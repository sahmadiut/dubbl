# Shared purchasing catalogs - LOC-056

LOC-056 adds 12 paired `PurchasingNavigation` messages: eight tab labels and four
explanatory titles. English wording is preserved. Persian financial terminology
is provisional pending native review; RTL and parent acceptance remain separate.

## Source ownership and reconciliation

| Source | Coverage |
|---|---|
| `app/(dashboard)/purchases/layout.tsx` | All tab labels and explanatory titles now use PurchasingNavigation; routes, order, icons and exact matching remain intact |
| `app/(dashboard)/purchases/loading.tsx` | Inspected and rendered unchanged; BrandLoader already uses SharedUI.loading2 |
| `line-items-editor.tsx`, `invoice-amount-input.tsx`, `DrawerFooter`, `SectionLabel`, `i18n/document-form-presentation.ts` | LOC-047 owns shared document forms, purchase reclaim hints, recurring-bill guidance, default footer labels and reviewed preview errors; SectionLabel has no own copy. Reused without duplicate keys or edits; see [shared document scope](SHARED_DOCUMENT_CATALOGS.md) |
| `bill-currency-amounts.tsx` | LOC-049: exact currency groups and missing-value dash, no authored prose |
| `expense-amount-input.tsx` | LOC-051: caller-supplied labels, currency code and unchanged 18-place input; no own prose |
| `requisition-line-editor.tsx` | LOC-053: Requisitions messages, line callbacks and procurement preview |
| `procurement-money-details.tsx` | LOC-048: ProcurementDetails messages for receipt, order and requisition detail |
| `debit-note-money-details.tsx`, `debit-note-overview.tsx` | LOC-052: DebitNotes messages and exact credit amounts |
| BillDrawer, PurchaseOrderDrawer, ExpenseDrawer, DebitNoteDrawer | LOC-049/054/051/052 respectively; all purchasing-specific drawer copy is already cataloged |
| Supplier `PaymentAmountPreview` | LOC-033: BankPayments messages; no duplicate ownership |

All eight purchasing child registries (LOC-048..055) retain ownership of their
route-specific forms, previews, errors and actions. This task does not accept
their combined integration: LOC-026/007/002 remain independently open.

## Explicit exceptions and adjacent work

Routes, icon identifiers, CSS, exact matching, IDs, currency codes, numeric
placeholders, punctuation, missing-value dashes and caller-provided labels/data
retain their existing meaning. Money/date/quantity adapters and all five shared
document preview policies are unchanged. No new operation, API, financial logic,
schema, migration, IRR flag or Stripe change is introduced.

ContactPicker internals remain LOC-058; currency/account/date picker internals
retain their own extraction and presentation tasks. SendDocumentDialog,
EmailHistory and FileUploader retain the adjacent ownership explicitly excluded
by LOC-025 acceptance and the purchasing child registries; this task does not
claim that their authored copy is localized. Public document/email/PDF and
background content remain LOC-009, with complete translation/RTL qualification
in later phases. These shared sending/history components also serve sales and
are outside this purchasing-specific navigation/form slice.

Existing purchasing MCP modules cover bills, expenses, recurring templates,
debit notes, requisitions, orders, goods receipts and landed costs through
organization-scoped direct DB services. Tab navigation is a presentation concern;
there is no new user operation or REST change requiring an MCP addition.

## Verification boundaries

`tests/shared-purchasing-catalogs.test.ts` uses production PurchasesLayout,
TabLayout, loading, React, next-intl and PresentationProvider. Both languages
cover all tab routes/order/icons/titles, each list's active tab, detail-page tab
suppression, escaped document children and the existing loading label. Shared
document and bank-payment tests exercise the reused previews and form callbacks
without changing their implementation. All purchasing child catalog tests are
also included in verification. No browser, native financial-language, complete
RTL, hosted CI or deployment acceptance is implied.

See [attempt evidence](../evidence/LOC-056-attempt-1.md) and
[self-review](../evidence/LOC-056-review-1.md) for executed checks and limitations.
