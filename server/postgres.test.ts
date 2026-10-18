import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { IglooStore, StoreError } from './store.js';
import type { Payments } from './payments.js';
import { Refunds, type RefundRequest } from './refunds.js';

const enabled = process.env.RUN_POSTGRES_TEST === '1' && Boolean(process.env.DATABASE_URL)
  && process.env.IGLOO_MODE !== 'live' && process.env.NODE_ENV !== 'production';
const developmentHostname = 'ep-dark-river-b8k8zhub-pooler.c-14.us-east-1.aws.neon.tech';

function developmentConnection(): string {
  const connection = process.env.DATABASE_URL!;
  assert.equal(new URL(connection).hostname, developmentHostname, 'Native booking tests may run only against the approved development database.');
  return connection;
}

async function cleanup(db: Database, packageId: string, slotId: string) {
  // Delete only this run's fixtures; no truncation or modification of other development bookings.
  await db.transaction(async (tx) => {
    await tx.query('DELETE FROM igloo_booking_alerts WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
    await tx.query(`DELETE FROM igloo_refund_events WHERE operation_id IN
      (SELECT r.id FROM igloo_refund_operations r JOIN igloo_bookings b ON b.id=r.booking_id WHERE b.package_id=$1)`, [packageId]);
    await tx.query('DELETE FROM igloo_refund_operations WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
    await tx.query('DELETE FROM igloo_cancellation_requests WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
    await tx.query('DELETE FROM igloo_outbox WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
    await tx.query('DELETE FROM igloo_payment_events WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
    await tx.query('DELETE FROM igloo_bookings WHERE package_id=$1', [packageId]);
    await tx.query('DELETE FROM igloo_slots WHERE id=$1', [slotId]);
    await tx.query('DELETE FROM igloo_packages WHERE id=$1', [packageId]);
  });
}

/** Explicit opt-in: use a dedicated development database, never the live sales database. */
test('pooled PostgreSQL transactions serialize the final igloo and duplicate Checkout delivery', { skip: !enabled }, async () => {
  const db = await createDatabase({ connectionString: developmentConnection() });
  const store = new IglooStore(db);
  const packageId = randomUUID(); const slotId = randomUUID();
  try {
    await store.init();
    await store.savePackage({ id: packageId, name: `TEST ONLY — concurrency ${packageId.slice(0, 8)}`,
      description: 'Disposable automated development test. Not a customer package.', durationMinutes: 90,
      amountCents: 12345, currency: 'usd', maxGuests: 6, policyText: 'Automated test only.', status: 'active' });
    await store.saveSlot({ id: slotId, startsAt: '2190-10-21T21:00:00.000Z', endsAt: '2190-10-21T22:30:00.000Z', capacity: 1, status: 'open' });
    const input = () => ({ packageId, slotId, name: 'Concurrency Test', email: 'test@example.test', guests: 4, policyAccepted: true, requestId: randomUUID() });
    const results = await Promise.allSettled(Array.from({ length: 16 }, () => store.createHold(input(), { livemode: false })));
    const winners = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected');
    assert.equal(winners.length, 1);
    assert.equal(failures.length, 15);
    assert.ok(failures.every((result) => result.reason instanceof StoreError && result.reason.code === 'SOLD_OUT'));
    const winner = winners[0].value;
    const booking = await store.attachCheckout(winner.id, { sessionId: `cs_test_native_${winner.id}`, url: 'https://checkout.stripe.com/test-fixture',
      expiresAt: new Date(Date.now() + 1_860_000).toISOString(), livemode: false, amountCents: winner.amountCents, currency: 'usd' });
    const event = { eventId: `evt_native_${randomUUID()}`, bookingId: booking.id, sessionId: booking.sessionId!, livemode: false,
      amountCents: booking.amountCents, currency: 'usd', paymentStatus: 'paid' as const, sessionStatus: 'complete' as const, type: 'checkout.session.completed' };
    const confirmations = await Promise.all(Array.from({ length: 8 }, () => store.applyStripeEvent(event)));
    assert.ok(confirmations.every((entry) => entry.status === 'confirmed'));
    assert.equal((await db.query('SELECT * FROM igloo_outbox WHERE booking_id=$1', [booking.id])).rowCount, 1);
    assert.equal((await db.query('SELECT * FROM igloo_payment_events WHERE booking_id=$1', [booking.id])).rowCount, 1);
    await Promise.all(Array.from({ length: 8 }, () => store.requestCancellation(booking.id, 'TEST ONLY cancellation review', 'test@example.test')));
    const active = (await db.query('SELECT id FROM igloo_cancellation_requests WHERE booking_id=$1 AND withdrawn_at IS NULL', [booking.id])).rows;
    assert.equal(active.length, 1);
    await Promise.all([store.withdrawCancellation(booking.id, String(active[0]!.id), 'test@example.test'), store.applyStripeEvent({ ...event, eventId: `evt_native_${randomUUID()}` })]);
    assert.equal((await store.getBooking(booking.id))?.status, 'confirmed');
    assert.equal((await store.listSlots()).find(slot => slot.id === slotId)?.remaining, 0);
  } finally {
    try { await cleanup(db, packageId, slotId); } finally { await db.close(); }
  }
});

test('pooled PostgreSQL workers create one full closure refund and late Checkout cannot restore its reservation', { skip: !enabled, timeout: 60_000 }, async () => {
  const db = await createDatabase({ connectionString: developmentConnection() });
  const store = new IglooStore(db);
  const packageId = randomUUID(); const slotId = randomUUID();
  const staff = 'native-test@example.test';
  const config: Config = { local: false, mock: false, mode: 'test', liveAllowed: false,
    origin: 'https://sodus.example.test', secret: 'native-refund-fixture-secret-not-production',
    adminEmails: [staff], emailEnabled: false, refundsEnabled: true };
  let release!: () => void;
  let entered!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const creating = new Promise<void>(resolve => { entered = resolve; });
  let running: Promise<void> | undefined;
  try {
    await store.init();
    await store.savePackage({ id: packageId, name: `TEST ONLY — native refund ${packageId.slice(0, 8)}`,
      description: 'Disposable native database refund test. No Stripe connection.', durationMinutes: 90,
      amountCents: 22_500, currency: 'usd', maxGuests: 8, policyText: 'Studio closure fixture only.', status: 'active' });
    const slot = await store.saveSlot({ id: slotId, startsAt: '2190-10-22T21:00:00Z', endsAt: '2190-10-22T22:30:00Z', capacity: 1, status: 'open' });
    const booking = await store.createHold({ packageId, slotId, name: 'Native Refund Guest', email: 'native-refund@example.test',
      guests: 8, policyAccepted: true, requestId: randomUUID() }, { livemode: false });
    await store.prepareCheckout(booking.id, { mode: 'payment' }, { rateId: 'txr_nativefixture', percentage: 8, taxCents: 1800 });
    const event = { eventId: `evt_native_refund_${randomUUID()}`, bookingId: booking.id, sessionId: `cs_native_${booking.id}`,
      paymentIntentId: `pi_native_${booking.id.replaceAll('-', '')}`, livemode: false,
      amountCents: 24_300, subtotalCents: 22_500, taxCents: 1800, currency: 'usd',
      paymentStatus: 'paid' as const, sessionStatus: 'complete' as const, type: 'checkout.session.completed' };
    await store.applyStripeEvent(event);
    let creates = 0;
    let response: Stripe.Refund;
    // A narrow dependency mock has no Stripe SDK or network client to accidentally call.
    const payments = { verifyAccount: async () => {}, stripe: { refunds: {
      create: async (params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) => {
        creates += 1;
        assert.equal(params.amount, 24_300, 'the whole paid amount, including tax, is refunded');
        assert.equal(params.payment_intent, event.paymentIntentId);
        assert.match(options.idempotencyKey!, /^sodus-igloo-refund:/);
        entered();
        await barrier;
        return response;
      },
      retrieve: async () => response,
    } } } as unknown as Payments;
    const firstWorker = new Refunds(store, config, payments);
    const secondWorker = new Refunds(store, config, payments);
    const request: RefundRequest = { bookingId: booking.id, requestId: randomUUID(), reason: 'weather', note: 'TEST ONLY unsafe-weather closure.' };
    await assert.rejects(firstWorker.request(request, staff), (error: unknown) => error instanceof StoreError && error.code === 'SLOT_MUST_BE_CLOSED');
    await store.saveSlot({ ...slot, status: 'closed' });
    const requested = await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? firstWorker : secondWorker).request(request, staff)));
    const operation = requested[0];
    assert.ok(requested.every(item => item.id === operation.id));
    assert.equal((await db.query('SELECT id FROM igloo_refund_events WHERE operation_id=$1', [operation.id])).rows.length, 1);
    response = { id: `re_native_${operation.id.replaceAll('-', '')}`, object: 'refund', amount: 24_300,
      currency: 'usd', payment_intent: event.paymentIntentId, status: 'succeeded',
      metadata: { booking_id: booking.id, refund_operation_id: operation.id } } as unknown as Stripe.Refund;
    running = firstWorker.processBooking(booking.id);
    await Promise.race([creating, running.then(() => { throw new Error('Refund worker finished before reaching the mocked Stripe call.'); })]);
    await assert.rejects(secondWorker.processBooking(booking.id), (error: unknown) => error instanceof StoreError && error.code === 'REFUND_BUSY');
    assert.equal((await store.getBooking(booking.id))!.status, 'confirmed');
    assert.equal((await store.listSlots(true)).find(item => item.id === slotId)!.remaining, 0);
    release();
    await running;
    assert.equal(creates, 1);
    assert.equal((await firstWorker.getForBooking(booking.id))!.status, 'succeeded');
    assert.equal((await store.getBooking(booking.id))!.status, 'cancelled');
    assert.equal((await store.listSlots(true)).find(item => item.id === slotId)!.remaining, 1);
    const late = await Promise.all(Array.from({ length: 8 }, () => store.applyStripeEvent({ ...event, eventId: `evt_native_late_${randomUUID()}` })));
    assert.ok(late.every(item => item.status === 'cancelled' && item.refundedAt));
    assert.equal((await store.listSlots(true)).find(item => item.id === slotId)!.remaining, 1);
    assert.equal((await store.listSlots()).some(item => item.id === slotId), false, 'a refunded closed seating is never offered again');
    assert.equal(creates, 1);
  } finally {
    release();
    if (running) await running.catch(() => {});
    try { await cleanup(db, packageId, slotId); } finally { await db.close(); }
  }
});
