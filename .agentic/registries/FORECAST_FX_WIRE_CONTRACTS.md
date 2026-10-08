# MON-116 cash forecast and unrealized FX wire contracts

2026-10-08, Asia/Tehran. Bounded child of MON-104. Technical self-review only;
parent integration and independent financial/release qualification remain open.

## Operations and inputs

| REST GET /api/v1/reports/... | MCP tool | Input | Output |
|---|---|---|---|
| cash-flow-forecast | cash_flow_forecast | Optional weeks: integer 1-52, default 12; optional supported uppercase currencyCode | currencyCode, forecastPeriod, projectionBasis, totals, weekly buckets and entries |
| unrealized-gains-losses | unrealized_gains_losses | No parameters | defaultCurrency, asOf, rateDirection, items, summary |

REST weeks uses canonical ASCII positive integer syntax, with no coercion/truncation
of decimals, exponents, blank values, trailing characters or leading zeroes. MCP
uses a numeric integer. Both reject unknown fields and duplicate REST parameters.
No date override, representation header, format/export or full-int64 mode is offered.
Both require authenticated org scope and view:data; missing organizations return 404.
Input failures are 400; unsupported saved values/results/rates are 422 with
LEGACY_NUMERIC_RANGE. MCP uses wrapTool and the same service/schema/serializer.

## Money and supported ranges

Existing integers retain their units and signs, conventionally called cents by
the document contracts (USD 1250 remains 1250). No currency/locale/magnitude-driven
storage rescaling. Every emitted monetary value remains a numeric safe integer
with a matching canonical signed decimal string named fieldMinor. Absolute source,
exposed line/subtotal and final amount limit is 9007199254740991. Bigint arithmetic
and SQL text projections prevent transitional Number ORM loss. Intermediates may
exceed Number/int64 bounds; exposed results are checked before response serialization.
No bigint reaches ordinary JSON, and an unsafe value is never repaired as a string.

| Report | Numeric money fields with matching Minor strings |
|---|---|
| Forecast root | totalInflows, totalOutflows, netForecast |
| Forecast week | inflows, outflows, net, cumulativeNet |
| Forecast entry | amount (signed) |
| FX item | amountDue, originalAmountBase, currentAmountBase, unrealizedGainLoss |
| FX summary | totalUnrealizedGain, totalUnrealizedLoss, netUnrealizedGainLoss |

Nullable FX money fields have null numeric and Minor values together. Counts,
weeks, entryCount, totalItems and missingRateItems remain ordinary integers.
Recurring quantity retains hundredths (100 = one unit), not monetary aliases.
Rates originalRate/currentRate are positive int32 millionths, 1000000 = 1. Their
originalRateExact/currentRateExact companions are canonical positive decimal strings
in quote_per_base direction: base currency units per document currency unit.
This report deliberately rejects quotes/reciprocals not exactly representable in
legacy millionths, including repeating inverse quotes. Exact rates are never silently
rounded to a compatibility alias; source compatibility integers are not used for math.

## Forecast selection and calendar

- Inclusive today UTC through today plus weeks times seven UTC days. Weekly buckets
  start on Sunday UTC and include every intersecting partial week; the array therefore
  has weeks + 1 buckets. forecastPeriod.weeks retains the requested horizon. Each
  entry is assigned to its actual Sunday; sum of bucket flows equals root totals and
  the last cumulativeNet equals netForecast. All dates are canonical Gregorian strings.
- Live invoices/bills exclude draft, void and paid and are selected by due date;
  overdue items remain excluded. Receivables are positive, payables negated; refunds
  keep their stored signs. Foreign/deleted contact labels are not exposed.
- Active live invoice/bill/expense recurring templates only; journals are excluded.
  Only templates producing an occurrence in the horizon affect currency selection.
  End date, generated count and maximum occurrences are respected; overdue runs
  consume slots while advancing but are not forecast entries. All frequencies reuse
  the generator's UTC advance helper, including legacy month overflow. At most 10000
  schedule advances per template; larger backlogs fail explicitly rather than truncate.
- Projected recurring amount preserves the existing line-subtotal estimate: sum of
  rounded quantity times unitPrice divided by 100 before tax/discount. Each line
  uses exact Math.round-equivalent rounding (negative ties toward positive infinity).
  Bill/expense subtotal is negated; expenses retain recurring_bill classification.
  projectionBasis states this estimate; no exact tax-inclusive generation is promised.
- Mixed contributing document currencies require currencyCode; no implicit FX sum.
  A filter selects that currency even for empty results. An unfiltered empty result
  uses the organization currency, and a single currency uses its contributing code.

## Unrealized FX estimate

Current live outstanding foreign invoices/bills exclude draft/void/paid. This is an
estimate on today's amountDue, using organization rate-table quotes at issue date
and today; it does not reconstruct historical settlements or use original posted
transaction FX. Issue-date historical rate replacement therefore changes this estimate.
The response exposes asOf and the page describes the estimate.

Latest direct pair on/before each date takes precedence; inverse lookup only occurs
when there is no direct row. Pending/quarantined/missing or unsupported-version/
direction metadata yields unavailable rates, without an older/identity/provider fallback.
Missing either quote leaves both base amounts and gain/loss null, increments
missingRateItems and excludes that item from totals. An available quote outside the
supported rate range fails 422 instead of pretending to be missing. Resolved quotes
and monetary products use exact decimal/rational math with legacy Math.round tie
behavior; receivable change is current minus original, liability change is inverted.
Gains are positive and losses remain negative; net is gain plus loss.

## Runtime, UI and verification limits

Both services run organization-scoped repeatable-read, read-only transactions, with
per-report rate caching only. No financial/audit writes, generation, posting, lock
changes, provider calls, or schema changes. API-key lastUsedAt authentication
bookkeeping is excluded from read-only financial assertions.

Forecast page offers the currency filter and reports failures instead of displaying
zeroes as a success. Both pages use existing exact currency-aware display formatting.
Chart geometry/axis ticks are approximate display coordinates only; chart tooltips,
tables and cards format original safe integers. FX page exposes missing-rate counts
and errors. No build, dev server, browser/session/OAuth, visual screenshot, large-volume,
full-range, independent financial or production/IRR qualification is claimed.

Actual API-key REST handlers and registered MCP SDK clients are covered by
tests/integration/forecast-fx.test.ts and its worker on a migrated disposable PostgreSQL
database. Legacy/exact document writer clients, defaults, signed ties, full horizon,
all recurrence frequencies, limits/backlog, scoped/deleted labels and tenant data,
permissions, currencies, exact/inverse/quarantined rates, numeric limits and unchanged
domain/GL/audit snapshots are asserted. Deliberately quarantined/unrepresentable
rate fixture rows bypass synchronization triggers only while seeding the disposable
database; guards are restored before report calls. Runtime never changes those guards.
