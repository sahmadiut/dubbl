# Payment settlement contracts (MON-056)

2026-10-04, Asia/Tehran. MON-021 child; additive exact input/output aliases,
safe-number business range, no full-int64 cutover or currency rollout change.

## Operations and envelopes

| REST POST | Registered MCP | Required inputs | Result |
|---|---|---|---|
| /api/v1/payments | create_payment | contactId, type, date, amount/amountMinor, allocations | {payment}, REST 201; full contact/allocations |
| /api/v1/invoices/:id/pay | pay_invoice | UUID path/invoiceId, amount/amountMinor, date | {invoice,payment}, REST 200 |
| /api/v1/bills/:id/pay | pay_bill | UUID path/billId, amount/amountMinor, date | {bill,payment}, REST 200 |

Single-document MCP date omission defaults to today in UTC. REST dates are
required canonical Gregorian YYYY-MM-DD, validated for real calendar dates.
MCP paths now settle actual cash instead of annotating paid balances. They use
manage:payments instead of manage:invoices/manage:bills; ordinary shape envelopes
remain with the additive payment result. No new tool registration file is needed.

## Fields, units and supported ranges

- Payment and each allocation: positive safe integer amount or canonical ASCII
  int64 amountMinor text, exact agreement if both supplied. Supported business
  range 1..9007199254740991. USD/IRR/JPY/KWD 1250 remains 1250 in document minor
  units. Valid larger int64 strings fail 422, never round or promote strings into
  a number-only path. Malformed strings/numbers, negative/zero and alias conflicts
  fail 400. There is no exact-only negotiation or implicit representation header.
- allocations: 1..1000 distinct document UUIDs, documentType invoice for received
  or bill for made. Exact sum must equal cash; all same contact/currency. No
  unapplied remainder, wrong-direction allocation or document overpayment. Use
  customer-credit creation for unapplied cash; it is a separate existing operation.
- contactId and optional bankAccountId: UUID, organization-owned live references;
  customer/supplier direction must match (both is accepted). bankAccountId nullable
  or omitted uses active cash GL 1100. Supplied bank is active/live and has document
  currency; its linked chart account is organization-owned active asset, distinct
  from control. Auto-linking uses existing bank-ledger helper in this transaction.
  Statement bank balance is unchanged; statement import/matching/reconciliation
  retains its own balance model and assigned children.
- Optional currencyCode normalizes through the shared currency schema and must
  match allocations; omission derives it. Currency scale never rescales an input.
  method is bank_transfer/cash/check/card/other, default bank_transfer. Optional
  reference and create notes are nullable strings <=10000 chars; blank is null.
  date does not predate issueDate. Payment/journal numbering remains int32 bounded.
- Header output subtotal/taxTotal/total/amountPaid/amountDue keeps numeric minor
  units with *Minor strings. Invoice balances use recognized total; bill due uses
  actual payable (reverse-charge VAT is excluded). Payment keeps number/date/method
  and adds amountMinor/currencyCode/journalEntryId; creation additionally uses the
  MON-055 full payment/contact/allocation DTO. Contact creditLimitMinor is nullable.
  All output and posting sums must fit safe signed integers before commit.
- REST schemas reject unexpected fields; SDK raw tool shapes may strip unknown
  top-level fields before invoking the shared strict service. Known fields and
  strict allocation objects are validated. JSON serialization stays guarded.

## Recognition, carrying and transaction FX

No missing journal/account becomes a balance-only success. Invoice sent/partial/
overdue or bill received/partial/overdue requires a posted, unreversed, live,
organization-owned invoice/bill recognition journal matching sourceId (or legacy
null sourceId plus document reference) and issue date. Every line validates safe
money, balanced nonnegative sides, account ownership and consistent exact FX,
direction quote_per_base, format v1 and legacy-millionths agreement. Current AR
1200/AP 2100 must be active with correct type and base denomination. Saved invoice
sender base must agree; historical bills without that snapshot are bounded by
control denomination and saved recognition validation. Unqualified history fails
422; changing the organization's currency is not a history revaluation operation.
Bill AP combines the saved bill and bill_grni clearing entries; clearing-only
and split tax/main AP are supported with consistent source/FX/date provenance.
Invoices whose recognized control no longer covers their header total fail 422.

