# RTL-014 accounting and tax integration acceptance

## Identity and independent parent scope

Codex, 2026-10-26, master baseline e6b28b5db107d142260fecd08026657dcdeac01a. Entry tree/index were clean. Live controller validate/status/next selected RTL-014; claimed by codex-rtl014-integration. This is the first task of a new owner-authorized two-commit batch. Commit locally only; the supervisor assigns the next task to a completely fresh agent and coordinates the paired push.

This is independent integration acceptance after RTL-030/031/032/033/034, not automatic parent completion from child statuses. Current non-banking accounting and tax TSX census was independently compared with RTL_MODULE_OWNERSHIP: exactly 31 current sources, assigned once, no missing/extra/duplicate paths (4/7/8/3/9). The five child attempt/review records were read, current isolation/native-control/navigation/sort/callback boundaries inspected, and all five suites plus their consumers rerun together. Three new tests close the real accounting shell/account-context/budget-context composition boundary which individual child bidi fixtures controlled.

## Current exhaustive source disposition

Paths below are relative to app/(dashboard). Child records retain detailed per-file implementation history; the following is the current integration disposition, checked against current sources rather than inferred from completed tasks.

| Sources | Integration result and preserved boundary |
|---|---|
| accounting/accounts/page.tsx | Isolated caller/code/currency labels, named raw search/type/sort, wrapping groups/actions and original routes/drawer arguments retained. |
| accounting/accounts/[id]/layout.tsx | Actual AccountContext provider composes with both real child pages. GL versus account currency provenance, exact summary aliases, caller/code isolation, current-page selection and original tab/back routes retained. |
| accounting/accounts/[id]/page.tsx | Exact ledger low digits, signed balances, entry/date isolation, raw filters/canonical date callbacks, local table scrolling, append/alias guards retained. Composed beneath actual parent shell and account layout. |
| accounting/accounts/[id]/settings/page.tsx | Actual context supplies the original caller name, account currency and built-in locks. Native label association and auto/LTR direction, raw FormData/PATCH/delete/status contracts retained. |
| accounting/page.tsx; accounting/[id]/page.tsx | List/detail/editor mixed caller/reference/entry/date/money boundaries, currency grouping, chronological data and original create/edit/post/void/delete/error callbacks retained. |
| accounting/recurring-journals/page.tsx; accounting/recurring-journals/[id]/page.tsx | Raw schedule/status/filter/route codes, account identifiers, exact lines/totals and run/pause/resume/delete boundaries retained. |
| accounting/opening-balances/page.tsx | Rich canonical saved date, validated saved lines, exact preview/write and opening drawer arguments retained. |
| accounting/layout.tsx; accounting/loading.tsx | Existing qualified TabLayout and BrandLoader reused. Real top-level navigation retains all ten hrefs and one active page; real detail composition hides outer tabs while preserving exactly one correctly selected child nav. Local navigation scrolling is deliberate; native browser clipping/focus is unverified. |
| accounting/budgets/page.tsx | Actual accounting shell/list composition retains caller/code isolation, original detail route, exact fixed-cents report currency and ratios. Two complete percentage tokens now share LTR isolation. |
| accounting/budgets/[id]/layout.tsx | Actual BudgetContext supplies both real pages with unchanged caller/currency/amount/period data. Complete utilization percentage is now isolated together; original navigation, totals and ratios retained. |
| accounting/budgets/[id]/page.tsx | Parent audit repaired the previously bare zero-actual budget amount, two complete percentage tokens and three variance sign/amount groups. Existing chronological sort-copy/chart keys, raw exact tooltips, source snapshots, local table scrolling and calculations retained. |
| accounting/budgets/[id]/settings/page.tsx | Actual context initializes caller/date/account/period drafts. Label association, native directions, sort-copy, exact fixed-cents distribution, errors and original PATCH/toggle/delete callbacks retained. |
| accounting/loans/page.tsx; accounting/loans/[id]/page.tsx | Fixed-two money, complete technical percentage, caller/schedule/date/status isolation, bank/account restrictions, saved order and original payment/route callbacks retained. |
| accounting/accruals/page.tsx; accounting/accruals/[id]/page.tsx | Exact fixed-cents totals, canonical sorted schedule/date/status/caller boundaries, raw filters and post/cancel/error callbacks retained. |
| accounting/fixed-assets/page.tsx; accounting/fixed-assets/[id]/page.tsx | Caller/reference/account/signed-history isolation, original exact lifecycle amounts/order and bar ratios, associated technical/prose controls and local table/dialog scrolling retained. |
| accounting/asset-categories/page.tsx | Method/convention enums, residual Minor values, rate basis points and account IDs stay canonical; associated fields/groups, directions and announced save errors retained. |
| tax/layout.tsx; tax/page.tsx | Qualified shared navigation, original country eligibility and open-period counts retained. Tax names/complete percentages, associated compound fields, native directions and original basis-point/null/account/create/edit/seed callbacks retained. |
| tax/currencies/page.tsx | Canonical ISO/direction/rateExact/currency decimals, caller/code/reference/amount boundaries, scoped queries and raw FX/filter/create callbacks retained. |
| tax/periods/page.tsx; tax/periods/[id]/page.tsx | Rich caller/reference/date/signed-money boundaries, copied statutory snapshot sort, unchanged bank asset/subtype/currency restrictions, canonical create/file/settlement lifecycle and retries retained. |
| tax/bas/page.tsx; tax/sales-tax/page.tsx; tax/schedule-c/page.tsx; tax/vat-return/page.tsx | All four actual reports compose with real tax navigation. Original statutory identifiers/order, refund/zero/negative values, exact sums/ratios, date/basis/drill/print and machine CSV snapshots retained. Existing worksheet/jurisdiction limitations remain. |

