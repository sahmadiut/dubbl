# Combined inventory catalog acceptance - LOC-066

2026-10-20 (Asia/Tehran). This parent independently audits LOC-072..078 after
their completion. LOC-008/002 and native terminology, mounted-browser, full
RTL and output/release qualification remain separate. Persian is provisional.

## Complete source and catalog inventory

The combined inventory contains exactly 18 route TSX files, five creation
drawers and three shared pickers. All eight owned namespaces contain 682 paired
messages; the full catalogs have 7,010 compatible keys per locale. Existing
SharedUI loaders, confirmations and adjacent shared controls retain their own
catalog ownership.

| Child and namespace | Messages | Actual owned surfaces |
|---|---:|---|
| [LOC-072](INVENTORY_CATEGORY_CATALOGS.md): InventoryNavigation / InventoryCategories | 5 / 40 | Inventory root layout; categories page; CategoryPicker; CategoryDrawer |
| [LOC-073](INVENTORY_ITEM_CATALOGS.md): InventoryItems | 208 | Item list; item layout/details/history; InventoryItemPicker; InventoryDrawer |
| [LOC-074](INVENTORY_VARIANT_SUPPLIER_CATALOGS.md): InventoryCatalogs | 54 | Item variants and suppliers pages |
| [LOC-075](WAREHOUSE_CATALOGS.md): Warehouses | 77 | Warehouse page; WarehousePicker; WarehouseDrawer |
| [LOC-076](INVENTORY_MOVEMENT_CATALOGS.md): InventoryMovements | 168 | Stock-take list/detail and transfers pages; StockTakeDrawer; TransferDrawer |
| [LOC-077](INVENTORY_ASSEMBLY_CATALOGS.md): InventoryAssembly | 84 | BOM list/detail and assembly pages |
| [LOC-078](INVENTORY_REPORT_CATALOGS.md): InventoryReports | 46 | Valuation, alerts and shared loading route |

The combined test pins every route filename, all five drawer bodies and their
shared footer/section chrome, and all three picker sources. AST inspection checks
authored JSX text, display attributes, toast arguments and document-title calls.
Child tests additionally inspect finite errors, dynamic display labels, ICU
arguments, callbacks, canonical requests and response validation. Source and
existing child inventories were reviewed together; passing AST checks alone is
not treated as proof of complete translation or business correctness. No further
product/catalog changes were needed for this parent.

## Explicit exceptions and preserved contracts

- Caller names, codes, categories, notes, descriptions, supplier names, SKUs,
  IDs, custom placeholders and unknown historical movement labels remain caller
  data. React escapes them; barcode print text uses the existing escape helper.
- Illustrative ITEM-001, WH-001/WH-002, SKU-DESK-001, valuation example identifiers
  and USB-C protocol spelling remain identifiers. Static example quantities,
  money, percentages, punctuation, multiplication markers and blind-count masks
  retain their existing meaning. The combined JSX/attribute audit allows only
  the authored identifier/multiplier exceptions actually present there.
- InventoryAssembly.orderName and InventoryMovements.statusCount contain only
  interpolated caller/translated values and punctuation in Persian. The other
  owned Persian messages contain Persian script. This is a structural check,
  not native linguistic approval.
- CSV headers/order, quoting, exact ASCII decimal money, filenames and MIME
  types remain canonical. Form names, sort/filter/status values, drawer types,
  URLs, methods, query parameters, organization headers, custom refetch events
  and request payloads retain their existing contracts.
- Canonical Minor strings, safe legacy numeric aliases, bigint calculations,
  USD/JPY/KWD scales where supported, saved stock/physical-decimal precision,
  nullable history, cost flow and stock posting remain unchanged. Legacy fixed
  USD item inputs are not converted to a different currency by this acceptance.
  Existing number/date/calendar presentation and full RTL qualification remain
  separate.
- Shared contact/date/currency controls retain their existing independent scope.
  Source inspection confirms there is no BOM/assembly creation drawer in this
  creation surface; this parent does not invent a new UI operation.

## Combined behavior and transport evidence

[Combined tests](../../tests/inventory-catalog-integration.test.ts) execute
production modules in one cache, preserving the real item context and linking
the actual category, warehouse and item pickers to their consumers. Real
next-intl/PresentationProvider covers both locales, exact low digits at
4,000,000,000,000,001 minor units, localized ready/pending footers, signed/int32
input boundaries, escaped caller data, the five canonical navigation routes,
detail-route navigation suppression, and loading/missing/invalid-money states
that suppress nested editable details. Child suites retain their more extensive
write-failure, cancellation, read-race and malformed-response checks.

The unchanged migrated inventory master, catalog, movement, assembly, valuation,
UI-money, detail-money and combined-inventory fixtures exercise actual REST
handlers, linked registered MCP tools and independent SQL assertions. Existing
inventory presentation readers are already included in these workers. They
check transport agreement, exact aliases, warehouse/default/stock records,
counting/transfers, assembly, FIFO/carrying value, revaluation/write-down,
balanced journals, permissions, organization isolation and atomic rollback.
No transport fixture is replaced by mocked HTTP.

Existing registerInventoryMasterTools, registerInventoryCatalogTools,
registerInventoryMovementTools, registerInventoryAssemblyTools,
registerInventoryValuationTools, registerWarehouseTools and
registerInventoryTools expose the unchanged operations via org-scoped
AuthContext/wrapTool and direct DB services. No new user operation or REST route
requires an additional tool in this parent.

See [attempt evidence](../evidence/LOC-066-attempt-1.md) for actual command
results and [self-review](../evidence/LOC-066-review-1.md) for review boundaries.
Controlled hook/IO/portal rendering does not mount browser interaction. No
production application, catalog, REST/MCP/service/auth/schema/migration,
financial arithmetic, FX/IRR or Stripe source is changed by this acceptance.
