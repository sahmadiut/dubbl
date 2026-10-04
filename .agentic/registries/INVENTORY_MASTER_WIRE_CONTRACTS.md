# Inventory master and CSV contracts

MON-075, 2026-10-05 Asia/Tehran. Implementing-assistant self-review only.
Shared direct Drizzle services use server AuthContext; no HTTP self-calls.
Parent MON-024 retains integrated stock/costing acceptance. No schema, storage
rescaling, currency rollout, production migration or full-int64 business promise.

## Operations

Paths below `/api/v1/inventory`. Every successful REST creation returns 201;
other operations return 200. UUIDs must identify live owned records.

| REST | MCP | Success |
|---|---|---|
| GET / | list_inventory_items | REST `{data,pagination,categories,summary}`; MCP `{items,total,page,limit,categories,summary}` |
| POST / | create_inventory_item | `{inventoryItem}` |
| GET /{id} | get_inventory_item | `{inventoryItem}` |
| PATCH /{id} | update_inventory_item | `{inventoryItem}` |
| DELETE /{id} | delete_inventory_item | `{success:true}` |
| GET /categories | list_inventory_categories | `{data,flat}`; roots with immediate children, plus flat list |
| POST /categories | create_inventory_category | `{category}` |
| PATCH /categories/{id} | update_inventory_category | `{category}` |
| DELETE /categories/{id} | delete_inventory_category | `{success:true}` |
| POST /import, multipart file | import_inventory_csv, csv text | `{created,updated,total,errors:[{row,message}]}` |
| GET /reorder-suggestions | list_inventory_reorder_suggestions | `{data}` |
| POST /bulk, action delete | delete_inventory_items | `{success:true,affected}` |
| POST /bulk, action set_active | activate_inventory_items | same |
| POST /bulk, action set_inactive | deactivate_inventory_items | same |
| POST /bulk, action set_category | set_inventory_items_category | same |
| POST /bulk, action adjust_stock | adjust_inventory_items_stock | same |

MCP retains the five existing item tool names and registers eleven additional
single-operation tools. All tools have strict, described input fields. List
defaults remain distinct: REST includes active and inactive; MCP activeOnly
defaults true. Reads require valid org authentication; writes require
manage:inventory, including custom permissions. MCP list no longer unnecessarily
requires mutation permission. API-key identity overrides a conflicting org header.

## Master inputs and outputs

- Create requires code and name, 1..10000 characters. Code uniqueness includes
  soft-deleted history. description/category/sku are nullable optional text, max
  10000 characters. categoryId and costAccountId/revenueAccountId/inventoryAccountId
  are nullable optional UUIDs, owned/live; accounts must be active and have
  expense/revenue/asset type respectively. Omission retains fields on PATCH;
  null clears nullable fields. isActive defaults true on creation.
- purchasePrice/salePrice are nonnegative safe integer cents per unit,
  0..9007199254740991, default zero on create. Matching purchasePriceMinor and
  salePriceMinor accept canonical ASCII nonnegative int64 integer strings, with
  the same safe Number business bound. Both aliases must agree. No whitespace,
  exponent, localized digits, decimal fractions, leading zeros or negative zero.
  No magnitude/locale/currency-based conversion. KWD organization fixtures retain
  the same integer cents values and post the existing base-currency ledger units.
- quantityOnHand is signed int32 whole physical units on create only. Positive
  quantity AND positive purchase price receive opening stock; otherwise quantity
  and book value start at zero, preserving existing creation behavior. reorderPoint
  is nonnegative int32 whole units, defaults zero. PATCH cannot overwrite stock.
- Item DTOs preserve numeric prices, averageCost, standardCost and totalValue,
  adding canonical *Minor strings. Costs and book value must be nonnegative safe
  integers. Physical on-hand may be signed int32. priceValue/priceValueMinor are
  the exact product of quantity and purchase price, separate from totalValue book
  valuation; product must be safe. Unsupported saved values fail visibly and
  cannot be hidden by unrelated patches/imports/bulk writes.
- List accepts search/category text, categoryId UUID, status active/inactive/
  low_stock, sortBy name/code/quantity/purchasePrice/salePrice/createdAt/category,
  sortOrder asc/desc. Default createdAt descending, stable id tie. page is 1..1000000,
  limit 1..200, default 1/50. Unknown/malformed parameters fail validation rather
  than partial integer parsing. pagination retains page/limit/total/totalPages.
  Summary is unfiltered, org-wide: totalValue is exact SQL numeric sum of
  quantity*purchasePrice, converted only after a safe bound check; totalValueMinor
  is additive. Counts are ordinary integers. avgMargin is approximate descriptive
  percentage, not ledger money; nonfinite/unsafe output fails shared serialization.
- Reorder suggestions retain `2*reorderPoint-quantityOnHand` as a safe whole count
  (can exceed int32; not a writable quantity). Supplier numeric cents plus nullable
  purchasePriceMinor use MON-074. Owned joins exclude foreign contact details;
  preferred sources sort first. Deleted owned supplier history remains readable.

## Category and bulk contracts

