# LOC-099 attempt 1

## Identity and scope

2026-10-21, Codex. Repository D:\Projects\dubbl, master, clean at entry.
Selected LOC-069 from the controller. Source inspection found seven CRM route
TSX files plus the 224-line creation drawer; split into LOC-099..102 and worked
only on LOC-099. LOC-069 retains independent combined acceptance. No independent
reviewer or human approval is claimed. Commit/push parity is verified separately
after controller completion.

## Acceptance mapping

1. Added 89 paired `CrmPipeline` messages (8,640 total leaves per locale) and
   extracted list/onboarding/creation copy, examples, finite labels, plural
   counts, feedback and sort accessibility. Shared loading/footer translations
   are reused. Persian script and source-copy assertions pass; exceptions are
   explicit in [CRM_PIPELINE_CATALOGS](../registries/CRM_PIPELINE_CATALOGS.md).
2. Production JSX/next-intl rendering and callbacks retain exact safe maximum
   cents, canonical dates, USD creation default, currency labels, all query/form
   values, org headers, event and navigation contracts. Checked readers preserve
   existing exact alias validation and prevent malformed envelopes from becoming
   adopted data or successful creates. Missing org/storage errors release busy
   state. Pipeline failures cannot show successful empty onboarding. Cleanup and
   request versions reject late reads. Failed pagination preserves rows and
   exposes retry without claiming exhaustion. Failed creates preserve inputs
   and do not close, dispatch success or navigate.
3. Controller split, catalog registry, task handoffs, this evidence and honest
   Codex self-review record provisional Persian wording and independent
   parent/native/RTL qualification. No Stripe changes or service/API/MCP/schema,
   migration, authorization, ledger or IRR flag changes were made.

## Verification

All commands ran from the repository root; no full build or dev server ran.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/crm-pipeline-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/crm-wire.test.ts tests/project-catalogs.test.ts tests/payroll-employee-catalogs.test.ts tests/payroll-contractor-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 70/70 pass, zero skips; includes shared creation-drawer regressions |
| node --import tsx --test tests/crm-pipeline-catalogs.test.ts after final pagination regression | 9/9 pass, zero skips |
| Explicit loopback TEST_DATABASE_URL/PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/crm.test.ts tests/integration/budget-project-crm-ui.test.ts | Budget/project/CRM fixture passed; initial CRM run exposed a test-adapter envelope error described below |
| Same isolated server; node --import tsx --test --test-concurrency=1 tests/integration/crm.test.ts after adapter correction | 1/1 pass, zero skips, 17.7 seconds worker; both selected fixtures ultimately pass |
| pnpm typecheck | Pass, including final focused tests; fumadocs generation plus tsc --noEmit |
| pnpm i18n:check | Pass, 8,640 paired compatible keys |
| pnpm exec eslint on changed TS/TSX source and tests | Pass, zero warnings/errors |
| pnpm lint | Pass, zero errors and 26 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 schema columns unchanged; 1,812 consumers |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| python .agentic/agent.py validate; git diff --check | Pass |

A disposable PostgreSQL 18 cluster used OS temp, 127.0.0.1:6471, local trust auth
and max_locks_per_transaction=256. Fixtures migrated randomized `dubbl_ci_*`
databases and dropped them. Final admin query returned zero fixture databases;
pg_ctl stopped the cluster. Application .env/DB was not used, and no credentials
were printed or persisted.

The CRM fixture now checks real pipeline list/create and deal create/list REST
and linked MCP payloads with the presentation readers. Existing SQL-text,
tenancy/permission/auth, currency isolation, invalid-input, history, audit and
atomic rollback assertions remain. MCP list results deliberately use a different
envelope; the initial fixture adaptation omitted its pagination wrapper. The
corrected test adapts only the fixture, preserving both production contracts.
Early typecheck found a nullable assignee-name mismatch in the page interface;
it was corrected. A Persian script assertion prompted an explicit Persian
count noun in the stage summary. Final checks pass after these fixes.

Money inventory changes cover owned consumer paths, hashes and source line
occurrences only; schema metadata is unchanged. Existing UI source guards
recognize the CRM reader and require its delegation to projectCrmJson.

## Review and handoff

See [Codex self-review](LOC-099-review-1.md). LOC-100 is next, followed by
LOC-101/102 and independent LOC-069 integration acceptance. Persian terminology
remains provisional. No full unit/integration suite, browser, native linguistic,
complete RTL/calendar/numerals, hosted CI, provider, deployment or production
qualification is claimed.
