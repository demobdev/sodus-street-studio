import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type { Config } from './config.js';
import { createDatabase, type Database } from './db.js';
import { deliverConfirmations } from './email.js';
import { IglooStore } from './store.js';

const config: Config = {
  local: false, mock: false, mode: 'live', liveAllowed: false,
  origin: 'https://sodus.example.test', secret: 'email-tests-only-not-a-production-secret',
  adminEmails: [], emailEnabled: true, emailKey: 'email-test-key',
  emailFrom: 'Sodus Street Studio <bookings@sodus.example.test>',
  emailReplyTo: 'studio@example.test',
};

let db: Database;
let store: IglooStore;
before(async () => {
  db = await createDatabase({ localPath: 'memory://' });
  store = new IglooStore(db);
  await store.init();
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.query('TRUNCATE igloo_outbox,igloo_payment_events,igloo_bookings,igloo_slots,igloo_packages,igloo_admin_tokens,igloo_admin_sessions,igloo_rate_limits');
});

async function confirmedBooking({ taxed = true, live = true } = {}) {
  const item = await store.savePackage({
    name: 'Classic Sub Tray — fixture', description: 'Email test only.', durationMinutes: 90,
    amountCents: 22_500, currency: 'usd', maxGuests: 8,
    policyText: 'Fixture policy accepted by the guest.', status: 'active',
  });
  const slot = await store.saveSlot({ startsAt: '2090-10-23T21:00:00.000Z', endsAt: '2090-10-23T22:30:00.000Z', capacity: 1, status: 'open' });
  const booking = await store.createHold({
    packageId: item.id, slotId: slot.id, name: 'Test Guest', email: 'guest@example.test',
    guests: 8, policyAccepted: true, requestId: randomUUID(),
  }, { livemode: live });
  if (taxed) {
    await store.prepareCheckout(booking.id, { line_items: [{ tax_rates: ['txr_fixture'] }] },
      { rateId: 'txr_fixture', percentage: 8, taxCents: 1_800 });
  }
  const amounts = { amountCents: taxed ? 24_300 : 22_500, subtotalCents: 22_500, taxCents: taxed ? 1_800 : 0 };
  await store.attachCheckout(booking.id, {
    sessionId: `cs_fixture_${booking.id}`, url: 'https://checkout.stripe.com/fixture',
    expiresAt: new Date(Date.now() + 1_860_000).toISOString(), livemode: live, currency: 'usd', ...amounts,
  });
  return store.applyStripeEvent({
    eventId: `evt_fixture_${booking.id}`, bookingId: booking.id, sessionId: `cs_fixture_${booking.id}`,
    livemode: live, currency: 'usd', ...amounts, paymentStatus: 'paid', sessionStatus: 'complete',
    type: 'checkout.session.completed',
  });
}

type SentBody = { from: string; to: string[]; reply_to: string; subject: string; text: string };

test('confirmed receipt sends the verified subtotal, tax and total with reply-to and a stable idempotency key', async (t) => {
  const booking = await confirmedBooking();
  const requests: { url: string; headers: Headers; body: SentBody }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as SentBody });
    assert.equal(init?.method, 'POST');
    return Response.json({ id: 'email_fixture_success' });
  });

  await deliverConfirmations(store, config);
  assert.equal(requests.length, 1);
  const request = requests[0]!;
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.headers.get('Authorization'), 'Bearer email-test-key');
  assert.equal(request.headers.get('Idempotency-Key'), `igloo-confirmation/${booking.id}`);
  assert.equal(request.body.from, config.emailFrom);
  assert.deepEqual(request.body.to, ['guest@example.test']);
  assert.equal(request.body.reply_to, 'studio@example.test');
  assert.equal(request.body.subject, `Sodus Street igloo booking ${booking.reference}`);
  assert.match(request.body.text, /Subtotal: \$225\.00 USD\nTax: \$18\.00 USD\nTotal paid: \$243\.00 USD/);
  assert.match(request.body.text, /Your payment is confirmed\./);
  assert.match(request.body.text, /5:00 PM/);
  assert.match(request.body.text, /Fixture policy accepted by the guest\./);
  assert.match(request.body.text, /Reply to this email/);
  assert.doesNotMatch(request.body.text, /TEST ONLY/);
  assert.equal((await store.getBooking(booking.id))!.emailStatus, 'sent');
  const outbox = (await db.query('SELECT status,provider_id,attempts FROM igloo_outbox WHERE booking_id=$1', [booking.id])).rows[0]!;
  assert.deepEqual(outbox, { status: 'sent', provider_id: 'email_fixture_success', attempts: 1 });
  await deliverConfirmations(store, config);
  assert.equal(requests.length, 1, 'a sent outbox item is not sent again');
});

