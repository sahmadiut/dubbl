# LOC-068 attempt 1 - combined project catalog acceptance

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Initial HEAD
`9152f45f`; clean entry tree. Fetch confirmed zero commits ahead/behind
origin/master. Owner requested one next task completed and pushed. Controller
selected LOC-068 after all six children LOC-093..098 were done.

Read AGENTS, START_HERE, project/map/frontend/controller instructions, selected
task and LOC-008/009 scope, current child registries/reviews, message contract,
production route/provider/drawer source, display/read helpers, existing tests,
project-master operation registry and registered MCP/billing output ownership.

## Acceptance mapping

1. Reconciled all 11 project TSX route components and ProjectDrawer against
   seven namespaces with 498 paired messages; 8,551 compatible keys per locale.
   Every project Persian message contains Persian script. The
   [combined registry](../registries/PROJECT_CATALOG_ACCEPTANCE.md) maps every
   component and lists caller/machine/symbol/shared-control/compatibility/output
   exceptions. No further product or catalog change was needed. Persian wording
   remains provisional.
2. Added four combined tests that use real production layout, ProjectProvider,
   sibling page JSX and next-intl/PresentationProvider, alongside AST extraction
   and namespace checks. Reran current child rendering/callback suites and
   actual migrated REST/linked MCP/independent SQL fixtures. Stored fixed-two
   project cents, canonical Minor aliases, physical minutes, dates, authorization,
   history and operation contracts remain unchanged.
3. This attempt, separate honest Codex self-review, task handoff and combined
   registry/message ownership record independent LOC-008/002/native/RTL/output
   and release qualification. No peer/human/native approval is implied.

## What changed and what the combined tests establish

`tests/project-catalog-integration.test.ts` feeds one checked project response
through the actual shared provider and layout into all seven detail workflows
in English and Persian. It checks translated page content, all canonical tab
destinations and active-page attributes, escaped caller data, identical exact
budget values, and time-derived earnings exceeding Number.MAX_SAFE_INTEGER.
It renders each detail page behind failed/previous-route state to prove that
the shared provider/layout hides stale financial/project content and presents
translated recovery feedback. Source checks pin all 11 components and drawer
ownership, reject authored JSX/display attributes/toast/title literals and
prevent project routes importing obsolete context display helpers/configs.

The existing child suites retain list/create/settings and shared footer checks,
calendar/chart assertions, task list/board/drag/drop/checklist/comments, time
entry/timer/autosave, milestone/assignment/progress invoice, team/member and
note filtering/editing callbacks, failed-response retention and cleanup coverage.
The production composition controls hook state, IO, chart/motion/portal
boundaries; it is not a mounted-browser interaction test.

Saved backend invoice descriptions/notes are explicitly inventoried for
separate output localization; existing history is not rewritten. The existing
two-operation timer-save flow still lacks atomic retry/idempotency recovery.
No such backend repair is claimed by catalog acceptance. Native terminology,
complete RTL/calendar/numerals and output/release acceptance remain separate.

Only the combined test, its generated money inventory scan/consumer entry,
registries, task handoff and unique evidence/review files change. Existing
consumer hashes and all 417 schema classifications match entry HEAD; none were
removed. No product/catalog, service/REST/MCP/auth, schema/migration, ledger,
currency/IRR flag or Stripe source changed.

## Actual verification

Commands ran from D:/Projects/dubbl with installed dependencies. No full build
or dev startup was run. No skips in the reported passing tests.

| Check | Result | Boundary |
|---|---|---|
| Combined production composition/source test | 4/4 pass, 8.375 seconds | Real provider/layout and seven sibling workflows; controlled hooks/IO |
| Focused project catalogs, wire, UI money and message foundation | 67/67 pass, 149.010 seconds | Current child production rendering/callback suites |
| Four migrated project integrations | 4/4 pass, 102.486 seconds | Actual REST/registered MCP, SQL, auth/scope/history/rollback |
| Full unit/static suite | 1,291/1,291 pass, zero skips, 598.408 seconds | Node tests/*.test.ts, concurrency 2 |
| pnpm typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0, 8,551 keys per locale | Key/ICU compatibility; not native approval |
| Owned-file ESLint | Exit 0, no findings | New combined test |
| Full lint | Exit 0, zero errors and 26 existing warnings outside this change | OS-temp cache |
| Money inventory/source/legacy gates | Exit 0 | 417 schema columns, 2,419 scanned files, 1,810 consumers; nine legacy checks |
| Controller, relative links and diff | Pass; 123 local Markdown links resolve; controller repeated at closure | Structural checks, not human qualification |

```text
node --import tsx --test tests/project-catalog-integration.test.ts
node --import tsx --test --test-concurrency=1 tests/project-*-catalogs.test.ts tests/project-catalogs.test.ts tests/project-*-wire.test.ts tests/budget-project-crm-ui.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/project-master.test.ts tests/integration/project-billing.test.ts tests/integration/budget-project-crm-ui.test.ts tests/integration/project-crm-pricing.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js tests/project-catalog-integration.test.ts
pnpm lint --cache --cache-location <OS-temp>/dubbl-loc068-eslint.cache
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database checks used process-scoped TEST_DATABASE_URL/PG_BIN and a unique
OS-temp PostgreSQL 18 cluster bound to 127.0.0.1:6474 with trust authentication
and max_locks_per_transaction=256. Fixtures created/migrated/dropped randomized
dubbl_ci_* databases. The final admin query found zero fixture databases and
pg_ctl stopped the cluster successfully. Application DB credentials were unused.

Initial combined-test failures were harness assumptions: JSON key order differs
between locales, document titles are hook metadata rather than visible page
headings, Link attribute order is not fixed, and directly requiring the shared
presentation helper loaded a separate CJS next-intl context. Sorted key sets,
actual visible message keys, order-independent link assertions and ESM imports
of the actual presentation/shared modules corrected the harness. Typecheck
also caught a nonexistent member document-title key. The final combined tests
and typecheck pass. No production regression was disguised as a test repair.

## Review and handoff

See [Codex self-review](LOC-068-review-1.md). All recorded local checks passed;
controller review/done accepts LOC-068 alone. LOC-008/002, native terminology, full
RTL/calendar/numerals, browser/keyboard, remaining output localization, hosted
CI, deployment and release/production/IRR qualification remain independent.
Commit/push and live remote parity follow controller closure and scoped staging;
this evidence does not claim a hosted CI or deployment result.
