# AI-050 combined sensitive domain effect acceptance

## Identity and scope

2026-10-31 (Asia/Tehran), Codex, D:/Projects/a/dubbl. Entry HEAD 3ea0cd25,
master, initially clean. Live controller selected AI-050 after AI-049/052/053/054.
Read root/nested rules, controller/start/project/repository/backend guidance,
decision/product/domain contracts, dependency evidence and the actual shared
consumption, execution, locking and domain services. No delegation or push.

This is independent combined acceptance of the completed domain children, using
new mixed-effect assertions. Reused the existing correct trusted execution
implementation rather than adding a second dispatcher. AI-051 retains application
resume/worker integration; AI-044 and AI-008 retain their parent acceptance.

## Acceptance mapping

1. New ai-mixed-effects.test.ts/ai-mixed-effects-worker.ts feed actual MCP batch
   observation/revision and session-backed REST approval into actual claimNextRun
   leases and trusted domain execution. One exact decision selects a dependency
   chain of manual journal posting, invoice cash settlement, bill cash settlement,
   saved-contact invoice email and draft deletion, with another journal left
   unselected. All targets are distinct saved resources. Wrong adapter, argument
   injection, unselected work and execution before a cross-domain prerequisite
   reject without consumption. Payment plus email of the same resource is refused
   even with valid independent item graphs. USD and 2147483648 IRR minor amounts
   remain exact in persisted payments/allocations, balanced journals, display
   totals and rendered email. GL totals exclude deletion and email. Shared
   postJournalInTransaction/deleteDraftJournalInTransaction,
   payDocumentInTransaction and saved rendering/delivery services remain the only
   domain implementations. No schema or public REST/MCP contracts change.

2. Reviewed the shared executeApprovedEffect boundary and conservative journal,
   settlement and email lock sets. Each actual effect rechecks exact original
   arguments, batch/decision/selection/step/adapter/resource/policy bindings,
   identity, current domain permission/configuration/runtime, lease, retention,
   deadline and cancellation. Journal/payment also enforce period/fiscal and
   saved money/FX/reference state. Required/unbound business approval fails closed.
   New mixed tests commit an earlier journal, pause the next payment after durable
   consumption on real SQL domain locks, then race resource edits without timestamp
   changes, permission revocation, Stop and lease expiry. No payment occurs and
   the earlier actual posted journal survives. Existing child suites rerun their
   broader policy/period/fiscal/reference/provider/session/recipient/quota races
   and final audit/event/SQL wait checks. Email retains final checks immediately
   before the single stubbed transport call while locks serialize ordinary writers.

3. All five successful effects retain distinct immutable consumption identities
   sharing the same decision and dispatch lease, with one operation-linked audit
   per effect. Repetition returns only identical receipts and does not change
   consumption/step rows or resend. Injected loss of acknowledgement after a real
   middle payment/receipt COMMIT reconciles the existing succeeded receipt. Stop
   between domains retains exactly the committed prefix. Known email rejection
   and unknown transport acknowledgement preserve three prior financial effects,
   distinguish failed/uncertain delivery and prevent later deletion or resend.
   A database trigger faults deletion after a confirmed email: the draft remains,
   while email and earlier financial effects/receipts survive. A separate process
   is killed after three financial commits and simulated provider acceptance;
   another process performs lease maintenance, retaining succeeded financial
   receipts and the uncertain delivery, requiring reconciliation and refusing old
   lease execution and ordinary resend. Repeated maintenance leaves receipts
   unchanged. No current record status reconstructs authority or lost arguments.

4. The new mixed suite and seven related suites pass together against migrated
   disposable SQL. Tests use actual services, sessions/REST handlers, registered
   linked MCP tools, leases, constraints, transactions and recovery processes;
   external transport alone is stubbed. Existing per-adapter tests retain
   concurrent callers, asynchronous authority/expiry races, crash rollback,
   separate delivery outcomes and exact-money/FX coverage. Default-off rollout,
   live-provider gates and automatic tool allowlist remain unchanged.

Contract: ../docs/AI_MIXED_EFFECT_EXECUTION.md. Task-owned inventory refresh adds
only two scanned paths and the new worker consumer; all old classifications,
annotations, source hashes and schema rows remain unchanged.

## Executed verification

Installed Node 23.11.0 / PostgreSQL 18. Created a randomized task-owned cluster
listening only on 127.0.0.1:4386. Explicit TEST_DATABASE_URL points the harness
there; every test creates, migrates and drops only its random dubbl_ci_* database.
IRR_TESTING_ENABLED=true and NODE_ENV=test enable local IRR fixtures. Provider
calls stay disabled. No application database is used. SQL fixture queuing is
explicit and does not claim application resume or worker orchestration support.

| Check | Actual result |
|---|---|
| Focused node --import tsx --test tests/integration/ai-mixed-effects.test.ts | Passed 1/1 in 19.3 seconds after fixture corrections |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-mixed-effects.test.ts tests/integration/ai-journal-execution.test.ts tests/integration/ai-settlement-execution.test.ts tests/integration/ai-email-execution.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-decisions.test.ts tests/integration/ai-action-adapters.test.ts tests/integration/ai-action-storage-acceptance.test.ts | Passed 8/8 in 168.9 seconds; mixed case 17.7 seconds |
| Final node node_modules/typescript/bin/tsc --noEmit | Passed, exit 0 |
| npm run lint | Passed, exit 0; zero errors, 20 preexisting warnings outside owned changes |
| node node_modules/eslint/bin/eslint.js tests/integration/ai-mixed-effects.test.ts tests/integration/ai-mixed-effects-worker.ts | Passed without warnings |
| node scripts/audit-ai-capabilities.mjs | Passed; unchanged 110 modules/824 tools/586 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed; unchanged seven reviewed automatic/817 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, exactly the ordered 1447-error HEAD baseline; zero added/removed errors |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

The money baseline comparison used a temporary readFileSync shim supplying only
HEAD's registry to the unchanged verifier. All old source files remain unchanged;
the current inventory adds only the new test paths/consumer. Exact captured
ordered diagnostic lists match. This is an existing failing inventory, not a
green financial readiness gate.

Initial fixture attempts corrected an invalid pool export in cleanup, an
expectation of a returned error where the trusted primitive throws, and manual
journal fixture numbering that collided with shared domain-generated numbers.
Fixtures now use the actual current journal maximum and db.$client cleanup.
An initial typecheck exposed the same cleanup error; the final corrected check
passed. No failed attempt is represented as passing. No application/test changes
followed the final combined regression run.

Final SQL confirmed zero remaining fixture databases and zero fixture sessions.
Stopped the task-owned cluster; pg_ctl status reports no server running (expected
exit 3). No full build, dev server, live external delivery, application DB mutation,
deployment or rollout activation occurred. No Stripe files/functionality changed.

## Review and handoff

Codex self-review is recorded separately in AI-050-review-1.md. Existing global
table locks can contend across organizations; email retains them while awaiting
transport acknowledgement. Confirmed delivery means transport acceptance only.
The shared safe-number amount ceiling remains unchanged. Live providers,
performance, deployed workers, UI/native Persian, deployment and production
activation are unqualified. AI-050 completes this combined domain acceptance;
AI-051 is the next task and AI-044/AI-008 remain open. Stop after the scoped local
commit; no push is authorized.
