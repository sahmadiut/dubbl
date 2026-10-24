# Currency unit presentation

## Shared foundation: LOC-129

`i18n/currency-names.ts` is a static Persian name snapshot, rather than a browser
ICU-dependent lookup. Names derive from installed ICU DisplayNames, with explicit
provisional names for its unmapped SVC/XCG/XDR/XSU/ZWG entries. The owner's exact
IRR name is **ریال**. Other terminology remains provisional for L10N-001 and
L10N-012. This catalog is independent of the message catalogs and never changes
canonical ISO metadata, database reference names, currency scales or flags.

`currencyLabel(code, locale, referenceName?)` selects names only for `fa-IR`.
English returns the caller's existing reference name when supplied, otherwise
the existing ISO code. Unknown/unmapped/case-mismatched codes fall back verbatim
to the supplied code; caller text remains escaped by React. Own-property lookup
prevents prototype names being treated as supported currencies. `currencyPrefix`
only translates known ISO codes; symbols and arbitrary caller prefixes retain
their existing meaning. No code is inferred from an ambiguous `$` symbol.

`currencyPartsText` replaces only identified Intl currency parts. Numeric parts,
signs, grouping and exact low digits remain untouched; a nonbreaking space
separates a localized name directly adjacent to a numeric part. English parts
are joined unchanged. The existing exact formatter retains BigInt arithmetic
and explicit currency scale, independently of numeral/calendar preference.

Adopted shared surfaces:

| Surface | Unit behavior | Canonical contract |
| --- | --- | --- |
| CurrencySelect full/compact | Persian name is primary; full selection retains secondary ISO; searchable terms include ISO, reference and localized names | Selected value, disabled codes, keys and callback are unchanged ISO |
| CurrencyInput | Known ISO prefix uses language label in `bdi` | Parent text, callback, hidden form field, decimal policy and caller aria-label are unchanged |
| DualAmount | Both amounts and missing base-rate unit use localized names and isolation | Saved source/base currencies, minor amounts and no-FX behavior unchanged |
| formatExactMoney/useNumberPresentation | Explicit presentation selects the name, preserves exact number parts | Existing default-English formatter callers and all units unchanged |

No new business operation or endpoint is introduced. Existing REST/MCP services
and machine currency values are unchanged. No schema, IRR production activation,
rial/toman conversion, rounding, payroll/legacy scale or financial calculation
change is authorized by this work.

## Remaining whole-website adoption and independent acceptance

An initial source audit found money display helper consumers in 132 website and
component files. That count is a scoping observation, not proof that all normal
currency displays have been adopted. LOC-115 is queued for independent combined
acceptance after these children; completing LOC-129 does not complete LOC-115:

| Owner | Required surfaces |
| --- | --- |
| LOC-130 | Sales, purchases, banking, accounting/fixed assets/loans, contacts, shared create/detail/document editors |
| LOC-131 | Inventory, projects, CRM, budgets, payroll; explicit fixed-two legacy semantics |
| LOC-132 | Reports, tax/currency workspace, settings/onboarding, dashboard/home, public/portal pages, all remaining website families |
| LOC-115 | Exhaustive caller/exception audit and independent integration acceptance of all children |

Each adoption task must inspect actual callers, including translated message
arguments and local formatter closures. Existing default-English helpers do not
automatically become language-aware. Raw domain unit labels, heading arguments,
accessible labels, summaries, badges and normal money cells remain assigned to
these children. This shared foundation does not claim their completion.

Exceptions to preserve and inventory during domain adoption: explicit technical
ISO identifier columns, state/select values, URLs, saved user/reference names,
REST/MCP/DB values, machine CSV/JSON exports, issued snapshots and email/PDF
outputs. Stripe files/functionality remain frozen under DEC-008, including
dedicated Stripe display work. Shared UI changes may naturally apply where
existing shared controls are used, but no Stripe-specific caller is edited.

RTL-001 and L10N-012 retain independent mounted-browser/layout/native acceptance.
The shared tests use real provider/next-intl SSR and authored callbacks, with
inline picker portal/command wrappers; they do not qualify browser search
filtering, focus, keyboard behavior, hydration or visual layout.


## LOC-130 domain adoption

