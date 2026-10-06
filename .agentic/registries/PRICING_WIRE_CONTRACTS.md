# Price-list and resolution contracts (MON-091)

2026-10-06, Asia/Tehran. Bounded adoption under MON-027; self-review only.
Shared direct-Drizzle services: lib/api/pricing.ts. Strict described schemas and
saved-value preflight: pricing-wire.ts. Existing pricing tool registration in
tools/index.ts is retained. No schema/migration or rollout flag changes.

## Boundaries and envelopes

REST paths below are relative to /api/v1. UUIDs are validated. Each tool uses
the server AuthContext and wrapTool; no HTTP self-calls. Reads retain authenticated
organization access, including custom roles without mutation permissions. Every
mutation requires manage:inventory in both transports.

| REST operation | MCP operation | Input / returned envelope |
|---|---|---|
| GET price-lists | list_price_lists | No body / REST data; MCP priceLists |
| POST price-lists | create_price_list | Name, optional currency/active/dates / priceList; REST 201 |
| GET price-lists/:id | get_price_list | List ID / priceList with items |
| PATCH price-lists/:id | update_price_list | Optional name/currency/active/dates / priceList |
| DELETE price-lists/:id | delete_price_list | List ID / success; MCP adds deletedPriceListId |
| GET price-lists/:id/items | list_price_list_items | List ID / REST data; MCP priceListItems (new parity tool) |
| POST price-lists/:id/items | add_price_list_item | Inventory ID, price aliases, optional tier / priceListItem; REST 201 |
| PATCH price-lists/:id/items/:itemId | update_price_list_item | Optional price aliases/tier / priceListItem |
| DELETE price-lists/:id/items/:itemId | delete_price_list_item | Parent/row IDs / success; MCP adds deletedPriceListItemId |
| GET price-lists/:id/resolve | resolve_price | Inventory ID, optional quantity/asOf / resolved object or null (new REST parity route) |

MCP root IDs are priceListId and priceListItemId. REST detail/items keep the
existing nested inventoryItem record, now strictly organization-scoped; owned
deleted/inactive items remain readable as history. MCP get retains itemCode and
itemName and omits the nested inventory record. All returned price rows, including
create/update/read and resolved prices, add unitPriceMinor. Existing numeric
unitPrice, parent metadata and success envelopes remain supported.

## Units and supported range

- unitPrice is the existing nonnegative integer **cents** value in the list's
  currency. unitPriceMinor is its canonical ASCII integer-string alias. No
  scaling, locale inference or magnitude-based reinterpretation occurs: 1250
  remains 1250 in USD, JPY and IRR price books. This preserves v1 storage semantics;
  the alias does not authorize a currency-regime or IRR production rollout.
- Supported price range is 0..9007199254740991 for both aliases, despite expanded
  physical bigint storage. Exact strings must fit int64 and the safe ORM/business
  bridge. Valid int64 prices above the safe bound fail with classified 422
  LEGACY_NUMERIC_RANGE before writes, rather than silently widening this workflow.
- Add requires either alias or agreeing aliases. Negative values, negative zero,
  fractions, whitespace, exponent/plus/leading-zero strings, localized digits and
  string coercion in the numeric field reject. Zero is valid. Update omission
  retains the saved price; aliases are removed before ORM persistence.
- minQuantity and resolver quantity are whole physical units, 1..2147483647,
  default 1. They are not scaled quantities, money, percent or hours. Resolver
  returns the unit price without computing or promising any safe extended product.
  Callers remain responsible for product/aggregate bounds.
- Currency is a validated ISO code (input trim/uppercase retained by shared
  currency schema); defaults USD on creation. Each list has its own currency;
  books in different currencies coexist without conversion or aggregation.
  Currency PATCH intentionally retains existing integer prices and reinterprets
  their denomination, preserving the documented v1 behavior. Posted invoice/quote
  lines are not rewritten. No implicit FX or historical rate is introduced.
- Dates are valid Gregorian YYYY-MM-DD, years 0001..9999, inclusive boundaries;
  null clears either boundary, omission retains it. Merged update windows must
  remain ordered. Resolver asOf defaults today's UTC date, independently of locale.
- Names are nonempty, up to 10000 characters and unique within the organization,
  including deleted books, matching the physical index. Unknown body/tool fields
  reject. Resolver REST query accepts only inventoryItemId, quantity and asOf;
  quantity uses canonical positive ASCII digits, and repeated/unknown keys reject.

## Resolution, scope and atomicity

Resolution chooses the highest minQuantity <= quantity. Missing/foreign/deleted,
inactive/out-of-window books, unavailable inventory or no eligible tier return
resolved:null in both transports, without revealing foreign roots/items.
This corrects the old MCP precheck which threw for missing books despite its
documented null contract. Corrupt money/tier/list metadata rejects with 422;
foreign saved inventory joins reject with 404 without leaking linked data.

Mutations lock the live organization first, coordinating existing invoice/quote
and inventory-master writers that use the same organization lock. Parent lookup
and row predicates enforce both selected list and organization; inventory add/
update requires live active owned inventory. Read transactions use repeatable-read
snapshots. All six mutation types commit their audit in the same transaction,
and money/metadata/JSON response preflight runs before commit. Actual audit and
post-write output faults are tested for rollback. Duplicate name/tier checks
produce 409, with existing DB unique indexes retained. Cross-transport competing
adds/creates and deletes serialize; deletion retains rows but disables resolution.
There is no idempotency key added: unique named/tiered creation retries conflict,
repeat soft deletion returns 404, and updates are serialized assignments.

These books do not post accounting entries, allocate invoices, adjust stock or
change posted history; accounting period locks therefore do not apply to metadata
CRUD. Existing invoice/quote price lookup now preflights saved list metadata and
tiers with the same DTO guards. It retains its decimal physical quantity, pricing
fallback, explicit-currency check and independently bounded extended-price math.
Invoice/quote lifecycle/ledger policies remain in their existing services.

## Qualification and remaining scope

Four pure groups cover aliases, schema rejection, dates and saved DTO ranges.
The migrated disposable PostgreSQL worker invokes every actual REST/MCP pair,
complete SDK registration, API-key membership/custom-role auth, foreign headers,
saved joins, safe maxima, inclusive windows, races and audit/output faults.
Existing invoice-write and quote transport regression workers also pass.

Project/CRM contracts and combined acceptance remain MON-092..094/MON-027.
Full-int64, migration/IRR/financial/release qualification is not claimed. No
new price-list dashboard is added; inspected app source has no price-list editor.
Performance for unpaginated large price books and independent accounting review
remain broader qualification work. No deprecation deadline is invented.
