# Igloo booking implementation contract

All amounts are integer USD cents. One booking reserves one entire igloo; `guests` is party size, not inventory quantity. Stored dates are UTC ISO strings; display event times in America/New_York. Maát approved the price, tax and event policy October 17; production sales and refunds remain disabled pending sender, Stripe refund configuration and end-to-end verification. Local demo data is explicitly test-only. See [current decisions and launch gates](SODUS-BOOKING-HANDOFF-2026-10-17.md).

## Public API

- `GET /api/igloo/catalog` -> `{mode:'test'|'live'|'unconfigured', bookingOpen:boolean, notice:string, packages:Package[], slots:Slot[]}`.
- `POST /api/igloo/checkout` body `{packageId,slotId,name,email,phone?,guests,policyAccepted:true,requestId}`. requestId is a stable browser-generated UUID for retrying the same submission. Returns `{checkoutUrl,bookingToken}`. No client price is accepted. 409 means slot unavailable; 503 means setup/booking unavailable. Error shape `{error:string,code?:string}`.
- `GET /api/igloo/booking` with `Authorization: Bearer <bookingToken>` -> `{mode,reference,status,packageName,startsAt,endsAt,guests,amountCents,taxCents,totalCents,currency,emailStatus,refundedAt,refundStatus,checkoutUrl?}`. Status: `held|awaiting_payment|confirmed|expired|cancelled|needs_review`. `refundedAt` and `refundStatus` are nullable. Never infer paid from the redirect, or refunded from a staff request alone.
- Return route `/igloos/confirmation#token=<bookingToken>`. Stripe cancel return `/igloos/confirmation?cancelled=1#token=<bookingToken>`. Store token in sessionStorage and strip URL fragment after reading. Poll while held/awaiting_payment with a bounded timer, provide refresh and back links. No email/name/address returned publicly.
- Local-only simulator route `/igloos/test-checkout#token=<bookingToken>`: clear 'Local simulation — no payment is collected' screen. Buttons invoke `POST /api/igloo/simulate` with bearer token and `{outcome:'paid'|'failed'|'expired'}`; this API must reject unless bound local dev server and explicit mock mode. It must be impossible to enable on Vercel.

Package: `{id,name,description,durationMinutes,amountCents,currency:'usd',maxGuests,policyText,status:'draft'|'active'}`.
Slot: `{id,startsAt,endsAt,capacity,remaining,status:'open'|'closed'}`. A package is eligible only when its duration matches the slot duration. Do not show incompatible slots. Capacity is the number of whole igloos. Overlapping slot rows are prohibited so capacity cannot be accidentally duplicated.

New reservations close at 2 p.m. America/New_York on the event's local calendar date, regardless of seating time. Catalog/new holds and first Checkout creation enforce that boundary. An already-persisted Stripe request retains its original idempotent parameters and may complete/reconcile after the cutoff. The 31-minute Checkout payment window does not allow creating a new reservation after 2 p.m.

## Admin API and UI

Route `/igloos/manage`, excluded from navigation; show sign-in before fetching customer data. Cookie authenticated, no tokens/credentials in frontend source or persistent browser storage.

- `POST /api/igloo/admin/login` `{email}` -> generic `{ok:true,devLoginUrl?:string}`. Server sends one-time link only for allowlisted admin emails. `devLoginUrl` may appear only on explicit local mock server with simulated email. Local UI must label it 'Local test sign-in'.
- Link route `/igloos/manage#login=<token>` -> `POST /api/igloo/admin/session` `{token}` sets HttpOnly SameSite cookie and returns `{ok:true}`. Strip token fragment immediately.
- `POST /api/igloo/admin/logout` -> `{ok:true}`.
- `GET /api/igloo/admin` -> `{mode,readiness:string[],packages:Package[],slots:Slot[],bookings:AdminBooking[],refundsEnabled:boolean,refunds:RefundOperation[]}`.
- `POST /api/igloo/admin/package` Package without required id for new entry. Returns `{ok:true}`. Input approval/status does not override the global live-sales gate.
- `POST /api/igloo/admin/slot` Slot fields without remaining and optional id. Returns `{ok:true}`. API accepts UTC ISO; the editor accepts New York local time, validates DST gaps/ambiguities and converts to UTC. Reject overlaps and capacity less than occupied units.
- `POST /api/igloo/admin/reconcile` -> `{ok:true}` refreshes a bounded held-session batch against Stripe and retries pending confirmation/alert emails.
- `POST /api/igloo/admin/cancellation-request` `{bookingId,reason}` and `/admin/cancellation-withdraw` `{bookingId,requestId}` -> `{ok:true}`. These audit-only review actions retain inventory/payment state; the server records the authenticated actor rather than accepting a client identity.
- `POST /api/igloo/admin/refund` `{bookingId,requestId,reason:'weather'|'venue_closure',note}` -> `{ok:true,refund}`. Requires refund enablement, a confirmed booking with verified original payment, and a closed seating. Creates one durable full-gross refund operation; this response does not mean Stripe has refunded the payment.
- `POST /api/igloo/admin/refund/reconcile` `{bookingId}` -> `{ok:true,refund}` processes/checks that existing operation and queues eligible alerts. Competing workers return `REFUND_BUSY`; a failed or unknown operation must not be replaced with a second refund.

AdminBooking includes `{id,slotId,reference,status,name,email,phone,guests,packageName,startsAt,endsAt,amountCents,taxCents,totalCents,currency,emailStatus,createdAt,refundedAt,cancellationRequest}`. The nullable cancellation request contains `{id,reason,requestedBy,requestedAt}`.

RefundOperation includes `{id,bookingId,requestId,reason,note,actor,amountCents,currency,status,refundId,attemptedAt,completedAt,createdAt,error}`. Refund status is `requested|pending|succeeded|failed|needs_review`. Staff-only records include payment identifiers and audit metadata; the public booking response exposes only refund state/time. No customer refund, reschedule or exchange endpoint exists under the approved policy.

## Backend responsibilities

Postgres transactions and slot row locking serialize reservations. A hold consumes capacity until Stripe confirms expired/failed or the payment confirms; never free it solely because a local clock deadline passed. Awaiting asynchronous payment continues to consume capacity. Durable webhook processing is idempotent and verifies session linkage, account mode, currency and amount; mismatch becomes needs_review and retains capacity. Confirmation mail uses a durable outbox with retry and idempotency.

Venue refunds retain inventory until the current Stripe object matches the operation's full paid amount, currency, payment identity and metadata and reports success. Refund webhooks (`refund.created`, `refund.updated`, `refund.failed`) trigger current-object reconciliation; they do not blindly apply the event's possibly stale status. Once refunded, late Checkout events or later refund failures cannot restore inventory. The seating itself stays closed until an explicit staff change.

`igloo_booking_alerts` stores immutable event/recipient payloads for staff booking notices, guest full-refund confirmations and staff review notices. A five-minute claim lease, stable provider idempotency key and current-state checks handle retries, concurrent workers and stale notices. Guest confirmation `emailStatus` is independent of staff/refund-alert delivery. Sending remains gated by configuration; a queue row is not proof of email delivery.

Backend modules live in `server/`, Vercel entry in `api/igloo.ts`; `server/dev.ts` serves the same API locally on 4317. Vite proxies `/api/igloo` to 4317. Local database is PGlite on disk, production uses Postgres. Production never falls back to local/mock storage or mock payments.
