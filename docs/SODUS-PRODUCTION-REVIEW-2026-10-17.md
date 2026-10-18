# Sodus production review — October 17, 2026

The technical production review is complete. Stripe payments and payouts are active, the intended restricted key and seven-event webhook are saved, the approved tax/catalog/policies agree, and the deployed API fails closed. **Customer bookings and live refund execution remain disabled.** This review does not authorize opening inventory or changing website DNS.

## Live Stripe and environment review

- Live business: **Sodus Street Studio, LLC**, account `acct_1UQXvGGVrEBb1o4U`, matching production `STRIPE_ACCOUNT_ID`. Stripe's Account status screen shows **no active tasks**, with **Payments** and **Payouts** under Active. No bank details were changed or copied.
- Reopened the existing **Sodus igloo booking — production** key review without saving changes. Its saved scope is exactly four permissions: Accounts Read, Checkout Sessions Write, Tax Rates Read, Charges and Refunds Write. No rotation, permission expansion, charge or refund occurred in this review.
- Live webhook `we_1UREQKGVrEBb1o4UXqs90Qge` is Active at `https://sodus-street-studio.vercel.app/api/igloo/webhook`. Its seven subscriptions are `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, and `refund.failed`.
- Live tax rate `txr_1URhxfGVrEBb1o4UxBNVackH` is Active, **8%**, **Exclusive**, New York. This is the previously owner-approved rate; this review confirms configuration and does not provide independent tax advice.
- Vercel's production variables contain production-only sensitive entries for the Stripe key, webhook signing secret, database URL, booking-token secret, scheduler secret, and Resend credential. Secret values were not retrieved or exported. `IGLOO_MODE=live`, policy/tax approvals are true, email is enabled, and both launch/refund execution gates remain false.
- `APP_ORIGIN` resolves to the stable Vercel origin. Its stored trailing whitespace is removed by the existing URL parser; the same-origin API check passed. No origin or launch-variable change was necessary.
- Production email sender is `bookings@sodusstreetstudio.com`; replies go to `info.sodusstreetstudio@gmail.com`. Staff sign-in and booking alerts currently target the approved Demo/Maát allowlist (`demo@blockbusters.tech`, `maat@onthemovecs.com`). The separate inquiry forms still go to `maat@onthemovecs.com` through FormSubmit.

## Catalog and API checks

The separate production database contains **zero bookings, zero refund operations, zero booking alerts, four draft packages and twelve closed seatings**. Every package is $225 base, USD, 90 minutes and up to eight guests, with the approved $243 tax-inclusive total and cancellation/closure policy. Dates are October 23, 24, 30 and 31 at 5, 7 and 9 p.m. America/New_York; each seating shares four igloos across platter choices.

The stable production API was checked without creating a reservation or sending email:

| Check | Verified result |
| --- | --- |
| Public catalog | 200; live mode, `bookingOpen:false`, no packages or slots exposed |
| Checkout with empty JSON from the allowed origin | 503 `NOT_CONFIGURED`; rejected before hold/provider creation |
| Unauthenticated staff and scheduled job endpoints | 401 |
| Production local-payment simulator | 404 |
| Unsigned webhook | 400 `INVALID_SIGNATURE` |
| Cross-origin checkout | 403 `ORIGIN` |
| Private staff/confirmation pages | `X-Robots-Tag: noindex, nofollow` |
| API cache policy | `no-store` |

Scheduled maintenance remains configured every five minutes in Vercel's committed configuration; its secret is present. The earlier authenticated maintenance and sandbox lifecycle evidence is retained in the linked verification report. No new privileged maintenance run was needed against an empty production ledger.

## Igloo schema review

The page previously returned the generic studio title and no canonical or JSON-LD. The scoped fix adds igloo metadata and connected **WebPage**, **Service**, and **LocalBusiness** entities in the initial built HTML and on React navigation. It represents the real experience/address/images without advertising available tickets while bookings are closed.

- Schema.org's hosted **code-snippet** validator reported **zero errors and zero warnings** for the exact rendered graph.
- Browser direct visit, navigation to About, and return to Igloos confirmed one graph/canonical on the igloo page, cleanup elsewhere, and no duplicates on return.
- Five focused schema checks, frontend build and lint passed. Private booking-route rewrites and noindex headers are preserved.
- See [the schema review](SODUS-IGLOO-SCHEMA-REVIEW-2026-10-17.md) for sources, implementation, maintenance and search limitations. A vocabulary-validation pass does not establish Google indexing or guarantee rich results.

## Remaining before launch

1. **Custom website domain:** DNS still resolves the root to `13.248.243.5` and `76.223.105.230`; the Vercel project currently lists its Vercel aliases only. The earlier GoDaddy WebsiteBuilder website cutover has not occurred. When explicitly authorized, connect the domain, verify certificates/public routes/forms, and update the canonical origin and `APP_ORIGIN` together. Review webhook URLs if changing them; preserve email DNS.
2. **Inquiry inbox receipt:** Maát still needs to confirm whether the single post-activation FormSubmit test reached inbox or spam. Do not send repetitive tests or conflate accepted submission with delivered mail. Actual Demo booking emails are separately verified.
3. **Launch decision:** Keep `IGLOO_ALLOW_LIVE=false`, `IGLOO_REFUNDS_ENABLED=false`, packages draft and seatings closed until the user authorizes opening. Approved prices, tax, policies and bank setup do not need to be requested again.

## Evidence

- [Completed sandbox payment/refund/email verification](SODUS-EMAIL-AND-SANDBOX-VERIFICATION-2026-10-17.md): $243 sandbox payment, full $243 refund, signed Stripe-origin events, delivered guest/staff/refund emails, replay safety, and retired test infrastructure.
- Workspace JSON: `output/igloo-2026-10-17/production-review.json` and `schema-browser-navigation.json`.
- Screenshots in `C:/Users/Demo Bailey/.codex/visualizations/2026/10/17/sodus-refunds/`: `production-account-reviewed.png`, `production-key-reviewed.png`, `production-webhook-reviewed.png`, `production-tax-reviewed.png`, and `igloo-schema-validator.png`.

The current review supersedes the earlier requirement to perform a future production configuration review. It does not open bookings, confirm the separate inquiry inbox receipt, complete custom-domain cutover, or claim a real-money payment test occurred. Stripe's [go-live checklist](https://docs.stripe.com/get-started/checklist/go-live), [key guidance](https://docs.stripe.com/keys), and [webhook guidance](https://docs.stripe.com/webhooks) informed this review; integration transactions used the completed separate sandbox workflow.
