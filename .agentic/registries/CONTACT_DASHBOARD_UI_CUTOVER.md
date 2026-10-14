# MON-163 contact, dashboard and shared report display

Saved numeric money must agree with required canonical `*Minor` strings before
adoption. [contact-dashboard-ui.ts](../../lib/money/contact-dashboard-ui.ts)
uses bigint for statement running balances, totals, forecast weeks, currency
groups and display ratios. Failed HTTP/alias validation suppresses financial
rows with an English error. No database schema, stored-unit or API/MCP change.

| Consumer | Source contract and units | Adopted behavior |
|---|---|---|
| [Contact list](../../app/(dashboard)/contacts/page.tsx) | Credit limit and outstanding numeric-minor aliases; backend rejects unlike document/contact currencies | Explicit saved currency, bigint amounts, no silent empty response adoption |
| [Contact layout](../../app/(dashboard)/contacts/[id]/layout.tsx), [details](../../app/(dashboard)/contacts/[id]/page.tsx), [bookkeeping](../../app/(dashboard)/contacts/[id]/bookkeeping/page.tsx) | Nonnegative currency minor credit limit or matching null aliases | Exact currency-scale input round-trip and `creditLimitMinor` write; clearing stays null |
| [Contact activity](../../app/(dashboard)/contacts/[id]/activity/page.tsx) | Each document/payment has its own currency and signed numeric-minor amount | Validates each row; currencies remain separate |
| [Contact statement](../../app/(dashboard)/contacts/[id]/statement/page.tsx) | Signed document-currency movements and opening/closing/debit/credit totals | Checks every running balance and sum; currency selector also reaches print/email inputs; stale requests aborted and invalid output disabled |
| [Dashboard](../../app/(dashboard)/dashboard/page.tsx) | PnL/aging reuse existing statement/aging adapters; trends/alerts use numeric-minor aliases | Exact currency labels, sorting, bar ratios, trend aliases, explicit error state |
| Dashboard budget alerts | [Budget adapter](../../lib/money/budget-ui.ts): signed fixed-two cents independently of ISO currency | Exact 90 percent threshold and bigint percentage; currency-labelled fixed-two display |
| [Cash-flow widget](../../components/dashboard/cash-flow-widget.tsx) | Forecast document currency and numeric-minor totals/weeks | Weekly net/cumulative/total checks, currency selector, exact original tooltip amounts; only chart geometry/axes approximate |
| [Shared statement display/export](../../lib/reports/statement-money.ts) | Numeric safe stored units or checked bigint minor units and explicit report currency | Bigint text display retains all low digits; numeric XLSX retains decimal round-trip and Excel 15-significant-digit rejection |
| [CSV helpers](../../lib/import-export/csv-utils.ts), [Export button](../../components/dashboard/export-button.tsx) | Existing MON-160 literal scalar/bigint Minor text and fixed-two price exception | Existing exact/rejecting behavior reused, no new conversion |
| [Bank report total decimal](../../lib/reports/bank-analytics-display.ts) | Display-only bigint totals with explicit ISO scale | Existing exact bigint scale retained |

Contact tax-rate basis points, file-size units, counts, date controls, dashboard
financial ratios and chart coordinates are nonmonetary. Core journal summary
ownership remains MON-007 and its existing exact currency grouping is unchanged.
Contact credit limits have no automatic conversion when changing the currency.
Forecast line subtotals before tax/discount and supplier-statement sign conventions
remain backend contracts; this customer statement UI validates debit minus credit.

[Behavior tests](../../tests/contact-dashboard-ui.test.ts) cover USD/JPY/KWD/
synthetic IRR, safe-max low digits, signed balances, alias/currency/sum failures,
failed HTTP, exact CSV and XLSX precision rejection. Migrated disposable loopback
[contacts](../../tests/integration/contact-wire.test.ts),
[statements](../../tests/integration/contact-statement.test.ts),
[forecast](../../tests/integration/forecast-fx.test.ts),
[dashboard](../../tests/integration/dashboard-data.test.ts) and
[KPI](../../tests/integration/kpi-analytics.test.ts) workers now adopt the same
adapters through real authenticated REST and linked registered MCP calls.
Independent SQL-text low-digit comparisons and unchanged financial/audit
snapshots cover read behavior. Existing statement/aging/budget UI integration
fixtures verify reused adapters separately.

MON-158, MON-162 and MON-008 retain independent combined acceptance. No live
browser, printer, independent human review, hosted CI, production IRR or
deployment qualification is claimed (DEC-005 permits behavioral/static review).
