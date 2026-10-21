# LOC-101 attempt 1

## Identity and scope

2026-10-21, Codex. Repository D:\Projects\dubbl, master, clean at entry;
starting HEAD 0a766bfe. Controller selected and started LOC-101. This evidence
qualifies one bounded child; commit/push confirmation is reported separately.

## Acceptance mapping

1. Added 42 paired `CrmActivity` messages for the deal activity page, feed,
   composer, placeholders, toolbar, sidebar, lifecycle banners, date/count
   sentences, approved rich attribution and finite read feedback. Existing
   namespaces remain unchanged. Activity names and relative time reuse
   `CrmDetail`; the now-unused English layout time helper is removed.
   Persian-script/source-copy checks pass. Explicit exceptions and pending
   native terminology/RTL acceptance are documented in
   [CRM_ACTIVITY_CATALOGS](../registries/CRM_ACTIVITY_CATALOGS.md).
2. Real production JSX renders through next-intl and PresentationProvider in
   both locales, with actual UI and money code. Tests retain caller escaping,
   maximum safe fixed-two cents, type/sort values, query parameters, org headers,
   dates and content. Checked feed readers reject malformed HTTP/JSON/envelopes,
   rows, timestamps, joined names, pagination and inconsistent counts before
   adopting any state. Cleanup/request generations suppress obsolete reads and
   refresh races; pagination suppresses duplicate requests and deduplicates IDs.
   Failed creation retains the draft; verified creation returns true and alone
   triggers a current feed refresh. Refresh failure uses separate read feedback.
   Existing detail tests now assert the shared creation callback's boolean.
   PostgreSQL integration validates real REST/linked MCP feed envelopes through
   the reader and retains SQL-text, scope/auth, lifecycle, audit and rollback
   checks. Existing organization-scoped activity MCP tools share the REST service.
3. Catalog registry, scope document, task handoff and honest Codex self-review
   retain provisional Persian wording and independent LOC-102, LOC-069/008/002
   and native/RTL acceptance. No Stripe, service/API/tool wire contract,
   schema/migration, authorization, ledger or currency flag change was made.

## Verification

Commands ran from the repository root. No full build or dev server ran.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/crm-activity-catalogs.test.ts tests/crm-detail-catalogs.test.ts tests/crm-pipeline-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/crm-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 54/54 pass, zero skips |
| Final node --import tsx --test --test-concurrency=1 tests/crm-activity-catalogs.test.ts tests/crm-detail-catalogs.test.ts | 14/14 pass after final source/assertion changes; zero skips |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/crm.test.ts tests/integration/budget-project-crm-ui.test.ts | 2/2 pass, zero skips; 21.7 seconds total |
| pnpm typecheck | Final pass; fumadocs generation and tsc --noEmit |
| pnpm i18n:check | Pass; 8,757 compatible leaves per locale |
| pnpm exec eslint on both owned routes, both presentation modules and three owned test files | Pass; zero warnings/errors |
| pnpm lint | Pass; zero errors, 24 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final pass; 417 schema columns unchanged, 1,816 checked consumer hashes and occurrence lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Compare existing catalog namespaces and inventory schema metadata to HEAD | Existing messages and schema metadata unchanged; inventory changes are task-owned consumer paths only |
| python .agentic/agent.py validate; git diff --check | Pass |

The disposable PostgreSQL 18 cluster used an OS-temp directory, loopback
127.0.0.1:6473, trust auth and max_locks_per_transaction=256. Fixtures migrated
randomized dubbl_ci_* databases and dropped them. The final admin query returned
zero remaining fixture databases and pg_ctl stopped the cluster. Application
.env/DB was not used; no credentials were printed or persisted.

Early checks caught an unsupported rich-tag name, a Windows pipe encoding issue,
a test-only next-intl module/context mismatch, a portal-only label assertion,
unused harness imports and a widened translation-key test type. These were
corrected before final checks. Persian text was rewritten with UTF-8-safe patches
and verified by script assertions; rich tags use the approved strong/em set.
Final money inventory regeneration includes the final source/test lines.

## Review and handoff

See [Codex self-review](LOC-101-review-1.md). LOC-102 is next; LOC-069/008/002
retain independent combined acceptance. No full unit/integration suite,
browser/native linguistic/full RTL/numeral/calendar, hosted CI, provider,
deployment or production acceptance is claimed. Persian wording is provisional.
