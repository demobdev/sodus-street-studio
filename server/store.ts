import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Database, Queryable } from './db.js';
import { BOOKING_CUTOFF_SQL } from './booking-policy.js';

export type BookingStatus = 'held' | 'awaiting_payment' | 'confirmed' | 'expired' | 'cancelled' | 'needs_review';
export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed';
export interface Package {
  id: string; name: string; description: string; durationMinutes: number; amountCents: number;
  currency: 'usd'; maxGuests: number; policyText: string; status: 'draft' | 'active';
}
export type PackageInput = Omit<Package, 'id'> & { id?: string };
export interface Slot {
  id: string; startsAt: string; endsAt: string; capacity: number; remaining: number; status: 'open' | 'closed';
}
export type SlotInput = Omit<Slot, 'id' | 'remaining'> & { id?: string };
export interface HoldInput {
  packageId: string; slotId: string; name: string; email: string; phone?: string;
  guests: number; policyAccepted: boolean; requestId: string;
}
export interface Booking {
  id: string; reference: string; requestId: string; packageId: string; slotId: string; status: BookingStatus;
  name: string; email: string; phone: string; guests: number; packageName: string;
  startsAt: string; endsAt: string; amountCents: number; currency: 'usd'; policyText: string;
  taxCents: number; totalCents: number; taxRateId: string | null; taxPercentage: number | null;
  livemode: boolean; sessionId: string | null; checkoutUrl: string | null; expiresAt: string | null;
  checkoutParams: Record<string, unknown> | null; checkoutAttemptedAt: string | null;
  emailStatus: EmailStatus; reviewReason: string | null; createdAt: string;
  paymentIntentId: string | null; refundedAt: string | null;
}
export interface CheckoutAttachment {
  sessionId: string; url: string; expiresAt: string; livemode: boolean; amountCents: number; currency: string;
  subtotalCents?: number; taxCents?: number;
}
export interface PaymentEvidence {
  eventId: string; bookingId: string; sessionId: string; livemode: boolean; amountCents: number;
  subtotalCents?: number; taxCents?: number;
  currency: string; paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  sessionStatus: 'open' | 'complete' | 'expired'; type: string;
  paymentIntentId?: string;
}
export interface OutboxItem { id: string; claimToken: string; booking: Booking; attempts: number }
export interface CheckoutTax { rateId: string; percentage: number; taxCents: number }
export interface CancellationRequest {
  id: string; reason: string; requestedBy: string; requestedAt: string;
}
export type ManagedBooking = Booking & { cancellationRequest: CancellationRequest | null };
export class StoreError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); this.name = 'StoreError'; }
}

