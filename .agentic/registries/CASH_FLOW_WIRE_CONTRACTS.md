# Cash-flow report wire contracts (MON-109)

## Boundaries and inputs

| Boundary | Operation | Input | Output |
|---|---|---|---|
| GET /api/v1/reports/cash-flow | Report or PDF/XLSX | startDate, endDate, method, basis, format | Existing flat and structured JSON, or attachment |
| cash_flow_statement MCP | Report | startDate, endDate, method, basis | Same JSON as REST |
| export_cash_flow_statement MCP | File export | Same controls plus required pdf/xlsx format | filename, mimeType, encoding=base64, content |

All controls are optional except the MCP export format. startDate/endDate are
inclusive real Gregorian YYYY-MM-DD dates, years 0001-9999, with start <= end.
Defaults are January 1 of the current UTC year and UTC today. The earliest
supported start has zero prior history. method is indirect (default) or direct;
basis is accrual (default) or cash. REST format is case-insensitive json (default),
pdf or xlsx; MCP format is lowercase pdf/xlsx. Empty, invalid or reversed dates,
unknown controls, duplicate REST controls and unsupported method/basis/format
fail with 400 (or MCP validation error) before queries. MCP schemas and service
inputs are strict. No input money, currency filter, dimension filter, FX conversion
or exact-only/header negotiation is added.

## Units, fields and ranges

Ledger debit/credit are stored organization-base integer cents. Journal line
currency tags do not rescale these values. JSON retains every existing numeric
cent field and adds a signed canonical decimal-integer string at `<field>Minor`:

- openingCashBalance, closingCashBalance, netCashChange;
- legacy totalOperating, totalInvesting, totalFinancing, netCashFlow;
- legacy operating/investing/financing line amount;
- operatingActivities.netIncome, depreciation, total, and
  workingCapitalChanges.accountsReceivable/accountsPayable/inventory;
- investingActivities.items[].amount and total;
- financingActivities.loanPayments, equityChanges, items[].amount and total;
- reconciliation.computedNetChange, cashAccountMovement, difference.

Zero is 0/"0"; negative outflows/refunds retain signs. Dates, method, basis,
accountId/code/name and legacy accountName/accountCode retain their existing
meaning. reconciliation.balanced remains a boolean. currencyCode is the supported
organization default currency (USD fallback); it does not change JSON units.
REST's established envelope is the canonical superset for MCP; old MCP structured
fields retain their names/types, with metadata/items/flat fields added.

Every exposed numeric amount, flat derived row and exact sibling must fit
+/-9007199254740991. SQL aggregates are read as text and intermediate calculations
use bigint, including gross sums above int64 and unsafe income operands that
cancel exactly. Only final exposed amounts are narrowed. An unsafe final row,
subtotal, net change, closing balance, reconciliation or unsupported organization
currency returns 422 LEGACY_NUMERIC_RANGE (MCP error with same status/code).
No bigint JSON leak, magnitude-dependent representation or rounded-number repair.
No promise of full-int64 exposed output is made.

PDF/XLSX reuse the shared statement exporter and prior rows/sections/subtotals.
Unlike fixed-cent JSON, file display divides the stored integer by the currency's
minor-unit scale: USD 1250 -> 12.50; IRR/JPY 1250 -> 1250; KWD 1250 -> 1.250.
PDF formats integer/fractional parts exactly. Numeric Excel cells additionally
require an exact decimal round-trip and at most 15 significant digits; otherwise
422 LEGACY_NUMERIC_RANGE. PDF layout/localization qualification remains separate.

## Computation and accounting limits

The pre-existing REST classifications are retained deliberately. Indirect uses
period natural-sign revenue minus expense balances, depreciation-source debit
sum, negative AR/inventory deltas, positive AP/current-liability deltas, negative
fixed-asset deltas, loan_payment-source credit-minus-debit sum and equity deltas.
Source-type sums include every owned line on qualifying entries; a balanced
loan_payment journal therefore sums to zero. Direct uses cash-basis revenue less
cash-basis expenses minus the depreciation debit add-back; its netIncome field
means cash-source revenue, depreciation/working-capital fields are zero, and
investing/financing reuse the indirect classification. This is the existing
cash-income heuristic, not payment tracing or a newly qualified direct method.

Cash balances recognize asset subtypes cash and bank. cash basis retains GL's
payment/bank_categorization/bank source-or-bank-account heuristic (an unsourced
cash-only entry does not match it). opening uses history before the start, actual
movement uses closing ledger cash minus opening. The exposed closingCashBalance
remains opening + computed net change. reconciliation.difference is computed net
change minus actual movement; balanced is exact equality to zero. These heuristics
can produce an unreconciled result, including balanced loan payments or non-cash
depreciation under direct mode. Fixtures characterize these differences. They
must not be interpreted as an independent accounting approval. Cash-flow pack and
compound reports remain MON-110; MON-101/MON-029 retain combined acceptance.

## Scope and verification

Both boundaries require view:data and organization ownership. One repeatable-read
read-only transaction covers currency, GL, source sums, opening and closing. Both
journal entries and chart accounts are scoped, including malformed cross-tenant
references in either direction. Posted, non-deleted entries only. Reporting does
not mutate ledger/chart/audit rows; API-key authentication separately updates
lastUsedAt. No period-lock/audit write is appropriate for this read operation.

`tests/cash-flow-wire.test.ts` and `tests/integration/cash-flow.test.ts`/worker
exercise actual API-key routes, registered MCP SDK clients, nested numeric/exact
agreement, both methods/bases, inclusive/default/earliest dates, all sections,
reconciliation, signed cash transfers/refunds, source sums, tenant/permission/input
failures, USD/IRR/JPY/KWD exports, actual PDF/XLSX/base64 output, exact cancellation,
safe limits and unsafe derived outputs, plus ledger/audit snapshots. Browser/session
and OAuth, high-volume/performance, historical remediation, full-int64, independent
accounting, localization, parent integration and production IRR gates remain open.
