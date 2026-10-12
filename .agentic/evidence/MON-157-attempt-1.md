# MON-157 attempt 1 - Budget, project and CRM UI money

## Identity

2026-10-13, Asia/Tehran. Operator: coding-assistant. Repository:
`D:/Projects/dubbl`, branch master, clean on entry, baseline
`24ec3c80d59736079e7fd36a80be0ad44236429a`. Controller selected MON-157;
no other task was started or completed. This evidence describes uncommitted
task changes at recording time; the subsequent Git commit carries the result.
User requested completion and push of the next task.

## Implementation

See [consumer and unit mapping](../registries/BUDGET_PROJECT_CRM_UI_CUTOVER.md)
for all paths and exceptions. New `lib/money/budget-ui.ts` qualifies saved
numeric/Minor pairs and adopts bigint budget values, exact signed input,
floor/remainder distribution, ratios, differences and chart tooltip payloads.
Budget list/detail/settings, the progress component and its report caller use
this boundary. Invalid/failed report reads show unavailable amounts; negative
spend/budgets remain visible. Editor drafts retain invalid text, expose
aria-invalid, block save, and reindex with line removal. Save uses string
totalMinor/amountMinor; explicit saved total precedence remains unchanged.

`lib/money/project-crm-ui.ts` qualifies nested project/master/billing/invoice,
CRM/deal/summary/analytics and pricing numeric-cents pairs, including nullable
rates and required billing-preview/invoice totals. Project views use saved
currency labels with fixed cents; existing exact rate/hour/percent inputs and
CRM weighted-value arithmetic remain. Minutes, counts, dates and percent
controls keep their distinct units. Shared Project/Deal/Budget/Accrual drawer
sections are scoped; accrual strict decimal-major input preserves 18-decimal
positive half-up rounding and canonical counts 1..1200.

Budget chart geometry is approximate Number presentation, while tooltips and
all money sums retain bigint. Budget denomination is still historical fixed
cents, labeled with current organization currency, without a saved snapshot or
conversion. New project/deal defaults remain USD. Pricing has no standalone
dashboard editor in current source; shared resolution and existing priced
invoice/domain contracts are composed rather than inventing a new feature.

MONEY_MANIFEST/TEST_MATRIX link this slice; money_inventory.py identifies 26
scoped consumer/helper paths as MON-157. Regenerated MONEY_BOUNDARIES contains
source hashes/occurrences. Nineteen obsolete scoped legacy-import allowances
are removed; source/static and lint guards reject reintroduction. No REST/MCP
contract, registration, schema or migration changes were needed.

## Acceptance mapping

1. Scoped consumers validate saved exact aliases and use exact money input,
   arithmetic and display. Fixed cents, nullable rates, whole minutes, percentages,
   counts, chart geometry and accrual REST-major/MCP-cents exceptions are explicit
   in the consumer registry. Missing/conflicting/unsafe/noncanonical/negative-zero
   money fails before adoption. Signed budget amounts are preserved.
2. Eight behavior/static groups and six actual REST-origin/MCP-origin workflows
   in USD/JPY/KWD preserve low digits and signed results. SQL-text independently
   asserts budget 3000000001 and -1, project 3000000001 cents/1251-cent rate/30
   minutes, CRM and pricing 3000000001, and accrual 101 cents from REST 1.005.
   Negative ledger spend produces report actual -2 and variance 3000000002;
   project time preview is 626. Cross-transport replay and invalid alias mutations
   preserve snapshots. Existing domain suites cover scope, permission, historical
   corruption, safe limits, concurrency and transaction rollback.
3. The scoped manifest/ownership mapping, hash inventory and money/static guards
   pass. MON-008 remains todo with its original independent integration criteria;
   completed MON-007/domain contracts do not substitute for that acceptance.

## Verification

All commands ran at the repository root. Dedicated PostgreSQL 18.6 cluster:
`C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon157-pg-19aff5eaae174be2ac53160f79ea915d`,
loopback 127.0.0.1:55461, synthetic dubbl_ci role, UTC, jit off,
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL and PG_BIN targeted
only this server. Wrappers created, migrated and dropped randomized disposable
databases. Final count was zero; pg_ctl fast shutdown exited 0. Cluster files
remain. No application database or .env credentials were read or mutated.

| Command/procedure | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/budget-project-crm-ui.test.ts | Final exit 0, 8/8 | Behavior, React render and actual source guards |
| node --import tsx --test --test-concurrency=2 tests/integration/budget-project-crm-ui.test.ts tests/integration/budget-wire.test.ts tests/integration/budget-report.test.ts tests/integration/project-crm-pricing.test.ts tests/integration/project-master.test.ts tests/integration/project-billing.test.ts tests/integration/crm.test.ts | Exit 0, 7/7, 41.409 seconds | Actual REST/MCP/SQL and existing domain regressions |
| node --import tsx --test --test-concurrency=2 tests/integration/budget-project-crm-ui.test.ts tests/integration/accrual-schedules.test.ts tests/integration/pricing.test.ts | Exit 0, 3/3, 23.489 seconds | Accrual and pricing negatives/replay/rollback |
| node --import tsx --test tests/budget-project-crm-ui.test.ts tests/integration/budget-project-crm-ui.test.ts | Exit 0, 9/9, 43.728 seconds | Stricter final required-preview/invoice/currency aliases |
| pnpm test | Final exit 0, 503/503, 45.628 seconds | After signed-visibility and per-period helper refinements |
| pnpm typecheck | Final exit 0 | MDX plus tsc; no build |
| Changed/new TS paths as individual argv to node node_modules/eslint/bin/eslint.js via Python subprocess | Final exit 0, zero warnings/errors | Includes helpers and fixtures |
| pnpm lint | Exit 0, zero errors, 93 remaining warnings | Unchanged consumers retain existing warnings; scoped final lint rerun after last UI refinements |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Final exit 0 | 415 columns, 2071 scanned files, 1556 consumers, 30162 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0 | Drizzle columns, source hashes and all occurrence lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Final exit 0, nine checks | Negative lint-gate regressions |
| Registry path/ownership script | Exit 0 | All 26 MON-157 paths and verification links exist |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure and whitespace; repeat after completion/staging |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0/0 | Remote synchronized before task commit |

An initial fixture used REST's schedule envelope for an MCP accrual replay;
it failed and was corrected to the existing accrualSchedule envelope. Early
type/lint checks caught test union inference and a reserved module binding;
both were corrected before the passing final checks. No product API envelope
was changed to fit a test. Self-review additionally corrected stale draft indices,
unavailable-as-zero displays, missing preview fields and hidden negative amounts.

## Review and handoff

Honest self-review: coding-assistant; see separate review evidence. No peer or
human approval is claimed. No full build, dev server, browser interaction,
screenshot, Docker, provider or deployment action. Financial/production and
full-int64 qualification remain separate. Task is ready for controller check,
submit/review/done and its authorized scoped commit/push; stop after reporting
the live next task. Completed evidence becomes immutable.
