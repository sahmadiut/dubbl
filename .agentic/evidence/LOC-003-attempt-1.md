# LOC-003 exact localized number foundation - 2026-10-24

## Identity and scope

Operator: Codex, fresh task sub-agent `/root/task_001`. Entry was clean master at
`92ec1a6c48f871e6c8b52d747d554999f64e6742`; controller validate/status/next
selected LOC-003. The owner authorized fresh sequential sub-agents to complete
and commit one controller task each, with the supervising agent pushing each
pair. This sub-agent makes one local commit and does not push.

Read root AGENTS, START_HERE, project/repository/controller/frontend guidance,
the task, requirements sections, MON-010 and LOC-002 evidence, exact parser,
localized parser, provider/preferences, shared controls and existing regressions.
Reused the strict complete-value normalizer from MON-010 rather than creating a
second permissive parser. This task supplies shared adapters and common-control
adoption; later L10N module tasks explicitly apply numeric/date adapters to their
remaining module surfaces. It does not claim all legacy formatters localized.

## Changes and acceptance mapping

1. **Identical IRR units:** existing parser tests and new preferred-numeral tests
   require Latin `123456789` and Persian `۱۲۳۴۵۶۷۸۹` to produce literal
   `123456789` IRR minor units. Real CurrencyInput callbacks emit that exact
   canonical text, followed by the existing invoice amount adapter. Numeral
   preference does not choose currency, change scale or activate IRR.
2. **Negative, large, fractional and malformed cases:** `i18n/numbers.ts` formats
   canonical decimals with bigint whole parts and exact fraction substitution in
   Intl parts. Fractional zeros, values above Number.MAX_SAFE_INTEGER, signed
   int64 bounds, negative subunits and 0/2/3-place currencies remain exact.
   Complete-value parsing retains the existing one-script/sign/separator grammar.
   The draft adapter permits explicit editing-only incomplete states while
   rejecting mixed scripts, unknown characters, bidi controls, exponent syntax,
   malformed grouping and excess precision. Domain validators remain responsible
   for sign/positive/zero/safe-range/write policy; drafts are not financial input.
3. **Presentation-only preferences:** `CurrencyInput` renders selected digits and
   separators while controlled parent values, callbacks and hidden form fields
   remain canonical ASCII. `DualAmount` uses the provider hook, exact ISO scale
   and bidi isolation for source/base money. `bankMoneyDisplay` delegates to the
   shared formatter with its historical English/Latin default and optional
   explicit presentation for later callers. Four language/numeral combinations
   prove independence from language, currency, date and FX wire data.

The new test renders real controls through PresentationProvider and captures the
production CurrencyInput event handler through its JSX runtime. It asserts exact
callback output and unchanged state after invalid edits, not a mirrored mock
implementation. The existing CommonJS-transpiled template fixtures require a
test-only provider bridge: tsx gives the local provider separate ESM/CommonJS
module identities. `tests/helpers/presentation.ts` now supplies the identical
presentation to both contexts. Production usePresentation still requires its
provider. Older expense component tests now use the existing presentation helper;
three accrual/budget assertions expect preferred input digits instead of ASCII
display text. Their canonical financial/payload assertions remain intact.

See [adapter and adoption contracts](../registries/LOCALIZED_NUMBERS.md).
No REST/MCP operation, permission, stored amount, schema/migration, rate/date,
catalog, IRR flag or Stripe source change. Existing locale preference REST/MCP
tools already expose numerals; no new operation requires another tool.

## Verification

All commands ran in D:/Projects/dubbl with installed dependencies. No database
was used or mutated; these are input/display changes with unchanged transports.

- `node --import tsx --test tests/localized-number-presentation.test.ts tests/localized-money.test.ts tests/invoice-ui-components.test.ts tests/bill-ui-components.test.ts tests/journal-ui-components.test.ts`:
  exit 0, 15/15 passed after correcting the new test's ESM/CommonJS capture-loader
  identity. The first invocation was 14/15 and failed only at the missing test
  provider; it is not reported as a pass. A later standalone new-suite run passed
  6/6 without the JSX harness's initial static-children warning.
