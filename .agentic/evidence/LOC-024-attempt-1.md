# LOC-024 attempt 1 - combined assets, loans, budgets and accrual catalogs

Date: 2026-10-18 (Asia/Tehran). Implementer: Codex. Repository: D:/Projects/dubbl.
Entry tree was clean on master. Controller validate/status/next selected LOC-024
for independent integration acceptance after LOC-034..038. Exactly this task is
completed; LOC-007/002 and native/RTL qualification retain their own gates.

## Acceptance mapping

1. Audited the complete eleven-route/four-drawer scope and child inventories.
   [Combined inventory](../registries/ASSET_LOAN_BUDGET_ACCRUAL_ACCEPTANCE.md)
   records ownership, 579 paired scoped messages and explicit caller/machine/
   formatting exceptions. Found LoanDrawer still using English shared footer
   defaults. Added Loans.cancel/creating in both locales and supplied the same
   overrides already used by the other three drawers. Catalogs now contain
   4,111 compatible keys per locale. Persian is provisional, not native approval.
2. New [combined tests](../../tests/asset-loan-budget-accrual-catalog-integration.test.ts)
   render real budget layout/overview/settings with the actual shared context,
   exact 4,000,000,000,000,001 minor units, USD/JPY/IRR/KWD, escaped caller text,
   saved dates, empty state and seeded read-error exclusion of stale children.
   All four production drawer bodies render with real shared chrome in ready/
   saving states under the presentation provider; localized cancel/pending labels
   and disabled submit state are asserted. AST source audit pins all eleven routes
   and four drawer bodies. Child rendering/production-callback, exact-money/wire
   and migrated REST/MCP/SQL suites run together on current source.
3. Inventory, task handoff and [honest self-review](LOC-024-review-1.md) record
   provisional Persian and independent parent/native/RTL boundaries. No REST/MCP,
   service, money helper, schema/migration or Stripe changes. All existing user
   operations retain their MCP counterparts. Only the loan footer presentation,
   paired messages, combined tests, mechanical inventory and controller/docs
   change. Existing completed child evidence is immutable and unmodified.

## Actual verification

All commands ran at repository root. A unique temporary PostgreSQL 18 cluster
was initialized with trust auth and bound to 127.0.0.1:55424. Process-scoped
TEST_DATABASE_URL and PG_BIN were explicit. Fixtures created/dropped randomized
databases and applied current migrations. The dedicated server stopped after
the suite. No application database was read, migrated or mutated.

| Check | Actual result |
|---|---|
| Focused combined and five-child catalog/money/wire suite | 72/72 passed, no skips; 21.380 seconds |
| Full unit/static suite, concurrency 4 | 805/805 passed, no skips; 73.824 seconds |
| Migrated asset/category, depreciation, CWIP, valuation, loan, combined asset-loan, budget CRUD/report/combined UI, accrual REST/MCP/SQL integrations | 10/10 passed, no skips; 125.991 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 4,111 compatible keys per locale |
| Changed-file ESLint | Exit 0; no errors or warnings |
| Full pnpm lint | Exit 0; zero errors, 72 existing warnings outside changed files |
| Money inventory generation/verifier | Exit 0; 417 columns, 2,234 scanned files, 1,676 consumer hashes and all occurrence/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Catalog ownership and Persian audit | Only two new Loans entries in each locale; every prior entry preserved; both new Persian entries contain Persian script |
| Pre-commit fetch/divergence | master and origin/master 0 ahead / 0 behind |
| Controller validation, local links and git diff --check | Exit 0 after evidence/handoff and controller completion |

Commands:

```text
node --import tsx --test --test-concurrency=2 tests/asset-loan-budget-accrual-catalog-integration.test.ts tests/asset-category-catalogs.test.ts tests/fixed-asset-catalogs.test.ts tests/loan-catalogs.test.ts tests/budget-catalogs.test.ts tests/accrual-catalogs.test.ts tests/asset-loan-ui-money.test.ts tests/asset-master-wire.test.ts tests/asset-depreciation-wire.test.ts tests/asset-cwip-wire.test.ts tests/asset-valuation-wire.test.ts tests/loan-wire.test.ts tests/budget-wire.test.ts tests/budget-report-wire.test.ts tests/accrual-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/asset-master.test.ts tests/integration/asset-depreciation.test.ts tests/integration/asset-cwip.test.ts tests/integration/asset-valuation.test.ts tests/integration/loans.test.ts tests/integration/asset-loan-integration.test.ts tests/integration/budget-wire.test.ts tests/integration/budget-report.test.ts tests/integration/budget-project-crm-ui.test.ts tests/integration/accrual-schedules.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js components/dashboard/create-drawer.tsx tests/asset-loan-budget-accrual-catalog-integration.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The first new combined run passed rendering/footers and failed its source audit
on FA-001. The fixed-asset child inventory already declares this identifier
sample. Added only that exact path/attribute/sample exception; final focused/full
runs pass. Two initial read-only inspection commands had invalid PowerShell
arguments/paths and were corrected. No product failure remains.

## Review and delivery boundary

Composition tests control initial hooks/effects/navigation and inline portals.
The seeded read-error rendering is not a network test; actual failure/cancellation
behavior is covered by child callback tests. These are not mounted browser/RTL
acceptance. PostgreSQL tests do execute real REST, MCP and independent SQL, but
do not certify all accounting/security workflows or production data.

No full build, dev server, Docker, hosted CI wait, provider call, deployment or
production IRR enablement was performed. Broad unchanged tests include existing
provider regression checks; there was no dedicated Stripe work. Native Persian,
RTL/browser and LOC-007/002 acceptance remain independent. Finish the scoped
commit and authorized origin/master push, verify SHA/clean tree, report next
controller task and stop. Commit/push evidence is reported separately after it
actually occurs.
