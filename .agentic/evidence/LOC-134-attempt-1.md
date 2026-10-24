# LOC-134 - Previous-push CI diagnosis and regression-fixture repair

## Authoritative failure

- Repository: `sahmadiut/dubbl` (explicit `--repo`; default gh resolution points at the upstream fork and was not used for the diagnosis).
- Failed push: `1fe3cc31c7b92f73334445ff41f03b626c1dc62b`.
- Run: https://github.com/sahmadiut/dubbl/actions/runs/40079198572
- Failed job/step: Test / `pnpm test`, https://github.com/sahmadiut/dubbl/actions/runs/40079198572/job/120829003355
- Hosted result: 1,481 tests, 50 failures. Lint, Typecheck, Task Controller and PostgreSQL Migration Fixtures succeeded. Build and Docker Build were skipped because Test failed; this was not a build failure.
- Inspection: `gh run list --repo sahmadiut/dubbl --limit 8 --json databaseId,headSha,conclusion,status,workflowName,url,createdAt`; `gh run view 40079198572 --repo sahmadiut/dubbl --json jobs,url,conclusion`; `gh run view 40079198572 --repo sahmadiut/dubbl --log-failed`.

## Diagnosis

The localized shared controls and financial page adoption intentionally changed visible numeral systems and currency names. Older catalog/integration fixtures still required English currency strings or raw ISO unit headings while rendering the Persian provider. The separate approved USD label change also left two `دلار آمریکا` expectations inconsistent with `دلار`. The currency selector callback fixture called a hook-using component outside its provider. The invoice extracted callback omitted its new presentation closure. Canonical amount, mutation, organization scope, escaping and export assertions remain required.

Reconciling these expectations also exposed one genuine missed adoption: the accounting journal page had a presentation context but its table and posted-total callers still invoked `coreDebitDisplay` without it. Both now pass the active presentation. A real-page regression independently asserts literal `ریال` in both locations and unchanged `IRR`/`1250` canonical groups. This production omission is distinguished from the stale fixtures; English behavior, existing per-currency display scales and legacy raw aliases are retained.

The exhaustive catalog test froze 10,587 keys. Comparing the last successful push `c5ac4eb3` with current catalogs proves 115 additions: AccountNames 101, OnboardingOptions 7, Loans 6, Accounts 1, producing 10,702 keys. The repaired count records these actual families; the existing loop continues to execute every real leaf, ICU choice and rich-text fixture in both languages.

Some payroll/inventory failures from the hosted SHA were already corrected by LOC-131 (`23f69071`), which is local and unpushed at the start of this task. The current affected-file run includes these files instead of assuming those repairs suffice.

## Repair boundaries

- Expected numeral strings use an independent literal character mapping in `tests/helpers/localized-fixtures.ts`; it does not call production number formatting. Approved representative currency-name literals include `ریال`, `دلار`, `یورو`, `دینار کویت` and `ین ژاپن`.
- Existing formatter-based expectations receive the same explicit locale as the rendered provider. Independent literal amount digits, fractions and known currency strings remain asserted.
- Canonical identifiers, dates, request bodies, hidden values, saved reference text and unchanged quantity contracts remain ASCII where required. Negative subunit expectations retain sign and bidi/currency placement.
- Currency selector callbacks execute under the actual presentation provider and still independently assert disabled IRR behavior and canonical selected ISO values.
- Invoice callback fixtures supply the real callback's presentation closure while retaining unchanged exact payload, retry/error and org assertions.
- Production change is limited to those two journal grouped-display caller arguments. No money scale, database, migration, API, MCP or Stripe change. LOC-132/LOC-115 and native/RTL/browser acceptance remain independent.

## Local verification

1. Final affected-file reproduction: **248/248 tests pass**, zero failed/skipped/cancelled, approximately 157 seconds. Exact command:

```powershell
node --import tsx --test --test-reporter=tap --test-concurrency=2 tests/account-catalogs.test.ts tests/accounting-sales-purchasing-catalog-integration.test.ts tests/asset-category-catalogs.test.ts tests/bank-account-catalogs.test.ts tests/bank-import-catalogs.test.ts tests/banking-catalog-integration.test.ts tests/bank-reconciliation-catalogs.test.ts tests/contact-catalog-integration.test.ts tests/credit-note-catalogs.test.ts tests/currency-labels.test.ts tests/customer-prepayment-catalogs.test.ts tests/debit-note-catalogs.test.ts tests/expense-catalogs.test.ts tests/functional-currency-settings.test.ts tests/goods-receipt-catalogs.test.ts tests/inventory-catalog-integration.test.ts tests/inventory-item-catalogs.test.ts tests/invoice-catalogs.test.ts tests/journal-catalogs.test.ts tests/landed-cost-catalogs.test.ts tests/payroll-catalog-integration.test.ts tests/payroll-contractor-catalogs.test.ts tests/payroll-employee-catalogs.test.ts tests/purchase-order-catalogs.test.ts tests/purchasing-catalog-integration.test.ts tests/recurring-bill-catalogs.test.ts tests/recurring-invoice-catalogs.test.ts tests/requisition-catalogs.test.ts tests/sales-payment-catalogs.test.ts tests/shared-document-catalogs.test.ts tests/whole-catalog-integration.test.ts
```

2. An independent log-title audit matched all **50** hosted failed case titles to passing final local cases; none were missing.
3. `pnpm typecheck`: **exit 0**. Local runtime is Windows/Node 23.11.0; hosted workflow uses Ubuntu/Node 22. This is local contract reproduction, not a claim that the hosted environment was rerun.
4. Owned ESLint: **exit 0, no warnings**. `pnpm lint`: **exit 0, 20 existing warnings**, unchanged from the preceding accepted task.
5. `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: **417 columns / 1,861 consumer hashes verified**. Parsed schema-column arrays exactly match HEAD, retaining every classification. Final source-hash refresh is performed after fixture import cleanup.
6. `node .agentic/scripts/verify_legacy_money.mjs`: **all nine checks pass**.
7. `pnpm i18n:check`: **10,702 paired keys/locale pass**.
8. `python .agentic/agent.py validate`: **366 structurally valid tasks**. `git diff --check`, strict UTF-8 decoding of every owned file and independent Persian-literal assertions pass. Controller checklist, honest self-review and closure are recorded with this evidence.

Controlled failed/interrupted runs are not reported as passes. The initial current-head baseline reproduction confirmed unresolved fixtures and was stopped. The first complete affected run was 229/247 with 18 failures, including stale later message/placeholder assertions and two repair-script errors (argument position/import); these were corrected. The next run was 247/248: all original hosted-failure families passed, but the new journal proof incorrectly expected fixed-two IRR instead of its existing zero-scale grouped display. Its literal expectation was corrected to the unchanged IRR contract; the final full affected run above passes all 248. Owned lint initially found six unused imports, which were removed.

## Limits

No full local build or dev server was run. No application DB was accessed. Hosted Build/Docker jobs were skipped, and no replacement hosted CI pass is claimed. The owner requested investigation and repair of the preceding run, without waiting for the next hosted result.
