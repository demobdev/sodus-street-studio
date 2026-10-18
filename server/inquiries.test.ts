import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { Inquiries, parseInquiry } from './inquiries.js';
import { IglooStore } from './store.js';

const originalFetch = globalThis.fetch;
const config: Config = {
  local: false, mock: false, mode: 'live', liveAllowed: false, refundsEnabled: false,
  origin: 'https://sodus.example.test', secret: 'inquiry-tests-only-secret-over-thirty-two-characters',
  adminEmails: [], emailEnabled: true, emailKey: 'inquiry-fixture-key',
  emailFrom: 'Sodus Street Studio <bookings@sodus.example.test>', emailReplyTo: 'studio@example.test',
};
let db: Database;
const servers: Server[] = [];
before(async () => {
  db = await createDatabase({ localPath: 'memory://' });
  await new IglooStore(db).init();
});
beforeEach(async () => {
  await db.query('TRUNCATE studio_inquiry_requests,igloo_rate_limits');
});
after(async () => {
  await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  })));
  await db.close();
});

function input(type: 'contact' | 'studio' | 'igloo' = 'contact') {
  return {
    type, requestId: randomUUID(), name: 'Fixture Guest', email: 'guest@example.test', phone: '555-0100',
    projectType: type === 'contact' ? 'Podcast production' : '', message: 'Fixture inquiry — do not send live email.',
    ...(type === 'studio' ? { sessionType: 'Voiceover Recording', preferredDate: '2090-10-23', preferredTime: '17:00', guests: '0', projectDescription: 'Fixture voiceover project.' } : {}),
  };
}

async function start(c = config) {
  const server = createServer(createApp(c, db));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return (body: unknown, headers: Record<string, string> = {}, route = '/inquiry') => originalFetch(`http://127.0.0.1:${address.port}/api/igloo${route}`, {
    method: 'POST', headers: { Origin: c.origin, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('all inquiry types use the original fixed recipient, verified sender and visitor Reply-To while reservations stay closed', async t => {
  const sent: { body: Record<string, unknown>; headers: Headers }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    assert.equal(url, 'https://api.resend.com/emails');
    sent.push({ body: JSON.parse(String(options?.body)), headers: new Headers(options?.headers) });
    return Response.json({ id: `fixture-email-${sent.length}` });
  });
  const request = await start();
  for (const type of ['studio', 'contact', 'igloo'] as const) {
    const payload = input(type); const response = await request(payload);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
    const email = sent.at(-1)!;
    assert.deepEqual(email.body.to, ['maat@onthemovecs.com']);
    assert.equal(email.body.from, config.emailFrom);
    assert.equal(email.body.reply_to, payload.email);
    assert.equal(email.headers.get('Idempotency-Key'), `studio-inquiry/${payload.requestId}`);
    assert.match(String(email.body.text), /Inquiry only — no reservation, payment or inventory hold was created/);
    assert.equal('html' in email.body, false);
    const expectedPath = type === 'igloo' ? 'igloos' : type === 'studio' ? 'booking' : 'contact';
    assert.match(String(email.body.text), new RegExp(`https://sodus.example.test/${expectedPath}`));
  }
  assert.equal((await db.query('SELECT id FROM igloo_bookings')).rows.length, 0);
  assert.equal((await db.query('SELECT id FROM igloo_outbox')).rows.length, 0);
  const checkout = await request({}, {}, '/checkout');
  assert.equal(checkout.status, 503); assert.equal((await checkout.json() as { code: string }).code, 'NOT_CONFIGURED');
  assert.equal(sent.length, 3);
});

test('inquiry HTTP boundary rejects untrusted origins, malformed JSON, oversized bodies and unsafe fields without sending', async t => {
  const send = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider request'); });
  const request = await start();
  assert.equal((await request(input(), { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request(input(), { Origin: '' })).status, 403);
  assert.equal((await request(input(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request('{')).status, 400);
  assert.equal((await request([])).status, 400);
  assert.equal((await request({ ...input(), message: 'x'.repeat(70_000) })).status, 413);
  for (const change of [{ email: 'guest@example.test\r\nBcc: other@example.test' }, { name: 'Fixture\nInjected' }, { message: 'x'.repeat(8001) }, { type: 'other' }, { to: 'other@example.test' }, { website: 'https://bot.example' }]) {
    const response = await request({ ...input(), ...change }); assert.equal(response.status, 400);
    assert.equal(JSON.stringify(await response.json()).includes('maat@'), false);
  }
  assert.equal(send.mock.callCount(), 0);
  assert.equal((await db.query('SELECT request_id FROM studio_inquiry_requests')).rows.length, 0);
});

test('sent requests are durable duplicates and changed payloads cannot reuse their idempotency key', async t => {
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'fixture-accepted' }));
  const inquiry = new Inquiries(db, config); const payload = parseInquiry(input());
  assert.deepEqual(await inquiry.submit(payload), { ok: true });
  await db.query("UPDATE studio_inquiry_requests SET created_at=now()-interval '2 days'");
  assert.deepEqual(await new Inquiries(db, config).submit(payload), { ok: true });
  await assert.rejects(inquiry.submit({ ...payload, message: 'Changed request' }), { code: 'INQUIRY_CHANGED' });
  assert.equal(send.mock.callCount(), 1);
  const row = (await db.query('SELECT * FROM studio_inquiry_requests')).rows[0]!;
  assert.equal(row.status, 'sent'); assert.equal(row.provider_id, 'fixture-accepted');
  for (const privateValue of [payload.name, payload.email, payload.message]) assert.equal(JSON.stringify(row).includes(privateValue), false);
});

test('concurrent submissions claim one send; retry after an uncertain failure reuses the provider key', async t => {
  let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  const keys: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    keys.push(new Headers(options?.headers).get('Idempotency-Key')!);
    if (keys.length === 1) { entered(); await waiting; throw new Error('Fixture network timeout after unknown provider result'); }
    return Response.json({ id: 'fixture-retry' });
  });
  const inquiry = new Inquiries(db, config); const payload = parseInquiry(input());
  const first = inquiry.submit(payload); const rejected = assert.rejects(first, { code: 'INQUIRY_UNAVAILABLE' });
  await started;
  await assert.rejects(new Inquiries(db, config).submit(payload), { code: 'INQUIRY_SENDING' });
  release(); await rejected;
  assert.deepEqual(await inquiry.submit(payload), { ok: true });
  assert.deepEqual(keys, [`studio-inquiry/${payload.requestId}`, `studio-inquiry/${payload.requestId}`]);
});

test('provider failures never leak diagnostics, never claim success and stop retries before provider deduplication expires', async t => {
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'PRIVATE PROVIDER DIAGNOSTIC maat@onthemovecs.com' }, { status: 403 }));
  const request = await start(); const payload = input(); const response = await request(payload);
  assert.equal(response.status, 503);
  const error = JSON.stringify(await response.json()); assert.match(error, /INQUIRY_UNAVAILABLE/);
  assert.doesNotMatch(error, /PRIVATE|maat@|Activation|api\.resend/);
  await db.query("UPDATE studio_inquiry_requests SET created_at=now()-interval '24 hours'");
  const expired = await request(payload); assert.equal(expired.status, 503);
  assert.equal((await expired.json() as { code: string }).code, 'INQUIRY_REVIEW');
  assert.equal(send.mock.callCount(), 1);
});

