# LOC-100 attempt 1

## Identity and scope

2026-10-21, Codex. Repository D:\Projects\dubbl, master, clean at entry;
starting HEAD 609ac64d. Controller selected and started LOC-100. This evidence
qualifies one bounded child; commit/push confirmation is reported separately.

## Acceptance mapping

1. Added 75 paired `CrmDetail` messages for the CRM deal shell, overview and
   settings. Source labels reuse `CrmPipeline`. All existing namespaces are
   unchanged. Authored labels, relative time/date sentences, feedback,
   confirmations, settings placeholders and unavailable states are catalogued.
   Persian-script/source-copy checks pass. Exceptions and the separate legacy
   activity-page timeAgo consumer are explicit in
   [CRM_DETAIL_CATALOGS](../registries/CRM_DETAIL_CATALOGS.md).
2. Real production JSX renders through next-intl and PresentationProvider in
   both locales. Tests retain caller escaping, fixed-two maximum safe cents,
   bigint weighted rounding, source/activity/stage/tab values, request methods,
   form fields, org headers, canonical Gregorian dates and navigation.
   Date-only/instant presentation uses the shared preference-aware adapters.
   Checked detail reads validate displayed joins/activities and existing exact
   aliases before adoption. Cleanup and request versions reject obsolete reads;
   a previous route's deal cannot render. Stage/won/lost/settings/delete/activity
   callbacks check actual HTTP/JSON/envelopes before success. Failed saves keep
   inputs; failed/cancelled deletes do not navigate; busy state is released.
   Successful mutation and failed follow-up refresh have distinct feedback.
   The real PostgreSQL fixture validates REST and linked MCP detail/mutation/
   activity/delete replies through the new readers while retaining SQL-text,
   authorization, organization isolation, lifecycle, audit and rollback checks.
3. Catalog registry, task handoff, this evidence and honest Codex self-review
   retain provisional Persian terminology and independent LOC-101/102,
   LOC-069/008/002 and native/RTL acceptance. No Stripe, service/API/tool contract,
   schema/migration, ledger, authorization or currency-flag changes were made.

## Verification

Commands ran from the repository root. No full build or dev server ran.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/crm-detail-catalogs.test.ts tests/crm-pipeline-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/crm-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | Final 48/48 pass, zero skips |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/crm.test.ts tests/integration/budget-project-crm-ui.test.ts | Standalone run: 2/2 pass, zero skips; 37.7 seconds total |
| pnpm typecheck | Final pass; fumadocs generation and tsc --noEmit |
| pnpm i18n:check | Pass; 8,715 compatible leaves per locale |
| pnpm exec eslint on the three owned route files, two presentation modules and three changed test files | Pass; zero warnings/errors |
| pnpm lint | Final pass; zero errors, 24 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final pass; 417 schema columns unchanged, 1,814 checked consumer hashes/occurrence lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Compare existing catalog namespaces/schema inventory to HEAD | Existing messages and schema metadata unchanged; changed inventory consumer paths are task-owned only |
| python .agentic/agent.py validate; git diff --check | Pass |

The disposable PostgreSQL 18.6 cluster used an OS-temp directory, loopback
127.0.0.1:6472, trust auth and max_locks_per_transaction=256. Fixtures migrated
randomized dubbl_ci_* databases and dropped them. The final admin query returned
zero remaining fixture databases and pg_ctl stopped the cluster. Application
.env/DB was not used; no credentials were printed or persisted.

The original combined startup/test shell did not advance promptly, so the
successful integration command was issued separately. After fixture teardown,
the original shell resumed and its redundant test attempt received
ECONNREFUSED; it did not run product assertions. The accepted 2/2 run above
completed before teardown. No product assertion failure remains unresolved.

Early checks caught a test-harness module/context mismatch, a circular React
element serialization in a test selector, a harness type assertion and owned
unused/ref warnings. These were corrected before final checks. Source inspection
also showed activity-create replies omit the joined user; the create reader
validates the actual unjoined wire shape and expected deal identity. Final
inventory regeneration resolves intermediate hash drift from source edits.

## Review and handoff

See [Codex self-review](LOC-100-review-1.md). LOC-101 is next; LOC-102 and the
LOC-069 integration parent remain separate. No full unit/integration suite,
browser/native linguistic/full RTL/numeral/calendar, hosted-CI, provider,
deployment or production acceptance is claimed. Persian wording is provisional.
