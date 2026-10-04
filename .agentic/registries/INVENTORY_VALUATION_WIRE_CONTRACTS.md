# Inventory valuation and landed cost contracts (MON-077)

Implemented contracts, not full-int64/IRR/production qualification. Actual runtime
fixtures and review: MON-077-attempt-1.md and MON-077-review-1.md.

## Operations and response envelopes

| REST | MCP | Result |
|---|---|---|
| GET /landed-costs | list_landed_costs | REST data/pagination; MCP allocations/total/page/limit |
| POST /landed-costs | create_landed_cost | allocation (REST 201) |
| GET /landed-costs/:id | get_landed_cost | REST direct record; MCP allocation; components, lineAllocations, linked bill/PO |
| PUT /landed-costs/:id | update_landed_cost | REST direct record; MCP allocation |
| DELETE /landed-costs/:id | delete_landed_cost | success |
| POST /landed-costs/:id/allocate | allocate_landed_cost | allocation, lineAllocations, journalEntryId |
| GET /reports/inventory-valuation | get_inventory_valuation | items, summary |
| GET /inventory/:id/cost-layers | list_inventory_cost_layers | inventoryItem, currencyCode, data (layers with consumptions) |

All paths have /api/v1 prefix. Existing envelopes/numeric fields remain. Two MCP
CRUD operations and report/layer counterparts are now registered in the full
catalog. Direct organization-scoped Drizzle services; no HTTP self-calls.

## Inputs, units, aliases and range

- Batch creation: name (1..10000 chars), optional nullable billId/purchaseOrderId
  UUIDs, allocationMethod by_value/default or by_quantity, currencyCode/default USD,
  1..1000 components. Components have description, optional nullable owned
  accountId and amount and/or amountMinor. Update changes name/method only.
  Unsupported keys reject; omission retains fields, null clears nullable metadata.
- **Legacy component amount is a two-decimal major number:** 12.50 stores 1250,
  independently of currency, preserving the existing REST/MCP contract. Its
  shortest decimal spelling is multiplied by 100 using bigint ratios and rounded
  ties toward +infinity (1.005 -> 101). This legacy contract is explicitly distinct
  from currency-aware major inputs. The dashboard's decimal editor sends exact
  amountMinor via the same fixed-two-decimal adapter, without parseFloat.
- amountMinor is a canonical nonnegative integer stored-unit string (USD cents).
  It is **not** a major-unit string. Both inputs must agree after legacy rounding.
  No whitespace, exponent, leading zero, negative zero, fractional integer alias,
  localized digits, negatives or out-of-int64 syntax. Safe int64 syntax outside
  0..9007199254740991 rejects 422 at the legacy ORM bridge before any insert.
  Legacy numeric major inputs must also round within this supported stored range.
- Batch totalCostAmount, component amount, line allocatedAmount, inventory values,
  journal amounts, layer unitCost/remainingValue and consumption unitCost/value are
  integer stored minor units, with additive canonical `*Minor` string aliases.
  Both numeric and exact clients retain the same stored integer. No opt-in switch,
  magnitude-based scaling, mixed alias type or full-int64 business claim.
- Allocation basis is **method dependent**: by_value uses PO line amount (minor
  units); by_quantity uses PO quantity stored in hundredths (300 = 3 units).
  allocationBasis remains nullable numeric; allocationBasisExact is the nullable
  canonical integer string. It is not mislabeled Minor. All current weights must
  be nonnegative and their sum positive. Intermediate sums/products use bigint.
- Physical stock/layer/consumption quantities are int32 whole units, separate from
  document quantity hundredths. FIFO order is receivedAt then id; PO allocation
  order is sortOrder then id. Dates are stored UTC instants; posting is UTC today.
- List page 1..1000000, limit 1..100; malformed numeric query strings reject.
  Report sortBy accepts name/code/quantity/totalCost/totalValue/marginPercent,
  sortOrder asc/desc. Legacy method weighted_average/fifo remains accepted as a
  presentation selection; configured item cost method determines carrying value,
  and the selector never recomputes posted cost history.

## Exact allocation and FIFO preservation

Allocation computes floor shares using exact bigint ratios, then assigns residual
minor units to the largest fractional remainders. Stable input order breaks ties;
zero-weight lines get zero. **Every component's shares sum to its saved amount**;
the batch total must agree with components. Duplicate item IDs across PO lines
roll up once, with item locks acquired in sorted ID order.

