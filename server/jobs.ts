import { createHash, timingSafeEqual } from 'node:crypto';
import type { Config } from './config.js';
import { deliverConfirmations } from './email.js';
import type { Payments } from './payments.js';
import type { IglooStore } from './store.js';
import type { Refunds } from './refunds.js';
import { deliverBookingAlerts } from './booking-alerts.js';

export function authorizedJob(authorization: string, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  // Compare equal-size hashes so token length does not select a different comparison path.
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256').update(authorization).digest();
  return timingSafeEqual(expected, actual);
}

export async function runBookingJobs(store: IglooStore, payments: Pick<Payments, 'reconcile' | 'checkout'>, c: Config,
  refunds?: Pick<Refunds,'processNext'>, now: () => number = () => performance.now()) {
  const startedAt = now();
  const elapsed = () => now() - startedAt;
  const result = { expiredHolds: await store.expireUnattemptedHolds(), reconciled: 0, recovered: 0, skipped: 0, failures: 0 };
  // One Checkout recovery, one refund and two single-message email passes fit the 180s
  // deployment budget. Do not begin a refund after 120s (up to 30s of bounded Stripe work)
  // or either email pass after 155s (10s send timeout). Durable work resumes next cron.
  for (const booking of await store.pendingCheckouts(1)) {
    try {
      if (booking.sessionId) { await payments.reconcile(booking); result.reconciled += 1; }
      else if (booking.status === 'held' && booking.checkoutParams) { await payments.checkout(booking); result.recovered += 1; }
      else result.skipped += 1; // A scheduler must not originate a new customer checkout.
    } catch { result.failures += 1; }
    finally {
      // A failing or never-attempted row must not monopolize every subsequent invocation.
      await store.db.query('UPDATE igloo_bookings SET updated_at=now() WHERE id=$1', [booking.id]);
    }
  }
  if (refunds) {
    if (elapsed() <= 120_000) { try { await refunds.processNext(); } catch { result.failures += 1; } }
    else result.skipped += 1;
  }
  if (elapsed() <= 155_000) await deliverConfirmations(store, c);
  else result.skipped += 1;
  if (elapsed() <= 155_000) await deliverBookingAlerts(store,c);
  else result.skipped += 1;
  return result;
}
