# Scheduled payment wire contracts - MON-059

2026-10-04, Asia/Tehran. Safe-number coexistence slice of MON-021. Shared
services use direct Drizzle access and authenticated AuthContext; MCP uses
wrapTool and strict registered Zod schemas. No exact-only negotiation exists.

## Operations

All REST paths below are under /api/v1. Reads require authenticated organization
access; all mutations/process require manage:payments. API key organization
cannot be overridden by tenant headers. IDs and bill/contact IDs are UUIDs.

| REST | MCP | Input | Success |
|---|---|---|---|
| GET /scheduled-payments | list_scheduled_payments | page, limit, optional status | {data,pagination:{page,limit,total,totalPages}} |
| POST /scheduled-payments | create_scheduled_payment | billId, contactId, amount aliases, scheduledDate, optional currencyCode/notes | 201 / MCP {scheduledPayment} |
| GET /scheduled-payments/:id | get_scheduled_payment | UUID / scheduledPaymentId | {scheduledPayment} |
| PATCH /scheduled-payments/:id | update_scheduled_payment | UUID / scheduledPaymentId, optional amount aliases, scheduledDate, notes, status="cancelled" | {scheduledPayment} |
| DELETE /scheduled-payments/:id | delete_scheduled_payment | UUID / scheduledPaymentId | {success:true} |
| POST /scheduled-payments/process | process_scheduled_payments | no financial body; UTC-today cutoff | {processed,total,skipped,failed,failures} |

List defaults page 1, limit 50; supported page 1..21474836, limit 1..100.
REST retains shared parsePagination's parseInt/clamp behavior; unparseable or
excessive page rejects. MCP requires integer values within bounds. status is
pending, processing, completed, failed or cancelled; unknown statuses reject.
List/detail reads use repeatable-read read-only snapshots, descending scheduled
date then ID, and validate referenced money/ownership before disclosure.

## Money, dates and envelopes

amount remains positive integer currency MINOR units (USD cents). amountMinor
is a canonical signed-int64-range integer string with positive value; at least
one alias is required for create, and PATCH can omit both to retain money.
Both must agree exactly. Leading zeros, decimal strings, negative zero, exponents,
whitespace/grouping/localized digits and fractional numeric amounts reject.
There is no amountExact decimal-major alias. The supported stored/converted/sum
range is 1..9007199254740991 (zero remains valid for individual carrying legs).
Larger valid int64 exact inputs fail 422 before mutation. Numeric money remains
numeric regardless of magnitude; stored USD/JPY/KWD/IRR 1250 remains 1250.

currencyCode defaults to USD on create and must match the bill. PATCH cannot
change bill, supplier or currency. scheduledDate is a real Gregorian YYYY-MM-DD;
create/edit require open dates, on/after bill recognition and no overpayment.
PATCH checks both old and new dates. notes is optional nullable text, at most
10000 characters; null clears. REST bodies/MCP arguments reject unknown fields.
REST process accepts an unused/empty body for existing clients; MCP has no inputs.

Every schedule response retains amount and adds amountMinor. Expanded bill
subtotal/taxTotal/total/amountPaid/amountDue add matching *Minor strings;
schedule.contact and bill.contact include nullable creditLimitMinor. Currency,
dates, status, IDs and other counts keep their types. Unsafe, missing, mismatched
or foreign bill/contact/journal references fail before disclosure, including
list/delete/cancel; same-org inactive/deleted history can still be read.

The existing form now prefills and parses decimal major input using the selected
bill's currency scale and exact bigint half-away rounding, then submits amountMinor
and currencyCode. USD positive ties round up; JPY/IRR have zero fractional scale,
KWD three. Plain ASCII decimal input is expected, without grouping or symbols.
UI failure messages report pending failed attempts. Its legacy currency display
formatter and broader locale/Persian normalization remain LOC-003 rollout work.

## Atomic writes, execution and retry policy

