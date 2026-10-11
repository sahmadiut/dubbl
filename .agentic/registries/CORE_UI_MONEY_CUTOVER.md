## MON-150 banking and reconciliation UI

Source verified 2026-10-12. `lib/money/bank-ui.ts` owns validated saved numeric/
Minor bridges, exact decimal bank input, signed balances, grouped currency totals,
full-statement document matching, transfers, category splits and tax previews.

| Consumer | Ownership and policy |
|---|---|
| accounting/banking/page.tsx | Account balance aliases validated before bigint; total/positive/negative balances grouped by currency. Positive/negative balance labels describe balances, not transaction flow. Bars compare only same-currency magnitude; bounded presentation percentages become Numbers after bigint division. |
| banking/[id]/(detail)/layout.tsx and overview/transactions | Bank and movements validated against explicit bank currency; sampled credit/debit totals use bigint. Sorting compares bigint magnitudes. Overview and rows use the adapted context. Errors suppress invalid account/transaction state. |
| banking/[id]/(detail)/imports and ImportSheet | Import history consumes dates/counts/warnings only. Preview balances, rows and duplicates validate numeric/Minor aliases; statement currency must agree with bank. Parser content/profile/format goes unchanged to the existing read-only preview and atomic commit APIs. No parser duplication in UI. |
| banking/[id]/reconcile and ReconciliationReport | Signed bank-scale session input sends startBalanceMinor/endBalanceMinor with safe bounds. Saved sessions/proof groups validate aliases and exact sums; bank statement and GL base currencies display separately. Different units withhold difference and disable statement completion/adjustment. No inferred FX comparison. |
| MatchToBillSheet, MatchToInvoiceSheet and unified MatchSheet | Saved same-currency documents/candidates validated; bigint due/statement limits, decimal prefill, full-statement payment preview and amountMinor writes. Existing payment/journal matches retain ID-only requests. Partial statement matching remains unsupported by the existing backend. |
| CreateExpenseSheet, CategorizeSheet, SplitAccountSheet, bulk coding | Bank-scale amountMinor expense lines must equal the outgoing statement. Positive exact category allocations must sum to its magnitude. Blank unused draft rows are ignored; malformed or incompletely selected rows reject. Inclusive VAT/recoverability preview uses bigint ratios. Coding/bulk controls send IDs, preserving existing atomic/per-item policies. |
| TransferSheet and BankTransferDrawer | Same-currency own-account targets; counterpart rows validate against bank currency and exact opposite amount. Manual transfer preview/save share bankUiAmount and send amountMinor. No cross-currency transfer introduced. |
| BankAccountDrawer and bank settings | Account drawer sets explicit currency/type with zero statement balance by existing API default; no opening GL input exists. Settings metadata writes unchanged; returned bank balances validated before context replacement. Currency/history restrictions remain API-owned. |
| settings/bank-rules | Rules apply across banks: fixed amounts and comparison thresholds intentionally use raw integer bank minor units, not decimal-major input. Saved aliases/conditions are validated, conditions retain canonical text in the editor, existing amountMinor fixed writes remain. Percent/priority/rate/count fields are nonmoney. |

`bank-ui-money.test.ts` covers safe edges, raw USD 1250 compatibility, 0/2/3 scales,
malformed/conflicting/range input, full-line match and same-currency policy,
large exact split/tax/grouped totals, nulls, preview/report/rule validation.
`integration/bank-ui-money.test.ts` exercises real authenticated REST and linked
MCP SDK plus SQL text for imported previews, saved movements, splits, document
payments, transfers through the safe maximum, account reads and session/proof
balances in USD/JPY/synthetic IRR/KWD. Existing bank domain regressions retain
tenant/role/lock/replay/concurrency and negative transport checks.

Compatible numeric saved amounts remain supported only through +/-9007199254740991;
aliases cannot override conflicting Numbers. No full-int64 public expansion,
foreign-currency reconciliation completion, partial statement settlement,
production IRR, migration, locale or browser qualification is claimed. Rates,
percentages, counts and file-size presentation remain nonmoney Number fields.
MON-133, MON-129 and MON-007 retain independent integration acceptance.

## MON-148 payment and allocation UI

Payment list/detail and banking payment batch list/create/detail/remittance plus
scheduled payment list/create/cancel/process use lib/money/payment-ui.ts. The
shared PaymentAmountPreview renders scheduled input validation and exact saved
currency scales. Canonical Minor aliases must agree with safe numeric raw units;
bigint handles allocated/unallocated balances, grouped sample totals/averages,
batch previews and remittance totals. Signed noncash credit/debit/prepayment
carriers retain their raw amounts. Saved batch and remittance totals are checked
against their items/lines and one currency. No stored units are rescaled.

Batch input retains decimal text, requires positive whole minor units, checks
bill identity/supplier/currency/due and a safe batch sum, and sends amountMinor
items with explicit batch currencyCode. One parsed result drives preview and
payload. Mixed currency selections and fractional minor inputs show English
errors and disable save; no FX is inferred. Scheduled input reuses the same
due/range/scale policy and shows its exact preview. Bill pickers include loaded
received/partial/overdue rows, capped at 100. Lists retain their default 50-row
sample; payment totals and legacy signed-tie averages are grouped by currency and
labeled as a sample. Sorting compares currency first, then bigint amounts.
Counts, pages, dates, methods and statuses are nonmoney.

Payments are fully allocated at creation by the existing REST/MCP service.
There is no operation to allocate historical leftover cash. The previous detail
button called invoice pay, which creates another cash payment; it is removed.
Historical leftovers remain visible with an English explanation for review.
This is a documented compatibility limit, not a new reallocation API. Existing
invoice and bill payment controls/shared InvoiceAmountInput remain owned and
verified by MON-135/MON-139; CustomerCreditDrawer belongs to MON-146, receipt
cash to MON-145, expense/mileage payment controls to MON-149, banking settlement
controls to MON-150 and tax/approval controls to MON-151. No standalone payment
create drawer exists. create-drawer.tsx is unchanged in this slice. Public/portal,
contact/report/payroll/loan/background consumers retain their existing MON-008
and domain ownership; this task does not replace those acceptance gates.

Organization/id keys reset scoped page state, reads abort on context/dialog/filter
changes, scheduled list generations reject older replies, and batch confirmation
checks the active organization again. Initial schedule processing is preserved;
filter changes only read the list. Large values wrap and bill selection is a
keyboard-accessible button. Invalid saved money suppresses amounts/actions.

