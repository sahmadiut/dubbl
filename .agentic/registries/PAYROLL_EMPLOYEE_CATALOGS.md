# Payroll employee list and creation catalogs - LOC-080

46 paired `PayrollEmployees` messages; 7,100 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance; native terminology, full RTL, numeral/calendar and release
qualification remain separate.

## Owned display and validation

| Source | Catalog coverage |
|---|---|
| `app/(dashboard)/payroll/employees/page.tsx` | Document title, team setup, empty/help/action copy, status tabs and badges, search and clear label, sort options and toggle label, loading, filtered absence, pay frequency labels, read and missing-organization feedback |
| `components/dashboard/create-drawer.tsx`, `EmployeeDrawer` only | Title/help, personal/compensation/details sections, field labels and human examples, frequency options, create/required/organization feedback, success and busy button |

The list reuses `payrollOverviewJson` for HTTP, JSON, envelope, required display
fields, boolean/frequency, ISO currency and exact salary/alias checks. Invalid
responses never enter employee state. Translations use only finite message
keys; raw server/network/parser/storage text never enters UI feedback.
Missing organization/storage failures end initial loading and refetching.
The existing `refetch-employees` event clears prior read feedback; only the
latest live request may adopt rows, show failure or finish loading. Cleanup
removes the listener and suppresses late response setters.

`payrollEmployeeCreatedJson` checks HTTP success, JSON/envelope and a nonblank
employee ID before navigation. `payrollJson` verifies any supplied saved monetary
fields and aliases. No money field is required in an ID-only navigation response.
Failed creates retain form state and release saving, including missing
organization or storage failure. Only success closes and navigates.
Shared `DrawerFooter` cancellation remains under `DocumentForms`; its existing
busy-label override now uses the employee-specific translated action.

## Explicit exceptions and contracts

- Employee names, numbers, positions, initials, email, account numbers, IDs and
  currencies remain caller/machine data. Human name/job placeholders are
  translated; technical examples `EMP-001`, `john@example.com`, `75000.00`,
  `20.00`, empty-state decorative `JD`, `AK`, `?`, and layout numerals are
  intentional unchanged examples. Symbols/required stars and fixed cents/date
  formatting retain existing behavior pending later presentation qualification.
- Machine frequencies remain `weekly`, `biweekly`, `monthly`; statuses remain
  `all`, `active`, `inactive`; sort values remain `name`, `number`, `salary`,
  `startDate`; drawer type remains `employee`. Only their labels are translated.
- Search still uses names, numbers and optional positions case-insensitively;
  sorting and ascending/descending behavior remain unchanged. In particular,
  the existing `startDate` sort still uses employee-number order; this extraction
  does not repair sorting semantics or change default list pagination.
- Salary input still uses `payrollCentsInput` and canonical `salaryMinor`,
  including zero, 29 cents and max safe integer cents. Payroll retains fixed
  two-decimal cents for USD/JPY/KWD without rescaling. Salary display remains
  `payrollMoneyDisplay`; the nullable historical currency fallback remains USD.
  Tax percentages still become integer basis points via
  `payrollBasisPointsInput`. Gregorian `YYYY-MM-DD`, optional nulls, currency
  codes, bank/employee identifiers and all request fields remain unchanged.
- `activeOrgId`, REST routes, organization/content-type headers, POST method,
  detail navigation, close/reset behavior, controls, CSS and animations remain.
  Icon-only clear and sort buttons gain translated accessible names.
- Existing org-scoped `list_payroll_employees` / `create_payroll_employee` MCP
  tools use the same master service as REST. No new operation or REST/MCP
  contract, authorization, schema/migration, ledger/payroll calculation,
  statutory rule/identifier, FX/IRR flag or Stripe implementation changes.

## Verification and handoff

The focused suite renders real production JSX with next-intl and
PresentationProvider. Hooks/IO and portal/date/currency-picker boundaries are
controlled; production footer, salary input, money helpers and other controls
are reused. It exercises both locales, empty/populated/error/loading/filter
states, every frequency and sort/status value, escaped data, exact salaries,
canonical callbacks and payloads, failed create retention, safe finite feedback,
refetch, stale-request/unmount behavior, Persian script and source-copy guards.
The existing payroll UI source guard recognizes only the employee page's checked
reader and the translated employee-success path, and verifies both readers
still delegate to payrollJson. Other consumers and Contractor remain guarded.
The migrated payroll-master worker checks actual REST and linked registered MCP
creation responses with the new navigation reader, and retains the existing
list-reader, independent SQL, tenancy, permission, migration and rollback checks.

Observed results and limits are recorded in
[attempt evidence](../evidence/LOC-080-attempt-1.md) and
[Codex self-review](../evidence/LOC-080-review-1.md).
Employee detail belongs to LOC-081. No browser, native linguistic, complete RTL,
hosted CI, provider, deployment or production qualification is implied.
