# LOC-106 attempt 1 - Trial balance and general ledger catalogs

## Identity and scope

2026-10-22, Codex in D:/Projects/dubbl. Entry branch master at bf23b23d,
clean tree; fresh origin/master fetch confirmed zero ahead/behind. Controller
validate/status/next selected LOC-106 and it was started with owner codex.
The user authorized completing and pushing exactly one bounded next task.
No subagents were used. LOC-070/008/002 remain independent integration parents.

Read root instructions, START_HERE, project/repository map, frontend/controller
guidance, selected task/parent/dependency handoffs, catalog registries and source
localization sections. Inspected both production pages, shared type presentation,
financial-statement/ledger readers, REST cumulative/ledger responses and registered
MCP report tools. Memory guidance was checked against current source/instructions.

## Acceptance mapping and implementation

1. Added 39 paired LedgerReports messages for all authored page copy: titles,
   descriptions/help, comparison/date/table labels, complete dimension filters,
   empty states, ICU account/entry counts, expand/collapse, complete amount
   messages, pagination progress/loading and finite failures. Known account types
   reuse Accounts through accountTypeLabel. Existing namespaces are unchanged
   after JSON parsing; all new Persian values pass a script assertion. See
   [ownership and explicit exceptions](../registries/LEDGER_REPORT_CATALOGS.md).
2. Six new tests render production JSX with real next-intl/PresentationProvider
   and shared UI, controlling page hooks/IO and animation. Both locales verify
   exact low digits/currency scale/negative balances, comparison totals, escaped
   caller text, singular/plural counts, type labels, filters, CSV/drilldown
   contracts, callbacks, loading/empty/error, invalid reads, snapshot-checked
   pagination and obsolete-request cleanup. Three existing migrated PostgreSQL
   suites verify actual REST, registered MCP and independent SQL assertions.
3. Task handoff, catalog registry, this evidence and honest self-review retain
   provisional Persian wording and independent parent/native/RTL/output
   qualification. No parent criterion or human gate is checked or waived.

Both pages store boolean failures and display a finite localized generic message.
Arbitrary network prose and English invalid-money/snapshot diagnostics cannot
leak into page copy. Existing readers still validate aliases/totals before state
adoption or append. Cleanup and request-version guards, orgless early return,
loading behavior and full-page retry are preserved.

Gregorian date/dimension/account queries, organization headers, hash anchors,
comparison controls, pagination offset/limit, exact bigint money, natural signs,
running versus opening-inclusive balances and CSV columns/filenames/Minor strings
are unchanged. Existing trial_balance/general_ledger/account_transactions/export
MCP tools retain direct scoped services, AuthContext and wrapTool; no new
operation is added. No REST/MCP/schema/migration/service/auth/ledger/money/FX/
IRR flag or Stripe implementation change is made.

Date formatting remains an explicit exception: trial headings retain canonical
Gregorian values and ledger entries retain the existing English short-month/day
formatter. Unknown trial account types retain escaped caller text. Shared control
catalog ownership and PDF/XLSX output scope remain separate.

## Actual verification

All commands ran at repository root; no full build or dev server was run.

| Command / procedure | Actual result |
|---|---|
| node --import tsx --test tests/ledger-report-catalogs.test.ts | 6/6 pass; final strengthened count/disabled-state assertions pass, zero skips; 6.768 seconds |
| node --import tsx --test --test-concurrency=1 tests/ledger-report-catalogs.test.ts tests/balance-cash-report-catalogs.test.ts tests/income-report-catalogs.test.ts tests/report-directory-catalogs.test.ts tests/financial-statement-ui.test.ts tests/ledger-aging-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 56/56 pass, zero skips; 23.408 seconds |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/financial-statement-ui.test.ts tests/integration/ledger-aging-ui.test.ts tests/integration/ledger-detail.test.ts | 3/3 pass, zero skips; 22.346 seconds |
| pnpm typecheck | Pass, including final test changes; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass; 8,981 compatible keys per locale |
| pnpm exec eslint on two owned pages and new test | Pass; no findings, including final test changes |
| pnpm lint | Pass; zero errors, 24 pre-existing warnings outside owned files |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns, 2,433 scanned files, 1,824 consumer hashes/lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Structured catalog/inventory comparison against HEAD | Existing namespaces and schema/classifications unchanged; 39 added paired keys; five changed consumers all task-owned; scanner metadata exception described below |
| python .agentic/agent.py validate; git diff --check | Pass; 347 structurally valid tasks |

PostgreSQL 18 used a unique OS-temp cluster on 127.0.0.1:6486, trust auth and
max_locks_per_transaction=256. Fixtures migrated randomly named dubbl_ci_*
databases and dropped them. Final admin query found zero fixture databases and
pg_ctl stopped the cluster. No application environment/database credentials were
used. No schema or migration file changed.

An initial inventory comparison assumed all consumer metadata would be identical.
Inspection showed moving the English project label into a catalog removes the
scanner's lexical project table/currency annotation from the ledger page. The
corrected structured comparison permits exactly this expected annotation change,
five owned consumer hashes/occurrences and new test scan membership; all other
metadata/classifications compare equal. Actual ledger currency still comes from
the unchanged organization-base service/DTO. No product check failed.

## Review and handoff

See [honest Codex self-review](LOC-106-review-1.md). Persian wording is provisional.
Native terminology, full RTL/calendar/numerals, mounted browser keyboard/layout,
adjacent PDF/XLSX outputs, full test suites, hosted CI, deployment and production
qualification are not claimed. No human gate is waived. Next bounded task is
LOC-107. Commit/push SHA and clean-tree confirmation are reported after controller
closure; this evidence describes the verified uncommitted task changes.
