# LOC-028 attempt 1 - independent combined tax catalog acceptance

2026-10-20 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `d55ca47c4f14e7cca808620124a00d14f2195056`; entry tree clean.
Controller validate/status/next selected LOC-028 after LOC-061..065 completed.
Started only this integration parent. User requested completion and push.
Fetched origin/master: entry HEAD was zero ahead/zero behind. No subagents used.

Read root AGENTS, controller entry/role/project/map, selected task, child scope
inventories/evidence, catalogs, actual route/shared source and transport fixtures.
Applied the memory controller-task skill, verified against current instructions.

## Acceptance mapping

1. [Combined inventory](../registries/TAX_CATALOG_ACCEPTANCE.md) independently
   reconciles all nine tax route files and the shared settlement preview. Eight
   namespaces retain 345 paired messages and 6,328 total keys per locale. Source
   guards find no unexplained authored English JSX, display literal attributes
   or document-title literals. Numeric syntax, statutory IDs, frozen/caller data,
   machine CSV labels and existing number/date formatting are explicit exceptions.
   No production/catalog correction is needed. Persian remains provisional.
2. New [combined tests](../../tests/tax-catalog-integration.test.ts) compose all
   eight actual pages beneath the actual tax layout and TabLayout. Both locales,
   USD/JPY/KWD, zero/refund/max-safe amounts, navigation eligibility/selection,
   detail tab hiding, escaping and the real exact settlement preview pass together.
   Child rendering/callback suites and separate actual migrated REST/MCP/SQL
   regression suites verify behavior, exact wire data and isolation.
3. The combined registry, catalog index and task handoff record the preserved
   contracts, global-currency-creation MCP gap, provisional Persian and independent
   LOC-007/002/native/RTL/statutory handoff. Review is honestly attributed to Codex.
   Existing completed child evidence is preserved without rewriting.

## Actual verification

| Check | Result |
|---|---|
| Combined/five-child tax catalogs and money/wire tests, concurrency 2 | 64/64 passed, no skips; 21.676 seconds |
| Final combined tests after harness cleanup | 3/3 passed, no skips; 8.913 seconds |
| Six migrated REST/MCP/SQL suites, concurrency 1 | 6/6 passed, no skips; 51.156 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 6,328 compatible keys per locale |
| Changed-file ESLint | Exit 0; no errors/warnings |
| Full unit/static suite, concurrency 4 | 1,027/1,027 passed, no skips; 132.637 seconds |
| Full pnpm lint | Exit 0; zero errors and 68 existing warnings outside the owned test |
| Money inventory generation/source verifier | 417 columns; 2,358 scanned files; 1,751 consumers; new combined test entry only |
| Legacy money gate | Nine regression checks passed |
| Controller structural validation / git diff --check | Passed; repeated at disposition |

Commands from repository root:

```text
node --import tsx --test --test-concurrency=2 tests/tax-catalog-integration.test.ts tests/tax-rate-catalogs.test.ts tests/currency-workspace-catalogs.test.ts tests/tax-period-catalogs.test.ts tests/vat-return-catalogs.test.ts tests/tax-filing-catalogs.test.ts tests/tax-ui-money.test.ts tests/tax-period-wire.test.ts tests/tax-rate-wire.test.ts tests/tax-report-wire.test.ts
node --import tsx --test tests/tax-catalog-integration.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/tax-rate-contracts.test.ts tests/integration/tax-period-contracts.test.ts tests/integration/tax-report.test.ts tests/integration/tax-ui-money.test.ts tests/integration/fx-wire.test.ts tests/integration/forecast-fx.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js tests/tax-catalog-integration.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database checks used a new PostgreSQL 18 cluster bound exclusively to
127.0.0.1:55428 with process-scoped TEST_DATABASE_URL and PG_BIN. Each fixture
created/migrated/dropped a randomized database. Independent admin SQL confirmed
zero remaining `dubbl_ci_*` databases, then pg_ctl stopped the cluster.
No application database, live provider or external service was accessed.

Initial test harness issues were corrected: the currency-select import used the
wrong directory, the VAT refund assertion needed the existing absolute display,
TypeScript needed an explicit boolean annotation and ESLint required renaming a
local `module` variable. Final focused tests, typecheck and owned lint pass.
Compiled source caching speeds repeated composition without changing runtime
contracts. The final fixture uses matching currency decimal metadata. Some
read-only searches used nonexistent paths and were rerun against actual paths.
No unresolved product defect was found. Regenerated money inventory adds only
the owned test consumer/hash; classifications and existing consumers are intact.

## Review boundaries and handoff

Composition controls own hooks/effects, navigation and sheet portals. It does
not mount a browser or qualify layout/keyboard/physical printing. Child callbacks
use controlled IO; DB suites exercise real API-key REST, registered MCP and SQL.
Existing global currency creation still has no corresponding MCP tool; this
pre-existing gap is explicit and is not claimed repaired by catalog acceptance.

LOC-007/002 retain independent acceptance. Native terminology, complete RTL,
localized number/date/input adapters, statutory qualification, physical print,
hosted CI, providers, production migration/deployment and IRR enablement remain
separate. No full build, dev server, Docker, deployment or dedicated Stripe work.
No production source/catalog/API/MCP/service/schema/migration/money/flag changes.
Complete controller disposition, commit/push only task-owned changes, verify
remote SHA/clean tree, report next task and stop. Commit/push success is reported
only after it occurs.
