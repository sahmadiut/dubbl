# AI-044 combined approved execution acceptance

## Identity and scope

2026-11-01 (Asia/Tehran), Codex, D:/Projects/a/dubbl. Entry HEAD 49ab03b1,
master, clean tree. Live controller selected AI-044 with all dependencies done.
Read applicable root/nested rules, start/controller/backend/project/repository
guidance, task/dependency evidence, product/source contracts and the actual
executor, worker, approval/consumption and effect-boundary implementations.
Exactly one controller task; no delegation or push. AI-008 retains its separate
outer preview/decision/resume acceptance.

Existing correct production implementations were reused. Added
ai-approved-execution-acceptance.test.ts and a separate AI044_ACCEPTANCE scenario
branch in ai-approved-worker-fixture.ts, reusing its real transport/domain setup
and SQL helpers. Added the combined contract in
../docs/AI_APPROVED_EXECUTION_ACCEPTANCE.md. No application source, public REST/MCP
contract, schema, migration, runtime flag or Stripe file/functionality changes.

## Acceptance mapping

1. The durable executor branches through executeApprovedBatch before the model
   loop and routes only the reviewed journal, settlement and saved-contact email
   adapters. Actual effect transactions recheck exact original arguments,
   selected step/dependency/decision bindings, actor/org/identity, resource and
   policy versions, current domain permissions/configuration, business approval,
   period/fiscal locks, deadline/retention, Stop and lease after SQL waits.
   The new parent test pauses the next invoice payment after its durable
   consumption and races expiry, a valid newly required independent business
   workflow and permission revocation. Only the prior posted journal remains;
   payment is failed and no delivery/deletion follows. Adapter regressions retain
   broader journal/payment/email resource, policy, fiscal/period, credential,
   quota, authority and final receipt/audit/event wait checks.

2. Parent acceptance races two actual executeRun invocations on the same lease
   while one waits on the payment domain SQL lock. The competitor returns busy.
   A fault wrapper loses acknowledgement only AFTER the real middle payment and
   receipt transaction commits. The adapter reconciles that original succeeded
   receipt, and the remaining selected chain completes. Independent SQL asserts
   exactly 2147483648 IRR minor units, one allocation for the invoice, one linked
   operation audit, a balanced settlement journal, five distinct consumed items
   sharing one decision, and exactly one external transport acceptance. Repeat
   REST resume observes the original MCP queue receipt; consumptions and steps
   remain identical and nothing is queued or resent. Consumption and per-adapter
   regressions repeat concurrent claims, lost handoffs/COMMIT acknowledgements,
   immutable identities, rollback and fresh-process reconciliation.

3. A real posted prerequisite with its succeeded step is deliberately damaged in
   four separate database fixtures: missing consumption, wrong argument digest,
   wrong policy digest or wrong resource digest. After lease expiry/maintenance,
   the actual worker stops each batch without payment or external sending. The
   existing posting survives; replayed resume cannot queue it again. The rerun
   mixed/worker suites retain failed/uncertain email, later deletion failure,
   Stop during a domain wait, edited approved resources, committed financial
   prefixes, fresh-lease continuation between effects and killed-process uncertain
   delivery recovery without replay. Each effect commits separately; no
   transaction-wide rollback is claimed.

4. Parent assertions retain exactly seven automatic tools, all read/draft, and
   exclude executor/consumption/security/provider/role operations from that
   catalog and the registered action transport. No provider attempt is created
   by the new approved journeys. Actual automatic dependent read/draft,
   clarification, reconnect and raw-adapter regression suites verify existing
   behavior; decision/worker suites retain unknown-field/confirmation injection,
   unselected action and no-resume/model-fallback denials. Model text and
   clarification never grant approval or expand selection.

5. New parent assertions plus child regressions exercise actual session-backed
   REST handlers, linked registered MCP, scoped leases, domain services,
   transactions/constraints and independently committed SQL across posting,
   invoice/bill cash payments, deletion and saved-contact email. Provider email
   transport/session acquisition are stubbed and commit/crash failures are
   explicitly injected. No live provider or production authentication,
   deployment/activation qualification is implied; default-off gates remain.

## Verification

Node 23.11.0 / PostgreSQL 18, installed dependencies. Created a randomized
task-owned PostgreSQL cluster listening only on 127.0.0.1:4388. Explicit
TEST_DATABASE_URL targets that cluster; each harness creates, migrates and drops
its own random dubbl_ci_* database. NODE_ENV=test and IRR_TESTING_ENABLED=true
enable fixtures only. No application database or live provider was used.

| Command/check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-approved-execution-acceptance.test.ts | Final focused run passed 1/1 in 20.0s after last uniqueness assertions |
| Combined integration regression command below | Passed 14/14 in 368.8s, zero skipped/cancelled |
| node node_modules/typescript/bin/tsc --noEmit | Passed twice, including after final test assertions |
| npm run lint | Passed, zero errors and 20 pre-existing warnings |
| Changed-file ESLint for both owned TypeScript files | Passed without warnings after final test assertions |
| node scripts/audit-ai-capabilities.mjs | Passed: 110 modules, 825 tools, 587 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed automatic tools, 818 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1; exact ordered 1447-error entry-HEAD baseline, zero added/removed diagnostics |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

Combined command, with the same explicit local test environment:

```text
node --import tsx --test --test-concurrency=1 tests/integration/ai-approved-execution-acceptance.test.ts tests/integration/ai-approved-worker.test.ts tests/integration/ai-mixed-effects.test.ts tests/integration/ai-journal-execution.test.ts tests/integration/ai-settlement-execution.test.ts tests/integration/ai-email-execution.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-decisions.test.ts tests/integration/ai-action-integration.test.ts tests/integration/ai-action-storage-acceptance.test.ts tests/integration/ai-executor.test.ts tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-worker.test.ts
```

The inventory refresh adds one scanned test path/consumer and updates only the
owned fixture source hash/occurrences/references. Programmatic comparison verifies
unchanged schema entries and all unrelated consumers/classifications. Captured
the failing money baseline before test edits, normalized PowerShell's first
native-stderr wrapper, and compared all diagnostic lines in order. This remains
an existing failing inventory, not a green financial readiness claim.

Initial corrections: initdb was first given a directory containing its redirected
log, so initialization was retried in its empty data subdirectory. The first
parent run used invoice_id in a SQL allocation assertion; the actual shared
allocation schema uses document_id. Corrected it and subsequent focused runs
passed. The first money comparison filter omitted PowerShell's wrapped first
diagnostic; normalizing that prefix established the exact matching baseline.
No failed attempt is reported as passed. After the final stronger assertions,
the focused suite, typecheck and changed-file lint passed again; subsequent
changes are documentation/controller/registry only.

Final SQL verified zero remaining fixture databases and zero fixture sessions.
The task-owned cluster was stopped and pg_ctl status reports no server running.
Automatic approval review rejected the combined shutdown/recursive temporary
directory deletion command, citing policy without a specific reason. A separate
non-deleting shutdown succeeded; the stopped cluster files remain under the
randomized dubbl-ai044-* directory in the user's temporary folder. No full build,
dev server, live external send, deployment or activation was performed.

## Review and handoff

Actual self-review is recorded in AI-044-review-1.md. Live providers, production
MCP interactive approval, deployed-worker supervision, throughput, browser/native
Persian and production activation remain unqualified. Confirmed email means
transport acceptance, not inbox delivery. Conservative global domain table locks
retain their contention limit. Complete only this scoped local commit and stop;
no push or next-task implementation is authorized.
