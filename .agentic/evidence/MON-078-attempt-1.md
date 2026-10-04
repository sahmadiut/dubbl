# MON-078 attempt 1 - exact inventory BOM and assembly

## Identity and scope

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD 0af3784 on
master tracking origin/master, clean working tree. User requested the next task
and commit/push after completion. Controller validate/status/context/next selected
MON-078; start claimed it. This evidence records work before its commit and does
not invent a commit, peer reviewer or human approval.

Read applicable root/nested instructions, START_HERE/controller/project/repository
map, backend role, task/dependency MON-011 review, ADR-006, source migration/API
compatibility sections, MON-077 evidence and valuation registry. Inspected actual
schema, REST/MCP, shared engine/receipt writers and dashboard source. No current
external provider/tax/currency-regime facts are asserted.

## Implementation and findings

Old REST/MCP completion duplicated floating-point recipe/cost math, rounded
finished stock value to unitCost times quantity, and put the difference in WIP.
Draft reads were outside the transaction and period/account checks were absent.
BOM/component references allowed foreign organization rows. PATCH could mark an
order completed without moving stock. Component deletion did not authorize its
parent. Missing MCP CRUD/read counterparts and exact cost aliases were added.

- inventory-assembly-wire.ts defines strict described schemas, exact minor cost
  aliases, physical decimal quantity/wastage aliases, safe/int32 bridges, real
  Gregorian posting dates, exact ceiling and purchase-price estimate math.
- inventory-assembly.ts shares fifteen scoped transactional operations across
  six REST route files and fifteen MCP tools. Added component PATCH and order
  detail/delete endpoints. New tool file is registered; existing build_assembly
  name/date remains, now delegating to the shared service. SDK registerTool with
  whole strict schemas exposes additionalProperties:false and rejects unknown
  input. Every input field has an actual catalog description; no HTTP self-call.
- Completion groups repeated components after exact per-line wastage ceilings,
  locks order/BOM/items/layers, validates grouped stock and FIFO history, uses
  shared average/FIFO issue math, preflights money totals and finished quantity,
  checks permissions/period/fiscal/account scopes, and posts one exact balanced
  journal with all movements, completion and audit in the same transaction.
- Finished receipt preserves total issued component plus conversion cost,
  separately from rounded unitCost. FIFO remainingValue and consumption value
  retain MON-077 residuals. The shared receipt engine's optional totalCost must
  agree with rounded unit cost; existing writers omit it and retain their
  previous behavior/divisibility contract. No schema change, migration generation,
  backfill, monetary rescale or history rewrite was needed.
- Draft/in_progress metadata can edit/cancel; final orders are immutable, direct
  PATCH completed rejects, repeated/concurrent builds have one winner. Open
  orders prevent BOM deletion. Stock is global whole physical units; standard,
  negative, inactive, inconsistent FIFO or self-consuming builds fail explicitly.
- BOM list/detail now share server purchase-price estimates including wastage.
  Dashboard uses exact aliases and base currency for display, surfaces failed
  deletes/starts and handles failed detail loading. Source layout/API alignment
  reviewed; no browser or screenshot runtime claim.
- Contract registry, money README/manifest, verification matrix, generated source
  inventory and task handoff updated. Parent MON-024 integration acceptance and
  money/migration/IRR/release gates remain separate.

## Acceptance mapping

1. INVENTORY_ASSEMBLY_WIRE_CONTRACTS.md documents all fifteen REST/MCP operation
   pairs, legacy envelopes, aliases, explicit minor/physical/percent/date units,
   safe/int32/decimal ranges, estimates versus carrying valuation, rounding,
   supported methods/lifecycle, ownership/account rules and qualification limits.
2. inventory-assembly-worker.ts invokes actual REST handlers using hashed API
   keys/custom memberships and actual SDK in-memory MCP clients, including full
   catalog registration. All fifteen operation pairs, legacy/exact clients,
   two organizations, custom read/write permission failures, invalid/expired keys,
   attempted header override and foreign/corrupt nested references are exercised.
