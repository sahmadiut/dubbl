# Supplier debit-note contracts (MON-051)

2026-10-04, Asia/Tehran. Implements one MON-020 child. Evidence:
MON-051-attempt-1 and implementing-assistant self-review MON-051-review-1.
No schema, migration generation, build, dev server, deployment or IRR enablement.

## Boundaries and envelopes

| REST | MCP | Input / response |
|---|---|---|
| GET /api/v1/debit-notes | list_debit_notes | Filters/pagination; REST data + pagination; MCP debitNotes + total/page/limit |
| GET /api/v1/debit-notes/:id | get_debit_note | Scoped UUID; debitNote with contact, lines/account/tax and recognition journal |
| POST /api/v1/debit-notes | create_debit_note | Draft header/lines; debitNote, HTTP 201 |
| PATCH /api/v1/debit-notes/:id | update_debit_note | Whitelisted draft fields/replacement lines; debitNote |
| DELETE /api/v1/debit-notes/:id | delete_debit_note | Draft soft-delete, retaining lines; success |
| POST /api/v1/debit-notes/:id/send | send_debit_note | Draft recognition; debitNote; REST optional email after commit |
| POST /api/v1/debit-notes/:id/apply | apply_debit_note | billId + amount/amountMinor; debitNote and bill |
| POST /api/v1/debit-notes/:id/void | void_debit_note | Reverse/unwind atomically; debitNote |

MCP uses debitNoteId for the path UUID. AuthContext fixes the organization; REST
API keys cannot redirect scope through x-organization-id. All selected writes
require manage:debit-notes; bill void retains approve:bills. Reads require valid
authentication and organization-owned relations. MCP tools call direct Drizzle
services inside wrapTool, without HTTP self-calls.

## Units, aliases and ranges

- Header fields: contactId, optional nullable billId/reference/notes, Gregorian
  issueDate and currencyCode (default USD). Create requires 1..1000 lines. PATCH
  permits these fields and complete replacement lines only; tenant/status/totals/
  posted IDs/timestamps reject. Changing currency with retained lines relabels
  unchanged minor integers; it never rescales them. Old/new edit dates are open.
- REST unitPrice is a numeric decimal major-unit price, e.g. USD 12.50. MCP
  unitPrice is integer minor units, e.g. USD 1250 cents. Both accept
  unitPriceExact (ASCII decimal major string, <=20 whole/18 fractional digits)
  and unitPriceMinor (canonical signed integer minor string). Numeric/minor/exact
  aliases must agree; omitted prices are zero. No magnitude/locale/header opt-in.
- Quantity is decimal physical units on input, signed int32 hundredths on output;
  input range -21474836.48..21474836.47. It is not money. Discount is 0..10000
  basis points, default zero. The existing debit-note-line table has no discount
  column: the saved amount includes the exact rounded discount. Description is
  nonempty; accountId/taxRateId/costCenterId are nullable owned UUIDs.
- Extend the unrounded price with quantity, round gross, basis-point discount and
  exclusive tax using integer ratios and the existing signed tie toward +infinity.
  Products/taxes/sums/stored prices and converted GL amounts must all fit signed
  JavaScript safe integers (+/-9007199254740991). The int64 alias parser accepts
  canonical signed int64 syntax, then larger workflow values reject with 422.
  Leading zeros, whitespace, exponent/localized exact strings and conflicting
  aliases fail with 400. Numeric MCP prices must be safe integers.
- Headers retain numeric subtotal/taxTotal/total/amountApplied/amountRemaining and
  add matching *Minor strings. Lines retain numeric unitPrice/amount/taxAmount and
  add *Minor strings. Contact creditLimit adds its existing exact alias. Bill
  responses use qualified BILL_WRITE_WIRE_CONTRACTS aliases. USD 1250 stays 1250;
  JPY/IRR/KWD use their frozen currency scales without changing stored history.
- List: optional draft/sent/applied/void status and contact UUID; REST from/to map
  to MCP startDate/endDate; strict Gregorian dates. Page 1..21474836 (default 1),
  limit 1..100 (default 50); date/total/number/created sorts and asc/desc order.
  Stable ID tie-break, scoped count, repeatable-read snapshot; no mixed money sum.
