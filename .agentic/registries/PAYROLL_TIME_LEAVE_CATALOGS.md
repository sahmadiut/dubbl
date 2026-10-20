# Payroll time and leave catalogs - LOC-086

75 paired flat `PayrollTimeLeave` messages; 7,594 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent integration
acceptance, followed by native terminology and full RTL qualification.

## Owned presentation and behavior

`app/(dashboard)/payroll/time-leave/page.tsx` owns the document title, topbar
actions, four statistics, timesheet/leave views, filters, search/clear/sort,
empty guidance, finite saved status labels, date/hour templates and ICU plural
counts, creation drawers, busy states, rejection confirmation and success/error
feedback. Icon-only search clear actions now have cataloged accessible names.
Shared BrandLoader continues to use `SharedUI.loading2`.

`i18n/payroll-time-presentation.ts` checks HTTP/JSON/envelopes, displayed list
and choice fields, unique IDs, pagination, finite statuses, ordered canonical
dates and nonnegative binary32 hours before adoption. Existing `payrollJson`
still checks nested employee money aliases and currency. Creation responses
require the navigation/request ID and expected leave status; approval/rejection
also require the matching request ID. Unknown diagnostic prose stays internal.

Initial list/choice effects ignore obsolete results and catch failures. Missing
organization or unavailable local storage releases initial loading. Failed
pagination preserves the existing list/page and releases busy. Failed creation
preserves the form/drawer and releases saving. Successful leave mutations use a
checked first-page refresh; refresh failures retain the successful mutation and
report a separate translated read failure. Rejection still requires the existing
confirmation before sending its unchanged empty-object payload.

## Exceptions, contracts and adjacent ownership

- Saved employee/policy names, employee numbers, reasons, IDs and `-` remain
  escaped data. Canonical Gregorian date inputs/display strings and numeric
  hour input remain unchanged. Only connectors and hour suffixes are messages;
  complete calendar/numeral and RTL presentation remains independent.
- All four timesheet and four leave statuses receive finite labels; cancelled
  leave remains visible in the all filter. Existing filter choices, sort values,
  machine-status sorting, search semantics, page size and loaded-dataset
  statistics remain unchanged. No new filter or altered statistics is implied.
- Hours remain physical binary32 quantities, including 7.5 and 0.25, never
  monetary minor units or minutes. Existing leave-hours parsing, employee
  monetary aliases, fixed-two payroll cents, saved values, FX, statutory
  identifiers, calculations, authorization and organization scope are preserved.
- Existing `/api/v1/payroll/timesheets`, `/leave/requests`, approval/rejection,
  employee and policy requests retain methods, headers, query/payload fields
  and navigation. No API, schema, migration, provider, IRR flag or Stripe change.
- Existing org-scoped `list_payroll_timesheets`, `create_payroll_timesheet`,
  `list_payroll_leave_requests`, `create_payroll_leave_request`,
  `approve_payroll_leave_request`, `reject_payroll_leave_request`,
  `list_payroll_employees` and `list_payroll_leave_policies` cover these user
  operations through shared services. No new MCP operation is needed.
- This page has no shift or policy editor. Existing shifts/schedules/policies
  remain backend/MCP contracts; LOC-087 owns the timesheet detail page and
  LOC-088 owns self-service. LOC-067 retains combined payroll acceptance.
  REST/MCP descriptions and diagnostic prose remain protocol data for the
  broader API/output ownership audit; this page displays finite feedback.

## Verification boundary

Focused tests render production JSX using real next-intl and
PresentationProvider in both locales, with controlled hooks/IO and portal
boundaries. They check all statuses, empty/search/loading/busy states, escaped
caller data, plural counts, unchanged filter/sort values, search/navigation,
pagination and initial reads, cancellation, missing organization/storage,
creation payloads/form retention and approval/rejection/refresh outcomes.
An AST audit rejects remaining authored JSX text and raw visible attributes;
every Persian leaf must contain Persian script.

The migrated time fixture now validates actual successful REST and linked MCP
list/policy/create/approve/reject responses through this reader. Existing
independent SQL, permission/isolation, hours, money, rollback, audit and migration
assertions remain. See [attempt evidence](../evidence/LOC-086-attempt-1.md) and
[Codex self-review](../evidence/LOC-086-review-1.md).

Mounted browser/keyboard, native linguistic review, full RTL/calendar/numerals,
parent integration, hosted CI, deployment and production acceptance remain
independent. No full build or unrequested dev server was run.
