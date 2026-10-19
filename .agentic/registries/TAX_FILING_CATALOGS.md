# Remaining tax filing catalogs - LOC-065

Bounded child of LOC-028: BAS, sales tax and Schedule C page bodies. Adds 78
paired messages: 23 `BasReport`, 16 `SalesTaxReport` and 39 `ScheduleCReport`.
Each complete catalog has 6,328 keys. LOC-028/007/002 retain independent combined
acceptance. Persian financial wording is provisional pending native review;
catalog extraction does not qualify statutory compliance or complete RTL.

## Authored copy inventory

| Surface | Extracted copy |
|---|---|
| `app/(dashboard)/tax/bas/page.tsx` | Document/page title, description, print, tax-period navigation, sales/purchases comparison labels, payable/refund summaries and ATO headings, GST and other-obligation section headings, known live field labels and report failure |
| `app/(dashboard)/tax/sales-tax/page.tsx` | Document/page title, description, print, tax-period navigation, summary labels, ICU invoice counts and rate/count sentence, breakdown heading, missing-rate/name fallbacks, taxable amount sentence, total heading and report failure |
| `app/(dashboard)/tax/schedule-c/page.tsx` | Document/page title, description, print, complete worksheet-only notice, comparison labels, profit/loss headings, income/expense section and line-range badges, summary heading, known live subtype labels and report failure |
| `lib/i18n/tax-filing-presentation.ts` | Finite BAS field and Schedule C line ID mappings to presentation keys; unknown IDs retain escaped wire labels |

Known mappings follow the eight current BAS definitions and 21 Schedule C subtype
definitions in `lib/reports/tax-reports.ts`. Machine labels and report data are
not rewritten. BAS NET is summarized by existing due/refund headings rather than
added as a new row. The Schedule C renderer also supports other lines/summary
rows; their unknown labels remain data. No new statutory labels or calculations
are invented for lines the current service does not emit. Caller-authored tax
rate names remain escaped data. No translation keys are constructed from IDs.

All three report effects use reviewed localized fallback messages for HTTP,
JSON, shape, money-alias, currency and network failures. Validation completes
before state adoption, cancellation still suppresses late writes, loading still
finishes and locale participates in effect dependencies. Existing no-org loading
and hidden-report/empty-CSV error gating are retained.

## Explicit exceptions and contracts

- Statutory/report IDs (`G1/G2/G3/G10/G11/1A/1B/NET`, Schedule C line IDs and
  section numerals I/II, Form 1040), GST/BAS/ATO/IRS identifiers and the BAS
  `G1-G11, 1A-1B` range remain canonical. Translated Schedule C range badges and
  profit/loss messages retain the existing ASCII statutory line numbers.
- Known live report labels are translated only on screen. Unknown labels, tax
  rate names and all caller data remain escaped. Frozen tax periods and settlement
  history belong to LOC-063 and remain unchanged.
- CSV retains filenames `bas`, `sales-tax`, `schedule-c-{year}` and columns:
  `field/description/amount/currencyCode`,
  `taxRate/ratePercent/taxableAmount/taxCollected/invoiceCount/currencyCode`,
  `line/description/amount/currencyCode`. Original wire descriptions, sales-tax
  `Exempt` machine fallback, integer amount strings, numeric counts, decimal
  percentage strings, empty missing percentage and currency codes remain intact.
- Dates stay canonical Gregorian strings; start/end defaults and Schedule C's
  full-year end default remain unchanged. Existing rate display uses basis points
  divided by 100 with two decimals and `%`; no numeral/input/calendar policy
  change is claimed. Invoice prose now uses ICU plurals in both locales.
- Exact bigint arithmetic, signs, absolute-value hero displays, zero expense
  dash/dimming, classifications, row order and bounded visual ratios remain
  intact. USD/JPY/IRR/KWD output and an aggregate of 9007199254740993 minor units
  are tested; synthetic IRR rendering does not enable production IRR.
- Shared date-range, export and loader controls already own their catalogs.
  Print remains `window.print()`. Internal thrown diagnostics are internal,
  never display prose. No redesign or new filing action is introduced.

## REST/MCP boundary

GET `/api/v1/reports/bas`, `/sales-tax` and `/schedule-c` retain date queries,
`x-organization-id` headers and existing numeric/Minor wire contracts. Existing
`bas`, `sales_tax` and `schedule_c` MCP registrations in
`lib/mcp/tools/tax-reports.ts` use the shared `getTaxReport` service with scoped
AuthContext and direct DB access. These were inspected and remain unchanged.
No new user operation or REST/MCP/tool schema change, database schema/migration,
financial helper, flag or Stripe change is part of this task. DEC-008 applies.

## Verification and handoff

Eight new test groups execute production templates/effects/callbacks with
controlled own state and IO, real React/next-intl/PresentationProvider and real
shared controls. They cover bilingual copy, plurals 0/1/2/12, known and hostile
unknown IDs, escaping, exact money, profit/loss/refunds/zero, loading/empty/error,
print/date/CSV contracts, org/date queries, failures, no-org and cancellation.
See [attempt](../evidence/LOC-065-attempt-1.md) and
[honest self-review](../evidence/LOC-065-review-1.md) for actual gate results.

Own hooks and IO are controlled; browser mounting, visual RTL, physical print,
live REST/MCP/SQL, native financial wording, statutory accounting, hosted CI,
deployment and release qualification are separate. LOC-028/007/002 remain open
for their independent acceptance; finishing this child does not complete them.
