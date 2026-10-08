# MON-032 attempt 1 - exact backup snapshot and restore contracts

## Identity and scope

2026-10-08, Codex, D:/Projects/dubbl, master. Clean entry at baseline
`b681a853051477e471a98aeabd011c92d0c950f4`. Controller selected MON-032;
no task or implementation was inferred from the older MON-107 memory handoff.
This evidence describes the reviewed working-tree implementation before commit.
Only this bounded child was implemented; MON-016 and QA-005 retain their gates.

## Implementation

- `lib/api/backup-wire.ts`: static catalog for the existing 21 entity arrays
  and seven document-line collections; version 1 compatibility and deliberate
  version 2 stored-unit Minor aliases. Strict schema/date/UUID/enum checks,
  duplicate and parent checks, exact-only siblings, nullable agreement, safe
  money/FX coexistence and raw JSON numeric token precision checks.
- `lib/api/backup-snapshot.ts`: shared direct-Drizzle snapshot/upload/download/
  manual-create/restore services. Builder uses repeatable read. Upload preflights
  organization, ID/reference ownership and exact ranges before metadata/S3.
  Original bytes and keys are never rewritten during conversion. Failed storage
  attempts have failed metadata. Manual creation shares capacity/retention/audit.
- Restore validates before the safety backup, locks affected/reference/dependent
  tables in sorted order, revalidates, restores all supported roots and document
  lines, reports actual counts and includes restore audit in its transaction.
  The old catch-and-ignore-FK behavior is removed. Unsupported current omitted
  dependent graphs and locked/closed periods reject before destructive work.
- REST upload/create/get/stored-download/restore routes use these services.
  Metadata ID/page checks now reject malformed requests visibly. Historical
  REST response envelopes, including the nested restoredCounts shape, are retained.
- `lib/mcp/tools/backups.ts`: all eight operations are registered through the
  existing backup registration. Added get/upload/stored-download/current-snapshot
  tools, enforced list authorization, documented units/input/output and shared
  capacity/retention/restore preflight. Tools use wrapTool and described fields.
- Fixed hourly rate-window SQL to bind an ISO UTC string, preventing raw Date
  parameter interpretation from shifting a timestamp-without-timezone comparison
  on a Tehran process. Verified both process timezones.
- Updated backup product documentation, BACKUP_WIRE_CONTRACTS, MONEY_MANIFEST
  and regenerated the existing source inventory. No schema/migration changed.

## Acceptance mapping

1. `../registries/BACKUP_WIRE_CONTRACTS.md` inventories every REST/MCP/job/storage
   boundary, entity money field, version, permission, unit, alias, range, response
   envelope and unsupported recovery cohort. Nonmoney counts/quantities/JSON
   and existing exact FX metadata retain their meanings.
2. `tests/integration/backups-worker.ts` exercises actual exported REST handlers
   with API-key memberships/custom roles and actual MCP SDK tools over
   InMemoryTransport. It covers version 1 numeric, version 2 dual and exact-only
   input, stored and current downloads, creation/list/get/delete/upload/restore,
   isolation/permissions, capacity/rate limits, original immutable text, scheduled
   maintenance and expired-object purge. S3Client command responses are synthetic;
   database queries/migrations/transactions, auth, REST and MCP are real.
3. Negative fixtures compare complete relevant table contents and object counts
   after invalid formats, mismatched aliases, unsafe ranges, foreign headers and
   references, wrong line parents, unknown/missing data, invalid dates/FX, denied
   roles, foreign/deleted backup IDs, corruption, locks and omitted allocations.
   Forced PostgreSQL trigger failures after soft deletion prove data and restore
   audit rollback for REST and MCP; the safety snapshot remains by design.

## Verification

All commands ran from D:/Projects/dubbl. Disposable PostgreSQL 18 cluster at
127.0.0.1:55532 with synthetic task_mon032 trust role, UTC server, and
max_locks_per_transaction=256. Every harness database used a random dubbl_ci name,
was migrated by the committed migration CLI and was dropped afterward. Final
database count was zero, and pg_ctl fast stop succeeded. No application data or
privileges were changed. No credentials were printed or persisted in repo.

| Command | Actual result |
|---|---|
| `node --import tsx --test tests/backup-wire.test.ts` | 2/2 pure groups passed; final format/null/token-precision checks passed with focused integration |
| `pnpm test` | 359/359 unit tests passed |
| `node --import tsx --test --test-concurrency=1 tests/integration/backups.test.ts tests/integration/journal-wire.test.ts tests/integration/invoice-writes.test.ts` | 3/3 integration groups passed |
| Final `node --import tsx --test tests/integration/backups.test.ts` | Passed, two fresh DB workers in UTC and Asia/Tehran, including scheduled maintenance/purge |
| Final `pnpm typecheck` | Exit 0, including final source, fixtures and MDX documentation |
| Final changed-file `pnpm exec eslint` | Exit 0, no errors or warnings |
| `pnpm lint` | Exit 0, 0 errors and 106 pre-existing warnings |
| `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | 415 columns, 1394 consumers, 26376 occurrences generated/verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 regression checks passed |
| `python .agentic/agent.py validate` | Valid, 173 tasks; structural check |
| `git diff --check` | Passed |
| `git fetch origin master` and `git rev-list --left-right --count HEAD...origin/master` before commit | 0/0; baseline synchronized |

Diagnostic history: the configured local role initially lacked CREATEDB, so the
fixtures moved to a separate synthetic cluster without changing its privileges.
Initial fixture definitions used the wrong journal monetary/FX fields and an FX
rate beyond the existing database compatibility guard; corrected to actual
schema fields and a losslessly supported rate. The timezone fixture exposed the
raw Date rate-window comparison and prompted the ISO binding fix. Initial
typecheck errors in generic schema narrowing were corrected. The final checks
above passed; those diagnostic attempts are not presented as successful runs.

## Self-review and limits

Codex self-review inspected the final diff, schema catalog, raw token validation,
nullable/exact-only handling, org/reference/line collisions, preflight ordering,
FK insertion order, coverage/period gates, table-lock revalidation, rollback,
original file preservation and source inventory. This is not an independent peer
or human security/accounting approval.

The guarded ORM range remains safe numeric coexistence, not full int64 consumer
cutover. The historical format is a bounded entity snapshot and omits auxiliary
ledgers and document file contents. Existing omitted dependent data prevents
destructive restore rather than being silently discarded. Table locks briefly
serialize concurrent writers across organizations. Storage/network availability
and Trigger scheduling were not tested against live providers. No full repository
integration suite, browser, build, dev server, production deployment/migration,
complete disaster-recovery rehearsal, IRR enablement or parent completion is claimed.

## Handoff

All three MON-032 criteria are supported. Submit, approve with this explicit
self-review identity, mark done, then commit/push only task-owned changes to
origin/master and verify remote SHA/clean tree. Stop after this task. MON-016
retains combined acceptance; QA-005 retains full recovery rehearsal. The next
task is selected by the controller after completion.
