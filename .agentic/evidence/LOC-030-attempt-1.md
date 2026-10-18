# LOC-030 attempt 1 - bank transaction workspace catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 8c53a323eb5189ce63fc683483d2d7c349965678. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next/context selected LOC-030; started only this bounded child
of LOC-023. No subagents were used. Read repository/controller/frontend guidance,
catalog contract, parent/dependency evidence, requirements sections and relevant
banking UI, money adapters, REST routes and registered MCP tools. Applied the
memory controller-task skill. DEC-008 preserves Stripe unchanged.

## Implementation and acceptance mapping

1. Added 303 paired `BankWorkspace` messages for detail layout/overview/
   transactions and shared transaction-row, matching, expense, categorize,
   transfer, split and bulk-assignment templates. Existing namespaces are
   unchanged; shared account types reuse `BankAccounts`. Full inventory and
   exceptions are in [workspace scope](../registries/BANK_WORKSPACE_CATALOGS.md).
   Import/reconciliation component copy remains separately owned by LOC-031/032.
2. Complete messages replace concatenated descriptions/counts. ICU controls
   transaction plurals and partial results. Structured clearing guidance uses
   approved em/strong renderers. Fixed local financial validations, matching
   explanations and known bank request failures translate at the UI boundary;
   unknown server/network/HTML/parser prose uses safe translated fallbacks.
3. Existing exact-money adapters, currency scales, state derivation, amounts,
   account resolution and machine REST/MCP payloads remain unchanged. The saved
   Director's loan memo stays canonical English data. No REST/MCP/service,
   schema or migration file changed and no new operation was introduced.
4. Bulk ignore previously treated resolved HTTP error responses as success.
   It now checks response status before announcing success/clearing selection.
   Actual callback tests cover rejection, retained selection and loading reset.
5. Added eleven focused test groups: real production template rendering through
   React/next-intl/PresentationProvider in both locales; all derived transaction
   states and confirmations; selected document/legacy/unified match flows;
   bigint amount/tax/split previews; expense/categorize/transfer/split writes;
   bulk selection/fill-down/save; currency scales and canonical Minor strings;
   org headers, match discriminators and null behavior; amount/HTTP/network/HTML
   failures; partial-result ICU notifications; safe interpolation and source audit.
   State/navigation are controlled, portals/select options are inline, and
   unowned picker/tracking/attachment widgets are narrow boundaries. Callback
   tests execute actual production syntax with controlled network/state.
6. Updated catalog scope/ownership and refreshed the conservative money inventory
   for changed source lines and new helper/test files. Parent/native/RTL handoff
   is explicit; no child completion is substituted for parent acceptance.

## Verification

Commands ran in D:/Projects/dubbl. All passed commands exited 0.

| Check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-030 | 292 valid tasks; selected this child |
| `node --import tsx --test tests/bank-workspace-catalogs.test.ts` | 11/11 groups passed in both locales |
| `node --import tsx --test tests/bank-workspace-catalogs.test.ts tests/bank-account-catalogs.test.ts tests/bank-ui-money.test.ts` | Final 25/25 tests passed, zero failures/skips; 8.301 seconds |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 741 passed, zero failures/skips; 87.411 seconds |
| `pnpm typecheck` | Passed, fumadocs-mdx and tsc --noEmit |
| `pnpm i18n:check` | 3,336 compatible keys in each locale |
| `pnpm lint` | Zero errors, 75 existing warnings |
| Changed-source/helper/test `pnpm exec eslint` | Zero errors/warnings |
| `python .agentic/scripts/money_inventory.py --write` | 417 columns, 2,218 scanned files, 1,661 consumer files, 32,022 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | All schema/hash/occurrence checks passed |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| AST/JSON identity audit against entry HEAD | Unowned ImportRow/ImportSheet/ReconciliationReport/RecLineList, deriveTxState/newSplitRow and every preexisting locale namespace unchanged; no Stripe-specific path changed |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | 0 ahead/0 behind before commit |

Full unit/lint/typecheck checks passed before a final spacing-only repair between
category/tax labels and their parenthetical hints. The final 25-test focused run,
changed-file lint and money inventory checks passed after that repair.

The optional existing `tests/integration/bank-ui-money.test.ts` regression was
attempted with an explicit loopback TEST_DATABASE_URL passed only to its child
process. The fixture creates a random disposable database and never migrates the
connection target. It failed before fixture creation with PostgreSQL 42501,
permission denied to create database; no application data was changed. This
integration run is not claimed as passed and is not required to accept this
catalog-only child. No role privileges were changed to bypass the failure.

During implementation, typecheck caught a translator shadowed by a transfer
target iterator; renamed the iterator. A render test initially loaded a separate
CommonJS next-intl context through DatePicker; the fixture now supplies the real
ESM DatePicker under the same provider. A test needed a non-null assertion after
tax preview generation, and lint caught children passed as a createElement prop;
both were corrected. None is counted as final passing verification. Final source
review restored English spacing between category/tax labels and hints.

## Review and handoff

See [honest self-review](LOC-030-review-1.md). Persian wording remains provisional
pending native review; full RTL/font/layout, browser event interaction, hosted
CI, providers, deployment and production IRR qualification remain independent.
No build, dev server, screenshot tooling or Docker execution was performed.
REST/MCP/SQL runtime acceptance is not claimed from the blocked optional run.

Finish controller checks/submission/self-review/done, stage only the reviewed
task-owned files, commit and push origin/master under the user's authorization,
verify remote SHA and clean tree, report the live next task and stop.
LOC-023/007/002 retain independent combined integration acceptance.
