# AI-032 attempt 1 - durable fenced tool execution

## Identity and scope

2026-10-28, Codex self-operated in D:/Projects/a/dubbl on fresh-start, starting
commit 7e42aa89. Entry tree was clean; the branch already contained six local
commits above origin/fresh-start. No peer/human review is claimed. No Stripe file,
application environment or rollout setting was changed.

Source inspection selected AI-031, then separated two actual implementation
boundaries: legacy step storage lacked worker authorization, and no bounded
provider loop/process existed. The controller split AI-031 into required AI-032
and AI-033. The original parent criteria remain unchanged and unchecked; AI-031,
AI-023 and AI-007 each retain independent integration acceptance. This attempt
completes AI-032 only, not an executable provider worker.

## Implementation and acceptance mapping

1. lib/ai/tool-operations.ts supplies internal prepare/execute operations using
   persisted server identity and the original fenced run lease. A stable UUID key
   binds canonical original validated arguments, tool name and catalog version.
   Hashing occurs before display redaction, so differently supplied secrets cannot
   reuse a redacted input's digest. Schema defaults and object ordering normalize
   correctly. Conversation -> run -> step locks serialize competing callers.
   Step/run version changes, events and the single dispatch audit commit together.
   The legacy transitionStep helper refuses worker-bound operations. Generated
   0022 adds nullable argument_digest/dispatch_lease with binding constraints;
   existing stored steps remain compatible but cannot be adopted for execution.

2. Preparation and last-moment dispatch validate runtime/kill switch, current
   identity, original credential/provider/configuration and both policy versions,
   reviewed schema, current allowlist/domain permission, cancellation, original
   deadline and lease expiry/ownership. The final callback runs after linked MCP
   setup, validates again after event/audit lock waits, and commits before the
   actual tool call. No transaction spans the domain call. There are at most 20
   steps, one executing operation, and 1 MiB cumulative payload; 40,000 bytes of
   result headroom are checked at preparation and dispatch. Unknown/unfinished
   effects cannot be bypassed with new operation keys. Provider token/cost/request
   admission remains AI-033's separate responsibility, using existing usage APIs.

3. Only actual registered MCP responses establish outcome/record provenance.
   Known envelope fields provide UUIDs; raw arguments, arbitrary IDs/narrative URLs
   do not. Results are bounded, redacted JSON; public progress reloads records and
   permissions and uses fixed application links. A competing or denied caller
   cannot settle another caller's effect. A trusted known completion can persist
   during stop/revocation while the original run still owns the lease; an expired
   or superseded callback cannot overwrite recovery or resurrect erased content.
   Ambiguous writes remain uncertain/reconciliation_required and never auto-replay.
   No provider text/private reasoning, user approval or live request is introduced.

4. tests/integration/ai-tool-operations.test.ts and its worker use actual linked
   registered business tools, real progress REST/MCP handlers and independent SQL.
   Tests verify competing same-key draft creation once, canonical/default replay,
   conflicting secrets, stale leases, legacy-mutation refusal, forged scope/schema
   inputs, foreign contact failure, source-derived links, content-free events and
   audit cardinality. Config/provider/agent-policy changes, expired identity, kill
   switch, live permission change behind a run lock, step/payload bounds and
   provisional executing output are exercised. A DB audit gate flips the kill
   switch after setup and proves execution authority and audit roll back before
   dispatch. A real expense insert gate verifies cancellation/revocation during
   the business transaction preserves the known draft and restricts disclosure.
   A separately spawned executor is killed after its expense commits but before
   the receipt can persist; fresh-process maintenance preserves an earlier success,
   marks the lost receipt uncertain, preserves exact usage charges/original deadline
   and refuses replay. Prepared safe work resumes under a fresh lease/same step.

## Verification

