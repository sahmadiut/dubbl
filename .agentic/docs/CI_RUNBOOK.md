# CI and migration fixture runbook

CI-001, 2026-10-02 (Asia/Tehran). Canonical package manager: `pnpm@10.30.3`, declared in package.json. CI uses Node 22 and frozen pnpm-lock.yaml installs. The legacy package-lock.json is preserved but is not the CI dependency source.

## Checks

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
python .agentic/agent.py validate
python -m unittest discover -s .agentic/tests -v
```

`typecheck` generates ignored Fumadocs collections before TypeScript checks. No Next build or development-server startup is required. Controller tests normalize only their temporary task copies to a synthetic initial state, preserving dependency and human-review gates. They do not reset actual progress. The evidence symlink test skips only Windows error 1314 (missing symlink privilege); Linux CI must execute it.

## PostgreSQL fixtures

CI provisions PostgreSQL 16 with synthetic service credentials. `pnpm test:integration` requires explicit `TEST_DATABASE_URL`, a local PostgreSQL server and a test role with `CREATEDB`. It never falls back to DATABASE_URL or runs migrations on the connection target. No real customer data or provider credentials are needed.

PowerShell example using a separately provisioned local test instance:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test_user:test_password@127.0.0.1:5432/test_database'
pnpm test:integration
```

Each case creates `dubbl_ci_` plus a random 32-character hexadecimal database name using template0. Only that validated, successfully created name is removed in cleanup, after closing connections. Temporary migration directories also use unique names. Parallel runs do not share fixture databases. The configured local `dubbl` test user's lack of CREATEDB is expected; do not broaden its permissions just to execute this suite. A separate temporary cluster was used for local verification.

Cases in `../../tests/integration/migrations.test.ts`:

1. Empty database: run the actual migration CLI through all committed migrations, seed a synthetic ledger, rerun and verify unchanged ledger/history.
2. Historical checkpoint `0003_same_frog_thor`: apply committed migrations through that checkpoint, seed, upgrade through current HEAD, verify preservation and rerun idempotency.
3. Untracked `0000_baseline`: construct the historical baseline and remove only its fixture migration history, seed, run the actual CLI baseline-adoption path, verify preservation and rerun idempotency.
4. Failed upgrade: create a deliberate 0002 column collision after the tracked baseline, verify nonzero CLI exit, transactional rollback of 0001 and migration history, unchanged ledger, then remove the fixture conflict and verify successful recovery.

The previous-schema fixture is pinned to a committed historical checkpoint. No release tags are available locally, so it is not represented as a verified previous production release. Future migration tasks must add representative application documents, historical production-version fixtures with sanitized data, backfill/checksum coverage and restore rehearsals as required by MON-010 and QA-005.

Synthetic organizations cover unchanged USD 1250 minor units, IRR 123456789 minor units and the 32-bit boundary 2147483647. Accounts reuse codes across organizations. Tests assert exact per-org/currency debit and credit totals, compare legacy row values/IDs/counts including stored FX, dates and period locks, check account/entry organization consistency and migration history. New columns added by historical migrations are excluded from legacy-row equality; required current schema changes are checked separately. These are schema/ledger preservation checks, not API authorization or financial-report qualification.

## Workflow gates and remaining qualification

Deployment migration control (updated 2026-10-02 by owner request): `Apply Migrations` is skipped unless the repository variable `AUTO_MIGRATE` is exactly `true`, the event is a push to master and all five checks succeed. Unset/false disables it. Authorized deployment setup additionally requires the `DATABASE_URL` repository secret pointing to the chosen deployment target; no local .env or credentials are copied to GitHub. This changes only deployment migration opt-in; PostgreSQL fixtures and PR migration drift checks remain enabled. Setting the variable requires the relevant deployment authorization and is not part of a generic task continuation.

Lint, typecheck, unit tests, PostgreSQL migration fixtures and controller tests run on pushes and pull requests. Existing build, Docker and master migration jobs now depend on all five checks. PR migration drift support is preserved. Global workflow permissions are contents:read. No workflow was dispatched, deployment performed or production migration executed during this task. Existing Docker support remains configured and unexecuted under DEC-002; no full build was run under root AGENTS.md.

Local reproducibility was checked with a separate source directory (no copied .env, node_modules, .source, .next or next-env.d.ts), frozen dependency installation, Node 22.23.3 and temporary PostgreSQL 18.6. Ubuntu/hosted Actions and PostgreSQL 16 service execution remain unverified locally; CI is configured to run them. Frozen install left the lockfile unchanged. Pnpm reported ignored dependency lifecycle scripts; the required lint/typecheck/tests still passed without approving additional scripts.

Open baseline findings remain release blockers:

- Trial-balance credit-normal balances appear in debit columns: PAR-008 and QA-001.
- Bank API balance differs from GL after opening/payment workflows: DATA-004, MON-007 and QA-001.
- The 167 existing lint warnings remain visible; no errors or additional warnings were introduced by this task. Later affected-surface work should address them as appropriate.

CI success does not qualify these report/API defects, exact-money migration, IRR production enablement, localization, providers, deployment or financial release gates. No runtime feature, REST/MCP contract or Drizzle schema changed in CI-001.
