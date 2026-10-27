# Persisted run progress contract

AI-029 supplies observation through GET `/api/v1/ai/runs/{id}/progress` and
`get_ai_run_progress`. Both use `lib/ai/run-progress.ts`, current execution identity,
own organization/owner scope and `view:ai-history`. Runtime/provider flags can
remain off. Observation never claims leases, performs maintenance, sends provider
requests, executes tools, accepts approval, or resumes work. Lifecycle MCP tools
remain excluded from the model's reviewed tool allowlist.

The strict input is runId, optional expectedVersion, optional afterStepId and
limit (default 10, maximum 20). REST takes runId from the path and the other fields
from the query, rejecting unknown/duplicate parameters and noncanonical integers.
Every field is described in the shared MCP schema. A page is ordered by persisted
createdAt and UUID, including sub-millisecond timestamp ties. A continuation must
pass both fields returned in `next`: afterStepId and expectedVersion. Changed
execution state returns 409; discard accumulated pages and read the first page
again. Foreign/missing step cursors fail. Cursors convey no execution authority.
Permission or domain-record changes are rechecked on each page, so clients must
also discard previously cached data on organization/access changes.

Conversation then run share locks keep each page consistent with step/lifecycle
writers and erasure, and live identity is refreshed after any lock wait. Deleted
or content-expired conversations return 404. REST success and error responses use
`Cache-Control: private, no-store`. API consumers still must discard late responses
after logout/organization switches; this service cannot clear a client's cache.

`run` returns identifiers, persisted state/version, UTC timestamps, a finite code,
and stop status (not_requested, requested, acknowledged). Finite run codes are
QUEUED, RUNNING, INPUT_REQUIRED, APPROVAL_REQUIRED, RECONCILIATION_REQUIRED,
COMPLETED, FAILED, STOPPED, EXPIRED and STOP_REQUESTED. Codes describe durable
state, not an inferred root cause. In-flight effects can finish after stop;
acknowledged reconciliation does not mean rollback or a known business outcome.
No queue position, percentage, ETA or worker uptime is inferred. Worker
availability is explicitly unknown. A nonterminal poll suggestion is 2000ms;
terminal runs return null. Clients should pause hidden/disconnected polling and
use bounded backoff. This is a bounded response API, not a scheduler or a live
stream, and the interval is not a quota enforcement guarantee.

Each step returns id/version/state/timestamps plus a finite outcome code:
PENDING, IN_PROGRESS, READ_COMPLETED, DRAFT_CREATED, ACTION_FAILED,
RECONCILIATION_REQUIRED, NOT_STARTED, RESULT_RESTRICTED or RESULT_UNAVAILABLE.
Reviewed tool action names are included only with all stored permissions, the
catalog permission and current view:data. Unknown tools fail closed. No arbitrary
stored input/result, prompt, free text, private reasoning, provider configuration,
lease token, operation key or secret is projected. Codes are stable UI translation
keys; AI-027 supplies localized presentation. These coarse summaries do not replace
the existing separately scoped history API.

Succeeded and uncertain steps can expose at most ten record references each.
References are reloaded from nondeleted contacts, journals or expense claims in
the current organization, using the independently reviewed tool-to-record mapping.
URLs are server-built `/contacts/{id}`, `/accounting/{id}` or
`/purchases/expenses/{id}` paths. No model/result URL is accepted. Omitted,
inaccessible, deleted or unrecognized references set recordsOmitted; no omitted
record IDs or content are disclosed. Expense amounts are exact SQL text
amountMinor strings with explicit currencyCode, without conversion, rescaling,
summation or legacy Number decoding. Record status is current; DRAFT_CREATED
describes the persisted completed draft action, not a claim that the record is
still draft today. A completed draft without a visible real reference reports
RESULT_UNAVAILABLE. Pending/executing results are never shown as confirmed.
Uncertain references support inspection and remain RECONCILIATION_REQUIRED.

Step preparation and transitions atomically increment the run version and insert
step_prepared/step_updated events in the same transaction. Event reads expose only
version sequence, finite notification kind and UTC time; unknown stored kinds map
to changed. They use at most 100 events plus one lookahead, so exactly 100 events
does not falsely imply another page. An ahead-of-server cursor restarts from zero
with cursorReset=true. Lost cursors can read from zero; neither case dispatches or
resubmits work. Clients then fetch the authorized progress projection separately.

AI-030 must add durable questions, candidate access checks and versioned/idempotent
answer/resume. AI-031 must persist recordIds from trusted actual tool outcomes,
enforce per-action leases/policy/budgets, add metered failure/recovery causes and
worker availability evidence, and distinguish provisional provider streams from
confirmed records. Current storage helpers and presentation redaction do not
authorize execution. AI-023 and AI-007 remain independent integration parents;
provider/worker/UI/production qualification is not claimed here.
