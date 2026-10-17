# LOC-020 attempt 1: import, backup and trash settings catalogs

## Identity

2026-10-17 (Asia/Tehran), codex, D:/Projects/dubbl, master. Entry HEAD
`fbaa0cb068bde38d5039b10922fc7845260dc235`, clean working tree. The user explicitly
requested completing/pushing the next task and pushing all files. Live controller
validate/status/next selected LOC-020; started with owner codex. Read root and
.agentic instructions, START_HERE, CONTROLLER, PROJECT/REPOSITORY_MAP, frontend
role, LOC-005 evidence, catalog requirements/registries and actual presentation,
CSV mappings/parser, REST and MCP source. One bounded task; no delegation.

## Implementation and acceptance mapping

1. Extracted authored headings, rich bank-statement guidance, seven import/export
   entity options and field labels, source selector, history types/statuses,
   five-step bulk-import wizard, backup list/actions/confirmations and trash
   list/filter/relative times/destructive confirmations. Added 248 paired keys
   across five namespaces, reaching 2,152 per locale. Inventory, technical
   exceptions and follow-up findings are in SETTINGS_DATA_CATALOGS.md.
2. The actual production list views, wizard state view and confirmation
   descriptions are separately renderable with the existing presentation
   provider. Nine new tests exercise both catalogs, real CSV parsing and all
   applicable provider aliases, every canonical matching label, exact cell text,
   disabled controls, escaped names/filenames, known/unknown/prototype values,
   time/byte boundaries, empty/populated lists and original request contracts.
   English field labels are retained independently as `matchLabel`, so localized
   display text cannot alter existing auto-mapping. Source fixtures were captured
   before extraction and checked against the final code using the TypeScript AST.
3. Persian text is provisional. LOC-017/012/006/002 integration, native financial
   wording and RTL acceptance remain independent and open. Updated registries,
   LOC-017 handoff and this task's handoff without completing parent criteria.
   See LOC-020-review-1.md for honest self-review.

Unknown server/network prose now uses localized operation fallback; exact CSV
parser issues are translated from an allowlist and unknown row diagnostics use
input-check copy. Server errors and persisted job details remain unchanged. Trash
fetch rejections report a localized load error rather than an unhandled rejection.
No new user operation, REST/MCP/domain/schema change or database access occurred.
Destructive request methods, bodies (including `confirm: true`), org headers,
filenames, field keys, aliases, required flags and date queries are preserved.

The generated money inventory was refreshed only for changed source hashes,
occurrence lines and new consumer files: 417 columns, 1,638 consumer files. No
money-unit policy/classification, stored amount or FX behavior changed.

## Verification

All commands ran from the repository root using installed dependencies. Results
below are actual final outcomes; no full build or unrequested dev server ran.

| Command | Actual result |
|---|---|
| `node --import tsx --test tests/settings-data-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts` | Exit 0; 26 passed, zero failed/skipped |
| `pnpm test` | Exit 0; 646 passed, zero failed/skipped |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` | Exit 0; zero errors, 75 existing warnings outside changed sources |
| `pnpm exec eslint` with the three pages, wizard, two new settings component files, two new presentation helpers and focused test | Exit 0; zero warnings/errors |
| `pnpm i18n:check` | Exit 0; 2,152 matching keys per locale |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1,638 consumer files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; hashes and occurrence/source lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks passed |
| `python .agentic/agent.py validate` | Exit 0; 247 structurally valid tasks; repeated before final disposition |
| `git diff --check` | Exit 0; repeated after documentation/disposition |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

The initial focused extraction audit found one remaining hardcoded wizard
Preview action; corrected it and the final focused/full suites passed. Interim
generation issues were corrected before final verification. No failed attempt
is represented as passed.

## Review, limits and handoff

Existing source findings were documented for independent parent assessment:
bulk-empty-trash has no MCP counterpart, its filtered/page confirmation count
does not describe the full organization-wide deletion scope, multi-selection
exports all files and the explicit `all` export branch does not apply selected
transactional date filters. These behaviors were preserved, not qualified as
correct by the request-preservation tests. The existing trash filter also omits
backup records; returned backup type labels are translated without adding a filter.

Native review, browser interaction/layout/font rendering, full RTL, live DB/REST/
MCP persistence/destructive action testing, PDF/physical print, Docker, deployment
and hosted CI were not performed or accepted. No financial or IRR-readiness claim.
Complete controller check/submit/self-review/done, commit all reviewed files per
the explicit user request, push origin/master, verify remote SHA and clean tree,
report the next controller task and stop.
