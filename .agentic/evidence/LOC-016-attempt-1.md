# LOC-016 attempt 1: settings access and audit catalogs

## Identity and scope

2026-10-17 (Asia/Tehran), coding-assistant, D:/Projects/dubbl, master. Entry HEAD
`1c0a65a6c45416612dd57e8fca062913276c0ab6`; entry tree was clean. The controller
selected LOC-016 and it was started under coding-assistant. Read root/.agentic
instructions, START_HERE, CONTROLLER, PROJECT/REPOSITORY_MAP, frontend role,
LOC-005 evidence, catalog/settings registries and task-linked locale requirements.

During this task, separate AI-001..013 planning changes appeared in the shared
checkout. They are unrelated and were neither edited nor selected for this
commit. Controller validation now counts 244 tasks, including that shared work;
the entry count was 231. No task split or extra implementation task was started.

## Implementation

- Extracted authored UI text for settings members/invitations/invite links,
  roles/permission controls, advisors, API keys and audit log into five typed
  namespaces. Added 319 matching keys across those namespaces and SettingsErrors,
  reaching 1,717 keys per locale. Persian wording is provisional.
- Complete messages replace member/permission/use counts, capacity/plan summaries,
  assignment/inviter/expiry text, API-key metadata, audit activity and pagination.
  Runtime ICU handles plurals. Existing numeric/string inputs remain data.
- Extracted actual permission, API-key and audit-activity UI into three supporting
  components for loaded-state rendering. All 17 groups and 45 existing permission
  IDs, category/individual selection handlers and save/system-role guards remain.
  Added accessible translated names to existing icon/category controls.
- API-key bytes, masking/sample curl/header tokens, org scope, limits and close/
  reset behavior are preserved. Rich authentication guidance keeps the original
  styled Authorization code span. Escaped caller key/name text is verified.
- Audit labels translate exact known action codes and the original entity-filter
  set; unknown technical codes remain inspectable data. Activity is one rich
  message containing escaped actor/entity text. Relative/day text uses catalogs
  and presentation preferences; canonical dates, searches, request filters and
  pagination operations are preserved. Other existing timestamp formatting is
  explicitly inventoried.
- Capacity messages derive from structured fields. Sixteen exact existing error
  contracts map to fifteen additional shared error keys. Unknown server/network/
  JSON error prose uses operation fallback; server/MCP outputs remain unchanged.
- Added [scope/exception inventory](../registries/SETTINGS_ACCESS_CATALOGS.md),
  updated catalog/settings ownership and refreshed generated money source hashes.
  No domain service, REST, MCP, schema, migration or dependency change.

## Acceptance mapping

1. All authored JSX prose/display attributes in the five pages and three extracted
   components have matching fa-IR keys. Inventory records user/system-role data,
   unknown technical codes, protocol samples, dates/numbers/browser validation and
   elevated permissions intentionally absent from the original editor.
2. Eight new tests render real pages and loaded controls through the production
   PresentationProvider. They assert permission IDs/states, key escaping and
   create/reveal branches, complete counts, capacity branches, audit labels/date
   boundaries and unknown fallbacks, safe errors and bounded source extraction.
   A one-off TypeScript AST comparison against entry HEAD confirmed all five
   pages' request URLs, JSON.stringify bodies, audit params.set calls and role
   permission-code occurrences match. No authorization/accounting changes.
3. Handoff/registries retain provisional Persian wording and independent
   LOC-012/006/002, native L10N and RTL acceptance. Self-review is identified
   honestly; no human, browser or persisted-workflow qualification is claimed.

## Verification

All commands ran from D:/Projects/dubbl with installed dependencies; no database
was accessed or needed for presentation extraction.

| Command/check | Actual result |
|---|---|
| Controller validate/status/next/context and start LOC-016 | Exit 0; selected one bounded task, 231 tasks at entry |
| Focused access/settings/catalog/locale tests | Exit 0; 33 passed before final source-audit strengthening; final full suite includes all eight access tests |
| One-off AST request/permission comparison against entry HEAD | All five pages and original permission code occurrences matched; temporary utility removed |
| `pnpm i18n:check` | Exit 0; 1,717 matching keys with compatible ICU contracts |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 2,171 scanned files, 1,627 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` final | Exit 0; 417 schema columns, all 1,627 consumer hashes and occurrence/source lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `git diff --check` | Exit 0 after source normalization |

| `pnpm test` final | Exit 0; 627 passed, zero failures/skips, including all eight access tests |
| `pnpm typecheck` final | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` final | Exit 0; zero errors, 78 pre-existing warnings |
| Changed-file ESLint final (five pages, three components, three helpers and test) | Exit 0; one existing unused UserCheck warning in advisors page |
| Final controller validation | Exit 0; 244 structurally valid tasks including unrelated AI planning work |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

Interim checks caught a malformed automated permission extraction, a missing
separator in unlimited-seat display, a remaining raw audit badge label and an
overbroad test guard that mistook passing a canonical action prop for rendering
it. Corrected each before final verification. A first lint/inventory run raced
with removal of task-owned temporary utilities and failed ENOENT; reran after
cleanup. These transient failures are not represented as passing checks.

## Review and limits

See [self-review](LOC-016-review-1.md). No build, dev server, Docker, database,
browser/clipboard click, PDF/printing, deployment or hosted CI run was performed.
Native terminology, RTL and complete/persisted access workflows remain unverified.
The registry records existing read/advisor fetch rejection handling and category
indeterminate behavior, technical event-code coverage and saved preset names.

## Handoff

Complete controller criteria/submission/self-review/done, commit only task-owned
files, push origin/master under the user's explicit instruction, verify remote
SHA and working-tree disposition, report next task and stop. Preserve unrelated
AI planning work in the checkout. LOC-012, LOC-006 and LOC-002 remain open.
