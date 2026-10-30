# Durable approved-action consumption

AI-049 supplies trusted worker primitives in `lib/ai/action-batches.ts` and the
content-free `ai_action_consumption` table. AI-050 owns actual domain adapters;
AI-051 owns explicit REST/MCP resume and worker integration. AI-044 and AI-008
retain independent combined acceptance. Approval recording still leaves a run
awaiting approval; there is no new queue transition or sensitive dispatch path.

`consumeApprovedAction({runId, lease, batchId, itemId})` accepts only those four
identifiers. It requires a currently running, owned, scoped, unexpired worker
lease. It locks conversation, run, current batch and ordered steps, validates the
complete normalized proposal graph, exact approval decision, selection digest,
batch binding, original expiry, step/argument/adapter/resource/policy bindings,
original run identity/configuration and current permissions. It reobserves the
current target and domain preflight, including period locks and business policy,
and repeats live checks after receipt/event/audit SQL writes and lock waits.
Unbound or required business approvals fail closed; legacy approved requests,
self-assignment, clarification and model text cannot substitute for approval.

Only a selected prepared item can be consumed. No executing/uncertain operation
can coexist with a new consumption. Failed/skipped selected work stops further
consumption. Every prerequisite needs both a succeeded step and a consumption
receipt belonging to this exact decision/item/fence. A synthetic or historical
succeeded step cannot unlock a dependent.

The transaction inserts one immutable consumption identity and changes the step
to executing with its original operation key and current dispatch lease. The
unique step and decision/item constraints serialize concurrent/lost-acknowledgement
retries. Exactly one caller receives `ACTION_CONSUMED` with the original validated
action arguments. Later calls receive `ACTION_ALREADY_CONSUMED` with a bounded
step receipt and no arguments. No worker may reconstruct a lost handoff from the
proposal, display, old result or receipt. Lease recovery requires reconciliation.
The primitive cannot guarantee resource stability after its transaction ends;
AI-050 must recheck and serialize authority inside each actual domain mutation or
external-delivery boundary before any effect. Consumption itself performs none.

`settleApprovedAction(runId, lease, consumptionId, outcome)` is a trusted adapter
callback, accepting only succeeded/failed/uncertain plus bounded record UUIDs.
The foundation tests simulate these callbacks; they do not claim a domain effect.
The consumption and step must match the still-owning running fence. An already
settled, recovered, replaced or closed fence returns its existing receipt. A
known callback may settle during Stop, revocation or expiry while its original
fence still owns executing work. It cannot initiate another action. Failure or
uncertainty skips pending work and erases every proposal revision; completed
receipts remain intact. Uncertainty requires reconciliation, never automatic
replay. Cancellation retains a known completed receipt and closes as cancelled.
A success leaves orchestration/final run completion to AI-051.

Existing maintenance changes a lost executing lease to an uncertain step and
reconciliation_required run. A fresh process and late callback cannot reclaim
execution authority or overwrite that result. Stop before consumption prevents a
handoff; Stop after consumption erases proposal authority while permitting the
original trusted callback to record its known result. No transaction-wide
rollback is claimed for partial effects.

Generated migration `0026_first_emma_frost.sql` adds the metadata table and
composite decision/step keys, ordered before their referencing foreign keys.
Both FKs bind the exact run, organization and owner. Unique step and decision/item
keys prevent duplicate consumption. The table stores UUIDs, digests and UTC
creation time; it copies no arguments, display, narration, provider response or
credentials. Existing conversation/run metadata deletion cascades these rows.
No numeric/JSON money columns or stored money units change.

These primitives have no public REST/MCP tool and do not widen the seven-tool
automatic catalog. Existing session-backed REST/MCP decisions feed the real SQL
qualification. The harness explicitly queues approved runs using fixture SQL to
exercise real lease claiming; no application resume behavior is implied. No live
provider, domain execution, external sending, UI/native Persian, deployment or
production activation is qualified. Runtime/provider rollout defaults remain off.
