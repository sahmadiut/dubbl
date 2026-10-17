# LOC-001 attempt 2: historical migration fixture CI repair

## Identity and observed failure

2026-10-17 (Asia/Tehran), coding-assistant. Clean entry at `95d7b569` on master.
The owner reported failed GitHub CI. Inspected
[run 38986399527](https://github.com/sahmadiut/dubbl/actions/runs/38986399527)
using `gh -R sahmadiut/dubbl`: Typecheck, Lint, Test and Task Controller passed;
PostgreSQL Migration Fixtures failed with 178/181 tests passing. Build/Docker
were skipped by their dependency gates, not tested successfully.

All three failures were in `tests/integration/money-bigint.test.ts`: upgrade,
lock-timeout/retry, and backup/restore upgrade. Only the organization whole-row
checksum differed: migration 0013 adds nullable `default_language`, and the
historical-row JSON oracle included the new key in its post-upgrade hash.
The implementation attempt had run locale/organization fixtures but missed this
broader migration regression. No historical/financial value change was observed.

Reopened LOC-001 with the controller and started it for this bounded repair.
Prior completed attempt/review evidence remains unchanged.

## Correction and review

- Extended the fixture's existing explicit nullable-addition map from payroll
  snapshots to include organization/user locale columns. Original organization
  fields are still hashed; no financial column or expected amount was removed.
- The existing metadata assertion now also checks the five new locale columns
  exist, remain nullable, have no database default and remain unpopulated on
  historical rows. The organization addition is excluded only from the comparison
  of original row contents, matching the existing additive-snapshot policy.
- Added rolled-back negative mutations: setting organization.default_language
  causes the null-preservation assertion to reject; rewriting organization.name
  still changes the historical checksum. The complete pre-mutation snapshot is
  rechecked after rollback.
- Regenerated the money inventory's single affected fixture hash/line references.
  No application source, REST/MCP operation, schema, migration SQL or workflow was
  changed by this repair.

## Acceptance mapping

1. Existing URL/auth/English compatibility remains as in immutable attempt 1.
   The failed hosted run's unit/type/lint/controller jobs passed, and this attempt
   changes only the migration fixture and source-inventory metadata.
2. Preference precedence/invalid-value coverage remains unchanged. The locale
   REST/MCP/request/SQL fixture passes again alongside migration regression tests.
3. Shared server/client locale configuration and independent timezone behavior
   are unchanged. This attempt additionally verifies historical user/org locale
   preferences stay null after migration instead of being populated implicitly.

## Verification

All local commands ran in D:/Projects/dubbl. Disposable PostgreSQL 18 was created
in a unique temporary directory and bound to loopback port 55477. Explicit
TEST_DATABASE_URL targets that server; fixtures create/drop random databases.
PG_BIN selects its matching pg_dump/pg_restore binaries. No application database
was migrated, reset or used for fixture mutations.

| Command | Actual result |
|---|---|
| `gh run view 38986399527 --repo sahmadiut/dubbl --json jobs` and `--log-failed` | Confirmed the three organization checksum mismatches in the PostgreSQL job |
| `node --import tsx --test tests/integration/money-bigint.test.ts` before repair | Exit 1; reproduced exactly 3 failures, 1 pass |
| `node --import tsx --test tests/integration/money-bigint.test.ts tests/integration/money-migration-qualification.test.ts tests/integration/locale-preferences.test.ts` after repair | Exit 0; 7 passed, zero failed/skipped, including 195-column/88-table preservation, bounds, rollback/retry, backup/restore and corruption detection |
| `pnpm exec eslint tests/integration/money-bigint.test.ts` | Exit 0, no warnings/errors |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; schema classification unchanged |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 417 columns and 1599 consumer hashes/line references verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` before final disposition | Exit 0; 218 valid tasks |
| `git diff --check` | Exit 0 |
| Pre-commit fetch/divergence check | Exit 0; HEAD and origin/master initially equal |

Full local build/dev/Docker were not run under repository instructions. The
complete local integration suite was not duplicated; the replacement hosted run
will execute it after the scoped push. This record does not claim that future run
passed. Local reproduction used PostgreSQL 18; hosted CI uses PostgreSQL 16.

## Handoff

See [self-review 2](LOC-001-review-2.md). Complete controller disposition, commit
only this fixture/inventory/task/new evidence, push, observe the replacement
GitHub CI through completion, and report its actual result. Do not start LOC-002
as part of this repair.
