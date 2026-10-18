import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import type { Config } from './config.js';
import { IglooStore, StoreError, type Booking, type CheckoutTax, type PaymentEvidence } from './store.js';
import { bookingToken } from './tokens.js';
import { bookingWindowOpen } from './booking-policy.js';

export class Payments {
  readonly stripe: Stripe | null;
  private verifiedAccount?: Promise<Stripe.Account>;
  constructor(private store: IglooStore, private config: Config) {
    this.stripe = config.stripeKey && !config.mock ? new Stripe(config.stripeKey, { maxNetworkRetries: 2, timeout: 15_000 }) : null;
  }
  async verifyAccount(options: { requireCharges?: boolean } = {}) {
    if (this.config.mock) return;
    if (!this.stripe || !this.config.stripeAccount) throw new StoreError('Stripe setup is incomplete.', 503, 'NOT_CONFIGURED');
    this.verifiedAccount ??= this.stripe.accounts.retrieveCurrent({}, options.requireCharges === false
      ? { maxNetworkRetries: 0, timeout: 10_000 } : undefined).then(account => {
      if (account.id !== this.config.stripeAccount) throw new Error('Stripe account mismatch.');
      return account;
    }).catch(error => { this.verifiedAccount = undefined; throw error; });
    const account = await this.verifiedAccount;
    if (options.requireCharges !== false && this.config.mode === 'live' && account.charges_enabled !== true) {
      // A refund may remain available while new charges are paused. Checkout still fails closed,
      // and clears its cached result so enabling payments can be detected on the next attempt.
      this.verifiedAccount = undefined;
      throw new StoreError('Stripe has not enabled live payments for this account.', 503, 'NOT_CONFIGURED');
    }
  }
  async checkout(booking: Booking): Promise<Booking> {
    if (booking.status !== 'held') {
      if (booking.status === 'expired' && !booking.checkoutParams && !booking.checkoutAttemptedAt && !booking.sessionId) {
        throw new StoreError('This temporary hold expired before checkout started. Please choose an available time again.', 409, 'HOLD_EXPIRED');
      }
      throw new StoreError('This reservation is no longer awaiting checkout. Please review its status.', 409, 'CHECK_STATUS');
    }
    if (booking.checkoutUrl) return booking;
    if (!booking.checkoutParams && !booking.checkoutAttemptedAt && !bookingWindowOpen(booking.startsAt)) {
      throw new StoreError('New reservations close at 2 p.m. New York time on the event day.',409,'BOOKING_CLOSED');
    }
    await this.verifyAccount();
    if (booking.livemode && (!this.config.taxApproved || !this.config.stripeTaxRateId || (booking.checkoutParams && !booking.taxRateId))) {
      throw new StoreError('The approved booking tax setup is incomplete.', 503, 'TAX_NOT_CONFIGURED');
    }
    let tax: CheckoutTax | undefined;
    if (!booking.checkoutParams && !this.config.mock && this.config.stripeTaxRateId) {
      if (!this.config.taxApproved) throw new StoreError('The booking tax setup needs approval.', 503, 'TAX_NOT_CONFIGURED');
      const rate = await this.stripe!.taxRates.retrieve(this.config.stripeTaxRateId);
      if (rate.id !== this.config.stripeTaxRateId || !rate.active || rate.inclusive || rate.livemode !== booking.livemode ||
          rate.rate_type === 'flat_amount' || !Number.isFinite(rate.percentage) || rate.percentage < 0 || rate.percentage > 100) {
        throw new StoreError('The approved tax rate must be active, exclusive and match the payment mode.', 503, 'TAX_NOT_CONFIGURED');
      }
      // Stripe manual percentages have up to four decimal places. There is one line item,
      // so line-level and invoice-level rounding both produce this same integer-cent amount.
      const scaledPercentage = Math.round(rate.percentage * 10_000);
      const taxCents = Math.floor((booking.amountCents * scaledPercentage + 500_000) / 1_000_000);
      tax = { rateId: rate.id, percentage: rate.percentage, taxCents };
    }
    const token = bookingToken(booking.id, this.config.secret);
    const params = await this.store.prepareCheckout(booking.id, {
      mode: 'payment', submit_type: 'book', customer_email: booking.email,
      client_reference_id: booking.id, metadata: { booking_id: booking.id },
      payment_intent_data: { metadata: { booking_id: booking.id } },
      integration_identifier: `sodus_igloo_${randomBytes(8).toString('hex').replace(/[0-9]/g,'a').slice(0,8)}`,
      line_items: [{ quantity: 1, ...(tax ? { tax_rates: [tax.rateId] } : {}), price_data: { currency: 'usd', unit_amount: booking.amountCents,
        product_data: { name: booking.packageName, description: `${new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(new Date(booking.startsAt))} (New York time); ${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}` } } }],
      success_url: `${this.config.origin}/igloos/confirmation#token=${token}`,
      cancel_url: `${this.config.origin}/igloos/confirmation?cancelled=1#token=${token}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    }, tax);
    if (this.config.mock) {
      return this.store.attachCheckout(booking.id, { sessionId: `mock_${booking.id}`,
        url: `${this.config.origin}/igloos/test-checkout#token=${token}`, expiresAt: new Date(Number(params.expires_at) * 1000).toISOString(),
        livemode: false, amountCents: booking.amountCents, currency: 'usd' });
    }
    await this.verifyAccount();
    // Never issue a fresh idempotency key for an unknown outcome, even after Stripe's 24h retention.
    const current = await this.store.getBooking(booking.id);
    if (current?.checkoutAttemptedAt && Date.now() - Date.parse(current.checkoutAttemptedAt) > 23 * 60 * 60_000) {
      await this.store.markNeedsReview(booking.id, 'Stripe creation outcome remains unknown beyond the safe retry window.');
      throw new StoreError('This checkout needs a staff review. Please contact the studio.', 409, 'CHECKOUT_REVIEW');
    }
    const session = await this.stripe!.checkout.sessions.create(params as Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: `sodus-igloo:${booking.id}` });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return this.store.attachCheckout(booking.id, { sessionId: session.id, url: session.url,
      expiresAt: new Date(session.expires_at * 1000).toISOString(), livemode: session.livemode,
      amountCents: session.amount_total ?? -1, subtotalCents: session.amount_subtotal ?? undefined,
      taxCents: session.total_details?.amount_tax, currency: session.currency ?? '' });
  }
  evidence(session: Stripe.Checkout.Session, type: string, eventId: string): PaymentEvidence {
    if (!['paid', 'unpaid', 'no_payment_required'].includes(session.payment_status) || !['open', 'complete', 'expired'].includes(session.status ?? '')) throw new Error('Unrecognized Stripe session state.');
    return { eventId, bookingId: session.metadata?.booking_id || '', sessionId: session.id,
      livemode: session.livemode, amountCents: session.amount_total ?? -1, currency: session.currency ?? '',
      subtotalCents: session.amount_subtotal ?? undefined, taxCents: session.total_details?.amount_tax,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      paymentStatus: session.payment_status as PaymentEvidence['paymentStatus'], sessionStatus: session.status as PaymentEvidence['sessionStatus'], type };
  }
  async reconcile(booking: Booking) {
    if (!booking.sessionId || this.config.mock || !this.stripe) return booking;
    await this.verifyAccount();
    const session = await this.stripe.checkout.sessions.retrieve(booking.sessionId);
    const result = await this.store.applyStripeEvent(this.evidence(session, 'reconcile', `reconcile:${session.id}:${session.status}:${session.payment_status}`));
    await this.store.db.query('UPDATE igloo_bookings SET updated_at=now() WHERE id=$1',[booking.id]);
    return result;
  }
  async webhook(raw: Buffer, signature: string, onRefund?: (event: Stripe.Event) => Promise<void>) {
    if (!this.stripe || !this.config.webhookSecret || this.config.mock) throw new StoreError('Webhook unavailable.', 503, 'NOT_CONFIGURED');
    let event: Stripe.Event;
    try { event = this.stripe.webhooks.constructEvent(raw, signature, this.config.webhookSecret); }
    catch { throw new StoreError('Invalid webhook signature.', 400, 'INVALID_SIGNATURE'); }
    const refundEvent = ['refund.created','refund.updated','refund.failed'].includes(event.type);
    if (!refundEvent && !['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type)) return;
    await this.verifyAccount({ requireCharges: !refundEvent });
    if (event.livemode !== (this.config.mode === 'live')) throw new StoreError('Stripe event payment mode mismatch.',400,'EVENT_MODE');
    if (refundEvent) { if (onRefund) await onRefund(event); return; }
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.metadata?.booking_id) return; // Other integrations on this account are not our reservations.
    await this.store.applyStripeEvent(this.evidence(session, event.type, event.id));
  }
}
