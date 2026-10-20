# Payroll self-service catalogs - LOC-088

42 paired flat `PayrollSelfService` messages; 7,731 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance, followed by native terminology and full RTL qualification.

## Owned presentation and behavior

`app/(dashboard)/payroll/self-service/page.tsx` owns the document title, profile
and history headings/descriptions, statistics, edit labels, save/busy feedback,
empty and missing states, period connectors, net-pay label, hour units, seven
finite saved leave-type labels and four finite timesheet status labels.
`BrandLoader` retains its existing shared loading catalog ownership.

`i18n/payroll-self-service-presentation.ts` checks successful HTTP/JSON/envelopes,
displayed fields, canonical ordered dates, generated timestamps, unique record
IDs, exact payroll money aliases, finite labels and physical binary32 hours.
The page resolves its authenticated profile before reading its three histories;
each history must match that employee ID. Profile PATCH responses must match
the selected employee. Existing payrollJson checks nested money/currency values.
No internal server/parser/storage/network prose becomes visible feedback.

Missing organization or unavailable storage releases loading and shows a finite
translated error. Profile HTTP 404 retains the missing-profile state and clears
old read errors. Other failed reads adopt no partial profile/history/form data.
Effect cleanup ignores obsolete success and failure, including late history.
Saving retains email/bank fields on failure, releases busy state in finally and
shows success only after a checked response. It does not initiate a refresh.

## Exceptions and preserved contracts

- Saved employee identity/number, position, bank account, email and policy names
  remain escaped data; `-` retains its existing missing-value presentation.
  Leave types describe existing database enum values; they do not establish
  Iranian statutory entitlements or classify saved policy names.
- Counts, decimal hour strings and canonical Gregorian periods retain their
  existing values. The generated date keeps its existing browser
  `toLocaleDateString()` display. Complete calendars/numerals and RTL are
  separate acceptance. Physical 7.5/0.25 hours are neither money nor minutes.
- Payroll fixed-two cents and canonical `*Minor` strings remain unchanged for
  all currencies. Money uses the existing payroll display adapter; no derived
  sum or currency conversion is introduced. Existing ten-payslip/five-timesheet
  display limits and full payslip count remain unchanged.
- Existing GET routes, PATCH, organization headers and payload fields are
  preserved. Empty email/bank values retain the existing optional omission
  behavior. No employee override, authorization, schema/migration, financial
  calculation, statutory identifier, provider, IRR flag or Stripe change.
- Existing org-scoped `get_payroll_self_profile`, `update_payroll_self_profile`,
  `list_payroll_self_payslips`, `get_self_payroll_leave_balances` and
  `list_self_payroll_timesheets` already cover the same operations. Their real
  REST/linked MCP responses pass the new reader in the migrated output/time
  fixtures alongside existing independent SQL and authorization assertions.

Real production JSX renders through next-intl/PresentationProvider in both
locales; controlled hooks and IO exercise reads and saves. These checks do not
constitute mounted-browser/keyboard, native Persian, full RTL, parent integration,
hosted CI, deployment or production acceptance. No full build or dev server ran.
