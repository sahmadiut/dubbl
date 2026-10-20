# Inventory assembly catalogs - LOC-077

84 paired `InventoryAssembly` messages; 6,964 compatible keys per locale.
Persian wording is provisional pending native terminology review. LOC-066,
LOC-008 and LOC-002 retain independent combined acceptance. Native/RTL/browser
and output qualification remain separate.

## Owned authored display

| Surface | Extracted content |
|---|---|
| `app/(dashboard)/inventory/bom/page.tsx` | Document/page title, example recipe/components, benefits, component-count plural summary, inactive/unknown labels, accessible menu label, open/delete actions, confirmation including cancel, read/delete feedback |
| `app/(dashboard)/inventory/bom/[id]/page.tsx` | Document title, cost breakdown, produces/quantity/wastage/per-unit summaries, component counts, inactive/unknown/absence labels, accessible removal label, read/removal feedback |
| `app/(dashboard)/inventory/assembly/page.tsx` | Document/page title, example workflow and benefits, finite status labels, order/recipe/date prose, start/complete actions, confirmation including cancel, read/start/completion feedback |

`i18n/inventory-assembly-presentation.ts` validates HTTP status, JSON/envelopes,
displayed fields, finite statuses and whole-unit order quantities before state
adoption or mutation success. It reuses `inventoryUiBom`, `inventoryUiBomDetail`
and `inventoryUiAssembly` so existing safe numeric/canonical Minor alias,
physical-decimal alias and exact estimate checks remain active. Component
quantities and wastage retain their saved decimal strings and precision.

PATCH and completion return order headers without nested BOMs. The reader
validates the returned ID/status/header, then merges only verified header fields
into the displayed order while retaining its existing recipe. Deletes require
`success: true`. Failed mutations retain current rows and report finite localized
operation feedback; raw server/parser/network prose never becomes display text.
Verified component removal remains successful if its follow-up read fails;
the detail instead clears stale data and displays read feedback. Missing
organization ends loading/prevents writes; effect cleanup suppresses stale reads.

## Explicit exceptions and preserved contracts

- Caller recipe/item names, descriptions, notes, codes and IDs remain escaped
  caller data. No translation, normalization or persistence change.
- Illustrative `SKU-DESK-001`, static dollar examples, quantities and the `x`
  multiplier retain their existing meaning. Persian `orderName` contains only
  caller-name/quantity placeholders and the multiplication sign; all other
  Persian messages contain Persian script.
- Existing exact money rendering and currency scales, physical-unit arithmetic,
  saved decimal precision, date formatting calls and surrounding punctuation are
  retained. Full numeral/date/calendar/input and RTL qualification are separate.
- Routes, methods, IDs, query parameters, organization headers, JSON payloads
  and canonical statuses remain unchanged. Start PATCH sends
  `{ status: "in_progress" }`; completion POST has no body. Component removal
  still DELETEs the specified `componentId` and refetches the same BOM.
- Actual source inspection found no creation forms in these three routes and
  no BOM/assembly creation drawer in the shared creation surface. Existing API
  and MCP creation/editing operations retain their contracts and ownership.

Existing org-scoped tools cover every unchanged operation: `list_boms`,
`get_bom`, `create_bom`, `update_bom`, `delete_bom`, `list_bom_components`,
`add_bom_component`, `update_bom_component`, `remove_bom_component`,
`list_assembly_orders`, `get_assembly_order`, `create_assembly_order`,
`update_assembly_order`, `delete_assembly_order`, and `build_assembly`.
No production REST/MCP/service/auth/schema/migration, ledger/stock-posting,
currency/FX/IRR or Stripe source changed.

## Verification boundaries

Eleven focused tests render production JSX through real next-intl and
PresentationProvider with controlled hooks/portal/IO boundaries. They cover
examples/saved/detail/error/loading states, USD/JPY/KWD costs, plural summaries,
caller escaping, canonical statuses/requests, confirmation cancellation, failed
write retention, header-only mutation responses, removal-versus-refresh feedback,
missing organization, disposed reads, Persian script and authored-copy audit.
The inventory money source guard follows the shared reader to its unchanged
exact-money validators. The migrated assembly fixture validates real REST and
registered MCP payloads with the new readers and independently checks SQL text
for stock units, carrying values and balanced journal totals. Existing
org/permission/cost-flow/audit/atomic rollback checks remain in that fixture.
See [attempt evidence](../evidence/LOC-077-attempt-1.md) for observed results.
