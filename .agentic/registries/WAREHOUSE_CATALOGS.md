# Warehouse catalogs - LOC-075

77 paired `Warehouses` messages, 6,712 compatible keys per locale.
Persian wording is provisional pending native terminology review. LOC-066,
LOC-008, LOC-002, native/RTL/browser/output qualification remain independent.

## Owned authored display

| Surface | Extracted content |
|---|---|
| `app/(dashboard)/inventory/warehouses/page.tsx` | Document/page title, empty example/help, benefits, stats/captions, default/active/inactive badges, filter/sort labels, search/loading/absence, edit form, confirmation and mutation/read feedback |
| `WarehouseDrawer` only in `components/dashboard/create-drawer.tsx` | Header, sections, labels/examples, creation feedback and shared-footer cancel/creating overrides |
| `components/dashboard/warehouse-picker.tsx` | Default placeholder, search/absence/failure text, default marker; caller placeholder override retained |

`i18n/warehouse-presentation.ts` checks HTTP/JSON/envelopes and displayed fields
before adoption or mutation success. Historical nullable active/default flags
remain nullable, with the previous truthiness behavior. Request failures use
finite operation-specific localized feedback; raw server/parser prose never
becomes display text or a catalog key. Failed writes retain forms/rows. Successful
writes and failed refreshes report distinct mutation-success/read-failure text.
Page request generations suppress stale results and effect cleanup invalidates
outstanding reads. Picker errors are visible; closing/superseding a read prevents
its adoption. Missing organization prevents writes and terminates page loading.

## Intentional exceptions and retained contracts

- Caller warehouse names, codes, addresses, IDs and supplied placeholder remain
  caller text, rendered through React escaping. No translation or normalization.
- Canonical `all`/`active`/`inactive`, `name`/`code`/`default`, `asc`/`desc`, drawer
  type `warehouse`, form names, routes, headers and `refetch-warehouses` event are
  unchanged. PATCH default uses `{ isDefault: true }`; location writes preserve
  `{ name, code, address }`, including blank-address null semantics.
- The illustrative `WH-001` code remains an identifier. Static example `248`,
  `$12,400`, `73%` and existing numeric statistic formatting remain unchanged;
  they are examples/formatting, not persisted financial records. Locale-specific
  numeral/currency formatting remains LOC-003 and later qualification work.
- Existing JSX punctuation around caller codes, icon names, CSS and motion values
  remain structural. No layout redesign, full RTL acceptance or calendar change.
- Other creation drawers, movement/stock-take/transfer, assembly/BOM and valuation/
  alert routes remain LOC-076..078. Inventory navigation is owned by LOC-072.

Existing REST warehouse CRUD and registered MCP `list_warehouses`, `get_warehouse`,
`create_warehouse`, `update_warehouse`, `delete_warehouse`, `get_warehouse_stock`
already cover unchanged operations through shared org-scoped services. No API,
MCP, schema/migration, stock, authorization, ledger, FX/IRR or Stripe change.

## Verification boundaries

Twelve focused tests render actual production JSX and controls through real
next-intl/PresentationProvider with controlled hooks and portal/IO boundaries.
They exercise form/busy/error behavior, delete cancellation, canonical request
payloads, filtering/sorting, nullable history, stale reads, caller escaping,
picker selection/deselection and Persian-script/source-copy audits. These are
controlled rendering/behavior checks, not mounted-browser or native review.
The migrated inventory movement fixture validates actual REST/MCP warehouse
DTOs with the new reader and independently checks SQL location/default values;
existing stock, money, isolation, permissions and rollback assertions remain.
See [attempt evidence](../evidence/LOC-075-attempt-1.md) for observed results.
