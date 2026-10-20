# LOC-084 attempt 1 - payroll run detail catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `71fb58e7`; clean entry tree. Live controller validate/status/next
selected LOC-084; exactly that child was started. Origin fetch confirmed zero
ahead/zero behind before implementation. User authorized completion and push.
No subagents. The memory controller-task skill guided the workflow; current
repository/controller state governed selection and acceptance.

Read root instructions, START_HERE, project/map/frontend guidance, task and
parent, catalog contract, relevant source sections, and prior payroll handoff
and self-review. Inspected the actual detail page, money/readers, run/output
REST/MCP routes, shared services, enums and migrated fixtures. No application
database was used.

## Acceptance mapping

1. Extracted all authored copy in the owned run detail page into 99 paired
   flat `PayrollRunDetail` messages. Catalog validation reports 7,436 compatible
   keys per locale. All authored Persian prose contains Persian script.
   [Scope and exceptions](../registries/PAYROLL_RUN_DETAIL_CATALOGS.md) records
   shared loading, the data-only employee option, punctuation, canonical dates,
   saved descriptions/caller data and exact fixed-two cents.
2. Real next-intl/PresentationProvider rendering and production callbacks pass
   in both locales. The checked detail reader rejects HTTP/JSON/envelope,
   required-field, enum, date, exact-rate and money problems before adoption
   or mutation success. Raw private errors use finite translated feedback.
   Initial run/bonus reads adopt together; missing organization and failures
   finish loading. Cleanup suppresses obsolete reads and later bonus requests.
   Failed mutations preserve forms/dialogs, release busy and avoid false
   success, reload or navigation. Bonus refresh is atomic after validation.
   Existing lifecycle and bonus/generation payloads, action constraints,
   confirmation cancellation, calculations and posting contracts remain.
3. Task handoff, scope inventory, catalog index and honest self-review retain
   provisional Persian and independent LOC-067/008/002/native/RTL acceptance.

No financial calculation, currency scale, stored amount/description, statutory
identifier, canonical date, permission, REST/MCP definition, schema/migration,
IRR flag, provider or Stripe change. Existing org-scoped MCP operations already
cover all owned actions. Generated money inventory updates only scanned paths
and owned consumers; schema classifications and other sections are unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Focused production rendering/callback and payroll money suite | 15/15 pass, zero skips; final focused run 6.372 seconds | Controlled hooks/IO and portal boundaries |
| Catalog validation | Exit 0; 7,436 keys per locale | No native linguistic approval |
| Owned-file ESLint | Exit 0; zero warnings/errors | Page, reader, focused/source-guard tests and both integration workers |
| Full lint | Exit 0; zero errors, 51 existing warnings | No broad lint cleanup |
| Typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Migrated run/lifecycle, history and output fixtures | 3/3 pass, zero skips; 37.499 seconds | Real REST, linked registered MCP and independent SQL on isolated PostgreSQL 18 |
| Full unit/static suite | 1,189/1,189 pass, zero skips; 236.223 seconds | Concurrency 2 |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,388 scanned paths, 1,779 consumer hashes; nine legacy checks | Source inventory only |
| Controller validation and diff check | Pass during implementation | Repeat with completed evidence |
| Owned Markdown links | 97 local targets exist | Task, catalog index, scope, attempt and review |

```text
node --import tsx --test tests/payroll-run-detail-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-runs.test.ts tests/integration/payroll-outputs.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/runs/[id]/page.tsx" i18n/payroll-run-detail-presentation.ts tests/payroll-run-detail-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-runs-worker.ts tests/integration/payroll-outputs-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Focused assertions cover populated/empty/not-found/filtered/loading/error/busy
states, all status/type/approval/item/bonus labels, unchanged creation choices,
search and navigation, caller escaping, maximal fixed cents and bigint
deduction sums above safe Number range, invalid/missing/conflicting aliases,
malformed fields/enums/dates/envelopes, initial atomic reads and cleanup,
actual lifecycle confirmations and POSTs, cancellation, payslip count success,
bonus exact payloads/checked refresh, failure retention and copy/script audit.
No private server/parser/network/storage prose becomes visible feedback.

The run worker checks real REST and registered linked MCP detail, process,
submission, approval, rejection, bonus list and bonus creation responses with
the new reader. The output worker checks actual REST/MCP generation counts.
Existing independent SQL, ledger balance, exact cents/FX, history preservation,
authorization/isolation, audit and rollback assertions remain intact.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6453, with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN pointed fixtures there; each case created/dropped its
own randomized database. An independent admin query found zero remaining
dubbl_ci_* databases. pg_ctl stopped the isolated server successfully.

Initial focused tests passed. Initial typecheck found that existing catalog
tests assume flat namespaces; flattened the new enum message keys to match
that repository convention and reran focused/catalog/type checks successfully.
Removed one unused test-helper warning; final owned lint is clean.

## Review and remaining qualification

See [Codex self-review](LOC-084-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian financial terminology remains
provisional. LOC-067/008/002 retain independent combined acceptance.
Mounted browser/keyboard, full RTL/numerals/calendar, remaining payroll
outputs, hosted CI, deployment and production acceptance are not claimed.
No full build, dev server, Docker, external provider request, application DB,
deployment or dedicated Stripe work ran. Controller closure and scoped commit/
push follow successful checks; remote synchronization is reported only after
verification.
