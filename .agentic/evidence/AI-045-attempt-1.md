# AI-045 attempt 1 - durable exact journal proposal batches

## Identity

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD ebb98ab6. Entry tree
was clean. Controller selected AI-042. Inspection separated durable journal
proposal storage/revisions from the broader payment/deletion/sending adapters
and business-workflow evaluation. Created AI-045/046 and used the controller to
split AI-042, retaining every original parent criterion. Completed only AI-045.
No delegated, peer, human or production acceptance is claimed.

## Implementation and acceptance mapping

1. Exact scoped persistence: lib/db/schema/ai-action-batches.ts and generated
   0024_serious_chat.sql store bounded proposal revisions with composite own
   run/org/actor FK, unique revision/request keys and one pending row per run.
   Validated original journal arguments are separate from bounded display.
   Canonical digest binds actor/org/run/revision, resource/adapter versions,
   step identity/version, exact selection/dependencies, display and fixed expiry.
   Prepared step rows contain no raw execution input and cannot be dispatched by
   the seven-operation automatic catalog. SQL tests assert the scope FK, positive
   version, digest, both JSONB bounds and partial pending uniqueness by their
   actual constraint names. Drizzle generation adds only the new table; prior
   tables/schema metadata compare equal to the previous snapshot. Classified
   the four new integer/JSONB columns in MONEY_BOUNDARIES without currency
   rescaling or changes to existing classifications.

2. Shared read/revision: lib/ai/action-batches.ts implements own-run GET and
   explicit POST revision routes and registered get_ai_action_batch /
   revise_ai_action_batch MCP tools. Schemas reject forged scope, approval,
   unsupported actions, unknown arguments and path overrides. Complete display
   is returned only after binding/step/resource checks and fresh AI/history/view/
   posting permission checks. Another organization or same-org owner sees no
   batch. Runtime-off observation is read-only; new revisions are disabled.
   Identical revision-key retries return stable historical metadata receipts,
   including after disablement; changed key bodies and competing different
   revisions conflict. Actual simultaneous REST/MCP retries persist exactly one
   replacement, and distinct competing revisions produce one winner.

3. Selection and authority: initial creation is trusted-worker-only and requires
   an actual fenced run lease/current config/version. Initial selections must be
   empty, so no model preselection can be persisted. Distinct item/resources,
   dependency closure, duplicate/self/missing/cyclic edges are validated. Each
   proposed effect is visible with explicit selected status; selected totals use
   bigint and separate currencies. Tests preserve USD and IRR 1250 independently
   and compute 18014398509481982 exactly from two SQL-seeded MAX_SAFE_INTEGER
   journals. Revisions regenerate resource snapshots, replace prepared step
   identities and binding, retain the original expiry/deadline, and preserve
   cumulative payload/20-step/20-revision limits. No approval, queue transition,
   provider attempt, journal posting, payment or email occurs. Run remains
   awaiting_approval and old lease is fenced. Existing completed effects are not
   rolled back; uncertain/unsettled work prevents new proposal preparation.

4. Lifecycle and qualification: new retention helpers join the existing run and
   conversation transactions. Stop clears authority/display for all revisions,
   skips prepared steps and prevents further use. Conversation deletion/content
   expiry clears both columns. Independently expired proposal payloads are purged
   in batches of at most 100; maintenance expires waiting runs and steps rather
   than requeueing them. A fresh-process maintenance test proves persisted expiry
   recovery. Real table-lock tests revoke disclosure during a journal read and
   revoke posting permission during a step INSERT wait after the batch row was
   inserted: the first withholds all display and the second rolls back the entire
   transaction. SQL hashes verify observation/retry/failed revision no-write
   behavior and no business/usage/approval effects. Config disablement, stale
   resources, corrupted display/step bindings, scope, input and cumulative bounds
   fail closed. See docs/AI_ACTION_BATCHES.md for exact supported boundaries.

## Verification

All checks ran in D:/Projects/a/dubbl with installed Node v23.11.0/dependencies.
Explicit TEST_DATABASE_URL selected the synthetic loopback PostgreSQL18 cluster
at 127.0.0.1:55491. It was stopped at entry; started with its established loopback
options, each harness created/migrated/dropped randomized dubbl_ci_* databases,
verified zero remaining fixture databases and stopped it afterward. No application
database, external provider request, email sender or production service was used.

| Check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-batches.test.ts tests/integration/ai-action-preview.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-persistence.test.ts tests/integration/ai-run-lifecycle.test.ts tests/integration/migrations.test.ts | 10/10 passed, 59.6 seconds; includes clean/repeated migrations, checkpoint upgrade, baseline adoption and rollback with preserved ledger |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-worker.test.ts tests/integration/ai-polling-observation.test.ts tests/integration/ai-tool-operations.test.ts | 3/3 passed, 35.8 seconds |
| node --import tsx --test tests/integration/ai-action-batches.test.ts after final binding/write-wait/exact-total checks | Passed, 9.2 seconds |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed after final edits |
| npx eslint on changed TypeScript source/routes/tests | Passed; final affected-source lint also passed |
| npm run lint | Passed, zero errors and 20 existing warnings outside changed paths |
| npx drizzle-kit generate | Generated 0024_serious_chat.sql, journal entry and snapshot; second run reported no schema changes |
| Snapshot comparison | New public.ai_action_batch only; all prior tables/other schema metadata unchanged and prevId matches prior snapshot |
| node scripts/audit-ai-capabilities.mjs and node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed after regeneration: 110 modules, 819 tools, 581 routes, 210 pages; seven reviewed automatic tools unchanged |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine regression checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Still failed with 1447 stale inventory errors; new proposal columns are classified; no green money-inventory claim |
| python .agentic/agent.py validate and git diff --check | Passed; staged whitespace check performed before commit |

The initial typecheck identified control-flow narrowing errors around a
const-arrow never-return helper; changed it to a declared never-return function.
Removed two unused fixture imports flagged by changed-file lint. Runtime
integration passed initially and after meaningful final race/binding refinements;
final static checks pass. No test failure is hidden as a passing check.

No full unit/exhaustive controller suite, full build, dev server, deployed worker,
browser/native Persian, live-provider or production qualification was attempted.
No application migration, Stripe work, deployment, activation or push occurred.
The migration is generated, committed and exercised only in disposable databases.

## Review and handoff

Codex self-review is in AI-045-review-1.md. Complete this bounded child with a
scoped local commit and stop. Next AI-046 supplies finite sensitive adapter
expansion and current business-policy evaluation. AI-042 independently integrates
both children; AI-008, explicit decisions (AI-043), execution (AI-044), UI and
provider/release gates remain open. Current executor does not generate these
proposals from model turns yet; the trusted worker primitive is ready for that
separately qualified integration and cannot itself execute actions.
