# MON-015 attempt 1 - auxiliary and report parent integration

## Identity

2026-10-10, Asia/Tehran. Operator codex, D:/Projects/dubbl, master. Clean entry
HEAD 4f35029677fc93b5d8ce44e556222df70d9dddff. The user authorized completion and
push of one next task. Live controller selection chose MON-015 after MON-023..029;
only this parent was started. This records verified working-tree implementation
before commit, with technical self-review rather than peer/human approval.

Read repository/nested instructions, START_HERE, controller, project/repository
map, backend role, migration/API source sections, ADR-006, child review evidence,
the seven integration inventories and actual schemas/services/routes/MCP/fixtures.
Current source and operation results, not old task counts or memory, qualify the
parent. No independent accounting, statutory, migration or production approval.

## Implementation and acceptance mapping

1. AUXILIARY_REPORT_INTEGRATION_CONTRACTS joins every adopted domain boundary via
   the complete seven child maps. Inputs/defaults, outputs/envelopes, numeric and
   Minor units, safe ranges, FX, physical quantities, dates, permission/retry/period
   behavior and retained unsupported workflows remain explicit. Loan/accrual REST
   numeric decimal-major input is distinguished from MCP integer cents. Fixed
   financial strings and currency-scaled exports retain their own contracts.
2. New auxiliary-report-integration.test.ts/worker invokes actual authenticated
   Next handlers and the full MCP registry through linked SDK transports in one
   migrated disposable database. Numeric REST 1250 cents and exact MCP 2147483750
   cents create/read budget, inventory, employee, asset, loan, project and accrual
   records. REST loan/accrual 12.50 major becomes exactly 1250; exact MCP input
   never multiplies by 100. Cross-transport detail/numeric/Minor aliases agree.
3. Legacy REST and exact MCP accrual postings create two balanced real journals
   totaling 2147485000 expense cents. A new budget actual matches with zero
   variance; REST/MCP P&L loss -2147485000 matches same-currency consolidation.
   Unposted masters/plans create no additional ledger costs. Targeted replays
   across the opposite transport create no extra journal/audit. Currency changes
   reject against history rather than reinterpreting saved money.
4. Both transports reject unsafe int64 inputs and conflicting aliases, invalid
   keys, unauthorized writes and foreign root lookups. Reads preserve the current
   domain policy: authenticated-member budget/inventory/project/loan reads remain
   available, while employee/asset/accrual details require their management grant.
   API-key scope survives conflicting organization headers. Stored unsafe GL
   rejects P&L/budget/consolidation with LEGACY_NUMERIC_RANGE and no writes.
5. Initial real SDK create_budget unknown organizationId returned success,
   reproducing silent validation stripping. All five CRUD registrations now pass
   full strict schemas to registerTool. The first registration-only retry still
   failed because the shared schema itself was non-strict; making create/update/
   line/period objects strict repairs REST and nested controls too. update_budget
   removes routing budgetId before the shared body parse. Actual SDK all-five
   unknown-control calls and REST/MCP nested create/update failures preserve state;
   valid create/get/update/list/delete still work. Existing permissions, valid
   defaults, money calculations and envelopes are unchanged. Both budget UI
   writers explicitly project supported line/period fields, inspected in source.
6. One query snapshots every public table except api_key authentication usage.
   No-write assertions include all domain/reference/configuration/financial/audit
   state for accepted readers, rejected operations and keyed/targeted replays.
   Seven current domain integrations and budget/report/alert/dashboard regressions
   independently reverify deeper workflows rather than relying on child status.
   Manifest, verification matrix, budget amendment and generated inventory match
   the current source. Original parent acceptance criteria remain unchanged.

## Verification

All commands ran at D:/Projects/dubbl. Task-owned PostgreSQL 18 trust cluster,
synthetic task_mon015 role, 127.0.0.1:55515, UTC, max_locks_per_transaction=256.
Explicit TEST_DATABASE_URL selected it; each harness migrated and dropped a
random dubbl_ci_ database. The all-table assertion connection disables JIT to
avoid compilation overhead, without changing product queries/transactions.
Final database count was zero; pg_ctl fast shutdown passed. Temporary cluster
files remain outside Git. No application DB, real customer data, external
provider, live email or production environment was used by this parent fixture.

| Command/check | Actual result | Scope |
|---|---|---|
| Controller validate/status/next/context/start | Exit 0; 173 tasks valid; selected/started MON-015 | Current workflow, not accounting proof |
| node --import tsx --test tests/integration/auxiliary-report-integration.test.ts | Final focused run 1/1 passed | Parent after fixes; expanded final version also passes in combined run |
| node --import tsx --test --test-concurrency=2 with 11 files below | Exit 0; 11/11, no skips | Current parent and domain integrations/regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Final post-fix exit 0; 359/359, no skips | Full unit/pure suite |
| node --import tsx --test tests/budget-wire.test.ts tests/budget-report-wire.test.ts tests/budget-alert-wire.test.ts | Exit 0; 13/13 | Post-fix focused signed/range/calendar/threshold regressions |
| pnpm typecheck | Final post-fix exit 0 | MDX/tsc; no build |
| pnpm exec eslint lib/api/budget-wire.ts lib/mcp/tools/budgets.ts tests/integration/auxiliary-report-integration.test.ts tests/integration/auxiliary-report-integration-worker.ts | Exit 0; clean | Every changed source/test file |
| pnpm lint | Exit 0; 0 errors, 106 existing warnings | Changed files clean |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 415 columns, 1893 scanned files, 1417 consumers, 27151 occurrences | Reproducible source-only inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; columns/consumer hashes/occurrence lines verified | Source/Drizzle gate |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | Legacy money usage gate |
| git diff --check; python .agentic/agent.py validate | Exit 0 | Whitespace/controller structure |
| psql fixture database count; pg_ctl -m fast -w stop | Zero random fixture databases; exit 0, stopped | Task-owned resource cleanup |

Combined integration files, under tests/integration with .test.ts suffix:
auxiliary-report-integration, budget-wire, budget-report, inventory-integration,
payroll-integration, asset-loan-integration, project-crm-pricing,
consolidation-auxiliary-integration, report-dashboard-integration, budget-alerts,
dashboard-report-integration.

Initial fixture corrections used the actual inventoryItemId MCP field and
documented authenticated-member read policies; no new read restrictions were
introduced or expected financial values weakened. Only the unknown-control
failures above required runtime repair. No schema/migration generation, full
build, dev server, Docker, deployment or IRR flag change ran.

## Review and handoff

See MON-015-review-1.md for actual implementing-operator self-review. All three
bounded parent criteria have direct evidence. Separate calls retain separate
snapshots; the matching report fixture is not universal economic reconciliation.
Known accounting/trial-balance defects, heuristic reports, best-effort delivery,
historical remediation, full-int64, performance, migration, session/OAuth,
Persian/RTL and production qualification remain their assigned gates.
Complete controller check/submit/self-review/done, commit only task-owned files,
push origin/master with existing user authorization, verify remote SHA/clean tree,
query next task and stop. Expected next task: MON-033. No deployment or second
task is included.
