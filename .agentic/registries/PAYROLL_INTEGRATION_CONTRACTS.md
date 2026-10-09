# Integrated payroll contracts (MON-025)

Verified 2026-10-09, Asia/Tehran; implementing-assistant self-review. Parent
acceptance joins MON-079..085 without replacing their bounded operation contracts.
This establishes the supported legacy/exact wire behavior on synthetic PostgreSQL
fixtures, not production accounting or statutory payroll qualification.

## Complete boundary inventory

Each linked registry specifies actual REST paths, MCP names, response envelopes,
permissions, inputs, outputs, units, null behavior and supported ranges.

| Boundary | Authoritative operation contract | Actual regression fixtures |
|---|---|---|
| Employee/contractor master CRUD | [PAYROLL_MASTER_WIRE_CONTRACTS](PAYROLL_MASTER_WIRE_CONTRACTS.md) | payroll-master.test.ts |
| Settings, deduction types/assignments, tax brackets/allowances/elections | [PAYROLL_CONFIG_WIRE_CONTRACTS](PAYROLL_CONFIG_WIRE_CONTRACTS.md) | payroll-config.test.ts |
| Timesheets/entries, shifts/schedules, leave/policies/balances, self-service time | [PAYROLL_TIME_WIRE_CONTRACTS](PAYROLL_TIME_WIRE_CONTRACTS.md) | payroll-time.test.ts |
| Regular/bonus/termination/correction runs, items, bonuses, approvals and posting | [PAYROLL_RUN_WIRE_CONTRACTS](PAYROLL_RUN_WIRE_CONTRACTS.md) | payroll-runs.test.ts |
| Contractor payments and payroll tax remittances | [PAYROLL_PAYMENT_WIRE_CONTRACTS](PAYROLL_PAYMENT_WIRE_CONTRACTS.md) | payroll-payments.test.ts |
| Compensation bands/reviews/entries, equity and forecasts | [PAYROLL_COMPENSATION_WIRE_CONTRACTS](PAYROLL_COMPENSATION_WIRE_CONTRACTS.md) | payroll-compensation.test.ts |
| Payslips, reports/CSV, tax-form data and self-service profiles/outputs | [PAYROLL_OUTPUT_WIRE_CONTRACTS](PAYROLL_OUTPUT_WIRE_CONTRACTS.md) | payroll-outputs.test.ts |

All fixture paths are under tests/integration. Their workers invoke real Next
handlers through API-key authentication and real MCP SDK in-memory transport;
they do not replace services with mocks or require a running dev server. Parent
payroll-integration.test.ts independently combines these domains in one database.

Money keeps existing integer cents, with agreeing canonical ASCII *Minor strings.
Signed correction amounts retain signs; nullable money retains paired nulls.
The effective legacy-compatible range is +/-9007199254740991, further restricted
by each operation's sign rules. Valid int64 strings beyond that range reject
with 422 LEGACY_NUMERIC_RANGE before mutation. This is safe-number coexistence,
not full-int64 consumer adoption. Salary is annual, rates are cents per hour,
tax rates are basis points, deduction/premium/adjustment percentages are ordinary
percent, physical hours are lossless binary32 quantities, dates are Gregorian,
and instants are UTC. Neither currency labels nor magnitude rescale stored money.
FX uses saved quote_per_base exact-decimal snapshots, distinct from approximate
legacy payroll float fields. Unsupported currency/history/precision rejects.

## Cross-domain financial evidence

The parent fixture creates a legacy salary employee at annual 120000 cents and
an exact-client hourly employee at 29 cents/hour. Adopted configuration creates
a 29-cent pre-tax deduction; actual timesheet operations approve 7.5 hours.
The resulting monthly run contains salary gross 10000, withholding 997,
deduction 29 and net 8974; hourly gross/net rounds once to 218. Base USD totals
are gross 10218, deductions 1026, net 9192. Concurrent REST/MCP processing returns
one journal whose debit and credit totals both equal 10218.

Payslip generation retries add no snapshots, both transports return identical
saved amounts, self-service returns only the linked salary employee's payslip,
and summary/labor/tax reports agree. Forecast/proposal REST/MCP outputs agree.
Changing salary, hourly rate and deduction defaults, and creating a future
compensation proposal, preserves complete payroll_item, journal, payslip and
tax/deduction-breakdown rows. The completed-run summary remains 10218 gross. These edits affect future
inputs; they do not recompute posted history.

An EUR contractor's 1250-cent payment posts 1500 USD at exact 1.2. Changing the
live rate to 1.5 and master hourly rate to 2500 leaves the paid payment's amount,
base amount and saved FX unchanged on retry. Currency changes with item/payment
history reject 409. Payroll-settings currency changes with run history reject.

Whole-slice table snapshots cover unsupported safe ranges, conflicting aliases,
unknown organization fields, foreign run/payslip/deduction access and permission
denials. Existing child fixtures additionally cover all listed operations,
audit/DTO rollback, period locks, idempotency and corrupt historical references.
Migration regressions preserve complete historical run/item, contractor/tax
payment and compensation review rows without unit/FX reinterpretation.

## Lock-order correction

Parent verification reproduced a PostgreSQL 40P01 deadlock: an employee update
held the employee while run creation held the organization; the update's audit
foreign-key check then waited for the organization. Employee create/update/delete
now lock the organization before employee/member work, matching configuration,
time, run, payment and compensation writers. Both REST and MCP share this fix.
This also serializes employee creation with the run's eligible-employee selection.

The parent fixture deterministically holds an organization lock and starts actual
REST employee update/delete requests. It observes their database lock wait, then
acquires the employee with FOR UPDATE NOWAIT, proving the writer has not acquired
the employee first. Releasing the organization allows each request to finish.
Concurrent employee-currency/run-creation and contractor-currency/payment-creation
calls allow either serialized order: created snapshots match the final master
currency, or the currency edit rejects 409. Unexpected 500/MCP internal errors
fail the fixture. Values 10000 and 1250 retain their original integer units.

## Qualification limits

PostgreSQL 18 local fixtures, API-key REST handlers and in-memory MCP transport
are verified. Browser/session/OAuth/network transport, full-int64 consumers,
statutory compliance, real PDF rendering/layout, high-volume performance,
independent accounting/security review, PostgreSQL 16 and production migrations
remain downstream qualification. Tax form /pdf still returns its documented JSON
data envelope. No schema/migration, historical rescale, IRR rollout, deployment,
external provider, build, dev server or Docker action is introduced by MON-025.
