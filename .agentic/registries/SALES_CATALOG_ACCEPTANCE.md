# Combined sales catalog acceptance

LOC-025 independently accepts the combined LOC-039..047 sales presentation
slice. All child evidence remains immutable. The current catalogs contain 5,002
compatible keys per locale, including 951 messages in the sales namespaces below.
Persian terminology remains provisional pending native financial-language review.

## Combined source inventory

| Child | Routes and shared presentation | Namespaces and messages |
|---|---|---|
| [LOC-039](SALES_PAYMENT_CATALOGS.md) | Payment list/detail | SalesPayments: 60 |
| [LOC-040](SALES_INVOICE_CATALOGS.md) | Invoice list/detail, InvoiceDrawer, lifecycle/payment dialogs and compliance labels | SalesInvoices: 274 |
| [LOC-041](SALES_QUOTE_CATALOGS.md) | Quote list/detail, QuoteDrawer and QuoteMoneyDetails | SalesQuotes: 73 |
| [LOC-042](SALES_RECEIPT_CATALOGS.md) | Receipt list/detail, SalesReceiptDrawer, money details and shared attachments | SalesReceipts: 86; ReceiptAttachments: 6 |
| [LOC-043](CREDIT_NOTE_CATALOGS.md) | Credit-note list/detail, CreditNoteDrawer and money details | CreditNotes: 102 |
| [LOC-044](CUSTOMER_PREPAYMENT_CATALOGS.md) | Prepayment list/detail, CustomerCreditDrawer/Form and money details | CustomerPrepayments: 103 |
| [LOC-045](RECURRING_INVOICE_CATALOGS.md) | Recurring-invoice list/detail, RecurringDrawer and money details | RecurringInvoices: 108 |
| [LOC-046](REVENUE_SCHEDULE_CATALOGS.md) | Revenue-schedule list/detail and RevenueScheduleDrawer | RevenueSchedules: 90 |
| [LOC-047](SHARED_DOCUMENT_CATALOGS.md) | Sales layout/loading, LineItemsEditor, InvoiceAmountInput, DrawerFooter and preview failures | SalesNavigation: 11; DocumentForms: 38 |

The combined scope contains all 18 TSX files under `app/(dashboard)/sales`,
seven creation drawers (including the prepayment form wrapper), and the eight
shared controls/details enumerated by the combined source test. Shared loading,
date, table and confirmation primitives reuse their existing catalogs.

## Explicit exceptions and adjacent ownership

Saved customer/account/tax names, descriptions, references, notes, email addresses,
filenames, snapshot values, document numbers and unknown status/method/source
codes remain escaped caller data. Organization headers, IDs, API paths, download
filenames, routes, canonical dates, query/sort/filter/action codes, retry keys,
currency codes, account codes, numeric placeholders, punctuation and financial
illustrations retain their machine/data meaning. The source audit permits only
the documented QTE/INV/SR/CN-0001 and INV-0042 document examples and punctuation
entities. Full date/numeral/currency input adapters retain their separate tasks.

Contact/currency/account picker internals, SendDocumentDialog, EmailHistory and
FileUploader keep their existing ownership. Supplier PaymentAmountPreview remains
LOC-033; purchasing navigation and remaining purchasing forms remain LOC-056.
Shared document form defaults are accepted here without claiming those adjacent
workflows are fully localized. Existing payment allocation links retain their
documented `/sales/invoices/{id}` destination; route correction remains outside
this catalog acceptance. Revenue schedules retain fixed-two USD presentation;
no currency inference or stored-unit reinterpretation is introduced.

## Independent composition and behavior checks

[Combined tests](../../tests/sales-catalog-integration.test.ts) render all seven
production drawer bodies with their actual shared footer, line editor, amount
input, date controls, next-intl and PresentationProvider. Both locales cover
ready/saving states, disabled pending submission, escaped caller data, and exact
4,000,000,000,000,001 minor-unit line previews in USD/JPY/KWD. Revenue schedules
retain their separate fixed-two contract. Invalid line previews render translated
alerts and missing-total sentinels. Sales layout and the invoice drawer render
together on list/detail paths. A combined AST audit pins the complete source
inventory and checks authored JSX/display attributes for remaining English copy.

Initial hooks/effects, navigation, portals and pickers belonging to other slices
are controlled in composition tests. Production JSX, translations, shared document
controls and money calculators remain real. These are composition checks, not
mounted browser interaction. All nine child suites run together on current source
and execute production callbacks for reads, pagination, cancellation, currency
resolution, creation, credit/payment application, lifecycle actions, recognition,
attachments, exact payloads and HTTP/network/JSON/shape/alias failures.

Existing migrated PostgreSQL suites independently execute authenticated REST,
registered MCP calls and SQL assertions for payment reads, invoice reads/lifecycle/
snapshots/UI, shared document editing, quotes, receipts, credit notes, prepayments,
recurring invoices and revenue schedules. Fixtures use explicit loopback
TEST_DATABASE_URL on a dedicated temporary PostgreSQL cluster, create/drop random
databases and leave the application database untouched.

## Preserved operations and handoff

No application code, catalog, REST/MCP, service, money adapter, schema, migration,
FX, rollout flag or Stripe file changes were required for combined acceptance.
Existing registered invoice/payment, quote, receipt, credit-note, customer-credit,
recurring-template, revenue-schedule and entity-file tools cover the accepted
operations using org-scoped AuthContext and shared Drizzle services with wrapTool.
No new user operation or REST route requires a new MCP tool. Existing documented
REST/MCP read-enrichment differences remain unchanged.

LOC-007/002 retain independent parent integration acceptance. Native Persian
terminology, complete RTL/font/layout/browser qualification, hosted CI, providers,
production migrations/deployment and IRR enablement remain separate. DEC-008
preserves Stripe unchanged. No full build, dev server, Docker or deployment ran.

See [attempt evidence](../evidence/LOC-025-attempt-1.md) and
[honest self-review](../evidence/LOC-025-review-1.md).
