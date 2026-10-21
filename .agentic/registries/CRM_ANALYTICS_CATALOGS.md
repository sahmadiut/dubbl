# CRM analytics catalogs

LOC-102 owns 18 paired `CrmAnalytics` messages (8,775 compatible leaves per
locale) for `crm/analytics/page.tsx`. Six built-in stage labels reuse
`CrmPipeline`. Persian wording is provisional pending native terminology and
full RTL qualification.

## Coverage and exceptions

- Document title, page description, currency controls, four statistic titles,
  deal summary labels, stage distribution, ICU deal counts, percent sentence
  and finite read failure feedback are catalogued. Shared loading, error and
  currency primitives retain their existing catalogs.
- Built-in stage IDs map to reviewed catalog keys; custom stage IDs remain
  escaped caller data, including their original underscores. The analytics
  response contains IDs rather than configured stage names; this slice does
  not invent names or change the wire shape. Currency codes/symbols and money
  formatting remain explicit exceptions. Summary counts retain their existing
  numeric rendering; full numeral/RTL acceptance remains independent.
- Money retains fixed-two cents, including maximum safe integer values and
  currency labels with other decimal scales. No stored amounts are rescaled.
  Routes, query keys, organization headers, stage IDs and analytics fields are
  unchanged. No schema/migration, authorization, ledger, currency flag or Stripe
  changes are part of this slice.

## Behavior and contracts

`crmAnalyticsJson` validates HTTP/JSON and the complete direct envelope before
adopting data. It delegates saved currency and canonical exact-money alias
checks to `projectCrmJson`, validates nonnegative safe counts, requested currency,
lifecycle count sums, integer conversion rate, exact rounded won average, and
stage count/value consistency using bigint. A stage total may exceed the sum of
open and won value when lost deals contribute value. Counts/percentages retain
their physical units.

Missing organization, storage exceptions, HTTP/network/JSON failures and invalid
envelopes release loading, clear unverified statistics and show finite translated
feedback. The message suggests selecting a currency when deals use multiple
currencies without exposing raw server prose or asserting that every failure is
a currency error. Cleanup ignores obsolete success/failure responses. Currency
change/reset and reload retry retain their existing behavior.

The existing `get_crm_analytics` MCP tool uses the same organization-scoped CRM
service as REST. No service/tool contract change is needed. Disposable PostgreSQL
tests pass real REST and linked MCP replies through the reader for maximum JPY
cents, USD won/lost totals and empty organizations, with independent SQL-text
count/value assertions and existing authorization, scope, audit and rollback
checks retained.

## Verification and handoff

Production JSX renders with real next-intl, `PresentationProvider`, UI and money
code under controlled hooks and IO. Tests cover both locales, document title,
built-in/custom stages, escaping, ICU 0/1/2 counts, exact cents, currency filters,
read rejection, cleanup and retry. The existing money static guard follows the
new checked-reader delegation. Existing namespaces and schema classifications
are unchanged; money consumer hashes/lines are refreshed for owned paths.

See [task evidence](../evidence/LOC-102-attempt-1.md). LOC-069/008/002 retain
independent combined acceptance. No native linguistic/full RTL, browser, hosted
CI, provider, deployment or production qualification is claimed.
