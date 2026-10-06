# CRM deal, pipeline and analytics contracts (MON-092)

2026-10-06, Asia/Tehran. Bounded MON-027 child; self-review only. Shared
direct-Drizzle services live in lib/api/crm.ts; strict described input schemas,
saved deal preflight and exact aggregate arithmetic live in crm-wire.ts.
registerCrmTools remains registered in lib/mcp/tools/index.ts. No schema,
migration, currency-history rewrite, ledger posting or rollout flag change.

## Operations and envelopes

Paths below are relative to /api/v1/crm. REST IDs are :id; MCP uses pipelineId
or dealId. All IDs are UUIDs. POST create operations return HTTP 201; other
successes return 200. MCP uses wrapTool and the existing server AuthContext.

| REST | MCP | Input / output |
|---|---|---|
| GET pipelines | list_pipelines | None / pipelines |
| POST pipelines | create_pipeline (new parity) | name, stages, optional isDefault / pipeline |
| GET pipelines/:id | get_pipeline | ID / pipeline with live owned deals |
| PATCH pipelines/:id | update_pipeline (new parity) | Optional name/stages/isDefault / pipeline |
| DELETE pipelines/:id | delete_pipeline (new parity) | ID / success |
| GET deals | list_deals | Optional pipelineId/stageId/source/status/search/sortBy/sortOrder/page/limit/currency / REST data,pagination,summary; MCP deals,total,page,limit,summary |
| POST deals | create_deal | pipelineId,stageId,title; optional value aliases/currency/contactId/assignedTo/probability/expectedCloseDate/source/notes / deal |
| GET deals/:id | get_deal | ID / deal with contact,assignedUser,pipeline,activities |
| PATCH deals/:id | update_deal | Optional title/value aliases/probability/expectedCloseDate/contactId/assignedTo/notes / deal |
| DELETE deals/:id | delete_deal (new parity) | ID / success |
| PATCH deals/:id/stage | move_deal_stage | Configured stageId / deal |
| POST deals/:id/won | mark_deal_won | ID / deal |
| POST deals/:id/lost | mark_deal_lost | Optional nullable reason / deal |
| GET deals/:id/activities | list_deal_activities | Optional type/search/sortBy/sortOrder/page/limit / activities,pagination,typeCounts,totalAll |
| POST deals/:id/activities | add_deal_activity | type; optional nullable content/scheduledAt / activity |
| GET analytics | get_crm_analytics (new parity) | Optional currency / direct analytics fields |

## Money, percentages, dates and ranges

valueCents retains its existing nonnegative integer **fixed cents** semantics,
with additive canonical valueCentsMinor string. Both aliases support
0..9007199254740991, including zero and the maximal safe Number. Supply either,
an agreeing pair, or neither (zero on create, unchanged on patch). A canonical
int64 alias above this business/ORM coexistence range returns 422 with
LEGACY_NUMERIC_RANGE before writes. Invalid syntax, negative/negative-zero,
fractional/unsafe numeric input, alias conflict or out-of-int64 string returns
400 (MCP validation error). Numeric fields never coerce text. Unknown inputs
reject; exact aliases never leak into ORM update sets. Every deal returned through
create/update/lifecycle/list/detail/pipeline reads includes both aliases.

Currency is an ISO label normalized on input (default USD), immutable in deal
PATCH. These historical cents fields do not become currency-scale minor units:
1250 stays 1250 for USD, JPY, KWD and IRR; no implicit conversion/FX occurs.
The CRM drawer parses decimal text into exact two-decimal cents, and CRM views
use the existing exact fixed-cents formatter with the saved currency label.
This corrects old scale-dependent presentation without rewriting stored history.
Weighted deal presentation rounds cents with bigint, rather than float products.
No production IRR or full-int64 availability is implied by the alias or ISO label.

Probability stays nullable numeric integer percent 0..100, default zero on
create. It is neither money nor basis points. Nullable input matches the existing
drawer and physical column. Expected close dates are Gregorian YYYY-MM-DD,
years 0001..9999; impossible dates reject. scheduledAt requires a valid ISO
instant with Z or explicit offset, normalized into UTC Date on persistence.
Returned timestamps serialize as UTC ISO strings. Null clears nullable fields;
omission retains values on patch. Source/activity/status/sort are strict enums.
Titles/pipeline/stage IDs/names are nonempty, at most 10000 characters;
notes/content/reason at most 100000. Stages have unique IDs (1..100 entries),
nonempty names and six-digit CSS hex colors. Unknown nested keys reject.