Commands ran from the repository root. A new task-owned PostgreSQL18 cluster on
127.0.0.1:55491 used synthetic trust fixtures and explicit TEST_DATABASE_URL. The
shared harness created/migrated/dropped randomized dubbl_ci_* databases; the
application database and ignored local environment files were not used or changed.

| Command/check | Actual result | Limitation |
|---|---|---|
| npx drizzle-kit generate | Generated 0022; subsequent invocation reports no schema changes | Migration applied only to disposable fixtures |
| Serial ai-tool-operations, ai-run-lifecycle, ai-run-progress, ai-run-input, ai-tool-registry, ai-usage and ai-persistence integration files | 7/7 passed after fixing the progress fixture snapshot | Preceded final transactional audit refinement |
| Final serial ai-tool-operations.test.ts, ai-tool-registry.test.ts and ai-run-progress.test.ts | 3/3 passed with final audit/guard code | Actual tools/database, no provider |
| Final isolated ai-tool-operations.test.ts after audit refinement | 1/1 passed, followed by final 3-file regression above | Synthetic fault injection |
| npx tsc --noEmit | Passed, including final source/test changes | No build |
| Focused ESLint on all changed TypeScript source/tests | Passed, zero warnings/errors, including final source/test changes | Scoped files |
| npm run lint | Exit0, zero errors/20 existing warnings outside task files | Before final audit refinement; final scoped lint covers that refinement |
| AI capability and tool coverage audits, without --write | Passed | Counts unchanged: 109 modules, 815 tools, 577 routes, 210 pages, 7 reviewed business tools |
| node .agentic/scripts/verify_legacy_money.mjs | 9 regression checks passed | Existing legacy gate |
| Actual money inventory verifier and exact HEAD diagnostic comparison | Both fail identically with 1447 errors; 11 drifted consumer files unchanged | Existing baseline failure, not a green global money inventory |
| python -m unittest discover -s .agentic/tests -q -k test_split_releases_slot_and_parent_returns_after_child_completion | 1 test passed | Focused graph regression only |
| python .agentic/agent.py validate; git diff --check | Passed before submission; completion revalidated | Structural validation, not runtime qualification |

The inventory comparison ran the actual verifier against HEAD's inventory and
HEAD's AI schema source-line locations, then against the current inventory/schema.
Its numeric/JSON table metadata is unchanged by the new text/UUID columns. Both
stderr outputs match exactly, 1447 lines; all 11 reported consumer files match HEAD
after LF normalization. Only six existing AI input column line pointers moved by
three lines in MONEY_BOUNDARIES.json. No unrelated inventory rebaseline occurred.
The temporary comparison script was removed.

Development failures were repaired or explicitly bounded: early cancellation
fixtures awaited stop while holding the domain organization lock, causing a query
timeout; the final fixture releases the business gate before awaiting stop, and
passed. An initial cleanup hang was stopped for that task-owned worker and fixed
by tracking checked-out fixture connections. The first aggregate run exposed
AI-029's cached pg_stat_activity snapshot; refreshing it inside the polling loop
fixed the contention assertion, and focused/aggregate retries passed. One follow-up
worker invocation timed out without an assertion after the audit refinement;
the isolated retry and final three-file regression passed. The exhaustive controller
suite was stopped after prolonged execution and is NOT claimed to pass; the focused
split regression and structural controller validation passed instead.

No build, dev server, Docker, live provider, deployed worker, hosted CI or production
activation was run. No native Persian/UI qualification is claimed. Provider/hosting,
metered protocol execution, provider-call/key persistence, streaming, automatic read
retry qualification and independent parent acceptance remain open for AI-033/later
tasks. Uncertain effect resolution remains conservative/manual inspection state.

## Review and handoff

Codex self-review is separately recorded in AI-032-review-1.md.
AI_TOOL_OPERATIONS.md documents the exact internal contract and remaining work.
Next implement AI-033 using this boundary; do not use legacy step-storage helpers
as dispatch authorization or treat a prepared/uncertain receipt as success.
