import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { SANDBOX_ACCOUNT, DEVELOPMENT_HOST, TEST_RECIPIENT, sandboxSettings, requireSandboxExecution } from './sandbox-lifecycle.js';
import { createDatabase } from './db.js';
import { IglooStore } from './store.js';
import { createApp } from './app.js';
import { Payments } from './payments.js';

const env: NodeJS.ProcessEnv = {
  IGLOO_MODE: 'test', PAYMENTS_DRIVER: 'stripe', IGLOO_ALLOW_LIVE: 'false',
  STRIPE_ACCOUNT_ID: SANDBOX_ACCOUNT, STRIPE_SECRET_KEY: 'rk_test_fixture_not_a_key',
  DATABASE_URL: `postgresql://fixture:fixture@${DEVELOPMENT_HOST}/sodus?sslmode=require`,
  SODUS_SANDBOX_RUN_ID: 'e212f3ab-78f2-458c-bb20-120b8b5ac316', APP_ORIGIN: 'http://127.0.0.1:5173',
  BOOKING_ADMIN_EMAILS: TEST_RECIPIENT,
  BOOKING_TOKEN_SECRET: 'fixture-security-secret-at-least-thirty-two-characters',
  STRIPE_WEBHOOK_SECRET: 'whsec_fixture', IGLOO_REFUNDS_ENABLED: 'true', IGLOO_TAX_APPROVED: 'true',
  STRIPE_TAX_RATE_ID: 'txr_fixture', BOOKING_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'fixture-only',
  BOOKING_FROM_EMAIL: 'Sodus Street Studio <bookings@sodusstreetstudio.com>',
};

test('sandbox connection is confined to its UUID schema without a public search_path fallback', () => {
  const settings = sandboxSettings(env);
  assert.equal(settings.schema, 'igloo_sandbox_e212f3ab78f2458cbb20120b8b5ac316');
  assert.equal(new URL(settings.scopedDatabaseUrl).searchParams.get('options'), `-c search_path=${settings.schema}`);
  assert.equal(new URL(settings.baseDatabaseUrl).searchParams.has('options'), false);
  assert.equal(settings.config.databaseUrl, settings.scopedDatabaseUrl);
  assert.equal(settings.config.mock, false);
  assert.equal(settings.executionAllowed, false);
  const pooled = sandboxSettings({ ...env, DATABASE_URL: env.DATABASE_URL!.replace('ep-dark-river-b8k8zhub.', 'ep-dark-river-b8k8zhub-pooler.') });
  assert.equal(new URL(pooled.scopedDatabaseUrl).hostname, DEVELOPMENT_HOST);
});

test('live keys, accounts, databases, runtimes and mock flows are rejected before any connection', () => {
  const variants: Partial<NodeJS.ProcessEnv>[] = [
    { STRIPE_SECRET_KEY: 'rk_live_fixture' }, { STRIPE_ACCOUNT_ID: 'acct_production' },
    { DATABASE_URL: 'postgresql://fixture:fixture@production.example/sodus' },
    { DATABASE_URL: `postgresql://fixture:fixture@${DEVELOPMENT_HOST}/another_database` },
    { IGLOO_MODE: 'live' }, { IGLOO_ALLOW_LIVE: 'true' }, { NODE_ENV: 'production' },
    { VERCEL: '1' }, { PAYMENTS_DRIVER: 'mock' },
  ];
  for (const variation of variants) assert.throws(() => sandboxSettings({ ...env, ...variation }));
});

test('schema injection, caller-supplied search_path and uncontrolled staff recipients fail closed', () => {
  for (const variation of [
    { SODUS_SANDBOX_RUN_ID: 'public;DROP TABLE anything' },
    { DATABASE_URL: `${env.DATABASE_URL}&options=-c%20search_path%3Dpublic` },
    { BOOKING_ADMIN_EMAILS: `${TEST_RECIPIENT},maat@example.test` },
    { APP_ORIGIN: 'https://sodus-street-studio.vercel.app' },
  ]) assert.throws(() => sandboxSettings({ ...env, ...variation }));
});

