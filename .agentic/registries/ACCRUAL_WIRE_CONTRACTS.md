# Accrual schedule and posting contracts

2026-10-06, Asia/Tehran. MON-097; actual source, ADR-006 and migrated PostgreSQL
fixtures. Shared accrual-schedules.ts/accrual-wire.ts; five existing MCP tools
remain registered through registerAllTools and use direct Drizzle transactions.

## Boundary map

| REST /api/v1/accrual-schedules | MCP | Input | Output |
|---|---|---|---|
| GET collection | list_accrual_schedules | Optional status/page/limit | REST data/pagination; MCP accrualSchedules/total |
| POST collection | create_accrual_schedule | Creation fields below | REST 201 schedule; MCP accrualSchedule |
| GET /{id} | get_accrual_schedule | UUID / scheduleId | REST schedule; MCP accrualSchedule |
| DELETE /{id} | cancel_accrual_schedule | UUID / scheduleId | REST success:true; MCP accrualSchedule |
| POST /{id}/post | post_accrual_entry | UUID / scheduleId; optional entryId/idempotencyKey | REST entry; MCP accrualEntry |

There is no PATCH or physical deletion operation. Every operation, including
reads and REST cancellation, requires manage:accruals; custom permissions take
precedence over legacy role. REST retains API-key/session auth and MCP uses
AuthContext supplied at server creation. All roots/links are organization scoped.
List status is active/completed/cancelled, page 1..1000000 default 1, limit 1..100
default 50. Invalid supplied pagination/status fails instead of coercing/clamping.

## Units, aliases and bounds

REST totalAmount remains positive numeric decimal major units, converted at fixed
two-decimal scale: 12.50 stores 1250 for USD/JPY/KWD/IRR. New totalAmountExact is
canonical positive ASCII decimal major text, at most 20 whole/18 fractional
digits. Numeric input uses its shortest decimal spelling (including scientific
notation); exact strings reject exponent, whitespace, grouping, localized digits
and leading zeros. Positive ties round up using bigint ratios. Major aliases
must agree before rounding.

MCP totalAmount remains positive integer CENTS; 1250 stores 1250, without *100.
MCP does not accept REST's totalAmountExact field. Both transports accept new
totalAmountMinor: a canonical positive signed-int64 string in the same fixed
cents, agreeing with rounded numeric/major aliases. At least one amount is
required. No rescaling based on currency, magnitude, locale or date occurs.

Stored totals/entries support safe integers through 9007199254740991. Valid
int64 aliases above that range fail classified 422 LEGACY_NUMERIC_RANGE before
mutation. Syntax/out-of-int64/unsafe numeric/conflict/negative/rounded-zero inputs
fail validation. Full-int64 workflows remain MON-007/008. Outputs retain numeric
totalAmount and add totalAmountMinor; every nested/posted entry retains numeric
amount and adds amountMinor. Counts, sortOrder, booleans, IDs, dates and timestamps
retain their units. No FX input or representation-negotiation header is added.

Required create fields: nonempty description (max 10000), Gregorian
startDate/endDate (YYYY-MM-DD, years 0001..9999), whole periods 1..1200, distinct
accountId/reverseAccountId UUIDs. Accounts must be live active org-owned GLs in
current base currency. Optional sourceEntryId references a live posted org
journal. Optional idempotencyKey is nonempty text, max 200 characters.

Allocation uses bigint floor(total/periods); LAST period absorbs the remainder.
Zero early periods remain allowed when periods exceeds cents. UTC month overflow
preserves legacy policy anchored to start: 2024-01-31 generates 2024-01-31,
2024-03-02, 2024-03-31. Dates are not month-end clamped. All generated dates must
fit endDate and supported years; endDate is an upper bound, not a guaranteed
final date. Creating a schedule does not modify locked ledger periods.

## Posting and saved history

Posting takes the first unposted period in sortOrder, creates a posted accrual
journal DR reverseAccountId / CR accountId, saves currencyCode=current base,
exchangeRate=1000000 and rateExact="1", and completes the final period.
Accrual tables have no currency snapshot. Creation/read preserve fixed cents for
all labels; posting requires a two-decimal current base and matching live
accounts. JPY/KWD/IRR posting rejects 422 rather than reinterpret cents. Currency
history/FX qualification remains separate; no existing history is converted.

Reads/mutations validate complete conserved allocation, UTC dates, state/order,
contiguous posted periods, distinct org-owned journals and exact balanced saved
legs. Orphan/duplicate/foreign/void/deleted journals, unsafe money and malformed
history fail visibly without mutation. Legacy identity-rate journals can have
null rateExact with exchangeRate=1000000. No history is repaired or rewritten.
Source journals are not returned; account joins never expand foreign data.

Posting checks permission-aware lockDate/advisorLockDate and closed fiscal years
inside the transaction. SHARE locks on period_lock/fiscal_year protect absent
rows against concurrent legacy period writers and can delay period edits.
Cancellation changes status only, preserving posted journals without requiring
a period override; completed schedules cannot cancel.

## Retry and atomicity contract

Create keys are org/action-scoped and normalize REST-major/MCP-cents aliases:
identical input replays the saved original response, changed input conflicts 409.
Post keys are org/schedule/action-scoped; successful retries return the original
period without advancing, changed entryId conflicts 409. Optional entryId instead
targets the expected next period: posted targets replay, foreign/missing targets
return 404 and future unposted targets return 409. Without either key or target,
each command deliberately advances one period. Empty REST post bodies remain
supported. Already-cancelled schedules replay without another audit.

Organization/schedule locks serialize creates/posts/cancels. Three bounded whole
transaction attempts handle serialization/deadlock and journal numbering unique
conflicts with legacy writers. Rows, periods, journals, legs, status, saved-output
checks and audit commit together; failures roll everything back. Audit JSON
stores normalized fingerprints/results using existing storage. Keyed replays
retain the original result/audit. New keys attached to already-posted targets
record one replay result without changing journals.

Invalid JSON/schema/dates/UUIDs/unknown fields return 400; auth/permissions
401/403; foreign roots 404; unsupported saved money/history/accounts/currency or
locked periods 422; retry/period conflicts 409. Legacy envelopes remain intact.
The dashboard sends exact major text with a stable create key and the visible
next period UUID when posting. Fixed-cent display and loaded-list sums use bigint
presentation, retaining English/USD labels.

No schema/migration, IRR/full-int64 enablement, deployment, screenshot or human
accounting approval is asserted. Historical remediation, performance and
MON-028 combined accrual/revenue/recurring qualification remain separate gates.
