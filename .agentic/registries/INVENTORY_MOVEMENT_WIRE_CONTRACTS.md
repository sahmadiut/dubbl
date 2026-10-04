# Inventory movement and warehouse contracts (MON-076)

2026-10-05, Asia/Tehran. Actual REST handlers and SDK MCP fixtures on disposable
migrated PostgreSQL18; implementing-assistant self-review. No deployment,
historical repair, schema change or production IRR/full-int64 enablement.

## Representation, inputs and supported range

Existing monetary inputs/outputs remain integer cents, including under KWD base
currency. No magnitude/currency/locale rescaling and no implicit exact-only mode.
Amounts support safe numeric coexistence, -9007199254740991..9007199254740991;
nonnegative fields restrict that range. Canonical ASCII signed int64 `*Minor`
strings accept the same supported business range, and agree exactly with any
numeric alias. Out-of-safe-range strings fail 422 LEGACY_NUMERIC_RANGE before
commit; full int64 business support remains MON-007/008/024. Numeric input must
be an integer; decimal strings, whitespace, exponents, leading zeros, negative
zero, localized digits and unknown fields reject. No Number parsing of exact
strings before range checking.

Physical quantities remain signed int32 WHOLE units (-2147483648..2147483647),
never currency, hundredths or money aliases. Counted quantities are nonnegative,
transfer/lot quantities positive, adjustment deltas nonzero. New on-hand and
warehouse balances must be nonnegative and int32. Standard costing and negative
saved global stock require separate qualification/remediation and reject 422.
Saved movement quantities retain signed int32, including historic negative stock.
Chart sums are SQL bigint/numeric text, checked before Number conversion, and may
exceed int32 safely. Negating an int32-minimum movement casts to bigint first.

UUIDs are strictly validated and organization-scoped; mutation references require
live owned items and active live locations. Historical transfer/count/allocation
location metadata may include deleted owned locations; foreign saved references
fail closed. Text max 10000 characters. Gregorian posting/manufacturing/expiry
dates are real canonical YYYY-MM-DD (including leap validation), independent of
locale/timezone. Posting defaults to UTC today; MCP retains optional posting date.
Expiry cannot precede manufacturing date. Pages 1..1000000, limits 1..200 (default
1/50), with canonical numeric query values and no partial parseInt coercion.

## Boundary inventory

All paths below are under `/api/v1`. `inventory-movements.ts` shares direct scoped
DB services; `inventory-movement-wire.ts` shares strict described schemas. MCP
tools use AuthContext at server creation and wrapTool, never HTTP self-calls.

