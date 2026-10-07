# Compound financial report contracts (MON-110)

## Boundaries

| REST operation | MCP read | MCP export | Formats |
|---|---|---|---|
| GET /api/v1/reports/tracking-category | tracking_category_report | export_tracking_category_report | REST json (default), pdf, xlsx; MCP export requires pdf/xlsx |
| GET /api/v1/reports/pack | report_pack | export_report_pack | REST xlsx (default), json; MCP export always XLSX |
| GET /api/v1/reports/financial-ratios | financial_ratios | None: JSON only | JSON; no format parameter |

Services in `lib/reports/compound.ts` use organization-scoped direct Drizzle reads
inside one repeatable-read, read-only transaction per request, including currency,
dimension labels, all report periods and outstanding document sums. All operations
require view:data; API keys determine their organization independently of a supplied
x-organization-id. MCP receives AuthContext and uses wrapTool. Existing report
registration is reused; no HTTP self-calls or new schema/migration.

## Inputs

All operations accept optional inclusive Gregorian startDate/endDate, real dates
in years 0001-9999. Defaults: January 1 of the current UTC year and UTC today.
Start must not follow end. Pack and tracking additionally accept basis=accrual
(default) or cash. Tracking accepts dimension=costCenterId (default), projectId,
or the existing project alias, and mode=pnl (default) or balances.
REST format is case-insensitive; enums otherwise require the listed values.
MCP exports use the same schemas, with required lowercase format for tracking.
Pack export needs no format input because its sole format is XLSX.

Unknown/duplicate REST parameters, unknown MCP fields, invalid/empty dates and
unsupported enum/format values fail with 400 or MCP validation errors before
report queries. No amount inputs, currency override, FX, date-calendar inference,
exact-only negotiation or magnitude-dependent type switch.

## Money and export units

Every JSON money value remains numeric integer cents, independent of the saved
organization currency or individual journal-line currency tags. Currency metadata
does not rescale stored values. Each scalar money field gains `<field>Minor` as
a canonical signed integer string. Monetary arrays gain aligned `<field>Minor`
arrays of strings, including empty arrays. Zero and negative values retain signs
and positions. Each exposed numeric amount and alias must fit
+/-9007199254740991; SQL sums use text and all intermediate money uses bigint.
Gross SQL debit/credit sums can exceed int64 when their final balances cancel.

PDF/XLSX consume the same projected calculations. The existing export policy
displays amounts at the organization currency scale: USD 1250 -> 12.50,
IRR/JPY 1250 -> 1250, KWD 1250 -> 1.250. PDF formats integers/fractions exactly.
Excel numeric cells require an exact decimal round-trip and at most 15 significant
digits; unsupported cells fail with 422 LEGACY_NUMERIC_RANGE. Existing formula-text
escaping and workbook names/layouts remain. No file is returned on precision failure.
MCP exports return data (base64), encoding=base64, filename and mimeType.
REST retains period-based download filenames and attachment MIME types.

## Tracking outputs and ownership

Envelope: dimension (normalized costCenterId/projectId), mode, basis, startDate,
endDate, additive currencyCode, columns, sections, and netIncome for pnl.
Columns carry key, label and dimensionValue (owned UUID or null). Real columns
sort by label then ID; the unassigned column (`__none__`, `Unassigned`) is last.
Historical soft-deleted dimension labels are still resolved within the organization.
Malformed references to another tenant's dimension fail with LEGACY_NUMERIC_RANGE
without returning its ID or label.

Section label and accounts retain the prior shape. Accounts carry accountId,
accountCode, accountName, accountType, amounts/amountsMinor aligned to columns,
and total/totalMinor across columns. Sections expose totals/totalsMinor per column
and total/totalMinor overall. pnl netIncome exposes byColumn/byColumnMinor and
total/totalMinor. pnl sections are Revenue and Expenses; balances additionally
returns Assets, Liabilities and Equity, all with natural-sign period movement.
Accounts missing from a column have 0/"0" there. No activity yields empty columns,
rows and aligned totals, with zero global totals. Row, section, per-column net and
global sums are calculated exactly before numeric projection and independently guarded.

## Report pack outputs and corrections

Envelope retains startDate, endDate, basis, currency and statements; currencyCode
is additive. Statements keep title, periodLabel, currency, optional columns,
sections and optional grandTotal/grandTotals. Rows retain code/name/depth/bold and
amount or amounts. All amount, amounts, subtotal, subtotals, grandTotal and
grandTotals fields gain the corresponding scalar/array Minor aliases.
Workbook consumers retain numeric Statement inputs; extra exact aliases are metadata.

