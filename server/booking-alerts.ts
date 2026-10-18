import { createHash, randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { IglooStore } from './store.js';
import { sendEmail } from './email.js';

type Row = Record<string, unknown>;
type AlertKind = 'staff_booking' | 'guest_refund' | 'staff_refund_review';
type Payload = { subject: string; text: string };
const money = (value: unknown) => `$${(Number(value) / 100).toFixed(2)} USD`;
const date = (value: unknown) => new Intl.DateTimeFormat('en-US', {
  dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York',
}).format(new Date(value as string));
const reviewKey = (row: Row) => `staff_refund_review/${row.operation_id}/${row.refund_status}/${createHash('md5').update(String(row.refund_error ?? '')).digest('hex')}`;
const testPrefix = (live: unknown) => live ? '' : '[TEST] ';
const testNotice = (live: unknown) => live ? '' : 'TEST ONLY — this is not a real reservation or refund.\n\n';

async function queue(store: IglooStore, booking: Row, kind: AlertKind, eventKey: string, recipient: string, payload: Payload) {
  // Never replace the first payload: provider retries must keep exactly the same content and key.
  await store.db.query(`INSERT INTO igloo_booking_alerts(id,event_key,booking_id,kind,recipient,payload)
    VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(event_key,recipient) DO NOTHING`,
  [randomUUID(), eventKey, booking.id, kind, recipient, JSON.stringify(payload)]);
}

async function enqueueAlerts(store: IglooStore, c: Config, recipients: string[]) {
  const live = c.mode === 'live';
  for (const recipient of recipients) {
    const bookings = await store.db.query(`SELECT b.* FROM igloo_bookings b
      WHERE b.status='confirmed' AND b.livemode=$1
        AND NOT EXISTS(SELECT 1 FROM igloo_booking_alerts a WHERE a.event_key='staff_booking/'||b.id::text AND a.recipient=$2)
      ORDER BY b.created_at LIMIT 50`, [live, recipient]);
    for (const b of bookings.rows) await queue(store, b, 'staff_booking', `staff_booking/${b.id}`, recipient, {
      subject: `${testPrefix(b.livemode)}New Sodus igloo booking ${b.reference}`,
      text: `${testNotice(b.livemode)}A guest's igloo payment is confirmed.\n\nReference: ${b.reference}\n${b.package_name}\n${date(b.starts_at)} (New York time)\nGuests: ${b.guests}\nGuest: ${b.name}\nEmail: ${b.email}\n${b.phone ? `Phone: ${b.phone}\n` : ''}Subtotal: ${money(b.amount_cents)}\nTax: ${money(b.tax_cents ?? 0)}\nTotal paid: ${money(b.total_cents ?? b.amount_cents)}\n\nManage this reservation at ${c.origin}/igloos/manage.`,
    });
    const reviews = await store.db.query(`SELECT b.*,r.id AS operation_id,r.status AS refund_status,r.error AS refund_error,r.reason AS refund_reason
      FROM igloo_refund_operations r JOIN igloo_bookings b ON b.id=r.booking_id
      WHERE r.status IN ('failed','needs_review') AND r.livemode=$1 AND b.livemode=$1
        AND NOT EXISTS(SELECT 1 FROM igloo_booking_alerts a WHERE a.recipient=$2
          AND a.event_key='staff_refund_review/'||r.id::text||'/'||r.status||'/'||md5(coalesce(r.error,'')))
      ORDER BY r.created_at LIMIT 50`, [live, recipient]);
    for (const b of reviews.rows) await queue(store, b, 'staff_refund_review', reviewKey(b), recipient, {
      subject: `${testPrefix(b.livemode)}Sodus refund needs review — ${b.reference}`,
      text: `${testNotice(b.livemode)}A studio-closure refund needs a staff check.\n\nReference: ${b.reference}\n${b.package_name}\n${date(b.starts_at)} (New York time)\nGuest: ${b.name}\nEmail: ${b.email}\nRecorded status: ${b.refund_status === 'failed' ? 'Failed' : 'Needs review'}\n\nOpen ${c.origin}/igloos/manage to review the current payment status and the existing refund operation. Do not start a second refund.`,
    });
  }
  const refunds = await store.db.query(`SELECT b.*,r.id AS operation_id,r.reason AS refund_reason,r.amount_cents AS refund_amount
    FROM igloo_refund_operations r JOIN igloo_bookings b ON b.id=r.booking_id
    WHERE r.status='succeeded' AND r.completed_at IS NOT NULL AND b.status='cancelled' AND b.refunded_at IS NOT NULL
      AND r.livemode=$1 AND b.livemode=$1 AND r.currency=b.currency AND r.amount_cents=b.total_cents
      AND NOT EXISTS(SELECT 1 FROM igloo_booking_alerts a WHERE a.event_key='guest_refund/'||r.id::text AND a.recipient=b.email)
    ORDER BY r.completed_at LIMIT 50`, [live]);
  for (const b of refunds.rows) await queue(store, b, 'guest_refund', `guest_refund/${b.operation_id}`, String(b.email), {
    subject: `${testPrefix(b.livemode)}Sodus igloo cancellation and full refund — ${b.reference}`,
    text: `Hello ${b.name},\n\n${testNotice(b.livemode)}Sodus Street Studio has cancelled your igloo reservation because of ${b.refund_reason === 'weather' ? 'a weather-related closure' : 'a venue closure due to unforeseen circumstances'}. We’re sorry your evening cannot go ahead.\n\nReference: ${b.reference}\n${b.package_name}\n${date(b.starts_at)} (New York time)\nFull refund, including tax: ${money(b.refund_amount)}\n\nStripe has confirmed the full refund. The time it takes to appear in your account depends on your bank or payment provider.\n\nQuestions? Reply to this email to reach Sodus Street Studio.`,
  });
}

/** Persist event snapshots, then deliver at most one currently relevant alert with a leased claim. */
export async function deliverBookingAlerts(store: IglooStore, c: Config): Promise<void> {
  const recipients = [...new Set(c.adminEmails.map(email => email.trim().toLowerCase()))]
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  await enqueueAlerts(store, c, recipients);
  if (c.mock || !c.emailEnabled) return;
  const token = randomUUID();
  const alert = await store.db.transaction(async tx => {
    // Recheck mutable source state before claiming a snapshot. A refund that later needs review
    // must not produce a new success email; a resolved issue must not create an obsolete alert.
    const candidate = (await tx.query(`SELECT a.* FROM igloo_booking_alerts a
      JOIN igloo_bookings b ON b.id=a.booking_id
      WHERE b.livemode=$1 AND a.status IN ('pending','failed','sending') AND a.next_attempt_at<=now()
        AND (a.lease_until IS NULL OR a.lease_until<now())
        AND ((a.kind='staff_booking' AND b.status='confirmed' AND a.recipient=ANY($2::text[])
          AND NOT EXISTS(SELECT 1 FROM igloo_refund_operations r WHERE r.booking_id=b.id))
        OR (a.kind='guest_refund' AND b.status='cancelled' AND b.refunded_at IS NOT NULL
          AND EXISTS(SELECT 1 FROM igloo_refund_operations r WHERE r.booking_id=b.id AND r.status='succeeded'
            AND r.completed_at IS NOT NULL AND r.livemode=$1 AND r.currency=b.currency AND r.amount_cents=b.total_cents
            AND a.event_key='guest_refund/'||r.id::text))
        OR (a.kind='staff_refund_review' AND a.recipient=ANY($2::text[])
          AND EXISTS(SELECT 1 FROM igloo_refund_operations r WHERE r.booking_id=b.id AND r.status IN ('failed','needs_review')
            AND r.livemode=$1 AND a.event_key='staff_refund_review/'||r.id::text||'/'||r.status||'/'||md5(coalesce(r.error,'')))))
      ORDER BY a.next_attempt_at,a.created_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`, [c.mode === 'live', recipients])).rows[0];
    if (!candidate) return null;
    return (await tx.query(`UPDATE igloo_booking_alerts SET status='sending',attempts=attempts+1,
      claim_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1 RETURNING *`, [candidate.id, token])).rows[0];
  });
  if (!alert) return;
  const payload = alert.payload as Payload;
  try {
    const providerId = await sendEmail(c, String(alert.recipient), payload.subject, payload.text, `igloo-alert/${alert.id}`);
    await store.db.query(`UPDATE igloo_booking_alerts SET status='sent',provider_id=$3,sent_at=now(),last_error=NULL,
      claim_token=NULL,lease_until=NULL WHERE id=$1 AND claim_token=$2`, [alert.id, token, providerId]);
  } catch {
    await store.db.query(`UPDATE igloo_booking_alerts SET status='failed',last_error='Delivery failed; retry required.',
      next_attempt_at=now()+interval '5 minutes',claim_token=NULL,lease_until=NULL WHERE id=$1 AND claim_token=$2`, [alert.id, token]);
  }
}
