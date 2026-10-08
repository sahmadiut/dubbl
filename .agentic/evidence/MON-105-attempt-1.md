# MON-105 attempt 1 - combined dashboard and saved report integration

## Identity and scope

2026-10-08, Asia/Tehran. Operator: codex. Entry master HEAD
`4287f927322ccdf4c0fe2035487d4db930a657fa`, clean working tree. Live controller
validate/status/context/next selected MON-105 after all five split children;
start assigned codex. Read root/nested AGENTS, START_HERE, controller, project/
repository map, backend role, original task, MON-011 and MON-119..123 evidence,
ADR-006, money manifest, actual services/REST/MCP/Trigger consumers and fixtures.
One integration parent only; no unrelated work or child evidence changed.
Self-review only. Changes are uncommitted when this evidence is written.

## Implementation and integration result

- Added `DASHBOARD_REPORT_INTEGRATION.md`: complete map of 25 REST/MCP pairs,
  related budget threshold CRUD, actual scheduled report/budget consumers,
  envelopes, units, aliases, JSON/range limits, permissions and delivery limits.
  Existing detailed child contracts and acceptance remain intact. Added parent
  manifest pointer and refreshed the machine money inventory.
- Added a disposable-database harness and combined SDK worker using
  `registerAllTools`. Tool discovery asserts all 25 registrations/descriptions
  and their top-level field descriptions. REST authenticates actual scoped keys,
  including foreign header spoofing, denied custom permissions and invalid keys.
- Actual legacy REST and exact MCP invoice writers create 1250-unit documents;
  a foreign MCP writer creates its own 777-unit document. Existing numeric/exact
  bill and bank writers supply related dashboard readers. Explicit fixture status
  setup characterizes all-status widgets versus overdue action alerts without
  claiming invoice posting/lifecycle qualification.
- Saved layout creation/read/list preserves opaque numeric 1250 and literal
  int64 strings unchanged. Documented widget filters from that stored layout feed
  all five REST/MCP widgets; invoice/bill totals are 2500, bank balance 1250 and
  low-stock count 1. Action alerts separately expose invoice 2500 and exclude
  draft bills. Shared financial snapshots remain unchanged.
- A report saved through REST and read through both transports feeds actual
  runner/export/schedule creation/delivery. Two source rows each retain numeric
  total/amountDue 1250 with agreeing Minor strings. Recorded CSV bytes equal
  REST/MCP export; scheduled XLSX carries monetary text cells. Persisted filter
  edits produce empty run output and header-only scheduled CSV; restoration
  restores two rows. Concurrent due processor calls send one occurrence locally.
- A journal created/posted through real REST handlers feeds numeric REST and
  exact MCP budgets. Both evaluate actual 1250, budget 1000 and threshold 500;
  two owner notifications carry the expected USD 12.50/10.00 body. Scoped SDK
  replay and internal checkBudgetVariances report zero new recipients. Financial
  state is unchanged by notification writes; foreign checks return no local data.
- The first combined run failed because get_dashboard_receivables stripped an
  unknown organizationId and returned success. Converted all six dashboard tools
  from raw shapes to full strict object registration. Invalid unknown controls
  now reject, including currencyCode on nonmonetary tools. Names, descriptions,
  valid currency inputs, permissions, units and shared direct-DB logic remain.
- Unsupported invoice int64 history fails across dashboard alerts/widgets,
  runner/export, schedule trigger/create and actual REST readers/delivery without
  changing financial/config/audit/notification rows or recorded mail count.
  Corrupt saved grouping rejects export/delivery/PATCH without repair. Unsafe GL
  activity rejects scoped and scheduled budget checks without side effects.
  Deleting the saved report through its real MCP operation causes manual and
  due scheduled delivery to fail 404 without sending or advancing run metadata.

## Acceptance mapping

1. DASHBOARD_REPORT_INTEGRATION links every dashboard/layout/report/schedule/
   budget-check boundary and related threshold/scheduled consumers to their
   detailed maps. Monetary numeric/Minor aliases, fixed cents versus bank units,
   physical/count/percent/grid/timing units, opaque JSON and safe ranges are
   explicit. No int64 financial capability follows from an opaque layout string.
