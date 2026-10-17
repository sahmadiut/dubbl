# LOC-015 attempt 1: settings automation catalogs

## Identity and scope

2026-10-17 (Asia/Tehran), coding-assistant, D:/Projects/dubbl, master. Entry HEAD
`1ceb760d26b995d2dd0cf6e34410a2fadffdb858`; clean entry tree. The live controller
selected LOC-015, which was started with owner coding-assistant. Read root and
.agentic instructions, START_HERE, CONTROLLER, PROJECT/REPOSITORY_MAP, frontend
role, LOC-005 evidence, the catalog/settings registries and the task-linked locale
requirements. No task split or unrelated work was needed.

## Implementation

- Extracted all authored product text in six settings automation routes: bank
  rules, approval workflows, pipelines, webhooks, reminders and notification
  preferences. Added six typed Settings namespaces and five SettingsErrors keys:
  360 new matching keys, increasing each locale from 1,038 to 1,398 keys.
- Complete messages replace concatenated rule/step/condition/event/attempt/day/
  stage counts, bank summaries and joins, pagination, entity-specific workflow
  guidance and confirmations containing user names. Real runtime ICU handles
  plural categories; saved/technical values never become catalog keys.
- Extracted actual notification controls, reminder template fields and workflow
  guidance into supporting components so loaded controls can be rendered with
  the production PresentationProvider. Notification switch labels are accessible
  in both languages; original IDs, defaults, channel independence, save disabling
  and 120-minute email digest are retained.
- Bank presentation helpers preserve legacy and multi-condition matching, signed
  exact minor-unit text, split count summaries and caller labels. Parsing, safe
  ranges, condition/split construction and legacy request mirrors are unchanged.
- Pipeline creation seeds translate new editable stage names only; IDs/colors
  and saved user names remain intact. Added translated drag role/instructions/
  announcements and stage-control labels using the installed dnd-kit API. Keyboard
  sensors, drag reordering, dirty confirmation and stage-removal guards remain.
- All four webhook delivery enum values have translated labels, including
  retrying; unknown values get a generic label. Event subscription codes and
  HTTP/protocol identities remain verbatim. Literal double-brace reminder tokens
  survive ICU rendering, insertion, editing and serialization unchanged.
- Existing exact error contracts use the settings allowlist/status mapping.
  Only locally created SettingsRequestError messages are carried through catch
  handlers; arbitrary fetch/JSON/wire error prose receives an operation fallback.
  REST/MCP/domain errors remain unchanged.
- Added [scope and exception inventory](../registries/SETTINGS_AUTOMATION_CATALOGS.md),
  updated catalog/settings ownership and refreshed the generated money source
  inventory. No dependency, schema, migration, domain service or REST/MCP change.

## Acceptance mapping

1. All bounded JSX prose/display attributes and dynamic messages are extracted
   with matching provisional fa-IR keys. The inventory explicitly covers user
   data, event/field/operator IDs, protocol samples, literal reminder variables,
   numeric-only placeholders, canonical money and existing date formatting.
2. Twelve new automation tests run in the final full unit suite. They render
   actual pages, loaded notification switches, reminder templates and condition
   guidance with real next-intl; verify channel payload/default/digest/save
   behavior, bank legacy/multi-condition summaries and exact minor-unit text,
   pipeline seed IDs/colors and drag announcement branches, all delivery statuses,
   plurals/pagination, literal tokens, escaping and error fallbacks. The source
   audit checks all six routes and the three extracted components for JSX/display
   extraction and translated machine-identity regressions. No authorization,
   account posting or canonical money contract changed.
3. Registry/handoff record provisional Persian terminology and independent
   LOC-012/006/002 integration and later native L10N/RTL acceptance. This is an
   honest self-reviewed extraction, not linguistic or browser qualification.

## Verification

All commands ran from D:/Projects/dubbl using installed dependencies. No database
fixture was required or accessed for this presentation-only task.

| Command or check | Actual result |
|---|---|
| Controller validate/status/next/context, then start LOC-015 | Exit 0; clean entry, selected bounded task, 231 structurally valid tasks |
| Focused automation/settings/catalog/locale group before final delivery-status helper | Exit 0; 36 passed; the final full suite also covers the added status helper test |
| `pnpm test` final | Exit 0; 619 passed, zero failures/skips, including 12 automation tests |
| `pnpm typecheck` final | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` final | Exit 0; zero errors, 78 existing warnings |
| Explicit changed-file ESLint for six pages, four i18n helpers, three components and the test | Exit 0; only two existing unused getSuccessRate/wh warnings in webhooks page |
| `pnpm i18n:check` | Exit 0; 1,398 keys in each locale, compatible ICU contracts |
| One-off TypeScript AST comparison against entry HEAD of JSON.stringify arguments and bank/reminder payload construction | All five bank/workflow/pipeline/webhook/reminder source comparisons match after whitespace normalization; the temporary review utility was removed |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 schema columns, 2,165 scanned files, 1,623 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema classifications, all 1,623 hashes and occurrence/source lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `git diff --check` | Exit 0 |
| Task-owned Markdown link check and final controller validation | Exit 0; 22 local links in six documents, 231 structurally valid tasks |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

Interim checks caught an incomplete helper extraction, an inadvertently translated
bank operator/mirror fallback and an encoding error in newly added Persian drag
labels. Corrected all before final verification; machine-value/source audits and
explicit Persian rendering/encoding assertions now cover these cases. Initial
test-audit false positives for numeric-only placeholder 0 and message interpolation
arguments were narrowed to their actual presentation contexts. No failing check
is represented as passing.

## Review and limits

See [self-review](LOC-015-review-1.md). Native linguistic/financial terminology,
full settings integration, RTL, browser click/drag/layout, persisted workflows,
PDF/printing, hosted CI and providers were not qualified. No full build, dev
server, Docker or database access was performed. Existing pipeline delete copy
and incomplete HTTP error handling are recorded in the scope inventory for
parent integration; this extraction does not claim to repair those workflows.

## Handoff

Complete controller criteria/submission/self-review/done, commit task-owned files,
push origin/master under the user's explicit instruction, verify remote SHA and
clean tree, report the next controller task and stop. LOC-012, LOC-006, LOC-002,
LOC-016/017 and native/RTL acceptance remain independently open.
