export const IGLOO_TIME_ZONE = 'America/New_York';

/** Maát's approved October 2026 terms, retained with each reservation at purchase. */
export const IGLOO_BOOKING_POLICY = 'Full payment is required at booking. Each reservation includes one igloo for 90 minutes, up to eight guests and one selected platter. The price is $225 plus 8% tax ($18), for a total of $243. New reservations close at 2pm Eastern on the event day. An already-started checkout may be completed within its payment window. Customer cancellations, refunds, rescheduling and exchanges are not available. If you cannot attend, you may give your ticket to a friend or family member. If Sodus Street Studio closes for weather or unforeseen circumstances, you will receive a full refund.';

/** Internal SQL expression: the seating's New York calendar date, at 14:00 in New York. */
export const BOOKING_CUTOFF_SQL = "(((starts_at AT TIME ZONE 'America/New_York')::date + TIME '14:00') AT TIME ZONE 'America/New_York')";

const localClock = new Intl.DateTimeFormat('en-US', {
  timeZone: IGLOO_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function localParts(date: Date) {
  const parts = Object.fromEntries(localClock.formatToParts(date).map(({ type, value }) => [type, value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

/** Resolve 2pm on the event's local date without depending on the server's timezone. */
export function bookingCutoffAt(startsAt: string | Date): Date {
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime())) throw new RangeError('Invalid seating start time.');
  const event = localParts(start);
  const localTarget = Date.UTC(event.year, event.month - 1, event.day, 14);
  let instant = localTarget;
  // Resolve the zone offset at the target time. 14:00 is unambiguous on New York DST transition days.
  for (let attempt = 0; attempt < 2; attempt++) {
    const wall = localParts(new Date(instant));
    const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    instant += localTarget - wallAsUtc;
  }
  return new Date(instant);
}

export function bookingWindowOpen(startsAt: string | Date, now: Date = new Date()): boolean {
  const instant = now.getTime();
  return Number.isFinite(instant) && instant < new Date(startsAt).getTime() && instant < bookingCutoffAt(startsAt).getTime();
}
