# Approved journal effects

AI-052 adds the trusted worker primitive `executeApprovedJournal` in
`lib/ai/action-batches.ts`. It accepts only run, lease, batch and item UUIDs.
It is not registered as a REST/MCP/model tool and does not queue runs. Existing
journal REST/MCP operations retain their contracts and share the extracted
`postJournalInTransaction` and `deleteDraftJournalInTransaction` services.
AI-053 owns cash settlement, AI-054 owns invoice delivery, AI-050 retains combined
domain acceptance, and AI-051 owns explicit resume and worker integration.

The primitive restricts consumption to journal actions before consuming anything.
Only a fresh one-time `ACTION_CONSUMED` return supplies original validated
arguments to the domain. An existing consumption returns a bounded receipt with
no domain invocation. A lost fresh handoff cannot reconstruct arguments, even
on the same lease. No caller-supplied arguments, display, text, resource status or
old approval can substitute for that handoff.

After consumption, the adapter opens a read-committed domain transaction and
acquires journal, reference, credential, AI configuration and business-policy
locks before the conversation/run/batch/step locks. Stop can therefore win while
the adapter waits for a resource. It then checks the exact current batch/decision,
selection, binding, adapter, step/version/operation, original arguments, resource
and policy digests, live credentials/grants/configuration, original deadline,
lease, cancellation and content retention. The existing bounded journal preview
reobserves the actual resource inside this locked transaction, including current
lines, active references, period locks and business approval. Required/unbound
business approval fails closed; it never repairs or approves a legacy request.

The shared domain mutation, strict operation-linked domain audit, succeeded step
receipt, run version and progress event commit in the same transaction. A final
authority/clock/runtime check follows all SQL writes, including any lock waits.
No GL amount, currency tag or FX value is rescaled or inferred. Posting preserves
stored lines; qualified deletion removes the draft and its lines. Earlier batch
effects remain committed if a later action fails.

Locks protect absent policy/period/reference rows as well as existing rows.
Journal header/line SHARE ROW EXCLUSIVE table locks prevent phantom lines and
reversals; SHARE locks protect authorization/configuration/reference/policy
tables. Deletion additionally locks every exported table with a journal foreign
key, so a new link cannot slip between the preview and deletion. These are
conservative global table locks, including cross-organization write contention,
not a throughput qualification. Local lock/statement timeouts bound individual
SQL waits to five/ten seconds. Deadlocks, timeouts and unknown database failures
fail closed without automatic retry. No provider/network operation runs under
these locks. Finer locking requires a later writer-wide protocol and acceptance.

Typed denial/staleness after consumption records failed work when the original
fence still owns it. Unknown outcomes record uncertainty. If COMMIT succeeds but
its acknowledgement is lost, only the immutable succeeded step receipt can
confirm it; the adapter never infers ownership from current journal status or
replays a domain operation. A crash during the domain transaction rolls back both
mutation and receipt. Existing fresh-process maintenance marks the previously
consumed operation uncertain/reconciliation_required. Recovered/replaced fences
remain immutable; a pending Stop retains completed effects. If the database is
unavailable even for reconciliation, the call may fail and maintenance remains
the recovery path; no new dispatch is inferred.

Disposable SQL acceptance uses actual session-backed REST approval, registered
MCP proposal/revision reads, real worker leases and journal domain services.
Fixture-only SQL queues approved runs; no application resume path is implied.
Qualification includes USD and IRR bigint storage, concurrent calls, dependency
ordering, unselected work, changed resources/permissions/policy/locks/config,
Stop/expiry during real SQL waits, post-mutation rollback, database fault
injection, lost commit acknowledgement, partial effects and killed-worker restart.
No new schema or migration is required. No live provider, delivery, deployed worker,
production authentication interaction, UI/native Persian, performance, deployment
or production activation is qualified. Runtime and provider rollout gates remain.
