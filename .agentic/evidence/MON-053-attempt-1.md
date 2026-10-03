# MON-053 attempt 1 - exact bill bulk contracts

## Identity and selection

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD 3697454, clean
master tree. User requested the next task and commit/push after full completion.
Controller validate/status/context selected MON-053, and start claimed it.
Self-review only; no delegation or independent/human approval.

Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, MON-053/MON-020 scopes, MON-011/047/048 dependency evidence,
ADR-006, source migration/API compatibility sections, money manifest, adjacent
invoice bulk contracts and actual REST/MCP/CSV/bill/money/schema/test source.

## Implementation

- bill-bulk-wire validates flat mapped rows, source dates/currency, exact major/
  minor price and extended-amount aliases, physical quantities and grouped
  headers. Reuses the established exact ratio/price policy. All price/product/
  override/group arithmetic is bigint, with explicit safe-number bridging.
  Retains extended-price rounding, independent amount overrides, signed/negative
  drafts, USD default and zero-tax policy. Well-formed US/European money grouping
  and parenthesis negative rounding survive without parseFloat/junk-to-zero.
- bill-bulk shares preview/import between actual REST and registered MCP. Preview
  retains flat data/row/valid/errors and line counts, adding stored minor money
  numeric fields plus Minor strings. Invalid group members/headers/sums and
  scoped references mark the group invalid; no writes occur.
- All malformed/unsupported monetary inputs preflight before jobs. Missing/
  unavailable/ambiguous references and periods/DB failures remain per-document
  failures. Literal case-insensitive names/codes avoid the old LIKE wildcard
  resolver. Missing supplied account codes fail instead of silently becoming null.
- Organization/reference locks, shared nextBillNumber, draft header, all lines
  and create audit share a transaction. Failed lines/audit consume no number and
  leave no header/lines. Generated numbers honor supplied numeric/BILL forms,
  serialize concurrent imports and reject signed-int32 exhaustion.
- Job envelope retains input-line totalRows and document processedRows/errorRows,
  group-ordinal errorDetails, partial completed/all-failed status and final
  best-effort summary audit. Reimport creates additional drafts; no durable resume
  or idempotency key, ledger/stock/payment/settlement posting is introduced.
- Thin REST routes use guarded JSON/malformed-body classification. New distinct
  preview_bill_import/import_bills MCP tools use AuthContext/wrapTool/direct DB
  and are registered in index.ts. Every input field is described. CSV wizard and
  template mapping expose currency and all price/override aliases.
- Added pure and real migrated PostgreSQL REST/API-key/full-SDK fixtures, registry,
  API/MCP docs, money README/manifest/test matrix and refreshed lexical inventory.

## Acceptance mapping

1. BILL_BULK_WIRE_CONTRACTS inventories both REST/MCP operations, envelopes,
   source/flat grouping formats, USD/default currency scaling, major/minor and
   extended-override semantics, signed rounding, quantity/count/date units, safe
   ranges, malformed/authorization/partial-job errors and retry/numbering limits.
2. Real handler/registered-SDK fixtures exercise numeric, CSV numeric-text,
   exact-major, exact-minor and dual clients through no-write preview/import and
   persisted get_bill aliases. USD/JPY/IRR/KWD, above-int32, safe maximum, signed/
   formatted overrides and grouped documents retain values. API-key/custom-role/
   invalid-key tests, conflicting org header, foreign/deleted/ambiguous supplier,
   foreign/inactive/missing account and literal wildcard tests establish scope.
3. SQL-text snapshots show invalid/unsafe prices/products/overrides/group sums/
   aliases/dates and permission failures leave jobs/business state unchanged.
   Period/closed-year/reference failures preserve business state while reporting
   job failures. Injected line/audit constraints prove header/line/create-audit/
   sequence rollback; partial, repeated and concurrent jobs and supplied-number
   collision/exhaustion are asserted. Jobs serialize normally and bill reads have
   exact aliases; ledger/stock/payment/allocation counts remain zero.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18 cluster at D:/Temp/dubbl-mon053-pg-3fbe45714e2d4a7c9c2886aa70e229d9,
loopback port 55463, synthetic dubbl_ci trust-auth role. Hidden pg_ctl startup
redirected output. Explicit TEST_DATABASE_URL/PG_BIN selects only this server;
harness creates/migrates/drops random fixture databases. Configured .env/database
was not read/migrated/reset; no credentials or customer data printed/persisted.
Provider keys are blank in workers; no live providers, dev server or full build.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-053 | Exit 0; valid 104-task graph and selected task | Structural only |
| Final node --import tsx --test tests/bill-bulk-wire.test.ts | Exit 0; 3/3 | Pure contracts including quantity boundaries/template aliases |
| npm test | Exit 0; 164/164 | Full unit suite; final quantity assertion added afterward passed targeted rerun |
| Final bill-bulk/bill-writes/bill-reads/invoice-bulk integration command | Exit 0; 4/4 | Actual handlers/registered SDK in migrated synthetic PostgreSQL |
| Final npx tsc --noEmit | Exit 0 | Installed dependencies and existing generated sources |
| npm run lint | Exit 0; 0 errors/155 existing warnings | Full lint; final small cleanup/quantity changes also linted |
| Final affected-path npx eslint | Exit 0; clean | Services/routes/tools/mapping/UI and all new tests |
| money_inventory.py --write, then verification (including final recheck) | Exit 0; 410 columns/1435 paths/1182 consumers/22973 occurrences | Lexical/source inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; Drizzle/source hashes match | Source metadata only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | No new deprecated helper use |
| pg_isready; remaining fixture count; pg_ctl fast/wait stop | Ready during tests; 0 fixture DBs; shutdown exit 0 | Synthetic files remain outside repository |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Authorized commit/push follows closure |
| git diff --check | Exit 0 | Line-ending notices only |

Initial typecheck caught a jsonResponse import from its non-exporting wrapper
and inferred raw-row types; corrected to direct module import and explicit row
typing. The first integration failure was a test-only wrong stock table name;
corrected to inventory_movement. A strengthened readback initially passed id
instead of get_bill's billId; corrected to the actual SDK input. Final four-worker
run passes. No failed attempt is presented as an initial pass. The hidden startup
launcher waited until PostgreSQL shutdown; its later readiness probe is not the
successful startup check. Direct readiness/tests/shutdown establish lifecycle.

No schema changes/migration generation, configured DB migration, build/dev/Docker,
deployment/browser/session/OAuth/provider or production/IRR enablement occurred.
Fixture migrations establish a test environment, not production migration safety.

## Review, limits and handoff

See MON-053-review-1 for honest implementing-assistant self-review. No slice
blocker remains. Safe numeric coexistence, independent amount override semantics,
mixed count units, partial-job/manual retry, best-effort summary audit and external
period/configuration/reference writer races are documented. Full-int64, durable
recovery, production migrations/PG16/clean installs and independent accounting/
security/native-language/release/IRR qualification remain assigned gates.
MON-020 retains combined acceptance. Complete controller closure, validate/status,
commit/push as requested, then stop. Next task is MON-054 procurement settings.
