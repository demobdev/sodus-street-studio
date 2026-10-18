import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { Config } from './config.js';
import type { Queryable } from './db.js';
import type { Payments } from './payments.js';
import { IglooStore, StoreError } from './store.js';

export type RefundStatus = 'requested' | 'pending' | 'succeeded' | 'failed' | 'needs_review';
export type RefundReason = 'weather' | 'venue_closure';
export interface RefundRequest { bookingId: string; requestId: string; reason: RefundReason; note: string }
export interface RefundOperation {
  id: string; bookingId: string; requestId: string; reason: RefundReason; note: string; actor: string;
  amountCents: number; currency: 'usd'; paymentIntentId: string; livemode: boolean; refundId: string | null;
  status: RefundStatus; attemptedAt: string | null; lastCheckedAt: string | null;
  completedAt: string | null; createdAt: string; error: string | null;
}
type Row = Record<string, unknown>;
type Claimed = { operation: RefundOperation; token: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Retry through the durable operation on the next job instead of spending the worker's
// whole deadline on SDK retries. Account identity + create + fresh read total at most 30s.
const stripeRefundOptions = { maxNetworkRetries: 0, timeout: 10_000 } as const;
const optionalIso = (value: unknown) => value == null ? null : new Date(value as string).toISOString();
const requiredUuid = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !uuid.test(value)) throw new StoreError(`${label} must be a UUID.`, 400, 'INVALID_INPUT');
  return value.toLowerCase();
};
function mapOperation(row: Row): RefundOperation {
  return { id: String(row.id), bookingId: String(row.booking_id), requestId: String(row.request_id),
    reason: row.reason as RefundReason, note: String(row.note), actor: String(row.actor),
    amountCents: Number(row.amount_cents), currency: 'usd', paymentIntentId: String(row.payment_intent_id),
    livemode: Boolean(row.livemode), refundId: row.refund_id == null ? null : String(row.refund_id),
    status: row.status as RefundStatus, attemptedAt: optionalIso(row.attempted_at),
    lastCheckedAt: optionalIso(row.last_checked_at), completedAt: optionalIso(row.completed_at),
    createdAt: optionalIso(row.created_at)!, error: row.error == null ? null : String(row.error) };
}
async function ledger(tx: Queryable, operationId: string, kind: string, details: Row = {}, eventId?: string) {
  await tx.query(`INSERT INTO igloo_refund_events(id,operation_id,kind,stripe_event_id,details)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(stripe_event_id) DO NOTHING`,
  [randomUUID(), operationId, kind, eventId ?? null, JSON.stringify(details)]);
}

/** A closure refund is one durable, full-payment operation. No guest cancellation or exchange path exists here. */
export class Refunds {
  constructor(private store: IglooStore, private config: Config, private payments: Payments) {}

  private enabled(): boolean { return (this.config.local && this.config.mock && this.config.mode === 'test') || this.config.refundsEnabled === true; }

  async list(): Promise<RefundOperation[]> {
    return (await this.store.db.query('SELECT * FROM igloo_refund_operations ORDER BY created_at DESC LIMIT 200')).rows.map(mapOperation);
  }

  async getForBooking(bookingId: string): Promise<RefundOperation | null> {
    requiredUuid(bookingId, 'Booking id');
    const row = (await this.store.db.query('SELECT * FROM igloo_refund_operations WHERE booking_id=$1', [bookingId])).rows[0];
    return row ? mapOperation(row) : null;
  }