| REST operation | MCP operation(s) | Inputs and output envelope |
|---|---|---|
| GET/POST warehouses | list_warehouses / create_warehouse | List REST `{data}` / MCP `{warehouses}`. Create requires name/code; optional address/null, isDefault. Create `{warehouse}` (REST 201). |
| GET/PATCH/DELETE warehouses/:id | get_warehouse / update_warehouse / delete_warehouse | Owned UUID (MCP warehouseId). Patch supplied create fields plus isActive. Read/write `{warehouse}`; delete `{success:true}`. |
| GET warehouses/:id/stock | get_warehouse_stock | Owned warehouse UUID. REST `{data}` / MCP `{stock}`: row id, inventoryItemId, itemName/code/sku, quantity whole units, updatedAt. |
| GET inventory/:id/warehouse-stock | get_inventory_warehouse_stock | Owned item UUID (MCP inventoryItemId). `{data}`: row id, warehouseId/name/code, whole quantity, updatedAt. |
| POST inventory/:id/adjust | adjust_inventory_stock | REST adjustmentType defaults quantity: `{adjustment,reason}`; write_down positive valueDelta/valueDeltaMinor; revaluation absolute nonnegative newTotalValue/newTotalValueMinor. MCP keeps kind and quantityDelta, or amount/amountMinor positive write-down magnitude / signed nonzero revaluation DELTA; reason required, optional date. Shared result described below. |
| POST bulk/inventory/adjust | bulk_adjust_inventory_stock | `{adjustments:[{itemId,quantity,reason?}]}`, 1..100 distinct live owned items, quantity is signed whole-unit delta. Atomic `{adjusted}`; missing items reject, never silently skip. |
| POST inventory/bulk adjust_stock | adjust_inventory_items_stock (MON-075) | Existing 1..200 distinct ids, one signed adjustment and optional reason; `{success,affected}`. Reuses enhanced shared preflight and exact cost engine. Other four master actions remain MON-075. |
| GET/POST inventory/transfers | list_inventory_transfers / create_inventory_transfer | List `{data}`; create distinct source/destination, optional notes/null, 1..100 distinct `{inventoryItemId,quantity}` positive whole lines. `{transfer}` (REST 201) with scoped fromWarehouse/toWarehouse and lines. |
| GET/PATCH inventory/transfers/:id | get_inventory_transfer / update_inventory_transfer | Owned UUID (MCP transferId), optional notes/null, status draft/in_transit/cancelled. `{transfer}`. |
| POST inventory/transfers/:id/complete | complete_inventory_transfer | Owned transferId. Atomic completion `{transfer}`; repeated/terminal completion rejects. |
| No separate REST convenience operation | transfer_inventory_stock | Existing one-item immediate create+complete: inventoryItemId, fromWarehouseId, toWarehouseId, positive quantity, optional notes. Single transaction `{transfer}`. |
| GET/POST stock-takes | list_stock_takes / create_stock_take | List `{stockTakes}` with itemCount (no lines). Create name, optional warehouseId/null and notes, `{stockTake}` (REST 201), snapshots active owned item/global or location quantities. |
| GET/PATCH/DELETE stock-takes/:id | get_stock_take / update_stock_take / delete_stock_take | UUID (MCP stockTakeId). Get/patch `{stockTake}` with owned warehouse and lines/item id/name/code. Patch name/notes/status draft/in_progress/cancelled; complete only via apply. Delete draft only `{success:true}`. |
| PATCH stock-takes/:id/lines/:lineId | count_stock_take_line | Owned take and belonging line, nonnegative countedQuantity whole units; `{line}`. Only in_progress counts. |
| POST stock-takes/:id/apply | apply_stock_take | Owned take UUID; MCP optional date. `{stockTake,adjustedCount,journalEntryIds}`; additional REST journalEntryIds retains existing stockTake/adjustedCount. |
| GET inventory/:id/movements | list_inventory_movements | REST owned item and page/limit; MCP optional owned inventoryItemId/warehouseId, movement type and page/limit. REST `{data,pagination}` / MCP `{movements,total,page,limit}`. |
| GET inventory/movements/chart | get_inventory_movement_chart | period 30d/90d/12m (daily/weekly/monthly), optional owned warehouseId. `{data:[{date,in,out,net}],period,groupBy}`, physical-unit sums only. |
| GET/POST inventory/:id/serials | list_inventory_serials / create_inventory_serials | List page/limit, optional available/sold/reserved/damaged status, `{data,pagination}`. Create 1..1000 distinct serialNumbers, optional warehouseId/null, `{data}` (REST 201). |
| GET/POST inventory/:id/lots | list_inventory_lots / create_inventory_lot | List page/limit `{data,pagination}`. Create positive whole quantity, optional lotNumber/batchNumber/warehouseId/null/manufacturingDate/expiryDate, `{lot}` (REST 201). Status query is unsupported for lots. |

Seventeen route files expose twenty-seven handler operations. Twenty-two movement
tools plus six warehouse tools expose all adopted operations. Existing four
inventory tool names and six warehouse names remain registered once; assembly
`build_assembly` remains in inventory.ts and is qualified by MON-078.

Inventory DTO retains MON-075 prices/costs/quantity and adds known Minor aliases.
Movement unitCost/value add `unitCostMinor`/`valueMinor` (signed value, nonnegative
unit cost). Stock-take valueAdjustment adds `valueAdjustmentMinor`, preserving
null for unadjusted history; signed amount is inventory debit minus credit.
Adjustment response retains inventoryItem/movement/null/journalEntryId/null/reason
and quantity previousQuantity/newQuantity/adjustment or value previousValue/newValue.
Value results add previousValueMinor/newValueMinor/valueDelta/valueDeltaMinor and
MCP-compatible newTotalValue/newTotalValueMinor/kind. Values and products are
validated inside the transaction, before successful return/commit.

## Accounting, state, concurrency and compatible corrections

- Quantity adjustment issues FIFO layers or average carrying cost; found stock
  receives at current average cost. DR Inventory / CR Shrinkage 5010 for found
  stock, reversed for loss. Zero-valued stock gets movement/audit with no GL.
  Accounts must be owned, live, active, correctly typed and in base currency.
- REST value-only revaluation retains offset Inventory Write-Down 5020; MCP
  revaluation retains Revaluation Surplus 3400 on uplift and Impairment Loss 5510
  on decrease. Write-down uses 5020 in both. REST target and MCP delta semantics
  are explicitly distinct; shared service never silently converts the meaning.
  Quantity stays unchanged. Exact integer division rounds ties toward +infinity.
  Positive book value requires stock. FIFO/standard value-only adjustments reject
  422 because rewriting item value without layers would leave inconsistent costs;
  layer/revaluation qualification remains MON-077/024. No existing layer rewritten.
