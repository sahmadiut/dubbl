# MON-003 attempt 1 — bigint monetary storage expansion

## Identity

2026-10-02, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`cd124c7b80d9e89b8a2eec2fe24c3d36b7c6778c`. Clean working tree at entry;
implementation and evidence were uncommitted during verification. One task only.
No independent reviewer, human financial approval or production qualification.

## Implementation

- Replaced 194 monetary integer declarations and the method-dependent landed-cost
  basis with `moneyInteger()` across 22 schema files. All 207 other inventoried
  numeric/JSON columns retain their types. The immutable historical evidence was
  not rewritten; current inventory registries were refreshed.
- `lib/db/money-column.ts` declares SQL bigint with guarded number reads/writes.
  Legacy USD 1250, IRR 123456789 and safe minor-unit integers remain numbers without
  scaling. Invalid/fractional/nonfinite/unsafe values fail closed. Full int64 SQL
  storage is available, but application reads above the safe-number range throw.
- Ran `npx drizzle-kit generate`. Generated migration/journal/snapshot are
  committed artifacts in the working change; no Git commit was created. SQL was
  regrouped into 88 ALTER TABLE statements with 195 identity casts, avoiding
  repeated table rewrites. Unchanged generator default resets were omitted.
  Five-second lock timeout and 15-minute per-statement timeout operate inside the
  existing transactional Drizzle runner. A second generation found no drift.
- `MONEY_BIGINT_MIGRATION.json` explicitly lists before/after types/dispositions
  for all 402 manifest columns. The inventory scanner recognizes the custom
  builder as bigint; independent exported Drizzle metadata still matches.
- Extracted shared isolated DB helpers into `tests/integration/fixtures.ts`.
  Historical ledger snapshots cast amount values to text to compare exact values
  across PostgreSQL int4/int8 driver representations. Existing financial balance
  assertions remain intact.
- Added three unit groups and four additional integration workflows. Synthetic
  rows populate every affected real table, including required foreign keys. They
  validate physical preservation; these are not business-valid payroll/document
  workflow qualifications. Every affected column also stores 2147483648 in the
  clean-install fixture.
- `lib/db/MONEY_MIGRATION.md` covers compatibility, locks, disk assessment,
  backup/restore rehearsal, migration/retry and post-commit recovery. The CI
  runbook records PostgreSQL client prerequisites and optional PG_BIN.
- No new user-facing operation, REST/MCP contract, monetary unit, runtime feature
  flag or currency policy. Corresponding API/MCP consumer work remains assigned
  to MON-006/007/008. No migration applied to the configured application DB.

## Acceptance mapping

1. Every manifest column: complete 402-column before/after registry, exported
   Drizzle metadata unit assertions, SQL exact-column-set test and information
   schema checks. Exactly 195 columns widen; all exclusions retain their types.
2. Clean installation and previous checkpoint upgrades: eight integration cases
   pass on PostgreSQL 18.6, including clean migration, tracked 0003 and immediately
   previous 0004 upgrades, untracked 0000 adoption and backup restore/independent
   upgrade. 0004 is the previous committed schema checkpoint, not a claimed
   tagged public release. Reruns preserve migration history and values.
3. Counts/nullability/checksums: every one of the 88 affected tables has a seeded
   row; full-row ordered MD5 checksums/counts, each money column's nonnull count
   and exact SQL sum, and every public column's default/nullability are identical
   before/after. Mixed persisted fixtures include int32 min/max, zero, negatives,
   USD 1250, IRR-scale 123456789 and nullable money. Existing three-organization
   ledger fixtures preserve balances, FX, dates, locks and tenant identities.

## Verification

All commands ran from `D:/Projects/dubbl`; no build, application dev server,
Docker operation, deployment or production mutation was run.