Capitalization requires batch and PO currencies equal organization posting base.
Foreign-currency batches remain draft metadata; allocation rejects rather than
posting the same integer as a different currency. Every PO line must be stock
backed by live active positive-on-hand average/FIFO inventory. Standard costing,
empty/exhausted stock, service lines, by_weight and manual reject explicitly.
Legacy stored weight/manual records remain readable; updating them to a supported
method is possible. No silent by-value fallback or dropped service-line share.
This preserves the supported legacy capitalization-on-current-on-hand behavior:
cost is spread over current stock/open layers for each PO item, not a new claim
that original shipment units can be reconstructed after later sales/receipts.

Average stock adds exact cost to authoritative totalValue and rounds averageCost
from value/quantity. FIFO also verifies total open-layer quantity/value equals
saved item quantity/value; inconsistent history fails for separate remediation.
It apportions added cost across open layers by remaining whole quantity, using
the same conserving algorithm. **Original layer unitCost is retained.** A nullable
new remainingValue carries exact current value, so fractional per-unit residuals
are not lost. Consumption allocates remaining carrying value by taken quantity;
partial issues use exact half-up rounding capped at available value, and final
exhaustion takes the entire residual. Consumption value is stored separately
from historical unitCost. Historical consumptions are not changed.

Migration 0008 adds nullable bigint remaining_value and consumption value only.
No backfill, rescaling, balance rewrite or dropping old columns. Null layer values
derive remainingQuantity * saved unitCost; null consumption values derive
quantity * saved unitCost. New shared receipts (including MON-052 bill stock)
write remainingValue explicitly; old rows switch when they are consumed or
capitalized. Bill reversal rejects capitalized/consumed layers rather than
removing a different amount. Existing FIFO receipt divisibility restrictions in
procurement remain; they are not silently relaxed. Adjacent assembly/lifecycle
writers still require MON-078/024 combined qualification.

## Report and presentation

The report preserves legacy unitCost = purchasePrice, totalCost = quantity times
purchasePrice, totalValue = quantity times salePrice, margin = difference,
marginPercent and summary totalMargin = display percentage. These are **price
projections**, not historical perpetual inventory balances. Additive carryingValue
and averageCost aliases show saved base-currency book valuation including landed
costs; summary carryingValue is its exact aggregate. All report money products,
differences and sums are checked safe integer values using bigint. Percentages
are finite display-only Numbers, never posted money. Unsafe individual/aggregate
values fail 422; no partially serialized report.

Dashboard valuation now uses API unitCost/summary totalValue correctly, labels
purchase price value separately from book value, and exports exact currency-aware
major decimals plus currency. Landed cost screens also display exact saved minor
amounts with batch currency. Layout/table column consistency inspected in source;
no browser/screenshot/visual runtime qualification claimed.

## Authorization, transaction and failures

AuthContext scopes every root read/write. REST API keys cannot override their
organization by header. Source bill/PO/accounts, nested PO item/account/warehouse
references, linked journal and cost-layer source/consumption/location ownership
are checked before disclosure. Historical owned layer locations remain readable.
All writes require manage:purchases. Existing getAuthContext/wrapTool authentication
and custom role rules remain unchanged. All schema fields have descriptions.

Create/components, draft update/delete and allocate/stock/layers/line allocations/
GL/audit commit in one transaction. Serializer preflight runs before commit. Org
and row locks serialize adopted writers. Allocated records are immutable; repeated
or concurrent allocation has one winner and subsequent 409 with no duplicate
posting. Allocation checks period/fiscal locks on UTC today before changing stock.
It posts one balanced DR inventory / CR live base-currency liability clearing 2160
journal (none when cost zero). Component accountId remains metadata; it does not
override the existing clearing credit contract. Audit failure rolls back everything.

400 = invalid schemas, aliases, IDs or missing PO/lines; 401 invalid/expired REST
credentials; 403 missing permission; 404 missing/foreign/deleted source; 409
allocated history/repeat; 422 period lock, unsupported business state or safe
money range (`LEGACY_NUMERIC_RANGE` for numeric compatibility failures). Existing
error wrappers provide REST/MCP envelopes. No successful mutation follows a
classified input, domain, source, range or response-preflight failure.

## Remaining gates

Full signed-int64 ORM/business range, migration/restore-wide qualification, IRR
enablement, independent human financial/security review and production release
remain assigned gates. No current tax/rate/provider facts are used here. No build,
dev server, Docker, real-account query, OAuth/browser or production deployment is
claimed. MON-078 handles BOM/assembly; MON-024 retains combined inventory acceptance.
