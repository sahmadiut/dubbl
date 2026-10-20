# LOC-066 attempt 1 - combined inventory catalog acceptance

## Identity and scope

2026-10-20 (Asia/Tehran), coding-assistant/Codex, D:/Projects/dubbl.
Entry master HEAD bd046b5d3e4bee8e1731da60dba9b29355b9e5ff, clean working
tree. Live controller validate/status/next selected LOC-066 after LOC-072..078
were done. Started exactly this integration parent. Fetched origin and confirmed
0 ahead/0 behind before delivery preparation. Actual commit/push outcomes are
reported after they occur, separately from this working-diff evidence.

Read repository/controller/frontend instructions, project/repository map,
localization source sections, message contract, seven child scope inventories
and review evidence, current routes/drawers/pickers, registered tools and migrated
fixtures. Used the memory controller-task skill. No subagents were used.

## Acceptance mapping

1. Independently reconciled all 18 inventory route TSX files, five creation
   drawers and three shared pickers against the current catalogs and child
   ownership. Eight namespaces contain 682 paired messages; full catalogs retain
   7,010 compatible keys per locale. Added the
   [combined scope/exceptions registry](../registries/INVENTORY_CATALOG_ACCEPTANCE.md)
   and updated the message index. Existing source already covers this scope;
   no additional application or catalog changes were needed.
2. Added [combined tests](../../tests/inventory-catalog-integration.test.ts)
   preserving the real item context and the linked production category/item/
   warehouse pickers. English/Persian composition covers exact low-digit prices,
   escaped caller data, localized ready/pending footers, int32 transfer input,
   canonical warehouse option IDs, list/detail navigation and suppression of
   editable children during loading/missing/invalid-money states. A complete
   filename-pinned AST source inventory checks JSX/display attributes/toast and
   document-title literals. Reran all seven child suites and eight migrated
   inventory fixture files on current source; their callback, read/write failure,
   permission/isolation, exact-money and SQL checks remain active.
3. This attempt, [self-review](LOC-066-review-1.md), combined registry and task
   handoff retain provisional Persian wording and independent LOC-008/002,
   native terminology, mounted-browser, full RTL/output and release acceptance.
   This independently accepts LOC-066 only; it does not complete its parents.

No production application/catalog, REST/MCP/service/auth/schema/migration,
stock/ledger/currency/FX/IRR or Stripe source changes. Existing registered
inventory tools retain direct DB services, org-scoped AuthContext, wrapTool
and described input schemas. No added UI operation or changed REST contract
requires an additional MCP tool.

## Actual verification

Commands ran in the repository root. Final results below are observed, not
inferred from child completion.

| Check | Observed result |
|---|---|
| New combined composition/source suite | 7/7 pass, no skips |
| Seven child catalog suites, concurrency 1 | 85/85 pass, no skips; 19.766 seconds |
| Full unit/static suite, concurrency 1 | 1,122/1,122 pass, no skips; 449.648 seconds |
| Eight migrated inventory fixture files, concurrency 1 | 9/9 pass, no skips; 82.346 seconds |
| pnpm typecheck | Final exit 0 |
| pnpm i18n:check | Exit 0; 7,010 compatible keys per locale |
| Owned-test ESLint | Exit 0; zero errors/warnings |
| Full pnpm lint | Exit 0; zero errors, 60 existing warnings |
| Money inventory verifier | Exit 0; 417 schema columns, 1,765 consumer hashes and all occurrence/source lines |
| Legacy money guard | Exit 0; nine regression checks |
| Controller validation and git diff --check | Pass; rechecked before delivery |
| Task-owned Markdown source links | Zero missing local link targets |

```text
node --import tsx --test tests/inventory-catalog-integration.test.ts
node --import tsx --test --test-concurrency=1 tests/inventory-category-catalogs.test.ts tests/inventory-item-catalogs.test.ts tests/inventory-variant-supplier-catalogs.test.ts tests/warehouse-catalogs.test.ts tests/inventory-movement-catalogs.test.ts tests/inventory-assembly-catalogs.test.ts tests/inventory-report-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-master.test.ts tests/integration/inventory-catalog.test.ts tests/integration/inventory-movements.test.ts tests/integration/inventory-assembly.test.ts tests/integration/inventory-valuation.test.ts tests/integration/inventory-ui-money.test.ts tests/integration/inventory-detail-ui-money.test.ts tests/integration/inventory-integration.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint tests/inventory-catalog-integration.test.ts
pnpm lint
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

PostgreSQL 18 used a freshly initialized randomized OS-temp cluster bound only
to 127.0.0.1:4328, with explicit process-scoped TEST_DATABASE_URL and PG_BIN,
UTF-8 and local trust authentication. Each fixture creates/migrates/drops its
own random dubbl_ci_* database. Final database count was zero and the dedicated
cluster stopped in finally; stopped data remains in OS temp. Real REST handlers,
linked registered MCP calls and independent SQL assertions ran. No application
database or PostgreSQL 16 compatibility qualification is claimed.

Early test-harness attempts used incorrect message/markup expectations, a
duplicate local function name that confused hook collection, a too-broad
ComponentType callable annotation and a CommonJS-loaded next-intl loader context.
Corrected these against actual source, used distinct collector names, typed
local exports as function components, and imported the real BrandLoader through
the same module boundary as PresentationProvider. Final focused checks,
typecheck and lint pass; no production code was changed to satisfy the harness.

Two Windows database-launch attempts waited for the server process tree rather
than just pg_ctl. Stopping those task-owned clusters released the launches and
their tests failed with connection-refused before fixtures could run. Reused
the empty dedicated cluster with hidden Start-Process plus WaitForExit on the
pg_ctl process itself; readiness was verified before the successful 9/9 run.
These setup failures are not counted as successful integrations. Final logs are
in OS temp as dubbl-loc066-unit.log, dubbl-loc066-focused.log,
dubbl-loc066-integration-verified.log and dubbl-loc066-lint.log.

## Review and delivery boundaries

Codex performed honest self-review, not independent peer/human/native linguistic
or accounting approval. Controlled rendering uses real production JSX/context/
translations but controls hooks, effects, IO, navigation and portals; it does
not mount browser interactions. Existing child callback tests and separate
migrated database fixtures complement that composition boundary.

No full build, dev server, Docker, provider request, deployment, production
migration, application database mutation or IRR enablement ran. The broad
unchanged unit suite is not dedicated Stripe work. Finish controller acceptance,
submission/self-review/done, commit only task-owned files, push origin/master,
verify remote SHA and clean tree, then report the live next task and stop.