Sales, purchases, banking, accounting (assets/loans included), contacts and their
shared editors now pass active presentation explicitly to existing exact-money
formatters. Pure table builders receive presentation from their React owner;
memo dependencies include presentation so switching language/numerals refreshes
the labels. Grouped summaries retain their original grouping/status/rounding
policy and format each group with its own saved code. All unadopted callers keep
their default English behavior until their owning task.

Normal headings, badges, selector option descriptions, amount-input accessible
labels/errors, exchange-rate notes, fixed USD form prefixes and static examples
use the label catalog. English symbols and sample amounts remain unchanged.
The exact legacy decimal adapter formats already-decimal asset amounts without
currency-scale reinterpretation or an added int64 bound on intermediate sums.
Assets/loans/revenue schedules retain their historical USD/fixed-two displays;
recurring bills retain major-times-100 storage and the existing saved-display
policy. No raw amount or source currency changes.

Adopted source inventory (each file was inspected, including local closures and
translation arguments):

- `app/(dashboard)/accounting/[id]/page.tsx`
- `app/(dashboard)/accounting/accounts/[id]/layout.tsx`
- `app/(dashboard)/accounting/accounts/[id]/page.tsx`
- `app/(dashboard)/accounting/accounts/[id]/settings/page.tsx`
- `app/(dashboard)/accounting/accounts/page.tsx`
- `app/(dashboard)/accounting/accruals/[id]/page.tsx`
- `app/(dashboard)/accounting/accruals/page.tsx`
- `app/(dashboard)/accounting/asset-categories/page.tsx`
- `app/(dashboard)/accounting/banking/[id]/(detail)/layout.tsx`
- `app/(dashboard)/accounting/banking/[id]/_components.tsx`
- `app/(dashboard)/accounting/banking/[id]/reconcile/page.tsx`
- `app/(dashboard)/accounting/banking/batches/[id]/page.tsx`
- `app/(dashboard)/accounting/banking/batches/page.tsx`
- `app/(dashboard)/accounting/banking/page.tsx`
- `app/(dashboard)/accounting/banking/scheduled/page.tsx`
- `app/(dashboard)/accounting/fixed-assets/[id]/page.tsx`
- `app/(dashboard)/accounting/fixed-assets/page.tsx`
- `app/(dashboard)/accounting/loans/[id]/page.tsx`
- `app/(dashboard)/accounting/loans/page.tsx`
- `app/(dashboard)/accounting/page.tsx`
- `app/(dashboard)/accounting/recurring-journals/[id]/page.tsx`
- `app/(dashboard)/contacts/[id]/activity/page.tsx`
- `app/(dashboard)/contacts/[id]/statement/page.tsx`
- `app/(dashboard)/contacts/page.tsx`
- `app/(dashboard)/purchases/[id]/page.tsx`
- `app/(dashboard)/purchases/bills/recurring/page.tsx`
- `app/(dashboard)/purchases/debit-notes/[id]/page.tsx`
- `app/(dashboard)/purchases/debit-notes/page.tsx`
- `app/(dashboard)/purchases/expenses/[id]/page.tsx`
- `app/(dashboard)/purchases/expenses/page.tsx`
- `app/(dashboard)/purchases/expenses/recurring/page.tsx`
- `app/(dashboard)/purchases/goods-receipts/[id]/page.tsx`
- `app/(dashboard)/purchases/goods-receipts/page.tsx`
- `app/(dashboard)/purchases/landed-costs/[id]/page.tsx`
- `app/(dashboard)/purchases/landed-costs/page.tsx`
- `app/(dashboard)/purchases/orders/[id]/page.tsx`
- `app/(dashboard)/purchases/orders/page.tsx`
- `app/(dashboard)/purchases/page.tsx`
- `app/(dashboard)/purchases/requisitions/[id]/page.tsx`
- `app/(dashboard)/purchases/requisitions/page.tsx`
- `app/(dashboard)/sales/[id]/page.tsx`
- `app/(dashboard)/sales/credit-notes/[id]/page.tsx`
- `app/(dashboard)/sales/credit-notes/page.tsx`
- `app/(dashboard)/sales/customer-prepayments/[id]/page.tsx`
- `app/(dashboard)/sales/customer-prepayments/page.tsx`
- `app/(dashboard)/sales/page.tsx`
- `app/(dashboard)/sales/payments/[id]/page.tsx`
- `app/(dashboard)/sales/payments/page.tsx`
- `app/(dashboard)/sales/quotes/page.tsx`
- `app/(dashboard)/sales/receipts/[id]/page.tsx`
- `app/(dashboard)/sales/receipts/page.tsx`
- `app/(dashboard)/sales/recurring/page.tsx`
- `app/(dashboard)/sales/revenue-schedules/[id]/page.tsx`
- `app/(dashboard)/sales/revenue-schedules/page.tsx`
- `components/dashboard/bill-currency-amounts.tsx`
- `components/dashboard/create-drawer.tsx`
- `components/dashboard/credit-note-money-details.tsx`
- `components/dashboard/customer-prepayment-money-details.tsx`
- `components/dashboard/debit-note-money-details.tsx`
- `components/dashboard/debit-note-overview.tsx`
- `components/dashboard/entry-form.tsx`
- `components/dashboard/invoice-amount-input.tsx`
- `components/dashboard/line-items-editor.tsx`
- `components/dashboard/opening-balance-form.tsx`
- `components/dashboard/opening-balance-money-details.tsx`
- `components/dashboard/payment-amount-preview.tsx`
- `components/dashboard/procurement-money-details.tsx`
- `components/dashboard/quote-money-details.tsx`
- `components/dashboard/recurring-invoice-money-details.tsx`
- `components/dashboard/requisition-line-editor.tsx`
- `components/dashboard/sales-receipt-money-details.tsx`
- `components/ui/rate-note.tsx`
- `i18n/numbers.ts`
- `lib/money/asset-display.ts`
- `lib/money/customer-prepayment-ui.ts`
- `lib/money/expense-display.ts`
- `lib/money/journal-display.ts`
- `lib/money/payment-ui.ts`
- `lib/money/procurement-ui.ts`
- `lib/money/quote-ui.ts`
- `lib/money/sales-receipt-ui.ts`

