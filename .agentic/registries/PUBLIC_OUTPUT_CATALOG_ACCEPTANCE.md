# Public, document and background catalog acceptance - LOC-009

Independent source audit and combined acceptance: 2026-10-24, Codex.
Child status was not used as evidence of parent integration. Existing production
implementations satisfy this bounded extraction scope; no new product operation,
translation rewrite, schema, REST/MCP contract or Stripe change is required.

## Combined ownership and exceptions

| Surface | Catalog / source owner | Explicit boundaries |
|---|---|---|
| Public invoice signing SSR and canvas | 23 PublicSigning keys; [inventory](PUBLIC_SIGNING_CATALOGS.md) | Frozen names, numbers, exact formatted money and dates stay data. HTTP/network/JSON failures use reviewed messages. Next notFound remains shared. |
| Portal layout, overview, invoices, quotes, payments and statements | 57 PublicPortal keys; [inventory](PUBLIC_PORTAL_CATALOGS.md) | Status presentation is localized; enums, routes, download names, identifiers, money aliases and authorization stay machine contracts. |
| Public payment checkout | Existing app/pay flow | Entire Stripe flow remains frozen by DEC-008, including existing prose. It does not block catalog acceptance. No dedicated Stripe work is performed. |
| Landing, pricing/legal and help metadata/navigation | 662 added paired keys across LandingShell, LandingFeatures, PublicPricingLegal, PublicMetadata and Docs; [combined inventory](LANDING_HELP_INTEGRATION.md) | Paired MDX sources retain existing content; legal identity/facts, sample financial data/code, brands, URLs and fixed pricing remain explicit exceptions. Existing /#integrations target exception is retained. |
| Email templates/layout, document email and HTML/PDF labels | 124 Output keys; [inventory](OUTPUT_CATALOGS.md) | Internal explicit-locale email/HTML hooks work in both languages. Existing send callers stay English. PDF remains English pending font/shaping qualification. Caller templates, historical snapshots and statutory acronyms stay data. |
| Notifications, alerts, report/remittance/statement delivery and export labels | 61 Background keys; [residual inventory](BACKGROUND_CATALOGS.md) | Existing workers use English. Saved notification bodies/rules, report machine labels, diagnostic/provider output and Trigger dispatch contracts remain unchanged. |

These 927 extracted keys complement prior catalogs and existing bilingual MDX;
the complete validated catalog currently contains 10,587 paired keys per locale.
This count is extraction coverage, not native linguistic or whole-product Persian
qualification. Source audit inspected the actual signing/portal pages, explicit
output/background translators, email/document renderers, delivery services and
Trigger dispatcher against these inventories. No additional owned prose was found
outside the recorded catalog/data/machine/provider boundaries.

## Independent composition

`tests/public-output-catalog-integration.test.ts` composes an independently built
invoice fixture through the real portal wire reader, actual portal layout/list
JSX, signing SSR, document HTML renderer, document email and notification digest.
Both locales are interleaved to detect shared translator state. USD/JPY/KWD/IRR
and the safe-integer boundary retain exact money text, frozen document numbers,
Gregorian dates, escaped caller text, navigation and token paths. Rendering must
not mutate the wire data or emit translation/context/markup diagnostics. A Persian
render must not change subsequent default-English email or worker output.
The production client fetch effect also rejects disagreeing financial aliases,
clears loading and shows the locale's reviewed error without adopting invalid rows.

React state/effects, Next request/navigation I/O and signing service data are
controlled in this component harness; real next-intl/provider and renderers run.
This is not browser hydration, touch/canvas or recipient-language delivery proof.
The existing landing/root composition and focused child behavior tests are rerun.
Migrated disposable PostgreSQL suites independently exercise real signing,
portal/document REST, registered MCP, alerts, report delivery, statements,
recurrence and remittance with independent SQL assertions and controlled outbound
providers. No application database or live delivery provider is used.

## Retained qualification

All Persian wording remains provisional. LOC-002 retains independent combined
acceptance. Later L10N/RTL/native/output tasks retain terminology, complete Persian
workflows, recipient locale delivery, calendar/numerals, keyboard/hydration,
email-client layout and Persian PDF shaping/pagination qualification. UTC database
tests do not accept the known Tehran-day deduplication boundary. No build, dev
server, human/native approval, hosted CI, deployment or production readiness is
claimed. IRR financial and production activation flags are unchanged.
