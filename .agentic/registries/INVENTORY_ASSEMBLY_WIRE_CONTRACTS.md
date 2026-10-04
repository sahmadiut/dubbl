# Inventory BOM and assembly contracts (MON-078)

Implemented safe-number compatibility slice; not full-int64, IRR enablement or
independent financial/security qualification. Evidence: MON-078-attempt-1.md and
MON-078-review-1.md. No schema changes or new migration are needed: FIFO residuals
use MON-077 migration 0008's nullable remainingValue/consumption value.

## Operations and envelopes

All REST paths below have /api/v1/inventory prefix. All fifteen operations have
one corresponding MCP tool, registered in the full catalog. Direct scoped
Drizzle services are shared; no HTTP self-calls. Reads require authentication;
all writes require manage:inventory through the supplied AuthContext.

| REST | MCP | Result |
|---|---|---|
| GET /bom | list_boms | data with nested assemblyItem, components, costBreakdown |
| GET /bom/:id | get_bom | bom, costBreakdown |
| POST /bom | create_bom | bom (REST 201) |
| PATCH /bom/:id | update_bom | bom |
| DELETE /bom/:id | delete_bom | success |
| GET /bom/:id/components | list_bom_components | components with nested componentItem |
| POST /bom/:id/components | add_bom_component | component (REST 201) |
| PATCH /bom/:id/components?componentId=UUID | update_bom_component | component |
| DELETE /bom/:id/components?componentId=UUID | remove_bom_component | success |
| GET /assembly-orders | list_assembly_orders | data with nested bom/assemblyItem |
| GET /assembly-orders/:id | get_assembly_order | order with nested bom/assemblyItem |
| POST /assembly-orders | create_assembly_order | order (REST 201) |
| PATCH /assembly-orders/:id | update_assembly_order | order |
| DELETE /assembly-orders/:id | delete_assembly_order | success |
| POST /assembly-orders/:id/complete | build_assembly | order, journalEntryId, totalCost/unitCost/componentCost/conversionCost with Minor aliases |

Existing REST numeric fields/envelopes remain. Detail/order-delete and component
PATCH are additive. Completion retains an empty-body UTC-today request; an
optional JSON date now matches MCP's existing date input. Malformed JSON and
unsupported body fields reject. MCP uses bomId, assemblyOrderId and componentId
UUIDs explicitly; every input field describes units and expectations.

## Inputs, units and ranges

- BOM create requires live active owned assemblyItemId and name (1..10000 chars).
  Optional nullable description (up to 10000), laborCostCents and
  overheadCostCents default zero. Update accepts name, description, both costs
  and isActive; omitted values retain, description null clears. Finished item
  identity is retained, not changed via PATCH.
- Costs remain **integer base-currency stored minor units per finished unit**
  (USD cents). laborCostCentsMinor/overheadCostCentsMinor are additive canonical
  nonnegative integer strings, agreeing exactly with numeric fields when both
  supplied. No major-unit conversion or currency/magnitude-based rescaling.
  Supported money and aggregate outputs are 0..9007199254740991. Aliases accept
  signed-int64 syntax constrained nonnegative; values outside the safe bridge
  reject 422 before persistence. No leading zeros, negative zero, exponent,
  whitespace, fractions, localized digits or out-of-int64 strings.
- Recipe quantity is **physical decimal units per finished unit**, not stored
  document hundredths. Legacy decimal strings/numbers remain; quantityExact is
  an additive decimal string. Either quantity or quantityExact is required on
  add; both must agree rationally. Supported decimal spelling has mandatory
  whole digits, no leading zeros/sign/exponent/whitespace/localized digits,
  up to ten whole and six fractional digits, with value >0..2147483647.
  Numeric clients use their shortest decimal spelling and must fit that same
  grammar; no binary multiplication is performed. Exact strings are preferred.
- wastagePercent/Exact are plain percent, 0..100 with six decimal places;
  default zero. They are not basis points, money or currency. Both aliases agree.
  Component update retains omitted item/quantity/wastage, permits replacing the
  live owned item and rejects self-consumption. Historical unsupported recipe
  decimals fail visibly on read/build rather than being rounded or reinterpreted.
- Assembly quantity is positive int32 **whole finished units**, 1..2147483647.
  Metadata notes allow null, up to 10000 chars. Date is a real canonical Gregorian
  YYYY-MM-DD; omission uses UTC today, independent of presentation timezone.
- Responses retain legacy numeric cost fields and add canonical *Minor strings.
  Nested inventory DTOs include purchasePriceMinor/salePriceMinor/averageCostMinor/
  standardCostMinor/totalValueMinor. Recipe rows retain quantity/wastagePercent
  and add quantityExact/wastagePercentExact. Null saved wastage means zero.
  BOM list/detail add currencyCode (organization base) and costBreakdown aliases.
  Quantity, percent, IDs and timestamps are never labeled Minor.
