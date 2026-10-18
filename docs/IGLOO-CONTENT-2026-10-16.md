# Under the Stars — October 16 content update

Source: Maát's email **Sodus Street Studio**, sent October 15, 2026 at 11:22 p.m. Eastern (October 16 03:22 UTC), Gmail message `1a142bb7731b43de`. Read in the Blockbusters inbox. Attachment: `SSS Under the Stars_Landing Page.docx`, preserved under `output/igloo-2026-10-16/` with extracted text. This brief supersedes the provisional $200 / six-guest sample discussed earlier.

## Details supplied

- Sodus Street Studio Under the Stars, at 28 Sodus Street, Clyde, New York.
- $225 per private igloo; up to eight guests; 90 minutes. Maát's October 17 reply confirms 8% tax: $18 tax, **$243 total**, paid in full at booking.
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

**October 17 photo update:** Maát's separate Hightail email (message `1a142bb739fcaec9`, sent alongside her October 15 brief) contains 13 files. `SSS-website.zip` was downloaded and inspected. Two distinct unfurnished-igloo views match her description of the actual setup before furniture is installed. They are now used in a two-photo section on `/igloos`, with a note that furnishings and final table settings are being prepared.

| Supplied filename inside SSS-website.zip | Published asset |
| --- | --- |
| `ChatGPT Image Oct 15, 2026, 07_54_33 PM.jpg` | `/images/igloos-evening.jpg` |
| `ChatGPT Image Oct 15, 2026, 07_55_01 PM.jpg` | `/images/igloo-entrance.jpg` |

Both JPEGs are copied byte-for-byte at their supplied 1536 × 1152 dimensions, without retouching or added furnishings. The supplied names include `ChatGPT Image` and contain no camera EXIF; selection is based on the unfurnished views matching Maát's description, not independently authenticated camera provenance. `07_55_46 PM.jpg` is an exact SHA-256 duplicate of `07_54_33 PM.jpg` and is omitted. Furnished concept renders, the promotional poster and the screenshot of the mock studio gallery are not published as venue photos. The remaining `Sodus Street Studio.png` is a logo.

The inline image in the direct email is an account-access screenshot; its other inline images are signature graphics. Those were not the venue photos. The earlier request for a photo folder is superseded by the Hightail transfer.

**October 17 evening update:** Maát supplied the tax and booking policy in message `1a14c0deb4708ec5`: 8% tax, full payment, 2 p.m. Eastern event-day booking cutoff, no customer cancellations/refunds/rescheduling/exchanges, ticket transfer to a friend/family member, and full refunds if Sodus closes for weather or unforeseen circumstances. Public pricing now states **$225 plus 8% tax — $243 total**. The local simulator still does not calculate or collect tax. Do not substitute the separate studio-session cancellation policy.

New venue photos are expected Tuesday, October 20; the current supplied views remain in place until those arrive. Customer bookings stay closed while sender DNS, live Stripe refund permissions/event subscriptions and payment/notification checks are completed. See [the current booking handoff](SODUS-BOOKING-HANDOFF-2026-10-17.md).

Implementation keeps the existing API readiness gate. Each local test package represents one included platter at the same $225 base price and uses shared slot inventory. Historical test bookings retain their old package/price snapshots.

## Verification

Local seed applied successfully on October 16: four platter packages, twelve seating slots, four available igloos per slot. Browser checked all twelve New York seating labels and the $225 package summary. The actual Vimeo embed played on the local page; native transcript expands, and the 390px mobile layout has no horizontal overflow. Screenshots: `output/igloo-2026-10-16/video-desktop.png` and `video-mobile.png`. Frontend build/lint and TypeScript passed; 31 server tests passed with the opt-in external Postgres test skipped in this run. No deployment, live inventory, live charge or outgoing email was made.
