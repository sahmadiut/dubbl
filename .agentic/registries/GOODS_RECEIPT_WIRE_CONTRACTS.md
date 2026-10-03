# Goods receipt contracts (MON-052)

2026-10-04, Asia/Tehran. Shared implementation in lib/api/goods-receipts.ts and
goods-receipt-wire.ts. Exact aliases coexist with legacy numeric output. This is
a bounded contract adoption, with parent MON-020 integration and MON-024 other
inventory writers still pending; no production/IRR/full-int64 qualification.

## Operations and transport envelopes

| REST operation | Registered MCP operation | Inputs | Outputs |
|---|---|---|---|
| GET /api/v1/goods-receipts | list_purchase_goods_receipts | Optional purchaseOrderId UUID, status, page, limit | REST data/pagination; MCP goodsReceipts/total/page/limit; receipts include contact and lines |
| GET /api/v1/goods-receipts/:id | get_goods_receipt | Receipt UUID; MCP goodsReceiptId | goodsReceipt with contact, PO and lines including stock/warehouse/PO-line relations |
| POST /api/v1/goods-receipts | receive_goods_receipt | purchaseOrderId, date, notes?, lines | 201 REST; goodsReceipt, journalEntryId (nullable), purchaseOrderStatus |
| POST /api/v1/goods-receipts/:id/create-bill | create_bill_from_goods_receipt | Receipt UUID; MCP goodsReceiptId; REST body unused | 201 REST; bill with numeric and exact balance aliases |

There were no receipt PATCH/DELETE/void endpoints. Receipt records are created in
received state, not editable drafts; this adoption does not invent destructive
receipt operations. Bill editing/recognition/void remains the separate bill
contract. List defaults page 1, limit 50; limit 1..100, page 1..21474836; statuses
draft/received/billed/void. REST numeric query strings are parsed as Numbers then
validated. MCP input fields and nested fields have descriptions. New get and
create-bill tools complete parity without duplicate registrations.

## Units, aliases and supported ranges

- Receipt lines select a PO line UUID and positive physical quantity. quantity is
  a Number; optional quantityExact is an ASCII nonnegative decimal string with at
  most eight whole and eighteen fractional digits. At least one is required; both
  must agree as decimal ratios before rounding. Exponent/whitespace/localized
  digits/leading-zero/negative exact spellings reject. Number scientific spelling
  is interpreted exactly through its shortest decimal representation.
- Stored quantityReceived remains int32 hundredths, 1..2147483647. Nonstock rounds
  the decimal ratio to hundredths, ties toward positive infinity: 1.005 -> 101.
  quantityReceivedExact is physical units with two decimals: 101 -> "1.01".
  Stock requires whole physical units before rounding, not rounded fractional
  receipts. Duplicate selections, missing lines and over-receipt reject.
- Clients cannot supply a receipt cost. unitCost is copied from the saved PO's
  unitPrice, in that PO currency's minor units; unitCostMinor is its canonical
  integer string. USD 1250 stays 1250 cents; JPY 1250 stays 1250 yen; KWD 1250 stays
  1250 fils. Header currencyCode identifies the source PO currency, nullable for
  unlinked historical receipts. PO headers/lines, contacts and nested inventory
  money add their existing explicitly named Minor aliases.
- Costs, extended costs, cumulative stock values, averages, ledger sides and bill
  totals must be nonnegative safe integers <= 9007199254740991. Output always
  retains numeric compatibility; aliases do not enable full int64 workflows.
  Invalid/unsafe ORM history and products/sums return classified 422. No magnitude
  rescaling or repaired rounded Number is allowed. Quantity/warehouse totals and
  document/entry numbering remain bounded by int32.
- Bill conversion preserves saved received quantities and unit costs. Amount is
  round(quantityReceived * unitCost / 100), using bigint ratios. Tax is zero;
  PO saved discount/tax totals are not copied into this legacy GRN-cost operation.
  Source account is copied for nonstock recognition. The PO conversion operation
  separately allocates its saved net/tax totals. Future mixing with unknown
  partially billed PO allocation history can reject under MON-049's existing
  qualification guard; no allocation history is invented here.
