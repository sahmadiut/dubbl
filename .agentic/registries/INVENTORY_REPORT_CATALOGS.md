# Inventory valuation and alert catalogs - LOC-078

46 paired `InventoryReports` messages; 7,010 compatible keys per locale.
Persian wording is provisional pending native financial terminology review.
LOC-066, LOC-008 and LOC-002 retain independent combined acceptance.

## Owned authored display

| Surface | Extracted content |
|---|---|
| `app/(dashboard)/inventory/valuation/page.tsx` | Document/page title, description, search placeholder/accessibility label, all report columns, statistics, cost/profit summaries, export action/feedback, sample item names, preview headers/help/add action, no-match state, finite read feedback |
| `app/(dashboard)/inventory/alerts/page.tsx` | Document title, empty state, statistics, critical badge, code/SKU/count/reorder summary, suggestion caption, purchase order action/accessibility label, finite read feedback |
| `app/(dashboard)/inventory/loading.tsx` | Already delegates to shared BrandLoader; verified its existing `SharedUI.loading2` in both locales, with no source change |

Inventory navigation and item-owned layouts/drawers/pickers already use their
earlier catalogs. No additional authored display remains in these shared
surfaces for this slice. New messages use real next-intl; interpolated item,
category, SKU and supplier data stays escaped caller content.

`i18n/inventory-report-presentation.ts` verifies HTTP/JSON/envelopes and displayed
fields before state adoption. Valuation keeps `inventoryUiValuation` checks for
canonical safe numeric/Minor aliases, whole-unit counts, currency consistency,
exact products and independent book/projection totals. Malformed reports cannot
reach sorting, display or export. Alerts validates signed int32 saved quantities,
nonnegative int32 reorder points, the saved suggestion formula and safe derived
suggestions (which can exceed int32). It maps the API's actual `suppliers` list
to the first preferred supplier's display identity. No price is displayed or
recomputed; no server payload changes. Without a preferred supplier, the name
remains absent. Zero-stock classification retains its existing equality rule;
negative saved stock is preserved. Missing organization prevents IO and ends
loading with finite feedback. Cleanup suppresses disposed results, and arbitrary
server/parser/network prose never becomes UI copy.

## Explicit exceptions and preserved contracts

- CSV headers remain canonical English, in the original order: Code, Name,
  Category, Qty On Hand, Unit Cost, Purchase Price Value, Book Value, Currency,
  Sale Price, Total Value, Margin %. Quoting, LF separators, ASCII exact decimal
  money, exact margin calculation, MIME type, UTC date filename and sorted/
  filtered row selection remain unchanged. Only export action and success
  feedback are localized. No localized digits/headers enter this machine export.
- Existing USD/JPY/KWD scales, exact bigint arithmetic, ratio sorting,
  percent/share formatting, counts and currency codes remain intact. Full
  numeral/date/calendar/input and RTL qualification are separate.
- Illustrative WDG-001/GDG-042/CBL-100 identifiers, fixed sample quantities,
  dollar values, percentages, USB-C protocol spelling, punctuation and absence
  dashes retain their existing meaning. Authored sample names are localized.
- Caller names/codes/categories/SKUs/supplier names remain untranslated and
  escaped. No normalization or persistence change.
- Routes, methods, organization headers, sort keys/directions and drawer
  identifiers are unchanged. Item navigation still opens `/inventory/{id}`;
  create-item opens `inventory`, and create-PO opens `purchaseOrder` without
  automatically attaching a supplier or suggested quantity.

Unchanged registered org-scoped MCP operations include `get_inventory_valuation`,
`list_inventory_reorder_suggestions`, `get_inventory_item`,
`create_inventory_item`, and `create_purchase_order`; the corresponding existing
REST operations remain in place. No production REST/MCP/service/auth/schema/
migration, valuation/stock-posting/ledger, currency/FX/IRR or Stripe source
changed. Generated money inventory changes track only owned source drift and
new reader/test paths; schema-column classifications remain unchanged.

## Verification boundaries

Nine focused report tests use production JSX and actual next-intl through
PresentationProvider with controlled hooks/IO. They cover both locales,
examples/saved/empty/no-match/loading/error states, escaped caller content,
USD/JPY/KWD money, precise ratio ordering, CSV equality, malformed responses,
missing organizations, disposed reads, preferred supplier mapping, zero/negative
stock and above-int32 suggestions. Eight existing inventory-money tests retain
their guards. The existing migrated consumer fixture now validates these
readers against real REST and linked MCP responses across six USD/JPY/KWD
transport workflows, independently checking SQL-text book/purchase values and
stock/reorder/suggested counts. Existing inventory master and valuation fixtures
also retain tenant/authorization, FIFO/history, ledger and rollback coverage.
See [attempt evidence](../evidence/LOC-078-attempt-1.md) for observed results.

Native financial terminology, mounted-browser/keyboard, full RTL and output
qualification, hosted CI, deployment and production acceptance remain
independent. No full build or unrequested dev server ran.
