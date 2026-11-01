# AI-008 outer preview, decision and resume acceptance

## Identity and scope

2026-11-01 (Asia/Tehran), Codex, D:/Projects/a/dubbl, master. Entry HEAD
e2dbb299; clean working tree. Live controller selected AI-008 after all children
completed. Read root/nested agent rules, controller/start/backend/project/map
guidance, owner/product contracts, dependency evidence and actual preview,
batch/decision/resume, worker and domain implementations. One bounded task,
without delegation, push or activation.

Reused the existing correct production implementation. Added
tests/integration/ai-action-journey-acceptance.test.ts and a separate
AI008_ACCEPTANCE branch in ai-approved-worker-fixture.ts, plus the combined
[journey contract](../docs/AI_ACTION_JOURNEY_ACCEPTANCE.md). The new assertions
reuse real fixture setup and transport/domain helpers, rather than treating child
completion as parent acceptance. No application source, schema, migration,
public transport, automatic catalog, rollout or Stripe changes.

## Acceptance mapping

1. Actual automatic catalog/dispatcher and rerun executor/runtime/input suites
   preserve permitted reads and drafts, dependent tool results and clarification.
   Sensitive actions remain separate finite adapters with strict input. New
   outer scenarios observe posting, invoice/bill payments, deletion and sending
   through real REST/registered MCP, prove no effects before approval/resume,
   reject injected confirmation fields, and retain independent business approval.
   Security/credential/provider/role changes remain absent from ordinary chat.

2. The new journey approves a five-effect selection, then explicitly revises
   both the invoice payment amount and selected set. The batch ID, digest and
   prepared step identities change, while expiry remains fixed. Replaying the
   old decision returns only its original acknowledgement; resuming the old
   batch fails. Fresh competing REST/MCP approvals bind the new selection.
   Only the revised journal and 1073741824 IRR cash payment execute. Child
   consumption/execution regressions retain cross-org/owner, current permission,
   policy/resource binding, expiry, SQL-wait revocation and period-lock checks.

3. The new complete six-effect display exposes five selected effects, every
   dependency and exact selected IRR totals. After revision only two execute;
   SQL confirms the partially paid invoice, unchanged bill and retained drafts,
   no delivery and two current-batch consumptions. Repeated queue acknowledgements
   do not create new effects. Concurrent rejection cancels all prepared
   descendants, erases every revision's authority/display and consumes nothing.
   Rerun execution/mixed/worker suites verify cancellation, partial prefixes,
   double submissions, crash/restart and uncertain outcomes without whole-batch
   rollback or automatic replay.

4. REST and linked registered MCP use the same actual preview/decision/revision/
   resume services. New tests cross their boundaries within one journey, retain
   private,no-store responses, and show an organization owner cannot inspect or
   approve a sibling user's run. Independent business approver requirements
   cannot be replaced by AI approval or resume. Rerun decision tests exercise
   actual persisted OAuth-token rejection with DECISION_INTERACTION_REQUIRED;
   the ordinary model catalog cannot approve itself.

5. New outer assertions compare actual REST/MCP business observations, excluding
   observation timestamps, for all five posting/payment/bill/email/deletion
   variants. They check label, reference/link, before/after, exact IRR cash amount
   and direction, recipients, effects, business approval, resource binding and
   expiry, and compare fingerprints with persisted previews. Batch transport
   reads match exactly and expose no raw executable arguments or credentials.
   The existing adapter regressions retain complete lines, currency-separated
   totals, FX, irreversible effects and bounded disclosure. AI-027 owns UI
   label translation and rendering; this task accepts its structured backend.

6. Actual REST revision followed by linked MCP retry returns one receipt.
   A selected payment without its required posting is rejected. Revised amounts
   and selection require new batch/steps/decision; rejected prerequisites never
   execute. Both decision and queue receipts survive lost/repeated observations
   without acquiring additional effect authority. Progress matches across
   transports with the same explicit page limit, preserving pagination.

