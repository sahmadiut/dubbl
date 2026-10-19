# LOC-026 attempt 1 - combined purchasing catalog acceptance

## Identity and scope

2026-10-19 (Asia/Tehran), Codex. Entry repository D:/Projects/dubbl, master,
HEAD 01b0720a861f3601c9b8e20f38fd83d5f1d40b73. The entry tree was clean.
Live controller validate/status/next selected LOC-026 after LOC-048..056 were
done. Started exactly this integration parent; child completion alone was not
treated as parent acceptance. LOC-007/002 remain independently open.

Read root/.agentic instructions, START_HERE, controller, PROJECT/REPOSITORY_MAP,
frontend role, source localization sections, message contract, all nine child
registries and relevant dependency evidence, actual forms and REST/MCP fixtures.
Used the memory controller-task skill. No subagents were used.

A concurrent unrelated font change appeared in line-items-editor.tsx after
entry. Preserved it. Created an isolated detached worktree at the same entry
HEAD under OS temp and copied only this task's new test and started task record.
The installed node_modules directory is shared through a junction. Final full
unit/static, typecheck, lint, catalog and money checks ran in that isolated
checkout, excluding the concurrent font edit. Initial focused suites and the
database workers ran from the primary checkout; the unrelated edit affects
presentation classes, not the REST/MCP/service source exercised by those workers.
Only LOC-026 files are delivered; no existing child evidence is rewritten.

## Acceptance mapping and changes

1. Independently audited all 18 purchasing route TSX files, four production
   creation drawers and eight shared controls against current source and child
   inventories. The [combined registry](../registries/PURCHASING_CATALOG_ACCEPTANCE.md)
   records 863 purchasing messages plus 38 reused DocumentForms messages, with
   explicit caller/machine/example/formatting exceptions and adjacent ownership.
   Both current catalogs have 5,788 compatible keys. No remaining scoped copy
   gap required application or catalog edits.
2. Added [combined tests](../../tests/purchasing-catalog-integration.test.ts):
   real production drawer bodies with real footer, line/expense amount/date
   controls and next-intl/PresentationProvider. Both languages cover ready/busy
   states, disabled submission, escaped caller data, exact
   4,000,000,000,000,001 minor units in USD/JPY/KWD, translated invalid previews,
   missing-total sentinels, bill supplier/currency/validity gating and composed
   list/detail navigation. Combined AST checks pin the complete source inventory.
   Existing child callback and migrated REST/MCP/SQL suites run on current source.
3. Updated the message index, combined scope and task handoff; recorded an honest
   self-review. Persian terminology remains provisional; native/RTL/browser and
   LOC-007/002 acceptance retain their independent gates.

No application, catalog, money helper, REST/MCP/service, schema, migration, FX,
IRR flag or Stripe changes. Existing registered purchasing MCP operations remain
org-scoped via AuthContext, described and wrapped by wrapTool, using shared
direct-DB services. No new operation or REST route needs a new tool.
Recurring bill/expense fixed-two units, landed-cost component conversion,
ordinary currency scales, exact quantity/rounding policies and stored history
remain unchanged.

## Actual verification

| Check | Actual result |
|---|---|
| New composition/source suite | Exit 0; 6/6 passed, no skips |
| Nine child suites plus shared-document and bank-payment suites, concurrency 2 | Exit 0; 84/84 passed, no skips; 44.330 seconds |
| Full unit/static suite in isolated checkout, concurrency 2 | Exit 0; 956/956 passed, no skips; 236.005 seconds |
| Migrated PostgreSQL REST/MCP/SQL groups, concurrency 1 | Exit 0; 21/21 passed, no skips; 249.651 seconds |
| Isolated pnpm typecheck | Exit 0 |
| Isolated pnpm i18n:check | Exit 0; 5,788 compatible keys per locale |
| Isolated full pnpm lint | Exit 0; zero errors, 68 existing warnings in unchanged files |
| Final changed-file ESLint | Exit 0; zero errors/warnings |
| Isolated money inventory verifier | Exit 0; 417 schema columns, 1,698 consumer hashes and occurrence/source lines |
| Isolated legacy money gate | Exit 0; nine regression checks |
| Pre-delivery origin fetch/divergence | Entry master and origin/master 0 ahead / 0 behind |
| Controller validation and git diff --check | Passed; final disposition revalidated before delivery |

