# Balance sheet and cash-flow report catalogs

LOC-105 owns 49 paired `BalanceCashReports` messages for three report pages.
Catalog validation reports 8,942 compatible keys per locale.
Persian financial wording remains provisional pending native terminology and
full RTL qualification. LOC-070/008/002 retain independent combined acceptance.

## Ownership and explicit exceptions

- `app/(dashboard)/reports/balance-sheet/page.tsx`: title, description, help,
  PDF action, date prompt and comparison toggle/placeholder, account headings,
  as-of-date sentence, three section headings, complete totals and safe failure.
- `app/(dashboard)/reports/comparative-balance-sheet/page.tsx`: title,
  description, period selector/accessible name and ICU count options, empty
  state, account/change/current headings, three sections, complete totals and
  safe failure. Back navigation reuses `ReportNavigation.backToReports`.
- `app/(dashboard)/reports/cash-flow/page.tsx`: title, description, help,
  account headings, three section/stat headings and explanations, complete
  empty/total sentences, net cash labels and safe failure. React keys use stable
  operating/investing/financing identifiers rather than translated headings.

Account names/codes/IDs remain escaped caller data. Currency codes, amounts,
signs, zero-change dash and canonical Gregorian dates remain data/formatting.
Prior comparative month/year labels still use the existing English UTC date
formatter in `statementComparisonPeriods`; complete calendar/numeral/date
presentation remains later qualification scope. Its authored `Current` label
is translated only at the visible header. The helper output and CSV keys are
unchanged: Assets/Liabilities/Equity section values, section/code/name/currencyCode
columns, Jan 2024Minor/CurrentMinor-style columns, filename and exact Minor
strings retain their existing machine contracts. Whole catalog sentences own
each total and empty state; translated labels are not lowercased/concatenated.

Shared loader, navigation, date pickers/filter, DataTable, ErrorState and
ExportButton retain their existing catalog ownership. PDF links and generated
document contents retain their existing routes and separate output scope.
UTC comparison cutoffs, date callbacks, comparison count values 2/3/4/6,
organization headers, account links and bigint money formatting are preserved.

Read errors now use finite boolean state and localized generic feedback, so
arbitrary network prose and fixed English invalid-money diagnostics do not
appear on these pages. The checked readers still reject incomplete/inconsistent
aliases before atomic state adoption. Cleanup prevents obsolete requests from
writing state. Existing missing-active-org early return/loading behavior remains;
organization selection is shared application scope.

## REST/MCP and verification

This extraction adds no report operation. Existing `balance_sheet`,
`cash_flow_statement` and report export tools retain direct DB/service access
through AuthContext/wrapTool. No REST/MCP schema, service, authorization,
DB/schema/migration, ledger, currency/IRR flag or Stripe source changes.

Five new production JSX tests use real next-intl/PresentationProvider and shared
UI with controlled page hooks/IO and animation. Both locales cover copy, exact
USD/JPY/IRR/KWD values, signed changes, safe caller text, PDF/CSV/account-link
contracts, empty/loading/error states, date/count/toggle/retry callbacks,
HTTP/JSON/envelope/amount/network failures and obsolete-response cleanup.
Existing migrated financial-statement UI, ledger/aging UI and cash-flow suites
exercise actual REST handlers, registered MCP calls and SQL on randomized
disposable loopback PostgreSQL databases.

See [evidence](../evidence/LOC-105-attempt-1.md) and
[Codex self-review](../evidence/LOC-105-review-1.md). LOC-106..114,
LOC-070/008/002, native Persian, full RTL/calendar/numerals, mounted browser,
keyboard/layout, document output, hosted CI and release/production qualification
remain independent. No human approval is implied.