7. New read/decision REST and MCP scenarios return exact BATCH_STALE,
   BATCH_EXPIRED and BATCH_DENIED codes with refresh, inspect/cancel or contact
   administrator recovery. An actual valid independent workflow returns
   DECISION_BUSINESS_APPROVAL_REQUIRED and independent_business_approver plus
   permitted next steps. Workflow/member/user identities and names remain
   hidden. Model/clarification text cannot provide a confirmation flag or alter
   hidden policy; regressions preserve clarification and interactive-session
   requirements.

## Verification environment and initial corrections

Node 23.11.0 / PostgreSQL 18 with installed dependencies. Created a randomized
task-owned cluster listening only on 127.0.0.1, using an explicit
TEST_DATABASE_URL. Every harness creates/migrates/drops its own random dubbl_ci_*
database. NODE_ENV=test and IRR_TESTING_ENABLED=true apply only to fixtures.
No application database or live provider was used.

The first focused run expected BATCH_CONFLICT for a superseded batch while
supplying the current run version. The actual guard correctly returns
BATCH_UNAVAILABLE; corrected that test expectation. The next run compared REST's
default progress page with MCP limit 20. Corrected REST to the same explicit
limit rather than treating different pagination as a service defect. Subsequent
focused and combined runs passed these assertions. No production repair was
needed. These initial failures are not counted as passes.

The scoped money registry refresh adds only the new scanned test path and
regenerates the owned shared fixture's hash, lexical occurrences and table
references. Programmatic comparison confirms unchanged schema entries and all
unrelated consumers/classifications. Captured the entry money diagnostic baseline
before test edits; normalized only PowerShell's first native-stderr prefix for
an exact ordered comparison. The inventory remains a failing gate, not financial
readiness evidence.

## Executed checks

All commands ran from the repository root. Integration commands used the
explicit disposable local environment above.

| Command/check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-action-journey-acceptance.test.ts | Focused run passed 1/1 in 11.9s before final strengthened resource/currency assertions |
| Combined integration command below | Final source passed 15/15 in 347.3s; zero failures/skips/cancellations |
| node node_modules/typescript/bin/tsc --noEmit | Passed, including after final assertions |
| npm run lint | Passed with zero errors and 20 existing warnings |
| Changed-file ESLint for both owned TypeScript files | Passed without warnings after final assertions |
| node scripts/audit-ai-capabilities.mjs | Passed: 110 modules, 825 tools, 587 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed automatic tools, 818 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1; exact ordered entry baseline of 1447 diagnostics, zero added/removed |
| Scoped money registry comparison | Unchanged schema and unrelated consumers; one scanned test path and owned fixture references/hash refreshed |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

Final combined command:

```text
node --import tsx --test --test-concurrency=1 tests/integration/ai-action-journey-acceptance.test.ts tests/integration/ai-approved-execution-acceptance.test.ts tests/integration/ai-approved-worker.test.ts tests/integration/ai-mixed-effects.test.ts tests/integration/ai-journal-execution.test.ts tests/integration/ai-settlement-execution.test.ts tests/integration/ai-email-execution.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-decisions.test.ts tests/integration/ai-action-integration.test.ts tests/integration/ai-action-storage-acceptance.test.ts tests/integration/ai-executor.test.ts tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-worker.test.ts
```

Final SQL verified zero remaining fixture databases and zero fixture sessions.
pg_ctl stopped the task-owned cluster and status confirmed no server running.
Stopped cluster files remain in its randomized dubbl-ai008-* temporary directory.

## Review and qualification boundary

Actual self-review is recorded in AI-008-review-1.md. The new parent scenarios
reuse child fixture setup/helpers; their outer journey assertions are separate.
Session acquisition and external email transport are stubbed, and fault/race
tests deliberately inject failures. Trusted worker proposal creation is tested;
there is no new client proposal-creation or sensitive model tool. Existing
resource-bound business approvals remain fail-closed where unsupported. Confirmed
email means transport acceptance, not inbox delivery. Conservative domain table
locks retain contention costs.

UI/native Persian, production authentication and MCP interactive consent,
live providers, deployed-worker supervision/throughput and activation remain
separate gates. No build, dev server, push, deployment or activation was run.
