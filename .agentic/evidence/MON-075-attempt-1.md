# MON-075 attempt 1 - inventory master and import contracts

## Identity and environment

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD
4c54f417fed525350801b4e24e73ea35e5e921e9, master, clean tree.
Implementation and evidence are uncommitted at writing; user explicitly requested
commit/push after completion. Implementing-assistant self-review, no independent
human accounting/security approval. Controller selected and started MON-075;
MON-024 and subsequent inventory qualification remain separate.

Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, task, MON-011 foundation evidence, ADR-006, source migration/API
sections, money/catalog contracts, MON-074 evidence, actual REST/MCP/UI/schema and
valuation/journal helpers. Installed dependencies and existing generated Next/MDX
sources used. No build, dev server, Docker, browser or deployment.

PostgreSQL18 initdb created an isolated synthetic trust-auth cluster at
D:/Temp/dubbl-mon075-pg-b7a8ffdd05624f82ae064abb94d85e64/data,
127.0.0.1:55475, role dubbl_ci. Hidden pg_ctl startup redirected logs; pg_isready
confirmed readiness. Explicit synthetic TEST_DATABASE_URL selected that server.
Harness cases migrated and dropped random fixture databases. Configured .env
database was not read, reset or migrated. No real customer/provider data or
credentials used. Final psql count found zero fixture databases; pg_ctl fast/wait
stop exited 0. Initial shutdown path guard rejected Windows separator spelling;
normalizing separators allowed the verified task cluster shutdown. No deletion.

## Implemented behavior

- New inventory-master-wire.ts documents strict described item/category/list/bulk/
  CSV schemas, exact aliases, DTOs/products and complete quoted-record parsing.
  Existing cents inputs add agreeing canonical Minor strings within safe Number
  bounds. Physical quantities remain whole int32, not money. CSV prices retain
  two-decimal major units; explicit Minor columns remain cents. No rescaling.
- New inventory-master.ts shares direct scoped DB services across seven route
  files and sixteen MCP tools. Existing five item tool names/envelopes remain;
  list filters and safe SQL summaries preserve numeric coexistence. Raw numeric
  aggregate converts only after exact bigint range checks. Item DTOs expose both
  book totalValue and exact quantity*purchasePrice priceValue.
- Opening stock uses the existing valuation path and atomically posts exactly
  matching DR Inventory / CR Opening Balance Equity, linking movement to GL.
  Period locks, owned live category/account references, account type/base currency,
  duplicate-code barriers and saved/proposed money preflight are enforced.
  Quantity/price without positive valued opening stock retains zero opening stock.
- Org no-key-update locks serialize code/category/journal work while remaining
  compatible with adjacent FK key-share locks. Item/FIFO layer locks serialize
  bulk writers. All adopted item/category/bulk writes audit transactionally;
  category cycles are rejected and deletions detach live child/item references.
- CSV commits each valid row's inventory, valuation, GL and audit together.
  Existing codes update master only and never reload opening quantities/value.
  Invalid rows return logical-record errors; whole-file format errors reject;
  infrastructure faults remain failures. Per-item opening GL replaces the old
  post-loop combined GL, removing partial stock-without-ledger risk.
- All five REST bulk actions have separate MCP tools, shared atomic preflight
  and audit; FIFO/average stock adjustments preserve ledger/cost-flow behavior.
  New inventory-cost.ts replaces floating division for weighted average and
  derived issue unit costs with exact signed tie-compatible integer ratios.
  Safe cumulative/products/value checks precede legacy Number paths.
- Reorder suggestions add price aliases and exclude foreign supplier details,
  preserving preferred-source order. Exact master create/edit conversion,
  whole-unit parsing, USD catalog display and local CSV decimal export avoid
  client-side rounding/truncation. Export Status can round-trip into the importer.
- INVENTORY_MASTER_WIRE_CONTRACTS inventories fields/operations/errors/limits;
  README, manifest, test matrix and money source inventory refreshed. Pending
  MON-033/076 handoffs coordinate generic exports and the already adopted bulk
  service; no acceptance/status of those tasks is claimed.

