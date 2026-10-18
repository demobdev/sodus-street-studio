/**
 * Real Stripe sandbox lifecycle, isolated from the existing development outbox.
 * Run with a separate ignored env file, never the production environment:
 * npx tsx --env-file=.env.sandbox.local server/sandbox-lifecycle.ts <phase>
 * Phases: plan, prepare, serve, login, inspect, refund, cleanup.
 * Every mutating phase requires SODUS_SANDBOX_EXECUTE=true after credentials are ready.
 * Checkout is completed in the browser using Stripe's test payment details.
 */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configuration, readiness, type Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { IglooStore } from './store.js';
import { Payments } from './payments.js';
import { createApp } from './app.js';
import { IGLOO_BOOKING_POLICY } from './booking-policy.js';

export const SANDBOX_ACCOUNT = 'acct_1UQXvR2d5P44qe8A';
export const DEVELOPMENT_HOST = 'ep-dark-river-b8k8zhub.c-14.us-east-1.aws.neon.tech';
const DEVELOPMENT_POOLER_HOST = 'ep-dark-river-b8k8zhub-pooler.c-14.us-east-1.aws.neon.tech';
export const TEST_RECIPIENT = 'demo@blockbusters.tech';
const TEST_ORIGIN = 'http://127.0.0.1:5173';
const TEST_API = 'http://127.0.0.1:4318/api/igloo';
const STAFF_REFUND_NOTE = 'SANDBOX TEST ONLY: simulated weather closure. No real reservation or funds.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;
export class SandboxGuardError extends Error { constructor(message: string) { super(message); this.name = 'SandboxGuardError'; } }
export interface SandboxSettings {
  config: Config; runId: string; schema: string; baseDatabaseUrl: string; scopedDatabaseUrl: string;
  executionAllowed: boolean;
}
interface Run {
  runId: string; packageId: string; slotId: string; startsAt: string; endsAt: string; retiredAt: string | null;
}

/** A single validated namespace, without a public-schema fallback, owns every application table. */
export function sandboxSettings(env: NodeJS.ProcessEnv): SandboxSettings {
  if (env.VERCEL || env.NODE_ENV === 'production' || env.IGLOO_MODE !== 'test' || env.PAYMENTS_DRIVER === 'mock' || env.IGLOO_ALLOW_LIVE !== 'false') {
    throw new SandboxGuardError('Use local, non-mock test mode with IGLOO_ALLOW_LIVE=false.');
  }
  if (env.STRIPE_ACCOUNT_ID !== SANDBOX_ACCOUNT || !/^(rk|sk)_test_/.test(env.STRIPE_SECRET_KEY ?? '')) {
    throw new SandboxGuardError('The exact Sodus sandbox account and a test key are required.');
  }
  const runId = String(env.SODUS_SANDBOX_RUN_ID ?? '').toLowerCase();
  if (!UUID.test(runId)) throw new SandboxGuardError('SODUS_SANDBOX_RUN_ID must be a fresh UUID saved in the private test env file.');
  const schema = `igloo_sandbox_${runId.replaceAll('-','')}`;
  let database: URL;
  try { database = new URL(env.DATABASE_URL ?? ''); }
  catch { throw new SandboxGuardError('An explicit development database URL is required.'); }
  if (!['postgres:','postgresql:'].includes(database.protocol) || ![DEVELOPMENT_HOST,DEVELOPMENT_POOLER_HOST].includes(database.hostname) ||
    database.pathname !== '/sodus' || (database.port && database.port !== '5432') || database.hash) {
    throw new SandboxGuardError('This harness accepts only the existing Sodus development host and sodus database.');
  }
  // pg-connection-string copies query keys such as host/user/database over URL fields.
  // Only these known TLS settings may survive validation; no override or duplicate keys.
  const seen = new Set<string>();
  for (const [name, value] of database.searchParams) {
    if (seen.has(name) || !((name === 'sslmode' && ['require','verify-ca','verify-full'].includes(value)) ||
      (name === 'channel_binding' && value === 'require'))) {
      throw new SandboxGuardError('Database URL query parameters may contain only approved, unique TLS settings.');
    }
    seen.add(name);
  }
  // Neon transaction pooling rejects search_path startup options. Use the explicitly
  // approved direct hostname for this same development endpoint and existing credentials.
  database.hostname = DEVELOPMENT_HOST;
  const baseDatabaseUrl = database.toString();
  database.searchParams.set('options', `-c search_path=${schema}`);
  const scopedDatabaseUrl = database.toString();
  const config = configuration(true, env);
  config.databaseUrl = scopedDatabaseUrl;
  if (config.origin !== TEST_ORIGIN) throw new SandboxGuardError(`APP_ORIGIN must be ${TEST_ORIGIN} for this local harness.`);
  if (config.adminEmails.length !== 1 || config.adminEmails[0] !== TEST_RECIPIENT) {
    throw new SandboxGuardError(`BOOKING_ADMIN_EMAILS must contain only ${TEST_RECIPIENT} during this test.`);
  }
  return { config, runId, schema, baseDatabaseUrl, scopedDatabaseUrl, executionAllowed: env.SODUS_SANDBOX_EXECUTE === 'true' };
}

