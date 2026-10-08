# Combined financial report contracts (MON-101)

Verified 2026-10-08, Asia/Tehran. Detailed fields, defaults and error contracts
remain in the linked child maps; their original evidence is immutable.

| REST GET /api/v1/reports/ | MCP read tool | Inputs | Outputs and exact aliases | Detailed contract |
|---|---|---|---|---|
| trial-balance | trial_balance | asAt/asOf, compareDate (REST); asAt, compareDates (MCP) | Fixed two-place debitBalance/creditBalance/balance with Minor strings, including comparisons | [Cumulative](CUMULATIVE_STATEMENT_WIRE_CONTRACTS.md) |
| balance-sheet | balance_sheet | Same cutoffs/comparisons | Fixed two-place account balance/section total and comparative arrays with Minor strings/arrays | [Cumulative](CUMULATIVE_STATEMENT_WIRE_CONTRACTS.md) |
| profit-and-loss | profit_and_loss | startDate/endDate, basis, costCenterId/projectId, compareFrom/compareTo | Numeric account balance, revenue/expense totals and netIncome cents with Minor strings, including comparison | [Period](PERIOD_STATEMENT_WIRE_CONTRACTS.md) |
| income-statement | income_statement | from/to, optional unbounded history | Fixed two-place account balance/section total/netIncome with Minor strings | [Period](PERIOD_STATEMENT_WIRE_CONTRACTS.md) |
| pnl-comparison | pnl_comparison | compare, periods, asAt | Numeric period balances/totals/netIncome/changes with Minor strings; percentages retain percent units | [Period](PERIOD_STATEMENT_WIRE_CONTRACTS.md) |
| general-ledger | general_ledger | startDate/endDate, accountId, costCenterId/projectId, offset/limit | Numeric debit/credit/running/period/opening/closing ledger balances and totals with Minor strings | [Ledger](LEDGER_DETAIL_WIRE_CONTRACTS.md) |
| account-transactions | account_transactions | required accountId, startDate/endDate | Numeric transaction/period/opening/closing ledger balances and totals with Minor strings | [Ledger](LEDGER_DETAIL_WIRE_CONTRACTS.md) |
| cash-flow | cash_flow_statement | startDate/endDate, method, basis | Flat/structured numeric activities/cash balances/reconciliation with Minor strings | [Cash flow](CASH_FLOW_WIRE_CONTRACTS.md) |
| tracking-category | tracking_category_report | startDate/endDate, basis, dimension, mode | Numeric scalar/column amounts/totals/netIncome with Minor strings/arrays | [Compound](COMPOUND_REPORT_WIRE_CONTRACTS.md) |
| pack | report_pack | startDate/endDate, basis | Four statements with numeric row amounts/subtotals/grand totals and Minor strings/arrays | [Compound](COMPOUND_REPORT_WIRE_CONTRACTS.md) |
| financial-ratios | financial_ratios | startDate/endDate | Numeric balance cents with Minor strings; ratiosExact contains matching ratios/percentages/integer days, not money | [Compound](COMPOUND_REPORT_WIRE_CONTRACTS.md) |

Real Gregorian dates span years 0001-9999 with inclusive ordered bounds. Child
maps specify defaults, aliases, comparison caps, dimensions and pagination.
Unknown/duplicate controls and invalid dates/IDs/enums/counts reject before report
queries. No money input or public exact-only switch exists. MON-101 preserves
the full strict cumulative MCP schema at registration: passing only its raw shape
formerly stripped unknown fields before service validation. All eleven read tools
now reject unknown controls.

JSON keeps fixed cents regardless of organization currency/journal-line tags.
Fixed decimal strings divide cents by 100; Minor strings do not divide them.
Exposed money is bounded by +/-9007199254740991, with SQL numeric/text sums and
bigint intermediates. Unsupported final amounts/currency return 422
LEGACY_NUMERIC_RANGE; exposed full-int64 support is not promised.

REST PDF/XLSX covers cumulative statements, P&L, full general ledger, cash flow
and tracking; pack supports XLSX. MCP export_financial_statement covers
cumulative/P&L/general-ledger files; export_cash_flow_statement and
export_tracking_category_report cover PDF/XLSX; export_report_pack returns XLSX.
Child maps specify filenames/dates/base64 envelopes. Files divide stored amounts
by currency scale (USD 100, IRR/JPY 1, KWD 1000). PDF formats exactly; Excel
requires exact decimal round-trip and at most 15 significant digits. Precision
failure returns no file.

## Integration and preserved limitations

financial-report-integration.test.ts/worker posts legacy numeric and exact string
journals above int32 using actual REST and registered MCP SDK writers. All eleven
report pairs agree on independently specified period income, cumulative earnings,
opening/movement/closing ledger balances, actual cash, tracking, pack and ratios.
Inclusive date boundaries count; drafts and following-period postings do not.
USD/IRR/JPY/KWD keep JSON units while actual P&L/pack XLSX net income agrees at
the existing currency scale. Each pair covers two tenants, keys/permissions,
unknown controls and unsupported currency with preserved journal/account/audit
snapshots. API-key lastUsedAt is an independent authentication write. The five
child suites retain malformed cross-tenant references, safe/unsafe/cancellation,
PDF/export, comparisons/dimensions and PostgreSQL pagination edge coverage.

Services require view:data and one organization-scoped repeatable-read read-only
snapshot each. Pack components share a snapshot; separate calls do not promise
one globally atomic snapshot. Reports do not mutate posted history or apply FX.

Standalone trial-balance natural-sign presentation/export subtotal remain the
PAR-008/QA-001 defect; pack's normal-sign trial balance does not repair it.
Cash-flow heuristics can remain unreconciled: compare reconciliation actual cash
movement with pack's cash summary, not computed closing cash universally.
Cumulative earnings include prior unclosed income; period income excludes it.
Ledger closingBalance/runningBalance are period-only; closingLedgerBalance/
ledgerBalance include opening history. Ratios retain current document snapshots,
subtype classifications, chart equity without earnings and existing margin/day
heuristics. Independent accounting, migration/historical currency, full-int64,
performance, browser/OAuth/session, localization/PDF layout and production IRR/
release gates remain separate. MON-029 retains broader report acceptance.
No schema, migration, history rescale or rollout change.
