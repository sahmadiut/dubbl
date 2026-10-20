# Payroll employee detail catalogs

LOC-081 owns `app/(dashboard)/payroll/employees/[id]/page.tsx` and its checked
presentation reader. It adds 92 paired `PayrollEmployeeDetail` messages; the
complete catalogs contain 7,192 compatible keys per locale. LOC-067/008/002
retain independent combined acceptance. Persian terminology is provisional.

## Inventory and exceptions

| Surface | Catalog coverage | Preserved data or shared ownership |
|---|---|---|
| Document title, back/not-found, profile header | Title, status, linked-member interpolation, activate/deactivate | Employee names, numbers, positions, member names/emails remain escaped saved data |
| Personal and employment details | Section descriptions, labels, bank and date labels | Bank account strings and disabled Gregorian date inputs remain canonical |
| Compensation | Salary/hourly/milestone/commission, weekly/biweekly/monthly, annual/per-period pay, tax/currency labels | Machine enum values, ISO codes, currency picker, exact payroll display/input helpers unchanged |
| Deductions | Section/empty state, pre/post-tax badges, active status, missing amount | Type names remain saved data; override/default amount and percentage precedence preserved |
| Tax configuration | Filing statuses, allowances, additional withholding, saving/success/failure | Existing federal/state statutory concepts and filing codes retained; no Iranian-law substitution |
| Leave balances | Section/empty state, seven leave types, balance/used and hour suffix | Policy names, fractional hours and original order retained; REST data envelope now consumed correctly |
| Compensation band | Section, name/min/mid/max/range labels | Saved band name, exact cents, band currency, range calculation and currency comparison preserved |
| Save and deletion | Actions, confirmation, saving/success and finite failure feedback | PATCH/PUT/DELETE methods, organization header, navigation and payload keys unchanged |

Structural separators (`·`, `-`, `%`), numeric input steps/defaults and money
outputs remain technical presentation. Hour values use a string ICU argument
to retain existing numeric precision; numeral/calendar formatting is separate.
CurrencySelect, CurrencyInput, Section, BrandLoader and confirmation-dialog
primitives retain their existing shared ownership. There is no schedule editor
in this page; schedule management belongs to the later payroll time slice.

## Response and behavior boundary

The reader calls `payrollJson`, checks HTTP success, envelopes, displayed fields,
finite enums/counts/hours/dates and required exact money aliases before state
adoption. Null historical currency, hourly money and withholding stay supported.
Employee read/update, deduction list, tax read/update, leave balances, band read
and deletion success each use their existing operation envelope. HTTP 404 on
the initial employee read shows the translated not-found state.

Network/parser/validation/server prose never becomes UI text. Organization
storage failures and missing selection release loading with finite feedback.
Read cleanup suppresses late results; verified profile/section state is adopted
together, and a failed save retains user input. Delete failures are caught and
never navigate or claim success. Optional blank profile fields remain null;
salary/withholding/hourly cents use canonical Minor strings, tax rates remain
basis points, and allowance counts remain counts. No stored amounts are rescaled.

Existing org-scoped `get_payroll_employee`, `update_payroll_employee`,
`delete_payroll_employee`, `list_payroll_employee_deductions`,
`get_payroll_employee_tax_config`, `update_payroll_employee_tax_config`,
`get_employee_leave_balances` and `get_compensation_band` tools retain their
shared services, permissions and contracts. The leave MCP envelope is `balances`;
REST uses `data`; MCP also flattens policyName/leaveType rather than nesting
policy. The fixture explicitly adapts those existing display fields for reader
comparison. No REST/MCP/service, schema/migration, ledger, statutory rule,
FX/IRR flag or Stripe implementation changed.

## Verification and handoff

The focused tests render real production JSX through next-intl and
PresentationProvider, with controlled hooks, navigation/IO and portal/currency
picker boundaries. They cover both locales, copied source text, Persian script,
escaping, enums, exact money, deduction defaults, leave hours, band currency,
empty/loading/error/saving states, checked initial reads, stale cleanup,
profile/tax payloads, failed-save retention, confirmation, deletion and missing
organization. Actual migrated REST and registered MCP fixtures exercise the
reader alongside independent SQL, tenancy, permission and rollback assertions.

Observed commands/results and honest review are in
[attempt evidence](../evidence/LOC-081-attempt-1.md) and
[Codex self-review](../evidence/LOC-081-review-1.md).
Native linguistic, mounted browser/keyboard, complete RTL/numeral/calendar,
output translation, hosted CI, deployment and release acceptance remain separate.