export function requireSandboxExecution(settings: SandboxSettings): void {
  if (!settings.executionAllowed) throw new SandboxGuardError('Execution is disabled. Set SODUS_SANDBOX_EXECUTE=true only after the test credentials are ready.');
  const c = settings.config;
  const missing = readiness(c);
  if (missing.length) throw new SandboxGuardError(`Sandbox setup is incomplete: ${missing.join(', ')}.`);
  if (!c.refundsEnabled || !c.taxApproved || !c.stripeTaxRateId) throw new SandboxGuardError('Enable refunds and the approved sandbox tax rate only in the isolated test environment.');
  const from = c.emailFrom?.match(/<([^<>]+)>\s*$/)?.[1] ?? c.emailFrom?.trim();
  if (from?.toLowerCase() !== 'bookings@sodusstreetstudio.com') throw new SandboxGuardError('Use the verified bookings@sodusstreetstudio.com sender.');
}

function mapRun(row: Row): Run {
  return { runId: String(row.run_id), packageId: String(row.package_id), slotId: String(row.slot_id),
    startsAt: new Date(row.starts_at as string).toISOString(), endsAt: new Date(row.ends_at as string).toISOString(),
    retiredAt: row.retired_at == null ? null : new Date(row.retired_at as string).toISOString() };
}
async function verifyScope(db: Database, settings: SandboxSettings): Promise<void> {
  const row = (await db.query('SELECT current_schema() AS schema,current_setting(\'search_path\') AS search_path')).rows[0];
  if (row.schema !== settings.schema || row.search_path !== settings.schema) throw new SandboxGuardError('The database connection is not exclusively scoped to this test run.');
}
async function readRun(db: Database, settings: SandboxSettings): Promise<Run> {
  await verifyScope(db, settings);
  const rows = (await db.query('SELECT * FROM igloo_sandbox_run')).rows;
  if (rows.length !== 1 || rows[0].run_id !== settings.runId || rows[0].recipient !== TEST_RECIPIENT) throw new SandboxGuardError('Sandbox ownership marker is missing or does not match this run.');
  return mapRun(rows[0]);
}
async function verifyRecipients(db: Database, run: Run): Promise<void> {
  const unsafe = (await db.query(`SELECT id FROM igloo_bookings WHERE livemode=true OR email<>$1
    OR package_id<>$2 OR slot_id<>$3 LIMIT 1`, [TEST_RECIPIENT, run.packageId, run.slotId])).rows;
  if (unsafe.length) throw new SandboxGuardError('Unexpected booking data or recipient found. Stop rather than processing this test schema.');
}
function futureSeating(): { startsAt: string; endsAt: string } {
  const future = new Date(Date.now() + 14 * 86_400_000);
  let start = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 21));
  const nyHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(start));
  start = new Date(start.getTime() + (17 - nyHour) * 3_600_000);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 90 * 60_000).toISOString() };
}

