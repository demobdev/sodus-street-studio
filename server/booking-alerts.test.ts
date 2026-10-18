import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type { Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { IglooStore, type Booking } from './store.js';
import { deliverBookingAlerts } from './booking-alerts.js';

const config: Config = {
  local: false, mock: false, mode: 'live', liveAllowed: false,
  origin: 'https://sodus.example.test', secret: 'booking-alerts-test-secret-not-production',
  adminEmails: ['demo@example.test'], emailEnabled: true, emailKey: 'fixture-key',
  emailFrom: 'Sodus Street Studio <bookings@sodus.example.test>', emailReplyTo: 'studio@example.test',
};
let db: Database;
let store: IglooStore;
before(async () => { db = await createDatabase({ localPath: 'memory://' }); store = new IglooStore(db); await store.init(); });
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.query('TRUNCATE igloo_booking_alerts,igloo_refund_events,igloo_refund_operations,igloo_cancellation_requests,igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});

async function booking(live = true): Promise<Booking> {
  const item = await store.savePackage({ name: 'Classic Sub Tray', description: 'Alert fixture only', durationMinutes: 90,
    amountCents: 22_500, currency: 'usd', maxGuests: 8, policyText: 'Test policy.', status: 'active' });
  const slot = await store.saveSlot({ startsAt: '2090-10-23T21:00:00Z', endsAt: '2090-10-23T22:30:00Z', capacity: 4, status: 'open' });
  const held = await store.createHold({ packageId: item.id, slotId: slot.id, name: 'Original Guest', email: 'guest@example.test',
    phone: '555-0100', guests: 8, policyAccepted: true, requestId: randomUUID() }, { livemode: live });
  await store.prepareCheckout(held.id, { mode: 'payment' }, { rateId: 'txr_fixture', percentage: 8, taxCents: 1800 });
  return store.applyStripeEvent({ eventId: `evt_${held.id}`, bookingId: held.id, sessionId: `cs_${held.id}`,
    livemode: live, amountCents: 24_300, subtotalCents: 22_500, taxCents: 1800, currency: 'usd',
    paymentStatus: 'paid', sessionStatus: 'complete', type: 'checkout.session.completed' });
}

async function refund(b: Booking, status = 'pending', error: string | null = null) {
  const id = randomUUID();
  await db.query(`INSERT INTO igloo_refund_operations(id,booking_id,request_id,reason,note,actor,amount_cents,currency,payment_intent_id,livemode,status,error,completed_at)
    VALUES($1,$2,$3,'weather','Fixture studio closure','demo@example.test',24300,'usd','pi_fixture',$4,$5,$6,
      CASE WHEN $5='succeeded' THEN now() ELSE NULL END)`, [id, b.id, randomUUID(), b.livemode, status, error]);
  if (status === 'succeeded') await db.query("UPDATE igloo_bookings SET status='cancelled',refunded_at=now() WHERE id=$1", [b.id]);
  return id;
}

type Body = { from: string; to: string[]; reply_to: string; subject: string; text: string };
type Request = { key: string | null; body: Body };
const request = (init?: RequestInit): Request => ({ key: new Headers(init?.headers).get('Idempotency-Key'), body: JSON.parse(String(init?.body)) as Body });

test('disabled delivery queues one immutable staff alert per recipient and sends at most one per call', async t => {
  const b = await booking();
  const calls: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(request(init)); return Response.json({ id: `fixture_${calls.length}` });
  });
  const c = { ...config, adminEmails: ['Demo@example.test', 'demo@example.test', 'maat@example.test'] };
  await deliverBookingAlerts(store, { ...c, emailEnabled: false });
  await deliverBookingAlerts(store, { ...c, emailEnabled: false });
  assert.equal(calls.length, 0);
  assert.equal((await db.query('SELECT id FROM igloo_booking_alerts')).rows.length, 2);
  await db.query("UPDATE igloo_bookings SET name='Changed after queueing' WHERE id=$1", [b.id]);
  await deliverBookingAlerts(store, c);
  assert.equal(calls.length, 1);
  await deliverBookingAlerts(store, c);
  await deliverBookingAlerts(store, c);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.body.to[0]).sort(), ['demo@example.test', 'maat@example.test']);
  for (const call of calls) {
    assert.match(call.body.text, /Original Guest/);
    assert.doesNotMatch(call.body.text, /Changed after queueing/);
    assert.match(call.body.text, /Total paid: \$243\.00 USD/);
    assert.match(call.body.text, /5:00 PM/);
    assert.match(call.body.text, /https:\/\/sodus\.example\.test\/igloos\/manage/);
    assert.equal(call.body.reply_to, 'studio@example.test');
    assert.match(call.key!, /^igloo-alert\/[0-9a-f-]+$/);
  }
  assert.equal((await store.getBooking(b.id))!.emailStatus, 'pending', 'staff alerts do not claim the guest confirmation was delivered');
});

