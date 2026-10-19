# LOC-049 attempt 1 - supplier bill catalogs

## Identity and scope

2026-10-19 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 7545a807726132bb578dde9669baf8c49b6117c1. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next selected LOC-049; only this bounded child was started.
LOC-026/007/002 retain independent integration acceptance. No subagents were used.

Read root instructions, controller/entry/frontend guidance, project/repository
map, localization requirements, catalog contract, task/parent/dependency records,
existing catalogs/tests and actual bill UI, money, REST/MCP and fixture surfaces.
Applied the memory controller-task skill. DEC-008 preserves Stripe unchanged.
No full build, development server or application database access occurred.

## Implementation and acceptance mapping

1. Added 163 paired SupplierBills messages, bringing each locale to 5,165 keys.
   The [scope inventory](../registries/SUPPLIER_BILL_CATALOGS.md) covers list,
   detail and BillDrawer authored copy with explicit caller/technical data,
   punctuation and existing money/date/quantity/shared-component exceptions.
   Added a finite typed status mapper preserving canonical and unknown codes.
   Due-day text uses real ICU plural rules. Existing namespaces are unchanged.
2. Production list/detail/drawer rendering through real React/next-intl and
   PresentationProvider checks English and Persian empty/populated/error/missing,
   lifecycle/dialog/duplicate/approval/currency states, exact money and escaping.
   State/effects/navigation are controlled; portals and unrelated shared forms
   use explicit boundaries. Original callback syntax executes exact payment,
   supplier-credit, approval/rejection/cancel and create payloads, org scope,
   duplicate warning/override/hard-block distinction, currency fallback and
   strict read aliases. HTTP/HTML/network/invalid success responses use localized
   operation messages; network failures reset busy state. Unknown server prose
   is never displayed. Aborted/stale reads, pagination and canonical filter/sort
   parameters remain intact. No money helper, REST/MCP service, authorization,
   schema/migration or persisted-unit change. Existing MCP tools cover every
   operation; their contracts are unchanged. Final independent migrated fixtures
   exercise real REST, registered MCP and SQL.
3. Inventory, task handoff and review retain provisional Persian wording,
   native terminology/RTL handoff and independent parent acceptance. Shared
   generic forms remain LOC-047/056; supplier payment preview remains LOC-033.
   There is no separate bill edit page/editor in the inspected slice.

## Verification

| Check | Actual result |
|---|---|
| Focused catalog/bill UI/editor tests | Exit 0; 20/20, including 8 new catalog/rendering/behavior/source tests |
| Full unit/static suite, concurrency 4 | Exit 0; 895/895, no failures, skips or cancellations |
| Migrated PostgreSQL bill editor/UI/lifecycle integration | Exit 0; 3/3 REST/MCP/SQL suites |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 5,165 compatible keys per locale |
| Changed-source/test ESLint | Exit 0; no errors or warnings |
| pnpm lint | Exit 0; 0 errors, 69 warnings in unrelated existing files |
| Money inventory refresh/verifier | Exit 0; 417 columns, 1,688 consumer hashes and all occurrence/source lines verified |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog/drawer audit | Exit 0; AST rejects authored English JSX/display attributes, every new Persian message has Persian script; prior catalog namespaces unchanged; shared drawer diff confined to BillDrawer |
| Fetch/divergence before commit | Exit 0; HEAD and origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

Commands:

```text
node --import tsx --test tests/bill-catalogs.test.ts tests/bill-ui-money.test.ts tests/bill-editor-money.test.ts tests/bill-ui-components.test.ts tests/bill-editor-components.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/bill-ui-money.test.ts tests/integration/bill-editor-money.test.ts tests/integration/bill-lifecycle.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two bill pages> components/dashboard/create-drawer.tsx i18n/bill-presentation.ts tests/bill-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

PostgreSQL 18 ran on loopback port 55449 using a newly initialized temporary
trust-auth test cluster and an explicit TEST_DATABASE_URL. Fixtures created,
migrated and dropped randomized databases; the test cluster shut down cleanly.
No application database or external provider was contacted. General full-suite
coverage includes existing Stripe tests; no dedicated Stripe work occurred.

Money inventory changes are mechanical scan/hash/occurrence updates for the owned
sources, catalogs and test. The refresh also includes the already committed
sales-catalog-integration test previously absent from the scan; its source is
unchanged. Column policy/classification and monetary behavior are unchanged.

The first new creation callback test used a non-UUID expense account fixture;
the actual existing schema rejected it. Replaced it with a valid fixture UUID,
then the focused/full/static checks passed. This was a test-fixture correction,
not a production schema or validation relaxation.

## Review and handoff

See [honest self-review](LOC-049-review-1.md). No mounted browser/layout, native
Persian financial terminology, hosted CI, deployment or production IRR acceptance
is claimed. No full build or dev server was run.

Finish controller checks/submit/self-review/done, commit only task-owned
source/catalog/test/planning/evidence/inventory files, push origin/master,
verify remote SHA and clean tree, report the live next task and stop. LOC-026
remains queued for independent combined purchasing acceptance after its children.