  async request(input: RefundRequest, actor: string): Promise<RefundOperation> {
    if (!this.enabled()) throw new StoreError('Studio refund processing has not been enabled.', 503, 'REFUNDS_DISABLED');
    const bookingId = requiredUuid(input.bookingId, 'Booking id');
    const requestId = requiredUuid(input.requestId, 'Request id');
    if (!['weather','venue_closure'].includes(input.reason) || typeof input.note !== 'string' || !input.note.trim() || input.note.length > 1000) {
      throw new StoreError('Choose a studio closure reason and provide a note of up to 1,000 characters.', 400, 'INVALID_INPUT');
    }
    if (typeof actor !== 'string' || !this.config.adminEmails.includes(actor.trim().toLowerCase())) throw new StoreError('Staff access required.', 403, 'FORBIDDEN');
    const note = input.note.trim();
    const staff = actor.trim().toLowerCase();
    const bookingSnapshot = (await this.store.db.query('SELECT slot_id FROM igloo_bookings WHERE id=$1', [bookingId])).rows[0];
    if (!bookingSnapshot) throw new StoreError('Booking not found.', 404, 'NOT_FOUND');
    return this.store.db.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`igloo-refund-request:${requestId}`]);
      // Slot -> booking -> operation is the same inventory lock order used by checkout.
      const slot = (await tx.query('SELECT status FROM igloo_slots WHERE id=$1 FOR UPDATE', [bookingSnapshot.slot_id])).rows[0];
      const booking = (await tx.query('SELECT * FROM igloo_bookings WHERE id=$1 FOR UPDATE', [bookingId])).rows[0];
      const replay = (await tx.query('SELECT * FROM igloo_refund_operations WHERE request_id=$1', [requestId])).rows[0];
      if (replay) {
        if (replay.booking_id !== bookingId || replay.reason !== input.reason || replay.note !== note || replay.actor !== staff) throw new StoreError('This request id was used for different refund details.', 409, 'IDEMPOTENCY_CONFLICT');
        return mapOperation(replay);
      }
      if ((await tx.query('SELECT id FROM igloo_refund_operations WHERE booking_id=$1', [bookingId])).rows.length) throw new StoreError('This booking already has a refund operation. Refresh its current status.', 409, 'REFUND_EXISTS');
      if (!booking || booking.slot_id !== bookingSnapshot.slot_id || booking.status !== 'confirmed' || booking.refunded_at != null) throw new StoreError('Only a confirmed, unrefunded booking can receive a studio refund.', 409, 'REFUND_NOT_ALLOWED');
      if (slot?.status !== 'closed') throw new StoreError('Close this seating before requesting studio closure refunds.', 409, 'SLOT_MUST_BE_CLOSED');
      const paymentIntent = String(booking.payment_intent_id ?? '');
      const total = Number(booking.total_cents ?? booking.amount_cents);
      if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntent) || !Number.isSafeInteger(total) || total < 50 || booking.currency !== 'usd') throw new StoreError('The original payment must be verified before a refund can be requested.', 409, 'PAYMENT_NOT_VERIFIED');
      if (Boolean(booking.livemode) !== (this.config.mode === 'live') || (this.config.mock && booking.livemode)) throw new StoreError('The booking and refund payment modes do not match.', 409, 'PAYMENT_MODE_MISMATCH');
      const id = randomUUID();
      const saved = (await tx.query(`INSERT INTO igloo_refund_operations
        (id,booking_id,request_id,reason,note,actor,amount_cents,currency,payment_intent_id,livemode)
        VALUES($1,$2,$3,$4,$5,$6,$7,'usd',$8,$9) RETURNING *`,
      [id, bookingId, requestId, input.reason, note, staff, total, paymentIntent, booking.livemode])).rows[0];
      await ledger(tx, id, 'requested', { actor: staff, reason: input.reason, note, amountCents: total });
      return mapOperation(saved);
    });
  }

  async processNext(): Promise<void> {
    if (!this.enabled()) return;
    const candidates = (await this.store.db.query(`SELECT booking_id FROM igloo_refund_operations
      WHERE status IN ('requested','pending') AND next_check_at<=now() AND (lease_until IS NULL OR lease_until<now())
      ORDER BY next_check_at,created_at LIMIT 5`)).rows;
    for (const candidate of candidates) {
      const claimed = await this.claim(String(candidate.booking_id), false);
      if (!claimed) continue;
      await this.process(claimed);
      return;
    }
  }

  async processBooking(bookingId: string): Promise<void> {
    requiredUuid(bookingId, 'Booking id');
    if (!this.enabled()) throw new StoreError('Studio refund processing has not been enabled.', 503, 'REFUNDS_DISABLED');
    const claimed = await this.claim(bookingId, true);
    if (!claimed) throw new StoreError('This refund is already being checked or requires staff review.', 409, 'REFUND_BUSY');
    await this.process(claimed);
  }

  private async claim(bookingId: string, manual: boolean, refundId?: string): Promise<Claimed | null> {
    return this.store.db.transaction(async tx => {
      await tx.query('SELECT id FROM igloo_bookings WHERE id=$1 FOR UPDATE', [bookingId]);
      const row = (await tx.query('SELECT * FROM igloo_refund_operations WHERE booking_id=$1 FOR UPDATE', [bookingId])).rows[0];
      if (!row || (row.lease_until && Date.parse(optionalIso(row.lease_until)!) > Date.now())) return null;
      if (refundId && row.refund_id && row.refund_id !== refundId) throw new StoreError('Refund identity mismatch.', 409, 'REFUND_MISMATCH');
      // Never create another refund for a failed/unknown operation. A known Stripe ID can safely be read again.
      if (!row.refund_id && !refundId && !['requested','pending'].includes(String(row.status))) return null;
      if (!manual && !['requested','pending'].includes(String(row.status))) return null;
      const token = randomUUID();
      const updated = (await tx.query(`UPDATE igloo_refund_operations SET claim_token=$2,
        lease_until=now()+interval '5 minutes',last_checked_at=now(),next_check_at=now()+interval '1 minute'
        WHERE id=$1 RETURNING *`, [row.id, token])).rows[0];
      return { operation: mapOperation(updated), token };
    });
  }

  private async process(claimed: Claimed, event?: Stripe.Event, knownRefundId?: string): Promise<void> {
    const op = claimed.operation;
    try {
      if (op.livemode !== (this.config.mode === 'live') || (this.config.mock && op.livemode)) {
        await this.finishError(claimed, 'needs_review', 'The refund and server payment modes do not match.', event?.id);
        return;
      }
      let refundId = knownRefundId ?? op.refundId;
      if (!refundId && op.attemptedAt && Date.now() - Date.parse(op.attemptedAt) >= 23 * 60 * 60_000) {
        await this.finishError(claimed, 'needs_review', 'Stripe creation outcome is unknown beyond the safe retry window. Review the original payment in Stripe before taking further action.', event?.id);
        return;
      }
      if (this.config.mock) {
        if (!this.config.local || this.config.mode !== 'test') throw new StoreError('Refund simulation is local only.', 503, 'NOT_CONFIGURED');
        await this.persistAttempt(claimed);
        const refund = { id: `re_mock_${op.id.replaceAll('-','')}`, object: 'refund', amount: op.amountCents,
          currency: op.currency, payment_intent: op.paymentIntentId, status: 'succeeded',
          metadata: { booking_id: op.bookingId, refund_operation_id: op.id } } as unknown as Stripe.Refund;
        await this.apply(claimed, refund, event?.id);
        return;
      }
      await this.payments.verifyAccount({ requireCharges: false });
      if (!this.payments.stripe) throw new StoreError('Stripe refund connection is incomplete.', 503, 'NOT_CONFIGURED');
      if (!refundId) {
        if (!this.enabled()) throw new StoreError('Studio refund processing has not been enabled.', 503, 'REFUNDS_DISABLED');
        await this.persistAttempt(claimed);
        const refund = await this.payments.stripe.refunds.create({ payment_intent: op.paymentIntentId,
          amount: op.amountCents, metadata: { booking_id: op.bookingId, refund_operation_id: op.id,
            studio_closure_reason: op.reason } }, { ...stripeRefundOptions, idempotencyKey: `sodus-igloo-refund:${op.id}` });
        const mismatch = this.mismatch(op, refund);
        if (mismatch) { await this.finishError(claimed, 'needs_review', mismatch, event?.id); return; }
        refundId = refund.id;
        // Keep the ID even if the following read fails. Idempotency responses may contain an old status.
        await this.store.db.query('UPDATE igloo_refund_operations SET refund_id=$3 WHERE id=$1 AND claim_token=$2', [op.id, claimed.token, refundId]);
      }
      const latest = await this.payments.stripe.refunds.retrieve(refundId, {}, stripeRefundOptions);
      if (latest.id !== refundId) { await this.finishError(claimed, 'needs_review', 'Stripe returned a different refund identity.', event?.id); return; }
      await this.apply(claimed, latest, event?.id);
    } catch (error) {
      const status = Number((error as { statusCode?: number })?.statusCode);
      const definitive = status >= 400 && status < 500 && status !== 409 && status !== 429;
      await this.finishError(claimed, definitive ? 'needs_review' : 'pending', definitive
        ? `Stripe rejected the refund operation (HTTP ${status}). Review permissions and the original payment in Stripe.`
        : 'Stripe could not confirm the current refund outcome. The same operation will be checked again.', event?.id);
      // Stripe must retry a webhook that could not be reconciled. Jobs retain a durable pending operation.
      if (event) throw error;
    }
  }

  private async persistAttempt(claimed: Claimed): Promise<void> {
    const updated = await this.store.db.query(`UPDATE igloo_refund_operations SET attempted_at=coalesce(attempted_at,now()),status='pending'
      WHERE id=$1 AND claim_token=$2 RETURNING id`, [claimed.operation.id, claimed.token]);
    if (!updated.rows.length) throw new StoreError('Refund claim expired. Refresh its status.', 409, 'REFUND_BUSY');
  }

  private mismatch(op: RefundOperation, refund: Stripe.Refund): string | null {
    const intent = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
    const live = (refund as Stripe.Refund & { livemode?: boolean }).livemode;
    if (!/^re_[A-Za-z0-9_]+$/.test(refund.id) || refund.object !== 'refund' ||
      refund.amount !== op.amountCents || refund.currency !== op.currency || intent !== op.paymentIntentId ||
      (op.refundId && refund.id !== op.refundId) || (live !== undefined && live !== op.livemode) ||
      refund.metadata?.booking_id !== op.bookingId || refund.metadata?.refund_operation_id !== op.id) {
      return 'Stripe refund identity, full amount, currency, or original payment did not match this booking. Staff review is required.';
    }
    return null;
  }

  private async apply(claimed: Claimed, refund: Stripe.Refund, eventId?: string): Promise<void> {
    const mismatch = this.mismatch(claimed.operation, refund);
    if (mismatch) { await this.finishError(claimed, 'needs_review', mismatch, eventId); return; }
    await this.store.db.transaction(async tx => {
      const booking = (await tx.query('SELECT * FROM igloo_bookings WHERE id=$1 FOR UPDATE', [claimed.operation.bookingId])).rows[0];
      const current = (await tx.query('SELECT * FROM igloo_refund_operations WHERE id=$1 FOR UPDATE', [claimed.operation.id])).rows[0];
      if (!current || current.claim_token !== claimed.token) return;
      const op = mapOperation(current);
      if (!booking || booking.payment_intent_id !== op.paymentIntentId || Number(booking.total_cents ?? booking.amount_cents) !== op.amountCents ||
        booking.currency !== op.currency || Boolean(booking.livemode) !== op.livemode || (op.refundId && refund.id !== op.refundId)) {
        await tx.query(`UPDATE igloo_refund_operations SET status='needs_review',error=$2,claim_token=NULL,lease_until=NULL WHERE id=$1`,
        [op.id, 'The booking payment no longer matches the approved refund. Staff review is required.']);
        await ledger(tx, op.id, 'needs_review', { refundId: refund.id, reason: 'booking_payment_changed' }, eventId);
        return;
      }
      let status: RefundStatus;
      let error: string | null = null;
      if (refund.status === 'succeeded') status = 'succeeded';
      else if (op.completedAt) { status = 'needs_review'; error = 'Stripe changed a previously successful refund. The booking remains cancelled; staff must resolve the payment without restoring inventory.'; }
      else if (refund.status === 'pending') status = 'pending';
      else if (refund.status === 'failed' || refund.status === 'canceled') { status = 'failed'; error = 'Stripe reports that the refund did not succeed. The igloo remains reserved until staff resolve the refund.'; }
      else { status = 'needs_review'; error = 'Stripe requires attention before this refund can be completed. The igloo remains reserved.'; }
      if (status === 'succeeded') {
        await tx.query(`UPDATE igloo_bookings SET status='cancelled',refunded_at=coalesce(refunded_at,now()),updated_at=now() WHERE id=$1`, [op.bookingId]);
      }
      await tx.query(`UPDATE igloo_refund_operations SET refund_id=$2,status=$3,error=$4,
        completed_at=CASE WHEN $3='succeeded' THEN coalesce(completed_at,now()) ELSE completed_at END,
        claim_token=NULL,lease_until=NULL,last_checked_at=now(),next_check_at=now()+interval '1 minute' WHERE id=$1`,
      [op.id, refund.id, status, error]);
      await ledger(tx, op.id, status, { refundId: refund.id, stripeStatus: refund.status, amountCents: refund.amount }, eventId);
    });
  }

  private async finishError(claimed: Claimed, status: 'pending' | 'needs_review', error: string, eventId?: string): Promise<void> {
    await this.store.db.transaction(async tx => {
      await tx.query('SELECT id FROM igloo_bookings WHERE id=$1 FOR UPDATE', [claimed.operation.bookingId]);
      const current = (await tx.query('SELECT * FROM igloo_refund_operations WHERE id=$1 FOR UPDATE', [claimed.operation.id])).rows[0];
      if (!current || current.claim_token !== claimed.token) return;
      const next = current.completed_at ? 'needs_review' : status;
      await tx.query(`UPDATE igloo_refund_operations SET status=$2,error=$3,claim_token=NULL,lease_until=NULL,
        last_checked_at=now(),next_check_at=now()+interval '1 minute' WHERE id=$1`, [current.id, next, error]);
      await ledger(tx, String(current.id), next, { error }, eventId);
    });
  }

  /** Called only after Payments verifies the Stripe signature and connected account. */
  async webhook(event: Stripe.Event): Promise<void> {
    if (!['refund.created','refund.updated','refund.failed'].includes(event.type) || this.config.mock) return;
    const refund = event.data.object as Stripe.Refund;
    if (refund.object !== 'refund' || !/^re_[A-Za-z0-9_]+$/.test(refund.id)) return;
    const metadataId = refund.metadata?.refund_operation_id;
    const row = (await this.store.db.query(`SELECT * FROM igloo_refund_operations WHERE refund_id=$1
      ${metadataId && uuid.test(metadataId) ? 'OR id=$2' : ''} LIMIT 2`,
    metadataId && uuid.test(metadataId) ? [refund.id, metadataId] : [refund.id])).rows;
    if (!row.length) return;
    if (row.length !== 1) throw new StoreError('Refund identity conflict.', 409, 'REFUND_MISMATCH');
    const op = mapOperation(row[0]);
    if (event.livemode !== op.livemode || (op.refundId && op.refundId !== refund.id) ||
      (metadataId && metadataId !== op.id) || (refund.metadata?.booking_id && refund.metadata.booking_id !== op.bookingId)) {
      throw new StoreError('Refund event did not match the original booking.', 409, 'REFUND_MISMATCH');
    }
    const claimed = await this.claim(op.bookingId, true, refund.id);
    if (!claimed) throw new StoreError('This refund is being checked. Retry the event.', 503, 'REFUND_BUSY');
    await this.process(claimed, event, refund.id);
  }
}
