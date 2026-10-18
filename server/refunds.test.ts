import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type Stripe from 'stripe';
import { createDatabase, type Database } from './db.js';
import type { Config } from './config.js';
import { IglooStore, StoreError } from './store.js';
import { Payments } from './payments.js';
import { Refunds, type RefundOperation, type RefundRequest } from './refunds.js';

let db: Database;
let store: IglooStore;
const staff = 'staff@example.test';
const config: Config = { local: true, mock: false, mode: 'test', liveAllowed: false,
  origin: 'http://127.0.0.1:5173', secret: 'refund-test-secret-at-least-thirty-two-characters',
  stripeKey: 'rk_test_no_network_fixture', stripeAccount: 'acct_fixture',
  adminEmails: [staff], emailEnabled: false, refundsEnabled: true };
before(async () => { db = await createDatabase({ localPath: 'memory://' }); store = new IglooStore(db); await store.init(); });
after(async () => { await db.close(); });
beforeEach(async () => { await db.query('TRUNCATE igloo_bookings,igloo_slots,igloo_packages CASCADE'); });
const hasCode = (code: string) => (error: unknown) => error instanceof StoreError && error.code === code;

async function fixture(overrides: Partial<Config> = {}) {
  const settings = { ...config, ...overrides };
  const item = await store.savePackage({ name: 'Refund fixture', description: 'Test only', durationMinutes: 90,
    amountCents: 12_345, currency: 'usd', maxGuests: 8, status: 'active', policyText: 'Studio closure only.' });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00.000Z', endsAt: '2090-10-21T22:30:00.000Z', capacity: 1, status: 'open' });
  const booking = await store.createHold({ packageId: item.id, slotId: slot.id, name: 'Fixture Guest', email: 'guest@example.test',
    guests: 4, policyAccepted: true, requestId: randomUUID() }, { livemode: settings.mode === 'live' });
  const intent = `pi_fixture_${booking.id.replaceAll('-','')}`;
  // A synthetic 5% test tax verifies full gross refunds, not a venue tax recommendation.
  await db.query('UPDATE igloo_bookings SET tax_cents=617,total_cents=12962 WHERE id=$1', [booking.id]);
  await store.attachCheckout(booking.id, { sessionId: `cs_${booking.id}`, url: 'https://checkout.stripe.com/test-fixture',
    expiresAt: new Date(Date.now() + 1_860_000).toISOString(), livemode: booking.livemode, amountCents: 12962, currency: 'usd' });
  await store.applyStripeEvent({ eventId: `evt_paid_${booking.id}`, bookingId: booking.id, sessionId: `cs_${booking.id}`,
    paymentIntentId: intent, livemode: booking.livemode, amountCents: 12962, currency: 'usd', paymentStatus: 'paid',
    sessionStatus: 'complete', type: 'checkout.session.completed' });
  await store.saveSlot({ ...slot, status: 'closed' });
  const payments = new Payments(store, settings);
  if (payments.stripe) {
    Object.assign(payments.stripe.accounts, { retrieveCurrent: async () => ({ id: 'acct_fixture', charges_enabled: true }) });
    Object.assign(payments.stripe.refunds, {
      create: async () => { throw new Error('Unexpected refund create: network is forbidden in tests.'); },
      retrieve: async () => { throw new Error('Unexpected refund retrieve: network is forbidden in tests.'); },
    });
  }
  const refunds = new Refunds(store, settings, payments);
  const input: RefundRequest = { bookingId: booking.id, requestId: randomUUID(), reason: 'weather', note: 'Studio closed for unsafe weather.' };
  return { settings, item, slot, booking, payments, refunds, input, intent };
}
function refund(op: RefundOperation, overrides: Record<string, unknown> = {}): Stripe.Refund {
  return { id: `re_fixture_${op.id.replaceAll('-','')}`, object: 'refund', amount: op.amountCents, currency: op.currency,
    payment_intent: op.paymentIntentId, metadata: { booking_id: op.bookingId, refund_operation_id: op.id },
    status: 'succeeded', ...overrides } as unknown as Stripe.Refund;
}
function event(current: Stripe.Refund, type = 'refund.updated', livemode = false): Stripe.Event {
  return { id: `evt_${randomUUID()}`, object: 'event', type, livemode, data: { object: current } } as Stripe.Event;
}
async function remaining() { return (await store.listSlots(true))[0]!.remaining; }

