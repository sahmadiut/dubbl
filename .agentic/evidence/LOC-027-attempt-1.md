# LOC-027 attempt 1 - independent combined contacts catalog acceptance

2026-10-19 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `b697e873faa1a1bbb1bb80b11b3283ab3646acff`; entry tree clean.
Controller validate/status/next selected LOC-027 after LOC-057..060 were done.
Started exactly this integration parent. User requested completion and commit;
no push is authorized or performed. No subagents were used.

Read applicable repository/controller/frontend instructions, current contacts
source, dependency evidence, child inventories, catalog contracts and existing
REST/MCP operations. Applied the memory controller-task skill for bounded scope,
safe verification, honest self-review and task-owned local staging.

## Acceptance mapping

1. [Combined inventory and exceptions](../registries/CONTACT_CATALOG_ACCEPTANCE.md)
   independently reconcile all nine contacts routes, shared picker and owned
   ContactDrawer. Seven namespaces retain 295 paired messages and 6,042 total
   keys per locale. No unexplained authored English JSX or display attributes
   remain in the audited scope. Technical samples, caller data, opaque service
   descriptions, machine values and later number/date presentation are explicit
   exceptions. Persian remains provisional pending native terminology review.
2. New [combined tests](../../tests/contact-catalog-integration.test.ts) render
   the actual layout with all six pages and real ContactContext under the
   presentation provider. Both locales, USD/JPY/KWD, low digits at the safe
   integer limit, caller escaping, shared activity configuration, account
   selectors, primary/visibility badges, tab selection and loading/empty/missing
   states pass. Actual production JSX handlers retain their closures: changing
   credit input in Details and submitting Bookkeeping sends exact KWD minor
   strings with preserved headers/fields. Pending state disables both tabs;
   disagreeing saved aliases retain prior contact state, localize failure and
   reset saving. Child callback suites and real migrated REST/MCP/SQL regression
   suites also pass together on current source.
3. Combined registry, catalog index and task handoff record scope, exceptions,
   provisional Persian and independent LOC-007/002/native/RTL/output acceptance.
   [Honest self-review](LOC-027-review-1.md) records actual findings and limits.
   No production source/catalog/API/MCP/service/money/schema/migration/Stripe
   change is needed. Existing child evidence is immutable and unmodified.

## Actual verification

| Check | Actual result |
|---|---|
| Focused combined/four-child catalogs and contact money/wire suite, concurrency 2 | 52/52 passed, no skips; 11.475 seconds |
| Full unit/static suite, concurrency 4 | 986/986 passed, no skips; 117.415 seconds |
| Migrated contact wire, statement/activity/export/email and combined report/contact REST/MCP/SQL suites, concurrency 1 | 3/3 passed, no skips; 30.749 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 6,042 compatible keys per locale |
| Changed-file ESLint | Exit 0; no errors/warnings |
| Full pnpm lint | Exit 0; zero errors, 68 existing warnings outside changed files |
| Money inventory generation/source check/verifier | Passed; 417 columns, 2,272 scanned files and 1,704 consumer hashes. Only the new combined test's consumer entry/hash is added; classifications and existing consumers are unchanged. |
| Legacy money gate | Passed; nine regression checks |
| Controller structural validation and git diff --check | Passed before disposition; repeated during completion |

Commands from repository root:

```text
node --import tsx --test --test-concurrency=2 tests/contact-catalog-integration.test.ts tests/contact-detail-catalogs.test.ts tests/contact-financial-catalogs.test.ts tests/contact-list-catalogs.test.ts tests/contact-people-files-catalogs.test.ts tests/contact-dashboard-ui.test.ts tests/contact-wire.test.ts tests/contact-statement-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/contact-wire.test.ts tests/integration/contact-statement.test.ts tests/integration/report-contact-cutover-acceptance.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js tests/contact-catalog-integration.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database checks used a newly initialized PostgreSQL 18 cluster bound exclusively
to 127.0.0.1:55427 with explicit process-scoped TEST_DATABASE_URL and PG_BIN.
Fixtures created, migrated and dropped randomized databases. Independent admin
SQL confirmed zero remaining `dubbl_ci_*` databases before stopping the server.
No application DB was accessed. Actual email delivery/storage was not exercised.

The first new test run exposed test-harness errors: an incorrect catalog key,
ESM/CommonJS next-intl module identity in the real shared loader, and a TypeScript
unknown-props annotation. Corrected the key, shared the ESM BrandLoader module
with the real provider and typed captured form props. Final focused/full suites
and typecheck pass. The initial source inventory correctly reported the new
test's missing entry; regeneration added only that consumer. Some read-only
searches used nonexistent paths/unsupported PowerShell wildcards and were rerun
against the actual files. No production defect or unresolved check remains.

## Review and handoff

Composition tests control hooks/effects/navigation, portal boundaries and IO;
manual rerendering is not mounted-browser interaction. Database assertions do
exercise real authenticated REST, registered MCP and independent SQL. Existing
MCP contact list limit/filter/balance differences and missing add-person/file
download/delete tools are documented gaps, not claimed resolved by localization.

LOC-007/002 retain independent acceptance. Native terminology, comprehensive
RTL/font/browser, number/date adapters, generated service/PDF/email translation,
live providers, hosted CI, production migration/deployment and IRR enablement
remain separate. No full build, dev server, Docker, deployment or dedicated
Stripe work ran. Finish controller disposition, commit task-owned files, verify
the local commit/clean tree, report the next task and stop. Commit evidence is
reported to the user only after it occurs.
