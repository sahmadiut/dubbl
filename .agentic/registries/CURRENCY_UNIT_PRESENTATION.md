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

## LOC-133 dashboard report fix

The owner reported that the Persian dashboard still displayed IRR. Its overview
and cash-flow widget used shared formatters without explicit presentation, which
retained their default English/ISO behavior. The following callers now use the
active PresentationProvider language/numerals:

- `app/(dashboard)/dashboard/page.tsx`: revenue/expense/net-income and aging
  cards; income/expense breakdowns; receivable/payable buckets; budget and action
  alerts; recent journal amount column.
- `components/dashboard/cash-flow-widget.tsx`: inflow/outflow/net summaries,
  exact original-integer tooltip, approximate compact chart-axis currency part.
- `lib/money/core-presentation.ts`: optional explicit presentation for grouped
  debit display; existing callers retain English default and unlike units remain
  separate. No grouping, validation or numeric contract changed.

Budget alert values retain fixed-two `budgetDecimal` semantics, including IRR;
ordinary currency-minor displays keep their explicit metadata scale. Chart
coordinates/ticks remain approximate geometry; exact totals/tooltips never
round-trip through chart numbers. Canonical `IRR` selector values, requests,
organization headers, REST/MCP/storage and saved data remain unchanged. No new
business operation/tool, schema or migration is introduced. Stripe is untouched.

`tests/dashboard-overview-catalogs.test.ts` exercises literal Persian ریال on
the real dashboard/forecast JSX, exact signed/large values, grouped amounts,
fixed-two budgets, axis/tooltip and ISO callbacks/queries. Existing composed
dashboard/activity/forecast coverage stays in
`tests/dashboard-document-catalog-integration.test.ts`.

LOC-133 is an owner-prioritized LOC-132 child. Inspection proved no dependency on
LOC-131's domain-page adoption; completed LOC-129/130 supply its shared helpers.
LOC-132 retains LOC-131 and LOC-133 dependencies and its independent remaining
scope/acceptance. LOC-115 also remains open. The external USD name edit was
preserved and externally committed separately before this task's commit. An
existing port-3000 server was observed, but browser
inventory was empty and IAB returned unavailable; no mounted-browser pass is
claimed. Native terminology, RTL, broader page adoption and IRR financial
qualification remain separate.


## LOC-131 inventory, projects, CRM, budgets and payroll

All ordinary currency displays found in these assigned families now receive active
PresentationProvider locale/numerals. Shared payroll/project/budget display helpers
accept explicit presentation and retain English defaults for unadopted callers.
Fixed-two cents are converted to canonical exact decimals before formatting; IRR,
JPY and KWD labels never reinterpret those saved units. Signed subunits, bigint
aggregates and low digits remain exact. Payroll grouped displays still separate
unlike currencies before applying the existing exact rounding policy.

Adopted files (actual caller inventory):

