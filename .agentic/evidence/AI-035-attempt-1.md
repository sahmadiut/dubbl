# AI-035 attempt 1 - independent metered provider-loop acceptance

2026-10-30, Codex in D:/Projects/a/dubbl, branch master, starting HEAD b9c06030.
Entry tree clean. Controller validate/status/next selected the ready integration
parent AI-035 after AI-037 and AI-038. This accepts only AI-035; it does not close
AI-033/031/023/007 or start AI-036. Operator and reviewer are Codex (self-review),
with no independent peer or human qualification.

## Changes and observed defect

Added tests/integration/ai-provider-loop.test.ts and its independent worker.
It uses real REST submission/input/answer/progress handlers, linked registered
MCP tools for answer/cancel/progress, actual MCP-backed expense draft execution,
deterministic injected raw provider responses, and separate SQL queries. No
HTTP self-call, model-controlled identity, public dispatch or settlement API was
added. Existing MCP/REST behavior and the seven-tool automatic catalog remain
unchanged. Sensitive operations still require the separate AI-008 approval
boundary and are rejected by this executor; clarification cannot authorize them.

The new fixture initially failed: a run with a validated final provider receipt
waited on an actual ai_event table lock, its conversation content expired, and
the executor committed succeeded plus an assistant message. lib/ai/executor.ts
now checks content expiry after event persistence and live authorization waits.
Throwing there rolls back the success/message; the existing safe-close path
reloads current state and commits expired without adding expired content.
Confirmed business receipts and settled usage remain intact. The same fixture
then passed. The executor contract documents this completion guard. The initial
new test typecheck also exposed pg.connect overload inference; an explicit
PoolClient type fixed the fixture before final passing typecheck/lint.

## Acceptance mapping

1. Durable provider-attempt/usage snapshots, dispatch leases, original pricing,
   config/policy/permission/output/budget envelopes and stable call/operation
   digests are implemented by provider-attempts.ts, usage.ts and tool-operations.ts.
   Existing integration cases were rerun on current source. The new combined case
   commits one USD draft, asks for clarification, answers through REST with an
   idempotent MCP replay, and resumes under a new lease. Three attempts retain
   ordinals 1/2/3, distinct keys, the first price despite a later price, output
   limit 128, original deadline and cumulative payload. Independent SQL verifies
   total_amount::text='1250', currency USD and draft status. Each known usage
   charge is exactly 120 tokens/270000000 billing atoms at the synthetic original
   price. Raising a 1150-token run budget after two settled attempts cannot admit
   a third reservation: zero transmissions/charges are added, the first draft
   survives, and public outcome is PARTIAL_COMPLETION. Prior fixtures additionally
   exercise token/cost/rate/concurrency/payload/request/step ceilings and unknown
   or partial usage. Unknown work retains its conservative charge.

2. executor.ts consumes only fresh validated protocol calls through AI-032's
   actual registered tools; persisted display arguments are never replayed.
   Existing current-source fixtures verify dependent list/get/draft actions,
   whole-response rejection, live permission/config/policy/kill checks, redaction,
   disclosure changes during DNS, unavailable record links, clarification and
   sensitive-call rejection. The new fixture combines confirmed draft/input/
   resume, verifies old leases cannot execute, compares real REST/MCP progress
   exactly, and verifies the grounded application link. Provider narration,
   fabricated paid/posted claims and URLs never enter final messages. The new
   real lock-wait regression verifies expiry prevents a success message.

3. Retry decisions use typed finite transient errors and persisted counters;
   separately charged attempt keys, eight requests and two transient failures
   bound the whole run, including restart. Arbitrary errors, malformed/partial
   output and business-tool errors are not automatically replayed. Existing
   executor/attempt fixtures reverify these paths and no provider/model fallback.
   In the new combined cancellation case, a second turn is held after a confirmed
   draft. A competing executor returns busy without sending; MCP cancellation
   leaves settled+unknown charges. Its late valid call settles known usage but
   cannot add another provider-call association or execute a second draft.
   SQL confirms the first draft and public PARTIAL_COMPLETION survive. Existing
   fixtures also verify revocation, uncertain writes and late stale callbacks.

4. Reran the real REST/MCP/disposable PostgreSQL integration group on current
   source. Separate-process kill/restart tests execute a draft, kill the actual
   executor after another provider dispatch, recover in another process, and
   preserve the original deadline/attempts/settled and unknown charges without
   duplicate effects. Provider-attempt and tool-operation fixtures cover actual
   lock waits, stale/competing executors, configuration/permission/kill changes,
   budget/quota/rate denials and committed-write uncertainty. Migration acceptance
   covers clean application, upgrade from 0022 and repeat application. Drizzle
   reports no schema drift; no schema/migration edit was needed for this parent.

## Verification

All commands ran from the repository root using existing dependencies. Explicit
TEST_DATABASE_URL targeted the synthetic task fixture cluster at 127.0.0.1:55493
(PostgreSQL18). The harness creates/migrates/drops randomized dubbl_ci_* databases
and never resets its connection target. This previously stopped fixture cluster
was started for these checks and stopped afterward. No application database or
ignored environment file was read/changed. No live provider, build, dev server,
Docker, deployment, Stripe file/behavior or runtime rollout flag was changed/run.

| Command | Result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-provider-loop.test.ts tests/integration/ai-executor.test.ts tests/integration/ai-provider-attempts.test.ts tests/integration/ai-tool-operations.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-run-progress.test.ts tests/integration/ai-run-lifecycle.test.ts tests/integration/ai-persistence.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-providers.test.ts | 11/11 passed, 90.4 seconds |
| node --import tsx --test tests/integration/ai-provider-loop.test.ts | Final parent fixture rerun passed after adding the explicit late-call association count; its scoped lint also passed |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed on final source/tests |
| npx eslint lib/ai/executor.ts tests/integration/ai-provider-loop.test.ts tests/integration/ai-provider-loop-worker.ts | Passed, zero warnings/errors |
| npm run lint | Exit0, zero errors, 20 existing warnings outside task files |
| npx drizzle-kit generate | No schema changes, nothing to migrate; drizzle/ unchanged |
| node scripts/audit-ai-capabilities.mjs | Passed: 109 modules, 815 tools, 577 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 808 unlisted denied |
| node --import tsx scripts/validate-messages.ts | Passed: 10776 keys in each production locale |
| node .agentic/scripts/verify_legacy_money.mjs | Nine checks passed |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 unchanged baseline errors; comparison below |
| python .agentic/agent.py validate; git diff --check | Passed; final completion state revalidated separately |

The money verifier ran both in the current tree and a separate clean HEAD source
archive linked to the existing dependencies. Both stderr streams have exactly
1447 lines and identical SHA-256
4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186.
Windows tar could not create the archive's CLAUDE.md symlink alias; every verifier
input was extracted and both verifiers ran normally. No inventory refresh,
suppression or task-specific money drift was introduced. This is baseline
nonregression evidence; the global money gate remains red.

No full unit or exhaustive controller suite was run. AI-038's immutable evidence
records two pre-existing full-suite catalog count failures; this task does not
claim to repair or qualify that suite. The focused current-source integration
and protocol groups above passed.

## Handoff and limits

Complete AI-035 only. AI-036 must supply actual polling, heartbeat, fairness,
shutdown/recovery and provisional observation; higher parents independently
accept their own criteria. Live provider/model/account entitlement, real prices,
tokenizers, PostgreSQL16/hosted CI, hosting, browser/native-Persian UX and production
rollout remain unqualified. Text-only clarification and automatic reviewed tools
remain the executor's documented boundaries. No activation or push was requested.
