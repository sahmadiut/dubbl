# AI-039 attempt 1 - bounded polling worker and process lifecycle

2026-10-30, Codex in D:/Projects/a/dubbl, master, starting HEAD 6b3d45ca. Entry
tree clean. Controller validate/status/next selected AI-036. Source inspection
confirmed no worker entrypoint and a whole-response buffered provider adapter;
process scheduling and provisional observation are separate implementation
boundaries. Split through the controller into required AI-039 and AI-040, retaining
every original AI-036 criterion unchecked for independent integration acceptance.
Selected and completed only the process implementation child AI-039. Reviewer is
Codex (self-review); no independent peer/human review is claimed.

## Implementation and acceptance mapping

1. lib/ai/worker.ts implements the internal runWorker process runner. Default
   polling is one second, maintenance/renewal five seconds, local concurrency two
   with strict bounded options, and drain ten seconds. It uses real claim,
   maintain, heartbeat and execute services, not self-HTTP or mocked persistence.
   Default-off runtime/live-provider gates refuse startup; trusted deterministic
   transports are injected only by server-side tests, never through REST/MCP or
   model inputs. Current flags are rechecked during polling and renewal. Renewals
   are serial; lease/config/permission/cancellation loss aborts provider work.
   An aborted claim cannot start a new action. Signal shutdown stops admission,
   aborts pending provider work and allows already started business transactions
   to settle during a bounded drain. Renewal timers stop after the drain; the
   result reports unfinished count without replay/requeue authority. The CLI
   adds a fifteen-second forced process exit after stop, including DB waits.
   Unknown charges and unfinished operations retain durable recovery semantics.

   scripts/ai-worker.ts supplies an explicit pnpm ai:worker entrypoint. It loads
   no environment file, migrates/seeds nothing, enables no flags and opens no HTTP
   listener. Startup gates run before importing DB services; failure logging uses
   finite content-free codes. No new user-facing operation is added: the existing
   owner/org-scoped REST/MCP run/progress/input/events contracts remain in use.
   Startup, process limits and hosting/signal limitations are documented in
   docs/AI_WORKER.md. No live provider/model/host qualification is inferred.

   Two existing lifecycle gaps were repaired in lib/ai/run-lifecycle.ts:
   - Capacity filters now precede the bounded oldest-first 100-row admission
     scan. A full owner/tenant's backlog cannot hide another eligible tenant or
     owner. Existing global admission serialization, SKIP LOCKED and per-org/
     owner capacities remain enforced across competing workers.
   - Heartbeats lock conversation then run and revalidate live authority plus
     wall time after waits. A heartbeat waiting past lease expiry cannot revive
     that lease; extension is also capped by the original run deadline.

2. Added tests/integration/ai-worker.test.ts and ai-worker-fixture.ts. They use
   real REST submission, linked registered MCP input/answer/cancel/progress,
   real MCP-backed expense execution, deterministic raw providers and independent
   PostgreSQL queries. Coverage includes:
   - Production CLI default-off rejection before connecting even to an invalid
     database URL; library provider-off refusal leaves a submitted run queued
     with zero reservations.
   - 101 older queued rows behind a running owner, another eligible owner in
     that org, then an eligible foreign tenant behind the full org. Both get
     claimed without hiding behind the capacity-blocked backlog.
   - A heartbeat blocked on a real run lock until expiry is rejected. Competing
     polling loops send exactly one request/reservation while SQL observes the
     active lease increasing through real heartbeat scheduling.
   - A dependent draft, durable text question, MCP answer and same-run polling
     continuation retain the deadline/ordinals 1,2,3. SQL independently confirms
     total_amount::text='1250' and draft status. Real REST/MCP progress matches
     and links to the actual application record; forged provider narration does
     not establish completion or payment.
   - Live cancellation, configuration-version change and runtime kill switch
     abort a pending provider; no tool dispatch occurs and unknown usage remains
     charged. Run-token and request-rate exhaustion send nothing and reserve
     nothing. The existing provider/usage fixtures additionally reverify cost,
     quota, concurrency, immutable snapshot and original-limit failures.
   - A fixture-only PostgreSQL trigger pauses the actual expense INSERT. Public
     progress exposes no provisional record. Cancellation waits at the business
     boundary, then preserves one succeeded draft receipt with partial outcome.
     Shutdown instead returns unfinished=1 after its bounded drain, leaves the
     next request queued, and permits the original write's known receipt to settle
     once unlocked, with partial outcome and no second tool/provider action.
   - A separate polling child gracefully stops during an unresponsive provider
     request and closes with reconciliation/unknown charge. Another actual
     polling child is killed after a committed draft and second provider dispatch;
     a fresh polling process runs maintenance/recovery, preserving the draft,
     deadline, two ordinals and settled+unknown charges without action replay.

   Windows tests request graceful stop through IPC to invoke the same runner
   AbortController path; Windows SIGTERM force-terminates children. Actual POSIX
   signal delivery, deployed supervisor behavior and host restarts remain
   qualification work. SIGKILL crash/restart uses actual process termination.

