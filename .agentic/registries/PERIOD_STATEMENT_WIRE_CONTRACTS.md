# Period financial statement contracts (MON-107)

Verified 2026-10-07, Asia/Tehran. ADR-006 additive compatibility; direct-DB
services in `lib/reports/period-statement.ts`, shared exact `gl-query.ts`.
MON-101/MON-029 retain independent combined report acceptance; MON-108..110
retain ledger detail, cash flow and compound/report-pack calculations.

| REST GET boundary | Registered MCP tool | Existing money representation |
|---|---|---|
| `/api/v1/reports/profit-and-loss` | `profit_and_loss` | Numeric integer cents |
| `/api/v1/reports/income-statement` | `income_statement` (new parity) | Fixed two-place decimal strings |
| `/api/v1/reports/pnl-comparison` | `pnl_comparison` (new parity) | Numeric integer cents |
| P&L `format=pdf|xlsx` | `export_financial_statement`, statement=profit_and_loss | Existing currency-scaled file figures |

All require `view:data`. API-key organization is authoritative over a supplied
organization header; MCP uses AuthContext, wrapTool and the same service without
HTTP self-calls. These operations read ledger data and do not mutate it. Auth may
independently update API-key lastUsedAt. No input money, FX or public exact-mode
negotiation. Existing legacy output fields/envelopes retain their units.

## Inputs and period semantics

All supplied dates are real Gregorian YYYY-MM-DD in years 0001-9999. Bounds are
inclusive. Unknown/duplicate REST parameters, invalid/empty dates, reversed
ranges, invalid formats/enums/IDs and unsupported counts return 400; MCP schema
and service validation reject the same unsupported inputs. Fields are described.

- P&L: startDate defaults to January 1 of current UTC year; endDate to today in
  UTC; basis=accrual (default)|cash. Both compareFrom and compareTo are required
  together and use the same basis/dimension as the primary period. REST format
  defaults to json and accepts case-insensitive json/pdf/xlsx. Comparison is
  present only when requested.
- P&L dimensions: costCenterId or projectId is an owned UUID, or the legacy
  none/null/empty sentinel for untagged lines. costCenterId takes precedence
  when both are supplied; valid ignored project IDs are not looked up. Effective
  foreign/missing dimension returns 404. REST now supports the same dimension
  inputs as MCP. Filtered responses add dimension and dimensionValue.
- Income statement: optional from/to; omitted lower/upper bound means unbounded
  history in that direction. period.from/to remain null when omitted. All owned
  revenue/expense accounts, including empty/inactive accounts, appear at zero
  when no qualifying activity exists. No basis or dimension option is inferred.
- Comparison: compare=monthly (default)|quarterly|yearly; periods is a strict
  integer 1-12 (REST canonical ASCII digits), default 6/4/3 respectively. Optional
  asAt anchors the calendar sequence and defaults to UTC today. All periods are
  complete calendar periods, including the full current period. Oldest first.
  Windows outside years 0001-9999 reject. UTC calendar arithmetic removes the
  prior local-midnight ISO shift; month/quarter/year labels retain English names.
- MCP P&L export: existing from/to map to P&L startDate/endDate with the same
  strict dates/defaults. Existing export tool shape remains; basis/dimension/
  comparative exports are available through REST, not invented MCP export inputs.

## Outputs, exact aliases and ranges

Every report adds currencyCode from the organization's supported current base
currency. Journal-line GL amounts are already base amounts; currency tags do not
trigger FX or grouping. Stored 1250 stays 1250 JSON cents for USD/IRR/JPY/KWD.
Income statement represents that as `12.50`, independent of currency scale.

| Location | Legacy money fields | Additive exact aliases |
|---|---|---|
| P&L revenue[]/expenses[], comparison rows | balance | balanceMinor |
| P&L top-level and comparison | totalRevenue, totalExpenses, netIncome | corresponding Minor fields |
| Income revenue/expenses.accounts[] | balance (decimal string) | balanceMinor |
| Income revenue/expenses sections | total (decimal string) | totalMinor |
| Income top-level | netIncome (decimal string) | netIncomeMinor |
| Comparison periods[].revenue[]/expenses[] | balance | balanceMinor |
| Comparison periods[] | totalRevenue, totalExpenses, netIncome | corresponding Minor fields |
| Comparison periods[] | revenueChange, expensesChange, netIncomeChange | corresponding Minor fields |

Aliases are canonical signed ASCII integer strings, bounded by
+/-9007199254740991, agreeing exactly with their legacy fields. Negative one cent
formats `-0.01` for income statement. Counts, dates and percentage fields are not
money. Comparison change percentages use exact bigint ratios and Math.round
ties toward positive infinity, to two decimal places; denominator is absolute
prior value. Zero prior value/first period gives zero. The rounded hundredths
must fit the same safe integer range before numeric conversion.

P&L rows retain accountId/accountName/accountCode; comparison rows retain
accountId/accountName; income rows retain code/name. Account code order is
stable. P&L/comparison include accounts with qualifying activity, including
zero net activity. Natural-sign revenue is credit-debit; expense is debit-credit.
Total revenue/expenses and net income are independently bounded, as are every
comparison period and consecutive change. Hidden gross sums may exceed safe
integer or int64 bounds and cancel exactly before final balances are projected.
Unsafe exposed amounts never become rounded Numbers or unprojected bigint JSON.

## Ledger selection, correction and exports

Only posted non-deleted entries in each range count. Both chart account and
journal entry must belong to the organization, including malformed cross-org
references in either join direction. Income-statement's former outer join could
sum lines whose posted/date join failed; using the shared exact account-driven
query corrects that leakage while retaining zero accounts. Cash basis retains
the existing payment/bank-source or owned bank-account heuristic. It is not a
new payment-allocation accounting policy.

Organization/currency, all requested periods and effective dimension ownership
use one repeatable-read read-only transaction. SQL SUM(bigint) becomes text
before driver conversion; sums, differences and percentages use bigint.
Invalid/unsupported reads preserve ledger/chart/audit state. Missing organization
is 404; invalid API key 401; denied permission 403; unsupported currency/final
amount or lossy spreadsheet cell 422 LEGACY_NUMERIC_RANGE on both transports.

P&L REST PDF/XLSX and MCP P&L export use the same exact calculation. Comparative
REST exports align accounts by ID and retain prior-only accounts/zero cells.
Existing attachment names and numeric XLSX cells are preserved. Exports retain
currency-based scaling: 1250 is USD 12.50, IRR/JPY 1250, KWD 1.250, distinct from
fixed two-place income JSON. MON-106 renderer guards preserve exact PDF digits
and reject numeric XLSX cells exceeding 15 significant digits or failing decimal
round-trip; formula-triggering text remains escaped. No silent text fallback.

## Evidence and remaining gates

`period-statement-wire.test.ts` covers strict inputs, UTC calendar windows,
leap/year edges and exact signed percentage rounding. Actual migrated disposable
PostgreSQL REST/API-key and registered MCP fixtures cover all three report pairs,
legacy/exact readers, default/unbounded and inclusive periods, cash/dimensions,
comparisons, tenant/permission isolation, malformed cross-org references,
USD/IRR/JPY/KWD, PDF/XLSX/MCP export, int64-sum cancellation, safe edges,
section/net/change overflow, unsupported currency and unchanged read snapshots.
Prior cumulative/budget regressions pass. No schema, historical rescale or
production flag changes. Independent financial, full-int64 client, migration,
high-volume, Persian/PDF layout and production IRR gates remain assigned tasks.
