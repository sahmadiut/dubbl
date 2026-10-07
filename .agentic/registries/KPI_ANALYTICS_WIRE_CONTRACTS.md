# MON-115 expense and KPI analytics contracts

Implemented 2026-10-08. These are read-only compatible contracts, not production
IRR or independent accounting qualification. MON-104 and MON-029 retain integration.

## Boundaries and inputs

| REST GET `/api/v1/reports/` | MCP operation | Inputs and defaults | Outputs |
|---|---|---|---|
| `expense-analytics` | `expense_analytics` | Inclusive Gregorian startDate/endDate; UTC January 1 through today | Ranked categories, distinct posted transaction counts, percentage shares, totalExpenses, monthlyAverage and monthlyTrend |
| `monthly-trends` | `monthly_trends` | Integer months 1-24, default 6 | Zero-filled UTC calendar months, revenue/expenses/netIncome, corresponding sparkline arrays |
| `executive-summary` | `executive_summary` | Inclusive dates as expense; basis accrual/cash, default accrual | Seven KPIs, equal-length immediately preceding priorPeriod, currencyCode and basis |
| `executive-summary?format=pdf/xlsx` | `export_executive_summary` | Same dates/basis, format required for MCP | REST binary or MCP base64 data, encoding, filename, MIME type |
| `profitability?groupBy=contact` | `contact_profitability` | Inclusive dates; optional supported uppercase currencyCode; REST groupBy contact by default | Invoice-driven contact entries ranked by profit, counts, margins, totalRevenue/totalCosts/totalProfit/overallMargin |

The existing `groupBy=project` branch and `get_project_profitability` retain
MON-094's service/contracts; no duplicate implementation. GET routes reject
unsupported/duplicate parameters, empty/malformed dates, reversed ranges,
unsupported currencies, fractional/partial/zero/negative/over-24 months and
unsupported enums/formats with 400. MCP validates described strict Zod schemas
and returns errors through wrapTool. Executive comparison dates must also remain
within Gregorian years 0001-9999; earliest dates without a representable prior
period reject. No amount inputs or exact-only/header negotiation is introduced.

## Money, aliases and ranges

Numeric amounts retain stored integer cents without FX or unit rescaling.
Every exposed numeric amount has a canonical signed decimal string alias:

- Expense root totalExpensesMinor/monthlyAverageMinor; category and month totalMinor.
- Monthly revenueMinor/expensesMinor/netIncomeMinor and aligned
  revenueSparklineMinor/expenseSparklineMinor/netIncomeSparklineMinor arrays.
- Executive KPI currentMinor/priorMinor/deltaMinor.
- Contact row revenueMinor/costsMinor/profitMinor and root
  totalRevenueMinor/totalCostsMinor/totalProfitMinor.

Compatibility output range is +/-9007199254740991, including derived differences,
categories, monthly cells, roots and deltas. No public full-int64 capability is
advertised. Ledger source columns are signed int64; SQL numeric sums use `::text`
and bigint, including intermediates above int64, until each exposed result narrows.
Document source totals/amountDue individually require the safe numeric range;
text projections reject unsupported saved values before aggregation. Bigint never
reaches generic JSON. Unsupported source/currency/output or lossy export values
produce 422 LEGACY_NUMERIC_RANGE through REST/MCP adapters.

Counts, percentages and months remain numbers in their own units. Shares/margins
round exact bigint ratios to two percentage places, with Math.round-compatible
negative ties toward positive infinity; expense average rounds to integer cents
over months with activity (not zero-filled elapsed months). KPI deltaPercent uses
absolute prior as divisor and null for zero prior. Nonpositive share/margin
divisors retain zero. Exposed rounded percentage integers also require the safe
numeric range before division by 100.

## Selection, currencies and isolation

Every operation requires view:data and authenticated organization scope. Each
service call uses one repeatable-read read-only Drizzle transaction. Organization
metadata missing returns 404, denied permissions 403 and invalid REST API keys 401.
Queries never use caller-supplied organization selectors to override AuthContext.

Ledger queries scope both journal and chart account organization, use posted
non-deleted journals and inclusive dates. Expense/monthly are accrual. Cash executive
uses the shared payment/bank-source or bank-line heuristic; it does not reconstruct
payment allocations. Ledger currencyCode is the validated organization base currency.
Monthly selects complete UTC months including the current month through month-end,
including scheduled posted activity, and excludes later months. Blank months are zero.

Executive AR/AP retain current stored amountDue on live non-draft/non-void documents
issued by each cutoff, regardless of basis. This is a current outstanding snapshot
filtered by issue date, not a historical settlement reconstruction. Eligible documents
must use organization currency; mixed/foreign currency rejects without implicit FX.
Gross profit subtracts expense accounts whose subType is cogs; cash includes asset bank.

Contact profitability excludes draft/void/deleted documents. Invoice contacts drive
entries and root totals; bills for contacts with no invoices remain excluded from
those totals, preserving the existing behavior. All selected documents participate
in currency validation. Mixed currencies reject unless currencyCode selects one;
an empty report uses the filter or organization currency. Same-tenant live contact
labels are joined separately; foreign/deleted contacts display Unknown without
leaking names. Exact comparisons plus contact/account ID break ranking ties.

## Exports and dashboard consumers

Executive PDF/XLSX consume the same validated statement and currency as JSON/MCP.
Exports display stored cents with currency metadata scales (USD 2, IRR/JPY 0, KWD 3),
without changing JSON units. Shared XLSX cell validation rejects decimal round-trip
loss or more than Excel's 15 significant digits; PDF uses exact money text.

Expense, executive and contact pages surface HTTP errors with role=alert and hide
failed report data. Existing exact statementMoneyText formats safe integers using
returned currencyCode. Contact provides a document currency selector and clear
action. Expense chart coordinates are approximate display Numbers in currency
major units; tooltip reads the original safe integer through exact formatting.
No charts/percentages feed ledger math. Browser/session/OAuth visual verification
has not been performed; no build or dev server was started.

## Evidence

`tests/kpi-analytics-wire.test.ts` verifies UTC leap/month/prior boundaries, query
syntax/cardinality/ranges and signed rational ties. Migrated disposable PostgreSQL
REST/API-key and MCP SDK fixtures in `tests/integration/kpi-analytics.test.ts` and
worker cover legacy/exact document-writer clients, parity/defaults, both bases,
AR/AP cutoffs, category counts, invoice-driven contact selection, foreign references,
tenant/auth failures, four currencies, actual PDF/XLSX/base64 exports, signed safe
edges, source/root/net/delta overflow, SQL cancellation above int64 and unchanged
domain/audit snapshots. Adjacent compound and project billing fixtures verify reuse.
Independent accounting, performance/full-range, localization and release gates remain.
