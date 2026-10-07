# MON-107 attempt 1 - exact period financial statements

## Identity and scope

2026-10-07, Asia/Tehran. Operator: codex. Entry master HEAD
`059d3efed3eb40021830adac23c25af4928bc1ae`. The task file was already marked
in_progress/owned by codex; its existing start record was retained and work
resumed. No other edits existed at entry. User authorized completing and pushing
one next task. Self-review only; no independent accounting/human approval.

Read root AGENTS, START_HERE, project/repository map, controller/task/dependencies,
MON-011/MON-106 evidence, ADR-006, money manifest, actual REST/MCP report/GL/export
code and disposable DB harness. Worked only on MON-107; no additional child or
parent acceptance is claimed.

## Implementation and acceptance mapping

1. PERIOD_STATEMENT_WIRE_CONTRACTS documents three REST/MCP pairs, P&L file exports,
   all dates/defaults/basis/dimensions/comparison counts, output fields, signed
   aliases, safe ranges, currency units and errors. MONEY_MANIFEST links it.
   Existing P&L/comparison numeric integer cents and income fixed two-place
   decimal strings retain their field names/units with additive Minor strings
   and currencyCode; no client-version switch or magnitude inference.
2. Shared direct-DB services use one repeatable-read read-only snapshot for
   organization/currency, effective dimension ownership and all periods.
   Registered profit_and_loss is updated; income_statement and pnl_comparison
   add previously absent MCP parity. Actual API-key REST and SDK MCP clients on
   migrated disposable PostgreSQL verify primary/comparative/inclusive/unbounded
   periods, zero accounts, cash-source/bank heuristic, tagged/untagged cost center,
   project ownership/precedence, two organizations, malformed cross-org account/
   entry references, custom-role denial, invalid keys/inputs and USD/IRR/JPY/KWD.
3. Shared exact GL reads SQL SUM as text; totals, net income, changes and ratio
   percentages use bigint before bounded wire conversion. Fixtures cover gross
   sums above int64 that cancel exactly, signed cents, safe maximum totals,
   section/net/change overflow and unsupported currency with unchanged failure
   snapshots. Income-statement's former outer join could sum disqualified
   draft/deleted/date/foreign-entry lines; the exact account-driven query fixes
   this while retaining empty accounts. Comparison UTC calendar arithmetic fixes
   local-midnight ISO shifts. Strict malformed/duplicate/reversed/partial inputs
   fail without ledger/audit mutation; no bigint JSON crash or silent narrowing.

P&L PDF/XLSX REST and existing export_financial_statement MCP P&L export now
consume the same calculations. REST comparative files align prior-only accounts
and zero cells by ID. Actual XLSX values preserve existing currency scaling;
PDF serializes successfully; Excel precision failures return LEGACY_NUMERIC_RANGE.
The existing safe PDF formatting/XLSX precision/formula-text guards are reused.
No schema, migration, historical rescale or production flag changes.

## Verification environment

Repository root D:/Projects/dubbl. Task-created PostgreSQL 18 cluster uses only
127.0.0.1:55507, synthetic fixture role, UTC timezone and explicit TEST_DATABASE_URL.
The harness creates/migrates/drops random dubbl_ci_ databases. Application DB was
not accessed. The task cluster was stopped after the final fixture run; its
temporary directory remains outside the repository. No full build, dev server, Docker or deployment was run.

| Command/check | Observed result | Scope |
|---|---|---|
| node --import tsx --test tests/integration/period-statement.test.ts | Exit 0; 1/1, no skips | Final actual REST/MCP fixture, all three pairs and exports |
| node --import tsx --test tests/period-statement-wire.test.ts tests/integration/period-statement.test.ts tests/integration/cumulative-statement.test.ts tests/integration/budget-report.test.ts | Exit 0; 6/6, no skips | Final wire/period/cumulative/budget regression run |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 325/325, no skips | Full unit suite; pnpm test's default concurrency had a subprocess timeout |
| pnpm typecheck | Exit 0 | Final MDX and tsc after all fixture corrections |
| pnpm exec eslint on changed TS files | Exit 0; clean | Final changed-file checks after all fixture corrections |
| pnpm lint | Exit 0; 0 errors, 120 existing warnings | No task-file warnings |
| python .agentic/scripts/money_inventory.py --write and without --write | Exit 0 | Regenerated lexical inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1338 consumers, 26095 occurrences | Final schema hashes/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks | No new legacy helper use |
| python .agentic/agent.py validate | Exit 0; 173 tasks | Structural controller state |
| git diff --check | Exit 0 | Whitespace |

Initial typecheck caught an inferred dimension string wider than GLQueryOptions;
an explicit options type fixed it. Fixture development corrected an invalid
API-key prefix, an overbroad isolation assertion matching totalRevenue's field
name (diagnostic retries resolved timeouts), ExcelJS default-import/indented-row
handling, and the existing export tool's actual name. Temporary diagnostics were
removed. These were fixture/static-check issues; final behavioral checks pass.

## Review and remaining work

Separate honest self-review: MON-107-review-1.md. MON-108..110 retain remaining
report calculations and report-pack integration; MON-101/MON-029 retain combined
acceptance. Existing cash-basis heuristic and JSON/export scale distinctions are
explicit, not independent accounting qualification. Full-int64 clients, historical
currency/migration, performance, Persian/PDF layout and production IRR/release
gates remain separate. Finish controller review/done, stage task-owned files,
commit/push master, verify remote SHA and clean tree, then stop.
