# Revenue schedule and recognition contracts

2026-10-06, Asia/Tehran. MON-098; actual source, ADR-006 and migrated PostgreSQL
fixtures. Shared revenue-wire.ts/revenue-schedules.ts; registered MCP tools use
direct Drizzle transactions and existing AuthContext.

## Boundary map

| REST /api/v1/revenue-schedules | MCP | Input | Output |
|---|---|---|---|
| GET collection | list_revenue_schedules | Optional status/page/limit | REST data/pagination; MCP revenueSchedules/total |
| POST collection | create_revenue_schedule | Creation fields below | REST 201 schedule; MCP revenueSchedule |
| GET /{id} | get_revenue_schedule | UUID / scheduleId | REST schedule; MCP revenueSchedule |
| DELETE /{id} | cancel_revenue_schedule | UUID / scheduleId | REST success:true; MCP revenueSchedule |
| POST /{id}/recognize | recognize_revenue_entry | UUID / scheduleId; optional entryId/idempotencyKey | REST entry; MCP revenueEntry |

No PATCH or physical deletion operation exists. All five operations require
manage:revenue, including reads and the formerly unguarded REST cancellation.
Custom permissions take precedence over legacy role. REST retains API-key/session
auth; MCP uses server AuthContext. Roots, invoice, line and posting accounts are
organization scoped. Status is active/completed/cancelled; page 1..1000000 default
1; limit 1..100 default 50. Supplied invalid pagination/filter fields fail.

## Units, aliases and bounds

REST totalAmount remains positive numeric decimal major units with fixed cents:
12.50 stores 1250 for USD/JPY/KWD/IRR. New totalAmountExact is positive canonical
ASCII decimal major text, at most 20 whole/18 fractional digits. Numeric input
uses its shortest decimal spelling, including scientific notation. Exact text
rejects exponent, grouping, whitespace, localized digits and leading zeros.
Positive ties round up using bigint ratios. Major aliases agree before rounding.

MCP totalAmount remains positive integer CENTS, never multiplied by 100. MCP
does not accept REST totalAmountExact. Both transports accept totalAmountMinor,
a canonical positive signed-int64 cents string agreeing with rounded major or
numeric cents aliases. At least one amount is required. No currency, magnitude,
locale or date rescaling occurs.

Storage/business outputs retain safe numeric cents through 9007199254740991.
Valid int64 strings above that range fail 422 LEGACY_NUMERIC_RANGE before mutation.
Malformed/out-of-int64/conflicting/negative/unsafe numeric/rounded-zero amounts
fail validation. Schedule output adds totalAmountMinor and recognizedAmountMinor;
each nested or recognized entry adds amountMinor. Original numeric fields,
counts, sortOrder, IDs, booleans, date-only values and timestamps retain their
units. No negotiation header or FX input is introduced. Full-int64 qualification
remains MON-007/008.

Create requires invoiceId and valid Gregorian startDate/endDate, years 0001..9999,
end at or after start. Optional invoiceLineId must belong to that exact invoice.
Method defaults straight_line; milestone/on_completion retain existing monthly
allocation behavior as labels. Inclusive calendar months determine 1..1200
periods. Bigint floor(total/months) allocates early periods; LAST period absorbs
the remainder. Zero early periods remain supported. UTC month overflow preserves
the existing policy: Jan 31 through Feb 29 generates Jan 31 and Mar 2. endDate
selects the final calendar month, not an upper bound on overflow dates. No month-end
clamping is introduced; generated years must remain supported.

## References, posting and history

Creation permits a live draft invoice for preparation, rejects void/deleted
invoices, and requires live active posting accounts in invoice currency:
liability 2300 is debited; invoice line account or default revenue 4000 is credited.
Foreign/inactive/deleted/wrong-type/FX-mismatched accounts fail before insert;
a foreign line account never silently falls back to 4000. Resolved account UUIDs
are saved in existing deferredRevenueAccountId/revenueAccountId fields, protecting
new schedules from later invoice-line reassignment. Explicit saved UUIDs are
honored; legacy null references resolve through the scoped line/default lookup.
Invoice/account joins are validated but are not expanded in responses.

Recognition requires sent/partial/paid/overdue invoice, live active saved accounts,
invoice currency equal to current base currency and a two-decimal base currency.
It writes DR deferred / CR revenue with currencyCode=current base,
exchangeRate=1000000 and rateExact="1". Revenue has no transaction FX/currency
snapshot. Other currency conversion and non-two-decimal fixed-cents posting fail
422 explicitly; no new historical rate or currency policy is invented.

Reads and writes validate complete conserved allocations, exact dates/order,
contiguous recognized periods, safe money, recognizedAmount equal to bigint sum,
state consistency and distinct org-owned posted journals with exactly two balanced
legs and matching source/date/accounts/currency/identity FX. Orphan, duplicate,
foreign, deleted/void and malformed journals fail visibly without repair.
Legacy identity-rate legs may have null rateExact with exchangeRate=1000000.

Period/advisor locks and closed fiscal years are checked within the recognition
transaction. SHARE table locks protect absent rows against legacy lock/year
writers. Cancel changes status only and preserves recognized history; completed
schedules cannot cancel, and repeated cancellation produces no additional audit.

## Retries and atomicity

Optional idempotencyKey is nonempty text, max 200. Create keys are org/action
scoped and normalize REST-major/MCP-cents inputs; identical input replays the
original response, changed input conflicts 409. Recognition keys are
org/schedule/action scoped; identical commands replay without advancing, changed
entryId conflicts 409. entryId alone targets the expected next period: recognized
targets replay, foreign/missing targets fail 404, future periods fail 409.
Unkeyed/untargeted calls deliberately advance one period; empty REST bodies remain
supported. Target replay after completion/cancellation preserves history.

Organization/schedule row locks serialize writes. Three bounded whole-transaction
attempts cover serialization/deadlock and journal-number unique collisions with
legacy writers. Schedule, periods, journal, legs, recognizedAmount/status,
saved-output preflight and audit commit or roll back together. Existing audit
JSON stores retry keys/fingerprints/results; no new schema is needed.

Invalid JSON/schema/UUID/date/unknown fields return 400; auth/permissions 401/403;
foreign roots/input references 404; unsupported saved history/accounts/currency
and locked periods 422; retry/expected-period conflicts 409. Legacy envelopes
and registered names remain intact. Dashboard creation sends exact major text
with a stable retry key, recognition targets the visible next period UUID, and
fixed-cents presentation/loaded sums use bigint while retaining English/USD labels.

This slice preserves independent schedules and caller-selected totals: it does
not impose a new invoice-total cap, aggregate multi-schedule revenue policy or
retroactively establish original invoice deferral. Economic workflow/FX/history,
performance remain wider gates. MON-028 now qualifies combined technical
acceptance; see [combined contracts](CONSOLIDATION_AUXILIARY_INTEGRATION_CONTRACTS.md). No schema,
migration, IRR enablement, deployment or independent accounting approval is claimed.
