# Sales invoice catalogs

LOC-040 adds 274 paired `SalesInvoices` messages, reaching 4,385 compatible keys
per locale. Persian financial wording is provisional. LOC-025/007/002 retain
independent combined acceptance; native linguistic and RTL qualification remain open.

## Source ownership and presentation

- `app/(dashboard)/sales/page.tsx`: empty lifecycle guidance, calls to action,
  totals and aging headings/buckets, recent payments, status tabs, search/date/sort
  filters, table headings, overdue labels, row/all selection accessibility, bulk
  actions/results, pagination counts and read failures. ICU handles invoice and
  reminder plurals; the locale supplies the bulk-result separator.
- `app/(dashboard)/sales/[id]/page.tsx`: statuses and invoice type badges, reminder
  counts, loading/error states, accessible back/dismiss actions, payment recording,
  approval/rejection, late fees, cancellation/write-off confirmations, duplication,
  PDF download failures, compliance warning presentation, document headings,
  attachments guidance, exact totals/progress, customer-credit application,
  snapshot display/correction and payment history.
- `InvoiceDrawer` in `components/dashboard/create-drawer.tsx`: customer/currency/
  reference/date/notes fields, deposit/retainer and approval guidance, own section
  labels, creation action/results, validation and currency-lookup failures.
  No other creation drawer or shared footer/section implementation changes.
- `i18n/invoice-presentation.ts`: finite status/method/credit display maps with
  own-property checks. All 41 currently authored compliance-rule messages map to
  reviewed paired display keys; future unreviewed prose gets a translated fallback.
  Compliance fields, severity, jurisdiction conditions and REST/MCP messages remain
  unchanged. This extraction does not qualify jurisdiction-specific legal rules.

Invoice actions use translated operation fallbacks for denied requests, JSON
errors, exact-money parser rejection and network failure. Previously uncaught
credit/approval/snapshot/confirmation failures now surface translated errors and
release busy states. Denied cancellation/duplication also reports failure.
Invoice reads check HTTP success and list shape before adopting data; successful
list reads clear stale errors. Existing cancellation/abort guards remain intact.

## Explicit exceptions and preserved contracts

Caller-controlled names, descriptions, references, notes, emails, account names,
invoice/payment numbers and snapshot values stay escaped data. Unknown status,
method and credit-source codes remain data. CSS classes, colors, schema IDs,
field names, method/status/type/action codes, sort/filter values, API URLs,
organization headers, download filenames, page size and query limits are unchanged.
Punctuation, step digits and numeric-only counts/percentages remain presentation
data. Existing English/date-only date rendering, exact currency formatting and
decimal input grammar await the separate presentation-adapter tasks.

Shared `line-items-editor`, contact/currency pickers, `DrawerFooter`,
`SectionLabel`, navigation/layout/loading, `SendDocumentDialog`, `EmailHistory`
and receipt-attachment internals retain their separate ownership. LOC-047 owns
shared document/line-form copy. `InvoiceAmountInput` now accepts optional `label`
and `invalidMessage` props: the two invoice dialogs supply catalog messages,
while existing defaults and all other callers remain unchanged for LOC-047.
Its validation, decimal precision, placeholder and onChange behavior are unchanged.

`lib/money/invoice-ui.ts`, document-editor helpers, server services, REST/MCP,
authorization, stored units, FX, database schema/migrations and IRR rollout flags
are unchanged. Payment/credit/custom-interest requests retain canonical
`amountMinor` strings. Copies preserve exact unit prices and saved dimensions;
creation retains deposit basis points, optional approval, canonical dates and
nullable reference/notes. No financial calculation uses translated text.
All pre-existing catalog namespaces, including Stripe, are unchanged under DEC-008.

## Existing MCP coverage

`list_invoices`, `get_invoice`, `get_invoice_summary`, `create_invoice`,
`pay_invoice`, lifecycle approval/send/void/write-off/interest tools,
`list_invoice_available_credits`, `apply_customer_credit`, invoice snapshot tools,
compliance checks, PDF tools and bulk reminder/mark-sent tools already cover the
corresponding operations. Invoice duplication reuses create with copied fields.
Services retain `AuthContext`, strict schemas and `wrapTool` protections.
Existing `get_invoice` explicitly returns invoice data only; REST payment-history/
base-display enrichment remains a documented MCP read-shape difference.
No operation or API changed, and no new MCP tool was needed.

## Verification and limits

`tests/invoice-catalogs.test.ts` renders actual production JSX with React,
next-intl and `PresentationProvider` in both locales. Table, fields, date picker,
amount input and money helpers are real; hooks/navigation/portals are controlled
and out-of-slice forms use explicit stubs. Tests execute original callback syntax
for reads, currency lookup, payment/credit writes, lifecycle/confirmation actions,
bulk summaries, creation, snapshots, copy and PDF download boundaries. They also
audit authored JSX/attributes, compliance-map coverage, Persian script, plural
0/1/2, escaped interpolation and exact USD/JPY/KWD values.

Four existing migrated PostgreSQL integration groups exercise actual authenticated
REST, registered MCP and independent SQL assertions for invoice reads, lifecycle,
snapshots and exact-money UI adapters on disposable loopback databases.
Controlled rendering/callback checks do not claim mounted browser interaction,
native terminology approval, complete RTL, live email/storage/PDF-provider,
hosted-CI, deployment or production IRR qualification. No build, development server
or application database access was used.

See [attempt evidence](../evidence/LOC-040-attempt-1.md) and
[self-review](../evidence/LOC-040-review-1.md).
