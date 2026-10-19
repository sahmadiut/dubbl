# Purchase order catalogs - LOC-054

Bounded child of LOC-026. LOC-026/007/002 retain independent integration
acceptance. Persian financial wording is provisional pending native review and
complete RTL qualification. Stripe remains unchanged under DEC-008.

## Owned sources

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/orders/page.tsx` | Document title, columns/status, empty pipeline/CTA, count tabs, loaded-row guidance, filters/sorts and read/overview errors |
| `app/(dashboard)/purchases/orders/[id]/page.tsx` | Detail captions, lifecycle actions/confirmations/outcomes, not-found/read failures, edit drawer, accessible line controls, validation/preview and footer |
| `components/dashboard/create-drawer.tsx`, PurchaseOrderDrawer only | Creation fields, validation/outcomes and explicit localized footer labels |
| `i18n/purchase-order-presentation.ts` | Typed finite own-property status mapping |

118 paired PurchaseOrders messages; 5,714 compatible keys per locale. Existing
catalog namespaces remain unchanged. All new Persian leaves contain Persian
script. Hidden diagnostic exception text never becomes display copy. Read errors
store finite keys and translate at render time without translator fetch dependencies.

## Behavior and money boundaries

Preserved URLs, headers, methods, IDs, query/status/sort values, saved Gregorian
dates and nullable payload fields. List controls still operate on loaded orders,
and amount sorting/overview group currencies without conversion. Reads check HTTP
and list envelopes before adopting exact-money rows. Failed pagination retains
loaded orders, exposes translated feedback and preserves generation guards.

Creation retains USD defaults, the real shared line editor with expense accounts,
purchase tax context and 18-place price text, currency validity resets, exact
unitPriceExact inputs and existing wire calculations. Edit hydration retains saved
rounded prices, quantity hundredths, account/tax references and the existing PATCH
no-tax/no-discount policy. Its preview uses the unchanged procurement calculator.
Failures preserve forms; create/edit require saved identity before close/navigation.

Receiving still POSTs to goods-receipts using purchaseOrderId, current UTC date
and exact outstanding quantity strings. Already-received/cancelled actions do not
mutate data. Conversion still uses a bodyless POST to the order conversion route;
delete remains DELETE after destructive confirmation. Lifecycle callbacks check
result identity/success, catch HTTP/network/JSON/parser/confirmation failures with
reviewed messages and restore busy state. Busy actions cannot be resubmitted by
callbacks that observe the current acting/saving state. No new operation was added.

## Explicit exceptions and independent scope

- Supplier/contact names/emails, descriptions, notes, references, numbers, account
  names/codes, currency codes, unknown status strings and saved dates are escaped
  caller data. Prototype-like statuses pass through safely as data.
- Technical values include URLs, headers, JSON fields, IDs, lifecycle/filter/sort
  codes, CSS, icons, step numbers, punctuation and empty defaults.
- Existing money/date/quantity helpers and exact ASCII decimal input remain
  unchanged. Full numeral/calendar adoption is separate.
- ProcurementMoneyDetails retains LOC-048 ownership. Shared line editor,
  SendDocumentDialog, EmailHistory, pickers and primitives retain their existing
  catalogs and independent acceptance; ContactPicker internals remain LOC-058,
  shared purchasing navigation/forms LOC-056. No schema, migration, financial
  service, REST/MCP, FX, worker, IRR flag or Stripe code changed.

Existing purchase-order MCP tools already cover create/list/get/count/update/
delete/send/convert through direct org-scoped shared DB services and wrapTool.
Existing goods-receipt tools cover receiving through the same service as REST.
This presentation extraction requires no new tool or contract change.

## Verification boundaries

`tests/purchase-order-catalogs.test.ts` executes production components with real
React/next-intl/PresentationProvider, table, date controls and money details.
Controlled state/navigation/portal and out-of-slice picker/editor/send/history
boundaries keep the test focused. The edit drawer's fields/preview render normally.
Original callback syntax executes with injected dependencies to assert requests,
exact aliases, failures, cancellation, saved identity, resets and retained state.
This does not establish mounted-browser, font or complete RTL acceptance.

Migrated disposable PostgreSQL suites independently cover actual REST, registered
MCP and SQL for orders, receipts and procurement UI payloads. Executed results and
limitations are recorded in [attempt evidence](../evidence/LOC-054-attempt-1.md)
and [self-review](../evidence/LOC-054-review-1.md). Native financial terminology,
parent acceptance, browser/RTL, hosted CI, deployment and production qualification
remain independent. No full build, dev server, provider request or deployment ran.
