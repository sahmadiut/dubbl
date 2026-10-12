# MON-153 attempt 1 - inventory detail/write-down UI money

## Identity and selection

2026-10-12, Asia/Tehran; coding-assistant (Codex), self-review only.
Entry master HEAD 28f0efc280cced3e3bcb4476910a8b1630c0ca8f, clean tree.
User authorized completing and pushing the next task. Live controller validate,
status and next selected MON-008 after completed MON-007. Read root/nested
instructions, START_HERE/project/repository map/controller/backend role, original
criteria, MON-007 evidence, money manifest and inventory master/movement contracts.
Used the memory Dubbl controller-task skill for one-task delivery discipline.

Source showed unfinished inventory write-down float parsing, payroll salary/forecast
floats and remaining auxiliary inventory/budget/report/dashboard/public consumers.
MON-008 exceeded one coherent change. Added source-bounded MON-153..160 with the
original MON-007 prerequisite, updated index/coverage and parent handoff, validated,
and used controller split. Original MON-008 acceptance is preserved; it remains
open for independent combined acceptance. Controller next selected MON-153 and
start claimed this one bounded child. No other child is implemented or completed.

## Implementation and acceptance mapping

1. lib/money/inventory-detail-ui.ts validates mandatory safe numeric and canonical
   agreeing purchasePrice/salePrice/totalValue/priceValue Minor aliases, nonnegative
   purchase/sale/carrying money and canonical int32 physical counts. priceValue must
   equal quantity x purchase price. Products, profit subtraction and one-decimal
   margin use bigint; margin has explicit half-away-from-zero rational rounding.
   Carrying value never falls back to a catalog product. The item layout header,
   stock-price value, prices, per-unit profit and write-down sheet adopt the adapter.
   Exact retained decimal text with at most two places produces valueDeltaMinor;
   positive/safe-range/sub-cent/excessive validation drives both preview and submit.
   Remaining book value is visible before save. Invalid data exposes an alert and
   suppresses money/actions. Org/item-keyed workspace, aborted superseded reads,
   verified mutation adoption, active-org recheck, save disable, reason validation
   and close/success clearing preserve scoped state. Failure preserves input.
   Labels/decimal keyboard/error announcements and large monetary wrapping were
   source-reviewed under DEC-005; no live-browser effects are claimed.

   Explicit exception: legacy catalog/item API inputs and USD/two-decimal display
   remain cents in every organization. Existing base-currency GL tags/raw amounts
   are preserved in JPY/KWD fixtures; no currency-based reinterpretation occurs.
   Physical counts and reorder progress are nonmoney, including inherited count
   input parseInt (remaining count-form policy belongs to MON-154). Average-cost
   only value adjustment, permission, period and concurrent current-state guards
   stay in the existing shared service. No schema/API/MCP/production-flag change.

2. tests/inventory-detail-ui-money.test.ts adds four meaningful financial/static
   groups: distinct book/price values, one-minor profit at 3000000001 purchase
   price, maximum-safe low digits, signed margin ties, missing/conflicting/unsafe
   aliases, count/product validation, zero/full write-down, grammar/range/sub-cent
   and excessive rejection. A scoped source guard rejects parseFloat, Math.round,
   toFixed, CurrencyInput and numeric write-down payload regressions in this page.

   tests/integration/inventory-detail-ui-money.test.ts and worker run real API-key
   REST handlers and linked registered MCP tools in six USD/JPY/KWD workflows,
   with both transport origins. Open 3 stock units at 3000000001 cents, write down
   3000000001 cents from exact major text 30000000.01, compare both transport reads
   through the actual UI adapter and literal SQL text: carrying 6000000002,
   purchase 3000000001, average 2000000001, count 3, unchanged catalog price value
   9000000003. Literal two journal legs contain 3000000001 in org base currency.
   Excessive and conflicting-alias writes reject with unchanged snapshots of item,
   movement, layer/consumption, account, journal/legs and audit tables. Opposite
   transport exhausts book value to zero while price value stays unchanged. Every
   posted journal balances. Existing master/movement/valuation regressions retain
   tenant/role/period/FIFO/layer/atomicity and monetary-range coverage.

