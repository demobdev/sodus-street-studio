import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import type { Config } from './config.js';
import { IglooStore, StoreError, type Booking, type PaymentEvidence } from './store.js';
import { bookingToken } from './tokens.js';

export class Payments {
  readonly stripe: Stripe | null;
  private verifiedAccount?: Promise<void>;
  constructor(private store: IglooStore, private config: Config) {
    this.stripe = config.stripeKey && !config.mock ? new Stripe(config.stripeKey, { maxNetworkRetries: 2, timeout: 15_000 }) : null;
  }
  async verifyAccount() {
    if (this.config.mock) return;
    if (!this.stripe || !this.config.stripeAccount) throw new StoreError('Stripe setup is incomplete.', 503, 'NOT_CONFIGURED');
    this.verifiedAccount ??= this.stripe.accounts.retrieveCurrent().then(account => {
      if (account.id !== this.config.stripeAccount) throw new Error('Stripe account mismatch.');
    }).catch(error => { this.verifiedAccount = undefined; throw error; });
    await this.verifiedAccount;
  }
  async checkout(booking: Booking): Promise<Booking> {
    if (booking.status !== 'held') throw new StoreError('This reservation is no longer awaiting checkout. Please review its status.', 409, 'CHECK_STATUS');
    if (booking.checkoutUrl) return booking;
    const token = bookingToken(booking.id, this.config.secret);
    const params = await this.store.prepareCheckout(booking.id, {
      mode: 'payment', submit_type: 'book', customer_email: booking.email,
      client_reference_id: booking.id, metadata: { booking_id: booking.id },
      integration_identifier: `sodus_igloo_${randomBytes(8).toString('hex').replace(/[0-9]/g,'a').slice(0,8)}`,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: booking.amountCents,
        product_data: { name: booking.packageName, description: `${new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(new Date(booking.startsAt))} (New York time); ${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}` } } }],
      success_url: `${this.config.origin}/igloos/confirmation#token=${token}`,
      cancel_url: `${this.config.origin}/igloos/confirmation?cancelled=1#token=${token}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
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
      amountCents: session.amount_total ?? -1, currency: session.currency ?? '' });
  }
  evidence(session: Stripe.Checkout.Session, type: string, eventId: string): PaymentEvidence {
    if (!['paid', 'unpaid', 'no_payment_required'].includes(session.payment_status) || !['open', 'complete', 'expired'].includes(session.status ?? '')) throw new Error('Unrecognized Stripe session state.');
    return { eventId, bookingId: session.metadata?.booking_id || '', sessionId: session.id,
      livemode: session.livemode, amountCents: session.amount_total ?? -1, currency: session.currency ?? '',
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
  async webhook(raw: Buffer, signature: string) {
    if (!this.stripe || !this.config.webhookSecret || this.config.mock) throw new StoreError('Webhook unavailable.', 503, 'NOT_CONFIGURED');
    let event: Stripe.Event;
    try { event = this.stripe.webhooks.constructEvent(raw, signature, this.config.webhookSecret); }
    catch { throw new StoreError('Invalid webhook signature.', 400, 'INVALID_SIGNATURE'); }
    if (!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type)) return;
    await this.verifyAccount();
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.metadata?.booking_id) return; // Other integrations on this account are not our reservations.
    await this.store.applyStripeEvent(this.evidence(session, event.type, event.id));
  }
}
