# Combined reporting catalog acceptance - LOC-070

2026-10-23 (Asia/Tehran). Independent integration acceptance after LOC-103..114;
LOC-008/002, native financial terminology, full RTL/calendar/numeral, output and
release qualification remain separate. Persian wording is provisional.

## Complete source and catalog inventory

The reporting directory contains exactly 34 TSX components. Fourteen namespaces
contain 654 paired messages; the complete catalogs contain 9,430 compatible keys
per locale. All 654 Persian values contain Persian script; this is not linguistic
approval. The combined test pins the complete inventory with exactly one owner
per component and audits authored JSX, display attributes, toasts and titles.
Child rendering/callback tests and current source/registries complement this
source check, including finite dynamic labels and failure paths.

| Child / namespace | Messages | Components relative to reports/ |
|---|---:|---|
| [LOC-103](REPORT_DIRECTORY_CATALOGS.md) / ReportDirectory, ReportNavigation | 73 + 6 | page.tsx, loading.tsx, _components.tsx |
| [LOC-104](INCOME_REPORT_CATALOGS.md) / IncomeReports | 38 | profit-and-loss, income-statement, executive-summary |
| [LOC-105](BALANCE_CASH_REPORT_CATALOGS.md) / BalanceCashReports | 49 | balance-sheet, comparative-balance-sheet, cash-flow |
| [LOC-106](LEDGER_REPORT_CATALOGS.md) / LedgerReports | 39 | trial-balance, general-ledger |
| [LOC-107](AGING_VENDOR_REPORT_CATALOGS.md) / AgingVendorReports | 59 | aged-receivables, aged-payables, payment-performance, vendor-spend, duplicate-detection |
| [LOC-108](ANALYTICAL_REPORT_CATALOGS.md) / AnalyticalReports | 100 | tracking, budget-vs-actual, expense-analytics, profitability, pnl-comparison, financial-ratios; shared BudgetProgressBar |
| [LOC-109](FORECAST_CALENDAR_CATALOGS.md) / ForecastCalendarReports | 39 | cash-flow-forecast, financial-calendar |
| [LOC-110](TAX_REPORT_CATALOGS.md) / TaxReports | 64 | 1099, tax-summary, vat-return |
| [LOC-111](BANKING_REPORT_CATALOGS.md) / BankingReports | 34 | bank-cash-flow, bank-reconciliation-status |
| [LOC-112](CUSTOM_REPORT_CATALOGS.md) / CustomReports | 50 | saved, custom |
| [LOC-113](SCHEDULED_REPORT_CATALOGS.md) / ScheduledReports | 52 | schedules |
| [LOC-114](CONSOLIDATION_PACK_CATALOGS.md) / ConsolidationReports, ReportPack | 37 + 14 | consolidation, pack |

Named directories own their page.tsx. No production source/catalog change was
needed for this combined acceptance. Earlier child records retain their historical
open-parent wording; this record supplies the subsequent LOC-070 acceptance.

## Explicit exceptions and shared ownership

- Saved/caller account, contact, document, budget, project, department, group,
  business and report names, descriptions, numbers, codes, tax IDs, addresses,
  recipients, labels and custom-result values remain escaped data. Known finite
  types/statuses/KPIs use reviewed display maps; unknown values remain data.
  Tracking translates only validated section IDs and its null dimension label,
  preserving a caller department named Revenue or Expenses.
- API calendar titles are opaque data, including existing missing-contact
  Customer/Supplier fallback prose. Statutory VAT official labels are supplied
  data and remain verbatim. Unknown account types/custom columns/source IDs,
  schedule frequency/format fallbacks and English prior comparative period
  labels are explicit data/output/format exceptions; do not infer their
  translation from authored JSX extraction.
- IDs, URLs, organization headers/storage keys, query/payload names, methods,
  enum values, canonical Gregorian dates, UTC instants and period labels remain
  unchanged. Statutory 1099/VAT identifiers and concepts retain their meaning;
  this work does not introduce Iranian statutory reporting compliance.
