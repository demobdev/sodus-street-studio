# Sodus booking handoff — October 17, 2026

## Current status

Customer bookings and live refunds remain disabled. Production email setup, the real **sandbox** $243 payment/full refund lifecycle, delivered notifications, replay verification and test cleanup are complete. The [production configuration review](SODUS-PRODUCTION-REVIEW-2026-10-17.md) is also complete: Stripe payments/payouts are active, the saved key/webhook/tax/catalog settings agree, and public checkout remains blocked. The igloo page now has validated structured data and specific metadata. No real money moved and no test emails were sent to Maát. See [the email and sandbox verification report](SODUS-EMAIL-AND-SANDBOX-VERIFICATION-2026-10-17.md) for identifiers and proof. Custom-domain cutover, Maát's inquiry-form inbox confirmation and the user's launch decision remain separate; keep bookings closed.

## Decisions received

Maát's October 17 email at **6:48 p.m. Eastern**, Gmail message **`1a14c0deb4708ec5`**, answers the outstanding event-policy questions:

- One private igloo, the chosen food platter, 90 minutes and up to eight guests: **$225 + 8% tax ($18) = $243**. Full payment is due when booking.
- New reservations close at **2 p.m. America/New_York on the event day**, for every seating. This replaces the provisional 35-minute cutoff. An already-started Checkout can finish within its existing payment window; replay/reconciliation must preserve its original request.
- No customer cancellations, refunds, rescheduling or exchanges. Do not add a self-service reschedule path or change a confirmed booking's date to work around this policy.
- A guest unable to attend may give their ticket to a friend or family member.
- A Sodus closure due to weather or unforeseen circumstances receives a **full refund, including tax**.
- Replies should go to **`info.sodusstreetstudio@gmail.com`**. Demo approved **`bookings@sodusstreetstudio.com`** as the sending address. Sender authentication and actual Demo inbox delivery are now verified.
- Updated venue photos are expected **Tuesday, October 20**. Existing supplied views remain published in the meantime.

Maát's policy example names Roc Holiday Village. Only the approved policy meaning is adapted to Sodus; that example's business name, dates and capacity are not Sodus event data. The existing October 23/24/30/31 dates, 5/7/9 p.m. seatings and shared four-igloo capacity remain the supplied event details.

## What is implemented

- Public pricing and booking terms show the approved tax, total, payment and cancellation rules. New holds/catalog availability and first Checkout creation use the 2 p.m. New York cutoff. Date calculations handle UTC date crossover and daylight saving time.
- Authenticated staff can request a full venue-closure refund only after closing the seating. The server requires a confirmed booking and verified original PaymentIntent, snapshots the full paid amount, records the actor/reason/note, and gives the booking one durable refund operation.
- Competing workers share a database lease. A lost response retries the same operation with the same Stripe idempotency key. An unknown creation older than the safe retry window stops for review rather than creating another refund.
- The booking remains reserved until a freshly retrieved matching Stripe refund succeeds. Partial amounts, wrong payment/account/currency, pending/failed refunds and permission failures retain the reservation for review. A later failure cannot restore capacity after a completed refund. Late Checkout events cannot reconfirm that cancelled booking.
- Refund event handling supports `refund.created`, `refund.updated` and `refund.failed`, subject to signature/account checks and current Stripe-object reconciliation. The existing production webhook is now saved and active with those three events plus its original four Checkout Session events.
- Durable notifications cover guest payment confirmation, staff new-booking alerts, guest full-refund confirmation and staff refund-review alerts. Alert payloads are snapshotted before provider delivery; retries retain the key and payload. Leases prevent concurrent delivery, and state checks suppress obsolete notices. Queueing is not proof of email delivery.
- Staff UI exposes closure-refund status and refresh controls. The earlier cancellation-review queue remains an audit/review mechanism; it does not itself issue a refund or move a booking.

## Form activation and delivery

The activation screenshot was observed. After activation, **one** clearly labelled live igloo inquiry retest was submitted and FormSubmit accepted it. **Maát's inbox receipt is still unconfirmed.** Do not describe provider acceptance as delivered mail, and do not repeatedly submit new tests while waiting for her confirmation.

