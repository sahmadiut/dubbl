# LOC-123 email and document output extraction

## Identity

2026-10-24 (Asia/Tehran), Codex. Repository D:\Projects\dubbl, master;
entry commit 6624d2f1. Clean working tree at entry. This evidence describes the
task-owned working diff before its commit; no human or production approval claimed.

## Result and acceptance mapping

1. Extracted 124 paired `Output` messages in en-US/fa-IR and added a typed,
   explicit-locale translator. Six production email content templates plus shared
   layout, document-email subject, HTML generators for five document types, PDF
   labels/preview captions, and portal statement PDF captions use catalog messages.
   Headings/notification plurals use whole ICU messages. React escaping and caller
   templates/data are preserved. See [inventory](../registries/OUTPUT_CATALOGS.md)
   for owned paths and explicit legal/data/machine/delegated exceptions.
2. Production rendering, behavior, catalog, static, controller and financial
   regression checks passed as recorded below. No API/MCP input or output schema,
   DB schema, authorization, ledger calculation, currency scale or Stripe change.
   Existing REST/MCP functions still call the shared output implementation.
3. Persian strings are provisional. Email and HTML renderers have internal locale
   hooks tested in both locales; existing transport/background callers stay English.
   PDF selects the English catalog pending Persian font/shaping qualification.
   LOC-009/LOC-002 and later L10N/RTL/native/output qualification remain independent.

## Verification

All commands ran from the repository root. No full build or dev server was run.

| Command | Observed result |
|---|---|
| `node --import tsx --test tests/output-catalogs.test.ts tests/document-render-wire.test.ts` | Exit 0; 14/14 passed |
| `node --import tsx --test tests/integration/document-rendering.test.ts` | Exit 0; 1/1 passed, real REST/MCP document/template/portal/email regression fixture |
| `pnpm i18n:check` | Exit 0; 9,942 keys per locale, including 124 Output keys |
| `pnpm typecheck` | Exit 0; initial and final runs passed |
| `pnpm exec eslint i18n/output.ts lib/documents/email-rendering.ts lib/documents/pdf-generator.ts lib/documents/pdf-renderer.tsx lib/documents/portal-statement.ts lib/documents/render-service.ts lib/email/templates tests/output-catalogs.test.ts` | Exit 0; no warnings/errors; final helper/test lint also passed |
| `pnpm lint` | Exit 0; 0 errors, 20 warnings in unchanged files |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed source/line hashes and new source/test entries only; 417 columns, 1,843 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 417 columns and 1,843 consumer hashes/occurrences verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` | Exit 0; valid, 360 tasks |
| `git diff --check` | Exit 0 |

Tests render actual React Email and next-intl, with escaped malicious caller text,
custom role/button/link preservation, zero/singular/plural/truncated notifications,
each document kind, safe unknown-kind fallbacks (including prototype property
names), date-row visibility, user HTML/placeholder preservation, USD/IRR/JPY/KWD
scale and MAX_SAFE_INTEGER amounts. A real English PDF is generated through the
production renderer. Paired-key/Persian-script/replacement-corruption assertions
cover all Output entries. Initial checks caught an unextracted organization CTA
and shell-corrupted Persian period text; both were corrected before final checks.
The initial inventory gate reported expected source drift and passed after refresh.

The DB integration used a unique OS-temp PostgreSQL 18 cluster with trust auth,
127.0.0.1:4733 and max_locks_per_transaction=256. TEST_DATABASE_URL and PG_BIN
were explicitly process scoped. The fixture created/dropped its own random DB;
final admin SQL reported zero dubbl_ci_ databases, and pg_ctl stopped the cluster.
No application DB or live provider was used; outbound mail is mocked by the fixture.

## Review and handoff

Codex self-review only; separate review record follows. No native Persian,
email-client, visual RTL/PDF typography, hosted-CI, deployment or production
qualification claim. Existing English delivery is intentional until later locale
resolution/output activation. No blockers to this bounded catalog extraction.
