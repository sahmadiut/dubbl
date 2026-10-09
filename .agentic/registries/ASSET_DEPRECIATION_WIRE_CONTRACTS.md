# Asset depreciation contracts (MON-087)

2026-10-06, Asia/Tehran. Actual source, ADR-006 and migrated PostgreSQL fixtures;
bounded adoption under MON-026. No production, statutory, full-int64 or IRR claim.

## Operations

All three pairs call `lib/api/asset-depreciation.ts` directly through Drizzle and
AuthContext. Each requires `manage:assets`; REST resolves real API/session auth,
MCP uses the server's context and wrapTool. API-key organization scope wins over a
contradictory organization header. No self-HTTP calls or negotiation headers.

| POST /api/v1/fixed-assets path | MCP tool | Result |
|---|---|---|
| /{id}/depreciate | run_asset_depreciation | depreciationEntry, journalEntryId, asset totals |
| /run-depreciation | run_assets_depreciation (additive) | message, processed, skipped, results |
| /{id}/rollback-depreciation | rollback_asset_depreciation | asset totals, rolledBack, reversedAmount/Minor, reversedDepreciationEntryId, journalEntryId, voidedJournalEntryId |

Existing REST/MCP names and numeric fields remain. Batch MCP parity is new.
REST single adds the previously MCP-only posting date and journalEntryId.
Rollback envelopes now contain the union of their previous fields. Rollback posts
a linked reversal instead of voiding history; `voidedJournalEntryId` is now null.
Both original and reversal journals stay posted, with opposite original lines.

## Inputs, units and ranges

JSON objects are strict. Empty REST POST bodies mean `{}` for legacy buttons;
malformed/non-object JSON and unknown fields reject. IDs are UUIDs. Monetary
amounts are computed from saved asset masters; these actions accept no amount
override, currency override or Minor input. Legacy/exact clients create masters
using the MON-086 numeric/Minor cost and residual fields, then call these actions.

Amounts retain the fixed integer-cents contract, 0..9007199254740991. Computation
uses bigint intermediates, exact positive ratios and ties rounding upward; ORM
and legacy output remain safe Numbers. Every returned amount has its explicit
canonical Minor string: depreciationEntry.amount, results[].amount,
rolledBack.amount, reversedAmount, asset.accumulatedDepreciation/netBookValue.
Nullable journal IDs stay null; counts, dates and physical units get no aliases.
No stringification of an already-rounded Number or magnitude-dependent units.

`date` is a real Gregorian YYYY-MM-DD, default current UTC date. Single accepts
optional `unitsThisPeriod`, a physical integer 0..2147483647. Usage-based methods
require positive usage and positive saved expected units; time-based methods
reject supplied usage. No monetary alias on units. Batch accepts no readings and
skips usage-driven assets. Life is saved int32 months, minimum one.

Optional `idempotencyKey` is 1..128 ASCII letters/digits/_.:-. Same operation,
organization and asset scope plus key must retain date/usage/expected-entry
inputs; changed input returns 409. Omitted dates remain omitted in fingerprints,
so keyed retries across UTC days replay the committed response.

## Calculations and timing

Straight-line divides cost less residual by life. Double-declining divides twice
current cost less accumulated by life. Monthly sum-of-years-digits uses weight
life minus prior row count and denominator life*(life+1)/2. Usage divides
depreciable base times reading by expected units. Every charge caps at remaining
base. Time-based periodIndex is actual existing depreciation-row count.

Full-month takes the whole installment. Mid-month takes half of the opening
installment. Half-year and mid-quarter retain the previous monthly half-opening
approximation; they are not statutory yearly/quarterly schedules. Pro-rata-days
uses inclusive days remaining in the service month, including leap years.
Terminal time-based periods consume all remaining base, avoiding stranded
half-year residuals. Full-at-purchase now expenses the entire remaining base.
Usage calculations ignore timing conventions. Service date anchors calculations;
posting before service or backdating before existing history rejects. No missing
months or synthetic catch-up schedule are invented. Zero rounded/exhausted
charges fail single requests without mutation and are skipped by batch; this
contract does not advance zero-charge periods for very small assets/long lives.

