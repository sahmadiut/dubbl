# Payable and procurement integration (MON-020)

2026-10-09, Asia/Tehran. Independent parent acceptance for MON-046 through
MON-054 under ADR-006 safe-number coexistence. Child inventories below retain
the complete operation/input/output/default/unit/range/permission/error contracts;
historical child evidence is unchanged.

| Slice | Boundary inventory | Combined fixture |
|---|---|---|
| Bill list/detail/counts | [Reads](BILL_READ_WIRE_CONTRACTS.md) | Converted/imported bills, nested prices, exact status sums, foreign/unsafe history |
| Bill CRUD | [Writes](BILL_WRITE_WIRE_CONTRACTS.md) | USD/JPY/KWD prices, imported draft editing, foreign suppliers, unsafe stored totals |
| Bill receive/approval/void | [Lifecycle](BILL_LIFECYCLE_WIRE_CONTRACTS.md) | Nonstock and GRNI recognition, credit barrier, reversals, reservation release and retry |
| Purchase orders | [Orders](PURCHASE_ORDER_WIRE_CONTRACTS.md) | Requisition conversion, sends, linked edit barrier, GRN slices, conversion exclusion/race |
| Purchase requisitions | [Requisitions](PURCHASE_REQUISITION_WIRE_CONTRACTS.md) | REST legacy/dual prices, MCP submission/approval, REST conversion, preserved amounts |
| Supplier debit notes | [Debit notes](DEBIT_NOTE_WIRE_CONTRACTS.md) | REST major/MCP minor price parity, service-receipt allowance, application/reversal |
| Goods receipts | [Receipts](GOODS_RECEIPT_WIRE_CONTRACTS.md) | REST legacy/dual quantity, MCP exact quantity, nonstock/stock, both bill conversion orders |
| Bill CSV import | [Bulk](BILL_BULK_WIRE_CONTRACTS.md) | MCP preview, REST import, above-int32 read/edit/count consumers, conflicting aliases |
| Procurement controls | [Settings](PROCUREMENT_SETTING_WIRE_CONTRACTS.md) | REST/MCP partial saves, retained 500 basis points, scoped defaults and consumed controls |

## Units and compatibility

Money output retains safe integer currency-minor Numbers with matching canonical
`*Minor` strings. Monetary operands, intermediate values and returned sums must
fit +/-9007199254740991; nonnegative receipt costs and positive credit applications
keep narrower requirements. Canonical int64 syntax does not activate full-int64
processing. Unsafe saved money fails with classified 422 LEGACY_NUMERIC_RANGE;
no fallback converts an already rounded Number to text.

| Price writer | REST numeric price | MCP numeric price | Exact aliases |
|---|---|---|---|
| Bills, POs, requisitions | Decimal currency major units | Decimal currency major units | unitPriceExact major decimal; unitPriceMinor integer minor |
| Supplier debit notes | Decimal currency major units | Integer currency minor units | Same named aliases; supplied representations must agree |
| Bill import | lineUnitPrice/lineAmount decimal major or supported CSV text | Same flat CSV contract | Named lineUnitPrice/lineAmount Exact and Minor siblings |
| Goods receipt | No client-supplied cost | No client-supplied cost | unitCostMinor copies saved PO currency minor price |

USD 12.50, JPY 1250 and KWD 1.250 each become 1250 minor units; persisted 1250
never rescale. Quantities use physical input units and int32 hundredths on stored
document lines. Goods-receipt quantityExact is physical decimal text;
quantityReceivedExact is two-decimal physical output. Stock requires whole input
units. Settings and tax/discount percentages use integer basis points (500=5%).
Dates are canonical Gregorian date-only values and timestamps UTC instants.
FX direction, scale conversion, rounding, PATCH tax policy, reverse charge,
historical reads and currency enablement remain per-slice contracts.

## Cross-workflow protections

The bill conversion entry points exclude each other's unqualified active
receipt-linked bills for selected PO lines. PO conversion can reuse only its own
qualified cumulative allocation events. A GRN-created draft has no PO reservation,
so overlapping PO conversion returns 422 before numbering, bill, link, tally or
audit mutation. Void the prior bill before switching paths. The conservative
guard covers concurrent REST PO/MCP GRN conversion through their common
organization lock, with one winner even when match controls are off. Unrelated
selected PO lines are unaffected. No cumulative money history is invented for
receipt conversion and no posted allocation is rewritten.

A receipt link alone no longer classifies a service bill as stock when sending
a linked supplier debit note. Receipt organization, supplier and stock/warehouse
dimensions are validated. Service receipt lines can point to the bill recognition
journal and still use ordinary allowance posting. Stock/GRNI bills retain existing
full-return/unsupported-variance restrictions. An active linked debit note blocks
bill void until the note is voided; reversal restores bill balances.

Six registered tools retain full strict schemas: receive_goods_receipt,
convert_po_to_bill, list_debit_notes, create_debit_note, update_debit_note and
apply_debit_note. They advertise additionalProperties=false and reject unknown
controls before callbacks. Other legacy whitelisting behavior remains documented
by child inventories. AuthContext fixes scope; conflicting REST organization
headers cannot redirect API keys. Read-only custom roles cannot mutate. SDK
validation failures may be text; service errors retain wrapTool codes.

## Verification and limits

The parent fixture calls actual authenticated REST handlers and registered MCP
SDK clients on committed migrations in disposable PostgreSQL. SQL-text snapshots
prove rejected requests preserve documents, quantities, stock/layers, allocations,
numbering, journals, jobs and audit counts. After service recognition, credit,
reversal/retry and stock recognition/void cycles, all journals balance and final
account totals are expense +2500, AP -2500, inventory +2500 and GRNI -2500 minor
units. Stock stays two units/value 2500 after bill recognition and void. Receipts
are not received twice. All nine child suites retain detailed operation, lock,
FX, rollback, approval, safe-edge and concurrency coverage and are rerun here.

Payment settlement remains MON-021; other inventory writers remain MON-024;
exports/PDFs remain MON-033/034. Foreign GRNI changed-FX, partial/multiple accruals,
return variance and unknown cumulative allocations remain explicitly unsupported
with pre-mutation rejection. Full-int64, external configuration races, durable
email, browser/session/OAuth, volume, production migration and independent
accounting/security/localization/IRR/release qualification are separate gates.
No schema or production flag changes are introduced.
