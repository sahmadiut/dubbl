# LOC-019 attempt 1: document template settings catalogs

## Identity

2026-10-17 (Asia/Tehran), coding-assistant; D:/Projects/dubbl, master, entry HEAD
`80c5bf4e547c35a8766ada8fd01a883eaa25f9c4`. Controller validate/status/next/context
selected LOC-019, then start claimed it. Read root/.agentic instructions,
START_HERE, CONTROLLER, PROJECT/REPOSITORY_MAP, frontend role, catalog contract,
LOC-005 dependency evidence and the actual settings/REST/MCP rendering sources.

Entry tree contained app/layout.tsx and app/globals.css Vazirmatn changes. The
current user explicitly instructed "push all files", overriding the usual
task-only staging preference. Reviewed and preserved those font changes and
included their TypeScript source in changed-file lint/typecheck. Font download,
browser rendering and production build behavior were not exercised.

## Implementation and acceptance mapping

1. Extracted all authored settings-page/list/form/preview-control copy into 70
   SettingsDocumentTemplates keys and one shared SettingsErrors key per locale;
   final catalogs contain 1,904 matching keys. Includes default/type labels,
   headings, descriptions, field/help/example text, variables help, save states,
   accessible menu/iframe labels, deletion/cancel confirmation and operation
   messages. SETTINGS_DOCUMENT_CATALOGS.md inventories technical/user/renderer
   exceptions. Sample HTML stays code-owned with translated plain sample text;
   literal template tokens are ICU interpolation values, never catalog syntax.
2. Extracted the existing production list/form/iframe into directly renderable
   components, preserving styles, field state callbacks, switch state, type
   immutability and save disabling. Added a failure-response helper using the
   existing settings error allowlist/status policy. Load/save/delete/preview/PDF
   failures show localized messages; arbitrary error prose is hidden. Source
   review confirms failed save retains the form and finally releases saving;
   failed delete rethrows to the existing confirmation hook for retry. Successful
   fetch methods, paths, organization headers, payload fields/null conversion,
   sample filename and preview/PDF format handling are preserved by fixed
   pre-extraction AST fixtures. Response tests verify rejection before success
   adoption and untouched successful JSON/HTML/PDF bodies. They do not simulate
   browser clicking or persistence.
3. Registries, parent handoff and task handoff record provisional Persian copy
   and independent LOC-017/012/006/002/native/RTL acceptance. No schema, migration,
   ledger, money math, authorization, REST or MCP operation changed. Existing
   preview_document_template retains its shared rendering service. Inspection
   found no document-template CRUD MCP registration; this existing gap is
   explicitly handed to LOC-017 integration, not represented as full MCP parity.

The generated money inventory was refreshed for source movement, hashes and
occurrence lines. It retains existing unit policy/classifications and covers
417 columns and 1,632 conservative consumer files. No database access was needed.

## Verification

All commands ran from the repository root with installed dependencies. No full
build or unrequested dev server was run.

| Command | Actual result |
|---|---|
| `node --import tsx --test tests/settings-document-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts` | Exit 0; 23 passed, zero failed/skipped |
| `pnpm test` | Exit 0; 637 passed, zero failed/skipped |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` | Exit 0; zero errors, 75 existing warnings outside changed sources |
| `node node_modules/eslint/bin/eslint.js` with page, root layout, settings error mapper, two new component/helper files and focused test | Exit 0; no warnings/errors |
| `pnpm i18n:check` | Exit 0; 1,904 keys per locale |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1,632 consumer files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; source hashes and occurrence lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks passed |
| `python .agentic/agent.py validate` | Exit 0; 247 structurally valid tasks at selection; repeated at final disposition |
| `git diff --check` | Exit 0; repeated after evidence/disposition |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

The six new tests exercise real React/next-intl list/form/iframe rendering in
both locales, escaping of stored HTML/name data, all 18 variable tokens, technical
examples, empty/default/unknown type branches, saving/blank-name controls, switch
state, error/status/prototype fallbacks, response streams/media checks, exact
request fixtures and bounded JSX/attribute extraction. The focused suite also
retains the production ICU validator, rich text and locale/provider checks.

## Review and handoff

See LOC-019-review-1.md for honest self-review. Native terminology, complete RTL,
browser interaction/layout, font rendering, PDF visual output, physical printing,
live CRUD/DB integration and hosted CI were not performed or accepted. Commit
all reviewed files under the current explicit user instruction, push
origin/master, verify remote SHA/clean tree, report the next task and stop.
