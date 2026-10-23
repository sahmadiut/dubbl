# Banking report catalogs - LOC-111

The bank-cash-flow and bank-reconciliation-status report pages own 34 paired
BankingReports messages: titles, descriptions, help, filters, grouping labels,
cards, table headings, empty/error states, gap/review counts and status notes.
Count phrases use ICU. Native Persian terminology review remains outstanding.

## Explicit exceptions and preserved contracts

- Account names and period labels are caller/report data, escaped by React.
- Account IDs, group values day/week/month, query/header keys, organization
  storage key, REST paths and banking/reconcile navigation remain canonical.
- CSV filenames, column keys and exact values remain machine contracts. Cash
  flow exports bigint minor units; status exports exact major decimal strings
  using each account's currency scale. No localized CSV headers are introduced.
- Gregorian/UTC dates, ISO currency codes, em-dash missing-value markers and
  existing exact money/count presentation remain. Full calendar/numeral/RTL
  qualification belongs to later tasks. Currency totals stay separate.
- BackToReports/ReportHelp, BrandLoader, DateRangeFilter and ExportButton use
  their existing shared catalogs; this slice adds no shared component changes.
- bank_cash_flow, bank_reconciliation_status and list_bank_accounts already
  cover these operations. REST/MCP/auth/database contracts are unchanged.

Finite localized failures replace raw network/server/validation diagnostics.
Existing account-picker failure behavior and absent-organization loading behavior
remain. No Stripe, IRR flags, schema or migrations changed.

LOC-070/008/002 retain independent acceptance. Catalog parity does not establish
native linguistic, complete RTL, browser, output, hosted CI or release approval.
See [evidence](../evidence/LOC-111-attempt-1.md).
