# Scoped AI quota and run operations

AI-058 supplies backend services for AI-059's dashboard. AI-011 retains assembled
dashboard acceptance. No runtime, provider, deployment or rollout is enabled.

All five REST endpoints under `/api/v1/ai/operations` call the same
`lib/ai/operations.ts` services as the registered MCP tools. Responses use
`private, no-store`. Strict schemas reject identity, organization, transcript
and execution arguments supplied by clients. Live identity and grants are
rechecked; organization membership never grants site-wide access.

| REST | MCP | Authorization and result |
|---|---|---|
| GET quota | get_ai_quota | Own: view:ai-history; organization: view:ai-usage. Explicit billing currency, optional current member UUID; current UTC month and reset instant, quota constraints, active states and full monthly usage by currency. |
| GET runs | list_ai_operation_runs | Same read permissions. Required from/to UTC creation window, at most 93 days; optional member/state; page/pageSize, maximum 100. Deterministic createdAt/id descending order, full filtered counts and outcomes independent of page. |
| GET run | get_ai_operation_run | Same read permissions plus exact run UUID. Own scope cannot inspect another owner. State, version, timestamps, duration, finite reason code and step-state counts only. |
| POST stop | stop_ai_operation_run | Own: view:ai-history; organization: manage:ai-policy. Exact run UUID and expectedVersion. Shared existing Stop transaction and audit, available while runtime is off. |
| POST disable | disable_ai_operation_config | manage:ai-providers. Exact configId and expectedVersion. Organization-only disable, available after catalog delegation withdrawal; no credential mutation. |

Read scope defaults to own. Organization scope without userId covers the entire
organization. With a member UUID it covers that current member; it cannot select
foreign or former members. Drill-down remains possible for retained organization
run metadata without opening conversation history. Usage auditors can inspect
operations without own-history or transcript audit permissions and cannot Stop
or Disable unless separately authorized.

## Quota and uncertainty

Quota uses one repeatable-read database snapshot and PostgreSQL's UTC calendar
month. All counts/large token amounts remain decimal integer strings. Cost
estimates are major billing-currency decimals with twelve fractional digits,
separate from accounting cents/minor units and provider invoices. No FX or
cross-currency addition occurs. Input/output observations are partial sums with
unknown-attempt counts; all-unknown sums are null. Settled, reserved and
unresolved (in-flight/unknown) debits are separate for each currency.

Own or selected-member explanations include both organization and member
constraints, because both constrain admission. Own users see organization quota
limits and remaining capacity, not other members' usage rows or identities.
Monthly token ceilings, rolling 60-second rate and concurrency include all
currencies. Cost ceilings apply only to the requested currency. Unresolved
attempts from older months still consume concurrency; cancelled reservations
still count toward the rolling rate, matching admission. Remaining values clamp
at zero after overages/lowered limits. Missing and zero budgets are explicit;
zero is never unlimited. Organization-only views explain the organization
constraint; a member constraint is additionally required for any actual user.

`WITHIN_LIMITS` is an observation, never permission to dispatch or a guarantee
that a request fits. Price/configuration, tool policy, runtime, request size,
original run ceilings and live admission checks still apply. Quota includes
current per-run ceilings but cannot calculate remaining per-run authority without
an actual request. The report does not reserve quota or test a provider.

## Privacy, timing and controls

Run outcomes count persisted request states and step states over the full
filtered scope. Duration is finished minus started in integer milliseconds;
it includes waits and is not provider response latency. Aggregates expose total
duration and sample count, with null total when no run has both timestamps.
Unstarted or unfinished run durations are null. Steps can include reads/drafts
and sensitive prepared work; a succeeded step does not imply journal posting.

No transcript snippets, prompts, tool names/arguments/results, record references,
raw diagnostics, secrets, identity snapshots, lease tokens or configuration
snapshots are returned by operations drill-down. Reason codes are finite
persisted-state/Stop explanations, not provider error text.

Stop checks the reviewed version after locking the scoped run, then rechecks
authority after locks and before commit. It retains completed effects, skips
prepared work and keeps executing/uncertain work visible for reconciliation.
Dispatched attempts retain unknown cost; only undispatched reservations release.
Disable locks the organization configuration, checks its version and current
authority, preserves credentials, increments version and audits once. Existing
dispatch checks prevent later work using the disabled configuration. In-flight
work is not rolled back. A repeated Stop/Disable with its returned current
version is a no-op; repeating an old version returns 409, requiring reread.
Concurrent callers with the same version have one winner.

These operations remain excluded from ordinary model tool discovery; new MCP
registrations do not expand the seven reviewed model-callable domain tools.
AI-059 supplies confirmations and localized dashboard views; see
[AI_USAGE_DASHBOARD](AI_USAGE_DASHBOARD.md). Run details also return advisory
`canStop` from the final live authorization check and persisted state. Stop
always rechecks live authority and reviewed version independently. Native review
and independent AI-011 assembled acceptance remain separate.
