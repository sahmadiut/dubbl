# CI-001 attempt 1 — reproducible checks and database fixtures

## Identity

2026-10-02 (Asia/Tehran), coding-assistant. Entry HEAD: c79b94bd9d9eed95dec6209b276821473eed4d34. Changes are uncommitted. CI-001 was selected by the validated controller and claimed with `python .agentic/agent.py start CI-001 --owner coding-assistant`. No other backlog task was started.

Read applicable root/.agentic instructions, START_HERE, CONTROLLER, PROJECT, REPOSITORY_MAP, devops role, task/dependency evidence and SOURCE sections testing-matrix/cicd/database-and-currency-migration. Inspected package scripts, existing CI, lockfiles, migration CLI, committed migration journal/SQL, Drizzle's installed migration implementation, schemas and tests.

## Implementation

- package.json: `typecheck` generates Fumadocs collections and runs tsc without emitting; `test:integration` uses the existing Node/tsx test stack separately from pure unit tests.
- .github/workflows/ci.yml: explicit read-only contents permission, PostgreSQL 16 fixture job with synthetic credentials, Python controller job and shared typecheck command. Existing build/Docker/master migration jobs now require lint, typecheck, unit tests, database integration and controller checks. Existing PR migration drift and Docker support preserved.
- tests/integration/migrations.test.ts: explicit local TEST_DATABASE_URL only; randomized databases created from template0, never migrated/reset connection target; finally cleanup and identifier checks. Four actual-CLI cases cover clean migration, tracked 0003 upgrade, untracked 0000 adoption and forced pending-migration SQL failure/rollback/recovery. Repeated migrations leave ledger and history unchanged. Synthetic exact totals cover USD 1250, IRR 123456789 and int32 maximum 2147483647 in three distinct orgs with reused account codes; legacy rows, stored FX, dates, period locks and tenant consistency are checked.
- .agentic/tests/test_agent.py: normalize only temporary copies to initial todo states so test results do not depend on actual backlog progress; remove stale repository-map wording expectation. Skip only Windows missing-symlink-privilege error 1314, preserving execution on Linux CI.
- README and docs/CI_RUNBOOK.md: portable commands, Windows environment setup, fixture safety/coverage and explicit limitations. docs/RISKS.md now names actual remediation/qualification task IDs for both known accounting defects.

No package dependency, schema, migration, application behavior, REST API or MCP tool changed. No user-facing feature was introduced, so no MCP operation is required.

## Clean environment

Copied tracked source plus the new integration test to `C:/Users/Sajjad/AppData/Local/Temp/dubbl-ci-clean-89011741f6094e35b513dd5b33d732f4`. No existing node_modules, .env, .source, .next or next-env.d.ts was copied. Installed with pnpm 10.30.3 and frozen lockfile, then ran checks with Node 22.23.3 (obtained with `pnpm dlx node@22 --version` and its executable directory prepended to PATH). Initial installation itself used host Node 23.11.0; all clean-directory product checks used Node 22.23.3.

Frozen install exited 0, resolving 1405 packages without lockfile resolution changes. Original and clean-copy pnpm-lock.yaml SHA256 both: `52F1D86838F857570E4B73F8F0F69C71407CB3E6B002156C8BEA60B93DC4A198`. Slow-download and ignored-dependency-lifecycle-script warnings were observed. No additional lifecycle scripts were approved; all required checks still passed.

The already authorized local dubbl connection user cannot CREATE DATABASE (SQLSTATE 42501). The first three-case integration run using that connection failed before creation. Its permissions were not changed, its schema/data were not migrated or reset, and credentials were never printed/persisted. An initial inline shell launcher also failed from Windows quoting before doing any database work; corrected to stdin script execution.

Used installed PostgreSQL binaries to create an entirely separate temporary trust-authenticated test cluster, restricted to 127.0.0.1:55439, under `C:/Users/Sajjad/AppData/Local/Temp/dubbl-ci-pg-b94db0667a8c4ffbb33897e557466650`. Initdb role dubbl_ci, UTF8/C locale. Observed server version via SHOW server_version: 18.6. This server's fixture URL had no password and no production connection. After tests, querying pg_database for dubbl_ci_* returned 0; pg_ctl fast stop exited 0. No temporary server remains running.

## Verification

