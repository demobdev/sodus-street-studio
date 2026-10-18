# Igloo page structured-data review — October 17, 2026

The igloo page now has a connected JSON-LD graph describing the page, the private igloo dining experience, and Sodus Street Studio at its published address. This work does not enable checkout, publish inventory, or change the approved dates, prices, tax or policies.

## Findings and changes

- Before this change, a direct HTTP request to `https://sodus-street-studio.vercel.app/igloos` returned 200 with the generic recording-studio title, no canonical link, and no JSON-LD. Source inspection confirmed the igloo React page also had no structured data.
- Added `WebPage`, `Service`, and `LocalBusiness` nodes with connected IDs, the published Clyde address, and the two real igloo images already displayed on the page. Experience details come from the same content module as the visible page.
- Added a specific igloo title, description, and one canonical URL. The stable Vercel address remains the canonical while the custom domain still awaits its website cutover. Update `publicSiteOrigin` in `web/src/content/igloo-schema.ts` together with that cutover, then rebuild.
- The build emits a dedicated `igloos/index.html` with this metadata and graph in its initial HTML. Exact `/igloos` and `/igloos/` rewrites select it before the SPA fallback; private manage, confirmation and test-checkout routes retain their existing routing and noindex headers.
- React reuses those metadata nodes on a direct visit and creates them during client navigation. Leaving the igloo page removes the igloo canonical and graph and restores the existing studio title/description.
- No offers, ticket availability, ratings, booking actions, or fabricated video publication details were added. The public page lists several dates and seatings rather than a unique event leaf page, so this change does not label the entire schedule as one Google event.

## Validation

- `npm run build` in `web`: passed; emitted `dist/igloos/index.html` with the production asset URLs.
- `npm run lint` in `web`: passed.
- `node --experimental-strip-types --test src/content/igloo-schema.test.mjs` in `web`: 5 passed. Covers graph references/address, absence of ticket/inventory claims, safe inline JSON serialization, initial HTML, and exact route isolation.
- Independently parsed the actual built HTML: one canonical, one parseable graph matching the shared schema data, the app bundle present, and no igloo graph in the generic homepage HTML.
- `git diff --check`: passed.
- Browser checks passed for a direct igloo visit, SPA navigation to About, and SPA return to Igloo Events: the igloo page had one connected graph, one canonical and its specific title; About had no igloo graph or canonical and restored the studio title; returning restored one graph. Evidence: `output/igloo-2026-10-17/schema-browser-navigation.json`.
- The exact rendered JSON-LD script was submitted to the official [Schema.org validator](https://validator.schema.org/) using its code-snippet test. It recognized the linked WebPage graph with **0 errors and 0 warnings**. Screenshot: `C:/Users/Demo Bailey/.codex/visualizations/2026/10/17/sodus-refunds/igloo-schema-validator.png`.
- Final deployed-HTML checks are recorded in the production review. These schema and browser checks do not by themselves establish Google indexing or rich-result eligibility.

## Search limitations and next maintenance step

This graph helps describe the experience and local business; it does not guarantee a rich result or a ranking change. The page still renders its visible main content with React, although the structured data is present before JavaScript. Google can render JavaScript; some other crawlers cannot. Full page prerendering is a separate improvement if needed.

After the custom domain serves this release, align its canonical origin, verify it in Search Console, and inspect `/igloos`. If individual evenings are later given their own public event pages, evaluate event markup there using their actual dates, locations, and real booking status. Do not turn on schema ticket offers independently of the booking system.

## Official references checked

- [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): match the visible content and avoid misleading claims.
- [Google event requirements](https://developers.google.com/search/docs/appearance/structured-data/event): individual events need unique leaf URLs; the event experience focuses on a single event page.
- [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): unique metadata, canonical consistency, and the benefits of initial HTML.
- [Schema.org Service](https://schema.org/Service), [WebPage](https://schema.org/WebPage), and [LocalBusiness](https://schema.org/LocalBusiness): properties and linked entity types used by this graph.
- [Vite plugin API](https://vite.dev/guide/api-plugin): post-build plugin ordering used for the small igloo HTML output.

The Google Rich Results Test and Search Console were not run against the undeployed local change. The successful Schema.org validation above is a schema-vocabulary check, not a Google validation pass or a promise of indexing or rich results.
