# Loan and schedule contracts (MON-090)

2026-10-06, Asia/Tehran. Implementation: `lib/api/loan-wire.ts`, `loans.ts`,
`amortization.ts`, the three loan route files and `lib/mcp/tools/loans.ts`.
Actual transport fixtures: `tests/integration/loans-worker.ts` via the registered
MCP SDK and real API-key REST handlers, not HTTP self-calls or a dev server.

## Operations and envelopes

| REST | MCP | Inputs | Result |
|---|---|---|---|
| GET /api/v1/loans | list_loans | Optional status, page, limit | REST `{data,pagination}`; MCP `{loans,total}`; loans include linked bank/principal/interest accounts |
| GET /api/v1/loans/:id | get_loan | Scoped loan UUID | `{loan,schedule}` with linked accounts and persisted schedule row IDs |
| POST /api/v1/loans | create_loan | Name, principal aliases, rate, term, start date, principal/interest GL UUIDs, optional bank/retry key | HTTP 201 / MCP `{loan,schedule}`; generated schedule preserves original envelope without persisted row IDs |
| PATCH /api/v1/loans/:id | update_loan | Optional name/status only | `{loan}`; no amount/account/date edit or schedule regeneration |
| DELETE /api/v1/loans/:id | delete_loan | Scoped loan UUID | `{success:true}`; atomic schedule deletion and root soft deletion; posted/journal history forbids deletion |
| POST /api/v1/loans/:id/post-payment | post_loan_payment | Optional scheduleEntryId, idempotencyKey; REST permits empty body | `{entry,journalEntry,loanStatus}`; persisted payment entry and original journal envelope |

Inputs are strict objects with described MCP fields. Unknown monetary/rate aliases
reject. UUIDs are canonical UUID inputs. Name is nonempty, max 10000 characters;
retry keys are nonempty strings, max 200. Page is 1..1000000, limit 1..100,
default page 1/limit 50. Status is active, paid_off or defaulted. REST now honors
the existing UI's status filter; ordering adds ID as a stable creation-time tie
breaker. Reads retain authenticated org access without a new mutation permission.
Writes require `manage:invoices`, using custom-role permissions before role fallback.

## Money, rate, range and dates

- REST create `principalAmount` remains decimal major units, e.g. 12.50 -> 1250
  cents. Add `principalAmountExact` unsigned ASCII decimal major text (max 256
  characters) and `principalAmountMinor` canonical signed-int64 cents text.
  Decimal inputs round half away from zero to fixed cents; all supplied aliases
  must agree after rounding. Numeric exponent notation is unsupported; use exact
  text. No magnitude/locale inference or currency-dependent rescaling.
- MCP create `principalAmount` remains positive integer cents, e.g. 1250 -> 1250.
  It adds `principalAmountMinor`; it does not accept REST's decimal-major alias.
- Principal and each derived/header/schedule amount must be nonnegative safe
  integer cents, at most 9007199254740991; principal/monthly/total payments are
  positive. Exact strings outside that range fail before mutation. Full-int64
  business support remains separate. The complete schedule payment sum must also
  fit the safe range, even if every individual payment fits.
- Loan outputs add principalAmountMinor and monthlyPaymentMinor. Schedule outputs
  add principalAmountMinor, interestAmountMinor, totalPaymentMinor and
  remainingBalanceMinor. Numeric fields keep integer cents in all outputs.
  Nested bank output adds balanceMinor and nullable lowBalanceThresholdMinor,
  retaining the bank contract's signed minor-unit range. Account metadata and
  journal headers add no fictitious money aliases. Null optional bank stays null.
- Annual interestRate is whole basis points 0..100000 (500 = 5%), not money or
  FX. termMonths is 1..1200. Larger/fractional counts/rates reject instead of
  relying on database int32 errors or unbounded power/schedule allocation.
- PMT uses rational bigint powers of (120000 + rate) and 120000; zero rate uses
  principal/term. Interest is remaining principal * rate / 120000. Each result
  rounds half away from zero; the last period clears the exact principal residual.
  No Number monetary intermediate, Math.pow or floating interest calculation.
  Rounded schedules with zero payments, negative amortization or premature
  exhaustion are unsupported and reject before writes.
- Dates are Gregorian YYYY-MM-DD, years 0001..9999; all derived dates must fit.
  Monthly dates preserve legacy calendar-month overflow from the original start,
  using UTC setters to remove host-timezone dependence. Jan 31, 2024 + one month
  is Mar 2, 2024. No end-of-month clamping policy is introduced.