Four pure/static React test groups and sixteen combined real REST/MCP/SQL
workflows cover USD/JPY/synthetic IRR/KWD, 1250 and 3000000001 raw units, exact
preview/saved agreement, cash allocations, batch submission/remittance and due
schedule completion. Existing payment read/settlement/batch/schedule fixtures
retain malformed/range/alias, permission/tenant, currency/FX, period/atomicity and
negative coverage. No new REST/MCP operation, schema/migration, provider action,
production flag or FX policy change. Safe numeric business compatibility remains;
full-int64, live browser, production IRR and accounting/linguistic qualification
are not claimed. MON-133, MON-129 and MON-007 retain independent integration.

## MON-131 combined receivable document UI acceptance

Independent parent acceptance composes MON-134 creation/shared editor, MON-135
saved invoice lifecycle, MON-136 quote/credit/receipt/prepayment and MON-137
recurring invoice consumers. The domain ownership rows below remain authoritative
for every list/detail/drawer/component/adapter; this entry supersedes older
MON-131-pending statements. See MON-131 attempt/review evidence and
`tests/integration/receivable-document-ui*`, jointly run with all seven domain
UI transport fixtures and MON-136's combined receipt/credit workflow.

Twenty-four workflows create invoices directly, convert accepted quotes, or
generate recurring drafts through REST and registered MCP in USD/JPY/synthetic
IRR/KWD. One linked MCP session per organization registers all six tool families.
Exact editor text, saved rounded prices, copy/PATCH, cash settlement, prepayment
and credit application, base display and allocation unwind compose without
rescaling raw units or inferring FX. SQL text independently verifies low digits,
line quantity 300, recognition balance and paid/due/remaining amounts. Invalid
creates, overpayments and excess prepayment applications preserve snapshots;
foreign invoice reads/payments fail. Recurring upcoming dates and advancement
retain schedule semantics. MON-136 separately composes receipt post/void and
grouped mixed-currency saved summaries in the same joint verification.

Rounding remains operation-specific: a half-minor price times three is 3 units
for invoice REST creation, quotes and recurring templates, and 2 units for invoice
MCP creation, credits and receipts. Copy/edit reconstructs the saved 1-unit price,
producing 3 units even when the original line saved 2. Original sub-minor text is
not stored/recovered. Credit creation maps only its supported line fields rather
than forwarding all invoice inventory/project dimensions. Stored units and safe
numeric compatibility with agreeing canonical Minor aliases are unchanged.

Joint behavioral/static React render checks cover currency scales, malformed/range/
alias rejection, quantities, taxes/discounts, summaries and English labels/alerts.
Source review confirms explicit preview policies, submit parsing/gating, context
guards, saved adapters, scrolling and wrapping. Physical quantity hundredths,
basis points, counts/dates, bounded list samples, unavailable mixed summaries and
static USD illustrations retain their documented contracts. Remaining shared
drawer/default consumers belong to their existing owners. MON-129 and MON-007
retain independent acceptance; MON-133 owns remaining cash/tax/account consumers.
No runtime/API/MCP/schema/production flag change or live browser/provider/PDF,
full-int64 business, production IRR or accounting/linguistic qualification claim.

## MON-136 combined receivable UI acceptance

Independent integration of MON-143..146 is verified by
`tests/integration/receivable-ui-integration*`; see
[attempt evidence](../evidence/MON-136-attempt-1.md) and
[self-review](../evidence/MON-136-review-1.md). The scoped consumers remain owned
by the four domain rows below: quote/credit/receipt/prepayment list/detail,
their create-drawer sections, exact adapters, saved detail components and reused
LineItemsEditor/InvoiceAmountInput/SendDocumentDialog presentation.

Eight combined REST/MCP workflows on migrated disposable PostgreSQL cover USD,
JPY, synthetic IRR and KWD: quote price-first preview/conversion, extended-price
credit and receipt previews, credit plus prepayment application to one converted
invoice, low-digit saved/SQL balances, cash recognition, and credit/receipt void.
USD 0.005 x 3 remains 3 minor units on quotes and 2 on credits/receipts. Equivalent
half-minor inputs verify the other currency scales. Original raw 1250 and
3000000001 values retain their units. A credit void restores only its allocation;
the prepayment balance and independent cash receipt remain separate.

One MCP session per organization registers all six relevant direct-DB tool
families. Cross-organization reads fail, invalid writes/applications leave the
four domains and invoice settlement unchanged, and both transports preserve
quote/credit USD defaults versus receipt/prepayment contact/org/USD resolution.
Exact grouped prepayment list summaries agree with SQL text sums after mixed
currency defaults. Eighteen focused adapter/static-render groups independently
retain English labels, scale/precision/range and alias rejection checks.

Compatibility limits remain explicit: public numeric amounts must be safe and
agree with canonical Minor aliases; bigint handles UI arithmetic. Numeric physical
quantities become stored hundredths and tax/discount percentages are basis points.
Sample list summaries and the 100-invoice picker do not promise all-page coverage.
Mixed-currency credit summaries remain unavailable under the existing API contract.
Static USD examples are illustrations. No FX is inferred by the UI; the fixture's
explicit synthetic rate only supplies the default-currency prepayment recognition.

This entry supersedes older MON-136/MON-146/137-pending prose in this registry.
MON-131 retains independent invoice/quote/credit/receipt/prepayment/recurring
combined acceptance; MON-129 and MON-007 remain open. MON-133 owns remaining
opening-balance/payment/expense/banking/tax/shared consumers. No API/MCP/schema
or production flag change; live browser/provider/PDF, full-int64 business use,
production IRR and broader accounting/linguistic qualification remain separate.

## MON-146 customer prepayment UI

CustomerCreditDrawer/CustomerCreditForm and sales/customer-prepayments list/detail
use customer-prepayment-ui.ts and CustomerPrepaymentMoneyDetails. Create resolves
explicit/contact/org/USD currency, shows an exact received preview, and sends
amountMinor with explicit currencyCode. Same-currency paid-in accounts are selected;
failed currency reads require explicit selection. Decimal text is parsed without
money Number conversion; positive whole minor units and safe workflow range are
required. Saved numeric aliases are checked against canonical Minor strings before
bigint display and original-minus-remaining arithmetic. Loaded, server-filtered
sample summaries exclude cancelled credits and group by currency; they are not
all-page or FX-converted totals. Client search preserves the existing sample scope.

