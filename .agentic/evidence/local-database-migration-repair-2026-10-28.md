# Local database migration-history repair - 2026-10-28

Operator: Codex, owner-directed repair of the configured local application
database in D:/Projects/a/dubbl. No application feature/controller task was opened.

## Failure and inspected state

The AI settings page could not query its missing provider/configuration/policy
tables. The owner's migration attempt adopted 0000 but failed at 0001 because
tax_rate_kind already existed. The database had 201 public tables and only the
baseline migration recorded.

A fresh isolated PostgreSQL18 reference database was migrated through 0014.
Compared with the app database, all 2328 columns (including types, nullability,
defaults), 2239 constraints, 253 indexes and 108 enum types matched exactly.
Six committed functions and nine triggers were absent. This was a schema-pushed
checkpoint without the complete migration history or SQL-only objects, rather
than a baseline-only database. Merely skipping the duplicate enum would not fix it.

## Backup, rehearsal and repair

- Created a PostgreSQL custom-format backup (668047 bytes) at
  C:/Users/Sajjad/AppData/Local/Temp/dubbl-migration-backup-0vNAJU/before-repair.dump.
  This private backup contains application data and remains outside Git.
- Restored that backup into an isolated disposable database on loopback55490.
- Reconstructed the missing six function/nine trigger definitions from the
  successfully migrated reference database. Seeded six missing baseline currency
  metadata rows using the committed 0012 seed, with conflict protection.
- Recorded 0001..0014 with SHA256 hashes of their actual committed SQL, only after
  structural equivalence checks; baseline timestamp/hash were verified too.
  Object restoration, seeding and history reconciliation used one transaction.
- Applied committed migrations0015..0020 normally through Drizzle. Repeated the
  migration to check idempotency. Rehearsal passed before changing the source.
- Repeated the verified repair on the configured app database. Per-row hashes
  over every pre-existing column verified all 1521 original records across all201
  tables were preserved. Only the intended six currency metadata rows were added
  to existing tables; no amounts, FX snapshots or historical rows were rewritten.
- Final source catalog matched the successful clone, including restored functions
  and triggers. All21 journal entries are present; the database has213 public
  tables, including all12 AI tables.
- The owner's exact command was rerun successfully:
  `node --env-file=.env.local --import tsx scripts/db-migrate.ts`
  Output: `Migrations applied.` No duplicate-object error.

The temporary repair helper was removed after use. Reference/clone databases
were dropped (zero leftovers verified), and the isolated cluster was stopped.
No environment secrets were printed/changed, no full build/dev server was run,
and no application/Stripe source file was modified. The app server had been
stopped by the owner; rendered UI/authenticated browser verification was not run.
Restart the normal app and reload AI settings to exercise the repaired database.
