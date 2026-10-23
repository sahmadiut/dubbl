# LOC-113 scheduled report catalog evidence

Completed 2026-10-23 by Codex on master. Clean working tree at entry. Scope:
app/(dashboard)/reports/schedules/page.tsx and its catalog/tests/registries.

## Acceptance mapping

1. Extracted 52 paired ScheduledReports messages, including all authored page
   copy, timing templates, weekdays, controls, validation and status. Explicit
   caller/machine/date/email exceptions and provisional terminology are in
   registries/SCHEDULED_REPORT_CATALOGS.md. Total 9,379 messages per locale.
2. Production JSX renders through PresentationProvider in both locales; actual
   captured portal JSX checks labels/options and canonical values. Callback tests
   verify organization headers, recipient splitting, four frequencies, conditional
   numeric days, format/time values, success/reset/refresh, client validation and
   HTTP/network fallback with form retention. No money arithmetic, export,
   REST/MCP/schema or Stripe changes. Existing shared service MCP remains intact.
   Corrected list limit from unsupported 200 to supported 100; no pagination UI.
3. Scope registry, task handoff and this evidence retain independent
   LOC-070/008/002 acceptance and native/RTL qualification boundaries.

## Verification

All commands ran from D:\Projects\dubbl.

- node --import tsx --test tests/scheduled-report-catalogs.test.ts tests/report-schedule-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts: 25 passed, zero failures/skips.
- node --import tsx --test tests/integration/report-schedules.test.ts: 1 passed, actual REST/linked MCP, SQL and recorded delivery on migrated disposable PostgreSQL.
- PostgreSQL 18 unique OS-temp cluster, trust auth, loopback 127.0.0.1:6493, max_locks_per_transaction=256; explicit TEST_DATABASE_URL. Fixture-created random database dropped; SQL confirmed zero dubbl_ci_* databases. Cluster stopped in finally. No application DB credentials/data used.
- pnpm typecheck: passed, repeated after final test assertions.
- pnpm lint: zero errors, 24 existing warnings outside owned files.
- pnpm exec eslint on the page and new test: passed without findings.
- pnpm i18n:check: 9,379 paired keys passed. Persian-script assertions passed.
- python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,832 consumer hashes passed after final edits.
- node .agentic/scripts/verify_legacy_money.mjs: nine regression checks passed.
- git diff --check: passed before submission.

The first extraction script stopped on a prose match before writing files; a
UTF-8 file-based script completed extraction and was removed. No unfinished
generator or background process is included.

## Review and handoff

See LOC-113-review-1.md for honestly attributed Codex self-review. No full build,
dev server, browser, full repository test suite, hosted CI, deployment or
production qualification claimed. Runtime date formatting and existing list
failure handling remain unchanged; only first-page scheduling data is requested.
Native Persian wording, full RTL/calendar/numeral/output qualification and
LOC-070/008/002 integration acceptance remain open. Next task is controller-selected
after closure; commit/push synchronization is verified separately.