test('only a verified full successful refund queues a guest cancellation email including tax', async t => {
  const b = await booking();
  const operation = await refund(b);
  const c = { ...config, adminEmails: [] };
  const calls: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(request(init)); return Response.json({ id: 'fixture_refund' });
  });
  await deliverBookingAlerts(store, c);
  assert.equal(calls.length, 0);
  await db.query("UPDATE igloo_refund_operations SET status='succeeded',completed_at=now() WHERE id=$1", [operation]);
  await deliverBookingAlerts(store, c);
  assert.equal(calls.length, 0, 'successful operation alone cannot claim the reservation was cancelled');
  await db.query("UPDATE igloo_bookings SET status='cancelled',refunded_at=now() WHERE id=$1", [b.id]);
  await deliverBookingAlerts(store, c);
  await deliverBookingAlerts(store, c);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.to, ['guest@example.test']);
  assert.match(calls[0].body.text, /weather-related closure/);
  assert.match(calls[0].body.text, /Full refund, including tax: \$243\.00 USD/);
  assert.match(calls[0].body.text, /depends on your bank or payment provider/);
  assert.doesNotMatch(calls[0].body.text, /\d+ business days/);
});

test('review alerts deduplicate issue states, suppress resolved snapshots, and never expose internal errors', async t => {
  const b = await booking();
  const operation = await refund(b, 'needs_review', 'first error fixture_secret_never_email');
  const calls: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(request(init)); return Response.json({ id: `fixture_review_${calls.length}` });
  });
  await deliverBookingAlerts(store, { ...config, emailEnabled: false });
  await deliverBookingAlerts(store, { ...config, emailEnabled: false });
  assert.equal((await db.query("SELECT id FROM igloo_booking_alerts WHERE kind='staff_refund_review'")).rows.length, 1);
  await db.query("UPDATE igloo_refund_operations SET error='second issue' WHERE id=$1", [operation]);
  await deliverBookingAlerts(store, config);
  assert.equal(calls.length, 1, 'the obsolete first issue is skipped');
  assert.match(calls[0].body.subject, /needs review/);
  assert.match(calls[0].body.text, /Do not start a second refund/);
  assert.doesNotMatch(calls[0].body.text, /fixture_secret_never_email|first error|second issue/);
  await deliverBookingAlerts(store, config);
  assert.equal(calls.length, 1);
  await db.query("UPDATE igloo_refund_operations SET status='failed' WHERE id=$1", [operation]);
  await deliverBookingAlerts(store, { ...config, emailEnabled: false });
  await db.query("UPDATE igloo_refund_operations SET status='pending' WHERE id=$1", [operation]);
  await deliverBookingAlerts(store, config);
  assert.equal(calls.length, 1, 'a now-resolved failure alert is not sent');
});