- Apply accepts positive safe integer amount and/or canonical amountMinor, equal
  when both supplied. It must fit both remaining note credit and supplier due.
  It records no second AP journal: recognition already debited AP.

## Recognition, stock and reversal

Every selected writer locks the organization and document, validates scoped
references and dates, preflights DTO serialization and commits numbering/header/
lines/journals/stock/allocations/bill balances/audit in one transaction. Missing
AP, missing expense accounts, missing FX, negative/zero posting totals, unsafe
history or inconsistent saved header/lines fail with no committed changes.

Expense recognition supports standard fully recoverable input VAT. It posts DR
AP = total, CR expenses = subtotal, CR input VAT = taxTotal. Standalone notes use
issue-date historical FX; linked expense notes reuse qualified saved bill FX.
Journal rows save exact quote-per-base FX with numeric millionths aliases and
version/provenance. Rates that cannot coexist exactly with legacy millionths
reject. Unqualified legacy recognition is readable when its owned reference
matches, but allocation/reversal requires its own sourceId and qualified saved FX.

Debit-note lines lack stock dimensions. A linked stock note therefore supports
only a complete matching recognized non-GRNI bill return, with matching ordered
line quantities/net/tax/accounts/tax IDs/cost centers and document balances.
Only one active stock debit note may reference the bill. Its journal mirrors the
original bill's saved base amounts/FX/dimensions, leaving that original entry
posted. Saved bill receipt movements remove original quantities/value from
untracked average/FIFO stock and warehouses; original FIFO layers must be wholly
unconsumed and exactly valued. Partial/GRNI/standard/serial/lot or unlinked
receipt history rejects with 422. No current-price cost reconstruction occurs.

Void swaps actual saved recognition legs, marks reversal links, restores actual
returned stock value/quantities and original FIFO layer balances, then unwinds
allocations. Missing/altered stock movements, foreign dimensions, changed cost
method, incompatible layer history or overdrawn stock reject and roll back.
Bill void refuses active linked debit notes to prevent double stock/AP reversal.

## Allocation and settlement coordination

Application requires sent remaining credit, recognized outstanding received/
partial/overdue bill, matching supplier/currency, posted own journals, matching
saved FX/AP account and equal proportional base AP carrying values. Different
rates or FX rounding residuals reject with 422 pending MON-021. It inserts a
noncash made/other carrier payment with paired debit_note/bill allocations and
updates note applied/remaining and bill paid/due using guarded bigint arithmetic.
Fully used notes become applied; settled bills become paid, otherwise partial.

Void validates every carrier's organization/supplier/currency/date/type and exact
two-link amounts against amountApplied. Bank-linked, deleted, provider-linked or
journal-bearing carriers reject. It restores bill balances, deletes qualified
carrier payments (cascading their allocations), resets note applied/remaining to
zero and marks void. Orphaned legacy applications are refused, not guessed.
Repeated partial application is a new allocation; no request-id deduplication is
advertised. Concurrent full application/send/void commit once under these locks.

Other payment/bank/bulk/configuration writers do not yet share every lock.
MON-021 retains cross-writer races, cash classification/report effects, carrying
FX/residuals, generic payment reversal and request idempotency. MON-020/024/052
retain partial stock/GRNI and specialized tax/header qualification. Existing
application capabilities outside this selected slice are not qualified here.

## Email and errors

REST send accepts no body, {} or sendEmail false; when true, recipientEmail,
nonempty subject and templateProps (organizationName/contactName/documentType/
documentNumber plus optional rendering strings) validate before recognition.
attachPdf is accepted for compatibility but delivery uses false (PDF MON-034).
MCP send performs recognition only; existing document-email tools handle delivery.
Delivery runs after commit. Failure returns 502 with the sent debitNote; retry
document-email delivery separately. A repeat recognition request returns 400.

400 covers schema/aliases/state/business errors; 401 invalid auth; 403 role;
404 missing/foreign scoped document; 422 unsafe money, period/closed-year/missing
FX or unsupported qualified-history paths (wire range code LEGACY_NUMERIC_RANGE);
500 unexpected transactional failures. Read/serialization range errors disclose
no rounded values. Full-int64, PostgreSQL 16/production migration, provider/
session/OAuth/browser and independent accounting/security/IRR/release gates remain.