- `app/(dashboard)/accounting/budgets/[id]/layout.tsx`
- `app/(dashboard)/accounting/budgets/[id]/page.tsx`
- `app/(dashboard)/accounting/budgets/[id]/settings/page.tsx`
- `app/(dashboard)/accounting/budgets/page.tsx`
- `app/(dashboard)/crm/analytics/page.tsx`
- `app/(dashboard)/crm/deals/[id]/activity/page.tsx`
- `app/(dashboard)/crm/deals/[id]/layout.tsx`
- `app/(dashboard)/crm/deals/[id]/page.tsx`
- `app/(dashboard)/crm/deals/[id]/settings/page.tsx`
- `app/(dashboard)/crm/page.tsx`
- `app/(dashboard)/inventory/[id]/layout.tsx`
- `app/(dashboard)/inventory/[id]/page.tsx`
- `app/(dashboard)/inventory/[id]/suppliers/page.tsx`
- `app/(dashboard)/inventory/[id]/variants/page.tsx`
- `app/(dashboard)/inventory/bom/[id]/page.tsx`
- `app/(dashboard)/inventory/bom/page.tsx`
- `app/(dashboard)/inventory/page.tsx`
- `app/(dashboard)/inventory/valuation/page.tsx`
- `app/(dashboard)/inventory/warehouses/page.tsx`
- `app/(dashboard)/payroll/analytics/page.tsx`
- `app/(dashboard)/payroll/compensation/page.tsx`
- `app/(dashboard)/payroll/compensation/reviews/[id]/page.tsx`
- `app/(dashboard)/payroll/contractors/[id]/page.tsx`
- `app/(dashboard)/payroll/contractors/page.tsx`
- `app/(dashboard)/payroll/employees/[id]/page.tsx`
- `app/(dashboard)/payroll/employees/page.tsx`
- `app/(dashboard)/payroll/forecasting/page.tsx`
- `app/(dashboard)/payroll/page.tsx`
- `app/(dashboard)/payroll/reports/[type]/page.tsx`
- `app/(dashboard)/payroll/reports/page.tsx`
- `app/(dashboard)/payroll/runs/[id]/page.tsx`
- `app/(dashboard)/payroll/runs/[id]/payslips/page.tsx`
- `app/(dashboard)/payroll/runs/off-cycle-dialog.tsx`
- `app/(dashboard)/payroll/runs/page.tsx`
- `app/(dashboard)/payroll/self-service/page.tsx`
- `app/(dashboard)/payroll/settings/page.tsx`
- `app/(dashboard)/payroll/tax-forms/[id]/page.tsx`
- `app/(dashboard)/payroll/tax-forms/page.tsx`
- `app/(dashboard)/payroll/tax-liabilities/page.tsx`
- `app/(dashboard)/projects/[id]/layout.tsx`
- `app/(dashboard)/projects/[id]/members/page.tsx`
- `app/(dashboard)/projects/[id]/milestones/page.tsx`
- `app/(dashboard)/projects/[id]/page.tsx`
- `app/(dashboard)/projects/[id]/settings/page.tsx`
- `app/(dashboard)/projects/[id]/time/page.tsx`
- `app/(dashboard)/projects/page.tsx`
- `components/dashboard/create-drawer.tsx`
- `lib/money/payroll-display.ts`
- `lib/money/payroll-ui.ts`
- `lib/money/project-display.ts`

Inventory covers list/detail/workspace prices, suppliers/variants, valuation/BOM
costs and empty-state samples, including the warehouse sample. Its historical
USD master/catalog fields retain their units; org/report currency metadata is
used only where already explicit. Valuation keeps its prior ungrouped ISO-style
English display, localizing its unit and digits only for the active presentation.
Projects cover list columns, detail/layout, hourly rates/time, billing/milestones,
members/settings and shared creation inputs. CRM covers pipeline, statistics and
all deal detail/activity/settings views. Budgets cover list, shell, overview,
settings/drawer summaries, exact chart tooltips and axis units. Payroll covers
overview grouped amounts, employee/contractor lists/details, run/detail/bonuses,
off-cycle choice and amount labels, compensation/reviews, analytics/forecast,
liabilities/reports, settings, self-service and website payslip/tax-form previews.
Visible currency badges and authored USD sample/input prefixes localize; selected
codes, raw identifiers and field values remain canonical.

Explicit exceptions and inspected unchanged surfaces:

- Canonical ISO state/queries, option values, request/response/DB/MCP fields,
  grouping keys and conditional bank/currency eligibility remain machine data.
  No API operation/schema/migration or MCP registration changed; existing MCP
  tools continue returning canonical amounts/codes for these same operations.
- Payroll/projects/budgets remain fixed-two cents, including IRR. Existing
  inventory catalog/master default-USD and BOM/report metadata scales are not
  migrated or rescaled. Number-only rates/percentages/hours/quantity text remain
  under their existing numeric contracts.
- Inventory CSV/JSON download columns, barcode print output, payroll JSON/CSV/PDF
  downloads, statutory tax identifiers and issued document snapshots remain
  existing output contracts. Website previews localize; output-client/server
  formatters were not changed. Export data continues carrying ISO codes.
- Inventory movements/counts/alerts/assembly/category/transfer/stock-take pages
  without ordinary unit displays, project task/note/context surfaces and payroll
  leave/timesheet/time-only surfaces were inspected and require no label edit.
  The inventory item picker has no ordinary monetary unit display.
