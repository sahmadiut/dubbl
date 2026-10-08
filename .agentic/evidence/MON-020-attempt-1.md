# MON-020 attempt 1 - payable/procurement integration

## Identity and scope

2026-10-09, Asia/Tehran. Operator: Codex implementing assistant. Entry master HEAD
031391909c348a97a055a279ea62e435957ebea8; clean working tree. User requested
"complete and push next task". Controller validate/status/next selected MON-020,
the independent integration parent of completed MON-046..054. Started only this
task. Read applicable instructions, controller/project/repository map, backend
role, task/dependency evidence, ADR-006, source migration/API compatibility rules,
all nine contract inventories and actual handlers/services/tools/fixtures.
Review is self-review; no peer/human/accounting/security approval is represented.

## Implementation

- Added payable-procurement-integration test/worker invoking actual authenticated
  REST handlers and full registered MCP SDK clients on disposable migrations.
  Requisition -> PO -> service GRN -> bill -> supplier allowance -> reversal/retry
  retains exact amounts and quantities. Stock GRN/PO billing, void and mixed
  conversion race preserve physical stock/value and release reservations once.
- Found the original debit-note classifier treated any receipt UUID as stock.
  Service receipts now support ordinary allowances; their organization, supplier
  and inventory/warehouse dimensions are checked before posting. A service line's
  bill recognition journal does not make it a stock accrual. Stock/GRNI returns
  retain their existing qualified-only restrictions.
- Inspection found PO conversion could bypass a GRN-created active draft by
  producing an unmatched PO bill: GRN conversion does not reserve quantityBilled,
  while receiptSlices subtracts draft capacity then permits an unmatched remainder.
  Selected PO lines now reject active receipt-linked bills lacking this PO's
  qualified allocation events. No allocation/FX history is guessed or rewritten.
  Sequential operations in both orders and concurrent REST PO/MCP GRN conversion
  verify exclusion before effects, including with match controls disabled.
- Six MCP strict services now receive full strict registered schemas: receipt
  creation, PO conversion and debit-note list/create/update/apply. Unsupported
  top-level controls reject through actual SDK validation; descriptions retain
  units/envelopes and document the new supported/unsupported paths.
- Consolidated the nine inventories in PAYABLE_PROCUREMENT_INTEGRATION; added
  current integration addenda to PO/GRN/debit inventories, MONEY_MANIFEST,
  TEST_MATRIX and refreshed lexical MONEY_BOUNDARIES metadata. No schema/migration
  files or monetary unit changes. Historical completed child evidence is intact.

## Acceptance mapping

1. PAYABLE_PROCUREMENT_INTEGRATION links every child boundary inventory and records
   inputs/outputs/units/aliases/ranges/defaults/permissions/atomicity and remaining
   unsupported paths. REST debit prices are major units; MCP numeric debit prices
   are minor units. Other document numeric prices retain decimal major units.
2. Parent fixture carries actual REST legacy/dual and MCP exact clients across
   documents, compares debit transport prices, tests USD/JPY/KWD scales and above
   int32 import/read/edit/count consumers. Custom-role mutation denial, API-key
   scope despite conflicting headers, foreign bills/suppliers/receipts, registered
   tool uniqueness and strict SDK schemas are verified. All nine child suites
   retain and independently rerun their full operation/auth/range/lock fixtures.
3. SQL-text snapshots cover rejected business/tenant/role/alias/schema/history
   requests, overlapping conversions and injected final debit audit failure.
   Journal/note effects roll back together. Unsafe stored money returns 422;
   compatible numeric and Minor output agrees without bigint serialization loss.
   All journals balance. Independent final account sums are expense +2500,
   AP -2500, inventory +2500 and GRNI -2500 minor units. Physical stock remains
   two units/value 2500 through bill posting/void; receipts are not received twice.

## Actual verification

Commands ran in D:/Projects/dubbl using installed dependencies. Fresh synthetic
PostgreSQL 18 cluster D:/Temp/dubbl-mon020-pg-a4d66c1ba199472d8c1a05587cc7681b,
loopback port 55520 and synthetic trust-auth role dubbl_ci. Explicit
TEST_DATABASE_URL selected it. Each fixture creates/migrates/drops a random
dubbl_ci_* database; the configured application database was not touched. Provider
keys were blank. No .env credentials or real customer data were printed/persisted.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/next/start/context | Exit 0, valid 173-task graph; selected MON-020 | Structure only |
| Initial nine child integration suites, concurrency=2 | Exit 0, 9/9 | Before parent repairs |
| Parent plus affected PO/debit/GRN regression run | Exit 0, 4/4 | After runtime/schema repairs |
| Final parent plus all nine child suites, concurrency=2 | Exit 0, 10/10 | Migrated synthetic PostgreSQL 18; actual handler/SDK transport |
| pnpm test | Exit 0, 359/359 | Unit suite, not production accounting qualification |
| Final pnpm typecheck | Exit 0 | MDX + tsc, installed dependencies; after final fixture additions |
| Final pnpm lint | Exit 0; 0 errors, 106 warnings in unchanged paths | Existing repository warnings remain |
| Changed-path npx eslint, seven changed TS files | Exit 0, no warnings/errors | Includes new fixture pair |
| money_inventory.py --write; money_inventory.py | Exit 0; 415 columns, 1875 paths, 1403 consumers, 26660 occurrences | Lexical inventory, not dataflow proof |
| verify_money_inventory.mjs | Exit 0; Drizzle classifications, hashes and source lines verified | Source metadata |
| verify_legacy_money.mjs | Exit 0; 9 regression checks | No new deprecated helper use |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | User-authorized push follows closure |
| git diff --check; controller validate | Exit 0 | Line-ending notices only |
| Fixture DB count and pg_ctl -m fast -w stop | Zero fixture databases; shutdown exit 0 | Synthetic cluster directory retained outside repo |

Full-repository lint and final typecheck passed before self-review. Initial full lint was intentionally stopped to
serialize memory-heavy checks when available RAM was low; it is not represented
as a pass. The final lint rerun passed with 106 warnings and no errors.

Initial parent fixture used import_job instead of bulk_import_job; corrected the
fixture table name. Its subsequent failure exposed service receipt classification.
The first repair also assumed a service receipt journal meant accrual; source
review showed bill recognition sets that pointer, and the final inventory-based
classifier fixes it. Two patches rejected mismatched context atomically; corrected
and reapplied. Final checks follow all repairs; no failed attempt is hidden.

No full build/dev server, Docker, browser/session/OAuth/live provider, configured
database migration/reset, deployment or IRR enablement occurred. Fixture migrations
qualify test setup, not production migration safety. Full-int64, changed-FX/partial
foreign GRNI, stock return variances, external configuration races, payment
settlement (MON-021), other inventory (MON-024), exports/PDFs (MON-033/034) and
independent accounting/security/localization/release qualification remain separate.

## Review and handoff

See MON-020-review-1.md for honest self-review and final static check results.
Complete acceptance/submit/self-review/done, validate staged content, commit only
task files, push authorized origin/master and verify remote SHA/clean tree.
Stop after MON-020; select but do not start the next controller task.
