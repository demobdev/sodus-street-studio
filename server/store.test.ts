import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database } from './db.js';
import { IglooStore, StoreError, type Booking, type HoldInput, type PaymentEvidence } from './store.js';

let db: Database;
let store: IglooStore;
before(async () => { db = await createDatabase({ localPath: 'memory://' }); store = new IglooStore(db); await store.init(); });
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.query('TRUNCATE igloo_cancellation_requests,igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});
async function fixture(capacity = 1) {
  const item = await store.savePackage({ name: 'Local test igloo', description: 'Test data only', durationMinutes: 90,
    amountCents: 12_345, currency: 'usd', maxGuests: 6, policyText: 'Test policy, not an approved sales package.', status: 'active' });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00.000Z', endsAt: '2090-10-21T22:30:00.000Z', capacity, status: 'open' });
  const input = (): HoldInput => ({ packageId: item.id, slotId: slot.id, name: 'Test Guest', email: 'guest@example.test',
    guests: 4, policyAccepted: true, requestId: randomUUID() });
  return { item, slot, input };
}
async function attach(booking: Booking) {
  return store.attachCheckout(booking.id, { sessionId: `cs_test_${booking.id}`, url: 'https://checkout.stripe.com/test-session',
    expiresAt: new Date(Date.now() + 1_860_000).toISOString(), livemode: false, amountCents: booking.amountCents, currency: 'usd' });
}
function evidence(booking: Booking, fields: Partial<PaymentEvidence> = {}): PaymentEvidence {
  return { eventId: `evt_${randomUUID()}`, bookingId: booking.id, sessionId: booking.sessionId ?? `cs_test_${booking.id}`,
    livemode: false, amountCents: booking.amountCents, currency: 'usd', paymentStatus: 'paid', sessionStatus: 'complete',
    type: 'checkout.session.completed', ...fields };
}
const hasCode = (code: string) => (error: unknown) => error instanceof StoreError && error.code === code;

test('only old never-attempted holds expire; recent requests, unknown outcomes and attached sessions keep inventory', async () => {
  const f = await fixture(5);
  const recent = await store.createHold(f.input(), { livemode: false });
  const abandoned = await store.createHold(f.input(), { livemode: false });
  const unknown = await store.createHold(f.input(), { livemode: false });
  const attempted = await store.createHold(f.input(), { livemode: false });
  const attached = await attach(await store.createHold(f.input(), { livemode: false }));
  await store.prepareCheckout(unknown.id, { mode: 'payment' });
  await db.query("UPDATE igloo_bookings SET checkout_attempted_at=now() WHERE id=$1", [attempted.id]);
  await db.query("UPDATE igloo_bookings SET created_at=now()-interval '1 day' WHERE id<>$1", [recent.id]);
  assert.equal(await store.expireUnattemptedHolds(), 1);
  assert.equal(await store.expireUnattemptedHolds(), 0);
  assert.equal((await store.getBooking(abandoned.id))?.status, 'expired');
  for (const b of [recent, unknown, attempted, attached]) assert.equal((await store.getBooking(b.id))?.status, 'held');
  assert.equal((await store.listSlots())[0]!.remaining, 1);
  await assert.rejects(store.prepareCheckout(abandoned.id, { mode: 'payment' }), hasCode('HOLD_EXPIRED'));
  await store.createHold(f.input(), { livemode: false });
  assert.equal((await store.listSlots())[0]!.remaining, 0);
});

test('expiry racing Checkout preparation cannot release inventory after the request becomes durable', async () => {
  const f = await fixture(2);
  const first = await store.createHold(f.input(), { livemode: false });
  await db.query("UPDATE igloo_bookings SET created_at=now()-interval '11 minutes' WHERE id=$1", [first.id]);
  const firstResults = await Promise.allSettled([store.prepareCheckout(first.id, { mode: 'payment' }), store.expireUnattemptedHolds()]);
  const firstSaved = (await store.getBooking(first.id))!;
  if (firstSaved.checkoutParams) { assert.equal(firstSaved.status, 'held'); assert.equal(firstResults[0]!.status, 'fulfilled'); }
  else { assert.equal(firstSaved.status, 'expired'); assert.equal(firstResults[0]!.status, 'rejected'); }

  const second = await store.createHold(f.input(), { livemode: false });
  await db.query("UPDATE igloo_bookings SET created_at=now()-interval '11 minutes' WHERE id=$1", [second.id]);
  const secondResults = await Promise.allSettled([store.expireUnattemptedHolds(), store.prepareCheckout(second.id, { mode: 'payment' })]);
  const secondSaved = (await store.getBooking(second.id))!;
  if (secondSaved.checkoutParams) { assert.equal(secondSaved.status, 'held'); assert.equal(secondResults[1]!.status, 'fulfilled'); }
  else { assert.equal(secondSaved.status, 'expired'); assert.equal(secondResults[1]!.status, 'rejected'); }
  for (const b of [firstSaved, secondSaved]) assert.equal(b.status === 'expired' && Boolean(b.checkoutParams), false);
});

test('taxed payment evidence must match subtotal, tax and total before confirmation', async () => {
  const f = await fixture(4);
  const variants = [
    { amountCents: 12_345, subtotalCents: 12_345, taxCents: 0 },
    { amountCents: 12_962, subtotalCents: 12_344, taxCents: 618 },
    { amountCents: 12_962 },
    { amountCents: 12_962, subtotalCents: 12_345, taxCents: 617 },
  ];
  for (const [i, fields] of variants.entries()) {
    const booking = await store.createHold(f.input(), { livemode: false });
    await store.prepareCheckout(booking.id, { line_items: [{ tax_rates: ['txr_fixture'] }] }, { rateId: 'txr_fixture', percentage: 5, taxCents: 617 });
    const result = await store.applyStripeEvent(evidence(booking, fields));
    assert.equal(result.status, i === 3 ? 'confirmed' : 'needs_review');
    assert.equal(result.totalCents, 12_962);
  }
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1);
});