Application options adopt amountDueMinor and require the same saved customer and
currency, outstanding status, and positive due. amountMinor writes cannot exceed
either balance. Detail/list/drawer remount by organization (detail also by id and
drawer by open); reads abort or reject obsolete filter generations. Invalid saved
money suppresses amounts/actions with English alerts. Invoice options retain the
existing 100-row selection cap. Existing static USD illustrations, counts, pages,
dates and source/status labels remain; no stored units are rescaled. Shared
InvoiceAmountInput and credit-note eligibility/application adapters are reused.

Four pure/rendered groups and migrated REST/MCP/SQL fixtures cover USD/JPY/IRR/KWD,
low digits, malformed/range/alias rejection, preview/saved agreement, default
currency, recognition journals and one-minor-unit application. Existing credit
contracts verify lifecycle/security/negative cases. These are synthetic accounting
fixtures and static React renders, not live browser or production qualification.
No REST/MCP/schema/IRR flag change. MON-136, MON-131, MON-129 and MON-007 retain
independent combined acceptance; other consumers remain under their current owners.
This completed slice supersedes earlier MON-146-pending prose below.

## MON-137 recurring invoice UI

RecurringDrawer sends explicit currencyCode and unitPriceExact decimal strings;
new templates default to USD as both existing REST/MCP create services do. Contact
and organization currencies do not override that default. Currency selection is
now available; no FX is invented or supplied. Prices allow 18 fractional digits.
The recurring-specific LineItemsEditor preview rounds price to currency minor
units AND quantity to signed int32 hundredths before extension, discount and tax.
USD 0.005 x 3 previews/saves 3 minor units; USD 1 x 1.234 previews/saves 123.
Bigint products/sums retain low digits and reject unsupported safe-number ranges.
Malformed prices/quantities, unavailable tax rates and blank descriptions block
creation. Zero quantity is preserved; blank quantity means one and blank price zero.

Saved detail validates unitPriceMinor against retained safe numeric units and uses
bigint gross products/totals in saved currency. Fractional quantities remain visible.
Upcoming cards adopt lineTotalMinor and currencyCode, explicitly labeled before
discounts and tax, matching the existing gross preview contract. Detail gross totals
have the same label; saved discount basis points are displayed separately. Taxes
are determined at generation using the then-current rate; no tax snapshot or
new final-total claim is attached to templates. List monetary totals remain absent;
summary counts, dates, schedule caps and frequencies are nonmoney. Existing start/
end/frequency/reference/notes/autoSend and pause/resume/delete controls remain.
No line-edit UI exists because PATCH only supports header edits. New editors and
lists remount by org; detail reads abort and use org/id context, upcoming requests
abort with the list read, and paginated responses reject obsolete filter generations.
Invalid read money is suppressed with an English alert. Existing table scrolling
and large amount wrapping preserve readable details.

Four pure/rendered groups plus migrated real REST/MCP/SQL fixtures verify USD,
JPY, synthetic IRR and KWD, signed ties, rounded fractional quantities, safe-edge
low digits, saved reads, default USD, gross upcoming amounts, draft generation and
schedule preservation. Existing recurring contracts cover automation/FX/lifecycle
regressions separately. MON-131, MON-129, MON-007 and MON-008 retain independent
combined acceptance and remaining consumers. No schema/history rescaling or IRR
production enablement; no live browser/provider/accounting qualification claim.

## MON-147 opening balances and MON-133 split

Source verified 2026-10-11. MON-133 now retains independent integration of
MON-147..152: opening balances, payments/allocations, expenses/mileage,
banking/reconciliation, tax/settings/approval, and ledger/shared presentation.
The original MON-133 acceptance and all remaining consumers are preserved.

| Owner | Consumers | Contract |
|---|---|---|
| MON-147 | accounting/opening-balances/page.tsx; create-drawer.tsx OpeningBalanceDrawer; OpeningBalanceForm; OpeningBalanceMoneyDetails; opening-balance-ui.ts | Exact decimal text, bigint preview/validation/saved totals; checked numeric fixed-cents writes only; unsupported Minor writes are not sent |
| MON-148 | sales/payments list/detail; banking/batches list/create/detail/remittance; banking/scheduled list/create/cancel/process; payment-ui.ts; PaymentAmountPreview | Checked Minor aliases, bigint balances/grouped sample summaries, explicit one-currency batch and schedule Minor writes, exact due/range preview/save checks; historical leftover allocation unsupported |
| MON-149 | Expense list/detail/edit/pay amount, ExpenseDrawer/mileage, recurring expense controls; expense-ui.ts, recurring-expense-ui.ts, ExpenseAmountInput | Exact text/Minor writes, bigint previews and validated saved aliases; organization/claim currency, miles hundredths and independently rounded per-mile rate; recurring payable fixed-two gross policy retained |
| MON-150 | Banking/statements/import/reconciliation/transfers/settings/rules, bank drawers | Validated Minor reads, bigint sums/tax/splits and bank-scale exact writes; grouped currency balances and separate bank/base reconciliation; raw bank minor-unit rule exception |
| MON-151 | Tax/period/sales-tax/settlement/settings and remaining core approvals | Pending exact money, basis-point/settings closure |
| MON-152 | Accounts list/detail/layout and untagged journal totals/automated detail | Pending source/base presentation closure |

Opening balance UI uses strict nonnegative major text with two decimal places;
blank cells are zero. Malformed/negative/fractional-cent/orphan amounts and
unsafe per-line or side totals block writes. Bigint equality replaces tolerance;
zero/unbalanced totals cannot submit. The same validated rows drive preview and
numeric payloads. Unused zero rows are omitted, and the endpoint's existing
acceptance of one two-sided row is retained. Every nonnegative side total is
safe so the legacy endpoint's Number sums remain exact for these UI payloads.
Saved numeric reads require safe integers; optional Minor aliases must be
canonical and agree. Display sums are bigint and preserve low digits.

Explicit compatibility exception: actual REST/MCP opening-balance operations
accept numeric cents only and insert default USD journal tags, even for JPY/KWD
organizations/accounts. The UI labels USD/fixed-two and does not infer/rescale
from org/account metadata. This slice does not modernize that backend policy,
add unsupported aliases, change FX, or repair historic entries. A currency-aware
opening-balance API adoption remains prerequisite to removing this exception in
MON-133/MON-129 combined acceptance. Existing endpoint scope/period/atomicity
policies are unchanged and are not qualified by this UI fixture.

