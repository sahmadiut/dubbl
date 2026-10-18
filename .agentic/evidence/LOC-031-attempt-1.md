# LOC-031 attempt 1 - bank statement import catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 447ea552f28010d862afc854e39e5ec702907cc6. Entry tree was clean.
The user authorized completing and pushing the next task. Live controller
validate/status/next/context selected LOC-031, started with owner Codex. Applied
the memory Dubbl controller-task skill. No subagents were used. Read root/nested
instructions, controller/frontend guidance, project/repository map, task/parent,
catalog requirements/registry, LOC-030 dependency evidence and actual import UI,
money adapters, parser, REST route and registered MCP contracts. DEC-008 leaves
Stripe unchanged. Completed only this bounded child of LOC-023.

## Acceptance mapping and implementation

1. Added 37 paired `BankImports` messages for the imports page, shared history
   rows and upload/paste/preview sheet. This covers document title, actions,
   guidance, format detection, file size/removal, placeholders/accessibility
   labels, summary/table headings, statement periods, ICU row/duplicate counts,
   warnings and busy states. All previous locale namespaces remain unchanged.
   [Scope and exceptions](../registries/BANK_IMPORT_CATALOGS.md) document caller
   data, format names, canonical dates, and machine contracts. Actual history
   uses ImportRow; no separate ImportHistoryTab/mapping/profile editor exists
   in this slice. No new editor or user operation was introduced.
2. A finite typed presentation helper translates all six current parser warnings;
   unknown warnings produce a translated review reminder. Parser, saved warnings
   and REST/MCP responses remain unchanged. Existing import callbacks already
   localize success/operation failures, generic validation, auth and range errors
   through BankWorkspace/BankAccountErrors. They are directly tested, unchanged.
3. Six new focused test groups render actual production page/row/sheet templates
   through React, next-intl and PresentationProvider in both locales. Context,
   portal/select and network/state boundaries are controlled. Actual callback
   syntax verifies file/paste reading, org headers, auto/null and explicit format
   values, unchanged content, preview/commit modes, exact low digits, preview
   adaptation, success counts, input reset/close/refresh and rejected validation,
   authentication, authorization, HTTP/HTML/network/malformed/currency responses.
   Failures do not claim success, close the sheet, reset inputs or refresh.
4. Rendering checks cover empty/populated history, singular/plural/zero counts,
   periods, escaped caller file names/descriptions, all format options, known and
   unknown warnings, selected files, file size/removal, busy/disabled states,
   absent preview/period/warnings, canonical file accept filters and exact bigint
   values. Source audit checks all owned JSX/visible literal attributes. A Persian
   character check guards every new Persian message against encoding loss.
5. Updated catalog ownership and the conservative money inventory for new files
   and shifted source lines. No schema, migration, financial service, parser,
   REST/MCP or Stripe-specific implementation changed. No database was accessed.
   Independent LOC-023/007/002 acceptance, native wording and full RTL qualification
   remain open; Persian terminology is provisional.

## Verification

All commands ran in D:/Projects/dubbl. Passing commands exited 0.

| Check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-031 | 292 valid tasks; selected this child |
| `node --import tsx --test tests/bank-import-catalogs.test.ts tests/bank-workspace-catalogs.test.ts tests/bank-import-wire.test.ts tests/bank-ui-money.test.ts` | 25/25 passed, zero failures/skips; 13.994 seconds |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 747/747 passed, zero failures/skips; 85.104 seconds |
| `pnpm typecheck` | Passed, fumadocs-mdx and tsc --noEmit |
| `pnpm i18n:check` | 3,373 compatible keys per locale |
| Changed-page/shared/helper/test `pnpm exec eslint` | Zero errors/warnings |
| `pnpm lint` | Zero errors, 75 existing warnings |
| `python .agentic/scripts/money_inventory.py --write` | 417 columns, 2,220 scanned files, 1,662 consumer files, 32,031 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | All schema/hash/occurrence checks passed |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| AST/JSON identity audit against entry HEAD | All unowned shared declarations and preexisting namespaces unchanged; no financial/REST/MCP/Stripe path changed |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | 0 ahead/0 behind before commit |

The full unit suite includes existing regression tests; no dedicated Stripe work
was performed. Database integrations were not run for this presentation-only
change. No DB, full build, dev server, Docker or screenshot tooling was used.

During implementation a PowerShell-to-Python pipe replaced new non-ASCII text
with question marks. Replaced the new catalog leaves with UTF-8 apply_patch,
restored the English title separator and added the Persian-character guard.
The initial sheet assertion failed while that lossy catalog was present; all
final checks above passed after correction. The first identity audit compared
LF Git text with CRLF checkout text; the final audit normalizes line endings
and passed. Neither initial attempt is counted as passing verification.

## Review and handoff

See [honest self-review](LOC-031-review-1.md). Native linguistic approval,
full RTL/font/layout, browser event automation, hosted CI, provider/deployment
and production IRR qualification are not claimed by these template/callback
tests. LOC-023/007/002 retain independent combined acceptance.

Finish the controller checks/submission/self-review/done, verify local document
links/diff/controller state, stage only task-owned files and commit/push
origin/master under the user's authorization. Verify remote SHA/clean tree,
report the live next task and stop.
