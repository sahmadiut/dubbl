# MON-153 inventory detail and write-down UI money

## Consumer ownership and units

- [Item layout](../../app/(dashboard)/inventory/[id]/layout.tsx): validated complete
  saved item aliases on read, count adjustment and active-toggle responses;
  header sale/purchase prices, catalog price value, per-unit profit and margin;
  carrying-value/write-down sheet, exact input, preview and canonical payload.
- [Adapter](../../lib/money/inventory-detail-ui.ts): nonnegative purchase/sale/book
  amounts, mandatory safe numeric and canonical agreeing Minor fields; int32 whole
  count and priceValue agreement; bigint product/subtraction; margin rounded to
  one decimal with explicit half-away-from-zero rational arithmetic.
- [Pure/static guard](../../tests/inventory-detail-ui-money.test.ts): edge/low
  digits, ties/signs, missing/conflicting/unsafe aliases, input range/grammar,
  excessive/sub-cent write-down and scoped prohibition of monetary floats.
- [Transport fixture](../../tests/integration/inventory-detail-ui-money.test.ts)
  and worker: both real authenticated REST and registered linked MCP, SQL-text
  expected stored low digits, balanced base-currency legs and unchanged financial
  snapshots on invalid/excessive writes in six USD/JPY/KWD workflows.

This joins MONEY_MANIFEST/MONEY_BOUNDARIES with the existing inventory master
MON-075 and movement MON-076 contracts. All existing operations use the shared
org-scoped service; no new tool, transport/schema or migration is necessary.

## Explicit compatibility policy

Catalog/item monetary input/output remains the existing integer cents contract,
with USD/two-decimal catalog presentation, including non-USD organizations. Ledger
posting retains existing raw values tagged in organization base currency. This
slice neither reinterprets raw stock units using organization currency nor
modernizes that historical policy. USD display and input are explicit in the sheet.

Purchase-price stock value (quantity x purchasePrice, priceValue) and actual book
value (totalValue) remain distinct after write-down. No missing book value falls
back to a price product. Inputs retain decimal text with at most two places and
safe Number business bounds, and write only valueDeltaMinor. Invalid sub-cent
values reject instead of the former float rounding. Positive amounts must not
exceed saved book value. Preview and submit use the same helper; the server remains
responsible for current-state/permission/period/cost-method validation. Backend
value-only adjustments still require average costing; FIFO/standard rejection is
unchanged. Whole physical counts, reorder progress, dates/IDs/statuses are nonmoney.
The physical count editor remains MON-154, including its inherited parseInt policy.

## State and presentation

Organization/item-keyed workspace resets forms and money state, superseded reads
abort, and invalid saved aliases expose an English alert and suppress money and
actions. Successful layout mutations validate aliases before adoption and abort
older reads. Write-down confirmation rechecks active organization, disables while
saving, validates a reason and clears text on close/success. Failed writes preserve
input. Large monetary text wraps, labels are associated with inputs, decimal keyboard
mode is used, errors are announced and the exact new book value is visible.
No screenshot requirement applies (DEC-005); live browser effects are not claimed.

## Remaining acceptance

MON-154 owns every other inventory tab/list/valuation/assembly/BOM/shared drawer
consumer. MON-155..160 own the remaining auxiliary/background/public families.
MON-008 retains all original criteria and independent combined acceptance.
Full-int64 business expansion, production IRR, currency/history remediation,
accounting/security/migration/localization and release qualification remain
separate. The fixture uses synthetic disposable PostgreSQL only, no provider calls.
