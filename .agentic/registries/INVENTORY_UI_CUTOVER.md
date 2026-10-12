# MON-154 remaining inventory UI money

## Owned consumers

The [shared adapters](../../lib/money/inventory-ui.ts) validate safe numeric money
against required canonical Minor strings before saved rows enter UI state.
The [behavior and source guards](../../tests/inventory-ui-money.test.ts) exercise
low digits, invalid/missing/unsafe/negative aliases, nullable stock/catalog values,
exact products/summaries, rational signed rounding, BOM cost composition and inputs.
The [integration fixture](../../tests/integration/inventory-ui-money.test.ts) uses
real authenticated REST, registered linked MCP and independent SQL text in six
USD/JPY/KWD workflows with both item-creation origins.

| Consumer | Validation and arithmetic | Retained units |
|---|---|---|
| Inventory list and CSV | Full item aliases, average/standard/book and price values; summary totalValue aliases; SQL avgMarginExact decimal percent; bigint CSV/display and exact one-decimal margin | Catalog USD cents; summary is purchase-price projection, not book value |
| Item details and revaluation | Required saved book value, verified mutation response before state updater; exact catalog text and newTotalValueMinor | USD major text -> cents; no book fallback |
| Item history | unitCost/value aliases and canonical int32 physical quantities | Signed movement cents; history UI still shows physical counts |
| Suppliers and variants | Nullable agreeing price aliases, quantity/lead-time checks, exact input; validate added variant before updater | Catalog cents, USD presentation; days/counts are physical |
| Valuation and CSV | Required item/summary aliases, exact quantity products, margin subtraction, currency homogeneity and summed book/projections; bigint margin sorting/rounding and clamped chart shares | Existing organization-currency presentation of raw units, including JPY/KWD; never convert/rescale |
| BOM list/detail | All cost aliases, nested owned item aliases, exact physical decimal agreement and component-cost estimate, labor/overhead/total identities; outer/inner breakdown agreement | Base-currency minor costs; recipe quantity/wastage are decimals up to six places |
| Assembly list | Whole finished-unit quantities, nested recipe money and finished-item aliases | Recipe costs retain raw minor units; build behavior stays in shared service |
| Stock-take detail | Nullable signed valueAdjustment aliases and whole counts on reads/count responses; preserve live-stock applied discrepancy | Whole physical units and signed base-currency saved stock cost |
| Transfers, shared picker/drawers | Validate fetched items; exact retained transfer quantity text rejects partial/fractional/out-of-range input rather than truncating/filtering a line; inventory create response validation | Transfers and stock-take progress are physical, not monetary percentages |
| Item layout count form | catalogWholeInput signed int32 parsing replaces partial parseInt | MON-153 still owns money/write-down; MON-154 owns physical count input |

## Transport and storage contracts

Existing org-scoped direct-DB inventory services and MCP registration remain the
operation owners. listInventoryItems adds avgMarginExact from the existing SQL
numeric aggregate without a Number round-trip; REST and list_inventory_items both
return it, and the MCP description explains decimal percent text. avgMargin stays
the numeric compatibility alias. No new operation or schema/migration is needed.

Catalog/create/revalue cents and USD display remain deliberate legacy exceptions.
Valuation and assembly retain existing organization-base-currency presentation of
the same raw stored values. No currency inference, historical rescaling, new cost
policy or production IRR enablement occurs. Carrying value and price projections
remain distinct. Existing monetary business limits remain safe Number bounds;
bigint intermediates protect products, subtraction, ratios and CSV low digits.

Nonfinancial movement/warehouse charts, transfer counts and stock-take progress
may use numeric count ratios. Status/ID/date strings and barcode generation are
nonmoney. No financial rendering is added to pages that only display counts.
The picker checks money on complete item responses even though labels show counts.

## Acceptance boundary

MON-153's layout/write-down evidence remains immutable. MON-008 retains independent
combined consumer, public/background and static-guard acceptance after MON-155..160.
No browser screenshots or dev server were required under DEC-005. Source review
checks decimal/numeric keyboard modes, labels, English alerts and saved-value
failure suppression; live-browser, accounting, security, migration, localization,
hosted PostgreSQL16, provider and production qualification remain separate.
