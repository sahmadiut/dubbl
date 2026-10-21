# Income and executive report catalogs

LOC-104 owns 38 paired `IncomeReports` messages for three report pages.
Catalog validation reports 8,893 compatible leaves per locale. Persian financial
wording is provisional pending native terminology and full RTL qualification.

## Ownership and exceptions

- `reports/profit-and-loss/page.tsx`: title, description, help, PDF action,
  comparison/tracking links, column headings, statistics, sections, empty states,
  totals, profit and safe failure feedback.
- `reports/income-statement/page.tsx`: title, description, help, year accessible
  name, empty state, column headings, sections, complete total labels, profit and
  safe failure feedback. Section React keys remain stable revenue/expenses IDs.
- `reports/executive-summary/page.tsx`: title, description, help, PDF action,
  seven known KPI labels, prior-period sentence, percent pattern, comparison
  suffix and safe failure feedback. Only own known keys enter the finite catalog
  mapping; unknown API-supplied labels remain escaped data, including toString.

All paths above are relative to `app/(dashboard)/`. Account names/codes/IDs,
unknown KPI labels, canonical Gregorian dates/year options, currency codes,
amounts, signs and numerical percent values remain data/formatting exceptions.
The Persian percent message contains punctuation and interpolation only.
Whole messages own both total labels and the prior-period sentence; no translated
sentence is assembled by concatenating translated section labels.

CSV section values `Money in`/`Money out`, column names, filename and canonical
`balanceMinor` strings remain exported contracts. PDF links still use existing
API routes and query names with format=pdf; generated document contents remain
adjacent output scope. Shared navigation, basis toggle, loader, date filters,
DataTable, ErrorState and ExportButton retain their existing catalog ownership.
Existing exact-money formatters, currency scale, dates/year selection, basis,
delta signs, routes, organization headers and validated response readers remain.

Read errors now store a boolean and render one reviewed localized load failure;
network messages, invalid saved-amount diagnostics and arbitrary server prose
are never displayed by these pages. Successful responses retain validated atomic
adoption and cancelled reads cannot write state. The existing missing-active-org
early return/loading behavior is retained; organization selection is shared
application scope. This is catalog extraction, not a new report operation.

## REST/MCP and verification

Existing profit_and_loss, income_statement and executive_summary operations and
exports retain direct organization-scoped services via AuthContext and wrapTool.
No REST/MCP schema, authorization, DB/schema/migration, ledger, monetary/FX,
currency/IRR flag or Stripe implementation changed. Disposable loopback
PostgreSQL fixtures passed real financial-statement and combined report/dashboard
REST/linked MCP/SQL regressions.

Five new production JSX tests use real next-intl/PresentationProvider and real
shared UI, controlling page hooks/IO and animation for static rendering. They
cover both locales, all authored messages, safe caller text, known/unknown KPI
labels, percent/sign patterns, exact low digits across USD/JPY/IRR/KWD, PDF/CSV
contracts, date/year/basis/retry callbacks, loading/empty/error states, HTTP/JSON/
amount/envelope/network failures and ignored obsolete responses.

See [evidence](../evidence/LOC-104-attempt-1.md) and
[Codex self-review](../evidence/LOC-104-review-1.md). LOC-105..114 and independent
LOC-070/008/002 remain open. Native Persian, full RTL/calendar/numerals, mounted
browser/keyboard layout, adjacent output, hosted CI and release/production
qualification are not implied by this bounded child.