Rendered form tests cover submission gating, exact totals, labels and decimal
keyboard input. Real registered MCP and authenticated REST writes/reads plus SQL
cover split 0.10+0.20/0.30, low digits, MAX_SAFE_INTEGER, replacement and USD/JPY/KWD
organization metadata. DEC-005 permits behavioral/layout review without screenshots.
MON-133, MON-129, MON-007 and MON-008 retain separate acceptance.
Shared opening-balance-read.ts flat selects repair the observed REST/MCP nested
FX numeric coercion failure. Existing numeric-cent line outputs remain and add
agreeing debitAmountMinor/creditAmountMinor strings; account reads are scoped to
the organization. No write schema, posting policy or stored history is changed.


# Core UI money ownership (MON-129 children)

## MON-145 sales receipt UI

SalesReceiptDrawer resolves explicit selection, customer, organization, then USD
exactly as both receipt create services do. Currency context is keyed to org and
customer; aborted reads cannot supply an obsolete default. Explicit currency is
sent with unitPriceExact strings and the supported line subset. Extended-price
preview matches salesReceiptTotals: USD 0.005 x 3 previews/saves 2 minor units.
Eighteen fractional price digits, signed ties, blank-to-zero price/blank-to-one
quantity and explicit zero/fractional quantities retain their domain semantics.
Malformed price/quantity, unknown tax, unsafe product/sum, unresolved currency
and missing descriptions disable saving; submit reparses exact lines. Bank
selection remains required in this drawer. Existing creation saves a draft;
posting/void remain the separate REST/MCP domain operations, not implicit cash
recognition. Bank currency, revenue, tax, period/role/tenant/FX and reversal
controls remain authoritative. No new lifecycle/edit/copy UI is introduced.

sales-receipt-ui.ts validates canonical Minor aliases against safe numeric raw
units, with checked numeric-only legacy fallback. Saved headers, line prices,
amounts and taxes become bigint without rescaling. Saved currency drives English
list/detail and subtotal/tax/total display; fractional quantity hundredths retain
fractions. Collected counts paid receipts only, grouped by saved currency from
the loaded matching sample, explicitly labeled in the card. Draft/void receipts
are excluded. Bigint aggregate sums may exceed one document's safe limit; empty
groups show a dash. Main reads abort on context change, lists are context-keyed,
pagination rejects obsolete generations and detail/drawer state remounts by org.
Invalid reads show alerts and suppress invalid money. Search/date/status/sort and
pagination remain; shared table horizontal scrolling/amount wrapping remain.

Five pure/rendered groups and migrated real REST/MCP/SQL fixtures cover USD, JPY,
synthetic IRR, KWD, safe-edge low digits, aliases, defaults, exact rounding, zero/
blank/fractional quantities, tax/cash references, saved reads and post/void. The
existing receipt fixture independently covers domain controls and atomicity.
Quantity /100, numeric physical-unit API quantities, tax basis points and retained
numeric wire coexistence keep units. Static USD empty-state illustrations and
shared defaults for pending editor callers remain explicit. No monetary fixed-two
exception remains in these receipt consumers. No schema/API/MCP/production flag
change. Browser effects, full-int64 posting, provider/PDF, production IRR and
financial/linguistic qualification are not claimed. MON-146/137 remain pending;
MON-136, MON-131, MON-129 and MON-007 retain independent combined acceptance.

## MON-140 debit note UI

DebitNoteDrawer explicitly defaults to USD, matching both debit-note transports
independently of supplier/org currency, and sends selected currency plus decimal
unitPriceExact strings. The shared extended-price calculator matches the debit
wire: USD 0.005 x 3 previews/saves 2 minor units. Up to 18 fractional price digits,
signed ties, safe-number workflow limits and blank-to-zero price/blank-to-one
quantity remain. Explicit zero/fractional quantities survive. Invalid input,
unknown tax, unsafe totals and missing descriptions prevent saving; handlers
reparse exact lines. Org-keyed drawer/editor state keeps supplier and tax context.

debit-note-ui.ts owns strict saved numeric/Minor validation with checked numeric-
only legacy fallback. Bigint drives header, line price/amount/tax, list and sample
overview display. Saved currency drives English presentation, never an inferred
scale or repeated FX conversion. Quantity /100 is physical hundredths. Overview
totals describe the loaded matching sample, exclude void notes and group currencies;
exact aggregate sums may exceed one document's safe-number limit. Empty groups
show a dash. List sort controls only send supported server keys. Aborted reads,
org/filter context and pagination generations suppress obsolete fetched money;
detail/dialog state remounts by org/document. Actions reload validated full reads
instead of merging numeric headers into bigint state. Send receives saved currency.

Applications require a sent note, recognized outstanding received/partial/overdue
bill, same supplier/currency and positive whole-minor amount within both balances.
Pending approval bills are excluded. Currency-scale input rejects malformed,
fractional-minor, unsafe and nonpositive amounts and sends amountMinor. Handler
revalidation and backend recognition/role/lock/FX/allocation/reversal controls remain.
The existing bill endpoint supports no supplier filter: the latest 100 org bills
are filtered locally, and the UI labels this bounded candidate sample. No lookup
completeness is claimed. Opening the dialog discards previous candidates/amount.
Debit void clears remaining/applied balances to zero and unwinds bill allocations.

Five adapter/render groups and an actual migrated REST/MCP/SQL fixture cover scales,
large low digits, exact create/draft update/read/list, malformed/range rejection,
tax/quantity/dimensions, grouped SQL sums and application/void. Existing debit and
bill lifecycle fixtures independently retain domain controls. These pages have no
monetary edit/copy or cash-refund operation; none is invented. Supported exact
draft PATCH/MCP contracts are checked separately. Debit line discounts are not
persisted as a separate column. No monetary fixed-two exception remains here;
shared unmigrated editor defaults, tax basis points and numeric wire coexistence
retain their units. Fixed USD empty-state examples remain illustrative. Browser
effects, outbound email/PDF, production IRR, full-int64 workflows, MON-141/142 and
MON-132/MON-129/MON-007 combined acceptance remain separate.

## MON-144 credit note UI

CreditNoteDrawer explicitly defaults to USD as both credit transports do,
independently of customer/org currency. Selected currency is sent with exact
decimal unitPriceExact strings. Preview uses extended-price rounding, so USD
0.005 x 3 previews/saves 2 minor units; signed ties retain the domain rule.
Eighteen fractional price digits, safe-number workflow limits, blank-to-zero
price/blank-to-one quantity and explicit zero/fractional quantity are retained.
Invalid price/quantity/tax/range suppresses preview/save; submission reparses
supported fields and requires descriptions. Org-keyed editor reloads tax context.

