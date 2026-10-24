# LOC-130 verification: financial-domain currency units

Date: 2026-10-24. Agent: codex-task-003. Entry: clean master at
c219437fc4d1730cd977e39ff06e163b1bd65a3e. Live controller validate/status/next
selected LOC-130. LOC-115 remains an independent open whole-website acceptance
parent; LOC-131/132 retain their assigned domains.

## Implementation and scope

See [complete adopted-source/exception inventory](../registries/CURRENCY_UNIT_PRESENTATION.md#loc-130-domain-adoption).
Existing exact-money helpers accept explicit optional presentation. React pages,
shared document/detail forms and pure column/summary builders thread active
presentation. Currency names/normal headings/aria labels/errors, rate notes,
static sample amounts and known fixed-USD input prefixes use the existing label
adapter. English helpers keep their default behavior. Pure exact decimal legacy
formatting avoids amount-to-Number conversion, changed scale or new sum limits.
No REST/MCP operation, schema, stored currency, exact Minor string, rounding,
FX, financial calculation, reference row or Stripe source changed.

Actual production financial-detail templates run through real next-intl and
PresentationProvider with IRR/USD/JPY/KWD, signed safe-large amounts, exact low
digits, escaped caller text and English/Persian behavior. IRR is asserted as a
literal Persian owner name. Actual input/payment/rate labels render through the
provider; actual bank-transfer submit syntax runs with controlled transport and
asserts canonical ISO bank references, exact Minor payloads, memo/date/org scope.
Grouped summary tests retain independent currency groups and original policies.
Asset decimal tests retain fixed-two negative subunits and sums above int64.

Existing bilingual catalog fixtures were updated for intentional numeral/unit
presentation. The loan fixture had pre-existing drift from the account-default
commit: missing baseCurrency, active-bank eligibility fields and organization
read fixtures. These fixtures now match the existing production contract.
Mounting that newly exercised branch exposed an unrelated AccountPicker portal
SSR fixture stall; its loan form harness now uses an inline account field that
preserves placeholder/currencyFilter. Actual picker behavior has its existing
separate suite and no browser/picker qualification is claimed here. Request and
financial assertions were retained. Eleven obsolete disable directives in owned
components were removed after final lint identified them as unused; unrelated
warnings remain untouched.

## Concurrent external edit

During verification a separate edit changed only the USD Persian name in
`i18n/currency-names.ts` from the committed long name to the shorter name. This
agent neither authored, reverted nor included that edit in this task commit. An external actor later staged that file; its index state is preserved by an explicit-path task commit. Task tests use
the label adapter for provisional USD terminology and independently assert the
owner's literal IRR name. Committed-baseline versus live verification is recorded
below; LOC-129 tests are not changed to fit someone else's edit. The external
catalog is scanned but has no lexical money-consumer hash; inventory staging
does not capture its uncommitted contents. Task-owned changes can be clean while
that external file remains separately staged.

## Commands and results

All commands ran in D:/Projects/dubbl unless noted:

- `node --import tsx --test --test-concurrency=1 tests/currency-domain-presentation.test.ts tests/quote-ui-money.test.ts tests/sales-receipt-ui-money.test.ts tests/procurement-ui-money.test.ts tests/payment-ui-money.test.ts tests/asset-loan-ui-money.test.ts tests/invoice-ui-components.test.ts tests/bill-ui-components.test.ts tests/journal-ui-components.test.ts`: 32/32 pass. Initial new-domain check incorrectly expected a hidden field without a field name; corrected to assert actual preferred-digit rendering, then all 32 pass.
- `node --import tsx --test --test-reporter=tap --test-concurrency=1 tests/quote-catalogs.test.ts tests/sales-receipt-catalogs.test.ts tests/bill-catalogs.test.ts tests/bank-payment-catalogs.test.ts tests/bank-workspace-catalogs.test.ts tests/contact-financial-catalogs.test.ts tests/contact-list-catalogs.test.ts tests/fixed-asset-catalogs.test.ts tests/loan-catalogs.test.ts tests/revenue-schedule-catalogs.test.ts tests/accrual-catalogs.test.ts`: final live run exit 0, 99/99 pass in 82.5 seconds. This preserves all request/callback guards and updates intentional language/numeral expectations.
- Final isolated `node --import tsx --test --test-concurrency=1 tests/currency-domain-presentation.test.ts tests/loan-catalogs.test.ts`: exit 0, 13/13 pass. Intermediate catalog runs (including 69/81 and 60/64) exposed old display assertions and pre-existing loan fixture drift; they are not claimed passing. Long portal-backed loan fixture attempts and the first interrupted catalog run were stopped; the final 99-test command above supersedes them.
- `pnpm typecheck`: completed workspace run exit 0 after production implementation. A final workspace rerun completed with no TypeScript diagnostics; its process result was lost across the supervisor usage-limit continuation, so no separate exit-code claim is based on that rerun. No production changes followed the completed check except removing eleven obsolete lint directives; later changes were fixtures/evidence.
- Task-owned ESLint via `pnpm exec eslint <all changed ts/tsx paths> tests/currency-domain-presentation.test.ts`: exit 0, no errors, 12 warnings (11 unused existing disable directives plus one existing unused total). The 11 obsolete directives were then removed. `pnpm lint`: completed exit 0 with 31 warnings at that run (including those directives); no second full lint pass after their removal is claimed. An earlier competing full-lint process was stopped and is not counted as passing.
- `pnpm i18n:check`: exit 0, 10,702 paired message keys.
- `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0, 417 unchanged schema classifications, 2,478 scanned files, 1,859 consumer hashes, 36,777 occurrences. Refreshed again after final fixture changes; no external USD-catalog consumer hash exists.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, nine regressions pass.
- `python .agentic/agent.py validate`: exit 0, 364 structurally valid tasks. `git diff --cached --check`: exit 0.

### Committed-baseline verification

After staging only task-owned files, `git checkout-index --all --prefix=<temporary snapshot>/` materialized the exact staged source with the committed currency-name catalog. Its node_modules junction reused installed dependencies; no app DB or environment files were copied. In that snapshot:

`node --import tsx --test --test-concurrency=1 tests/currency-domain-presentation.test.ts tests/currency-labels.test.ts tests/localized-number-presentation.test.ts`

Exit 0, 14/14 pass (5.5 seconds), including the original LOC-129 USD assertions, literal Persian IRR, both languages/numerals and actual canonical input/picker callbacks. This proves required domain behavior with the external USD edit excluded. Snapshot creation and runtime checks did not change the user's working file.

An additional `pnpm typecheck` in the cold snapshot was CPU-active for over two CPU minutes and reached about 3.8 GB working memory under host pressure. It completed successfully before the proposed stop was attempted: recovered process result `BASELINE_TYPECHECK_EXIT=0`. This is a full staged-source typecheck pass with the committed currency-name catalog. No further test expansion was performed.

The staged diff excludes `i18n/currency-names.ts`; that separate external change remains staged by its external actor. Dashboard currency displays are explicitly outside LOC-130 and are not claimed fixed; LOC-132/LOC-115 retain their adoption/audit ownership.

## Limits

No full build/dev server, app database operation, hosted CI, native terminology
acceptance, mounted browser/keyboard/filtering/hydration, RTL visual acceptance,
production financial qualification or IRR activation was performed. An already
running user-owned dev server was observed and left untouched. Stripe remains
frozen under DEC-008. Technical ISO diagnostics and document/email/export output
exceptions are explicitly inventoried; this child does not complete LOC-115.

The supervisor handles the authorized pair push. This agent makes one local
LOC-130 commit and does not push or start LOC-131.
