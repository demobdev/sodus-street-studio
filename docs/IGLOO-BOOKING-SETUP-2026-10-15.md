# Sodus igloo bookings — setup status, October 15, 2026

**October 16 update:** Maát has now supplied the $225/eight-guest package, four platter choices, four October dates and four igloos per seating, plus a Vimeo community promo. See [the new source and implementation notes](IGLOO-CONTENT-2026-10-16.md). The provisional package table below is historical; do not use its $200/six-guest sample as current terms.

**Production follow-up:** Stripe now shows no active account tasks, and API checks confirm payments and payouts enabled. The October 15 missing-bank observation below is historical. See [October 16 production readiness](PRODUCTION-READINESS-2026-10-16.md) for the separate production database, restricted live key, remaining tax/policy/email requirements and launch gates.

## Current state

- The deployed site is the React/Vite application in `web/`; root `vercel.json` points to `web/dist`. The separate `apps/web` WordPress/Next prototype is not the deployed booking application.
- Maát granted Demo access to **Sodus Street Studio, LLC** in Stripe. After Demo signed in on bai-no2, the browser session was verified working at approximately 10:23 a.m. ET. Account `acct_1UQXvGGVrEBb1o4U` shows a live publishable-key label.
- The Account Status page lists Payments and Payouts as active, but also has a **past-due "Provide an external account" task**. Its details explicitly say no bank account is on file. Maát needs to complete this bank-account setup; do not describe the account as fully ready. Cartes Bancaires is separately paused. Tax registrations and webhook setup remain unverified.
- The Stripe connector requires reauthentication, but the browser works. Demo approved a new limited **sandbox** key on October 15: Accounts read, Checkout Sessions write. The key is stored only in ignored `.env.local`. Account identity was verified via `accounts.retrieveCurrent()` and a real $1 sandbox Checkout Session was created successfully. No live products, prices or payment links were created.
- Existing forms submit an inquiry to Maát through FormSubmit. They do not allocate inventory, reserve a time or collect payment. An actual email-delivery test remains to be coordinated; local checks must not send unsolicited test messages.
- Demo explicitly chose custom React booking instead of Acuity on October 15. The custom flow, booking database and staff dashboard are now implemented locally.

## Draft package from the October 14 meeting

These are working notes, not published or approved sale terms.

| Field | Working value | Still needed |
| --- | --- | --- |
| Experience | Private igloo rental at Sodus Street Studio | Approved package name and description |
| Price | $200 USD per rental | Final price; tax-inclusive/exclusive treatment; full payment vs deposit |
| Duration | 90 minutes | Confirm duration and turnaround buffer |
| Proposed starts | 5 pm, 7 pm, 9 pm, America/New_York | Final start times; 4:30 pm was also discussed |
| Event dates | Late October and November were discussed | Exact dates, closures and booking cutoff |
| Inventory | Not supplied | Number of igloos and maximum guests per igloo |
| Food and drinks | Food options and beverage arrangements were discussed | Exact inclusions and add-ons; no alcohol promise until confirmed |
| Changes/cancellation | Not supplied for igloos | Cancellation, weather, rescheduling and refund terms |
| Photography | Updated photos expected | Approved images and permission to use them |

Maát's package details are expected Monday, October 19. Keep the studio's existing $75/hour and $500/day rates separate from igloo packages.

## Implemented architecture

- Customer React pages: `/igloos`, `/igloos/confirmation`. Staff dashboard: `/igloos/manage`.
- Server-owned USD prices, package/policy snapshots, whole-igloo capacity, atomic holds and UUID-based retry protection.
- Hosted Stripe Checkout and verified payment events. Redirects alone never confirm a booking. Delayed payments retain capacity; amount/currency/mode/session mismatches require review.
- Local-only simulator at `/igloos/test-checkout`, impossible to enable in a Vercel runtime. Sample $200/90-minute package and six-guest limit are test fixtures, not approved sale terms.
- PGlite for local simulation. Neon development project `sodus-igloo-bookings` (`delicate-sun-06292740`), Postgres 17 in US East; schema applied and native concurrency test passed. The live database must be separate and empty of sample data.
- Admin allowlist, one-use 15-minute sign-in links, 12-hour HttpOnly cookie sessions, durable rate limits and origin checks. Local test sign-in exists only in local mock mode.
- Durable confirmation outbox, one message per invocation, five-minute retry delay. Delivery remains disabled until a verified Sodus sender is connected and tested. Staff's reconciliation action retries pending checkout/email work in bounded batches.
- Default booking cutoff: 35 minutes before arrival; Stripe Checkout expires after 31 minutes. Confirm operational cutoff and turnaround buffer Monday. All stored times are UTC; customer display uses America/New_York.