Explicit exceptions and inspected unchanged surfaces:

- Canonical ISO codes in state, keys, selection values, filters, effect/context
  keys, requests, REST/MCP/DB values, account constraints and hidden values remain
  machine identifiers. Contact/account currency *display* cells are localized;
  selected CurrencySelect values and secondary ISO references remain technical.
- The finite bank RangeError diagnostic still identifies the technical ISO input
  contract (for example KWD); no arbitrary server error prose is localized or
  exposed. Normal amount aria/errors authored by page/shared inputs use labels.
- Issued snapshots, send-document email composition, generated PDF/CSV/JSON and
  other export/output wire helpers retain their existing output contracts. No
  output API or server formatter was changed. SendDocumentDialog's email amount
  is part of composed output, rather than a newly localized document snapshot.
- Account-picker bookkeeping IDs/codes/names and user-entered descriptions remain
  caller data. Contact detail/bookkeeping/layout and banking detail/settings
  pages whose currency input is already CurrencySelect inherit LOC-129; they
  have no additional normal raw currency-unit display requiring mutation here.
- Entry/opening-balance numeric-only previews retain their canonical decimal
  values; their explicit fixed USD input prefixes now localize. Numeric-only
  line preview precision and percentage/rate values retain existing contracts.
- Shared create-drawer project, inventory, budget, CRM and payroll branches remain
  assigned LOC-131, even though the file also contains LOC-130 forms. Shared
  send/email/public/report/settings surfaces remain LOC-132 as inventoried above.
- Stripe functionality/files remain frozen under DEC-008 and were not edited.

Actual production detail templates, signed grouped summary/bill amounts, rate
notes, payment/input aria/errors and the authored bank-transfer submit callback
are exercised in `tests/currency-domain-presentation.test.ts`. Persian IRR is
asserted literally as **ریال**. Existing catalog fixtures now compare money to
the active language/numeral presentation, while all request assertions preserve
ISO identifiers and exact Minor strings. The loan fixture was brought up to the
pre-existing base-currency/bank-eligibility contract; no corresponding financial
production logic changed in LOC-130.

Parent LOC-115 remains independent and open. LOC-131 and LOC-132 retain their
assigned adoption scopes. Native Persian terminology, mounted browser behavior,
RTL/layout and production financial/IRR qualification are not accepted here.
