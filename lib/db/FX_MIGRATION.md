# Exact FX expansion (MON-004)

Migration `0006_new_susan_delgado` adds `rate_exact`, format version 1,
`quote_per_base` direction, provenance and migration status to all four FX tables.
The existing integer millionths and payroll `real` columns, defaults, nullability,
IDs, currency tags, dates, amounts and balances remain intact. No configured
application database was migrated during implementation.

## Decimal policy

Positive rates have up to 20 whole digits and 18 fractional digits, from 10^-18
through 99999999999999999999.999999999999999999. Drizzle uses decimal strings;
`lib/currency/exact-rate.ts` validates and normalizes them without Number coercion.
This capacity covers synthetic USD/IRR 1500000 and a rounded reciprocal
0.000000666666666667. These are precision fixtures, not current market quotes.
Exact decimal input is never rounded. Repeating inverses/triangulation require an
explicit arithmetic rounding policy in MON-005; this task does not select one.

Storage uses unconstrained PostgreSQL numeric with a CHECK enforcing positive
values below 10^20 and equality with trunc(value,18). Unlike numeric(38,18), this
rejects nonzero excess fractional precision instead of rounding before checks.
NaN/infinities also fail the bound checks. See the
[PostgreSQL numeric documentation](https://www.postgresql.org/docs/16/datatype-numeric.html).
Trailing zeroes do not consume meaningful precision; the string adapter emits
canonical ASCII without exponent notation, signs, grouping or localized digits.

## Backfill and provenance

- Exchange, journal and consolidation rates use exact SQL
  `old_rate::numeric / 1000000::numeric`. Positive legacy values get status `exact`
  and provenance `legacy_scaled_1e6:<manual|api|derived|transaction>`. Provenance
  records the actual available legacy category; it invents no provider identity.
- Payroll is unscaled binary32. `fx_float4_exact` decodes its persisted IEEE bits
  using integer and numeric arithmetic. It does not use real-to-numeric or text
  casts that could conceal rounding. Values whose exact binary value fits the
  policy get `legacy_binary32_exact`. For example 1.25 is exact; stored 1.1 is
  1.10000002384185791015625 and exceeds the 18-place policy. That value keeps its
  legacy bits, a null exact field, status `legacy_float_requires_review` and
  `legacy_binary32_outside_policy` provenance. Never guess the intended decimal
  or original economic rate. Exact binary reconstruction is evidence of the
  stored value, not proof that the original user/provider input was exact.
- Historical null, zero, negative and nonfinite rates remain unchanged with
  null exact fields, `invalid_legacy` status and `legacy_invalid` provenance.
  Backfill quarantines them; it does not substitute 1:1 or repair posted history.

Direction means quote units per one base unit. Exchange table base/target/date
are already explicit. Journal rates accompany the document currency and posted
org-base amounts; consolidation rates use member currency into group presentation
currency; payroll uses employee/item currency into payroll base. Historical manual
journal interpretation and mutable parent currency settings still require
MON-005/007/008 qualification. No current currency setting is copied into a
supposed historical currency snapshot. Existing transaction rate fields are
backfilled independently of the exchange table and never refreshed from it.

## Coexistence safeguards and limits

BEFORE triggers maintain exact fields for all legacy inserts, updates and upserts,
including REST, MCP, jobs and raw SQL. They leave legacy fields unchanged. A
separate UPDATE OF guard rejects explicitly conflicting pairs even when the
supplied exact value equals the previous value. Unsupported format/direction,
new nonpositive/nonfinite rates and unrepresentable exact writes fail closed.
Derived provenance/status are recomputed, so callers cannot forge readiness.
An unrelated edit of a preexisting malformed row can preserve its quarantine.

The scaled legacy fields remain int32: rates above 2147.483647 or with more than
six decimal places cannot yet be used by those live consumers, even though the
new physical storage supports them. They are rejected, never written as a rounded
or null legacy substitute. The physical-capacity test disables triggers only in
its disposable fixture; production writers keep the guards. MCP manual numeric
input now rejects loss of precision before writes, using bigint for exact
millionths conversion. REST continues to accept integer millionths and now
rejects int32 overflow as a validation error. Existing rate numbers and MCP
`rateDecimal` remain numeric; `rateExact` and format/provenance/status are additive
metadata in returned rows. Agents must require `rateMigrationStatus === 'exact'`
before using `rateExact`. No new end-user operation is introduced.

Legacy payroll workflows can still persist finite positive binary32 rates whose
exact values require review; those rows explicitly lack an authoritative exact
rate. This preserves existing payroll behavior without fabricating precision.
Consumers, provider arithmetic, inverses, caches, reporting and full-range wire
contracts still require MON-005/006/007/008. Before consumer cutover, resolve the
quarantined cohort from documented original inputs or approved remediation.
Do not remove the guards or contract legacy fields as part of provider work.
Functional IRR remains disabled; no market/provider or production readiness
approval is implied.

## Maintenance and recovery

Use the existing transactional migration CLI and backup/restore procedure in
[MONEY_MIGRATION.md](MONEY_MIGRATION.md). The expansion takes ACCESS EXCLUSIVE locks
on four tables; the initial backfill updates rows and generates WAL/dead tuples.
Locks are held until commit. Five-second lock and 15-minute statement timeouts
bound the transaction; no online or production downtime claim is made. Rehearse
on a restored representative target, compare original-row checksums and ledger
invariants, inventory quarantines and accept disk/WAL/backup capacity before
deployment. Keep AUTO_MIGRATE disabled until that deployment is authorized.

The initial backfill runs bounded 500-row batches in the migration transaction.
An error rolls back both expansion/backfill and migration history; rerun the
migration after resolving the cause. Individual maintenance calls to the
invoker-rights `public.backfill_exact_fx(table, size)` commit independently and
process only pending rows, with validated table names, batch sizes 1..10000 and
FOR UPDATE SKIP LOCKED. No SECURITY DEFINER or cross-org lookup is used. The
maintenance role must already have permission to update the authorized tables;
this function is not a user-facing endpoint or MCP tool.

After expansion, use the explicit maintenance runner when pending rows remain:

```text
DATABASE_URL=<authorized target> FX_BACKFILL_BATCH_SIZE=500 node --import tsx scripts/backfill-fx.ts
```

Supply credentials through the environment, not committed commands. The runner
does not implicitly load .env. Each call commits a batch, so interrupted runs
resume without touching completed rows. Lock/statement timeouts are 5/60 seconds.
Exit 0 means no pending rows, 2 means locked/pending work remains, 1 means an
operation failed. It reports counts only; no row data or credentials. Rerun after
locks clear. Resolve quarantine separately; never automatically reclassify or
rescale history. Concurrent legacy writes are covered by triggers and row locks.

## Verification

Unit tests cover extreme strings, precision rejection, exact legacy bridges,
four Drizzle adapters/checks, shared REST/MCP validation and MCP role denial.
Integration tests cover clean install, upgrade from committed 0005, every legacy
FX table with two tenants, unchanged full legacy rows/payroll bits, malformed
history, ORM/raw/upsert sync, historical independence, unsafe writes, physical
20/18 storage bounds, committed-batch restart, locked-row reporting/idempotency,
and expansion lock-failure rollback/retry. Earlier migration/backup tests still
run. These are synthetic storage/compatibility fixtures; complete business and
production migration qualification belongs to MON-010 and QA-005.
