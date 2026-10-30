# AI-053 approved cash settlements

## Identity and scope

2026-10-31 (Asia/Tehran), Codex, D:/Projects/a/dubbl. Entry HEAD 636869b3,
master, initially clean. Controller selected AI-053 after completed AI-052.
Read repository rules, controller/project/backend guidance, task/dependency
evidence and actual approval/consumption, preview and cash settlement services.
Completed exactly this bounded child. No delegation, push or Stripe edits.
AI-050/AI-044/AI-008 retain independent integration acceptance.

## Implementation and acceptance mapping

1. Added trusted executeApprovedSettlement accepting only scoped run/lease/
   batch/item UUIDs. It rejects other domains before consumption and forwards
   original validated cash arguments only from a fresh one-time handoff.
   Existing consumed operations return bounded receipts without invoking the
   domain again. Extracted payDocumentInTransaction shares the existing invoice/
   bill payment service and preserves public REST/MCP contracts. No model/public
   dispatch tool, queue transition, provider call or email operation was added.

2. Shared journal/cash effect orchestration validates exact current decision,
   selection/binding, adapter, step/operation/arguments, identity/grants/config,
   resource/policy digests, original deadline, retention, cancellation and lease.
   previewSettlementInTransaction reuses the bounded shared preflight under
   domain locks. Saved recognition and historical carrying, allocations/carriers,
   contact/bank/ledger links, existing cash/control/FX accounts, exact rates/base,
   business approval and period/fiscal locks are serialized against ordinary SQL
   writers and absent-row insertions. Domain locks precede run locks, allowing
   Stop to win while the effect waits. Unsupported/unbound/self-assigned business
   approval fails closed. Final live checks follow receipt/event SQL waits.

3. Payment, allocation, balanced settlement journal, document outstanding,
   numbering, shared domain audit, operation-linked audit and succeeded receipt
   commit together. Receipts contain only document/payment/journal UUIDs and
   existing bounded metadata. Unknown outcomes never replay; lost COMMIT
   acknowledgement reconciles the durable succeeded step. Failed/current effects
   roll back while prior batch effects remain. A killed worker leaves its durable
   consumption for fresh-process uncertainty/reconciliation, without a second
   payment. Existing money storage, saved journal amounts and FX remain intact;
   no schema migration is needed.

4. New SQL harness uses real session-backed REST approval, registered MCP batch
   reads/revisions, real leases and shared document recognition/payment services.
   Fixture-only SQL queues approved runs; AI-051 still owns application resume.
   Positive cases cover invoice/bill direction, full/partial USD, 2147483648 IRR
   minor amounts, exact payment/allocation/outstanding/GL assertions, unselected
   and dependency rejection, concurrent/repeated calls and one operation audit.
   EUR recognition at 2 USD/EUR and cash at 3 exercises two successive 417/833
   payments, 834/1666 carrying rounding and immutable recognition history.
   Negatives change header/recognition lines, balance, recognition status,
   credentials/grants, cash account, saved bank state/link, contact, business
   policy, period/fiscal locks, base currency, FX rate, provider config, runtime,
   Stop and lease during actual post-consumption SQL waits, for invoices and
   bills. Wrong adapters cannot consume cash. Injected arguments/wrong leases
   and lost fresh handoffs cannot reacquire execution. Post-write event waits
   prove authority writers serialize and expiry rolls back all payment,
   allocation, journal, numbering and payment-audit counts. Trigger-induced
   second-effect failure retains the first real payment and immutable receipt.
   Real committed success with lost acknowledgement reconciles without replay.
   A separate worker killed after uncommitted money writes rolls back the entire
   effect; a fresh process recovers uncertainty and refuses the old lease.

Contract and qualification limits: ../docs/AI_SETTLEMENT_EXECUTION.md.

## Executed verification

Installed Node 23.11.0 / PostgreSQL 18. Created a task-owned randomized cluster
on 127.0.0.1:4384. Explicit TEST_DATABASE_URL feeds randomized dubbl_ci_* databases;
each test migrates/drops only its new database. No application database was used.

| Check | Actual result |
|---|---|
| Initial settlement SQL acceptance | Passed 1/1 in 41.9 seconds |
| Expanded settlement FX/race acceptance | Passed 1/1 in 49.2 seconds |
| Final node --import tsx --test --test-concurrency=1 tests/integration/ai-settlement-execution.test.ts tests/integration/ai-journal-execution.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-adapters.test.ts tests/integration/payment-settlements.test.ts tests/integration/ai-action-decisions.test.ts tests/integration/ai-action-preview.test.ts | Passed 7/7 in 145.1 seconds; final settlement case 48.0 seconds |
| Final npx tsc --noEmit | Passed, exit 0 |
| npm run lint | Passed: 0 errors, 20 existing warnings outside owned changes |
| Final npx eslint on six owned application/test files | Passed, no warnings |
| node scripts/audit-ai-capabilities.mjs | Passed, unchanged 110 modules/824 tools/586 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, unchanged seven reviewed automatic/817 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, identical ordered 1447-error baseline; zero added/removed |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

Money inventory refresh is limited to four owned consumers' hashes/occurrences/
references plus two scanned test paths and one new worker consumer. Existing annotations, schema
classifications and unrelated consumers remain unchanged. A temporary readFileSync
shim supplies HEAD inventory/owned sources to the unchanged verifier; its complete
ordered error list equals the final current list. The inventory is not a green gate.

The initial test fixture referenced singular invoice-write/bill-write paths;
corrected these to the actual plural modules and reran. Removed initial unused
fixture bindings. No failed attempt is reported as passing. No later source
changes followed the final regression run.

Final SQL confirmed zero remaining dubbl_ci_* databases and no fixture sessions.
Stopped the task-owned cluster; pg_ctl status reports no server running (expected
exit 3). No full build, dev server, application DB mutation or activation occurred.

## Review and handoff

Codex self-review is recorded separately in AI-053-review-1.md. Global table locks
can contend across organizations; finer locking needs a shared writer protocol
and separate acceptance. SQL timeouts/deadlocks fail closed; no automatic payment
retry is authorized. The shared safe-number amount ceiling remains unchanged.
AI-054 owns external invoice delivery; AI-050/044/008 retain combined acceptance;
AI-051 owns resume/worker integration. No live provider, deployed worker, UI/native
Persian, performance, deployment or production activation is qualified.
