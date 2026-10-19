# VAT return catalogs - LOC-064

Bounded child of LOC-028. The VAT report route uses 43 paired `VatReturn`
messages (6,238 keys per locale). LOC-028/007/002 retain independent integration
acceptance. Persian terminology is provisional pending native review; this
task does not qualify statutory compliance or complete RTL/browser behavior.

## Authored copy inventory

| Surface | Extracted copy |
|---|---|
| `app/(dashboard)/tax/vat-return/page.tsx` | Document/page title and description; print and tax-period navigation; cash/accrual controls and help; flat-rate switch, placeholder, accessible input name and explanation; comparison and due/refund headings; all-box heading and drill help; calculated badge; loading/empty drilldown; table headings; ICU line-count total; localized report/drill failure feedback |
| `lib/i18n/vat-return-presentation.ts` | Finite mapping from statutory box IDs 1-9 to localized live report labels; unknown IDs retain escaped server labels |

Known live labels correspond to the current `vatReturn` box definitions in
`lib/reports/tax-reports.ts`. Only their presentation changes. Unknown box data
is preserved without constructing message keys. Submitted/frozen period labels
remain in LOC-063's data boundary. Navigation goes to `/tax/periods`, where
existing creation, filing and settlement actions were extracted under LOC-063;
this VAT route has no separate filing mutation or new operation.

Report and drill HTTP, JSON, currency, shape and money-alias failures show
reviewed localized fallbacks. Arbitrary network/parser/server diagnostic prose
is not displayed. Existing cancellation/generation guards, cache behavior and
loading completion remain intact. Locale changes participate in translation
dependencies. Existing error gating continues to disable CSV data and hide the
report; no retry/control redesign is introduced.

## Explicit exceptions and contracts

- Box identifiers 1-9, calculated boxes 3/5, key box 5 and drillable boxes 1/4
  remain canonical. Report data and row ordering, IDs, entry numbers, dates,
  user descriptions/references and account metadata are retained and escaped.
- CSV preserves filename `vat-return`, columns `box/description/amount/currencyCode`,
  original wire labels, canonical integer amount strings and currency codes.
  This machine export is deliberately independent of translated screen labels.
- Exact bigint sums/absolute values, money formatting and bounded visual ratios
  remain unchanged. USD/JPY/IRR/KWD rendering and totals beyond Number's safe
  sum range are tested; this does not enable IRR or introduce FX conversion.
- Basis values remain `accrual/cash`. Dates remain canonical Gregorian values;
  flat-rate text still uses the existing Number/rounding-to-basis-points behavior,
  numeric input type/range/step, and omission when off/nonpositive/nonfinite.
  Numeric example `14.5`, `%`, entry prefix `#` and missing-data dash are retained
  formatting exceptions. No calendar or number-input policy changes are claimed.
- Shared date-range, loader and export controls retain their existing namespaces.
  Internal thrown diagnostics remain internal strings, not display messages.
- Existing no-org loading and period/basis drill-cache semantics are retained.
  This task does not change control-account drilldown reconciliation or turn
  the existing UK/EU report heuristic into Iranian statutory tax functionality.

## REST/MCP boundary

REST GET `/api/v1/reports/vat-return` and `/transactions` retain organization
headers, date/basis/box parameters, optional flat-rate basis points and current
wire shapes. Corresponding `vat_return` and `vat_return_transactions` MCP tools
in `lib/mcp/tools/tax-reports.ts` already use shared report services and scoped
AuthContext/direct DB access. No transport, tool schema, permission, service,
database schema/migration, financial helper, production flag or Stripe file
changes. DEC-008 remains in effect.

## Verification and handoff

Nine catalog test groups cover real React/next-intl/PresentationProvider output,
actual production effects/callbacks with controlled IO, bilingual labels and
plurals, positive/zero/refund values, hostile data escaping, unknown/prototype-like
IDs, print/CSV and query contracts, exact sums, failures, cancellation, cache
and busy/disabled states. Own hook state/effects are controlled: these are not
mounted browser, live REST/MCP/SQL or physical-print tests. See
[attempt](../evidence/LOC-064-attempt-1.md) and
[honest self-review](../evidence/LOC-064-review-1.md).

Remaining tax routes belong to LOC-065. Combined LOC-028/007/002 acceptance,
native financial wording, complete L10N/RTL/keyboard/browser qualification,
hosted CI, printing and statutory/release qualification remain independent.
