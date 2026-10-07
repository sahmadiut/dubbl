# MON-108 attempt 2 - PostgreSQL 16 pagination CI correction

## Identity and observed failure

2026-10-07, Asia/Tehran. Operator: codex. Entry master HEAD
`56f70d227efccb045203dd0295e7a99e4769121d`, clean tree. User explicitly requested
checking the GitHub CI failure, fixing/pushing it and not waiting for the new run.
Reopened MON-108 through the controller; original attempt/review evidence remains
immutable. Self-review only; no independent accounting or production approval.

Actual failed run: [37623783847](https://github.com/sahmadiut/dubbl/actions/runs/37623783847).
PostgreSQL Migration Fixtures failed 1/100: ledger-detail-worker page assertion
returned three line IDs instead of one. Lint, typecheck, unit and controller jobs
passed; build/Docker were skipped by dependencies. gh calls use explicit fork
repository sahmadiut/dubbl because the checkout's default gh repository is upstream.

## Cause and correction

Reproduced the unmodified ledger service failure locally on PostgreSQL 16.15:
offset=0, limit=1 returned three lines. A five-row/two-account SQL reproducer
showed the upper row-number bound disappear from the execution plan, leaving
only the lower bound. PostgreSQL 18.6 preserved the upper Run Condition for the
same query. The row_number window used the default RANGE frame while the exact
running SUM used ROWS UNBOUNDED PRECEDING. PostgreSQL 16's window optimization
merged those windows but lost the upper pagination predicate.

Set row_number to the same explicit ROWS UNBOUNDED PRECEDING frame as SUM.
On PostgreSQL 16 the reproducer then retains `row_number() <= 1` as its Run
Condition and returns one row per account with exact running sums. No arithmetic,
currency, output contract or application data change; no database upgrade needed.

Strengthened the actual REST/MCP fixture to assert exact page lengths and IDs for
offsets 0/1/2/3 at limit 1, offset 1 at limit 2, offset 2 at limit 500 and the
maximum supported offset. Summary limit 1 is checked independently against its
full three-line count. Existing running/history assertions and exports remain.
Updated the contract registry and generated inventory. No assertion removed,
timeout raised, fixture skipped or CI gate weakened.

## Acceptance mapping

1. Original inputs/outputs/units/aliases remain documented; registry additionally
   records shared window-frame compatibility and PostgreSQL 16/18 regression.
2. Updated actual API-key REST/registered MCP fixture passes both PostgreSQL
   versions, including exact/numeric agreement, stable pages, complete running
   history, authorization, tenant isolation and exports. Adjacent cumulative and
   period statement fixtures also pass PostgreSQL 16.
3. Original strict invalid-input/range rejection and read-only snapshots remain
   exercised by the passing full fixture. Pagination now respects both upper and
   lower bounds while exact running calculations occur before slicing.

## Verification and environment

Commands ran in D:/Projects/dubbl. Downloaded portable PostgreSQL 16.15 runtime
components from the [EDB binary archive](https://www.enterprisedb.com/download-postgresql-binaries)
into the OS temporary directory; no system installation or existing DB upgrade.
Created a synthetic loopback-only fixture cluster at 127.0.0.1:55516 with UTC
timezone; reused the task-owned PostgreSQL 18.6 cluster at 127.0.0.1:55508.
Explicit TEST_DATABASE_URL targets allowed the harness to create/migrate/drop
random dubbl_ci_ databases. Configured application DB was not accessed. Both
clusters stopped after the fixtures; temporary runtime/data remain outside Git.

| Actual check | Result |
|---|---|
| Pre-fix SQL reproducer and ledger-detail.test.ts on PostgreSQL 16.15 | Reproduced missing upper bound and 3 != 1 assertion |
| Post-fix SQL reproducer/EXPLAIN on PostgreSQL 16.15 | Correct bounded rows, preserved Run Condition and running sums |
| node --import tsx --test --test-concurrency=1 tests/integration/ledger-detail.test.ts tests/integration/period-statement.test.ts tests/integration/cumulative-statement.test.ts with PostgreSQL 16 target | Exit 0; 3/3, no skips |
| node --import tsx --test tests/integration/ledger-detail.test.ts with PostgreSQL 18 target | Exit 0; 1/1, no skips |
| pnpm exec eslint lib/reports/ledger-detail.ts tests/integration/ledger-detail-worker.ts | Exit 0, clean |
| pnpm typecheck | Exit 0; MDX/tsc, no build |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 415 columns, 1340 consumers, 26096 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; hashes/occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks |
| python .agentic/agent.py validate and git diff --check | Exit 0 |

Full unit/lint suites were not rerun for this small SQL/fixture diff; the failed GitHub run had
passed them. No full build, dev server, Docker, deployment or schema change.

## Handoff

Local typecheck and honest self-review passed. Complete reopened MON-108, commit
only correction-owned files and push origin/master. Verify remote SHA/clean tree
and stop without waiting for the new GitHub run, as requested. MON-109 is not
started; parent integration and other financial/production gates remain separate.
