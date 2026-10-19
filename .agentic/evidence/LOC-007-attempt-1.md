# LOC-007 attempt 1 - independent combined accounting/sales/purchasing catalogs

## Identity and scope

2026-10-20 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `dafe0aa8b92435ed7748d3b0e8cbb7139336b962`; clean entry tree.
Live controller validate/status/next selected LOC-007 after LOC-021..028 were
complete. Started only this integration parent. The user authorized completion
and push. Fetched origin/master and confirmed zero ahead/zero behind at entry.
No subagents were used. The memory controller-task skill supplied workflow
guidance, checked against current repository instructions and controller state.

Read root/.agentic instructions, START_HERE, controller, project/map/frontend
guidance, source localization requirements, dependency inventories/evidence,
actual route/shared source, catalogs, and real REST/MCP/SQL regression fixtures.
Completed child evidence is unchanged; it was not substituted for parent review.

## Acceptance mapping and implementation

1. [Combined inventory](../registries/ACCOUNTING_SALES_PURCHASING_CATALOG_ACCEPTANCE.md)
   reconciles all 87 routes: accounting 33, sales 18, purchases 18, contacts 9,
   tax 9, plus their owned shared controls/drawers through all eight child
   inventories. Fifty-three namespaces contain 4,142 paired messages, with
   6,328 total keys per locale. The new AST test pins every route path, rejects
   unexplained English JSX/display literals and literal document titles, checks
   referenced namespace parity and asserts Persian script with two exact
   interpolation-only exceptions. Technical samples, data, formatting and adjacent
   output ownership are explicit. No additional extraction/production fix is needed.
2. New [combined tests](../../tests/accounting-sales-purchasing-catalog-integration.test.ts)
   render actual layouts, TabLayout, EntryForm, LineItemsEditor, AccountPicker,
   amount controls and TaxSettlementPreview using real React/next-intl and
   PresentationProvider. Both locales preserve active routes, detail tab hiding,
   escaped caller text, exact low-order digits, invalid raw input and translated
   accessible alerts. USD/JPY/KWD preserve 4,000,000,000,000,001 minor units.
   Recurring bills keep fixed-two price input; journals independently keep their
   fixed-two bridge and exact debit/credit totals. The full suite reruns child
   source/render/callback/error/portal/contract checks on current source.
   Fifteen migrated PostgreSQL suites exercise actual authenticated REST,
   registered MCP and independent SQL across combined domain boundaries.
3. Inventory, catalog index, task handoff and honest self-review explicitly
   retain provisional Persian, LOC-002 whole-product acceptance, adjacent
   LOC-008/009/output work and later native/RTL/date/number/release qualification.
   Known pre-existing MCP gaps remain disclosed, not claimed repaired.

Only the new test, combined registry, catalog index, money consumer inventory,
selected task and unique attempt/review evidence change. No production source,
catalog, REST/MCP, service, authorization, schema/migration, exact-money/FX,
IRR flag or Stripe files change. The generated money inventory adds only the
owned test path/hash/occurrence entry; existing consumer/classification data is intact.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Actual result | Limit |
|---|---|---|
| New combined source/composition/negative tests | 3/3 passed, no skips; 3.383 seconds | SSR, no mounted browser |
| Full unit/static suite, concurrency 4 | 1,030/1,030 passed, no skips; 122.842 seconds | Includes controlled callback IO |
| Fifteen migrated REST/MCP/SQL suites, concurrency 1 | 15/15 passed, no skips; 141.895 seconds | PostgreSQL 18, synthetic local fixtures |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit | No full build |
| pnpm i18n:check | Exit 0; 6,328 compatible keys per locale | No native linguistic approval |
| Owned-file ESLint | Exit 0; zero errors/warnings | New test only |
| Full pnpm lint | Exit 0; zero errors, 68 existing warnings | Unchanged warnings retained |
| Money inventory generation/source verifier | Passed; 417 columns, 2,359 scanned files, 1,752 consumers | Conservative lexical inventory |
| Legacy money gate | Nine regression checks passed | Existing gate scope |
| Controller structural validation / git diff --check | Passed before disposition; repeated at completion | Structural validation is not implementation proof |

```text
node --import tsx --test tests/accounting-sales-purchasing-catalog-integration.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/journal-integration.test.ts tests/integration/core-accounting-integration.test.ts tests/integration/core-ui-integration.test.ts tests/integration/asset-loan-integration.test.ts tests/integration/budget-project-crm-ui.test.ts tests/integration/accrual-schedules.test.ts tests/integration/receivable-document-integration.test.ts tests/integration/receivable-payable-integration.test.ts tests/integration/payable-procurement-integration.test.ts tests/integration/contact-wire.test.ts tests/integration/contact-statement.test.ts tests/integration/tax-rate-contracts.test.ts tests/integration/tax-period-contracts.test.ts tests/integration/tax-report.test.ts tests/integration/tax-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js tests/accounting-sales-purchasing-catalog-integration.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database checks used a new OS-temp PostgreSQL 18 cluster listening exclusively
on 127.0.0.1:6318, explicit process-scoped TEST_DATABASE_URL and PG_BIN, and
max_locks_per_transaction=256. Each suite created/migrated/dropped its own random
database. Independent admin SQL confirmed zero remaining dubbl_ci_* databases;
pg_ctl stopped the cluster in finally. Stopped cluster files remain in OS temp.
No application DB, provider or external service was used.

An initial pre-change full suite passed 1,027 tests. Final full verification
includes all three new tests. Initial new-test failures were fixture/assertion
mistakes: a non-UUID account fixture invalidated production previews, two
interpolation-only messages intentionally lacked Persian script, and an asserted
journal label was not used by EntryForm. Corrected the UUID, narrowly documented
the exact templates, and asserted the actual debit label and both exact totals.
Typecheck caught the initial wrong label property. All final checks pass.
Read-only exploration also tried two nonexistent paths and one Python read
without explicit UTF-8; corrected paths/encoding without changing source.

## Review and remaining work

[Codex self-review](LOC-007-review-1.md) is honestly attributed, not peer/human,
native linguistic or accounting approval. New composition uses actual modules
with canonical PathnameContext; SSR leaves effects and portals unmounted.
Existing child callback tests control IO; PostgreSQL fixtures separately verify
actual transport/SQL behavior. Full hosted CI, mounted browser/keyboard, complete
RTL, physical printing and live-provider qualification are not claimed.

LOC-002 retains independent product-wide acceptance. Native terminology, output
translation, date/number/input adapters, statutory qualification, production
migration/deployment and IRR enablement remain separate. Existing missing MCP
tools for global currency creation and contact add-person/file download/delete,
plus list-filter/limit/balance differences, remain explicitly documented gaps.
No new user operation or REST change requires an MCP addition here.

No full build, dev server, Docker, deployment or dedicated Stripe work ran.
Complete controller disposition, commit only the seven owned files, push
origin/master, confirm remote SHA/clean tree, report the next task and stop.
Commit/push success is reported separately only after it occurs.