credit-note-ui.ts validates saved header/line/summary numeric aliases against
canonical Minor strings with checked numeric-only legacy fallback. Bigint and
saved currency drive list/detail, subtotal/tax/applied/remaining and send amounts.
Saved quantity hundredths show fractions; units never rescale. Overview retains
the all-status, all-filter summary API contract: mixed currencies/unsafe sums
show Unavailable plus the server error; missing/empty currency shows a dash.
Individual tagged rows remain readable when the aggregate is unavailable.

Invoice applications show only outstanding same-customer/same-currency invoices
from the existing latest-100 lookup, scoped to the customer. Amount input uses
saved currency scales, rejects fractional minor/nonpositive/malformed/unsafe
values and either balance bound, and sends amountMinor. Handlers revalidate.
Domain roles, locks, recognition, allocation and reversal rules stay authoritative.
Main reads abort when context changes; list/filter results and summaries are
keyed to context, and detail/dialog state remounts by org/document. Lifecycle
actions reload normalized full reads, never merge numeric headers into bigint.
Opening the application dialog discards old candidates and amounts. Pagination
continues to append validated rows with context checks; search/sort/dates remain.

Five adapter/rendered tests and a migrated REST/MCP/SQL fixture verify scales,
safe-edge low digits, defaults, exact extended rounding, saved prices/tax/units,
summary aliases, eligible application/bounds and void unwind. Existing credit
regressions independently cover tenant/role/locks, inventory and atomicity.
Large safe draft values are verified without claiming large posting qualification.
Quantity/100 and tax basis points remain nonmoney; fixed USD example cards are
illustrative. There is no monetary credit edit/copy workflow in these pages.
Shared editor defaults for unmigrated callers and numeric wire coexistence remain.
Public/email/PDF delivery, browser effects, full signed-int64 workflows, production
IRR and parent combined acceptance are separate. MON-145 receipts are covered
above; MON-146/137 remain pending;
MON-136, MON-131, MON-129 and MON-007 remain open.

## MON-143 quote UI

QuoteDrawer uses explicit USD by default, matching REST and MCP even when customer
and organization currencies differ. Selection is always sent as currencyCode.
Exact decimal price text (up to 18 fractional digits) is preserved as unitPriceExact;
price-first preview matches quoteTotals in both transports. USD 0.005 x 3 previews
and saves 3 minor units. Signed ties retain the existing backend rule. Unknown tax,
malformed price/quantity and unsafe products/sums suppress totals and saving. Blank
price means zero and blank quantity means one; explicit zero remains zero. Empty
descriptions disable submission and are reparsed before HTTP. Org-keyed editors
reload tax context. No new pricing lookup, edit or FX workflow is introduced.

quote-ui.ts validates safe numeric aliases against canonical Minor strings, with
validated numeric-only legacy fallback. Header, billedTotal and saved line amounts
become bigint without rescaling. Saved currency drives all English totals/prices
and the send dialog. Saved physical quantity hundredths display without integer
truncation. Status summaries cover the displayed page/filter, grouped by currency;
unrepresented statuses show a dash. Aggregate bigint sums may exceed one document's
safe limit while individual workflow amounts retain the safe-number restriction.
Quote list/detail reads abort on context changes and suppress invalid amounts.
Status/send actions reload full money reads rather than merging numeric response
headers into bigint state. Quote conversion sends the existing empty remaining-
billing request; backend permissions, date locks and residual policy are unchanged.

Four adapter/rendered cases and a real REST/MCP/SQL fixture cover scales, low digits,
price-first rounding, malformed/range/alias rejection, tax, quantity, saved reads,
default currency and conversion. Existing quote worker independently covers domain
negative cases and partial/milestone conversion. No live browser/effect, provider,
PDF, production IRR or full signed-int64 workflow qualification is claimed. Credit
UI is now covered by MON-144 above; receipt UI is covered above; prepayment remains
MON-146 and
recurring is covered by MON-137 below.
MON-136, MON-131, MON-129 and MON-007 retain independent combined acceptance.


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
| MON-136 | Integration parent for MON-143..146 quote, credit, receipt and prepayment UI; tests/integration/receivable-ui-integration* | Independent combined REST/MCP/SQL acceptance verified; each domain retains currency, rounding and lifecycle policy; see MON-136 evidence |
| MON-143 | sales/quotes list/detail; create-drawer.tsx QuoteDrawer; quote-money-details.tsx; lib/money/quote-ui.ts | Explicit USD default/selectable currency, price-first exact preview and unitPriceExact payloads, validated saved Minor aliases and currency-grouped sample summaries |
| MON-144 | sales/credit-notes list/detail; create-drawer.tsx CreditNoteDrawer; credit-note-money-details.tsx; lib/money/credit-note-ui.ts | Explicit USD/selectable currency, exact extended-price preview/writes, validated saved Minor/summary reads and same-customer/currency amountMinor invoice application |
| MON-145 | sales/receipts list/detail, SalesReceiptDrawer, sales-receipt-ui.ts and SalesReceiptMoneyDetails | Exact extended-price preview/unitPriceExact writes, selected/contact/org currency, validated saved Minor reads and per-currency paid sample sums; separate post/void domain policy retained |
| MON-146 | sales/customer-prepayments list/detail; CustomerCreditDrawer/CustomerCreditForm; customer-prepayment-ui.ts and CustomerPrepaymentMoneyDetails; reused InvoiceAmountInput/credit-note application adapters | Exact amountMinor create/apply writes, resolved currency, checked saved Minor balances, currency-grouped loaded sample summaries and same-customer/currency invoice application |
| MON-137 | Recurring invoice list/detail, RecurringDrawer; recurring-invoice-ui.ts, RecurringInvoiceMoneyDetails and recurring-specific LineItemsEditor | Exact unitPriceExact writes, explicit USD default/selected currency, stored price/quantity-first preview, validated Minor saved/gross upcoming display and schedule preservation |
| MON-132 | Integration parent for MON-138..142 payable/procurement consumers; tests/integration/payable-ui-integration* | Independent combined REST/MCP/SQL acceptance of ordinary, recurring, receipt-derived and requisition-derived bill reads, supplier-credit copies, allocation and unwind; see MON-132 evidence |
| MON-138 | create-drawer.tsx BillDrawer; line-items-editor.tsx bill policy; lib/money/bill-editor.ts | Exact extended-price preview and unitPriceExact writes; explicit supplier/org/selected currency; reverse-charge amount due; approval/duplicate controls |
| MON-139 | purchases/page.tsx and purchases/[id]/page.tsx; bill-ui.ts and BillCurrencyAmounts; shared InvoiceAmountInput/DualAmount props | Validated saved Minor reads, currency-grouped counts/sample aging, exact source/base/progress, whole-minor payments and supplier-credit price/dimension copies |
| MON-140 | purchases/debit-notes list/detail, DebitNoteDrawer, debit-note-ui.ts, DebitNoteMoneyDetails and DebitNoteOverview; shared LineItemsEditor/InvoiceAmountInput/SendDocumentDialog props | Exact extended-price preview/unitPriceExact writes, validated saved Minor aliases, currency-grouped sample sums and same-supplier/currency amountMinor bill application; no cash-refund operation exists |
| MON-141 | purchases/orders, requisitions, goods-receipts list/detail; PurchaseOrderDrawer; procurement-ui.ts; ProcurementMoneyDetails and RequisitionLineEditor; shared LineItemsEditor PO policy | Exact decimal prices/Minor reads, wire-specific bigint previews, per-line receipt rounding, currency-grouped sample totals, physical quantity/tally/conversion contracts |
| MON-142 | purchases/bills/recurring/page.tsx; recurring-bill-ui.ts; LineItemsEditor recurringBill policy | Exact fixed-two compatibility price inputs in every currency, saved-currency Minor reads/gross display, preview/generated draft agreement and schedule preservation |
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
extended-price rounding and two-fraction input default for compatibility callers.
Current document drawers pass explicit currency and domain policy: MON-138 bills,
MON-140 debit notes, MON-141 purchase orders, MON-145 sales receipts and MON-137
recurring invoices. Supplier credit is the saved bill's debit-note copy action,
owned by MON-139; no separate SupplierCreditDrawer exists in the current source.
MON-142 deliberately selects the recurringBill fixed-two input policy, documented
below. MON-135 owns saved invoice editing and lifecycle. Other parent integrations
retain their own acceptance; these explicit props do not qualify their scope.
QuoteDrawer now passes explicit price-first/currency/precision policy under MON-143.
CreditNoteDrawer passes explicit extended-price/currency/precision policy under MON-144.
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


