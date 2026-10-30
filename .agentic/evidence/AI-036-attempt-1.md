# AI-036 attempt 1 - combined polling recovery and observation acceptance

2026-10-30, Codex in D:/Projects/a/dubbl, master, starting HEAD 96b4da18.
Entry tree clean. Controller validate/status/next selected AI-036 after its
AI-039/040 implementation children. Started and accepted only AI-036. This is
independent combined integration evidence, reviewed by Codex as self-review;
it does not claim independent peer or human review. AI-033/031/023/007 retain
their original acceptance criteria.

## Acceptance mapping

1. Inspected the actual worker/CLI, lifecycle and observation services against
   AI-036 and its completed children. Startup, default-off gates, bounded fair
   claims/polling/maintenance/renewal, shutdown and host limitations remain
   documented in docs/AI_WORKER.md. Added a separate combined fixture in
   tests/integration/ai-polling-observation{.test,-worker}.ts using the actual
   polling runner in child processes, deterministic server-owned raw provider
   responses, actual REST handlers, registered linked MCP calls and SQL assertions.

   A first process creates an actual MCP-backed expense draft and asks a durable
   clarification, then exits. REST/MCP observe INPUT_REQUIRED, no provisional
   content and the confirmed exact amountMinor='1250' receipt. Hashing the entire
   run/step/provider-attempt/usage/event/expense tables before/after observation
   proves it does not resume execution. An authorized MCP answer queues the same
   run; a fresh process receives the draft receipt and answer in its request,
   exposes WAITING_FOR_RESPONSE alongside the same confirmed record, then finishes.
   The original deadline/configuration survive, provider ordinals remain 1/2/3,
   and SQL/public receipts show one draft rather than replaying the first turn.

   Another process is killed after a draft commits and the next provider request
   dispatches. The fixture advances only that synthetic lease to expiry for
   deterministic recovery. REST/MCP observe OBSERVATION_DELAYED without any
   renewal/maintenance/mutation. A fresh polling process runs recovery, sends zero
   provider calls and leaves reconciliation_required. Step operation/record IDs,
   attempt IDs/ordinals/snapshots, configuration/deadline and usage price/budget
   snapshots/reserved and charged amounts remain unchanged. Settled plus unknown
   charges survive; independent SQL verifies total_amount::text='1250', draft
   status and exactly two total drafts from these two separate user runs.

   A further fresh process gracefully stops during a dependent pending provider
   request after a confirmed draft. IPC invokes the same AbortController shutdown
   path used by the CLI signal handler; bounded drain completes and observation
   truthfully shows reconciliation with the known draft. Actual SIGKILL separately
   tests process loss. POSIX signal/supervisor behavior remains unqualified.

2. The combined fixture uses REST and MCP observation throughout. Provisional
   server milestones remain separate from persisted receipts/live domain rows;
   hostile model prose, secret-looking strings, fake payment claims and URLs
   never enter either public result. Complete-response validation remains before
   dispatch; raw token streaming/freeform assistant prose is not exposed.

   Runtime-off reconnect with lost/current/future cursors hashes durable tables
   unchanged. Same-cursor permission revocation removes the record even without
   an execution-version change, and deleted notifications reset the cursor.
   No observer claims, retries, resumes, settles or replays work.

   Independent fault review found a disclosure race not covered by the children:
   a domain-table writer can delay record resolution AFTER the reader's last
   permission check. With expense_claim locked ACCESS EXCLUSIVE, an observer
   blocked reading the record, and a role revocation committed before releasing
   the lock, the original service returned HTTP200 containing the revoked draft.
   The new regression reproduced that failure (200 instead of 409).

   Fixed lib/ai/run-progress.ts to reauthorize and compare grants after domain
   resolution, before releasing progress/observation. The deterministic race now
   passes independently through REST (409) and registered MCP (error), with no
   record details in either error; the next observation uses current restricted
   grants. This shared-service fix retains both transport contracts and also
   protects existing progress reads. No new API/MCP operation or schema needed.

3. Reran the existing real provider/executor/tool/usage/input/lifecycle/persistence/
   progress/observation/worker integrations. They cover competing workers, fair
   admission behind busy tenants, heartbeat writer waits, actual expense INSERT
   cancellation and bounded shutdown drain, unavailable/config/kill/rate/token/
   cost/quota conditions, malformed raw calls, original limits and unknown usage.
   New tests add combined cross-process observation; they do not replace child
   or remaining parent obligations. Updated current runbook/observation docs.

## Verification

Explicit TEST_DATABASE_URL used only the existing synthetic PostgreSQL18 cluster
at 127.0.0.1:55493, with each harness creating/migrating/dropping randomized
dubbl_ci_* databases; the supplied target was not migrated or reset. Confirmed
the stopped fixture cluster with pg_ctl status, started it for these checks and
stopped it afterward. No application DB or ignored environment file was used.
Installed Node v23.11.0/dependencies were used. No live request, activation,
deployment, build, dev server, Stripe change or push was performed.

| Check | Result |
|---|---|
| node --import tsx --test tests/integration/ai-polling-observation.test.ts | Initial combined process/observation case passed; added late domain-wait regression reproduced HTTP200 disclosure before the fix |
| node --import tsx --test --test-concurrency=1 with ai-polling-observation, ai-run-observation, ai-worker, ai-provider-loop, ai-executor, ai-provider-attempts, ai-tool-operations, ai-run-input, ai-run-progress, ai-run-lifecycle, ai-persistence, ai-usage, ai-providers .test.ts files | 14/14 passed, 127.7 seconds; began before the final domain-wait fix |
| Final-source same runner with ai-polling-observation, ai-run-observation, ai-run-progress, ai-worker, ai-provider-loop, ai-executor .test.ts files | 6/6 passed, 74.1 seconds, including both new REST/MCP revocation races and original snapshot/charge preservation assertions |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed on final code |
| npx eslint lib/ai/run-progress.ts tests/integration/ai-polling-observation.test.ts tests/integration/ai-polling-observation-worker.ts | Passed on final code, zero warnings/errors |
| npm run lint | Passed, zero errors and 20 existing warnings outside task files; final code delta additionally passed scoped lint |
| npx drizzle-kit generate | No schema changes, nothing to migrate; drizzle/ unchanged |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 816 tools, 578 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 809 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys per production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 baseline diagnostics; raw stderr SHA256 4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186 |
| python .agentic/agent.py validate; git diff --check | Passed; completed state and staged diff rechecked separately |

All 1913 money-inventory/checker/consumed-source/schema paths were compared to
starting HEAD after newline normalization: none changed. The audit hash is
identical to the preceding committed baseline. The global money gate remains
failed; it is not waived or counted as green.

The first process test kept its IPC channel open after draining; corrected
fixture cleanup to disconnect after closing its pool, then reran successfully.
The later intentional late-grant regression failed before the production fix
and passed after it. No unresolved implementation defect was found in review.

No full unit/exhaustive controller suite, PostgreSQL16/hosted CI, provider/account/
model entitlement, real pricing/tokenizer, raw token streaming, POSIX signal/
deployed supervisor, browser/native-Persian or production qualification is claimed.
The existing default-off runtime/provider gates remain unchanged.

## Handoff

Complete AI-036 only with a local scoped commit. AI-033 becomes the next
controller integration task; AI-031/023/007 also remain open. No push requested.
