# Payment batch wire contracts - MON-058

2026-10-04, Asia/Tehran. Bounded safe-number coexistence slice of MON-021;
no full-int64, production, independent financial or IRR qualification.

## Operations and envelopes

All REST paths are under /api/v1. Shared services use direct Drizzle access,
the authenticated organization and `wrapTool` for MCP. Read operations require
authentication; all cash/draft mutations and remittance operations additionally
require manage:payments. Tenant headers cannot override an API key's organization.

| REST | MCP | Inputs | Successful response |
|---|---|---|---|
| POST /payments/batch | record_payment_batch | type, contactId, date, allocations; optional method, bankAccountId, reference, idempotencyKey | 201 / MCP {payment}, contact and allocations |
| GET /payment-batches | list_payment_batches | page and limit | {data,pagination:{page,limit,total,totalPages}} |
| POST /payment-batches | create_payment_batch | name, currencyCode, items | 201 / MCP {batch}, items without expansions |
| GET /payment-batches/:id | get_payment_batch | UUID / batchId | {batch}, items with bill/contact and bill.contact |
| PATCH /payment-batches/:id | update_payment_batch | UUID / batchId, optional name, addItems, removeItemIds | {batch}, expanded items |
| POST /payment-batches/:id/submit | submit_payment_batch | UUID / batchId; no financial request body | {batch,processed,total}, expanded completed items |
| GET /payment-batches/:id/remittance | generate_remittance | UUID / paymentBatchId; MCP optional contactId | {batch,remittances} |
| POST /payment-batches/:id/remittance | send_payment_batch_remittance | UUID / batchId, optional contactId and personalMessage | {success:true,sent:[{contactId,recipientEmail}],skipped:[{contactId,reason}]} |

Immediate batching records ONE payment across documents of one contact and
currency. Stored supplier batches record ONE payment per bill and may contain
multiple suppliers, all in one currency. Draft writes have no cash/GL effect.

## Money inputs and rounding

Immediate allocation numeric `amount` retains decimal MAJOR-unit semantics:
USD 12.50 becomes 1250 minor units. `amountExact` is an ASCII ungrouped decimal
major string with at most 256 characters, mandatory whole digits, no sign,
exponent, whitespace, grouping or leading zero (except 0). `amountMinor` is a
canonical positive signed-int64-range integer minor string. At least one is
required. Numeric and exact major aliases must agree as rational values; minor
aliases must agree with the rounded major value. Positive ties round upward,
using bigint ratios, then totals sum rounded allocations using bigint. A value
that rounds to zero rejects. No separate header amount is accepted: total IS
the allocation sum. Numeric scientific notation is interpreted through its
shortest decimal spelling, without binary float products.

Currency comes from an owned allocated document in the settlement transaction.
Frozen currency scales correct the old unconditional x100 assumption: new JPY/
IRR 1250 major becomes 1250 minor; KWD 1.250 major becomes 1250 minor. Historical
stored amounts are never rescaled. USD behavior retains its scale, with decimal
ties corrected (1.005 now produces 101, rather than a binary-float accident).
IRR fixtures use synthetic quotes; they do not enable production IRR.

Stored create/add item numeric `amount` is a positive integer in existing
currency MINOR units (USD cents); `amountMinor` is its exact matching string.
There is no stored-item `amountExact`. Item/batch currency defaults independently
to USD and must match the bill. No implicit item-currency inheritance or FX
conversion. Safe-number coexistence limits every amount, sum, converted cash,
carrying and balanced journal side to 1 through 9007199254740991, except valid
zero carrying legs. Larger valid exact int64 inputs return classified 422 before
commit. Numeric money never switches to strings by magnitude or a request header.

## Other inputs and returned aliases

All IDs are UUIDs. Immediate received settles invoices, made settles bills;
allocations are 1-1000 distinct documents in one currency/contact. Method defaults
to bank_transfer; optional bank is active, organization-owned and in document
currency. Reference is optional/nullable, at most 10000 characters. Date is
required Gregorian YYYY-MM-DD, validated for real dates. Request/body retry key
must agree, 1-128 ASCII letters/digits/._:-. Immediate allocations reject unknown
fields; MCP descriptions expose every field's units and expectations.

Stored names are 1-10000 characters; creation needs 1-1000 distinct available,
recognized outstanding supplier bills. Edit can add at most 1000 items and remove
at most 1000 distinct existing item UUIDs. Final batch is nonempty and at most
1000 bills. Edits cannot change currency and require draft status. Missing/foreign
removal IDs reject instead of being silently ignored. Only pending draft items
submit. List page is 1-21474836, limit 1-100 (defaults 1/50); SQL count is a safe
integer and reads use a repeatable-read read-only snapshot. Malformed pagination
rejects. Remittance filter contactId is a UUID present in the result; plain text
personalMessage is at most 10000 characters. Empty email POST body remains {};
malformed nonempty JSON now rejects rather than emailing everyone accidentally.

