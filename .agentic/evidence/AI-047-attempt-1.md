# AI-047 attempt 1 - current journal business-policy observations

## Identity and task selection

2026-10-30, Codex, D:/Projects/a/dubbl, master, entry HEAD 9497f48b and clean tree.
Controller validate/status/next selected AI-046. Reviewed actual journal,
settlement, deletion, email-rendering/delivery and approval operations. Approval
requests store status without resource/policy digests; settlement preflight also
contains locks and lazy bank/FX-account creation. Split AI-046 into AI-047
(journal policy evaluation/binding) and AI-048 (additional finite domain
adapters), retaining every original parent criterion and integration acceptance.
Completed only AI-047. No delegation, peer or human review is claimed.

## Acceptance mapping

1. Current policy: lib/ai/business-policy-preview.ts observes policies inside the
   existing journal adapter's repeatable-read, read-only transaction. It validates
   all active journal workflow conditions/steps and scoped member references,
   uses the existing condition semantics and checkApprovalRequired engine, and
   rejects ambiguous multiple matches rather than depending on unordered SQL
   precedence. It qualifies the latest request's historical workflow, current
   step, scoped requester/action members and action-step references. Bounds are
   20 active workflows, 100 steps each, 100 actions, existing 100 conditions, and
   32768 UTF-8 bytes for individual workflow and complete policy observation.
   Unavailable results have finite codes and no partial display. No workflow,
   step, request, member identity, conditions, names or comments are disclosed.
   Only opaque digests, booleans, status and finite requirement/actor categories
   are returned. These categories describe needed review, not execution rights.

2. Exact binding: journal adapter version 2 binds the actual header/lines/account
   display and a scoped policy digest covering relevant workflow fields, ordered
   steps, latest request, ordered actions and referenced member/user bindings.
   Policy/step/request/action edits invalidate the resource fingerprint without
   relying on updatedAt. Batch authority explicitly stores adapter/resource/
   policy versions separately from display; a stale/invalid observation withholds
   the entire batch. Explicit CAS revision regenerates observations and prepared
   step identities, preserving original expiry/deadline and rollback behavior.
   A SQL fixture with documented legacy version-one authority reads stale, then
   explicitly upgrades under the original expiry. Existing bounded JSONB storage
   is sufficient; no schema or migration was changed.

3. Approval boundary: legacy requests have no exact resource or policy digest.
   approvalSatisfied, resourceBoundApproval and canCurrentActorApprove are always
   false, even for historical approved status. No matching rule only means that
   business policy is not required; it does not grant AI approval. Any workflow
   assignment to the proposing actor, journal creator or matching requester is
   marked for administrator repair. Sequential isRequired:false steps do not
   create a bypass. The ordinary seven read/draft tools and default-off runtime
   remain unchanged. No request/action is submitted and no domain mutation,
   approval, payment, email, continuation or dispatch is performed by preview.

4. Actual transport/database evidence: expanded the existing real REST handlers
   and linked registered MCP fixture journeys. They assert matching/nonmatching
   text/integer conditions, inactive historical workflow, malformed fields and
   integer operands, missing steps, multiple matches, foreign step/requester/
   action members, invalid current step, workflow/step/action/payload bounds,
   hidden identities/comments, self-assignment and resource edits. They test
   policy/request/action/step changes invalidating durable proposals, explicit
   refresh, no-effect failed revisions, fixed expiry and legacy authority
   upgrade. SQL hashes include policy/request/action data and verify that
   observations and failed revisions leave them unchanged; business journals
   remain drafts, with zero AI approvals/payments/email deliveries. Existing
   resource/period/currency/FX/scope/retention/revision-race checks still pass.
   Actual journal-line and policy-table waits followed by permission revocation
   withhold the complete preview. Existing batch INSERT-wait revocation rolls
   back the entire proposal. Current credentials, own-run/org scope, cancellation
   and retention remain enforced by the shared operations.

## Verification

Installed Node v23.11.0 and PostgreSQL 18 synthetic loopback cluster used through
explicit TEST_DATABASE_URL at 127.0.0.1:55493. The established cluster was stopped
at entry, started with loopback-only options, and each test harness created,
migrated and dropped randomized dubbl_ci_* databases. Verified zero remaining
fixture databases and stopped the cluster. No application database was mutated.

| Command/check | Result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-preview.test.ts tests/integration/ai-action-batches.test.ts tests/integration/approval-contracts.test.ts tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-run-lifecycle.test.ts | 5/5 passed, 52.4 seconds; actual REST/MCP/SQL, approval domain, automatic runtime and lifecycle regressions |
| node --import tsx --test tests/approval-conditions.test.ts tests/ai-provider-protocol.test.ts | 14/14 passed |
| npx tsc --noEmit | Passed; final affected-source check also run before completion |
| npx eslint on all changed TypeScript sources/tests | Passed |
| npm run lint | Passed, zero errors and 20 existing warnings outside changed paths |
| npx drizzle-kit generate | No schema changes, nothing to migrate; no generated changes |
| node scripts/audit-ai-capabilities.mjs --write, then without --write | Regenerated only three changed MCP descriptions; passed, 110 modules/819 tools/581 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed; seven reviewed tools/812 unlisted; no coverage changes |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Still failed with 1447 baseline errors. Intersection of changed files with every verifier consumer/schema/registry/script input is empty; no green inventory claim |
| python .agentic/agent.py validate and git diff --check | Passed; final staged/controller checks before commit |

Initial typecheck found one removed request variable still referenced by the
fingerprint constructor; removed that reference, bound the new observation and
reran successfully. Capability audit initially detected the expected description
drift and passed after narrow regeneration. No test failure is reported as green.

No full build, dev server, full unit/exhaustive controller suite, browser/native
Persian, deployment, live provider, sensitive execution or production activation
was attempted. Existing direct journal posting still does not enforce the
business-approval engine; AI-043/044 must qualify the decision/effect boundary.

## Handoff

Documentation is in docs/AI_BUSINESS_POLICY_PREVIEWS.md and updated preview/batch
contracts, task index and source coverage. AI-048 retains finite payment/deletion/
sending adapters and their actual no-effect preflight, recipients and domain gates.
AI-046/042/008 remain open integration parents. Complete this bounded child with
an honestly attributed self-review and scoped local commit; no push authorization
is inferred from continue next task.