## Aggregates and currency grouping

Both summary and analytics explicitly return currency. A currency filter selects
one saved group; omitted currency supports zero or one distinct currency only
(empty results default USD). Mixed currencies fail with classified 422 requiring
a currency filter, never sum unlike amounts. CRM list/analytics screens expose
this selection and report server errors instead of presenting USD guesses.

Summary retains activeCount,activeValue,wonCount,wonValue,totalDeals and active
stageDistribution. It deliberately ignores search/stage/source/status/pagination,
as before, but honors pipeline and currency. It adds activeValueMinor and
wonValueMinor; stage entries add valueMinor alongside count and numeric value.
Analytics retains totalDeals,openDeals,wonDeals,lostDeals,totalPipelineValue,
wonValue,conversionRate,avgDealValue and all-live-deal stageDistribution. Money
adds totalPipelineValueMinor,wonValueMinor,avgDealValueMinor and stage valueMinor.
All sums and rounded averages use bigint, with safe numeric output checks;
nonnegative average and conversion percent round nearest, half up. Conversion
counts only won/lost records; active rows do not change its denominator.
The shared aggregate preflight qualifies both summary and analytics stage sums
even when only summary is requested. No hidden overflowing stage total is allowed.
Stage IDs use Map/Object.fromEntries so __proto__ cannot corrupt accumulators.

Pagination is numeric whole page 1..21474836 and limit 1..100 (deals default 50,
activities 30). Sort defaults created/date descending with deterministic ID ties.
REST page/limit must use canonical positive ASCII digits; duplicate/unknown query
keys reject. Activities' per-type counts/totalAll ignore filters as before.
List implementations retain unpaginated loading for full summary/count validation;
large-dataset performance remains parent qualification.

## Scope, authorization, transactions and compatibility corrections

All roots and saved nested pipeline/contact references are organization scoped.
Pipeline detail excludes both deleted deals and foreign deals pointing to that
pipeline. New/changed contacts must be live; owned deleted contacts remain readable
as history. Nested contact creditLimit adds nullable creditLimitMinor within the
safe signed range. Assignees and activity authors must be current organization
members, including historical reads. Removed/foreign member history fails closed
without leaking global user data or guessing a replacement. User DTOs expose
only id,name,email,image; passwordHash and other auth internals are excluded.
Malformed/unsafe saved deal/stage/currency/date/probability/dual-lifecycle history
fails before edits. Remediation is a separate explicit operation, not inferred.

Pipeline mutations retain manage:contacts in both transports. Deal and activity
operations retain the existing authenticated-member policy with no additional
role gate; tests include a custom role with no mutation permissions to prove
this distinction. All adopted writers acquire the live organization row lock,
then qualify references and persist audit/output within one transaction.
Reads use repeatable-read snapshots. Audit failures and returned money/stage/
activity-scope failures roll back mutations, including soft deletes.
No accounting period locks apply to these nonposting CRM metadata operations.

True isDefault clears other live defaults atomically, including concurrent
REST/MCP updates. Removing a nonterminal stage used by any live deal returns
409. Deleting a pipeline with live deals returns 409, preserving readable
references. Soft-deleting a deal preserves activities, but timeline reads/appends
on a deleted deal now return 404. Missing/foreign/deleted roots return 404.

Won/lost writes set reserved closed_won/closed_lost stages, probability 100/0
and one timestamp, clearing the opposite state/reason; ambiguous legacy double
timestamps reject. Same-state retries preserve original timestamp and create
no duplicate audit. Changing the closing outcome is supported and audited;
concurrent opposing closes serialize and leave one outcome. Moving a configured
stage preserves existing lifecycle timestamps (legacy behavior); it does not
reopen or close a deal. Creation is active even in a configured terminal stage.
Create/append operations have no new deduplication token: a retry deliberately
creates another record/activity. Repeat deletion returns 404.

## Evidence and limits

Four pure groups and crm-worker.ts exercise all sixteen actual REST/MCP pairs,
full SDK registration/described strict schemas, API-key auth, numeric/exact/agreed
aliases, safe maxima, currency and aggregate rejection, public member/contact
joins, invalid dates/probability/query input, historical corruption, cross-tenant
references, role behavior, retries, concurrent closes/defaults/deletes and actual
audit/output fault rollback on migrated disposable PostgreSQL.
No builds, Next dev server, screenshot, provider, deployment, schema edits or
independent financial review. Historical remediation, locale and general currency
presentation, full-int64/performance and integrated MON-027/financial/release gates
remain separate; no legacy numeric sunset is invented.