test('refund requests are restricted to staff, confirmed bookings, closed seatings and verified payments', async () => {
  const f = await fixture();
  await assert.rejects(f.refunds.request(f.input, 'guest@example.test'), hasCode('FORBIDDEN'));
  await assert.rejects(f.refunds.request({ ...f.input, reason: 'customer_request' as 'weather' }, staff), hasCode('INVALID_INPUT'));
  await assert.rejects(f.refunds.request({ ...f.input, note: '' }, staff), hasCode('INVALID_INPUT'));
  await store.saveSlot({ ...f.slot, status: 'open' });
  await assert.rejects(f.refunds.request(f.input, staff), hasCode('SLOT_MUST_BE_CLOSED'));
  await store.saveSlot({ ...f.slot, status: 'closed' });
  await db.query('UPDATE igloo_bookings SET payment_intent_id=NULL WHERE id=$1', [f.booking.id]);
  await assert.rejects(f.refunds.request(f.input, staff), hasCode('PAYMENT_NOT_VERIFIED'));
  await db.query("UPDATE igloo_bookings SET payment_intent_id=$2,status='held' WHERE id=$1", [f.booking.id, f.intent]);
  await assert.rejects(f.refunds.request(f.input, staff), hasCode('REFUND_NOT_ALLOWED'));
  assert.equal((await f.refunds.list()).length, 0);
});

test('refund creation remains closed by default and payment modes must match', async () => {
  const f = await fixture({ refundsEnabled: false });
  await assert.rejects(f.refunds.request(f.input, staff), hasCode('REFUNDS_DISABLED'));
  await f.refunds.processNext();
  assert.equal((await f.refunds.list()).length, 0);
  f.settings.refundsEnabled = true;
  f.settings.mode = 'live';
  await assert.rejects(f.refunds.request(f.input, staff), hasCode('PAYMENT_MODE_MISMATCH'));
});

test('request replay is audited once, conflicts are rejected, and a booking has only one immutable operation', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  assert.deepEqual(await f.refunds.request(f.input, staff), op);
  assert.equal(op.amountCents, 12962);
  assert.equal(op.paymentIntentId, f.intent);
  assert.equal(op.actor, staff);
  assert.equal(op.status, 'requested');
  await assert.rejects(f.refunds.request({ ...f.input, note: 'Changed details' }, staff), hasCode('IDEMPOTENCY_CONFLICT'));
  await assert.rejects(f.refunds.request({ ...f.input, requestId: randomUUID() }, staff), hasCode('REFUND_EXISTS'));
  assert.equal((await db.query('SELECT * FROM igloo_refund_events')).rows.length, 1);
  assert.equal(await remaining(), 0);
  assert.equal((await store.getBooking(f.booking.id))!.status, 'confirmed');
});

test('full gross refund is durable before Stripe, and capacity releases only on freshly retrieved success', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  let creates = 0;
  let latest = refund(op, { status: 'pending' });
  Object.assign(f.payments.stripe!.refunds, {
    create: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
      creates += 1;
      const saved = (await f.refunds.getForBooking(f.booking.id))!;
      assert.ok(saved.attemptedAt);
      assert.equal(saved.status, 'pending');
      assert.equal(params.amount, 12962);
      assert.equal(params.payment_intent, f.intent);
      assert.equal('reason' in params, false);
      assert.deepEqual(options, { idempotencyKey: `sodus-igloo-refund:${op.id}`, maxNetworkRetries: 0, timeout: 10_000 });
      return refund(op); // Cached creation status is deliberately different from the fresh read.
    },
    retrieve: async () => latest,
  });
  await f.refunds.processBooking(f.booking.id);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'pending');
  assert.equal((await store.getBooking(f.booking.id))!.status, 'confirmed');
  assert.equal(await remaining(), 0);
  latest = refund(op);
  await f.refunds.processBooking(f.booking.id);
  const completed = (await f.refunds.getForBooking(f.booking.id))!;
  assert.equal(creates, 1);
  assert.equal(completed.status, 'succeeded');
  assert.ok(completed.completedAt);
  assert.equal((await store.getBooking(f.booking.id))!.status, 'cancelled');
  assert.ok((await store.getBooking(f.booking.id))!.refundedAt);
  assert.equal(await remaining(), 1);
  assert.equal((await store.listSlots()).length, 0, 'the refunded seating remains closed');
});

