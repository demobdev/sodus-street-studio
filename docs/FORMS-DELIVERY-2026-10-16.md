# Sodus form delivery audit — October 16, 2026

This records the implementation at the start of production-readiness work. No test submission, email, or live payment was sent during this audit. Later server/email changes should update the relevant rows before launch.

| Form | Destination and behavior | Storage / delivery evidence |
| --- | --- | --- |
| Studio session request, `/booking` | Browser sends JSON to `https://formsubmit.co/ajax/maat@onthemovecs.com`. Subject: `Sodus Street Studio Booking Request — {session type}`. Reply-To is the guest email. Maát follows up with availability and payment instructions. | No app database record, reserved inventory, payment, calendar event, staff dashboard entry, or automatic guest confirmation. FormSubmit acceptance is checked before the success state is displayed. Inbox delivery remains unverified. |
| General contact, `/contact` | Same FormSubmit destination. Subject: `Sodus Street Studio Contact Inquiry`. Reply-To is the guest email. | No app database record or CRM integration. Inbox delivery remains unverified. |
| Igloo inquiry, `/igloos` while booking is closed | Same FormSubmit destination. Subject: `Sodus Street Studio — Igloo Event Inquiry`. Includes preferred date and `requestType: inquiry-only`. Reply-To is the guest email. | Does not hold an igloo or take payment. No booking database entry. Inbox delivery remains unverified. |
| Paid igloo reservation, `/igloos` when enabled | Same-origin `POST /api/igloo/checkout`; server saves a hold, creates a Stripe Checkout Session, and redirects the guest to `checkout.stripe.com`. | Guest details and reservation snapshots are stored in `igloo_bookings`. Payment status is checked server-side using signed Stripe webhooks or reconciliation. A redirect alone never confirms payment. |
| Igloo guest confirmation | At audit time, the durable `igloo_outbox` sends confirmation to the guest’s booking email through Resend after payment is verified. | Requires configured and verified sender, enabled delivery, and actual delivery testing. No automatic Maát/staff booking alert existed at the start of this audit. |
| Staff sign-in, `/igloos/manage` | `POST /api/igloo/admin/login` accepts only addresses allowlisted in `BOOKING_ADMIN_EMAILS`; Resend sends a one-time sign-in link. Response is generic to other addresses. | Hashed one-time credentials and sessions are stored in the booking database. `.env.example` names `demo@blockbusters.tech` and `maat@onthemovecs.com`; an example is not proof of deployed settings. Local mock mode displays a clearly labeled test link without sending email. |
| Staff package / seating editors | Authenticated `POST /api/igloo/admin/package` and `/admin/slot`. | Writes booking database package and seating records. Does not email customers or charge cards. |

## What needs confirmation from Maát

- Confirm `maat@onthemovecs.com` remains the intended recipient for all three request forms, or supply the preferred Sodus address and any additional recipients.
- Confirm receipt of a clearly labeled test submitted from the final public website. If FormSubmit sends an activation request, she must confirm the receiving address first. Check spam as well as inbox. Do not assume deployment or a browser success message proves inbox delivery.
- Confirm the intended Sodus sender/reply-to address for reservation confirmations and staff alerts, so its domain can be verified and end-to-end delivery tested.

## Evidence and limits

- `web/src/lib/submitRequest.ts` fixes the recipient to Maát, checks HTTP status and FormSubmit’s `success` response, and supplies a direct-email fallback on failure. It sets `_captcha: false`, uses AJAX, and configures no `_cc`, `_autoresponse`, webhook, or database.
- `web/src/components/BookingForm.tsx` and `ContactForm.tsx` enumerate request fields and subjects. Their forms collect names, email, optional phone and request details; card information is not collected there.
- `server/app.ts`, `payments.ts`, `email.ts`, `schema.sql`, and `store.ts` implement the separate reservation/payment, staff-access, and confirmation paths.
- Both connected Demo inboxes were searched (including spam and trash) for FormSubmit with Sodus or Maát. No matching activation or delivery messages were found. These are **not Maát’s mailbox**, so the search cannot establish whether she activated FormSubmit or received submissions.
- Maát’s October 15 email, subject **Sodus Street Studio**, message `1a142bb7731b43de` in the Blockbusters inbox, supplies the event brief and says Stripe is completely set up. It does not specify a replacement form recipient or confirm FormSubmit activation. Her sender/signature is `maat@onthemovecs.com`.
- [FormSubmit’s official setup instructions](https://formsubmit.co/) say first use sends a confirmation email. They also say autoresponses do not work for AJAX forms or with reCAPTCHA disabled. The current form integration therefore does not send automatic guest acknowledgments.

## Copy corrected

Removed obsolete Acuity promises from the studio form, booking page, FAQ, and privacy page. Studio requests now state that staff confirm availability and payment details, and that submitting the form does not reserve a session or collect payment. The existing studio cancellation wording was retained; it must not be treated as the igloo event policy.
