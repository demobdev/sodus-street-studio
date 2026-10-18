import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { createApp } from './app.js';
import { configuration, type Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { IglooStore } from './store.js';
import { bookingToken } from './tokens.js';

const ORIGIN = 'http://127.0.0.1:5173';
const ADMIN = 'maat@example.test';
const local: Config = {
  local: true, mock: true, mode: 'test', liveAllowed: false, origin: ORIGIN,
  secret: 'http-test-secret-with-more-than-thirty-two-characters', adminEmails: [ADMIN], emailEnabled: false,
};
let db: Database;
let store: IglooStore;
const servers: Server[] = [];
before(async () => {
  db = await createDatabase({ localPath: 'memory://' });
  store = new IglooStore(db);
  await store.init();
});
beforeEach(async () => {
  await db.query('TRUNCATE igloo_booking_alerts,igloo_refund_events,igloo_refund_operations,igloo_cancellation_requests,igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});
after(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
  await db.close();
});

async function start(config: Config = local, database = db) {
  const server = createServer(createApp(config, database));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/igloo`;
  return async (route: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
    return fetch(`${base}${route}`, {
      method,
      headers: { ...(method === 'POST' ? { Origin: config.origin, 'Content-Type': 'application/json' } : {}), ...options.headers },
      ...(options.body === undefined ? {} : { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }),
    });
  };
}

async function seed(capacity = 1) {
  const item = await store.savePackage({
    name: 'Private igloo — local sample', description: 'Test data only.', durationMinutes: 90,
    amountCents: 12_345, currency: 'usd', maxGuests: 6, policyText: 'Sample policy, not approved for live sales.', status: 'active',
  });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00.000Z', endsAt: '2090-10-21T22:30:00.000Z', capacity, status: 'open' });
  return { item, slot, input: { packageId: item.id, slotId: slot.id, name: 'Private Guest Name', email: 'private-guest@example.test', phone: '555-0100', guests: 4, policyAccepted: true, requestId: randomUUID() } };
}

async function staffSession(request: Awaited<ReturnType<typeof start>>) {
  const login = await (await request('/admin/login', { body: { email: ADMIN } })).json() as { devLoginUrl: string };
  const token = new URLSearchParams(new URL(login.devLoginUrl).hash.slice(1)).get('login');
  const response = await request('/admin/session', { body: { token } });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie')!.split(';')[0]!;
}

test('checkout enforces origin, JSON and size limits before creating a reservation', async () => {
  const request = await start();
  const { input } = await seed();
  assert.equal((await request('/checkout', { body: input, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/checkout', { body: input, headers: { Origin: '' } })).status, 403);
  assert.equal((await request('/checkout', { body: input, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/checkout', { body: '{' })).status, 400);
  assert.equal((await request('/checkout', { body: [] })).status, 400);
  assert.equal((await request('/checkout', { body: { ...input, name: 'x'.repeat(70_000) } })).status, 413);
  assert.equal((await store.listBookings()).length, 0);
});

test('checkout uses server price, safely retries and protects occupied capacity and private contact fields', async () => {
  const request = await start();
  const { input } = await seed();
  const response = await request('/checkout', { body: { ...input, amountCents: 1, currency: 'eur' } });
  assert.equal(response.status, 200);
  const checkout = await response.json() as { checkoutUrl: string; bookingToken: string };
  assert.ok(checkout.checkoutUrl.startsWith(`${ORIGIN}/igloos/test-checkout#token=`));
  const repeat = await request('/checkout', { body: input });
  assert.equal(repeat.status, 200);
  assert.deepEqual(await repeat.json(), checkout);
  const changed = await request('/checkout', { body: { ...input, guests: 3 } });
  assert.equal(changed.status, 409);
  const occupied = await request('/checkout', { body: { ...input, requestId: randomUUID() } });
  assert.equal(occupied.status, 409);
  assert.equal((await occupied.json() as { code: string }).code, 'SOLD_OUT');
  assert.equal((await store.listBookings()).length, 1);
  assert.equal((await request('/booking')).status, 404);
  assert.equal((await request('/booking', { headers: { Authorization: `Bearer ${checkout.bookingToken}tampered` } })).status, 404);
  const status = await request('/booking', { headers: { Authorization: `Bearer ${checkout.bookingToken}` } });
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.match(status.headers.get('x-robots-tag')!, /noindex/);
  const publicData = await status.json() as Record<string, unknown>;
  assert.equal(publicData.amountCents, 12_345);
  assert.equal(publicData.taxCents, 0);
  assert.equal(publicData.totalCents, 12_345);
  assert.equal(publicData.currency, 'usd');
  assert.equal(publicData.status, 'held');
  for (const field of ['name', 'email', 'phone', 'requestId', 'policyText', 'sessionId', 'checkoutParams']) assert.equal(field in publicData, false);
  assert.equal(JSON.stringify(publicData).includes(input.email), false);
  const paid = await request('/simulate', { body: { outcome: 'paid' }, headers: { Authorization: `Bearer ${checkout.bookingToken}` } });
  assert.equal(paid.status, 200);
  const confirmed = await paid.json() as Record<string, unknown>;
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.emailStatus, 'simulated', 'mock mode explicitly says no email was delivered');
  assert.equal('checkoutUrl' in confirmed, false);
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1);
});

