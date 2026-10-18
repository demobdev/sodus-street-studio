# Sodus inquiry transport — October 17, 2026

Customer igloo checkout and live refunds remain disabled. This change handles inquiries only; it does not reserve inventory, collect payment or create a booking.

## Evidence and reason for replacement

Maát confirmed receipt of the earlier igloo inquiry in her October 17, 9:18 p.m. Eastern email, message `1a14c966cda2f05b`. That provider notice identified the Vercel-origin form. A subsequent screenshot from the custom-domain studio request showed FormSubmit's activation-required response. Her confirmation is valid evidence for the earlier form; it does not establish the new domain's studio form is activated. FormSubmit's documentation does not explicitly establish that changing a domain resets activation, so the precise provider identity mismatch is unconfirmed.

The three inquiry forms now use same-origin `POST /api/igloo/inquiry` and the already verified Sodus Resend sender. No visitor activation link is required by this transport. Maát's original recipient stays fixed privately on the server. It is removed from public form copy and the client bundle. Visitor email is validated and used as Reply-To only for inquiries; booking confirmation reply-to remains unchanged.

## Delivery behavior

- Studio, general contact and igloo inquiry fields are validated and bounded server-side. The server fixes subjects and recipient; clients cannot set email headers or recipients.
- Origin, JSON body limits, a honeypot and database rate limits apply. Inquiry emails use plain text.
- A per-submission UUID, HMAC payload fingerprint, short send lease and Resend idempotency key prevent duplicate retries. Delivery tracking stores status/reference/provider ID, not the submitted message body. Failed submissions retain their fields in the browser for manual retry; there is no automated inquiry-content outbox.
- Success is shown only after the provider acknowledges acceptance. This is not proof of inbox receipt. Failure text is visitor-safe and never repeats raw provider diagnostics or a personal recipient address.
- Local simulation explicitly reports that no email was sent.

## Validation

- Eight backend inquiry tests cover all three forms, fixed sender/recipient, visitor Reply-To, invalid input/origins/oversized bodies, duplicate and concurrent sends, ambiguous retries, provider failures, local simulation and closed checkout.
- Four client tests cover same-origin requests, stable retry identity, new identity after success or edited details, safe failure text, malformed acknowledgments and simulation/rate-limit messages.
- Browser tests submitted all three forms against an isolated local mock server with no email or payment credentials. Each retained its fields and explicitly reported no email sent.
- Full server suite: 115 passed, two existing opt-in PostgreSQL skips, zero failures. TypeScript, web build, lint and 15 client/schema checks passed.
- No new live inquiry email was sent during this change. Maát's receipt confirmation above applies to the earlier FormSubmit test.

## Hero styling

The igloo hero uses a lazy-loaded tsParticles basic engine for ivory/gold stars over navy. Demo requested a more noticeable continuous effect: drift is four times the initial speed and twinkle is three times faster, with automatic playback and no sky button. A static reduced-motion fallback and offscreen/tab pausing remain. The homepage and booking launch controls are unchanged. The coming-soon gate is deferred at Demo's request.
