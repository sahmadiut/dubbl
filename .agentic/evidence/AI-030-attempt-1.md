# AI-030 attempt 1 - durable scoped clarification

## Identity

2026-10-28, Codex self-operated in D:/Projects/a/dubbl, branch fresh-start,
starting commit ac17e731. Starting tree clean. This evidence describes local
implementation and synthetic qualification, not a deployed worker/provider or
independent human review. No Stripe files or functionality changed.

## Implementation and acceptance mapping

1. lib/db/schema/ai.ts adds ai_run_input with scoped run foreign key, monotonic
   input versions, one-pending-input partial unique index and bounded question,
   candidate/answer JSON. The trusted requestRunInput primitive requires the
   original fenced live lease, exact run version, known nonempty permissions,
   bounded questions and unique live scoped choices. It rejects unfinished steps
   and unsettled usage before suspending/releasing the lease. Up to 20 questions
   per run and cumulative 1 MiB payload bytes apply. Display revalidates history,
   saved domain permissions and current nondeleted records. Labels/status come
   from current records; links have fixed routes. Notifications contain no text.
   Erasure and retention clear questions/candidates/answers. Maintenance expires
   awaiting-input runs even after retention already cleared the pending row.
2. lib/ai/run-input.ts shares strict described schemas and direct DB services
   between GET /api/v1/ai/runs/{id}/input, POST input/answer, get_ai_run_input and
   answer_ai_run_input. Owner/organization come only from authenticated context.
   Unknown/nested approval/identity fields, mismatched question/answer kinds,
   stale input/run versions, missing/foreign/deleted/not-offered choices and
   inaccessible records fail. Read/error responses are private/no-store. Runtime
   can be off for observation. Clarification exposes clarification_only and
   cannot consume an approval, execute a tool or change financial history.
3. Conversation -> run -> input locks serialize competing answers and erasure.
   Exactly one answer, run queue/version transition, event and content-free audit
   write commit together. Same-key/version/content retries return a stable
   historical receipt without queueing again, including after later questions.
   Original and answering identities, configuration/credential/provider and both
   policy snapshots are checked live, including after lock waits. Runtime/kill,
   question expiry and deadline are checked immediately before acceptance. Changed
   snapshots require a new request. The run/steps/operation keys, original start/
   deadline and usage charges survive; payload bytes only increase. Cancellation
   and expiry prohibit continuation. Deadline is conservatively the original
   wall-clock deadline, never extended for waiting; AI_RUN_INPUT.md explains the
   boundary relative to the initial pause-aware design aspiration.
4. Generated 0021_clever_selene.sql, journal and snapshot are additive, and apply
   in the real migrated disposable fixtures. Subsequent generation finds no
   drift. Tests call actual route handlers and linked registered MCP tools,
   independent SQL and a fresh-process maintenance recovery path. Capability/
   coverage inventory is updated to 109 modules, 815 tools, 577 routes, 210 pages;
   exactly seven reviewed business tools remain unchanged. Clarification controls
   remain excluded from model dispatch. Six new inventory columns are explicitly
   classified non_money without refreshing unrelated baseline consumer records.

## Verification

Commands ran from the repository root. A new task-owned PostgreSQL18 cluster used
127.0.0.1:55490, synthetic trust fixtures and explicit TEST_DATABASE_URL. The
harness created/migrated/dropped randomized dubbl_ci_* databases. Application DB,
ignored env files and real credentials were not used or changed.
Zero disposable databases remained after the final fixtures, and the task-owned
cluster was stopped successfully.

| Command/check | Actual result | Limitation |
|---|---|---|
| npx drizzle-kit generate | Generated 0021; final invocation: no schema changes | Applied only in disposable databases |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-run-input.test.ts tests/integration/ai-run-progress.test.ts tests/integration/ai-run-lifecycle.test.ts tests/integration/ai-persistence.test.ts | 4/4 passed | No actual provider/worker/UI |
| Final ai-run-input.test.ts after retention-recovery and DB-constraint/ceiling assertions | 1/1 passed | Synthetic real DB fixtures |
| ai-tool-registry.test.ts and ai-usage.test.ts, serial | 2/2 passed | Deterministic dispatch and metering fixtures |
| npx tsc --noEmit | Passed, including final repeat after all code/test changes | No build |
| Focused ESLint including final test changes | Passed, no warnings/errors | Task files |
| npm run lint | Passed exit0, zero errors/20 existing warnings | Baseline warnings unchanged |
| Capability and tool coverage audits, without --write | Passed after regeneration | Source inventory, not full operation qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Nine checks passed | Legacy money lint regression gate |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 baseline errors | Precisely attributed below |
| python .agentic/agent.py validate; git diff --check | Passed before submission; completion revalidated | Structural controller check |

The final clarification fixture verifies strict schemas, REST/MCP JSON parity,
same-org other owners/foreign org isolation, live label/deletion/permission changes,
original session expiry, configuration and agent-policy changes, pending-approval
state refusal, wrong question types, forged references, idempotent REST/MCP races,
different-answer conflicts, stop/answer racing, read-only history, preserved
completed steps and exact usage rows, original deadlines, versioned second
questions, fresh lease after continuation, DB scoped/unique constraints, maximum
20 questions, cancellation, expiry/fresh-process recovery, content retention and
erasure, and revoked membership through retained MCP closures. No approval row is
created or consumed, and AI_PROVIDER_CALLS_ENABLED remains false.

Baseline inventory attribution used the actual verifier with the HEAD inventory
and only the new ai_run_input table excluded, compared against the final verifier
with six new non-money classifications. Both exit1 outputs match line-for-line:
1447 errors. All 11 drifted consumer files match HEAD byte-for-byte after LF
normalization. Old AI schema omissions and unrelated consumer line/hash drift
were preserved. The temporary baseline-check script was removed. This is not a
passing global money-inventory claim.

Failed development attempts were repaired before final verification: partial
uniqueness initially used unique instead of uniqueIndex and failed generation/
typecheck; the final migration and typecheck pass. The first lock-contention
fixture cached PostgreSQL activity snapshots and was stopped; explicit snapshot
refresh fixed it. A subsequent expected-error assertion was broadened to include
the correct fail-closed No authorized AI tools outcome. A diagnostic git subprocess
needed a larger capture buffer for the large baseline inventory; the final exact
comparison passed. A temporary JSON rewrite expanded/reordered the registry; it
was replaced with an 84-line-only additive classification diff before acceptance.

No build, dev server, Docker, live provider, deployed worker, hosted CI or production
activation was run. Existing unrelated development processes were left alone.
Native Persian/UI, actual provider and worker hosting qualification remain open.

## Review and handoff

Codex self-review is recorded in AI-030-review-1.md. AI_RUN_INPUT.md defines the
public/internal contracts and retention/retry semantics. AI-031 must integrate
trusted question generation and accepted untrusted answers into its bounded
metered worker, with current validation/approvals on every real action. AI-023
and AI-007 remain independent integration parents. No rollout flag was enabled.
