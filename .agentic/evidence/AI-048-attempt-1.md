# AI-048 implementation evidence

## Identity

2026-10-30, Codex, D:\Projects\a\dubbl. Entry HEAD was 26f9f46a and the
working tree was clean. This is one bounded controller task, with a local commit
only. No push, deployment, dev server, build or live provider was authorized.

## Acceptance mapping

1. Added the finite contract in docs/AI_FINITE_ACTION_ADAPTERS.md and strict
   discriminated action schemas in lib/ai/action-adapters.ts. Supported additions
   are single invoice received-cash/bill made-cash settlement, qualified unlinked
   manual-draft deletion, and saved-contact invoice-summary email. Exact arguments
   and live per-action permissions come from shared settlement, journal deletion
   and rendering/email domains. AmountMinor is a canonical positive document
   minor string checked before numeric conversion. Unknown actions/fields,
   refunds, arbitrary allocations, recipient/display overrides, attachments,
   security/provider/role/credential actions and Stripe remain unsupported.
   Added three actual REST routes and three matching registered MCP tools using
   wrapTool; no action is added to the seven-tool ordinary model catalog.

2. Extracted shared preflightSettlement, assertDraftJournalDeletion and
   readDocumentForRendering. Existing writers retain their lock, account setup,
   idempotency, delivery and transaction contracts. Observation transactions are
   repeatable-read/read-only and never call effects. Settlement requires existing
   bank/FX accounts, qualifies recognition/history/period/reference/currency/FX,
   and shows source cash separately from base cash/carrying/gain and balanced GL
   legs. Deletion reports complete removed lines and irreversible cascade/no-undo
   effects, rejects all incoming journal FKs except cascading lines and reversal
   links, and uses the direct deletion domain's strict period rule. Email derives
   complete summary content/subject/recipient/reply-to/amounts/dates, validates
   saved/live mailbox agreement, controls/header safety and the same email quota
   used by delivery. No HTML/PDF render, delivery, log insertion, account creation,
   numbering, payment, journal change or business approval occurs in preview.

3. Extended current business-policy observation to invoice/bill saved headers
   using the existing condition engine. Identity-free requirements and exact
   policy/request/action bindings, malformed/ambiguous-policy rejection and
   self-assignment safeguards remain. Historical approved status always leaves
   resourceBoundApproval/approvalSatisfied/canCurrentActorApprove false. Every
   adapter integrates with existing persisted proposals, full strict argument
   authority separate from display, prepared step/action permissions, adapter/
   resource/policy bindings, explicit selection/dependency closure, CAS revisions,
   fixed original expiry, stale detection, cancellation and generic retention.
   Duplicate resources across actions are rejected rather than predicting future
   state. No unposted deletion amounts or email totals are counted as GL impact.
   Existing journal authority versions remain compatible. No schema/migration
   change or sensitive dispatch is introduced.

4. New actual REST/MCP/disposable SQL integration exercises every new action
   (both payment directions), runtime-off reads, exact source/base FX, separate
   totals, missing/unlinked/inactive ledger setup without lazy writes, overpay,
   recognition dates/status, period/fiscal locks, currency mismatch, malformed/
   unsafe integer strings, strict unsupported inputs, unsafe/disagreeing mailbox,
   subject injection, email quota, direct SQL unsafe bigint, display bounds,
   foreign/missing scope, incoming deletion references, historical approved policy,
   malformed monetary conditions/self-assignments, mixed persisted proposals,
   closure/duplicate-resource rejection, stale edits without timestamps, new
   step/permission bindings, fixed-expiry revision and mixed-payload cancellation.
   SQL hashes cover all business financial/reference/policy/delivery/audit tables
   before/after each read or proposal operation. Actual table waits followed by
   revocation of each new domain permission withhold complete preview disclosure.
   Existing batch regression also checks permission revocation during insert
   waits, races, idempotent lost acknowledgements, expiry/erase/retention and legacy
   upgrades. Existing domain and runtime integration regressions pass separately.