These tables have no saved currency/FX columns. Services require an organization
base currency with two decimal places and same-currency scoped accounts/bank.
This preserves fixed cents while failing unlike-scale currencies, including IRR,
instead of converting them. USD/GBP identity postings are supported when their
accounts are consistent. No historical currency is invented or snapshotted here.
The base setting plus linked account and saved journal tags are current checks;
they cannot prove a historical base setting for an unposted loan. Parent MON-026
retains historical currency policy and combined financial qualification.

## Transactions, historical data and payment coordination

Writers lock the live organization first, then the scoped loan, and relevant bank
rows/accounts. Adopted master/payment/delete writers cannot race into partial
state. Read operations use read-only repeatable-read snapshots. Every joined
account/bank/journal must belong to the same org before it can be disclosed or used.
Principal GL must be liability, interest GL expense, repayment GL a distinct asset;
new/posting accounts and banks must be live/active. Credit-card/loan repayment
banks are unsupported. Existing bank GL sharing with another bank rejects.
Self-linking an unlinked bank GL occurs inside the payment transaction.

Saved schedules must be complete, ordered, principal-conserving, exact-interest/
PMT-consistent and have supported canonical dates. Posted rows form a prefix,
with distinct linked journals matching date, tenant, source and posted status.
Original principal/interest/cash legs must equal the stored schedule and use base
currency with identity FX. Qualified legacy identity lines with null exact rate
metadata remain readable; new lines save rateExact "1", quote_per_base, exact
version/status and 1000000 compatibility millionths. Unsafe or inconsistent
history, foreign references, unlinked/void/extra source journals and corrupt
status fail closed; no posted schedule/history is recalculated or rewritten.

Loan creation tracks an existing liability; it does not invent loan funding.
Posting records the scheduled repayment in the GL on the schedule date:
DR principal liability + DR interest expense / CR bank asset. It performs no
external payment, invoice/bill allocation, generic payment row or bank statement
movement/balance mutation. MON-021's cash/document settlement engine is therefore
not invoked, and its allocation/FX carriers are not reused as loan payments.
Statement matching, bank/GL balance diagnostics and integrated financial review
remain their banking/MON-021/MON-026 gates. Synthetic bank balance preservation
is tested explicitly; this is no claim to resolve the existing bank balance defect.

Payments lock period_lock/fiscal_year tables in SHARE mode and apply the normal
two-tier permission-aware cutoff and closed-year rules inside the transaction.
This may delay period-setting edits across organizations; performance remains a
parent gate. Metadata creation/edit/deletion with no posting has no ledger date
effect. paid_off requires all payments posted; active requires remaining payments.
The final scheduled payment sets paid_off atomically.

Every mutation, schedule, journal/legs/number, bank GL linking, root status, output
preflight and awaited audit commits together. RETURNING values are checked against
the validated calculation/request and untouched loan fields. Audit and output
faults roll back all changes. Invalid requests fail without mutations; saved/output
fault detection inside the transaction rolls back already attempted writes.

## Retries and compatible corrections

Optional creation keys are org-scoped; normalized REST major/MCP minor requests
replay the original result across transports. Changed inputs conflict (409).
Optional payment keys are loan-scoped and fingerprint the expected schedule ID.
Without a key, supplied scheduleEntryId acts as the target retry key. Successful
retries return the audited saved result and never advance another period; an
unposted out-of-order target conflicts. Both concurrent cross-transport create
and targeted payment retries are tested. The dashboard always sends its displayed
schedule ID. Replays validate current saved loan scope/history before returning
payment results; creation replay returns its original creation snapshot.

Legacy empty payment requests deliberately preserve "post the next payment"
semantics. A later empty request can advance the following period; use a target
or explicit retry key when network retries require deduplication. Metadata edits
need no replay key; repeated delete returns 404 after soft deletion. Deletion
and payment serialize, yielding either deletion/404 or payment/deletion rejection.

Invalid schema/aliases: 400. Missing scoped root: 404. Missing/expired API key:
401. Insufficient permission: 403. Retry/out-of-order/status conflict: 409.
Unsupported ranges, saved history/accounts/currency or locked period: 422.
Compatibility errors retain LEGACY_NUMERIC_RANGE where produced by the wire/ORM
guard. Unexpected database/audit faults: REST 500, MCP wrapped error. No bigint
reaches the default numeric JSON serializer without preflight.

Dashboard amount inputs and percentage-to-basis-point parsing now use exact
fixed-cents helpers; displays and loaded-list sums use bigint. The broader create
drawer, locale/currency display and full-int64/performance/independent accounting
qualification remain assigned gates. No schema change, migration, production
IRR flag, deprecation deadline or deployment is introduced by MON-090.
