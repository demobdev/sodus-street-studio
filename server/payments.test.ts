import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createDatabase, type Database } from './db.js';
import { IglooStore, StoreError, type Booking } from './store.js';
import { Payments } from './payments.js';
import type { Config } from './config.js';
import { runBookingJobs } from './jobs.js';

const config: Config = {
  local: true, mock: false, mode: 'test', liveAllowed: false, origin: 'http://127.0.0.1:5173',
  secret: 'payments-test-secret-with-at-least-thirty-two-characters',
  stripeKey: 'rk_test_local_fixture_only', stripeAccount: 'acct_expected_fixture',
  webhookSecret: 'whsec_local_fixture_only', adminEmails: [], emailEnabled: false,
};
let db: Database;
let store: IglooStore;
before(async () => {
  db = await createDatabase({ localPath: 'memory://' });
  store = new IglooStore(db);
  await store.init();
});
beforeEach(async () => {
  await db.query('TRUNCATE igloo_booking_alerts,igloo_refund_events,igloo_refund_operations,igloo_cancellation_requests,igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});
after(async () => { await db.close(); });

async function fixture(capacity = 1, overrides: Partial<Config> = {}) {
  const settings = { ...config, ...overrides };
  const item = await store.savePackage({
    name: 'Test igloo', description: 'Fixture only.', durationMinutes: 90, amountCents: 12_345,
    currency: 'usd', maxGuests: 6, policyText: 'Test policy only.', status: 'active',
  });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00.000Z', endsAt: '2090-10-21T22:30:00.000Z', capacity, status: 'open' });
  const hold = () => store.createHold({
    packageId: item.id, slotId: slot.id, name: 'Test Guest', email: 'guest@example.test',
    guests: 3, policyAccepted: true, requestId: randomUUID(),
  }, { livemode: settings.mode === 'live' });
  const payments = new Payments(store, settings);
  // Replace every network method used in these tests; SDK webhook signing remains real.
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async () => ({ id: config.stripeAccount, charges_enabled: true }) });
  Object.assign(payments.stripe!.taxRates, { retrieve: async () => { throw new Error('Unexpected tax rate read in test.'); } });
  Object.assign(payments.stripe!.checkout.sessions, {
    create: async () => { throw new Error('Unexpected session creation in test.'); },
    retrieve: async () => { throw new Error('Unexpected session retrieval in test.'); },
  });
  return { payments, hold, settings };
}

function session(booking: Booking, params: Record<string, unknown> = {}) {
  return {
    id: `cs_test_${booking.id}`, object: 'checkout.session', url: 'https://checkout.stripe.com/test-fixture',
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60, livemode: booking.livemode, amount_total: booking.amountCents,
    currency: 'usd', metadata: { booking_id: booking.id }, payment_status: 'unpaid', status: 'open', ...params,
  };
}

test('the current Stripe account must match before checkout can be created', async () => {
  const { payments, hold } = await fixture();
  const booking = await hold();
  let creates = 0;
  let currentAccountReads = 0;
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async () => {
    currentAccountReads += 1;
    return { id: 'acct_wrong_fixture' };
  } });
  Object.assign(payments.stripe!.checkout.sessions, { create: async () => { creates += 1; return session(booking); } });
  await assert.rejects(payments.checkout(booking), /Stripe account mismatch/);
  assert.equal(currentAccountReads, 1);
  assert.equal(creates, 0);
  assert.equal((await store.getBooking(booking.id))?.status, 'held');
});