## MON-138 bill creation

BillDrawer resolves selected/supplier/organization/USD currency exactly as REST
create and always sends the resolved currency. MCP still defaults to USD only
when omitted; explicit UI payloads agree across both transports. Supplier/org
GETs are scoped, abort stale requests and key results to their context. Failures
leave totals unresolved and offer explicit currency selection. Org changes
remount the line editor. Existing saved bill UI is owned by MON-139.

bill-editor.ts parses decimal prices without monetary Number conversion and
uses billWriteLineSchema and billWriteTotals for the actual extended-price
policy, signed rounding, safe-number workflow limits and exact bigint displays.
Unlike invoice REST create, bill REST and MCP both extend the unrounded price:
USD 0.005 x 3 previews/saves 2 minor units. Stored unit price is rounded to 1;
no hidden source-price precision is reconstructed by this child. Reverse-charge
VAT remains in document tax/total but is excluded from Amount due, using the
actual bill calculator. Missing selected rate/kind suppresses totals and saving.
Recoverability labels are nonmoney basis-point controls; physical quantities
remain signed numeric controls stored in hundredths, with supplied zero retained.
Blank price defaults to zero and blank quantity to one. No posted units rescale.

Invalid/unresolved preview disables both create and duplicate-confirm actions;
submission reparses exact line inputs and rejects empty descriptions before HTTP.
Currency/line/supplier changes invalidate preview state and clear stale duplicate
warnings. Duplicate warn confirmation, unoverrideable block, hold and approval
states keep their existing backend policies. Success notices use saved status,
including a held bill saved pending approval. Monetary inputs retain text/decimal
keyboard mode, line labels, 18 fractional price digits and horizontal scrolling.

Pure and rendered React tests cover safe low digits, USD/JPY/IRR/KWD scales,
malformed/range/product/sum/tax failures, currency fallback, signed ties, fractional
and zero quantities, exact English totals and alerts. Migrated disposable SQL
uses authenticated currency GETs and bill POST/read plus registered MCP create;
independent SQL text validates prices, extended amounts, tax and quantity.
Fixtures also assert duplicate warn/block/hold and pending approval controls.
Bill write/read/lifecycle regressions retain tenant/role/lock protections.
No live browser effect coverage, signed-int64 public expansion, IRR enablement,
financial approval or parent completion is claimed. MON-140..142 remain pending;
MON-132, MON-129 and MON-007 retain independent integration acceptance.

## MON-139 saved bill lifecycle

`bill-ui.ts` adopts bill header/line/list/count/base Minor strings with the shared
strict safe numeric alias validator. Legacy-only reads validate raw integer units
without rescaling. Source and issue-date lookup base display remain separate;
missing FX is nullable. Exact English output uses saved USD/JPY/IRR/KWD scales.
Bill due amounts include the backend's reverse-charge exclusion; the UI does not
reconstruct payable from document total. Progress uses a bigint ratio, converting
only its bounded presentation percentage to Number. Quantities remain physical
hundredths and now display fractional quantities without integer truncation.

Counts retain their per-status currency; outstanding/overdue groups combine only
the same currency. Mixed currencies within a status are still rejected by REST
and MCP, so the UI shows unavailable totals and keeps readable per-bill rows.
No exchange rate is inferred. Failed/empty totals display a dash without a USD
zero. Aging is an explicit latest-100-bill sample, grouped by source currency,
with bigint sums and ratio bars. It is not a complete receivables/payables report.
Due-soon cards also use each saved bill currency. Aborted org/filter reads and
pagination generation checks prevent obsolete fetched money from populating a
new request context. Invalid detail money suppresses actions. Mutation success
reloads document/base aliases rather than merging raw numbers into bigint state.

Payment input reuses the exact currency-scale InvoiceAmountInput; invalid,
nonpositive, fractional-minor, unsafe or above-due amounts disable payment and
are rechecked by the handler. Payments send amountMinor; authoritative backend
recognition/role/tenant/period/FX/overpayment rules are unchanged. The existing
supplier-credit action sends unitPriceExact reconstructed from saved raw units
with explicit saved currency, fractional quantity, account, tax, discount and
supported cost center. Debit notes do not accept bill inventory/warehouse/project/
goods-receipt fields; no unsupported fields are sent. Saved debit-note lines do
not persist a discount field, although their existing calculator accepts the
discount and persists the resulting amount. This task does not change that wire.
Saved unit prices are already rounded: an original sub-minor price cannot be
recovered from its stored price; copy uses that saved price under debit-note
extended-price rounding. No preview is invented for the direct credit action.

