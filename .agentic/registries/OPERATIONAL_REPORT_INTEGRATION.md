# Combined operational analytics contracts (MON-104)

Verified 2026-10-08, Asia/Tehran. Child maps and immutable evidence retain
the detailed field lists, algorithms, defaults and range/negative cases.

| REST GET `/api/v1/reports/` | MCP read tool | Inputs | Outputs / exact aliases | Detailed contract |
|---|---|---|---|---|
| vendor-spend | vendor_spend | startDate/endDate, currencyCode | Vendors, monthlyTrend, totalSpend; totalSpendMinor, avgBillAmountMinor, totalMinor | [Documents](DOCUMENT_ANALYTICS_WIRE_CONTRACTS.md) |
| sales-by-customer | sales_by_customer | Same dates/currency; REST format | Customer net/tax/gross and totals with Minor strings, distinct invoice counts | [Documents](DOCUMENT_ANALYTICS_WIRE_CONTRACTS.md) |
| sales-by-item | sales_by_item | Same dates/currency; REST format | Item net/tax/gross and totals with Minor strings; hundredth quantities, line counts | [Documents](DOCUMENT_ANALYTICS_WIRE_CONTRACTS.md) |
| expense-analytics | expense_analytics | startDate/endDate | Category/month totals, totalExpenses/monthlyAverage with Minor strings | [KPIs](KPI_ANALYTICS_WIRE_CONTRACTS.md) |
| profitability | contact_profitability | startDate/endDate, currencyCode; REST groupBy=contact | Invoice-driven revenue/costs/profit, totals with Minor strings; numeric margins | [KPIs](KPI_ANALYTICS_WIRE_CONTRACTS.md) |
| monthly-trends | monthly_trends | months 1-24 | Zero-filled revenue/expenses/netIncome and sparklines with Minor strings/arrays | [KPIs](KPI_ANALYTICS_WIRE_CONTRACTS.md) |
| executive-summary | executive_summary | startDate/endDate, basis; REST format | Seven current/prior/delta KPIs with Minor strings; deltaPercent | [KPIs](KPI_ANALYTICS_WIRE_CONTRACTS.md) |
| cash-flow-forecast | cash_flow_forecast | weeks 1-52, currencyCode | Weekly/document inflows/outflows/net/cumulative and totals with Minor strings | [Forecast/FX](FORECAST_FX_WIRE_CONTRACTS.md) |
| unrealized-gains-losses | unrealized_gains_losses | Empty strict object | Foreign document valuation/gain-loss and summary with Minor strings; exact rate aliases | [Forecast/FX](FORECAST_FX_WIRE_CONTRACTS.md) |
| bank-cash-flow | bank_cash_flow | startDate/endDate, groupBy, bankAccountId, currencyCode | Period inflows/outflows/net/balance and totals with Minor strings | [Banking](BANK_ANALYTICS_WIRE_CONTRACTS.md) |
| bank-reconciliation-status | bank_reconciliation_status | bankAccountId | Account balance/discrepancy/unreconciled/aging money with Minor strings; counts/metadata | [Banking](BANK_ANALYTICS_WIRE_CONTRACTS.md) |
| inventory-valuation | get_inventory_valuation | sortBy, sortOrder, method | Unit/purchase/sale/margin projections and separate carrying values with Minor strings; whole quantities | [Inventory](INVENTORY_VALUATION_WIRE_CONTRACTS.md) |
| recurring-transactions | recurring_transactions | bankAccountId, minOccurrences 2-10000 | Currency-separated patterns, avg/min/max/transactions with Minor strings | [Operational](OPERATIONAL_REPORT_WIRE_CONTRACTS.md) |
| financial-calendar | financial_calendar | startDate/endDate, currencyCode | Due documents, recurring estimates, budget dates; amountMinor and individual currency | [Operational](OPERATIONAL_REPORT_WIRE_CONTRACTS.md) |
| duplicate-detection | duplicate_detection | Empty strict object | Currency/contact/total/date heuristic groups; amountMinor | [Operational](OPERATIONAL_REPORT_WIRE_CONTRACTS.md) |

The existing `profitability?groupBy=project` branch delegates to
`get_project_profitability`'s separately adopted [project billing contract](PROJECT_BILLING_WIRE_CONTRACTS.md).
It accepts projectId/startDate/endDate/currency, returns project revenue/cost/
profit/variance with Minor aliases, and preserves its existing authenticated
read permission and snapshot semantics. The MON-094 actual REST/MCP suite is
rerun for this branch; the fifteen readers below refer to the primary table.

All are direct organization-scoped DB readers requiring `view:data` with
repeatable-read, read-only snapshots. Inventory valuation now enforces this
permission in the shared service (previously any authenticated member could
read it), validates supported uppercase organization currency even for empty
reports, and rejects duplicate REST controls. Its sort/method defaults remain
in the inventory map. Passing a presentation method never rewrites stock cost.
Three document MCP readers now register the full strict object schema rather
than its raw shape, so unknown controls reject instead of being stripped.
All fifteen actual registered MCP schemas reject unknown fields.

There are no money inputs or representation-negotiation switches. Numeric
integer money retains its saved units and additive canonical Minor strings
within +/-9007199254740991. USD/IRR/JPY/KWD never trigger history rescaling.
Ledger reports use organization base amounts; document/bank reports preserve
their own currency and reject unsupported mixed totals or require a filter.
Calendar/pattern/status outputs may carry separately identified currencies.
Inventory price projections differ from saved book value. FX rates retain
their documented direction and compatibility limits. Counts, quantities,
percentages and dates are not monetary aliases.

Sales REST PDF/XLSX and executive REST/MCP PDF/XLSX retain the child export
contracts, currency display scales and precision rejection. Bank CSV remains
client-side. No new export workflow or provider is introduced.

## Combined acceptance and limitations

`operational-report-integration.test.ts/worker` uses migrated disposable
PostgreSQL and `registerAllTools`, real API-key route handlers and linked MCP
SDK clients. Actual legacy/exact invoice and bill writers plus posted mixed
numeric/Minor journal lines feed one shared dataset. Independent assertions
connect sales, spend, profitability, expense/monthly/executive KPIs, due calendar,
forecast, duplicate totals, bank patterns/status/cash flow and stock carrying
versus price values across four currency contexts. Separate tenant data and
keys, denied custom-role permissions, unknown/duplicate controls, strict tool
schemas, unsafe inventory values and invalid saved currency preserve domain,
ledger and audit snapshots. Authentication lastUsedAt remains separate.
The five child suites and existing inventory suite retain deeper signed-range,
rounding, scoped references, recurrence, FX rate and binary-export checks.

Separate report calls do not promise one globally atomic snapshot. Ledger and
document totals agree in the synthetic matching dataset, not universally:
statuses, issue/due/posting dates, tax, settlement and FX can differ. Executive
AR/AP uses current saved amountDue rather than historical reconstruction;
profitability is invoice-driven; forecast is a document/recurring projection
rather than a bank opening balance; cash-flow period balance is net movement;
duplicate/recurring detection retains heuristics. Calendar journal templates
retain their documented zero estimate. MON-029 retains broader report acceptance.
No schema/migration/history rescale/IRR flag change. Independent accounting,
full-int64 business paths, migration, performance, browser/session/OAuth,
localization and production qualification remain separate gates.