Commands (repository root or isolated checkout as described above):

```text
node --import tsx --test tests/purchasing-catalog-integration.test.ts
node --import tsx --test --test-concurrency=2 tests/goods-receipt-catalogs.test.ts tests/bill-catalogs.test.ts tests/recurring-bill-catalogs.test.ts tests/expense-catalogs.test.ts tests/debit-note-catalogs.test.ts tests/requisition-catalogs.test.ts tests/purchase-order-catalogs.test.ts tests/landed-cost-catalogs.test.ts tests/shared-purchasing-catalogs.test.ts tests/shared-document-catalogs.test.ts tests/bank-payment-catalogs.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/bill-reads.test.ts tests/integration/bill-writes.test.ts tests/integration/bill-bulk.test.ts tests/integration/bill-lifecycle.test.ts tests/integration/bill-ui-money.test.ts tests/integration/bill-editor-money.test.ts tests/integration/document-editor-money.test.ts tests/integration/recurring-bill-ui-money.test.ts tests/integration/recurring-payables.test.ts tests/integration/expense-crud.test.ts tests/integration/expense-lifecycle.test.ts tests/integration/expense-ui-money.test.ts tests/integration/debit-notes.test.ts tests/integration/debit-note-ui-money.test.ts tests/integration/purchase-requisitions.test.ts tests/integration/purchase-orders.test.ts tests/integration/goods-receipts.test.ts tests/integration/procurement-ui-money.test.ts tests/integration/inventory-valuation.test.ts tests/integration/payable-procurement-integration.test.ts
pnpm typecheck
pnpm i18n:check
pnpm lint
node node_modules/eslint/bin/eslint.js tests/purchasing-catalog-integration.test.ts
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database execution used a new randomized OS-temp PostgreSQL 18 cluster bound
only to 127.0.0.1:13496, with explicit process-scoped TEST_DATABASE_URL and PG_BIN.
Existing fixtures migrate/drop random dubbl_ci_* databases and run real REST,
linked registered MCP and independent SQL assertions. Twenty suite files yield
21 test groups because inventory-valuation also checks its additive migration.
Final fixture database count was zero; the dedicated cluster stopped in finally.
Stopped cluster data remains in OS temp. No application database, production
migration or PostgreSQL 16 qualification is claimed.

The first composition harness used nonexistent message-key names and assumed
expense totals used a code prefix rather than their existing currency formatter.
Corrected those test expectations against actual source: decimalError is the
reviewed invalid-expense error; exact grouped digits retain the formatter's
currency-specific prefix. Removed a nonexistent unconditional purchase-tax hint
expectation; reclaim hints require selected tax data and remain covered by the
shared-document suite. Final focused and isolated full suites pass. No product
defect was hidden or repaired.

## Review and delivery boundaries

Codex performed [self-review](LOC-026-review-1.md), not independent peer, human,
native linguistic or accounting approval. Composition controls initial hooks,
effects, navigation, adjacent pickers/uploaders and portals; it does not mount
browser events. Child tests execute original callback syntax; database workers
separately exercise actual REST/MCP/SQL. This does not certify every business
workflow or complete date/numeral/RTL/font/browser qualification.

No build, dev server, Docker, provider request, deployment, application database
or IRR enablement ran. Broad unchanged unit regression checks do not constitute
dedicated Stripe work. LOC-007/002 and later native/RTL/release gates remain open.
Finish controller review/done and scoped commit/push; verify remote SHA and the
isolated task tree, while preserving the primary checkout's unrelated font edit.
Actual commit/push and primary checkout status are reported separately on delivery.
