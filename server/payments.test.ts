import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createDatabase, type Database } from './db.js';
import { IglooStore, StoreError, type Booking } from './store.js';
import { Payments } from './payments.js';
import type { Config } from './config.js';

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
  await db.query('TRUNCATE igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});
after(async () => { await db.close(); });

async function fixture(capacity = 1) {
  const item = await store.savePackage({
    name: 'Test igloo', description: 'Fixture only.', durationMinutes: 90, amountCents: 12_345,
    currency: 'usd', maxGuests: 6, policyText: 'Test policy only.', status: 'active',
  });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00.000Z', endsAt: '2090-10-21T22:30:00.000Z', capacity, status: 'open' });
  const hold = () => store.createHold({
    packageId: item.id, slotId: slot.id, name: 'Test Guest', email: 'guest@example.test',
    guests: 3, policyAccepted: true, requestId: randomUUID(),
  }, { livemode: false });
  const payments = new Payments(store, config);
  // Replace every network method used in these tests; SDK webhook signing remains real.
  Object.assign(payments.stripe!.accounts, { retrieveCurrent: async () => ({ id: config.stripeAccount }) });
  Object.assign(payments.stripe!.checkout.sessions, {
    create: async () => { throw new Error('Unexpected session creation in test.'); },
    retrieve: async () => { throw new Error('Unexpected session retrieval in test.'); },
  });
  return { payments, hold };
}

function session(booking: Booking, params: Record<string, unknown> = {}) {
  return {
    id: `cs_test_${booking.id}`, object: 'checkout.session', url: 'https://checkout.stripe.com/test-fixture',
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60, livemode: false, amount_total: booking.amountCents,
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
