# Payroll compensation and forecasting wire contracts

MON-084, 2026-10-06, Asia/Tehran. Actual source: payroll-compensation-wire.ts,
payroll-compensation.ts, the nine route files below and payroll-compensation.ts
MCP registration. Default responses retain numeric aliases; no request header or
representation negotiation is introduced. Matching `fieldMinor` strings are
always returned for listed money. Direct Drizzle services are shared by REST/MCP.

## Boundary map

Paths below are relative to `/api/v1/payroll/`. MCP uses `id` for an owned band or
review UUID. REST retains existing response envelopes and creation status 201.
Other successes are 200. Every MCP tool has one operation and uses wrapTool.

| REST path and method | MCP tool | Inputs and output |
|---|---|---|
| compensation/bands GET | list_compensation_bands | No input; `{data: bands}` |
| compensation/bands POST | create_compensation_band | name, optional level/currency; required min/mid/maxSalary pairs; `{band}` |
| compensation/bands/:id GET | get_compensation_band | Owned id; `{band}` |
| compensation/bands/:id PATCH | update_compensation_band | Optional name/level/isActive/min/mid/maxSalary pairs; `{band}` |
| compensation/bands/:id DELETE | delete_compensation_band | Owned id; `{success:true}`; referenced bands reject |
| compensation/reviews GET | list_compensation_reviews | No input; `{data: reviews, currency: current base}` |
| compensation/reviews POST | create_compensation_review | name, effectiveDate, optional nullable totalBudget pair; `{review}` |
| compensation/reviews/:id GET | get_compensation_review | Owned id; `{review}` with entries, scoped employee DTOs, totals and count |
| compensation/reviews/:id PATCH | update_compensation_review | Optional name/date/status/nullable totalBudget pair; `{review}` |
| compensation/reviews/:id/entries GET | list_compensation_entries | Owned live review id; `{data: entries}` |
| compensation/reviews/:id/entries POST | create_compensation_entry | Owned review/employee, current/proposedSalary pairs, optional adjustmentPercent/reason; `{entry}` |
| compensation/equity-analysis GET | analyze_compensation_equity | No input; `{data: analysis}` including salary pair, currency, band and numeric penetration percent |
| forecasting/projection GET | project_payroll_costs | months 1..60, default 12; `{currency,data,totals}`; gross/tax/net pairs, numeric headcounts and YYYY-MM labels |
| forecasting/what-if POST | forecast_payroll_what_if | months, salaryAdjustmentPercent, newHires, avgNewHireSalary pair, terminations; `{currency,current,projected,difference}` with monthlyGross/projectedTotal pairs and numeric headcounts |
| forecasting/budget-vs-actual GET | get_payroll_budget_vs_actual | year 1..9999, default UTC year; `{year,currency,budget,actual,variance,utilizationPercent}` with budget/actual/variance pairs |

REST GET months/year accept canonical positive ASCII integer query values only.
Unknown query parameters remain ignored. Body and MCP schemas are strict.
Valid Gregorian dates are YYYY-MM-DD, year 1..9999. Invalid JSON returns 400.

## Money, percentages, currencies and ranges

All wire amounts are integer cents/minor units, never major-unit prices or FX.
USD 1250, IRR 1250 and KWD 1250 remain 1250, without rescaling old rows. New input
accepts a safe integer Number, a canonical nonnegative int64 string `fieldMinor`,
or both with exact agreement. The business/ORM bridge supports 0..9007199254740991;
larger valid int64 strings fail with 422 LEGACY_NUMERIC_RANGE before mutation.
Negative zero, decimals, exponent notation, whitespace, localized digits, leading
zeros, null nonnullable salary values and conflicting aliases reject. Only
totalBudget permits null, including null exact alias to clear. Computed variance
and differences can be negative within the same signed safe range. Aggregate
overflow fails visibly; no rounded Number/null/string substitution occurs.

Bands require `0 <= minSalary <= midSalary <= maxSalary`, with annual salaries in
their explicit ISO currency (default USD). Updates validate the merged row and
cannot change currency. Equity comparisons require an owned live assigned band
whose currency matches a salary employee; incompatible references reject rather
than reveal another tenant or compare unlike amounts. Penetration is an exact
ratio rounded to two percentage decimal places; a zero-width band returns null.