test('unknown creation outcome retries the same operation and key within its safe retry window', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  const calls: { params: unknown; options: unknown }[] = [];
  Object.assign(f.payments.stripe!.refunds, {
    create: async (params: unknown, options: unknown) => {
      calls.push({ params: structuredClone(params), options: structuredClone(options) });
      if (calls.length === 1) throw new Error('Lost response after Stripe may have created the refund.');
      return refund(op);
    }, retrieve: async () => refund(op),
  });
  await f.refunds.processBooking(f.booking.id);
  const firstAttempt = (await f.refunds.getForBooking(f.booking.id))!.attemptedAt;
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'pending');
  assert.equal(await remaining(), 0);
  await f.refunds.processBooking(f.booking.id);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.attemptedAt, firstAttempt);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'succeeded');
});

test('an unknown creation older than 23 hours stops for review without a fresh request', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  await db.query("UPDATE igloo_refund_operations SET attempted_at=now()-interval '24 hours',status='pending' WHERE id=$1", [op.id]);
  await f.refunds.processBooking(f.booking.id);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'needs_review');
  assert.equal(await remaining(), 0);
  await assert.rejects(f.refunds.processBooking(f.booking.id), hasCode('REFUND_BUSY'));
});

test('a returned refund ID survives a failed follow-up read and is retrieved without another create', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  let creates = 0;
  let reads = 0;
  Object.assign(f.payments.stripe!.refunds, {
    create: async () => { creates += 1; return refund(op); },
    retrieve: async () => { reads += 1; if (reads === 1) throw new Error('Network failed'); return refund(op); },
  });
  await f.refunds.processBooking(f.booking.id);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.refundId, refund(op).id);
  await db.query("UPDATE igloo_refund_operations SET attempted_at=now()-interval '2 days' WHERE id=$1", [op.id]);
  await f.refunds.processBooking(f.booking.id);
  assert.equal(creates, 1);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'succeeded');
});

for (const [label, mutation] of Object.entries({ partial: { amount: 100 }, currency: { currency: 'eur' },
  payment: { payment_intent: 'pi_unrelated' }, metadata: { metadata: {} }, mode: { livemode: true } })) {
  test(`a ${label} mismatch cannot cancel a booking or release inventory`, async () => {
    const f = await fixture();
    const op = await f.refunds.request(f.input, staff);
    Object.assign(f.payments.stripe!.refunds, { create: async () => refund(op, mutation) });
    await f.refunds.processBooking(f.booking.id);
    assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'needs_review');
    assert.equal((await store.getBooking(f.booking.id))!.status, 'confirmed');
    assert.equal(await remaining(), 0);
  });
}

test('permission rejection is held for staff review without releasing or silently retrying a refund', async () => {
  const f = await fixture();
  await f.refunds.request(f.input, staff);
  let calls = 0;
  Object.assign(f.payments.stripe!.refunds, { create: async () => { calls += 1; throw { statusCode: 403 }; } });
  await f.refunds.processBooking(f.booking.id);
  await f.refunds.processNext();
  assert.equal(calls, 1);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'needs_review');
  assert.equal(await remaining(), 0);
});

test('failed and action-required refunds retain the reservation until a current successful refund is verified', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  let latest = refund(op, { status: 'failed' });
  Object.assign(f.payments.stripe!.refunds, { create: async () => latest, retrieve: async () => latest });
  await f.refunds.processBooking(f.booking.id);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'failed');
  assert.equal(await remaining(), 0);
  latest = refund(op, { status: 'requires_action' });
  await f.refunds.processBooking(f.booking.id);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'needs_review');
  assert.equal(await remaining(), 0);
  latest = refund(op);
  await f.refunds.processBooking(f.booking.id);
  assert.equal(await remaining(), 1);
});