Actual bill list/detail pages have no monetary draft editor or bill-copy button;
no new public workflow is added. Their existing supplier-credit copy is migrated.
Draft REST PATCH and registered update_bill are independently checked with the
exact supported line subset. Pure adapters, actual React currency/input/base
rendering and migrated REST/MCP/SQL fixtures cover scales, safe low digits,
alias/range/precision errors, copying, tax/discount, payment and missing FX. Existing
domain suites cover controls. No live browser effects, screenshot qualification,
full-int64 workflow, production IRR or financial approval is claimed. MON-140..142
and MON-132/MON-129/MON-007 retain their separate scope and acceptance.

## MON-141 procurement UI

Owner: purchases/orders, purchases/requisitions and purchases/goods-receipts list/detail,
create-drawer.tsx PurchaseOrderDrawer, procurement-ui.ts, ProcurementMoneyDetails,
RequisitionLineEditor and the LineItemsEditor purchaseOrder policy.

Creation explicitly defaults to USD as both procurement transports do, independently
of supplier/org currency. Selected currency is sent with unitPriceExact decimal strings,
up to 18 fractional price digits. Blank prices mean zero, blank quantities one, and
explicit zero/fractional quantities survive. Malformed input, missing descriptions,
unresolved tax, int32 quantity and safe money range failures prevent submission.
Handlers reparse lines; UI PATCH sends only the supported line subset. PO create
calculates exclusive tax; PO draft PATCH and requisitions retain zero-tax/no-discount
policies with tax references. PO editing explicitly labels that policy and seeds saved
rounded prices in saved currency; original subminor price text is not persisted.
USD 0.005 x 3 creates 2 minor units, saving a 1-minor rounded unit price. Receiving
those 3 units uses that saved cost and can value them at 3 minor units. No historical
price is reconstructed. Receipt/bill amounts round each line, then sum; two half-unit
lines at one minor each total 2, never aggregate-round to 1.

Saved numeric/Minor amounts must be safe, canonical and agree; numeric-only fallback
retains raw units. Document header/line sums agree exactly. Currency metadata drives
presentation for USD/JPY/synthetic IRR/KWD, never inferred rescaling. Receipt cost
aliases and physical quantityReceivedExact aliases are checked. Bigint sums/overview
can exceed one document's safe bridge. PO/receipt overview excludes voids and groups
loaded matching records by currency. The counts endpoint rejects mixed currencies
within a status; counts unavailability is stated without suppressing valid list money.
It never supplies mixed currency amounts. Empty groups are dashes. No monetary
fixed-two exception remains in these consumers; USD defaults/static examples,
quantity hundredths, tax basis points and numeric wire coexistence keep their units.

Remaining receipt quantities use quantityExact, preserving physical hundredths.
Saved ordered/received/billed-or-reserved quantities retain fractions. Direct PO bill
conversion reserves billed quantities at draft creation; receipt bill drafts update
billed tallies only at recognition. UI displays saved authoritative tallies; no cash,
posting, FX, reservation or stock policy changes. Receipt billing creates a draft;
recognition remains a separate domain operation. Optional supplier selection on the
requisition create sheet supports later conversion; existing approval/reject/convert,
notes/reference/dates, send/edit/delete and receive controls remain. Requisition
lifecycle DTOs update only status/reason fields instead of overwriting bigint money.

List services support status/page, not search/date/sort. Existing local controls now
inspect and sort loaded samples, labeled explicitly; amount sorting groups currencies
then compares bigint. Pagination remains server-scoped. Org/document keys remount
state, main reads abort, and filter generations suppress obsolete pagination. Pages
parse incoming amounts before enqueueing React state updates; invalid money is
suppressed with English alerts. Requisition sheet renders a stable element to preserve
input focus. Tables scroll horizontally; large amounts wrap. DEC-005 requires no
screenshots; pure adapters and rendered controls/details plus real REST/MCP/SQL
fixtures cover money behavior. Live browser effects, provider/email/PDF, full-int64
posting, production IRR and accounting/linguistic qualification are not claimed.
MON-142 and MON-132/MON-129/MON-007 retain independent acceptance.

## MON-142 recurring bill UI

Owner: MON-142 owns app/(dashboard)/purchases/bills/recurring/page.tsx,
lib/money/recurring-bill-ui.ts and the recurringBill branch of
components/dashboard/line-items-editor.tsx. The actual UI is a list and create
sheet; no recurring bill detail/header-edit/manual-generation screen exists.
Recurring payable REST/MCP services and generation remain the adopted MON-099
contracts. Existing MCP create/list/get/preview/pause/update/run/delete tools
already support this consumer; no transport or schema changes were required.

Creation sends explicit currencyCode (default USD, independently of supplier/org)
and intact unitPriceExact text, up to 18 fractional digits. The compatibility
policy is deliberately fixed two-decimal input for ALL currencies: multiply price
by 100 and round before storing; independently round physical quantity to int32
hundredths before extension. The UI labels that input policy and formats resulting
minor units using the selected currency scale. Price 12.50 becomes 1250 raw units,
displaying USD 12.50, JPY/IRR 1250 or KWD 1.250 before quantity/tax. Never rescale
history or silently reinterpret prices using the selected currency. Bigint wire
calculations preserve signed ties and low digits; USD 0.005 x 3 becomes 3 units.
Tax preview uses current purchase rates; generation uses then-current rates and
creates draft bills. No final future-tax snapshot or FX policy is invented.

Zero quantity remains zero, blank quantity means one, blank price means zero.
Every submitted line requires a description; incomplete lines are not dropped.
Malformed money, missing tax selections, quantity/safe-money/aggregate overflow,
invalid currency, dates and occurrence limits produce English errors. Dates,
frequency, start/end caps, supplier, expense accounts and reference remain.
Closing resets the draft; editor remounts on opening and workspaces on org changes.
List requests abort on cleanup. Saved list unitPriceMinor aliases must be canonical
and agree with safe numeric raw units before bigint gross sums. Each row shows its
currency and gross amount, explicitly before discount/tax; currencies are never
summed. Corrupt money suppresses the loaded rows with an alert. Scrollable tables,
decimal keyboard input, quantity/price labels and wide sheet preserve readability.

Five behavioral/React render groups and migrated real REST/MCP/SQL fixtures cover
USD, JPY, synthetic IRR, KWD, safe-edge digits, malformed/compatibility/alias cases,
preview/list/saved/generation agreement, pause/resume, two dates, inclusive end/cap
completion and no duplicate generation. Existing payable and recurring-invoice UI
fixtures cover shared-editor regressions. MON-132/MON-129/MON-007 combined
acceptance remains separate. No production IRR/full-int64/browser/accounting
qualification, historical rescaling, build, dev server or deployment is claimed.

