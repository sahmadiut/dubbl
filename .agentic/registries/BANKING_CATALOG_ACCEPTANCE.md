# Combined banking catalog acceptance

LOC-023 independently accepts the combined presentation of LOC-029 through
LOC-033. LOC-007/002 retain their own integration acceptance. The five children
provide 667 paired banking messages across BankAccounts (89), BankAccountErrors
(11), BankWorkspace (303), BankImports (37), BankReconciliation (93) and
BankPayments (134). This acceptance adds no messages; both complete catalogs
remain at 3,600 keys. Persian terminology remains provisional.

## Current source inventory

All paths below are relative to `app/(dashboard)/accounting/banking/` unless
otherwise specified. The combined route audit covers all 11 current TSX files.

| Surface | Implementation and exceptions |
|---|---|
| Account list `page.tsx`, detail `settings/page.tsx` | [Account inventory](BANK_ACCOUNT_CATALOGS.md): account types, grouping, fields, confirmation and errors. The settings path is `[id]/(detail)/settings/page.tsx`. |
| Detail `layout.tsx`, `page.tsx`, `transactions/page.tsx` | Under `[id]/(detail)/`; [workspace inventory](BANK_WORKSPACE_CATALOGS.md): navigation, summaries, transaction states, matching, cash coding and operation results. |
| Detail `imports/page.tsx` | Under `[id]/(detail)/`; [import inventory](BANK_IMPORT_CATALOGS.md): history, upload/paste/preview, formats and warnings. |
| `[id]/reconcile/page.tsx` | [Reconciliation inventory](BANK_RECONCILIATION_CATALOGS.md): selected lines, statement dates/balances, report and adjustment UI. |
| `scheduled/page.tsx`, `batches/page.tsx`, `batches/[id]/page.tsx` | [Payment inventory](BANK_PAYMENT_CATALOGS.md): scheduling, batches, submission, remittance preview and notifications. |
| `[id]/_components.tsx` | All shared transaction, import, match, categorize, expense, transfer, split, cash-coding and reconciliation components are covered jointly by the workspace/import/reconciliation inventories. |
| Shared UI outside the route tree | BankAccountDrawer and BankTransferDrawer in `components/dashboard/create-drawer.tsx`, and `components/dashboard/payment-amount-preview.tsx`, covered by account/payment inventories. Other drawers retain their own owners. |

The five finite `i18n/bank-*-presentation.ts` helpers provide translated display
labels, known errors/warnings and safe operation fallbacks. Authored copy uses
catalogs; caller account/bank/contact/ledger names, descriptions, references,
filenames, account numbers and saved financial text remain data escaped by React.
Canonical currency/country/type/status/format codes, IDs, URLs, request fields,
headers, dates, CSV/parser syntax, file filters, punctuation and technical samples
remain unchanged. The source audit explicitly permits the ISO country sample
`US` and the `&rarr;` entity. Saved `Director's loan` and `Reconciliation
adjustment` defaults remain accounting data in both locales. Financial/date/
numeral policy uses the existing adapters and is not changed by this acceptance.

## Independent combined checks

`tests/banking-catalog-integration.test.ts` compiles actual production layout,
four detail pages and shared components into one module cache. It preserves the
real BankAccountContext identity and provider/consumer behavior; no bank context
or banking component is substituted. Actual React, next-intl and
PresentationProvider render both locales. Initial state and navigation/effects
are controlled, portals render inline and unowned pickers/attachments are narrow
boundaries. Checks cover all four populated child pages, an empty import history
with the import sheet open, cross-namespace labels, canonical form fields, escaped
caller content and exact positive/negative KWD amounts with low digits retained.
The complete route-tree AST audit checks authored JSX and visible literal
attributes; adding a route requires inventory review.

The five child catalog suites also run together against current source. Actual
production callback syntax checks canonical organization headers, methods,
payloads and navigation; success/reset/refresh and failure/retry behavior;
finite error mappings, unknown/HTML/network failures, ICU counts, partial/zero
results and exact signed Minor strings across USD/JPY/IRR/KWD. Existing banking
and payment wire/money suites retain their financial assertions. These are
component composition and callback/wire checks, not browser or PostgreSQL tests.

## Preserved operation contracts and handoff

No production component, catalog, money/service, REST, MCP, schema or migration
change is needed for this combined acceptance. Existing MCP tools continue to
cover bank account CRUD; transaction reads/categorization/exclusion/undo; bill,
invoice and existing-record matching; splits/transfers; statement import preview,
commit and profiles; reconciliation statements/reports/adjustments; scheduling,
batches and remittance generation/sending. No user operation is added. Manual/CSV
banking remains intact. Stripe files and functionality remain preserved under
DEC-008; no dedicated Stripe work is performed.

Native Persian terminology, complete RTL/font/layout, browser event automation,
live REST/MCP/database transaction qualification, hosted CI, providers, deployment
and production IRR enablement remain separate. No TEST_DATABASE_URL is configured
in this execution; no DB tests or application DB access are claimed. No full
build, dev server or Docker execution was performed. The unrelated preexisting
locale-preferences edit remains outside this task's commit.

See [execution evidence](../evidence/LOC-023-attempt-1.md) and
[honest self-review](../evidence/LOC-023-review-1.md). Completing this banking
parent does not complete LOC-007 or LOC-002.