| Command/procedure | Actual result | Context/limits |
|---|---|---|
| `python .agentic/agent.py validate/status/context` | Exit 0; MON-003 selected and started | Structural tracker checks only |
| `npx drizzle-kit generate` | Exit 0; generated 0005; final repeat reports no schema changes | Grouped SQL reviewed against generated column set |
| `npm test` | Exit 0; final 61/61 pass | Three new money-column groups; existing money/FX tests retained |
| `npm run test:integration` | Exit 0; final 8/8 pass | Explicit isolated PostgreSQL 18.6 server, synthetic dubbl_ci role; PG_BIN points to installed matching clients |
| `npx tsc --noEmit` | Exit 0 final | Ignored generated-type repair described below |
| `npm run lint` | Exit 0; final 0 errors, 167 existing warnings | Interim extra unused payments integer import removed; no added warning remains |
| `npx eslint lib/db/money-column.ts lib/db/schema tests/money-column.test.ts tests/integration --quiet` | Exit 0 | Affected surfaces; full lint also run |
| `python .agentic/scripts/money_inventory.py --write`, then without `--write` | Exit 0 each | 402 columns, 1,293 files, 1,078 consumers, 20,687 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | Actual Drizzle exports, source hashes and line references matched |
| `git diff --check` | Exit 0 | Git CRLF conversion notices only |
| Read-only configured local DB size assessment | Query succeeded | PostgreSQL 18.6; database 18,167,487 bytes; 88 affected tables/indexes total 2,170,880 bytes, 142 estimated rows, largest 65,536 bytes; no data printed or modified |
| Fixture database cleanup query, then `pg_ctl -m fast -w stop` | 0 remaining dubbl_ci_* databases; stop exit 0 | Dedicated temporary cluster, localhost:55439; configured DB never reset/migrated |

Initial execution against the authorized local .env target failed with CREATEDB
permission denied before database creation. No permissions were broadened. Used
the existing runbook's separate-cluster approach: installed PostgreSQL 18.6
`initdb`/`pg_ctl`, temporary directory
`C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon003-pg-26c7d3e82748491da91f113f91332bac`,
trust auth restricted to 127.0.0.1:55439. URL/role were synthetic and password-free.
The tests create/drop only randomized fixture databases and temporary backups.

An intermediate typecheck found duplicated tails in ignored
`.next/dev/types/routes.d.ts` and `validator.ts`. Preserved originals in
`C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon003-next-types-o95_l7ni`, removed only
trailing duplicated content after complete declarations, then reran typecheck
successfully. No tracked Next configuration change or server startup.

## Runtime and recovery observations

Final populated 0004 migration rehearsal: 195 columns/88 tables, 1,997 ms including
CLI startup, database 18,405,055 -> 19,322,559 bytes. Initial rehearsal: 1,607 ms,
18,396,863 -> 19,322,559 bytes. Tiny fixtures and PostgreSQL 18.6 cannot establish
production downtime or PostgreSQL 16 behavior. Locks persist until transaction
commit; measured elapsed time is not a separate lock-duration measurement.

Holding ACCESS SHARE on journal_line caused the five-second lock timeout after
the preceding organization rewrite. Exit 1 included the real PostgreSQL lock
timeout. All 402 types stayed at the previous checkpoint, five migration-history
entries remained, and every affected checksum was unchanged. Releasing the lock
and retrying succeeded. Existing forced-SQL-failure rollback also still passes.

Exact SQL journal storage roundtrips int64 min/max; both overflow directions fail
with 22003. Current ORM reads 2147483648 and MAX_SAFE_INTEGER exactly and rejects
int64 extremes outside the number range. Unit metadata tests verify this guard
for every widened column. Actual pre-expansion pg_dump/pg_restore recreates the
previous schema with identical row checksums, then independently upgrades with
the same invariants. No backup of real customer/production data was taken.

## Review and handoff

Self-review in `MON-003-review-1.md`. No unresolved MON-003 blocker. Leave
configured/local and production migrations for explicitly authorized execution.
Next task is MON-004: exact decimal FX storage and backfill. Full-range domain and
wire adoption, raw SQL/report precision and financial release checks remain later
tasks; functional IRR stays gated.
