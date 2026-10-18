import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOOKING_CUTOFF_SQL, bookingCutoffAt, bookingWindowOpen } from './booking-policy.js';
import { createDatabase } from './db.js';

const cases = [
  ['2026-10-23T21:00:00Z', '2026-10-23T18:00:00.000Z'],
  ['2026-10-23T23:00:00Z', '2026-10-23T18:00:00.000Z'],
  // The 9pm New York seating is on the previous UTC date.
  ['2026-10-24T01:00:00Z', '2026-10-23T18:00:00.000Z'],
  ['2027-01-15T22:00:00Z', '2027-01-15T19:00:00.000Z'],
  ['2026-03-08T21:00:00Z', '2026-03-08T18:00:00.000Z'],
  ['2026-11-01T22:00:00Z', '2026-11-01T19:00:00.000Z'],
];

test('all seatings close at 2pm on their New York event day, including DST boundaries', () => {
  for (const [start, cutoff] of cases) {
    assert.equal(bookingCutoffAt(start).toISOString(), cutoff);
    const boundary = new Date(cutoff);
    assert.equal(bookingWindowOpen(start, new Date(boundary.getTime() - 1)), true);
    assert.equal(bookingWindowOpen(start, boundary), false);
    assert.equal(bookingWindowOpen(start, new Date(boundary.getTime() + 1)), false);
  }
});

test('past seatings and invalid dates cannot create a new booking window', () => {
  assert.equal(bookingWindowOpen('2026-10-23T14:00:00Z', new Date('2026-10-23T15:00:00Z')), false);
  assert.equal(bookingWindowOpen('invalid', new Date()), false);
  assert.equal(bookingWindowOpen('2026-10-23T21:00:00Z', new Date('invalid')), false);
  assert.throws(() => bookingCutoffAt('invalid'), RangeError);
});

test('database cutoff and application cutoff agree at the exact boundary in different database timezones', async () => {
  const db = await createDatabase({ localPath: 'memory://' });
  try {
    for (const zone of ['UTC', 'Pacific/Auckland']) {
      await db.query(`SET TIME ZONE '${zone}'`);
      for (const [start, cutoff] of cases) {
        const { rows } = await db.query(`SELECT ${BOOKING_CUTOFF_SQL} AS cutoff,
          $2::timestamptz < ${BOOKING_CUTOFF_SQL} AS at_boundary,
          ($2::timestamptz - interval '1 millisecond') < ${BOOKING_CUTOFF_SQL} AS before_boundary
          FROM (SELECT $1::timestamptz AS starts_at) AS slot`, [start, cutoff]);
        assert.equal(new Date(rows[0].cutoff as string).toISOString(), cutoff);
        assert.equal(rows[0].at_boundary, false);
        assert.equal(rows[0].before_boundary, true);
      }
    }
  } finally {
    await db.close();
  }
});
