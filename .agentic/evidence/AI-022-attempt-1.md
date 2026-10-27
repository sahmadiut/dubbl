# AI-022 attempt 1 - scoped lifecycle and worker leases

## Identity

2026-10-27, Codex task_007, self-operated in D:/Projects/a/dubbl, branch fresh-start.
Starting commit bd411fa3a24cabe4c9aad47957a41dbf49c231f0; starting tree clean.
This record describes the pre-commit implementation, not an invented final SHA.

AI-007 was split using the controller after inspecting its broad provider/tool loop,
worker process and lifecycle scope. AI-022 owns lifecycle/leases only; AI-023 owns
the actual bounded metered worker loop. AI-007 retains every original acceptance
criterion and awaits both children plus independent integration acceptance.

## Implementation

- lib/ai/run-lifecycle.ts: default-off submission, server-derived identity/default
  provider/policy snapshots, request digest conflict checks, atomic prompt/run/event/
  audit writes, own status/events/stop, serialized capacity admission, fenced leases,
  heartbeat, live identity/config revalidation, deadline and expired-lease recovery.
- lib/db/schema/ai.ts and generated 0020 migration/snapshot: additive request digest,
  start/deadline/stop timestamps and consistency constraint. Existing historical
  rows remain valid; no existing money, ledger or provider schema is reinterpreted.
- REST lifecycle routes, conversation creation and registered MCP parity share
  direct DB services with AuthContext/wrapTool and described strict schemas.
- lib/ai/persistence.ts: typed optional server execution snapshot fields; bounded
  retention batches; stop prevents preparing/starting further steps, while an
  existing executing step may still record its actual outcome.
- Capability and coverage audit refreshed:109 modules,812 tools,574 route files,
  208 pages. Exactly seven business tools remain reviewed;805 remain unlisted.
  Lifecycle controls are explicitly excluded from model-dispatchable operations.
- AI_RUN_LIFECYCLE.md documents APIs, lease/recovery contract, flags and limitations.

## Acceptance mapping

1. Shared own REST/MCP submission/status/stop/events and conversation creation are
   verified by ai-run-lifecycle-worker.ts using actual linked MCP and route handlers.
   Unknown fields, conflicting key content, disabled flags, foreign owners/orgs and
   removed membership fail. Public output excludes identity, provider config,
   credential reference, raw prompt, private reasoning and worker token.
2. Concurrent identical submissions produce one run and one user message. Three
   competing claims yield only two running runs in the organization and distinct
   owners. Heartbeats require the same unexpired claim token; reclaim generates
   another token and old tokens fail. A ten-minute deadline and24-hour queued TTL
   expire work; first-start deadline survives requeue. Capacity decisions serialize
   under a transaction advisory lock and queue scans are bounded at100 records.
3. Stop skips pending steps and prevents new preparation/lease checks; an executing
   tool is not claimed cancelled/rolled back. Fresh-process maintenance marks it
   uncertain and puts the run in reconciliation_required, preserving earlier
   succeeded-step record IDs. No uncertain write is requeued. Reserved provider
   attempts cancel with zero charge; dispatched attempts remain unknown with their
   conservative charge. Retention erases payloads but preserves unresolved metadata
   and reconciliation IDs. Snapshot changes and revoked live role fail closed.
4. Additive migration applied successfully by the disposable test harness. New
   behavior, related regressions and static gates are listed below. AI-007 and
   AI-023 remain open; this does not claim a functioning provider/tool worker.

## Verification

All commands ran from the repository root. PostgreSQL18 was initialized in a
task-owned temporary directory bound to loopback55488, using an isolated trust
fixture with no real credentials. Harness databases are randomized dubbl_ci_*
databases, migrated and dropped after each test. Application DATABASE_URL and
AUTH_SECRET were neither printed, changed nor used for these tests.

| Command | Actual result | Limitation |
|---|---|---|
| npx drizzle-kit generate | Generated0020; final check reports no schema changes | No app/production DB migration |
| node --import tsx --test tests/integration/ai-run-lifecycle.test.ts | Passed | No real provider or hosted worker |
| Six focused integration files, serial | AI002/003/004/006/022 passed; AI005 migration child timed out during anomalous host wait | Not a passing aggregate invocation |
| Serial ai-run-lifecycle.test.ts + ai-usage.test.ts retry |2/2 passed; resolves AI005 migration-process timeout | No product failure assertion was observed in timed-out attempt |
| Final serial ai-run-lifecycle.test.ts + ai-persistence.test.ts |2/2 passed | Covers final stop guard and bounded retention |
| npx tsc --noEmit | Initial and subsequent full/incremental checks passed, including final stop guard | No full build |
| Focused ESLint over source/routes/tests/audit | Passed | Final guard covered by final lint |
| npm run lint | Passed exit0,0 errors/20 pre-existing warnings | No unrelated warnings changed |
| Capability/coverage audit without --write | Passed | Source inventory is not feature qualification |
| python .agentic/agent.py validate; git diff --check | Passed before completion | Controller structural check only |

No dev server, full build, Docker, live-provider request, deployed worker or hosted
CI qualification was performed. Financial, IRR, native, security and release gates
remain intact. No Stripe file was modified. Final focused lint also passed after the last stop guard. The task cluster had zero
leftover disposable databases and was stopped after checking its resolved task-owned
temporary path. No application DB or ignored local environment was changed.

## Review and handoff

Codex task_007 self-review, separately recorded in AI-022-review-1.md. No peer/human
approval is claimed. AI-023 must implement worker polling/shutdown, bounded provider/
tool loop, metering callbacks/token ceilings, operation-level effect reconciliation,
grounded final answers/clarification, retries and actual action fencing immediately
before dispatch. Its worker must use claim/assert/heartbeat/maintenance primitives;
the old storage-only transition helpers are not execution authorization. Queue
fairness/backpressure beyond100 queued candidates requires AI-023/012 validation.
