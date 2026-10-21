# LOC-104 attempt 1

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Entry HEAD ceb9b4e4,
clean tree. Live controller validate/status/next selected LOC-104, started with
owner codex. Exactly this child of LOC-070 is completed. No subagents used.
The user requested completion and push. A fresh origin/master fetch confirmed
two pre-existing local commits ahead, zero behind: f6ebbc30 (local IRR testing
and qualification planning) and ceb9b4e4 (Persian currency units). Both remain
intact and are included in the branch push, separately from this task commit.

Read root/.agentic rules, controller/frontend/project/map guidance, task and
parent scope, source localization sections, dependency evidence, catalog/report
registries, actual JSX/readers, REST handlers and registered MCP report tools.
Memory skill workflow was checked against current instructions/controller state.

## Acceptance mapping

1. Added 38 paired IncomeReports messages covering all authored copy on profit
   and loss, income statement and executive summary. Includes complete total
   labels, year accessibility, seven finite KPI labels, period/percentage copy,
   empty states and safe errors. Existing messages compare equal to HEAD.
   [Scope registry](../registries/INCOME_REPORT_CATALOGS.md) records data,
   formatting, CSV, shared-control and adjacent-output exceptions explicitly.
2. Five new production JSX tests render real next-intl/PresentationProvider
   and shared UI in both locales with controlled page hooks/IO and animation.
   They verify exact money, escaped caller data, known/unknown KPI labels,
   prior dates and signed percentages, export contracts, callbacks, failed
   reads and obsolete-request cleanup. Existing financial statement and combined
   report/dashboard REST/linked MCP/SQL fixtures passed on disposable PostgreSQL.
3. Task handoff, this evidence, self-review and registries retain provisional
   Persian wording and separate LOC-105..114 and LOC-070/008/002/native/RTL/output
   acceptance. No parent criterion is checked or parent state completed.

## Implementation and preserved contracts

Only the three page components, paired catalogs, test, task/evidence and related
registries change. Each page stores a finite boolean error and renders the
localized load-failure message. Raw network errors and fixed English invalid-
amount diagnostics no longer leak through these pages; validated readers retain
their existing rejection behavior. Income totals use complete messages and
stable revenue/expenses React keys. Executive labels translate only own known
keys, retaining escaped unknown data such as toString; dates and percentage
values remain canonical formatting inputs rather than translated machine data.

Routes, Gregorian date/year and cash/accrual query values, organization header,
exact bigint adoption/formatting, CSV section names/columns/filename/Minor strings
and PDF URLs remain unchanged. No new operation requires an MCP tool; existing
profit_and_loss, income_statement, executive_summary and export tools remain
scoped through AuthContext/wrapTool. No service/wire/auth/DB/schema/migration,
money/FX/ledger, currency/IRR flags or Stripe source changed.

## Actual verification

All commands ran from repository root. No full build or dev server was run.

| Command / procedure | Result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/income-report-catalogs.test.ts tests/report-directory-catalogs.test.ts tests/financial-statement-ui.test.ts tests/analytical-report-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 45/45 pass, zero skips; 20.370 seconds |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/financial-statement-ui.test.ts tests/integration/report-dashboard-integration.test.ts | 2/2 pass, zero skips; 40.949 seconds |
| pnpm typecheck | Pass; fumadocs-mdx and tsc --noEmit; final repeat after harness imports also passed |
| pnpm i18n:check | Pass; 8,893 compatible leaves per locale |
| pnpm exec eslint on the three owned pages and new test | Pass; no findings |
| pnpm lint | Pass; zero errors, 24 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns, 2,431 scanned files, 1,822 consumer hashes/lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Structured before/after catalog and money-inventory comparison | Existing namespaces unchanged; 38 added messages per locale; schema metadata unchanged, six changed consumer paths all task-owned |
| python .agentic/agent.py validate; git diff --check | Pass; 347 structurally valid tasks |

PostgreSQL 18 used a uniquely named OS-temp cluster, 127.0.0.1:6484, trust auth
and max_locks_per_transaction=256. Tests migrated randomized dubbl_ci_* databases
and dropped them. Final admin query found zero remaining fixture databases;
pg_ctl stopped the cluster. No application environment/database credentials used.

The first new test run exposed a test-loader ESM/CommonJS next-intl context
split in nested shared UI. Static ESM imports of those real shared components
fixed the harness; no UI stubs or production workaround was added. Final focused
rendering/read/callback/catalog command passes all 45 checks. No unresolved
test failure remains.

## Review and handoff

See [honest Codex self-review](LOC-104-review-1.md). Existing missing-active-org
early-return/loading behavior is retained and recorded; selection/loading changes
are outside this extraction. English authored copy is preserved except safe
generic translated feedback replacing arbitrary failure diagnostics. Persian
terminology is provisional. Native/full RTL/calendar/numerals, mounted browser,
keyboard/layout, adjacent PDF/XLSX output, full unit/integration suite, hosted CI,
providers, deployment and production qualification are not claimed.

Next controller task is LOC-105 (balance sheet, comparative balance sheet and
cash flow). LOC-070/008/002 retain independent combined acceptance. Commit/push,
remote SHA parity and clean-tree confirmation are reported after closure.
