# Core UI money ownership (MON-129 children)

Source reviewed 2026-10-11. MONEY_BOUNDARIES.json is the reproducible lexical
inventory; this registry assigns reviewed core consumers to controller tasks.
Lexical absence alone is not proof of money correctness. MON-129 retains all
original combined criteria; MON-007 retains its original integration acceptance.

| Owner | Actual source consumers | Contract |
|---|---|---|
| MON-130 | components/dashboard/entry-form.tsx; create-drawer.tsx EntryDrawer and RecurringJournalDrawer; accounting/page.tsx and accounting/[id]/page.tsx; accounting/recurring-journals/[id]/page.tsx; dashboard/page.tsx recent journal columns | Exact editor cells/previews and Minor writes; saved manual currency-scale display/edit; raw fixed-two REST aliases validated against Minor strings; numeric legacy list totals remain explicitly fixed-two compatibility presentation |
| MON-131 | sales/page.tsx, sales/[id]/page.tsx, sales/quotes, sales/credit-notes, sales/receipts, sales/recurring; their invoice/quote/credit/receipt/customer-credit create-drawer sections; components/dashboard/line-items-editor.tsx receivable consumers | Invoice/quote/credit/receipt currency-scale contracts and explicit recurring exceptions; adopted receivable inventories and REST price Exact/Minor fields |
| MON-134 | components/dashboard/line-items-editor.tsx, lib/money/document-editor.ts; create-drawer.tsx InvoiceDrawer | Shared exact preview/display/input; invoice create exact-major strings, resolved currency and REST price-first rounding |
| MON-135 | sales/page.tsx and sales/[id]/page.tsx; invoice-amount-input.tsx; invoice-ui.ts; invoice-specific DualAmount and SendDocumentDialog props | Validated Minor reads, exact saved/copy prices, source/base display, aging and progress; currency-scale payment/interest Minor writes and same-currency credit application |
| MON-136 | Quote, credit note, sales receipt and customer prepayment lists/details/create drawers | Pending domain-specific currency, rounding, exact fields and settlement |
| MON-137 | Recurring invoice list/detail/editor and create-drawer.tsx RecurringDrawer | Pending recurring pricing/currency, exact fields and schedule preservation |
| MON-132 | purchases/page.tsx, purchases/[id]/page.tsx, purchases/debit-notes, purchases/orders, purchases/requisitions, purchases/goods-receipts, purchases/bills/recurring; corresponding create-drawer sections and line-items-editor payable consumers | Existing payable/procurement fixed-two versus currency scale policies; quantity hundredths and basis-point controls are separate |
| MON-133 | accounting/accounts/[id] page/layout; accounting/opening-balances/page.tsx and OpeningBalanceDrawer; accounting/banking, payments and payment batches; purchases/expenses and expense create/edit/mileage controls; tax/page.tsx, tax/periods/[id], tax/sales-tax and tax settlement controls; remaining core bank/payment/tax/settings/approval consumers | Explicit exact money and source/base-currency presentation; opening balances still require numeric compatibility writes until their separate API adoption; no silent unsupported Minor fields |
| MON-008 | Other dashboard financial/report consumers, budgets/assets/loans/projects/payroll/inventory auxiliary surfaces, contacts summaries, jobs, exports, public/provider/PDF consumers | Existing domain adoption does not imply complete consumer closure |

Shared create-drawer.tsx and dashboard/page.tsx are owned by section. MON-130
changes only journal sections/recent journal columns; MON-134 changes InvoiceDrawer.
Opening-balance floats and other document price/expense/budget/payment parsers
are pending under the rows above.
The recurring-journals list contains scheduling/count controls, no money fields.
Core source groups are broad inventories for subsequent bounded review; children
may split further without erasing any parent criterion.

## MON-130 reviewed behavior

`lib/money/journal-display.ts` owns strict nonnegative major text with an explicit
currency, blank-to-zero cells, safe-number workflow limits and bigint side sums.
Malformed, fractional-minor, negative, orphan and unsafe rows disable
submission. Recurring rows also reject two positive sides; manual journals retain
the existing acceptance of two-sided lines. Empty unused rows are omitted; positive amounts are never silently
dropped. Two or more nonzero rows and exact equality are required. Preview and
write use the same validated rows. This retains manual edit's existing raw-unit
balance rule; it does not introduce base FX balancing.

