# Assets, loans, budgets and accruals catalog acceptance (LOC-024)

LOC-024 independently accepts the combined extraction from LOC-034..038.
The owned namespaces contain 579 paired messages: AssetCategories (57),
AssetCategoryErrors (11), FixedAssets (176), Loans (96), Budgets (145) and
Accruals (94). This acceptance adds Loans.cancel and Loans.creating, bringing
the complete catalogs to 4,111 keys each. Persian wording remains provisional.

## Current source inventory and exceptions

All route paths below are relative to `app/(dashboard)/accounting/`.

| Surface | Authored copy and explicit exceptions |
|---|---|
| `asset-categories/page.tsx` | [Category inventory](ASSET_CATEGORY_CATALOGS.md): create/edit, methods/conventions, account guidance, active status and errors. |
| `fixed-assets/page.tsx`, `fixed-assets/[id]/page.tsx` | [Asset inventory](FIXED_ASSET_CATALOGS.md): list/detail, creation, depreciation/rollback, construction/capitalization, valuation/impairment and disposal. |
| `loans/page.tsx`, `loans/[id]/page.tsx` | [Loan inventory](LOAN_CATALOGS.md): list/detail, creation, schedules, repayment preview/confirmation and errors. LOC-024 supplies the previously missing shared footer overrides. |
| `budgets/page.tsx`, `budgets/[id]/layout.tsx`, `budgets/[id]/page.tsx`, `budgets/[id]/settings/page.tsx` | [Budget inventory](BUDGET_CATALOGS.md): list, real shared detail context, overview, chart labels, settings, period labels, amounts and errors. |
| `accruals/page.tsx`, `accruals/[id]/page.tsx` | [Accrual inventory](ACCRUAL_CATALOGS.md): list/detail, creation, allocation previews, posting, cancellation, retries and errors. |
| Shared creation UI | FixedAssetDrawer, LoanDrawer, BudgetDrawer and AccrualScheduleDrawer in `components/dashboard/create-drawer.tsx`; DrawerIcon, SectionLabel and DrawerFooter are shared chrome. All four pass translated create/cancel/creating labels. Other drawer bodies/defaults retain their owners. |

The eleven route files and four drawer bodies have no unexplained authored
English JSX or literal visible attributes. `FA-001` is an identifier example;
numeric samples, dollar/currency symbols, signs, percent signs, journal `#`,
separators and missing-value punctuation retain the child inventories' explicit
exceptions. Caller names, descriptions, notes, account codes and custom period
labels remain escaped data. Future unknown status/method codes remain data.

IDs, canonical enum/filter values, URLs, methods, headers, payload keys, account
selectors, retry keys, saved Gregorian dates and field constraints remain machine
contracts. Asset/loan/accrual fixed cents and historical USD display, budget
currency display, exact Minor/decimal strings and bigint aggregates are preserved.
This task does not convert date/numeral/currency presentation policy or enable IRR.

## Independent combined verification

[Combined production composition tests](../../tests/asset-loan-budget-accrual-catalog-integration.test.ts)
compile the real budget layout and both child pages into one module cache.
The actual BudgetContext provider/consumers are used together; no fabricated
budget context is substituted. Real React, next-intl and PresentationProvider
render both locales with exact 4,000,000,000,000,001 minor units, low-order
actual spend, USD/JPY/IRR/KWD display, escaped caller data, saved Gregorian dates,
empty lines and a seeded read-error state that prevents stale child rendering.

The same test loads all four production drawers with their real shared footer
and renders both ready/saving states under one presentation provider. All four
submit buttons disable while saving. Persian never falls through to English
Cancel/Creating defaults. This caught the LoanDrawer omission, repaired with two
paired keys and overrides while preserving its request/money code. A recursive
AST audit pins the complete eleven-route inventory and audits the owned drawers.

These tests control initial hook state/effects/navigation and inline portals;
they are component composition checks, not mounted browser interaction. The
child catalog suites also run together on current source, executing production
callback syntax for successful/failed creation, edits, reads, confirmations,
cancellation and retry, including organization headers, exact payloads, malformed
JSON/shapes/aliases, unknown server prose and escaped caller content.

Existing migrated PostgreSQL suites independently exercise real REST handlers,
registered MCP calls and SQL assertions for category/asset masters, depreciation,
CWIP, valuation/disposal, loans and their combined lifecycle, budgets/reports,
combined budget/project/CRM UI contracts and accrual allocation/posting/retries.
They use explicit loopback TEST_DATABASE_URL and disposable randomized databases
on a dedicated temporary PostgreSQL cluster. No application database is used.

## Preserved operation contracts and handoff

No REST, MCP, service, money adapter, schema or migration change is needed.
Existing organization-scoped tools cover category/asset CRUD, depreciation and
rollback, construction/capitalization, valuation/disposal, loan CRUD/schedule/
repayment, budget CRUD/comparison, and accrual create/read/post/cancel. No new
user operation is introduced. Stripe remains unchanged under DEC-008.

LOC-007/002 retain their independent integration acceptance. Native Persian
financial terminology, full RTL/font/layout and browser qualification, hosted CI,
providers, production migration/deployment and IRR enablement remain separate.
No full build, dev server, Docker or deployment is part of this task.

See [attempt evidence](../evidence/LOC-024-attempt-1.md) and
[honest self-review](../evidence/LOC-024-review-1.md).
