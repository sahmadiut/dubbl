# MON-114 attempt 1 - exact spend and sales analytics

## Identity

2026-10-07, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
6af5713d19545aabb6857b6d0fae0b75bf28b8d6; working tree clean at entry.
Honest technical self-review only; no independent peer/human/accounting review,
deployment or production qualification is claimed.

## Implementation and bounded scope

The live controller selected MON-104. Read applicable instructions, START_HERE,
controller/project/repository map, MON-011 evidence, ADR-006, money manifest and
actual report/MCP sources. Fifteen independently queried reports span documents,
ledger/KPIs, forecast/FX, banking and recurring/calendar/duplicates. Split the
oversized task into MON-114..118 per the controller; parent retains every original
criterion, all child dependencies and already-adopted inventory valuation reuse.
Only MON-114 was implemented. No controller code was changed.

- document-analytics.ts is the shared direct-Drizzle service for three scoped
  REST/MCP reports. Narrow SQL-text source projections preserve integers, bigint
  handles grouping/sums/averages/percentages, and exposed fields retain safe numeric
  cents with matching exact strings. All components use one read-only snapshot.
- document-analytics-wire.ts validates dates, currency and REST parameters; saved
  source/result range checks fail visibly. Scoped live labels prevent foreign or
  deleted names/codes from leaking. Mixed-currency totals require a filter.
- Three REST routes delegate to the service/route helper, including existing sales
  PDF/XLSX. Existing sales MCP tools use the same service; vendor_spend is registered
  alongside them. Every operation enforces view:data and described input units.
- Distinct customer invoice counts, item quantity/line counts, null-item grouping,
  signed values, vendor ranking/top-five monthly trends and rounded averages retain
  their units. Replaced the vendor query's unbound total_spend ordering and array
  interpolation with deterministic snapshot grouping.
- DOCUMENT_ANALYTICS_WIRE_CONTRACTS maps all boundaries, aliases, inputs, errors,
  selection semantics, currency/export behavior and actual supported source/result
  ranges. Updated manifest, generated inventory, task index/source coverage and
  split-parent/child handoffs.

## Acceptance mapping

1. The contract registry maps three REST/MCP pairs and both sales binary exports.
   Numeric cents and canonical Minor strings stay within +/-9007199254740991.
   Counts/quantity/percentages keep physical/numeric units; dates and single document
   currency are explicit. No public full-int64/exact-only mode is advertised.
2. Migrated disposable PostgreSQL fixtures invoke actual API-key handlers and MCP
   SDK clients. Both existing legacy/exact document-writer inputs feed report
   assertions. Fixtures verify key/custom-role failures, tenant/label isolation,
   date/status boundaries, empty defaults, counts, multi-line distinct invoices,
   top-five ranking and JSON/PDF/XLSX currency units/parity.
3. Strict inputs and saved currency/amount/output guards reject visibly; safe signed
   edges and bigint cancellation are asserted. Unsupported source totals/tax,
   group/root/gross overflow and lossy XLSX cells return LEGACY_NUMERIC_RANGE.
   Financial/domain/audit snapshots stay unchanged on success/export/failure,
   separately from API-key authentication lastUsedAt bookkeeping.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55514, with a synthetic local role and UTC timezone. Explicit
TEST_DATABASE_URL targeted that cluster. The harness created/migrated/dropped random
dubbl_ci_ fixture databases; the configured application database was not accessed.
The cluster was stopped after the final integration run. Temporary cluster data
remains outside the repository, with no application-data deletion.

| Actual command/check | Result | Limit |
|---|---|---|
| node --import tsx --test tests/document-analytics-wire.test.ts tests/integration/document-analytics.test.ts tests/integration/aging.test.ts tests/integration/tax-report.test.ts | Exit 0; 5/5, no skips | Focused and shared-MCP regressions |
| node --import tsx --test tests/document-analytics-wire.test.ts tests/integration/document-analytics.test.ts | Final exit 0; 3/3, no skips | After extra ranking, multi-line, unsafe-tax and description checks |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 322/322, no skips | Full unit suite |
| pnpm typecheck | Exit 0, final after all source/fixture edits | MDX/tsc; no Next build |
| pnpm exec eslint on three helpers, three routes, reports MCP and all three fixtures | Exit 0; clean | Final changed helpers/MCP/worker lint also clean |
| pnpm lint | Exit 0; 0 errors, 121 warnings in unrelated files | Existing warning debt remains |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1333 consumer files, 26064 occurrences | Source inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Final Drizzle exports/hashes/source lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No new legacy money consumer |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structure/whitespace only |
| python -m unittest discover -s .agentic/tests -v | Stopped before completion; preceding 12 cases passed | Optional full-backlog simulation was still progressing (138 resolved synthetic tasks); no complete suite pass is claimed |

The first focused run exposed foreign fixture invoices persisting between customer
and item cases (1800 instead of expected 900). Scoped fixture cleanup corrected the
test isolation; final runs pass without relaxing assertions. Diff review corrected
two unrelated Unicode characters affected by the initial text rewrite; existing
MCP report content now changes only for the intended imports and registrations.
The optional controller test run was stopped during its lengthy full-backlog
simulation after the required structural validation and application checks passed.
Its temporary synthetic copy may remain outside the repository; real task states
were never mutated by that run. No controller-test failure was observed, and this
does not claim that the incomplete controller suite passed.

No build, dev server, Docker, schema/migration generation, application database,
provider/email request, deployment or production IRR change ran. Fixture migrations
qualify these boundaries only. The service aggregates selected narrow rows in memory;
large-volume performance, full-int64 storage/business paths, unrelated report domains
and independent financial/accounting qualification remain their own gates.

## Review and handoff

See MON-114-review-1.md for technical self-review. No blocker remains for MON-114.
MON-104 retains MON-115..118 and independent integration (including inventory reuse),
and MON-029 retains combined reports. Stop after marking this child done, committing
only task-owned files, pushing origin/master and verifying synchronization.