test('local mock mode explicitly simulates, and disabled production delivery fails closed', async t => {
  const send = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider request'); });
  const local = await start({ ...config, local: true, mock: true, emailEnabled: false });
  assert.deepEqual(await (await local(input())).json(), { ok: true, simulated: true });
  const disabled = await start({ ...config, emailEnabled: false });
  assert.equal((await disabled(input())).status, 503); assert.equal(send.mock.callCount(), 0);
  assert.equal((await db.query('SELECT request_id FROM studio_inquiry_requests')).rows.length, 0);
});

test('database-backed email and IP limits protect inquiry sending across application instances', async t => {
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: `fixture-${randomUUID()}` }));
  const first = await start(); const second = await start();
  for (let i = 0; i < 5; i++) assert.equal((await (i % 2 ? first : second)(input())).status, 200);
  assert.equal((await second(input())).status, 429);
  for (let i = 0; i < 4; i++) assert.equal((await first({ ...input(), email: `other${i}@example.test` })).status, 200);
  assert.equal((await second({ ...input(), email: 'last@example.test' })).status, 429);
  assert.equal(send.mock.callCount(), 9);
});

test('field validation checks actual dates, time bounds, header controls, required details and guest bounds', () => {
  for (const change of [{ preferredDate: '2090-02-30' }, { preferredDate: 'not-a-date' }, { preferredTime: '24:00' }, { guests: '-1' }, { guests: '1001' }, { sessionType: '' }, { projectDescription: '' }, { email: '.guest@example.test' }, { email: 'guest@example..test' }]) {
    assert.throws(() => parseInquiry({ ...input('studio'), ...change }), { code: 'INVALID_INPUT' });
  }
  assert.equal(parseInquiry({ ...input(), message: 'A multiline\nmessage\nwith details.' }).message, 'A multiline\nmessage\nwith details.');
});
