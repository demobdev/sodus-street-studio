# Sodus booking handoff — October 17, 2026

## Current status

Customer bookings and live refunds remain disabled. The approved-policy, venue-closure refund and notification changes are implemented; their final production deployment is pending. Publishing these changes does not open bookings. Append the final deployment and production verification below when complete.

## Decisions received

Maát's October 17 email at **6:48 p.m. Eastern**, Gmail message **`1a14c0deb4708ec5`**, answers the outstanding event-policy questions:

- One private igloo, the chosen food platter, 90 minutes and up to eight guests: **$225 + 8% tax ($18) = $243**. Full payment is due when booking.
- New reservations close at **2 p.m. America/New_York on the event day**, for every seating. This replaces the provisional 35-minute cutoff. An already-started Checkout can finish within its existing payment window; replay/reconciliation must preserve its original request.
- No customer cancellations, refunds, rescheduling or exchanges. Do not add a self-service reschedule path or change a confirmed booking's date to work around this policy.
- A guest unable to attend may give their ticket to a friend or family member.
- A Sodus closure due to weather or unforeseen circumstances receives a **full refund, including tax**.
- Replies should go to **`info.sodusstreetstudio@gmail.com`**. Demo approved **`bookings@sodusstreetstudio.com`** as the sending address. Sender authentication remains a separate technical requirement.
- Updated venue photos are expected **Tuesday, October 20**. Existing supplied views remain published in the meantime.

Maát's policy example names Roc Holiday Village. Only the approved policy meaning is adapted to Sodus; that example's business name, dates and capacity are not Sodus event data. The existing October 23/24/30/31 dates, 5/7/9 p.m. seatings and shared four-igloo capacity remain the supplied event details.

## What is implemented

- Public pricing and booking terms show the approved tax, total, payment and cancellation rules. New holds/catalog availability and first Checkout creation use the 2 p.m. New York cutoff. Date calculations handle UTC date crossover and daylight saving time.
- Authenticated staff can request a full venue-closure refund only after closing the seating. The server requires a confirmed booking and verified original PaymentIntent, snapshots the full paid amount, records the actor/reason/note, and gives the booking one durable refund operation.
- Competing workers share a database lease. A lost response retries the same operation with the same Stripe idempotency key. An unknown creation older than the safe retry window stops for review rather than creating another refund.
- The booking remains reserved until a freshly retrieved matching Stripe refund succeeds. Partial amounts, wrong payment/account/currency, pending/failed refunds and permission failures retain the reservation for review. A later failure cannot restore capacity after a completed refund. Late Checkout events cannot reconfirm that cancelled booking.
- Refund event handling supports `refund.created`, `refund.updated` and `refund.failed`, subject to signature/account checks and current Stripe-object reconciliation. The existing production webhook has **not yet been expanded** to those events.
- Durable notifications cover guest payment confirmation, staff new-booking alerts, guest full-refund confirmation and staff refund-review alerts. Alert payloads are snapshotted before provider delivery; retries retain the key and payload. Leases prevent concurrent delivery, and state checks suppress obsolete notices. Queueing is not proof of email delivery.
- Staff UI exposes closure-refund status and refresh controls. The earlier cancellation-review queue remains an audit/review mechanism; it does not itself issue a refund or move a booking.

## Form activation and delivery

The activation screenshot was observed. After activation, **one** clearly labelled live igloo inquiry retest was submitted and FormSubmit accepted it. **Maát's inbox receipt is still unconfirmed.** Do not describe provider acceptance as delivered mail, and do not repeatedly submit new tests while waiting for her confirmation.

Studio, general-contact and igloo-inquiry forms still send to `maat@onthemovecs.com` through FormSubmit. They do not reserve inventory, collect money, save a booking record or send a guest autoresponse. The new Gmail reply-to is for booking/notification mail; it does not silently change the existing inquiry recipient.

## Remaining launch checklist

| Item | Status / next action |
| --- | --- |
| Event price, tax percentage, cutoff and policy | Answered by Maát. Finish applying/validating the exact approved production tax rate and package-policy snapshots; do not ask her to supply these answers again. |
| Form inbox confirmation | Ask Maát whether the one post-activation test reached inbox or spam. Provider acceptance is verified; receipt is not. |
| Sodus sending domain | Resend domain was created, but is **not verified**. Publish the exact required DNS records, verify the domain, configure the sending credential/address, and test staff sign-in plus guest/staff mail. DNS access may require Maát/Morgan/Christian if our current access is insufficient. |
| Live Stripe permissions | Existing restricted key has Accounts read, Checkout Sessions write and Tax Rates read. **Charges and Refunds access is not granted.** Enable only the additional required refund capability through an approved configuration change; keep live refund execution disabled until verified. |
| Stripe webhook | Existing live endpoint subscribes to the four Checkout Session events only. Add the three refund events and validate real Stripe-origin delivery and signature/account checks. |
| Payment/refund validation | Complete a separate Stripe sandbox checkout/refund/notification flow and then an owner-controlled live smoke check when ready. No live charge/refund or actual refund email was performed by the automated tests below. |
| Release | Final production deployment and deployed readiness checks pending. Keep `IGLOO_ALLOW_LIVE=false` and `IGLOO_REFUNDS_ENABLED=false`; catalog packages/slots must not be opened until all required checks pass. |
| Photos | Replace/add Tuesday's supplied venue photos after review. This is a content follow-up, not a Stripe account blocker. |

The bank account was already connected. No renewed bank-account setup request is needed. Rescheduling is intentionally unavailable under the approved policy, rather than an unfinished customer feature.

## Validation completed for this implementation

- Cutoff unit/database tests cover the exact 2 p.m. boundary, the 9 p.m. seating's different UTC date, summer/winter offsets and New York DST transition days. SQL is independent of the database session timezone.
- Nine notification tests passed using mocked providers: immutable retries, delayed failure recovery, concurrent/stale worker handling, mode isolation, removed staff recipients, and suppression of stale success/review notices. No provider emails were sent by these tests.
- Both opt-in native PostgreSQL tests passed on the separate Neon **development** host. The new test runs competing refund workers, confirms one full $243 mocked refund operation, verifies the closed-seating requirement and retained inventory, and confirms late Checkout events cannot restore a cancelled booking. No Stripe client/network request was used for that refund test. Only each run's isolated 2190 fixtures were removed.
- TypeScript and the public-page build/lint passed during implementation. Record final full-suite, UI and deployed checks with the release below.

## Release record

Pending final production deployment and verification by the main task.
