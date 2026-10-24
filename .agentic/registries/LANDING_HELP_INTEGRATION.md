# Landing/help combined catalog acceptance (LOC-122)

The independent parent accepts the combined source at 118743ba plus its two
new production-composition checks. No application change or new message is
needed: the four child implementations already compose correctly.

## Owned surface and exception inventory

- Landing shell/conversion: 78 LandingShell messages; see
  [LANDING_SHELL_CATALOGS.md](LANDING_SHELL_CATALOGS.md).
- Eight landing feature/demo/FAQ components: 283 LandingFeatures messages; see
  [LANDING_FEATURE_CATALOGS.md](LANDING_FEATURE_CATALOGS.md).
- Pricing, privacy, terms and shared legal chrome: 268 PublicPricingLegal
  messages; see [PRICING_LEGAL_CATALOGS.md](PRICING_LEGAL_CATALOGS.md).
- Root/legal metadata and documentation chrome: 22 PublicMetadata messages and
  11 new Docs messages, retaining its existing navigation keys; see
  [DOCS_METADATA_CATALOGS.md](DOCS_METADATA_CATALOGS.md).

The four inventories remain the detailed exception record. Brand/company/legal
facts, opaque demonstration money/dates/IDs, code/terminal examples, SEO/assets,
URLs, pricing model values and frozen Stripe passages remain fixed. MDX content
continues in the existing paired bilingual source, outside JSON catalogs.
Gradient/activity helpers and layout/home composition add no display literals.
No REST/MCP/schema, authorization, currency, financial policy, provider or
request-preference change is necessary. No new user operation is introduced.

## Independent combined checks

tests/landing-help-integration.test.ts renders the actual Home, PricingPage,
PrivacyPage and TermsPage inside the actual LandingLayout and root server
layout. The actual PresentationProvider/next-intl catalog instance is shared
with all children. Request/font I/O, unrelated theme/auth and Fumadocs provider
boundaries are controlled. Both locales retain one main/footer, localized shell
and page content, matching metadata locale, invariant links/SVG data, unchanged
demo values, frozen Stripe/legal facts and nine accessible collapsed FAQ
triggers, with no rendering diagnostics. A second check verifies every docs
destination rendered by home against both English and Persian MDX source paths.

The sibling production tests additionally execute docs locale selection,
metadata, missing-page/static-param paths, Fumadocs labels, pricing intervals,
legal TOC behavior, showcase state/timers, FAQ content and shell navigation.
They remain necessary; source existence is not MDX execution. No network,
linked asset availability, mounted hydration or browser coverage is inferred.

Existing route/anchor contracts are preserved, not comprehensively certified:
the pre-existing footer /#integrations link has no matching section ID in the
current home composition. This is outside display extraction and unchanged.

## Remaining gates

Persian wording, including legal and financial terminology, is provisional.
Native linguistic/legal review, full RTL, keyboard/browser, numeral/calendar,
marketing claim, crawler, hosted-CI, deployment and production qualification
remain outside this parent. LOC-009 and LOC-002 require independent combined
acceptance. Later L10N/RTL tasks retain their own mandatory qualification gates.
