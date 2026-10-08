# Purchase order contracts (MON-049)

## MON-020 integration update, 2026-10-09

[Combined contract](PAYABLE_PROCUREMENT_INTEGRATION.md) supersedes the historical
parent-pending note below. PO conversion rejects active receipt-linked bills for
selected lines unless they have this PO's qualified exact conversion events.
GRN-created drafts cannot be bypassed by an unmatched PO bill; void before
switching conversion paths. Organization locking gives concurrent REST PO/MCP
GRN conversion one winner. convert_po_to_bill uses a full strict registered
schema; unknown controls reject before callbacks. Existing cumulative allocation,
quantity, tax, period and safe-number rules remain.

Source inspected on 2026-10-03 (Asia/Tehran), entry HEAD `7583781`. This is the
MON-020 child for PO CRUD, reads/counts, send and bill conversion. PDF is MON-034;
requisitions/receipts/bulk/settings remain MON-050/052/053/054. No schema or
currency-rollout change. Evidence: MON-049-attempt-1 and honest self-review.

## Operations and envelopes

| REST boundary | MCP operation | Successful response |
|---|---|---|
| GET /api/v1/purchase-orders | list_purchase_orders | REST `{data,pagination}`; MCP `{purchaseOrders,total,page,limit}` |
| POST /api/v1/purchase-orders | create_purchase_order | 201 REST / MCP `{purchaseOrder}` |
| GET /api/v1/purchase-orders/:id | get_purchase_order | `{purchaseOrder}` with supplier, lines and account/tax relations |
| PATCH /api/v1/purchase-orders/:id | update_purchase_order | `{purchaseOrder}` |
| DELETE /api/v1/purchase-orders/:id | delete_purchase_order | `{success:true}`; soft header deletion and physical line removal |
| GET /api/v1/purchase-orders/counts | get_purchase_order_counts | `{counts,total}` |
| POST /api/v1/purchase-orders/:id/send | send_purchase_order | `{purchaseOrder}` |
| POST /api/v1/purchase-orders/:id/convert | convert_po_to_bill | 201 REST `{purchaseOrder,bill}`; MCP `{bill,purchaseOrderStatus}` |

Reads require authenticated organization context; create/edit/delete/convert
require `manage:bills`, send requires `approve:bills`. MCP has one tool per
operation, registered through tools/index.ts with server-created AuthContext,
wrapTool and shared direct-DB services. REST API keys resolve their own tenant;
a conflicting x-organization-id cannot redirect it. Foreign/deleted PO IDs
return 404. No HTTP self-call or new public negotiation flag.

REST list retains suppliers without lines; MCP list retains suppliers and lines.
Detail includes account/tax details. Money aliases are additive on headers and
returned lines; supplier creditLimit adds creditLimitMinor. Historical inactive/
deleted dimensions remain readable in the same tenant. Foreign references reject
before disclosure. Pagination defaults page 1/limit 50, size 1..100 and maximum
page 21,474,836; REST retains existing parsePagination coercion/clamping before
the bounded service schema. Status and supplier UUID filters are validated.

## Input and output units

| Field | Input | Output/storage |
|---|---|---|
| unitPrice | Optional legacy decimal major-unit Number, e.g. USD 12.50 | Rounded integer currency minor units, e.g. USD 1250 |
| unitPriceExact | Optional ASCII decimal major-unit string, <=20 whole/18 fractional digits | Same rounded minor price, with exact ratio extended-price calculation |
| unitPriceMinor | Optional canonical signed int64 integer string, within safe workflow range | Same integer minor price |
| quantity | Physical units as a bounded decimal Number, default 1 | Signed int32 hundredths, e.g. 1.5 -> 150 |
| quantityReceived/quantityBilled | Not editable header/line inputs | Integer hundredths; no money aliases |
| discountPercent (create) | 0..10000 basis points, default zero; 1000=10% | Net line amount; PO schema has no discount column |
| taxRateId | Optional scoped UUID; basis-point rate from tax_rate | Same reference; calculated taxAmount on create |
| subtotal/taxTotal/total; line amount/taxAmount | Server-calculated | Safe integer currency minor units plus *Minor strings |
| count/page/limit | Ordinary integers | Ordinary integers, no money aliases |
| issueDate/deliveryDate | Canonical Gregorian YYYY-MM-DD; optional null delivery | PostgreSQL date-only values |
| sentAt/timestamps | Server-generated | UTC ISO instants in JSON |