Categories contain no money. name is required on create, other text color/
description nullable optional, max 10000. parentId is nullable optional live owned
UUID. Organization lock serializes graph edits; foreign/missing/deleted parents,
cycles and duplicate names including deleted history fail. Omitted PATCH fields
retain values. Soft-deletion detaches live child categories and item categoryId
references, recorded in the same audit transaction. Free-text item category remains.

Bulk ids are 1..200 distinct live owned item UUIDs; the entire set must exist.
set_category requires max-10000 free text, empty clears; categoryId is untouched.
adjust_stock requires nonzero signed int32 whole-unit adjustment and optional
max-10000 reason. Action-specific extraneous fields fail; each MCP operation has
its own schema. Quantity cannot become negative or exceed int32. Current UTC date
must be unlocked, including closed fiscal years. Existing FIFO/average paths
remain, with exact ratio rounding for average unit cost and issue movement cost.
Products, cumulative FIFO costs, new book value and legacy receipt numerators are
preflighted using bigint; Number paths are entered only within safe limits.
Posting accounts must be live owned asset/expense accounts in org base currency.
All items, movements, FIFO layers, GL and audits commit together. Zero-value stock
adjustments write movement/quantity and audit without a nonzero journal. Repeating
a stock adjustment represents a new event; no new retry-token guarantee is claimed.
MON-076 retains standalone movement/adjustment and cross-writer qualification and
can reuse this adopted bulk service instead of duplicating it.

## Opening stock, import and export coordination

Opening positive value is exact quantity*purchase price, guarded before insertion.
The existing valuation path sets averageCost/totalValue and writes an initial
movement. DR Inventory / CR Opening Balance Equity (3000) is posted for exactly
the same value; movement links to its journal. Account types, ownership, active
status, base currency and open period are enforced. Organization/code and item
locks serialize this slice; duplicate concurrent creates have one winner. Audit
failure rolls back item, accounts, valuation and GL. Duplicate codes return 409.

CSV accepts max 5 MB/1000 logical data records, quoted commas/newlines and doubled
quotes. Headers normalize case, spaces, underscores and hyphens. Required code/name;
supported columns description/category/sku/purchasePrice/salePrice/quantityOnHand/
reorderPoint/purchasePriceMinor/salePriceMinor/status. Aliases item_code/item_name/
product/desc/cat/barcode/cost/cost_price/price/sell_price/quantity/qty/stock/on_hand/
reorder/min_stock map to these fields. Unknown/duplicate/missing headers, malformed
quotes and empty files fail the request. Each data row must match column count.

Legacy CSV purchasePrice/salePrice are TWO-DECIMAL MAJOR UNITS; 0.29 becomes 29
cents exactly, regardless of organization currency, preserving this format.
*Minor columns are integer cents, with exact alias agreement. Empty prices/physical
fields default zero. Physical inputs use canonical whole integers, never parseInt.
Status accepts Active/Inactive, including case variants; empty retains/defaults.
Overprecision, invalid text, unsafe alias/product and fractional quantities return
row errors before writes. Existing live codes update master fields only, retaining
on-hand, book value, average/FIFO layers and GL even if CSV supplies quantity;
new codes receive valued opening stock. Deleted codes cannot be recreated.
Valid rows commit independently with transactional audit; errors use logical record
numbers (header=1), not physical newline count inside quoted fields. Infrastructure
errors remain failures, not fabricated validation messages; earlier valid rows may
already have committed. Reimporting a code updates master without receiving stock
twice. New opening journals are per item rather than the old combined post-loop
journal, ensuring each row's ledger/valuation/audit is atomic.

Master create/edit and bulk quantity forms use exact conversions. USD/two-decimal
catalog presentation is retained explicitly; locale/currency rollout is separate.
The local inventory-list CSV export now uses exact decimal strings and its Status
column round-trips through this importer. Generic REST export/*, import jobs and
shared Excel/CSV adapters remain MON-033; reuse these declared formats and do not
reinterpret legacy major columns as minor. Valuation-specific exports remain
MON-077/033. No claim that all generic export consumers are migrated.

## Errors and qualification limits

400 malformed/unsupported input, unknown fields, duplicate IDs, cycles, negative
result or quantity overflow; 401 invalid/expired auth; 403 missing permission;
404 foreign/missing/deleted resources; 409 duplicate code/category; 422 locked date,
invalid posting account or classified LEGACY_NUMERIC_RANGE; infrastructure faults
500 with generic REST error. CSV row errors remain in the 200 result envelope.
No bigint JSON crash or repair of already-rounded history. Response preflight and
transaction rollback prevent unsupported outputs leaving committed writes.

Actual disposable migrated PostgreSQL18 fixtures invoke REST API-key handlers,
custom roles, the full SDK registry and standalone strict tool registry. Tests
cover legacy/exact/dual clients, opening GL/currencies, units/import replays,
FIFO adjustments, tenant/role/reference/range failures, unsafe saved rows and SQL
aggregates, concurrent duplicate create and nine audit-trigger rollback paths.
This is not PostgreSQL16, browser/session/OAuth or independent accounting/security
qualification. Full-range ORM/business and production IRR gates remain separate.
