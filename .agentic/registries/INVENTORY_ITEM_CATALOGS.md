# Inventory item catalogs (LOC-073)

Bounded child of LOC-066: 208 paired `InventoryItems` messages, 6,581 keys per
locale. Persian wording is provisional pending native terminology review.
LOC-066/008/002 retain independent combined acceptance.

## Owned surfaces

| Surface | Authored copy and behavior |
|---|---|
| `app/(dashboard)/inventory/page.tsx` | Document title, statistics, movement chart period/legend labels, filters, sort labels, accessible actions, status help, empty/search/loading states, selections/counts, CSV feedback, bulk category/count/delete sheets, import results and safe errors |
| `app/(dashboard)/inventory/[id]/layout.tsx` | Workspace navigation, back links, statuses/tooltips, exact money statistics, adjustment and write-down sheets/previews/validation, read/retry and mutation feedback |
| `app/(dashboard)/inventory/[id]/page.tsx` | Details fields/sections, save/delete/revaluation states and confirmations, per-location stock heading, barcode preview/print heading and safe errors |
| `app/(dashboard)/inventory/[id]/history/page.tsx` | Document title, empty/read states, finite movement labels and creator attribution |
| `components/dashboard/inventory-item-picker.tsx` | Default/search/empty labels, quantities and read errors; caller placeholder overrides retained |
| `components/dashboard/create-drawer.tsx` | InventoryDrawer only, plus one presentation-helper import; translated shared footer cancel/pending overrides |
| `i18n/inventory-item-presentation.ts` | Presentation response validators, finite movement and local write-down error mapping, escaped barcode print text |

## Contracts and behavior

Response helpers reject failed HTTP, invalid JSON, malformed envelopes/rows and
inconsistent exact money before any response-driven state adoption. They reuse
the existing inventory money/count validators, retain numeric legacy values and
matching canonical `*Minor` strings, and never rescale or round stored values.
List results are validated completely before updating rows, summary or pagination.
Picker reads retain cancellation/request sequencing and organization isolation.
History and per-location reads now suppress cancelled results and handle failures.

Failed writes retain forms, selections and sheets; missing-org guards precede
busy flags. Deletion needs a verified success before toast/navigation. Bulk/import
success is distinguished from a subsequent failed refresh, preventing a saved
operation being reported as failed. Arbitrary server/parser prose is replaced
with reviewed localized fallbacks; import row numbers remain visible with an
actionable check-values fallback. Barcode print text escapes item names before
HTML interpolation; the CODE128 value remains the original SKU/code.

Existing REST/MCP operations already cover this UI: inventory-master item
list/get/create/update/delete/bulk/import and inventory-movement list/chart/adjust
plus item warehouse stock. They remain org-scoped direct Drizzle services with
the same authorization, period-lock, audit and money behavior. No new operation
or tool, API/MCP/service/schema/migration/accounting change is introduced. See
[master contracts](INVENTORY_MASTER_WIRE_CONTRACTS.md).

## Explicit exceptions and adjacent ownership

- Names, descriptions, categories, SKUs/codes, movement reasons/creator IDs and
  unknown movement type codes are caller data, escaped in HTML. Prototype-like
  unknown codes do not enter translation/style dictionaries through inheritance.
- CSV export headers (`Code` through `Status`), `Active`/`Inactive` values,
  `inventory-YYYY-MM-DD.csv`, MIME, quoting and exact two-decimal USD values stay
  canonical interchange data in both locales. Import column identifiers in help
  remain canonical. Raw REST/MCP import error strings remain transport data; the
  UI displays a localized safe row fallback rather than arbitrary server prose.
- URLs, headers, IDs, object/form fields, filter/sort/action/type codes, numeric
  chart keys/periods, events and control names remain machine contracts.
- `ITEM-001`, `0.00`, `$`, `USD`, CODE128 parameters, punctuation and technical
  developer-only errors remain code/examples, not translated financial data.
- Exact money computation/rounding, USD catalog unit interpretation, quantity
  parsing, date-only/UTC storage and organization currency remain unchanged.
  Existing host-default dates, currency/numeral formatting, direction/layout,
  printed-page font/RTL and mounted keyboard/browser qualification retain later
  L10N/RTL/output ownership. This task translates the owned barcode heading only.
- LOC-072 owns categories/top navigation; LOC-074 owns variants/suppliers page
  bodies; LOC-075 locations; LOC-076 movement management/stock-takes/transfers;
  LOC-077 assembly/BOM; LOC-078 valuation/alerts/loading and residual inventory.
  Shared workspace tabs are owned here, not in sibling page-body extractions.
- Other creation drawers, operations/report modules, public/email/PDF templates
  and parent integration remain outside this child. DEC-008 preserves Stripe.

## Verification

[Focused tests](../../tests/inventory-item-catalogs.test.ts) render actual
production JSX with real next-intl/PresentationProvider, controls and shared
DrawerFooter, controlling hooks, portals/charts and IO. They exercise real
callbacks/effects, exact money, canonical payloads/CSV bytes, escaped caller data,
busy/empty/search/error states, finite type mappings, cancellation and source-copy
inventory. This is not mounted browser or native terminology approval.

Three existing migrated PostgreSQL REST/MCP/SQL suites additionally run the new
presentation validators against actual transport DTOs while retaining their
authorization, stock/cost/ledger and import/bulk regression checks. See
[attempt](../evidence/LOC-073-attempt-1.md) and
[self-review](../evidence/LOC-073-review-1.md) for actual results and limits.
