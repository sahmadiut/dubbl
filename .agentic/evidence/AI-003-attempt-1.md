# AI-003 persistence evidence

2026-10-27, Codex task_003, database implementation and self-review. Starting
commit `14f3d0357e74ebb015e2a79ce730e09f86d62595`, clean `fresh-start` checkout.
This attempt implements storage and scoped history, not an enabled agent.

## Implementation and acceptance mapping

1. `lib/db/schema/ai.ts` defines conversations, messages, runs, steps, approvals
   and content-free outbox events. Opaque UUIDs, organization/owner references,
   composite parent-scope foreign keys, UTC timestamps, positive versions,
   unique run request keys and event sequences preserve durable scoped state.
   Database checks enforce valid state names, terminal timestamps, lease shape
   and payload bounds. `lib/ai/persistence.ts` adds transactional idempotent
   enqueue/event creation, compare-and-swap run/step transitions, terminal
   immutability and uncertain-effect guards. Restart recovery classifies expired
   leases without replaying effects; actual worker/dispatch remains AI-007.

   REST: GET `/api/v1/ai/conversations`, GET/DELETE
   `/api/v1/ai/conversations/[id]`, POST
   `/api/v1/ai/conversations/[id]/audit`. Four corresponding registered MCP tools
   call the same direct-DB service under `wrapTool`. List/get/delete are own-only;
   organization transcript audit requires separate permission and a recorded
   reason/actor/time in the existing audit log. Organization administration and
   aggregate usage do not implicitly confer audit access. Generic preset roles
   exclude the new audit permission. Live credential/membership/custom-role
   resolution uses AI-002 before access; historic generated payloads require
   their current domain permissions, with unclassified outputs withheld.
   Returned histories omit credential references and configuration snapshots.

2. Bounded structured JSON storage redacts credential/password/token/cookie and
   reasoning fields, plus defensive known token/bearer/assignment/URL patterns
   in prose. Deep/cyclic/oversized inputs fail. Individual display payloads above
   60,000 bytes become a marked omission with sanitized digest and byte count;
   PostgreSQL enforces a 64 KiB physical JSON bound. Tool preparation rejects
   truncated inputs. Messages are limited to 1 MiB/conversation; tool input/result
   bytes to 1 MiB/run and 20 prepared steps. Configuration snapshots accept only
   UUID references and integer versions, with strict unknown-field rejection;
   saved execution identities contain credential references, never bearer secrets.

   Defaults: 30-day content, 90-day metadata. Reads hide expired payloads before
   physical maintenance. Idempotent deletion tombstones immediately, stops new
   storage, cancels safe pending work, marks dispatched effects uncertain and
   retains reconciliation metadata/operation keys/bounded actual record IDs.
   It erases message, step and approval payloads and expires pending approvals.
   Maintenance erases expired content, expires approvals and purges eligible
   terminal metadata. Unreconciled effects are retained until resolved; no
   business/financial record is deleted and no rollback of committed effects is
   claimed. Existing audit-log retention is not shortened.

3. `npx drizzle-kit generate` produced `0015_mean_wild_pack.sql` plus snapshot
   and journal entry; a subsequent bounded content-free record-ID refinement
   produced `0016_chubby_crusher_hogan.sql` and its snapshot/journal entry.
   Both are additive generated migrations, applied together by the repository's
   migration CLI to new disposable databases. No existing schema/table is
   changed. `tests/integration/ai-persistence.test.ts` and its worker exercise
   real SQL, REST handlers and linked registered MCP tools, including a second
   fresh Node process that reopens and recovers persisted expired-lease work.

## Verification

All commands ran from `D:\Projects\a\dubbl`.

| Command | Actual result |
|---|---|
| `npx drizzle-kit generate` (twice after schema changes) | Passed; generated the two additive migrations and snapshots |
| `pnpm exec tsc --noEmit` | Initial application pass; later test argument type error corrected; final full incremental check passed |
| `pnpm lint` | Passed, zero errors and 20 pre-existing warnings outside this change |
| Focused ESLint over persistence/schema/routes/tools/registration/plans/new tests | Passed after final edits |
| `TEST_DATABASE_URL=<isolated loopback> node --import tsx --test tests/integration/ai-persistence.test.ts` | Passed, including final preset/domain/retention/record-ID refinements |
| Same invocation with `tests/integration/execution-identity.test.ts` | Both passed; related live REST/MCP identity regression |
| `node scripts/audit-ai-capabilities.mjs --write`, then check without `--write` | Passed; 105 registered modules, 790 operations, 559 route files, 208 pages |
| `python .agentic/agent.py validate`; `git diff --check` | Passed; structural validation remains separate from behavioral evidence |

The first integration attempt failed because a static persistence import loaded
real auth before the test's module mock; moved it after mock installation and
reran successfully. The fixture mocks session issuance only. It uses actual live
membership/permissions, shared services, PostgreSQL, REST and MCP execution.

The passing worker verifies concurrent duplicate submissions resolve to one run;
one of two competing CAS state changes wins; terminal states cannot reopen;
fresh-process restart preserves partial outcomes and requires reconciliation;
event sequences remain unique; foreign owner/organization access fails; ordinary
admin cannot audit; successful authorized audit is recorded; connected MCP access
reacts to domain/history permission changes and removed membership; persisted
secrets/config references are absent from histories; oversize payloads truncate
or fail appropriately; scope/state/size SQL constraints reject invalid writes;
erasure is repeatable and preserves outcome references; expired content is hidden
and erased; eligible metadata is purged; the aggregate content cap is enforced.

## Environment and limitations

Used installed PostgreSQL 18 `initdb`/`pg_ctl` to start a separate temporary cluster
with trust authentication restricted to `127.0.0.1:55483`. Existing disposable
fixture helpers created/dropped randomized `dubbl_ci_*` databases. No application
DB, credentials, account privileges, ignored environment files, financial data,
schema flags or provider settings were changed. Cluster shutdown is recorded in
the task handoff after verification. No credentials are included in this evidence.

This is storage acceptance. AI-007 must schedule maintenance/lease recovery and
implement the actual bounded executor, approved resume/reconciliation, policy,
flag/kill-switch and budget checks. CAS transition primitives alone do not
authorize a tool or consume an approval. AI-008 implements concrete approvals;
their records exist here but no approval endpoint or execution is exposed.
AI-006/007 must supply trusted domain permission provenance for all persisted
results and never execute redacted/truncated display payloads. Redaction is not a
claim that arbitrary unidentified secrets in prose can be recognized; upstream
minimization and strict permitted input schemas remain mandatory. History reads
are bounded (100 conversations/messages/runs, 20 steps); richer navigation is
AI-009 work. Provider/usage schemas, UI/catalog work, live providers, worker
hosting, backup erasure, deployment/migration of existing application databases,
production/security/human qualification, full test suite and browser checks are
not claimed. No full build, dev server or Stripe changes occurred.

## Handoff

See separate `AI-003-review-1.md`. Next controller task is expected AI-004; use
live `next`. Integrate provider configuration using stored UUID/version references.
Later runtime tasks must call `authorizeExecution` on persisted trusted identities
before dispatch/retry/resume, enforce current policy and real approvals, and
reconcile uncertain effects without replay. Feature enablement remains deferred.
