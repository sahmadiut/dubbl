# Trial balance and general ledger catalogs

LOC-106 owns 39 paired `LedgerReports` messages for two report pages.
Catalog validation reports 8,981 compatible keys per locale. Known account types
reuse `Accounts` through the existing finite `accountTypeLabel` mapping.
Persian financial wording remains provisional pending native terminology and
full RTL qualification. LOC-070/008/002 retain independent combined acceptance.

## Ownership and explicit exceptions

- `app/(dashboard)/reports/trial-balance/page.tsx`: title, description, help,
  date prompt, comparison toggle/placeholder, date sentence, account/table
  headings, debit/credit columns, total and safe read failure.
- `app/(dashboard)/reports/general-ledger/page.tsx`: title, description, help,
  entry headings, complete dimension-filter sentences, clear-filter action,
  empty states, ICU account/entry counts, expand/collapse actions, complete
  amount labels, pagination progress/loading and safe read/pagination failure.

Account names/codes/IDs, descriptions, references and entry numbers remain
escaped caller data. Trial balance unknown account types retain the existing
helper's caller-data fallback; only five known types use catalog labels. Currency
codes, exact amounts, signs, count badges and the reference dash remain data or
formatting. The existing English short month/day formatter for ledger entries
is explicitly retained, as are raw Gregorian comparison date headings. Full
calendar/numeral/date presentation remains separate qualification scope.

Back navigation, loader, date picker/filter, DataTable, ErrorState and ExportButton
retain existing shared catalog ownership. Routes, query/dimension/account keys,
hash anchors, organization headers, date callbacks, pagination limits/offsets
and request cleanup/version guards are unchanged. Existing exact-money readers,
alias checks, natural signs, trial balance splits/comparison totals, running
versus opening-inclusive ledger balances and currency-scale display are retained.

CSV columns, filenames (`account-balances`, `general-ledger`), type values and
exact Minor strings remain machine contracts. No exported text/data is translated.
PDF/XLSX rendering remains adjacent output scope. Existing registered
`trial_balance`, `general_ledger`, `account_transactions` and export tools retain
their direct scoped services, AuthContext and wrapTool behavior. No new operation
or REST/MCP/schema/migration/money/FX/IRR flag/Stripe change is introduced.

Read failures use boolean state with a localized generic message. Raw server,
network and invalid-money diagnostics cannot become user-visible page prose.
Invalid responses still fail before adoption or pagination append. Missing-org
early return, loading behavior and full-page retry remain unchanged.

## Verification and independent handoff

Six production JSX tests use real next-intl/PresentationProvider and shared UI
with controlled page hooks/IO and isolated animation. Both locales cover exact
large/negative/currency-scale amounts, comparison totals, escaping, type labels,
singular/plural counts, filters, loading/empty/error states, date and account
callbacks, CSV/drilldown contracts, malformed reads, validated pagination and
obsolete-request guards. Existing migrated PostgreSQL suites exercise real
REST, registered MCP and SQL assertions. See
[attempt evidence](../evidence/LOC-106-attempt-1.md) and
[honest Codex self-review](../evidence/LOC-106-review-1.md) for actual results.

Native terminology, full RTL/calendar/numerals, mounted browser interaction,
adjacent output, full-suite, hosted-CI, deployment and production acceptance
are not established by these local checks. LOC-107 is the next bounded slice;
LOC-070/008/002 remain open for independent combined acceptance.