- Public/report/settings remainder stays LOC-132; parent whole-website audit
  LOC-115 remains independent. Dashboard was separately done in LOC-133.
- Stripe functionality/files remain untouched under DEC-008. No IRR financial
  gate or ledger qualification was enabled.

Actual provider/next-intl component tests assert literal Persian ریال in CRM
analytics plus canonical IRR org-scoped queries, signed fixed-two compensation,
project detail, inventory valuation and budget cards/axis/exact tooltip. Shared
helper tests cover both locales and numeral systems, zero/signed subunits and
large exact low digits. Existing callbacks still prove canonical cents/ISO/date
payloads. Persian terminology beyond owner-specified IRR remains provisional;
no native linguistic, mounted browser/RTL or production financial acceptance is
claimed. No server/build/database operation was run.

## LOC-134 CI regression reconciliation

The previous-push CI audit found two missed callers in the otherwise adopted
`app/(dashboard)/accounting/page.tsx`: the journal table amount and posted-total
card still used the grouped debit formatter's default English presentation.
Both now receive the active presentation. The actual-page regression asserts
literal Persian `ریال` in both locations, exact IRR `۱٬۲۵۰`, and unchanged
canonical `IRR`/`1250` groups. English behavior and currency separation remain.

CI fixtures now distinguish localized visible units/numerals from canonical
inputs, quantities, identifiers and outputs. Landed-cost displays retain their
documented ASCII decimal body while localizing only the unit. The whole-catalog
inventory includes the 115 previously added account/onboarding/loan leaves and
continues executing every production key. This repair does not accept LOC-132
or parent LOC-115 and does not claim hosted/build/native/RTL/browser completion.


## LOC-132 reports, tax, public and remaining website adoption

Assigned ordinary report, tax/FX, public/portal, onboarding and generic landing
money labels use active presentation. Report totals, rows, nested sections,
grouped summaries, accessible settlement labels and chart units pass the owning
provider explicitly. Budget progress retains fixed-two units, including IRR.

`statementMoneyText` accepts optional presentation after the existing checked
amount/currency validation. Only website/signing-summary callers opt in. Default
document HTML/PDF, email, digest and worker output remains unchanged, as tested
with interleaved USD/JPY/KWD/IRR fixtures. The signing service envelope, existing
`totalFormatted`, issued snapshots and saved values are unchanged; its page
formats the existing validated saved amount for the viewer.

Onboarding country/review unit labels localize while org creation JSON, country
codes, legal names and defaults stay canonical. FX cards show localized names
and preserve differing saved reference names separately; search accepts both,
ISO codes and symbols. Technical reference codes, pair keys, selector/hidden
values, org headers, URLs and raw CSV/XLSX/JSON fields remain unchanged. Unknown
caller text stays escaped and translated labels never flow back into writes.

`authoredUsdText` applies only to known authored USD illustrations, never to
user/saved text with ambiguous dollar symbols. Generic hero, dashboard/report
illustrations and marquee samples change unit markers while preserving numeric
bodies, signs, percentages, abbreviated suffixes, SVG geometry, dates and IDs.

Adopted source inventory:

- `app/(dashboard)/reports/1099/page.tsx`
- `app/(dashboard)/reports/aged-payables/page.tsx`
- `app/(dashboard)/reports/aged-receivables/page.tsx`
- `app/(dashboard)/reports/balance-sheet/page.tsx`
- `app/(dashboard)/reports/bank-cash-flow/page.tsx`
- `app/(dashboard)/reports/bank-reconciliation-status/page.tsx`
- `app/(dashboard)/reports/budget-vs-actual/page.tsx`
- `app/(dashboard)/reports/cash-flow-forecast/page.tsx`
- `app/(dashboard)/reports/cash-flow/page.tsx`
- `app/(dashboard)/reports/comparative-balance-sheet/page.tsx`
- `app/(dashboard)/reports/consolidation/page.tsx`
- `app/(dashboard)/reports/duplicate-detection/page.tsx`
- `app/(dashboard)/reports/executive-summary/page.tsx`
- `app/(dashboard)/reports/expense-analytics/page.tsx`
- `app/(dashboard)/reports/financial-calendar/page.tsx`
- `app/(dashboard)/reports/financial-ratios/page.tsx`
- `app/(dashboard)/reports/general-ledger/page.tsx`
- `app/(dashboard)/reports/income-statement/page.tsx`
- `app/(dashboard)/reports/payment-performance/page.tsx`
- `app/(dashboard)/reports/pnl-comparison/page.tsx`
- `app/(dashboard)/reports/profit-and-loss/page.tsx`
- `app/(dashboard)/reports/profitability/page.tsx`
- `app/(dashboard)/reports/tax-summary/page.tsx`
- `app/(dashboard)/reports/tracking/page.tsx`
- `app/(dashboard)/reports/trial-balance/page.tsx`
- `app/(dashboard)/reports/vat-return/page.tsx`
- `app/(dashboard)/reports/vendor-spend/page.tsx`
- `app/(dashboard)/tax/bas/page.tsx`
- `app/(dashboard)/tax/currencies/page.tsx`
- `app/(dashboard)/tax/periods/[id]/page.tsx`
- `app/(dashboard)/tax/sales-tax/page.tsx`
- `app/(dashboard)/tax/schedule-c/page.tsx`
- `app/(dashboard)/tax/vat-return/page.tsx`
- `app/portal/[token]/invoices/page.tsx`
- `app/portal/[token]/payments/page.tsx`
- `app/portal/[token]/quotes/page.tsx`
- `app/portal/[token]/statements/page.tsx`
- `app/sign/[token]/page.tsx`
- `components/dashboard/budget-progress-bar.tsx`
- `components/dashboard/tax-settlement-preview.tsx`
- `components/landing/bento-features.tsx`
- `components/landing/dashboard-preview.tsx`
- `components/landing/feature-sections.tsx`
- `components/landing/hero.tsx`
- `components/landing/how-it-works.tsx`
- `components/onboarding/onboarding-wizard.tsx`
- `i18n/currency-labels.ts`
- `lib/reports/statement-money.ts`

Inspected unchanged surfaces and explicit exceptions:

- DEC-008: `components/settings/billing-content.tsx` and
  `app/(landing)/pricing/page.tsx` retain all subscription/seat/storage/annual/
  monthly and checkout-linked prices. Dedicated Stripe source, cards, routes,
  tools and provider behavior are untouched. `app/pay/[token]/page.tsx` is also
  unchanged: it is explicitly Stripe checkout/redirect UI, so its invoice amounts
  retain the frozen provider-page display. The entire mixed Stripe Payout
  `ReconciliationMockup` in `components/landing/bento-features.tsx` is identical
  to HEAD, including its sibling bank/journal samples and their displays.
- General settings currency controls already inherit LOC-129 CurrencySelect.
  Document-template machine tokens and reference/configuration fields retain
  technical values. Tax percentages, statutory boxes/account codes, rate
  direction/precision and reference data are unchanged. Rate/period/navigation
  pages have no extra ordinary money units. Custom/saved/scheduled report config
  and pack controls retain canonical keys, URLs and output contracts.
- Portal overview/layout, auth/invitation/admin/team/help navigation and legal
  pages have no extra ordinary money units. Documentation API/code examples
  retain technical ASCII currency contracts.
- Compact chart numeric bodies retain existing approximate geometry/sample
  policy while visible currency units localize. Exact tooltips/totals retain
  saved bigint values. Bank grand totals keep their exact canonical decimal
  body while unit names localize; aggregates gain no new stored-int64 limit.
- Issued snapshots, sender/recipient data, server document formatting,
  email/PDF/digest/output APIs and machine exports are unchanged. No schema,
  migration, business operation or REST/MCP tool change is introduced. Existing
  MCP currency/Minor fields remain the corresponding canonical machine surface.

LOC-133 independently accepted dashboard/forecast; LOC-130/131 retain their
assigned domains. LOC-132 does not complete LOC-115's independent combined audit.
Native terminology, mounted-browser/layout/focus/hydration, RTL and IRR financial
or production activation remain separate. No build/dev server or application DB
access occurred in this task.
