# LOC-040 attempt 1 - sales invoice catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `e0b7915cd55ec9250e4557795379e301828180d5`; entry tree clean.
Live controller validate/status/next selected LOC-040; started this task only.
Applied the memory Dubbl controller-task skill. No subagents were used.
Read repository/controller/frontend instructions, source localization sections,
LOC-006 dependency evidence/review, catalog contract, actual invoice UI, money
helpers, REST/MCP services/tools and existing financial fixtures.

Bounded child of LOC-025; LOC-025/007/002 retain independent integration acceptance.
Stripe functionality, files and prior catalog namespaces stay unchanged under
DEC-008. Native Persian terminology, RTL and later presentation adapters remain
separate qualification tasks.

## Acceptance mapping

1. Added 274 paired `SalesInvoices` messages, reaching 4,385 compatible keys in
   each locale. [Scope inventory](../registries/SALES_INVOICE_CATALOGS.md) covers
   invoice list/detail, the InvoiceDrawer, payment and lifecycle dialogs, plural
   counts, all 41 authored compliance warnings, snapshot correction, credit
   application, exact-input messages and accessible back/selection/dismiss actions.
   Existing namespaces compare equal as parsed JSON after removing SalesInvoices.
   Other drawer functions and shared footer/section implementations compare equal
   to entry HEAD. Caller data, machine codes, dates, money and shared forms have
   explicit ownership/exception records.
2. Real React/next-intl/PresentationProvider rendering covers both locales and
   empty/table/summary/filter/selection/status/dialog/snapshot/credit/error states.
   Original production callbacks verify organization-scoped paths/headers,
   canonical payment/credit/interest Minor strings, exact copied prices, creation
   deposit basis points/approval/nulls, snapshot fields, PDF filename and URL
   cleanup, bulk codes/IDs, plural summaries, cancellation and lookup precedence.
   Failure cases include HTTP denial, network errors, invalid JSON, malformed
   read envelopes, conflicting/noncanonical saved aliases and invalid inputs.
   Amounts cover USD/JPY/KWD including 9007199254740991 raw units. Unknown codes
   remain escaped data; unreviewed server prose gets translated fallbacks.
   Existing financial REST/MCP/SQL integrations pass afresh on isolated databases.
3. Scope/handoff/self-review explicitly retain provisional Persian and independent
   parent/native/RTL qualification. Existing MCP operation coverage and the
   documented invoice read-shape difference are inventoried. No new operation,
   server/API/MCP implementation, authorization, schema/migration, stored unit,
   FX calculation or IRR rollout flag changed.

## Changes and failure handling

Invoice reads now reject HTTP failures and malformed list envelopes before data
adoption; successful list reads clear stale errors. Existing abort/cancellation
guards remain intact. Lifecycle callbacks no longer expose arbitrary service or
parser prose. Previously uncaught network failures in credit/approval/snapshot/
confirmation actions surface translated errors; busy states reset. Denied
cancellation/duplication reports a translated failure. Bulk counts validate before
ICU interpolation. The shared amount input accepts optional label/invalidMessage
props so invoice dialogs translate their copy while existing callers/defaults
remain unchanged for LOC-047. Removed two now-unused lint suppression comments.

## Actual verification

All commands ran in D:/Projects/dubbl. No build, dev server, deployment, application
database, live email or object-storage access. PostgreSQL 18 was initialized in a
new temporary directory, bound to 127.0.0.1 on a dynamically allocated free port,
and used only through explicit TEST_DATABASE_URL. Fixtures migrated/dropped
randomized dubbl_ci_* databases. Cleanup SQL returned zero remaining fixture
databases; the isolated server stopped in finally. This is not PostgreSQL 16 or
production migration qualification.

| Check | Actual result |
|---|---|
| Controller selection/start/validate | Exit 0; valid 292-task graph |
| Final focused invoice catalog suite | Exit 0; 12/12 passed, no skips; 8.646 seconds |
| Final full unit/static suite, concurrency 4 | Exit 0; 817/817 passed, no skips; 78.854 seconds |
| Invoice lifecycle/read/snapshot/UI-money REST/MCP/SQL | Exit 0; 4/4 groups passed, no skips; 47.825 seconds |
| pnpm typecheck | Exit 0, final source and tests |
| pnpm i18n:check | Exit 0; 4,385 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero errors/warnings |
| pnpm lint | Exit 0; zero errors, 69 remaining warnings in unrelated sources |
| Money inventory generation/verification | Exit 0; 417 columns, 2,236 scanned files, 1,678 consumer hashes and all occurrence/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog/scope/link audit | Exit 0; no owned JSX/display attributes left, prior namespaces/other drawers unchanged, new Persian script assertions and registry links pass |
| Fetch/divergence before commit | Exit 0; HEAD vs origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/invoice-catalogs.test.ts tests/invoice-ui-components.test.ts tests/invoice-ui-money.test.ts
node --import tsx --test tests/invoice-catalogs.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/invoice-ui-money.test.ts tests/integration/invoice-reads.test.ts tests/integration/invoice-lifecycle.test.ts tests/integration/invoice-snapshots.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two invoice pages> components/dashboard/create-drawer.tsx components/dashboard/invoice-amount-input.tsx i18n/invoice-presentation.ts tests/invoice-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
```

Early focused tests exposed three remaining JSX fragments, ESM/CommonJS provider
identity issues in the test loader, a non-UUID fixture account and an empty scope
parameter in the confirmation harness. These were corrected; final focused/full
runs pass. The first local-link audit ran before evidence files existed and was
rerun successfully after evidence creation. No failed check is counted as passed.
Money inventory changes are mechanical source hash/line/path refreshes only;
classification and monetary policy are unchanged. Broad existing provider tests
are ordinary regression coverage, not dedicated Stripe work.

## Review and handoff

See [Codex self-review](LOC-040-review-1.md). Controlled rendering and extracted
callback execution do not claim mounted browser behavior, complete RTL or native
linguistic approval. Shared forms/navigation and other sales children stay open.
Date/numeral adapters, hosted CI, live delivery/storage/PDF providers, deployment
and production IRR remain unverified here.

Finish controller check/submit/self-review/done, commit the owned sources,
catalogs/tests/scope/evidence/controller and mechanical inventory changes, push
origin/master, confirm remote SHA/clean tree, report the live next task and stop.