Studio, general-contact and igloo-inquiry forms still send to `maat@onthemovecs.com` through FormSubmit. They do not reserve inventory, collect money, save a booking record or send a guest autoresponse. The new Gmail reply-to is for booking/notification mail; it does not silently change the existing inquiry recipient.

## Remaining launch checklist

| Item | Status / next action |
| --- | --- |
| Event price, tax percentage, cutoff and policy | Applied. Stripe rate `txr_1URhxfGVrEBb1o4UxBNVackH` is active, 8%, exclusive, New York; the production tax-rate variable and approval flags are set. The four draft package policies contain the approved wording. Do not ask Maát for these answers again. |
| Form inbox confirmation | Ask Maát whether the one post-activation test reached inbox or spam. Provider acceptance is verified; receipt is not. |
| Sodus sending domain | **Complete:** Resend domain `3e4c7be9-db68-4d1b-8fc6-c0f892579b17` and all four GoDaddy DNS records are verified. A sending-only domain-restricted credential is stored in sensitive Vercel `RESEND_API_KEY`; `BOOKING_EMAIL_ENABLED=true` is deployed. Production staff sign-in reached Demo's inbox with SPF/DKIM/DMARC passing and the link logged in successfully. Actual sandbox guest/staff/refund emails also reached Demo's inbox. Sender: `bookings@sodusstreetstudio.com`; reply-to: `info.sodusstreetstudio@gmail.com`. |
| Live Stripe permissions | **Saved and independently verified** by reopening Edit key: four permissions, two read/two write — Accounts Read, Charges and Refunds Write, Checkout Sessions Write, Tax Rates Read. The existing restricted key is unchanged; no rotation or real-money transaction occurred. Proof: `stripe-refund-access-saved.png`. Keep live refund execution disabled until the final production configuration review and launch decision. |
| Stripe webhook | Saved and active with the four Checkout Session events and `refund.created`, `refund.updated`, `refund.failed`. Endpoint remains `https://sodus-street-studio.vercel.app/api/igloo/webhook`. Actual Stripe-origin payment/refund events, signature/account handling and retry behavior were exercised through the separate sandbox endpoint. Final production configuration review remains distinct from creating an artificial live payment. |
| Payment/refund validation | **Sandbox lifecycle complete:** decline retained the hold without a confirmation; $243 payment/full $243 refund succeeded; guest/staff/refund messages reached Demo's inbox. Duplicate event delivery created no extra refund/email. No real-card live-mode test charge is required or permitted for integration testing; see Stripe's testing guidance below. |
| Release | Deployed and checked; keep `IGLOO_ALLOW_LIVE=false` and `IGLOO_REFUNDS_ENABLED=false`. Catalog packages/slots must not be opened until all required checks pass. |
| Photos | Replace/add Tuesday's supplied venue photos after review. This is a content follow-up, not a Stripe account blocker. |
| Temporary sandbox cleanup | **Complete:** manual Stripe event resend returned 200 Delivered / Recovered at 01:22:14 UTC with no duplicate refund/email. Fixture retired, package draft, seating closed and audit evidence retained. Temporary webhook `we_1URif82d5P44qe8A7KPpYuBv` is Disabled; ngrok/API stopped with no listeners on 4318/4040. Ignored sandbox execution/email/refund flags are false and the consumed login token is removed. Vite is restored to the ordinary local mock preview (5173, default API 4317). |

The bank account was already connected. No renewed bank-account setup request is needed. Rescheduling is intentionally unavailable under the approved policy, rather than an unfinished customer feature.

