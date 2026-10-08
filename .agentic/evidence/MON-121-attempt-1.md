# MON-121 attempt 1 - exact custom and saved report contracts

## Identity and scope

2026-10-08, Asia/Tehran. Operator: codex. Entry master HEAD
`48b879ba9d82eceef343af04de77979896baab4b`, clean working tree. Controller next
selected MON-121, then start assigned codex. Read root/nested AGENTS, controller,
project/repository map, backend role, ADR-006, MON-011 evidence, money manifest and
actual REST/MCP/report schema/UI/scheduling sources. This is one bounded child of
MON-105; combined integration and scheduled delivery retain separate ownership.
Changes were uncommitted when this evidence was written. Self-review only.

## Implementation

`CUSTOM_REPORT_WIRE_CONTRACTS.md` documents seven REST/MCP operation pairs, all
source projections, exact aliases, units, supported ranges and failure policy.

- Added `lib/reports/custom-wire.ts` and `custom.ts`. Run and saved CSV export
  share the same six-source dispatch, source field allowlists, filters, inclusive
  date ranges, null behavior and ordered columns. Expenses/payroll now execute
  through the shared runner, rather than retaining independent CSV-only readers.
- Numeric cents remain safe integer compatibility fields; selected money adds
  exact matching Minor strings. Explicit Minor-only columns work within the same
  range. Nullable creditLimit stays null. Ordered money comparisons use bigint;
  physical quantities/counts are separate. No scale conversion or FX aggregation.
- Strict config/create/PATCH validation rejects unknown/duplicate columns,
  operators, unsupported grouping, malformed/excessive controls, invalid/reversed
  dates and noncanonical or unsafe monetary filter strings before writes. Existing
  grouping was ignored; now nonempty requests reject explicitly.
- Saved CRUD is organization scoped. PATCH/delete lock and validate the current
  stored row; returned-row serialization is checked before transaction commit.
  Reads/export revalidate configs and finite SQL timestamps. Soft deletion and
  its audit entry remain, including REST request metadata; MCP uses the same path.
- All operations require view:data, with additional view:payroll-reports for
  payroll execution/export. Independently scoped contact/run/employee/bank/import
  joins prevent related foreign data from leaking. Deleted roots are excluded.
- CSV now applies filters/dates and uses the same columns/Minor aliases as run.
  It quotes commas/quotes/CR/LF, doubles quotes, preserves literal integer units,
  retains empty-result headers and returns identical bytes in REST/MCP base64.
- Replaced duplicated handlers in four REST files, added seven described MCP
  tools in `custom-reports.ts`, registered them in index, added pure/DB fixtures,
  updated the boundary registry/manifest and regenerated the machine inventory.

## Acceptance mapping

1. Complete boundary/input/output/range/units/alias map is in
   `registries/CUSTOM_REPORT_WIRE_CONTRACTS.md`; shared schemas and every MCP Zod
   field describe expectations. Stored config strings remain literal and arbitrary
   opaque numeric/object controls are rejected rather than coerced to money.
2. `tests/integration/custom-reports-worker.ts` invokes actual REST handlers,
   API-key auth, in-memory MCP SDK transports and full registration. It covers
   all six sources and seven operations, both actual legacy/exact invoice writer
   adapters, metadata CRUD, tenant spoofing/foreign related rows, permissions,
   payroll-only denial, missing/deleted IDs and identical run/export data.
3. Pure and migrated operation fixtures cover canonical filters, invalid configs,
   malformed bodies/IDs, empty patches, literal zero/false/null/strings, Gregorian
   leap-day boundaries, CSV escaping/empty headers, signed safe boundaries on five
   sources plus invoice unsafe reads, positive/negative unsafe int64 reads/exports,
   maximum stored int64, mismatched bank currencies, corrupt persisted configs,
   infinite source/saved timestamps and unsupported history without repair.
   Read/failed-operation financial/config/audit snapshots remain unchanged.

## Verification

All commands ran in D:/Projects/dubbl. A new PostgreSQL 18 trust cluster used the
synthetic task_mon121 role on 127.0.0.1:55521 in UTC. Explicit TEST_DATABASE_URL
selected it; fixtures created/migrated/dropped random dubbl_ci_ databases. The
application DATABASE_URL was not read or used. Cluster shutdown succeeded; its
temporary data remains outside the repository.

| Actual command/procedure | Result | Scope |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/custom-report-wire.test.ts tests/integration/custom-reports.test.ts | Final exit 0, 3/3 | Final source including returned deleted-row audit preflight |
| Same command plus tests/integration/dashboard-layouts.test.ts and tests/integration/dashboard-data.test.ts | Exit 0, 5/5 | Task and adjacent dashboard integration regression |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 348/348, no skips | Complete unit suite; final subsequent edits concern delete request/audit metadata and integration assertions |
| pnpm typecheck | Final exit 0 | MDX plus tsc, no Next build |
| pnpm exec eslint on all eleven changed/new code and test files | Final exit 0, clean | Four routes, three modules, index and three tests |
| pnpm lint | Exit 0, zero errors, 111 existing warnings | Whole repository; warnings outside changed files |
| python .agentic/scripts/money_inventory.py --write | Final exit 0 | 415 columns, 1837 files, 1376 consumers, 26061 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0 | All Drizzle columns, consumer hashes and source occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Final exit 0, 9 checks | Money lint gate regression |
| python .agentic/agent.py validate | Exit 0, valid 173 tasks | Structural validation |
| git diff --check | Exit 0 | No whitespace errors; LF/CRLF notices only |
| pg_ctl stop for task cluster | Exit 0, stopped | Fixture resource cleanup |

Initial fixture/typecheck failures identified a missing payroll employee startDate;
fixed it. A later invoice assertion identified the fixture's IRR contact/legacy
price scale, and explicit USD initially failed the existing credit-limit currency
guard. Aligned the synthetic contact/invoice currency to USD, keeping separate
IRR payroll, JPY bank and KWD expense examples. Final focused checks all passed.
These were fixture corrections, not changes to invoice accounting semantics.

No full build, dev server, screenshot requirement, full integration suite, schema
generation, application migration, provider call, deployment or IRR enablement
was performed. Exact-only clients retain the safe numeric storage bridge limit;
full-int64 financial support and explicit stored-data remediation remain separate.
CSV text is literal; spreadsheet formula/display behavior is not redefined here.

## Review and handoff

Self-review: `MON-121-review-1.md`. No remaining blocker in this bounded slice.
Controller acceptance/review/done and task-owned commit/push follow this evidence.
MON-122 retains report scheduling/delivery and MON-105 retains combined integration.
After completion query next, verify the remote SHA/clean tree, and stop.
