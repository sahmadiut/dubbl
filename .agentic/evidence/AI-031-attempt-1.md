# AI-031 attempt 1 - metered worker integration acceptance

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD d22f6528.
Entry tree clean. Controller validate/status/next selected AI-031 after AI-032
and AI-033 completed. Started only AI-031. This is independent integration of
the children with Codex self-review, not peer/human approval. AI-023 and AI-007
retain all original acceptance criteria.

## Implementation and acceptance mapping

Extended tests/integration/ai-runtime-acceptance{.test,-worker}.ts rather than
duplicating its isolated database/provider setup. The fixture invokes runWorker
without a transport override, composing the actual encrypted-credential adapter,
raw bounded transport, protocol, fenced attempts/usage, registered MCP draft tools
and REST/MCP run observation/input/cancellation. DNS and HTTPS are mocked before
consumers load. No request reaches an external provider; synthetic encryption keys
and enabling flags exist only inside that child process.

1. Explicit polling, leases, dependent tools, links, clarification and truthful
   queue conditions: reran actual worker/process fixtures for competing pollers,
   fair admission beyond a 101-row busy-owner backlog, heartbeat/lock waits,
   separate-process clarification/continuation, crash/restart and graceful drain.
   The raw fixture verifies real exact-money drafts and grounded links through
   matching REST/MCP reads and independent SQL text assertions. New disabled-
   provider observation returns QUEUED / WAITING_FOR_EXECUTION, no availability,
   queue position, ETA or percentage; a hash of durable tables stays unchanged.

2. Live authority and cumulative ceilings: new combined scenarios withhold the
   final byte of a second valid draft-call response after a first draft commits.
   While matching REST/MCP observation shows WAITING_FOR_RESPONSE and the known
   draft, cancellation through registered MCP, disabled tool policy and runtime
   kill each cause a raw-adapter abort. Only two requests are sent. A late complete
   body acquires no second call association/operation. Cancellation closes
   cancelled; policy/kill close reconciliation_required. The SQL-confirmed first
   draft remains status=draft, currency=USD, total_amount::text='1250'.

   A fresh polling invocation after an MCP clarification answer meets a newly
   lowered zero-token run budget. It transmits no request and closes failed with
   PARTIAL_COMPLETION. Entire original attempt rows and charge rows, configuration
   and original deadline are unchanged; the earlier draft survives. Existing
   attempt/usage/loop tests independently exercise original request/step/token/
   output/payload/time/cost ceilings, stricter/original policy envelopes, prices,
   identity/config/permission/rate/quota/concurrency and charged transient retries.

3. Durable operations/events and no replay: each delayed stop retains precisely
   the first draft's operation association, one settled charge and one unknown
   charge. Unknown tokens stay positive and charged cost equals the reservation.
   Cursor reconnect remains read-only and returns actual partial/reconciliation
   status plus the first draft. Existing real database races and separate-process
   kill/restart fixtures retain keys, ordered attempts/events, original snapshots,
   limits and partial effects; unknown or orphaned writes are never replayed.
   Only typed bounded provider failures retry with fresh charged identities.
   No automatic business retry or provider/model switch is introduced.

4. Untrusted input and safe observation: reran whole-body rejection, malformed/
   sensitive/duplicate calls, partial bodies, DNS-time domain revocation, delayed
   domain-read disclosure, cancelled business INSERTs, reconnect/cursor loss,
   bounded histories and content expiry. Private request/narration/reasoning,
   credentials, arguments and model URLs do not appear in public observations or
   final assistant messages. Provisional delivery is bounded server-status
   snapshot polling, separate from confirmed persisted receipts/live record links.
   Raw model tokens/prose streaming is not exposed or qualified. Clarification
   text is untrusted and cannot approve sensitive actions; AI-008 remains separate.

5. Updated AI_WORKER documentation with these combined checks, startup reference
   and unchanged qualification limits. No production code, public REST/MCP schema,
   money unit, database schema or migration needed modification. No unresolved
   defect was identified within this integration acceptance boundary.

## Verification

Explicit TEST_DATABASE_URL used the existing synthetic PostgreSQL18.6 cluster
at 127.0.0.1:55493. Confirmed it stopped, started it, ran checks, verified zero
remaining dubbl_ci_* databases, then stopped it. Each integration harness creates,
migrates and drops a randomized disposable database; no application database or
the supplied connection target is reset/migrated. Node v23.11.0 was used.

| Check | Result |
|---|---|
| node --import tsx --test tests/integration/ai-runtime-acceptance.test.ts | Passed standalone, then passed within combined regression run |
| node --import tsx --test --test-concurrency=1 with ai-runtime-acceptance, ai-polling-observation, ai-run-observation, ai-worker, ai-provider-loop, ai-executor, ai-provider-attempts, ai-tool-operations, ai-run-input, ai-run-progress, ai-run-lifecycle, ai-persistence, ai-usage, ai-providers, ai-tool-registry .test.ts files | 16/16 passed, 149.6 seconds |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed after explicit numeric counter annotation in the new fixture |
| npx eslint tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-runtime-acceptance-worker.ts | Passed on final tests, zero warnings/errors |
| npm run lint | Exit0; zero errors, 20 existing warnings outside task files |
| npx drizzle-kit generate | No schema changes, nothing to migrate; drizzle/ unchanged |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 816 tools, 578 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 809 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys per production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, unchanged 1447 baseline diagnostics; raw stderr SHA256 4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186 |
| python .agentic/agent.py validate; git diff --check | Passed; completion and staged checks repeated before commit |

Raw money diagnostics match the preceding committed baseline's hash exactly.
The changed-path set intersects none of the inventory/checker/consumed-source/
schema set's 1913 paths. This global gate remains failed, not waived or described
as passed. No unrelated baseline repair was attempted.

No full unit/exhaustive controller suite, build, dev server, live provider,
deployment, activation, application database change, Stripe work or push occurred.
PostgreSQL16/hosted CI, actual provider/account/model/pricing/tokenizer, deployed
host/supervisor/POSIX signals, raw token streaming, browser/native-Persian and
production rollout remain unqualified. Synthetic checks do not imply them.

## Handoff

Complete AI-031 with one scoped local commit. AI-023/007 remain open for independent
integration; obtain the next task from the controller after completion. No push
requested. Stop after this task.
