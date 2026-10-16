# Sodus igloo production readiness — October 16, 2026

Customer reservations remain closed. The production payment connection is being prepared; deployment alone is not a launch approval or proof of a completed payment.

## Completed infrastructure

- Stripe business: Sodus Street Studio, LLC, `acct_1UQXvGGVrEBb1o4U`. Account Status showed no active tasks. API checks confirmed `charges_enabled` and `payouts_enabled` true. This supersedes the October 15 missing-bank task; no bank details were copied or changed.
- Restricted live key named **Sodus igloo booking — production**, created with Demo's explicit approval and Stripe email/SMS verification. Permissions: Accounts read, Checkout Sessions write, Tax Rates read. Stored as a sensitive, production-only Vercel variable. Temporary local transfer file and clipboard copy were removed. No refund/payout permissions.
- Separate Neon production database: `sodus-igloo-production`, project `shiny-cell-17409257`, database `sodus`, PostgreSQL 17 in AWS US East. Schema applied; zero bookings and no test reservations copied.
- Four draft platter packages, $225 base price, eight guests, 90 minutes. Twelve closed seating slots across October 23, 24, 30 and 31 at 5, 7 and 9 p.m. Eastern. Each slot has four igloos shared across all platter choices.
- Vercel production database connection, booking token secret, scheduled-job secret, account ID and staff allowlist configured. Allowlist: Demo and Maát. Reply-To: `maat@onthemovecs.com`.
- Live sales, policy approval, tax approval and email delivery remain explicitly disabled.

## Application changes

- Separate immutable subtotal, tax and total snapshots. Stripe confirmation must match all components, currency, account mode and session identity.
- Support for one approved exclusive percentage tax rate. No rate has been chosen: the live Stripe account currently has no Tax Rates. If the food/rental bundle needs itemization or multiple tax treatments, adjust the model before launch.
- Customer receipts and staff screens show subtotal, tax and total; confirmation replies go to Maát.
- Authenticated scheduled reconciliation and email-outbox retries every five minutes. It cannot originate a checkout for a hold with no saved Stripe request.
- Removed stale Acuity references. Studio session requests are inquiries, with availability and payment instructions confirmed by staff.

## Still needed from Maát

1. Confirm the applicable tax treatment/rate for the igloo-plus-food bundle with her tax adviser, including whether it needs separate line items.
2. Supply the igloo cancellation, weather, rescheduling and refund terms. Confirm the 35-minute booking cutoff is operationally suitable. The current payment model collects the full $225 plus applicable tax.
3. Confirm the domain/address for outgoing Sodus reservation emails and provide DNS access for sender verification. Reply-To is already set to her existing address.
4. Confirm FormSubmit activation and receipt in `maat@onthemovecs.com`, including spam, during a coordinated test. No external test inquiry has been sent during this audit.
5. Provide real igloo photos when ready. These are a content follow-up, not a Stripe account requirement.

## Forms and notifications

All three inquiry forms—studio booking, contact, and igloo inquiry—go through FormSubmit to `maat@onthemovecs.com`. They are not saved in the booking database, do not reserve inventory, and do not send an automatic guest acknowledgment. See [the form-by-form delivery audit](FORMS-DELIVERY-2026-10-16.md).

Once enabled, paid igloo reservations are stored in the production booking database. A confirmed payment queues a guest email via Resend. The staff dashboard lists reservations; there is currently no separate automatic staff booking alert. Staff sign-in also depends on the verified email sender.

## Remaining technical launch checks

- Finish and verify the Stripe event destination and signing secret for `/api/igloo/webhook`.
- Verify the Sodus sender domain, configure a sending credential, and test actual guest and staff-login email delivery.
- Install the approved tax rate and final policy text, then validate payment success, decline, expiry, duplicate events and confirmation delivery in a separate test environment.
- Perform an owner-controlled live payment/refund smoke check when the owner is ready; no live payment has been initiated in this task.
- Activate the final catalog and seating slots and enable customer booking only after those checks pass.

The stable booking URL is `https://sodus-street-studio.vercel.app/igloos`. A custom domain must also update `APP_ORIGIN` and Stripe/webhook URLs consistently.
