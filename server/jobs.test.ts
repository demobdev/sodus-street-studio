import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type { Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { runBookingJobs } from './jobs.js';
import { IglooStore, type Booking } from './store.js';

let db: Database;
let store: IglooStore;
const config: Config = { local: true, mock: false, mode: 'test', liveAllowed: false, origin: 'http://127.0.0.1:5173',
  secret: 'jobs-fixture-booking-secret-longer-than-thirty-two', adminEmails: [], emailEnabled: true,
  emailKey: 'fixture-only', emailFrom: 'Fixture <no-reply@example.test>' };
before(async () => { db = await createDatabase({ localPath: 'memory://' }); store = new IglooStore(db); await store.init(); });
beforeEach(async () => { await db.query('TRUNCATE igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits'); });
after(async () => { await db.close(); });

async function fixture(capacity = 1) {
  const item = await store.savePackage({ name: 'Scheduler fixture', description: 'Not for sale', durationMinutes: 90, amountCents: 12345,
    currency: 'usd', maxGuests: 8, policyText: 'Test only', status: 'active' });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00Z', endsAt: '2090-10-21T22:30:00Z', capacity, status: 'open' });
  return () => store.createHold({ packageId: item.id, slotId: slot.id, name: 'Test guest', email: 'guest@example.test',
    guests: 2, policyAccepted: true, requestId: randomUUID() }, { livemode: false });
}
const attach = (b: Booking) => store.attachCheckout(b.id, { sessionId: `cs_test_${b.id}`, url: 'https://checkout.stripe.com/fixture',
  expiresAt: new Date(Date.now() + 1_860_000).toISOString(), livemode: false, amountCents: b.totalCents, currency: 'usd' });
const confirm = (b: Booking) => store.applyStripeEvent({ eventId: `reconcile:${b.id}:complete:paid`, bookingId: b.id,
  sessionId: b.sessionId!, livemode: false, amountCents: b.totalCents, currency: 'usd', paymentStatus: 'paid', sessionStatus: 'complete', type: 'reconcile' });
const unexpectedCheckout = async (): Promise<Booking> => { throw new Error('A scheduler must not create a fresh checkout.'); };

test('scheduled reconciliation recovers a missed webhook and repeated runs send one confirmation', async (t) => {
  const hold = await fixture();
  const booking = await attach(await hold());
  let checks = 0;
  let emails = 0;
  t.mock.method(globalThis, 'fetch', async () => { emails += 1; return new Response(JSON.stringify({ id: 'email_fixture' }), { status: 200 }); });
  const payments = { reconcile: async (b: Booking) => { checks += 1; return confirm(b); }, checkout: unexpectedCheckout };
  assert.equal((await runBookingJobs(store, payments, config)).reconciled, 1);
  await runBookingJobs(store, payments, config);
  assert.equal(checks, 1);
  assert.equal(emails, 1);
  assert.equal((await store.getBooking(booking.id))?.status, 'confirmed');
  assert.equal((await store.getBooking(booking.id))?.emailStatus, 'sent');
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1);
});

test('scheduled email delivery retries a failed confirmation with the same idempotency key', async (t) => {
  const hold = await fixture();
  const booking = await confirm(await attach(await hold()));
  const keys: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    keys.push(new Headers(options.headers).get('Idempotency-Key')!);
    return keys.length === 1 ? new Response('', { status: 503 }) : new Response(JSON.stringify({ id: 'email_fixture' }), { status: 200 });
  });
  const payments = { reconcile: unexpectedCheckout, checkout: unexpectedCheckout };
  await runBookingJobs(store, payments, config);
  assert.equal((await store.getBooking(booking.id))?.emailStatus, 'failed');
  await db.query("UPDATE igloo_outbox SET next_attempt_at=now()-interval '1 second'");
  await runBookingJobs(store, payments, config);
  await runBookingJobs(store, payments, config);
  assert.deepEqual(keys, [`igloo-confirmation/${booking.id}`, `igloo-confirmation/${booking.id}`]);
  assert.equal((await store.getBooking(booking.id))?.emailStatus, 'sent');
});

test('a failed checkout does not starve the next pending reservation', async () => {
  const hold = await fixture(2);
  const first = await attach(await hold());
  const second = await attach(await hold());
  await db.query("UPDATE igloo_bookings SET updated_at=now()-interval '1 day' WHERE id=$1", [first.id]);
  const seen: string[] = [];
  const payments = { reconcile: async (b: Booking) => { seen.push(b.id); if (b.id === first.id) throw new Error('Temporary Stripe failure'); return confirm(b); }, checkout: unexpectedCheckout };
  const noEmail = { ...config, emailEnabled: false };
  assert.equal((await runBookingJobs(store, payments, noEmail)).failures, 1);
  assert.equal((await runBookingJobs(store, payments, noEmail)).reconciled, 1);
  assert.deepEqual(seen, [first.id, second.id]);
  assert.equal((await store.getBooking(first.id))?.status, 'held');
  assert.equal((await store.getBooking(second.id))?.status, 'confirmed');
});

test('jobs retry only a durable unknown Checkout outcome and never originate another held checkout', async () => {
  const hold = await fixture(2);
  const attempted = await hold();
  const untouched = await hold();
  await store.prepareCheckout(attempted.id, { mode: 'payment', metadata: { booking_id: attempted.id } });
  await db.query("UPDATE igloo_bookings SET updated_at=now()-interval '1 day' WHERE id=$1", [attempted.id]);
  const recovered: string[] = [];
  const payments = { reconcile: unexpectedCheckout, checkout: async (b: Booking) => { recovered.push(b.id); return attach(b); } };
  const noEmail = { ...config, emailEnabled: false };
  assert.equal((await runBookingJobs(store, payments, noEmail)).recovered, 1);
  assert.equal((await runBookingJobs(store, payments, noEmail)).skipped, 1);
  assert.deepEqual(recovered, [attempted.id]);
  assert.equal((await store.getBooking(untouched.id))?.checkoutParams, null);
  assert.equal((await store.getBooking(untouched.id))?.sessionId, null);
});
