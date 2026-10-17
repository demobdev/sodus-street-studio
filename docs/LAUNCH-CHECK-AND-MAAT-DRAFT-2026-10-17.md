# Sodus launch check and Maát email draft — October 17, 2026

## Current result

Stripe's production connection is installed, but paid bookings remain closed. The public catalog returned `mode: live`, `bookingOpen: false`, and no exposed packages or slots. Vercel reports the stable production alias READY on commit `33b7072`, deployment `dpl_6JzpuLnSnoLJVxgfVvU1vVuUwSQA`. The earlier failed deployment email is historical; it does not describe the current release.

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

FormSubmit reports sending an activation email. Maát's inbox is not accessible here, so its receipt and the inquiry's eventual delivery are unverified. Ask her to activate the form, then perform another clearly labeled test and obtain inbox confirmation. Do not repeatedly submit while activation is pending. All three inquiry forms use the same recipient and transport, but only the igloo form was exercised in this live test. They do not save requests in the application's database or reserve inventory.

Proof: `output/igloo-2026-10-17/form-activation-required.png`.

## Email findings

- Searched both connected Demo mailboxes, including spam and trash. No new direct Maát email was found this morning.
- Stripe's October 17, 6:25 a.m. Eastern email says the Sodus Stripe profile can receive funds from other Stripe businesses. This notification is about the Stripe profile; it is not proof of the website's checkout or confirmation delivery.
- Maát already sent a Hightail transfer on October 15 at 11:22 p.m. Eastern: **13 files**, 35 MB, subject **Sodus Street Studio**. The shared page is accessible and says access never expires. Her message says some images are actual and some are AI, with furniture not yet installed. It contains the landing-page brief, logos, SSS-website.zip and image files. This supersedes the October 16 request for her to provide photos. Individual real-versus-AI asset selection still needs review before publication.
- Morgan's October 16 reply asks for photos and Sodus GoDaddy domain privileges. The photos are already in Hightail. Domain access still needs verification for the custom website address and outgoing email authentication.

## Still needed from Maát

1. FormSubmit activation and receipt confirmation after a fresh test.
2. Applicable tax treatment/rate for the $225 igloo-plus-food bundle, including whether itemization is needed.
3. Cancellation, weather, rescheduling and refund terms; confirmation of full payment upfront and the current 35-minute booking cutoff.
4. Preferred outgoing Sodus confirmation email address and domain access for verification.

The packages, price, dates and seatings are already supplied; do not ask for them again. The bank account is already connected; do not ask her to add it again.

## Our remaining work before paid reservations

- Configure and verify the sender, then test guest confirmations and staff sign-in delivery.
- Complete a controlled cancellation/refund/rescheduling process. Current staff booking records are read-only; refund webhooks are not handled. A Stripe-dashboard refund alone does not update the reservation or release inventory. This is our implementation/operations gap, not a missing client answer.
- Provide staff booking alerts or agree on a concrete dashboard-monitoring process; separate staff alerts do not exist yet.
- Apply approved tax and policies and test actual Stripe-origin payment/webhook/confirmation behavior, including failure, expiration and duplicate handling. Locally signed readiness probes are not a completed Stripe payment test.
- Arrange an owner-controlled live payment/refund smoke check, then activate the catalog and launch flags only after checks pass.

## Email draft — not sent

Subject: Sodus igloo bookings — final details

Hi Maát,

Stripe is connected to Sodus, and your igloo packages, pricing and dates are loaded. We’re finishing the booking and confirmation-email checks before opening reservations.

We can build booking directly into your Sodus website, using Stripe’s API to securely handle payments, so guests can choose their package and seating on your site. That would give us a booking system tailored to your igloos without requiring a separate booking platform—would that approach work for you?

I tested the website inquiry form today, and the service that forwards inquiries to your inbox, FormSubmit, needs a one-time activation. Please look for its activation email at maat@onthemovecs.com, including spam. You can click “Activate Form” yourself or forward that email to me at demo@blockbusters.tech and I can handle it for you. Once it’s activated, I’ll resend the test so you can confirm it arrives.

Could you also confirm:

- The tax rate/treatment for the $225 igloo and food package.
- Your cancellation, refund, rescheduling and bad-weather policy.
- Whether full payment at booking and a booking cutoff 35 minutes before each seating work for you.
- Which email address you’d like booking confirmations to come from.

We received your Hightail files too—thank you. We’ve added the two unfurnished igloo views to the page. We’ll finish the remaining payment, email and cancellation checks before opening bookings.

Thanks,
Demo
