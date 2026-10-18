import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLocalMockEnvironment, iglooEventPackages, iglooEventSlots } from './seed-local.js';

test('local event has four exclusive platter choices at the supplied base price and party limit', () => {
  assert.equal(iglooEventPackages.length, 4);
  assert.deepEqual(iglooEventPackages.map((item) => item.name), [
    'Classic Sub Tray — TEST ONLY', 'Charcuterie Experience — TEST ONLY',
    'Italian Favorites — TEST ONLY', 'Casual Favorites Platter — TEST ONLY',
  ]);
  for (const item of iglooEventPackages) {
    assert.equal(item.amountCents, 22_500);
    assert.equal(item.maxGuests, 8);
    assert.equal(item.durationMinutes, 90);
    assert.match(item.policyText, /tax is not calculated/);
    assert.match(item.policyText, /Customer cancellations, refunds, rescheduling and exchanges are not available/);
    assert.match(item.policyText, /2pm Eastern/);
    assert.match(item.policyText, /8% tax.*\$243/);
  }
});

test('event uses twelve New York times with a shared four-igloo pool', () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const displayed = iglooEventSlots.map((slot) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(slot.startsAt)).map((part) => [part.type, part.value]));
    assert.equal(slot.capacity, 4);
    assert.equal(Date.parse(slot.endsAt) - Date.parse(slot.startsAt), 90 * 60_000);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  });
  assert.deepEqual(displayed, ['2026-10-23', '2026-10-24', '2026-10-30', '2026-10-31'].flatMap((day) => ['17:00', '19:00', '21:00'].map((time) => `${day} ${time}`)));
  assert.equal(new Set(iglooEventSlots.map((slot) => slot.id)).size, 12);
});

test('seed guard rejects hosted, production, live and Stripe-backed execution', () => {
  assert.doesNotThrow(() => assertLocalMockEnvironment({ PAYMENTS_DRIVER: 'mock', IGLOO_MODE: 'test' }));
  for (const overrides of [{ VERCEL: '1' }, { NODE_ENV: 'production' }, { PAYMENTS_DRIVER: 'stripe' }, { IGLOO_MODE: 'live' }, { IGLOO_ALLOW_LIVE: 'true' }]) {
    assert.throws(() => assertLocalMockEnvironment({ PAYMENTS_DRIVER: 'mock', ...overrides }), /local mock only/);
  }
});