test('Postgres query parameters cannot override the validated host, database, credentials or connection options', () => {
  for (const query of [
    'host=production.example', 'hostname=production.example', 'port=6543', 'database=production', 'dbname=production',
    'user=other', 'password=other', 'options=-c%20search_path%3Dpublic', 'sslrootcert=secret-file',
    'sslkey=secret-file', 'sslcert=secret-file', 'sslmode=no-verify', 'sslmode=require&sslmode=disable',
    'Host=production.example', '%68ost=production.example', 'application_name=unapproved',
  ]) assert.throws(() => sandboxSettings({ ...env, DATABASE_URL: `postgresql://fixture:fixture@${DEVELOPMENT_HOST}/sodus?${query}` }));
  assert.throws(() => sandboxSettings({ ...env, DATABASE_URL: `postgresql://fixture:fixture@${DEVELOPMENT_HOST}:6543/sodus` }));
  assert.doesNotThrow(() => sandboxSettings({ ...env, DATABASE_URL: `postgresql://fixture:fixture@${DEVELOPMENT_HOST}:5432/sodus?sslmode=verify-full&channel_binding=require` }));
});

test('execution needs explicit opt-in and complete isolated payment, webhook, refund and email settings', () => {
  assert.throws(() => requireSandboxExecution(sandboxSettings(env)), /Execution is disabled/);
  const optedIn = { ...env, SODUS_SANDBOX_EXECUTE: 'true' };
  assert.doesNotThrow(() => requireSandboxExecution(sandboxSettings(optedIn)));
  for (const variation of [
    { STRIPE_WEBHOOK_SECRET: '' }, { RESEND_API_KEY: '' }, { BOOKING_EMAIL_ENABLED: 'false' },
    { IGLOO_REFUNDS_ENABLED: 'false' }, { IGLOO_TAX_APPROVED: 'false' }, { STRIPE_TAX_RATE_ID: '' },
    { BOOKING_FROM_EMAIL: 'another@example.test' },
  ]) assert.throws(() => requireSandboxExecution(sandboxSettings({ ...optedIn, ...variation })));
});

test('the isolated HTTP app enforces Demo and the prepared package/slot on every checkout before a provider call', async t => {
  const db = await createDatabase({ localPath: 'memory://' });
  const store = new IglooStore(db);
  await store.init();
  const item = await store.savePackage({ name: 'Scoped test', description: 'Fixture only', durationMinutes: 90,
    amountCents: 22500, currency: 'usd', maxGuests: 8, policyText: 'Test only', status: 'active' });
  const slot = await store.saveSlot({ startsAt: '2090-10-21T21:00:00Z', endsAt: '2090-10-21T22:30:00Z', capacity: 1, status: 'open' });
  const c = { ...sandboxSettings(env).config, mock: true };
  let providerCalls = 0;
  t.mock.method(Payments.prototype, 'verifyAccount', async () => { providerCalls += 1; });
  const server = createServer(createApp(c, db, { checkoutRestriction: { email: TEST_RECIPIENT, packageId: item.id, slotId: slot.id } }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/igloo/checkout`;
  const input = { packageId: item.id, slotId: slot.id, name: 'Demo — TEST', email: TEST_RECIPIENT,
    guests: 1, policyAccepted: true, requestId: randomUUID() };
  try {
    for (const variation of [{ email: 'other@example.test' }, { email: 'demo+other@blockbusters.tech' },
      { packageId: randomUUID() }, { slotId: randomUUID() }]) {
      const response = await fetch(url, { method: 'POST', headers: { Origin: c.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, ...variation }) });
      assert.equal(response.status, 403);
      assert.equal((await response.json() as { code: string }).code, 'CHECKOUT_SCOPE');
    }
    assert.equal(providerCalls, 0);
    assert.equal((await store.listBookings()).length, 0);
    const valid = await fetch(url, { method: 'POST', headers: { Origin: c.origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(valid.status, 200);
    assert.ok(providerCalls > 0);
    assert.equal((await store.listBookings()).length, 1);
    assert.equal((await store.listBookings())[0].email, TEST_RECIPIENT);
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    await db.close();
  }
});
