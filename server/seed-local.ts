import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from './db.js';
import { IglooStore, type PackageInput, type SlotInput } from './store.js';
import { IGLOO_BOOKING_POLICY } from './booking-policy.js';

export const legacyPackageId = '10000000-0000-4000-8000-000000000001';
export const legacySlotIds = [1, 2, 3].map((number) => `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`);

const eventDates = ['2026-10-23', '2026-10-24', '2026-10-30', '2026-10-31'];
const localHours = ['17:00', '19:00', '21:00'];
const policyText = `LOCAL SIMULATION ONLY: this does not create a real reservation or charge a payment; tax is not calculated in this preview. Approved live-booking terms: ${IGLOO_BOOKING_POLICY}`;

export const iglooEventPackages: PackageInput[] = [
  ['Classic Sub Tray', 'Assorted subs.'],
  ['Charcuterie Experience', 'Meats, cheeses and accompaniments.'],
  ['Italian Favorites', 'Meatballs and mozzarella Caprese.'],
  ['Casual Favorites Platter', 'Burgers and chicken fingers.'],
].map(([name, platter], index) => ({
  id: `10000000-0000-4000-8000-${String(index + 101).padStart(12, '0')}`,
  name: `${name} — TEST ONLY`,
  description: `One igloo for 90 minutes and up to eight guests, including one ${name} platter. ${platter} Live price: $225 plus 8% tax ($243 total); this local simulation does not calculate tax.`,
  durationMinutes: 90,
  amountCents: 22_500,
  currency: 'usd',
  maxGuests: 8,
  policyText,
  status: 'active',
}));

// All supplied October dates are in EDT (America/New_York, UTC−04:00).
// One slot pool is shared by all platter choices: four igloos, not four per platter.
export const iglooEventSlots: SlotInput[] = eventDates.flatMap((date, dateIndex) => localHours.map((hour, hourIndex) => {
  const startsAt = new Date(`${date}T${hour}:00-04:00`);
  return {
    id: `20000000-0000-4000-8000-${String(dateIndex * localHours.length + hourIndex + 101).padStart(12, '0')}`,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 90 * 60_000).toISOString(),
    capacity: 4,
    status: 'open',
  };
}));

export function assertLocalMockEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.VERCEL || env.NODE_ENV === 'production' || env.PAYMENTS_DRIVER !== 'mock' || env.IGLOO_MODE === 'live' || env.IGLOO_ALLOW_LIVE === 'true') {
    throw new Error('Seed is local mock only.');
  }
}

export async function seedLocalEvent(db: Database, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  assertLocalMockEnvironment(env);
  const store = new IglooStore(db);
  await store.init();
  // Keep existing booking snapshots and reserved times intact. Only retire the old fixtures.
  await db.query("UPDATE igloo_packages SET status='draft',updated_at=now() WHERE id=$1", [legacyPackageId]);
  await db.query("UPDATE igloo_slots SET status='closed' WHERE id=ANY($1::uuid[])", [legacySlotIds]);
  for (const item of iglooEventPackages) await store.savePackage(item);
  for (const slot of iglooEventSlots) await store.saveSlot(slot);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assertLocalMockEnvironment();
  // Deliberately do not read DATABASE_URL: this command can only open the local mock database.
  const db = await createDatabase({ localPath: './.data/igloo-local' });
  try {
    await seedLocalEvent(db);
    console.log('Local October igloo preview ready: four platter choices, twelve shared slots and four igloos per slot. Tax is not calculated; no live payments or production data changed.');
  } finally {
    await db.close();
  }
}
