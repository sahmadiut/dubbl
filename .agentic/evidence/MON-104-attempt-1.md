# MON-104 attempt 1 - combined operational analytics integration

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry master HEAD
`5a1d1e5e7e0a1ffdde606ee31e5589fc6efd4f3a`; working tree clean at entry.
Controller selected and started MON-104 after all five child dependencies resolved.
Technical self-review only; no independent human/accounting or production approval.

## Implementation and observed behavior

Read root/nested instructions, controller/project/repository map, backend role,
MON-104, dependency evidence, ADR-006, money manifest, child contract maps and
actual REST/MCP/services. Retained the five implemented slices and previously
adopted inventory valuation, with no duplicate business implementation.

- OPERATIONAL_REPORT_INTEGRATION maps fifteen primary REST/MCP readers, their
  units/aliases, input/default/range details via child maps, existing exports,
  and the separately adopted project-profitability branch. MONEY_MANIFEST and
  generated MONEY_BOUNDARIES point to current integration and source facts.
- Three sales/spend MCP readers now register the full strict Zod object. Their
  former raw-shape registration silently removed unknown controls before the
  shared service could reject them. Full SDK registration verifies strict input
  schemas and unknown-input errors across all fifteen tools.
- Shared inventoryValuationReport now requires view:data, uses repeatable-read
  read-only transactions, and validates supported uppercase organization currency
  even when no item is present. Its REST route rejects duplicate controls.
  Existing price projections, separate carrying value, sorting and configured
  cost semantics remain. Original inventory fixture now asserts both REST/MCP
  denial for a custom role without view:data, replacing its previous allowed read.
- New migrated-database parent fixture registers all MCP tools and invokes real
  API-key report handlers and linked SDK clients. REST numeric invoice and MCP
  exact invoice/bill writers create a shared document dataset. A real REST entry
  writer/posts mixed numeric/Minor journal lines. Bank/stock/foreign-tenant rows
  are synthetic fixtures. Every saved amount stays unchanged when currency tags
  are varied through USD/IRR/JPY/KWD solely inside the disposable fixture.
- Independent assertions connect sales/spend/profitability, expense/monthly/
  executive KPIs, forecast/calendar/duplicates, bank cash/status/patterns and
  inventory book versus price values. Numeric/Minor aliases are recursively
  checked, including sparkline arrays. Separate tenant results, key/header org
  scope, invalid keys, denied permissions, strict/duplicate controls, unsafe
  inventory and invalid saved currency preserve domain/ledger/audit snapshots.
  API-key lastUsedAt bookkeeping is intentionally outside those snapshots.

## Acceptance mapping

1. All report boundaries link to detailed documented inputs/defaults, outputs,
   units, aliases and public safe numeric ranges. Primary table has fifteen
   reader pairs; preserved project grouping has a separate project contract.
2. Actual numeric REST/exact MCP writers feed all fifteen actual REST/MCP report
   comparisons in one dataset, including four currency contexts, two tenants,
   auth failures and missing custom-role permission. Existing project branch and
   every child suite are reverified, including exports and deep negative cases.
3. Unknown controls, duplicated REST parameters, unsupported inventory currency
   and unsafe money fail visibly. No bigint serialization exception, silent
   precision loss, unit rescale or financial mutation follows report calls.
   Child suites retain signed cancellation/range, saved corruption, recurrence,
   FX rate, mixed-currency and binary-export precision assertions.

## Verification

All commands ran at D:/Projects/dubbl. Created a task-owned synthetic PostgreSQL
16.15 cluster outside the repo, listening only on 127.0.0.1:55504 with UTC timezone.
Explicit TEST_DATABASE_URL targeted it; harnesses migrated and dropped randomly
named disposable databases. The application database was not queried or changed.
Stopped the task-owned cluster after verification; temporary cluster data remains
outside the repository. No application data was reset or deleted.

| Command/check | Actual result | Limit |
|---|---|---|
| node --import tsx --test tests/integration/operational-report-integration.test.ts | Initial 1/1, exit 0 | Before upgrading document setup to real public writers |
| node --import tsx --test --test-concurrency=1 tests/integration/operational-report-integration.test.ts tests/integration/document-analytics.test.ts tests/integration/kpi-analytics.test.ts tests/integration/forecast-fx.test.ts tests/integration/bank-analytics.test.ts tests/integration/operational-reports.test.ts tests/integration/inventory-valuation.test.ts tests/integration/project-billing.test.ts | Final 9/9, exit 0; no skips | Parent, all five children, two inventory cases and project branch; PostgreSQL 16 |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | 359/359, exit 0; no skips | Full unit suite |
| pnpm typecheck | Final exit 0 | MDX/tsc; no Next build |
| pnpm exec eslint on four changed services/tool files, valuation route and three changed fixtures | Final exit 0; clean | Changed source/test files |
| pnpm lint | Exit 0; 0 errors, 106 warnings in unchanged files | Existing repository warning debt |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1397 consumer files, 26490 occurrences | Source inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle exports, hashes and source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Legacy-money gate |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure/whitespace |

The initial typecheck found a test-only TS7022 inferred-variable error in the
recursive alias assertion. An explicit unknown annotation fixed it; final
typecheck passed after all source/test edits. No assertion was weakened.

## Review and handoff

See MON-104-review-1.md for identified self-review. MON-029 retains broader report
integration; independent accounting, full-int64 business range, migration,
performance, browser/session/OAuth, localization and production/IRR gates remain
separate. Cross-report equality applies to the specified matching synthetic
dataset, not universal ledger/document reconciliation. Existing document snapshots,
forecast/bank/duplicate heuristics and inventory carrying/price distinctions stay
documented. No schema/migration/posted-history/IRR rollout change; no full build,
dev server, Docker, provider call or deployment. Stop after this task is committed,
pushed and remote synchronization verified.
