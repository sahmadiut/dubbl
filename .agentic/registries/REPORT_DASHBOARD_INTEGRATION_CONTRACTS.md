# Report and dashboard integration contracts (MON-029)

Verified 2026-10-09, Asia/Tehran. This parent integrates the six completed domain
slices; their immutable evidence and detailed boundary maps remain authoritative
for each field, default, error, file envelope and limit.

| Domain and complete boundary inventory | Detailed inputs, outputs, units, aliases and ranges | Current operation fixtures |
|---|---|---|
| Budget comparison: GET reports/budget-vs-actual / budget_vs_actual | [Budget comparison](BUDGET_REPORT_WIRE_CONTRACTS.md); optional owned budget UUID, newest fallback, signed numeric cents and Minor siblings, natural signs, exact percent/projection rounding | budget-report; budget-wire |
| Eleven financial readers and their REST/MCP PDF/XLSX exports: cumulative, period, ledger, cash flow, tracking, pack and ratios | [Financial integration](FINANCIAL_REPORT_INTEGRATION.md), which links all five detailed maps; date/dimension/pagination/basis controls, numeric cents or fixed two-place strings plus Minor siblings; ratios/counts/days retain independent units | financial-report-integration; cumulative-statement; period-statement; ledger-detail; cash-flow; compound |
| Aging, payment performance, contact general/supplier statements, activity, print/email and aging exports | [Receivable/payable integration](RECEIVABLE_PAYABLE_INTEGRATION.md); inclusive cutoffs/periods, currency filters, owned contacts, pagination and delivery; numeric money with Minor strings, separate activity currencies | receivable-payable-integration; aging; contact-statement; payment-performance |
| Seven tax/regulatory readers: 1099, tax-summary, sales-tax, VAT return/drill-down, BAS, Schedule C | [Tax reports](TAX_REPORT_WIRE_CONTRACTS.md); dates/year/basis/period/box, agreeing threshold/thresholdMinor, flat-rate basis points; numeric fixed cents and Minor strings; existing jurisdiction heuristics | tax-report |
| Fifteen operational readers and sales/executive exports; preserved project-profitability branch | [Operational integration](OPERATIONAL_REPORT_INTEGRATION.md), which links all document/KPI/forecast/FX/bank/inventory/calendar/pattern maps and the project contract; dates/currency/weeks/months/IDs/sort/heuristic controls; money aliases distinct from physical quantities/rates/counts | operational-report-integration; document-analytics; kpi-analytics; forecast-fx; bank-analytics; operational-reports; inventory-valuation; project-billing |
| Twenty-five dashboard/layout/custom/saved-report/schedule/budget-check pairs, threshold CRUD and trusted scheduled consumers | [Dashboard integration](DASHBOARD_REPORT_INTEGRATION.md), which links every detailed map; widget currencies, opaque placement JSON, allowlisted source/columns/filters, owned IDs, schedule timing/recipients/formats; literal money aliases, metadata/count/grid/time units | dashboard-report-integration; dashboard-data; dashboard-layouts; custom-reports; report-schedules; budget-alerts; budget-wire |

All paths above are under /api/v1 and all tool names/operation mappings are in
the linked inventories. This integration adds no new public operation, selector
or version header. Public monetary outputs retain their existing safe numeric
compatibility (absolute value at most 9007199254740991) and additive canonical
Minor strings. Exact intermediates use SQL text/numeric and bigint. Values outside
the supported public range fail with 422 LEGACY_NUMERIC_RANGE rather than rounded
numbers, automatic string fallback or bigint JSON crashes. Opaque layout strings
can retain int64 text without qualifying int64 financial computations.

Fixed-cent financial JSON and fixed two-place legacy financial strings remain
distinct from currency-scaled export cells and document/bank currency metadata.
Changing a synthetic currency tag never rescales saved money. Detailed export
maps retain Excel/PDF precision guards, literal CSV/text cells and base64 envelopes.
No second FX conversion is applied to already-base GL activity. FX retains its
saved rate direction and exact rate aliases. Currency, locale and dates are
independent. Real Gregorian date-only values and UTC instants retain their units.

