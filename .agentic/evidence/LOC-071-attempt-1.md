# LOC-071 combined acceptance evidence

Date: 2026-10-23 (Asia/Tehran). Operator: Codex. Repository: D:/Projects/dubbl.
Entry: master at 58c4b552113eb95db87422c7527dd16ead4f63ad, clean tree.
The live controller selected LOC-071 after LOC-116..119 completion. Started only
this task. User authorized completion and push. Fetch confirmed zero ahead/behind
origin/master before commit. Applied the previously read controller-task skill
and current repository rules. No subagents were used.

## Acceptance mapping

1. Independently reconciled the current two dashboard and two document routes,
   plus eleven shared surfaces. Nine namespaces contain 341 paired messages,
   including existing shared catalogs counted once. No further product extraction
   is needed. The new AST/source test pins both route directories, fifteen source
   files, observed namespace set, paired key count, Persian script, notification/
   title translation and exact English JSX exceptions. Detailed ownership and
   data/template/Stripe/formatting exceptions are recorded in
   [combined acceptance](../registries/DASHBOARD_DOCUMENT_CATALOG_ACCEPTANCE.md).
   Child evidence was read and preserved, not substituted for parent acceptance.
2. New combined tests render the production dashboard with actual ActivityFeed
   and CashFlowWidget under one real PresentationProvider/next-intl context.
   They verify translated known activity and forecast errors, escaped caller and
   unknown audit technical data, exact KWD low digits, audit navigation and period
   callbacks. A second composition renders production workspace, send dialog,
   email history, attachment list and its actual nested uploader with shared
   errors/loaders in both locales. Both real loading routes are covered. Existing
   child operation/error-state suites, exact-money/public/render adapters and
   catalog regressions rerun on current source. Three migrated PostgreSQL suites
   cover authenticated REST, linked registered MCP calls, permission/tenant denial,
   unsafe/invalid values and independent SQL state snapshots.
3. Scope registry, catalog index, task Handoff and honest self-review retain
   provisional Persian and independent LOC-008 residual shared-operations,
   LOC-002 whole-product, LOC-009 authored output, native/RTL/calendar/numeral and
   browser/release acceptance. Completing this parent does not complete LOC-008.

## Changes and contract review

Only the new combined test, scope registry, catalog index, generated money test
inventory, selected task and unique attempt/review evidence change. Product code,
catalogs, APIs/MCP, schemas/migrations, organization/auth contracts, saved exact
money/FX, IRR flags and Stripe files are unchanged. Inventory comparison shows
only the new test consumer and scanned-path addition; classifications stay intact.
Existing direct-DB MCP dashboard, forecast, render, preview, email history/send and
file surfaces were inspected through the child inventories and current regression
workers. No new user operation is introduced or full backend parity claimed.

## Verification

Commands ran from D:/Projects/dubbl.

| Command | Actual result |
|---|---|
| node --import tsx --test tests/dashboard-document-catalog-integration.test.ts tests/dashboard-overview-catalogs.test.ts tests/document-workspace-catalogs.test.ts tests/document-email-history-catalogs.test.ts tests/document-send-catalogs.test.ts tests/message-catalogs.test.ts tests/contact-dashboard-ui.test.ts tests/document-render-wire.test.ts tests/public-ui.test.ts | Exit 0; 49 passed, zero failures/skips |
| node --import tsx --test --test-concurrency=2 tests/integration/dashboard-data.test.ts tests/integration/dashboard-report-integration.test.ts tests/integration/document-rendering.test.ts | Exit 0; three passed, zero failures/skips |
| pnpm i18n:check | Exit 0; 9,660 compatible keys per locale |
| pnpm typecheck | Exit 0; generated MDX and tsc --noEmit |
| pnpm exec eslint tests/dashboard-document-catalog-integration.test.ts | Exit 0; zero findings |
| pnpm lint | Exit 0; zero errors, 21 warnings in unchanged files |
| python .agentic/scripts/money_inventory.py --write | Exit 0; indexed new owned test |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 417 columns, 1,839 consumer hashes/occurrences |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks |
| git diff --check | Exit 0 |
| python .agentic/agent.py validate | Valid; 351 tasks |

Final DB fixtures used a unique OS-temp PostgreSQL 18.6 cluster with trust auth,
127.0.0.1:4731 and max_locks_per_transaction=256; TEST_DATABASE_URL and PG_BIN
were explicit process-scoped values. Each suite applied current migrations in a
randomly named disposable database. Final admin SQL found zero dubbl_ci_ databases;
pg_ctl stopped the isolated server. No provider email was delivered; SMTP is mocked.
An initial run derived a loopback target from the existing environment but stopped
at permission-denied CREATE DATABASE (no database/data mutation). It was replaced
with the isolated cluster. A Windows inherited-pipe startup wait required stopping
only the task's launcher process, then using the already-ready isolated cluster
with inherited stdio; final tests and shutdown completed normally.

Initial composition expected the populated Documents title while using the empty
onboarding state; supplying the intended populated fixture fixed that assertion.
Lint caught the reserved module variable name in the harness; renaming it fixed
the rule. The final commands above all passed after those harness corrections.

## Limits and handoff

Controlled hooks, portals, charts, animations and IO do not establish mounted
effects, browser/keyboard/RTL layout or real SMTP/S3 delivery. Existing response
adoption and operation-parity limitations in child inventories remain explicit.
No build, dev server, hosted-CI, deployment or production qualification ran.
Persian wording needs native review. Codex self-review is recorded separately;
no human, native or independent peer approval is claimed. After scoped commit and
push, report the next controller task and stop.