Prices default zero without inventory price lookup. Major aliases must agree
exactly when numeric and string are both provided; minor aliases must agree with
the rounded major price. Numeric values use their shortest decimal spelling,
including scientific notation, interpreted as integer ratios. Exact strings
reject exponents, localized digits, whitespace, leading zeros and malformed
decimals; minor strings also reject fractions, negative zero and out-of-int64.
Currency defaults USD in both transports. Explicit JPY/KWD use their own scales;
IRR arithmetic is tested in pure functions without enabling IRR input/production.
USD 1250 remains 1250; no stored history rescaling or implicit FX.

Create retains extended major-price rounding, then basis-point discount and
exclusive tax, with signed ties toward +infinity through bigint ratios.
Stored unit prices are rounded separately. All rounded prices, gross/net/tax,
headers, allocations, aggregate and intermediate money sums are limited to
[-9007199254740991,9007199254740991]. Full int64 business support remains MON-007/008.
Physical quantity range is [-21474836.48,21474836.47], rounded to int32 hundredths.
Conversion requires strictly positive ordered/selected hundredths; zero/negative
ordered quantities are representable drafts but cannot convert in this slice.
Create/update arrays contain 1..1000 lines. Dates and all exposed references use
described schemas. Unknown CRUD header fields are stripped, preserving legacy
whitelisting; conversion rejects unknown keys.

### Existing PATCH distinction

Complete replacement lines retain the original REST PATCH contract: calculate
extended prices with no discount or tax, set taxTotal/taxAmount to zero and retain
taxRateId as a reference. Header-only edits retain existing totals. The new MCP
update operation explicitly documents the same contract. Currency/PO number are
fixed on edit. Tax/discount PATCH policy changes remain an explicit follow-up,
not silently introduced into v1 by this task. REST now accepts the same scoped
inventoryItemId/warehouseId dimensions as existing MCP creation.

## Counts

Each status bucket returns `{count,amount,amountMinor,currencyCode}`. SQL sum,
min and max arrive as text and are checked with bigint before numeric conversion.
Unsafe constituents reject even when offsetting amounts would yield a safe sum.
Mixed currencies within one status reject 422; different status buckets may have
different currencies, each explicitly labeled. `total` counts documents rather
than summing incomparable money. Empty result is `{counts:{},total:0}`.

## Conversion and procurement coordination

Conversion accepts an empty/omitted body for all remaining quantities, or a
nonempty selection of unique line UUIDs and positive physical quantities. Both
formats work after prior qualified partial conversions. Selected quantities
round to hundredths and cannot exceed the remaining quantity. Draft/void/closed
orders reject; duplicate/foreign line selections and rounded-zero quantities
reject before mutation. The first convertedBillId remains as a historical pointer;
it no longer prevents billing the remaining quantity after a partial conversion.

Amounts now allocate saved net amount/tax by cumulative billed quantity, with
exact residuals. This repairs the former recomputation from rounded unitPrice
that dropped discounts/subminor prices and rounded every partial independently.
Conversion audit stores exact allocated amountMinor/taxAmountMinor and each
reserved PO line/quantity. Active allocations are subtracted from each cumulative
target, so voiding an earlier partial round cannot duplicate its rounding unit.
Unqualified legacy partially billed history rejects 422 rather than guessing
its previous allocations. New unbilled legacy orders remain convertible.

