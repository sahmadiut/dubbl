# MON-024 attempt 1 - combined inventory and costing acceptance

## Identity and environment

2026-10-09, Asia/Tehran. Operator: coding-assistant, implementing assistant.
User requested complete and push next task. Entry master HEAD
24371ba6c1de5c164a34fc3d06f9efaed4409ff6; clean working tree. Controller validation,
status/next/context selected MON-024, integration parent of completed MON-074..078.
Only this task was claimed. No delegation or independent reviewer was used.

Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, MON-011 evidence/ADR-006, child and MON-052 evidence, money manifest,
source migration/API sections, current services/routes/tools/schema and fixture
harness. Local memory skill supplied the one-task/staging/disposable-DB procedure;
current controller/source/tests determine all implementation findings.

Created a new PostgreSQL 18 synthetic trust-auth cluster in
D:/Temp/dubbl-mon024-pg-287deabd5916446db997740cace96a6b/data,
loopback port 55424, role dubbl_ci. Hidden pg_ctl startup; explicit synthetic
TEST_DATABASE_URL selects it. Every harness test creates/migrates/drops a random
fixture database. Configured application/.env DB was not read/migrated/reset.
Existing installed dependencies/generated Next/MDX sources were used; no build,
dev server, Docker, browser, provider, deployment or schema modification.

## Implementation and integration result

- INVENTORY_INTEGRATION_CONTRACTS.md links every catalog, master/CSV, movement/
  location/tracking metadata, valuation/layer/landed cost and BOM/assembly boundary,
  plus receipt and sales bridges. It specifies supported units, aliases/ranges,
  existing envelopes and explicit allocation/history limits. Child acceptance is
  not treated as parent proof: a new combined test/worker provides parent evidence.
- Combined API-key REST and full SDK in-memory MCP tests compose receipts/freight,
  warehouse transfers/live counts, global assembly, partial/full invoice sale/void,
  bulk and single issues, CSV master-only updates, catalog-only metadata and exact
  report/layer reads. Fixtures use KWD and preserve v1 1250 units without rescaling.
- Source review identified assembly's missing warehouse allocation: located
  components could be consumed globally leaving stale location balances. New
  preflight rejects nonzero warehouse stock or open located FIFO component layers,
  and serial/lot/batch components or finished items, with 422 before mutation.
  Supported untracked/unassigned assembly remains transactional and unchanged.
- A real combined invoice sale reproduced FIFO value drift: a layer worth 65
  retained remainingValue 65 after full sale. invoice-stock now consumes the exact
  authoritative remaining value, persists consumption value, and restores both
  quantity/value on void. Historical null layers/consumptions retain their product
  fallback; shortfall behavior is preserved. Final average sale consumes saved
  carrying value; return average uses restored total rather than rounded cost
  products. REST/MCP descriptions and mutable contracts document these changes.
- Source money inventory, manifest, test matrix and parent handoff are updated.
  Completed child evidence remains immutable. No migration/backfill/history/unit
  rewrite or rollout flag change is necessary.

## Acceptance mapping

1. Combined registry and linked child registries inventory all inputs/outputs,
   units, aliases, ranges, envelopes, physical quantities, permissions, references,
   methods/lifecycle and explicit unsupported cases. Safe numeric coexistence is
   not full signed-int64 business support. Price projections remain distinct from
   inventory carrying value; landed major-unit and recipe-decimal inputs retain
   their own documented units.
2. New parent fixture invokes real handlers with API-key/custom role authentication,
   two tenants/conflicting organization header and full registered SDK clients.
   Legacy/exact/dual clients, >int32 catalog prices, all composing writer families,
   exact report parity and base-currency stock/journal behavior are exercised.
   Five child suites and goods receipt/bill/invoice/credit suites pass currently.
