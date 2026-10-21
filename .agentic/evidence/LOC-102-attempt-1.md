# LOC-102 attempt 1

## Identity and scope

2026-10-21, Codex. Repository D:\Projects\dubbl, master, clean at entry;
starting HEAD 30021270. Controller selected and started LOC-102. This evidence
qualifies one bounded child; commit/push confirmation is reported separately.

## Acceptance mapping

1. Added 18 paired `CrmAnalytics` messages for document/page titles, description,
   currency controls, statistic cards, summary labels, distribution, ICU counts,
   percent sentence and finite failure feedback. Six built-in stage labels reuse
   `CrmPipeline`. Existing namespaces remain unchanged. Persian-script and JSX
   source-copy checks pass. Custom stage IDs, currency labels, fixed-two cents
   and shared primitives have explicit ownership/exceptions in
   [CRM_ANALYTICS_CATALOGS](../registries/CRM_ANALYTICS_CATALOGS.md).
2. Real production JSX renders through next-intl and PresentationProvider in both
   locales with actual UI and money code. Tests cover title/stage/count output,
   escaping, maximum safe cents with KWD label, loading, failed reads, currency
   changes/reset and retry. Checked reads reject HTTP/JSON/envelope failures,
   invalid counts, currency mismatch, malformed/missing exact aliases and
   inconsistent lifecycle/stage counts, percent and won average before adoption.
   Missing org/storage exceptions release loading without fetching; cleanup
   suppresses obsolete successes/failures. Raw server prose stays hidden behind
   a finite translated fallback, including a conditional currency-filter hint.
   Existing money validation remains delegated to projectCrmJson. REST and linked
   MCP analytics replies pass the same reader against a disposable PostgreSQL
   fixture, including JPY maximum, USD won/lost values and empty organizations.
   Independent SQL-text assertions compare saved USD counts and won values.
   Existing auth, org scope, audit and rollback assertions remain intact.
3. Updated catalog ownership, task handoff, generated money consumer inventory
   and honest self-review. Persian wording remains provisional, and
   LOC-069/008/002 retain independent combined acceptance. No service/API/tool
   contract, schema/migration, authorization, ledger, currency flag or Stripe
   implementation change was made. The existing organization-scoped
   get_crm_analytics tool shares the REST CRM service.

## Verification

Commands ran from the repository root. No full build or dev server ran.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/crm-analytics-catalogs.test.ts tests/crm-activity-catalogs.test.ts tests/crm-detail-catalogs.test.ts tests/crm-pipeline-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/crm-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | Final 59/59 pass, zero skips |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/crm.test.ts tests/integration/budget-project-crm-ui.test.ts | 2/2 pass, zero skips; 32.1 seconds |
| Final node --import tsx --test tests/integration/crm.test.ts, same fixture environment | 1/1 pass after SQL-text assertion addition; 11.5 seconds |
| pnpm typecheck | Pass twice, including final test/static-guard and SQL changes; fumadocs generation and tsc --noEmit |
| pnpm i18n:check | Pass; 8,775 compatible leaves per locale |
| pnpm exec eslint on analytics route, reader, analytics tests, integration worker and budget-project-crm-ui test | Final pass; zero warnings/errors |
| pnpm lint | Pass; zero errors, 24 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 schema columns unchanged, 1,818 checked consumer hashes and occurrence lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Compare catalog namespaces/schema classifications and changed money inventory consumers with HEAD | Existing namespaces/schema classifications unchanged; seven changed consumer paths all owned by this task |
| python .agentic/agent.py validate; git diff --check | Pass |

The PostgreSQL 18 cluster used an OS-temp directory, loopback 127.0.0.1:6473,
trust auth and max_locks_per_transaction=256. Tests migrated randomized
dubbl_ci_* databases and dropped them. The final admin query found zero remaining
fixture databases and pg_ctl stopped the cluster. Application .env/DB was not
used; credentials were not printed or persisted.

Early verification caught a test-only next-intl module/context mismatch for
BrandLoader and the existing static guard's direct-reader assumption. The
harness now imports the loader through the same module context, and the static
guard verifies the new reader's delegation to the unchanged money validator.
Both final checks pass. A schema-comparison helper's incorrect inventory key
was corrected to schema_columns; the final comparison passes.

## Review and handoff

See [Codex self-review](LOC-102-review-1.md). Next is independent LOC-069
combined CRM acceptance; LOC-008/002 also remain open. No full unit/integration
suite, browser/native linguistic/full RTL/numeral/calendar, hosted CI, provider,
deployment or production acceptance is claimed. Persian wording is provisional.
