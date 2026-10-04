# Payment reversal contracts (MON-057)

2026-10-04, Asia/Tehran. Bounded MON-021 child. Shared direct-DB service;
no schema, currency regime, rollout flag, exact-only negotiation or deployment.

## Boundaries and representation

| REST | MCP | Input | Output |
|---|---|---|---|
| DELETE /api/v1/payments/:id | delete_payment | Organization payment UUID; MCP paymentId | HTTP 200 / tool JSON {success:true} |

There is no monetary request field, date override, currency conversion or new
client representation switch. Both legacy and exact clients delete the same
records. MCP describes its UUID and units and uses wrapTool(ctx); REST uses
jsonResponse/handleError. DELETE body/header money aliases are not consumed.
Malformed UUID: 400; missing/foreign/deleted payment: 404; unauthorized: 401/403.
Repeating deletion returns 404 and creates no extra journal or audit. Settlement
retry keys still replay their original creation result; use a new settlement key
to record cash again after reversal, never reinterpret an old key as new cash.

## Stored units, aliases and supported ranges

Payments, allocations, invoice/bill paid/due and note/prepayment applied/remaining
balances retain the document currency's integer minor units (USD cents).
USD/IRR/JPY/KWD integers are never rescaled based on locale or magnitude. Cash
allocations sum to payment.amount. Noncash carriers have two equal allocations;
their sum is not a cash total. Carrier amount is positive application money,
even though a note carrier has no new cash journal.

Saved money must be a safe integer; positive payment/allocation amounts range
1..9007199254740991. Balance subtraction/addition uses bigint, validates
nonnegative operands and safe results, and never clamps. Invoice paid+due must
equal total; bill payable can be below tax-inclusive total (reverse charge), but
must remain positive and no greater than total. Active saved allocations must
exactly equal each document's paid balance and each source credit's applied
balance. No annotation-only balance is silently repaired.

Audit preflight adds canonical amountMinor aliases to payment/allocation rows,
document money aliases through existing DTOs, and totalMinor/amountAppliedMinor/
amountRemainingMinor or originalAmountMinor/amountRemainingMinor to restored
credits. Numeric fields retain their types; dates/timestamps/nulls remain JSON
compatible. The public success envelope has no monetary fields. Unsafe ORM
history, sums or output fail 422 LEGACY_NUMERIC_RANGE before committed writes.
No full-int64 domain qualification is claimed by accepting a UUID.

## Identity, locking and history

Requires manage:payments. Organization, payment, allocation/document/credit and
journal rows are read/locked within one transaction. The organization lock
serializes adopted settlement, carrier and reversal writers. Historical contacts,
banks, GL accounts and dimensions must belong to the organization; an inactive
owned bank/GL reference can be reversed. Its balance and links stay unchanged.
Every target document is live, recognized and in its allowed settlement state.
Recognition must be owned, posted, live/unreversed and match document source.

Payment date, affected issue dates, prepayment receipt date and reversed journal
date must be open. Closed fiscal years reject. Existing strict lock behavior is
retained (no new bypass permission). Simultaneous unadopted lock/configuration,
legacy batch/schedule and bank writers still need parent-domain qualification.

Cash journals must be their own posted unreversed payment source, matching
sourceId, or legacy reference when sourceId is null. They must have positive
balanced safe totals, nonnegative one-sided legs, owned accounts/dimensions,
qualified exact FX v1 quote_per_base consistent with legacy millionths, and
matching payment date/currency. Reversal swaps saved debit/credit verbatim and
copies currency, legacy/exact rate, version, direction, migration status,
provenance, cost center and project. Original lines are unchanged; both entries
link each other. No current rate lookup, recognition revaluation or provider call.
Journal numbers fit positive int32 and are allocated under the organization lock.

Credit/debit-note carriers require exactly one matching note and one invoice/bill,
equal positive amounts, method other, matching note issue date and no cash/bank
journal or bank reference. Deletion restores source applied/remaining/status and
target paid/due/status/paidAt without reversing the note recognition journal or
stock. Note voiding now excludes soft-deleted carriers, retaining their history.
Prepayments require an owned open/applied customer credit and saved application
journal; deletion restores remaining/status and reverses only the application,
preserving the original deposit journal.

All payment/document/note/prepayment writes, journal/reversal links, soft-delete,
output preflight and mandatory audit commit or roll back together. Allocation
rows and original payment bank/provider/reference metadata remain historical.
BankTransactionId, Stripe intent or any statement line linked to the payment
journal yields 409: unmatch/refund through the appropriate workflow first.
No bank statement balance, reconciliation or external refund is manufactured.

## Verification and limits

Pure reversal arithmetic and actual REST/API-key/custom-role/registered SDK
fixtures run on disposable fully migrated PostgreSQL. Cover numeric/exact-created
cash, safe-max/above-int32, multi/partial, legacy null sourceId, FX edits/dimensions,
USD/IRR/JPY/KWD scales, note reapply/void after delete, prepayment, locked dates,
foreign refs, corrupt/unsafe history, audit rollback and duplicate concurrency.

Out-of-order rounded cash reversals preserve each saved control/FX leg, including
zero control legs. Retained applications can then differ from MON-056's required
cumulative proportional carrying; that settlement guard still rejects new cash
until the remaining applications are unwound. Fixtures qualify arbitrary-order
unwind and clean resettlement; generalized residual carrying is not implemented.
No posted history is rewritten to hide this condition. Full financial/IRR,
configured-target migration, live HTTP session/OAuth/provider, independent review
and remaining MON-021 child/combined gates are not inferred from these checks.
