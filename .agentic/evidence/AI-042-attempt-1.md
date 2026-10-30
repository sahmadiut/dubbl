# AI-042 independent versioned proposal storage integration

## Identity and scope

2026-10-30, Codex, D:/Projects/a/dubbl, master, entry HEAD 44f3bea8 and clean
working tree. Live controller validate/status/next selected the ready AI-042
integration parent after AI-041/045/046. Read the applicable instructions,
controller/backend role, owner/product requirements, dependency implementation,
contracts and evidence. This is one bounded parent task, without delegation,
peer/human review, push or activation.

## Acceptance mapping

1. Independently reviewed the actual finite shared domain set: qualified manual
   journal posting and deletion, recognized invoice/bill settlement, and one
   invoice summary email to its saved contact. AI_ACTION_STORAGE_ACCEPTANCE.md
   maps these to their current domain grants and trusted business observations;
   AI_FINITE_ACTION_ADAPTERS.md retains strict arguments, bounds and unsupported
   variants. The child/domain suites exercise every action, including source
   cash/base GL/FX, recipients, irreversible effects and current workflow policy.
   Unsupported/security/credential/provider/role/Stripe operations remain absent
   from the sensitive schema; the automatic catalog stays seven read/draft tools.

2. Added an independent actual REST/MCP/SQL parent journey in
   ai-action-storage-acceptance.test.ts and its worker. It starts with six USD/IRR
   effects, then replaces posting with deletion, deletion with posting, both
   invoice/bill cash arguments and the invoice email resource. SQL checks every
   new exact argument, action/adapter/resource/policy binding, actor/org/run,
   prepared step and current grant, independently of display. Old arguments and
   display remain unchanged while their steps are skipped. Run identity/config,
   start, request digest, deadline and original expiry remain unchanged. Generated
   migration 0024_serious_chat.sql already supplies scoped authority/display
   persistence; the parent modifies no schema and reruns its migration paths.

3. Shared actual REST and linked registered MCP produce the same own-batch
   display and revision receipts. Distinct concurrent revision keys with different
   amounts yield exactly one new version and one conflict; the stored display
   matches the winning arguments. Old versions and changed input under the old
   request key conflict without writes. Identical lost-ack retries return only
   original metadata, including after cancellation with runtime disabled, and
   cannot restore authority. Sibling/foreign scope yields BATCH_NOT_FOUND. The
   child/domain regressions cover every per-item grant, late read/INSERT-wait
   revocation, invalid/stale policy/resource, expiry, corrupt bindings and finite
   recovery responses without disclosing approver identities.

4. Initial proposal selection/totals are empty. Explicit whole-graph revision
   returns every selected effect with all original/new argument-derived business
   details. Exact separate totals are 1250 IRR plus 2750 USD minor; competing
   revision amounts produce 2750 or 2850 USD according to the actual winner.
   Deletion/email have no new GL impact. Every display expiry remains the original
   fixed expiry. Old steps are skipped, new steps have null input/dispatch lease,
   the run remains awaiting_approval and the fourth six-item revision fails the
   total-step bound. Child regressions rerun graph closure/cycle/duplicate/alias
   selection bounds, cash/base FX separation and no implicit sensitive selection.

5. Two deterministic SQL lock cases cover cancellation racing revision. Revision
   first holds the run while blocked on an ai_step update: Stop waits, then clears
   both current and superseded payloads after revision commits. With Stop first
   in the run-lock queue, the waiting revision conflicts and cannot recreate
   authority. Every affected prepared step becomes skipped and no run is claimed.
   Conversation deletion, content retention and proposal expiry each follow a
   mixed revision and erase both versions, including replaced arguments/resources.
   Content/expiry maintenance runs in fresh processes and expires without requeue.
   A journey-wide SQL hash excludes only Stop's legitimate audit writes and
   confirms all other business financial/reference/policy/delivery tables remain
   unchanged. Payments, email logs, AI approvals, usage and provider attempts/calls
   remain empty. Failed revisions and read/retry operations additionally hash AI
   state and perform no writes. Disposable migration tests retain ledger values.

## Executed verification

Installed Node 23.11.0 and PostgreSQL 18. A fresh task-owned cluster listened only
at 127.0.0.1:4379, selected through explicit TEST_DATABASE_URL. Each harness
created/migrated/dropped its randomized dubbl_ci_* database. Final SQL found zero
fixture databases; pg_ctl stopped the task cluster and confirmed no server running.
No application database, real delivery, external provider or application migration
was used. All commands below ran from the repository root.

| Check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-storage-acceptance.test.ts tests/integration/ai-action-integration.test.ts tests/integration/ai-action-batches.test.ts tests/integration/ai-action-adapters.test.ts tests/integration/ai-action-preview.test.ts tests/integration/migrations.test.ts | 9/9 passed, 71.6 seconds; five real transport/SQL journeys and four migration cases |
| Parent-only rerun after journey-wide immutable business hash | Passed, 16.1 seconds, including both Stop/revision orderings |
| node --import tsx --test tests/approval-conditions.test.ts tests/ai-provider-protocol.test.ts | 14/14 passed |
| npx tsc --noEmit | Passed after correcting the test fixture's nonexistent run.attempts assertion; final affected-source run repeated |
| npm run lint | Passed, 0 errors and 20 existing warnings, none in new tests |
| npx eslint on both new test files | Passed; final affected-source run repeated |
| node scripts/audit-ai-capabilities.mjs | Passed, unchanged 110 modules/822 tools/584 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, unchanged seven reviewed/815 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Failed, exit 1 with exactly 1447 errors; verified by capturing direct stderr lines. No registry, schema, product source or registered consumer was changed, so these remain the existing failures. No global money-inventory pass is claimed |
| python .agentic/agent.py validate; git diff --check | Passed; controller completion and staged checks repeated before commit |

The first parent test exposed a harness import-order error: a runtime import of
the adapter loaded Auth.js before the test's session mock, causing an out-of-
request headers error. Converted it to a type-only import and dynamically loaded
runtime adapter helpers after the mock, matching the existing transport fixtures.
Initial typecheck also found a nonexistent attempts field in the new assertion;
replaced it with actual persisted identity/config/start/request-digest checks.
These were test-harness defects, not product defects. The corrected parent and
full targeted suite pass. No failing check is represented as passing.

## Review and handoff

Actual self-review is AI-042-review-1.md. Product implementation satisfied this
parent's observation/storage requirements, so no runtime/schema duplication or
behavior change was needed. New tests and contract/evidence are the scoped diff.
Completed child evidence remains untouched.

AI-043 is next for explicit resource-bound approve/reject decisions. AI-044 owns
executor-to-proposal integration, fenced approved execution and recovery;
AI-008 remains the outer integration parent. Current direct-domain workflows
still lack the required resource-bound business-approval enforcement; future AI
dispatch cannot bypass it. No preview digest, selection, clarification text,
legacy approved status or metadata receipt supplies that authority.

No full build, dev server, exhaustive unit/controller suite, browser/native
Persian, live provider/delivery qualification, production rollout or push was
attempted. Finish this single task with honest self-review and a local commit,
then stop. No blocker remains within this observation/storage scope.