- Receipts derive averageCost from authoritative totalValue/newQuantity with exact
  ratio, retaining prior rounding residuals. Average issues cap at carrying value
  and consume the exact remaining book value on full exhaustion, avoiding an
  over-credit caused by rounded unit cost. FIFO preflight refuses overdraw or
  exhausted stock with stranded value. Bigint products, totals and costs are
  range-checked; no floating money multiplication/division in adopted cost flow.
- Stock takes recompute every counted line against live global or LOCATION units,
  including stored zero discrepancies after stock changed. The location delta
  changes both location and global stock; it never sets global stock equal to a
  single warehouse count. Movement/line carry signed exact GL value and journal
  link. Uncounted lines remain unadjusted. Completion and all lines/GL/audit are
  atomic. Applied/cancelled takes cannot reopen; direct status=completed rejects.
- Transfer validates all items/locations, quantity bounds, sufficient source stock
  and destination int32 range before movement writes. Creation/header/lines and
  completion/two movements/stock/audit each commit atomically. Global quantity,
  cost layers and book value are unchanged: physical relocation has zero money
  movement and no GL. FIFO financial ordering remains global, as before. Completed
  or cancelled transfers cannot reopen or move units twice.
- Organization no-key-update and ordered item locks serialize adopted writers,
  defaults, state transitions and journal numbering, without conflicting with
  adjacent FK key-share locks. MON-052 receipt writer shares item locks. Cost-flow
  engine locks and compares supplied saved values; stale adjacent pre-reads reject
  422/reload-and-retry instead of overwriting concurrently changed stock. General
  parent cross-writer qualification remains MON-024, not inferred from these races.
- Default warehouse updates clear other live defaults. Duplicate codes including
  deleted history return 409. Warehouse deletion refuses nonzero stock or open
  transfers/counts and retains history. Historical joins always enforce ownership.
- Serial/lot creation preserves its existing allocation METADATA semantics: no
  stock receipt, cost layer or journal. Serial labels are unique per org/item
  including deleted history. Whole batches and audit commit together. No automatic
  movement-serial/lot selection/consumption/relocation feature is invented: those
  assignment tables have no existing REST/MCP writers. MON-052's tracking guard is
  retained. Complete tracked workflow qualification remains the inventory parent.
- Stock adjustment/import-like creation requests remain new events on retry; no
  idempotency token is invented. Transfer/take completion retries reject without
  reposting. All adopted mutations require manage:inventory and atomic audit;
  reads retain existing role behavior (legacy MCP movement listing also requires
  manage:inventory). Viewer/custom-role and manager cases are verified.

Inventory revaluation editor parses two-decimal major display text to canonical
newTotalValueMinor without float rounding. Count editor rejects decimal/partial
whole input instead of truncating parseInt. USD/two-decimal catalog display is
retained; future locale/currency presentation and generic exports are separate.

## Errors, evidence and limits

400 malformed JSON, unknown/irrelevant fields, bad aliases/dates/quantities,
negative proposed stock/value, duplicate batch items, wrong state/count filters;
401 invalid/expired API key; 403 permission denied; 404 foreign/missing/deleted
resources or active-location references; 409 duplicate code/serial, terminal
transfer modification/completion, terminal count edits, nonempty/open warehouse
deletion; 422 period/fiscal lock, invalid accounts, unsupported costing/history,
stale stock and LEGACY_NUMERIC_RANGE; infrastructure failures remain generic 500.
Invalid writes and serializer preflight failures leave no committed partial data.

Actual fixture tests cover both legacy numeric and exact/dual money clients,
KWD base posting with unchanged cents units, API keys/custom roles/two tenants,
strict described SDK schemas and full unique registration, every adopted route
and tool, foreign/corrupt references, SQL snapshots, safe/unsafe saved bigint,
range/products, physical chart over-int32, period locks, FIFO/average residuals,
location/global/recount semantics, completion and concurrent writers, and sixteen
injected audit rollback families. Each linked money movement matches asset-account
GL net; journals balance in the base currency. A direct synthetic receipt-writer
race omits a GL fixture deliberately; actual MON-052 receipt regression separately
qualifies its full API/MCP path.

No browser/session/OAuth/PostgreSQL16/independent human accounting/security review.
No public provider data, production database migration or customer data used.
MON-077 valuation/layer/landed-cost and MON-078 assembly, full-range/IRR/migration
and parent MON-024 integrated acceptance remain open. Tests do not enable IRR.
