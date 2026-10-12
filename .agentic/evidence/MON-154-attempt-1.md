# MON-154 attempt 1 - remaining inventory UI money

## Identity and selection

2026-10-12, Asia/Tehran. Operator/reviewer: Codex, honest self-review.
Entry master HEAD 6cd773622ad667c8c1d09697d1b9bb0cf3e77efd, clean working tree.
The user authorized completing and pushing the next task. Live controller
validate/status/next selected MON-154; start claimed it for codex. Read root and
nested instructions, START_HERE/project/map/controller/backend role, task criteria,
MON-153 evidence and inventory domain services/wire contracts. Applied the memory
Dubbl controller-task skill for one bounded delivery. No child or integration
parent is implicitly completed.

## Implementation and acceptance mapping

1. lib/money/inventory-ui.ts validates canonical required Minor strings against
   safe numeric aliases, negative-zero/nonnegative rules and int32 physical units.
   Item purchase/sale/book/price values plus average/standard costs and reorder
   points validate before list/picker/drawer adoption. Supplier/variant nullable
   prices retain null/null agreement; movement cost/value aliases retain signs.
   Inventory detail editing verifies successful saved responses before state
   updaters and requires saved carrying value instead of falling back to a price
   product. The MON-153 layout's count form now parses signed whole units strictly.

   Valuation validates exact products, margin subtraction, all item/summary money,
   homogeneous currency and complete aggregate sums. Display/CSV uses Minor values;
   percentage display uses bigint half-away-from-zero rational rounding, sorting
   uses cross-products, and chart shares clamp exact ratios before decimal CSS text.
   List inventory summary adds avgMarginExact directly from its existing SQL numeric
   aggregate; avgMargin remains the numeric compatibility alias. Shared REST/MCP
   outputs include it and the list_inventory_items description documents percent
   text. The UI verifies the compatibility alias and rounds the decimal text exactly.

   BOM adapters validate saved costs and nested item aliases, exact physical
   quantity/wastage aliases with six-place precision, component-cost arithmetic,
   cost total identities and duplicate inner/outer response breakdowns. Assembly
   lists validate positive whole finished units and nested recipe/finished costs.
   Stock-take reads validate nullable signed valueAdjustment aliases and physical
   counts. Applied discrepancy is preserved because the server compares with live
   stock, which may differ from the original expected count. Transfer/picker item
   reads validate complete saved money even when labels only show counts. Transfer
   drawer retains quantity text, validates every line, and rejects partial/fractional
   or out-of-range quantities rather than truncating or silently dropping a line.

   Invalid reads show English alerts and suppress monetary views. Picker lists and
   selected-label state are tagged to their organization; superseded requests are
   ignored and cached resolution cannot relabel another selection/organization.
   Inventory create/variant mutation validation occurs before success/close or
   deferred state adoption. Source review covers decimal/numeric keyboards,
   transfer quantity aria-label, alert roles and preserved exact strings. Under
   DEC-005 no screenshots or live-browser effects are claimed.

   Explicit exceptions: catalog/details/create/revalue retain USD/two-decimal cents
   in every organization; valuation and assembly retain existing organization-base
   presentation of the same raw minor units. No conversion, inferred currency,
   historical rescaling, cost-policy change, schema/migration or production flag
   change. Financial limits stay safe Number bounds with bigint intermediates.
   Count charts, warehouse/transfer progress, stock-take progress, IDs/dates and
   barcode generation are nonmoney. Unused financial data is not newly displayed.

2. tests/inventory-ui-money.test.ts adds eight financial/input/source groups.
   These preserve one-minor low digits at large prices, require aliases, reject
   unsupported/unsafe/conflicting/malformed saved values, retain nullable and
   signed stock/catalog values, distinguish book and projected totals, verify
   USD/JPY/KWD scales without rescaling, signed percentage ties and clamped shares,
   BOM fractional-unit costing, SQL decimal rounding and strict full-line transfer
   input. Margin sorting distinguishes two ratios whose Number division collapses
   to the same value. Scoped guards cover all eleven adopted inventory page groups,
   prevent monetary float valuation ratios and forbid the carrying fallback.

   tests/integration/inventory-ui-money.test.ts and worker create six independent
   USD/JPY/KWD organizations with REST and MCP item-creation origins. Real API-key
   REST and registered linked MCP calls pass through the actual UI adapters. Open
   3 units at purchase 3000000001 and sale 3000000002, write down 3000000001; SQL
   confirms carrying 6000000002 and average 2000000001 while list/valuation purchase
   projection stays 9000000003 and sale projection 9000000006, exact profit 3.
   List decimal average matches an independent SQL-text aggregate. Catalog and
   movement reads agree across transports. BOM quantity 0.5 rounds component cost
   to 1500000001, plus labor 1 and overhead 2 yields 1500000004. Assembly list costs
   validate across transports. Count/apply 2 units produces signed value adjustment
   -2000000001 and SQL carrying 4000000001. Conflicting REST/MCP variant inputs fail
   with unchanged item/catalog/movement/layer/ledger/account/audit SQL snapshots;
   every posted journal balances. Existing domain fixtures retain permission,
   organization, period, FIFO, range, atomicity and negative-history coverage.

