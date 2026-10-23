# LOC-124 background and residual catalog extraction

2026-10-24 (Asia/Tehran). Operator: Codex. Began on clean master at
abb92d1fc07f15f02776521b3e6ec0e28db77a85. Selected only controller-next LOC-124;
fetched origin and confirmed HEAD/origin/master parity before committing.

## Acceptance mapping

1. Added 61 paired `Background` keys and an explicit-locale internal translator.
   Extracted immediate/digest email delivery text, budget and low-bank-balance
   notices, scheduled report email content, recurring invoice/remittance/statement
   subjects and remittance HTML, contact statement HTML labels and shared
   statement-export captions.
   BACKGROUND_CATALOGS.md maps Trigger, notification, maintenance, lib/API/MCP,
   report, reminder, template, diagnostic and provider exceptions. Existing
   delivery callers retain English, matching LOC-123's extraction boundary.
2. Added six focused tests for paired keys/Persian script, English compatibility,
   actual bilingual email rendering, relative-time boundaries/pluralization,
   escaped report HTML, exact-money string preservation and real XLSX/PDF output.
   Seven existing disposable migrated REST/registered MCP/SQL suites pass across
   both alert paths, report delivery, contact statements, period statement exports
   and recurring invoice generation. The additional payment-batch suite verifies remittance delivery. Catalog/static/controller/money checks pass.
3. Registry, catalog index, handoff and honest self-review explicitly retain
   provisional Persian wording and independent LOC-009/LOC-002 acceptance. No
   native, RTL, browser, recipient locale delivery, Persian PDF or release claim.

No routes, REST/MCP input/output schemas, auth/organization checks, financial
calculations, stored history, migrations, flags or Stripe files were changed.
Money inventory was regenerated for changed source hashes/line references and
the new helper/test; all 417 schema classifications remain identical.

## Verification

Repository root: D:\Projects\dubbl. No build or dev server was run.

| Command | Result |
|---|---|
| `node --import tsx --test tests/background-catalogs.test.ts tests/output-catalogs.test.ts tests/budget-alert-wire.test.ts tests/contact-statement-wire.test.ts tests/period-statement-wire.test.ts` | 26 passed, zero failed/skipped; 1.76 seconds |
| `node --import tsx --test --test-concurrency=2 tests/integration/bank-accounts.test.ts tests/integration/budget-alerts.test.ts tests/integration/report-schedules.test.ts tests/integration/contact-statement.test.ts tests/integration/recurring-invoices.test.ts tests/integration/period-statement.test.ts` | Six passed, zero failed/skipped; 30.22 seconds |
| `node --import tsx --test tests/integration/payment-batches.test.ts` | One passed; 9.73 seconds; same UTC disposable DB fixture |
| `pnpm i18n:check` | Passed; 10,003 compatible keys per locale |
| `pnpm typecheck` | Exit 0 on final source; initial export fixture type errors corrected and rechecked |
| `pnpm lint` | Exit 0; zero errors, 20 existing warnings in unrelated files |
| Changed-file `pnpm exec eslint` over helper, test and all ten changed production services | Exit 0, no warnings/errors |
| `python .agentic/scripts/money_inventory.py --write` | Regenerated source inventory; 417 classifications unchanged |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; all 417 columns, 1,845 consumer hashes and source references verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate`, `git diff --check` | Exit 0 |

Initial Persian catalog writes through the Windows shell produced question marks;
the new script-integrity assertion caught them. Replaced the content via UTF-8
patching and reran successfully. Initial catalog validation caught differing ICU
plural contracts; both locales now declare matching selectors/interpolations.
The expected initial source-inventory drift was resolved by regeneration.

The first five-suite integration run passed four suites; bank daily deduplication
failed with the OS-default Asia/Tehran PostgreSQL session near the UTC day boundary
(10 notifications versus the expected one). The temporary cluster was set to UTC,
the test process used TZ=UTC, and all six final suites passed. Existing timestamp-
without-time-zone/day-boundary behavior was not changed in this catalog task;
cross-timezone qualification remains open. This is not evidence of Tehran-time
deduplication acceptance. An initial export test fixture omitted the required row depth and passed a Node Buffer to an ArrayBuffer-typed ExcelJS API. Typecheck caught both issues. The fixture now supplies depth=0 and a sliced ArrayBuffer; the final export test passes without the initial PDF margin warning. PDF visual layout is not accepted by this test.

The database run used a unique OS-temp PostgreSQL 18 cluster, trust auth,
127.0.0.1:4734 and max_locks_per_transaction=256. TEST_DATABASE_URL and PG_BIN were
explicitly process scoped. Fixtures created/dropped randomized dubbl_ci databases;
final admin SQL reported zero remaining fixture databases and pg_ctl stopped the
cluster. No application DB or live provider was used.

## Review and handoff

Codex self-review only; separate review record follows. No new user operation
requires a new MCP tool. Existing direct scoped service registrations are retained
and exercised by integration suites. Remaining output language activation, native
wording, email-client/RTL and timezone/PDF qualification belong to later tasks.
LOC-009 and LOC-002 stay independent. No blocker to this extraction task.
