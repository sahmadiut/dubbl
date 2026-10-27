# AI usage, estimated costs and budgets

AI-005, 2026-10-27. Engineering contract; no provider prices, account entitlement,
live-provider qualification or rollout activation are supplied by this task.

`lib/ai/usage.ts` owns shared REST/MCP services and trusted executor primitives.
Prices are immutable organization/provider/model versions created by
`manage:ai-providers`; no update/delete API reinterprets a prior attempt. Rates
are exact major billing-currency decimal strings per **million tokens**, with
six fractional digits. Stored rate integers are micro-major units per million
tokens. One such rate atom multiplied by one token produces one cost atom of
10^-12 major currency units. BigInt does all multiplication, comparisons and
aggregation. Budget amounts support twelve fractional digits. These estimates
are separate from accounting minor units, provider invoices and FX; no ledger
entry or currency conversion is performed. Tests use synthetic rates only.

Input tokens include their cached subset; output tokens include their reasoning
subset. Category rates replace the corresponding base rate rather than adding
another charge. Unknown category counts remain null, with the more expensive
applicable rate used conservatively. Unknown input/output totals hold the full
reservation and concurrency slot; partial observed overages increase that debit.
Late trusted callbacks fill unknown fields without rewriting known counts.
Settled callbacks are idempotent; conflicting observed counts are rejected.
Over-reservation releases on known settlement. Usage above the reservation is
recorded truthfully and prevents later admissions when a quota is exceeded.

`manage:ai-policy` configures both an organization and a current member budget
for each requested billing currency. Both are required; missing policy/price
fails closed and zero limits disable admission. A policy update uses the current
version and never resets prior usage. Token ceilings use the UTC calendar month
and cover all billing currencies; rate and concurrency also cover all currencies.
Cost limits apply only to their own currency. Reports never sum across currencies.
Per-run token and cost ceilings include all retries/reservations; changing a
run's billing currency is rejected. UTC month attribution follows attempt
creation, so delayed settlement corrects the original attempt period.

Admission, policy updates, dispatch checks, cancellation and settlement serialize
through an organization-scoped PostgreSQL transaction advisory lock. Each real
provider attempt has a distinct attempt key; retrying submission with the same
key returns the same reservation only when its scope, run, configuration, model,
price selection and individual input/output ceilings agree. Re-dispatching that
attempt is rejected: a timeout/crash is reconciled, never silently replayed.
Reserved, in-flight and unknown states consume concurrency; the rolling
60-second rate count also includes cancelled reservations and retries. Only
pre-dispatch cancellation releases a reservation. Cancellation after dispatch
retains unknown usage until a trusted callback/reconciliation establishes counts.

The future executor must compute a valid input-token upper bound, cap provider
output including reasoning, persist the attempt ID before dispatch, revalidate
live identity and current policy at dispatch, and use a new key per real retry.
`reserveAttempt`, `markAttemptDispatched`, `settleAttempt` and
`cancelReservation` are internal primitives, not REST/MCP/model-callable tools.
Settlement accepts server-owned attempt/org/user references so usage can still
be accounted after the initiating member or credential loses access. Never pass
model/browser-provided settlement scopes or counts into this trusted callback.
The runtime, worker scheduling and provider-usage normalization are AI-007/012
work; no general generation loop is introduced here.

The existing bounded administrative connection test is metered now. It selects
the latest explicitly created price version and requires explicit org/member
budgets before any transport request. With no qualified tokenizer it reserves
the entire approved context ceiling, including its 16-token output cap, then
settles returned usage. Transport/response failures preserve unknown usage;
even DNS failures remain conservatively reserved. Provider opt-in remains off
by default, and metering configuration does not enable provider calls.

Own reports require `view:ai-history`; organization aggregates require
`view:ai-usage` (admin by default), without transcript access. Reports are bounded
to 93 days and grouped by owner/provider/model/currency, exposing only counts
and estimates. Per-category unknown-attempt counts accompany partial observed
sums; null is never presented as known zero. Policy and price mutation tools
carry explicit ordinary-chat exclusion markers for AI-006 to enforce.

History content erasure does not erase active usage reservations. The existing
90-day conversation metadata purge now waits for all attached usage attempts
to be settled/cancelled; then scoped cascade deletion may remove that expired
metadata. Unknown usage has no automatic zero-cost expiry. Content-free
administrative attempts (no conversation/run) require a later maintenance
retention/reconciliation job; this task does not claim worker scheduling or
unconditional deletion of unresolved billing evidence. AI-013 must verify the
deployed retention and backup-erasure policy alongside prior release gates.