Revalued assets or inconsistent saved cost/NBV/accumulated totals fail with 422;
the existing revaluation writer changes NBV without resetting the original cost
base. MON-088 must establish the carrying-base/history policy before those assets
can safely resume depreciation. No revaluation history is rewritten here.

## Retry, locking and rollback

One charge per asset/calendar month across single REST/MCP and batch. Existing
legacy date rows also count. Same month/usage returns the saved entry and current
asset totals without another charge; changed reading conflicts. Fully depreciated
assets can replay an existing monthly entry. Batch only selects active live
organization assets, skipping CWIP/future-service/exhausted/already-booked assets.
Optional batch keys replay the original results; unkeyed reruns may include new
assets but never duplicate existing monthly rows.

Undo accepts optional expected `depreciationEntryId`, which must be the latest
row ordered by date, creation instant, UUID. Default undo selects latest.
Rollback keys default to that explicit expected entry, or (for legacy omission)
asset/current posting day. A replay cannot silently remove the previous period.
For cross-day legacy retries or repeated separate undo/rebook operations in one
day, use explicit target/key. The detail UI sends the displayed latest entry ID.
Successful undo removes only the schedule row, restores exact totals and retains
original/reversal GL and immutable audit. Subsequent posting can rebook that month.

Organization locks precede asset locks, covering masters and all asset lifecycle
writers. Still-legacy disposal/valuation/CWIP writers now verify their preflight
snapshot under these locks and reject stale state with 409. Their separate amount,
audit and lifecycle contract work remains MON-088/089. Depreciation holds SHARE
table locks on period_lock/fiscal_year during its transaction, including absence
of rows, because legacy period writers do not share the organization protocol.
This can delay period changes in other organizations; large batches/performance
need parent qualification. Existing advisor lock tier and closed-year rules are
checked through the same transaction. Undo checks original depreciation date,
original GL date and reversal date, so deleting the schedule never alters a locked
period. Already committed retry replay changes no accounting state.

Posting requires both live active owned GL accounts or neither; partial,
foreign/inactive/deleted, wrong-base-currency or identical accounts fail. Neither retains the existing
non-GL tracking behavior. Reversals use original scoped GL lines and account IDs,
even if historical owned accounts are now inactive/deleted. Original journal must
be posted, unreversed, sourced to this asset, balanced and match the saved charge.
Foreign saved journals and unsupported saved history/money fail before writes.
New GL lines stamp the organization base currency and an exact 1:1 rate with
provenance. A new charge rejects when this asset's prior depreciation GL lines
use another currency, including rolled-back original journals. Undo preserves all
original exact-rate/provenance/version/status fields and scoped cost-center and
project dimensions; it does not reprice them when the organization base changes.
The existing FX sync trigger derives `legacy_scaled_1e6:transaction` provenance.
Returned reversal lines are compared to saved exact snapshots inside the
transaction; a snapshot that this consumer cannot preserve fails 422 and rolls
back. Legacy lines with no authoritative exact snapshot retain their numeric
rate and gain the trigger's lossless derived exact representation on the new
reversal only. Original lines are never updated.

All charge/batch/undo journals, schedule, totals, response preflight and awaited
audit commit together. Audit JSON stores scoped retry fingerprint/result; no new
schema/migration. Unsupported saved amounts return classified 422; validation is
400, auth 401/403, absent/foreign asset 404, retry/history conflict 409, locked or
unsupported economic history 422. Injected DB faults return 500 and roll back.
Asset masters still have implicit organization base currency, without saved
currency/FX snapshots. MON-026 now prevents public functional-currency changes
with any asset/category/loan history, including unposted and soft-deleted roots;
see [combined contracts](ASSET_LOAN_INTEGRATION_CONTRACTS.md). Legacy direct edits
and historical remediation remain unqualified.
Full-int64 business support, historical currency changes, browser
session/OAuth, large-batch performance and independent accounting review remain
MON-026 and release qualification, not enabled by tracker completion.