type Row = Record<string, unknown>;
const occupied = "('held','awaiting_payment','confirmed','needs_review')";
// New reservations close at 2pm New York time on the event day, regardless of seating time.
const bookingWindow = `starts_at > now() AND now() < ${BOOKING_CUTOFF_SQL}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const iso = (value: unknown): string => new Date(value as string | number | Date).toISOString();
const optionalIso = (value: unknown): string | null => value == null ? null : iso(value);
const badInput = (message: string) => new StoreError(message, 400, 'INVALID_INPUT');
function requireUuid(value: string, label: string) { if (!uuid.test(value)) throw badInput(`${label} must be a UUID.`); }
function boundedInt(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw badInput(`${label} is outside the allowed range.`);
}
function mapPackage(row: Row): Package {
  return { id: String(row.id), name: String(row.name), description: String(row.description),
    durationMinutes: Number(row.duration_minutes), amountCents: Number(row.amount_cents), currency: 'usd',
    maxGuests: Number(row.max_guests), policyText: String(row.policy_text), status: row.status as Package['status'] };
}
function mapSlot(row: Row): Slot {
  return { id: String(row.id), startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), capacity: Number(row.capacity),
    remaining: Math.max(0, Number(row.capacity) - Number(row.occupied ?? 0)), status: row.status as Slot['status'] };
}
function mapBooking(row: Row): Booking {
  return { id: String(row.id), reference: String(row.reference), requestId: String(row.request_id),
    packageId: String(row.package_id), slotId: String(row.slot_id), status: row.status as BookingStatus,
    name: String(row.name), email: String(row.email), phone: String(row.phone), guests: Number(row.guests),
    packageName: String(row.package_name), startsAt: iso(row.starts_at), endsAt: iso(row.ends_at),
    amountCents: Number(row.amount_cents), currency: 'usd', policyText: String(row.policy_text),
    taxCents: Number(row.tax_cents ?? 0), totalCents: Number(row.total_cents ?? row.amount_cents),
    taxRateId: row.tax_rate_id == null ? null : String(row.tax_rate_id),
    taxPercentage: row.tax_percentage == null ? null : Number(row.tax_percentage),
    livemode: Boolean(row.livemode), sessionId: row.session_id == null ? null : String(row.session_id),
    checkoutUrl: row.checkout_url == null ? null : String(row.checkout_url), expiresAt: optionalIso(row.expires_at),
    checkoutParams: row.checkout_params as Record<string, unknown> | null, checkoutAttemptedAt: optionalIso(row.checkout_attempted_at),
    emailStatus: row.email_status as EmailStatus, reviewReason: row.review_reason == null ? null : String(row.review_reason),
    createdAt: iso(row.created_at), paymentIntentId: row.payment_intent_id == null ? null : String(row.payment_intent_id), refundedAt: optionalIso(row.refunded_at) };
}
async function lockedBooking(db: Queryable, id: string): Promise<Row> {
  const { rows } = await db.query('SELECT * FROM igloo_bookings WHERE id=$1 FOR UPDATE', [id]);
  if (!rows[0]) throw new StoreError('Booking not found.', 404, 'NOT_FOUND');
  return rows[0];
}

function amountMismatch(row: Row, payment: { amountCents: number; subtotalCents?: number; taxCents?: number }): boolean {
  if (Number(row.total_cents ?? row.amount_cents) !== payment.amountCents) return true;
  // Taxed bookings require all signed components, not merely a coincidentally matching total.
  if (row.tax_rate_id != null && (payment.subtotalCents == null || payment.taxCents == null)) return true;
  return (payment.subtotalCents != null && payment.subtotalCents !== Number(row.amount_cents)) ||
    (payment.taxCents != null && payment.taxCents !== Number(row.tax_cents ?? 0));
}

export class IglooStore {
  constructor(public readonly db: Database) {}

  async init(): Promise<void> {
    const schema = (await Promise.all(['schema.sql','refund-schema.sql','booking-alerts-schema.sql'].map(file => readFile(new URL(`./${file}`, import.meta.url), 'utf8')))).join('\n');
    // Schema contains only simple statements, so both Pg and PGlite use the same migration path.
    await this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(741001)');
      for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) await tx.query(statement);
    });
  }

  async listPackages(includeDraft = false): Promise<Package[]> {
    const result = await this.db.query(`SELECT * FROM igloo_packages ${includeDraft ? '' : "WHERE status='active'"} ORDER BY name`);
    return result.rows.map(mapPackage);
  }

  async savePackage(input: PackageInput): Promise<Package> {
    const id = input.id ?? randomUUID(); requireUuid(id, 'Package id');
    if (!input.name?.trim() || input.name.length > 160 || !input.policyText?.trim() || input.policyText.length > 10_000 || typeof input.description !== 'string' || input.description.length > 5_000) throw badInput('Provide a name, description and booking policy.');
    boundedInt(input.amountCents, 50, 1_000_000, 'Price'); boundedInt(input.durationMinutes, 15, 1_440, 'Duration'); boundedInt(input.maxGuests, 1, 100, 'Party size');
    if (input.currency !== 'usd' || !['active', 'draft'].includes(input.status)) throw badInput('Invalid package currency or status.');
    const { rows } = await this.db.query(`INSERT INTO igloo_packages (id,name,description,duration_minutes,amount_cents,currency,max_guests,policy_text,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
      duration_minutes=EXCLUDED.duration_minutes,amount_cents=EXCLUDED.amount_cents,max_guests=EXCLUDED.max_guests,
      policy_text=EXCLUDED.policy_text,status=EXCLUDED.status,updated_at=now() RETURNING *`,
    [id, input.name.trim(), input.description.trim(), input.durationMinutes, input.amountCents, input.currency, input.maxGuests, input.policyText.trim(), input.status]);
    return mapPackage(rows[0]);
  }

  async listSlots(includeClosed = false): Promise<Slot[]> {
    const { rows } = await this.db.query(`SELECT s.*, (SELECT count(*) FROM igloo_bookings b WHERE b.slot_id=s.id AND b.status IN ${occupied})::integer AS occupied
      FROM igloo_slots s ${includeClosed ? '' : `WHERE s.status='open' AND ${bookingWindow}`} ORDER BY starts_at`);
    return rows.map(mapSlot);
  }

  async saveSlot(input: SlotInput): Promise<Slot> {
    const id = input.id ?? randomUUID(); requireUuid(id, 'Slot id');
    if (!Number.isFinite(Date.parse(input.startsAt)) || !Number.isFinite(Date.parse(input.endsAt)) || Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw badInput('Provide a valid start and end time.');
    boundedInt(input.capacity, 1, 100, 'Igloo capacity');
    if (!['open', 'closed'].includes(input.status)) throw badInput('Invalid slot status.');
    return this.db.transaction(async (tx) => {
      // Serializes all schedule edits, including concurrent inserts where no row yet exists to lock.
      await tx.query('SELECT pg_advisory_xact_lock(741002)');
      const previous = (await tx.query('SELECT * FROM igloo_slots WHERE id=$1 FOR UPDATE', [id])).rows[0];
      const count = Number((await tx.query(`SELECT count(*) AS count FROM igloo_bookings WHERE slot_id=$1 AND status IN ${occupied}`, [id])).rows[0].count);
      if (input.capacity < count) throw new StoreError('Capacity cannot be smaller than existing reservations.', 409, 'CAPACITY_IN_USE');
      if (previous && count && (iso(previous.starts_at) !== iso(input.startsAt) || iso(previous.ends_at) !== iso(input.endsAt))) throw new StoreError('A reserved time cannot be moved. Create a separate time and handle existing bookings first.', 409, 'SLOT_IN_USE');
      const conflict = await tx.query('SELECT id FROM igloo_slots WHERE id<>$1 AND starts_at<$3 AND ends_at>$2 LIMIT 1', [id, input.startsAt, input.endsAt]);
      if (conflict.rows.length) throw new StoreError('This time overlaps another igloo time slot.', 409, 'SLOT_OVERLAP');
      const { rows } = await tx.query(`INSERT INTO igloo_slots (id,starts_at,ends_at,capacity,status) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,capacity=EXCLUDED.capacity,status=EXCLUDED.status RETURNING *`,
      [id, input.startsAt, input.endsAt, input.capacity, input.status]);
      return mapSlot({ ...rows[0], occupied: count });
    });
  }

  async createHold(input: HoldInput, options: { livemode: boolean }): Promise<Booking> {
    requireUuid(input.requestId, 'Request id'); requireUuid(input.packageId, 'Package id'); requireUuid(input.slotId, 'Slot id');
    if (!input.name?.trim() || input.name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254 || (input.phone?.length ?? 0) > 40 || input.policyAccepted !== true) throw badInput('Provide your contact details and accept the booking policy.');
    boundedInt(input.guests, 1, 100, 'Party size');
    const clean = { ...input, requestId: input.requestId.toLowerCase(), packageId: input.packageId.toLowerCase(), slotId: input.slotId.toLowerCase(),
      name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone?.trim() ?? '' };
    const fingerprint = createHash('sha256').update(JSON.stringify([clean.packageId, clean.slotId, clean.name, clean.email, clean.phone, clean.guests, true, options.livemode])).digest('hex');
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`igloo-request:${clean.requestId}`]);
      const replay = (await tx.query('SELECT * FROM igloo_bookings WHERE request_id=$1', [clean.requestId])).rows[0];
      if (replay) {
        if (replay.request_fingerprint !== fingerprint) throw new StoreError('This request id was already used for different booking details. Please start a new booking.', 409, 'IDEMPOTENCY_CONFLICT');
        return mapBooking(replay);
      }
      const item = (await tx.query("SELECT * FROM igloo_packages WHERE id=$1 AND status='active' FOR SHARE", [input.packageId])).rows[0];
      const slot = (await tx.query(`SELECT * FROM igloo_slots WHERE id=$1 AND status='open' AND ${bookingWindow} FOR UPDATE`, [input.slotId])).rows[0];
      if (!item || !slot) throw new StoreError('This package or time is no longer available.', 409, 'UNAVAILABLE');
      if (input.guests > Number(item.max_guests)) throw badInput('The party exceeds this package’s guest limit.');
      if (Date.parse(iso(slot.ends_at)) - Date.parse(iso(slot.starts_at)) !== Number(item.duration_minutes) * 60_000) throw badInput('This package does not match the selected time slot.');
      const count = Number((await tx.query(`SELECT count(*) AS count FROM igloo_bookings WHERE slot_id=$1 AND status IN ${occupied}`, [input.slotId])).rows[0].count);
      if (count >= Number(slot.capacity)) throw new StoreError('This time is fully booked. Please choose another.', 409, 'SOLD_OUT');
      const id = randomUUID();
      const { rows } = await tx.query(`INSERT INTO igloo_bookings (id,reference,request_id,request_fingerprint,package_id,slot_id,status,name,email,phone,guests,package_name,starts_at,ends_at,amount_cents,currency,policy_text,livemode)
        VALUES ($1,$2,$3,$4,$5,$6,'held',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [id, `IG-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`, input.requestId, fingerprint, input.packageId, input.slotId,
        clean.name, clean.email, clean.phone, input.guests, item.name, slot.starts_at, slot.ends_at, item.amount_cents, item.currency, item.policy_text, options.livemode]);
      return mapBooking(rows[0]);
    });
  }

  async getBooking(id: string): Promise<Booking | null> {
    requireUuid(id, 'Booking id');
    const { rows } = await this.db.query('SELECT * FROM igloo_bookings WHERE id=$1', [id]);
    return rows[0] ? mapBooking(rows[0]) : null;
  }

  async markNeedsReview(id: string, reason: string): Promise<Booking> {
    const { rows } = await this.db.query(`UPDATE igloo_bookings SET
      status=CASE WHEN status IN ('held','awaiting_payment') THEN 'needs_review' ELSE status END,
      review_reason=CASE WHEN status IN ('held','awaiting_payment') THEN $2 ELSE review_reason END,
      updated_at=now() WHERE id=$1 RETURNING *`, [id, reason.slice(0, 500)]);
    if (!rows[0]) throw new StoreError('Booking not found.', 404, 'NOT_FOUND');
    return mapBooking(rows[0]);
  }

  async attachCheckout(id: string, session: CheckoutAttachment): Promise<Booking> {
    return this.db.transaction(async (tx) => {
      const row = await lockedBooking(tx, id);
      if ((row.session_id && row.session_id !== session.sessionId) || row.livemode !== session.livemode || amountMismatch(row, session) || row.currency !== session.currency.toLowerCase()) {
        const { rows } = await tx.query("UPDATE igloo_bookings SET status='needs_review',review_reason='Checkout session did not match the reserved booking',updated_at=now() WHERE id=$1 RETURNING *", [id]);
        return mapBooking(rows[0]);
      }
      const { rows } = await tx.query('UPDATE igloo_bookings SET session_id=$2,checkout_url=$3,expires_at=$4,updated_at=now() WHERE id=$1 RETURNING *', [id, session.sessionId, session.url, session.expiresAt]);
      return mapBooking(rows[0]);
    });
  }

  /** Persist exact Stripe creation parameters before sending any request, so retries reuse identical inputs. */
  async prepareCheckout(id: string, params: Record<string, unknown>, tax?: CheckoutTax): Promise<Record<string, unknown>> {
    if (tax && (!/^txr_[A-Za-z0-9]+$/.test(tax.rateId) || !Number.isFinite(tax.percentage) || tax.percentage < 0 || tax.percentage > 100 || !Number.isSafeInteger(tax.taxCents) || tax.taxCents < 0)) throw badInput('Invalid checkout tax snapshot.');
    // Capture totals in the same write as the idempotent request. A changed tax setting must not
    // mutate a checkout whose Stripe response was lost or whose customer has already paid.
    const { rows } = await this.db.query(`UPDATE igloo_bookings SET checkout_params=COALESCE(checkout_params,$2::jsonb),
      tax_rate_id=CASE WHEN checkout_params IS NULL THEN $3 ELSE tax_rate_id END,
      tax_percentage=CASE WHEN checkout_params IS NULL THEN $4 ELSE tax_percentage END,
      tax_cents=CASE WHEN checkout_params IS NULL THEN $5 ELSE tax_cents END,
      total_cents=CASE WHEN checkout_params IS NULL THEN amount_cents+$5 ELSE total_cents END,
      checkout_attempted_at=COALESCE(checkout_attempted_at,now()),updated_at=now() WHERE id=$1 AND status='held' RETURNING checkout_params`,
    [id, JSON.stringify(params), tax?.rateId ?? null, tax?.percentage ?? null, tax?.taxCents ?? 0]);
    if (!rows[0]) {
      const exists = await this.getBooking(id);
      if (!exists) throw new StoreError('Booking not found.', 404, 'NOT_FOUND');
      if (exists.status === 'expired' && !exists.checkoutParams && !exists.checkoutAttemptedAt && !exists.sessionId) {
        throw new StoreError('This temporary hold expired before checkout started. Please choose an available time again.', 409, 'HOLD_EXPIRED');
      }
      throw new StoreError('This reservation is no longer awaiting checkout. Please start a new reservation.', 409, 'CHECK_STATUS');
    }
    return rows[0].checkout_params as Record<string, unknown>;
  }

  /** Release abandoned requests only when Stripe could not have received a creation request. */
  async expireUnattemptedHolds(): Promise<number> {
    // Ten minutes exceeds the 180-second request budget. The same row lock used by
    // prepareCheckout serializes this release against persisting the first Stripe attempt.
    const { rowCount } = await this.db.query(`UPDATE igloo_bookings SET status='expired',updated_at=now()
      WHERE status='held' AND created_at < now()-interval '10 minutes'
        AND checkout_params IS NULL AND checkout_attempted_at IS NULL AND session_id IS NULL
      RETURNING id`);
    return rowCount;
  }

  async applyStripeEvent(event: PaymentEvidence): Promise<Booking> {
    return this.db.transaction(async (tx) => {
      // Serialize duplicate delivery even when deliveries claim different booking ids.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`igloo-event:${event.eventId}`]);
      const processed = (await tx.query('SELECT * FROM igloo_payment_events WHERE event_id=$1', [event.eventId])).rows[0];
      if (processed) {
        if (processed.booking_id !== event.bookingId || processed.session_id !== event.sessionId) throw new StoreError('Payment event identity mismatch.', 409, 'EVENT_CONFLICT');
        const previous = await lockedBooking(tx,event.bookingId);
        // Backfill old sessions on reconciliation without changing their booking state.
        if (previous.payment_intent_id == null && event.paymentIntentId && previous.session_id === event.sessionId && previous.livemode === event.livemode && !amountMismatch(previous,event) && previous.currency === event.currency.toLowerCase()) {
          await tx.query('UPDATE igloo_bookings SET payment_intent_id=$2 WHERE id=$1',[event.bookingId,event.paymentIntentId]);
        }
        return mapBooking(await lockedBooking(tx, event.bookingId));
      }
      const found = (await tx.query('SELECT * FROM igloo_bookings WHERE id=$1 FOR UPDATE', [event.bookingId])).rows[0];
      if (!found) throw new StoreError('Reservation is not available yet; retry delivery.', 503, 'BOOKING_NOT_FOUND');
      const row = found;
      let status = row.status as BookingStatus;
      let reason: string | null = row.review_reason == null ? null : String(row.review_reason);
      const mismatch = (row.session_id != null && row.session_id !== event.sessionId) || (row.payment_intent_id != null && event.paymentIntentId != null && row.payment_intent_id !== event.paymentIntentId) || row.livemode !== event.livemode || amountMismatch(row, event) || row.currency !== event.currency.toLowerCase();
      const paid = event.paymentStatus === 'paid' && event.sessionStatus === 'complete';
      const successEvidence = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'reconcile'].includes(event.type);
      if (row.refunded_at != null) {
        // A late Checkout event must never restore capacity already released after a verified refund.
        status = 'cancelled';
        if (mismatch) reason = 'Payment evidence changed after refund. Staff must review the payment; reservation remains cancelled.';
      }
      else if (mismatch) { status = 'needs_review'; reason = 'Payment session, mode, amount or currency does not match this reservation.'; }
      else if (status === 'needs_review') { /* Manual review cannot be cleared by another automatic delivery. */ }
      else if (event.paymentStatus === 'no_payment_required' && event.sessionStatus === 'complete') { status = 'needs_review'; reason = 'Checkout completed without the required package payment.'; }
      else if (paid && successEvidence) {
        if (status === 'expired' || status === 'cancelled') { status = 'needs_review'; reason = 'Payment arrived after the reservation was released. Staff must review availability.'; }
        else status = 'confirmed';
      } else if (status !== 'confirmed') {
        if (event.sessionStatus === 'expired' && event.paymentStatus !== 'paid' && ['checkout.session.expired', 'reconcile'].includes(event.type)) status = 'expired';
        else if (event.type === 'checkout.session.async_payment_failed' && event.sessionStatus === 'complete' && event.paymentStatus !== 'paid') status = 'cancelled';
        else if (['checkout.session.completed', 'reconcile'].includes(event.type) && event.sessionStatus === 'complete' && event.paymentStatus === 'unpaid' && !['expired', 'cancelled'].includes(status)) status = 'awaiting_payment';
      }
      // Verified webhook metadata identifies the booking even if Stripe delivered before our create response.
      const { rows } = await tx.query('UPDATE igloo_bookings SET status=$2,review_reason=$3,session_id=COALESCE(session_id,$4),payment_intent_id=COALESCE(payment_intent_id,$5),updated_at=now() WHERE id=$1 RETURNING *', [event.bookingId, status, reason, mismatch ? null : event.sessionId, mismatch ? null : event.paymentIntentId ?? null]);
      await tx.query('INSERT INTO igloo_payment_events (event_id,booking_id,session_id) VALUES ($1,$2,$3)', [event.eventId, event.bookingId, event.sessionId]);
      if (status === 'confirmed' && row.status !== 'confirmed') await tx.query('INSERT INTO igloo_outbox (id,booking_id) VALUES ($1,$2) ON CONFLICT (booking_id) DO NOTHING', [randomUUID(), event.bookingId]);
      return mapBooking(rows[0]);
    });
  }

  async pendingCheckouts(limit = 100): Promise<Booking[]> {
    const { rows } = await this.db.query("SELECT * FROM igloo_bookings WHERE status IN ('held','awaiting_payment') ORDER BY updated_at,created_at,id LIMIT $1", [Math.min(500, Math.max(1, limit))]);
    return rows.map(mapBooking);
  }

  async listBookings(limit = 200): Promise<Booking[]> {
    const { rows } = await this.db.query('SELECT * FROM igloo_bookings ORDER BY created_at DESC LIMIT $1', [Math.min(1_000, Math.max(1, limit))]);
    return rows.map(mapBooking);
  }

  async listManagedBookings(limit = 200): Promise<ManagedBooking[]> {
    const { rows } = await this.db.query(`SELECT b.*, r.id AS cancellation_id, r.reason AS cancellation_reason,
      r.requested_by, r.requested_at FROM igloo_bookings b
      LEFT JOIN igloo_cancellation_requests r ON r.booking_id=b.id AND r.withdrawn_at IS NULL
      ORDER BY (r.id IS NOT NULL) DESC, b.created_at DESC, b.id LIMIT $1`, [Math.min(1_000, Math.max(1, limit))]);
    return rows.map(row => ({ ...mapBooking(row), cancellationRequest: row.cancellation_id == null ? null : {
      id: String(row.cancellation_id), reason: String(row.cancellation_reason),
      requestedBy: String(row.requested_by), requestedAt: iso(row.requested_at),
    } }));
  }

  // Staff review only: payment state, reserved capacity and guest messaging stay unchanged.
  async requestCancellation(bookingId: string, reason: string, actor: string): Promise<void> {
    requireUuid(bookingId, 'Booking id');
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1_000) throw badInput('Provide a cancellation reason of 1–1000 characters.');
    if (!actor?.trim()) throw badInput('A staff identity is required.');
    return this.db.transaction(async tx => {
      const booking = await lockedBooking(tx, bookingId);
      if (booking.status !== 'confirmed') throw new StoreError('Only confirmed reservations can be flagged for cancellation review.', 409, 'BOOKING_NOT_CONFIRMED');
      const current = (await tx.query('SELECT * FROM igloo_cancellation_requests WHERE booking_id=$1 AND withdrawn_at IS NULL', [bookingId])).rows[0];
      if (current) {
        if (current.reason === reason.trim()) return;
        throw new StoreError('This booking already has a cancellation request. Refresh to review it before making changes.', 409, 'CANCELLATION_EXISTS');
      }
      await tx.query('INSERT INTO igloo_cancellation_requests (id,booking_id,reason,requested_by) VALUES ($1,$2,$3,$4)', [randomUUID(), bookingId, reason.trim(), actor]);
    });
  }

  async withdrawCancellation(bookingId: string, requestId: string, actor: string): Promise<void> {
    requireUuid(bookingId, 'Booking id'); requireUuid(requestId, 'Cancellation request id');
    if (!actor?.trim()) throw badInput('A staff identity is required.');
    return this.db.transaction(async tx => {
      await lockedBooking(tx, bookingId);
      const previous = (await tx.query('SELECT * FROM igloo_cancellation_requests WHERE id=$1 AND booking_id=$2', [requestId, bookingId])).rows[0];
      if (!previous) throw new StoreError('Cancellation request not found. Refresh the dashboard.', 404, 'NOT_FOUND');
      // A retry for a withdrawn request must never clear a newer request for the same booking.
      if (previous.withdrawn_at != null) return;
      await tx.query('UPDATE igloo_cancellation_requests SET withdrawn_by=$2,withdrawn_at=now() WHERE id=$1', [requestId, actor]);
    });
  }

  async claimConfirmationEmails(limit = 20, livemode = false): Promise<OutboxItem[]> {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query(`SELECT o.* FROM igloo_outbox o JOIN igloo_bookings b ON b.id=o.booking_id
        WHERE b.status='confirmed' AND b.livemode=$2
          AND NOT EXISTS(SELECT 1 FROM igloo_refund_operations r WHERE r.booking_id=b.id)
          AND ((o.status IN ('pending','failed') AND o.next_attempt_at<=now()) OR (o.status='sending' AND o.lease_until<now()))
        ORDER BY o.created_at LIMIT $1 FOR UPDATE OF o SKIP LOCKED`, [Math.min(100, Math.max(1, limit)), livemode]);
      const output: OutboxItem[] = [];
      for (const row of rows) {
        // Serialize the final eligibility check against a closure request or payment update.
        // Read the refund operation after acquiring the booking lock so a just-committed
        // closure cannot leave an old confirmation eligible for a retry.
        const current = (await tx.query('SELECT status,livemode FROM igloo_bookings WHERE id=$1 FOR UPDATE', [row.booking_id])).rows[0];
        if (!current || current.status !== 'confirmed' || current.livemode !== livemode ||
          (await tx.query('SELECT id FROM igloo_refund_operations WHERE booking_id=$1', [row.booking_id])).rows.length) continue;
        const claimToken = randomUUID();
        await tx.query("UPDATE igloo_outbox SET status='sending',claim_token=$2,lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id=$1", [row.id, claimToken]);
        const booking = (await tx.query("UPDATE igloo_bookings SET email_status='sending' WHERE id=$1 RETURNING *", [row.booking_id])).rows[0];
        output.push({ id: String(row.id), claimToken, booking: mapBooking(booking), attempts: Number(row.attempts) + 1 });
      }
      return output;
    });
  }

  async markEmailSent(id: string, claimToken: string, providerId?: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query("UPDATE igloo_outbox SET status='sent',sent_at=now(),provider_id=$3,lease_until=NULL WHERE id=$1 AND claim_token=$2 AND status='sending' RETURNING booking_id", [id, claimToken, providerId ?? null]);
      if (rows[0]) await tx.query("UPDATE igloo_bookings SET email_status='sent' WHERE id=$1", [rows[0].booking_id]);
    });
  }

  async markEmailFailed(id: string, claimToken: string, error: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query("UPDATE igloo_outbox SET status='failed',last_error=$3,lease_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=$1 AND claim_token=$2 AND status='sending' RETURNING booking_id", [id, claimToken, error.slice(0, 500)]);
      if (rows[0]) await tx.query("UPDATE igloo_bookings SET email_status='failed' WHERE id=$1", [rows[0].booking_id]);
    });
  }
}
