# MON-074 attempt 1 - exact inventory variants and suppliers

## Identity and task selection

2026-10-04 through 2026-10-05, Asia/Tehran. Implementing operator:
coding-assistant. Entry HEAD b71a984, clean master tree. User requested the next
task followed by commit/push when finished. Controller validate/status/context
selected MON-024. Read applicable instructions, START_HERE/controller/project/
repository map/backend role, MON-011 and MON-052 evidence, ADR-006, money manifest,
source migration/API sections, actual schemas/routes/tools/editors and DB harness.

Source inspection found separate catalog, master/import, stock/warehouse, valuation/
landed-cost and BOM/assembly domains. Split MON-024 into MON-074 through MON-078
per controller guidance; parent retains all original criteria, combined writer
qualification and MON-052 goods-receipt handoff. Parent is blocked on children.
MON-074 alone was claimed and implemented. No delegation or independent review.
This evidence describes the verified uncommitted changes before controller closure.

## Implementation result

- New inventory-catalog-wire.ts supplies described strict REST/MCP schemas and
  explicit price/physical-unit DTOs. Numeric cents retain their values; additive
  purchasePriceMinor/salePriceMinor strings must agree and fit safe Number range.
  Null historical prices and quantities stay null. Invalid/unsupported saved
  prices fail before updates can mask them. Creation defaults prices/quantities
  zero and options {}; patch omissions retain fields.
- Shared inventory-catalog.ts direct-DB services scope parent, child and predicates
  by organization. Parent/child locks, supplier-reference share locks, duplicate
  guard, output preflight and transactional audit prevent partial writes. Reads
  use repeatable-read snapshots. Supplier reads scope joined contact ownership;
  foreign historic bad links cannot disclose names/emails. Create/patch require
  live owned supplier/both contacts; deletes allow safe bad-link cleanup.
- Replaced four REST route files with thin handlers, preserving existing success
  envelopes/statuses and classifying malformed JSON. New inventory-catalog MCP
  file registers all eight corresponding operations, uses wrapTool and is wired
  into the full registry. All fields describe inputs, units and expectations.
- Variant editor now consumes actual data/inventoryVariant envelopes; previously
  it read variants/variant and would fail to show returned rows. Optional options
  fixes the omitted-map editor submission. Both editors parse decimal prices with
  BigInt, reject partial physical quantities/days and display exact safe-edge cents
  with the existing formatter. Existing USD two-decimal presentation is retained.
- Registry INVENTORY_CATALOG_WIRE_CONTRACTS, manifest/README/test matrix, controller
  source coverage/task index and refreshed inventory document the bounded change.
  No schema/migration/ledger/FX/currency-policy/production-flag change.

## Acceptance mapping

1. Registry inventories all eight real operations/envelopes, fields, cents/string
   aliases, nullable history, safe bounds, signed whole-unit variant metadata and
   nonnegative int32 lead days, default/patch behavior, authorization and errors.
   Currency-less catalog prices do not infer org/contact currency or rescale values.
2. Pure fixtures and actual PostgreSQL/API-key handlers plus SDK InMemoryTransport
   cover legacy, exact and dual inputs, safe-max and >int32 prices, output parity,
   strict described schemas/full unique tool registration, two tenants, conflicting
   org header, viewer/custom-manager roles and invalid/expired credentials.
3. Text SQL snapshots verify invalid inputs, foreign/missing/deleted resources,
   unsafe raw bigint history and bad joins cause no adopted writes/audits. Mixed
   REST/MCP duplicate supplier creation has one winner and one audit. Injected
   audit failure rolls back all six write services and verifies the actual SQL
   exception cause. Catalog operations leave parent stock and all ledger/movement/
   warehouse/FIFO tables unchanged. Null prices, deleted owned supplier history,
   cleanup of malformed links and independent physical ranges are qualified.

## Actual verification

Commands ran in D:/Projects/dubbl with installed dependencies and existing generated
Next/MDX sources. No full build or dev server. PostgreSQL18.6 initdb created an
isolated synthetic trust-auth cluster at
D:/Temp/dubbl-mon074-pg-51bd6b780b7345e9a545fa207c5d4390/data on 127.0.0.1:55474,
role dubbl_ci. Hidden pg_ctl startup redirected logs. Explicit synthetic
TEST_DATABASE_URL selected this server; each harness case migrated/dropped a random
fixture database. Configured .env database was not read, migrated or reset. No real
customer data/secrets/providers were used. Startup's Windows Start-Process -Wait
stayed attached to the process tree while the server ran; separate pg_isready and
psql checks confirmed readiness, and shutdown closes that startup invocation.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start/split/start MON-074 | Exit 0, valid 128-task graph | Structural only |
| Initial node --import tsx --test tests/inventory-catalog-wire.test.ts tests/integration/inventory-catalog.test.ts | Exit 0, 4/4 | First pure/actual PostgreSQL pass |
| npm test | Exit 0, 218/218 | Full unit suite, no independent financial approval |
| npm run lint | Exit 0, 0 errors/143 existing warnings | Same count as MON-073 entry evidence |
| Final strengthened catalog pure/PostgreSQL command above | Exit 0, 4/4 | Actual handlers/full SDK; no browser session |
| node --import tsx --test tests/inventory-catalog-wire.test.ts tests/integration/inventory-catalog.test.ts tests/integration/goods-receipts.test.ts | Goods-receipt suite passed, catalog failed on strengthened assertion's wrapper matching; pure 3/3 passed | Corrected and reran catalog; receipt regression passed |
| npx tsc --noEmit; changed-file eslint | Exit 0, clean changed TS files | Includes editors, routes, services, tool registry and tests |
| Final npx tsc --noEmit and final worker eslint | Exit 0 | After strengthening cause assertion |
| Final money_inventory.py --write, verify; verify_money_inventory.mjs with --import tsx | Exit 0, 410 columns; source/hashes match | Lexical source inventory, not dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | No new legacy helper usage |
| psql remaining random fixture count; pg_ctl fast/wait stop | Zero fixture DBs, server shutdown exit 0 | Synthetic cluster only |
| git fetch origin; rev-list HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Push follows task closure |
| git diff --check | Exit 0 | LF/CRLF conversion notices only |

After the initial 4/4 pass, self-review strengthened negative fixtures, safe-edge
display, nullable/foreign history, duplicate audit count and exact audit-failure
matching. Drizzle wraps the PostgreSQL exception, so matching its top-level message
failed although rollback occurred. Changed the assertion to inspect the actual
cause. Final catalog command passes, proving all six failures originate in the
audit trigger. Small README/task trailing blank lines were fixed before diff check.

## Review, limits and handoff

See MON-074-review-1 for honest implementing-assistant self-review. No bounded
slice blocker remains. Safe Number business/ORM support is explicit; strings do
not promise full int64 handling. Parent MON-024 and MON-075 through MON-078 own
remaining inventory and cross-writer valuation. Catalog currency policy, broader
contact-merge concurrency, large unpaginated collections, historical generic
imports/opaque payloads MON-033/034 and production/IRR/independent accounting/
security gates are separate. Browser/session/OAuth and PostgreSQL16 are untested.

No schema generation, production migration, build/dev/Docker/browser/live provider,
deployment or new statutory rule. Next: controller acceptance/review/done, validate/
status, user-authorized commit/push, then stop. Next task: MON-075.