Earlier references to an owner-controlled live-card smoke test are superseded: [Stripe's testing instructions](https://docs.stripe.com/testing#how-to-use-test-cards) prohibit testing in live mode with real payment details. Use the completed sandbox payment/refund evidence plus final production account/configuration checks before launch; do not create an artificial real-money test charge.

## Validation completed for this implementation

- Cutoff unit/database tests cover the exact 2 p.m. boundary, the 9 p.m. seating's different UTC date, summer/winter offsets and New York DST transition days. SQL is independent of the database session timezone.
- Nine notification tests passed using mocked providers: immutable retries, delayed failure recovery, concurrent/stale worker handling, mode isolation, removed staff recipients, and suppression of stale success/review notices. No provider emails were sent by these tests.
- Both opt-in native PostgreSQL tests passed on the separate Neon **development** host. The new test runs competing refund workers, confirms one full $243 mocked refund operation, verifies the closed-seating requirement and retained inventory, and confirms late Checkout events cannot restore a cancelled booking. No Stripe client/network request was used for that refund test. Only each run's isolated 2190 fixtures were removed.
- The latest full suite contains 109 tests: **107 passed, zero failed, two opt-in PostgreSQL tests skipped**; the latter passed separately against development. TypeScript, frontend build and lint passed.
- Real Stripe sandbox payment/refund and actual delivered guest/staff/refund emails are verified in [the separate evidence report](SODUS-EMAIL-AND-SANDBOX-VERIFICATION-2026-10-17.md). Duplicate delivery left one refund operation and one guest refund-email attempt. A concurrent `refund.updated` event initially received 503 `REFUND_BUSY`, then Stripe's automatic retry returned 200 approximately 18 seconds later; no failure remained unresolved.

## Release record

- Commit `78de023d263a9aee75170d165478c5efb35d8d7a` pushed to `main`; Vercel deployment `dpl_J99rFPdCAF3FBZYC6JqsfPbcpmDY` is READY and aliased to https://sodus-street-studio.vercel.app.
- The original refund release had 101 passing server tests. The later full suite has 107 passing tests, zero failures and two opt-in PostgreSQL skips; both native tests passed separately. TypeScript, web build and lint passed.
- Actual local browser flow passed: TEST booking `IG-AF6A08CD3513`, simulated payment, closed seating, queued weather refund, successful processing, guest cancellation/refund screen. Capacity returned from 3/4 to 4/4 and the seating remained closed. Local simulation used $225 with zero test tax; separate payment/refund tests verified the full $243 including tax. No real payment, refund or email occurred.
- Deployed public page visibly shows $243 total, 2pm Eastern cutoff, no customer rescheduling, and full closure refund policy. Production catalog returns `mode:live`, `bookingOpen:false`, empty packages/slots; unauthenticated admin returns 401.
- Production database verification: four draft packages, twelve closed slots, zero bookings, zero refund operations and zero alerts.
- Production email readiness deployed in READY deployment `dpl_BqLwfzqRUe3ZRamDESc4SssNzWpk` at the stable alias. `BOOKING_EMAIL_ENABLED=true`; production staff email reached Demo's inbox, passed SPF/DKIM/DMARC and completed magic-link sign-in. `IGLOO_ALLOW_LIVE=false` and `IGLOO_REFUNDS_ENABLED=false` remain unchanged.
- Proof images: `C:/Users/Demo Bailey/.codex/visualizations/2026/10/17/sodus-refunds/` contains `local-refund-success.png`, `local-guest-refund.png`, `live-booking-policy.png`, `stripe-tax-rate.png`, the prepared Stripe permission/event screenshots, DNS preparation and form acceptance proof.
- Approved configuration save proof: `stripe-refund-events-saved.png` and `email-dns-saved.png` in the same folder. No charge, refund, booking activation or email delivery was performed by these settings changes.
- Final sandbox replay and shutdown proof: `sandbox-webhook-replay-delivered.png` and `sandbox-webhook-disabled.png` in the same folder. The real sandbox payment/refund audit remains retained after retirement; no temporary API or tunnel remains active.
- GoDaddy currently points the root at its WebsiteBuilder site and `www` at the root. Website DNS has not been switched to Vercel. Treat custom-domain cutover separately from sender DNS and verify the public origin, forms and certificates when performed.

The production review is complete; its current results and remaining prelaunch steps are in [the production review](SODUS-PRODUCTION-REVIEW-2026-10-17.md). Production customer bookings and live refunds remain disabled until explicitly authorized. References above to a future production review are historical; the remaining work is custom-domain cutover, separate inquiry inbox receipt and a launch decision.
