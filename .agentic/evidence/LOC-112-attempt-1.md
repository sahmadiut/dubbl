# LOC-112 evidence

Completed 2026-10-23 by Codex. Scope: saved/custom report presentation only.
50 paired CustomReports messages (9,327 total per locale), localized source labels,
ICU column counts, confirmations, empty states, actions and safe run failures.
See registries/CUSTOM_REPORT_CATALOGS.md for explicit machine/caller exceptions.
Column names, selected values, config bodies, exports, REST/MCP and money adapters
remain unchanged. Shared test harness adds real Dialog import and controlled
confirmation capture. Portal options/dialog content are checked through captured
production JSX; visible page content renders through real PresentationProvider.

## Validation

- node --import tsx --test tests/custom-report-catalogs.test.ts tests/custom-report-wire.test.ts tests/report-result-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts: 30 passed, zero skips.
- Production callbacks verify org header/config, failed-run non-adoption and localized fallback, save payload and confirmation interpolation; bilingual rendering verifies escaping, source values and Persian script.
- node --import tsx --test tests/integration/custom-reports.test.ts: 1 passed; actual REST/linked MCP/SQL migrated disposable PostgreSQL test.
- Temporary PostgreSQL 18 cluster in OS temp, trust auth, loopback 127.0.0.1:6492, max_locks_per_transaction=256. Fixture creates/drops randomized DB; cluster stopped in finally.
- pnpm typecheck: passed after final test additions.
- pnpm lint: zero errors, 24 existing warnings. Changed-page/test/helper eslint: passed with no findings.
- pnpm i18n:check: passed, 9,327 paired keys.
- python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,831 consumers verified.
- node .agentic/scripts/verify_legacy_money.mjs: 9 checks passed.
- git diff --check: passed.

Initial checks caught lost Persian characters from shell transport; UTF-8 output
was repaired through ASCII-escaped JSON and Persian-script assertions passed.
Initial typecheck exposed removed date helper; restored with translated Never and
title. Initial harness import/context and circular-serialization errors were
corrected before all tests passed. The first integration attempt lacked CREATEDB;
it was replaced by the successful isolated cluster without changing app data.

No full build, dev server, schema/REST/MCP/Stripe change. Persian wording remains
provisional. Native wording, full RTL/calendar/numeral, browser, full test suite,
hosted CI, deployment and LOC-070/008/002 acceptance are independent and unclaimed.
