# Durable AI tool operations

AI-032, 2026-10-28. Internal worker execution boundary, not a public dispatch API
or a running provider worker. AI-033 owns provider protocol, metering, retries,
polling, heartbeats, shutdown, provisional streaming and grounded final answers.
AI-031/023/007 retain independent integration acceptance. Runtime and live-provider
flags remain unchanged and default off. Stripe is unchanged.

## Execution authority

`prepareToolOperation(runId, lease, operationKey, name, arguments)` and
`executeToolOperation(...)` in `lib/ai/tool-operations.ts` are trusted server-only
primitives. They are deliberately absent from REST/MCP/model tool discovery.
The worker must choose stable UUID operation keys and retain their association
with completed provider calls. Passing model arguments as identity/lease/scope
is prohibited. The persisted run selects organization, actor and configuration.

Preparation validates a reviewed strict schema, normalizes defaults and binds
the key to SHA-256 of the canonical original arguments, tool name and catalog
version. Redacted input is display data only; supply the complete original
arguments again at execution. Different secrets that redact identically still
conflict. No original secret text is recoverable through the digest field.
The additive 0022 migration adds `argument_digest` and `dispatch_lease` to steps;
legacy stored steps remain valid but cannot be adopted as worker operations.
The legacy `transitionStep` helper rejects worker-bound steps.

Conversation -> run -> step locks serialize preparation, erasure and observation.
Before preparing and immediately before actual linked MCP invocation, the worker
rechecks lease ownership/expiry, deadline, cancellation, runtime/kill switch,
live identity, immutable provider/credential/policy snapshots, allowlist and domain
permission. The final guard runs after asynchronous registry/MCP setup and audit.
The underlying registered tool independently refreshes identity and applies its
domain checks. These checks are immediate authorization checks, not a promise to
roll back an effect when a permission or kill switch changes after dispatch.

At most 20 steps and 1 MiB cumulative payload bytes apply. Preparation leaves
40,000 bytes of headroom for a bounded result, checked again at invocation.
Only one operation may execute at a time; unresolved uncertainty prevents further
dispatch. No transaction is held across the domain call. Run version increments
and content-free events commit with each prepare/dispatch/settlement change.

## Receipts, races and recovery

An operation moves prepared -> executing -> succeeded/failed/uncertain. A repeated
same-key request returns the stored receipt and performs no new dispatch. A
competing caller cannot settle the winner. A last-moment guard failure returns
the still-prepared receipt; it is not a success or an automatic retry instruction.
Preparation failures throw. The provider loop must distinguish these states and
stop/recover according to live run state. New keys must not be invented to replay
uncertain writes. Bounded read/provider retries belong to AI-033, within the same
run's persistent limits; no retry loop is introduced here.

Only the actual registered tool's response produces record IDs. Fixed known
envelope fields are inspected; arbitrary narrative, argument IDs or URLs cannot
establish successful provenance. Progress reloads these records in the current
organization under current permissions and uses fixed application routes. No
model-generated final text is published by this boundary. Pending/executing work
does not expose confirmed links. The existing REST and MCP progress operations
share these receipts without exposing operation keys, digests, leases or raw data.

Trusted settlement preserves known committed effects even during cancellation,
deadline passage or actor revocation, while the original run still owns the lease
and no maintenance/recovery has superseded it. It starts no new action. Content
cannot be resurrected after erasure/expiry. Late callbacks cannot overwrite
recovery or a successor's lease. If a write committed but its receipt was lost,
maintenance marks the operation uncertain and the run reconciliation_required;
it never assumes rollback or replays the write. Existing usage reservations and
original deadline remain intact. This child supplies conservative reconciliation
state, not automatic outcome discovery or a user resolution/approval service.

Cancellation notifications can wait for a domain transaction's organization lock
before acknowledging the stop. Known commits still settle safely after that wait.
Provider/hosting/availability qualification, heartbeat and process startup are
explicitly pending AI-033 and later release tasks. No worker startup command is
advertised until that process exists.
