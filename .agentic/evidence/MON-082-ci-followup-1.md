# MON-082 CI checksum follow-up 1

2026-10-05; coding-assistant, self-reviewed corrective follow-up to the owner's failed-CI report. Starting commit 3d76a25; no completed-task evidence/status was rewritten and no next task was started.

## Observed failure

GitHub run [37338002204](https://github.com/sahmadiut/dubbl/actions/runs/37338002204), commit 3d76a25, failed PostgreSQL Migration Fixtures: 69/72 integration tests passed. All three failures were money-bigint.test.ts historical checksums for payroll_run and payroll_item_deduction. The runner's full suite caught a fixture omitted from the previous targeted local selection. Payroll run/lifecycle and payroll legacy migration tests passed on hosted PostgreSQL 16; lint, typecheck, unit tests and controller also passed. Build/Docker/deployment migration jobs were skipped due to the failed prerequisite.

The historical checksum excludes nullable columns from earlier expansion migrations but did not exclude the five new 0009 payroll snapshot fields. PostgreSQL to_jsonb includes those new null keys, changing row hashes despite preserving all original data.

## Correction

Updated tests/integration/money-bigint.test.ts to exclude exactly the five new snapshot keys from historical comparisons. Every original column, table row count and monetary total remains compared. Added independent assertions that all five columns exist, are nullable with no default, and remain unpopulated on historical fixture rows after upgrading. Existing restore, lock rollback, int32/int64 and type assertions remain intact. Refreshed MONEY_BOUNDARIES source hash/line inventory. No runtime, schema, migration SQL or CI gating change; no assertions were removed.

## Actual checks before corrective push

- Temporary PostgreSQL 18 loopback cluster: node --import tsx --test tests/integration/money-bigint.test.ts, TEST_DATABASE_URL explicitly supplied and PG_BIN set to matching local clients: exit 0, all 4 tests passed, including the 3 failing hosted cases and backup/restore.
- pnpm typecheck: exit 0; pnpm exec eslint tests/integration/money-bigint.test.ts: exit 0, no warnings.
- python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: exit 0; 413 schema columns, 1264 consumer hashes, 25113 occurrences.
- git diff --check: exit 0.

A new hosted run will validate the full suite after pushing this correction; success is not claimed here before it runs. No local build/dev server, manual workflow dispatch or production database action was performed. The existing push-triggered workflow is unchanged. Original MON-082 evidence remains an immutable account of its actual checks; this separate follow-up records the omitted fixture and fix.