async function prepare(settings: SandboxSettings): Promise<void> {
  requireSandboxExecution(settings);
  // Verify Stripe identity and test tax before creating any isolated database fixture.
  const base = await createDatabase({ connectionString: settings.baseDatabaseUrl });
  try {
    const payments = new Payments(new IglooStore(base), settings.config);
    await payments.verifyAccount({ requireCharges: false });
    const rate = await payments.stripe!.taxRates.retrieve(settings.config.stripeTaxRateId!, {}, { timeout: 10_000, maxNetworkRetries: 0 });
    if (rate.livemode || !rate.active || rate.inclusive || rate.percentage !== 8 || rate.rate_type === 'flat_amount') {
      throw new SandboxGuardError('The configured sandbox Tax Rate must be active, exclusive, 8%, and test mode.');
    }
    await base.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`sandbox-run:${settings.runId}`]);
      const exists = (await tx.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [settings.schema])).rows.length > 0;
      if (exists) return; // Existing ownership is verified below. Never adopt an unrelated schema.
      // schema is derived solely from a validated UUID, never arbitrary input.
      await tx.query(`CREATE SCHEMA "${settings.schema}"`);
      await tx.query(`CREATE TABLE "${settings.schema}".igloo_sandbox_run (
        run_id uuid PRIMARY KEY,recipient text NOT NULL,package_id uuid NOT NULL,slot_id uuid NOT NULL,
        starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),retired_at timestamptz)`);
      const seating = futureSeating();
      await tx.query(`INSERT INTO "${settings.schema}".igloo_sandbox_run(run_id,recipient,package_id,slot_id,starts_at,ends_at)
        VALUES($1,$2,$3,$4,$5,$6)`, [settings.runId, TEST_RECIPIENT, randomUUID(), randomUUID(), seating.startsAt, seating.endsAt]);
    });
  } finally { await base.close(); }
  const db = await createDatabase({ connectionString: settings.scopedDatabaseUrl });
  try {
    const run = await readRun(db, settings);
    if (run.retiredAt) throw new SandboxGuardError('This run was retired. Use a fresh run UUID instead of reopening it.');
    const store = new IglooStore(db);
    await store.init();
    await verifyRecipients(db, run);
    if (!(await store.listPackages(true)).some(p => p.id === run.packageId)) {
      await store.savePackage({ id: run.packageId, name: 'Sodus igloo — SANDBOX TEST ONLY',
        description: 'One igloo, 90 minutes, up to eight guests. Test checkout only; no real booking or funds.',
        durationMinutes: 90, amountCents: 22_500, currency: 'usd', maxGuests: 8,
        policyText: `SANDBOX TEST ONLY — no real reservation or funds. ${IGLOO_BOOKING_POLICY}`, status: 'active' });
    }
    if (!(await store.listSlots(true)).some(s => s.id === run.slotId)) {
      await store.saveSlot({ id: run.slotId, startsAt: run.startsAt, endsAt: run.endsAt, capacity: 1, status: 'open' });
    }
    console.log(JSON.stringify({ prepared: true, runId: run.runId, schema: settings.schema,
      packageId: run.packageId, slotId: run.slotId, startsAt: run.startsAt,
      subtotalCents: 22_500, taxCents: 1800, totalCents: 24_300, recipient: TEST_RECIPIENT,
      next: 'Start the isolated API with serve, then complete Checkout in the browser. No Checkout Session or email was created by prepare.' }, null, 2));
  } finally { await db.close(); }
}

async function withRun<T>(settings: SandboxSettings, action: (db: Database, run: Run) => Promise<T>): Promise<T> {
  const db = await createDatabase({ connectionString: settings.scopedDatabaseUrl });
  try { const run = await readRun(db, settings); await verifyRecipients(db, run); return await action(db, run); }
  finally { await db.close(); }
}

async function inspect(settings: SandboxSettings): Promise<void> {
  await withRun(settings, async (db, run) => {
    // This phase intentionally never polls /booking or calls Payments.reconcile: those
    // may confirm via an API read and cannot prove a Stripe-origin webhook was delivered.
    const bookings = (await db.query(`SELECT id,reference,status,livemode,amount_cents,tax_cents,total_cents,
      payment_intent_id IS NOT NULL AS payment_intent_recorded,email_status,refunded_at
      FROM igloo_bookings ORDER BY created_at`)).rows;
    const events = (await db.query('SELECT event_id,booking_id FROM igloo_payment_events ORDER BY processed_at')).rows;
    const refunds = (await db.query(`SELECT id,booking_id,reason,amount_cents,currency,status,refund_id,completed_at,error
      FROM igloo_refund_operations ORDER BY created_at`)).rows;
    const refundEvents = (await db.query('SELECT kind,stripe_event_id FROM igloo_refund_events ORDER BY created_at')).rows;
    const guestMessages = (await db.query('SELECT booking_id,status,provider_id,attempts FROM igloo_outbox')).rows;
    const alerts = (await db.query('SELECT booking_id,kind,recipient,status,provider_id,attempts FROM igloo_booking_alerts ORDER BY created_at')).rows;
    const slot = (await new IglooStore(db).listSlots(true)).find(s => s.id === run.slotId);
    console.log(JSON.stringify({ runId: run.runId, schema: settings.schema, retiredAt: run.retiredAt,
      bookings, paymentEvents: events, stripeOriginPaymentSeen: events.some(e => String(e.event_id).startsWith('evt_')),
      refunds, refundEvents, stripeOriginRefundSeen: refundEvents.some(e => String(e.stripe_event_id ?? '').startsWith('evt_')),
      guestMessages, alerts, slot,
      emailEvidence: 'A provider_id means Resend accepted the message. Verify delivery status and the actual Demo inbox separately.' }, null, 2));
  });
}

