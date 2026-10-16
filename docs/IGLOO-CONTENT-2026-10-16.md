# Under the Stars — October 16 content update

Source: Maát's email **Sodus Street Studio**, sent October 15, 2026 at 11:22 p.m. Eastern (October 16 03:22 UTC), Gmail message `1a142bb7731b43de`. Read in the Blockbusters inbox. Attachment: `SSS Under the Stars_Landing Page.docx`, preserved under `output/igloo-2026-10-16/` with extracted text. This brief supersedes the provisional $200 / six-guest sample discussed earlier.

## Details supplied

- Sodus Street Studio Under the Stars, at 28 Sodus Street, Clyde, New York.
- $225 per private igloo, plus applicable tax; up to eight guests; 90 minutes.
- One platter included: Classic Sub Tray; Charcuterie Experience; Italian Favorites (meatballs and mozzarella Caprese); or Casual Favorites Platter (burgers and chicken fingers).
- October 23, 24, 30 and 31, 2026. The weekdays in the brief match 2026.
- Seatings: 5–6:30 p.m., 7–8:30 p.m., 9–10:30 p.m., America/New_York.
- Four igloos per seating, shared inventory across platter choices. Twelve seatings, at most 48 igloo reservations across the four evenings.

## Video

- Supplied URL: https://vimeo.com/1236354271
- Title: **Ride-To-Clyde-15 (1)**, uploaded by Maát Reed on October 15.
- Official Vimeo Embed UI returned `https://player.vimeo.com/video/1236354271?h=418634721b`, 640 × 360.
- The 15-second promo is about Clyde's October community events. It is not an igloo walkthrough. Present it as **Make an evening of Clyde**, with a responsive player, visible controls, no autoplay, transcript and an external watch link.
- Transcript from Vimeo: "This October, something's stirring in Clyde. Come alive with food, fun, and hometown surprises. Haunted history, spooky thrills, and unforgettable nights all around town. Weekends in October. Take a ride to Clyde."

## Assets and remaining launch inputs

Maát mentions actual unfurnished-igloo photos and AI concepts. They are not attached to this message. The inline image is an account-access screenshot showing DemoBailey / Pending; the other inline images are signature graphics. Do not mistake these for venue photos. A focused Drive search for Sodus and Igloo did not find the new photographs. The photo folder link has been requested from Demo.

Maát says Stripe is completely set up; this is her report, not a new dashboard verification. Live payments remain disabled pending hosted webhook and email verification, final tax configuration, cancellation/weather/rescheduling policy and deployment. Do not carry the studio session cancellation policy into igloo bookings without confirmation. Base-price display must say **plus applicable tax**; the local simulator does not calculate or collect tax.

Implementation keeps the existing API readiness gate. Each local test package represents one included platter at the same $225 base price and uses shared slot inventory. Historical test bookings retain their old package/price snapshots.

## Verification

Local seed applied successfully on October 16: four platter packages, twelve seating slots, four available igloos per slot. Browser checked all twelve New York seating labels and the $225 package summary. The actual Vimeo embed played on the local page; native transcript expands, and the 390px mobile layout has no horizontal overflow. Screenshots: `output/igloo-2026-10-16/video-desktop.png` and `video-mobile.png`. Frontend build/lint and TypeScript passed; 31 server tests passed with the opt-in external Postgres test skipped in this run. No deployment, live inventory, live charge or outgoing email was made.
