# LOC-009 independent public/output/background acceptance - 2026-10-24

Operator: codex-loc009, fresh owner-authorized Codex worker. Baseline: clean
master c5ac4eb3c3f308c8716e982e051a1ec1eeb3dc02. Read applicable instructions,
controller/project/repository map, LOC-009, child evidence and actual source.
The controller selected and started LOC-009 with every dependency resolved.
Exactly this task is accepted; LOC-002 remains independent.

## Acceptance 1: source and exception audit

The existing production implementation satisfies the bounded extraction scope.
Added registries/PUBLIC_OUTPUT_CATALOG_ACCEPTANCE.md, linked from MESSAGE_CATALOGS,
to consolidate 927 extracted keys across signing, portal, landing/help, output
and background ownership. Audited actual pages, translators, email/document
renderers, notifications, delivery services and Trigger dispatcher against child
inventories. Existing catalogs are reused without duplicate translation or product
changes. Paired MDX is existing help content. Explicit exceptions retain user data,
historical snapshots/templates, machine/API/MCP/report contracts, provider errors,
date/money formatting, English delivery defaults and frozen Stripe flow under
DEC-008. No missing owned prose outside those recorded boundaries was found.

No REST/MCP operation, authorization, DB schema, financial calculation, currency
scale, history, IRR readiness flag or Stripe file is changed. No new user operation
requires a new MCP tool. Generated MONEY_BOUNDARIES adds only the new test plus
the pre-existing LOC-122 landing composition test now discovered by regeneration;
all 417 schema classifications are preserved.

## Acceptance 2: independent combined verification

New tests/public-output-catalog-integration.test.ts composes independently built
invoice data through the real portal wire reader, production portal layout/list,
signing SSR, document HTML, document email and notification digest. Interleaved
Persian/English/Persian renders cover USD/JPY/KWD/IRR at MAX_SAFE_INTEGER, exact
money preservation, frozen IDs/dates, escaped caller text, unchanged navigation
and token paths, no wire-data mutation and no translation/context/markup diagnostics.
Persian rendering cannot alter later default-English email or worker messages.
The production fetch effect rejects disagreeing monetary aliases without adopting
invalid rows and clears loading with a localized reviewed error. Framework I/O,
React state/effects and signing service data are controlled; actual next-intl,
PresentationProvider, wire validation, UI primitives and renderers execute.

Commands run from D:/Projects/dubbl:

- `node --import tsx --test --test-concurrency=1 tests/public-output-catalog-integration.test.ts tests/public-signing-catalogs.test.ts tests/public-portal-catalogs.test.ts tests/landing-help-integration.test.ts tests/landing-shell-catalogs.test.ts tests/landing-features-catalogs.test.ts tests/pricing-legal-catalogs.test.ts tests/docs-metadata-catalogs.test.ts tests/landing-activity.test.ts tests/output-catalogs.test.ts tests/background-catalogs.test.ts tests/document-render-wire.test.ts tests/budget-alert-wire.test.ts tests/contact-statement-wire.test.ts tests/period-statement-wire.test.ts`:
  58/58 passed, no failed/skipped tests, exit 0 (40.12 seconds).
- `node --import tsx --test --test-concurrency=1 tests/integration/invoice-signatures.test.ts tests/integration/public-portal-wire.test.ts tests/integration/document-rendering.test.ts tests/integration/bank-accounts.test.ts tests/integration/budget-alerts.test.ts tests/integration/report-schedules.test.ts tests/integration/contact-statement.test.ts tests/integration/recurring-invoices.test.ts tests/integration/period-statement.test.ts tests/integration/payment-batches.test.ts`:
  10/10 passed, no failed/skipped tests, exit 0 (105.25 seconds). Real REST,
  registered MCP and independent SQL assertions on migrated PostgreSQL; outbound
  provider boundaries controlled. Frozen provider implementation was not edited.
- `pnpm i18n:check`: exit 0; 10,587 paired keys and ICU/rich contracts validated.
- `pnpm typecheck`: fumadocs-mdx and tsc --noEmit passed, exit 0.
- `pnpm exec eslint tests/public-output-catalog-integration.test.ts`: exit 0,
  no warnings/errors.
- `pnpm lint`: exit 0; zero errors and 20 existing warnings outside owned files.
- `python .agentic/scripts/money_inventory.py --write`, then
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0;
  417 columns, 1,850 consumer hashes and source occurrence checks verified.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0; nine regressions pass.
- `python .agentic/agent.py validate`: exit 0; 360 valid tasks.
- `git diff --check`: exit 0.

The DB run created a unique OS-temp PostgreSQL 18 cluster with explicit UTF8/trust,
127.0.0.1:57841, timezone UTC and max_locks_per_transaction=256. TEST_DATABASE_URL,
PG_BIN and TZ were process scoped. Fixtures created/dropped their randomized
databases; final SQL reported zero remaining dubbl_ci_ databases and pg_ctl
stopped the cluster in finally. No application DB or live provider was used.

Initial new-test run caught a fixture omission: default email had no viewUrl but
asserted the conditional button. Added the fixture link and reran successfully;
production behavior and assertion strength were preserved.

## Acceptance 3: review and retained qualification

Persian remains provisional. LOC-002 retains independent integration acceptance;
L10N/RTL/native/output tasks retain terminology, complete Persian workflows,
recipient locale resolution/delivery, email-client layout, Persian PDF shaping,
calendar/numerals, hydration/keyboard and release qualification. UTC-only tests do
not accept the known Tehran-day bank-alert deduplication boundary. No native/human
approval, browser, hosted CI, deployment or production qualification is claimed.
No full build or dev server was run. Actual independent peer review by
codex-parent (/root, Codex) inspected the complete new composition test,
consolidated inventory, task diff and disposable-PG verification evidence. No
blocker was found; approved contingent on final controller/diff checks. See
LOC-009-review-1.md. Owner steering requires a task-local commit only; parent
batches its push with LOC-002 and monitors hosted CI.
