# Combined tax catalog acceptance (LOC-028)

LOC-028 independently accepts the combined tax extraction from LOC-061..065.
Eight namespaces contain 345 paired messages: TaxRates (64), TaxNavigation (7),
TaxCurrencies (60), TaxPeriods (93), VatReturn (43), BasReport (23),
SalesTaxReport (16) and ScheduleCReport (39). Complete catalogs retain 6,328
keys per locale. Persian wording remains provisional pending native review.

## Current inventory and explicit exceptions

The complete route inventory is relative to `app/(dashboard)/tax/`:

| Surface | Authored display copy and ownership |
|---|---|
| `layout.tsx`, `page.tsx` | [Rate/navigation inventory](TAX_RATE_CATALOGS.md): base/country-specific tabs, badge, rate list, quick profile setup, compound editor and create/edit sheets. |
| `currencies/page.tsx` | [Currency inventory](CURRENCY_WORKSPACE_CATALOGS.md): currency/rate lists, both creation sheets, reference search, source labels, exact FX report and outcomes. |
| `periods/page.tsx`, `periods/[id]/page.tsx` | [Period inventory](TAX_PERIOD_CATALOGS.md): list/detail, urgency/plurals, creation, filing, frozen boxes and settlement. |
| `components/dashboard/tax-settlement-preview.tsx` | [Period inventory](TAX_PERIOD_CATALOGS.md): exact amount sentence and blank/invalid feedback. Path is repository-relative. |
| `vat-return/page.tsx` | [VAT inventory](VAT_RETURN_CATALOGS.md): basis/flat-rate controls, live boxes, comparisons, drilldown and failures. |
| `bas/page.tsx`, `sales-tax/page.tsx`, `schedule-c/page.tsx` | [Remaining filing inventory](TAX_FILING_CATALOGS.md): summaries, live field/line labels, worksheet notice, counts and outcomes. |

The nine route files and shared preview contain no unexplained authored English
JSX, visible literal attributes or document-title literals. Retained text is
numeric input syntax (`0.00`, `10.00`, `100`, `1.234567`), `%`, `#` and the BAS
technical range `G1-G11, 1A-1B`. Child inventories document expression-level
exceptions, technical names and machine CSV labels separately.

Caller/reference currency and country names, tax/component names, unknown live
report labels, dates, account metadata, references, notes, descriptions and frozen
period labels remain escaped data. Known live statutory IDs map to finite
presentation keys; unknown IDs are never used to construct catalog keys.
Submitted history is not rewritten. Existing host/en-US date rendering, raw
counts/badges, currency/rate formatting, numeric input policies, signs and
punctuation are explicit later L10N/number/date-adapter work.

Tax rates/recovery remain integer basis points; rates remain exact decimal FX
with explicit quote direction. Monetary values retain canonical integer Minor
strings, matching legacy aliases, safe-carrier validation, bigint derived sums,
currency-specific scales and existing rounding. No units are rescaled. Country
eligibility, statutory IDs, report classifications, frozen lines, filing/settlement
behavior, IRR flags, permissions and organization scope remain intact. Translating
existing UK/EU/AU/US report prose does not qualify Iranian statutory compliance.

## Independent combined verification

[Combined tests](../../tests/tax-catalog-integration.test.ts) compose all eight
actual page templates beneath the actual tax layout and TabLayout, with React,
next-intl and PresentationProvider. Both locales cover zero, negative and
9,007,199,254,740,991 minor units across USD/JPY/KWD. Assertions check translated
page/navigation copy, exactly one active tab, canonical URLs, GB/AU/US filing
eligibility, IR base navigation, hidden detail tabs, escaped caller data and
currency-aware exact amounts. The real settlement preview shares the same
provider and renders exact USD/JPY/KWD input plus blank/invalid feedback.

A recursive AST guard pins all nine routes and shared preview, rejects unexplained
authored JSX/visible attributes/title literals, reconciles eight namespace schemas
and checks Persian script. Five existing child suites run together against current
source: all current EU/country branches, loading/empty/error states, statutory
labels, ICU counts, real shared controls, portal option values, production callback
bodies, exact payloads/aliases, retry/busy cleanup, HTTP/JSON/shape/network failures,
cancellation, print and machine CSV behavior remain checked.

Composition controls local hook state/effects, navigation and sheet portals.
It is SSR verification, not mounted-browser, keyboard, layout or physical-print
qualification. Existing child callback tests control IO; actual transport checks
are separate migrated PostgreSQL suites exercising authenticated REST handlers,
registered MCP SDK calls and independent SQL assertions for rates/profiles,
period filing/settlement/rollback, reports, tax UI money, FX and forecast/FX.
Explicit loopback TEST_DATABASE_URL targets a dedicated temporary cluster;
fixtures create/migrate/drop randomized databases, leaving the application DB
untouched.

## Operations and handoff

No production source/catalog, service, API/MCP, money helper, schema/migration,
rollout flag or Stripe change is needed for this acceptance. Existing direct-DB,
org-scoped rate/profile, currency/rate list, exchange-rate creation, unrealized FX,
period CRUD/file/settlement and VAT/BAS/sales-tax/Schedule C tools remain intact.
No new user operation or REST route is introduced.

Full MCP parity is not claimed: global `/api/currencies` POST still has no matching
MCP creation tool, as documented by LOC-062. This pre-existing gap remains recorded
for broader acceptance; catalog acceptance does not imply it was repaired.

LOC-007/002 retain independent combined acceptance. Native terminology, complete
RTL/font/keyboard/browser qualification, number/date/input adapters, statutory
accounting acceptance, physical printing, hosted CI, live providers, production
migration/deployment and IRR enablement remain separate. Stripe is preserved under
DEC-008. No full build, dev server, Docker or deployment was run.

See [attempt evidence](../evidence/LOC-028-attempt-1.md) and
[honest self-review](../evidence/LOC-028-review-1.md).
