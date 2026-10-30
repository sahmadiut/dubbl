# AI-049 exact approved-action consumption and fenced receipts

## Identity and scope

2026-10-31 (Asia/Tehran), Codex, D:/Projects/a/dubbl, entry HEAD c5052ebb,
master and initially clean working tree. Live controller selected AI-044. Read
root/nested agent rules, start/controller/backend role, project/repository map,
product experience, decision contract and AI-043 evidence, current proposal,
adapter, authorization, executor, worker, schema and lifecycle implementation.

AI-044 spans consumption, four domain effect boundaries and worker/transport
integration. Used the controller split workflow to create AI-049, AI-050 and
AI-051, preserving every parent criterion and AI-008's outer acceptance. This
attempt completes only AI-049. No delegation, push or rollout change.

## Implementation and acceptance mapping

1. Added strict trusted-only consumeApprovedAction and settleApprovedAction in
   lib/ai/action-batches.ts. Consumption accepts only run/lease/batch/item UUIDs,
   canonicalizes identity spelling, locks conversation/run/batch/ordered steps,
   validates normalized graph and exact current approved decision/binding,
   selection, arguments, step versions, adapter/resource/policy versions, owner,
   org, original expiry, current lease, original run identity/configuration and
   current AI/history/data/domain permissions. Target preflight and live authority
   checks repeat after receipt/event/audit SQL writes and real lock waits.
   Changed/required/unbound business approval fails closed. These observations
   do not serialize future domain effects; AI-050 explicitly retains that work.
   No REST/MCP/model dispatch capability or application queue path is added.

2. Added ai_action_consumption content-free metadata plus generated migration
   0026_first_emma_frost.sql/snapshot/journal. Composite decision and step FKs bind
   the same run/org/owner. New referenced unique keys precede their FKs in DDL.
   Unique step and decision/item constraints enforce one immutable consumption.
   Prepared-to-executing, dispatch lease, receipt, run version, event and audit
   commit atomically. Exactly one concurrent caller receives original validated
   action arguments; later callers receive only existing bounded receipt data.
   A lost fresh handoff cannot reacquire arguments, including on the same lease.
   No arguments, display, transcript, credentials or provider output are copied
   into consumption metadata. No numeric/JSON money columns or units change.

3. New consumption requires no executing/uncertain step and no failed/skipped
   selected work. A selected prerequisite must have a succeeded step AND its
   own consumption for this exact decision/item/argument/fence. An unrelated or
   synthetic succeeded step is insufficient. Trusted finite callbacks preserve
   existing receipts; wrong or recovered/replaced fences cannot overwrite them.
   Known callbacks can settle during Stop/revocation/expiry while their original
   running fence still owns executing work. Failed/uncertain results skip pending
   actions and erase proposal authority. Uncertainty requires reconciliation;
   cancellation retains known completed receipts. Existing maintenance converts
   a lost executing lease to uncertain/reconciliation_required. No replay or
   transaction-wide rollback is claimed. Final success orchestration is AI-051.

4. Added real session-backed REST approval and registered linked MCP proposal/
   revision/rejection flows feeding disposable SQL and actual claimNextRun.
   Qualification covers concurrent same/lower/uppercase UUID claims, one-time
   argument handoff and repeated receipts, unselected actions, missing receipts,
   fake prerequisite success, rejected/missing/old decisions, superseded batches,
   arbitrary argument injection, wrong leases, resource edits without timestamps,
   permission/session revocation, lease and original approval/deadline expiry,
   changed provider/policy/runtime, cross-owner/org/run FKs and invalid digests.
   Real SHARE table locks pause consumption INSERT before permission revocation,
   resource edits and wall-clock lease expiry; every fence/step/event write rolls
   back. Stop before and after consumption, partial confirmed/failed receipts,
   uncertain callbacks, fresh-process maintenance, late stale callbacks and no
   requeue are exercised. Business/provider/usage table hashes remain unchanged.
   Callback results are deliberately simulated trusted adapter receipts, not
   claims about financial posting, deletion, payment or external sending.

## Executed verification

Installed Node 23.11.0 and PostgreSQL 18. Created a task-owned randomized cluster
listening only on 127.0.0.1:4382. Explicit TEST_DATABASE_URL directs the harness;
each case creates/migrates/drops a randomized dubbl_ci_* database. No application
database or production migrations were used. Foundation fixture SQL explicitly
queues approved runs to exercise actual claimNextRun; no public resume path is
implied. Details and limits: ../docs/AI_ACTION_CONSUMPTION.md.

| Check | Actual result |
|---|---|
| node --import tsx --test tests/integration/ai-action-consumption.test.ts | Final passed, 1/1, 25.2 seconds, actual REST/MCP/SQL and fresh recovery process |
| Sequential combined consumption/decisions/storage/batches/integration/migrations run | Existing regression cases passed 8/8; new consumption case initially failed on fixture session revocation and was corrected/rerun separately. The failed combined command is not reported green |
| npx drizzle-kit generate | Generated 0026_first_emma_frost.sql and metadata; generated FK ordering corrected before migration. Four migration regression cases passed, including clean upgrade, preservation, adoption and rollback |
| npm run lint | Passed: 0 errors, 20 existing warnings outside owned changes |
| Final npx eslint on changed application/schema/test sources | Passed |
| Final npx tsc --noEmit | Passed, exit 0 |
| node scripts/audit-ai-capabilities.mjs | Passed, unchanged 110 modules/824 tools/586 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, unchanged seven reviewed automatic/817 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, exactly 1447 existing errors; baseline and current complete ordered lists identical, zero added/removed errors |
| python .agentic/agent.py validate; git diff --check | Passed during implementation; final controller/staged checks recorded below |

Money inventory was refreshed only for owned source hashes/occurrences,
coordinates and new scanned paths, preserving existing classifications/notes.
A temporary readFileSync shim supplied HEAD versions of the registry and owned
sources to the existing verifier; comparison against the unmodified current
verifier confirmed exact error-list equality. No new numeric/JSON column needs
classification. The broad inventory generator was used only in memory, not to
rewrite unrelated reviewed rows or historical evidence.

Early fixture corrections: a consumed step's unique key masked the intended
cross-run FK assertion, so the test uses an unconsumed foreign-run step; rejected
runs must not be queued as normal running fixtures; revision history contains
skipped superseded steps, so lock-wait assertions compare full before/after rows;
durable session revocation uses users.sessionRevokedAt rather than clearing a
mock login. Explicit fixture array typing fixed TypeScript diagnostics. No failing
check is represented as passing.

## Review and handoff

See AI-049-review-1.md for actual Codex self-review. AI-050 must integrate the
finite domain services, serialize/recheck authority at each real effect boundary
and reconcile actual committed/uncertain outcomes. AI-051 must add explicit
REST/MCP resume and worker orchestration. AI-044/AI-008 retain independent combined
acceptance. No domain execution, live provider/sending, UI/native Persian,
production authentication transport, deployment or production activation is
qualified. Full builds and unrequested dev servers were not run. Stripe files
and functionality are unchanged. Stop after one bounded child and local commit.

## Final verification record

Final affected-source eslint and npx tsc --noEmit both passed, exit 0. Controller
validate and git diff --check passed before submission. Final SQL confirmed zero
remaining dubbl_ci_* fixture databases. Stopped the task-owned cluster; pg_ctl
status reported no server running (its expected exit 3). No fixture process or
application database mutation remains. Final focused consumption rerun passed
1/1 in 25.2 seconds after UUID alias normalization; no source changes followed.