## Verification

Installed Node 23.11.0 and PostgreSQL 18. Created a new synthetic task cluster in
the Windows temporary folder, listening only at 127.0.0.1:55512, with explicit
TEST_DATABASE_URL. Each harness migrated and dropped its own randomized
dubbl_ci_* database. No application database or existing cluster was mutated.
The older ai029 fixture cluster could not start because pg_notify was absent;
it was not repaired or reused. Verified zero remaining dubbl_ci_* databases and
stopped the task cluster; pg_ctl status confirmed no server running.

All commands ran from the repository root. These are executed results, not a
claim that one command ran the entire repository test suite.

| Check | Result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-adapters.test.ts tests/integration/ai-action-preview.test.ts tests/integration/ai-action-batches.test.ts tests/integration/ai-runtime-acceptance.test.ts tests/integration/ai-run-lifecycle.test.ts | 5/5 passed, 58.9 seconds; latest adapter-only rerun also passed after final input-hardening/fixture corrections |
| node --import tsx --test --test-concurrency=1 tests/integration/payment-settlements.test.ts tests/integration/payment-batches.test.ts tests/integration/approval-contracts.test.ts | 3/3 passed, 27.0 seconds |
| tests/integration/document-rendering.test.ts and tests/integration/bank-document-matches.test.ts | Both passed against actual REST/MCP/SQL, 13.8 and 8.4 seconds; direct email rendering/delivery uses synthetic delivery stubs in that established regression |
| node --import tsx --test tests/integration/fx-revaluation.test.ts | Passed, 15.8 seconds; saved-history/carrying regression |
| node --import tsx --test tests/payment-settlement-wire.test.ts tests/settlement.test.ts tests/document-render-wire.test.ts tests/approval-conditions.test.ts tests/ai-provider-protocol.test.ts | 26/26 passed |
| npx tsc --noEmit | Passed, including the final affected-source run after fixture narrowing and input hardening |
| npm run lint | Passed with zero errors, 20 existing warnings outside task changes; final changed-file lint also checked |
| npx drizzle-kit generate | No schema changes, nothing to migrate; no generated migration drift |
| node scripts/audit-ai-capabilities.mjs --write, then without --write | Passed; 110 modules, 822 tools, 584 REST routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs --write, then without --write | Passed; seven reviewed ordinary tools, 815 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Remains failed at 1447 baseline errors. An isolated read shim supplied HEAD bytes for the original registry and all three changed existing verifier consumers; baseline/current both exit 1 with exactly identical 1447 error lists, zero new failures. Only those three consumer hashes/occurrences and the new adapter entry/scanned path were refreshed; affected batch authority/display money semantics were corrected. No global inventory regeneration or green inventory claim |
| python .agentic/agent.py validate and git diff --check | Passed; final completion/staged checks before commit |

Initial new-suite failures were fixture corrections: attachment.fileKey was
omitted, then the synthetic email count was below the actual free quota. Both
were corrected and rerun. Typecheck caught the same fixture field, a saved-policy
input alias not present in the DB type, and a union fixture requiring explicit
invoice narrowing; all were corrected. Final input review also guarded malformed
and excessively long strings before BigInt refinement, with actual REST/MCP
negative cases. Initial inventory line drift was resolved through the scoped
consumer refresh described above. No failing or interrupted check is called green.

## Limits and handoff

No full build, dev server, exhaustive unit/controller suite, browser/native
Persian review, real external delivery/provider qualification, deployment or
production activation was performed. Settlement observation deliberately requires
existing account setup and bounded history. Email covers one saved-contact
summary without attachments/overrides; deletion covers only qualified unlinked
manual drafts. Resource-bound business approval/decision/execution remains
AI-043/044 work, with existing direct-domain approval integration gaps explicit.

AI-046 is the next combined integration parent after this child is accepted;
AI-042/008 also remain open. Complete only AI-048 with honestly attributed
self-review, final controller validation and a scoped local commit, then stop.
