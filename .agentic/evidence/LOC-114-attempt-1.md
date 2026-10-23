# LOC-114 consolidation and report pack catalog evidence

Completed implementation 2026-10-23 by Codex on master, clean tree at entry.
Scope: consolidation/page.tsx and pack/page.tsx under app/(dashboard)/reports/,
paired catalogs, focused tests, scope registry and regenerated money inventory.

## Acceptance mapping

1. Extracted 37 ConsolidationReports and 14 ReportPack messages, paired in
   en-US/fa-IR, including ICU names/date range/group totals and accessible removal
   labels. Catalog validation finds 9,430 keys per locale. Persian-script
   assertions pass. Explicit machine/caller/output exceptions are recorded in
   registries/CONSOLIDATION_PACK_CATALOGS.md.
2. Production JSX renders under real PresentationProvider/next-intl in both
   locales. Tests cover empty states, both report tabs, escaped caller data,
   account group totals, exact values beyond Number.MAX_SAFE_INTEGER, unchanged
   CSV columns/raw-unit strings, tab/date/basis callbacks, group creation payload
   and organization header, localized report HTTP/network/malformed-data failures,
   and stale-request suppression. Pack links retain dates/basis/format contracts.
   Existing REST/MCP suites verify scoped configuration/report operations and
   financial report/workbook parity. No REST/MCP/schema/Stripe changes.
3. Task handoff and scope registry retain provisional Persian wording and
   independent LOC-070/008/002, native terminology, full RTL and release gates.

## Verification

Commands executed from D:\Projects\dubbl:

- node --import tsx --test tests/consolidation-pack-catalogs.test.ts tests/consolidation-report-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts: 26 passed, zero failures/skips.
- node --import tsx --test --test-concurrency=1 tests/integration/consolidation-config.test.ts tests/integration/consolidation-report.test.ts tests/integration/financial-report-integration.test.ts: three passed, actual REST/linked MCP, SQL, rollback/concurrency and workbook checks.
- PostgreSQL 18 unique OS-temp cluster at loopback 127.0.0.1:6494, trust auth,
  max_locks_per_transaction=256; explicit TEST_DATABASE_URL. Test-created random
  databases dropped; SQL confirmed zero dubbl_ci_* databases, cluster stopped in
  finally. Application database and credentials were not used.
- pnpm typecheck: passed after correcting test fixture typing.
- pnpm lint: zero errors, 24 existing warnings outside changed files.
- pnpm exec eslint on both pages and focused test: passed without findings.
- pnpm i18n:check: 9,430 paired keys passed.
- python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,833 consumer hashes passed.
- node .agentic/scripts/verify_legacy_money.mjs: nine checks passed.
- git diff --check and controller validation: passed before closure.

Initial focused runs exposed fixture issues (missing browser organization context,
escaped apostrophe expectation and incomplete typed report fixture); corrected
test setup/expectations and independently asserted exported strings/columns.
The extraction script initially missed an ICU label parameter; diff inspection
corrected it before the successful focused run. Temporary script was removed.

## Limits and handoff

See LOC-114-review-1.md for Codex self-review. No full build, dev server, browser,
full repository test run, hosted CI, deployment or production acceptance claimed.
Native Persian wording, full RTL/calendar/numeral/currency/output qualification
and independent combined parent acceptance remain open. Existing group management
failure behavior is unchanged. Commit/push parity is verified after closure.