## Acceptance mapping

1. Registry inventories all seven REST files/sixteen tools, envelopes, filters,
   price/valuation aliases, supported numeric and physical ranges, CSV major/minor
   formats, category/reference behavior, errors and MON-033/076 coordination.
2. Pure tests plus actual migrated PostgreSQL REST/API-key/custom-role and SDK
   fixtures cover legacy/exact/dual clients, full unique registration, all tool
   schemas described/strict, two tenants, spoofed org header, invalid/expired auth,
   viewer/manager permissions, KWD base ledger with unchanged legacy integer units,
   item/category/import/reorder/bulk successful operations and opening GL proof.
3. SQL snapshots cover malformed/unsupported/range inputs, references, roles,
   quantities, locked periods, unsafe stored bigint and unsafe SQL aggregates.
   Opening movement/value/GL balance, repeated CSV master-only updates, fractional
   rejection, FIFO layer cost, duplicate concurrent create and nine injected audit
   failure rollbacks verify no partial adopted inventory/GL/audit mutation.

## Actual verification

All commands ran in D:/Projects/dubbl. No full builds or dev servers.

| Command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-075 | Exit 0, valid 128-task graph | Structure only |
| Initial master pure/PostgreSQL command | Exit 0, 4/4 | First pass before strengthened fixtures |
| node --import tsx --test tests/inventory-master-wire.test.ts tests/integration/inventory-master.test.ts tests/integration/inventory-catalog.test.ts tests/integration/goods-receipts.test.ts | Exit 0, 6/6 | Real adopted paths plus MON-074/052 regressions |
| npm test | Exit 0, 221/221 | Full unit suite; no independent financial approval |
| npm run lint | Exit 0, 0 errors/143 existing warnings | Same count as entry MON-074 evidence |
| Strengthened master pure/PostgreSQL rerun | Exit 0, 4/4 | Added unsafe summary, dual CSV, no-cost and export fixtures |
| Final master pure/PostgreSQL rerun | Exit 0, 4/4 | After FK-compatible org lock and UTF-8 CSV size guard |
| npx tsc --noEmit | Exit 0 on repaired/final checks | Existing generated sources, no build |
| Changed-file eslint | Exit 0, clean changed TypeScript | Routes, master tools/services, editors, exact ratios and fixtures |
| money_inventory.py --write and verify; node --import tsx verify_money_inventory.mjs | Exit 0, 410 columns/1268 hashes verified | Conservative lexical source inventory |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | No new legacy money helper usage |
| git fetch origin; rev-list HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Push after controller closure |
| psql fixture count; verified pg_ctl stop | Zero fixture DBs; shutdown exit 0 | Synthetic cluster only |
| git diff --check | Exit 0 | LF/CRLF notices only |

First typecheck found one removed centsToDecimal import still used by the revalue
prefill. Replaced that prefill with exact decimal presentation; subsequent checks
pass. Review strengthened actual snapshots, FIFO/quantity/product/aggregate guards,
account currency validation, CSV/export/dual/replay cases and safe signed rounding.
No unresolved check failure. See separate honest self-review evidence.

## Limits and handoff

Safe Number coexistence remains explicit; full int64 and other stock/valuation/
assembly writers remain MON-076/077/078 and parent MON-024. Standalone stock
adjustment retries remain new events; no new idempotency token guarantee. General
cross-writer concurrency and migration/IRR/historical/opaque/export qualification
remain separate. USD/two-decimal catalog UI/CSV format does not infer a currency
or silently rescale KWD/IRR. Generic CSV/Excel export/import remains MON-033.
No genuine session/OAuth/browser/PostgreSQL16 or independent human financial/
security review. No schema edit, migration-file generation or production change.

No bounded blocker. Next: controller check/submit/self-review/done, validate/status,
user-authorized commit/push, then stop. Next task: MON-076.
