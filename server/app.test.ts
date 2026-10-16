import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { createApp } from './app.js';
import { configuration, type Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { IglooStore } from './store.js';

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
  await db.query('TRUNCATE igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});
after(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
  await db.close();
});

async function start(config: Config = local) {
  const server = createServer(createApp(config, db));
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
  assert.equal('checkoutParams' in dashboardBody.bookings[0]!, false);
  assert.equal((await request('/admin/logout', { body: {}, headers: { Cookie, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/admin', { headers: { Cookie } })).status, 200);
  assert.equal((await request('/admin/logout', { body: {}, headers: { Cookie } })).status, 200);
  assert.equal((await request('/admin', { headers: { Cookie } })).status, 401);
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