Read operations use organization-scoped direct DB services and require the
documented permission, normally view:data. Configuration/delivery/notification
operations retain their separate manage/email grants. API keys cannot be
retargeted by an organization header; MCP uses AuthContext. Strict schemas reject
unknown controls, and REST validators reject duplicate/invalid controls. The
budget_vs_actual MCP registration now passes its complete strict Zod object to
registerTool: the former raw shape silently stripped unknown organizationId
before validation. Valid inputs, description, computation and response are unchanged.

## Independent parent acceptance

report-dashboard-integration.test.ts/worker registers the full MCP tool registry
and authenticates actual REST handlers. It creates a numeric REST invoice (1250)
and an exact MCP invoice (2147483750, above int32), both with synthetic 20% tax,
and an exact MCP bill (250 plus 50 tax). Actual shared sendInvoice/receiveBill
recognition posts the same source data. Mixed numeric/exact budget inputs and a
REST saved custom report consume this history. No synthetic GL status shortcut is
used. A second tenant has its own 777 invoice, and denied/data-only custom users
exercise every one of the seventeen integrated reader pairs.

Independent expected amounts distinguish these economic meanings:

- Net revenue 2147485000 and expense 250 yield ledger net income 2147484750;
  income statement, ratios, Schedule C and executive KPI agree.
- Budget revenue/expense actuals agree with P&L. Their natural-sign sum is
  2147485250 and variance is zero; it is not net income.
- Sales net/tax/gross are 2147485000 / 429497000 / 2576982000. Tax summary agrees
  with output tax, has input tax 50 and net payable 429496950.
- Gross aging/dashboard AR is 2576982000, AP/vendor spend is 300. Contact closing
  balance and forecast net are 2576981700 before settlement. These gross values
  differ from untaxed ledger profit.
- Custom rows retain the two document totals and sum to AR; REST/MCP literal CSV
  exports agree. Numeric and fixed-decimal legacy aliases match Minor values.

USD/IRR/JPY/KWD contexts are changed directly only inside the disposable fixture;
the actual organization-settings history guard is not bypassed in product code.
Original journal currency stays USD. Successful/failed readers and exports leave
organization/domain/configuration/ledger/audit/notification snapshots unchanged.
API-key lastUsedAt is authentication bookkeeping and is excluded.
Unknown organization controls, invalid keys, denied/data-only readers and foreign
contact lookup are checked through both transports. Stored int64 document
corruption fails across aging, widgets, forecast, contact, custom run/export.
Stored unsafe GL fails across budget, P&L, income statement, Schedule C and
executive summary without any financial or audit write.

The current parent and all linked operation suites are rerun, covering the
remaining reader/configuration/delivery/file operations, signed bounds,
cancellation, tenant references, invalid dates and exact rate/rounding cases.
SMTP remains recorded locally by the existing delivery suites.

## Scope and limitations

Each reader has its own database snapshot; separate calls are not one globally
atomic report bundle. Equality above applies to this matching recognized dataset,
not universal reconciliation across different dates/statuses/tax/FX/settlement
policies. Existing cash/ratio/forecast, tax-jurisdiction and pattern heuristics
remain documented. Standalone trial-balance presentation/export subtotal defects
remain PAR-008/QA-001. Scheduled SMTP/alert delivery retains its documented best
effort behavior and no durable exactly-once outbox claim.

This is technical contract integration. Independent accounting/statutory,
full-int64 business range, high-volume performance, migration/backup, live browser,
session/OAuth, Persian/RTL, visual PDF layout and production qualification remain
their own tasks. No schema/migration change, production flag change, deployment,
build, dev server, Docker or external provider request is part of this work.