Imported non-TSX money/presentation helpers were inspected at these consumers, including journal-display, asset-loan-ui, budget-ui and tax-ui. Fixed-two asset/loan/budget contracts remain distinct from currency-scaled journal/tax display/input contracts. No normalization, rescaling, FX/math, caller trimming, posted history, REST/MCP, DB/schema/migration, provider or frozen Stripe changes. No new user operation or MCP tool is introduced.

## Parent repairs and new combined regression

Only nine JSX isolation boundaries in three budget views change. Existing expressions, sign choices, percent values, English/Persian wording, raw values and percentage CSS width calculations are byte-preserved inside the new boundaries. Search across all assigned views identified every matching split percentage in this bounded parent; all five are grouped with their percentage symbol. Three overview/table variance groups now include their existing sign and amount in the same bdi. The zero-actual card uses the same isolated formatter result as nonzero cards.

tests/rtl-accounting-tax-integration.test.ts composes actual AccountingLayout + AccountDetailLayout + ledger/settings, and AccountingLayout + BudgetDetailLayout + overview/settings, sharing the real exported context identities. It exercises en-US/fa-IR x latn/arabext with escaped long mixed Persian/English caller values and exact 4000000000000001 minor units. Budget zero and overspent cases assert complete percentage/sign boundaries, exact isolated low digits, original context currencies, unchanged saved period snapshots and real current-nav callbacks. A third test composes the real budget list with all ten accounting links, its active-page identity, complete percentage, exact amount and detail callback. Both ESM/CJS test provider contexts receive the same presentation; no production context is stubbed. Only state/effect/router/confirmation/drawer IO is controlled; SSR is not a mounted-browser claim.

## Actual checks

Commands ran from D:\Projects\dubbl, with heavy test/typecheck/full-lint jobs sequenced.

- Combined baseline: `node --import tsx --test --test-concurrency=1` over rtl-ledger-accounts, rtl-journals, rtl-budget-loan-accrual, rtl-fixed-assets, rtl-tax-controls, account-catalogs, ledger-aging-ui, journal-catalogs, journal-ui-components, journal-ui-money, opening-balance-ui-money, budget-catalogs, loan-catalogs, accrual-catalogs, budget-project-crm-ui, asset-loan-ui-money, fixed-asset-catalogs, asset-category-catalogs, asset-loan-budget-accrual-catalog-integration, tax-rate-catalogs, tax-period-catalogs, tax-filing-catalogs, vat-return-catalogs, tax-catalog-integration and tax-ui-money (`tests/*.test.ts` filenames): 170/170 passed, zero failures/skips/cancellations. This was before the nine parent isolation repairs.
- After all production repairs: `node --import tsx --test --test-concurrency=1 tests/rtl-accounting-tax-integration.test.ts tests/rtl-budget-loan-accrual.test.ts tests/budget-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/asset-loan-budget-accrual-catalog-integration.test.ts`: 25/25 passed (23 existing affected regressions and the first two new parent cases). Includes installed logical/wrapping/local-scroll CSS and exact chart/callback/data checks.
- After adding the third parent case and final assertions: `node --import tsx --test tests/rtl-accounting-tax-integration.test.ts`: 3/3 passed, zero failures/skips/cancellations. In total 173 unique test cases are evidenced across the recorded runs, not a claim that a single final 173-test run occurred.
- Final `pnpm exec tsc --noEmit`: passed, exit 0, with the three-case parent suite present.
- `pnpm i18n:check`: passed, 10723 paired keys; no catalog changes.
- `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: all nine checks passed.

- `pnpm lint`: passed, exit 0, zero errors and 21 existing unrelated warnings. The new suite and three changed budget views have no lint diagnostics.
- `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: passed, 417 columns / 1894 consumers. The diff refreshes only three owned source hashes and adds the new test/scanned path; no schema-column content change.
- `git diff --check`: passed. Final controller validation follows the attributed review/completion; entry structural validation passed for 415 tasks. Structural validity is not implementation or native/financial proof.

## Acceptance mapping

1. The independent current 31-source census, exhaustive source disposition and combined consumer/alias/lifecycle/export checks cover every assigned file. The real shell/context regression preserves route, caller, currency, saved snapshot and exact low-digit contracts.
2. Five existing child component/CSS suites reran in the combined baseline. After the parent audit repaired the remaining complete-token boundaries, all 23 affected retained tests and the final three real-composition cases passed across both languages and numeral choices. Existing logical/wrapping/local-scroll/unclamped CSS coverage remains valid because the parent changes no CSS classes or layout calculations.
3. Exact ownership, actual runs and unverified native/browser/accounting/output boundaries are explicit here and in the self-review. Broader integration/qualification tasks retain independent acceptance.

## Acceptance limits and handoff

This accepts only RTL-014's bounded technical source/component/CSS integration. No build/dev-server startup, app DB write, live REST/MCP/SQL, mounted browser/caret/selection/keyboard/AT/zoom/clipping review, native Persian/legal/accounting review, live tax authority/provider action, PDF/email/printed-output qualification, hosted CI result, IRR activation, production release or deployment is performed or claimed. Existing technical English date/rate conventions, fixed-two asset/budget contracts and jurisdiction/worksheet assumptions remain explicit. DEC-005 removes screenshot requirements; DEC-008 preserves Stripe. RTL-010, RTL-008 and RTL-002 retain independent acceptance, as do later native/financial/output/release gates.

Complete honestly attributed self-review/controller steps, create one scoped local commit, and return to the supervisor for a fresh next-task agent and eventual paired push. No push by this task.
