# Sales quote catalogs

LOC-041 adds 73 paired `SalesQuotes` messages, reaching 4,458 compatible keys
per locale. Persian wording is provisional pending native terminology review.
LOC-025/007/002 retain independent combined acceptance; native/RTL gates stay open.

## Source ownership

- `app/(dashboard)/sales/quotes/page.tsx`: document title, empty guidance and
  example descriptions, creation actions, overview/table headings, status tabs,
  status labels, empty results and read failures. Columns now receive the active
  translator inside the component; filtering still uses canonical status codes.
- `app/(dashboard)/sales/quotes/[id]/page.tsx`: loading/not-found, recipient and
  date descriptions, back/send/accept/decline/conversion controls, conversion
  hint, status labels, action outcomes, initial-read and refresh errors.
- `QuoteDrawer` in `components/dashboard/create-drawer.tsx`: owned title,
  guidance, labels, placeholders, footer action, validation and create outcomes.
- `components/dashboard/quote-money-details.tsx`: line headings, currency
  interpolation and subtotal/tax/total labels. Saved amounts still use bigint
  and the existing exact currency formatter.
- `i18n/quote-presentation.ts`: typed finite status display map with own-property
  lookup; unknown values remain escaped data, including prototype-like codes.

Create failures now use a translated fallback instead of unreviewed server/parser
prose. Lifecycle and conversion requests catch network failures, suppress stale
outcomes across context changes and translate errors. Creation/conversion require
a nonempty string result ID before success/navigation. Existing successful payloads
and routes are preserved; no transport or financial service changes were needed.

## Explicit exceptions and preserved contracts

Caller names, emails, notes, references, line descriptions, account codes/names,
document numbers and unknown statuses remain escaped data. Sample `QTE-0001` and
`INV-0001`, illustrative USD amounts, punctuation and numeric-only counts retain
their existing presentation. Date-only strings, currency formatting, fractional
quantity rendering and decimal input grammar await separate presentation tasks.
Internal thrown English diagnostics are never directly displayed.

API URLs, organization headers, status/action/filter/document-type codes, CSS,
currency codes, date values, stored units, line quantity hundredths, exact decimal
`unitPriceExact`, price-first rounding and 18 price fraction digits are unchanged.
Quote creation still defaults independently to USD, retains nullable reference/
notes and sends `expiryDate`. Conversion still requests the remaining balance
through a POST with no body. No translated value enters a financial calculation.

Shared `LineItemsEditor`, contact/currency pickers, `DrawerFooter` internals,
navigation/layout/loading, `SendDocumentDialog` and `EmailHistory` stay separately
owned; LOC-047 retains shared form/document copy. Other creation drawers, all
pre-existing message namespaces and Stripe are unchanged under DEC-008. No DB,
schema, migration, server, REST/MCP or IRR-flag changes are part of this slice.

## MCP coverage

Existing `list_quotes`, `get_quote`, `create_quote`, `send_quote`, `accept_quote`,
`decline_quote` and `convert_quote_to_invoice` cover corresponding quote operations
through org-scoped shared services and `wrapTool`. `send_quote` records sent state;
the existing shared email delivery dialog has separate ownership. No new operation
or changed route requires a new tool in this extraction.

## Verification and limits

`tests/quote-catalogs.test.ts` renders actual production component syntax with
React, next-intl and `PresentationProvider` in both locales. Table, date picker,
money details and exact-money helpers are real. State/navigation/portals and
out-of-slice forms use controlled boundaries. Original callback syntax is executed
for reads, refresh, creation, lifecycle and conversion, asserting headers, routes,
exact payloads, malformed JSON/shapes/aliases, denial, network errors, cancellation,
stale context, escaped interpolation, all statuses, unknown codes and Persian script.
There is no authored plural sentence in this slice; numeric counts stay numeric.

Two migrated disposable loopback PostgreSQL groups exercise actual authenticated
REST, registered MCP and SQL for quote lifecycle, isolation, exact prices, saved
reads and conversion. Controlled rendering is not mounted browser qualification.
Native wording, RTL, date/numeral adapters, live email/provider, hosted CI,
deployment and production IRR qualification remain open. No full build or dev
server was run, and the application database was not accessed.

See [attempt evidence](../evidence/LOC-041-attempt-1.md) and
[self-review](../evidence/LOC-041-review-1.md).
