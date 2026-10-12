# MON-133 attempt 1 - combined core UI money acceptance

## Identity

2026-10-12, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
a48f9048dd8e1f74a0642df540016b7c8cd307bc, clean tree. User authorized completing
and pushing the next task. Controller validate/status/next selected MON-133;
start claimed this integration parent after all six children were done.
Read project/controller/frontend instructions, child evidence, ownership/manifest/
boundary inventories, actual UI adapters, services, routes and registered tools.
One task only; MON-129/MON-007/MON-008 remain separate.

## Implementation and acceptance mapping

1. Explicit consumer ownership and exact boundaries: current CORE_UI_MONEY_CUTOVER
   entry joins MONEY_BOUNDARIES consumer families to MON-147..152 and document,
   shared component, metadata/nonmoney or MON-008 ownership. Existing production
   implementation is correct for the recorded slice; no duplicate service/tool
   or UI repair was needed. New combined wrapper/worker independently exercises
   the adapters using actual authenticated REST handlers and a linked full MCP
   SDK session with all relevant tool registrations for each organization.
2. Meaningful combined behavior: eight workflows (USD/JPY/KWD/synthetic IRR,
   REST-origin and MCP-origin) compose numeric USD opening preview/write/read,
   taxed invoice recognition, bank-scale CSV preview/import/full-statement match,
   exact payment/allocation and proof views, expense/mileage preview/create/
   submit/approve/pay, real VAT filing/frozen lines/settlement, account running
   pages and every saved journal's presentation groups. A 3000000001 source price
   retains low digits through tax, 3300000001 cash and allocations; expense
   ordinary plus mileage is 3000000004. Mileage distance stays 300 hundredths
   and per-mile rate stays one claim minor unit. SQL text independently checks
   all journal sides, source tags/FX, account net amounts and allocations.
   Overpayment on an unmatched statement, malformed/overflow/conflicting writes,
   foreign account/entry reads and presentation reads preserve scoped snapshots
   including invoices, allocations, expenses/items, frozen lines, GL and FX.
   Child suites jointly retain safe-max, malformed/read alias, rounding, scale,
   preview/saved, settings/rates, batch/schedule/transfer and lifecycle negatives.
   Full pure/static React checks and source review preserve English labels,
   alerts, decimal keyboard mode, gating, org/request guards, scrolling/wrapping.
3. Source/base and compatibility: actual EUR 1251-minor invoice at quote 0.3333
   posts 417 USD, 4 JPY/IRR or 4170 KWD base minor units. Source tags and rate
   persist; journal amountCurrencyCode drives presentation without repeated FX.
   Matching-scale REST base display returns 417 USD; differing scales reject
   with existing LEGACY_NUMERIC_RANGE, while MCP preserves its invoice-only
   envelope/source units. REST fixed-two journal aliases and MCP numeric minor
   fields are independently decoded and compared exactly. No policy was changed
   to make the test pass. Opening USD cents, recurring payable fixed-two gross
   prices, raw GL/current-base/history, safe Number wire coexistence, raw rule/
   approval thresholds and mixed-unit rejection stay documented exceptions.
   Synthetic IRR expense/bank behavior is existing; tax filing remains rejected
   with unchanged state. No history rewrite, full-int64 workflow expansion,
   schema/migration or production flag change.

## Database and verification

All commands ran from D:/Projects/dubbl. Dedicated synthetic PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon133-pg-9ffe087d2b524d9b9898386494ac1641.
Loopback 127.0.0.1:55453, synthetic trust-authenticated dubbl_ci, UTC,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL/PG_BIN; each
wrapper created/migrated/dropped a randomized database. Final fixture DB count
was 0 and pg_ctl fast stop passed. Application .env/database was not accessed.
No build, dev server, Docker, provider, hosted CI wait or deployment.

| Command / procedure | Actual result | Limit |
|---|---|---|
| node --import tsx --test --test-concurrency=2 tests/integration/core-ui-integration.test.ts tests/integration/opening-balance-ui-money.test.ts tests/integration/payment-ui-money.test.ts tests/integration/expense-ui-money.test.ts tests/integration/bank-ui-money.test.ts tests/integration/tax-ui-money.test.ts tests/integration/core-presentation-money.test.ts tests/integration/journal-ui-money.test.ts tests/integration/payment-expense-bank-integration.test.ts | Exit 0, 9/9 | Combined acceptance plus six child suites, journal editor and domain composition |
| node --import tsx --test tests/integration/core-ui-integration.test.ts | Final exit 0, 1/1; eight workflows | Rerun after expanding snapshots and unmatched-statement overpayment negatives |
| pnpm test | Exit 0, 474/474 | Full pure/static React suite |
| pnpm typecheck | Final exit 0 | MDX and tsc only |
| pnpm exec eslint tests/integration/core-ui-integration.test.ts tests/integration/core-ui-integration-worker.ts | Final exit 0, no output | Both changed TS files |
| pnpm lint | Exit 0, 0 errors/98 existing warnings | Warnings match preceding task and are outside changed files |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Final exit 0 | 415 columns, 2050 scanned files, 1539 consumers, 29600 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0 | Drizzle classification, hashes and source occurrence lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Final exit 0, 9 checks | Legacy-import guard |
| python .agentic/agent.py validate | Exit 0, 202 valid tasks | Structural only; repeated after completion |
| git diff --check | Exit 0 | Line-ending advisory notices only |
| Source/layout/ownership self-review | Complete under DEC-005 | No live browser/screenshot claim |

Early fixture attempts corrected wrong assumptions about numeric MCP journal
fields, statement proof requiring an explicit session, bank movement organization
scope through bank_account, the journal rate_exact column name, existing IRR
expense support, different-scale REST base-display rejection and invoice-only
MCP reads. Actual route conversion also rounds to each base currency scale;
fixture expectations now independently assert 417/4/4170 units rather than an
incorrect shared raw result. An initial multi-file documentation patch failed
atomically due to a guessed README heading; the correct heading was used.
These were fixture/path/expectation corrections, not weakened backend policies.
The final new fixture and joint suite pass; no failed attempt is reported passed.

## Review and handoff

Honest self-review: MON-133-review-1.md; no peer/human approval is claimed. Local
PostgreSQL 18 checks do not qualify hosted PostgreSQL 16, production IRR,
historical mixed-unit/base remediation, browser effects, accounting/linguistic
or migration/release gates. No scoped blocker remains. Complete this parent via
controller acceptance/submit/self-review/done, commit only its ten task-owned
files, push origin/master, verify remote SHA and clean tree, report next and stop.
The push result will be reported after execution; this evidence invents no SHA.
