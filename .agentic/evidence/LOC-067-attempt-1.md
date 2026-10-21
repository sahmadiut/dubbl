# LOC-067 attempt 1 - combined payroll catalog acceptance

2026-10-21 (Asia/Tehran), Codex. Base `0a8a81f1` on master; clean entry tree.
The owner requested one next task completed and pushed. Controller selected
LOC-067 after LOC-079..092. Inspected AGENTS, START_HERE, project/map/frontend
and controller instructions, selected task/parent, child scope and self-review
records, message catalog contract, all payroll route sources and two drawer
bodies, presentation readers, shared controls, output helper/service/REST/MCP
ownership and current payroll integration fixtures.

## Acceptance mapping

1. Reconciled exactly 27 payroll TSX route components, EmployeeDrawer and
   ContractorDrawer against 14 namespaces and 1,043 paired messages; 8,053 total
   keys per locale. The [combined inventory](../registries/PAYROLL_CATALOG_ACCEPTANCE.md)
   assigns every component and explicitly records caller/machine/technical
   placeholders, statutory codes, symbol-only templates, shared controls,
   dates/numerals, JSON/CSV and internal error exceptions. No further production
   copy or catalog change was needed. Persian wording remains provisional.
2. New real production composition tests use next-intl/PresentationProvider
   with actual PayrollLayout/TabLayout and workflow pages/shared drawer chrome.
   Current child rendering/callback suites and migrated real REST, linked MCP
   and independent SQL checks were rerun together. Exact fixed-two cents,
   canonical aliases, money/physical-unit distinctions, stored history,
   authorization, tenant isolation and machine contracts remain unchanged.
3. This attempt, the separate honest Codex self-review, task handoff and message
   catalog/combined ownership registries record the accepted scope and explicit
   native Persian/RTL/output/parent/release handoff. LOC-008/002 remain open.

## Implementation and output ownership

Added `tests/payroll-catalog-integration.test.ts`. Its five checks pin all route
filenames and both drawer bodies, audit authored JSX/display attributes/toasts/
document titles, pair all namespaces with named Persian exceptions, compose
three workflows with the same checked employee, preserve high/low exact cents
and escaped caller text, render both drawers with their real shared footer and
check translated failed reads hiding saved employee data while navigation stays.

The tax-form `/pdf` operation still returns JSON and a `.json` download; no
payroll PDF template or translated PDF was invented. Existing unrendered English
JSON diagnostic prose remains an explicit LOC-009 output exception. CSV bytes,
header/data/formula protection and filename retain backend ownership. All owned
UI download/error feedback is catalog-backed. The ambiguous saved `Unassigned`
department fallback and pre-existing settings approval-chain REST-only summary
retain their documented separate contracts, without claiming additional parity.

The only generated money inventory delta is the new test's scanned path and
consumer entry. All existing consumers and all 417 schema classifications match
entry HEAD. No product/catalog, API/MCP/service/auth, database/schema/migration,
stored money, statutory calculation, FX/IRR flag, provider or Stripe file changed.

## Actual verification

Commands ran from D:/Projects/dubbl. No full build or dev server ran.

| Check | Actual result | Boundary |
|---|---|---|
| Combined production composition/source tests | 5/5 pass, zero skips; final run 2.112 seconds | Real production JSX/provider; hooks/IO/portals controlled |
| Current payroll child catalogs, wire, UI money and catalog foundation | 164/164 pass, zero skips; 57.390 seconds | All 14 child workflow suites, malformed-response and callback cases |
| Migrated payroll fixtures across eight files | 11/11 pass, zero skips; 86.690 seconds | Real REST/linked MCP, independent SQL, history/migration/auth/lifecycle |
| Full unit/static suite | 1,247/1,247 pass, zero skips; 288.691 seconds | Node tests/*.test.ts with concurrency 2 |
| pnpm typecheck | Exit 0 after fixing the test's nullable currency argument | fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 8,053 keys per locale | Compatible keys/ICU, not native approval |
| Owned-file ESLint | Exit 0; zero errors/warnings | New combined test |
| Full lint | Exit 0; zero errors, 26 existing warnings outside this change | OS-temp cache |
| Money inventory/source/legacy gates | Exit 0; 417 columns, 2,404 scanned paths, 1,795 consumer hashes; nine legacy checks | Only new test scan/consumer added |
| Controller, local links and diff checks | Pass; 125 local Markdown links resolve | Structural workflow and task-owned scope; repeated at closure |

```text
node --import tsx --test tests/payroll-catalog-integration.test.ts
node --import tsx --test --test-concurrency=1 tests/payroll-*-catalogs.test.ts tests/payroll-*-wire.test.ts tests/payroll-ui-money.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-master.test.ts tests/integration/payroll-config.test.ts tests/integration/payroll-time.test.ts tests/integration/payroll-runs.test.ts tests/integration/payroll-payments.test.ts tests/integration/payroll-outputs.test.ts tests/integration/payroll-compensation.test.ts tests/integration/payroll-integration.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js tests/payroll-catalog-integration.test.ts
pnpm lint --cache --cache-location <OS-temp>/dubbl-loc067-eslint.cache
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database tests used process-scoped TEST_DATABASE_URL/PG_BIN and a new isolated
PostgreSQL 18 cluster under OS temp at 127.0.0.1:6467 with trust authentication
and max_locks_per_transaction=256. Fixtures created/dropped randomized databases.
The final admin query found zero dubbl_ci_* databases; pg_ctl stopped the cluster
successfully. The application database/credentials were not used.

Initial new-test failures reflected incorrect test assumptions: self-service
displays pay in payslip rows rather than the profile salary, the shared footer
uses DocumentForms, and illustrative employee/email placeholders are explicit
exceptions. Corrected the fixtures and exact exception list; the final combined
suite passes. Typecheck also required the checked nullable currency's existing
USD fallback. The money generator initially reported the new unregistered test;
inspection confirmed only that added scan/consumer before regeneration.

## Review and handoff

See [Codex self-review](LOC-067-review-1.md). This is self-review, not independent
peer/human/native/statutory approval. LOC-067 alone is accepted. LOC-008/002,
native terminology, complete RTL/calendar/numerals, mounted-browser/keyboard,
remaining output-copy, hosted CI, deployment and production/IRR qualification
remain separate. Commit/push and live remote parity follow controller closure
and scoped staging; no hosted CI or deployment result is claimed here.