- Invalid/unsafe historical costs and aggregates produce classified 422, never
  rounded Numbers, bigint serialization failures or partially committed writes.
  Strict REST/MCP schemas reject unknown keys. No representation negotiation or
  full-int64 business claim is added.

## Estimation and completion valuation

BOM estimates multiply purchasePrice by exact recipe quantity and
(1 + wastage/100), sum as bigint ratios, then round the aggregate material cost
once with ties toward +infinity. Labor and overhead are added exactly. This is
a **purchase-price estimate per finished unit**, not actual component carrying
cost or a promise about whole-unit build cost. The list now uses the same server
estimate as detail; it no longer omits wastage or computes money with floats.
Dashboard display uses canonical minor strings and organization currency.

Completion calculates ceil(recipe quantity * build quantity * (1 + wastage/100))
exactly **per recipe line**, then groups repeated item IDs. This preserves the
whole-unit stock contract and existing per-line wastage rule. Zero/negative
requirements, int32 overflow, self-consumption, inactive/deleted/foreign sources,
insufficient grouped stock and standard costing reject before stock changes.
Active live BOM, finished item and every component are required. Multi-level
recipes consume the selected component's existing stock; no recursive builds.

Component and finished item locks use sorted IDs. FIFO preflight requires open
layer quantity/value to match item quantityOnHand/totalValue, and uses exact
remainingValue or historical null's original quantity * unitCost. It mirrors the
shared engine's partial proportional rounding and final-layer residual
exhaustion; no fallback cost is accepted for inconsistent assembly layers.
Average costing uses shared saved averageCost, capped at carrying value, and
consumes all residual value on final exhaustion. Unsupported negative stock or
inconsistent layers fail for separate remediation; no historical rewrite.

Labor plus overhead are multiplied by finished quantity exactly. Finished
totalCost = issued component cost + conversion cost. Display unitCost rounds
totalCost / finished quantity, but **receipt movement value, totalValue and FIFO
remainingValue receive the full totalCost**, rather than rounded unitCost * qty.
An optional totalCost argument in the shared receipt engine is used only for
this adoption; its unitCost must match exact rounded value / qty. Existing
procurement/master writers omit it and retain their previous valuation contract
and divisibility restrictions. No MON-052 behavior is relaxed.

One journal posts DR Finished Goods (owned item's inventory account or 1320),
CR grouped component inventory accounts (owned account or control 1300), and
CR liability Manufacturing/WIP Clearing 2305 for **actual conversion cost**.
No fictitious rounding credit/debit is needed. Accounts must be live active,
owned, correctly typed and in posting base currency. No foreign-currency
conversion, warehouse redistribution or negative inventory posting is introduced.
All movements reference the order and same journal, whose sourceId is the order.
Zero-cost builds retain a balanced zero-value journal and real physical movements.

## Transactions, lifecycle and authorization

Organization locks serialize adopted writes/numbering; order/BOM/item/layer locks
serialize completion against edits and stock movements. BOM/components, order
CRUD, stock/layers/consumptions, GL, completion status and audit are transactional.
Money/quantity preflight, exact rollup, response serialization and audit must
succeed before commit; failure rolls back the whole operation. Period/fiscal
locks use the posting date and existing advisor/custom-permission behavior.
Metadata-only edits do not post money and do not require a period check.

Draft/in_progress orders can edit quantity/notes or cancel. Completion is only
through the build operation: direct PATCH completed rejects. Completed and
cancelled orders cannot be edited or rebuilt. Only noncompleted orders can be
soft-deleted. Open orders must be cancelled/deleted before BOM soft deletion;
owned deleted BOM metadata remains available for historical completed orders.
Read/build nested inventory references must be live and owned. No completion
reversal or posted-history rewrite is provided. Retry/concurrent completion has
one success and subsequent 409, with one source journal and audit.

REST API-key organization cannot be overridden by an organization header. All
root rows and nested returned inventory/recipe IDs are checked against context.
Component removal/update checks both parent ownership and component membership.
Posting inventory/clearing accounts are validated, including corrupt historical
foreign references. Existing authentication/custom-role logic is reused.

400 invalid schemas/aliases/date/JSON/IDs; 401 invalid/expired API credentials;
403 insufficient permissions; 404 missing/deleted/foreign root or nested source;
409 final lifecycle/repeated completion/open-order BOM delete; 422 period/fiscal
lock, safe-money range, unsupported cost method/history/stock/account or recipe
aggregate. Zod/SDK errors retain existing REST/MCP wrappers; unexpected failures
return existing internal-error envelopes after transaction rollback.

## Qualification limits

Actual fixtures use migrated disposable PostgreSQL 18, REST handlers with API-key
authentication and SDK in-memory MCP clients/full catalog. No browser/session/
OAuth transport, PostgreSQL16/clean-install CI, build/dev server, external provider,
independent human accounting/security review or production deployment is claimed.
Parent MON-024 retains combined inventory acceptance. Full-int64 ORM/domain,
restore/migration, IRR rollout and release qualifications retain assigned gates.