3. Saved-table snapshots assert unchanged persistence after invalid inputs,
   unsupported methods/history/ranges, permission/scoping/lifecycle/date/period
   errors and ten injected audit-failure operations. Tests verify exact quantity
   ceilings, wastage, duplicate-item grouping, purchase-price aggregates, FIFO
   residuals, final lifecycle, one-winner concurrent REST/MCP builds, safe amounts
   beyond int32, unsafe stored int64 and zero costs without bigint crashes.

## Actual verification

Commands ran in D:/Projects/dubbl using installed dependencies and existing
ignored generated Next/MDX sources. New temporary PostgreSQL 18 trust cluster
used localhost port 55478 and synthetic fixtures; existing .env/application DB
was not read/reset/migrated. Fixture database count was zero before shutdown.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/next/start | Exit 0; valid 128-task graph | Orchestration only |
| node --import tsx --test tests/inventory-assembly-wire.test.ts | Exit 0; 3/3 | Pure contracts/math |
| New assembly PostgreSQL fixture | Exit 0; 1/1 after repairs | Actual fifteen REST/MCP operations |
| Seven-file PostgreSQL run with --test-concurrency=2 | Exit 1; 7/8 passed | Seven regression cases passed; expanded assembly fixture expectation failed, described below |
| Corrected expanded assembly fixture | Exit 0; 1/1 | Same integration assertions, repaired expectation |
| Final assembly integration plus pure file with --test-concurrency=2 | Exit 0; 4/4 | Includes final FIFO original-quantity guard |
| npm test | Exit 0; 230/230 | Full pure suite; final service guards subsequently covered by focused tests |
| Final pnpm exec tsc --noEmit | Exit 0 | Existing generated sources, no build |
| Final npm run lint | Exit 0; 0 errors/143 preexisting warnings | Initial extra unused test import removed |
| money_inventory.py --write; money_inventory.py | Exit 0; 412 columns/1265 consumer hashes | Conservative source inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source hashes verified |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No new deprecated money use |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0/0 before commit | Remote sync, no deployment |
| pg_database count; pg_ctl stop | Zero fixture databases; exit 0 shutdown | Newly created test cluster only |
| git diff --check | Exit 0 | LF/CRLF notices, no whitespace errors |

The seven-file regression run covered MON-048 bill lifecycle, MON-052 goods
receipts, MON-074 catalog, MON-075 master, MON-076 movements and both MON-077
migration/valuation cases; all seven passed. Its assembly failure was an authored
expectation: a fractional purchase-price estimate rounded to zero and thus did
not overflow when adding MAX_SAFE_INTEGER labor. The test now uses a nonzero
estimate, and snapshots verify rollback. Corrected expanded/final runs passed.
No failed financial assertion was waived.

Initial development checks also exposed fixture syntax/type mistakes, missing
purchase-price fixture metadata and a prematurely overflowing recipe fixture;
these were repaired. The first MCP schema check required replacing tool(shape)
with registerTool(strict object) to preserve strict catalog validation. An early
typecheck caught the remaining old UI formatter and a broad test method type;
final versions pass. Running the inventory verifier without --import tsx failed
Node's extensionless TS module resolution; the prescribed tsx invocation passed.

Financial fixture: actual goods receipt receives 3 FIFO units worth 87; actual
landed-cost allocation capitalizes 1; assembly consumes 88, adds 9 labor/overhead,
and receives exactly 97 for 3 finished FIFO units with rounded unitCost 32.
Journal debits/credits both equal 97, layer remainingValue is 97, and later
issues consume 32 then 65 without losing the residual. Historical null layer
values retain original cost products; every successful journal balances and all
assembly movements link to its source journal.

## Review, limits and handoff

See MON-078-review-1.md for implementing-assistant self-review. No independent
agent/human accounting/security review, browser/session/OAuth transport,
PostgreSQL16/CI clean install, full build/dev server, Docker, provider call or
deployment is claimed. Full-int64 ORM/business range, current currency rollout,
production migration/restore, IRR enablement and release gates remain assigned
work. MON-024 retains combined inventory acceptance; finalized assemblies have
no reversal feature, and historical inconsistent FIFO requires explicit repair.

All three bounded criteria are supported. Close through controller self-review,
validate/status, commit/push as requested, verify synchronization and stop after
this task. Do not silently close parents or begin another task.
