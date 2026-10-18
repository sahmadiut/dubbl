# Customer prepayment catalogs

LOC-044 is one bounded child of LOC-025. LOC-025/007/002 retain independent
integration acceptance. This extraction adds 103 paired `CustomerPrepayments`
messages to en-US and fa-IR (4,755 compatible keys per locale). Persian financial
wording is provisional pending native terminology and RTL qualification.

## Owned source and behavior

- `app/(dashboard)/sales/customer-prepayments/page.tsx`: title, columns,
  finite status/source display, empty guidance, creation action, loaded summary
  labels, failure states, tabs/tooltips, search/date/sort controls, clear action,
  filtered-empty state and ICU pagination count. Search uses the displayed
  translated source label. Column and search memoization respond to locale changes.
- `app/(dashboard)/sales/customer-prepayments/[id]/page.tsx`: loading/not-found,
  recipient, back action, application dialog and outcomes, invoice choices,
  available credit, received date, validation, notes and read failures.
- `CustomerCreditForm` and its `CustomerCreditDrawer` wrapper in
  `components/dashboard/create-drawer.tsx`: creation guidance, owned labels,
  placeholders, validation, currency recovery and creation outcomes.
- `components/dashboard/customer-prepayment-money-details.tsx`: original,
  used-so-far and available-to-use labels; existing bigint subtraction and exact
  currency formatting are preserved.
- `i18n/customer-prepayment-presentation.ts`: finite typed status/source labels
  with own-key checks. Unknown and prototype-like values remain escaped data.

Read errors are stored as message codes, so existing failures render in the
current locale without refetching due to translation dependencies. Unknown
server/parser prose is replaced with catalog fallbacks. Creation requires a
nonempty string saved identity before success, close and navigation. If an
application succeeds but its JSON/balance aliases are unreadable, the detail
clears its usable balance and requests a reload, without a success toast.

## Explicit exceptions and preserved contracts

Customer names, invoice numbers, notes, account names, unknown source/status
codes, canonical currency codes and dates remain caller data. Illustrative
`INV-0042`, USD example amounts, punctuation and missing-value dashes retain
their existing presentation. Internal thrown diagnostics are never displayed.
Date, numeral and financial-input adapters retain separate qualification.

REST paths, organization headers, canonical filter/status/source/sort values,
page size 50, date query names, drawer type `customerCredit`, routes and CSS are
preserved. Summaries still group loaded non-void rows by currency with bigint;
unlike currencies are never added. No new monetary conversion is introduced.

Creation retains explicit/contact/organization/USD currency resolution,
same-currency bank filtering, canonical Gregorian date, nullable notes and exact
`amountMinor`. Application retains same-customer/same-currency outstanding
invoice eligibility, exact positive amount validation against both balances and
the canonical `{ invoiceId, amountMinor }` payload. Existing abort, organization
remount and stale-pagination generation guards remain intact.

ContactPicker, CurrencySelect, DatePicker internals, InvoiceAmountInput,
DrawerFooter internals, shared loaders, navigation and shared sales forms retain
their existing owners (including LOC-047/058 and later adapters). Other drawers,
earlier catalog namespaces and Stripe are unchanged under DEC-008. No schema,
migration, service, REST/MCP, FX, financial-unit or IRR-flag changes are made.

## MCP coverage

Existing `list_customer_credits`, `get_customer_credit`,
`create_customer_credit`, `apply_customer_credit` and
`list_invoice_available_credits` use organization-scoped AuthContext, shared
Drizzle services, strict described input schemas and `wrapTool`. Existing
bank/contact/organization reads support the creation form. No operation or route
is added, so no MCP contract change is required.

## Verification and limits

`tests/customer-prepayment-catalogs.test.ts` renders production component syntax
with React, real next-intl, PresentationProvider, DataTable, DatePicker, balance
cards and exact-money helpers. State, navigation, portals and out-of-slice form
pickers use controlled boundaries. Original callbacks exercise canonical
creation/application requests, HTTP/network/JSON/shape/alias failures, cancelled
reads, stale pagination, currency resolution and invoice eligibility. Both
locales, ICU counts, Persian script, hostile interpolation and owned JSX/display
attributes are checked. The existing UI-money rendering test now uses the real
presentation provider required by translated cards. Existing wire/UI-money and
disposable REST/MCP/SQL fixtures retain financial and tenant checks.

Controlled rendering does not establish mounted browser qualification. Native
wording, RTL, date/numeral adapters, shared forms, parent acceptance, hosted CI,
providers, deployment and production IRR qualification remain open. No full
build or dev server is run, and the application database is not accessed.

See [attempt evidence](../evidence/LOC-044-attempt-1.md) and
[self-review](../evidence/LOC-044-review-1.md).