async function api(settings: SandboxSettings, route: string, body?: unknown, session?: string): Promise<{ response: Response; data: Record<string, unknown> }> {
  const response = await fetch(`${TEST_API}${route}`, { method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(route === '/admin/refund/reconcile' ? 80_000 : 35_000),
    headers: { Origin: settings.config.origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(session ? { Cookie: `sodus_igloo_admin=${session}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new SandboxGuardError(`Test API ${route} returned ${response.status} (${String(data.code ?? 'unknown')}).`);
  return { response, data };
}

async function verifyApiRun(settings: SandboxSettings, run: Run): Promise<void> {
  const { data } = await api(settings, '/catalog');
  if (data.mode !== 'test' || !data.bookingOpen || /local simulation/i.test(String(data.notice)) ||
    !Array.isArray(data.packages) || !data.packages.some((p: Row) => p.id === run.packageId)) {
    throw new SandboxGuardError('The local API is not serving this ready, isolated Stripe sandbox run.');
  }
}

async function login(settings: SandboxSettings): Promise<void> {
  requireSandboxExecution(settings);
  await withRun(settings, async (_db, run) => {
    if (run.retiredAt) throw new SandboxGuardError('This run is retired.');
    await verifyApiRun(settings, run);
    await api(settings, '/admin/login', { email: TEST_RECIPIENT });
    console.log(JSON.stringify({ loginRequested: true, recipient: TEST_RECIPIENT,
      next: 'Check the actual inbox. For the refund phase, supply its one-time token privately as SODUS_SANDBOX_LOGIN_TOKEN. Do not print or commit the token.' }));
  });
}

async function refund(settings: SandboxSettings, env: NodeJS.ProcessEnv): Promise<void> {
  requireSandboxExecution(settings);
  const loginToken = env.SODUS_SANDBOX_LOGIN_TOKEN;
  if (!loginToken || !/^[A-Za-z0-9_-]{43}$/.test(loginToken)) throw new SandboxGuardError('Supply a fresh one-time staff-login token privately from the actual delivered email.');
  await withRun(settings, async (db, run) => {
    if (run.retiredAt) throw new SandboxGuardError('This run is retired.');
    await verifyApiRun(settings, run);
    const bookings = (await db.query('SELECT * FROM igloo_bookings WHERE package_id=$1 AND slot_id=$2', [run.packageId, run.slotId])).rows;
    if (bookings.length !== 1 || !['confirmed','cancelled'].includes(String(bookings[0].status)) ||
      Number(bookings[0].amount_cents) !== 22_500 || Number(bookings[0].tax_cents) !== 1800 || Number(bookings[0].total_cents) !== 24_300 || !bookings[0].payment_intent_id) {
      throw new SandboxGuardError('Exactly one verified $243 sandbox booking is required before the closure refund test.');
    }
    const booking = bookings[0];
    const redeemed = await api(settings, '/admin/session', { token: loginToken });
    const session = redeemed.response.headers.get('set-cookie')?.match(/(?:^|[;,]\s*)sodus_igloo_admin=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
    if (!session) throw new SandboxGuardError('The one-time email sign-in did not create a staff session.');
    try {
      const admin = (await api(settings, '/admin', undefined, session)).data;
      if (admin.mode !== 'test' || admin.refundsEnabled !== true || !Array.isArray(admin.bookings) ||
        !admin.bookings.some((b: Row) => b.id === booking.id && b.totalCents === 24_300) ||
        !Array.isArray(admin.packages) || !admin.packages.some((p: Row) => p.id === run.packageId)) {
        throw new SandboxGuardError('The authenticated API does not match this sandbox booking.');
      }
      await api(settings, '/admin/slot', { id: run.slotId, startsAt: run.startsAt, endsAt: run.endsAt, capacity: 1, status: 'closed' }, session);
      const requested = await api(settings, '/admin/refund', { bookingId: booking.id, requestId: settings.runId,
        reason: 'weather', note: STAFF_REFUND_NOTE }, session);
      await api(settings, '/admin/refund/reconcile', { bookingId: booking.id }, session);
      console.log(JSON.stringify({ refundRequested: true, bookingId: booking.id,
        operationId: (requested.data.refund as Row)?.id, requestedAmountCents: 24_300,
        next: 'Wait for the real Stripe refund event, then inspect. Verify the guest refund email in the actual inbox.' }));
    } finally { await api(settings, '/admin/logout', {}, session); }
  });
}

async function cleanup(settings: SandboxSettings): Promise<void> {
  requireSandboxExecution(settings);
  await withRun(settings, async (db, run) => {
    const unsettled = (await db.query("SELECT id FROM igloo_bookings WHERE status IN ('held','awaiting_payment','confirmed','needs_review') LIMIT 1")).rows;
    if (unsettled.length) throw new SandboxGuardError('Settle/refund or expire the test checkout before cleanup. This phase never deletes payment evidence.');
    const store = new IglooStore(db);
    const item = (await store.listPackages(true)).find(p => p.id === run.packageId);
    const slot = (await store.listSlots(true)).find(s => s.id === run.slotId);
    if (item) await store.savePackage({ ...item, status: 'draft' });
    if (slot) await store.saveSlot({ ...slot, status: 'closed' });
    await db.query('UPDATE igloo_sandbox_run SET retired_at=coalesce(retired_at,now()) WHERE run_id=$1', [settings.runId]);
    console.log(JSON.stringify({ retired: true, schema: settings.schema, evidenceRetained: true,
      next: 'Stop the temporary API/tunnel and disable its sandbox webhook after delivery checks. Production was not changed.' }));
  });
}

export async function runSandboxPhase(phase: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const settings = sandboxSettings(env);
  if (phase === 'plan') {
    console.log(JSON.stringify({ account: SANDBOX_ACCOUNT, databaseHost: DEVELOPMENT_HOST, schema: settings.schema,
      runId: settings.runId, recipient: TEST_RECIPIENT, executionAllowed: settings.executionAllowed,
      subtotalCents: 22_500, taxCents: 1800, totalCents: 24_300,
      prerequisites: ['Sandbox restricted key: Accounts Read, Checkout Sessions Write, Charges and Refunds Write, Tax Rates Read',
        'Active exclusive 8% sandbox Tax Rate', 'Sandbox webhook signing secret for all seven supported events',
        'Verified Sodus domain-restricted email credential; only Demo in the test staff allowlist'],
      sequence: ['prepare', 'serve', 'login', 'Browser Checkout with Stripe test card', 'inspect (actual evt_* payment evidence)',
        'refund (fresh emailed login token)', 'inspect (actual refund event and delivered emails)', 'cleanup'] }, null, 2));
  } else if (phase === 'prepare') await prepare(settings);
  else if (phase === 'inspect') await inspect(settings);
  else if (phase === 'login') await login(settings);
  else if (phase === 'refund') await refund(settings, env);
  else if (phase === 'cleanup') await cleanup(settings);
  else if (phase === 'serve') {
    requireSandboxExecution(settings);
    // Pass the verified isolated database explicitly; createApp must not select a
    // connection or a fallback schema from the process environment for this run.
    const db = await createDatabase({ connectionString: settings.scopedDatabaseUrl });
    try {
      const run = await readRun(db, settings);
      await verifyRecipients(db, run);
      if (run.retiredAt) throw new SandboxGuardError('This run is retired.');
      const server = createServer(createApp(settings.config, db, { checkoutRestriction: {
        email: TEST_RECIPIENT, packageId: run.packageId, slotId: run.slotId,
      } }));
      server.once('close', () => { void db.close(); });
      await new Promise<void>((resolveStarted, reject) => { server.once('error', reject); server.listen(4318, '127.0.0.1', resolveStarted); });
      console.log(`Isolated Sodus Stripe sandbox API listening on http://127.0.0.1:4318; schema ${settings.schema}. Production remains unchanged.`);
    } catch (error) { await db.close(); throw error; }
  } else throw new SandboxGuardError('Choose plan, prepare, serve, login, inspect, refund or cleanup.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSandboxPhase(process.argv[2] ?? 'plan').catch(error => {
    // Never log SDK/connection error objects: they can contain credentials or tokens.
    console.error(error instanceof SandboxGuardError ? error.message : `Sandbox phase failed (${error instanceof Error ? error.name : 'unknown error'}).`);
    process.exitCode = 1;
  });
}
