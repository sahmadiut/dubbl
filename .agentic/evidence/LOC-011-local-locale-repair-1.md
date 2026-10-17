# LOC-011 local runtime repair: apply existing locale expansion

2026-10-17 (Asia/Tehran), Codex. During the authorized LOC-011 task the user
reported a Next.js runtime failure in `loadPresentationPreferences`: selecting
`users.language`, `time_zone`, `numerals`, `calendar` failed. This is an additional
explicit user-reported issue handled before finishing the task/push.

## Confirmed cause

Used `pg` with the existing `DATABASE_URL` from `.env`, without printing or
persisting credentials. The configured database is the owner-authorized test
database under START_HERE/DEC-003. Read-only information_schema inspection found
none of the four user locale columns or `organization.default_language`.
The exact reported query reproduced PostgreSQL SQLSTATE `42703`, message
`column "language" does not exist`. This database also has no migration history
table. Did not infer that earlier migrations had run or synthesize migration
tracking for them.

## Applied repair and preservation

Applied the already-committed `drizzle/0013_shiny_harry_osborn.sql` verbatim
(statement-breakpoint comments stripped for one pg query) in a transaction:

1. BEGIN; local lock timeout 5 seconds and statement timeout 30 seconds.
2. Lock public.organization and public.users in ACCESS EXCLUSIVE mode for stable
   before/after preservation checks.
3. Snapshot row counts and deterministic hashes over existing JSON row fields,
   excluding only the five additive preference keys. Raw rows/hashes containing
   customer data or credentials are not stored in evidence.
4. Execute migration 0013: five nullable text columns, no defaults/rescaling or
   row updates. Require identical existing-data hashes and row counts.
5. Execute the reported user's locale query; check all new preference columns
   initialize to null. COMMIT only after all checks pass.

Actual result: committed; five users and five organizations preserved; existing
data hashes matched; reported user was found and the reported query passed.
Zero users/organizations had non-null new preference fields. A separate pg
connection after commit verified both the user preference SELECT and the
membership-scoped organization-language SELECT. Existing fallback precedence
therefore applies until users choose preferences.

No application source/schema definition/new migration was needed for this
repair. The existing migration file is unchanged. No application reset, seed,
`drizzle-kit push`, financial migration, currency change or historical migration
adoption was performed. The pre-existing absence of migration history was not
reconciled; broader legacy-schema adoption is not qualified by this repair.

## Verification limits

The direct PostgreSQL failure and repaired reads are verified. No dev server was
started/restarted, no full build was run, and no browser refresh or successful
page rendering of the user's active session is claimed. The user was told the
query succeeds and that they can refresh. Normal LOC-011 tests use rendering/pure
fixtures and do not mutate this database.
