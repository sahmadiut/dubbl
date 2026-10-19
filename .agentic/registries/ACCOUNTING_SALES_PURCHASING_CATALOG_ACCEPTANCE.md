# Combined accounting, sales and purchasing catalog acceptance (LOC-007)

LOC-007 independently accepts the current combined extraction of LOC-021..028,
using LOC-006's shared shell, confirmation, loading, table and date controls.
All 87 route TSX files and their owned shared forms are reconciled below.
The 53 domain/shared namespaces contain 4,142 paired messages; complete catalogs
retain 6,328 compatible keys in each locale. Persian wording remains provisional
pending native financial-language review. Earlier child inventories record their
own acceptance-time counts and parent boundaries; they remain immutable history.

## Combined source and shared-control inventory

All route paths are relative to `app/(dashboard)/`. The new
[combined test](../../tests/accounting-sales-purchasing-catalog-integration.test.ts)
pins every current route path, its authored JSX/display literals, document-title
calls, referenced namespace parity and Persian script or exact interpolation-only
exceptions. Child tests additionally audit their owned drawers/shared controls,
dynamic labels, error mappings, callbacks and portal option values.

| Family | Route files | Paired messages | Current source and shared ownership |
|---|---:|---:|---|
| Chart and accounting navigation, LOC-021 | 6 | 173 | `accounting/layout.tsx`, `loading.tsx`, four `accounts/` files; Accounts (163), AccountErrors (10), AccountDrawer and AccountPicker. [Inventory](ACCOUNT_CATALOGS.md). |
| Journals and opening balances, LOC-022 | 5 | 269 | Accounting list/detail, recurring-journal list/detail, opening balances; Journals (251), JournalErrors (15), JournalActivity (3). EntryForm, OpeningBalanceForm/details, ActivityFeed and three drawers. [Inventory](JOURNAL_CATALOGS.md). |
| Banking, LOC-023 | 11 | 667 | All `accounting/banking/` files, transaction/import/reconciliation components, BankAccountDrawer, BankTransferDrawer and PaymentAmountPreview. Six namespaces and complete child links in [combined inventory](BANKING_CATALOG_ACCEPTANCE.md). |
| Assets, loans, budgets, accruals, LOC-024 | 11 | 579 | Remaining accounting master/list/detail/context/settings routes and four drawers. Six namespaces and complete child links in [combined inventory](ASSET_LOAN_BUDGET_ACCRUAL_ACCEPTANCE.md). |
| Sales, LOC-025 | 18 | 951 | All sales routes, seven creation drawers including the prepayment wrapper, money details and receipt attachments. Eleven namespaces, including shared DocumentForms (38), in [combined inventory](SALES_CATALOG_ACCEPTANCE.md). |
| Purchasing, LOC-026 | 18 | 863 | All purchases routes, four drawers plus inline recurring/requisition/landed-cost forms, procurement/debit-note/bill/expense details and line editors. Ten purchasing namespaces; shared DocumentForms counted once above. [Combined inventory](PURCHASING_CATALOG_ACCEPTANCE.md). |
| Contacts, LOC-027 | 9 | 295 | List/loading, detail context and six pages, ContactDrawer and ContactPicker. Seven namespaces, [combined inventory](CONTACT_CATALOG_ACCEPTANCE.md). |
| Tax, LOC-028 | 9 | 345 | All tax routes including currencies and country-specific reports, TaxSettlementPreview. Eight namespaces, [combined inventory](TAX_CATALOG_ACCEPTANCE.md). |

## Explicit exceptions and adjacent ownership

Saved account/contact/tax names, custom statuses, descriptions, notes, references,
reasons, user names, document numbers, file names, historical snapshots and server
generated accounting descriptions remain escaped data. They are not heuristically
translated or rewritten. IDs, URLs, API paths, headers, action/filter/sort/type/
status codes, payload keys, country/currency codes, canonical Gregorian dates,
UTC instants, MIME/storage values, CSV contracts and exact Minor aliases remain
machine values. Existing finite known-error mappings localize display only;
unknown server/network/parser prose uses the reviewed operation fallback.

The route audit permits exact documented samples only at their owning paths:
REF-RENT; INV-0042/CN-0001; INV-0042 in prepayments; QTE-0001/INV-0001;
SR-0001; BILL-0042/DN-0001; PO-0042/GRN-0001; G1-G11, 1A-1B; bank ISO
placeholder US; and contact email@example.com. Punctuation entities, numeric
examples, fixed financial illustrations, signs and missing-value sentinels retain
their existing meaning. The child drawer inventories also retain documented phone,
reference and account-code examples. Budgets.monthLabel and
RevenueSchedules.detailDescription contain only localized interpolations and
punctuation, so they intentionally have no Persian-script literal.

Shared shell/primitives and currency selection reuse LOC-006. Public document,
PDF, email, SendDocumentDialog, EmailHistory and FileUploader internals retain
LOC-009/adjacent ownership documented by the children. Complete date, numeral,
input, font, bidi, accessibility and RTL qualification remains with its later
tasks. Child wording/native reviews are not replaced by key/script checks.

## Independent combined verification

The new test renders the actual AccountingLayout, SalesLayout, PurchasesLayout,
TaxLayout and shared TabLayout with production EntryForm, LineItemsEditor,
AccountPicker, CurrencyInput, InvoiceAmountInput and TaxSettlementPreview under
real React, next-intl and PresentationProvider. There is no transpiled component
substitute in these new renders. SSR leaves effects and portals unmounted;
PathnameContext supplies canonical list/detail routes.

Both locales preserve exact 4,000,000,000,000,001 minor units across USD/JPY/KWD
for invoice, recurring-invoice, bill, purchase-order and recurring-bill previews.
Recurring bills deliberately keep fixed-two price input while output uses the
document currency scale. Journals separately retain fixed-two entry and exact
debit/credit totals. Tax settlement retains its currency-scaled input and exact
grouped output. Active routes, translated account/amount labels, escaped caller
data, invalid raw entry retention, accessible translated alerts and detail-page
tab hiding pass together. No money units are inferred from presentation language.

The full current unit/static suite reruns all child catalog/render/callback and
existing domain integration suites together. Separate disposable migrated
PostgreSQL suites exercise authenticated REST, registered MCP and independent SQL
for journal/configuration/core accounting, banking/expense/tax UI, asset/loan,
budget/project/CRM, accruals, receivable documents, receivable/payable reconciliation,
payable/procurement, contacts/statements and tax rates/periods/reports/UI.
See [attempt evidence](../evidence/LOC-007-attempt-1.md) for exact commands/results.

## Preserved contracts and remaining acceptance

This acceptance requires no production source, catalog, REST/MCP, authorization,
service, schema/migration, money, FX, rollout flag or Stripe change. Existing
registered tools retain AuthContext organization scope, shared Drizzle services,
described inputs and wrapTool. No new operation or changed REST route is added.
It does not claim full pre-existing MCP parity: global currency creation and
contact add-person/file download/delete remain documented gaps; contact-list
filter/limit/balance differences also remain unchanged.

LOC-002 retains independent whole-product acceptance; LOC-008/009 and broader
translation/output work are not completed by LOC-007. Native terminology,
browser/keyboard/complete RTL, providers, hosted CI, physical print, statutory
qualification, production migrations/deployment and IRR enablement remain separate.
DEC-008 preserves existing Stripe unchanged. No full build, dev server, Docker,
application DB access, deployment or live-provider request was used.
Review is honestly identified as [Codex self-review](../evidence/LOC-007-review-1.md).