test('approved exclusive tax is snapshotted before Checkout and matching signed totals confirm once', async () => {
  const { payments, hold } = await fixture(1, { stripeTaxRateId: 'txr_fixture', taxApproved: true });
  const booking = await hold();
  // Synthetic 5% fixture, deliberately not a tax recommendation for the venue.
  Object.assign(payments.stripe!.taxRates, { retrieve: async () => ({ id: 'txr_fixture', active: true, inclusive: false, livemode: false, percentage: 5 }) });
  Object.assign(payments.stripe!.checkout.sessions, { create: async (params: Record<string, unknown>) => {
    assert.deepEqual((params.line_items as { tax_rates: string[] }[])[0]?.tax_rates, ['txr_fixture']);
    assert.equal('automatic_tax' in params, false);
    const saved = (await store.getBooking(booking.id))!;
    assert.deepEqual([saved.amountCents, saved.taxCents, saved.totalCents, saved.taxRateId, saved.taxPercentage], [12_345, 617, 12_962, 'txr_fixture', 5]);
    return session(booking, { amount_subtotal: 12_345, amount_total: 12_962, total_details: { amount_tax: 617 } });
  } });
  const checkedOut = await payments.checkout(booking);
  assert.equal(checkedOut.status, 'held');
  const payload = JSON.stringify({ id: 'evt_tax_fixture', object: 'event', type: 'checkout.session.completed', livemode: false,
    data: { object: session(booking, { amount_subtotal: 12_345, amount_total: 12_962, total_details: { amount_tax: 617 }, payment_status: 'paid', status: 'complete' }) } });
  const signature = payments.stripe!.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret! });
  await payments.webhook(Buffer.from(payload), signature);
  await payments.webhook(Buffer.from(payload), signature);
  assert.equal((await store.getBooking(booking.id))?.status, 'confirmed');
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1);
});

test('tax snapshots survive a lost Checkout response and later configuration changes', async () => {
  const { payments, hold, settings } = await fixture(1, { stripeTaxRateId: 'txr_fixture', taxApproved: true });
  const booking = await hold();
  let rateReads = 0;
  let creates = 0;
  let firstParams: Record<string, unknown>;
  Object.assign(payments.stripe!.taxRates, { retrieve: async () => { rateReads += 1; return { id: 'txr_fixture', active: true, inclusive: false, livemode: false, percentage: 5 }; } });
  Object.assign(payments.stripe!.checkout.sessions, { create: async (params: Record<string, unknown>) => {
    creates += 1;
    if (creates === 1) { firstParams = structuredClone(params); throw new Error('Lost response'); }
    assert.deepEqual(params, firstParams);
    return session(booking, { amount_subtotal: 12_345, amount_total: 12_962, total_details: { amount_tax: 617 } });
  } });
  await assert.rejects(payments.checkout(booking), /Lost response/);
  settings.stripeTaxRateId = 'txr_changed';
  const retried = await payments.checkout((await store.getBooking(booking.id))!);
  assert.equal(rateReads, 1);
  assert.equal(retried.taxRateId, 'txr_fixture');
  assert.equal(retried.totalCents, 12_962);
  assert.equal(retried.status, 'held');
});

test('missing, inactive, inclusive, or wrong-mode tax cannot start a live checkout', async () => {
  const { payments, hold, settings } = await fixture(1, { mode: 'live', stripeKey: 'rk_live_fixture', taxApproved: false });
  const booking = await hold();
  await assert.rejects(payments.checkout(booking), (error: unknown) => error instanceof StoreError && error.code === 'TAX_NOT_CONFIGURED');
  settings.taxApproved = true;
  settings.stripeTaxRateId = 'txr_fixture';
  for (const invalid of [{ active: false }, { inclusive: true }, { livemode: false }, { rate_type: 'flat_amount' }]) {
    Object.assign(payments.stripe!.taxRates, { retrieve: async () => ({ id: 'txr_fixture', active: true, inclusive: false, livemode: true, percentage: 5, ...invalid }) });
    await assert.rejects(payments.checkout(booking), (error: unknown) => error instanceof StoreError && error.code === 'TAX_NOT_CONFIGURED');
  }
  assert.equal((await store.getBooking(booking.id))?.checkoutParams, null);
});

