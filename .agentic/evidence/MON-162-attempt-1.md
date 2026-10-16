# MON-162 attempt 1 - auxiliary report UI combined acceptance

## Identity and environment

2026-10-16, coding-assistant (Codex), explicitly self-review. Repository
D:/Projects/dubbl, master; clean entry HEAD
`74de743ad60a3e2289639613f7e81cb550c17d91`. Controller validate/status/next selected
MON-162 after MON-166/167/168 were done; start claimed the integration parent.
Original acceptance criteria and parent MON-158/MON-008 status are preserved.
Read controller/project/repository instructions, selected task, child attempt
and review evidence, migration/API source requirements, registries and actual
report adapters/pages/services/tools/fixtures. The memory controller-task skill
guided the one-task, scoped commit/push workflow.

Explicit TEST_DATABASE_URL and PG_BIN targeted a dedicated PostgreSQL 18 cluster
at 127.0.0.1:55462, synthetic dubbl_ci role, trust auth, loopback listener only,
UTC, max_locks_per_transaction=256, jit=off. Cluster path:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon162-pg-c6a1fa70c1634452969c50c03c8911e0.
Fixtures create, migrate and drop random databases. Final fixture database count
was zero and pg_ctl fast shutdown succeeded. Temporary files/log remain outside
Git. No application .env/database access, schema change, migration generation,
full build, dev server, Docker, provider or production action.

## Acceptance mapping

1. Existing child runtime code already composes correctly; no duplicate service
   or MCP operation is needed. AUXILIARY_REPORT_UI_ACCEPTANCE accounts for all
   32 report pages: 22 child consumers, existing exact budget consumer, three
   navigation/configuration/server-download pages without client money, and
   six MON-161 statements excluded from this parent. Shared validators require
   saved numeric/canonical Minor agreement and explicit currency before bigint
   state, display, totals, tooltips and CSV. Source and existing behavior/static
   tests retain error/superseded-request guards. All documented quantity/count,
   date, ratio/percentage/chart, raw-minor CSV, ledger paging, consolidation and
   backend compatibility unit exceptions are mapped without rescaling history.
2. New auxiliary-ui-cutover-acceptance test/worker independently exercise twelve
   authenticated REST/linked SDK registered MCP operations per separate USD,
   JPY, KWD and synthetic IRR tenant. Literal SQL text verifies cash/bank net
   2999999100, receivables 3000000001 and payables 901. Shared stored history
   reconciles ledger, cash flow, tracking, ratio/executive net income, expenses,
   vendor spend, aging, bank status/cash flow and custom hidden-carrier results.
   Exact currency-scale display, raw-minor CSV, repeated responses and complete
   financial/audit JSON-text snapshots preserve values. Every operation tests
   malformed adoption, unauthorized REST and denied MCP. Hostile organization
   headers do not alter scope; foreign bank IDs fail. A balanced extra persisted
   maximum-safe entry triggers aggregate overflow in five ledger-derived
   families: REST 422 and MCP LEGACY_NUMERIC_RANGE, rejected UI HTTP adoption
   and unchanged financial snapshots. Joint child/domain suites independently
   retain tax/refunds, historical FX, consolidation, saved config, pagination,
   concurrency, permission/scope, corrupt/unsafe history and binary exports.
3. New combined registry links child ownership and retained units; MONEY_MANIFEST,
   TEST_MATRIX and money README link it and supersede old MON-162-pending notes.
   Regenerated MONEY_BOUNDARIES adds only the new fixture paths/worker consumer.
   Inventory/legacy/static/link/controller checks pass. MON-158 and MON-008
   remain independently open; no production enablement follows from completion.

## Verification

All commands ran from D:/Projects/dubbl. The joint command was
`node --import tsx --test --test-concurrency=2` with these explicit paths under
tests/integration (no shell brace/glob expansion was assumed):

```text
auxiliary-ui-cutover-acceptance.test.ts ledger-aging-ui.test.ts tax-report.test.ts
compound.test.ts consolidation-report.test.ts custom-reports.test.ts
bank-analytics.test.ts kpi-analytics.test.ts document-analytics.test.ts
operational-reports.test.ts forecast-fx.test.ts payment-performance.test.ts
budget-report.test.ts report-schedules.test.ts
```

| Check | Actual result | Limit |
|---|---|---|
| Joint command above, explicit loopback TEST_DATABASE_URL | Exit 0, 14/14, 418.314 seconds | Selected report families, PostgreSQL 18; not every integration or hosted PostgreSQL 16 CI |
| Final `node --import tsx --test tests/integration/auxiliary-ui-cutover-acceptance.test.ts` | Exit 0, 1/1, 67.053 seconds | Includes final strengthened exact MCP overflow-code assertion |
| `pnpm test` | Exit 0, 550/550, 147.207 seconds | Full unit/behavior/static suite; no live browser |
| `pnpm typecheck` | Exit 0, including final run after source settled | fumadocs-mdx plus tsc only |
| Native Node ESLint on both new TypeScript files | Exit 0, no warnings/errors | Task-owned TypeScript only |
| `pnpm lint` | Exit 0, zero errors/81 warnings in unchanged files | Existing warnings retained |
| `python .agentic/scripts/money_inventory.py --write`, then without flags | Exit 0; 415 columns, 2099 scanned paths, 1577 consumers, 30937 occurrences | Lexical classification/hash inventory |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; Drizzle columns, hashes and source lines verified | Final worker hash independently rechecked after edits settled |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0, 9 regression checks | Legacy money static gate |
| Changed documentation local Markdown links | Exit 0, 238 links/zero missing | Existence only; new evidence links checked separately before submission |
| `python .agentic/agent.py validate`; `git diff --check` | Exit 0 | Controller structure and whitespace, not financial proof |
| `git fetch origin master`; divergence at entry | Exit 0, 0 ahead/0 behind | Actual entry synchronization |
| Fixture database count; pg_ctl fast stop | Zero remaining dubbl_ci_% databases; exit 0 shutdown | Temporary synthetic cluster files retained |

The initial new fixture consumed a Response body with json() before calling the
HTTP adoption helper. Fixed the harness to clone before reading; the final
focused and joint runs passed. MCP helper handles both JSON errors and plain
text errors. Self-review strengthened overflow checks from generic MCP failure
to the specific LEGACY_NUMERIC_RANGE code, then reran the final focused fixture,
typecheck and verified the final worker inventory hash. No runtime defect was
hidden or acceptance weakened. Initial incorrect discovery paths were corrected
and are not represented as successful checks.

## Review and handoff

Honest self-review: [MON-162-review-1](MON-162-review-1.md). No scoped blocker
remains. Complete controller checks/submit/self-review/done, commit only these
task-owned files, push the authorized origin/master, verify remote SHA/clean tree,
report live next task and stop. Git/final response record the real delivery SHA;
no future commit/push is invented here.

No browser/screenshot/physical print/download, hosted CI, independent peer/human
or native-language/accounting review, production IRR, provider, deployment or
release qualification is claimed. Existing backend accounting policies, safe
numeric wire limits and pending broader integration parents remain separate.
