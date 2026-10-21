# LOC-092 attempt 1 - payroll settings catalogs

2026-10-21 (Asia/Tehran), Codex. Base `ba31eed6` on master; clean entry tree.
The owner requested one next task completed and pushed. Controller selected
LOC-092. Inspected AGENTS/START_HERE, project/map/frontend/controller guidance,
task/parent/dependency review, message catalog contract, relevant source sections,
production settings page, payroll adapters, configuration/time/compensation
services and wire schemas, approval-chain route/schema, existing MCP tools and
their linked integration fixtures.

## Acceptance mapping

1. Extracted authored settings copy into 124 paired `PayrollSettings` messages;
   catalogs have 8,053 compatible keys each. Persian-script assertions cover every
   new Persian value. Scope includes eight sections, five drawers, summaries,
   options, labels, empty states, feedback, confirmation and accessible delete
   labels. [Explicit exceptions](../registries/PAYROLL_SETTINGS_CATALOGS.md)
   preserve machine values, saved text, existing dollar prefixes, fixed-two
   payroll cents, clocks, units, shared controls and statutory terminology.
2. Real production JSX and next-intl/PresentationProvider render in both locales.
   Controlled hooks/IO invoke actual five creation, save and confirmed delete
   callbacks. Tests preserve exact low/max cents, money aliases, all option values,
   physical binary32 hours/premiums, basis points, clock strings, account nulls,
   endpoint/method/header/payload/omission contracts and saved text escaping.
   Negative cases cover HTTP/JSON/envelope/money/quantity/rate/clock errors,
   duplicate IDs, failed-create retention, missing organization/storage,
   atomic reads and unmounted replies. Real migrated REST/linked MCP envelopes
   also pass the reader alongside independent SQL and authorization assertions.
3. Task handoff, catalog registry, scope/exceptions and honest Codex self-review
   record provisional Persian and independent parent/native/RTL acceptance.

## Resulting behavior and preserved boundaries

All seven reads validate before adoption. Load failure hides the screen behind
translated feedback, releases loading and never displays raw diagnostics.
Successful refresh clears the error; generation guards ignore obsolete results.
Mutations require checked success before feedback/reset. Failed creates retain
form fields. Previously silent band-create HTTP failures and unchecked deletes
now get translated feedback. Confirmed deletion refreshes only after success.

No new user operation, REST/MCP/service/auth change, database/schema/migration,
stored amount, statutory rule, provider, IRR flag or Stripe source change.
Existing configuration, time and compensation MCP tools remain. Approval-chain
summary remains its pre-existing REST read; this localization does not claim
broader MCP parity or payroll-parent acceptance.

## Actual verification

All commands ran from D:/Projects/dubbl. No full build or dev server ran.

| Check | Result | Boundary |
|---|---|---|
| Focused catalog/rendering/callback, config wire, UI money and catalog foundation | 26/26 pass, zero skips; final run 5.644 seconds | Production JSX with real translations; controlled hooks/IO |
| Migrated configuration, time and compensation fixtures | 4/4 pass, zero skips; 41.932 seconds | Real REST/linked MCP, independent SQL, auth and legacy contracts |
| pnpm typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 8,053 keys per locale | Key/ICU contracts, not native terminology approval |
| Owned-file ESLint | Exit 0; zero errors/warnings | Page, reader, focused/guard tests and three workers |
| Full lint | Exit 0; zero errors, 26 existing warnings outside owned files | OS-temp cache; removed an unused settings icon import |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,403 scanned paths, 1,794 consumer hashes; nine legacy checks | No schema classification or stored money change |
| Catalog/inventory scope and staged hashes | All index consumer hashes match; only new namespace, task-owned consumers and the pre-existing stale members entry differ | Verified before closure/commit |
| New registry/evidence links, controller validation and diff check | Pass | Repeated after closure |

```text
node --import tsx --test tests/payroll-settings-catalogs.test.ts tests/payroll-config-wire.test.ts tests/payroll-ui-money.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-config.test.ts tests/integration/payroll-time.test.ts tests/integration/payroll-compensation.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/settings/page.tsx" i18n/payroll-settings-presentation.ts tests/payroll-settings-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-config-worker.ts tests/integration/payroll-time-worker.ts tests/integration/payroll-compensation-worker.ts
pnpm lint --cache --cache-location <OS-temp>/dubbl-loc092-eslint.cache
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database tests used process-scoped TEST_DATABASE_URL/PG_BIN and a new isolated
PostgreSQL 18 cluster under OS temp at 127.0.0.1:6458, trust authentication and
max_locks_per_transaction=256. Fixtures created/dropped randomized databases;
the final admin query found zero dubbl_ci_* databases and pg_ctl stopped the
cluster successfully. No application database or credentials were used.

The first Persian-script assertion rejected an interpolation-only Persian
template before writing catalogs; it was made a natural Persian phrase. The
first negative reader test exposed HTTP-200 band envelopes carrying an error
field. The reader now rejects these; all 26 final checks pass. Review also
aligned settings quantity bounds with the existing binary32 wire schema, which
allows finite exactly representable overtime values above the safe-integer range.

Staged scope verification found that HEAD's money inventory still recorded the
old settings/members source hash, although the font edit was already committed
at task entry. Regeneration refreshes only that inventory entry to the actual
committed source. The staged members source is byte-identical to HEAD; this task
does not modify it. The scope assertion was corrected to account for the two
owned catalog consumers and this metadata-only refresh. A trailing blank test
line found by the staged diff check was removed before final verification.

## Review and handoff

See [Codex self-review](LOC-092-review-1.md). This is self-review, not independent
peer/human/native/statutory approval. Persian wording, independent LOC-067/008/002
combined acceptance, complete RTL/calendar/numerals, mounted browser/keyboard,
hosted CI, deployment and production qualification remain separate. The full
unit suite and payroll-parent integration were not run; focused checks match
this bounded screen. Commit/push and actual remote parity follow controller
closure and scoped staging.
