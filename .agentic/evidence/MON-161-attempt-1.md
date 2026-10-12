# MON-161 attempt 1 - cumulative and period financial statement UI money

## Identity and scope

2026-10-13, Asia/Tehran. Operator/reviewer: codex, self-review only.
Entry master HEAD a17e79c68635817f51d7e8d4ba49a88c653c8fe2, clean tree.
User authorized completing and pushing the next task. Live controller selected
MON-158. Actual report/contact/widget source showed distinct contracts; created
MON-161/162/163 with original MON-007 prerequisite and source anchors, validated
and split MON-158 using the controller. MON-161 is the bounded financial-statement
slice within that selected task. MON-158 retains original acceptance and waits
for all three children; MON-008 remains independent integration. Task index and
source coverage document the split. No automatic delegation or human review.

Read root AGENTS, START_HERE, project/repository map, backend role, controller,
task/dependency evidence, money manifest/boundaries and actual cumulative/period
wire/service, REST handlers, MCP registration and report consumers. Used the
memory Dubbl controller-task skill for the scoped execution/push workflow.
Source requirements: api-backward-compatibility and database-and-currency-migration.

## Implementation and acceptance mapping

1. `lib/money/financial-statement-ui.ts` validates required canonical Minor strings
   against fixed-two REST decimals or safe numeric-minor fields before bigint
   adoption. Cumulative split/row/section/primary/comparison dimensions and period
   sums/net income/changes validate. Explicit canonical report currency determines
   display scale; fixed-two aliases remain raw saved units independently of ISO
   scale. No inferred currency, FX, history rescaling or repaired unsafe Number.
   Six pages adopt it: trial-balance, balance-sheet, comparative-balance-sheet,
   income-statement, profit-and-loss and pnl-comparison. Totals/differences use
   bigint. CSV uses explicit currency and canonical Minor text. Chart coordinates
   alone are approximate; tooltips display original integers. Failed HTTP/JSON or
   malformed money replaces rows/exports with English ErrorState and reload.

   Comparative balance sheet now reads all columns from the existing single
   repeatable-read comparison endpoint; it no longer stitches independent
   requests. UTC cutoffs include each preceding month end and year/leap-day
   rollover. Account IDs preserve identity including synthetic blank-code earnings.
   Existing English titles, filters, basis, count/year inputs, horizontally
   scrollable tables and source accessibility remain. No live browser claim.

2. Nine unit/source behavior groups cover safe-edge low digits in four currency
   scales, negative subunits, totals beyond safe Number, corrupted/missing aliases,
   invalid currency, inconsistent sums/columns/deltas, CSV, chart source integers,
   failed HTTP/JSON and UTC dates. New disposable integration independently seeds
   posted journals and composes all five real authenticated REST and linked SDK
   registered MCP operations through the exact browser adapters in USD/JPY/KWD/
   synthetic IRR report contexts. Literal SQL text independently verifies
   9007199253000001 revenue; prior revenue is 1000001 and expense 901. Assertions
   retain net income 9007199252999100, cash/earnings 9007199253999101,
   comparative change 9007199252999100, revenue period delta 9007199252000000 and
   trial debit sum 18014398508000004. SQL journal/account/audit text snapshots stay
   unchanged across reads, malformed DTO adoption and auth failures. Foreign
   account/entry contamination is excluded; denied MCP reads and invalid REST
   authorization fail. Additional persisted 2000000 causes all five REST/MCP
   reports to reject overflow, REST 422 LEGACY_NUMERIC_RANGE; failures do not
   mutate financial history. Removing that fixture restores the initial snapshot.

   Existing cumulative, period and combined financial-report fixtures passed,
   independently retaining tenant/role/query/history/dimension/basis/export units.
   No duplicate feature tools were needed: existing direct-DB org-scoped report
   registrations and their shared services remain the public operations.

3. FINANCIAL_STATEMENT_UI_CUTOVER maps consumers, saved units, reviewed numeric
   exceptions, failures, regressions and remaining owners. Manifest, TEST_MATRIX,
   money README and generator classify the seven owned runtime files. Regenerated
   MONEY_BOUNDARIES retains source hashes/occurrences and explicit MON-161 owner.
   Removed four existing legacy-helper allowances; the other two pages had none.
   Scoped source guards and money/static checks pass. MON-158/MON-008 original
   criteria stay open, and MON-162/163 are unstarted.

## Verification and database

All commands ran in D:/Projects/dubbl, Node 23.11.0, installed pnpm dependencies.
Dedicated synthetic PostgreSQL 18 trust-auth cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon161-pg-3a14280fb3e74fbc9ed77d46d4ffeef5,
127.0.0.1:1965, dubbl_ci role, UTC, max_locks_per_transaction=256, jit=off.
Explicit TEST_DATABASE_URL and PG_BIN target only this cluster. Each wrapper
creates, migrates and drops its own random fixture DB. Final fixture DB count
is zero; pg_ctl fast stop passed. Cluster files remain in the temporary folder.
No application .env/database, build/dev server, Docker, provider or production action.

| Command / procedure | Actual result | Limitation |
|---|---|---|
| node --import tsx --test tests/financial-statement-ui.test.ts | Exit 0, 9/9 | Behavioral adapters/source guards; no live browser |
| pnpm test | Exit 0, 512/512 | Pure unit/behavior tests, distinct from DB acceptance |
| node --import tsx --test --test-concurrency=2 tests/integration/financial-statement-ui.test.ts tests/integration/cumulative-statement.test.ts tests/integration/period-statement.test.ts tests/integration/financial-report-integration.test.ts | Three existing suites passed; initial combined exit 1 | New fixture omitted required journal description; corrected, not an application regression |
| node --import tsx --test tests/integration/financial-statement-ui.test.ts | Final exit 0, 1/1, four currencies/five operations | Rerun after adding required description; 12.8 seconds |
| pnpm typecheck | Final exit 0 | Earlier new-fixture type error found missing description, corrected before final check |
| pnpm exec eslint on six pages, adapter and three new test files | Final exit 0, zero warnings/errors | Removed three obsolete owned suppression comments |
| pnpm lint | Exit 0, zero errors/92 warnings | Warnings outside owned runtime/test files; no broad cleanup |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0 | 415 columns, 2075 scanned paths, 1559 consumers, 30299 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, LF hashes and all occurrence/source lines |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regressions | New legacy money usage remains forbidden |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural/integrity checks, not production qualification |

## Review and remaining boundaries

Self-review in MON-161-review-1.md. Known natural-sign trial-balance accounting
defect remains PAR-008/QA-001: natural-positive revenue/liability appear in debit.
Current-base/raw-history report conventions remain unchanged. No full-int64,
production IRR, general XLSX precision, native Persian wording or live browser
qualification. Other reports are MON-162; contacts/dashboard/shared display are
MON-163. Public/provider/export rendering remains MON-160. MON-158/MON-008 need
their own independent acceptance. User-authorized scoped commit/push follows
controller checks, submit, honest self-review and done.
