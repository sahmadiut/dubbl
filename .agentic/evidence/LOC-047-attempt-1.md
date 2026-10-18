# LOC-047 attempt 1 - Shared sales navigation and document forms

## Identity

- Task: LOC-047; date: 2026-10-19; operator: Codex.
- Repository: D:/Projects/dubbl; branch: master; entry HEAD: e9494dc6.
- Working tree was clean at entry. This evidence describes the task-owned diff
  before its commit, without claiming a future commit SHA.
- Exactly one controller-selected task; no sibling or parent completion inferred.

## Result and acceptance mapping

1. Added 49 paired `SalesNavigation`/`DocumentForms` keys, reaching 5,002 per
   locale. Sales tab labels/titles, line fields/actions/totals, tax reclaim hints,
   recurring-bill guidance, amount-input defaults and shared footer defaults now
   use real next-intl. Remove-line controls gain translated accessible labels.
   Sales loading already uses localized BrandLoader; verified unchanged.
   SectionLabel has no authored copy; each drawer owns its children. Scope and
   explicit exceptions: [shared catalog registry](../registries/SHARED_DOCUMENT_CATALOGS.md).
2. Real bilingual rendering and original callback execution preserve decimal
   text, IDs, line limits, disabled/saving state, custom overrides, navigation,
   precision and all five preview policies. Known preview failures map to finite
   reviewed messages; arbitrary parser text gets a translated generic fallback.
   Existing REST/MCP/SQL fixtures independently confirm calculator/payload parity.
3. Registry and task handoff record provisional Persian terminology and separate
   LOC-025/007/002, native linguistic and RTL acceptance. LOC-056 retains remaining
   purchasing-specific forms/navigation; LOC-033 retains PaymentAmountPreview.

## Files and preserved boundaries

Application edits are sales layout, shared line-items-editor, invoice-amount-input,
only DrawerFooter in create-drawer, the two new catalog namespaces and
`i18n/document-form-presentation.ts`. `tests/shared-document-catalogs.test.ts` adds
six behavioral/rendering groups. Five existing test files receive only provider
or ESM import wiring needed for the newly localized amount input; assertions
remain intact. Controller evidence/handoff and catalog/inventory registries are
updated. No operation, REST route, MCP schema or financial calculation changed.

Ownership audit compared entry HEAD against working files: every earlier catalog
namespace, SectionLabel, all other drawer implementations and schema-column
classifications are identical. No lib/, migration or Stripe file changes.
Inventory refresh contains 10 owned consumer changes and two additions; the sales
layout no longer matches lexical money patterns after copy moves to catalogs.
There are 417 columns, 2,250 scanned files and 1,686 consumers. This inventory is
a lexical cross-check, not a financial proof.

Existing create_invoice/create_bill/create_purchase_order/create_recurring_template,
document payment/credit operations and list_tax_rates cover the shared controls.
Registered MCP implementations and org-scoped AuthContext/wrapTool services were
inspected and preserved. No new MCP operation was needed.

## Actual verification

All commands ran from D:/Projects/dubbl. Integration used a random OS-temp
PostgreSQL 18.6 cluster, trust authentication bound only to 127.0.0.1 on an
allocated port and explicit TEST_DATABASE_URL. Existing fixtures migrated and
dropped their random dubbl_ci_* databases. Final fixture database count: zero;
the cluster was stopped in finally. Stopped files remain in OS temp. No application
database, PostgreSQL 16 or production qualification is claimed.

| Check | Actual final result |
|---|---|
| Shared catalogs plus invoice/bill amount and invoice/credit/prepayment catalog tests, concurrency 2 | Exit 0; 42/42 passed, no skips; 15.583 seconds |
| Full suite: node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 882/882 passed, no skips; 145.027 seconds |
| node --import tsx --test --test-concurrency=2 tests/integration/document-editor-money.test.ts tests/integration/bill-editor-money.test.ts tests/integration/recurring-invoice-ui-money.test.ts tests/integration/recurring-bill-ui-money.test.ts tests/integration/procurement-ui-money.test.ts | Exit 0; 5/5 groups passed, no skips; 26.533 seconds |
| pnpm typecheck | Exit 0 |
| pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Changed-file ESLint on application/helper/tests | Exit 0; zero errors/warnings |
| pnpm i18n:check | Exit 0; 5,002 compatible keys per locale |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 417 schema columns and 1,686 consumer hashes/source lines verified |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks |
| Ownership and inventory comparison against entry HEAD | Exit 0; only owned changes, all old namespaces/other drawers/schema classifications unchanged |
| python .agentic/agent.py validate; git diff --check | Exit 0 |

Initial new test fixtures used non-UUID IDs and assumed server-rendered select
labels; corrected to real UUIDs and controlled portal contents. Initial typecheck
found test callable-component typing, corrected without changing application
types. Initial full suite passed 876 and failed six locale-context rendering
checks. Two amount test files now use PresentationProvider; three catalog harnesses
load the real amount input through the provider's ESM context. The final focused,
typecheck and full-suite results above include these repairs. The first isolated
cluster bootstrap stalled on inherited output handles before running tests; it
was stopped, output handling corrected, and the final run completed and cleaned up.

## Review and limits

Codex performed an honest self-review; see [review](LOC-047-review-1.md).
No independent human/native reviewer, mounted browser/RTL, provider, hosted-CI,
deployment or production IRR qualification is claimed. No build, dev server,
Docker, provider request or application DB was used. Persian wording remains
provisional. LOC-025 is eligible for independent combined acceptance after this
child completes; it has not been accepted by this task.
