# Combined purchasing catalog acceptance

LOC-026 independently accepts the combined LOC-048..056 purchasing presentation
slice. Completed child evidence remains immutable. The current catalogs contain
5,788 compatible keys per locale: 863 purchasing messages below and 38 reused
DocumentForms messages, for 901 messages across the combined form surface.
Persian terminology remains provisional pending native financial-language review.

## Combined source inventory

| Child | Routes and shared presentation | Namespaces and messages |
|---|---|---|
| [LOC-048](GOODS_RECEIPT_CATALOGS.md) | Goods-receipt list/detail and receipt/order/requisition line details | GoodsReceipts: 65; ProcurementDetails: 12 |
| [LOC-049](SUPPLIER_BILL_CATALOGS.md) | Bill list/detail, BillDrawer, lifecycle/approval/payment dialogs and grouped currency amounts | SupplierBills: 163 |
| [LOC-050](RECURRING_BILL_CATALOGS.md) | Recurring-bill list and inline creation drawer | RecurringBills: 42 |
| [LOC-051](EXPENSE_CATALOGS.md) | Expense list/detail/edit, recurring expenses, ExpenseDrawer and ExpenseAmountInput callers | Expenses: 196 |
| [LOC-052](DEBIT_NOTE_CATALOGS.md) | Debit-note list/detail, DebitNoteDrawer, overview and line/amount details | DebitNotes: 105 |
| [LOC-053](REQUISITION_CATALOGS.md) | Requisition list/detail, inline creation and RequisitionLineEditor | Requisitions: 88 |
| [LOC-054](PURCHASE_ORDER_CATALOGS.md) | Order list/detail/edit/receive and PurchaseOrderDrawer | PurchaseOrders: 118 |
| [LOC-055](LANDED_COST_CATALOGS.md) | Landed-cost list/detail, inline creation/components and allocation feedback | LandedCosts: 62 |
| [LOC-056](SHARED_PURCHASING_CATALOGS.md) | Purchasing layout/loading and reconciled shared form ownership | PurchasingNavigation: 12 |
| [LOC-047](SHARED_DOCUMENT_CATALOGS.md) | Reused LineItemsEditor, InvoiceAmountInput, DrawerFooter and reviewed preview failures | DocumentForms: 38 |

The combined scope contains all 18 TSX files under
`app/(dashboard)/purchases`, four creation drawers, and eight shared controls:
line-items-editor, invoice-amount-input, expense-amount-input,
bill-currency-amounts, requisition-line-editor, procurement-money-details,
debit-note-money-details and debit-note-overview. Inline drawers and editing
forms belong to their route files. Shared loading, date, table and confirmation
primitives reuse their existing catalogs.

## Explicit exceptions and adjacent ownership

Saved supplier/account/tax names, descriptions, references, notes, rejection
reasons, emails, filenames, document numbers, snapshot data and unknown
status/frequency/method codes remain escaped caller data. IDs, org headers, URLs,
query/filter/sort/action codes, JSON fields, currency/account codes, date-only
values, numeric placeholders, punctuation, step numbers and missing-value
sentinels retain their data or machine meaning. Source checks permit only the
documented PO-0042/BILL-0042/GRN-0001/DN-0001 examples and punctuation entities.
Illustrative USD amounts remain fixed demonstration data.

Existing money/date/quantity/percentage/distance formatters and ASCII decimal
entry are preserved. Recurring bills and expenses retain legacy fixed-two
price units in every currency; their previews must not be reinterpreted as
currency-scaled entry. Landed-cost components retain their existing fixed-two
minor-unit conversion and service currency default. Other bill/order/debit and
expense workflows retain their own currency scale, rounding and safe-range
contracts. Unlike currencies are never added together.

Supplier PaymentAmountPreview remains LOC-033. ContactPicker internals remain
LOC-058. Currency/account/date picker internals retain their existing ownership.
SendDocumentDialog, EmailHistory and FileUploader remain the adjacent shared
scope documented in the child registries; public documents/email/PDF remain
LOC-009. This acceptance covers purchasing-specific copy and the shared document
form defaults without claiming those adjacent features are fully localized.

## Independent composition and behavior checks

[Combined tests](../../tests/purchasing-catalog-integration.test.ts) render the
four production drawer bodies with their real footer, shared line or expense
amount controls, date controls and next-intl/PresentationProvider. Both locales
cover ready/saving states, disabled pending submission, escaped caller data,
exact 4,000,000,000,000,001 minor-unit previews in USD/JPY/KWD, translated invalid
previews and missing-total sentinels. Bill submission is disabled for unresolved
supplier currency, missing supplier and invalid line state. PurchasesLayout
renders with the real bill form on list/detail routes. A combined AST audit pins
the complete source inventory and rejects authored English JSX/display literals.

Initial hooks/effects, navigation, adjacent pickers/uploaders and portals are
controlled. Production JSX, shared form controls, translations and money
calculators remain real. These checks do not mount browser events. The nine
child catalog suites plus shared-document and bank-payment suites execute actual
production callback syntax for reads, cancellation, pagination, creation, editing,
lifecycle/approval/payment/credit actions, receiving, conversion, allocation,
receipt lookup and HTTP/network/JSON/shape/alias failures on current source.

Existing migrated PostgreSQL suites separately execute authenticated REST,
registered MCP operations and independent SQL assertions for bill reads/writes/
bulk/lifecycle/editor/UI, shared document editing, recurring payables/UI, expense
CRUD/lifecycle/UI, debit notes/UI, requisitions, orders, receipts, procurement UI,
landed-cost/FIFO valuation and combined payable/procurement flows. Explicit
loopback TEST_DATABASE_URL targets a new dedicated temporary cluster; fixtures
create/drop random databases and leave the application database untouched.

## Preserved operations and handoff

No application, catalog, REST/MCP, service, financial helper, schema/migration,
FX, IRR flag or Stripe changes were needed for this acceptance. Existing
registered bill/bulk, expense CRUD/lifecycle, recurring-template, debit-note,
purchase-requisition/order, goods-receipt and landed-cost modules retain
org-scoped AuthContext, described input schemas, direct Drizzle-backed services
and wrapTool. No new operation or REST route requires an MCP addition.

LOC-007/002 retain independent integration acceptance. Native Persian wording,
complete RTL/font/layout/browser qualification, numeral/date adapters, hosted CI,
providers, production migration/deployment and IRR enablement remain separate.
DEC-008 preserves Stripe unchanged. No full build, dev server, Docker or
deployment ran. See [attempt evidence](../evidence/LOC-026-attempt-1.md) and
[honest self-review](../evidence/LOC-026-review-1.md).
