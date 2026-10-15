# MON-159 attempt 1 - background integration acceptance

## Identity

2026-10-15, Asia/Tehran. Operator coding-assistant (Codex); self-review only.
Entry master HEAD 9f02ae216244f501b87bd2a16974b660695cbf55; clean working tree.
The user requested completing and pushing the next task. Live controller
validate/status/next selected MON-159 after completed MON-164 and MON-165.
Read root/nested instructions, controller/project/repository map/backend role,
task/context, MON-007/164/165 evidence, scoped inventories and actual source.
The memory controller-task skill guided the one-task delivery workflow. Older
memory described MON-165 as incomplete; live task/evidence/source superseded it.

## Implementation and acceptance mapping

1. New BACKGROUND_CUTOVER_ACCEPTANCE joins both child mappings to every scoped
   actual job/service family: bookkeeping/depreciation/loans/revenue, reconciliation,
   budget/bank alerts, saved auto-reversal, journal/invoice/payable recurrence,
   FX revaluation, payroll, accruals, scheduled payments, reports and costing.
   Provider/rate/digest/webhook/backup/purge boundaries retain existing MON-160
   ownership. Actual runtime already composes shared exact domain contracts;
   no duplicate writer or new public operation/tool was required.

   Fixed legacy cents, fixed-two REST major aliases, document-minor settlement,
   tagged journal units, base-carrying stock costs, quantity hundredths/basis
   points and provider/opaque units remain explicit separate policies. No saved
   value is rescaled by magnitude/currency. Existing period/tenant/owner/replay/
   audit and safe final Number guards remain. Full-int64 bank alert projections
   are separate from business posting limits.
2. New tests/integration/background-cutover-acceptance.test.ts and worker compose
   both child families on one migrated tenant using real authenticated REST and
   linked registered SDK MCP, rather than inferring parent acceptance from children.
   EUR 3000000001 recognizes USD 3600000001 at 1.2; editing the issue reference
   to 0.9 leaves saved history unchanged. Period-end 1.3 posts exactly 300000000
   and its paired mirror. Depreciation posts 1000000000 from 3000000001 / 3;
   recurring JPY tags retain 3000000001 at identity FX. Saved KWD-tagged manual
   3000000001 at 1.234567 reverses without applying FX again.

   Actual bookkeeping, journal recurrence and FX run concurrently on that tenant,
   followed by auto-reversal. Independent SQL-text literal totals verify all seven
   journal sources, unique numbers and balanced entries. Original recognition and
   manual legs remain unchanged SQL JSON text; paired FX AR net is zero. Actual
   bookkeeping produces one in-app bank alert with -30000000.01 balance and
   -30000000.00 threshold. No email preference exists, so no provider runs.
   Every entry is read through REST fixed-two and MCP numeric-minor envelopes.
   All workers/read transports repeat with unchanged complete financial snapshots.

   Shared period locks block bookkeeping/revaluation/reversal with unchanged
   financial state. Corrupt saved asset book value and invoice due reject without
   writes and succeed after fixture repair. The joint domain suite independently
   extends four-scale/low-digit/final-remainder, scope/role, replay/concurrency,
   historical FX, locked/closed period and injected fault/rollback coverage.
3. Updated MONEY_MANIFEST, TEST_MATRIX and lib/money/README with current parent
   acceptance and retained MON-008 boundary. Regenerated MONEY_BOUNDARIES adds
   only the two test paths and one fixture consumer/hash/occurrences; 415 schema
   columns remain unchanged. Existing exact background source/static and legacy
   money gates pass. MON-008 task and criteria are untouched and independently open.

## Verification

All commands ran in D:/Projects/dubbl. Dedicated synthetic trust-authenticated
PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon159-pg-3a17838859e543159c5f68302c8e39d6.
Loopback 127.0.0.1:55482, synthetic dubbl_ci role, UTC, jit=off,
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL and PG_BIN; wrappers
create/migrate/drop randomized databases. Application .env/DB was not accessed.

| Command / procedure | Actual result | Limits |
|---|---|---|
| node --import tsx --test --test-concurrency=2 with the 21 files listed below | Exit 0, 21/21, 143.944 seconds | Focused combined domain/worker acceptance, not entire integration suite |
| pnpm test | Exit 0, 536/536, 28.000 seconds | Full pure/static suite |
| pnpm typecheck | Exit 0 | fumadocs-mdx and tsc only; no full build |
| pnpm exec eslint tests/integration/background-cutover-acceptance.test.ts tests/integration/background-cutover-acceptance-worker.ts | Exit 0, no output | Both task-owned TypeScript files |
| pnpm lint | Exit 0, 0 errors/90 unchanged-file warnings | New files lint clean |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0, 415 columns/2093 scanned files/1572 consumers/30721 occurrences | Lexical ownership/hash gate, not transitive dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, 415 columns/1572 hashes and all occurrence/source lines verified | Actual schema/source consistency |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Existing guard |
| Local link check across new parent mapping, both child mappings, manifest and money README | Exit 0, 239 local links, zero missing | Path existence only |
| python .agentic/agent.py validate | Exit 0, 218 tasks | Controller structure, not financial proof |
| git diff --check | Exit 0 | Whitespace; LF/CRLF notices only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before delivery | Actual entry remote synchronization |
| psql fixture database count; pg_ctl -m fast -w stop | Zero remaining fixture databases, exit 0 cluster shutdown | Temporary synthetic cluster/logs retained |

The integration runner used these explicit tests/integration/*.test.ts basenames:
background-cutover-acceptance, background-bookkeeping, fx-revaluation,
recurring-journal-wire, recurring-invoices, recurring-payables, payroll-integration,
accrual-schedules, scheduled-payments, report-schedules, budget-alerts,
inventory-integration, payment-settlements, bank-accounts, bank-rules,
asset-depreciation, loans, revenue-schedules, journal-lifecycle-wire,
asset-loan-integration and journal-integration.

Initial new fixture attempts failed because recurring-journal line descriptions
were missing and the expected manual source type was "manual" rather than the
actual null. Corrected fixture payload/expectations, then the final joint 21-file
run passed. No runtime defect was found. The first inventory drift check detected
the two new test paths/one consumer; inspected the generated delta before refresh.
These initial failures are not reported as passed checks. An early path probe
used a nonexistent registries/TEST_MATRIX path; actual docs/TEST_MATRIX was read
and updated. Temporary logs contain synthetic data only.

## Review and handoff

Honest self-review is MON-159-review-1.md. No scoped blocker remains. Complete the
controller check/submit/self-review/done workflow, commit only owned files, push
authorized origin/master, verify actual remote SHA and clean tree, report live
next task, then stop. Commit/push results are recorded by Git and the final reply;
no future SHA or remote result is invented in this evidence.

No full build, dev server, application database mutation, Trigger run/deployment,
external provider call, Docker, hosted CI, browser/printer or peer/human/accounting
review occurred. Existing FX later-settlement/immutable payable evidence and
safe-final-value limits remain; external email exactly-once, production IRR,
full-int64 business posting and PostgreSQL 16 hosted qualification are not claimed.
MON-008 retains independent final acceptance.
