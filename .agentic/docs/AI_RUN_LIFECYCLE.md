# Scoped run lifecycle and lease primitives

AI-022 is the first child of AI-007. It implements submission, observation, stop,
exclusive claim/heartbeat and crash classification. **It does not implement the
model loop, tool execution, provider adapter, worker process or hosting.** AI-023
owns those pieces; AI-007 retains its original independent integration acceptance.

`AI_RUNTIME_ENABLED` must explicitly equal `true` and `AI_RUNTIME_KILL_SWITCH`
must not equal `true` for new conversations, submissions, claims or executable
lease checks. Defaults are off. No local flag was changed by this task. Stopping
and inspecting own work remains available with current history permission while
runtime is off. These flags do not qualify a provider or authorize rollout.

The public REST operations are POST `/api/v1/ai/conversations`, POST
`/api/v1/ai/runs`, GET `/api/v1/ai/runs/{id}`, POST
`/api/v1/ai/runs/{id}/cancel`, and GET `/api/v1/ai/runs/{id}/events?after=N`.
Each uses the same direct database service as its corresponding MCP operation.
Run lifecycle tools are excluded from the model tool allowlist; models cannot
create recursive runs, cancel unrelated work or claim worker leases.

Submission accepts only an own conversation UUID, request key and untrusted user
message. It derives the original credential identity, organization, current default
provider configuration, credential reference, provider version and both default
agent/org policy versions on the server. Missing credentials, disabled policies,
unapproved models, or no permitted tools fail closed. Reusing a key with identical
trimmed input returns the original run; different input conflicts. Prompt, run,
queued event and content-free audit commit atomically. Up to 100 runs and 1MiB
display content are admitted per conversation. Payload redaction is display data,
never executable authority. No raw prompt is placed in an event or error log.

`claimNextRun()` is an internal primitive, never an endpoint. It serializes capacity
decisions with a PostgreSQL transaction advisory lock, scans at most 100 oldest
queued records using SKIP LOCKED, and admits at most one running run per owner
and two per organization. Busy runs are skipped within that bounded window;
AI-023 must qualify queue fairness/backpressure at larger scale. Current original
identity, provider and policy snapshots are rechecked before admission. Changed
snapshots fail the old run; the owner submits a new request rather than silently
adopting new execution authority. Each claim gets a fresh opaque fencing token and
30-second lease; first claim sets a ten-minute execution deadline which recovery
does not reset. Queued work expires after 24 hours.

`assertRunLease(runId, leaseToken)` rechecks live identity/snapshots, flags, stop,
conversation retention, lease owner/expiry and deadline. `heartbeatRun` renews
only the same unexpired, uncancelled lease. AI-023 must bind each action to this
token, atomically guard its step/attempt state before dispatch, and recheck flags
before every provider request and tool call. This primitive alone cannot make a
future caller's unchecked network request safe. Internal AI-003 storage transition
helpers are not substitutes for fenced worker execution.

Stop skips prepared steps, prevents new executable-lease checks and cancels
undispatched usage reservations. Dispatched provider usage becomes unknown with
its conservative charge retained. A currently executing tool stays in progress;
stop never claims rollback. On expired lease/deadline, `maintainRuns()` marks any
executing step uncertain, retains known record IDs, puts the run in
`reconciliation_required` and never requeues that effect. A safe pre-dispatch
crash can requeue with a new lease token. An expired or stopped safe run terminates.
AI-023 owns actual record-level reconciliation, bounded retries and partial-action
summaries, and must never replay uncertain drafts. No automatic reconciliation or
approval authorization is exposed here.

`maintainRuns()` processes at most 100 expired leases/queued records, preserves
unknown usage, then invokes retention in batches of at most 100 conversations.
Its scheduler and shutdown behavior belong to AI-023. Unsettled usage or uncertain
effects retain metadata; expired display payloads are erased while reconciliation
record references remain. Existing approval-expiry storage behavior is preserved.

Events contain only monotonic run version, lifecycle kind and UTC time. Polling
after a cursor returns up to 100 events and never dispatches work. Public status
uses the existing history service's current domain-permission filtering for step
inputs/results/record IDs, and exposes no credential, policy snapshot, worker lease
token or private reasoning. Own/organization scope and live history rights are
enforced again for every REST or MCP call.