test('a live Stripe account without charges enabled cannot create Checkout', async () => {
  const { payments, hold } = await fixture(1, { mode: 'live', stripeKey: 'rk_live_fixture', taxApproved: true, stripeTaxRateId: 'txr_fixture' });
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async () => ({ id: config.stripeAccount, charges_enabled: false }) });
  await assert.rejects(payments.checkout(await hold()), /not enabled live payments/);
});

test('identity-only refund verification permits paused charges without bypassing checkout verification', async () => {
  const { payments } = await fixture(1, { mode: 'live', stripeKey: 'rk_live_fixture' });
  let enabled = false;
  const options: unknown[] = [];
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async (_params: unknown, requestOptions: unknown) => {
    options.push(requestOptions);
    return { id: config.stripeAccount, charges_enabled: enabled };
  } });
  await payments.verifyAccount({ requireCharges: false });
  assert.deepEqual(options[0], { maxNetworkRetries: 0, timeout: 10_000 });
  await assert.rejects(payments.verifyAccount(), /not enabled live payments/);
  enabled = true;
  await payments.verifyAccount();
  assert.equal(options.length, 2, 'a paused checkout must refresh the account on its next attempt');
  assert.equal(options[1], undefined, 'ordinary checkout keeps its existing Stripe retry settings');
});

test('signed refund webhooks dispatch while charges are paused and still require the expected Stripe account', async () => {
  const { payments, hold } = await fixture(1, { mode: 'live', stripeKey: 'rk_live_fixture' });
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async () => ({ id: config.stripeAccount, charges_enabled: false }) });
  const payload = JSON.stringify({ id: 'evt_refund_paused', object: 'event', type: 'refund.updated', livemode: true,
    data: { object: { id: 're_fixture', object: 'refund' } } });
  const signature = payments.stripe!.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret! });
  let dispatched = 0;
  await payments.webhook(Buffer.from(payload), signature, async () => { dispatched += 1; });
  assert.equal(dispatched, 1);
  await assert.rejects(payments.checkout(await hold()), /not enabled live payments/);
  await assert.rejects(payments.webhook(Buffer.from(`${payload} `), signature, async () => { dispatched += 1; }), /Invalid webhook signature/);
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async () => ({ id: 'acct_wrong', charges_enabled: false }) });
  await assert.rejects(payments.webhook(Buffer.from(payload), signature, async () => { dispatched += 1; }), /Stripe account mismatch/);
  assert.equal(dispatched, 1);
});

test('tax lookup failure releases only its never-attempted hold after TTL and a stale caller cannot create Checkout', async () => {
  const { payments, hold } = await fixture(1, { stripeTaxRateId: 'txr_fixture', taxApproved: true });
  const booking = await hold();
  Object.assign(payments.stripe!.taxRates, { retrieve: async () => { throw new Error('Tax lookup unavailable'); } });
  await assert.rejects(payments.checkout(booking), /Tax lookup unavailable/);
  assert.equal((await store.getBooking(booking.id))?.checkoutParams, null);
  assert.equal((await store.getBooking(booking.id))?.checkoutAttemptedAt, null);
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  await db.query("UPDATE igloo_bookings SET created_at=now()-interval '11 minutes' WHERE id=$1", [booking.id]);
  const job = await runBookingJobs(store, payments, config);
  assert.equal(job.expiredHolds, 1);
  assert.equal((await store.listSlots())[0]!.remaining, 1);
  await hold(); // Another guest can now reserve the released igloo.
  Object.assign(payments.stripe!.taxRates, { retrieve: async () => ({ id: 'txr_fixture', active: true, inclusive: false, livemode: false, percentage: 5 }) });
  let creates = 0;
  Object.assign(payments.stripe!.checkout.sessions, { create: async () => { creates += 1; return session(booking); } });
  await assert.rejects(payments.checkout(booking), (error: unknown) => error instanceof StoreError && error.code === 'HOLD_EXPIRED');
  await assert.rejects(payments.checkout((await store.getBooking(booking.id))!), (error: unknown) => error instanceof StoreError && error.code === 'HOLD_EXPIRED');
  assert.equal(creates, 0);
  assert.equal((await store.getBooking(booking.id))?.status, 'expired');
  assert.equal((await store.listSlots())[0]!.remaining, 0);
});

