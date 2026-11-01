# Filtered AI usage reports

AI-055, 2026-11-01. Backend foundation for AI-011, whose assembled dashboard
acceptance remains open. Existing `GET /api/v1/ai/usage` and `get_ai_usage`
retain their original contracts.

## Operations and scope

`GET /api/v1/ai/usage/report` and `get_ai_usage_page` share
`lib/ai/usage-reports.ts`. `GET /api/v1/ai/usage/export` and `export_ai_usage`
share its complete JSON export. Both operations resolve current credential and
membership/role permissions before reading and recheck access before returning.
Own scope is the default and requires `view:ai-history`. Organization scope
requires `view:ai-usage`. Neither permission grants transcript access.

Every query is pinned to the authenticated organization. Organization scope may
filter another user within that organization; own scope rejects another user
with 403. Foreign or unmatched resource filters return no groups, without
disclosing whether those resources exist elsewhere. Organization IDs and site
scope are not accepted as query filters. Site-session aggregates belong to
AI-056; an organization credential cannot request global usage.

Inputs are strict: inclusive `from` and exclusive `to` are UTC ISO instants,
with a positive window of at most 93 days. Optional filters are `userId`,
`providerId`, exact `model`, uppercase billing `currency`, immutable `priceId`,
and attempt `state` (`reserved`, `in_flight`, `unknown`, `settled`, `cancelled`).
UUID filters normalize case. Model filters are exact parameterized values.
Unknown input fields fail validation.

## Pages and exports

Reports accept one-based `page` (1..1000000) and `pageSize` (1..100, default 50).
Groups sort by user/provider/model/currency/price UUID. A group can contain
multiple attempt states; state counts are separate fields. `totalGroups` and
`totalsByCurrency` cover the entire matching scope, even for an empty page
beyond the last page. Empty datasets return zero groups and an empty totals
array. The server never calculates summary totals from a page.

Each request uses one read-only repeatable-read PostgreSQL snapshot for count,
totals and page/export queries, without locking provider execution. Independent
requests observe fresh data: paging and exporting while settlement proceeds may
therefore observe changed totals. Pagination is not a frozen historical snapshot
token. Consumers should refresh totals when changing pages or exporting.

Export accepts the same filters without page fields and returns all matching
groups with `complete: true`, full totals, `format: "json"` and the limit.
Exactly 10000 groups are allowed. More groups fail with 413 and an actionable
instruction to narrow filters; there is no silent truncation. REST adds a fixed
`ai-usage.json` attachment name only on success. Successful report/export
responses use `Cache-Control: private, no-store`.

## Exact values and uncertainty

Counts, token sums and group counts are exact integer strings. All cost fields
are estimated **major billing-currency decimal strings with twelve fractional
digits**, independent of accounting cents/minor units. SQL numeric sums and
BigInt decimal formatting preserve values above JavaScript's safe integer
range. No price fetching, provider request, invoice, ledger effect or currency
conversion is performed.

- `chargedCost` is the total currently charged against admission, including
  conservative holds; it is not purely observed spending.
- `settledCost` is the charged estimate for settled attempts; unknown cached or
  reasoning categories can still require conservative category pricing.
- `reservedCost` is the current held estimate for undispatched reservations.
- `unresolvedCost` is the current held estimate for in-flight/unknown attempts,
  including observed lower-bound overages retained by the metering service.
- `chargedTokens` likewise includes reservations/uncertainty, while category
  token sums are partial observed values. All-null categories stay null.
- Per-category `unknown*Attempts` counts explain missing observations and
  exclude cancelled reservations, which incur no usage. Cached tokens are a
  subset of input; reasoning tokens are a subset of output. Do not add those
  subsets again to input/output totals.

Totals remain separated per billing currency; rows retain their immutable price
version. No prompts, outputs, attempt keys, snapshots, executable inputs, budget
versions, settlement payloads or credential references are selected. Metering
attempt states do not represent business-run success/failure. Quota/reset and
run operations belong to AI-058, forms to AI-057, and bilingual dashboard
presentation to AI-059. The two new MCP operations remain outside the reviewed
automatic chat catalog. Native Persian, deployed provider/worker behavior and
production activation remain separate gates.