3. Verification below supports this implementation child. No schema change was
   needed. Updated task index/source coverage for the required split, retaining
   every integration parent. Added the package script and refreshed only its
   existing money-inventory consumer hash and two shifted line numbers; no broad
   regeneration or baseline suppression. AI-040 owns provisional observation;
   AI-036/033/031/023/007 retain independent acceptance.

## Verification

Repository-root commands, existing dependencies, explicit TEST_DATABASE_URL to
the synthetic PostgreSQL18 fixture cluster at 127.0.0.1:55493. Harnesses create,
migrate and drop randomized dubbl_ci_* databases without resetting their target.
The previously stopped fixture cluster was started for tests and stopped after.
No application database, ignored environment file, Stripe behavior/file, live
provider, build, dev server, Docker, deployment or activation was changed/run.

| Check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-worker.test.ts | Passed on final source/tests; independent polling/process fixture, 13.7 seconds |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-run-lifecycle.test.ts tests/integration/ai-provider-loop.test.ts tests/integration/ai-executor.test.ts tests/integration/ai-provider-attempts.test.ts tests/integration/ai-tool-operations.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-run-progress.test.ts tests/integration/ai-persistence.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-providers.test.ts | 11/11 passed, 95.6 seconds |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed; scoped lint passed for final worker/lifecycle/CLI/test files |
| npx tsc --noEmit --project D:/temp/dubbl-ai039-cli-check.json | Passed using a temporary config extending the project with explicit worker CLI/next-env roots; scripts/ are excluded by the ordinary project check |
| node --import tsx scripts/ai-worker.ts with runtime/provider flags false and invalid DB URL | Final CLI default-off check passed, expected exit1 without connection or credential output |
| npm run lint | Exit0, zero errors, 20 existing warnings outside task files |
| npx drizzle-kit generate | No schema changes, nothing to migrate; drizzle/ unchanged |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 815 tools, 577 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 808 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Nine checks passed |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys per production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 baseline errors byte-identical to clean HEAD after the package-only consumer refresh |
| python .agentic/agent.py validate; git diff --check | Passed; completed state revalidated separately |

The money audit ran both in current source and a separate git archive HEAD source
snapshot linked to existing dependencies. Both final stderr streams have 1447
lines and SHA-256 4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186.
The initial three new diagnostics referred solely to package.json's inserted
script line/hash. Its one existing consumer row was refreshed; every historical
error remains visible. This global gate is red, not waived or reported green.

Initial integration development found a fixture cleanup missing the terminal
finishedAt constraint and an observation race (cancel could prevent transport
entry before its abort listener existed). The fixture now respects the terminal
constraint and waits for actual transport entry. Final cases passed. Full unit
and exhaustive controller suites were not run; prior unrelated catalog-count
failures are not repaired or claimed qualified here.

An additional compiler-API check included the excluded CLI file and found its
dynamic import did not make it a TypeScript module (top-level await/global stop
diagnostics). Added an explicit empty module export. The focused temporary
project check, final CLI lint and default-off subprocess check then passed.

## Handoff

Complete AI-039 only, with a local scoped commit and no push. AI-040 is next for
disclosure-safe provisional observation and REST/MCP contracts. Parent AI-036
retains independent worker/observation integration acceptance. Provider account/
model entitlement, real pricing/tokenizers, PostgreSQL16/hosted CI, actual host/
supervisor/POSIX signals, browser/native-Persian UX and rollout remain unqualified.