Org/supplier/order-validated received/billed, nondeleted GRNs allocate by date,
creation, sort order and ID. Active bill-line quantities subtract from each GRN
capacity, preventing reuse of the earliest receipt in subsequent rounds. The
received-minus-billed ceiling is preserved; any unmatched remainder has no GRN
link. Slice money/tax uses exact cumulative allocation and absorbs residuals.
Cost-center/inventory/warehouse dimensions survive conversion. Reverse-charge
VAT remains in total/taxTotal but is excluded from supplier amountDue, matching
the bill write/recognition contract. If a partial/sliced reverse-charge allocation
cannot both preserve the saved tax residual and meet recognition rounding, it
rejects 422 before mutation; no tax unit is silently added or dropped.

Conversion creates a draft bill; no ledger/stock posting occurs in conversion.
The conversion audit reservation is validated against scoped PO line and bill
links on bill lifecycle access. Recognition does not increment reserved tallies
a second time. Voiding an unposted or posted converted bill releases all its
reserved quantities, including unmatched slices, and recomputes PO status.
Converted draft bills cannot be edited/deleted through bill CRUD; callers void
then reconvert. This protects reservations until a deliberate amendment policy.
Old conversion events without new reservations retain their legacy bill lifecycle
behavior; no historical tally or posted entry is retroactively repaired.

## Mutation, sending and error guarantees

Organization/PO/line/reference locks serialize these operations. Numbering seeds
from both sequences and existing numeric PO/BILL forms, with signed int32
capacity checks. Header/lines/links/tallies/number/status/audit changes commit
together. DTO/serialization preflight happens inside the transaction. Historical
money, balances, dimensions, dates and converted-bill scope validate before
overwrite/delete/send/convert. Drafts with receipts/bill links/tallies reject
edit/delete/send. Old and replacement issue dates use strict period/closed-year
checks; owner bypass is not applied. Soft deletion retains the historical header.

Send without email only marks sent with timestamp/audit. sendEmail=true requires
recipientEmail, nonempty subject and complete templateProps. Invalid bodies no
longer silently mark sent. Empty send/convert bodies are accepted; malformed JSON
returns 400. attachPdf is accepted but remains false in delivery, preserving
existing PO behavior. Email render precedes mutation, while delivery follows the
committed state. Delivery failure returns 502 with sent state/audit retained and
a failed delivery log when written by the sender; retry through document email
tools. DB/audit failure performs no email delivery. External delivery is not
transactional and live providers are unqualified.

REST errors: 400 schema/state/reference/balance, 401 invalid credentials, 403
permission/disabled currency, 404 foreign/deleted ID, 422 period/unsupported
money/history, 500 transactional DB failures. Range/history failures include
LEGACY_NUMERIC_RANGE. MCP uses wrapTool status/code; SDK schema errors may occur
before wrapTool. No serializer fallback or unsafe Number-to-string repair.

## Verification and remaining limits

Pure price/ratio/alias/currency/PATCH/count/residual fixtures and actual migrated
PostgreSQL API-key/custom-role/registered-SDK fixtures cover all operations,
numeric/exact/dual clients, safe maxima/above-int32/signed values, tenant/role
checks, saved corruption, period locks, counts, concurrent first numbering/send/
conversion/delete, GRNI recognition/void, reserved edits, email failure without
provider credentials and injected line/bill/link/tally/audit rollback. SQL-text
snapshots compare business effects and audit/ledger/stock/email counts.

MON-020 retains combined acceptance with the other procurement children. Separate
bulk/goods-receipt/settings writers have not all adopted these locks/contracts;
races with them and period configuration remain unqualified. Foreign GRNI FX,
stock whole-unit/FIFO qualification, old reservation remediation, full-int64,
OAuth/session/browser/live email, migration/release and independent financial/
security/native-language review remain their assigned gates. No build/dev/Docker,
deployment/configured database migration or IRR enablement is claimed.