test('re-running the additive schema keeps existing tax and package snapshots', async () => {
  const f = await fixture();
  const booking = await store.createHold(f.input(), { livemode: false });
  const params = { line_items: [{ tax_rates: ['txr_fixture'] }] };
  await store.prepareCheckout(booking.id, params, { rateId: 'txr_fixture', percentage: 5, taxCents: 617 });
  await store.init();
  assert.deepEqual(await store.prepareCheckout(booking.id, {}, { rateId: 'txr_different', percentage: 10, taxCents: 1235 }), params);
  const saved = (await store.getBooking(booking.id))!;
  assert.deepEqual([saved.amountCents, saved.taxCents, saved.totalCents, saved.taxRateId, saved.taxPercentage], [12_345, 617, 12_962, 'txr_fixture', 5]);
});

test('concurrent reservations for the last whole igloo permit exactly one booking', async () => {
  const f = await fixture();
  const results = await Promise.allSettled([store.createHold(f.input(), { livemode: false }), store.createHold(f.input(), { livemode: false })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
  assert.equal(failure.reason.code, 'SOLD_OUT');
  assert.equal((await store.listSlots())[0].remaining, 0);
  assert.equal((await store.listBookings()).length, 1);
});

test('retrying the same request is idempotent but changed details or account mode are rejected', async () => {
  const f = await fixture(); const input = f.input();
  const first = await store.createHold(input, { livemode: false });
  const replay = await store.createHold(input, { livemode: false });
  assert.equal(first.id, replay.id);
  await assert.rejects(store.createHold({ ...input, guests: 3 }, { livemode: false }), hasCode('IDEMPOTENCY_CONFLICT'));
  await assert.rejects(store.createHold(input, { livemode: true }), hasCode('IDEMPOTENCY_CONFLICT'));
});

test('duplicate payment delivery confirms and enqueues one email; later expiry cannot downgrade payment', async () => {
  const f = await fixture(); const booking = await attach(await store.createHold(f.input(), { livemode: false }));
  const event = evidence(booking);
  const results = await Promise.all([store.applyStripeEvent(event), store.applyStripeEvent(event)]);
  assert.ok(results.every((result) => result.status === 'confirmed'));
  assert.equal((await db.query('SELECT * FROM igloo_outbox')).rowCount, 1);
  const stale = await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.expired', sessionStatus: 'expired', paymentStatus: 'unpaid' }));
  assert.equal(stale.status, 'confirmed');
  assert.equal((await db.query('SELECT * FROM igloo_outbox')).rowCount, 1);
});

test('unpaid completion retains inventory until a successful asynchronous payment arrives', async () => {
  const f = await fixture(); const booking = await attach(await store.createHold(f.input(), { livemode: false }));
  const unpaid = await store.applyStripeEvent(evidence(booking, { paymentStatus: 'unpaid' }));
  assert.equal(unpaid.status, 'awaiting_payment');
  assert.equal((await db.query('SELECT * FROM igloo_outbox')).rowCount, 0);
  await assert.rejects(store.createHold(f.input(), { livemode: false }), hasCode('SOLD_OUT'));
  const paid = await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.async_payment_succeeded' }));
  assert.equal(paid.status, 'confirmed');
});

test('elapsed local expiry does not release a reservation; verified expired Checkout does', async () => {
  const f = await fixture(); const booking = await attach(await store.createHold(f.input(), { livemode: false }));
  await db.query("UPDATE igloo_bookings SET expires_at=now()-interval '1 day' WHERE id=$1", [booking.id]);
  assert.equal((await store.listSlots())[0].remaining, 0);
  await assert.rejects(store.createHold(f.input(), { livemode: false }), hasCode('SOLD_OUT'));
  const expired = await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.expired', sessionStatus: 'expired', paymentStatus: 'unpaid' }));
  assert.equal(expired.status, 'expired');
  assert.equal((await store.listSlots())[0].remaining, 1);
  assert.equal((await store.createHold(f.input(), { livemode: false })).status, 'held');
});

test('overlapping slot insertion and shrinking or moving reserved inventory are rejected', async () => {
  const f = await fixture(2);
  await assert.rejects(store.saveSlot({ startsAt: '2090-10-21T22:00:00Z', endsAt: '2090-10-21T23:30:00Z', capacity: 2, status: 'open' }), hasCode('SLOT_OVERLAP'));
  await store.createHold(f.input(), { livemode: false }); await store.createHold(f.input(), { livemode: false });
  await assert.rejects(store.saveSlot({ ...f.slot, capacity: 1 }), hasCode('CAPACITY_IN_USE'));
  await assert.rejects(store.saveSlot({ ...f.slot, startsAt: '2090-10-21T23:00:00Z', endsAt: '2090-10-22T00:30:00Z' }), hasCode('SLOT_IN_USE'));
  const outcomes = await Promise.allSettled([
    store.saveSlot({ startsAt: '2090-10-22T21:00:00Z', endsAt: '2090-10-22T22:30:00Z', capacity: 1, status: 'open' }),
    store.saveSlot({ startsAt: '2090-10-22T22:00:00Z', endsAt: '2090-10-22T23:30:00Z', capacity: 1, status: 'open' }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
});

test('tampered amount, currency, account mode and session identity cannot confirm a booking', async () => {
  const f = await fixture(4);
  for (const fields of [{ amountCents: 1 }, { currency: 'eur' }, { livemode: true }, { sessionId: 'cs_wrong' }]) {
    const booking = await attach(await store.createHold(f.input(), { livemode: false }));
    const result = await store.applyStripeEvent(evidence(booking, fields));
    assert.equal(result.status, 'needs_review');
    assert.equal((await store.applyStripeEvent(evidence(booking))).status, 'needs_review');
  }
  assert.equal((await db.query('SELECT * FROM igloo_outbox')).rowCount, 0);
  assert.equal((await store.listSlots())[0].remaining, 0);
});

test('payment webhook can attach a session before its create response and retries preserve exact creation parameters', async () => {
  const f = await fixture(); const booking = await store.createHold(f.input(), { livemode: false });
  const first = { expires_at: 900, metadata: { booking_id: booking.id }, amount: booking.amountCents };
  assert.deepEqual(await store.prepareCheckout(booking.id, first), first);
  assert.deepEqual(await store.prepareCheckout(booking.id, { expires_at: 901 }), first);
  const paid = await store.applyStripeEvent(evidence(booking));
  assert.equal(paid.status, 'confirmed');
  assert.equal(paid.sessionId, `cs_test_${booking.id}`);
  assert.deepEqual(paid.checkoutParams, first);
  assert.ok(paid.checkoutAttemptedAt);
  const response = await attach(paid);
  assert.equal(response.status, 'confirmed');
});

test('existing reservations retain their approved price, package name and policy after edits', async () => {
  const f = await fixture(); const booking = await store.createHold(f.input(), { livemode: false });
  await store.savePackage({ ...f.item, name: 'Changed package', amountCents: 20_000, policyText: 'Changed policy' });
  const stored = await store.getBooking(booking.id);
  assert.equal(stored?.amountCents, 12_345);
  assert.equal(stored?.packageName, 'Local test igloo');
  assert.equal(stored?.policyText, f.item.policyText);
});

test('late payment after released inventory requires manual review instead of confirming an oversold slot', async () => {
  const f = await fixture(); const booking = await attach(await store.createHold(f.input(), { livemode: false }));
  await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.async_payment_failed', paymentStatus: 'unpaid' }));
  await store.createHold(f.input(), { livemode: false });
  const result = await store.applyStripeEvent(evidence(booking, { type: 'checkout.session.async_payment_succeeded' }));
  assert.equal(result.status, 'needs_review');
  assert.equal((await db.query('SELECT * FROM igloo_outbox')).rowCount, 0);
});

test('confirmation outbox leases prevent duplicate workers and reject a stale worker completion', async () => {
  const f = await fixture(); const booking = await attach(await store.createHold(f.input(), { livemode: false }));
  await store.applyStripeEvent(evidence(booking));
  const first = (await store.claimConfirmationEmails())[0];
  assert.equal((await store.claimConfirmationEmails()).length, 0);
  await db.query("UPDATE igloo_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [first.id]);
  const second = (await store.claimConfirmationEmails())[0];
  assert.notEqual(first.claimToken, second.claimToken);
  await store.markEmailSent(first.id, first.claimToken, 'stale-worker');
  assert.equal((await store.getBooking(booking.id))?.emailStatus, 'sending');
  await store.markEmailSent(second.id, second.claimToken, 'email-provider-id');
  assert.equal((await store.getBooking(booking.id))?.emailStatus, 'sent');
  assert.equal((await store.claimConfirmationEmails()).length, 0);
});

test('uncertain checkout attempts retain inventory for review and cannot downgrade a confirmed reservation', async () => {
  const f = await fixture(2);
  const held = await store.createHold(f.input(), { livemode: false });
  const reviewed = await store.markNeedsReview(held.id, 'Unknown checkout outcome after the retry window.');
  assert.equal(reviewed.status, 'needs_review');
  assert.equal(reviewed.reviewReason, 'Unknown checkout outcome after the retry window.');
  const paid = await attach(await store.createHold(f.input(), { livemode: false }));
  await store.applyStripeEvent(evidence(paid));
  assert.equal((await store.markNeedsReview(paid.id, 'Stale reconciliation attempt.')).status, 'confirmed');
  assert.equal((await store.listSlots())[0].remaining, 0);
});

test('new reservations close 35 minutes before arrival while staff can still see the time slot', async () => {
  const f = await fixture();
  await db.query("UPDATE igloo_slots SET starts_at=now()+interval '35 minutes',ends_at=now()+interval '125 minutes' WHERE id=$1", [f.slot.id]);
  assert.equal((await store.listSlots()).length, 0);
  assert.equal((await store.listSlots(true)).length, 1);
  await assert.rejects(store.createHold(f.input(), { livemode: false }), hasCode('UNAVAILABLE'));
  await db.query("UPDATE igloo_slots SET starts_at=now()+interval '36 minutes',ends_at=now()+interval '126 minutes' WHERE id=$1", [f.slot.id]);
  assert.equal((await store.listSlots()).length, 1);
  assert.equal((await store.createHold(f.input(), { livemode: false })).status, 'held');
});

test('reconciliation recognizes completed but unpaid checkout without downgrading a confirmed booking', async () => {
  const f = await fixture(); const booking = await attach(await store.createHold(f.input(), { livemode: false }));
  const pending = await store.applyStripeEvent(evidence(booking, { type: 'reconcile', paymentStatus: 'unpaid' }));
  assert.equal(pending.status, 'awaiting_payment');
  assert.equal((await store.listSlots())[0].remaining, 0);
  assert.equal((await db.query('SELECT * FROM igloo_outbox')).rowCount, 0);
  await store.applyStripeEvent(evidence(booking, { type: 'reconcile' }));
  assert.equal((await store.applyStripeEvent(evidence(booking, { type: 'reconcile', paymentStatus: 'unpaid' }))).status, 'confirmed');
});

test('pending checkout batches rotate by their last update so old unresolved rows cannot monopolize a batch', async () => {
  const f = await fixture(2);
  const first = await store.createHold(f.input(), { livemode: false });
  const second = await store.createHold(f.input(), { livemode: false });
  await db.query("UPDATE igloo_bookings SET updated_at=now()-interval '10 minutes' WHERE id=$1", [first.id]);
  await db.query("UPDATE igloo_bookings SET updated_at=now()-interval '5 minutes' WHERE id=$1", [second.id]);
  assert.equal((await store.pendingCheckouts(1))[0].id, first.id);
  await db.query('UPDATE igloo_bookings SET updated_at=now() WHERE id=$1', [first.id]);
  assert.equal((await store.pendingCheckouts(1))[0].id, second.id);
});