test('an unknown checkout outcome keeps inventory and retries identical persisted parameters and idempotency key', async () => {
  const { payments, hold } = await fixture();
  const booking = await hold();
  const calls: { params: Record<string, unknown>; options: Record<string, unknown> }[] = [];
  Object.assign(payments.stripe!.checkout.sessions, {
    create: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
      calls.push({ params: structuredClone(params), options: structuredClone(options) });
      const persisted = await store.getBooking(booking.id);
      assert.deepEqual(persisted?.checkoutParams, params, 'request parameters must be durable before Stripe receives them');
      if (calls.length === 1) throw new Error('Connection timed out after Stripe may have created the session.');
      return session(booking, { expires_at: params.expires_at });
    },
  });
  await assert.rejects(payments.checkout(booking), /timed out/);
  const unresolved = await store.getBooking(booking.id);
  assert.equal(unresolved?.status, 'held');
  assert.equal(unresolved?.sessionId, null);
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  const retried = await payments.checkout(unresolved!);
  assert.equal(retried.sessionId, `cs_test_${booking.id}`);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(calls[0]!.options.idempotencyKey, `sodus-igloo:${booking.id}`);
  assert.match(String(calls[0]!.params.integration_identifier), /^sodus_igloo_[a-z]{8}$/);
  assert.equal('payment_method_types' in calls[0]!.params, false);
  assert.equal('automatic_tax' in calls[0]!.params, false);
  assert.equal((await store.listBookings()).length, 1);
});

test('an unresolved creation beyond the retry window requires review without a new Stripe request', async () => {
  const { payments, hold } = await fixture();
  const booking = await hold();
  await store.prepareCheckout(booking.id, { mode: 'payment', expires_at: 1 });
  await db.query("UPDATE igloo_bookings SET checkout_attempted_at=now()-interval '24 hours' WHERE id=$1", [booking.id]);
  let creates = 0;
  Object.assign(payments.stripe!.checkout.sessions, { create: async () => { creates += 1; return session(booking); } });
  await assert.rejects(payments.checkout((await store.getBooking(booking.id))!),
    (error: unknown) => error instanceof StoreError && error.code === 'CHECKOUT_REVIEW');
  assert.equal(creates, 0);
  assert.equal((await store.getBooking(booking.id))?.status, 'needs_review');
  assert.equal((await store.listSlots())[0]!.remaining, 0);
});

test('real SDK webhook signature verification confirms a matching payment once and quarantines a signed amount mismatch', async () => {
  const { payments, hold } = await fixture(2);
  const matching = await hold();
  const mismatched = await hold();
  async function deliver(booking: Booking, eventId: string, amount = booking.amountCents) {
    const payload = JSON.stringify({
      id: eventId, object: 'event', type: 'checkout.session.completed', livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: { object: session(booking, { payment_status: 'paid', status: 'complete', amount_total: amount }) },
    });
    const signature = payments.stripe!.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret! });
    await payments.webhook(Buffer.from(payload), signature);
    return { payload, signature };
  }
  const first = await deliver(matching, 'evt_matching_fixture');
  assert.equal((await store.getBooking(matching.id))?.status, 'confirmed');
  assert.equal((await store.getBooking(matching.id))?.sessionId, `cs_test_${matching.id}`, 'webhook can precede the create response');
  await payments.webhook(Buffer.from(first.payload), first.signature);
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1);
  await deliver(mismatched, 'evt_mismatched_fixture', 1);
  assert.equal((await store.getBooking(mismatched.id))?.status, 'needs_review');
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1);
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  await assert.rejects(payments.webhook(Buffer.from(`${first.payload} `), first.signature),
    (error: unknown) => error instanceof StoreError && error.code === 'INVALID_SIGNATURE');
});
