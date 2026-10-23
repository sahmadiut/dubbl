# Landing feature / demonstration / help catalog inventory (LOC-126)

LandingFeatures owns 283 paired messages across bento-features, dashboard-preview,
feature-sections, how-it-works, integrations, open-source, testimonials and faq.
Render-local factories translate static display data without module-level hooks.
Both complete accent headings and the FAQ contact sentence use approved em rich
tags; reviewed component code supplies the existing span/anchor elements.

Showcase view state, the six-second advance/wrap timer, timer cleanup, navigation,
marquee copies/speed/direction, SVG paths/coordinates, chart values and accordion
single/collapsible item contracts remain intact. Marquee highlight flags are now
explicit stable booleans, preserving the previous English substring selection in
both languages. View navigation gets localized accessible names/pressed state.

## Intentional exceptions

- DEC-008: Stripe Payout, the complete Stripe/Payments integration card and the
  API-First feature title/description mentioning Stripe remain unchanged. No
  provider implementation or Stripe-specific localization is performed.
- Brands/person/company names (dubbl, AWS, Acme Corp, Globex Inc, Alice Wang,
  Bob Martinez, Carol Singh, QuickBooks, Xero, FreshBooks, Wave, Chase, Shopify,
  Claude), REST API, Apache 2.0, URLs, icon names and module/package identifiers
  remain fixed. Surrounding display prose may translate.
- Dates/month abbreviations (Mar 01, Feb 28, Mar 1, 2026, Jan..Dec), amounts,
  percentages, counts, account codes, invoice/journal/transaction IDs, masked bank
  numbers, and spreadsheet error tokens remain opaque marketing sample values.
  Translated sentences retain their original numbers/codes. These demonstrations
  do not consume ledger data, convert currencies or implement locale formatting.
- Entire terminal/TypeScript/SDK/Docker examples, comments inside examples,
  terminal/self-host/sdk window identifiers and executable commands remain
  literal. This includes the pre-existing e.amount example and localhost output;
  extraction does not qualify or rewrite the examples' API/financial claims.
- CSS, SVG geometry, chart/animation arrays, fixed IDs/status keys and primitive
  internals are machine/styling contracts, not message text.

## Acceptance limits

Persian is provisional. No native linguistic review, browser/keyboard execution,
complete RTL, calendar/numeral conversion, marketing/legal claim verification,
provider execution or deployment qualification is implied. Existing marketing
claims are translated faithfully, not independently certified by this task.
Production templates render through the real PresentationProvider and next-intl;
controlled hook/prop checks cover showcase callbacks/timer and accordion content.
No build or dev server is required or run. No REST/MCP or database change.

LOC-122, LOC-009 and LOC-002 remain independent integration acceptance tasks.
Pricing/legal and documentation/metadata belong to LOC-127 and LOC-128.
