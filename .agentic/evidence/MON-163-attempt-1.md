# MON-163 attempt 1 - contact dashboard shared money display

## Identity

2026-10-14; implementing coding-assistant; D:/Projects/dubbl, master.
Entry HEAD 2b792e4e2c40283b006bbf989dafbef431a1bdaa; clean entry tree.
One controller-selected bounded task, started after validate/status/next.
No subagents, independent reviewer or human approval was claimed. No unrelated
edits were present or included. Delivery commit is recorded by Git after this
immutable evidence is written.

## Implementation and acceptance mapping

1. Added lib/money/contact-dashboard-ui.ts and adopted it throughout contact
   list/layout/detail/bookkeeping/activity/customer-statement screens, dashboard
   nonjournal widgets and cash-flow-widget. Required numeric aliases agree with
   canonical Minor strings before bigint adoption. Nullable/nonnegative credit
   limits round-trip USD/JPY/KWD/synthetic IRR scales and submit creditLimitMinor.
   Activity currencies remain per-row; statements reconcile signed movement,
   opening/closing and debit/credit sums; forecasts reconcile weekly net,
   cumulative and total amounts. Statement/forecast currency selectors thread
   existing filters; print/email use the same selected statement currency.
   Statement cancellation prevents stale response adoption, and invalid data
   disables output. Errors clear financial rows or suppress the dashboard.
   PnL and aging reuse previously verified statement/aging adapters; budget
   amounts preserve their fixed-two cents exception. Budget 90 percent threshold,
   amounts and sorting use bigint. Trend aliases validate before numeric chart
   geometry. Forecast tooltips retain original bigint amounts and explicit
   currency. Shared statement-money helpers accept checked bigint text values;
   numeric XLSX retains decimal-round-trip and 15-significant-digit guards.
   Existing exact CSV/export and bank-total-decimal behavior is reused.
   Core journal dashboard ownership stays MON-007. No REST/MCP backend contract,
   storage, schema, migration, currency enablement or historic data rescaling.

2. Eight meaningful behavior/source tests cover exact scale round-trips,
   safe-max 9007199254740991 low digits, signed movements, alias/currency/running/
   total failures, failed HTTP, original tooltip integers, signed geometry,
   exact CSV and lossy spreadsheet rejection. Five real migrated PostgreSQL
   REST/MCP workers now adopt the UI adapter. Contact-list outstanding and
   forecast totals match independent SQL amount text at 9007199254740991;
   negative statement closing balance matches saved SQL -9007199254740991.
   Actual authenticated REST responses agree with linked SDK registered
   direct-DB MCP tools. Existing tenant/permission/auth/mixed-currency/persisted
   overflow and unchanged SQL financial/audit snapshot assertions pass. Three
   existing UI composition fixtures exercise reused PnL/aging/budget adapters.

3. CONTACT_DASHBOARD_UI_CUTOVER.md maps consumers, backend units and reused
   helpers. MONEY_MANIFEST, TEST_MATRIX and money README are current; generator
   and MONEY_BOUNDARIES map scoped source hashes, lines and ownership. Eight
   obsolete legacy-helper allowances were removed. MON-158/MON-162/MON-008
   independent combined acceptance remains open.

## Verification and environment

Dedicated PostgreSQL 18 trust-auth synthetic cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon163-pg-a28458ff91574da6a13c1ddfc0c5095b,
127.0.0.1:1963, dubbl_ci; max_locks_per_transaction=256, jit=off.
Explicit loopback TEST_DATABASE_URL and PG_BIN were set for integration commands.
Wrappers created, migrated and dropped randomized disposable databases. Final
fixture database count was 0; pg_ctl fast stop passed. Temporary cluster files
remain. Application .env/database was not used. All commands ran at repo root.

| Command/check | Actual result | Limit |
|---|---|---|
| node --import tsx --test tests/contact-dashboard-ui.test.ts | Final exit 0, 8/8 | Includes self-review signed-percentage correction; behavior/source, no browser |
| pnpm test | Exit 0, 535/535 | Full unit/behavior suite before final signed-geometry and error-wording edits; final focused tests passed after those edits |
| node --import tsx --test --test-concurrency=2 tests/integration/contact-wire.test.ts tests/integration/contact-statement.test.ts tests/integration/forecast-fx.test.ts tests/integration/dashboard-data.test.ts tests/integration/kpi-analytics.test.ts | Exit 0, 5/5, no skips | Actual REST/MCP/SQL, dedicated disposable loopback fixtures |
| node --import tsx --test --test-concurrency=2 tests/integration/financial-statement-ui.test.ts tests/integration/ledger-aging-ui.test.ts tests/integration/budget-project-crm-ui.test.ts | Exit 0, 3/3, no skips | Reused dashboard adapters independently exercised |
| pnpm typecheck | Final exit 0 | MDX plus tsc only; final run after all code changes |
| pnpm exec eslint (all 16 changed TS/TSX files) | Exit 0, 0 errors/4 existing warnings | Existing unused total and three widget imports; no new warnings |
| pnpm lint | Exit 0, 0 errors/90 existing warnings | No new scoped warnings; final changed helper/dashboard/statement/test lint rerun exit 0 with no output |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Final exit 0 | 415 columns, 2088 source files, 1569 consumers, 30571 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0 | Drizzle columns, hashes and lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Final exit 0, 9 checks | Existing money lint regression guard |
| New registry relative-link check | Exit 0, all links resolve | Local paths only |
| python .agentic/agent.py validate | Exit 0, 218 tasks | Structure only, repeated after completion |
| git diff --check | Exit 0 | Whitespace only; CRLF conversion notices |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before delivery | Actual synchronization before commit |
| PostgreSQL fixture count; pg_ctl -m fast -w stop | 0 fixture databases; exit 0 | Dedicated synthetic cluster only |

Source discovery included a failed path probe and a patch context mismatch; these
were corrected and are not successful checks. No integration/test failures were
observed. Self-review corrected signed percentage rounding from positive-only
bias to exact signed rounding; final focused tests/typecheck/lint/inventory pass.

## Review and handoff

See MON-163-review-1.md for honest implementing-agent self-review. No scoped
blocker remains. Complete controller check/submit/self-review/done, stage only
listed task-owned changes, commit/push origin/master and verify remote SHA and
clean tree. Report the freshly selected next task and stop.

No full build, dev server, live browser/layout/print qualification, hosted CI,
provider call, email delivery to real people, deployment or production action.
Existing accounting defects, localization/native review, IRR production enablement
and parent integration acceptance remain separate. Local PostgreSQL 18 results
do not establish hosted PostgreSQL 16 or CI qualification.
