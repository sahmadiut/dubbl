# AI-043 explicit scoped approval and rejection

## Identity and scope

2026-10-30, Codex, D:/Projects/a/dubbl, master, entry HEAD f27e9a4f and
initially clean working tree. Live validate/status/next selected AI-043 after
AI-042. Read root/nested agent rules, controller/start/project/repository/backend
role, owner/product requirements, batch/adapter/policy implementation and
dependency evidence. One bounded task, without delegation, push or activation.

## Implementation and acceptance mapping

1. Added shared strict approveActionBatch/rejectActionBatch services, POST own-run
   action-batch/approve and /reject routes, and registered approve_ai_action_batch
   and reject_ai_action_batch tools in the existing registered preview module.
   Exact batch/run versions, bindingDigest, complete persisted selection and
   idempotency key bind the decision; org/actor derive from current authentication.
   Resource/action/policy/argument/step bindings and original expiry are verified.
   Schema-generated migration 0025_plain_outlaw_kid adds scoped decision metadata,
   unique batch/request constraints and bounded permission/digest/version guards.
   The referenced composite unique is ordered before the generated FK. There is
   no new automatic catalog tool, arbitrary argument input or sensitive dispatch.

2. Approval additionally requires a live authenticated session. Current production
   MCP OAuth and API-key contexts cannot attest separate explicit human consent;
   they receive DECISION_INTERACTION_REQUIRED/open_interactive_approval. The same
   registered MCP operation is tested positively with a server-bound session
   context, and negatively with an actual stored token context. This does not
   claim production OAuth-token approval support. Safe rejection remains token-
   callable. No human-confirmed boolean, model yes, clarification text or policy
   override is accepted. Current own scope, grants, runtime/configuration and
   original run identity are revalidated. Changed resources, selection, policy,
   stale versions, expired records and revoked credentials fail closed. Existing
   required business approvals return DECISION_BUSINESS_APPROVAL_REQUIRED with
   identity-free next actor categories; legacy approved requests and self-assigned
   policies confer no authority. No business policy/request/action is changed.

3. Decisions lock conversation/run/batch/ordered steps and write one atomic
   content-free receipt/event. Writes are followed by fresh resource/policy,
   credential, permission and wall-clock checks, including SQL lock waits.
   Approval increments run version but leaves awaiting_approval with no lease,
   queue or domain effect. Read exposes decision metadata and live canApprove.
   Revisions supersede original batch authority and require a new decision;
   historical receipts never resume work. Rejection cancels the run, erases every
   revision and skips all remaining prepared items/dependents, preserving completed
   steps/effects. Executing, uncertain or unrelated prepared work prevents a
   decision. Existing Stop/expiry/retention invalidates proposal authority.
   Original required grants persist in bounded metadata so even erased-payload
   receipt retries respect current permission revocation. Identical request-key
   replays return only the original receipt; changed input or a competing key
   conflicts. There are zero queue transitions from decisions.

4. New actual REST/registered linked MCP/disposable SQL journey covers:
   concurrent identical REST/MCP approvals, lost acknowledgements, competing
   approve/reject keys, changed input under a key, exact selection/dependency
   closure, empty/duplicate selection, forged digest/version/arguments/policy/
   actor/text, sibling and foreign scope, each posting/read/AI grant, deletion
   permission, token-only self-approval denial, real token rejection/revocation,
   session revocation, runtime/configuration changes, edited resources without
   timestamps, expiry/cancellation, legacy approved and self-assigned business
   policy, and identity-free next actors. SQL constraints reject cross-owner/org
   receipts and bad digests. A completed durable step is byte-for-byte unchanged
   after dependent rejection. Both Stop/decision lock orderings are exercised.
   A real SHARE table lock pauses receipt INSERT, then permission revocation,
   resource edit or wall-clock expiry rolls back every decision write. Business
   table hashes prove posting/deletion decisions create no financial/delivery/
   approval/provider/usage effects. Retry and failed-decision hashes prove no AI
   mutations. Claiming finds no queued sensitive work.

## Executed verification

Installed Node 23.11.0 and PostgreSQL 18. A fresh task-owned cluster listened only
at 127.0.0.1:4381, using explicit TEST_DATABASE_URL. Harnesses create/migrate/drop
randomized dubbl_ci_* databases. No application database, production migration,
provider or external delivery was used. Final cleanup and controller/staged checks
are recorded before the local commit.

Final SQL found zero remaining dubbl_ci_* fixture databases. Stopped the owned
cluster with pg_ctl; status confirmed no server running. Final affected-source
typecheck and lint passed, and controller/diff checks passed before submission.

| Check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-decisions.test.ts tests/integration/ai-action-storage-acceptance.test.ts tests/integration/ai-action-batches.test.ts tests/integration/ai-action-integration.test.ts tests/integration/migrations.test.ts | 8/8 passed, 60.5 seconds; four real transport/SQL journeys and four migration cases |
| Decision + batch regression rerun after current-decision/readiness display | 2/2 passed, 29.0 seconds |
| Final decision rerun after rejecting unrelated prepared work | Passed, 14.6 seconds |
| node --import tsx --test tests/approval-conditions.test.ts tests/ai-provider-protocol.test.ts | 14/14 passed |
| npx tsc --noEmit | Passed; final affected-source run repeated before completion |
| npm run lint | Passed: 0 errors, 20 existing warnings outside task changes |
| npx eslint on changed application/schema/transport/test sources | Passed |
| npx drizzle-kit generate | Generated 0025_plain_outlaw_kid.sql and snapshot; no application DB migration |
| node scripts/audit-ai-capabilities.mjs --write, then verification | Passed: 110 modules/824 tools/586 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs --write, then verification | Passed: seven reviewed/817 unlisted tools; decision tools excluded from ordinary chat |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, exactly 1447 existing errors. A temporary source-read shim supplies HEAD registry/changed-consumer bytes and excludes only the new decision table from baseline enumeration: baseline/current error lists are identical, zero new errors. Only owned consumer hashes/occurrences/scanned paths and three new nonmonetary schema columns were refreshed; prior classifications/annotations retained |
| python .agentic/agent.py validate; git diff --check | Passed; final controller/staged checks before commit |

The first focused journey failed because the new fixture used an object instead
of the domain's array approval conditions. Corrected to [] and reran successfully.
An intermediate broad inventory generation refreshed unrelated historical drift;
reduced it to the scoped refresh above. The first temporary baseline shim exceeded
Node's default child-process output buffer; increased its bounded capture and
verified exact baseline equality. These were fixture/tooling corrections; no
failing check is represented as passing and no global inventory pass is claimed.

## Review and handoff

See AI-043-review-1.md for actual self-review. Contract and limitations are in
AI_ACTION_DECISIONS.md. AI-044 remains responsible for executor-to-proposal
integration, exact selected/dependent dispatch, resource-bound business approval,
current authorization at effects, fencing, consumption and recovery. Recorded
decisions alone cannot activate any of that behavior. AI-008 remains independent
combined acceptance. No browser/native Persian, production authentication
interaction, live provider/delivery, full build, dev server, exhaustive unit suite,
deployment, production activation or push was attempted. Stop after the scoped
local commit; no task blocker remains within this decision-only scope.
