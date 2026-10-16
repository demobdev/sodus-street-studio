import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './db.js';
import { IglooStore, StoreError } from './store.js';

const enabled = process.env.RUN_POSTGRES_TEST === '1' && Boolean(process.env.DATABASE_URL)
  && process.env.IGLOO_MODE !== 'live' && process.env.NODE_ENV !== 'production';

/** Explicit opt-in: use a dedicated development database, never the live sales database. */
test('pooled PostgreSQL transactions serialize the final igloo and duplicate Checkout delivery', { skip: !enabled }, async () => {
  const db = await createDatabase({ connectionString: process.env.DATABASE_URL });
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
  } finally {
    // Delete only rows owned by this run, even if another development user has added data.
    await db.transaction(async (tx) => {
      await tx.query('DELETE FROM igloo_outbox WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
      await tx.query('DELETE FROM igloo_payment_events WHERE booking_id IN (SELECT id FROM igloo_bookings WHERE package_id=$1)', [packageId]);
      await tx.query('DELETE FROM igloo_bookings WHERE package_id=$1', [packageId]);
      await tx.query('DELETE FROM igloo_slots WHERE id=$1', [slotId]);
      await tx.query('DELETE FROM igloo_packages WHERE id=$1', [packageId]);
    });
    await db.close();
  }
});