test('a refund changed to needs-review before delivery cannot send the queued success notice', async t => {
  const b = await booking();
  const operation = await refund(b, 'succeeded');
  const c = { ...config, adminEmails: [] };
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider call'); });
  await deliverBookingAlerts(store, { ...c, emailEnabled: false });
  assert.equal((await db.query("SELECT id FROM igloo_booking_alerts WHERE kind='guest_refund'")).rows.length, 1);
  await db.query("UPDATE igloo_refund_operations SET status='needs_review',error='Stripe changed status' WHERE id=$1", [operation]);
  await deliverBookingAlerts(store, c);
  assert.equal(network.mock.callCount(), 0);
});

for (const failure of ['error', 'missing acknowledgment', 'network failure'] as const) {
  test(`${failure} retries after delay with the same payload and idempotency key`, async t => {
    await booking();
    const calls: Request[] = [];
    t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      calls.push(request(init));
      if (calls.length > 1) return Response.json({ id: 'fixture_retry' });
      if (failure === 'network failure') throw new Error('Fixture offline');
      return failure === 'error' ? Response.json({}, { status: 503 }) : Response.json({});
    });
    await deliverBookingAlerts(store, config);
    const failed = (await db.query('SELECT status,provider_id,sent_at,attempts,last_error,next_attempt_at>now() AS delayed FROM igloo_booking_alerts')).rows[0];
    assert.deepEqual(failed, { status: 'failed', provider_id: null, sent_at: null, attempts: 1, last_error: 'Delivery failed; retry required.', delayed: true });
    await deliverBookingAlerts(store, config);
    assert.equal(calls.length, 1);
    await db.query("UPDATE igloo_booking_alerts SET next_attempt_at=now()-interval '1 second'");
    await deliverBookingAlerts(store, config);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal((await db.query('SELECT status FROM igloo_booking_alerts')).rows[0].status, 'sent');
  });
}

test('concurrent workers share a lease and an expired worker cannot replace a later delivery result', async t => {
  await booking();
  let releaseFirst!: (response: Response) => void;
  let firstReached!: () => void;
  const reached = new Promise<void>(resolve => { firstReached = resolve; });
  const firstResponse = new Promise<Response>(resolve => { releaseFirst = resolve; });
  const calls: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(request(init));
    if (calls.length === 1) { firstReached(); return firstResponse; }
    return Response.json({ id: 'new_worker_result' });
  });
  const first = deliverBookingAlerts(store, config);
  await reached;
  await deliverBookingAlerts(store, config);
  assert.equal(calls.length, 1);
  await db.query("UPDATE igloo_booking_alerts SET lease_until=now()-interval '1 second'");
  await deliverBookingAlerts(store, config);
  releaseFirst(Response.json({ id: 'old_worker_result' }));
  await first;
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, calls[1].key);
  assert.deepEqual((await db.query('SELECT status,provider_id,attempts,claim_token,lease_until FROM igloo_booking_alerts')).rows[0],
    { status: 'sent', provider_id: 'new_worker_result', attempts: 2, claim_token: null, lease_until: null });
});

test('mode isolation, simulation and removed staff recipients do not leak notification mail', async t => {
  const b = await booking(false);
  const calls: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(request(init)); return Response.json({ id: 'fixture_test_mail' });
  });
  await deliverBookingAlerts(store, config);
  assert.equal((await db.query('SELECT id FROM igloo_booking_alerts')).rows.length, 0);
  await deliverBookingAlerts(store, { ...config, mode: 'test', local: true, mock: true });
  assert.equal(calls.length, 0);
  await deliverBookingAlerts(store, { ...config, mode: 'test', adminEmails: [] });
  assert.equal(calls.length, 0, 'an address removed from staff access is not sent a previously queued alert');
  await deliverBookingAlerts(store, { ...config, mode: 'test' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.subject, /^\[TEST\]/);
  assert.match(calls[0].body.text, /TEST ONLY/);
  assert.equal((await store.getBooking(b.id))!.emailStatus, 'pending');
});
