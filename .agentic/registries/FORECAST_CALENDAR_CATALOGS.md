# Forecast and financial calendar catalogs

LOC-109 owns cash-flow-forecast/page.tsx and financial-calendar/page.tsx under
app/(dashboard)/reports, with 39 paired ForecastCalendarReports messages.
This includes headings/descriptions, horizon options, estimates help, chart
series, table labels, finite failures, event kinds, weekday labels, event
overflow counts, empty states, Today and accessible previous/next month names.
BackToReports and BrandLoader retain their shared catalog ownership, alongside
the existing currency and select controls. Persian financial wording remains
provisional pending native review.

## Preserved contracts and explicit exceptions

- Forecast weeks 4/8/12/26/52, weeks/currencyCode query names, currency filters,
  organization headers and /reports return routes retain their machine values.
  The chart uses stable dataKey values to select original bigint inflows,
  outflows and cumulativeNet for exact tooltips; translated names cannot choose
  the monetary carrier. Approximate chart coordinates retain existing behavior.
- Calendar event type identifiers, colors, canonical Gregorian date keys,
  month boundaries, Sunday-first order, day selection/toggle, Today navigation,
  per-date truncation and event ordering remain. Gregorian month/date labels,
  dates, day numerals, currency codes, amount formatting, abbreviated chart-axis
  geometry/k and dash placeholders remain formatting/data exceptions. Full
  Persian-calendar/numeral/timezone/RTL qualification is separate from catalog
  extraction; translating weekdays does not change Gregorian query ranges.
- API-supplied event titles combine caller contact/document/template/budget
  names and identifiers. They remain escaped data, including the existing
  compact title split at " - ". The server's missing-contact Customer/Supplier
  fallback inside that opaque title remains an explicit server-output exception:
  no unsafe parsing or replacement of caller text is introduced. Structured
  title localization can be accepted separately with the parent/output work.
- Existing exact-money readers, aliases, sign/color predicates and mixed-currency
  event amounts remain; amounts are never combined across currencies. Failed
  requests use finite translated copy and clear invalid rows/totals. Missing-org
  and cancelled-effect guards retain their existing behavior.

cash_flow_forecast and financial_calendar already provide registered scoped
direct-service MCP operations. REST/MCP handlers, authorization, schema,
migrations, exports, FX/IRR flags and Stripe are unchanged.

## Verification and handoff

Production JSX tests use real next-intl, PresentationProvider and shared UI,
controlling page hooks/IO/animation. They exercise copy, exact tooltip callbacks,
selection/query values, leap-day and year rollover, caller escaping, separate
currency amounts, HTTP/JSON/money/network rejection, cancellation and missing org.
Portal options and chart props are inspected directly; no mounted browser
coverage is inferred. Migrated PostgreSQL fixtures exercise actual REST,
registered MCP and SQL assertions.

See [evidence](../evidence/LOC-109-attempt-1.md) and
[honest self-review](../evidence/LOC-109-review-1.md). LOC-070/008/002 retain
independent combined acceptance. Native terminology, full RTL/date/numeral,
browser, adjacent output, hosted CI and release qualification remain separate.
Next bounded task: LOC-110.
