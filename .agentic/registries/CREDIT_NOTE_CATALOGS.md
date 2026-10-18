# Sales credit note catalogs

LOC-043 is one bounded child of LOC-025. LOC-025/007/002 retain independent
integration acceptance; LOC-047 retains shared sales forms. This extraction
adds 102 paired `CreditNotes` messages to en-US and fa-IR. Persian financial
wording is provisional pending native terminology and RTL qualification.

## Owned source

- `app/(dashboard)/sales/credit-notes/page.tsx`: document title, list columns,
  finite status display, empty guidance, creation action, summary labels and
  failure state, tabs/tooltips, search/date/sort controls, clear action,
  filtered-empty state, ICU pagination count and read/load-more failures.
- `app/(dashboard)/sales/credit-notes/[id]/page.tsx`: loading/not-found/read
  failure, recipient, back/send actions, status and issued date, notes,
  application action/dialog, invoice choices/fallbacks, remaining credit,
  amount validation and application outcomes, cancellation confirmation and
  outcomes. Unknown server/parser prose is replaced with catalog fallbacks.
- `CreditNoteDrawer` in `components/dashboard/create-drawer.tsx`: owned
  title/guidance, fields/placeholders, line/notes section labels, create action,
  validation and creation outcomes. Success requires a nonempty string credit
  note ID before showing success, closing and navigating.
- `components/dashboard/credit-note-money-details.tsx`: total/applied/remaining,
  line headings and subtotal/tax/total messages, interpolating existing exact
  money strings and the canonical currency code.
- `i18n/credit-note-presentation.ts`: typed finite status display with own-key
  checks; unknown values (including prototype-like names) remain escaped data.

Cancellation denial/network failure now produces the translated failure message.
Existing active-instance guards suppress late application/cancellation outcomes.
The original abort and organization/filter-context protections remain in place.

## Explicit exceptions and preserved contracts

Customer names/emails, references, notes, line descriptions, account names/codes,
document/invoice numbers and unknown status values remain escaped caller data.
Illustrative `INV-0042`, `CN-0001`, USD example amounts, punctuation and missing
value dashes retain their presentation. Date-only strings, exact money format,
fractional quantity display and input decimal grammar await separate adapters.
Internal thrown diagnostics are never displayed directly.

REST paths, organization headers, queries, canonical status/filter/sort values,
page size 50, drawer type, document type `credit_note`, navigation and CSS are
preserved. Summaries still use the saved response currency; the existing server
and adapter reject mixed-currency or unsafe aggregates. No currencies are added
together in presentation code.

Creation retains the USD default, explicit currency selector, contact/date,
nullable reference/notes, exact `unitPriceExact`, physical decimal quantities,
stored hundredths, extended-price rounding (`roundPriceFirst={false}`), 18
fraction digits and revenue/sales-tax context. Application still selects this
customer's outstanding same-currency invoices, validates positive exact money
against both remaining credit and invoice due, and sends canonical
`{ invoiceId, amountMinor }` without localized financial input or numeric coercion.

Shared LineItemsEditor, contact/currency/date pickers, DrawerFooter internals,
InvoiceAmountInput, SendDocumentDialog, EmailHistory, navigation and shared
loaders keep separate ownership. Other drawers, all earlier namespaces and
Stripe remain unchanged under DEC-008. There are no schema/migration, service,
REST/MCP, financial-unit, FX or IRR-flag changes.

## MCP coverage

Existing `list_credit_notes`, `get_credit_note`, `create_credit_note`,
`update_credit_note`, `delete_credit_note`, `send_credit_note`,
`apply_credit_note`, `void_credit_note` and `get_credit_note_summary` are
organization-scoped, use shared Drizzle services, strict described input
schemas and `wrapTool`. No new user operation or route is introduced.

## Verification and limits

`tests/credit-note-catalogs.test.ts` renders actual production syntax with React,
next-intl and PresentationProvider in both locales. Tables, DatePicker, money
details and financial helpers remain real; component state, navigation,
portals and out-of-slice forms have controlled boundaries. Original callbacks
exercise canonical requests, creation/application/cancellation, exact amounts,
HTTP/network/JSON/shape/alias failures, cancelled reads, stale pagination and
invoice eligibility. Persian-script checks and an AST source audit cover owned
JSX and display attributes. Existing credit wire and UI-money tests cover
currency scales, limits and rounding; disposable PostgreSQL integration
exercises authenticated REST, registered MCP and independent SQL.

Controlled rendering does not establish mounted browser qualification. Native
wording, RTL, date/numeral adapters, shared forms, independent parent acceptance,
hosted CI, providers, deployment and production IRR qualification remain open.
No full build or dev server was run; the application database was not accessed.

See [attempt evidence](../evidence/LOC-043-attempt-1.md) and
[self-review](../evidence/LOC-043-review-1.md).