Manual and recurring creation retain explicit USD defaults. Saved manual lines
use their saved currency scale; editing 1250 JPY units shows 1250, and 1250 KWD
units shows 1.250. Minor writes preserve the same raw units. Currency, saved
millionths FX, cost center, project and fiscal year survive a draft edit; new
edit rows inherit the first row's currency/rate. Foreign recurring templates
retain their existing verbatim identity posting policy, not a new FX workflow.

`CurrencyInput` accepts a fractionDigits prop for saved currency editing, while
its default remains two for existing consumers. Journal monetary inputs are
text with decimal keyboard mode and accessible per-line labels. Existing grid
scrolling is retained; saved edit columns accommodate currency codes.

## Explicit compatibility and pending presentation exceptions

- Journal REST debit/credit and list total decimal aliases are fixed-two even
  for JPY/KWD tags. The exact alias is checked against that legacy spelling,
  then raw units drive calculations. Fallback fixed-two reads support legacy
  data without exact aliases; conflicting or unsafe aliases fail closed.
- Journal list/dashboard total fields are raw sums without a currency. Their
  historical USD/fixed-two display remains exact compatibility presentation;
  it is not an FX-converted economic total. Currency-rich aggregate presentation
  belongs to MON-133/MON-129 acceptance. No new currency is inferred from amount.
- Automated GL amount currency may differ from its source-document currency tag.
  Only manual/null-source and recurring_journal detail use saved tag scales.
  Other source types retain their prior fixed-two presentation explicitly through
  journalDisplayCurrency; MON-133 owns resolving those source/base distinctions.
  No second FX conversion or rescaling occurs here.
- Saved manual detail totals are grouped by currency; currency groups are not
  implicitly converted or summed into one display currency. Raw-unit balance
  status still matches the existing manual API policy. Saved rates are not edited.
- Remaining report widgets in dashboard/page.tsx stay MON-008. No schema,
  migration, public operation, MCP contract, production flag or history changes.

## MON-134 shared editor and invoice creation

`document-editor.ts` uses the actual invoice wire parser/calculator. Monetary
prices remain decimal strings (`unitPriceExact`), with up to 18 fractional digits;
minor-unit sums/products/tax use bigint inside that calculator. Exact display
uses the resolved currency scale. REST create rounds price to currency minor
units before extending quantity; MCP create and invoice PATCH retain their
existing extended-price policy. For USD price 0.005 and quantity 3, create preview
and REST save are 3 minor units, while the MCP/extended preview is 2. No API or
MCP rounding policy was changed to hide this distinction.

InvoiceDrawer resolves customer/organization currency through org-scoped GETs,
then sends the resolved or explicitly selected currency with the exact lines.
The chain matches REST: selected currency, customer, organization, USD. Loading
failures leave totals unresolved and offer explicit selection; aborted/stale
customer results cannot replace a newer context. Invalid/unresolved previews
show an English alert and suppress numeric totals; invalid invoice saving is
disabled and submission reparses the exact lines. Blank prices mean zero and
blank quantity means one; blank descriptions require correction before submit.
Range guards retain the existing safe-numeric workflow limit, including sums,
quantity products and tax. No complete signed-int64 workflow claim is made.

Quantity is still a nonmoney numeric wire control stored in hundredths; its
decimal spelling is parsed without monetary Number conversion. Zero, fractional
and signed quantities follow the existing invoice schema. Deposit percentage,
tax-rate percentage and recoverability labels remain explicit nonmoney
basis-point conversions. Shared inputs keep keyboard decimal mode and line
labels; the grid scrolls horizontally on narrow screens.

The shared editor's omitted currency retains an explicit USD/fixed-two preview,
extended-price rounding and two-fraction input default. This compatibility
presentation serves BillDrawer, QuoteDrawer, SalesReceiptDrawer,
PurchaseOrderDrawer, CreditNoteDrawer, RecurringDrawer and SupplierCreditDrawer.
Their payload parsing, currency resolution, domain rounding and final preview/
saved parity remain pending under MON-132, MON-136 and MON-137 (and the owning
parent integrations). They must pass explicit policy props when migrated; this
child does not qualify them. MON-135 owns saved invoice editing and lifecycle.
MON-131, MON-129 and MON-007 remain open for independent combined acceptance.

