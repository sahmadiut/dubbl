# Landing shell / conversion catalog inventory (LOC-125)

LandingShell owns 78 paired messages across navbar, footer, hero, cta-section and
trust-bar. The landing layout/home composition is unchanged. Hero headings use
the approved em rich tag, rendered by reviewed component code. Routes and anchors
remain fixed; the mobile menu's existing state/close callbacks are retained.

## Intentional exceptions

- The footer's Stripe Integration label and /docs/guides/stripe-integration
  destination remain unchanged under DEC-008. No Stripe work is performed.
- dubbl, GitHub, X, Next.js, PostgreSQL, TypeScript, Drizzle ORM, REST API,
  Apache 2.0/Apache-2.0, company name/number/address, URLs and SVG/code literals
  remain identifiers. Company registration prose is translated around its facts.
- Demo amounts ($48,250, +$12,500, -$240, +$5,000, $4,200, $240), percentages,
  counts, invoice/journal IDs, Dec 2025 and POST /v1/transactions are opaque sample
  values. Display prose around them is translated; no ledger amounts are read or
  reinterpreted. The git clone example remains literal terminal text.
- Copyright keeps its original 2026 value; no date or calendar behavior changes.
- Chart paths, numeric animation data, CSS, UI primitive internals and brand
  icon names are unchanged. Existing shared primitives retain their own catalogs.
- TrustBar is cataloged even though the current home page does not mount it.

## Parent scope retained

LOC-122 was split into LOC-125 shell/conversion, LOC-126 feature/demo/FAQ content,
LOC-127 pricing/legal and LOC-128 docs chrome/public metadata after inspection of
13 landing components and pricing/legal/docs surfaces. Only LOC-125 is accepted
in this delivery. LOC-122/LOC-009/LOC-002 retain independent integration gates.
Existing MDX bodies remain under their bilingual content system, not copied into
JSON messages. Untranslated sibling surfaces are tracked by their own tasks.

Persian is provisional. Native review, browser/keyboard, complete RTL, translated
calendar/numerals, legal/marketing claim review and hosted/deployment qualification
are not implied by catalog extraction or controlled rendering tests.
