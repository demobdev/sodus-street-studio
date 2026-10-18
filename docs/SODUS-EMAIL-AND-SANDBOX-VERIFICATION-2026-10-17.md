# Sodus email and Stripe sandbox verification — October 17, 2026

## Result

The real Stripe sandbox checkout, full refund, signed event processing and Sodus notification emails were exercised successfully. Emails reached **Demo's inbox**, including the guest receipt, staff booking alert and guest refund notice. No real money moved and no test emails were sent to Maát.

Production email delivery is enabled and its staff sign-in was verified. **Customer bookings and live refund execution remain disabled**: `IGLOO_ALLOW_LIVE=false` and `IGLOO_REFUNDS_ENABLED=false`. The stable production catalog still reports `mode: live`, `bookingOpen: false`. These email and sandbox checks do not open bookings.

## Production sender and staff sign-in

- Resend domain `3e4c7be9-db68-4d1b-8fc6-c0f892579b17` and all four DNS records are verified.
- A sending-only credential restricted to the Sodus domain is stored as the sensitive Vercel production variable `RESEND_API_KEY`. A separate test credential is stored locally for the isolated sandbox. No credential values or login tokens are included in this record.
- `BOOKING_EMAIL_ENABLED=true` is deployed in READY deployment **`dpl_BqLwfzqRUe3ZRamDESc4SssNzWpk`**, serving the stable alias [sodus-street-studio.vercel.app](https://sodus-street-studio.vercel.app).
- Sender: `bookings@sodusstreetstudio.com`. Reply-to for all verified messages: **`info.sodusstreetstudio@gmail.com`**.
- The production staff sign-in email reached `demo@blockbusters.tech` with the Gmail **INBOX** label: message **`1a14c8b11a45aff9`**, Resend message **`01a14c8b-0d8a-754b-b8f7-fae0fa88d948`**. SPF, DKIM and DMARC passed.
- Opening the delivered one-time sign-in link completed the production dashboard login successfully. This confirms actual inbox receipt and working sign-in, beyond provider acceptance alone.

## Isolated sandbox scope

The payment/refund test used the Sodus Stripe sandbox and a dedicated schema on the existing development database, separate from production and the ordinary development outbox. HTTP checkout was restricted to Demo's exact email and the prepared package/seating.

| Identifier | Value |
| --- | --- |
| Database schema | `igloo_sandbox_7ab1b75646974bb194583cb565938a94` |
| Package | `278be140-8c71-4cc4-9a4e-a2cf33603537` |
| Seating | `877510fa-ee16-4654-81a2-dc900c157389` |
| Booking reference | `IG-0661BC949A58` |
| Booking UUID | `0661bc94-9a58-42c8-a0ca-394c344ac41b` |
| Subtotal / tax / total | `$225.00 / $18.00 / $243.00` |
| Actual email recipient | `demo@blockbusters.tech` only |

## Payment and email evidence

1. Stripe's decline test card produced a declined payment. The booking remained held and no confirmation was queued.
2. A subsequent successful Stripe sandbox payment charged **24,300 test cents**, matching the $225 subtotal plus 8% tax. The actual Stripe-origin event **`evt_1URikc2d5P44qe8AEkP0oisW`** was stored by the booking server.
3. The guest receipt and staff booking alert both show **delivered** in Resend and were independently found in Gmail's **INBOX**:

| Message | Resend ID | Delivery evidence |
| --- | --- | --- |
| Guest payment receipt | `01a14c97-3feb-7586-8eb8-cecd5c630879` | Resend delivered; Gmail INBOX |
| Staff booking alert | `01a14c97-421a-7790-bfb5-f4330826878e` | Resend delivered; Gmail INBOX |

## Full venue-closure refund evidence

The authenticated staff HTTP flow closed the test seating and requested a weather-closure refund. Operation **`a2631af1-a0b4-4931-95d5-a07a021d785e`** succeeded for the entire **24,300 test cents**, including tax.

- Stripe sandbox refund: **`re_3URijP2d5P44qe8A1NMPD1NN`**.
- Actual Stripe-origin refund event stored: **`evt_3URijP2d5P44qe8A1r1iUNPJ`**.
- Final booking state: **cancelled**. Seating remained **closed**, with **1 of 1** igloos available in its internal capacity count. It was not reopened for purchase.
- Guest refund notice: Resend **`01a14c98-11d7-78c9-96e4-c009de13b624`**, status **delivered**; Gmail **`1a14c9815a79abc9`**, label **INBOX**.

This verifies the real sandbox API, webhook and email path. It does not claim a real-money refund occurred.

## Duplicate delivery, retry and automated checks

- Duplicate event delivery produced no additional refund or email: there remained **one refund operation** and **one guest refund-email attempt**.
- A `refund.updated` delivery initially returned **503 `REFUND_BUSY`** while the authenticated staff refund worker held its lease. Stripe automatically retried and received **200 about 18 seconds later**. This is the intended concurrency/retry behavior; there was no unresolved failure.
- A manual Stripe resend of `refund.updated` subsequently returned **200**, marked **Delivered / Recovered** at **01:22:14 UTC**. It created no duplicate refund or email.
- Latest full automated run: **109 tests — 107 passed, zero failed, two opt-in PostgreSQL tests skipped**. The two native PostgreSQL tests were previously run separately against the development database and passed. TypeScript, frontend build and lint passed.
- Production state was checked separately: **zero bookings, zero refund operations, zero alerts, four draft packages and twelve closed slots**. Sandbox records and emails did not populate the production booking database.

## Visual evidence

Proof directory: `C:/Users/Demo Bailey/.codex/visualizations/2026/10/17/sodus-refunds/`

- `production-email-staff-login.png`
- `sandbox-payment-declined.png`
- `sandbox-booking-confirmed.png`
- `sandbox-full-refund-confirmed.png`
- `sandbox-webhook-replay-delivered.png`
- `sandbox-webhook-disabled.png`

## Completed cleanup and remaining launch decision

- **Sandbox cleanup is complete.** The fixture's `retired_at` is saved, its package is draft and its seating is closed. Payment/refund/email audit evidence is retained.
- After successful replay verification, the temporary sandbox webhook **`we_1URif82d5P44qe8A7KPpYuBv`** was visibly **Disabled** in Stripe. The ngrok tunnel and isolated API were stopped; no listeners remained on ports **4318** or **4040**.
- The ignored sandbox environment now has execution, email and refund flags false; the consumed login token was removed. Vite was restored to the ordinary local mock preview on port **5173**, using the default API on **4317**.
- Complete the final production configuration/account review before enabling customer bookings or live refund execution. Verify the intended live account, credentials, tax rate, webhook subscriptions, approved catalog/policies and deployment settings while launch gates remain closed.
- **Do not perform a real-card live-mode test charge.** Stripe's official testing instructions prohibit testing live mode with real payment details and direct integration tests to sandbox/test credentials. The successful sandbox lifecycle above is the payment/refund test evidence; final launch requires production configuration/account checks, not a mandatory real-money smoke charge. [Stripe testing instructions](https://docs.stripe.com/testing#how-to-use-test-cards)
- Maát's separate inquiry-form inbox confirmation remains distinct from these verified Demo booking emails. Sender verification and Demo receipt do not establish delivery of the earlier FormSubmit inquiry to Maát.

This record supersedes earlier handoff statements that booking email delivery was disabled, real sandbox refund/notification delivery remained untested, cleanup was pending, or a live-mode real-card smoke test was required. **Production bookings and live refund execution remain closed; an approved launch decision is still required after the final production configuration review.**
