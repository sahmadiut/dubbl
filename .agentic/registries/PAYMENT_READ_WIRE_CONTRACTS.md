# Payment read contracts (MON-055)

2026-10-04, Asia/Tehran. Bounded MON-021 child; additive exact aliases retain
numeric compatibility. No exact-only negotiation, settlement mutation, cash
reclassification, FX conversion or full-int64 consumer cutover is implied.

## Inventory and envelopes

| REST | MCP | Inputs | Result |
|---|---|---|---|
| GET /api/v1/payments | list_payments | Optional type, contactId, page, limit | REST {data, pagination}; MCP {payments, total, page, limit} |
| GET /api/v1/payments/:id | get_payment | UUID; MCP field paymentId | {payment}, including contact, bankAccount and allocations |

List retains contact/allocations with no bankAccount expansion. Both preserve
existing row fields/metadata, including payment number, direction, method, notes,
reference, provider/journal/statement IDs, currencyCode, Gregorian date-only date
and ISO timestamps. Deleted payment rows are excluded. Lists order createdAt
then id descending for stable ties. Count/page rows and detail/reference checks
share a repeatable-read, read-only database snapshot per operation.

## Units, aliases and ranges

- Payment amount and each allocation amount retain signed integer minor units
  (USD cents); add amountMinor as a canonical integer string.
- Contact creditLimit retains nullable numeric minor units in its own currency;
  creditLimitMinor is a matching string or null.
- Detail bankAccount balance keeps signed minor units in the bank currency and
  adds balanceMinor. lowBalanceThreshold retains numeric/null values and adds
  lowBalanceThresholdMinor string/null. List validates linked bank money before
  omitting the expansion.
- Every monetary value must fit -9007199254740991 through 9007199254740991 under
  the transitional Number ORM. Unsafe int64 history returns 422 with
  LEGACY_NUMERIC_RANGE. No rounding/stringifying rounded Numbers repairs it.
  Numeric fields and aliases agree exactly, with no magnitude/currency rescaling.
- USD/IRR/JPY/KWD 1250 remains 1250. No FX or new base display exists here.
  Payment/contact/bank currency metadata stays intact; amounts are not converted
  or summed across currencies.
- Allocations remain separate rows. Noncash pairs (invoice plus credit_note or
  prepayment; bill plus debit_note) must not be summed into cash or rewritten as
  payment amount. Zero/signed historical amounts remain readable. Reads do not
  certify carrier bookkeeping or settlement integrity.
- Counts/page/limit stay numeric. page defaults to 1, range 1..21474836; limit
  defaults to 50, range 1..100. REST parses numeric query values and validates
  bounded integers; malformed/fractional/out-of-range values return 400 instead
  of the prior clamp/truncation. MCP requires numeric integer inputs. type is
  received/made; contactId/detail IDs must be UUIDs. Unknown query keys do not
  affect reads; no monetary aliases act as filters.

## Scope, access and errors

REST uses existing API-key/session authentication. MCP receives AuthContext at
server creation and calls direct Drizzle services through wrapTool. Reads retain
authenticated member/custom read-only role access; manage:payments is not needed.
Organization scope comes from context, not request headers/filters. Invalid or
expired API keys return 401. Missing/foreign/deleted detail IDs return 404 on both
transports. REST input validation returns 400; MCP invalid input returns an error
through SDK/schema validation or wrapTool.

Parent payment, expanded contact/bank must belong to this organization. Each
allocation documentId is checked against its actual invoice, bill, credit_note,
debit_note or prepayment/customer_credit table and organization. Unknown types,
missing documents and foreign allocation IDs return classified 422. Each list
page checks only returned rows. A valid foreign contact filter matches no own
payments without exposing a foreign contact or payment.

Scalar journalEntryId must reference an own journal. bankTransactionId must
reference a statement line through an own bankAccount. Same-tenant soft-deleted
or inactive referenced contacts/banks/documents remain readable as history.
Linked document/journal/statement contents are not expanded or mutated.

Reads change no payment/allocation/document/bank/journal/business audit/numbering/
rate/stock state. Existing API-key usage bookkeeping is separate. Unsupported
requests/history preserve SQL-text business snapshots. Shared JSON/wrapTool
serialization prevents bigint crashes and silent precision loss. No period lock
or mutation audit is needed for read-only operations.

## Qualification and pending work

Three pure contract groups and real REST exports/API keys/custom roles plus
registered MCP SDK fixtures on migrated disposable PostgreSQL qualify this slice.
They cover legacy/exact parity, signed safe endpoints, currency independence,
ties/pagination/filters, authentication/scope and polymorphic/link negatives,
unsupported history, unchanged business snapshots, nullable/inactive history and
paired noncash allocations. Adjacent credit/debit-note regression fixtures pass.
See MON-055 attempt/review evidence for actual commands and results.

MON-056 onward retain creation/pay/reversal/batch/schedule/expense/banking writers;
MON-021 retains combined integration. Writers must enforce the same references
before mutation and qualify carrier/settlement races and FX. Full signed-int64
consumers, production migration/IRR, financial/security qualification, real HTTP/
session/OAuth, providers and release gates remain pending.
