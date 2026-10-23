# Dashboard overview catalogs

LOC-117 owns `app/(dashboard)/dashboard/page.tsx`, its loading-route audit and
`components/dashboard/cash-flow-widget.tsx`, with 99 paired DashboardOverview keys.
Greetings retain their time-of-day/random selection and translate the selected key
at render time. Onboarding, titles, columns, journal status labels, aging buckets,
budget alerts, action cards, KPI labels, period controls, legend and tooltip series
labels use catalogs. Error state stores finite keys so changing locale does not
refetch or expose arbitrary server prose. Chart dataKey and exact payload lookups
remain untranslated.

Audited existing shared widgets: ActivityFeed already uses JournalActivity and
SettingsAudit; ErrorState and BrandLoader use SharedUI. The dashboard loading
route renders that existing localized BrandLoader. No duplicate keys are needed.

Explicit exceptions: caller names, account names and descriptions remain escaped
caller data; entry numbers, canonical date-only text and chart week labels retain
the existing date presentation. Exact-money formatting, percentage/ratio geometry,
currency codes, `#`, `x`, `%`, URLs, IDs, drawer action values, headers, organization
storage key, PATCH body and chart keys remain unchanged. Chart axis compact currency
formatting remains en-US; calendar/numeral/RTL qualification is independently owned.
Aging labels translate the validated five-bucket positions without changing wire
labels. Status labels translate only the existing draft/posted/void values.

Existing REST and direct-DB MCP dashboard/report tools remain the contract surface;
no operation, schema, permission, database or Stripe change is introduced. Relevant
tools include get_dashboard_alerts and cash_flow_forecast. No DB fixture is needed
for this presentation-only slice.

Production JSX tests use real next-intl/PresentationProvider, controlled hook state,
IO and animation/chart wrappers. They check both locales, hostile caller text,
aging/status labels, onboarding PATCH, navigation/drawer callbacks, exact KWD/JPY
amounts, tooltip carriers, periods/currency controls and forecast HTTP/JSON/money/
network failure handling. Full browser layout, native Persian wording, RTL and
LOC-071 combined acceptance remain separate; wording is provisional.