No real booking/payment/confirmation email has been sent by the local simulator. The $1 Stripe sandbox fixture is separate from the local sample catalog.

## Before enabling customer payments

1. Complete the missing bank-account requirement, verify this exact business account's final readiness and inspect existing integrations. Browser access is now working; the connector still needs reauthentication.
2. Confirm the package fields above. Verify tax setup rather than inferring it from the meeting's automatic-tax selection. Current implementation collects the full package amount; deposits/add-ons need an explicit model if requested.
3. Deploy the server, set `APP_ORIGIN` to the exact deployment origin and `NODEJS_HELPERS=0` in Vercel (preserves the raw webhook stream), add a Stripe webhook at `/api/igloo/webhook`, and store its signing secret in server environment variables. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Configure separate sandbox/live databases and credentials. Do not enable live sales before final approval.
4. Verify sandbox success/decline/expiry, actual webhook delivery and real confirmation-email delivery. Local/API tests cover concurrent capacity, duplicate events, forged events, expired holds, snapshots and authentication. Native Neon test sent 16 competing reservations and 8 duplicate events; exactly one reservation/event/outbox resulted. Confirmed-booking refunds/cancellations/rescheduling remain a staff process until policy is approved; there is no customer cancellation automation yet.
5. Create the approved live prices, connect the final booking route, and verify the public flow. A promotional QR code should resolve to the stable booking page, not a temporary preview URL.

## References

- [Acuity's Stripe integration](https://www.acuityscheduling.com/partners/stripe)
- [Stripe Checkout fulfillment and webhooks](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted)
- [Stripe API key handling](https://docs.stripe.com/keys)

## Local commands

Run from the repository root. Copy `.env.example` to ignored `.env.local`, supply a random 32-byte-or-longer secret and admin allowlist. `PAYMENTS_DRIVER=mock` makes the local server use PGlite even when a development DATABASE_URL is present.

```powershell
npm ci
npm ci --prefix web
npx tsx --env-file=.env.local server/seed-local.ts
npm run dev:api
# Separate terminal:
npm run dev --prefix web -- --host 127.0.0.1 --port 5173
```

The seed is local only; stop the local API before running it again. It never writes sample packages to Neon or production. `npm run db:migrate` applies the schema to the explicit DATABASE_URL without adding catalog data.

Validation: `npm run check`, `npm test`, `npm run build --prefix web`, `npm run lint --prefix web`. The opt-in native Postgres race test requires `RUN_POSTGRES_TEST=1` and the development DATABASE_URL; it cleans only its own UUID-scoped fixtures.

Final local validation: 28 server tests passed, with the opt-in native Postgres test skipped in the default run (it passed separately against Neon); five New York time/DST tests, TypeScript, frontend build and lint also passed.

## Verified Stripe test payment

On October 15 at 10:57 a.m. ET, a $1 sandbox Checkout payment succeeded using Stripe's official test card. The React confirmation page retrieved the server status and displayed confirmed reference `IG-7E37A4230A7B`; the server checked Stripe directly, persisted confirmation and queued one email. No real funds moved and no email was sent. Proof: `output/igloo-2026-10-15/stripe-confirmed-booking.png` and `stripe-verification.json`. The test package was then set to draft and its slot closed in the development database.

This is a tested local implementation and verified sandbox API connection. Live launch, production webhooks, final packages, bank setup and confirmation delivery are still pending. A Sodus sending domain is not yet present in the connected Resend account; do not send from an unrelated client's domain.
