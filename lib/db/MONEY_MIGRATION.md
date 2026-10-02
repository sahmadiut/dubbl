# Bigint monetary storage expansion (MON-003)

Migration `0005_clear_senator_kelly` widens 194 monetary columns and the
method-dependent landed-cost allocation basis, across 88 tables. The complete
402-column before/after disposition is in
`.agentic/registries/MONEY_BIGINT_MIGRATION.json`. Quantities, percentages, counts,
FX and JSON envelopes retain their existing storage and units. USD 1250 remains
1250; existing IRR is never rescaled or inferred from magnitude.

Drizzle generation produced the migration and snapshot. The SQL was grouped into
one `ALTER TABLE` per table, with explicit identity casts, to avoid repeated table
rewrites. Generator-only default resets were omitted because the defaults are
unchanged; PostgreSQL integration checks compare every default and nullability
before and after. Running `npx drizzle-kit generate` again reports no drift.

## Compatibility boundary

`moneyInteger()` uses PostgreSQL bigint and a temporary safe-number adapter.
Legacy Drizzle reads/writes keep number types and numeric JSON for exact integers
within +/-9007199254740991. Reads beyond that range and fractional, nonfinite or
unsafe writes throw instead of rounding. SQL expressions deliberately remain
available to Drizzle, so this guard does not qualify raw SQL, aggregates, reports
or all application arithmetic. MON-006/007/008 own those consumers and full-range
string/bigint contracts. This expansion supplies no new feature or REST/MCP
operation and changes no rollout flag. Functional IRR stays gated.

## Locks, storage and deployment procedure

Integer-to-bigint changes rewrite affected tables and can rebuild their indexes.
`ACCESS EXCLUSIVE` locks block reads and writes and remain held until the
migration transaction commits. This is a maintenance-window migration, not an
online zero-downtime promise. SQL sets a five-second lock timeout and a
15-minute timeout per statement. Run through `scripts/db-migrate.ts` so failure
rolls back the pending migrations and history together. Do not execute the SQL
statement-by-statement outside a transaction. Do not use `drizzle-kit push`.

Before applying to a deployment target:

1. Disable concurrent application/job writes for the maintenance window. Keep
   deployment `AUTO_MIGRATE` disabled until the rehearsal and backup are accepted.
2. Inventory target table/index sizes with `pg_total_relation_size`, database
   size with `pg_database_size`, available disk, long transactions and active
   locks. An amount grows from four to eight bytes before alignment; allow space
   for rewritten heaps/indexes, WAL and the retained backup. Measure on a restored
   representative copy; small-fixture timing is insufficient for a large DB.
3. Create a uniquely named full `pg_dump --format=custom` backup using the
   approved target and secure client credential configuration. Keep original
   backups intact and outside Git. Restore into a separate database with
   `pg_restore --exit-on-error`, using a matching client/server version and the
   deployment's ownership/role policy. Compare row counts, full-row checksums,
   per-column null counts/sums, balances, dates, currency tags and org IDs.
4. Apply committed migrations to that restored copy, compare the same invariants
   and record duration/disk growth. Rehearse lock-timeout failure and retry. If the
   window or disk budget is insufficient, use a separately reviewed staged-copy
   migration instead of increasing timeouts without a new assessment.
5. Run the authorized deployment migration, verify the invariants and migration
   history, then resume writes. A failed transaction may be retried after the
   blocker is resolved. Never narrow back to integer after larger amounts have
   been written. Recovery after commit uses the verified backup/PITR plan and
   accounts for subsequent writes; it is not a destructive down migration.

The local configured test DB was assessed read-only: 88 affected tables,
2,170,880 total table/index bytes, 142 estimated rows and an 18,167,487-byte
database. These are local estimates, not production capacity. It was not migrated.

## Verification

`npm test` covers the adapter, every inventoried Drizzle type and the SQL's exact
column set. `npm run test:integration` requires an explicit local
`TEST_DATABASE_URL` with CREATEDB and matching `pg_dump`/`pg_restore` clients on
PATH, or the optional `PG_BIN` directory. It creates/drops only randomized fixture
databases; it never migrates the connection target. Fixtures cover clean install,
tracked 0003 and 0004 upgrades, untracked baseline adoption, every money table's
populated checksum, defaults/nullability, int32/int64 bounds, safe ORM reads,
idempotency, lock timeout rollback/retry, and backup restoration followed by an
independent upgrade. Rows are synthetic physical-preservation fixtures, not
qualification of payroll, procurement or report business behavior.

The populated 0004 rehearsal on PostgreSQL 18.6 took 1,997 ms including CLI
startup, and the database grew from 18,405,055 to 19,322,559 bytes. Locks are held
for the transaction; this elapsed measurement is not an individual lock-duration
measurement. PostgreSQL 16 execution remains the CI job's responsibility.
