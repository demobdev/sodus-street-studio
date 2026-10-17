import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database } from './db.js';
import { IglooStore, StoreError, type Booking, type HoldInput, type PaymentEvidence } from './store.js';

let db: Database;
let store: IglooStore;
const firstStaff = 'demo@example.test';
const secondStaff = 'maat@example.test';
const hasCode = (code: string) => (error: unknown) => error instanceof StoreError && error.code === code;

before(async () => {
  db = await createDatabase({ localPath: 'memory://' });
  store = new IglooStore(db);
  await store.init();
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.query('TRUNCATE igloo_cancellation_requests,igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});

async function fixture(capacity = 1) {
  const item = await store.savePackage({ name: 'Cancellation review fixture', description: 'Local test only', durationMinutes: 90,
    amountCents: 22_500, currency: 'usd', maxGuests: 8, policyText: 'Test policy only.', status: 'active' });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00.000Z', endsAt: '2090-10-21T22:30:00.000Z', capacity, status: 'open' });
  const input = (): HoldInput => ({ packageId: item.id, slotId: slot.id, name: 'Test Guest', email: 'guest@example.test',
    guests: 4, policyAccepted: true, requestId: randomUUID() });
  const hold = () => store.createHold(input(), { livemode: false });
  const confirmed = async () => store.applyStripeEvent(evidence(await hold()));
  return { slot, input, hold, confirmed };
}

function evidence(booking: Booking, fields: Partial<PaymentEvidence> = {}): PaymentEvidence {
  return { eventId: `evt_${randomUUID()}`, bookingId: booking.id, sessionId: booking.sessionId ?? `cs_test_${booking.id}`,
    livemode: false, amountCents: booking.amountCents, currency: 'usd', paymentStatus: 'paid', sessionStatus: 'complete',
    type: 'checkout.session.completed', ...fields };
}

async function activeRequest(bookingId: string) {
  const booking = (await store.listManagedBookings()).find(item => item.id === bookingId);
  assert.ok(booking?.cancellationRequest);
  return booking.cancellationRequest;
}

test('only confirmed reservations accept a cancellation review and invalid reasons create no audit record', async () => {
  const f = await fixture(6);
  for (const status of ['held', 'awaiting_payment', 'expired', 'cancelled', 'needs_review']) {
    const booking = await f.hold();
    await db.query('UPDATE igloo_bookings SET status=$2 WHERE id=$1', [booking.id, status]);
    await assert.rejects(store.requestCancellation(booking.id, 'Guest requested a discussion.', firstStaff), hasCode('BOOKING_NOT_CONFIRMED'));
  }
  const confirmed = await f.confirmed();
  for (const reason of ['', ' \n\t ', 'x'.repeat(1_001)]) {
    await assert.rejects(store.requestCancellation(confirmed.id, reason, firstStaff), hasCode('INVALID_INPUT'));
  }
  await assert.rejects(store.requestCancellation(confirmed.id, 'Valid reason', ''), hasCode('INVALID_INPUT'));
  await assert.rejects(store.requestCancellation(randomUUID(), 'Valid reason', firstStaff), hasCode('NOT_FOUND'));
  assert.equal((await db.query('SELECT id FROM igloo_cancellation_requests')).rowCount, 0);
});

test('duplicate and simultaneous cancellation review requests preserve the first staff identity and reason', async () => {
  const f = await fixture();
  const booking = await f.confirmed();
  await Promise.all([
    store.requestCancellation(booking.id, '  Guest called about a cancellation.  ', firstStaff),
    store.requestCancellation(booking.id, 'Guest called about a cancellation.', firstStaff),
  ]);
  const original = await activeRequest(booking.id);
  await Promise.all([
    store.requestCancellation(booking.id, 'Guest called about a cancellation.', secondStaff),
    store.requestCancellation(booking.id, ' Guest called about a cancellation. ', firstStaff),
  ]);
  assert.deepEqual(await activeRequest(booking.id), original);
  assert.equal(original.requestedBy, firstStaff);
  assert.equal(original.reason, 'Guest called about a cancellation.');
  assert.equal((await db.query('SELECT id FROM igloo_cancellation_requests')).rowCount, 1);
  await assert.rejects(store.requestCancellation(booking.id, 'A different reason from a stale screen.', secondStaff), hasCode('CANCELLATION_EXISTS'));
  assert.deepEqual(await activeRequest(booking.id), original);
});

test('flagging and withdrawing keep paid inventory reserved through delayed payment deliveries and do not enqueue notices', async () => {
  const f = await fixture();
  const booking = await f.confirmed();
  await Promise.all([
    store.requestCancellation(booking.id, 'Guest asked staff to review options.', firstStaff),
    store.applyStripeEvent(evidence(booking)),
  ]);
  const request = await activeRequest(booking.id);
  await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.expired', sessionStatus: 'expired', paymentStatus: 'unpaid' }));
  await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.async_payment_failed', paymentStatus: 'unpaid' }));
  assert.equal((await store.getBooking(booking.id))?.status, 'confirmed');
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  await assert.rejects(store.createHold(f.input(), { livemode: false }), hasCode('SOLD_OUT'));
  const eventCount = (await db.query('SELECT event_id FROM igloo_payment_events')).rowCount;
  await store.withdrawCancellation(booking.id, request.id, secondStaff);
  assert.equal((await store.getBooking(booking.id))?.status, 'confirmed');
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  assert.equal((await db.query('SELECT event_id FROM igloo_payment_events')).rowCount, eventCount);
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rowCount, 1, 'only the original paid confirmation exists');
  assert.equal((await store.getBooking(booking.id))?.emailStatus, 'pending');
  assert.equal((await store.listManagedBookings())[0]!.cancellationRequest, null);
});

test('withdrawing a cancellation review cannot clear a later payment mismatch or release its inventory', async () => {
  const f = await fixture();
  const booking = await f.confirmed();
  await store.requestCancellation(booking.id, 'Staff are checking the guest request.', firstStaff);
  const request = await activeRequest(booking.id);
  const mismatched = await store.applyStripeEvent(evidence(booking, { amountCents: 1 }));
  assert.equal(mismatched.status, 'needs_review');
  await store.withdrawCancellation(booking.id, request.id, secondStaff);
  const current = await store.getBooking(booking.id);
  assert.equal(current?.status, 'needs_review');
  assert.equal(current?.reviewReason, mismatched.reviewReason);
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  assert.equal((await store.listManagedBookings())[0]!.cancellationRequest, null);
});

test('withdrawals preserve the audit trail and stale retries cannot withdraw a newly opened request', async () => {
  const f = await fixture(2);
  const booking = await f.confirmed();
  const other = await f.confirmed();
  await store.requestCancellation(booking.id, 'First inquiry from guest.', firstStaff);
  const first = await activeRequest(booking.id);
  await assert.rejects(store.withdrawCancellation(other.id, first.id, secondStaff), hasCode('NOT_FOUND'));
  await store.withdrawCancellation(booking.id, first.id, secondStaff);
  const withdrawn = (await db.query('SELECT * FROM igloo_cancellation_requests WHERE id=$1', [first.id])).rows[0]!;
  assert.equal(withdrawn.requested_by, firstStaff);
  assert.equal(withdrawn.withdrawn_by, secondStaff);
  assert.ok(withdrawn.requested_at);
  assert.ok(withdrawn.withdrawn_at);
  await store.requestCancellation(booking.id, 'A new request after guest called again.', firstStaff);
  const reopened = await activeRequest(booking.id);
  assert.notEqual(reopened.id, first.id);
  await store.withdrawCancellation(booking.id, first.id, firstStaff);
  assert.deepEqual(await activeRequest(booking.id), reopened);
  assert.deepEqual((await db.query('SELECT * FROM igloo_cancellation_requests WHERE id=$1', [first.id])).rows[0], withdrawn);
  assert.equal((await db.query('SELECT id FROM igloo_cancellation_requests WHERE booking_id=$1', [booking.id])).rowCount, 2);
  await store.init();
  assert.deepEqual(await activeRequest(booking.id), reopened, 'reapplying the additive schema retains review history');
});

test('an older active cancellation review stays visible ahead of recent bookings in the limited management list', async () => {
  const f = await fixture(3);
  const older = await f.confirmed();
  const newer = await f.confirmed();
  const newest = await f.confirmed();
  await db.query("UPDATE igloo_bookings SET created_at='2026-10-01T12:00:00Z' WHERE id=$1", [older.id]);
  await db.query("UPDATE igloo_bookings SET created_at='2026-10-02T12:00:00Z' WHERE id=$1", [newer.id]);
  await db.query("UPDATE igloo_bookings SET created_at='2026-10-03T12:00:00Z' WHERE id=$1", [newest.id]);
  await store.requestCancellation(older.id, 'Still needs a staff conversation.', firstStaff);
  const limited = await store.listManagedBookings(2);
  assert.deepEqual(limited.map(booking => booking.id), [older.id, newest.id]);
  const request = await activeRequest(older.id);
  await store.withdrawCancellation(older.id, request.id, secondStaff);
  assert.deepEqual((await store.listManagedBookings(2)).map(booking => booking.id), [newest.id, newer.id]);
});
