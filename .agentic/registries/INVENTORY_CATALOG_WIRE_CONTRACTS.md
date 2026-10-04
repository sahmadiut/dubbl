# Inventory variant and supplier contracts

MON-074. Implemented by the coding assistant, self-review only. Parent MON-024
retains combined inventory/costing qualification after MON-074 through MON-078.

## Operations and envelopes

All paths are below `/api/v1/inventory/{id}`; id is the live organization-owned
parent inventory item UUID. MCP uses `inventoryItemId` for this UUID and direct
Drizzle services with the server's AuthContext. No HTTP self-calls.

| REST | MCP | Success envelope |
|---|---|---|
| GET variants | list_inventory_variants | `{data: [...]}` |
| POST variants | create_inventory_variant | `{inventoryVariant}`, REST 201 |
| PATCH variants/{variantId} | update_inventory_variant | `{inventoryVariant}` |
| DELETE variants/{variantId} | delete_inventory_variant | `{success: true}` |
| GET suppliers | list_inventory_suppliers | `{data: [...]}` |
| POST suppliers | create_inventory_supplier | `{inventoryItemSupplier}`, REST 201 |
| PATCH suppliers/{supplierId} | update_inventory_supplier | `{inventoryItemSupplier}` |
| DELETE suppliers/{supplierId} | delete_inventory_supplier | `{success: true}` |

Other successful REST operations return 200. `supplierId` identifies the link,
not its contact. Variants sort by name/UUID; suppliers by UUID. Reads are existing
unpaginated per-item collections; full-range/large-workload qualification is separate.
The variants editor now consumes the existing `data`/`inventoryVariant` envelopes.

## Units, aliases and bounded range

- `purchasePrice` and variant `salePrice` retain existing integer cents per unit.
  Additive `purchasePriceMinor`/`salePriceMinor` are canonical ASCII integer strings
  in those same units. USD 1250 stays 1250. These currency-less catalog fields
  gain no inferred currency, org/contact currency conversion or FX snapshot.
  Organization KWD/IRR and supplier currency do not change stored/catalog units.
  Existing editors retain USD/two-decimal presentation; catalog/document currency
  policy and wider application presentation remain separate qualification.
- Supported new prices: 0..9007199254740991. Numeric or exact alias alone works;
  both must agree. Canonical int64 strings beyond safe Number range return 422
  `LEGACY_NUMERIC_RANGE` before mutation. This transitional Number ORM/business
  slice does not advertise full int64. No header/content negotiation or dynamic
  type switching. Outputs always include numeric prices and named string aliases.
- Malformed strings, negative prices, negative zero, unsafe numeric input,
  fractional amounts, exponents in string aliases, whitespace, localized digits,
  leading zeros, alias conflicts and unknown body fields reject with 400. JSON
  numeric lexical forms are governed by decoded numeric values; the string alias
  preserves strict canonical syntax. Null prices are output-compatible historical
  values, with null aliases; new writes do not accept null price input.
- Omitted creation prices default zero; omitted updates retain existing values.
  Saved unsupported/negative/unsafe prices return classified 422 on reads/updates;
  unrelated edits cannot mask invalid history. Deletes need no unsafe monetary
  decoding and may remove bad links/soft-delete bad variants without rescaling.
- `quantityOnHand` for a variant is existing metadata: signed int32 whole physical
  units (-2147483648..2147483647), default zero. It neither changes parent stock
  nor posts warehouse/movement/valuation/ledger. No monetary or hundredths alias.
  Null historical quantity remains null. This retains signed existing behavior.
- Supplier `leadTimeDays` is nonnegative int32 days, default zero. Historical null
  stays null. `isPreferred` defaults false and permits multiple preferred links.
  No uniqueness of preferred status is invented.
- Variant requires nonempty `name`; `sku` optional/null, `options` is an optional
  string-to-string map defaulting `{}`; update replaces it. Creation defaults
  `isActive` true; patch accepts `isActive`. Names/SKUs/options strings max 10000.
  Supplier create requires `contactId`; update cannot change it. `supplierCode`
  is optional, empty string clears, `isPreferred` optional boolean. Shared strict
  REST/MCP schemas describe all fields. Invalid JSON returns 400.
- Editors use BigInt decimal-to-cent conversion without float multiplication or
  rounding, reject excess decimal places and partial int32 quantity/day strings.
  Existing exact English formatter preserves safe-edge cents in display.

## Authorization, isolation and transactions

Authenticated org members can read; all writes require `manage:inventory`.
API-key org wins over conflicting `x-organization-id`. Parent, variant/link and
all mutation predicates carry organization and parent scope. Foreign/missing/
deleted parent or child returns 404; invalid UUID returns 400. Variant reads
exclude soft deletes and retain inactive rows. Supplier deletion removes the
link as before; variant deletion soft-deletes and retains its history.

Create/patch supplier references require live organization-owned supplier/both
contacts, locked FOR SHARE. Customer-only/deleted/foreign contacts return 404.
Read joins qualify contact organization too: malformed historical foreign links
are excluded, never exposing foreign names/emails. Deleted owned contacts remain
visible for history; their links may be deleted, but patch requires a live supplier.
Link deletion deliberately allows cleanup of an invalid foreign reference.

Mutations lock the scoped parent FOR UPDATE and the existing child FOR UPDATE;
duplicate supplier creation checks the existing `(item, contact)` uniqueness
before insert and returns 409. Mixed REST/MCP duplicate creation serializes with
one winner. Atomic audit shares the transaction with insert/update/delete, and
safe DTO/serialization preflight runs before committing. Read collections use
read-only repeatable-read snapshots. Parent locks coordinate this slice's writes
and direct parent updates; broader cross-writer/merge races remain MON-024/075.

These catalog operations never post monetary ledger/stock entries or change dates
of recognized documents; no fiscal period check is added to metadata edits.
No new idempotency key is invented: variant POST creates new records on repeat;
supplier uniqueness prevents duplicate links; repeated deletes return 404.
No schema, data migration, production flag, statutory rule or IRR enablement change.

## Verification and remaining qualification

`inventory-catalog-wire.test.ts` checks strict aliases, safe edges, nullable DTOs,
physical ranges and exact editor conversion. Migrated PostgreSQL worker calls all
eight actual REST operations and SDK tools (including full tool registration),
two tenants, viewer/custom-manager permissions, API keys, null/unsafe history,
bad contact joins, duplicate REST/MCP race and audit-trigger rollback for all six
writes. Text SQL snapshots include catalog, stock, ledger and audit rows. Ledger/
stock tables remain empty after catalog operations. No browser/session/OAuth,
network server, independent accounting/security review or production migration
claim. No build/dev server. MON-075/076/077/078 own the remaining source domains;
MON-033/034 own generic imports/opaque payloads; full-range/IRR gates remain.
