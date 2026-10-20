# LOC-080 attempt 1 - employee list and creation catalogs

## Identity and scope

2026-10-20 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `5e7359f64e3457728f5e7f1fac07f4ac1f90867f`; clean entry tree.
Fetched origin/master and confirmed zero ahead/zero behind. Live controller
validate/status/next selected LOC-080. Started and completed only this bounded
LOC-067 child under the user's completion/push authorization. No subagents.

Read repository/.agentic instructions, controller, project/map/frontend guidance,
source locale/configuration sections, dependency/parent scope, message registry,
production list/drawer/reader/money source and payroll REST/MCP/SQL fixture.
The memory controller-task skill supplied workflow guidance; current repository
and controller state governed task selection and scope.

## Acceptance mapping

1. Extracted all authored employee list and EmployeeDrawer display into 46 paired
   `PayrollEmployees` messages, with 7,100 compatible keys per locale. Shared
   cancellation remains in DocumentForms. Added translated accessible names for
   clear-search/sort controls. [Scope registry](../registries/PAYROLL_EMPLOYEE_CATALOGS.md)
   records exact examples, decorative initials, technical values and shared
   ownership exceptions. Persian values contain actual Persian script.
2. Reused strict overview list validation and added checked create/navigation
   responses. HTTP/JSON/envelope/field/money/storage/network errors produce
   finite localized feedback. Missing organization releases loading/saving;
   failed creation retains fields and never closes/navigates. Latest-request
   and cleanup guards prevent stale responses from replacing verified rows.
   Tests render production JSX and exercise actual callbacks in both locales.
   Migrated PostgreSQL fixtures check real authenticated REST, linked registered
   MCP and independent SQL with the creation reader. Salary cents, canonical
   Minor aliases, tax basis points, Gregorian dates, optional nulls, identifier
   values, headers, methods and navigation remain unchanged.
3. Updated scope registry, catalog index and task handoff; honest self-review
   records the limits below. LOC-067/008/002 acceptance and native terminology,
   complete RTL/date/numeral/browser/output/release qualification remain separate.

Changes are limited to the employee page, EmployeeDrawer and one helper import
in its shared file, a creation reader, catalogs, focused tests, payroll-master
fixture assertions, the payroll UI source guard, owned registries and selected
task/evidence. A source
comparison against HEAD confirms the entire shared drawer file outside
EmployeeDrawer and its new import is unchanged. Money inventory regeneration
changes only scanned paths, owned consumer hashes/occurrences and the new test;
all schema-column classifications and existing contracts remain unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Focused employee catalog/render/callback and payroll UI guard tests | 16/16 pass, no skips; 3.476 seconds | SSR with controlled hooks/IO and portal/date/currency-picker boundaries |
| Full unit/static suite, concurrency 4 | 1,150/1,150 pass, no skips; 149.260 seconds | Unit/static/callback scope |
| Migrated payroll-master REST/MCP/SQL fixture | 1/1 pass, no skips; 14.099 seconds | Synthetic local PostgreSQL 18 |
| pnpm typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit; no full build |
| pnpm i18n:check | Exit 0; 7,100 keys per locale | No native linguistic approval |
| Owned-file ESLint | Exit 0; zero errors/warnings | Page, shared drawer, helper, focused test, fixture worker |
| Full pnpm lint | Exit 0; zero errors, 59 existing warnings | No owned warnings |
| Money inventory generation/check/source verifier | Exit 0; 417 columns, 2,380 scanned files, 1,771 consumers | Conservative lexical inventory |
| Legacy money guard | Exit 0; nine checks passed | Existing regression scope |
| Controller validation / git diff --check | Pass | Repeated at completion |
| Owned Markdown links | 87 local paths exist | Task, registry/index, attempt and review |

```text
node --import tsx --test tests/payroll-employee-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-master.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/employees/page.tsx" components/dashboard/create-drawer.tsx i18n/payroll-employee-presentation.ts tests/payroll-employee-catalogs.test.ts tests/integration/payroll-master-worker.ts
node node_modules/eslint/bin/eslint.js tests/payroll-ui-money.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Integration used a fresh OS-temp PostgreSQL 18 cluster bound to 127.0.0.1:6440,
process-scoped TEST_DATABASE_URL/PG_BIN, local trust and
max_locks_per_transaction=256. The fixture migrated/dropped its random database;
admin SQL confirmed zero remaining dubbl_ci_* databases. pg_ctl stopped the
cluster in finally; stopped logs/artifacts remain in OS temp. No application DB.

Focused tests cover every frequency/filter/sort value, ascending/descending
sorting and search behavior, escaped caller values, exact zero/29/max safe
cents in USD/JPY/KWD, nullable historical currency, canonical date/basis points,
finite errors, required-field rejection, failed-create retention, missing org,
storage failure, refetch and suppression of superseded/unmounted responses.
Production input/money functions and footer are reused. Existing PostgreSQL
checks retain tenant/permission, alias/currency, independent SQL, migration,
history/soft deletion, audit and atomic rollback assertions.

Initial focused-test failures came from harness selection of JSX `button`
instead of the production Button component; corrected the harness and removed
an invalid React key-prop read. An initial busy-label prop name was corrected
to the existing creatingLabel before successful static checks. No new runtime
dependency or API/MCP/service/schema change was needed.

The first full suite passed 1,149/1,150 tests; its only failure was the old
payroll UI source guard requiring a direct payrollJson symbol and literal
English employee-success toast. Updated only the employee-page exception and
employee-drawer assertion to require the checked readers, translated toast and
their underlying payrollJson adapters. Other consumers and the Contractor
assertion remain guarded. Focused guard/render tests, changed-test lint and
typecheck were rerun; the full suite was repeated after this correction.

## Review, limits and handoff

See [Codex self-review](LOC-080-review-1.md). This is self-review, not an
independent peer, human, accounting or native linguistic approval. The existing
startDate sort uses employee-number ordering; default pagination, fixed-two
payroll cents, currency fallback, canonical dates and existing UI structure
remain unchanged. These behaviors are documented, not newly qualified.

Persian terminology remains provisional. LOC-081 owns employee detail;
LOC-067/008/002 retain independent acceptance. Mounted browser/keyboard, full
RTL/numeral/calendar, output translation, hosted CI, provider, deployment and
production release are not claimed. No full build, dev server, Docker, provider
request, application DB, deployment or dedicated Stripe work ran.
Finish controller disposition, scoped commit/push, remote SHA/clean-tree checks,
report the next task and stop. Commit/push success is reported only after it occurs.
