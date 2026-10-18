# Sodus launch check and Maát email draft — October 17, 2026

**Evening update:** Maát answered the outstanding policy questions at 6:48 p.m. Eastern (`1a14c0deb4708ec5`). The current requirements and technical blockers are in [the booking handoff](SODUS-BOOKING-HANDOFF-2026-10-17.md). Form activation is now observed and one post-activation retest was accepted by FormSubmit; inbox receipt is still unconfirmed. The sent-email transcript and earlier test results below remain historical records.

## Current result

Stripe's production connection is installed, but paid bookings remain closed. The public catalog returned `mode: live`, `bookingOpen: false`, and no exposed packages or slots. The initial morning check found the stable production alias READY on commit `33b7072`, deployment `dpl_6JzpuLnSnoLJVxgfVvU1vVuUwSQA`. The earlier failed deployment email is historical; it does not describe the current release.

The subsequent photo release `bdbf0bf` deployed successfully as `dpl_2rnAGrSeVu53deshKAS7tY3yXVhN`. Both supplied unfurnished igloo views are now on the live page. Desktop/mobile checks passed; paid bookings remain closed.

## Authorized live inquiry test

Demo explicitly requested a test before drafting the client email. One inquiry was submitted through the live `/igloos` page, using:

- Name: `Demo Bailey — TEST ONLY`
- Email: `demo@blockbusters.tech`
- Phone and preferred date: blank
- Recipient configured in the application: `maat@onthemovecs.com`
- Subject configured in the application: `Sodus Street Studio — Igloo Event Inquiry`
- Message: `TEST ONLY — Sodus website form delivery check, October 17, 2026. Hi Maát, this is Demo testing the live igloo inquiry form. This is not a reservation or payment request; please do not reserve an igloo. Please reply to confirm this test arrived in your inbox. Thank you!`

The page displayed this provider error, not a success state:

> This form needs Activation. We've sent you an email containing an 'Activate Form' link. Just click it and your form will be actived!

At this morning check, FormSubmit reported sending an activation email and the next step was activation followed by one clearly labelled retest. The evening update above supersedes that blocker: activation was observed and the one retest was provider-accepted; Maát's inbox receipt is still unverified. All three inquiry forms use the same recipient and transport, but only the igloo form was exercised. They do not save requests in the application's database or reserve inventory.

Proof: `output/igloo-2026-10-17/form-activation-required.png`.

## Email findings

- Searched both connected Demo mailboxes, including spam and trash. No new direct Maát email was found this morning.
- Stripe's October 17, 6:25 a.m. Eastern email says the Sodus Stripe profile can receive funds from other Stripe businesses. This notification is about the Stripe profile; it is not proof of the website's checkout or confirmation delivery.
- Maát already sent a Hightail transfer on October 15 at 11:22 p.m. Eastern: **13 files**, 35 MB, subject **Sodus Street Studio**. The shared page is accessible and says access never expires. Her message says some images are actual and some are AI, with furniture not yet installed. It contains the landing-page brief, logos, SSS-website.zip and image files. This supersedes the October 16 request for her to provide photos. The two unfurnished views were reviewed and published in the photo release; selection and provenance limitations are recorded in `docs/IGLOO-CONTENT-2026-10-16.md`.
- Morgan's October 16 reply asks for photos and Sodus GoDaddy domain privileges. The photos are already in Hightail. Domain access still needs verification for the custom website address and outgoing email authentication.

## Answers received and remaining client follow-up

Maát confirmed full payment, $225 plus 8% tax ($243 total), a 2 p.m. Eastern event-day cutoff, no customer cancellation/refund/rescheduling/exchange, transfer to a friend/family member, and full refunds for venue closures. Her reply-to preference is `info.sodusstreetstudio@gmail.com`; Demo approved `bookings@sodusstreetstudio.com` as sender. Updated photos are expected Tuesday.

Remaining client follow-up is receipt of the single post-activation inquiry test and DNS access if current team access is insufficient for sender verification. Tax/policy implementation and Stripe refund permissions are our technical work, not unanswered policy questions.

The packages, price, dates and seatings are already supplied; do not ask for them again. The bank account is already connected; do not ask her to add it again.

