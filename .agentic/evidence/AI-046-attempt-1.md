# AI-046 combined integration evidence

## Identity and selection

2026-10-30, Codex, D:/Projects/a/dubbl, master. Entry HEAD 44b6e1d1 and clean
working tree. Live controller validate/status/next selected AI-046 after AI-045,
AI-047 and AI-048. Read their source/contracts/evidence, the parent criteria,
owner/product requirements and backend role. This completes only AI-046; no
delegation, separate peer/human review, push or rollout is claimed.

## Acceptance mapping

1. Reviewed the actual finite domain boundaries: manual journal posting and
   deletion, one invoice received-cash/bill made-cash settlement, and one derived
   saved-contact invoice-summary email. Existing shared operations supply the
   read-only preflight. Strict arguments, domain compatibility ceilings and
   current grants are documented in AI_FINITE_ACTION_ADAPTERS.md. Reconciled the
   main batch contract's formerly journal-only wording with the actual four
   action variants and per-item adapter/grant contracts. Unsupported financial,
   security/provider/role/credential and Stripe actions stay unavailable; no
   ordinary model catalog, runtime/provider activation or effect is added.

2. Added an independent combined actual REST/MCP/disposable SQL journey in
   ai-action-integration.test.ts and its worker. Six proposed effects combine USD
   and IRR journal posting, USD invoice cash, EUR bill cash into USD GL, separate
   draft deletion and separate invoice email. It checks every standalone domain
   observation and mixed complete display, target/reference/relative links,
   before/after states, removed lines/no-undo, derived recipients/content, exact
   currency carriers and cash/recognition FX. Bill cash 500 EUR minor at rate 3
   previews 1500 USD cash, 1000 carrying and a 500 USD loss; combined selected GL
   impact is 3250 USD plus 1250 IRR, never a mixed economic sum. Deletion/email
   contribute no new GL impact. Later explicit FX refresh at rate 4 produces
   3750 USD while preserving the IRR units. No narration, executable raw JSON or
   display overrides establish these effects.

3. Matching current journal/invoice/bill workflows and latest approved requests
   are seeded for every resource. Existing domain condition semantics produce
   identity-free next actors and opaque resource/policy bindings, with
   approvalSatisfied/resourceBoundApproval/canCurrentActorApprove always false.
   Tests show malformed bill policy withholds the entire mixed batch, failed
   revision rolls back all prior metadata changes and self-assignment reports
   administrator repair without authority. Journal/contact/FX edits without
   updatedAt changes make the stored proposal stale; explicit whole-batch
   revision binds fresh observations and policy, never historical approval.

4. The mixed journey verifies empty initial selection, complete dependency
   closure, concurrent REST/MCP selection with one stable retry receipt, CAS
   versions, original expiry/deadline, new scoped prepared steps and exact domain
   grants, old skipped steps, no dispatch leases, no financial effects and the
   unchanged 20-total-step ceiling. Read disclosure checks every grant, including
   an earlier posting grant revoked during the later email adapter's real table
   wait. Revoking manage:payments during a prepared-step INSERT wait rolls back
   the complete mixed transaction, including already inserted batch metadata,
   run version/events and steps. Sibling/foreign scope returns no details.
   Runtime-off reads work and new revisions fail closed. Cancellation,
   conversation erasure, content retention and batch expiry remove all six
   payloads; maintenance in a fresh process expires without requeueing effects.

5. All four real observation/proposal integration suites pass: new parent
   journey plus the journal/policy, storage/revision/retention and finite-adapter
   child regressions. These include financial/currency/reference/period gates,
   scope, unsupported inputs, unsafe recipients/headers/SQL values, bounds,
   invalid/stale policy/resource, no effects, late revocation, races, revisions
   and retention. SQL hashes cover all business financial/reference/policy/audit/
   delivery tables; reads and rejected revisions also hash all AI state. The
   combined run creates no payment, email log, AI approval or provider call.

## Finding repaired during parent acceptance

The initial independent mixed test failed: PostgreSQL resolves uppercase and
lowercase UUID spellings to the same row, but the old resource key compared text
case. Posting one draft and deleting its uppercase UUID alias was accepted as
two distinct resources and wrote proposal metadata. Business records were not
mutated, but this violated the finite distinct-resource contract.

actionResource now compares lowercase UUIDs. Batch normalization lowercases
item/prerequisite/selection IDs before uniqueness/closure and request digest
checks. Original validated domain arguments keep their spelling. The reproduced
duplicate-resource case and case-alias duplicate-item case now reject without
any writes; uppercase/lowercase equivalent complete graph selections race
through actual REST/MCP and return the same idempotent receipt. Existing rows
are never silently rewritten or executed. This repair needs no schema change.

## Executed verification

All commands ran from repository root. Installed Node 23.11.0 and PostgreSQL 18.
A fresh task-owned synthetic cluster listened only at 127.0.0.1:55513 through an
explicit TEST_DATABASE_URL. Harnesses migrated/dropped randomized dubbl_ci_*
databases. No application database, external provider or real delivery was used.
Verified zero remaining fixture databases after the final rerun, stopped the
task-owned cluster and confirmed pg_ctl reports no server running.

| Command/check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-integration.test.ts tests/integration/ai-action-preview.test.ts tests/integration/ai-action-batches.test.ts tests/integration/ai-action-adapters.test.ts | 4/4 passed, 51.2 seconds; actual REST handlers, linked registered MCP and disposable SQL |
| Parent-only rerun after prepared-step/deadline assertions | Passed, 12.6 seconds |
| node --import tsx --test tests/approval-conditions.test.ts tests/ai-provider-protocol.test.ts | 14/14 passed |
| npx tsc --noEmit | Passed, including final affected-source repeat after the prepared-step assertions |
| npm run lint | Exit 0, no errors; 20 existing warnings plus an unused test import observed before adding the final prepared-step assertions. Final scoped lint is clean; only baseline warnings remain in current source |
| npx eslint lib/ai/action-adapters.ts lib/ai/action-batches.ts tests/integration/ai-action-integration-worker.ts tests/integration/ai-action-integration.test.ts | Passed, zero errors/warnings after final test changes |
| npx drizzle-kit generate | No schema changes, nothing to migrate; no generated changes |
| node scripts/audit-ai-capabilities.mjs | Passed, 110 modules/822 tools/584 routes/210 pages; unchanged inventory |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, seven reviewed automatic tools/815 unlisted; unchanged coverage |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1 with the exact same 1447 baseline failures. An isolated read shim supplies HEAD bytes for the original registry and changed registered adapter source: HEAD/current both exit 1, exactly identical error lists and zero new failures. Only the changed adapter's registry hash was refreshed; units/occurrences/schema and unrelated consumers are untouched |
| python .agentic/agent.py validate; git diff --check | Passed; completion/staged checks repeated before commit |

The initial parent failure was the reproduced UUID bug, repaired and verified
through the full passing suite. No failed check is reported as passing. No full
build, dev server, exhaustive controller/unit suite, browser/native Persian,
live-provider/delivery qualification, deployment or production activation was run.
Child evidence is immutable and unchanged; this parent supplies new evidence.

## Handoff and limits

AI_ACTION_INTEGRATION.md records this combined contract and qualification.
AI-042 is next for its separate storage/adapter integration; AI-008 remains open.
AI-043/044 retain explicit resource-bound decisions, missing direct-domain
business-approval enforcement, fenced effects and uncertain-outcome recovery.
No preview fingerprint, selected item, legacy approved status or worker message
can satisfy those future gates. Complete this task with honest self-review and
scoped local commit only, then stop.
