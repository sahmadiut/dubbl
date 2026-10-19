# LOC-025 attempt 1 - combined sales catalog acceptance

Date: 2026-10-19 (Asia/Tehran). Implementer: Codex. Repository: D:/Projects/dubbl.
Entry tree was clean on master at e41c30fb. Controller validate/status/next
selected LOC-025 after all nine LOC-039..047 children completed. Exactly this
parent acceptance task is handled. LOC-007/002 retain independent acceptance.

## Acceptance mapping and changes

1. Audited all 18 sales TSX routes, seven creation drawers and shared forms/details
   against current source and the nine child inventories. The new
   [combined registry](../registries/SALES_CATALOG_ACCEPTANCE.md) records 951 scoped
   paired messages, explicit caller/machine/example/punctuation/format exceptions,
   adjacent owners and MCP coverage. Persian terminology remains provisional.
2. Added [combined tests](../../tests/sales-catalog-integration.test.ts) rendering
   actual drawer bodies with actual shared line editor, amount input, footer and
   date controls under real next-intl/PresentationProvider. Both locales cover
   ready/saving states, disabled submit, escaped caller data, exact
   4,000,000,000,000,001 minor units in USD/JPY/KWD, invalid previews and
   list/detail layout composition. Revenue schedules retain fixed-two USD units.
   Combined AST audit covers all routes/drawers and eight shared components.
   Existing child callback and migrated REST/MCP/SQL suites run on current source.
3. Updated task handoff and message-catalog index; recorded independent parent,
   native Persian, RTL and browser boundaries. No application or catalog repair
   was needed. Only a test and acceptance/controller documentation change.

No REST/MCP, service, money helper, schema/migration, FX, production-IRR flag or
Stripe file changes. Existing MCP counterparts remain registered, described,
organization-scoped via AuthContext, using Drizzle-backed shared services and
wrapTool. Earlier completed task/evidence records are unchanged.

## Actual verification

Commands ran from repository root. PostgreSQL integration uses a new random
OS-temp PostgreSQL 18.6 cluster bound only to 127.0.0.1:10607 with explicit
process-scoped TEST_DATABASE_URL and PG_BIN. Existing fixtures migrate and drop
random dubbl_ci_* databases. No application database, production migration or
PostgreSQL 16 qualification is claimed. Final fixture database count was zero;
the dedicated cluster was stopped in finally. Its stopped data files remain in
OS temp, alongside the stopped initial attempt.

| Check | Actual final result |
|---|---|
| New combined composition/source suite | Exit 0; 5/5 passed, no skips; 26.928 seconds |
| Nine child catalog suites together, concurrency 2 | Exit 0; 83/83 passed, no skips; 80.985 seconds |
| Full unit/static suite, concurrency 2 | Exit 0; 887/887 passed, no skips; 450.487 seconds |
| Migrated PostgreSQL REST/MCP/SQL suites, concurrency 1 | Exit 0; 16/16 passed, no skips; 385.321 seconds; zero remaining fixture databases; cluster stopped |
| pnpm typecheck, including final test source | Exit 0 |
| pnpm i18n:check | Exit 0; 5,002 compatible keys per locale |
| Full pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Final changed-file ESLint | Exit 0; zero errors/warnings |
| Money inventory verifier | Exit 0; 417 schema columns and 1,686 consumer hashes/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Pre-commit fetch/divergence | master and origin/master 0 ahead / 0 behind |
| Local acceptance links, scoped diff ownership, controller validation and git diff --check | Passed |

Commands:

```text
node --import tsx --test tests/sales-catalog-integration.test.ts
node --import tsx --test --test-concurrency=2 tests/sales-payment-catalogs.test.ts tests/invoice-catalogs.test.ts tests/quote-catalogs.test.ts tests/sales-receipt-catalogs.test.ts tests/credit-note-catalogs.test.ts tests/customer-prepayment-catalogs.test.ts tests/recurring-invoice-catalogs.test.ts tests/revenue-schedule-catalogs.test.ts tests/shared-document-catalogs.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payment-reads.test.ts tests/integration/payment-ui-money.test.ts tests/integration/invoice-reads.test.ts tests/integration/invoice-lifecycle.test.ts tests/integration/invoice-snapshots.test.ts tests/integration/invoice-ui-money.test.ts tests/integration/document-editor-money.test.ts tests/integration/quotes.test.ts tests/integration/quote-ui-money.test.ts tests/integration/sales-receipts.test.ts tests/integration/sales-receipt-ui-money.test.ts tests/integration/credit-note-ui-money.test.ts tests/integration/customer-prepayment-ui-money.test.ts tests/integration/recurring-invoices.test.ts tests/integration/recurring-invoice-ui-money.test.ts tests/integration/revenue-schedules.test.ts
pnpm typecheck
pnpm i18n:check
pnpm lint
node node_modules/eslint/bin/eslint.js tests/sales-catalog-integration.test.ts
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The initial combined harness included the prepayment form's state slots when
rendering revenue schedules; corrected selection to include that form only with
its wrapper. Initial source audit omitted the already documented INV-0042
example; added that exact exception. An initial negative test incorrectly rejected
the legitimate English translation of the price error; scoped the English-text
exclusion to Persian and asserted missing-total sentinels in both locales.
Final combined suite passes. No application defect was found or hidden.

The first cluster startup inherited output pipes through PostgreSQL and stalled
the Python runner before tests began. Stopped that task-specific process/cluster,
changed control output to files, and started the successful cluster above.
No fixture or application database had been used by the stalled attempt.

## Review and delivery limits

Codex performed honest [self-review](LOC-025-review-1.md), not independent peer,
human, native linguistic or accounting approval. Composition controls initial
hooks/effects/navigation, adjacent pickers and portals; it does not mount browser
events. Child tests execute real callback syntax; PostgreSQL suites separately
exercise actual REST/MCP/SQL. Catalog acceptance does not certify every business
workflow, complete RTL, providers, hosted CI, production data or deployment.

No full build, dev server, Docker, provider request, application DB or production
IRR enablement ran. The broad unchanged unit suite includes provider regression
checks, but there was no dedicated Stripe work. LOC-007/002, native terminology
and later RTL/browser/release gates remain independent. Commit/push evidence is
reported separately after authorized delivery and remote SHA confirmation.
