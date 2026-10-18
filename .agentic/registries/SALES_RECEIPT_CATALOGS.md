# Cash sale and receipt attachment catalogs

LOC-042 adds 86 paired `SalesReceipts` and six paired `ReceiptAttachments`
messages, reaching 4,550 compatible keys per locale. Persian wording is
provisional pending native financial terminology review. LOC-025/007/002 retain
independent integration acceptance; native/RTL qualification remains open.

## Source ownership

- `app/(dashboard)/sales/receipts/page.tsx`: document title, columns, status
  display/tabs, empty guidance/examples, creation action, stats, search/date/sort
  controls, filtered-empty state, pagination count and read/load-more failures.
  The count now uses ICU plurals rather than an English suffix condition.
- `app/(dashboard)/sales/receipts/[id]/page.tsx`: loading/not-found, recipient,
  back action, status, reference, total, deposit destination/fallback, notes and
  read failure. Organization/receipt changes still remount the content; retries
  clear an earlier failure before adopting the next validated response.
- `SalesReceiptDrawer` in `components/dashboard/create-drawer.tsx`: owned
  title/guidance, labels/placeholders, payment destination hint, empty account
  list, footer action, validation, currency-context and creation outcomes.
- `components/dashboard/sales-receipt-money-details.tsx`: line headings,
  currency interpolation and subtotal/tax/total messages using existing exact
  money strings.
- `components/dashboard/receipt-attachments.tsx`: shared default label,
  view/remove titles, loading and failure messages. Caller label overrides are
  retained. Failed HTTP reads preserve the previous list; failed HTTP downloads
  use the translated error. Optimistic delete rollback is preserved.
- `i18n/sales-receipt-presentation.ts`: finite typed status display helper with
  own-property checks. Unknown status values remain escaped data.

Creation failures use a translated fallback rather than raw service/parser
prose. Creation requires a nonempty string receipt ID before success/navigation.
The request, saved-money adapters and financial logic remain unchanged.

## Explicit exceptions and preserved contracts

Caller names, notes, references, line descriptions, file names, bank/account
codes/names, document numbers and unknown status values remain escaped data.
Sample `SR-0001`, illustrative USD amounts, punctuation and numeric stat counts
retain their presentation. Canonical date-only strings, exact currency format,
fractional quantity display and decimal input grammar await separate adapters.
Internal thrown English diagnostics are not displayed directly.

REST paths, organization headers, query keys, status/filter/sort codes, drawer
type, document entity types, CSS and route navigation are unchanged. Pagination
keeps page size 50, existing generation/abort guards and prior rows on load-more
failure. The collected stat sums only paid loaded matches by currency with
bigint; currencies are never added together.

Creation retains customer/org/USD currency precedence, explicit currency
override, bank destination, nullable reference/notes, canonical date, decimal
physical input quantities, stored hundredths, exact `unitPriceExact`, extended
price rounding (`roundPriceFirst={false}`), 18 price fraction digits and the
revenue/sales-tax editor context. No localized value enters money calculations.

Shared LineItemsEditor, contact/currency/date pickers, DrawerFooter internals,
FileUploader, navigation and shared loaders retain their separate ownership.
LOC-047 owns the shared sales form copy. Other creation drawers, all earlier
message namespaces and Stripe are unchanged under DEC-008. No DB, migration,
REST/MCP service, persisted-unit, FX or IRR-flag changes are part of this task.

## MCP coverage

Existing org-scoped `list_sales_receipts`, `get_sales_receipt`,
`create_sales_receipt`, `update_sales_receipt`, `delete_sales_receipt`,
`post_sales_receipt` and `void_sales_receipt` use shared Drizzle services and
`wrapTool`. `list_entity_files` and `attach_file_to_entity` retain attachment
listing/upload coverage. This extraction introduces no new operation or route;
it does not claim a new audit of all document-operation parity.

## Verification and limits

`tests/sales-receipt-catalogs.test.ts` renders actual production component
syntax through React, next-intl and PresentationProvider in both locales.
Tables, date picker, money details and money helpers are real. State,
navigation, portals and out-of-slice forms have controlled boundaries. Original
callbacks verify requests, exact payloads, translated outcomes, malformed JSON,
shapes/aliases, denial, network failure, cancellation, pagination generation
guards, currency fallback, optimistic rollback and escaped interpolation.
Persian-script checks and an AST audit cover owned JSX and display attributes.

Two disposable PostgreSQL groups exercise authenticated REST, registered MCP
and SQL for receipt lifecycle, organization isolation, prices, saved reads,
posting and voiding. Controlled rendering does not establish mounted browser
qualification. Native wording, RTL, date/numeral adapters, provider behavior,
hosted CI, deployment and production IRR qualification remain open. No full
build or dev server was run; the application database was not accessed.

See [attempt evidence](../evidence/LOC-042-attempt-1.md) and
[self-review](../evidence/LOC-042-review-1.md).
