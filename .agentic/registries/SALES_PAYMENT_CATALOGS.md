# Sales payment catalog extraction

LOC-039 adds 60 paired `SalesPayments` messages (2,844 keys per locale).
LOC-025/007/002 retain independent combined acceptance. Persian wording remains
provisional pending native terminology and RTL qualification.

## Authored presentation covered

- `app/(dashboard)/sales/payments/page.tsx`: document title, headings, description,
  empty/error states, currency sample guidance, summary labels, table headers,
  allocation counts, method labels, date/search/sort filters, clear action and
  accessible back/search labels. Allocation counts use ICU plural rules while the
  existing zero-count dash remains unchanged.
- `app/(dashboard)/sales/payments/[id]/page.tsx`: entity title, customer/reference/
  account/date interpolation, loading/missing/error states, methods, exact amount/
  allocated/unallocated labels, historical balance warning, allocation section,
  document type fallbacks, notes and back action.
- `i18n/sales-payment-presentation.ts`: finite typed method/document display maps
  with own-property guards; future unknown and prototype-like codes remain data.
  The existing English list/detail bank-transfer capitalization is preserved.

Requests use translated operation fallbacks rather than exposing network, JSON,
service or exact-money parser prose. A malformed list envelope now fails visibly
instead of appearing as an empty success. Successful loads clear stale read errors.
Aborted requests never adopt data/errors or alter loading state.

## Explicit exceptions and preserved contracts

Caller names, references, notes, bank names, payment/invoice numbers, unknown
codes and identifiers remain escaped caller data. Canonical method/document codes,
filter values, sort keys/directions, date strings/comparisons, API URLs, organization
headers, query limits, client remount keys and link destinations remain unchanged.
Existing allocation invoice links retain `/sales/invoices/{id}`; route correction
is outside this extraction. Hyphens, separators and styling are punctuation/layout.
BrandLoader and DatePicker use their existing shared catalogs. Sales navigation is
owned by LOC-047; invoice payment-recording dialogs by LOC-040. Supplier-only
PaymentAmountPreview is owned by LOC-033, outside this customer-read slice.

`paymentUiRow`, `paymentUiMoney` and `paymentUiSummary` remain unchanged: canonical
saved aliases validate before adoption, signed noncash carriers retain their
units, allocations sum as bigint, and totals/averages group currencies without FX.
The loaded sample remains bounded to the existing first-page payment request;
no unrequested whole-ledger total is implied. Dates/numerals/money presentation
adapters retain separate later qualification. Historical unallocated balances
remain read-only and cannot create another cash payment from this page.

No new user operation, API, schema or MCP contract was introduced. Existing
`list_payments` and `get_payment` cover these org-scoped reads through the same
services as REST; the invoice lookup remains labels only. Existing create/delete/
batch tools and all authorization, financial and audit behavior stay unchanged.
No Stripe functionality, files or pre-existing catalog namespaces were changed.

## Verification boundaries

`tests/sales-payment-catalogs.test.ts` renders the actual production templates
through React, next-intl and PresentationProvider. State/navigation/network
boundaries are controlled and Select portals inline; table, fields, date picker,
headers, translations and exact-money helpers are real. Production callback
syntax is executed for fetch, filter/sort and invoice label lookup assertions.
These checks do not claim mounted browser event or complete RTL qualification.
Existing payment-read and payment UI integration fixtures separately exercise
real REST/MCP/SQL on randomized disposable migrated PostgreSQL databases.

Native Persian review, complete RTL/browser layout, hosted CI, deployment and
production IRR qualification remain independent. No full build, development
server or application database access is part of this task.

See [attempt evidence](../evidence/LOC-039-attempt-1.md) and
[honest self-review](../evidence/LOC-039-review-1.md).
