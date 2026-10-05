# MON-084 review 1

2026-10-06, Asia/Tehran; reviewer coding-assistant, the implementing assistant.
Actual self-review, not peer/human financial approval. Reviewed current source,
diff, generated SQL/snapshot, wire registry and MON-084-attempt-1 results.

All 15 boundaries use scoped direct-Drizzle services and strict described schemas
with safe numeric/Minor coexistence. Reviewed required/nullable alias resolution,
merged band ranges, salary/currency guards, owned review/employee/band references,
scoped nested DTOs, immutable terminal/deleted records, exact aggregate preflight,
organization lock order and transactionally awaited audits. REST response envelopes
and MCP registration are covered by actual SDK transport fixtures. Foreign and
corrupt references fail without returning foreign employee data. Concurrent review
entries serialize and duplicate decisions reject; audit fault rolls back writes.

Forecast model changes are explicit: hourly estimates are consistent across
projection/what-if/budget, tax estimates use each employee's basis-point rate,
termination costs scale the retained monthly workforce before adjustments, and
all money intermediate operations use bigint with defined rounding. Input percent
precision/count/month/year constraints do not coerce those units into money.
Mixed-currency/unsupported forecasts fail visibly. Penetration/utilization remain
plain numeric percentages with exact two-decimal calculation. UTC first-day month
anchoring prevents end-of-month drift. UI exact decimal input/display and checked
server sums remove affected hardcoded cents and floating-point aggregation.

Migration 0011 only adds a nullable review currency column. Fixtures compare every
original review field, leave legacy snapshot null and rerun idempotently. All-money
historical checksums exclude only the new snapshot while asserting its null/default
preservation. New reviews preserve their currency after a base-setting change.
The documented legacy current-base bridge and incompatible history rejection remain
bounded limitations rather than silently fabricated historical currency/FX.

Initial development type errors and the invalid-token fixture were corrected.
The broad run passed 333/334 with no skips; the sole backup failure was missing
PostgreSQL clients on PATH. The actual dump/restore fixture passes after setting
PG_BIN to the matching installed clients. Every one of 334 distinct cases has
passing evidence across that run and focused rerun, not a claimed all-green full
rerun. Typecheck, lint (0 errors, 134 preexisting warnings), source inventory,
legacy-money guard and diff whitespace checks pass. No remaining slice finding
blocks its three acceptance criteria.

No build/dev server, browser/session/OAuth/network transport, independent financial
approval, production migration/deployment, full-int64 or multi-currency forecast
qualification is inferred. MON-085/025 retain their output/integrated acceptance;
IRR rollout flags remain unchanged. Approve this self-review, close controller,
perform the authorized commit/push, verify synchronized clean master and stop.