2. The combined real REST/API-key/full-registry SDK fixture covers actual legacy
   and exact writers, cross-domain dispatch, stored config updates, attachments,
   notifications, scoped worker replay and authorization/tenant isolation. All
   five child suites plus budget CRUD/report regression pass in the same run;
   those retain every operation/source, currency and negative case.
3. First failure reproduced strict-input parity loss; full strict dashboard
   schemas fix it without relaxing assertions. Parent/child fixtures verify
   invalid controls before writes, unsupported stored JSON/config/date/money,
   signed/safe limits, literal precision, no bigint serialization crash and
   unchanged failed-operation snapshots. Metadata, delivery and alert operations
   preserve financial rows. API-key lastUsedAt is outside these snapshot claims.

## Verification

All commands ran in D:/Projects/dubbl. New PostgreSQL 18 trust cluster used
synthetic task_mon105 on 127.0.0.1:55525 with UTC timezone and explicit
TEST_DATABASE_URL. Fixtures created/migrated/dropped random dubbl_ci_ databases;
the application DATABASE_URL was not read or used. The harness passed each
temporary URL only to its worker/migration process. SMTP transport was replaced
with a local recorder; Resend and Stripe secrets were empty in workers. No mail
or external provider request occurred. Cluster shutdown succeeded; its temporary
files remain outside the repository, without deleting application data.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/next/start | Exit 0, selected MON-105, valid 173 tasks | Structural, not financial proof |
| node --import tsx --test --test-concurrency=1 tests/integration/dashboard-report-integration.test.ts tests/integration/dashboard-data.test.ts tests/integration/dashboard-layouts.test.ts tests/integration/custom-reports.test.ts tests/integration/report-schedules.test.ts tests/integration/budget-alerts.test.ts tests/integration/budget-wire.test.ts tests/integration/budget-report.test.ts | Exit 0, 8/8, no skips | Parent, all five children, two budget regressions |
| node --import tsx --test tests/integration/dashboard-report-integration.test.ts | Final exit 0, 1/1 | Final extra opaque preservation and actual report-deletion assertions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 359/359, no skips | Complete unit suite |
| pnpm typecheck | Final exit 0 | MDX and tsc, no Next build |
| pnpm exec eslint lib/mcp/tools/dashboard-data.ts tests/integration/dashboard-report-integration.test.ts tests/integration/dashboard-report-integration-worker.ts | Final exit 0, no warnings/errors | All changed code |
| pnpm lint | Exit 0, 0 errors/106 existing warnings | Warnings outside changed code |
| python .agentic/scripts/money_inventory.py --write; then without --write | Exit 0 | 415 columns, 1869 scanned files, 1399 consumers, 26531 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, hashes and source occurrences match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy gate regression |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure and whitespace |
| pg_ctl -w stop for task cluster | Exit 0, stopped | Fixture resource cleanup |

Initial typecheck found an inferred optional undefined currencyCode incompatible
with URLSearchParams; explicitly typed the test's string filter map. The first
DB failure reproduced the actual raw-shape SDK validation defect described above.
Final checks pass with both corrected, without changing valid financial behavior.

## Review and limitations

See MON-105-review-1.md for actual self-review. No remaining blocker in MON-105.
No schema/migration generation, full build, dev server, Docker, live Trigger,
provider request, deployment, visual PDF-fit check or production IRR change ran.
PostgreSQL 16, high-volume performance, independent accounting/Persian/migration/
production qualification and MON-029 broader integration remain separate.
SMTP partial acceptance/crashes lack a persistent outbox/exactly-once guarantee;
post-commit budget email/digest delivery remains best effort without durable retry.
Existing full-int64 financial bridge limits and explicit data remediation remain.

## Handoff

Finish controller check/submit/self-review/done using these evidence files; stage
only task-owned files, commit/push origin/master under the user's instruction,
verify matching remote SHA/clean tree, query the next task and stop. MON-029 retains
its original independent report integration and qualification acceptance.
