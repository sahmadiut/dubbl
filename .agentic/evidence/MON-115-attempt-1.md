# MON-115 attempt 1 - exact expense and KPI analytics

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry master HEAD
214df71; clean working tree at entry. Technical self-review only; no independent
peer/human/accounting review, deployment or production qualification is claimed.

The live controller selected MON-115. Read root/nested instructions, controller,
project/repository map, backend role, task, MON-011 evidence, ADR-006 and money
manifest. Scope is exactly this child; MON-104/MON-029 retain integration.

## Implementation

- `kpi-analytics.ts` shares direct-Drizzle repeatable-read read-only snapshots for
  expense, monthly, executive and contact profitability. Ledger SQL text aggregates
  and shared exact GL helpers retain bigint through final output; documents use
  narrow text source projections and safe source guards. Numeric money retains its
  units and adds matching Minor strings. Root/row/month/net/delta outputs reject
  unsupported ranges rather than round, overflow or crash JSON.
- `kpi-analytics-wire.ts` validates actual Gregorian dates, month counts, basis,
  format, currency, query cardinality and prior comparison range. UTC calendar
  windows avoid local-time first-of-month drift. Bigint ratio rounding preserves
  average/share/delta behavior including signed ties.
- Four REST readers and five MCP operations (including executive PDF/XLSX) use the
  service. Existing project profitability remains on MON-094's shared service.
  Every operation requires view:data. Ledger scopes both journal and account;
  live owned contact labels cannot expose foreign/deleted names.
- Contact currency filtering prevents mixed-unit aggregation. Executive outstanding
  documents require organization currency and retain the current amountDue snapshot
  filtered by issue cutoff, not historical settlements. Cash basis retains the
  shared entry heuristic; invoice-driven contact totals remain compatible.
- Three report pages show failures, hide failed data and use existing exact
  currency-aware statement formatting. Contact supports currency selection; expense
  chart tooltips format original integers while display coordinates remain approximate.
- KPI_ANALYTICS_WIRE_CONTRACTS maps every input/output/unit/alias/range/selection,
  error and export. Updated manifest, test matrix and generated inventory.

## Acceptance mapping

1. The contract registry maps all four REST/MCP pairs and executive binary/base64
   exports, UTC dates/defaults, supported money/count/percentage units, aliases,
   source/result bounds and project reuse. No full-int64/exact-only mode advertised.
2. Disposable migrated PostgreSQL fixtures call actual API-key REST handlers and
   registered MCP SDK clients, comparing every pair. Real legacy/exact document
   writers feed contact reports. Cover both bases, populated tenant isolation,
   malformed cross-org joins/deleted labels, denied custom-role/key permissions,
   defaults, counts, current AR/AP issue cutoffs, invoice-driven contacts, month
   zero filling, four currencies and actual PDF/XLSX/base64 outputs.
3. Invalid/unsupported parameters reject. Fixtures assert positive/negative safe
   edges, exact cancellation, SQL intermediates above int64, source/root/category/
   net/delta overflow, mixed/unsupported currency and lossy XLSX failures. Financial,
   domain and audit snapshots remain unchanged for success/export/failure, excluding
   API-key lastUsedAt authentication bookkeeping. All service snapshots are read-only.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55515 with a synthetic local role and UTC timezone. Explicit
TEST_DATABASE_URL targeted that cluster. The harness created/migrated/dropped random
dubbl_ci_ databases; the configured application database was not accessed. The
cluster is stopped before the push; temporary data remains outside the repository.

| Actual command/check | Result | Limits |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/kpi-analytics-wire.test.ts tests/integration/kpi-analytics.test.ts | Exit 0, 4/4, no skips | Final source and expanded fixture assertions |
| node --import tsx --test tests/integration/kpi-analytics.test.ts | Exit 0, 1/1, no skips | Final extra actual month/currency/export-permission negative cases |
| node --import tsx --test --test-concurrency=1 tests/integration/kpi-analytics.test.ts tests/integration/compound.test.ts tests/integration/project-billing.test.ts | Exit 0, 3/3, no skips | Shared reports and project reuse regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 336/336, no skips | Full unit suite |
| pnpm typecheck | Exit 0 | MDX/tsc, no full build |
| pnpm exec eslint on changed TS/TSX files | Exit 0, clean | Includes helpers, routes, MCP, pages and fixtures |
| pnpm lint | Exit 0, 0 errors, 119 warnings | Existing unrelated warning debt |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0, 415 columns, 1359 consumer files | Inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle exports, hashes and occurrence/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy money guard regression |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structure/whitespace only |

Initial fixtures omitted required journal description; corrected the fixture.
Initial query unit checks showed months=25 was deferred to service validation;
query parsing now checks its schema too. Typecheck exposed an implicit callback
type for the schema union; explicitly accepts unknown and reparses inside service.
Self-review corrected executive basis separation before date parsing, removed
unused old MCP imports, preserved actual export filenames and restricted COGS to
expense accounts. Final checks passed after corrections; no failure was waived.

No build, dev server, Docker, schema generation, application migration/data access,
provider/email call, deployment or production IRR change ran. Browser/session/OAuth,
visual PDF fit, large-volume performance, full-range public contracts and independent
financial/localization/release qualification remain outside this bounded task.

## Review and handoff

See MON-115-review-1.md for honest technical self-review. No task blocker remains.
Complete this child, commit task-owned files, push origin/master and verify remote
SHA/clean tree. MON-116 is next; MON-104/MON-029 retain their own acceptance.
