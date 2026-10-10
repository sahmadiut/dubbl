# Core UI money ownership (MON-129 children)

Source reviewed 2026-10-11. MONEY_BOUNDARIES.json is the reproducible lexical
inventory; this registry assigns reviewed core consumers to controller tasks.
Lexical absence alone is not proof of money correctness. MON-129 retains all
original combined criteria; MON-007 retains its original integration acceptance.

| Owner | Actual source consumers | Contract |
|---|---|---|
| MON-130 | components/dashboard/entry-form.tsx; create-drawer.tsx EntryDrawer and RecurringJournalDrawer; accounting/page.tsx and accounting/[id]/page.tsx; accounting/recurring-journals/[id]/page.tsx; dashboard/page.tsx recent journal columns | Exact editor cells/previews and Minor writes; saved manual currency-scale display/edit; raw fixed-two REST aliases validated against Minor strings; numeric legacy list totals remain explicitly fixed-two compatibility presentation |
| MON-131 | sales/page.tsx, sales/[id]/page.tsx, sales/quotes, sales/credit-notes, sales/receipts, sales/recurring; their invoice/quote/credit/receipt/customer-credit create-drawer sections; components/dashboard/line-items-editor.tsx receivable consumers | Invoice/quote/credit/receipt currency-scale contracts and explicit recurring exceptions; adopted receivable inventories and REST price Exact/Minor fields |
| MON-132 | purchases/page.tsx, purchases/[id]/page.tsx, purchases/debit-notes, purchases/orders, purchases/requisitions, purchases/goods-receipts, purchases/bills/recurring; corresponding create-drawer sections and line-items-editor payable consumers | Existing payable/procurement fixed-two versus currency scale policies; quantity hundredths and basis-point controls are separate |
| MON-133 | accounting/accounts/[id] page/layout; accounting/opening-balances/page.tsx and OpeningBalanceDrawer; accounting/banking, payments and payment batches; purchases/expenses and expense create/edit/mileage controls; tax/page.tsx, tax/periods/[id], tax/sales-tax and tax settlement controls; remaining core bank/payment/tax/settings/approval consumers | Explicit exact money and source/base-currency presentation; opening balances still require numeric compatibility writes until their separate API adoption; no silent unsupported Minor fields |
| MON-008 | Other dashboard financial/report consumers, budgets/assets/loans/projects/payroll/inventory auxiliary surfaces, contacts summaries, jobs, exports, public/provider/PDF consumers | Existing domain adoption does not imply complete consumer closure |

Shared create-drawer.tsx and dashboard/page.tsx are owned by section. MON-130
changes only journal sections/recent journal columns. Opening-balance floats and
document price/expense/budget/payment parsers are pending under the rows above.
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

## Evidence composition

Pure tests use real journal/recurring wire adapters to reconcile editor input,
preview, Minor writes and saved aliases across USD/IRR/JPY/KWD and safe low digits.
Rendered React checks verify balanced/invalid/orphan save-button states, exact
English totals, text input and accessible labels. The disposable migrated SQL
fixture sends the same editor payload through authenticated REST and registered
MCP SDK transports, reads/edits it, and independently checks SQL text totals and
retained currency/FX/dimensions. Existing journal integration separately checks
tenant, role, lock, import, posting/reversal, recurrence and scheduling policies.
These are neither live browser interactions nor production/accounting qualification.
