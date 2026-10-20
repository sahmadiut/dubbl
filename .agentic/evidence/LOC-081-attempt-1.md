# LOC-081 attempt 1 - employee detail catalogs

## Identity and scope

2026-10-20 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `57628c4615bb43ffe2ec6b14349ce3794ea1ca34`; clean entry tree.
Live controller validate/status/next selected LOC-081. Started exactly this
LOC-067 child. Fetched origin/master and confirmed zero ahead/zero behind.
The user authorized completing and pushing the next task. No subagents.

Read root/.agentic instructions, project/map/frontend/controller guidance,
parent/task/dependency evidence, catalog contract, locale source sections,
production page/money code and actual employee/config/time/compensation
REST/MCP/service/fixture contracts. The memory controller-task skill guided the
workflow; current repository/controller state governed selection and scope.

## Acceptance mapping

1. Extracted all authored employee detail copy into 92 paired
   `PayrollEmployeeDetail` messages; 7,192 compatible keys per locale. The
   [scope inventory](../registries/PAYROLL_EMPLOYEE_DETAIL_CATALOGS.md) records
   technical/shared-data exceptions, fixed-two payroll money and the absence
   of a schedule editor in this route. Persian leaves contain Persian script.
2. Real production JSX renders through next-intl and PresentationProvider in
   both locales. Checked readers validate HTTP/JSON/envelopes, displayed fields,
   enums/dates/counts/hours and exact cents aliases before state adoption.
   Initial HTTP 404 shows the localized not-found state. Corrected the existing
   leave-balance consumer from leaveBalances to the actual REST data envelope.
   Storage/missing-org paths release loading; cleanup suppresses stale reads.
   Profile/tax/delete errors are finite translations, never raw server/parser
   prose. Failed saves retain fields, failed deletes never navigate or toast
   success. Exact cents, basis points, optional nulls, dates and operation
   payload/header/route contracts remain unchanged. Existing registered MCP
   tools and shared services remain authoritative and unchanged.
3. Scope registry, message index and task handoff retain provisional Persian
   terminology and independent LOC-067/008/002 acceptance. Honest self-review
   documents native/RTL/browser/output/release limits below.

Changes are limited to the detail page, its checked reader, paired catalogs,
focused tests, scoped assertions in four existing migrated payroll workers,
the payroll UI source guard, generated money inventory and owned task/docs.
Schema-column classifications and financial calculation/transport/service
implementations are unchanged. No dedicated Stripe work.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Focused detail catalog/render/callback and payroll UI guard suite | 14/14 pass, no skips; 21.517 seconds | SSR, controlled hooks/IO and portal/currency-picker boundaries |
| Owned-file ESLint | Exit 0, zero errors/warnings | Page, reader, focused/guard tests and four workers |
| Catalog validation | Exit 0, 7,192 keys per locale | No native linguistic approval |
| Full unit/static suite, concurrency 2 | 1,159/1,159 pass, no skips; 331.817 seconds | Unit/static/callback scope |
| Migrated payroll master/config/time/compensation fixtures | 5/5 checks pass across initial four successes and corrected time rerun; no skips | Disposable local PostgreSQL 18 |
| Typecheck | Exit 0 on final source | fumadocs-mdx and tsc --noEmit |
| Full lint | Exit 0; zero errors, 59 existing warnings | No owned warnings |
| Money inventory/source and legacy gates | Exit 0; 417 columns, 2,382 paths, 1,773 consumer hashes; nine legacy checks | Conservative source inventory and existing guards |
| Controller validation / diff checks | Pass, repeated at completion | Workflow structure only |
| Owned Markdown links | 89 local paths exist | Task, index, scope, attempt and review |

```text
node --import tsx --test tests/payroll-employee-detail-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-master.test.ts tests/integration/payroll-config.test.ts tests/integration/payroll-time.test.ts tests/integration/payroll-compensation.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-time.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/employees/[id]/page.tsx" i18n/payroll-employee-detail-presentation.ts tests/payroll-employee-detail-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-master-worker.ts tests/integration/payroll-config-worker.ts tests/integration/payroll-time-worker.ts tests/integration/payroll-compensation-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The focused suite covers all compensation/frequency/filing and leave-type
machine values; populated/empty/pending/error/not-found states; escaping;
deduction override/default precedence; cross-currency band display; canonical
disabled dates; max-safe/zero/29 cents and null currency; malformed/missing/
conflicting aliases, unsafe dates/counts/enums; actual profile/tax/delete
callbacks and headers; blank/null fields; failed-save retention; invalid cents
rejected before fetch; delete cancellation/failure; each section read failure;
storage failure and ignored unmounted responses.

The first concurrency-4 full unit run was deliberately stopped during host
resource contention without a completed result; the final full run uses
concurrency 2. Full lint and typecheck were also initially concurrent with
integration, causing slow execution. Only completed final checks are counted.

The database fixtures retain real authenticated REST handlers, linked registered
MCP clients, independent SQL, tenant/permission checks, audits and rollback
assertions. The new reader is applied to employee reads/PATCH and linked MCP
updates; deduction list and tax read/update; leave balances with REST data/MCP
balances envelopes and explicitly adapted flattened policy fields; and compensation-band reads. Tests use synthetic fixtures.

Integration setup uses a new OS-temp PostgreSQL 18 cluster, trust authentication
on 127.0.0.1:6451, process-scoped TEST_DATABASE_URL/PG_BIN and
max_locks_per_transaction=256. Each fixture creates/drops its random database.
Admin SQL confirmed zero remaining dubbl_ci_* databases after both runs.
The cluster was stopped in finally after each run; logs/artifacts remain in OS
temp. No application DB is used.

Initial focused failures exposed test-harness assumptions about Button children
and annual-salary visibility for hourly workers. Corrected those assertions and
trimmed unused copied harness paths; no product behavior was relaxed. The first
expanded typecheck caught the fixture wrapper widening existing response types
and an irrelevant leave comparison in non-leave fixtures. Replaced it with a
generic identity wrapper and operation-specific checks. Inventory drift during
active test edits required final regeneration; no financial classification
changed. The first four migrated checks passed, while the time worker exposed
a test adapter assuming MCP nested policy like REST. The existing MCP
contract flattens policyName/leaveType; corrected only the fixture adapter and
reran that worker on the same isolated test server. Neither transport changed.
Successful reruns are recorded above before controller completion.

## Review and limits

See [Codex self-review](LOC-081-review-1.md). This is self-review, not peer,
human, native linguistic or accounting approval. Existing fixed-two payroll
cents, USD fallback for null historical currency, disabled date fields,
allowance/withholding semantics and range calculations remain unchanged.

Persian terminology is provisional. LOC-067/008/002 retain independent combined
acceptance. Mounted browser/keyboard, complete RTL/numeral/calendar, output
translation, hosted CI, provider, deployment and production release acceptance
are not claimed. No full build, dev server, Docker, external provider request,
application DB, deployment or dedicated Stripe work ran.
Controller disposition, scoped commit/push and remote SHA/clean-tree checks are
performed after all required verification; push success is reported only after
it occurs.
