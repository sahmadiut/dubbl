# LOC-032 attempt 1 - bank reconciliation catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 696b81ca43d4f12711452dd571806e6eb7a8a4c5. Entry tree was clean.
The user authorized completing and pushing the next task. Live controller
validate/status/next/context selected LOC-032; started with owner Codex. Used
the memory Dubbl controller-task skill. No subagents were used. Read root
instructions, entry/controller/frontend guidance, project/repository map,
task/parent/dependencies, catalog contract and preceding banking evidence.
Inspected actual page/report, money/wire helpers, REST routes/shared services
and registered MCP tools. DEC-008 preserves Stripe unchanged. Completed only
this bounded child; LOC-023/007/002 retain independent integration acceptance.

## Acceptance mapping

1. Added 93 paired `BankReconciliation` messages for all authored visible copy
   in the reconciliation page, ReconciliationReport and RecLineList presentation.
   Covers page/sheet/dialog headings, field labels, guidance, summaries, status,
   tooltips, accessible back action, operation failures/successes/busy states and
   ICU counts/pronouns. All preexisting namespaces are identical to entry HEAD.
   See [scope and explicit exceptions](../registries/BANK_RECONCILIATION_CATALOGS.md).
2. Added a finite typed UI mapping for 17 current service failures and reused
   BankAccountErrors for known shared failures/statuses. Specific local decimal
   balance exceptions are translated. Unknown/HTML/network/parser prose uses
   operation fallbacks. Cloning error responses preserves the shared reader.
   Bulk updates now report zero success as error and partial success as warning
   with both counts; canonical requests/reset/refresh remain unchanged. No
   financial, service, schema/migration, REST, MCP or Stripe path changed.
3. Twelve new meaningful test groups use actual production templates through
   React/next-intl/PresentationProvider in both locales, with controlled state,
   navigation and inline portal boundaries. Actual callback syntax tests read,
   create, complete, adjustment, selection and bulk paths. They establish
   canonical org headers/routes/query filters, Gregorian dates, exact signed
   USD/KWD Minor strings, low-digit precision, default saved adjustment text,
   trimmed caller text, session/action/optional-ID contracts, counted results,
   eligibility/completed/zero guards and failed-write input preservation.
4. Tests cover empty/populated/history/status/sheet/report/dialog branches,
   positive/negative differences, exact summaries/previews, no-ledger and mixed
   currencies, escaped caller data, runtime zero/one/two/fraction plurals,
   unknown/prototype/HTML/network/permission errors, invalid fractional/unsafe
   balances and optional report-read failure. AST auditing rejects authored
   English JSX/visible literal attributes. Every new Persian leaf contains
   Persian characters. Full catalog validation passes 3,466 keys per locale.
5. Updated the ownership registry, bounded scope/handoff and conservative money
   inventory for changed source hashes/lines and the two new source files.
   Persian wording is provisional. LOC-023/007/002 integration and native/RTL
   acceptance remain independently open; controller completion is not release
   or production IRR qualification.

## Verification

All commands ran in D:/Projects/dubbl; final passing commands exited 0.

| Check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-032 | 292 structurally valid tasks; selected this bounded child |
| `node --import tsx --test tests/bank-reconciliation-catalogs.test.ts tests/bank-reconciliation-wire.test.ts tests/bank-workspace-catalogs.test.ts tests/bank-import-catalogs.test.ts` | 32/32 passed; no failures/skips; 20.080 seconds |
| `pnpm test` | 759/759 passed; no failures/skips; 53.107 seconds |
| `pnpm typecheck` | Passed, fumadocs-mdx and tsc --noEmit |
| Changed-page/shared/helper/test `pnpm exec eslint` | Passed with zero errors/warnings |
| `pnpm lint` | Passed with zero errors and 75 preexisting warnings |
| `pnpm i18n:check` | 3,466 compatible keys per locale |
| `python .agentic/scripts/money_inventory.py --write` | 417 columns, 2,222 scanned files, 1,664 consumers, 32,095 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Verified 417 schema columns, 1,664 consumer hashes and all occurrence/source lines |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| AST/JSON identity audit against entry HEAD | Preexisting namespaces and all unowned shared declarations unchanged; no financial/REST/MCP/Stripe path changed |
| `git diff --check` | Passed |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | 0 ahead/0 behind before commit |

An intermediate inventory verification reported source/hash drift after final
helper/test edits; regenerated the inventory and the final verifier passed.
The full suite includes existing regressions; no dedicated Stripe work occurred.
No database integration was run for this presentation-only change. No application
DB, full build, dev server, Docker, provider or screenshot tooling was used.

## Review and handoff

See [honest self-review](LOC-032-review-1.md). Native linguistic approval, full
RTL/font/layout, browser event automation, hosted CI, providers, deployment and
production IRR qualification are not claimed. Tests exercise real templates and
callback syntax at controlled boundaries, not DB transactions or browser clicks.

Complete controller checks/submission/self-review/done; validate document links,
controller state and scoped diff. Commit/push task-owned files to origin/master
under the user's authorization, verify remote SHA and clean tree, report the
controller's live next task and stop.