- Bill balance outputs carry subtotalMinor, taxTotalMinor, totalMinor,
  amountPaidMinor and amountDueMinor, alongside unchanged numeric amounts. Bill
  issue/due dates default to today's UTC Gregorian day. Canonical receipt date
  must be a real YYYY-MM-DD day. No locale/calendar inference is performed.

## Posting, stock and saved FX

Receipt stock uses exact historical receipt-date document-major -> base-major FX
with explicit currency-scale conversion. Rate must coexist exactly with positive
int32 millionths. Missing/tiny/nonrepresentable rates reject. Ledger legs persist
rateExact, quote_per_base, format/version/provenance and original currency;
sourceId identifies the receipt. Transactional create audit saves currencyCode,
baseCurrencyCode, rateExact, direction, journalEntryId and grniTotalMinor. Existing
audit/ledger schema stores this snapshot; no schema migration is needed.

One posted entry debits Inventory and credits GRNI for valued stock. Each stock
movement links the entry, receipt and warehouse; moving-average costs use exact
totalValue/quantity. FIFO creates integer unit-cost layers and rejects base values
that do not divide into unit costs. Standard retains the existing moving-average
receipt behavior. Serial/lot allocation remains MON-024 and rejects. Negative FX
residual legs reject rather than recording negative stock receipts. Zero base
value receives physical stock with a null journal link; nonstock has no GRNI or
stock movement. Subsequent nonzero GRNI recognition still requires a qualified
accrual; zero-value accrual repair/variance policy is not inferred.

Base-currency GRNI retains existing qualified identity-FX behavior. New foreign
stock receipts qualify for full single-receipt bill recognition with every receipt
line once, unchanged costs, no stock-line tax and the same receipt/bill FX. The
saved base/currency, audit journal ID/GRNI amount, accrual sourceId, exact leg rates,
balanced values and unused quantities must agree. Same-rate USD/JPY/KWD/EUR cases
are verified. Changed FX, partial or multiple foreign accruals, tax/price variance,
unknown legacy FX and base-currency changes fail with 422 before committed effects.
MON-020 retains broader differing-FX/partial residual qualification; no historical
posting is rewritten. Nonstock receipt lines use ordinary expense/AP recognition
and saved billed quantities, not a nonexistent stock accrual. Void restores
receipt/PO state using the separate bill lifecycle and never receives stock again.

## Isolation, locks, atomicity and errors

All queries use AuthContext organization. API-key organization wins over a
conflicting header. Reads require authentication; writes require manage:bills.
UUIDs, supplier, PO/PO lines, item, warehouse, journal and account references are
checked before output/commit; unavailable write references reject while owned
historical read references may remain visible. Invalid key is 401; role denial
403; missing/foreign receipt or PO is 404; schema/state/duplicate/over-receipt is
400; locked dates and unsupported money/FX/history are 422. MCP wraps service
errors with wrapTool; malformed SDK arguments can fail before the handler.

Organization/PO/line/item/receipt locks serialize supported writers. Receipt
number/header/lines/PO tallies/status, journal, stock/layers/warehouse, exact
response preflight and audit share one transaction. Conversion likewise commits
bill number/header/lines/PO link/audit together. Receipt-to-bill creation creates a
draft without posting, stamping billed or incrementing recognized PO quantities.
An active bill referencing any receipt line (including drafts/partial bills)
blocks repeat conversion; void releases that guard. Concurrent REST/MCP conversion
has one winner. PO conversions also count active receipt-linked draft quantities.
Injected stock/audit failures and rejected inputs leave business rows unchanged.

## Verification and remaining scope

tests/goods-receipt-wire.test.ts exercises ratios/aliases/ranges. The migrated
PostgreSQL goods-receipts worker calls real REST routes and the full MCP SDK
registry with API-key/custom-role auth, legacy/exact/dual inputs, nested aliases,
stock/FIFO/warehouse/zero/large values, scales, foreign FX/GRNI, nonstock posting/
void, locks, malformed/foreign history, concurrent receipt/conversion and injected
rollback. Adjacent bill lifecycle, PO and debit-note workers verify shared writers.
Evidence MON-052-attempt-1 and honest self-review MON-052-review-1 record results.
No build/dev/provider/session/OAuth/production migration/independent financial/
security/native-language/release/IRR approval is claimed.
