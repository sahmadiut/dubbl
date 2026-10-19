# Inventory category catalogs

LOC-072, 2026-10-20 (Asia/Tehran). Implementing-assistant self-review only.
Persian wording is provisional pending native terminology and RTL qualification.
LOC-066/008/002 retain independent combined acceptance.

## Owned surfaces

| Source | Coverage |
|---|---|
| `app/(dashboard)/inventory/categories/page.tsx` | Document title, tree/count, empty state, first creation/edit sheet, parent/root choices, accessible edit/delete/color labels, confirmation, CRUD/read messages |
| `components/dashboard/category-picker.tsx` | Default/search/empty placeholders, add/edit actions, edit sheet, pending state, color labels, confirmation and read/write failures |
| `components/dashboard/create-drawer.tsx`, `CategoryDrawer` only | Creation description, sections, name/color/description fields, examples, submit/pending/cancel and create result |
| `app/(dashboard)/inventory/layout.tsx` | Five existing tabs; same routes, icons and exact root matching |
| `i18n/inventory-category-presentation.ts` | HTTP/JSON/envelope/row validation before state adoption; safe localized operation fallbacks in callers |

Forty paired `InventoryCategories` messages and five paired
`InventoryNavigation` messages bring each locale to 6,373 keys. ICU handles
category counts. Existing common sheet/loader/confirmation primitives retain
their own catalogs; `CategoryDrawer` supplies all localized footer overrides.

## Behavior and preserved contracts

Category reads must return `{data,flat}` arrays with valid renderable category
rows; writes must return `{category}`, deletion `{success:true}`. Failed HTTP,
invalid JSON, malformed rows and network failures keep prior rows/form state
and show the corresponding localized operation error. Unknown server prose and
technical validator errors are not shown. Picker request ordering suppresses
stale success/error, retaining the pending counter cleanup.

The page's empty branch now shares its creation sheet and confirmation host
with the populated branch, so the first category can be created. Page deletion
now checks HTTP status and success envelope before a success toast/refetch.
Drawer submission checks organization presence before setting its busy state.
Deletion confirmation describes the existing backend unlink behavior for items
and child categories while retaining the free-text item category.

Names/descriptions and caller-supplied picker placeholders are escaped caller
content. IDs, parent relationships, hex colors, input names, root/null/empty
values, endpoint paths, methods, organization headers and the
`refetch-categories` event remain canonical. Page forms retain `parentId`;
picker/drawer forms retain their existing omission of it. Existing root-only
parent eligibility and selection toggle/clear behavior are preserved. No money
fields or computations are introduced.

Existing MCP counterparts remain `list_inventory_categories`,
`create_inventory_category`, `update_inventory_category` and
`delete_inventory_category`, registered through inventory-master and backed by
the same direct Drizzle services as REST. Routes, API/MCP schemas, services,
authorization, database schema/migrations and accounting are unchanged. See
[wire contract](INVENTORY_MASTER_WIRE_CONTRACTS.md). No new operation needs a
new tool.

## Exceptions and adjacent ownership

- User-authored names, descriptions, parent names, category IDs and color codes
  remain data. Technical response-validation errors are internal only.
- Class names, form names/IDs, HTTP/header/event identifiers, drawer type
  `category`, routes and structural enum values are machine contracts.
- Tree indentation/directional icons, full dates/numerals and mounted keyboard/
  RTL qualification remain later RTL/L10N ownership; matching keys do not
  establish native-reviewed financial terminology.
- LOC-073 owns item pages/creation/picker, LOC-074 variants/suppliers, LOC-075
  warehouses/picker/drawer, LOC-076 movements/stock-takes/transfers, LOC-077
  assembly/BOM, LOC-078 valuation/alerts/loading and residual inventory strings.
  Other `create-drawer.tsx` sections are outside this child.
- LOC-067..071 retain payroll, projects, CRM, reports and dashboard/documents.
  LOC-009 owns public/output authored templates. DEC-008 preserves Stripe.

## Verification

[Eleven focused tests](../../tests/inventory-category-catalogs.test.ts) render
production templates with real `next-intl`/`PresentationProvider`, real controls
and shared drawer footer. Portal and hook boundaries are controlled; this is
not mounted browser qualification. They exercise actual authored callbacks with
controlled IO, malformed responses, canonical payloads, root eligibility,
escaping, busy/empty states, selection and stale response behavior, plus a source
copy audit and Persian-script assertions. The existing migrated inventory-master
REST/MCP/SQL suite separately verifies transport, scope, category graph/audit
and money regressions on a disposable loopback database.

See [attempt](../evidence/LOC-072-attempt-1.md) and
[self-review](../evidence/LOC-072-review-1.md) for completed checks and limits.