Create and ordinary edit require live recognized outstanding supplier bills,
matching active supplier/contact, available saved journal link, supported money,
and amount no greater than current amountDue. Scheduling is intent, not a
reservation: multiple schedules may initially target the same outstanding bill.
Execution rechecks live balance and recognition. Create repeats create new
schedules; there is no request idempotency key or inferred reference identity.

Organization then schedule locks serialize adopted CRUD/process with existing
settlement/document writers. Schedule/audit create, edit, cancel and soft delete
commit together. Only pending schedules can be edited/cancelled. Cancellation
does not require the bill to remain outstanding, so settled intent can be released;
money/references/dates remain guarded. Pending/cancelled/legacy failed schedules
can be deleted on an open saved date. Processing/completed schedules reject
deletion; reverse the actual payment separately. No schedule deletion reverses cash.

Processing selects due live pending IDs ordered by date/ID, then rereads each row
under the locks. Changed/deleted/cancelled/completed/future rows skip. Each item
uses MON-056 settlement inside the caller's transaction, bank_transfer, GL 1100,
saved schedule date/notes/currency and one bill allocation. Retained recognition
carrying and payment-date FX release AP and post cash/realised FX, save exact FX,
update bill paid/due/status/paidAt, number payments/journals, and audit. Payment,
allocation, journal legs/link, balances, schedule completed/processedAt and both
settlement/schedule audits commit atomically. Mandatory audit failure rolls back
every effect. Schedule process audit links the exact paymentId; no guessed linkage.
Safe serialization preflight remains inside the settlement transaction.

Concurrent/repeated processing cannot duplicate a completed schedule's cash,
even when the first response is lost. Reversed payments do not re-arm schedules.
No public schedule-to-payment retry key is exposed: the locked status and atomic
commit are the schedule retry identity. Completed legacy schedules are not repaired.

Each failed item rolls back and remains pending. Other successful items stay
committed. total counts the selected IDs; processed counts new completions,
skipped counts IDs changed before their lock, failed counts failures.
failures is [{scheduledPaymentId,status,error,code?}]. Per-item errors are embedded
in a successful HTTP 200/MCP result; authorization failure fails the entire call.
Clients must inspect failed/failures even when processed=0. Numeric counts are
not money, and no cross-currency monetary total is produced. Invalid due money
cannot block independent items because initial selection reads IDs only.
Legacy failed/processing rows are not automatically retried or reassigned;
processing rows may represent old ambiguous commits and need provenance review.

No dedicated Trigger job/cron referenced scheduled payments in the inspected
source. Existing dashboard on-load and explicit process invocations now use this
service, as does MCP. No new unattended cash-posting schedule is introduced.

## Errors, verification and remaining gates

Invalid schemas/aliases/state/date ordering/overpayment and unavailable default
cash account generally return 400; missing/deleted schedule 404, permission 403,
unauthenticated/expired key 401. Foreign/inconsistent/unsafe historical references
or money return 422 with LEGACY_NUMERIC_RANGE. Period/fiscal locks and missing FX
return 422. Internal DB/audit failures return 500. Process item failures carry
the same classification after rollback without leaking internal DB diagnostics.

tests/scheduled-payment-wire.test.ts covers units/scales/aliases/safe edge/syntax.
tests/integration/scheduled-payments-worker.ts invokes actual REST handlers and
MCP SDK against a disposable migrated PostgreSQL database: role/org/key isolation,
CRUD/read aliases, dates/locks/closed years, audit rollback, stale balances/partial
run, concurrent process/cancel, safe max, EUR retained currency/payment-date FX,
missing rates/cash account and unsafe/null/foreign/deleted history.

MON-042/051 noncash carrier carrying and MON-045 status-only paid annotations
remain qualified/rejected by the existing settlement history checks, without new
balance-only settlement. MON-048 recognized payable and reverse-charge policies
are retained. MON-021 keeps combined banking/payment/expense acceptance.
Full-int64 consumers, nonadopted lock/config/bank/contact-merge writer concurrency,
ambiguous old processing recovery, actual browser/session/OAuth, long-run resource
limits, independent financial/security/migration/release and IRR gates remain open.
No schema, stored-unit, migration, deployment or IRR flag change.