3. INVENTORY_DETAIL_UI_CUTOVER maps every owned component/adapter/fixture, exact
   units and reviewed exceptions to MONEY_MANIFEST/MONEY_BOUNDARIES and existing
   inventory contracts. TEST_MATRIX, TASK_INDEX and PLAN_COVERAGE record new scope.
   Regenerated inventory and source/Drizzle guard verify current hashes/lines.
   Legacy-money ESLint guard remains, with all nine negative regression checks.
   MON-154 owns other inventory consumers; MON-155..160 own other families;
   MON-008 retains independent combined acceptance and broad static-guard closure.

## Actual verification

All commands in D:/Projects/dubbl. Dedicated synthetic PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon153-pg-aa447abd00534bd59ca0d02bead0da82,
loopback 127.0.0.1:55458, synthetic dubbl_ci role, UTC, jit=off and
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL and PG_BIN point only
to it. Wrappers migrate/drop randomized disposable databases. Fixture database
count was zero; pg_ctl fast shutdown exited 0. Cluster files remain. No .env or
application DB, dev server, full build, Docker, deployment or provider calls.

| Command/procedure | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/inventory-detail-ui-money.test.ts | Exit 0, 4/4 initially and final | Final negative-zero count check included |
| node --import tsx --test --test-concurrency=2 tests/integration/inventory-detail-ui-money.test.ts tests/integration/inventory-movements.test.ts tests/integration/inventory-master.test.ts tests/integration/inventory-valuation.test.ts | Exit 0, 5/5, 36.991 seconds | New 6 workflows plus all three financial regressions, valuation has two tests |
| pnpm test | Exit 0, 478/478 | Full pure/static suite; final small self-review repairs subsequently verified by focused tests/typecheck |
| pnpm typecheck | Exit 0 initially and final | MDX + tsc, no build |
| pnpm exec eslint lib/money/inventory-detail-ui.ts app/(dashboard)/inventory/[id]/layout.tsx tests/inventory-detail-ui-money.test.ts tests/integration/inventory-detail-ui-money.test.ts tests/integration/inventory-detail-ui-money-worker.ts | Exit 0, no output, final | All changed/new TS/TSX files; shell paths quoted |
| pnpm lint | Exit 0, 0 errors/98 existing warnings | Final small repair has clean changed-file lint |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0, final | 415 columns, 2058 scanned files, 1544 consumers, 29784 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, final | Actual Drizzle/source hashes and occurrence lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Existing import/call guard negative regression coverage |
| Registry local-link check via Python pathlib | Exit 0, 4 links | All linked owned files exist |
| python .agentic/agent.py validate | Exit 0, 210 tasks | Structure only, repeated after completion |
| git diff --check | Exit 0 | LF/CRLF conversion notices only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before commit | Current pre-delivery synchronization |
| psql fixture count; pg_ctl fast stop | Count 0, exit 0 shutdown | Synthetic fixture server only |

## Self-review, limitations and handoff

Separate MON-153-review-1.md records honest coding-assistant self-review. Review
added negative-zero physical count rejection and ensured a malformed successful
mutation response aborts older reads and exits loading before showing the alert.
Final focused 4/4, typecheck, changed-file lint and inventory checks passed after
those repairs. Earlier full 478/478 and 5/5 integration results are accurately
recorded; no failures occurred in executed financial suites.

No scoped blocker. Complete controller checks/submit/self-review/done, commit only
task-owned files including necessary MON-008 split planning, push origin/master,
verify remote SHA and clean tree, then report MON-154 and stop. No other task is
completed. Live browser/provider/PDF effects, full-int64 business, modernization of
inventory currency units, production IRR, hosted PostgreSQL16, accounting defects,
security/migration/localization and release qualification remain independent.
