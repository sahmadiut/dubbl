# MON-008 attempt 1 - final auxiliary and public consumer acceptance

## Identity and scope

2026-10-16, Asia/Tehran. Operator coding-assistant (Codex), self-review only.
Entry master HEAD `8509df246afccedbf97f67328b1efbc504e6c3f4`, clean working tree.
The user requested completing and pushing the next task. Live controller
validate/status/next selected MON-008 after every child and prerequisite completed;
start claimed this integration parent. Original acceptance criteria stay intact.
No other task was started, completed or delegated.

Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, selected task/context, dependency evidence, requirement sections
database-and-currency-migration and api-backward-compatibility, actual shared
services, REST/MCP registrations, UI adapters and financial fixtures. The memory
Dubbl controller-task skill guided the one-task workflow; live controller/source
state superseded its older recorded next-task information.

## Acceptance mapping

1. [AUXILIARY_PUBLIC_CUTOVER_ACCEPTANCE](../registries/AUXILIARY_PUBLIC_CUTOVER_ACCEPTANCE.md)
   joins every remaining inventory, payroll, asset/loan, budget/project/CRM/accrual,
   report/contact/dashboard, background and public/render/export/provider family
   to actual adopted domain and consumer contracts. Core MON-007 ownership is
   retained. Remaining conservative lexical matches are mapped infrastructure,
   tests, nonmoney or static examples. Reviewed compatibility exceptions remain
   explicit; no saved unit is guessed/rescaled and no historical FX is repriced.
   No unresolved scoped monetary consumer family was identified. Independent
   accounting/production/migration/full-int64/localization/release limits remain.

2. New auxiliary-public-cutover-acceptance test/worker independently composes real
   authenticated REST invoice creation, linked registered MCP recognition and
   actual recurring-journal maintenance with REST/MCP report UI adoption, public
   payment and statement adoption, actual HTML rendering and CSV export in separate
   USD/JPY/KWD/synthetic IRR organizations. Independent literal SQL text verifies
   invoice/AR 4000000003, cost 907 and net 3999999096; every journal balances.
   Literal expected currency-scale digits verify output labels; CSV explicitly
   retains fixed-two 40000000.03 and raw Minor 4000000003 in every currency.
   Email labels require that same validated currency. REST/MCP exports agree.

   A separate locked occurrence consumes its schedule without posting under the
   retained contract. Unlocked generation posts once; repeated worker/read calls
   preserve complete SQL JSON-text financial/template/numbering/audit snapshots.
   Denied MCP, unauthorized REST, hostile organization headers, foreign scoped
   token/render calls, missing tokens and conflicting UI aliases reject.
   Persisted unsafe invoice due rejects public/render output in both transports,
   preserving the complete corrupted snapshot; fixture repair restores the exact
   original response and financial snapshot. Portal view activity and API-key
   usage metadata are intentionally excluded from financial snapshots.

   Joint current child/intermediate/domain regressions extend independent coverage
   to inventory costing/write-down, payroll, assets/loans, budgets/projects/CRM,
   accruals, reports/contacts/dashboard, background bookkeeping/FX/reversal and
   public signing/provider/import/export/backup. Their history, scope, period,
   rounding, replay/concurrency, corruption/range and atomic rollback assertions
   are retained. Completion is based on current composed tests and source review,
   not the children's controller status alone.

3. MONEY_MANIFEST, TEST_MATRIX and lib/money/README point to current final parent
   acceptance and explicitly supersede older pending notes without rewriting
   completed evidence. money_inventory.py now assigns inventory pages/helpers and
   scheduled domain/provider delegates to their completed child families and this
   combined acceptance. Regenerated MONEY_BOUNDARIES contains the new fixture and
   current source hashes. Existing source/behavior and ESLint legacy guards reject
   new deprecated assumptions under reviewed exceptions; inventory/Drizzle gates
   verify actual paths/hashes/column and occurrence consistency. No schema,
   migration, runtime service, API/MCP operation or production flag changed.

## Environment

Dedicated synthetic PostgreSQL 18 cluster at 127.0.0.1:55488:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon008-pg-d17f46a518074463b4455c3b0128c30c.
Role dubbl_ci, trust auth, loopback listener, UTC, jit=off and
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL and matching PG_BIN
select only this cluster. Each wrapper creates/migrates/drops a randomized
disposable database. Application .env/database was not read or mutated.
Temporary logs and cluster files stay outside Git.