1. Balance Sheet: cumulative owned posted balances through endDate; Assets,
   Liabilities, Equity including Current Earnings. Earnings reuse the standalone
   cumulative helper and include all unclosed income, fixing the old pack's
   period-only earnings mismatch. Grand total is liabilities plus equity.
2. Profit and Loss: inclusive period revenue/expense rows and totals, with net
   income as grand total. Uses the standalone exact income-period reader in the
   pack's snapshot. No prior earnings enter its period income.
3. Trial Balance: cumulative nonzero balances for all account types, fixing the
   old pack's asset/liability/equity-only query. Debit-normal asset/expense balances
   split into debit/credit columns; liability/equity/revenue signs are reversed
   before splitting. Totals sum each side exactly. This preserves the pack's
   existing sign rule; standalone trial_balance still has its separately tracked
   PAR-008/QA-001 natural-sign presentation defect. No independent accounting
   approval or resolution of that standalone defect is claimed.
4. Cash Flow Summary: actual opening/closing ledger cash, net change, period net
   income and net non-cash/working-capital movement (net change minus period income).
   Reuses cash-flow's exact asset cash/bank helper, adding the explicit cash subtype
   previously omitted by pack. Opening is before startDate, or zero at 0001-01-01.
   Grand total is closing cash. This summary is actual cash movement rather than
   the standalone cash-flow heuristic's computed activity statement.

Cash basis retains the shared payment/bank_categorization/bank source-or-bank
account heuristic. Each qualifying account and entry is scoped; posted,
non-deleted entries only. No posted history is rewritten.

## Financial ratios and exact decimals

Envelope retains startDate/endDate, ratios and balances; adds currencyCode and
ratiosExact. Balances contain numeric cents and Minor siblings for totalAssets,
currentAssets, totalLiabilities, currentLiabilities, totalEquity, inventory,
totalRevenue, totalExpenses, netIncome, receivablesDue and payablesDue.
GL balances now honor the cumulative endDate cutoff and the shared posted/deleted/
tenant predicates, correcting the former outer-join filter leakage and missing cutoff.
Revenue/expenses reuse the exact period reader. Equity retains chart-account equity,
without adding unclosed earnings; no new classification heuristic is introduced.

Outstanding invoices/bills retain their current snapshot (not a reconstruction at
historical endDate), exclude draft/void/paid and now exclude deleted documents.
Every included document must use the organization currency; foreign/mixed currency
documents fail with LEGACY_NUMERIC_RANGE even if their sums cancel. There is no
implicit FX or filtering that silently omits obligations. Old document amounts
are not rescaled. Parent accounting/historical qualification remains open.

Let A=currentAssets, L=currentLiabilities, I=inventory, TL=totalLiabilities,
E=totalEquity, R=periodRevenue, X=periodExpenses, N=R-X, TA=totalAssets,
AR=receivablesDue, AP=payablesDue, D=max(1, UTC end-start in days).

| Ratio | Formula | Output precision |
|---|---|---|
| currentRatio | A/L | 2 decimal places |
| quickRatio | (A-I)/L | 2 decimal places |
| debtToEquity | TL/E | 2 decimal places |
| grossMargin, netMargin | 100*N/R | 2 percentage places |
| dso | AR/R*D | integer days |
| dpo | AP/X*D | integer days |
| returnOnAssets | 100*N/TA | 2 percentage places |
| returnOnEquity | 100*N/E | 2 percentage places |

Each ratiosExact field is the canonical matching two-place decimal string or
integer day string. These are ratios/percentages/days, not money and not Minor
aliases. Zero denominator yields null in both objects. Rational arithmetic and
rounding are bigint, matching Math.round ties toward positive infinity even with
negative numerators/divisors. The rounded scaled integer must be safe and the
numeric two-place output must round-trip its exact decimal; otherwise 422.
Gross margin intentionally retains the existing net-income heuristic; current
assets/liabilities retain subtype substring classifications, and D excludes the
inclusive-end extra day as before. These are contract fixtures, not accounting
qualification of those heuristics.

## Errors, state and qualification

Authentication/permission failures retain 401/403, missing organization 404.
Unsupported money, ratio precision, organization currency, document currency or
tracking ownership produce 422 LEGACY_NUMERIC_RANGE; MCP returns matching code/status.
No money/report/history/audit writes occur; API-key authentication independently
updates lastUsedAt. Fixtures compare table snapshots across report/input failures.
No bigint leaks, unsafe Number recovery, int64-wide public promise, schema change,
currency migration or production IRR enablement. MON-101/MON-029 retain combined
acceptance; independent accounting, browser/session/OAuth, localization/PDF layout,
historical currency and performance/release qualification remain separate.

Evidence: tests/compound-wire.test.ts and tests/integration/compound.test.ts/worker;
MON-110-attempt-1.md and MON-110-review-1.md.
