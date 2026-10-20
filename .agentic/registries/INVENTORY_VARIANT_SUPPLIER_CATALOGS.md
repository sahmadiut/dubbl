# Inventory variant and supplier catalogs (LOC-074)

Bounded child of LOC-066: 54 paired `InventoryCatalogs` messages; complete
catalogs contain 6,635 keys per locale. Persian wording is provisional pending
native terminology review. LOC-066/008/002 retain independent acceptance.

## Owned surfaces

| Surface | Authored copy and behavior |
|---|---|
| `app/(dashboard)/inventory/[id]/variants/page.tsx` | Document title, heading, empty state, add sheet/action, field labels/examples, active/inactive status, price/SKU/quantity captions and read/create/input feedback |
| `app/(dashboard)/inventory/[id]/suppliers/page.tsx` | Document title, heading, empty state, linking sheet/action, supplier picker override, field labels/examples, price/code/lead-time captions, preference, accessible unlink label, confirmation/cancellation and read/link/unlink/input feedback |
| `i18n/inventory-catalog-presentation.ts` | Typed presentation rows, HTTP/JSON/list validation and finite local input-error mapping |

## Preserved contracts and safe failures

Presentation helpers reuse `inventoryUiCatalog` for exact monetary aliases and
physical-unit validation. Lists validate every row before state adoption. Saved
null prices retain null aliases; historical null variant counts remain hidden,
without coercion to zero or rejection of otherwise valid history. Nullable
active/preferred flags retain the original display behavior. User names, SKUs,
supplier codes, option keys/values and contact identifiers remain escaped data.

Both routes keep their methods, URLs, organization headers, identifiers and
payload keys. Existing two-decimal USD catalog input still produces canonical
`purchasePriceMinor`/`salePriceMinor` strings in integer cents within the safe
legacy range. Blank optional inputs stay omitted; explicit zero stays zero.
Variant quantity remains signed int32 whole physical units; lead time remains
nonnegative int32 days. Existing numeric-input minimum hints are unchanged.
No ledger/stock/quantity scaling, FX, currency-regime or IRR enablement changes.

Missing organization, HTTP, JSON, envelope/row, network and input failures use
localized safe feedback. Local parser errors have a finite message mapping;
arbitrary server/parser prose never becomes a displayed message or catalog key.
Failed writes retain forms and rows; busy state clears in finally. A successful
link with failed refresh reports the saved link distinctly. Unlink requires
confirmation and verified success before removing its row. Initial reads ignore
cancelled results and finish loading even without an active organization.

Existing registered inventory-catalog MCP tools cover variant and supplier
list/create/update/delete through org-scoped direct Drizzle services and
`wrapTool`. This presentation-only extraction introduces no REST/MCP/service,
authorization, audit, database/schema/migration or financial changes and no new
operation needing a tool. The real catalog worker now applies presentation
validation to successful REST/MCP DTOs, including nullable history, while
retaining authorization/isolation/rollback assertions and adding SQL-text checks.

## Explicit exceptions and adjacent ownership

- Names, SKUs, supplier codes/contact names/IDs and variant option keys/values
  are caller data. Unknown text is escaped, never translated as authored copy.
- URLs, organization headers, IDs, JSON keys, `supplier` picker type, DOM IDs,
  styles, methods and option-object structure remain machine contracts.
- `$`, `USD`, numeric `0`, technical developer-only exceptions and punctuation
  stay code/data. Existing currency formatting, Latin physical count values and
  canonical input parsing retain later L10N ownership; captions are translated.
- Item workspace/navigation and other item fields belong to LOC-073; contact
  picker internals already belong to contact catalogs. Shared loader/sheet
  controls retain their existing namespaces. LOC-075..078 own other inventory
  routes; parent combined acceptance is independent.
- Native terminology, full RTL/dates/numerals/input behavior, mounted browser
  keyboard interactions, output/printing and production qualification remain
  separate. Stripe remains unchanged under DEC-008.

## Verification

[Focused tests](../../tests/inventory-variant-supplier-catalogs.test.ts) render
actual production JSX through real next-intl/PresentationProvider and controls,
with controlled hook/portal/IO boundaries. They exercise localized copy,
escaping, exact high/low monetary digits, nullable history, active/preferred
states, picker selection, empty/loading/error/busy behavior, real mutation/read
callbacks, cancellation, safe failures, canonical payloads and optional inputs.
An AST copy inventory and Persian-script assertion guard owned coverage.
This is controlled SSR/callback coverage, not mounted-browser/native approval.

The existing inventory money source guard follows the new shared presentation
boundary. Two migrated PostgreSQL suites exercise actual REST, registered MCP
and SQL without the application DB or external providers. See
[attempt](../evidence/LOC-074-attempt-1.md) and
[self-review](../evidence/LOC-074-review-1.md) for final checks and limitations.
