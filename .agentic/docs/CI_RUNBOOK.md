# CI and migration fixture runbook

MON-091 adds `pricing-wire.test.ts` to pure discovery and `pricing.test.ts` to
integration discovery. Run `node --import tsx --test tests/pricing-wire.test.ts
tests/integration/pricing.test.ts` with explicit loopback TEST_DATABASE_URL and a
CREATEDB test role. Actual API-key handlers and full MCP SDK registration run in
random migrated databases without a Next dev server. Audit/price output faults
are injected only in those fixtures; the harness drops them afterward. Invoice
write/quote integration workers cover adopted price-list lookup regressions. No
new schema/migration or deployment opt-in is introduced.

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

CI provisions PostgreSQL 16 with synthetic service credentials. `pnpm test:integration` requires explicit `TEST_DATABASE_URL`, a local PostgreSQL server and a test role with `CREATEDB`. The MON-003 backup/restore fixture also requires matching `pg_dump` and `pg_restore` clients on PATH; optionally set `PG_BIN` to their directory (useful on Windows). It never falls back to DATABASE_URL or runs migrations on the connection target. No real customer data or provider credentials are needed. See `../../lib/db/MONEY_MIGRATION.md` for monetary expansion, lock and recovery checks.

MON-004 adds five integration cases in `tests/integration/fx-exact.test.ts`: all-four-field legacy preservation/backfill (including exact binary32 and quarantines), clean-install guarded ORM/raw/upsert writes, physical 20/18 decimal capacity and rejection, committed-batch restart/locked pending work, and expansion lock failure/rollback/retry. See `../../lib/db/FX_MIGRATION.md` for coexistence limits and the explicit maintenance runner. The physical-capacity fixture disables only its temporary database's FX triggers to isolate numeric CHECK behavior; live consumers still reject rates the legacy fields cannot represent. MON-003 checksum comparisons now exclude only the five newly added FX metadata columns, while still hashing every original row field and checking original column defaults/nullability.

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

MON-005 adds five workflows in `tests/integration/fx-history.test.ts`: metadata
upgrade preservation and tenant-specific extremes, provider outage/poisoning with
quarantined history, public-feed reuse/concurrent refresh/manual precedence,
tenant/pair/date lookup caches, and real invoice journal creation before/after
refresh plus a direct-DB MCP manual override/audit. The worker subprocess uses
only its disposable database. Legacy checksum tests exclude the six nullable
new provider metadata fields while still comparing every original field.
`tests/rate-provider.test.ts` covers exact source parsing/cross math, negative
inputs and bounded/redacted HTTP failures. No live provider traffic is required.

Deployment migration control (updated 2026-10-02 by owner request): `Apply Migrations` is skipped unless the repository variable `AUTO_MIGRATE` is exactly `true`, the event is a push to master and all five checks succeed. Unset/false disables it. Authorized deployment setup additionally requires the `DATABASE_URL` repository secret pointing to the chosen deployment target; no local .env or credentials are copied to GitHub. This changes only deployment migration opt-in; PostgreSQL fixtures and PR migration drift checks remain enabled. Setting the variable requires the relevant deployment authorization and is not part of a generic task continuation.

Lint, typecheck, unit tests, PostgreSQL migration fixtures and controller tests run on pushes and pull requests. Existing build, Docker and master migration jobs now depend on all five checks. PR migration drift support is preserved. Global workflow permissions are contents:read. No workflow was dispatched, deployment performed or production migration executed during this task. Existing Docker support remains configured and unexecuted under DEC-002; no full build was run under root AGENTS.md.

Local reproducibility was checked with a separate source directory (no copied .env, node_modules, .source, .next or next-env.d.ts), frozen dependency installation, Node 22.23.3 and temporary PostgreSQL 18.6. Ubuntu/hosted Actions and PostgreSQL 16 service execution remain unverified locally; CI is configured to run them. Frozen install left the lockfile unchanged. Pnpm reported ignored dependency lifecycle scripts; the required lint/typecheck/tests still passed without approving additional scripts.

Open baseline findings remain release blockers:

- Trial-balance credit-normal balances appear in debit columns: PAR-008 and QA-001.
- Bank API balance differs from GL after opening/payment workflows: DATA-004, MON-007 and QA-001.
- The 167 existing lint warnings remain visible; no errors or additional warnings were introduced by this task. Later affected-surface work should address them as appropriate.

CI success does not qualify these report/API defects, exact-money migration, IRR production enablement, localization, providers, deployment or financial release gates. No runtime feature, REST/MCP contract or Drizzle schema changed in CI-001.

MON-082 adds `tests/integration/payroll-runs.test.ts` to the existing integration discovery. Reproduce locally with an explicitly supplied loopback TEST_DATABASE_URL and `node --import tsx --test tests/integration/payroll-runs.test.ts`; each case creates/drops a random database and uses synthetic data. The worker invokes actual REST handlers and MCP SDK transport without a dev server, live providers or production credentials. A second case qualifies legacy payroll preservation through 0009. The existing FX storage/backfill fixture accounts for payroll's single combined guard after the bounded consumer cutover. Deployment migration authorization/opt-in and production currency flags remain unchanged.


MON-083 adds `tests/integration/payroll-payments.test.ts` to normal discovery. It exercises actual contractor/tax payment REST/MCP and legacy migration preservation in random fixture databases without a dev server. Use a temporary PostgreSQL cluster configured with `timezone = 'UTC'` to match CI. A cluster initialized on a Tehran-local Windows host otherwise exposes the existing low-bank-balance daily deduplication mismatch between UTC application dates and PostgreSQL local timestamp dates; that banking behavior is outside MON-083. Setting this option only on the disposable test cluster avoids claiming a banking timezone fix. Never alter deployment/test-target timezone implicitly. The all-money checksum fixture excludes only new nullable contractor snapshot columns, preserving original historical column comparisons.