## MON-132 combined payable/procurement UI acceptance

Current 2026-10-11 parent review supersedes earlier child-era statements that
MON-132 is pending. Consumer ownership remains MON-138..142 in the table above;
the parent independently verifies their composition rather than inferring
completion from child status. Evidence: MON-132-attempt-1.md and self-review.

The combined payable-ui-integration fixture uses actual UI payload/adoption
helpers, authenticated REST handlers, linked registered MCP tools and SQL-text
assertions in a disposable migrated database. Both transports exercise ordinary
bill creation, PO receipt conversion, requisition-to-PO direct conversion and
recurring generation through saved bill reads, supplier-credit copying,
recognition, whole-minor application and void unwind in USD/JPY/IRR/KWD. Physical
1.25 and 0.5 quantities remain hundredths; two half-unit receipt lines round
independently to 2 raw units. Recognition updates PO billed tallies. Draft creation
and recurring occurrence completion remain separate from bill recognition.

Supplier credit copies the saved rounded price, as MON-139 documents. The USD
extended-price input 0.005 x 3 saves a 2-unit bill with 1-unit stored price;
copying that stored 0.01 price produces a 3-unit debit note. Both transports
verify allocation stops at the 2-unit bill, retains 1 credit unit, and void
restores the bill balance. Original sub-minor price text is not stored/recovered.

Recurring 12.50 input stores 1250 price units in every currency; the generated
bill and copied debit note retain those units and use saved currency formatting.
No history is rescaled. Ordinary bill/debit/PO inputs retain currency-scale
pricing, with each adopted wire's own rounding/tax policies. Child behavioral
and transport fixtures are rerun jointly for sub-minor/signed ties, low digits,
safe-range rejection, malformed/alias rejection, reverse-charge due amounts,
tax/discount/dimension preservation, payment/base reads, mixed summary rejection,
English labels and schedule controls. Source inspection confirms explicit policy
props and saved adapters at scoped list/detail/editor/drawer consumers.

Explicit exceptions are recurring payable fixed-two PRICE INPUT, retained safe
numeric/Minor wire coexistence, physical quantity /100, tax/discount basis points,
nonmoney percentages/counts and static illustrative USD examples. Aggregates
respect each documented sample/count contract and never invent FX. No remaining
monetary float/fixed-two shortcut is adopted for scoped saved presentation.
MON-129 and MON-007 retain independent combined acceptance; MON-133, auxiliary,
public/PDF/provider and full-int64/production-IRR qualification are separate.
DEC-005 behavioral/layout review applies; live browser effects are not claimed.

## MON-149 expense and mileage UI

Owner: MON-149 owns purchases/expenses list/detail/edit and payment amount display,
create-drawer.tsx ExpenseDrawer/mileage, purchases/expenses/recurring controls,
expense-ui.ts, recurring-expense-ui.ts and ExpenseAmountInput. Existing expense
CRUD/lifecycle (MON-060/061), organization settings (MON-125), and recurring
payable services/generation (MON-099) retain their ownership. Registered MCP
operations already accept these inputs and return matching aliases; no API,
MCP, schema, migration or production currency flag change is required.

Ordinary amounts and reimbursement rates are exact decimal major text using
the claim currency. Creation loads organization currency and saved mileage rate,
validates the rate's numeric/Minor agreement, and explicitly sends that currency.
There is no guessed USD while loading or on failure. Organization raw 67 units
is USD 0.67, JPY/IRR 67 or KWD 0.067 per mile. The null setting's existing 67-unit
server fallback remains unchanged. Saved currency owns detail/edit/pay display.

Mileage multiplies the original entered distance and rate as exact ratios,
rounding each tax-inclusive item half away from zero to currency minor units.
Distance metadata independently rounds to int32 hundredths of miles; rate
metadata independently rounds to claim-currency minor units per mile. This
preserves the existing calculation order without floats. The saved amount is
authoritative, never recomputed from rounded metadata: USD 0.005 per mile times
3 miles saves 2 units with a 1-unit saved per-mile rate. Ordinary lines send
agreeing amountExact/amountMinor; mileage sends amountMinor, distanceMiles and
mileageRateMinor. Preview and payload share the same calculation. Aggregate
safe-number bounds are checked with bigint. Creation keeps its positive-item
policy, whereas editing and the adopted API allow zero. Malformed/negative,
exponent/partial decimal, unsupported currency, amount/rate/distance/aggregate
overflow and blank submitted fields reject with English errors.

Safe numeric compatibility fields remain in saved UI objects. Every monetary
consumer validates any canonical Minor alias against that number before bigint
arithmetic, exact decimal edit prefill or formatting. Detail validates item/header
totals, nullable mileage aliases and physical metadata. Broken reads expose an
alert and suppress their amounts. Lifecycle success reloads through that same
detail adapter. Edit carries saved line IDs and account/receipt fields; omitted
tax, cost-center and mileage metadata is retained by the service. Saved mileage
distance/rate are shown without changing the amount. Status counts retain their
server contract: one currency per status, cross-status mixed totals show
"Multiple currencies", empty totals show 0 and same-currency sums use bigint.
Organization/id keyed workspaces and opening/closing drawer mounts reset context.

Recurring expenses remain type=expense under the existing recurring payable
contract, with supplier, frequency, dates and occurrence cap preserved. Explicit
currency defaults USD independently of organization/contact. Exact price text
still rounds major x 100 for every currency before storage; the UI states this
exception and formats the resulting gross total with the selected currency.
Expense generation stays gross-only, without tax or discount. All submitted
lines are required; no incomplete line is silently dropped. Ordinary expense
currency-scale inputs do not redefine recurring price semantics. Template create
and two capped occurrences are checked through real REST/MCP and SQL.

Six behavioral/render groups and a new disposable migrated PostgreSQL fixture
cover USD/JPY/synthetic IRR/KWD, low digits, subminor ties, aliases, invalid/range
cases, preview/save/edit/read/count agreement and recurrence. Expense CRUD,
lifecycle and recurring bill UI fixtures are jointly rerun. Existing scrollable
detail table and responsive sheets are retained; monetary inputs have decimal
keyboard modes and English accessible names. DEC-005 permits this source/render
layout review; live browser effects are not claimed. Physical hundredths,
tax-rate basis points and recurrence counts are explicit nonmoney exceptions.
Receipt provider, organization setting editor, localization, full-int64 business
expansion and production IRR qualification remain separate. MON-133/MON-129 and
MON-007 retain independent integration acceptance; no build/dev/deployment occurs.
