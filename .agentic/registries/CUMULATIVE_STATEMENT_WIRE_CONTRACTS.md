# Cumulative financial statement contracts (MON-106)

Verified 2026-10-07, Asia/Tehran. ADR-006 dual compatibility contract; shared
direct-DB service `lib/reports/cumulative-statement.ts`. MON-101 was split by
source inventory into cumulative statements, period statements, ledger detail,
cash flow and compound reports. MON-101 and MON-029 retain original integration
criteria; MON-107..110 retain the other report boundaries.

| REST boundary | MCP operation | Output |
|---|---|---|
| GET `/api/v1/reports/trial-balance` | `trial_balance` | asAt, currencyCode, accounts; comparison dates/columns when requested |
| GET `/api/v1/reports/balance-sheet` | `balance_sheet` | asAt, currencyCode, assets/liabilities/equity sections, including cumulative unclosed earnings; comparison dates/columns when requested |

Both require `view:data` in AuthContext. REST uses actual API-key/session auth;
API-key organization remains authoritative over an x-organization-id header. MCP
uses the same service through wrapTool, not HTTP. Input has no monetary amounts
or FX. Clients read additive aliases without version negotiation; the existing
decimal-string fields retain their names and units.

## Inputs

REST accepts `asAt` (canonical) or matching `asOf` (legacy alias), `compareDate`
(repeatable and/or comma separated, trimmed), and `format=json|pdf|xlsx`
(case-insensitive, default json). Unknown parameters, duplicate scalar parameters,
conflicting aliases, empty/invalid dates or formats reject with 400. MCP accepts
described optional asAt and compareDates fields. Dates must be real Gregorian
YYYY-MM-DD in years 0001-9999, inclusive cutoffs. Default asAt is today in UTC.
At most twelve supplied comparison dates; duplicates and the primary date are
removed with original order retained. Comparisons may be before or after asAt.
No calendar, currency, amount or locale is inferred from date text.

## JSON money

All existing amounts are fixed two-place decimal strings: 1250 cents is `12.50`
for USD/IRR/JPY/KWD, matching the preexisting JSON contract. `currencyCode` describes
the organization's current implicit base-currency context; it does not rescale
money. Journal line debit/credit amounts are already base GL amounts; per-line
currency tags do not trigger FX or separate currency groups. Historical currency
snapshots/remediation, full-int64 client qualification and IRR enablement remain
separate money gates.

| Output location | Legacy fields | Additive exact aliases |
|---|---|---|
| Trial balance accounts[] | debitBalance, creditBalance, balance | debitBalanceMinor, creditBalanceMinor, balanceMinor |
| Trial balance accounts[].balances[] (comparative) | same per-date scalar fields | same per-date Minor aliases |
| Balance sheet section.accounts[] | balance; balances[] (comparative) | balanceMinor; balancesMinor[] |
| Balance sheet section | total; totals[] (comparative) | totalMinor; totalsMinor[] |

Every alias is a canonical signed ASCII integer string in the same integer cents,
bounded by +/-9007199254740991, exactly matching its decimal field. A negative
cent formats `-0.01`. Comparative arrays align to dates=[asAt,...compareDates].
Accounts retain accountId/code/name/type where previously present; balance-sheet
account rows retain their prior field shape. Every organization chart account,
including empty/inactive accounts as before, is included where its statement
type qualifies. Sorting remains account code order. Synthetic current-year-earnings
is appended to equity if nonzero on any requested date, including zero columns
where appropriate. No bigint is passed unprojected to JSON.

## Calculations and scope

Only posted, non-deleted entries through each inclusive date count. Both account
and entry organization predicates apply; a malformed cross-organization line is
excluded regardless of join direction. Asset/expense natural balance is debit
minus credit; liability/equity/revenue natural balance is credit minus debit.
Balance-sheet earnings are cumulative revenue minus expense balances, matching
the existing open/closed-earnings interpretation; equity section totals include
that synthetic account.

The trial balance intentionally preserves the assigned baseline natural-sign
presentation defect: positive natural balances appear in debitBalance for all
account types. It is characterized in fixtures, not qualified as an accounting
trial balance. PAR-008/QA-001 retain its repair and independent financial review.
The existing trial-balance export subtotal sums natural-sign balances; it is
not a debit-minus-credit reconciliation claim.

SQL SUM(bigint) is cast to text before driver conversion. Shared GL exact
functions (`aggregateAsAtExact`, `aggregateByDateRangeExact`,
`aggregateByDimensionExact`) return bigint debit/credit/balance without narrowing
intermediate sums, including sums beyond int64. The legacy-named aggregation
functions return the existing numeric shape after checking all returned monetary
fields. An unsafe gross debit/credit makes that adapter fail even if net balances
cancel. The cumulative report service uses exact functions and narrows only
amounts it exposes, so hidden gross sums/earnings operands can cancel exactly.
Both paths preserve date/basis/type/dimension/empty-account semantics. Cash-basis
bank-account existence checks also require an owned account. Exact functions
accept an optional caller transaction; the statement service reads organization,
all cutoffs and earnings in one repeatable-read read-only transaction.

## Exports

REST retains PDF and XLSX attachment formats/names and comparative columns.
Statement and multi-sheet workbook exports retain their prior currency-based
scale, which differs from legacy fixed-two-place JSON for zero/three-place
currencies. Stored 1250 exports as USD 12.50, IRR/JPY 1250, KWD 1.250; no underlying
stored money is rewritten. This existing distinction is explicit rather than
silently changed during contract adoption.

PDF formats bigint whole/fractional parts separately with existing Intl currency
style; it retains every cent/minor digit, including the safe maximum. XLSX cells
remain numeric/summable and must have no more than 15 significant decimal digits
(excluding trailing zeros) and round-trip to the exact currency decimal with
toFixed(scale). Otherwise export rejects with 422 LEGACY_NUMERIC_RANGE; it does
not silently switch to text or round money. All actual cells/totals are guarded;
formula-triggering account text retains escaping. Trial-balance export subtotal
range is checked only for export, because JSON exposes individual rows, not that
subtotal. Balance-sheet section totals are checked for JSON too.

## Errors and verification

REST invalid API key is 401; missing view:data is 403; missing organization is
404; malformed input is 400. MCP SDK validates published schemas and wrapTool
reports domain validation/permission errors. Unsupported organization currency,
unsafe final account/section/earnings/export totals, legacy GL adapter amounts or
lossy spreadsheet cells return 422 `LEGACY_NUMERIC_RANGE` on REST/MCP. No amount
recovery from rounded Numbers, float ledger math, bigint JSON crash or partial
report response. These reads do not change ledger/chart/audit rows; normal auth
can update API-key lastUsedAt independently.

`cumulative-statement-wire.test.ts` exercises strict dates/query, exact signed
edges, currency-scale display and actual XLSX/workbook/PDF serialization.
`integration/cumulative-statement.test.ts` invokes actual REST handlers with
API keys and registered MCP SDK clients on migrated disposable PostgreSQL.
Fixtures cover empty accounts, all natural signs, inclusive dates, comparisons,
earnings, foreign entry/account references, auth/custom-role negatives, exact
SQL cancellation above safe/int64 limits, safe edges, unsupported outputs and
unchanged ledger/chart/audit snapshots. Shared GL range/dimension/cash/empty paths
and the prior budget-report regression are exercised. No schema/migration or
production flag changed. No builds/dev server/Docker/production database access;
broader accounting, localization/PDF layout, high-volume and combined report
qualification remain their assigned tasks.
