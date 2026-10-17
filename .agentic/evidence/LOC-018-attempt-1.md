# LOC-018 attempt 1: billing and Stripe settings catalogs

## Identity and scope

2026-10-17 (Asia/Tehran), coding-assistant, D:/Projects/dubbl, master.
Live controller selected LOC-017. Inspected root/.agentic instructions,
START_HERE, controller reference, project/repository map, frontend role, catalog
contract, LOC-005 evidence and the actual settings sources. Six settings pages
plus the bulk-import wizard had independent provider/document/data contracts;
created LOC-018/019/020, validated, split LOC-017 through the controller and
started the selected LOC-018. LOC-017 retains independent combined acceptance.

Entry tree included unrelated AI planning changes, committed independently during
this run as b1df1c55c50779019fd3a6afa20c332a517c53cb. This is the review baseline;
it was in parity with origin/master before this task's commit. Later unrelated
font edits appeared in app/layout.tsx and app/globals.css. Those files are not
staged by this task. No clean shared-working-tree claim is made.

## Implementation and acceptance mapping

1. Extracted all authored provider-slice copy into SettingsBilling/SettingsStripe:
   116 paired keys, 1,833 total per locale. Factored existing billing content and
   Stripe card into settings components so actual loaded branches can be rendered
   without mounting effects or calling providers. Whole ICU seat/account/email
   summaries and complete dated messages replace English fragments. All exceptions
   are inventoried in SETTINGS_PROVIDER_CATALOGS.md. User labels stay escaped.
2. Rendering covers free/Pro, annual/monthly, self-hosted, missing/error/loading,
   usage warnings, configured/unconfigured Stripe mappings, statuses and live/test.
   Exact OAuth/status allowlists reject arbitrary/prototype-like values. Unknown
   provider/API prose uses translated operation guidance instead of being echoed.
   Source AST tests compare every fetch/JSON.stringify call to pre-extraction
   fixtures independent of future Git HEAD. Endpoints, organization headers,
   methods, payloads, plan IDs/prices and account mapping fields/filters are retained.
   No REST/MCP/domain/schema change or new operation. Existing integration MCP tools
   continue to provide checkout, status, settings, sync and disconnect operations.
3. Registry/handoffs record provisional Persian wording, explicit technical-unit,
   data, date and price exceptions. LOC-019/020 remain unstarted; LOC-017/012/006/002
   and native linguistic/RTL acceptance remain open.

## Verification

All commands ran in the repository root. No database/provider fixture was required.

| Command/check | Actual result |
|---|---|
| pnpm i18n:check | Exit 0; 1,833 compatible keys per locale |
| node --import tsx --test tests/settings-provider-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | Exit 0; 21 passed, none failed/skipped |
| pnpm test | Exit 0; 631 passed, none failed/skipped |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm exec tsc --noEmit after final test edits | Exit 0 |
| pnpm lint | Exit 0; zero errors, 77 existing warnings |
| pnpm exec eslint on both provider pages, both new settings components, provider-presentation.ts and settings-provider-catalogs.test.ts | Exit 0; no warnings/errors |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 417 columns, 1,630 consumer files |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; schema classifications, hashes and occurrence lines verified in shared tree |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks |
| Scoped staged-inventory audit using git show/git cat-file --batch and SHA-256 | All 1,630 consumer hashes match staged source blobs after retaining HEAD's app/layout.tsx inventory entry; unrelated font changes excluded |
| python .agentic/agent.py validate | Exit 0; 247 structurally valid tasks |
| git diff --check and git diff --cached --check | Exit 0 |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0 ahead / 0 behind before this task commit |

Initial catalog validation caught digit-leading generated identifiers; renamed
them to valid typed keys. Initial rendering/source checks caught the remaining
seat-summary fragment and an interim Unicode encoding problem in newly added
messages; repaired both, added explicit Persian character assertions and reran
focused checks successfully. An inventory inspection command exceeded Node's
default child-process output buffer; reran it with a bounded larger buffer.

The generator initially captured concurrent app/layout.tsx edits. Restored only
that inventory record to HEAD without touching the user's source, then checked
every staged consumer against its staged source blob. Working-tree inventory
verification may report that unrelated file until its owner regenerates it.

## Limits and handoff

No full build, dev server, browser click/layout, native linguistic review, live
OAuth/checkout/sync, database migration, deployment or hosted CI is claimed.
Existing browser timestamp formatting and provider USD price arithmetic remain
unchanged; preference adapters are separate work. See LOC-018-review-1.md for
honest self-review. Complete controller disposition, commit only task-owned paths,
push origin/master, verify remote parity, report preserved unrelated changes and
controller next task, then stop.
