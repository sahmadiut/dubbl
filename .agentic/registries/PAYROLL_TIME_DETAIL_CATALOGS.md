# Payroll leave and timesheet list/detail catalogs - LOC-087

95 paired flat `PayrollTimeDetail` messages; 7,689 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent integration
acceptance, followed by native terminology and full RTL qualification.

## Owned presentation and behavior

The four `app/(dashboard)/payroll/leave/page.tsx`, `leave/[id]/page.tsx`,
`timesheets/page.tsx` and `timesheets/[id]/page.tsx` routes own document titles,
headings/descriptions, filters, search, empty/missing states, creation dialogs,
finite saved status/shift labels, date/hour summaries, entry controls,
approval/deletion confirmations, rejection dialogs and mutation/read feedback.
The icon-only entry deletion control has a cataloged accessible name.
Shared BrandLoader retains its existing `SharedUI.loading2` ownership.

`i18n/payroll-time-presentation.ts` reuses the existing list/choice/create/leave
mutation reader and adds checked detail, entry create/delete and timesheet
transition envelopes. Detail fields, ordered canonical dates, physical binary32
hours, unique in-period entries, finite status/shift labels, rejection reasons
and approval timestamps are checked before adoption. The underlying payrollJson
continues to check nested employee/project money aliases and currencies.
Detail reads and approval/rejection/submission responses must match the selected
record ID. Mutation success is accepted only after HTTP/envelope validation.
Internal server/parser/network diagnostics never become visible feedback.

Initial effects ignore obsolete success and failure. Missing organization or
unavailable storage releases loading. Explicit detail HTTP 404 responses map to
the translated missing-record state. Other read failures show finite translated
feedback. Failed creation/rejection/entry writes retain their fields and dialog;
existing creation/approval/rejection busy states release in finally. Successful
mutations retain success when follow-up reads fail and show a separate read
error, preserving the last checked data. Successful entry deletion refreshes
only after a checked `{success:true}` response.

## Exceptions and contract preservation

- Employee/policy names, employee numbers, reasons, descriptions, IDs and `-`
  remain escaped saved data. Policy names remain names rather than inferred
  statutory leave classifications. All four timesheet/four leave statuses and
  all five entry shift categories have finite translated labels. Existing
  filter options, machine values, style classes and search behavior remain.
- Canonical Gregorian date strings, native date/number inputs, fractional hours
  and count strings remain unchanged; only authored connectors and units are
  cataloged. The approved-on value retains its existing browser
  `toLocaleDateString()` behavior. Full calendar/numeral and RTL formatting is
  a separate acceptance gate. Hours remain physical quantities, including 7.5
  and 0.25, never monetary cents or minutes.
- Existing cents aliases, stored values, FX, calculations, statutory identifiers,
  organization scope and authorization remain unchanged. No REST/MCP route,
  request method/header/payload, schema, migration, provider, IRR flag or Stripe
  functionality changed. Rejection reason trimming/optional omission and entry
  date/hour/shift/description payloads retain their current contracts.
- Existing org-scoped `list_payroll_timesheets`, `get_payroll_timesheet`,
  `create_payroll_timesheet`, `create_payroll_timesheet_entry`,
  `delete_payroll_timesheet_entry`, `submit_payroll_timesheet`,
  `approve_payroll_timesheet`, `reject_payroll_timesheet`,
  `list_payroll_leave_requests`, `get_payroll_leave_request`,
  `create_payroll_leave_request`, `approve_payroll_leave_request`,
  `reject_payroll_leave_request`, `list_payroll_employees` and
  `list_payroll_leave_policies` cover the owned operations via shared services.
  No new MCP tool is needed. REST/MCP diagnostics remain protocol data.
- LOC-086 owns the adjacent time-leave overview; its existing reader behavior
  remains covered by its focused suite. Self-service belongs to LOC-088,
  and LOC-067 retains combined payroll acceptance. Shift/policy configuration
  and generated statutory outputs retain their separate ownership.

## Verification boundary

Production JSX renders with real next-intl/PresentationProvider in both locales,
with controlled hook/IO and portal boundaries. Tests check escaped saved data,
all status/shift labels, canonical dates/fractional hours, unchanged choices,
empty/missing/busy/loading/error states, authored JSX/visible attributes and
Persian script. Behavior assertions cover initial reads, cleanup, malformed
responses, unavailable storage, missing organization, filtering/search/navigation,
creation payloads, confirmations/cancellation, entry add/delete, submission,
approval/rejection, failed-form retention, busy release and refresh failures.

The migrated payroll time fixture now passes real successful REST and linked
registered MCP detail, entry create/delete and timesheet transition responses
through this reader, alongside the existing list/choice/create/leave operations.
Independent SQL, permission/isolation, hours, exact money, rollback, audit and
migration-preservation assertions remain. See [attempt evidence](../evidence/LOC-087-attempt-1.md)
and [Codex self-review](../evidence/LOC-087-review-1.md).

Mounted browser/keyboard, native terminology, full RTL/calendar/numerals, parent
integration, hosted CI, deployment and production acceptance remain independent.
No full build or unrequested dev server was run.