3. SQL-text snapshots prove no writes after malformed/unknown/conflicting aliases,
   fractional stock, unsafe exact and raw saved money, ownership/auth/role/period/
   lifecycle errors and injected assembly audit failure. Actual exception cause is
   verified and recovery succeeds. Two different writer-family races conserve
   stock/value; journals balance and aggregate inventory assets reconcile with
   saved item carrying totals, including reversals and residuals.

Concrete flow: located receipt 3*29=87 plus freight1=88; transfer2 creates no GL;
location count2->1 consumes29, retaining global2/value59. Located assembly rejects.
Separate unassigned receipt2*29=58 plus freight1=59, conversion6, finishes2/value65
with rounded unitCost33. Partial/full invoice issues consume33/65 and void restores
65. Final single/bulk issues consume33 then32. Average recipe builds2 units/value1;
full sale/void retains that residual1. Actual receipt/bulk adjustment serialize to
8/value80; capitalization/build race preserves combined component/finished96.

## Actual verification

All commands ran in D:/Projects/dubbl. No full build or unrequested dev server.

| Command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/next/context/start MON-024 | Exit 0; selected parent in valid 173-task graph | Structural only |
| Final 10-file integration command below with --test-concurrency=2 | Exit 0; 11/11 passed | Includes 2 MON-077 cases; actual migrated PG18 handlers/SDK |
| Final strengthened parent integration rerun | Exit 0; 1/1 | Added all tracking methods, orphan located FIFO metadata and inventory-GL reconciliation |
| pnpm test | Exit 0; 359/359 | Pure suite, not independent financial approval |
| pnpm typecheck; final pnpm exec tsc --noEmit | Exit 0 | Installed/generated sources; no build |
| Changed-file eslint; final parent worker eslint | Exit 0 | No changed-file warnings |
| pnpm lint | Exit 0; 0 errors/106 existing warnings | Warnings in unchanged files |
| money_inventory.py --write then verify; node --import tsx verify_money_inventory.mjs | Exit 0; 415 columns/1410 consumer hashes/26909 occurrences | Lexical inventory and Drizzle/source checks |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | No new deprecated money helper usage |
| git diff --check | Exit 0 | LF/CRLF notices only |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Remote sync; commit/push follows closure |
| psql fixture database count; verified pg_ctl fast/wait stop | Zero fixture databases; shutdown exit 0 | Only newly created test cluster; temporary workspace path file removed |

Integration files: inventory-integration, inventory-catalog, inventory-master,
inventory-movements, inventory-valuation, inventory-assembly, goods-receipts,
bill-lifecycle, invoice-lifecycle and credits under tests/integration/*.test.ts.
Command: node --import tsx --test --test-concurrency=2 followed by those exact ten
paths. Focused final command: node --import tsx --test
tests/integration/inventory-integration.test.ts.

Initial parent check failed an authored race expectation: an adjustment before the
first receipt uses saved average0, not purchase price10. Changed the fixture to
receive initial1/value10 before racing; no behavior was changed to satisfy this
incorrect expectation. Invoice fixture initially omitted AR/revenue accounts;
after adding prerequisite accounts it reproduced the real FIFO remaining-value
bug. After the fix, retained historical consumption audit added expected entries;
the assertion now includes restored sales as well as subsequent issues. All final
checks pass; no financial failure was waived. Injected audit failure is expected,
its actual PostgreSQL cause is verified and all business snapshots remain equal.

## Review and handoff

See MON-024-review-1.md for implementing-assistant self-review. No bounded blocker.
Assembly warehouse/tracking allocation rejects explicitly; standalone global
adjustments retain documented independent location behavior and global FIFO cost
flow. Full-int64, ambiguous historical return reconstruction, foreign variance,
generic import/export, production migration/restore, IRR and independent human
accounting/security qualification retain their assigned contracts and gates.
No browser/session/OAuth/HTTP MCP, PG16/clean-install CI or production claim.

Next: record checks, submit, honest self-review and done; validate/status; commit
only task-owned files, user-authorized push to origin/master, verify remote SHA and
clean tree, then stop without beginning another task.