test('admin sign-in protects customer data, single-use links, mutation origin and logout', async () => {
  const request = await start();
  const { input } = await seed();
  await request('/checkout', { body: input });
  assert.equal((await request('/admin')).status, 401);
  assert.equal((await request('/admin/package', { body: {} })).status, 401);
  const denied = await request('/admin/login', { body: { email: 'outsider@example.test' } });
  assert.deepEqual(await denied.json(), { ok: true });
  assert.equal((await db.query('SELECT token_hash FROM igloo_admin_tokens')).rows.length, 0);
  const login = await request('/admin/login', { body: { email: ' MAAT@EXAMPLE.TEST ' } });
  const result = await login.json() as { ok: boolean; devLoginUrl: string };
  const token = new URLSearchParams(new URL(result.devLoginUrl).hash.slice(1)).get('login');
  assert.ok(token);
  const session = await request('/admin/session', { body: { token } });
  assert.equal(session.status, 200);
  const setCookie = session.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\/api\/igloo/);
  const Cookie = setCookie.split(';')[0]!;
  assert.deepEqual(await session.json(), { ok: true });
  assert.equal((await request('/admin/session', { body: { token } })).status, 401);
  const dashboard = await request('/admin', { headers: { Cookie } });
  assert.equal(dashboard.status, 200);
  const dashboardBody = await dashboard.json() as { bookings: Record<string, unknown>[] };
  assert.equal(dashboardBody.bookings[0]!.email, input.email);
  assert.equal(dashboardBody.bookings[0]!.taxCents, 0);
  assert.equal(dashboardBody.bookings[0]!.totalCents, 12_345);
  assert.equal('checkoutParams' in dashboardBody.bookings[0]!, false);
  assert.equal((await request('/admin/logout', { body: {}, headers: { Cookie, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/admin', { headers: { Cookie } })).status, 200);
  assert.equal((await request('/admin/logout', { body: {}, headers: { Cookie } })).status, 200);
  assert.equal((await request('/admin', { headers: { Cookie } })).status, 401);
});

test('booking status exposes the reserved subtotal, tax and total without leaking tax configuration', async () => {
  const request = await start();
  const { input } = await seed();
  const booking = await store.createHold(input, { livemode: false });
  await store.prepareCheckout(booking.id, { line_items: [{ tax_rates: ['txr_fixture'] }] }, { rateId: 'txr_fixture', percentage: 5, taxCents: 617 });
  const response = await request('/booking', { headers: { Authorization: `Bearer ${bookingToken(booking.id, local.secret)}` } });
  assert.equal(response.status, 200);
  const data = await response.json() as Record<string, unknown>;
  assert.deepEqual([data.amountCents, data.taxCents, data.totalCents], [12345, 617, 12962]);
  for (const field of ['taxRateId', 'checkoutParams', 'email', 'name']) assert.equal(field in data, false);
});

test('cancellation review requires staff and trusted origin, records the session actor, and stays private', async () => {
  const request = await start();
  const { input } = await seed();
  const checkout = await (await request('/checkout', { body: input })).json() as { bookingToken: string };
  const booking = (await store.listBookings())[0]!;
  await request('/simulate', { body: { outcome: 'paid' }, headers: { Authorization: `Bearer ${checkout.bookingToken}` } });
  const body = { bookingId: booking.id, reason: 'Guest called about a weather concern.', actor: 'spoof@example.test' };
  assert.equal((await request('/admin/cancellation-request', { body })).status, 401);
  assert.equal((await request('/admin/cancellation-withdraw', { body: { bookingId: booking.id, requestId: randomUUID() } })).status, 401);

  const login = await (await request('/admin/login', { body: { email: ADMIN } })).json() as { devLoginUrl: string };
  const token = new URLSearchParams(new URL(login.devLoginUrl).hash.slice(1)).get('login');
  const session = await request('/admin/session', { body: { token } });
  const Cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal((await request('/admin/cancellation-request', { body, headers: { Cookie, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/admin/cancellation-request', { body: { bookingId: booking.id, reason: {} }, headers: { Cookie } })).status, 400);
  assert.equal((await request('/admin/cancellation-request', { body, headers: { Cookie } })).status, 200);
  const dashboard = await (await request('/admin', { headers: { Cookie } })).json() as { bookings: { cancellationRequest: { id: string; reason: string; requestedBy: string } }[] };
  const pending = dashboard.bookings[0]!.cancellationRequest;
  assert.equal(pending.reason, body.reason);
  assert.equal(pending.requestedBy, ADMIN);
  const publicData = await (await request('/booking', { headers: { Authorization: `Bearer ${checkout.bookingToken}` } })).json() as Record<string, unknown>;
  assert.equal(publicData.status, 'confirmed');
  assert.equal('cancellationRequest' in publicData, false);
  assert.equal(JSON.stringify(publicData).includes(body.reason), false);
  assert.equal((await store.listSlots())[0]!.remaining, 0);
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 1, 'review does not queue another guest message');
  const withdrawal = { bookingId: booking.id, requestId: pending.id };
  assert.equal((await request('/admin/cancellation-withdraw', { body: withdrawal, headers: { Cookie, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/admin/cancellation-withdraw', { body: withdrawal, headers: { Cookie } })).status, 200);
  assert.equal((await store.listManagedBookings())[0]!.cancellationRequest, null);
  const audit = (await db.query('SELECT requested_by,withdrawn_by FROM igloo_cancellation_requests WHERE id=$1', [pending.id])).rows[0]!;
  assert.deepEqual(audit, { requested_by: ADMIN, withdrawn_by: ADMIN });
});

test('closure refund HTTP flow keeps capacity until verified and exposes only current public refund status', async () => {
  const request = await start();
  const { slot, input } = await seed();
  const checkoutResponse = await request('/checkout', { body: input });
  assert.equal(checkoutResponse.status, 200);
  const checkout = await checkoutResponse.json() as { bookingToken: string };
  const Authorization = `Bearer ${checkout.bookingToken}`;
  assert.equal((await request('/simulate', { body: { outcome: 'paid' }, headers: { Authorization } })).status, 200);
  const booking = (await store.listBookings())[0]!;
  const Cookie = await staffSession(request);
  const body = { bookingId: booking.id, requestId: randomUUID(), reason: 'weather', note: 'Studio is closed because of unsafe weather.', actor: 'spoof@example.test', amountCents: 1 };

  const openSlot = await request('/admin/refund', { body, headers: { Cookie } });
  assert.equal(openSlot.status, 409);
  assert.equal((await openSlot.json() as { code: string }).code, 'SLOT_MUST_BE_CLOSED');
  assert.equal((await request('/admin/slot', { body: { ...slot, status: 'closed' }, headers: { Cookie } })).status, 200);
  const queued = await request('/admin/refund', { body, headers: { Cookie } });
  assert.equal(queued.status, 200);
  const queuedBody = await queued.json() as { ok: boolean; refund: { id: string; status: string; actor: string; amountCents: number } };
  assert.equal(queuedBody.ok, true);
  assert.equal(queuedBody.refund.status, 'requested');
  assert.equal(queuedBody.refund.actor, ADMIN);
  assert.equal(queuedBody.refund.amountCents, booking.totalCents, 'client-supplied refund amount cannot change the full refund');
  const repeat = await request('/admin/refund', { body, headers: { Cookie } });
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json() as { refund: { id: string } }).refund.id, queuedBody.refund.id);
  assert.equal((await request('/admin/refund', { body: { ...body, requestId: randomUUID() }, headers: { Cookie } })).status, 409);
  assert.equal((await store.listSlots(true))[0]!.remaining, 0, 'queued refund does not release the igloo');
  const requestedStatus = await (await request('/booking', { headers: { Authorization } })).json() as Record<string, unknown>;
  assert.equal(requestedStatus.status, 'confirmed');
  assert.equal(requestedStatus.refundStatus, 'requested');
  assert.equal(requestedStatus.refundedAt, null);
  for (const field of ['note', 'actor', 'paymentIntentId', 'refundId', 'requestId', 'refund']) assert.equal(field in requestedStatus, false);
  assert.equal(JSON.stringify(requestedStatus).includes(body.note), false);

  const process = await request('/admin/refund/reconcile', { body: { bookingId: booking.id }, headers: { Cookie } });
  assert.equal(process.status, 200);
  assert.equal((await process.json() as { refund: { status: string } }).refund.status, 'succeeded');
  assert.equal((await store.listSlots(true))[0]!.remaining, 1, 'verified full refund releases capacity');
  assert.equal((await store.listSlots(true))[0]!.status, 'closed', 'refund does not reopen the seating');
  const refunded = await (await request('/booking', { headers: { Authorization } })).json() as Record<string, unknown>;
  assert.equal(refunded.status, 'cancelled');
  assert.equal(refunded.refundStatus, 'succeeded');
  assert.equal(typeof refunded.refundedAt, 'string');
  const dashboard = await (await request('/admin', { headers: { Cookie } })).json() as { refundsEnabled: boolean; refunds: { status: string }[]; bookings: { slotId: string }[] };
  assert.equal(dashboard.refundsEnabled, true);
  assert.equal(dashboard.refunds.length, 1);
  assert.equal(dashboard.refunds[0]!.status, 'succeeded');
  assert.equal(dashboard.bookings[0]!.slotId, slot.id);

  // A later Stripe failure does not erase the historical success timestamp or recreate inventory.
  await db.query("UPDATE igloo_refund_operations SET status='needs_review',error='Stripe changed the refund outcome.' WHERE id=$1", [queuedBody.refund.id]);
  const changed = await (await request('/booking', { headers: { Authorization } })).json() as Record<string, unknown>;
  assert.equal(changed.status, 'cancelled');
  assert.equal(changed.refundStatus, 'needs_review', 'guest UI can distinguish historical success from current refund state');
  assert.equal(changed.refundedAt, refunded.refundedAt);
  assert.equal('error' in changed, false, 'staff review detail is private');
  assert.equal((await store.listSlots(true))[0]!.remaining, 1);
});

test('refund endpoints require staff, trusted origin, valid UUIDs, and a permitted closure reason', async () => {
  const request = await start();
  const { input } = await seed();
  const checkout = await (await request('/checkout', { body: input })).json() as { bookingToken: string };
  const Authorization = `Bearer ${checkout.bookingToken}`;
  await request('/simulate', { body: { outcome: 'paid' }, headers: { Authorization } });
  const booking = (await store.listBookings())[0]!;
  const body = { bookingId: booking.id, requestId: randomUUID(), reason: 'weather', note: 'Closure test.' };
  for (const route of ['/admin/refund', '/admin/refund/reconcile']) {
    assert.equal((await request(route, { body })).status, 401);
    assert.equal((await request(route, { body, headers: { Authorization } })).status, 401, 'a guest booking token is not staff authorization');
  }
  const Cookie = await staffSession(request);
  for (const route of ['/admin/refund', '/admin/refund/reconcile']) {
    assert.equal((await request(route, { body, headers: { Cookie, Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await request(route, { body: { ...body, bookingId: 'not-a-uuid' }, headers: { Cookie } })).status, 400);
  }
  assert.equal((await request('/admin/refund', { body: { ...body, requestId: 'bad-request-id' }, headers: { Cookie } })).status, 400);
  assert.equal((await request('/admin/refund', { body: { ...body, reason: 'customer_cancelled' }, headers: { Cookie } })).status, 400);
  assert.equal((await request('/admin/refund', { body: { ...body, note: ' ' }, headers: { Cookie } })).status, 400);
  assert.equal((await db.query('SELECT id FROM igloo_refund_operations')).rows.length, 0);
  assert.equal((await store.getBooking(booking.id))?.status, 'confirmed');
  assert.equal((await store.listSlots(true))[0]!.remaining, 0);
});

test('scheduled jobs require an exact configured bearer token before any database initialization', async () => {
  let touched = false;
  const unavailable: Database = {
    query: async () => { touched = true; throw new Error('Database must not be reached.'); },
    transaction: async () => { touched = true; throw new Error('Database must not be reached.'); },
    close: async () => {},
  };
  const cronSecret = 'scheduled-jobs-fixture-secret-at-least-thirty-two-characters';
  const request = await start({ ...local, cronSecret }, unavailable);
  assert.equal((await request('/jobs')).status, 401);
  assert.equal((await request(`/jobs?secret=${cronSecret}`)).status, 401);
  assert.equal((await request('/jobs', { headers: { Authorization: `Bearer ${cronSecret}bad` } })).status, 401);
  assert.equal((await request('/jobs', { headers: { Authorization: cronSecret } })).status, 401);
  assert.equal((await request('/jobs', { method: 'POST', headers: { Authorization: `Bearer ${cronSecret}` } })).status, 405);
  assert.equal((await (await start(local, unavailable))('/jobs', { headers: { Authorization: 'Bearer undefined' } })).status, 401);
  assert.equal(touched, false);
});

test('authorized scheduled job can run while customer booking is closed and reveals no records', async () => {
  const cronSecret = 'scheduled-jobs-fixture-secret-at-least-thirty-two-characters';
  const request = await start({ ...local, mode: 'live', liveAllowed: false, cronSecret });
  const first = await request('/jobs', { headers: { Authorization: `Bearer ${cronSecret}` } });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await first.json(), { ok: true, expiredHolds: 0, reconciled: 0, recovered: 0, skipped: 0, failures: 0 });
  const repeat = await request('/jobs', { headers: { Authorization: `Bearer ${cronSecret}` } });
  assert.equal(repeat.status, 200);
  assert.equal((await (await request('/catalog')).json() as { bookingOpen: boolean }).bookingOpen, false);
});

test('deployed configuration cannot enable the simulator or bypass the live launch gate', async () => {
  const deployed = configuration(false, { PAYMENTS_DRIVER: 'mock', IGLOO_MODE: 'live', BOOKING_TOKEN_SECRET: local.secret, APP_ORIGIN: 'https://studio.example' });
  assert.equal(deployed.mock, false);
  assert.equal(deployed.local, false);
  const request = await start({ ...deployed, adminEmails: [ADMIN] });
  const catalog = await request('/catalog');
  const data = await catalog.json() as { bookingOpen: boolean; packages: unknown[] };
  assert.equal(data.bookingOpen, false);
  assert.deepEqual(data.packages, []);
  assert.equal((await request('/simulate', { body: { outcome: 'paid' } })).status, 404);
  const { input } = await seed();
  assert.equal((await request('/checkout', { body: input })).status, 503);
  assert.equal((await store.listBookings()).length, 0);
});

test('fake Stripe webhooks fail signature verification without modifying inventory', async () => {
  const request = await start({ ...local, mock: false, stripeKey: 'sk_test_not_a_real_key', webhookSecret: 'whsec_local_test_only' });
  const { input } = await seed();
  const booking = await store.createHold(input, { livemode: false });
  const forged = await request('/webhook', { body: { id: 'evt_forged', type: 'checkout.session.completed', data: { object: { metadata: { booking_id: booking.id }, payment_status: 'paid' } } }, headers: { 'stripe-signature': 'invalid', Origin: 'https://other.example' } });
  assert.equal(forged.status, 400);
  assert.equal((await forged.json() as { code: string }).code, 'INVALID_SIGNATURE');
  assert.equal((await store.getBooking(booking.id))?.status, 'held');
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 0);
});
