# AI-051 explicit approved batch resume and worker execution

## Identity and scope

2026-10-31 (Asia/Tehran), coding-assistant (Codex), D:/Projects/a/dubbl.
Entry HEAD a56de87d, master, clean tree. Live controller selected AI-051 after
AI-050. Read root AGENTS, controller/start/project/repository/backend guidance,
task/dependency evidence and decision/product/domain/worker implementation.
One task, no delegation, push, build, dev server, deployment or activation.
AI-044 and AI-008 retain independent combined acceptance.

## Acceptance mapping

1. `resumeActionBatch` and its strict schema in lib/ai/action-batches.ts back both
   POST /api/v1/ai/runs/[id]/action-batch/resume and the registered linked MCP
   resume_ai_action_batch tool. They accept exact batch/run versions, preview
   binding, complete persisted selection and a request key, requiring an existing
   interactive approval, current identity/configuration, live permissions and
   resource/policy/expiry bindings. REST rejects body runId and query fields;
   both reject argument/confirmation injection. Generated migration 0028 adds a
   composite-scoped content-free resume receipt; receipt, queue, event and audit
   commit atomically and checks repeat after SQL waits. Exact retries return the
   original queue receipt without queuing again, including after completion/Stop.
   Actual REST and MCP positive journeys cover all five effects and both USD and
   large IRR values. Decision alone remains awaiting_approval and unclaimable.
   Unapproved, stale selection/resource, revised approval, expired deadline,
   runtime-off and revoked-domain cases fail closed. Lost real resume COMMIT
   acknowledgement and competing REST/MCP callers retain exactly one queue event.

2. `executeApprovedBatch` is the existing executor's first branch under its
   process advisory lock. It routes only selected action kinds and identifiers
   into the existing posting/deletion, invoice/bill settlement and saved-contact
   email adapters. Arguments enter a domain service only via fresh consumption.
   Every selected dependency must have a confirmed step and immutable matching
   consumption receipt. Failed/uncertain/missing/corrupt prerequisites stop further
   effects. Completion rechecks live lifecycle/permission/expiry and skips
   unselected prepared steps. The new fixture runs the actual polling worker on
   a posting -> invoice payment -> bill payment -> email -> deletion chain with
   an unselected post. SQL verifies exact balances, partial prefixes, operation
   identities and durable delivery state. No provider/model attempt is added;
   a queued proposal lacking a resume receipt cannot fall through to the model.

3. New worker journeys verify a resource edit after resume preserves only the
   posted prefix; Stop while a payment waits on a real domain SQL lock preserves
   that prefix without payment/delivery; known rejection and unknown delivery
   acknowledgement preserve earlier financial effects and block deletion/resend.
   A resume audit-lock permission race rolls back both queue and receipt. After
   a lease expires between two committed effects, a fresh worker lease observes
   those original receipts and executes only the remaining unconsumed actions.
   A separate polling worker is killed after simulated external acceptance;
   maintenance in another process retains uncertain delivery, prior financial
   receipts and reconciliation_required without resend or remaining deletion.
   Repeat resume/maintenance is inert. Existing retention/clarification/worker
   suites exercise expiry, deletion, lease renewal and shutdown. Maintenance
   exposed an existing SQL precedence bug: the content-presence OR in
   expireActionBatchContent bypassed the expiry bound. Parenthesizing it preserves
   unexpired proposals while existing expired-content tests still pass.

4. New ai-approved-worker.test.ts/ai-approved-worker-fixture.ts use migrated
   disposable PostgreSQL, actual sessions/REST handlers, linked registered MCP,
   real run claims/heartbeats/domain transactions/constraints and independent SQL.
   Only external delivery and model transport are stubbed; the approved branch
   never calls the model stub. REST/MCP progress now exposes permission-checked
   finite sensitive-action outcome codes and live record links, with successful
   readback exercised through both transports. Ten related SQL suites pass
   together. Automatic catalog remains seven read/draft operations. Default-off
   gates, existing worker startup flags and Stripe functionality are unchanged.

## Verification

Node 23.11.0 and PostgreSQL 18. Created a randomized task-owned cluster listening
only at 127.0.0.1:4387. Explicit TEST_DATABASE_URL targets that cluster; each
harness creates, migrates and drops its random dubbl_ci_* database.
NODE_ENV=test and IRR_TESTING_ENABLED=true enable local fixtures only.
No application DB or live provider was used. Migration snapshot comparison
confirms only public.ai_action_resume was added; every prior table is unchanged.

| Command/check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-approved-worker.test.ts | Expanded final focused run passed 1/1 in 25.0s |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-approved-worker.test.ts tests/integration/ai-worker.test.ts tests/integration/ai-executor.test.ts tests/integration/ai-mixed-effects.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-decisions.test.ts tests/integration/ai-action-storage-acceptance.test.ts tests/integration/ai-run-progress.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-run-observation.test.ts | Passed 10/10 in 160.0s |
| npx drizzle-kit generate | Generated 0028_spotty_sharon_ventura.sql, snapshot and journal; applied by all disposable harnesses |
| node node_modules/typescript/bin/tsc --noEmit | Passed, exit 0 |
| npm run lint | Passed, zero errors and 20 pre-existing warnings |
| Changed-file ESLint covering all ten owned TypeScript paths | Passed without warnings |
| node scripts/audit-ai-capabilities.mjs | Passed; 110 modules, 825 tools, 587 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed; seven reviewed automatic tools, 818 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1; exact ordered 1447-error starting-HEAD baseline, zero added/removed diagnostics |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

The baseline money verifier ran in a temporary detached worktree at a56de87d
using the installed dependency directory junction. PowerShell's first diagnostic
wrapper was normalized before comparing all 1447 diagnostics in order. The
baseline worktree and junction were removed. Registry refresh preserves existing
classifications/annotations and only adds six owned scanned paths, three consumers
and the non-money resume version column, updating owned source hashes/occurrences.
The existing inventory remains a failing gate, not a green financial claim.

Initial focused attempts failed on maintenance erasing unexpired proposals; the
SQL predicate fix resolved it. An expanded race assertion initially watched for
the wrong lock-query prefix and was corrected to the actual settlement lock.
Final focused and combined runs passed after these corrections. No application
or test code changed after the final combined run. Documentation/registry-only
changes followed. Final SQL reports zero fixture databases and sessions; the
task-owned cluster is stopped.

## Review and handoff

See AI-051-review-1.md for honest self-review. Contract:
../docs/AI_APPROVED_BATCH_RESUME.md. No live-provider, deployed-worker, production
MCP interactive approval, UI/native Persian, throughput or production-readiness
claim. Existing global domain table-lock contention remains. Email confirmation
means transport acceptance, not inbox delivery. No activation, full build or dev
server was authorized or performed. Finish scoped local commit and stop; no push.