`document-editor-money` tests cover currency scales, signed sub-minor ties,
safe-edge low digits, malformed/range/tax rejection, control units and currency
fallback. Rendered shared-editor checks cover exact English output, default
compatibility totals, invalid/unresolved alerts and input labels. Its migrated
SQL fixture uses real authenticated GET/POST and registered MCP SDK transports,
checks each transport's policy, and independently reads stored line totals.
No browser interaction, production IRR or accounting approval is inferred.

## MON-130 evidence composition

Pure tests use real journal/recurring wire adapters to reconcile editor input,
preview, Minor writes and saved aliases across USD/IRR/JPY/KWD and safe low digits.
Rendered React checks verify balanced/invalid/orphan save-button states, exact
English totals, text input and accessible labels. The disposable migrated SQL
fixture sends the same editor payload through authenticated REST and registered
MCP SDK transports, reads/edits it, and independently checks SQL text totals and
retained currency/FX/dimensions. Existing journal integration separately checks
tenant, role, lock, import, posting/reversal, recurrence and scheduling policies.
These are neither live browser interactions nor production/accounting qualification.

## MON-135 saved invoices and settlement UI

`invoice-ui.ts` validates canonical Minor strings against retained safe integer
numeric aliases, with a validated numeric-only fallback for legacy responses.
Raw units never rescale. Invoice list/detail headers and lines, aging buckets,
payment/credit amounts and nullable issue-date lookup base display become bigint
at the fetch boundary. Source/base currencies stay separate and no FX is repeated.
English display preserves safe-edge low digits with currency scales. Aging sums
and paid percentages use bigint; only bounded percentage presentation becomes
Number. Unavailable/mixed-currency summaries show a dash, not a USD money total.
Summary counts fall back to the actual list count. Empty illustrative money cards
also show a dash when there is no currency. Recent payments use their saved
currency. Invoice GET payment history is allocation money without a currency tag;
it explicitly inherits the invoice currency, as required by invoice-reads.ts.

Payment and custom late-fee controls use explicit currency prefixes, scale-aware
text inputs, decimal keyboard mode, accessible labels/invalid status and English
alerts. Invalid/nonpositive/fractional-minor/unsafe amounts disable submission;
handlers reparse and send amountMinor. Blank late fee retains configured interest
calculation. Whole-minor input does not round silently. Credit min/due uses bigint,
requires matching currency and sends amountMinor. Backend roles, locks, recognition,
overpayment and safe-range guards remain authoritative and unchanged.

Make a copy sends explicit saved currency and unitPriceExact reconstructed from
saved raw units. Tax, discounts, account, cost center, project, inventory, warehouse
and price-list dimensions are retained. The same exact copied line payload is
verified through draft REST PATCH and MCP update_invoice. The existing detail
page's Edit sheet edits sender/recipient snapshots only; there was no monetary
line editor to migrate, and no new line-edit workflow is introduced here. The
creation editor remains MON-134. Fractional physical quantity now displays without
integer truncation; quantity /100 and tax/deposit basis-point controls remain
nonmoney. Draft copying uses REST price-first rounding, while PATCH keeps its
existing extended-price policy; stored prices are already rounded minor units.
No hidden source-price precision is inferred from saved prices.

Balance refreshes reload invoice, base amounts, history and credits. Main fetches
are keyed to organization/invoice context and aborted on navigation; stale main
money/credit results cannot populate another context. Invalid detail money shows
an alert and suppresses actions. Failed summary/history/credit reads suppress those
amounts. Other metadata fetches retain existing behavior; no browser race claim.
DualAmount accepts bigint for this slice; numeric callers retain legacy behavior.
SendDocumentDialog gets exact bigint plus explicit invoice currency; other callers
keep their prior fixed-two default pending their owners. CurrencyInput's optional
aria-invalid prop preserves existing input defaults.

Pure adapter and rendered React tests cover scales, safe low digits, malformed
and alias/range rejection, signed display, nullable base display, input labels,
invalid alerts and exact progress/aging. Migrated disposable SQL uses authenticated
REST and registered MCP for saved/list/read, copy, PATCH, cash, credits, summary
and custom late fees; independent SQL text verifies amounts and retained dimensions.
Existing invoice-read/lifecycle/payment-settlement/credit workers cover domain
negative cases. Rendered checks are not browser interactions; no screenshots,
production IRR enablement, full int64 public workflow or accounting review is
claimed. MON-136/MON-137, MON-132/MON-133 and MON-008 consumers remain pending.
MON-131, MON-129 and MON-007 retain independent combined acceptance.
