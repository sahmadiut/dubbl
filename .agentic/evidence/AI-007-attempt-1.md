# AI-007 attempt 1 - durable multi-step execution integration

## Identity

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD 8fd2a7f7.
Entry tree was clean. Controller validate/status/next selected AI-007 after
AI-022 and AI-023 completed. Started only AI-007. This is independent parent
integration acceptance with an honestly attributed Codex self-review, not an
independent peer/human review or production qualification.

## Implementation and acceptance mapping

Extended tests/integration/ai-runtime-acceptance{.test,-worker}.ts with a combined
journey through actual REST submission, polling/leases, encrypted credential
adapter, whole raw provider-response validation, metered execution, registered
domain MCP tools, and REST/MCP observation. DNS/HTTPS are mocked before consumers
load; no external request occurs. Synthetic keys and enabled runtime flags exist
only inside disposable fixture processes. Existing production services required
no change. Updated AI_WORKER.md and the task handoff with the acceptance boundary.

1. Discovery, dependent tools, grounding and clarification: seed two matching
   supplier records plus a foreign-organization match. The poller executes
   list_contacts with a supplier/name filter, sees both permitted IDs but no
   foreign record or private email/notes, then persists a clarification question.
   Execution stops with one read receipt and no draft. The authorized versioned
   text answer selects one ID; a new polling invocation performs get_contact,
   create_expense_claim and get_expense_claim using the actual new draft ID.
   Independent SQL asserts total_amount::text='1250', currency_code='USD',
   status='draft' and exactly one expense. Four ordered succeeded receipts bind
   to the exact provider-call operation keys. Both client transports expose the
   same live draft links/status/exact amount, never the provider's forged payment
   narrative or URL. Existing clarification fixtures cover missing date data;
   scoped candidate-choice primitives are separately covered by ai-run-input.

2. Limits and stop/failure: this journey retains the original config/deadline
   across input wait and six original attempt ordinals, each with exactly one
   settled synthetic charge of 120 tokens and 270000000 cost atoms. The executed
   provider-attempt/loop, tool-operation, usage, lifecycle, executor and polling
   regressions cover eight provider attempts, twenty tool steps, output/context
   ceilings, cumulative run payload, token/cost budgets, elapsed deadlines,
   provider timeout/failure, 429/503 bounded retries, cancellation and kill.
   Unknown usage remains conservatively charged; transient retry does not turn
   a partial/unknown run into successful or free work. Reconnect is observation.

3. Durable idempotency, order and uncertain effects: actual competing pollers
   claim the discovery journey without duplicate reads or drafts. Repeating the
   original request key through REST and registered MCP while awaiting input
   returns the same run with no table changes or network dispatch. Readback
   cannot occur until the draft's actual receipt provides its ID. Repeating the
   accepted answer after completion returns its original receipt without work.
   Executed fresh-process crash/restart, lost handoff, committed-writer wait and
   unknown-reservation regressions retain known receipts and require
   reconciliation rather than replay. Partial outcomes retain completed records;
   stop does not claim transaction-wide rollback.

4. Untrusted content and public export: private contact emails/notes and foreign
   records never enter provider history. The existing combined cases reject
   reasoning/unsupported/duplicate/sensitive/oversized raw output before business
   dispatch, even with complete-looking earlier bytes. Clarification injection
   saying APPROVE ALL PAYMENTS creates no approval. Client schemas reject an
   injected approval field. Final summaries are server-owned finite codes and
   live permission-checked receipts; public events have only kind, sequence and
   timestamp. Model prose and saved redacted payloads confer no authority.

5. Shared REST/MCP services and deterministic integration: actual submission
   handlers and registered MCP submit_ai_run return the same persisted run;
   get_ai_run_input, answer_ai_run_input and get_ai_run_observation consume the
   same services as REST. Observation checks private,no-store caching and exact
   transport parity. Competing workers, cancellation during delayed provider and
   business effects, lease races, configuration/identity/policy changes and
   multi-tool completion pass the broader executed integrations.

6. AI-023 state contract: the combined journey passes queued, awaiting_input,
   resumed and succeeded states with grounded live links. Same/future-cursor
   reconnects leave hashes of runs, steps, attempts, usage, events, expenses,
   inputs, provider calls, messages and approvals unchanged; network count also
   stays unchanged. Revoking domain permissions hides all four step results on
   the same execution cursor, without mutating execution state. The executed
   existing combined/input/progress/observation/lifecycle suites independently
   verify lost answer acknowledgements, stale versions, stop requested versus
   acknowledged, failed/not-started/partial/reconciliation outcomes, runtime-off
   observation and cursor recovery. These are shared data contracts for future
   UI and existing MCP clients, not a claim that Assistant UI is implemented.

## Verification

All commands ran at D:/Projects/a/dubbl with installed Node v23.11.0/dependencies.
Explicit TEST_DATABASE_URL selected the existing synthetic PostgreSQL18 cluster
at 127.0.0.1:55493. It was stopped at entry; it was started with explicit loopback
host/port for checks. Each harness creates/migrates/drops randomized dubbl_ci_*
databases. Verified zero remaining fixture databases and stopped the cluster
after testing. No application database was queried or changed.

| Check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-runtime-acceptance.test.ts | Passed initially, in the combined run, and after the final supplier-type and six-charge assertions; final 12.3 seconds |
| node --import tsx --test --test-concurrency=1 with ai-runtime-acceptance, ai-polling-observation, ai-run-observation, ai-worker, ai-provider-loop, ai-executor, ai-provider-attempts, ai-tool-operations, ai-run-input, ai-run-progress, ai-run-lifecycle, ai-persistence, ai-usage, ai-providers, ai-tool-registry .test.ts | 16/16 passed, 129.1 seconds; subsequent fixture refinements rechecked with the targeted test |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed again after final test edits |
| npx eslint tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-runtime-acceptance-worker.ts | Passed after final test edits, zero warnings/errors |
| npm run lint | Exit0, zero errors, 20 existing warnings outside task files |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 816 tools, 578 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 809 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys in each production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 unchanged baseline diagnostics; comparison below |
| python .agentic/agent.py validate; git diff --check | Passed; final controller/staged checks repeated before commit |

The money-inventory raw stderr SHA256 is
4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186,
identical to the committed AI-023/031 baseline. No changed task path intersects
its consumer/schema/checker/inventory inputs. This gate remains failed, not
waived or repaired by the task.

Initial fixture setup failed to bind the cluster's default port; starting with
its established explicit 127.0.0.1:55493 options fixed it. The first in-progress
typecheck caught an unsupported fixture contact.company field; corrected to
schema-backed names before the first successful database test. Inspection also
removed an already-consumed response clone and used the real answer receipt
instead of guessing its field names. Final static and integration checks pass.

No schema changed, so no migration generation was needed. No full unit/exhaustive
controller suite, build, dev server, live provider request, deployment, activation,
Stripe work or push occurred. PostgreSQL16/hosted CI, actual provider/account/
model/pricing/tokenizer, deployed supervisor/POSIX signal handling, raw model-token
streaming, browser/native-Persian UX and production qualification remain untested.
Provisional delivery is bounded server-status snapshot polling. Sensitive action
previews/approvals and the Assistant UI remain separately scheduled work.

## Review and handoff

Codex self-review is recorded separately in AI-007-review-1.md. No unresolved
implementation defect was found in this local backend acceptance boundary.
Complete AI-007 with one scoped local commit. Obtain the next task from the
controller, report it and stop. No push was requested.