3. INVENTORY_UI_CUTOVER maps owned consumers, units, contracts and exceptions.
   MONEY_MANIFEST and TEST_MATRIX link this scope to MONEY_BOUNDARIES. Regenerated
   inventory hashes/lines and legacy-money gate pass. MON-153 evidence is unchanged;
   MON-008 retains independent combined acceptance after other consumer children.

## Actual verification

All commands ran in D:/Projects/dubbl. Dedicated PostgreSQL 18 cluster at
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon154-pg-f88762ed9260432fbb94281b201876e8,
loopback 127.0.0.1:55459, synthetic dubbl_ci role, UTC, jit=off,
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL/PG_BIN targeted only
this server. Wrappers created/migrated/dropped randomized disposable databases.
Final fixture count was 0; pg_ctl fast shutdown exited 0. Cluster files remain.
No .env/application DB, full build, dev server, Docker, provider or deployment.

| Command / procedure | Observed result | Scope / limitation |
|---|---|---|
| node --import tsx --test tests/inventory-ui-money.test.ts tests/inventory-detail-ui-money.test.ts | Exit 0, final 12/12 | Eight new groups plus MON-153 four |
| node --import tsx --test --test-concurrency=2 tests/integration/inventory-ui-money.test.ts tests/integration/inventory-catalog.test.ts tests/integration/inventory-assembly.test.ts tests/integration/inventory-movements.test.ts tests/integration/inventory-valuation.test.ts tests/integration/inventory-master.test.ts | Exit 0, 7/7, 46.581 seconds | Six new workflows plus existing domains; valuation has two tests |
| node --import tsx --test --test-concurrency=2 tests/integration/inventory-ui-money.test.ts tests/integration/inventory-detail-ui-money.test.ts | Exit 0, final 2/2, 19.870 seconds | Final adapter refinements plus MON-153 shared-layout regression |
| pnpm test | Exit 0, final 486/486, 16.597 seconds | Earlier 485/485 before final sorting/transfer group also passed |
| pnpm typecheck | Exit 0, final | MDX + tsc, no build |
| Changed/new TS paths passed as separate argv to node node_modules/eslint/bin/eslint.js via Python subprocess | Exit 0, final, 0 errors/8 existing warnings | Existing history/assembly/BOM warnings; new adapter/fixtures/picker clean |
| pnpm lint | Exit 0, final, 0 errors/98 existing warnings | Full repository |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0, final | 415 columns, 2062 scanned files, 1547 consumer files, 29922 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle/source hashes and lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Existing import/call guard negative regressions |
| Registry local-link check using Python pathlib | Exit 0, all 3 links exist | Scoped registry links |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural validation, no authenticity/financial claim from controller |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before delivery | Actual remote synchronization |
| psql fixture database count; pg_ctl fast stop | 0 databases, shutdown exit 0 | Synthetic fixture server only |

The first changed-file lint PowerShell array invocation passed all paths as one
argument and matched no files; corrected to Python subprocess argv. A temporary
picker cleanup edit introduced prefer-const/ref warnings; corrected cleanup to
local cancellation and final lint passed. No failed invocation is counted as a pass.

## Review and handoff

Separate MON-154-review-1.md records honest self-review and the refinements above.
No blocker. Complete controller checks/submit/self-review/done, stage task-owned
files, commit and push origin/master, verify remote SHA and clean tree, report next
task and stop. MON-008 combined acceptance, remaining children, full-int64 business,
hosted PostgreSQL16, accounting/security/migration/localization/provider/production
qualification and live-browser effects remain independent.
