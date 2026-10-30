# AI-040 attempt 1 - disclosure-safe provisional observation

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD fc0581f2.
Entry tree was clean. Controller validate/status/next selected AI-040, which
was started as the only active task. This is one implementation child; no
AI-036/033/031/023/007 parent acceptance is completed here. Review is explicitly
Codex self-review. No independent peer or human approval is claimed.

## Implementation and acceptance mapping

1. Added `GET /api/v1/ai/runs/{id}/observation?after=0` and registered
   `get_ai_run_observation({runId, after?})`. Both call the shared database reader
   in lib/ai/run-progress.ts; MCP uses wrapTool and a strict described object
   schema, without HTTP self-calls. Run UUID is owner/org-scoped, and `after` is
   a bounded integer execution cursor. Unknown, duplicate, malformed or authority
   inputs are rejected. All REST success/error responses are private/no-store.
   The lifecycle tool is explicitly outside the model-callable catalog.

   `provisional` contains only finite server-generated milestone codes with an
   explicit provisional/unavailable state and no record links. `confirmed`
   contains existing persisted progress/outcome codes, up to 20 steps and live
   permission/scoped domain references with exact expense minor-unit strings.
   It never contains original prompts, model narration, private reasoning,
   credentials, saved tool arguments/results, operation keys or model-created
   URLs. A pending provider response and an already confirmed draft can coexist
   without promoting the pending response to confirmation. Suspended/terminal
   runs clear provisional content; stale leases/deadlines display delayed status.

   The existing adapter continues to buffer/validate the complete raw response
   before accepting calls. The observation stream is bounded snapshot polling
   of safe milestones, not raw token deltas/freeform assistant prose. Raw model
   text can echo secrets or invented outcomes even when structurally valid;
   labeling it provisional would not make it safe. Structured clarification
   retains its existing separate authorized input contract.

   Delivery always requires replacing the snapshot. Matching execution cursors
   cannot retain previously authorized records after a grant/deletion change.
   Future/removed cursors reset safely; zero handles cursor loss. Observation
   performs no claim, retry, dispatch, renewal, maintenance, settlement or resume.
   The shared progress reader additionally rejects oversized step history,
   rechecks late grants/expiry and resolves domain links after execution/cursor/
   authorization waits. Existing progress responses retain their wire shape.
   See docs/AI_RUN_OBSERVATION.md for the complete client contract and limits.

2. Added tests/integration/ai-run-observation.test.ts and its isolated worker
   fixture. Actual polling worker, real REST handlers, linked registered MCP and
   independent PostgreSQL assertions cover:
   - Own/foreign organization and owner boundaries, strict REST/MCP schemas,
     cache headers and exclusion from automatic model dispatch.
   - A held raw provider response exposing only WAITING_FOR_RESPONSE, zero steps
     and one usage attempt through repeated observations. Delivering incomplete
     raw function-call JSON produces no business effect and retains unknown usage.
   - A real MCP-backed expense draft followed by another pending provider turn:
     provisional status remains separate from the live confirmed draft link,
     status and amountMinor='1250'. Hostile valid narration, URLs and secret-looking
     content never appear in either public contract.
   - Runtime-off observation and lost/current/future cursors with hashes of entire
     run/step/provider-attempt/usage/event/expense tables proving no mutation.
     Deleted notifications reset; reconnect never calls the provider again.
   - Same-cursor permission revocation and record deletion, retained MCP closures,
     a permission change during a real run-row writer wait, wall-clock conversation
     expiry across that wait, deletion and loss of history permission.
   - Stale leases observed without renewal/maintenance, 20 bounded steps and refusal
     to prepare a 21st, plus long authorized input with a small observation payload.
   - A fixture trigger blocking the actual expense INSERT during cancellation:
     delayed observation and cancellation preserve exactly one known draft and
     a partial outcome. Final reconnect leaves the database unchanged.

   Existing worker/executor/provider/protocol fixtures additionally verify raw
   duplicate/oversized/invalid UTF-8/partial calls, whole-response validation,
   live disclosure, clarification/resume, lease/usage/price/ceiling preservation,
   cancellation, shutdown and separate-process recovery without effect replay.

3. No schema change was needed; migration generation confirms no drift. Updated
   only generated capability/coverage inventories for the new REST/MCP operation
   and shifted registration lines: 109 modules, 816 tools, 578 routes, 210 pages,
   seven reviewed automatic tools. No policy, provider, permission or activation
   flags were enabled, and Stripe files/behavior remain unchanged.

## Verification

Repository-root commands used installed dependencies and explicit loopback
TEST_DATABASE_URL against the existing synthetic PostgreSQL18 cluster at
127.0.0.1:55493. Each harness migrates and drops randomized dubbl_ci_* databases;
it never resets the supplied target. The initially stopped fixture cluster was
started for these tests and stopped afterward. No application database or ignored environment file
was used/changed. No live provider request, build, dev server, Docker, hosting,
deployment, activation or push was performed.

| Check | Result |
|---|---|
| node --import tsx --test tests/integration/ai-run-observation.test.ts | Passed; real polling/REST/MCP/SQL cases, final separate run 5.6 seconds |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-run-progress.test.ts tests/integration/ai-worker.test.ts tests/integration/ai-executor.test.ts tests/integration/ai-provider-loop.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-provider-attempts.test.ts tests/integration/ai-tool-operations.test.ts | 8/8 passed, 76.4 seconds |
| Final reader-order regression: same node runner with ai-run-observation, ai-run-progress, ai-worker, ai-executor, ai-provider-loop | 5/5 passed on final source, 49.2 seconds |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed on final source |
| Scoped ESLint for reader/MCP/route/two test files | Passed on final source, no warnings/errors |
| npm run lint | Exit0, zero errors, 20 existing warnings outside task files |
| npx drizzle-kit generate | No schema changes, nothing to migrate; drizzle/ unchanged |
| node scripts/audit-ai-capabilities.mjs | Passed, 109 modules/816 tools/578 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, seven reviewed and 809 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx scripts/validate-messages.ts | Passed, 10776 keys per production locale |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 existing errors; raw stderr SHA-256 4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186, matching preceding AI-039 evidence |
| python .agentic/agent.py validate; git diff --check | Passed; completed state checked separately |

The global money inventory remains a red gate, not waived or described as passed.
All 1913 inventory/checker/consumed-source/schema paths were compared against HEAD
with normalized line endings; none changed. The raw audit diagnostic
hash matches the prior committed baseline; PowerShell-formatted stderr adds error
wrapper lines, so the recorded count/hash use subprocess-captured raw bytes.

During development, typecheck caught a duplicated local variable name, which was
fixed. The first fixture incorrectly disabled runtime while a worker was active;
that correctly aborted the worker and invalidated a no-mutation assertion. The
runtime-off mutation check now runs after worker closure. An assumption that long
input must prevent a provider call was corrected: this boundary has byte limits
and conservative reservations, not a qualified tokenizer. Long input now asserts
one bounded turn and no input disclosure. Final checks above passed.

Full unit/controller suites, PostgreSQL16/hosted CI, live provider/account/model/
price/tokenizer, raw-token streaming, deployed process/supervisor, browser and
native-Persian qualification remain unperformed. These are not inferred from
local source checks or deterministic transports.

## Handoff

Complete only AI-040 with a local scoped commit. Next is controller-selected
AI-036 for independent combined worker/observation integration acceptance.
AI-033/031/023/007 also remain open. Runtime/provider gates retain their defaults.