test('sandbox receipts are clearly marked as tests and untaxed legacy bookings retain their base total', async (t) => {
  await confirmedBooking({ taxed: false, live: false });
  let sent: SentBody | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body)) as SentBody;
    return Response.json({ id: 'email_fixture_test' });
  });
  await deliverConfirmations(store, { ...config, mode: 'test' });
  assert.ok(sent);
  assert.match(sent.subject, /^\[TEST\] Sodus Street igloo booking /);
  assert.match(sent.text, /TEST ONLY — this is not a real reservation\./);
  assert.match(sent.text, /Subtotal: \$225\.00 USD\nTax: \$0\.00 USD\nTotal paid: \$225\.00 USD/);
});

for (const failure of ['provider error', 'missing acknowledgment', 'network error'] as const) {
  test(`${failure} leaves a failed outbox item for delayed retry without losing the confirmed reservation`, async (t) => {
    const booking = await confirmedBooking();
    const keys: string[] = [];
    t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key') || '');
      if (keys.length > 1) return Response.json({ id: 'email_fixture_retry' });
      if (failure === 'network error') throw new Error('Fixture network failure');
      return failure === 'provider error' ? Response.json({ message: 'Fixture error' }, { status: 503 }) : Response.json({});
    });

    await deliverConfirmations(store, config);
    const saved = (await store.getBooking(booking.id))!;
    assert.equal(saved.status, 'confirmed');
    assert.equal(saved.emailStatus, 'failed');
    const outbox = (await db.query(`SELECT status,attempts,provider_id,sent_at,lease_until,last_error,
      next_attempt_at > now() AS retry_scheduled FROM igloo_outbox WHERE booking_id=$1`, [booking.id])).rows[0]!;
    assert.deepEqual(outbox, {
      status: 'failed', attempts: 1, provider_id: null, sent_at: null, lease_until: null,
      last_error: 'Delivery failed; retry required.', retry_scheduled: true,
    });
    await deliverConfirmations(store, config);
    assert.equal(keys.length, 1, 'failed emails wait for their retry time');

    await db.query("UPDATE igloo_outbox SET next_attempt_at=now()-interval '1 second' WHERE booking_id=$1", [booking.id]);
    await deliverConfirmations(store, config);
    assert.deepEqual(keys, [`igloo-confirmation/${booking.id}`, `igloo-confirmation/${booking.id}`]);
    assert.equal((await store.getBooking(booking.id))!.emailStatus, 'sent');
    assert.equal((await db.query('SELECT attempts FROM igloo_outbox WHERE booking_id=$1', [booking.id])).rows[0]!.attempts, 2);
  });
}

test('disabled delivery and local simulation leave the outbox untouched and make no provider call', async (t) => {
  const booking = await confirmedBooking();
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network call'); });
  await deliverConfirmations(store, { ...config, emailEnabled: false });
  await deliverConfirmations(store, { ...config, local: true, mock: true });
  assert.equal(network.mock.callCount(), 0);
  assert.equal((await store.getBooking(booking.id))!.emailStatus, 'pending');
  assert.deepEqual((await db.query('SELECT status,attempts FROM igloo_outbox WHERE booking_id=$1', [booking.id])).rows[0], { status: 'pending', attempts: 0 });
});