MON-084 adds `tests/integration/payroll-compensation.test.ts` to normal integration discovery. Run with an explicit loopback TEST_DATABASE_URL against a disposable UTC PostgreSQL cluster; cases create/drop random fixture databases. Actual handlers and MCP SDK transports require no Next dev server. Migration 0011 snapshot preservation and all-money checksum exclusions are qualified without updating/rescaling historical compensation rows. No deployment migration opt-in or currency rollout flag changes.


MON-085 adds `tests/integration/payroll-outputs.test.ts` to normal integration discovery. It creates a random migrated database and executes all 16 actual payroll output REST/MCP pairs through synthetic API keys and in-memory SDK transport. Use an explicit loopback TEST_DATABASE_URL on a disposable UTC cluster; `node --import tsx --test tests/payroll-output-wire.test.ts tests/integration/payroll-outputs.test.ts` needs no Next dev server. Broad migration/backup qualification still requires matching PG_BIN clients. Outputs add no migration; no current tax-policy or statutory filing approval is inferred.

MON-086 adds `tests/integration/asset-master.test.ts` to normal discovery. The worker exercises ten actual asset/category master REST/MCP pairs in a random migrated fixture database, using synthetic API keys and in-memory MCP transports. Run `node --import tsx --test tests/asset-master-wire.test.ts tests/integration/asset-master.test.ts` with an explicit loopback TEST_DATABASE_URL on a disposable UTC cluster. No Next dev server is required; fault injection is scoped to that fixture database. There is no new migration or rollout change.

MON-087 adds asset-depreciation.test.ts to integration discovery and asset-depreciation-wire.test.ts to pure checks. Actual handlers and full MCP SDK registration run without a dev server on migrated random databases, using synthetic identity and a loopback PostgreSQL target. Assertions cover exact maximal-safe arithmetic, eighteen method/convention schedules, rollback GL preservation, concurrency, period tiers and transaction faults. No schema change/migration or deployment opt-in. Depreciation's period-table SHARE locks may delay period edits across organizations during batch transactions; performance and independent accounting qualification remain parent gates.

MON-088 adds `asset-valuation-wire.test.ts` to pure discovery and `asset-valuation.test.ts` to integration discovery. The latter runs all registered MCP tools and actual API-key REST handlers against a migrated random database, without a dev server. It checks exact signed recovery/surplus and carrying-value disposal, safe range failures, scope/permissions/periods, retry/concurrency and atomic audit/output faults. No new schema/migration/deployment opt-in. PostgreSQL TABLE SHARE locks may delay period edits; post-valuation schedules and financial/performance qualification remain parent gates.


MON-089 adds asset-cwip.test.ts to integration discovery. Run node --import tsx --test tests/asset-cwip-wire.test.ts tests/integration/asset-cwip.test.ts with an explicit loopback TEST_DATABASE_URL on a disposable UTC PostgreSQL cluster. The worker invokes actual cost-list/add/capitalization REST and MCP SDK tools in random migrated fixture databases; no Next dev server is required. Fault injections affect only those databases. No schema/migration, deployment opt-in or IRR flag change.

MON-090 adds `loans.test.ts` to normal integration discovery. Run `node --import tsx --test tests/loan-wire.test.ts tests/integration/loans.test.ts` with an explicit loopback TEST_DATABASE_URL on a disposable UTC PostgreSQL cluster. The harness creates/migrates/drops a random fixture database and invokes actual API-key REST handlers and full MCP SDK registration without a Next dev server. Synthetic fault injection is confined to fixture databases; no new schema/migration or deployment/IRR opt-in.

MON-092 adds `crm.test.ts` to normal integration discovery and four pure groups in `crm-wire.test.ts`. Run `node --import tsx --test tests/crm-wire.test.ts tests/integration/crm.test.ts` with an explicit loopback TEST_DATABASE_URL on a disposable UTC cluster. Random migrated databases exercise all sixteen actual CRM REST/MCP pairs, strict described tool schemas, API-key auth, exact cents/currency/probability, scoped public joins, lifecycle/default concurrency and audit/output fault rollback. No Next dev server, schema change, deployment or IRR opt-in is required.


MON-093 adds `project-master.test.ts` to integration discovery and four pure groups in `project-master-wire.test.ts`. Run `node --import tsx --test tests/project-master-wire.test.ts tests/integration/project-master.test.ts` with an explicit loopback TEST_DATABASE_URL on a disposable UTC cluster. Random migrated databases exercise all 48 actual REST/MCP pairs, scoped public references, exact cents/physical quantities, all writer audit faults, financial returned-money rollback and concurrent time/timer/member updates without a Next dev server. No schema/migration or deployment/IRR opt-in change.


MON-094 adds `project-billing.test.ts` to normal integration discovery and four pure groups in `project-billing-wire.test.ts`. Run `node --import tsx --test tests/project-billing-wire.test.ts tests/integration/project-billing.test.ts tests/integration/project-master.test.ts` with an explicit loopback TEST_DATABASE_URL on a disposable UTC PostgreSQL cluster. Random migrated databases invoke actual REST API-key handlers and all eight registered billing MCP tools through in-memory SDK transports. Assertions cover scopes/permissions, three cost sources, all four currency labels, exact products/sums/percentages, output/audit rollback, period guards, fixed allocation and retry/concurrency. Fault injection stays within those random databases. MON-093 integration protects the adjacent expense-only currency reference guard. No Next dev server, schema migration or deployment/IRR opt-in change.
