# LOC-094 attempt 1

## Identity and scope

2026-10-21, Codex, D:\Projects\dubbl, master. Clean tree at entry. Controller
selected LOC-094, the bounded project overview/navigation child of LOC-068.
This record describes the verified task diff before its commit. Parent
LOC-068/008/002 acceptance and LOC-095..098 remain independent.

## Implementation and acceptance mapping

1. Added 89 paired ProjectOverview messages (8,242 compatible leaves per
   locale). Project overview and shared header/navigation, cards, activity
   lists, enum/role/billing labels, chart copy/series/units, calendar copy and
   invoice feedback use real next-intl. The shared presentation hook localizes
   date/duration helpers without changing sibling compatibility exports.
   The mini calendar now reuses the existing independent calendar adapter;
   canonical Gregorian event lookup, start/end rings, event dots, overdue
   color and Today/month callbacks remain. Explicit authored/data/machine/
   symbol and unconverted-sibling exceptions are in
   [PROJECT_OVERVIEW_CATALOGS](../registries/PROJECT_OVERVIEW_CATALOGS.md).
2. Checked detail and invoice readers preserve the projectCrmJson exact-pair
   boundary and reject failed or malformed responses before state adoption,
   success or navigation. The provider handles missing org/blocked storage,
   settles loading, hides a previous route's project and ignores responses
   after cleanup. Private server/network/parser diagnostics never become
   product messages. Project invoices retain POST, empty JSON, org header and
   the existing sales detail destination. Exact bigint revenue above safe
   integer range, fixed-two cents display, canonical aliases, whole minutes,
   percentages, dates, enum values and feature navigation are preserved.
3. Registry, task handoff and honest self-review record provisional Persian
   and the independent native terminology, RTL, browser and parent gates.
   No REST/MCP/service/schema/migration, authorization, ledger, IRR flag,
   currency or Stripe implementation change was made. Existing get_project
   and generate_project_invoice MCP tools already cover these operations.

## Verification

All commands ran from D:\Projects\dubbl. Final results have zero skips.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/project-overview-catalogs.test.ts tests/project-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/project-master-wire.test.ts tests/project-billing-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 51/51 pass; the executed invocation also supplied a nonexistent date-pickers.test.ts path, which this runner ignored; actual calendar suite ran separately below |
| node --import tsx --test tests/calendar.test.ts | 6/6 pass, including independent calendar/numeral/TZ preferences, actual picker grids and date callbacks |
| Explicit TEST_DATABASE_URL/PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/project-master.test.ts tests/integration/project-billing.test.ts | 2/2 pass; final run 30.286 seconds; real REST, linked registered MCP, independent SQL/scope/rollback assertions |
| pnpm typecheck | Pass, including generated MDX and tsc --noEmit |
| pnpm i18n:check | Pass; 8,242 compatible keys per locale |
| pnpm exec eslint on all nine changed TS/TSX files | Pass; zero errors/warnings |
| pnpm lint | Pass; zero errors and 26 existing warnings outside this task's files |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 schema columns and 1,799 consumer hashes/occurrence lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| python .agentic/agent.py validate; git diff --check | Pass; 325 structurally valid tasks; no whitespace errors |
| Semantic catalog/inventory comparison with HEAD | All pre-existing locale namespaces unchanged; all 417 schema entries preserved; changed inventory consumers limited to owned files |

The integration fixtures used an isolated PostgreSQL 18 cluster under OS temp,
trust authentication, 127.0.0.1:6472, max_locks_per_transaction=256. Random
dubbl_ci_* databases were dropped by the fixtures. Final admin count was zero;
pg_ctl stopped the cluster. Application .env/database was not used. No secrets
were printed or persisted. No full build or dev startup was run.

The master worker passes real get_project REST/MCP DTOs through the new detail
reader; the billing worker checks generated invoice REST/MCP responses through
the new invoice reader. Existing independent SQL, tenancy, permissions, audit,
retry, history and atomic-failure checks remain. The money source guard now
recognizes those delegated readers while requiring projectCrmJson validation.

Initial checks exposed mismatched ICU plural structures, a missed title/empty
label, a synchronous effect-state lint violation and test-harness ESM/CommonJS
provider context mismatch. These were fixed and the final checks above passed.
A broad catalog text replacement briefly changed an unrelated existing English
key; it was restored before final validation, and semantic comparison confirms
all existing namespaces match HEAD. Inventory generation normalized three
unrelated schema comment characters; their exact prior entries were preserved
before the final inventory verification. No schema implementation changed.

## Review and handoff

Codex self-review is separate; no independent peer or human approval is claimed.
No full unit/integration suite, browser interaction, native terminology review,
complete RTL/output qualification, hosted CI, deployment or production
qualification is claimed. LOC-095 is next; LOC-068/008/002 remain open. Final
commit/push SHA parity and clean-tree verification are reported from Git after
controller completion.