Reviews snapshot the organization base currency at creation via migration 0011.
Legacy rows retain null: their currency bridge is explicitly the current base,
with no migration-time inference/rescaling. Reads/entries use the saved review
currency even after a base-setting change. Entries require live active salary
employees paid in that currency; currentSalary must match the employee on create.
Current/proposed salaries remain snapshots; completing a review does not update
employee salary. Informational adjustmentPercent is plain -100..1000 percent,
input with at most two decimal places; its existing PostgreSQL real column remains
binary32 and may return an approximate fraction. It never calculates salary.
Reviews include exact, checked currentSalary/proposedSalary/difference totals and
entry counts. Foreign/deleted linked employees or invalid saved amounts reject.

Forecasts require all active live staff in the current organization base currency
and salary/hourly compensation. Mixed currencies, milestone/commission and missing
hourly rates reject with 422; no undocumented FX estimate is performed. Forecasts
are estimates, using 173 hours/month for hourly staff. Projection computes salary
/12 per employee and hourlyRate*173, then each employee's flat basis-point tax
rate on that rounded cost. It sums those taxes, replacing the former unweighted
average tax estimate. Net is gross minus tax. Each money operation uses bigint
intermediates and half-away-from-zero rounding. Month labels anchor the first
UTC day and advance UTC months, avoiding end-of-month overflow/DST drift.

What-if retains the same monthly employee-cost model. Terminations 0..active
headcount remove the exact proportional average monthly cost, rounded once;
salaryAdjustmentPercent adjusts retained cost, then new hires add annual salary
*count/12 rounded once. Adjustment is plain -100..1000 percent with at most two
decimals, converted to an exact rational; it is neither binary32 nor money.
Counts are integer 0..100000. Positive newHires requires avgNewHireSalary, including
explicit zero. Totals multiply the rounded monthly amounts by the bounded horizon.
This keeps projected headcount and gross nonnegative without combining unadjusted
termination costs with adjusted totals.

Budget actual sums current annual salary or hourlyRate*2076 annual cents, and
completed nondeleted run gross whose periods lie wholly within the year. Saved
run base currency must equal the current base; legacy null uses the established
base bridge. Actual sums use bigint, with no SQL-to-Number aggregate coercion.
Utilization is actual/budget in plain percent rounded to two decimals (zero budget
returns zero). No taxable jurisdiction rules or financial forecast guarantee is
introduced.

## Authorization, mutations and dashboard

Compensation requires manage:compensation; forecasts require view:payroll-reports.
REST uses actual API-key/session auth, MCP AuthContext; every parent/employee/band/
run lookup is organization scoped. All operations use an organization transaction
lock. New and updated DTOs, aggregate totals and references are checked before
commit; audit insertion and writes share the same transaction. Review entries
allow one employee per review under the shared lock. Completed/cancelled reviews
are immutable. Soft-deleted bands/reviews cannot be updated or resurrected.
These planning operations do not post journals or mutate salaries, so posting
period locks and journal idempotency are not applicable. Create is not a generic
idempotent API; duplicate review/band creation remains possible on a new request.

Dashboard band/review/what-if inputs parse exact major-unit decimals in the shown
currency into Minor strings, rejecting fractional minor units. Currency prefixes
and exact signed display use the actual currency scale. Review/projection totals
come from checked server calculations; band width uses bigint and marks multiple
currencies explicitly. Server rejection is shown to users. Historical financial
rows are not repaired implicitly.

## Verification and remaining qualification

tests/payroll-compensation-wire.test.ts and tests/integration/payroll-compensation
test/worker cover actual authenticated routes and SDK MCP transport, all 15
operations and tool descriptions/uniqueness, legacy/exact inputs, range and unit
failures, tenant/permission/key boundaries, audit rollback, entry races, aggregate
overflow, currency snapshots and migration preservation. A random fixture database
and separate local PostgreSQL cluster are used; no dev server is required.
Browser/session/OAuth/network transport, full-int64 consumers, multi-currency FX
forecasting and independent financial approval remain unqualified. MON-085 and
parent MON-025 retain output and integrated payroll acceptance. Apply migration
0011 before this runtime; no production migration or IRR flag change is implied.