Control carrying uses actual saved recognition AR/AP, not current issue-date FX.
For recognized base value B, document payable T, prior paid P and new amount A,
release round(B*(P+A)/T)-round(B*P/T) using exact bigint half-away rounding. Final
payment releases all remaining carrying value. Zero control legs from rounding
are allowed; cash must round to a positive base amount. Previous paid amount must
equal active saved allocation history and cumulative carrying must agree.

Prior cash requires qualified payment journal, document-specific control leg
and settlement audit base provenance from this service. Old balance-only marks,
missing allocation/journal/provenance, unknown carriers and mismatched FX/rounding
fail visibly, without rewriting history. Credit/debit-note carriers remain paired
noncash allocations; qualify saved note organization/contact/currency/recognition
and matching exactly proportional control values. Prepayment application carriers
use their saved customer_credit_application journal rather than counting another
cash movement. Differing-FX or ambiguous carrier rounding is explicitly unsupported;
the original MON-042/045/048/051 handoffs and MON-021 integration remain pending.

Payment-date quote lookup uses the same transaction and historical exact resolver.
Document-major to base-major FX includes both minor scales; no float ledger math.
No payment-rate-as-recognition fallback exists. Current rate must fit positive
int32 millionths exactly (1e-6 through 2147.483647) until coexistence cutover.
Bank/cash, one carrying leg per document, and optional FX gain 4910/loss 5930
balance exactly. Journal money is base minor units, currency/FX metadata records
transaction denomination and payment quote, matching established invoice posting.
Audit stores base currency, payment rate/direction/source/effective date/provider/
inverse provenance and each saved recognition rate/carrying release as strings.

## Authorization, locks, concurrency, audit and retries

All six boundaries call the same direct Drizzle service using captured AuthContext,
manage:payments and the existing role/custom-permission period-lock helper.
Organization/header spoofing cannot select another tenant. Missing/foreign/deleted
documents return 404; malformed/business values 400; denied roles 403; valid unsafe
money/history, missing FX and locks 422. Internal SQL failures return REST 500 or
MCP errors. The fixture deliberately rejects audit inserts and verifies rollback.

An organization FOR UPDATE lock plus document/recognition/history row locks
serializes these adopted writers, number creation and retries. All payment,
allocation, bank auto-link, journal, balance/status/paidAt, sequence and audit writes
share one transaction. DTO/serializer errors also roll back. New document pay audit
and payment settle audit are mandatory; API-key last-used bookkeeping is separate.
Concurrent over-settlement admits one request; same-key repeats produce one
payment/result/audit. This does not qualify concurrent legacy batch/schedule/
bank writers or simultaneous configuration/period-lock edits in other tasks.

Optional idempotencyKey (or REST Idempotency-Key, matching if both supplied) is
1..128 ASCII letters/digits/._:-, shared across adopted operations within an org.
Normalize alias choices, defaults/nulls and allocation order; operation/target,
date, explicit currency/contact, method, bank and notes/reference remain identity.
Replays are authorized again, then return original JSON before outstanding/lock
checks; changed payload/operation returns 409. No key means a fresh cash operation.
MCP clients should supply explicit date for retries across UTC day boundaries.
The payment settle audit row durably stores fingerprint, key and original result;
retention of that row is required. No audit purge/rewrite policy is added here.

## Qualification and remaining scope

Pure contracts plus disposable migrated PostgreSQL actual REST exports/API keys/
custom roles and registered SDK fixtures cover aliases/ranges, locks/isolation,
cash/FX/carrying/scale conservation, noncash carriers, rollback, first-number and
concurrent/retry behavior. Evidence lists actual commands and limits. No real
HTTP OAuth/session, provider quote, configured-target migration, IRR enablement,
schema change, build/dev server or deployment is implied. MON-057 reversal,
MON-058 batch, MON-059 scheduled payments, remaining expense/banking children and
MON-021 combined acceptance retain their original work.