test('webhooks use the current Stripe object, recover unknown outcomes, and never restore a refunded booking after later failure', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  let latest = refund(op);
  let reads = 0;
  Object.assign(f.payments.stripe!.refunds, { retrieve: async () => { reads += 1; return latest; } });
  const stale = event(refund(op, { status: 'pending' }), 'refund.created');
  await f.refunds.webhook(stale);
  await f.refunds.webhook(stale);
  assert.equal(reads, 2, 'duplicate event still reconciles from current data');
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'succeeded');
  assert.equal((await db.query('SELECT * FROM igloo_refund_events WHERE stripe_event_id=$1', [stale.id])).rows.length, 1);
  const completed = (await f.refunds.getForBooking(f.booking.id))!.completedAt;
  latest = refund(op, { status: 'failed' });
  await f.refunds.webhook(event(refund(op), 'refund.failed'));
  const failed = (await f.refunds.getForBooking(f.booking.id))!;
  assert.equal(failed.status, 'needs_review');
  assert.equal(failed.completedAt, completed);
  assert.equal((await store.getBooking(f.booking.id))!.status, 'cancelled');
  assert.equal(await remaining(), 1);
  await store.applyStripeEvent({ eventId: `evt_late_${randomUUID()}`, bookingId: f.booking.id, sessionId: `cs_${f.booking.id}`,
    paymentIntentId: f.intent, livemode: false, amountCents: 12962, currency: 'usd', paymentStatus: 'paid',
    sessionStatus: 'complete', type: 'checkout.session.completed' });
  assert.equal((await store.getBooking(f.booking.id))!.status, 'cancelled');
  assert.equal(await remaining(), 1);
});

test('unrelated and wrong-mode webhook events cannot operate on a booking', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  await f.refunds.webhook(event(refund(op, { id: 're_unrelated', metadata: {} })));
  await assert.rejects(f.refunds.webhook(event(refund(op), 'refund.updated', true)), hasCode('REFUND_MISMATCH'));
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'requested');
  assert.equal(await remaining(), 0);
});

test('a claim serializes concurrent workers and a webhook waits for the same operation', async () => {
  const f = await fixture();
  const op = await f.refunds.request(f.input, staff);
  let release!: () => void;
  let started!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  let creates = 0;
  Object.assign(f.payments.stripe!.refunds, { create: async () => { creates += 1; started(); await barrier; return refund(op); }, retrieve: async () => refund(op) });
  const first = f.refunds.processBooking(f.booking.id);
  await entered;
  await assert.rejects(f.refunds.processBooking(f.booking.id), hasCode('REFUND_BUSY'));
  await assert.rejects(f.refunds.webhook(event(refund(op))), hasCode('REFUND_BUSY'));
  await f.refunds.processNext();
  release();
  await first;
  assert.equal(creates, 1);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'succeeded');
});

test('local simulation uses no Stripe client and cannot refund a live booking', async () => {
  const f = await fixture({ mock: true, refundsEnabled: false });
  assert.equal(f.payments.stripe, null);
  await f.refunds.request(f.input, staff);
  await f.refunds.processNext();
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'succeeded');
  assert.equal(await remaining(), 1);
});

test('live closure refunds verify account identity and use bounded calls even when new charges are paused', async () => {
  const f = await fixture({ mode: 'live', stripeKey: 'rk_live_fixture' });
  const op = await f.refunds.request(f.input, staff);
  let reads = 0;
  Object.assign(f.payments.stripe!.accounts, { retrieveCurrent: async (_params: unknown, options: unknown) => {
    assert.deepEqual(options, { maxNetworkRetries: 0, timeout: 10_000 });
    return { id: config.stripeAccount, charges_enabled: false };
  } });
  Object.assign(f.payments.stripe!.refunds, {
    create: async (_params: unknown, options: unknown) => {
      assert.deepEqual(options, { maxNetworkRetries: 0, timeout: 10_000, idempotencyKey: `sodus-igloo-refund:${op.id}` });
      return refund(op);
    },
    retrieve: async (_id: string, _params: unknown, options: unknown) => {
      reads += 1;
      assert.deepEqual(options, { maxNetworkRetries: 0, timeout: 10_000 });
      return refund(op);
    },
  });
  await f.refunds.processBooking(f.booking.id);
  assert.equal(reads, 1);
  assert.equal((await f.refunds.getForBooking(f.booking.id))!.status, 'succeeded');
  assert.equal(await remaining(), 1);
});