## Our remaining work before paid reservations

- Verify the created Resend domain through DNS, configure the approved sender/reply-to, then test guest, staff-alert and staff sign-in delivery.
- Deploy the implemented venue-closure refund workflow and extend the live restricted key/webhook for refunds. The existing key has no Charges and Refunds permission and the endpoint currently has only four Checkout event subscriptions. Keep live refunds disabled until verified. No customer rescheduling path is planned under the approved policy.
- Durable staff booking and refund-review alerts and guest refund confirmations are implemented and provider-mocked tests pass; real delivery still requires sender verification.
- Apply approved tax and policies and test actual Stripe-origin payment/refund/webhook/confirmation behavior. Locally signed readiness probes and mocked tests are not a completed live payment/refund test.
- Arrange an owner-controlled live payment/refund smoke check, then activate the catalog and launch flags only after checks pass.

## Email sent — October 17, 2026

Sent from `demo@blockbusters.tech` to `maat@onthemovecs.com` after Demo's explicit send instruction. Gmail confirmed the `SENT` label; message/thread ID: `1a14b5121d52a5b0`.

Subject: Sodus igloo bookings — final details

Hi Maát,

Stripe is connected to Sodus, and your igloo packages, pricing and dates are loaded. We’ve also added the two unfurnished igloo views from your photo folder.

We can build booking directly into your Sodus website, connecting to Stripe’s API for secure payments. Guests would choose their package and seating through your site without needing a separate booking platform—would that approach work for you?

I tested the website inquiry form today. FormSubmit, the service that forwards inquiries to your inbox, needs a one-time activation. Please check maat@onthemovecs.com, including spam, for its activation email. You can click **“Activate Form”** yourself or forward the email to me at **demo@blockbusters.tech** and I can handle it. Afterward, I’ll resend the test so you can confirm it arrives.

Could you also confirm:

- The applicable tax rate for the $225 igloo and food package.
- Your cancellation, refund, rescheduling and bad-weather policy.
- Whether full payment at booking and closing reservations 35 minutes before each seating work for you.
- Which email address you’d like booking confirmations to come from.

We’ll finish the remaining payment, email and cancellation checks before opening bookings.

Thanks,
Demo

## Forwarded to the team — October 17, 2026

Demo authorized forwarding the sent message to Christian Broussely (`christian@blockbusters.tech`) and Morgan Engle (`morgan@blockbusters.tech`). Gmail confirmed forwarding from `demo@blockbusters.tech` with the `SENT` label: message `1a14b53e4e97aaf1`, thread `1a14b5121d52a5b0`. The original message above was included unchanged.

Intro: “Hi Christian and Morgan, Forwarding the Sodus booking update I sent Maát so you both have the latest status and the final details we’re waiting on. Thanks, Demo.”

## Earlier cancellation review implementation and verification

- Authenticated staff can flag a confirmed reservation with a reason, see active requests first, and withdraw a request by its exact ID. The database retains requester/withdrawer identity and timestamps. Payment state, guest confirmation behavior and capacity stay unchanged.
- This is an internal review queue, not a completed cancellation/refund/rescheduling workflow. Production staff sign-in still depends on the sender configuration above. No real payments, refunds or guest messages were generated by this work.
- Server type check and existing test suite passed; six focused cancellation tests and the admin HTTP privacy/authentication test passed. The native pooled PostgreSQL test passed against the separate Neon **development** branch, including simultaneous requests and payment delivery. It removed only its own test records.
- Web build and lint passed. Local browser testing covered creation and withdrawal, desktop and 390px mobile layouts, no page overflow and no console warnings/errors. The local test request was withdrawn afterward; its audit history remains.
- Screenshot proof: `C:/Users/Demo Bailey/.codex/visualizations/2026/10/17/sodus-booking-review/cancellation-review-desktop.png` and `cancellation-review-mobile.png` in that directory. These show local test data, not a real cancellation.

The subsequent venue-closure refund and notification implementation supersedes the earlier review-only limitation. See [the current handoff](SODUS-BOOKING-HANDOFF-2026-10-17.md) for scope, tests and remaining production gates; final deployment is pending.
