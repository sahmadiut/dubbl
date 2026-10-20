# Payroll overview and navigation catalogs - LOC-079

44 paired `PayrollOverview` messages; 7,054 compatible keys per locale.
Persian terminology is provisional. LOC-067/008/002 retain independent combined
acceptance; native terminology, full date/numeral/RTL/browser/output and release
qualification remain separate.

## Owned display and response boundaries

| Source | Extracted display |
|---|---|
| `app/(dashboard)/payroll/page.tsx` | Document/page title, ghost summaries, setup help and steps, first employee action, populated summaries, recent runs, period prose, all five run statuses, breakdown legend, quick actions and finite read/organization feedback |
| `app/(dashboard)/payroll/layout.tsx` | Nine navigation labels and the tax liability explanation; existing exact overview matching and detail-page tab hiding retained |
| `app/(dashboard)/payroll/loading.tsx` | No authored copy; delegates to the already catalogued shared BrandLoader |

`i18n/payroll-overview-presentation.ts` checks HTTP success, JSON/envelope shape,
required display fields, finite statuses and real Gregorian date-only values.
It reuses `payrollJson` and its exact cents/alias/currency validation. Every
displayed money field and matching `*Minor` string must be present, including
zero. Negative run totals remain valid for correction runs. Nullable historical
currencies retain the existing USD display fallback. No payload is normalized,
rescaled or rewritten.

The effect adopts employees and runs together only after both reads validate.
Non-2xx responses, bad JSON, malformed records and network/storage failures show
finite translated feedback, without raw server/parser text or dynamic unknown
catalog keys. Missing organization context ends loading without a request.
Cleanup suppresses late success, failure and loading setters after unmount.

## Intentional exceptions and preserved contracts

- Employee IDs, names, numbers and positions remain caller data; this overview
  does not display names/positions/numbers. Employee identifiers are not
  translated or persisted differently. Run IDs retain canonical navigation.
- Canonical Gregorian period strings remain unchanged. Only surrounding `to`
  prose is translated. Step numerals 1/2/3, numerical counts, slash separators,
  grouped-currency separator and missing-value dash retain existing presentation.
  Full numeral/calendar/date/RTL qualification belongs to later acceptance.
- `payrollMoneyDisplay`, `payrollGroupedDisplay`, `payrollShare`, salary/12
  half-away-from-zero rounding and bigint aggregation remain unchanged. Payroll
  retains legacy two-decimal cents for every ISO scale. Unlike currencies stay
  separate. Existing completed-run paid summary, draft count, first-five recent
  list and completed-or-latest breakdown selection are unchanged; this task does
  not change their reporting period or pagination semantics.
- All five machine statuses remain `draft`, `processing`, `completed`, `void`,
  `pending_approval`. Their labels are finite display translations; English uses
  readable capitalization and `Pending approval` instead of the machine token.
- Routes, organization header, GET methods, localStorage key `activeOrgId`,
  drawer type `employee`, navigation order/icons, CSS, controls and animations
  are retained. The unused `grossPct` local was removed; rendered chart widths
  still come from the existing exact share helper.
- No new operation or REST/MCP contract was introduced. Existing scoped
  `list_payroll_employees` and `list_payroll_runs` tools provide both overview
  reads through the same services as REST. Employee/run creation remains linked
  through existing drawers/routes/tools and belongs to later children.
- No API/service/MCP, authorization, schema/migration, ledger/payroll
  calculation, statutory identifier/rule, FX/IRR flag or Stripe source changes.

## Source-inspected LOC-067 split

27 route TSX files total 10,917 lines before extraction, plus EmployeeDrawer and
ContractorDrawer in the shared creation file. All are assigned below. LOC-067
retains independent combined acceptance and may subdivide broad children after
further inspection.

| Child | Payroll-relative route scope and shared ownership |
|---|---|
| LOC-079 | Root page, layout, loading |
| LOC-080 | Employee list and EmployeeDrawer only |
| LOC-081 | Employee detail |
| LOC-082 | Contractor list/detail and ContractorDrawer only |
| LOC-083 | Run list and off-cycle dialog |
| LOC-084 | Run detail |
| LOC-085 | Run payslips, tax form list/detail; inventory adjacent generated output ownership |
| LOC-086 | Time/leave configuration page |
| LOC-087 | Leave list/detail and timesheet list/detail |
| LOC-088 | Self-service |
| LOC-089 | Compensation and review detail |
| LOC-090 | Analytics, forecasting, report list/detail |
| LOC-091 | Tax liabilities |
| LOC-092 | Settings |

## Verification boundaries

Eleven focused tests render production JSX with real next-intl and
PresentationProvider, real shared TabLayout and controls, controlled hooks/IO.
They check empty/populated/employee-only/loading/error states, all statuses,
navigation actions/detail hiding, document title, large exact amounts and
separate USD/JPY/KWD groups, source-copy coverage and Persian script. Read
callbacks check atomic adoption, missing organization, malformed data/HTTP/JSON,
network/storage failures and cleanup. Existing migrated payroll master and run
fixtures now pass actual REST and linked registered MCP lists through the new
reader. Existing independent SQL, tenant, permission, migration, cents, FX,
posting/lifecycle and rollback checks remain in those fixtures. See
[attempt](../evidence/LOC-079-attempt-1.md) and
[honest self-review](../evidence/LOC-079-review-1.md) for observed results.
