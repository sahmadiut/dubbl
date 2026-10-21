# Payroll analytics, forecasting and reports catalogs

LOC-090 owns `analytics/page.tsx`, `forecasting/page.tsx`, `reports/page.tsx`
and `reports/[type]/page.tsx` under `app/(dashboard)/payroll/`.
The 64 paired `PayrollAnalytics` messages cover document titles, report cards,
summary fields, forecast and scenario controls/results, empty states, date
filters, table headings, navigation, CSV actions and finite read/scenario/export
feedback. Employee counts use ICU plurals. The detail summary uses an explicit
field-to-message list; API field names are no longer generated display labels.

## Preserved contracts and exceptions

- Report tokens `summary`, `tax-liability`, `labor-cost`, `yoy`, route paths,
  request methods, `x-organization-id`, query/payload keys and the 12-month
  projection/scenario horizon remain machine values.
- Employee and department names are saved data, escaped by React. The service's
  ambiguous `Unassigned` department fallback stays unchanged: the wire currently
  cannot distinguish it from an actual department with that name. Native/output
  integration review owns any future explicit fallback identifier.
- Gregorian `YYYY-MM-DD` date inputs/query values and `YYYY-MM` row labels remain
  canonical. Date filters keep their existing server behavior, including the
  year-over-year operation's all-history grouping. Calendar/numeral presentation
  and complete RTL/layout qualification remain separate tasks.
- Currency codes, fixed-two payroll cent displays, canonical `*Minor` aliases,
  input defaults/units, numeric headcounts and plain salary-adjustment percentages
  are unchanged. Labor costs retain separate groups for each department/currency.
  Server calculations/aggregation, rounding, authorization and org scope remain.
- CSV header/data, filename `payroll-export.csv`, MIME type, formula protection
  and authenticated download helper are backend-owned machine/export contracts.
  Only the visible action and failure feedback are localized here. No CSV bytes
  or shared export helper are changed.
- Numeric values, percent/plus/minus symbols, currency prefixes, CSS classes,
  skeletons and icons are not prose messages. Shared BrandLoader, PageHeader,
  Input, CurrencyInput and Button retain their existing ownership.

`payrollAnalyticsJson` rejects failed HTTP, malformed JSON/envelopes, invalid
display fields and missing/conflicting exact aliases before state adoption.
It accepts the actual REST/MCP summary, labor, tax, yearly, projection and scenario
envelopes. Scenario differences are checked using bigint. Server/network/parser
diagnostics stay internal and map to finite translated messages. Analytics reads
adopt summary/projection atomically. Effect cleanup prevents obsolete results
from changing state. Missing organization/unavailable storage releases loading.
Report filters remain available after a failed read, while stale data is hidden.
Scenario failures retain input fields, clear prior results and release busy state.

Existing tools `get_payroll_summary`, `get_payroll_labor_cost`,
`get_payroll_tax_liability`, `get_payroll_yoy`, `export_payroll_csv`,
`project_payroll_costs` and `forecast_payroll_what_if` cover these operations.
No REST route, MCP tool, schema, migration, statutory behavior, stored amount,
provider integration or Stripe source is changed.

## Acceptance boundary

Real production JSX is rendered through next-intl and PresentationProvider in
both locales, with controlled hooks/IO for callbacks. Focused checks cover
plurals, exact high/low/signed cents, escaped saved data, all report variants,
navigation, Gregorian filters, reads, scenarios, authenticated CSV downloads,
negative responses, missing storage/org and obsolete reads. Migrated fixtures
feed actual REST and linked MCP success envelopes through the reader alongside
their existing independent SQL and authorization assertions.

Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance. Native terminology, complete RTL/calendar/numerals, mounted browser
and keyboard, hosted CI, deployment and production qualification remain open.
See [attempt evidence](../evidence/LOC-090-attempt-1.md) and
[Codex self-review](../evidence/LOC-090-review-1.md) for actual results.
