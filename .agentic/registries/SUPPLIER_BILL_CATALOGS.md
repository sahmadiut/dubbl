# Supplier bill catalogs - LOC-049

LOC-049 is the bounded supplier-bill child of LOC-026. LOC-026/007/002 retain
independent combined acceptance. Persian wording is provisional pending native
financial terminology and RTL qualification. DEC-008 preserves Stripe unchanged.

## Source ownership

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/page.tsx` | Document title, table headers and statuses, due/overdue labels, empty guidance, feature cards, overview and aging labels, due-soon guidance, tabs/tooltips, search/date/sort controls and read/pagination errors |
| `app/(dashboard)/purchases/[id]/page.tsx` | Document title, missing/read errors, status/supplier/due sentence, statement link, lifecycle action labels/tooltips/toasts, approval/rejection/payment dialogs, cancellation and supplier-credit confirmations, line/totals/payment/details/order-match labels and supplier attachment prompt |
| `components/dashboard/create-drawer.tsx`, `BillDrawer` only | Creation labels, supplier/bill-number/reference/currency/dates, approval guidance, duplicate warning and confirmation, notes, submit label and localized validation/currency/create failures |
| `i18n/bill-presentation.ts` | Finite typed status display mapping, preserving canonical and unknown/prototype status codes |

Added 163 paired `SupplierBills` messages: 5,165 compatible keys per locale.
Due-day sentences use ICU plurals rather than English count suffixes. Tab counts
retain the existing numeric/dash display contract. The shared footer already
uses `DocumentForms` for cancel/creating; the bill submit label is supplied here.

## Behavior and transport preservation

All routes, organization headers, canonical status/filter/sort values, dates,
pagination, request-generation and abort protection remain intact. No money
adapter, currency fallback, rounding, line-quantity unit, FX policy, schema,
stored amount or REST/MCP contract was changed. Payment still sends canonical
`amountMinor` text, and supplier-credit lines retain the existing exact aliases.
Creation retains supplier/default currency selection, extended-price rounding,
explicit currency, optional approval, duplicate warning/block distinction and
`confirmDuplicate` behavior. Malformed success responses fail visibly instead
of navigating to an invalid bill URL. Validation and failed requests display
localized operation messages instead of raw exceptions or server prose; network
failures reset lifecycle busy controls. User-entered descriptions are checked
before serialization and retain their original text in the payload.

No new operation or REST route was added. Existing organization-scoped direct-DB
tools `list_bills`, `get_bill`, `get_bill_counts`, `create_bill`, `receive_bill`,
`approve_bill`, `reject_bill`, `pay_bill`, `void_bill` and `create_debit_note`
already cover these UI operations. Their registration, permissions, services,
descriptions and machine responses remain unchanged.

## Explicit exceptions and remaining ownership

- Caller/saved content stays verbatim and React-escaped: supplier/account names,
  account codes, bill numbers, line descriptions, notes, rejection reasons,
  duplicate numbers and unknown status codes.
- Technical route paths, JSON field names, status/action/filter/sort codes,
  identifiers, CSS, icons, structural punctuation, percent/multiplication signs,
  missing-value dashes and internal exceptions caught by localized handlers
  remain code constants.
- Money, quantity hundredths, FX/base amounts, percentages and date values keep
  the existing adapters. BillCurrencyAmounts has no authored prose; its dash
  and exact currency groups remain unchanged. Numeral/calendar adoption and
  RTL are separate tasks.
- Shared line forms, amount inputs, currency/contact/date pickers, tables,
  loading/confirmation UI, rate notes, dual amounts and receipt attachments use
  their existing catalogs. Generic forms remain LOC-047/056; supplier payment
  preview remains LOC-033. Purchasing navigation remains LOC-056, including its
  bill-loading shell. Other purchasing routes remain their respective children.
- Source inspection found no separate bill edit route or editor in this slice;
  creation is in BillDrawer and lifecycle controls are on the bill detail page.

## Verification and boundaries

`tests/bill-catalogs.test.ts` renders the production list/detail/drawer functions
through real React, next-intl and PresentationProvider with real table, date,
input, money, rate and footer controls. State/effects/navigation are controlled;
portals and out-of-slice forms use explicit test boundaries. These checks do
not constitute mounted browser interaction or layout approval.

Production callbacks verify exact settlement/credit/create payloads, org scope,
approval/rejection/cancel behavior, duplicate confirmation, hard duplicate
failure, HTTP/HTML/network/invalid-success failures, currency fallback, strict
money aliases, stale reads and pagination. Source AST assertions reject authored
English JSX/display attributes, and Persian-script checks cover all new keys.
Existing bill editor, saved UI and lifecycle fixtures independently exercise
authenticated REST, registered MCP and SQL in randomly named migrated disposable
PostgreSQL databases. See [attempt evidence](../evidence/LOC-049-attempt-1.md)
and [honest self-review](../evidence/LOC-049-review-1.md) for final results.

Native Persian terminology, full RTL/font/layout, hosted CI, deployment and
production IRR qualification remain independent. No full build, development
server, application database or dedicated Stripe work was performed.
