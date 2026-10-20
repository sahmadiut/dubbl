# Inventory movement catalogs - LOC-076

168 paired `InventoryMovements` messages; 6,880 compatible keys per locale.
Persian wording is provisional pending native terminology review. LOC-066,
LOC-008 and LOC-002 retain independent combined acceptance; native/RTL/browser
and output qualification remain separate.

## Owned authored display

| Surface | Extracted content |
|---|---|
| `app/(dashboard)/inventory/stock-takes/page.tsx` | Document/page title, empty help and lifecycle examples, status labels, statistics, completion rate, search/filter labels, item-count plurals, absence and read feedback |
| `app/(dashboard)/inventory/stock-takes/[id]/page.tsx` | Document title, statuses, dates' surrounding prose, counting controls, summaries, blind-count/action labels, sort/filter/search, confirmations, bulk/posting/count/mutation feedback and absence/loading text |
| `app/(dashboard)/inventory/transfers/page.tsx` | Document title, empty examples, warehouse/item examples, statistics, status/sort/filter/search, list/detail labels, item/unit plurals, dates' surrounding prose, confirmations and read/write feedback |
| `StockTakeDrawer` and `TransferDrawer` only in `components/dashboard/create-drawer.tsx` | Titles/help, sections/fields/placeholders, input feedback, actions, accessible quantity/removal labels and localized shared-footer cancel/creating overrides |

`i18n/inventory-movement-presentation.ts` validates HTTP/JSON/envelopes,
display fields, finite statuses and whole-unit transfer quantities before
adoption/success. Stock-take lines and item lookup reuse the established exact
money validators, including matching canonical `valueAdjustmentMinor` aliases.
Creation validates the stock-take header because that response omits lines.
Historical nullable `adjusted` flags retain their previous truthiness. Posted
discrepancies remain saved live-stock differences, not reconstructed values.

Errors use finite localized operation feedback; raw server/parser/network prose
never becomes display text or a catalog key. Missing organizations end loading
and prevent mutations. List/detail request cleanup and transfer generations
suppress stale reads. Failed writes retain forms/details; busy states clear.
Transfer cancellation checks the response before success. Failed optimistic
counts restore only the affected line and report failure to the bulk action, so
bulk success requires every count to succeed. Posting validates its complete
response and retains that result if the follow-up read fails.

## Intentional exceptions and retained contracts

- Caller stock-take/item/warehouse names, codes, notes and IDs remain escaped
  caller data. No translation, normalization or persistence change.
- Illustrative `WH-001` and `WH-002` remain identifiers. Example quantities,
  numerical statistics, signs, slash separators, `***` blind-count mask and `-`
  missing-count marker retain existing meaning. `statusCount` contains only
  interpolation and punctuation; its status argument is already translated.
- Existing date formatting calls, ASCII whole-unit input, input constraints,
  counted quantities, discrepancy calculations, filter/sort keys and ordering,
  percentages and physical-unit arithmetic remain unchanged. Full date/numeral/
  calendar/input and RTL qualification belong to later acceptance.
- Canonical statuses, drawer types `stockTake`/`transfer`, form names, API paths,
  IDs, organization headers, methods, request bodies and custom events
  `refetch-stock-takes`/`refetch-transfers` remain unchanged. Stock-take creation
  still sends nullable warehouse/blank notes; transfer creation sends validated
  whole-unit lines and nullable notes. Posting remains POST to `/apply` and
  completion remains POST to `/complete`; no posting/cost-flow logic changes.
- Other creation drawers, inventory navigation/master data, warehouse controls,
  assembly/BOM and valuation/alerts retain their existing ownership.

Existing org-scoped REST/MCP tools already implement every operation through
shared services: `list_stock_takes`, `get_stock_take`, `create_stock_take`,
`update_stock_take`, `delete_stock_take`, `count_stock_take_line`, `apply_stock_take`,
`list_inventory_transfers`, `get_inventory_transfer`, `create_inventory_transfer`,
`update_inventory_transfer`, `complete_inventory_transfer`, and existing inventory
item/warehouse lookup tools. No API, MCP, schema/migration, authorization, ledger,
stock posting, currency, FX/IRR or Stripe source changed.

## Verification boundaries

Fourteen focused tests render production JSX through real next-intl and
PresentationProvider with controlled hooks and portal/IO boundaries. They cover
canonical requests, confirmations/cancellation, failure retention, busy states,
bulk/post feedback, optimistic restoration, input ranges, nullable history,
read cleanup/generations, escaping, Persian script and source-copy coverage.
The existing inventory money source guard now follows the shared reader to its
exact-money validators. The migrated inventory movement fixture validates real
REST and registered MCP results with these readers and independently checks SQL
count/discrepancy/value adjustment and transfer quantities. Existing isolation,
permission, cost-flow and atomic rollback assertions remain in that fixture.
See [attempt evidence](../evidence/LOC-076-attempt-1.md) for actual results.
