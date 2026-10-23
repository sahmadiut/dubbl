# LOC-008 independent combined acceptance evidence

2026-10-23 (Asia/Tehran). Operator: coding-assistant (Codex). Started on master
with a clean tree at 9f30c3916c011e5f231c399d73ae248d30bc022f; fetched origin and
confirmed matching origin/master before implementation. Selected and started
only the controller's next task, LOC-008.

## Acceptance mapping and changes

1. Read LOC-008, six completed child scopes/evidence and current components.
   Reconciled all 101 route TSX files (18 inventory, 27 payroll, 11 projects,
   seven CRM, 34 reports, two dashboard, two documents), 56 distinct namespaces
   and 3,442 paired messages. OPERATIONS_CATALOG_ACCEPTANCE.md records domain
   ownership and explicit shared, saved-data, statutory, output, formatting and
   DEC-008 exceptions. The direct dashboard imports reconcile to 17 components;
   seven residual cross-module primitives receive independent parent source
   checks. Existing UI primitives/date/currency/contact and nested drawer/widget
   ownership were inspected. No further product copy needed extraction.
2. Added operations-catalog-integration.test.ts: exact route/import inventory,
   residual AST display-copy/key checks, and real PageHeader, Section, EmptyState,
   DateRangeFilter, ExportButton and BudgetProgressBar composition through real
   next-intl/PresentationProvider in both locales. Checks include active-locale
   actions/presets, escaped caller content, and distinct large exact budget cents
   with the historical fixed-two KWD label. Reran all six combined child tests
   and selected current catalog suites, plus migrated REST/registered MCP/SQL
   integrations spanning all six domain groups.
3. Scope registry, catalog index, task handoff and separate honest self-review
   retain provisional Persian wording and independent LOC-002 whole-product,
   LOC-009 output and native/RTL/calendar/numeral/browser/release acceptance.
   Completed child files/evidence are unchanged.

Only the new parent test, combined registry, catalog-index link, generated money
inventory, task and unique evidence/review change. Product components/catalogs,
REST/MCP/services/auth/schema/migrations, financial history/scales, IRR flags and
Stripe are unchanged. Money inventory changes only scanned_paths and consumers
for the new test; column classification and existing records remain unchanged.
No new operation requires a new MCP registration; existing domain registrations
and direct scoped services are exercised rather than replaced by HTTP mocks.

## Verification on current source

| Command | Actual result |
|---|---|
| Focused catalog selection below, node --import tsx --test --test-concurrency=1 @focused | 56 files; 390 passed, zero failures/skips/cancellations; 260.971 seconds |
| node --import tsx --test tests/operations-catalog-integration.test.ts | Final 3/3 pass; 5.176 seconds |
| Integration selection below, node --import tsx --test --test-concurrency=2 @integration | Final 13/13 pass, zero failures/skips/cancellations; 72.130 seconds |
| pnpm typecheck | Final exit 0; MDX generation and tsc --noEmit |
| pnpm i18n:check | Exit 0; 9,660 compatible keys in each locale |
| pnpm exec eslint tests/operations-catalog-integration.test.ts | Exit 0; zero findings |
| pnpm lint | Exit 0; zero errors, 21 existing warnings outside owned files |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 417 columns, 2,450 scanned files, 1,840 consumers |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; all 417 columns and 1,840 consumer hashes/source occurrences verified |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks passed |
| python .agentic/agent.py validate | Valid; 351 tasks |
| git diff --check | Exit 0 |

Reproduce focused selection in PowerShell:

```powershell
$focused = Get-ChildItem tests/*catalog*.test.ts | Where-Object { $_.Name -match '^(inventory|warehouse|payroll|project|crm|report|income|balance-cash|ledger|aging-vendor|analytical|forecast-calendar|tax-report|banking-report|custom-report|scheduled-report|consolidation-pack|dashboard|document|operations|message)' } | ForEach-Object FullName
node --import tsx --test --test-concurrency=1 @focused
```

Integration files under tests/integration/: inventory-integration, payroll-integration,
project-master, project-billing, project-crm-pricing, crm,
financial-report-integration, operational-report-integration,
auxiliary-report-integration, report-dashboard-integration, dashboard-data,
dashboard-report-integration and document-rendering (each .test.ts).

Final integration used a unique OS-temp PostgreSQL 18 cluster initialized with
explicit UTF8 encoding, trust auth, 127.0.0.1:57823 and
max_locks_per_transaction=256. TEST_DATABASE_URL and PG_BIN were explicitly
process-scoped. Each suite migrated a random disposable database. Final admin
SQL counted zero dubbl_ci_ databases and pg_ctl stopped the server. No application
database or credentials were used. SMTP is mocked; no provider mail was sent.
Logs: OS-temp dubbl-loc008-focused.log, dubbl-loc008-integration-utf8.log,
dubbl-loc008-typecheck.log and dubbl-loc008-lint.log.

## Corrected attempts and review limits

Initial test expectations incorrectly used KWD's currency scale for the legacy
fixed-two budget surface; source inspection corrected the expected cents without
changing product arithmetic. Typecheck caught the required Section children prop;
passing it explicitly fixed the test. The final focused/typecheck runs passed.
A quoted ripgrep expression was parsed incorrectly by PowerShell and searched
outside the intended source roots; it was stopped and replaced by bounded Python
source/import inspection. No files were changed by that search.

Initial initdb logging inside its target directory made the directory nonempty;
moving the log outside the data directory fixed initialization. Windows' default
WIN1252 database encoding then rejected Unicode email content in document-rendering
(12/13 initial integrations passed, and an isolated retry reproduced it). Replacing
the disposable cluster with explicit UTF8 fixed it; all 13 suites passed on the
new cluster. Both running test clusters were checked for leftover databases and
stopped. No product regression or unresolved task-owned failure remains.

This is catalog extraction/integration acceptance, not complete financial or
backend operation parity qualification. Child-documented response, list-management,
timer-save, generated output and technical-data boundaries remain explicit.
Controlled hooks/IO/portals/charts do not qualify mounted effects, browser/keyboard,
full RTL or real SMTP/S3 delivery. No full build, dev server, full repository test
run, hosted-CI, deployment or native linguistic approval is claimed. Only an
honest Codex self-review is recorded. Commit/push synchronization is verified
after controller closure; report next selection and stop.