- `node --import tsx --test tests/localized-number-presentation.test.ts tests/bank-ui-money.test.ts tests/invoice-ui-components.test.ts tests/bill-ui-components.test.ts tests/journal-ui-components.test.ts`:
  exit 0, 16/16 passed on the final shared bank-display delegation.
- `node --import tsx --test --test-concurrency=1 tests/accrual-catalogs.test.ts tests/asset-loan-budget-accrual-catalog-integration.test.ts tests/bank-payment-catalogs.test.ts tests/bank-workspace-catalogs.test.ts tests/bill-catalogs.test.ts tests/budget-catalogs.test.ts tests/crm-catalogs.test.ts tests/expense-ui-money.test.ts`:
  49 tests ran, 47 passed and 2 failed at the old Persian budget input display
  expectations. The command named nonexistent `crm-catalogs.test.ts`, so it did
  not check CRM. Both actual failed expectations were corrected explicitly.
- `node --import tsx --test --test-concurrency=1 tests/asset-loan-budget-accrual-catalog-integration.test.ts tests/budget-catalogs.test.ts tests/crm-pipeline-catalogs.test.ts`:
  exit 0, 18/18 passed after those corrections, including the actual CRM suite.
  These cover the failed budget tests and the remaining CommonJS fixture errors
  identified in the interrupted full run. Unchanged passing cases are not
  relabeled as a separately rerun 49-test passing command.
- `pnpm exec eslint i18n/numbers.ts i18n/use-numbers.ts components/ui/currency-input.tsx components/ui/dual-amount.tsx tests/localized-number-presentation.test.ts`:
  exit 0, no warnings. A later invocation also included final bank-display.ts
  and passed. Final changed-file lint over both new i18n files, both shared UI
  controls, bank-display.ts, the new regression, presentation helper and all four
  adjusted older tests also passed, exit 0 with no warnings.
- `pnpm i18n:check`: exit 0, 10,702 compatible keys per locale. Catalogs are
  unchanged by this task.
- `pnpm typecheck`: initial implementation passed, exit 0. A concurrent repeat
  was interrupted under memory pressure; the final sequential `pnpm typecheck`
  also completed with exit 0 on the final source and test tree.
- `pnpm lint`: exit 0, zero errors and 20 existing warnings outside owned code.
- `python .agentic/scripts/money_inventory.py --write`, then
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: passed, all
  417 column classifications preserved. Final refresh/verifier completed with
  exit 0, 2,473 scanned files, 1,855 consumer hashes and 36,717 source occurrences.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, nine regressions pass.
- Initial controller validation: exit 0, 360 structurally valid tasks.
- `git diff --check`: exit 0 before controller closure.

An attempted sequential full unit run was stopped after known pre-bridge
provider-context failures; it did not finish and is not a full-suite pass.
Affected accrual/budget/bank/bill/CRM/expense cases were reproduced and repaired
with the focused commands above. Concurrent focused/typecheck repeats were also
stopped when host memory fell to roughly 0.5 GB free, then relevant checks ran
sequentially. The first isolated accrual reproduction failed at the missing
provider; its later six-test run and the 49-test run pass after the bridge and
preferred-digit expectation change. No result is attributed to a killed process.

The generated inventory also refreshes four pre-existing stale consumer records
from entry commit 92ec1a6c: settings/page.tsx, onboarding-wizard.tsx and the two
message catalogs. Those source files are unchanged in this task. Only generator
output is refreshed; classifications and unrelated source remain preserved.

## Review and limits

See [honest Codex self-review](LOC-003-review-1.md). No full build/dev server,
browser mounted keyboard/cursor/IME/hydration, native linguistic review, complete
module/RTL/output qualification, provider delivery, hosted CI, production-data
rehearsal, production IRR activation or release sign-off is claimed.

Complete the evidence/controller closure and one task-owned local commit. The
supervising agent then starts the live next task in a fresh sub-agent; no push
is performed by this task agent.