Payment `amount` and allocation `amount` return numeric minor units with
`amountMinor`; contact includes nullable creditLimitMinor. Batch totalAmount adds
totalAmountMinor; item amount adds amountMinor. Expanded bill subtotal, taxTotal,
total, amountPaid and amountDue add *Minor strings; both item.contact and
item.bill.contact add nullable creditLimitMinor. Counts, dates and IDs retain
their types. Batch total and count must equal items; bills/contacts/journal links
must belong to the organization even for unexpanded reads. Safe same-tenant
historical references remain readable; unsafe or inconsistent history rejects.

Remittance batch fields retain id/name/status/totalAmount/paymentCount and add
totalAmountMinor, currencyCode and UTC paymentDate. REST retains submittedAt/
completedAt; MCP retains paymentDate. Group totalPaid and line billTotal/amountPaid
are numeric minor units with matching *Minor strings. Groups use a single checked
currency and bigint sums; no combining unlike units. Full bill total is reported
separately from cash applied (including reverse-charge bills). No PDFs/CSV/ABA
payment file operation exists in this slice; email is HTML with attachPdf false.

## Atomic settlement and retries

Organization and batch/document locks serialize adopted standalone, batch,
reversal, bill/invoice and note/prepayment writers. The common MON-056 service
qualifies original recognition, current balances/active allocation history,
saved cumulative carrying, payment-date historical exact FX, explicit currency
scales, active cash account, period/fiscal locks and safe journal numbering.
No overpayment/clamping, missing-document skip or guessed recognition FX.
Credit/debit-note/prepayment carriers retain MON-056 qualification limits;
bulk mark-paid annotations cannot substitute for settlement. Cash journals save
FX provenance and every document has a carrying leg. Statement bank balances
are not independently accumulated by these operations.

Stored submission uses today's UTC Gregorian date, bank_transfer and GL 1100.
All payments/allocations/GL/numbering/document balances and paidAt/item status/
batch timestamps/mandatory audits/output preflight share ONE transaction. Any
failure leaves the original draft and all money unchanged. The former partial
success with unconditional completed status is intentionally replaced; no failed
item is labeled paid. Successful response counts both equal the item count.
Concurrent/repeated submit sees one success and subsequent 400; no duplicate cash.
Draft create/edit audit failures also roll back their headers/items.

Immediate optional idempotencyKey uses MON-056's organization-wide audit record,
normalized minor aliases and sorted allocations; matching retry returns original
JSON and a changed operation/data returns 409. Permission is checked on retry.
Without a key, another partial payment may be recorded if still outstanding.
Draft create is not idempotent and reserves no payable balance across batches;
submit rechecks current balances. Completed batch payment reversal is supported
by MON-057, but does not reopen a completed batch for resubmission.

## Export qualification and errors

Remittances require completed items plus retained submit audit linking each item
to its payment. Payments must be live, same org/contact/currency/amount, with the
matching allocation and live posted unreversed payment journal/date/source.
Unqualified older batches without this linkage return 422; no historical repair
or guessed payment match occurs. Reversed/missing linked cash returns 409;
corrupt journal/provenance/amount history returns 422. This prevents email or
data export from claiming unpaid or reversed items were paid.

All groups are validated and rendered before the first delivery/log write.
Formatting uses exact decimals and bigint Intl parts even at safe-max; text
fields are HTML escaped. Missing emails skip. Deliveries are sequential, external
and not transactional with DB; a later provider failure can leave earlier email
deliveries/logs committed. Repeating send may resend. The existing best-effort
send audit is awaited in REST/MCP; mandatory financial audits remain separate.
No live provider call is made by the operation fixtures.

Malformed inputs/alias conflicts/direction/status/overpayment: 400. Missing/deleted
primary batches/documents: 404; unauthenticated/expired keys: 401; denied role:
403. Foreign nested history, mixed currencies, unsafe amounts/sums/FX/numbering
or unsupported historical carrying: 422 LEGACY_NUMERIC_RANGE (period/rate errors
retain their existing 422 classification). Injected/unexpected DB failures: 500,
with financial transaction rollback. MCP reports equivalent errors via wrapTool.

Full-int64 domain, unadopted schedule/bank/config/lock writers, generalized
residual carrying after out-of-order rounded reversals, real HTTP/session/OAuth,
live email providers, broader financial/security/migration/release and IRR gates
remain assigned work. MON-021 retains combined payment/expense/banking acceptance.
