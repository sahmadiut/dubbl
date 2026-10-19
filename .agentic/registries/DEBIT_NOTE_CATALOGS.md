# Supplier debit note catalogs - LOC-052

LOC-052 is one bounded purchasing child of LOC-026. LOC-026/007/002 retain
independent integration acceptance. Persian financial wording is provisional
pending native terminology review and complete RTL qualification. Stripe stays
unchanged under DEC-008.

## Source ownership

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/debit-notes/page.tsx` | Document title, columns/statuses, empty guidance and examples, overview scope, filters/sorts, count plurals, read failures and empty search results |
| `app/(dashboard)/purchases/debit-notes/[id]/page.tsx` | Loading/not-found/errors, sender and reference captions, send/apply/cancel actions, confirmation, bill choice/scope, remaining-credit guidance, local validation and workflow outcomes |
| `components/dashboard/debit-note-overview.tsx` | Currency-grouped total/used/remaining headings |
| `components/dashboard/debit-note-money-details.tsx` | Saved credit/line headings and subtotal/tax/total captions |
| `components/dashboard/create-drawer.tsx` | Only DebitNoteDrawer: fields, descriptions, placeholders, required-input errors, creation feedback and cancel/creating footer overrides |
| `i18n/debit-note-presentation.ts` | Finite typed status display mapping with own-property checks |

Added 105 paired DebitNotes messages, bringing each catalog to 5,508 compatible
keys. Other namespaces remain unchanged. Read failures store finite message keys
and render in the current locale without adding translations to fetch-effect
dependencies. Unknown and prototype-like status codes remain caller data.
Unreviewed API/network/JSON/parser prose never becomes visible error copy;
application validation uses a reviewed translated amount/balance fallback.

## Preserved behavior and exact money

List and pagination requests keep the organization header, URLs, page size,
status/sort/direction/date query values, client search and existing abort/context/
generation guards. Invalid exact-money aliases still fail before state adoption.
Overview totals cover only loaded matching rows, exclude void credits and group
currencies separately with bigint sums; the translated scope describes this
existing limitation. ICU formats count plurals independently of monetary output.

Creation keeps USD/reset defaults, nullable reference/notes, date-only issueDate,
supplier ID, exact unitPriceExact text and canonical line quantity/account/tax
values. Purchase/expense line filtering, 18 fractional price digits, extended-price
rounding and all financial helpers remain unchanged. Failed requests retain the
drawer and restore its saving state. Creation now requires a nonempty saved ID
before showing success, closing or navigating; concurrent saving is guarded.

Application keeps the latest-100-bills request and exact eligibility: same
supplier/currency, received/partial/overdue status and positive balance. The sent
credit and bill bounds are checked before posting the unchanged `{billId,
amountMinor}` payload. Currency-specific decimal entry, saved hundredths of
quantity, safe numeric compatibility and canonical Minor strings remain intact.
Failed operations retain the dialog/selection and show localized feedback.
Unmounted outcomes remain suppressed. Send-dialog refresh/email-history behavior
and `debit_note` machine identifiers remain unchanged.

Cancellation retains destructive confirmation and the org-scoped POST without a
body. HTTP/network failures now produce localized feedback; success retains the
existing reload path. No workflow, REST/MCP route, schema or migration was added.

## Explicit exceptions and independent ownership

- Supplier/contact names and email, document numbers, references, notes, line
  descriptions, account names/codes, currency codes and saved dates remain data
  and are React-escaped. Unknown machine statuses stay unchanged.
- Technical URLs, JSON fields, IDs, status/filter/sort values, CSS and icons remain
  constants. `BILL-0042`, `DN-0001` and the three illustrative USD amounts in the
  empty-state example remain fixed demonstration data. Dashes and punctuation
  remain symbols.
- Existing money/date/quantity adapters and exact ASCII decimal entry remain
  unchanged; complete numeral/calendar adoption is separate.
- LineItemsEditor, InvoiceAmountInput, currency/date controls, send dialog,
  EmailHistory, table and other shared primitives keep their existing catalogs.
  Debit-owned amount accessibility/error overrides are translated here.
- ContactPicker internals remain LOC-058. Shared purchasing navigation/forms
  remain LOC-056. Sibling purchases, LOC-026/007/002 and native/RTL acceptance
  retain independent scope. No Stripe, FX, worker or IRR rollout changes.

## Existing MCP coverage

`lib/mcp/tools/debit-notes.ts` already registers list/get/create/update/delete/
send/apply/void tools. They use direct DB services, org-scoped AuthContext,
described schemas and wrapTool. Existing bill-list tools cover the selection
workflow. This display extraction needs no new MCP operation or tool text change.

## Verification and limits

`tests/debit-note-catalogs.test.ts` renders production functions and real
React/next-intl/PresentationProvider, money components, inputs, table and date
controls. Hooks/navigation and portal/select/picker/editor boundaries are
controlled; select options render inline for label/value assertions. These are
rendering/callback tests, not mounted browser or visual-layout acceptance.
Existing migrated disposable PostgreSQL suites separately exercise actual REST,
registered MCP and independent SQL assertions for creation, reads, exact amounts,
application, cancellation and lifecycle/accounting behavior.

See [attempt evidence](../evidence/LOC-052-attempt-1.md) and
[honest self-review](../evidence/LOC-052-review-1.md) for executed results. Native
Persian terminology, full RTL/font/browser review, hosted CI, deployment and
production IRR qualification remain independent. No full build or dev server ran.
