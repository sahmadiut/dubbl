# MON-029 attempt 1 - report and dashboard parent integration

## Identity

2026-10-09, Asia/Tehran. Operator codex; repository D:/Projects/dubbl, master.
Entry HEAD d018dc01; clean working tree. The user authorized completion and push
of one next task. Controller selected MON-029 after MON-100..105 and MON-011.
Started precisely this parent. Technical self-review only; no independent human,
accounting/statutory, production or remote-CI approval. Evidence precedes commit.

Read root/nested instructions, START_HERE, controller, project/repository map,
backend role, source migration/API requirements, ADR-006, dependency evidence and
reviews, six domain inventories, actual source services/registrations/routes and
the migrated disposable database harness. The earlier memory record about
unfinished MON-026 was stale; live task state and commits confirmed completion.

## Implementation and acceptance mapping

1. REPORT_DASHBOARD_INTEGRATION_CONTRACTS links all six complete boundary maps
   and their per-field inputs/defaults, output/envelope, units, aliases, permissions
   and ranges. It distinguishes fixed cents/two-place legacy strings, currency-
   scaled file cells, literal custom rows, physical/count/grid/date/ratio units and
   opaque JSON. No public exact-only/full-int64 capability or selector is invented.
2. New report-dashboard-integration.test.ts/worker creates one legacy numeric REST
   invoice and one exact MCP invoice above int32, both taxed at a synthetic 20%,
   and an exact MCP bill. Actual shared sendInvoice/receiveBill recognition feeds
   ledger, budget, financial, aging/contact, tax, operational, dashboard and custom
   reports in the same migrated database. Seventeen registered reader pairs and
   custom run/saved export compare actual authenticated REST and full SDK registry.
   Independent expected values distinguish net profit 2147484750, natural-sign
   budget sum 2147485250, output/input/net tax 429497000/50/429496950, gross AR/AP
   2576982000/300 and contact/forecast net 2576981700. JSON aliases and literal CSV
   agree across USD/IRR/JPY/KWD synthetic contexts. Original posted currency stays
   USD; this is fixture-only context setup, not an organization-settings operation.
3. Initial schema discovery found missing strict additionalProperties on
   budget_vs_actual. A subsequent actual SDK unknown organizationId call returned
   success, reproducing raw-shape stripping before shared service validation.
   Changed only this registration to registerTool with the full strict schema.
   The original rejection assertion now passes. Valid name/description/input/output,
   direct scoped DB logic, units, permissions and computations remain unchanged.
4. Each integrated pair checks invalid keys, denied and data-only custom readers,
   unknown organization controls and foreign tenant data/foreign contact 404.
   Keys remain scoped despite conflicting organization headers. Unsafe stored
   invoice int64 fails across aging/widget/forecast/contact/custom/export, and
   unsafe GL fails across budget/P&L/income/Schedule C/executive readers with 422
   LEGACY_NUMERIC_RANGE. Successful and failed operations preserve whole-slice
   financial/configuration/audit/notification snapshots; API-key lastUsedAt is
   explicitly excluded as authentication bookkeeping. No bigint JSON crash or
   silent precision/unit fallback occurs.
5. All linked domain operation suites were rerun rather than inferring parent
   completion from child task metadata. Their deep bounds, cancellation, dates,
   scope, exports, configuration/delivery and notification checks remain intact.
   Existing accounting defects stay assigned to PAR-008/QA-001. Manifest, matrix,
   generated source inventory and parent handoff link the current integration.

## Verification

All commands ran at D:/Projects/dubbl. Task-created PostgreSQL 16.15 trust cluster
used synthetic task_mon029, bound to 127.0.0.1:55529, UTC, with max_locks_per_transaction
256. Explicit TEST_DATABASE_URL selected it; fixtures migrated/dropped random
dubbl_ci_ databases. Final database count was zero and pg_ctl shutdown passed.
Temporary cluster files remain outside the repository. The configured application
database was not accessed. Existing delivery suites record SMTP locally; no actual
email/provider call. No schema generation, build, dev server, Docker, deployment
or production IRR flag change ran.

| Command/check | Actual result | Scope |
|---|---|---|
| Controller validate/status/next/context/start | Exit 0, valid 173 tasks, selected MON-029 | Structure and task selection |
| node --import tsx --test tests/integration/report-dashboard-integration.test.ts | Final exit 0, 1/1, no skips | Parent fixture after registration fix |
| node --import tsx --test --test-concurrency=2 with all 28 test files listed below | Exit 0, 29/29, no skips | Parent, six slices and full child operation regressions; inventory has two cases |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 359/359, no skips | Full pure/unit suite |
| pnpm typecheck | Final exit 0 | MDX/tsc, no full build |
| pnpm exec eslint lib/mcp/tools/budgets.ts tests/integration/report-dashboard-integration.test.ts tests/integration/report-dashboard-integration-worker.ts | Exit 0, clean | All changed source/test files |
| pnpm lint | Exit 0, 0 errors, 106 existing warnings | Whole repository; changed files clean |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 415 columns, 1891 scanned files, 1416 consumers, 27116 occurrences | Current lexical source inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns/1416 hashes and occurrence lines verified | Source/Drizzle gate |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks passed | Legacy usage gate |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure and whitespace |
| psql fixture database count; pg_ctl -w stop | Zero random fixture databases; exit 0, stopped | Task-owned resource cleanup |

Integration command files, each under tests/integration and with .test.ts suffix:
report-dashboard-integration, budget-report, budget-wire,
financial-report-integration, cumulative-statement, period-statement,
ledger-detail, cash-flow, compound, receivable-payable-integration, aging,
contact-statement, payment-performance, tax-report, operational-report-integration,
document-analytics, kpi-analytics, forecast-fx, bank-analytics, operational-reports,
inventory-valuation, project-billing, dashboard-report-integration, dashboard-data,
dashboard-layouts, custom-reports, report-schedules, budget-alerts.

Initial parent failures exposed the registration issue as described above.
After its repair, the final fixture currency assertion initially selected every
journal column after deliberate unsafe GL corruption; the ORM correctly refused
to decode that int64 money. Restricted this assertion's projection to currencyCode,
the field it actually checks. All monetary failure assertions remain unchanged.
Final focused and complete domain runs pass. No assertion was weakened to permit
unsupported money or unknown controls.

## Review and handoff

See MON-029-review-1.md for honest implementing-operator self-review. No blocker
remains within report contract integration. Separate calls retain separate
snapshots; shared-dataset equality is not universal economic reconciliation.
Known trial-balance defects, cash/ratio/forecast/tax heuristics, best effort SMTP,
full-int64, independent accounting/statutory, migration/performance, live browser/
session/OAuth, localization/PDF-layout and production qualification remain their
assigned gates. Complete controller criteria/submit/self-review/done, commit only
task-owned files, push origin/master, verify matching remote SHA/clean tree, query
the next task and stop. No deployment or additional task is authorized by this run.
