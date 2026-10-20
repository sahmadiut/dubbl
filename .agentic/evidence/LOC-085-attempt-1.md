# LOC-085 attempt 1 - payroll payslip and tax form catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `544205b9`; clean entry tree. Live controller validate/status/next
selected LOC-085; exactly that child was started. Origin fetch confirmed zero
ahead/zero behind before implementation. User authorized completion and push.
No subagents. The memory controller-task skill guided the workflow; current
repository/controller state governed selection and acceptance.

Read root/.agentic instructions, START_HERE, project/map/frontend guidance,
task and parent, catalog contract, relevant source sections and prior payroll
handoff. Inspected the three actual pages, shared readers/money/download
helper, output service/wire, schema enums, REST/MCP registrations, adjacent
output generation and migrated fixtures. No application database was used.

## Acceptance mapping

1. Extracted authored copy in the three owned pages into 83 paired flat
   `PayrollOutputs` messages. Catalog validation reports 7,519 compatible keys
   per locale. All Persian prose leaves contain Persian script; three
   statutory form identifiers deliberately match English. See
   [scope and exceptions](../registries/PAYROLL_OUTPUT_CATALOGS.md) for full
   adjacent generated output ownership, shared loading, caller data, canonical
   date/year and fixed-two cents exceptions. The existing PDF-named endpoint
   returns JSON; its note and wire identifiers remain unchanged and are not
   displayed by these pages. Broader output prose remains assigned to LOC-009.
2. Real next-intl/PresentationProvider rendering and production callbacks pass
   in both locales. Checked readers reject invalid HTTP/JSON/envelopes,
   required fields, enums, metadata and missing/conflicting money aliases.
   Run/payslip reads adopt atomically after link/duplicate checks; initial
   cleanup ignores obsolete reads. Missing org/storage failure finishes
   loading; 404 retains not-found. Viewed status requires a valid matching GET.
   Generation validates the batch/count and refreshed list before success;
   failed mutations retain list/year/expanded state and release busy. Download
   callbacks exercise the real existing file helper with org headers and JSON
   filename; failures use finite translated feedback. No raw private errors
   reach visible state/toasts. All five saved tax statuses and empty historical
   1099-MISC batches retain readable labels; unsupported generation stays so.
3. Task handoff, catalog index, generated-output scope inventory and honest
   self-review record provisional Persian and independent parent/native/RTL
   acceptance. LOC-067/008/002 remain open.

No financial calculation, currency scale, stored money/description, statutory
identifier, permission, REST/MCP definition, schema/migration, IRR flag,
provider or Stripe change. Generation-date presentation now uses the saved UTC
date prefix rather than implicit host locale/timezone formatting; full locale
calendar/numeral presentation is independent. Existing org-scoped MCP already
covers all owned operations. Generated money inventory changes only scanned
paths and owned consumer hashes/occurrences; schema classifications and other
inventory sections remain unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Final focused production rendering/callback and payroll money suite | 15/15 pass, zero skips; 4.572 seconds | Controlled hooks/IO and portal boundaries |
| Catalog validation | Exit 0; 7,519 keys per locale | No native linguistic approval |
| Final owned-file ESLint | Exit 0; zero warnings/errors | Three pages, reader, focused/source-guard tests and output worker |
| Full lint | Exit 0; zero errors, 51 existing warnings | Final owned lint also covers later enum additions |
| Final typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Final migrated payroll output fixture | 1/1 pass, zero skips; 12.700 seconds | Real REST, linked registered MCP and independent SQL on isolated PostgreSQL 18 |
| Full unit/static suite | 1,199/1,199 pass, zero skips; 268.162 seconds | Concurrency 2; final focused checks also cover enum additions |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,390 scanned paths, 1,781 consumer hashes; nine legacy checks | Source inventory only |
| Controller validation and diff check | Pass during implementation | Repeat with completed evidence |

```text
node --import tsx --test tests/payroll-output-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-outputs.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/runs/[id]/payslips/page.tsx" "app/(dashboard)/payroll/tax-forms/page.tsx" "app/(dashboard)/payroll/tax-forms/[id]/page.tsx" i18n/payroll-output-presentation.ts tests/payroll-output-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-outputs-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Focused coverage includes populated/empty/not-found/loading/error/busy states,
all payslip/tax statuses, statutory box and known metadata labels, unchanged
year choices/default/generation types, singular/plural missing counts, escaped
caller data, masked tax IDs, maximal fixed cents and bigint differences beyond
safe Number range, invalid/missing/conflicting aliases, malformed fields/enums/
metadata/envelopes, checked initial reads and cleanup, view GET/link/status
checks, generation POST/count/refresh/failure retention, real authenticated
JSON download callbacks and file/error paths, navigation/expansion/year editing,
copy audit and Persian-script exceptions.

The output worker applies the new reader to actual successful REST and linked
registered MCP payslip list/detail, tax batch list/detail and generation
responses. Existing independent SQL checks, history/YTD/tax exactness,
authorization/isolation, idempotency, rollback, audit and migration assertions
remain intact. Existing downloaded JSON data and protocol note are preserved.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6453 with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN pointed the fixture there; each run created/dropped its
own randomized database. The final admin query found zero remaining dubbl_ci_*
databases. pg_ctl stopped the isolated server successfully. No application DB
or application environment credentials were used.

During implementation, initial typecheck caught a mechanical JSX map syntax
error and an unreachable translated default in exhaustive status switches;
both were corrected. A download callback test initially asserted before the
page's void async callback completed; the test now flushes that callback.
Schema review caught `corrected` status and empty historical 1099-MISC batches;
added labels/reader coverage. Final focused/catalog/type/owned-lint checks pass.

## Review and remaining qualification

See [Codex self-review](LOC-085-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian financial terminology is
provisional. LOC-067/008/002 retain independent combined acceptance.
Mounted browser/keyboard, full RTL/numerals/calendar, remaining payroll/output
translation, hosted CI, deployment and production acceptance are not claimed.
No full build, dev server, Docker, external provider request, application DB,
deployment or dedicated Stripe work ran. Controller closure and scoped commit/
push follow successful checks; remote synchronization is reported only after
verification.
