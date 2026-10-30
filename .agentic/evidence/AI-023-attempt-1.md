# AI-023 attempt 1 - shared execution and client recovery acceptance

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD 43e212b7.
The entry tree was clean. Controller validate/status/next selected AI-023 after
AI-029/030/031 completed. Started only AI-023. This accepts the combined child
contracts with Codex self-review, not peer/human approval. AI-007 retains every
original criterion and requires its own integration acceptance.

## Implementation and acceptance mapping

Extended tests/integration/ai-runtime-acceptance{.test,-worker}.ts, reusing its
actual polling worker, encrypted credential adapter, raw bounded provider
transport, fenced executor, registered business MCP tools, and real REST/MCP
client contracts. DNS and HTTPS are mocked before consumers load; no external
provider request occurs. Synthetic keys and enabled flags exist only inside
the disposable fixture process. No production implementation, API/MCP operation,
schema, migration, money contract or rollout configuration needed modification.

1. Explicit worker/leases, dependent tools, grounded results and clarification:
   the raw-adapter poller commits an actual expense draft, persists a question,
   stops, and resumes through a new polling invocation after the authorized
   answer. Independent SQL verifies total_amount::text='1250', USD and draft
   status. Existing executor coverage also chains list_contacts, get_contact and
   create_expense_claim using real persisted record IDs and grounded final links.
   Worker/process fixtures cover competing claims, fair admission, bounded
   heartbeat/maintenance, graceful shutdown and fresh-process crash recovery.

2. Current authority and limits: the combined fixture retains the original
   config/deadline and entire attempt/charge rows across answering and retries.
   Original ordinals remain 1/2/3 and synthetic settled usage is 120 tokens and
   270000000 cost atoms per attempt. The existing delayed-response cases stop
   dispatch on cancellation, live policy revocation or kill; stricter live budget
   prevents resumed transmission. Provider-attempt/loop/usage/tool suites cover
   request/step/token/output/payload/time/cost limits, identity, config, policy,
   permissions, snapshots, prices, quotas and rate/concurrency admission.

3. Ordered idempotent operations, retries and partial results: a REST answer is
   committed as though its acknowledgement was lost, then three concurrent
   registered MCP retries return exactly the same ANSWER_ACCEPTED receipt. Only
   one input_answered event and one run-version advance occur, with unchanged
   attempts, charges and completed draft. Answering sends no provider request.
   Existing HTTP503/429 cases retain separately charged attempts and unknown
   reservations; recovery never replays uncertain/orphaned effects. Process,
   cancellation and writer-wait tests retain known partial completion.

4. Untrusted content and public exports: clarification text saying APPROVE ALL
   PAYMENTS enters the next request as untrusted data and creates no approval.
   Strict REST and registered MCP schemas reject an injected approval field;
   stale run versions conflict without changing durable state. Public events
   contain only sequence/kind/createdAt, with no answer/request/model payload.
   Whole raw response validation rejects private reasoning, malformed/duplicate/
   sensitive calls and invented finish states before dispatch. Live disclosure
   checks after asynchronous waits protect both provider context and client reads.

5. Shared UI/MCP contracts: the same persisted question is read through actual
   REST and registered MCP with identical output and private,no-store REST
   caching. Both answer transports share a stable receipt. After completion and
   runtime shutdown, both transports return the historical receipt without
   queueing; changed answer text conflicts. Observation/events reconnect through
   both transports without writes. Expanded SQL digests cover entire run, step,
   attempt, usage, event, expense, input, call association, message and approval
   tables. Existing progress/input suites exercise strict described schemas,
   cursor/version pagination, own/org access and lifecycle-tool catalog exclusion.

6. Durable pending input and safe continuation: the raw adapter's text question
   preserves effects, attempts, charges, config and the original deadline rather
   than resetting budgets. The separate real input suite covers live scoped
   candidate choices, foreign/deleted/missing references, permission changes,
   stale versions, expiry, cancellation, retention, unique pending questions and
   bounded question/payload limits. Choice questions remain a trusted internal
   primitive; the raw provider protocol emits only bounded text clarification.
   Clarification is explicitly clarification_only, distinct from AI-008 approval.

