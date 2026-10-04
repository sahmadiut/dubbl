# Bank document matching wire contracts (MON-066)

2026-10-04, Asia/Tehran. Additive exact aliases with safe numeric coexistence;
no full-int64 client mode, historical money rescaling or production IRR enablement.
Implementation: bank-document-match-wire.ts, bank-document-matches.ts and the
shared payment-settlements.ts engine. Tools use AuthContext and direct Drizzle.

## Operations and envelopes

All paths are under `/api/v1/bank-transactions/{id}`. All operations require
`manage:banking`; matching keeps that existing permission while ordinary payment
creation still requires `manage:payments`. IDs are organization-owned UUIDs.

| REST | MCP | Input | Response (HTTP 200 / MCP JSON) |
|---|---|---|---|
| POST `/match`, invoice/bill inferred from ID or explicit matchType | `match_to_invoice`, `match_to_bill` | Exactly one invoiceId/billId; amount and/or amountMinor; optional date/method | payment `{id,paymentNumber,amount,amountMinor,currencyCode,journalEntryId}`; invoiceStatus/billStatus |
| POST `/match`, existing_payment | `match_to_existing_payment` | Exactly one paymentId; no amount/date override | REST `{matchType,paymentId,journalEntryId}`; MCP retains `{transactionId,paymentId,journalEntryId}` |
| POST `/match`, existing_journal | `match_to_existing_journal` (new) | Exactly one journalEntryId; no amount/date override | `{matchType,journalEntryId}`; MCP adds transactionId |
| POST `/match-invoice` | `match_to_invoice` | invoiceId, amount and/or amountMinor, optional date/method | Same invoice match envelope |
| POST `/split` | `split_to_documents` (new) | 1..1000 distinct allocations `{documentType,documentId,amount?,amountMinor?}`; optional date/method | payment as above, allocations `{documentType,documentId,amount,amountMinor,newStatus}` |
| GET `/match-invoice` | `get_bank_invoice_matches` (new) | No body; transactionId for MCP | transaction summary, suggestedMatches, openInvoices |

Other migrated MCP writers add their existing transactionId. Unknown fields fail.
Exactly one target must agree with explicit matchType; ambiguous IDs fail rather
than selecting one silently. `/match` GET remains the MON-063 suggestion service.

## Units, aliases, supported range and defaults

Numeric amount and allocation amount are positive integer **currency minor units**,
USD cents (1250 = $12.50); they are never decimal major prices. amountMinor is a
canonical positive integer string, equal to amount when both appear. Input syntax
rejects fractions, signs/leading zeros, exponents, spaces, localized digits and
negative zero. Every stored/derived monetary operand, allocation total, cash/GL
leg and journal total must fit the safe numeric range up to 9007199254740991.
Larger valid int64 aliases fail 422 before committed mutation. No unit inference
or explicit exact-only mode exists. USD/JPY/KWD/IRR stored 1250 remains 1250.

Date is canonical Gregorian YYYY-MM-DD, defaults to the statement date, cannot
predate recognition and must be open. The statement date is checked separately.
Method is bank_transfer/cash/check/card/other, defaults to bank_transfer. An
existing-record link retains saved dates/money/method and posts nothing.

Statement numeric amount remains signed; its magnitude must equal the new
settlement or saved cash exactly. Positive settles invoices, negative settles
bills. Zero, excluded, reconciled, transferred or already linked lines fail.
Allocations must cover the **entire** statement magnitude, with no overpayment,
duplicate document or remainder. Splits currently require one contact/currency
because one payment has one contact. Partial/mixed-contact legacy reconciliation
is explicitly rejected; the old behavior could hide unposted residual cash or
create inconsistent carrying history. Documents and the bank must share currency.

GET returns signed transaction amount/amountMinor and currencyCode; outgoing or
zero amounts return empty lists. Up to 50 same-currency sent/partial/overdue invoices
are returned in stable UUID order, with numeric total/amountDue and exact aliases.
Suggested matches retain their candidate envelope, adding candidate.amountMinor.
Nested foreign contacts and unsafe money fail. The read uses a read-only snapshot.

## Settlement and saved history

New settlement reuses [payment contracts](PAYMENT_SETTLEMENT_WIRE_CONTRACTS.md):
recognized, unreversed, qualified invoice/bill/GRNI history; saved AR/AP carrying;
actual outstanding reverse-charge payable; exact cumulative rounding residuals;
payment-date cash FX, document/base minor scales and separate realised gain/loss.
Exact rates retain quote_per_base direction, format v1 and legacy-millionths
agreement. Supported quote range remains 0.000001..2147.483647 with lossless
millionths. Missing quotes fail 422, not implicit identity FX.

Credit/debit/prepayment application carriers remain noncash. Their paired
allocations and saved recognition/control history qualify only the existing
matching/proportional FX rules; ambiguous/differing carrier rounding fails.
Balance-only external paid annotations are not invented cash settlements.
MON-042/045/048/051 handoffs and MON-021 combined accounting acceptance remain.

Existing payment matching requires active, unlinked, posted **cash** on the same
bank, currency, direction and exact amount. It never changes bankAccountId to
make a candidate fit. Noncash carriers/unposted payments fail. Allocation sums,
distinct owned documents/contact, saved payment journal, source/date, exact FX,
base/cash/rate audit provenance and document-specific carrying legs must agree.
Saved FX is used without a current quote lookup. Missing/corrupt legacy provenance
fails visibly, without historical repair. No document balances are changed.

Existing journal matching requires owned, live, unreversed posted history, balanced
safe nonnegative amounts, owned GL/dimensions, consistent saved FX and the complete
net bank leg equal to the signed statement cash. The saved bank GL must be active,
exclusive and correctly typed/denominated. Direct journals support base-currency
identity FX only; foreign cash uses existing-payment matching. Payment/expense-
owned, transfer and noncash application journals cannot bypass their workflows.
A qualified base-currency customer-credit **cash receipt** can link its journal;
this does not apply its deposit or create a settlement. No journal may link twice.

## Atomicity, authorization, locks and errors

Organization lock precedes bank/movement and settlement document/history locks;
shared adopted writers serialize on the same organization. Ownership is scoped
before decoding foreign money. Active banks and valid exclusive GL links are
required. Existing links, transfer/statement sessions and bank-expense history
must be resolved first. Statement, new posting and saved existing journal dates
respect period locks/fiscal closure. Read/write roles and invalid/expired API keys
are exercised through actual handlers; MCP schemas are strict and described.

New payment, numbering, allocations, carrying/cash/FX journal, document statuses,
bank/payment links and all financial audits share one transaction. Existing links
and audit likewise commit together. Precommit serialization guards prevent bigint
crashes or committed unsafe results. Forced audit failures roll back earlier
writes. Repeats fail without duplicate posting; concurrent statement/document/
payment/journal matches produce one successful exclusive match. No bank balance
or stored statement amount is changed by reconciliation. There is no durable
success-response replay/idempotency key on these bank endpoints.

Errors: 400 input/state/direction/currency/amount mismatch, 401 authentication,
403 permission, 404 missing/foreign parent/target, 422 unsupported money/FX/history
(`LEGACY_NUMERIC_RANGE`) or period lock, 500 unexpected DB errors with rollback.
No credentials or foreign financial detail are returned.

MON-067 transfers, MON-068 undo/session reconciliation, MON-069 rules and MON-021
combined acceptance retain their gates. Other legacy writers/configuration do not
all share the adopted locks; no browser/OAuth/provider/production qualification or
independent financial review is claimed. No schema/migration change is required.
