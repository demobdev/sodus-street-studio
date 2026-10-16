# Igloo booking implementation contract

All amounts are integer USD cents. One booking reserves one entire igloo; `guests` is party size, not inventory quantity. Stored dates are UTC ISO strings; display event times in America/New_York. Production sales remain disabled until packages and policies are approved. Local demo data is explicitly test-only.

## Public API

- `GET /api/igloo/catalog` -> `{mode:'test'|'live'|'unconfigured', bookingOpen:boolean, notice:string, packages:Package[], slots:Slot[]}`.
- `POST /api/igloo/checkout` body `{packageId,slotId,name,email,phone?,guests,policyAccepted:true,requestId}`. requestId is a stable browser-generated UUID for retrying the same submission. Returns `{checkoutUrl,bookingToken}`. No client price is accepted. 409 means slot unavailable; 503 means setup/booking unavailable. Error shape `{error:string,code?:string}`.
- `GET /api/igloo/booking` with `Authorization: Bearer <bookingToken>` -> `{mode,reference,status,packageName,startsAt,endsAt,guests,amountCents,currency,emailStatus,checkoutUrl?}`. Status: `held|awaiting_payment|confirmed|expired|cancelled|needs_review`. Never infer paid from the redirect.
- Return route `/igloos/confirmation#token=<bookingToken>`. Stripe cancel return `/igloos/confirmation?cancelled=1#token=<bookingToken>`. Store token in sessionStorage and strip URL fragment after reading. Poll while held/awaiting_payment with a bounded timer, provide refresh and back links. No email/name/address returned publicly.
- Local-only simulator route `/igloos/test-checkout#token=<bookingToken>`: clear 'Local simulation — no payment is collected' screen. Buttons invoke `POST /api/igloo/simulate` with bearer token and `{outcome:'paid'|'failed'|'expired'}`; this API must reject unless bound local dev server and explicit mock mode. It must be impossible to enable on Vercel.

Package: `{id,name,description,durationMinutes,amountCents,currency:'usd',maxGuests,policyText,status:'draft'|'active'}`.
Slot: `{id,startsAt,endsAt,capacity,remaining,status:'open'|'closed'}`. A package is eligible only when its duration matches the slot duration. Do not show incompatible slots. Capacity is the number of whole igloos. Overlapping slot rows are prohibited so capacity cannot be accidentally duplicated.

## Admin API and UI

Route `/igloos/manage`, excluded from navigation; show sign-in before fetching customer data. Cookie authenticated, no tokens/credentials in frontend source or persistent browser storage.

- `POST /api/igloo/admin/login` `{email}` -> generic `{ok:true,devLoginUrl?:string}`. Server sends one-time link only for allowlisted admin emails. `devLoginUrl` may appear only on explicit local mock server with simulated email. Local UI must label it 'Local test sign-in'.
- Link route `/igloos/manage#login=<token>` -> `POST /api/igloo/admin/session` `{token}` sets HttpOnly SameSite cookie and returns `{ok:true}`. Strip token fragment immediately.
- `POST /api/igloo/admin/logout` -> `{ok:true}`.
- `GET /api/igloo/admin` -> `{mode,readiness:string[],packages:Package[],slots:Slot[],bookings:AdminBooking[]}`.
- `POST /api/igloo/admin/package` Package without required id for new entry. Returns `{ok:true}`. Input approval/status does not override the global live-sales gate.
- `POST /api/igloo/admin/slot` Slot fields without remaining and optional id. Returns `{ok:true}`. API accepts UTC ISO; the editor accepts New York local time, validates DST gaps/ambiguities and converts to UTC. Reject overlaps and capacity less than occupied units.
- `POST /api/igloo/admin/reconcile` -> `{ok:true}` refresh held sessions against Stripe and retry pending confirmation emails. No refund or cancellation of confirmed bookings in this version; staff handle that through Stripe/support until policy is approved.

AdminBooking: `{id,reference,status,name,email,phone,guests,packageName,startsAt,endsAt,amountCents,currency,emailStatus,createdAt}`.

## Backend responsibilities

Postgres transactions and slot row locking serialize reservations. A hold consumes capacity until Stripe confirms expired/failed or the payment confirms; never free it solely because a local clock deadline passed. Awaiting asynchronous payment continues to consume capacity. Durable webhook processing is idempotent and verifies session linkage, account mode, currency and amount; mismatch becomes needs_review and retains capacity. Confirmation mail uses a durable outbox with retry and idempotency.

Backend modules live in `server/`, Vercel entry in `api/igloo.ts`; `server/dev.ts` serves the same API locally on 4317. Vite proxies `/api/igloo` to 4317. Local database is PGlite on disk, production uses Postgres. Production never falls back to local/mock storage or mock payments.