All repository commands ran from D:/Projects/dubbl unless marked clean source copy.

| Command / procedure | Actual result | Scope / limitation |
|---|---|---|
| `python .agentic/agent.py validate/status/context` at entry | Exit 0; valid 60 tasks; CI-001 ready | Controller integrity only |
| `pnpm typecheck` in existing workspace | Exit 0 | Existing dependencies/generated output |
| `pnpm lint` in existing workspace | Exit 0; 0 errors, 167 warnings | Same baseline warnings as AUD-001 |
| `pnpm test` in existing workspace | Exit 0; 44 passed | Existing pure-function suite |
| First integration run against configured dubbl user | Exit 1; 3 permission failures | No CREATEDB; no successful fixture creation |
| First separate-cluster integration run | Exit 1; 2 passed, 1 failed | Test used SELECT * on two tables expanded by 0001; corrected to explicit legacy columns, not product/data changes |
| Corrected `pnpm test:integration` in workspace | Exit 0; 3 passed | PostgreSQL 18.6, Node 23.11.0 |
| `pnpm install --frozen-lockfile` in clean source copy | Exit 0, 2m44.2s | Fresh node_modules; ignored dependency script warnings |
| `pnpm typecheck` in clean source copy | Exit 0 | Node 22.23.3; no Next build/start |
| `pnpm lint` in clean source copy | Exit 0; 0 errors, 167 warnings | Node 22.23.3; no additional warnings |
| `pnpm test` in clean source copy | Exit 0; 44 passed | Node 22.23.3 |
| Final `pnpm test:integration` in clean source copy | Exit 0; 4 passed, 0 skipped; 13.243s | Node 22.23.3 / PostgreSQL 18.6; includes forced SQL failure and recovery |
| `python -m unittest discover -s .agentic/tests -v` | Exit 0; 26 run, 25 passed, 1 skip; 72.396s | Python 3.13.9; Windows symlink privilege missing, Linux CI execution pending |
| `pnpm exec eslint tests/integration/migrations.test.ts` | Exit 0, no warnings | Final integration test code |
| Inline Node negative target checks | Exit 0 | Missing and remote TEST_DATABASE_URL rejected before connection; no errors/secrets echoed |
| PyYAML BaseLoader parse and workflow assertions | Exit 0; 8 jobs validated | push/PR triggers, frozen installs, five prerequisite gates, PG16 image and read-only permission checked; not a hosted Actions execution |
| `Get-FileHash` on both pnpm locks | Exit 0, identical SHA256 | Frozen dependency graph preserved |
| Fixture database count / pg_ctl stop | Exit 0; count 0 / stopped | Separate temporary server only |
| `git diff --check` and controller validate | Exit 0 | LF/CRLF notices only; no whitespace errors |

## Acceptance mapping

1. Reproducible bounded CI checks demonstrated from a clean source/dependency directory under Node 22. Frozen installs and pre-typecheck source generation wired into the actual workflow; integration/controller checks added. Hosted Ubuntu Actions and PostgreSQL 16 service execution remain unrun; existing full build and Docker jobs were only inspected under root AGENTS/DEC-002.
2. Fixtures contain only synthetic organizations, accounts, journals and locks; no production dump, person, login, provider or real secret. Separate randomized databases isolate destructive fixture setup/cleanup. Original configured database was untouched apart from rejected CREATE requests.
3. Baseline controller failures caused by live task state are resolved; Windows symlink limitation is explicit and tested by Linux CI. Existing lint warnings remain documented. Trial-balance defect remains with PAR-008/QA-001; bank/GL defect remains with DATA-004/MON-007/QA-001 and blocks relevant financial release qualification. Migration fixture success does not hide or qualify those reports.

## Review and handoff

Separate honest self-review: CI-001-review-1.md. No peer/human/hosted-CI/production approval claimed. Historical checkpoint 0003 is not a verified previous production release (no local tags). Actual production-version fixtures, monetary backfills, representative documents and restore rehearsals remain MON-010/QA-005; application authz/API/accounting and English/Persian gates remain their assigned tasks. IRR was not enabled.

After acceptance checks and controller closure, CI-002 should be next. Stop after CI-001. Changes remain uncommitted; no full build, Docker execution, Next dev startup, workflow dispatch, deployment or production migration occurred.