7. Structured outcomes for clients: REST/MCP views match persisted completed,
   input-required, queued, stopped/partial and reconciliation-required outcomes
   with real live scoped references. Disabled provider observation reports waiting
   for execution with unknown availability, no queue position, ETA or percentage.
   Provider/rate/quota tests preserve actual denial and unknown-charge semantics.
   No result claims rollback, payment, success or a link based on model narration.

8. Provisional versus confirmed delivery: the combined fixture observes a pending
   partial raw body without executing its complete-looking call. Existing polling,
   progress and observation suites cover lost/future cursors, runtime-off reconnect,
   bounded long histories, delayed disclosure revocation and cancellation during
   actual business INSERT effects. Provisional delivery is the bounded stream of
   server-status snapshots, distinct from confirmed receipts/live records. Raw
   model token/prose streaming remains unexposed and unqualified, as documented
   in AI_RUN_OBSERVATION.md; private reasoning and secrets have no public channel.

Updated AI_WORKER.md with the combined acknowledgement/reconnect contract and
the remaining AI-007 acceptance boundary. No unresolved implementation defect
was found within this task's integration boundary.

## Verification

All commands ran at D:/Projects/a/dubbl. Explicit TEST_DATABASE_URL selected the
existing synthetic PostgreSQL18 cluster at 127.0.0.1:55493. It was stopped at entry,
started for these checks, and each harness creates/migrates/drops a randomized
dubbl_ci_* database. No application database or supplied target is reset/migrated.
Installed Node v23.11.0/dependencies were used. After the final regression,
verified zero remaining dubbl_ci_* databases and stopped the fixture cluster.

| Check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-runtime-acceptance.test.ts | Passed on final fixture, 12.6 seconds; passed again in the combined run |
| node --import tsx --test --test-concurrency=1 with ai-runtime-acceptance, ai-polling-observation, ai-run-observation, ai-worker, ai-provider-loop, ai-executor, ai-provider-attempts, ai-tool-operations, ai-run-input, ai-run-progress, ai-run-lifecycle, ai-persistence, ai-usage, ai-providers, ai-tool-registry .test.ts files | 16/16 passed on final test source, 138.5 seconds |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed on final test source |
| npx eslint tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-runtime-acceptance-worker.ts | Passed, zero warnings/errors |
| npm run lint | Exit0, zero errors and 20 existing warnings outside task files |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 816 tools, 578 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 809 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys in each production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, unchanged 1447 baseline diagnostics; hash and scope comparison below |
| python .agentic/agent.py validate; git diff --check | Passed; controller completion and staged diff checked separately before commit |

No schema file changed, so no Drizzle migration generation was required.

The initial new test had two fixture-only mistakes: a content-leak regex matched
legitimate public timestamp dates, and a count query assumed ai_approval had a
run_id column. Corrected these to check public event field names/content markers
and the isolated approval table's count. The standalone final fixture then passed.
No production defect or approval/schema change was inferred from these errors.

The global money inventory remains failed, not waived: 1447 diagnostics, raw
stderr SHA256 4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186,
identical to the committed AI-031 baseline. None of this task's changed paths
intersects the inventory/checker/consumed-source/schema union of 1922 paths.
No unrelated baseline repair was attempted.

No full unit/exhaustive controller suite, build, dev server, application DB write,
live provider call, deployment, activation, Stripe work or push was performed.
PostgreSQL16/hosted CI, actual provider/account/model/pricing/tokenizer, deployed
supervisor/POSIX signals, raw token streaming, browser/native-Persian and production
qualification remain unperformed. Local fixtures do not establish those results.

## Handoff

Complete AI-023 with one scoped local commit. AI-007 remains open for its own
integration acceptance. Obtain the next task from the controller, then stop.
No push was requested.
