# AI-052 approved journal posting and deletion

## Identity and scope

2026-10-31 (Asia/Tehran), Codex, D:/Projects/a/dubbl. Entry HEAD 21baac43,
master, initially clean. Controller selected AI-050 after AI-049. Read repository
and nested agent rules, controller/start/project/repository/backend documents,
product experience, decision and consumption contracts, dependency evidence and
actual shared journal/settlement/email services. No delegation or push.

AI-050 covers three distinct effect boundaries: journal transactions, cash
settlement and external invoice delivery. Split it with the controller into
AI-052, AI-053 and AI-054, preserving every original criterion and final combined
acceptance. This attempt completes only AI-052; AI-050/AI-044/AI-008 stay open.
Updated task index and source coverage. No deployment/activation is inferred.

## Implementation and acceptance mapping

1. executeApprovedJournal accepts only scoped run/lease/batch/item identifiers.
   It restricts to the two journal adapters before consumption and passes exact
   original validated arguments from the fresh one-time handoff to shared
   postJournalInTransaction/deleteDraftJournalInTransaction. Repeated consumption
   only observes bounded receipts. Public REST/MCP journal contracts retain the
   same services; no automatic or public sensitive dispatch tool was added.

2. A read-committed domain transaction acquires journal locks, reference,
   credential, provider/policy and business-approval locks before run locks. It
   verifies current exact decision/selection/binding/adapter/step/operation and
   resource/policy digests, session/grants/configuration, original deadlines and
   lease, cancellation and retention. previewJournalInTransaction reobserves
   saved journal content, active references, period/fiscal locks and business
   approval inside that locked transaction. Required/unbound business approval
   fails closed. Post-write checks include all asynchronous SQL/audit/event waits.
   Ordinary auth/policy/reference insert/update/delete writers cannot change
   those observations during the effect. New journal links are fenced for deletion.

3. Mutation, strict operation-linked domain audit and bounded succeeded receipt
   commit atomically through the existing consumption/step identity. There is
   no committed domain / missing receipt crash window. A lost COMMIT acknowledgement
   reconciles only the succeeded receipt. Unknown database outcomes retain
   uncertainty and never replay; crash rollback leaves a consumed operation for
   fresh-process maintenance. Earlier committed batch effects remain intact when
   a later action fails. Stop/expired/recovered fences cannot regain execution.
   No amounts, currencies or saved FX are rescaled; no schema change is needed.

4. Added actual session-backed REST approval and registered linked MCP proposal/
   revision flows feeding real claimNextRun and journal domain transactions in
   disposable SQL. Positive post/delete tests cover USD and 2147483648 IRR minor
   amounts, concurrent calls, prerequisite success, dependent work, unselected
   work, exact retained lines and one operation audit. Negatives include arbitrary
   arguments/wrong lease, lost handoff, edited header/lines without timestamps,
   permission/session revocation, inactive accounts, new/self-assigned business
   policy, period/fiscal locks, linked drafts, Stop, runtime/provider changes and
   lease expiry during real effect lock waits. Real auth writes are shown waiting
   behind the effect transaction. Audit INSERT expiry rolls back mutation and
   success receipt. A database trigger faults the second operation after its
   mutation, retaining the first actual posted effect and uncertain second receipt.
   A wrapper loses only a real transaction's committed success acknowledgement;
   the adapter observes the receipt without another mutation. A worker is killed
   while its mutation is uncommitted; another process recovers uncertainty and
   confirms no journal replay. No payment, email or provider effect is invoked.

Implementation contract and limits: ../docs/AI_JOURNAL_EXECUTION.md.

## Executed verification

Installed Node 23.11.0 / PostgreSQL 18. Created a task-owned randomized cluster
on 127.0.0.1:4383; explicit TEST_DATABASE_URL feeds randomized dubbl_ci_* databases.
Each case migrates/drops only its new database. No application database was used.
Fixture-only SQL queues approved runs; application resume remains AI-051.

| Check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-journal-execution.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-preview.test.ts tests/integration/ai-action-adapters.test.ts tests/integration/journal-lifecycle-wire.test.ts tests/integration/journal-wire.test.ts | Passed 6/6 in 88.2 seconds, real SQL/REST/MCP and fresh recovery process |
| Final node --import tsx --test tests/integration/ai-journal-execution.test.ts | Passed 1/1 in 35.8 seconds after adding lost-COMMIT-acknowledgement coverage; no later source changes |
| Final npx tsc --noEmit | Passed, exit 0 |
| npm run lint | Passed: 0 errors, 20 existing warnings outside owned changes |
| Final npx eslint on seven owned application/test files | Passed, no warnings |
| node scripts/audit-ai-capabilities.mjs | Passed, unchanged 110 modules/824 tools/586 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, unchanged seven reviewed automatic/817 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, identical ordered 1447-error baseline; zero added/removed errors |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

Money inventory updated only seven owned source hashes/occurrences/references and
new scanned paths, preserving unrelated classifications and schema columns. A
temporary readFileSync shim supplied HEAD registry and owned source contents to
the unchanged verifier; its full error list exactly equals the final current list.
No migration was generated because no schema changed.

Early fixture failures were corrected and rerun: Stop with a lost executing
handoff correctly retains running work, so the fixture expires/reconciles it
before submitting another run; linked journal fixtures require a description;
resource modifications use the already held SQL lock connection to avoid a new
writer queuing behind the adapter's table lock. Removed unused fixture imports.
No failed attempt is reported as passing.

Final SQL confirmed zero remaining dubbl_ci_* databases. Stopped the task-owned
cluster; pg_ctl status reports no server running (expected exit 3). No fixture
process/application DB mutation remains. No full build/dev server was run.

## Review and handoff

Codex self-review is recorded separately in AI-052-review-1.md. Conservative
global table locks can contend across organizations, and deadlocks/timeouts
fail closed; this is not performance/production qualification. Finer locking
needs a shared writer protocol and separate qualification. AI-053 owns payments,
AI-054 owns external invoice delivery, AI-050 owns combined domain acceptance,
AI-051 owns resume/worker orchestration. UI/native Persian, live providers,
deployment and activation remain unqualified. Stripe files/functionality unchanged.
