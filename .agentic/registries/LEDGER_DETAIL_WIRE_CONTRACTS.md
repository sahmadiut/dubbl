# Ledger detail contracts (MON-108)

Verified 2026-10-07, Asia/Tehran. ADR-006 additive compatibility. Shared direct-DB
service: `lib/reports/ledger-detail.ts`. MON-101/MON-029 retain integration acceptance.

| REST GET boundary | Registered MCP operation | Output |
|---|---|---|
| `/api/v1/reports/general-ledger` | `general_ledger` | Account summaries or paginated single-account lines |
| `/api/v1/reports/account-transactions` | `account_transactions` | Account metadata and all period transactions |
| General ledger `format=pdf|xlsx` | `export_financial_statement`, statement=general_ledger | Complete period lines/subtotals, currency-scaled files |

Every operation requires view:data. API-key organization overrides supplied org
headers; MCP uses AuthContext/wrapTool without HTTP self-calls. Reports use one
repeatable-read read-only snapshot. Auth may update API-key lastUsedAt separately.

## Inputs

- startDate/endDate: inclusive real Gregorian YYYY-MM-DD, years 0001-9999.
  Defaults: January 1 of current UTC year and UTC today. Reversed/empty/invalid
  ranges reject. No money input, FX or basis option is inferred.
- accountId: owned non-deleted account UUID, required for account transactions,
  optional for general ledger. Foreign/missing/deleted accounts return 404.
- General ledger offset: canonical integer 0-2147483647, default zero; nonzero
  requires accountId. limit: integer 1-500, default 50. Summary JSON caps each
  account's lines; single-account JSON skips offset then caps at limit. Totals
  and totalEntries cover the complete period. Account transactions return all lines.
- General ledger costCenterId/projectId: owned UUID or none/null/empty sentinel
  for untagged lines. costCenterId takes precedence. Both supplied inputs need
  valid syntax; only the effective ID is looked up (foreign/missing returns 404).
  The same filter applies to opening history, movement and detail queries.
- REST format: general ledger accepts case-insensitive json/pdf/xlsx, default
  json; accountId mode supports only JSON and rejects exports. Account transactions
  have no format/dimension input. Unknown/duplicate REST parameters, invalid IDs,
  dates, ranges, formats, partial numeric syntax and unsupported bounds return 400.
  MCP schemas/services enforce the same inputs; all fields have descriptions.
- MCP export retains from/to aliases mapped to startDate/endDate, same validation
  and defaults. No new pagination/dimension export inputs are invented.

Posted non-deleted entries joined to owned non-deleted accounts count. Malformed
cross-org account/entry references in either direction are excluded. Inactive
accounts remain reportable. Summary includes accounts with period lines, even
zero-net activity, and excludes empty/opening-only accounts. Single-account and
account-transactions responses include opening-only history. Stable detail order:
date, entryNumber, entry UUID, line UUID; summary order: code, account UUID.

## Outputs, exact aliases and supported range

All JSON money retains numeric integer cents with canonical signed ASCII integer
`Minor` strings agreeing exactly. Exposed money is bounded by +/-9007199254740991,
including displayed source debit/credit, opening, gross period totals and running
balances. SQL numeric sums/windows are read as text and combined as bigint before
projection. Intermediate historical sums may exceed int64 and cancel exactly.
Unsafe exposed values return 422 LEGACY_NUMERIC_RANGE. No full-int64/exact-only
negotiation or rounded-number recovery. Counts/pagination/entryNumber are not money.

| Location | Legacy/additive numeric money | Exact aliases |
|---|---|---|
| Entries/transactions | debit, credit, runningBalance, ledgerBalance | corresponding Minor fields |
| General ledger summary accounts/single-account | totalDebit, totalCredit, balance, openingBalance, closingLedgerBalance | corresponding Minor fields |
| Account transactions top level | totalDebit, totalCredit, closingBalance, openingBalance, closingLedgerBalance | corresponding Minor fields |

Natural sign: asset/expense = debit minus credit; liability/equity/revenue = credit
minus debit. Existing runningBalance starts at zero at period start; balance and
account-transactions closingBalance remain period movement. Additive openingBalance
contains history strictly before startDate. ledgerBalance = openingBalance +
runningBalance; closingLedgerBalance = openingBalance + full period movement.

Existing dates, entryNumber, description and reference remain. General ledger
uses entry descriptions; account transactions prefer line description then entry
description and retain sourceType/sourceId as opaque stored metadata. Both add
scoped entryId/lineId UUIDs; sourceId is not dereferenced. Single-account general
ledger retains entries/offset/limit and adds totals, history/balance fields,
totalEntries, dates and currencyCode. Account transactions retain account
id/name/code/type and transactions. Empty results have zero numeric/string money.

currencyCode is the supported current organization base currency. GL amounts are
already base amounts; original line currency tags do not trigger FX/rescaling.
JSON 1250 remains 1250 for USD/IRR/JPY/KWD. Unsupported base currency returns
422 LEGACY_NUMERIC_RANGE.

## Exports and qualification limits

PDF/XLSX include all period lines regardless of JSON limit. MCP previously
exported all lines; REST previously truncated to JSON limit and now matches MCP.
Rows retain debit minus credit; subtotals retain natural-sign period movement.
Opening history remains explicit in JSON, without changing file subtotals.
Shared renderers retain currency scaling: 1250 = 12.50 USD, 1250 IRR/JPY or 1.250
KWD. PDF formatting is exact; XLSX rejects failed numeric round-trip or Excel
15-digit precision. No additional worksheet/header fields are introduced.

Actual API-key REST/registered MCP SDK fixtures run on disposable migrated
PostgreSQL: aliases, defaults, signs, opening/movement/running balances, stable
pagination, JSON caps/complete exports, dimensions, tenant/auth failures, int64
historical cancellation, unsafe gross/running/source outputs, currency/export
units and unchanged ledger/audit snapshots. Browser/session/OAuth, performance,
independent accounting, full-range migration and production IRR qualification
remain separate. No schema/history rescale or production flag changes.