- Schedule weekday 0..6, month day 1..28, HH:MM, frequency and format values,
  comma-separated recipient syntax and the example placeholder
  `name@example.com, another@example.com` remain machine/email syntax. Existing
  schedule first-page pagination, list-fetch failure handling, banking picker
  failures and consolidation group-management failure behavior remain unchanged.
- Currency codes, numeric counts, ratios/percentages, Gregorian years/day
  numerals, signs, punctuation, dashes, English/runtime month/date formatting
  and abbreviated chart-axis geometry retain existing presentation. Calendar,
  numeral, timezone, mixed-text and full RTL qualification remain separate.
- Shared BackToReports/BasisToggle use ReportNavigation; BrandLoader, error,
  export, date/currency/select, table, dialog and confirmation controls retain
  their existing namespaces. Duplicate invoice/bill statuses reuse existing
  SalesInvoices/SupplierBills maps. BudgetProgressBar uses AnalyticalReports.
- Exact Minor strings, bigint sums, report readers, legacy compatible numeric
  aliases, FX snapshots, scales and fixed-two budget values remain unchanged.
  Locales never select currencies or combine unlike currency totals. Charts
  retain exact bigint tooltip carriers selected by stable dataKey values;
  approximate chart coordinates do not become ledger amounts.

## Output and error ownership

| Surface | Accepted boundary and remaining ownership |
|---|---|
| Client CSV exports | Visible actions/errors use SharedUI; machine headers/order, raw Minor strings, fixed section tokens such as Money in/Money out, bucket/period values, filenames and caller data remain export contracts |
| Banking status CSV | Existing exact major decimal strings use each account currency scale; bank cash-flow CSV retains raw minor units |
| Consolidation CSV | Raw-unit strings and entity label/ID column keys remain unchanged |
| PDF/XLSX statement, tracking, executive and pack links | UI actions/period/help are catalogued; routes, query values, sheet/cell/data contracts and document templates remain unchanged. LOC-009 and later output/native/RTL qualification retain output-copy ownership |
| Custom/saved CSV and generated reports | Source/column IDs, saved configuration and result data remain machine/caller values; UI run errors use finite catalog feedback |
| Scheduled delivery | Catalogued controls preserve report IDs, recipients, day/time/format values and existing registered service operations; mail/output contents retain separate output scope |
| Report read/run/create failures | Owned UI boundaries map HTTP/network/parser/malformed-money failures to reviewed finite messages, without rendering raw private diagnostics; request cancellation/stale guards remain. Existing management/list behavior above is preserved |

No backend diagnostic translation or native PDF/mail/workbook layout approval is
claimed. No new user operation was introduced; existing report, custom report,
schedule and consolidation tools retain AuthContext, wrapTool and direct scoped
services. REST/MCP/schema/migrations, financial history, IRR flags and Stripe are
unchanged.

## Combined verification and limits

[Combined tests](../../tests/report-catalog-integration.test.ts) use production
page JSX, real shared controls and next-intl/PresentationProvider with controlled
page hooks and IO. One checked exact income/P&L amount feeds both pages across
USD/JPY/KWD and both locales; caller text stays escaped, rendered money agrees,
CSV bytes agree, and pack/P&L share canonical date/basis callbacks. Failed reads
hide stale data; malformed money cannot enter page state. Child suites cover
all routes, chart tooltips, calendar navigation, selectors, schedules and exports.
This is composition/behavior evidence, not a mounted-browser/keyboard test.

Current migrated disposable PostgreSQL runs verify actual REST handlers, linked
registered MCP calls and independent SQL assertions for combined financial,
operational, auxiliary/dashboard, budget, forecast, tax, custom/saved, schedule
and consolidation workflows. Financial tests additionally check pack workbook
content, scoped authorization, posted history and transport parity. Their
financial assertions complement UI tests; no whole-product qualification is
inferred. See [actual results](../evidence/LOC-070-attempt-1.md) and
[Codex self-review](../evidence/LOC-070-review-1.md).

LOC-008/002 and native terminology, full RTL/calendar/numeral/currency formatting,
remaining output localization, browser/keyboard, hosted CI, deployment and
production qualification remain independent. No full build or dev server was run.
