# LOC-105 attempt 1

## Identity and scope

2026-10-22 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Entry HEAD 705767f7,
clean tree. Live controller validate/status/next selected LOC-105, started with
owner codex. A fresh origin/master fetch confirmed zero ahead/behind at entry.
The user authorized completion and push of exactly one bounded task. No
subagents used. LOC-070/008/002 remain separate integration parents.

Read root instructions, START_HERE, project/repository map, frontend/controller
guidance, task/parent and dependency handoff/evidence, catalog registries and
source localization sections. Inspected the actual pages, exact-money readers,
REST cumulative/cash-flow handlers and registered MCP report tools. The memory
workflow was checked against current source/controller instructions.

## Acceptance mapping

1. Added 49 paired BalanceCashReports messages covering authored copy in balance
   sheet, comparative balance sheet and cash flow. Includes complete totals,
   empty states, comparison/date wording, period count/accessibility, section
   help, Current heading and safe failures. Existing namespaces compare equal
   to HEAD after JSON parsing. Every new Persian value passes a script assertion.
   [Scope registry](../registries/BALANCE_CASH_REPORT_CATALOGS.md) explicitly
   records data/date/export/shared-control/output exceptions.
2. Five new tests render production JSX with real next-intl/PresentationProvider
   and shared UI, controlling page hooks/IO and animation. Both locales cover
   exact low digits/currency scale, safe caller text, comparison signs, PDF/CSV/
   ledger contracts, callbacks, loading/empty/error, invalid reads and cleanup.
   Three existing migrated PostgreSQL suites verify real REST, registered MCP
   and SQL contracts. Static/catalog/money/controller checks pass below.
3. Task handoff, registries, this evidence and honest self-review retain
   provisional Persian wording, independent parent/native/RTL/output acceptance
   and the next bounded slice. No parent criterion is checked or completed.

## Implementation and preserved contracts

The three pages obtain display copy from the paired namespace. Cash-flow
sections use stable operating/investing/financing React keys. Complete messages
replace lowercased/concatenated section totals and empty sentences. Comparative
period options retain values 2/3/4/6 and now have a translated accessible name.
The visible Current heading is translated; statementComparisonPeriods and
CurrentMinor/prior-month CSV keys are unchanged. Prior month/year labels retain
their existing English UTC formatter as an explicit date-presentation exception.

Read failures store boolean state and render a finite localized generic message.
Raw network prose and English invalid-amount diagnostics cannot leak into page
copy. Existing readers still validate full report aliases/totals before adoption;
effects retain cleanup guards and missing-active-org early-return/loading behavior.

Gregorian date/count queries, organization header, ledger links, exact bigint
adoption/display, CSV section values/columns/filename/Minor strings and PDF URLs
remain unchanged. Existing balance_sheet, cash_flow_statement and export tools
retain AuthContext/wrapTool and direct DB services; no new operation is added.
No REST/MCP/schema/service/auth/DB/migration/ledger/money/FX/currency/IRR flag or
Stripe implementation changed. The regenerated money inventory changes only
the six owned source/catalog/test consumers plus scan membership; all other
metadata/classifications compare equal to HEAD.

## Actual verification

All commands ran at repository root. No full build or dev server was run.

| Command / procedure | Actual result |
|---|---|
| node --import tsx --test tests/balance-cash-report-catalogs.test.ts | 5/5 pass, zero skips; 10.342 seconds |
| node --import tsx --test --test-concurrency=1 tests/balance-cash-report-catalogs.test.ts tests/income-report-catalogs.test.ts tests/report-directory-catalogs.test.ts tests/financial-statement-ui.test.ts tests/ledger-aging-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 50/50 pass, zero skips; 27.294 seconds |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/financial-statement-ui.test.ts tests/integration/ledger-aging-ui.test.ts tests/integration/cash-flow.test.ts | 3/3 pass, zero skips; 41.448 seconds |
| pnpm typecheck | Pass; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass; 8,942 compatible keys per locale |
| pnpm exec eslint on three owned pages and new test | Pass; no findings |
| pnpm lint | Pass; zero errors, 24 pre-existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns, 2,432 scanned files, 1,823 consumer hashes/lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Structured before/after catalog and inventory comparison | Existing namespaces and inventory schema/classification metadata unchanged; 49 new paired keys; six changed consumers all task-owned |
| python .agentic/agent.py validate; git diff --check | Pass; 347 structurally valid tasks |

PostgreSQL 18 used a unique OS-temp cluster on 127.0.0.1:6485, trust auth and
max_locks_per_transaction=256. Tests migrated randomly named dubbl_ci_* databases
and dropped them. Final admin query found zero fixture databases; pg_ctl stopped
the cluster. No application environment/database credentials were used.

An initial Windows shell pipeline replaced non-ASCII catalog text with question
marks. Explicit UTF-8 patch writes restored the Persian strings and two English
em dashes before verification. Script assertions, existing-catalog comparison,
real bilingual rendering and i18n validation pass on the final files. No
unresolved test failure remains.

## Review and handoff

See [honest Codex self-review](LOC-105-review-1.md). Persian wording remains
provisional. Native terminology, full RTL/calendar/numerals, mounted browser
keyboard/layout, adjacent PDF/XLSX output, full unit/integration suites, hosted
CI, deployment and production qualification are not claimed. No human gate is
waived. Next is LOC-106 trial balance and general ledger catalogs. Commit/push,
remote SHA and clean-tree confirmation are reported after controller closure.
