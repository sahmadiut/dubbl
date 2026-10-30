# AI-033 attempt 1 - metered provider protocol, executor and polling acceptance

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD 09724778.
Entry tree clean. Controller validate/status/next selected AI-033 after completed
AI-034/035/036. Started only this task. This is combined integration acceptance
with Codex self-review, not independent peer or human approval. AI-031/023/007
retain their original acceptance criteria.

## Implementation and acceptance mapping

Added tests/integration/ai-runtime-acceptance.test.ts and its isolated worker
fixture. Unlike the earlier combined polling fixture's injected transport, this
test invokes the actual runWorker without a transport override. It composes
createRunTransport, scoped encrypted credentials, providerPostRaw, the bounded
protocol/attempt/usage executor, registered MCP draft tools and the same real
REST/MCP observation/clarification contracts used by clients. Both DNS and HTTPS
are mocked before their consumers load, so no external request occurs. Live-call
flags are changed only in that disposable child process for mocked-adapter tests;
no project environment or rollout configuration is changed.

1. Actual competing pollers claim and execute a dependent draft then durable
   clarification. An MCP answer queues the same run, and a new polling invocation
   receives the original live receipt and authorized answer. The draft's real ID
   and exact amountMinor='1250' enter the request; private narration/request
   markers do not. SQL independently verifies total_amount::text='1250', currency
   USD and draft status. The deadline remains original, provider ordinals are
   1/2/3, and all three reservations settle to 120 tokens/270000000 cost atoms
   using the synthetic price (including cached input). Approval-looking answer
   text remains untrusted and produces no sensitive operation.

   Existing actual-worker/process fixtures were rerun, including fair admission
   behind a 101-row busy-owner backlog, separate-process clarification/continuation,
   killed workers after known effects, fresh-process recovery and bounded graceful
   shutdown. They preserve operation/attempt identity, original snapshots/deadline,
   charges and uncertain effects without replay. Startup and process/supervisor
   limits remain documented in docs/AI_WORKER.md.

2. HTTP503 after a committed draft causes exactly one fresh, separately charged
   retry; a later valid completion does not erase the unknown charge or promote
   the run from reconciliation to success. The draft remains inspectable through
   matching REST/MCP views. Unknown charged tokens stay positive and charged cost
   equals the retained reservation. Repeated HTTP429 reaches the persisted two-
   transient-failure bound with exactly two charges and no effect.

   Existing metering/attempt/loop/worker fixtures recheck original output, request,
   payload, step, token, time and cost ceilings, current stricter/original budgets,
   price/config/policy snapshots, identity and kill/cancellation guards, quota/
   rate/concurrency denial and separate-process restart. No provider/model fallback,
   automatic business retry or untrusted settlement surface is introduced.

3. The synthetic HTTPS mock delivers every response in two parts, withholding the
   final JSON byte. A gated raw response already contains a complete-looking draft
   call and then an unsupported reasoning item: repeated REST/MCP observation sees
   only WAITING_FOR_RESPONSE and zero steps. No call executes before the full
   body arrives, and the eventual invalid body executes nothing. Its trustworthy
   usage still settles independently of content rejection.

   After separate known first drafts, sensitive bank-transfer calls, repeated call
   identity and an unknown/incomplete finish fail with PARTIAL_COMPLETION and just
   one call association/effect; oversized raw output retains unknown usage and
   RECONCILIATION_REQUIRED instead. Model prose, fake payment claims, model URLs,
   private reasoning, arguments and credentials never appear in observation or
   persisted final assistant messages. Sensitive operations remain outside the
   reviewed automatic catalog and still require AI-008's separate approval work.

4. A DNS hook revokes domain permissions before the second request transmits.
   Only the first HTTPS request occurs; its already committed draft survives,
   and public observation hides its now-restricted record. Runtime/provider-off
   reconnect with zero/current/future cursors leaves hashes of entire run/step/
   attempt/usage/event/expense tables unchanged and sends no request.

   Rerun observation/worker/process fixtures cover actual INSERT cancellation,
   delayed disclosure and writer waits, terminal/unavailable queue states, grant
   revocation/expiry/deletion, cursor loss, bounded histories and crash/recovery.
   Provisional delivery remains bounded server-status snapshot polling, distinct
   from persisted confirmed receipts/live record links. Raw token/freeform model
   prose streaming is neither exposed nor qualified by this task.

5. Updated the dependent-executor documentation to distinguish completed local
   combined checks from pending live/host/UI qualification. No production service,
   REST/MCP operation, schema, inventory contract, money unit or migration needed
   modification. No unresolved implementation defect was found in this acceptance
   review; this task adds independent combined regression coverage and evidence.

## Verification

Explicit TEST_DATABASE_URL targeted the existing synthetic PostgreSQL18 cluster
at 127.0.0.1:55493. Confirmed stopped, started it for the checks and stopped it
afterward. Each harness creates, migrates and drops randomized dubbl_ci_*
databases; no application database or supplied target is reset/migrated. Installed
Node v23.11.0/dependencies were used. No environment file, live provider, deployment,
activation, build, dev server, Stripe functionality/file or push was changed/run.

| Check | Result |
|---|---|
| node --import tsx --test tests/integration/ai-runtime-acceptance.test.ts | Passed; final standalone run 10.1 seconds, then passed again within combined regression run |
| node --import tsx --test --test-concurrency=1 with ai-runtime-acceptance, ai-polling-observation, ai-run-observation, ai-worker, ai-provider-loop, ai-executor, ai-provider-attempts, ai-tool-operations, ai-run-input, ai-run-progress, ai-run-lifecycle, ai-persistence, ai-usage, ai-providers .test.ts files | 15/15 passed, 134.2 seconds; new acceptance test loaded final strengthened outcome assertions |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed on final source/tests |
| npx eslint tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-runtime-acceptance-worker.ts | Passed on final tests, zero warnings/errors |
| npm run lint | Exit0, zero errors and 20 existing warnings outside task files |
| npx drizzle-kit generate | No schema changes, nothing to migrate; drizzle/ unchanged |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 816 tools, 578 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 809 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys per production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, unchanged 1447 baseline diagnostics; stderr SHA256 4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186 |
| python .agentic/agent.py validate; git diff --check | Passed; completed state and staged diff rechecked separately |

The audit's raw diagnostic hash matches the preceding committed baseline.
Git's changed-path set intersects none of the inventory/checker/consumed-source/
schema set's 1913 paths. This global money gate remains failed, not waived or
represented as passed. No unrelated baseline repair was attempted.

Full unit/exhaustive controller suites, PostgreSQL16/hosted CI, actual provider/
account/model entitlement, pricing/tokenizer, deployed host/supervisor/POSIX signal,
raw token streaming, browser/native-Persian and production/rollout qualification
remain unperformed. Local synthetic checks and configuration do not imply them.

## Handoff

Complete AI-033 with one local scoped commit. Next controller task is AI-031's
independent integration acceptance; AI-023/007 also remain open. No push requested.
