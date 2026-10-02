# ADR-004: exact FX format and coexistence

2026-10-02, Asia/Tehran. MON-004 technical storage decision by coding-assistant;
self-reviewed implementation, not human accounting or deployment approval.

Use positive exact decimal strings with 20 whole/18 fractional digits and
`quote_per_base` direction. This follows the source plan's numeric(38,18)-sized
proposal, but uses unconstrained numeric plus rejection checks to prevent typmod
rounding. Synthetic 1500000 and 0.000000666666666667 fit; repeating inverse
rounding policy remains explicit MON-005 work. Format version 1 is storage
metadata, not a public wire-version switch. No current exchange-rate assertion.

Expand all four actual fields, retaining old values/types/defaults/nullability.
Backfill integer millionths by SQL division and payroll by exact IEEE-bit
reconstruction. Quarantine invalid history and binary32 values outside the policy
instead of guessing intended decimals. Stored-value exactness does not establish
correct original inputs, currency direction or posted economic interpretation.

Coexistence triggers derive metadata, synchronize legacy writes and reject unsafe
exact pairs. Explicit conflicting updates are detected even if the exact field
is unchanged. Scaled consumers stay limited to positive int32 millionths until
MON-005/006/007/008 qualify cutover. Payroll compatibility may retain flagged
binary32 values without an authoritative exact rate. No contraction or IRR
enablement. Preserve existing role/org checks; maintenance runs use invoker
permissions and explicit authorized targets.

The initial backfill is transactional; independently committed maintenance
batches can resume, report locked pending work and remain idempotent. Deployment
requires backup/restore and representative lock/WAL/disk rehearsal under the
existing authorization policy. See [FX runbook](../../lib/db/FX_MIGRATION.md),
[source design](../sources/SOURCE.md#money-and-database-architecture) and
[source migration](../sources/SOURCE.md#database-and-currency-migration).
