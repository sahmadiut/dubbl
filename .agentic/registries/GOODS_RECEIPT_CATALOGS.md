# Goods receipt catalogs - LOC-048

LOC-026 was split after inspection found 18 purchasing route TSX files (7,887
lines), plus shared forms/drawers. LOC-048 owns the bounded receipt read/action
slice and shared procurement line details; LOC-026/007/002 retain independent
combined acceptance after the other children. DEC-008 preserves Stripe unchanged.

## Source ownership

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/goods-receipts/page.tsx` | Document title, empty-state guidance and steps, table columns, display statuses, tabs/tooltips, loaded-sample summaries/hint, search/date filters, empty/filter messages, ICU receipt counts and read errors |
| `app/(dashboard)/purchases/goods-receipts/[id]/page.tsx` | Loading/missing/read errors, supplier/date/order sentences, navigation/action labels and tooltips, statuses, item counts, notes and create-bill success/failure |
| `components/dashboard/procurement-money-details.tsx` | Both receipt and order/requisition line headers, unit price/cost, received/location, billed/reserved, subtotal, tax and totals |
| `i18n/goods-receipt-presentation.ts` | Finite typed status display mapping; canonical values and unknown/prototype codes are preserved |

Added 65 `GoodsReceipts` and 12 `ProcurementDetails` messages in each locale:
2,921 compatible keys per catalog. Persian is provisional; key parity and
Persian script do not establish native financial terminology acceptance.

## Behavior and contract preservation

List/detail/pagination retain organization headers, endpoints, canonical status
filters and pagination values, cleanup/generation protection, loaded-sample
search/date/sorting and exact currency grouping. All money helpers, receipt
rounding, quantity hundredths/physical aliases, transport fields, REST/MCP,
database schema, posting and IRR flags remain unchanged. English display status
capitalization remains distinct between tabs and badges. Counts use ICU plurals.

Read failures now use complete translated operation messages instead of raw
exceptions. Successful reads clear stale errors. Invalid list envelopes and
pagination HTTP failures fail visibly rather than appearing as an empty result.
Create-bill uses the existing POST without body, organization header, busy state
and bill redirect. Failed conversion uses translated copy instead of raw server
prose; the underlying service and error responses remain unchanged.

No new operation or REST route was added. Existing registered
`list_purchase_goods_receipts`, `get_goods_receipt` and
`create_bill_from_goods_receipt` tools cover these operations through the same
organization-scoped direct-DB services. Receiving new goods remains the order
workflow (`receive_goods_receipt`) and belongs to LOC-054's catalog extraction.

## Explicit exceptions and remaining ownership

- Caller/saved content stays verbatim: supplier, item, SKU, account code/name,
  warehouse, notes, document numbers and unknown status values. React escapes it.
- Route paths, IDs, request/filter/status/sort values, JSON fields, CSS, icons,
  structural punctuation and missing-value dashes stay in code.
- The instructional example retains `PO-0042`, `GRN-0001`, `$1,200.00` and
  `+$1,200.00` as fixed illustrative data. These are not persisted amounts.
- Dates, exact money, quantity text and non-ICU count displays retain existing
  adapters/formatting. Full numeral/calendar adoption and RTL remain later work.
- The purchase-order link has separately translated lead-in and link text to
  preserve its reviewed link structure; neither message controls the URL.
- Shared date picker, table/loading controls and page header keep their existing
  catalog ownership. Purchasing navigation/loading remains LOC-056.
- Other purchasing routes and creation/edit/receive drawers remain LOC-049..056.
  Shared generic document forms remain LOC-047. Supplier payment preview remains
  LOC-033. LOC-026 must reconcile their combined coverage independently.

## Verification and boundaries

`tests/goods-receipt-catalogs.test.ts` renders production list/detail templates
and both shared line-detail modes through real React/next-intl and
`PresentationProvider`, with actual table/date/money components. State, effects,
navigation and network boundaries are controlled; these are not mounted browser
interactions. The tests execute production callbacks for HTTP/JSON/network,
malformed shape/amount/quantity aliases, stale/aborted reads, pagination,
create-bill success/failure, org guards and exact filtering/sorting. Source AST
checks cover authored JSX/display attributes with the explicit examples above.

Receipt and procurement regression fixtures run independently against migrated,
random disposable PostgreSQL databases with real REST, registered MCP and SQL
assertions. See [attempt evidence](../evidence/LOC-048-attempt-1.md) and
[honest self-review](../evidence/LOC-048-review-1.md) for actual results. Native
Persian, full RTL/layout/font qualification, hosted CI, deployment and production
IRR acceptance remain independent. No full build or dev server was run.