All commands below ran in D:/Projects/dubbl. Joint integration command:
`node --import tsx --test --test-concurrency=2`, with these explicit test paths
under tests/integration (each basename has `.test.ts`):

```text
auxiliary-public-cutover-acceptance inventory-detail-ui-money inventory-ui-money
inventory-integration inventory-assembly inventory-valuation
payroll-master payroll-config payroll-time payroll-runs payroll-payments
payroll-compensation payroll-outputs payroll-integration
asset-master asset-depreciation asset-valuation asset-cwip loans asset-loan-integration
budget-project-crm-ui budget-wire budget-report project-crm-pricing project-master
project-billing crm accrual-schedules pricing
report-contact-cutover-acceptance auxiliary-ui-cutover-acceptance
financial-statement-ui contact-statement forecast-fx dashboard-data tax-report
consolidation-report custom-reports bank-analytics
background-cutover-acceptance background-bookkeeping fx-revaluation
recurring-journal-wire recurring-invoices recurring-payables scheduled-payments
report-schedules budget-alerts revenue-schedules payment-settlements bank-accounts bank-rules
public-portal-wire document-rendering generic-import-export backups stripe-contract
opaque-public-integration public-boundaries-integration
```

## Actual verification

| Command/procedure | Result | Limit |
|---|---|---|
| New parent fixture alone | Exit 0, 1/1, 19.400 seconds | Before final explicit CSV/display assertions; final worker is included in joint run |
| Joint integration command above | Exit 0, 64/64, no skips, 975.917 seconds | 59 explicit files, disposable REST/registered MCP/UI/SQL and captured/local adapters; includes final strengthened parent worker |
| pnpm test | Exit 0, 550/550, 55.019 seconds | Full unit/behavior/static suite |
| pnpm typecheck | Exit 0 | fumadocs-mdx plus tsc; no build |
| node node_modules/eslint/bin/eslint.js with both new TypeScript paths | Exit 0, no warnings/errors | Final task-owned TypeScript |
| pnpm lint | Exit 0, zero errors/81 existing warnings | Unchanged files retain warnings; new files lint clean |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0; 415 columns, 2103 scanned files, 1580 consumers, 31012 occurrences | Lexical inventory, not transitive dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, source hashes and occurrence/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine checks | Actual negative/allowance lint regressions |
| Local documentation link check | Exit 0, 271 links/zero missing | Six changed/new mapping, manifest, matrix, README and evidence/review files; existence only |
| python .agentic/agent.py validate; git diff --check | Exit 0, 218 tasks, clean whitespace | Structure/whitespace only; not financial proof |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 ahead/0 behind before delivery | Actual remote synchronization |
| psql fixture count; pg_ctl fast shutdown | Zero fixture databases; exit 0, server stopped | Dedicated synthetic cluster only |

The initial new fixture incorrectly expected locked recurrence to leave its
schedule unchanged; source/domain tests confirm the existing consume-without-
posting policy, so the fixture now verifies that policy explicitly and uses a
separate unlocked occurrence. A second attempt supplied unsupported format=csv
to the strict CSV endpoint; removed the unsupported query, retaining its real
contract. Subsequent focused run passed; final strengthened worker is in the
joint run. These initial failures are not reported as passed checks.
Some discovery probes used nonexistent paths or unsupported PowerShell wildcard
syntax; corrected them without modifying product source. They are not checks.

## Review and delivery

Honest implementing-agent self-review: [MON-008-review-1](MON-008-review-1.md).
No scoped blocker remains. Complete controller check/submit/self-review/done,
stage only owned files, commit/push authorized origin/master, verify remote SHA
and clean tree, report the live next task and stop. Actual delivery SHA belongs
to Git/final response; no future commit/push result is invented here.

No full build, dev server, Docker, browser/screenshot/printer, live external
provider, Trigger deployment, hosted CI, production or independent peer/human
review occurred. Local PostgreSQL 18 does not qualify hosted PostgreSQL 16.
Existing accounting defects (PAR-008/QA-001), historical remediation, migration/
rollback, production IRR, full-int64 business expansion, localization/RTL and
financial/security/release qualification remain separate.
