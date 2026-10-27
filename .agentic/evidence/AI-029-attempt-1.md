# AI-029 attempt 1 - permission-safe persisted progress

## Identity

2026-10-28, Codex self-operated in D:/Projects/a/dubbl, branch fresh-start,
baseline 65a524e3. Existing product-experience planning was preserved. Changes
are scoped against that commit; no peer/human review or provider approval is claimed.

AI-023's expanded acceptance combined observation, durable clarification and the
metered worker. The controller split it into required AI-029, AI-030 and AI-031
after source inspection, retaining every parent criterion. AI-029 supplies the
first service boundary only. AI-023 and AI-007 remain independent open parents.

## Implementation

- lib/ai/run-progress.ts and the new /api/v1/ai/runs/{id}/progress GET share
  strict described schemas with get_ai_run_progress in the existing MCP module.
  Scope is current owner/organization and live view:ai-history. Read access
  remains available with runtime/provider flags disabled.
- Progress contains finite state/outcome/recovery codes, persisted step states,
  truthful stop acknowledgement and currently accessible record references.
  Current nondeleted contact/journal/expense records are independently reloaded
  within the organization. Links use fixed application paths. Expense money
  selects SQL text, retaining exact amountMinor/currency values above 2^53.
- Unknown tool types, empty/missing domain permissions and revoked rights fail
  closed. No raw prompt/tool input/output, user-authored text, arbitrary URL,
  lease/operation key, provider configuration, secret or private reasoning is
  projected. Pending/executing output is not reported as confirmed. An uncertain
  reference supports inspection without a success or rollback claim.
- Pages contain at most 20 steps, ten references per step, ordered by full database
  createdAt and UUID. Continuations bind to run version and a same-run cursor.
  Conversation -> run share locks follow erasure's lock order; identity is refreshed
  after lock waits. REST progress and event responses are private/no-store,
  including errors. The observation path performs no execution/maintenance writes.
- Step preparation/transitions atomically increment run version and insert
  content-free change notifications. Event reads use 100+1 lookahead, reset ahead
  cursors explicitly, and normalize unrecognized stored kinds to changed.
- AI capability/coverage registries refreshed: 109 modules, 813 tools, 575 API
  route files, 210 pages. Exactly seven business tools remain reviewed; this new
  lifecycle read stays excluded from model dispatch. No policy or flag changed.
- AI_RUN_PROGRESS.md records the public contract, cursor recovery, polling hints,
  finite codes, required trusted worker provenance and remaining service boundaries.

## Acceptance mapping

1. Real route handlers and linked MCP progress calls return identical JSON.
   Schema/query negatives cover foreign identity parameters, unknown/duplicate
   fields, noncanonical integers, invalid IDs, cursor/version mismatch and limits.
   Same-org other owners and foreign organizations receive 404. Deleted/expired
   conversation and removed membership/history permission fail. Read snapshots
   prove no run/step/event/usage/audit mutations during concurrent observation.
2. Real existing scoped references survive projection; foreign/deleted/missing IDs
   and unsupported tools are omitted. Record status changes are loaded live.
   Independent SQL asserts 9007199254740993 stored minor units; REST/MCP return
   the exact string with IRR. Arbitrary saved input/output/reasoning/URLs are absent.
   Worker availability is explicitly unknown and no queue position/ETA/percentage
   is invented. Known partial/uncertain effects have distinct codes.
3. Notifications are transactional and ordered. Two competing same-version step
   updates yield one successful transition and one run-version increment.
   Reconnect from current, zero or ahead cursor never dispatches. Exactly 100 vs
   101 events has correct paging. Stop during an effect remains requested until
   maintenance classifies it uncertain, preserving an earlier succeeded draft and
   uncertain record-inspection link. Safe queued cancellation is acknowledged.
4. Disposable DB tests verify lock contention: a real writer holds the run while
   a progress read waits, revokes permissions, and commits; the delayed response
   and retained MCP closure expose no record/action content. A maximum 20-step
   history with equal microsecond timestamps pages exactly once per UUID. New
   progress suite and existing lifecycle/persistence regressions pass. Static
   results and the unrelated failing money inventory are distinguished below.

## Verification

Commands ran from the repository root. PostgreSQL18 used a new task-owned
temporary cluster on 127.0.0.1:55489 with synthetic trust fixtures. TEST_DATABASE_URL
pointed at this server; the harness migrated/dropped randomized dubbl_ci_* DBs.
Application DATABASE_URL, ignored environment files and credentials were not used
or changed. Zero disposable databases remained; the cluster was stopped.

| Command/check | Actual result | Limitation |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-run-progress.test.ts tests/integration/ai-run-lifecycle.test.ts tests/integration/ai-persistence.test.ts | 3/3 passed | No actual provider/worker/UI |
| Final progress test after adding same-version race and event REST header/reset assertions | 1/1 passed | Deterministic real DB fixtures |
| npx tsc --noEmit | Passed; final repeat recorded in review | No full build |
| Focused ESLint, including final test edits | Passed, zero warnings/errors | Source/test scope |
| npm run lint | Exit0, zero errors/20 existing warnings outside task files | Baseline warnings retained |
| node scripts/audit-ai-capabilities.mjs; node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed after regeneration | Source inventory, not feature qualification |
| node .agentic/scripts/verify_legacy_money.mjs | 9 regression checks passed | Existing legacy import gate |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1: 1447 baseline errors | See baseline attribution below; not reported green |
| python .agentic/agent.py validate; git diff --check | Passed before submission; final completion revalidated | Structural validation only |

The money inventory verifier reports missing AI schema entries and stale
consumer hashes/line patterns. A Python diagnostic reran the actual verifier,
compared all 11 drifted consumers byte-for-byte (normalized LF) to git show HEAD,
and asserted schema, MONEY_BOUNDARIES.json and the verifier itself equal HEAD.
Every comparison passed. Thus the same failure exists in the starting commit;
this task did not alter those files. No unrelated inventory rebaseline was made.
Running scripts/eslint-legacy-money.mjs directly is only a module import; the
actual nine-check verify_legacy_money.mjs gate above was executed separately.

Initial fixture failures were repaired before acceptance: the legacy ORM writer
correctly rejected a >2^53 amount, so only the isolated test fixture uses SQL to
seed it; SDK schema-error responses are not JSON envelopes, so the negative-test
helper now checks isError without parsing those texts. Initial focused ESLint's
prefer-const finding was resolved by the final cancellation assertions, and final
focused/full lint passed. These failed attempts are not counted as passing runs.

No schema changed, so no migration generation/application change is required.
No full build, dev server, live provider, deployed worker, hosted CI, production
activation or native Persian/UI qualification was run. Stripe files are unchanged.

## Review and handoff

Codex self-review is recorded separately in AI-029-review-1.md. AI-030 is the next
required slice: persist questions/candidates and accept versioned idempotent answers
without approval authority or reset budgets. AI-031 then implements actual metered
dispatch, trusted record provenance, streaming and fault recovery. Existing storage
helpers/presentation payloads are not execution authorization. Parents remain open.
