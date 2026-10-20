# LOC-078 attempt 1 - Inventory valuation and alert catalogs

2026-10-20 (Asia/Tehran), coding-assistant/Codex, `D:\Projects\dubbl`.
Started from clean `master` at `7d404226`, equal to local `origin/master`.
This evidence describes the task-owned working diff; commit/push outcomes are
reported only after they occur. No independent human/peer review is claimed.

## Scope and acceptance mapping

1. Extracted 46 paired `InventoryReports` messages (7,010 keys per locale) for
   valuation and alerts document titles, statistics, table headings, examples,
   empty/no-match states, search, actions, accessible labels and finite feedback.
   The existing shared inventory loading route already delegates to localized
   BrandLoader; its English/Persian rendering was verified without source change.
   Shared inventory navigation, item layout, item/warehouse pickers and inventory/
   warehouse/stock-take/transfer drawers already use earlier catalogs. See the
   [scope and exception inventory](../registries/INVENTORY_REPORT_CATALOGS.md).
2. Real production JSX is rendered through actual next-intl/PresentationProvider
   with controlled hooks/IO. New report readers validate HTTP/JSON/display fields
   before adoption. Valuation retains exact alias, currency/product/aggregate
   validation. Alerts preserves signed saved stock and above-int32 derived reorder
   suggestions and maps the actual API `suppliers` list to the first preferred
   supplier identity. Read failures cannot appear as a healthy empty state, expose
   raw exception prose or leave loading stuck. Missing organization prevents IO;
   effect disposal suppresses stale results. CSV content and financial arithmetic
   are unchanged. Existing registered MCP operations remain in place.
3. Catalog registry, scope/exceptions, this attempt and separate self-review
   record provisional Persian terminology and independent LOC-066/008/002,
   native/RTL/browser/output and release acceptance. No parent is completed by
   this child.

## Verification observed

Commands below ran in the repository root, all final results exit 0 unless
explicitly described as an initial failed check.

| Command | Observed result |
|---|---|
| `node --import tsx --test tests/inventory-report-catalogs.test.ts tests/inventory-ui-money.test.ts` | 17/17 pass: nine new report and eight existing inventory-money checks |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | 1,115/1,115 pass, no failures/cancellations/skips |
| `node --import tsx --test --test-concurrency=1 tests/integration/inventory-ui-money.test.ts tests/integration/inventory-master.test.ts tests/integration/inventory-valuation.test.ts` | 4/4 pass on randomized migrated PostgreSQL databases; no skips |
| `pnpm typecheck` | Pass before and after final effect/test lint fixes |
| `pnpm exec eslint` over both routes, report reader, report/unit-money tests and integration worker | Pass, zero warnings/errors |
| `pnpm lint` | Final pass, zero errors/60 existing warnings |
| `pnpm i18n:check` | 7,010 compatible keys per locale; all new Persian leaves contain Persian script |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned consumers/new reader/test paths; 417 schema-column records unchanged by structural comparison to HEAD |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Pass, 417 columns/1,765 consumers/34,499 occurrences |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks pass |
| `python .agentic/agent.py validate` and `git diff --check` | Pass before controller submission |

The full unit/static suite completed successfully with one worker to bound
host memory use. The final report is retained in OS temp as
`dubbl-loc078-unit.log`; full lint is in `dubbl-loc078-lint-final.log`.

Focused report checks cover both locales; saved, illustrative, empty, filtered,
loading and failure states; escaping of caller strings; USD/JPY/KWD display;
margin ratios below Number precision; canonical request paths/headers; failed
HTTP/network/parser/envelope validation; disposal/missing organization; supplier
mapping; zero/negative stock and above-int32 reorder suggestions. CSV checks
execute the production exporter and assert identical locale output, English
headers/order, quoting, exact low-digit money and original UTC date filename.

The migrated consumer fixture exercises six USD/JPY/KWD REST/MCP workflows.
It now checks the new valuation and alert readers on real REST and linked
registered MCP responses, with independent SQL-text assertions for saved
purchase/carrying values and quantity/reorder/suggestion counts. Existing
inventory master and valuation fixtures also retain tenant/authorization,
historical migration, FIFO, procurement, ledger and audit rollback checks.

Integration used a fresh OS-temp PostgreSQL 18 cluster, only on
127.0.0.1:6438, explicit process-scoped TEST_DATABASE_URL/PG_BIN, local trust
authentication and max_locks_per_transaction=256. Each fixture migrated and
dropped its randomized database. Admin SQL confirmed zero remaining
`dubbl_ci_*` databases, and pg_ctl stopped the cluster in finally. Sanitized
logs and stopped cluster artifacts remain in OS temp. No application DB used.

The initial lint run found synchronous effect setters on the alerts route and
the test harness's reserved `module` variable. Both were corrected, then owned
and full lint passed. Initial money inventory verification correctly reported
owned source drift; regeneration and final verification passed. These initial
failures are not claimed as passes.

## Handoff and limitations

See [Codex self-review](LOC-078-review-1.md). Persian wording remains provisional.
LOC-066/008/002, native terminology, full RTL/date/numeral/input, mounted-browser/
keyboard, output, hosted CI/deployment and production acceptance remain
independent. No full build, unrequested dev server, application database,
provider request, deployment, Docker or dedicated Stripe work ran. Production
REST/MCP/service/auth/schema/migration/ledger/stock-posting/FX/IRR source is
unchanged. Once all required checks and self-review pass, finish the scoped
commit/push, verify remote SHA and clean tree, report live next task and stop.
