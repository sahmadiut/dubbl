# Budget comparison report contracts (MON-100)

Verified 2026-10-06. Shared direct-DB `lib/api/budget-report.ts`; wire validation
and exact rounding in `budget-report-wire.ts`. No schema or production flag change.

| REST boundary | MCP operation | Input / returned envelope |
|---|---|---|
| GET `/api/v1/reports/budget-vs-actual` | `budget_vs_actual` | Optional `budgetId` UUID; same `{currencyCode,budget,comparisons,totalBudgeted,totalActual,totalVariance,totalBurnRate,daysElapsed,daysRemaining,totalDays}` envelope plus exact aliases below |

REST accepts at most one budgetId and rejects unknown query parameters. MCP
publishes the same described UUID schema and uses wrapTool. Both require view:data
in AuthContext. Input supplies no monetary amounts or FX. Exact clients read the
additive aliases without a version header or opt-in; numeric clients keep the
existing integer-cent fields. This is a dual contract bounded by numeric compatibility,
not an exact-only/full-int64 output contract.

| Output location | Existing money fields | Exact aliases / units and range |
|---|---|---|
| Root | totalBudgeted, totalActual, totalVariance, totalBurnRate | Each adds `FieldMinor` (for example totalActualMinor), a canonical signed ASCII integer string in the same fixed cents; all numeric money and aliases within +/-9007199254740991 |
| comparisons[] | budgeted, actual, variance, burnRate, projected | Each adds the corresponding `Minor` string with the same signed cents/range |
| comparisons[].periods[] | budgeted, actual, variance | Each adds the corresponding `Minor` string with the same signed cents/range |
| Root / comparisons metadata | currencyCode; daysElapsed, daysRemaining, totalDays; variancePct | Organization current default currency; UTC day counts; safe signed integer percentage, respectively. These are not monetary aliases |

`budget` retains id/name/startDate/endDate/periodType; lines retain
accountId/accountName/accountCode and periods retain id/label/startDate/endDate/sortOrder.
No extra account or fiscal-year details are returned. Lines sort by id; periods
sort by sortOrder then id. Stored dates must be real Gregorian dates in years
0001-9999 and each range must be nondecreasing. At most 500 lines/10000 periods.
Periods may overlap or extend beyond the budget range as allowed by existing CRUD;
their actuals use their own inclusive ranges, not a clipped or allocated total.
Explicit line totals remain independent of period sums, and repeated account
lines retain existing comparison behavior. No forced reconciliation is introduced.

Without budgetId, select the newest non-deleted budget by createdAt then id,
including inactive budgets as the existing MCP description promises. Empty,
missing, deleted and foreign budget IDs return budget:null, empty comparisons,
zero counts/totals and exact "0" aliases. Foreign account or fiscal-year references
inside an owned budget fail 404, preventing names/amounts from leaking.

All actuals include only posted, non-deleted entries from this organization.
Asset/expense actual = debit minus credit; liability/equity/revenue actual = credit
minus debit. GL amounts are already in organization-base fixed cents; journal-line
document currency tags do not cause conversion or grouping. Budget tables lack a
currency snapshot, so currencyCode describes the current implicit organization
context. USD/IRR/JPY/KWD 1250 remains 1250. Currency-history/snapshot and full-range
qualification remain separate money gates.

SQL SUM(bigint) is cast to text before driver conversion; bigint retains exact
intermediate sums even beyond safe Number/int64 limits. Only final output amounts
are narrowed after checks. Variance = budgeted minus actual; variancePct = rounded
100*variance/budgeted, or zero when budgeted is zero. Burn rate/projected = rounded
actual*totalDays/daysElapsed, or zero when no days have elapsed. Totals use bigint
sums and a separately rounded aggregate projection. Nearest rounding retains
Math.round's signed ties toward positive infinity, including negative denominators.
Duration is inclusive UTC days. Elapsed days retain nearest-day rounding from UTC
start and are clamped to [0,totalDays]. A repeatable-read, read-only transaction
keeps organization context, budget, periods and actuals in one database snapshot.

Errors: REST malformed UUID/duplicate/unknown input is 400; SDK schema validation
or wrapTool reports MCP validation errors. Invalid API keys are 401; missing
view:data is 403; missing organization/nested foreign references are 404. Unsafe
stored cents, invalid stored dates/currency, resource bounds, or any unsupported
money/percentage/projection is 422 `LEGACY_NUMERIC_RANGE` on REST/MCP. No rounded
Number recovery, implicit rescaling, bigint JSON crash or partial report is allowed.
Report queries do not mutate budget/ledger/audit data; normal API-key authentication
can still update lastUsedAt independently.

Verification: budget-report-wire.test.ts tests exact signed rounding, range/currency,
UTC dates and query validation; integration/budget-report.test.ts invokes actual
API-key REST and registered MCP SDK clients on migrated disposable PostgreSQL.
Existing integration/budget-wire.test.ts verifies CRUD regression. Financial
statement baseline sign defects remain PAR-008/QA-001; other report/dashboard
domains remain MON-101 through MON-105, with MON-029 final integration retained.
