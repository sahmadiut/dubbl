# Payroll run detail catalogs - LOC-084

99 paired flat `PayrollRunDetail` messages; 7,436 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance, followed by native terminology, RTL and release qualification.

## Owned presentation

`app/(dashboard)/payroll/runs/[id]/page.tsx` owns the document title, back/not-found
states, pay-period connector, status/run-type/approval badges, processing date,
sign-off/finish/approve/reject actions and confirmations, busy/success/failure
feedback, gross/deduction/net summary, journal summary/link/absence, employee
count/search/clear/absence, item types and money labels, bonus count/type/list/
absence and creation dialog, and generate/view payslip actions.

`payrollRunDetailJson` checks HTTP success, object envelopes, required displayed
fields, finite enums, canonical pay-period dates, processed timestamp, IDs,
exact-rate text and nullable employee fields. It delegates all supplied money
and currency checks to existing `payrollJson`, and reuses the overview reader
for required run totals and dates. Bonus/generation mutations require their
actual bonus/count envelopes before displaying success. All server, parser,
storage and network errors use finite translated feedback.

Initial reads adopt run and bonuses together after validation; missing
organization/storage failure releases loading with translated feedback.
Detail HTTP 404 retains the not-found state. Effect cleanup ignores obsolete
fulfillment/failure and avoids starting a later bonus read. Bonus creation
refreshes and validates both collections before updating them or resetting the
form. Failed mutations release busy and preserve form/dialog state, with no
success, reload or navigation. Confirmation cancellation still sends no request.

## Exceptions and preserved contracts

- Shared `BrandLoader` uses `SharedUI.loading2`. `employeeOption` deliberately
  contains only escaped `{name} ({number})` in both catalogs. All other Persian
  leaves contain Persian script. The display fallback `-`, FX marker `@`,
  canonical date/UTC timestamp strings, IDs, employee numbers, currency codes,
  saved exact rates, employee names and saved descriptions remain data.
  Descriptions include caller text and existing service-generated defaults;
  this slice does not translate or reinterpret persisted descriptions.
- Statuses `draft`, `processing`, `completed`, `void`, `pending_approval`, run
  types `regular`, `termination`, `bonus_only`, `correction`, `off_cycle`,
  approval `pending`/`approved`/`rejected`, all eight item types and all seven
  saved bonus types keep their machine values. The creation picker retains
  its existing six choices/order; saved `spot` bonuses have translated badges
  without adding a new picker option. Existing action visibility, approval
  constraints and employee deduplication/search remain.
- Payroll remains legacy fixed-two cents regardless of ISO scale. Existing
  `payrollMoneyDisplay`, `payrollCentsInput` and bigint `payrollSum` remain;
  null currency still defaults to USD. No change to stored money, FX,
  calculations, authorization, statutory identifiers, schema/migrations,
  IRR enablement, provider or Stripe files/functionality.
- Lifecycle POSTs retain their existing paths, organization header and absent
  body. Bonus POST retains employee ID, machine bonus type, canonical
  `amountMinor` and nullable description. Refresh, reload, journal and payslip
  navigation retain their paths. No REST/MCP definition changed.
- Existing org-scoped `get_payroll_run`, `process_payroll_run`,
  `submit_payroll_run_for_approval`, `approve_payroll_run`, `reject_payroll_run`,
  `list_payroll_run_bonuses`, `create_payroll_run_bonus` and `generate_payslips`
  already cover these actions through the shared services and registered MCP.

## Verification boundary

The focused suite renders production JSX via real next-intl and
PresentationProvider in both locales. Hooks/IO and portal boundaries are
controlled; mounted browser/keyboard qualification is not claimed. It covers
populated/empty/not-found/loading/error/busy states, enum labels and unchanged
picker values, escaped data, exact maximal cents/bigint sums, filtering and
navigation, checked reads/cleanup, actual lifecycle confirmations and POSTs,
bonus payload/refresh, failure retention, malformed responses and copy audit.

The migrated run and output workers pass real REST and linked registered MCP
responses through the new reader for detail/lifecycle, bonus list/create and
payslip generation. Existing independent SQL, balanced-ledger, authorization,
isolation, rollback, audit and migration-preservation assertions remain.
See [attempt evidence](../evidence/LOC-084-attempt-1.md) and
[Codex self-review](../evidence/LOC-084-review-1.md) for observed results.

Native Persian, full RTL/numerals/calendar, remaining payroll outputs,
hosted CI, deployment and production acceptance remain independent.
