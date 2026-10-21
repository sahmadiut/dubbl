# Analytical and comparison report catalogs

LOC-108 owns 100 paired AnalyticalReports messages across tracking,
budget-vs-actual, expense-analytics, profitability, pnl-comparison and
financial-ratios pages. Titles, help, descriptions, tables, selections, complete
section totals, counts, chart series names, ratio explanations/day units,
empty states and finite failures are localized. The shared BudgetProgressBar's
complete actual/budget amount messages are included because the report renders
that component. Its other consumers inherit the same presentation provider.

Tracking translates only validated Revenue/Expenses section identifiers and the
column with null dimensionValue. Named departments/projects remain escaped
caller text, even if their name matches a built-in English label. Account and
contact names/codes, budget names/IDs, Gregorian date/period/month labels, numeric
percentages, signs, ratio x/percent symbols, chart axis currency/abbreviated k
geometry and dash placeholders are explicit data/formatting exceptions. Date,
calendar, numeral and full RTL qualification remain separate. Persian financial
wording is provisional pending native review.

Localized chart display names never choose a monetary series. The comparison
tooltip selects revenueExact/expensesExact using the canonical dataKey. Expense
tooltips retain the original minorUnits bigint. Approximate chart geometry and
all exact-money readers/aliases, currency scales, rounding, sign/color predicates,
totals and budget fixed cents semantics are preserved.

Routes, query names, mode=pnl, basis=cash/accrual, projectId/costCenterId,
none sentinel, hash account IDs, budget IDs and quarterly/monthly/yearly/period
values remain unchanged. Tracking spreadsheet links and server export contents
retain existing contracts. Shared back/date/basis/currency/select/loader/table/
error controls retain their catalog ownership. Failed requests render a finite
translated message; cancellation and missing-organization guards are retained.

Existing tracking_category_report/export_tracking_category_report,
budget_vs_actual/list_budgets, expense_analytics, contact_profitability,
pnl_comparison and financial_ratios MCP tools retain scoped direct services,
AuthContext, wrapTool and their current authorization. No REST/MCP operation,
schema, migration, money/FX/IRR flag or Stripe implementation is changed.

Production JSX tests exercise real next-intl/PresentationProvider and shared UI
with controlled page hooks/IO/animation. Portal options and chart callback props
are inspected directly; they are not represented as visible SSR or mounted
browser coverage. See [evidence](../evidence/LOC-108-attempt-1.md).
LOC-070/008/002 retain independent combined acceptance, alongside native/RTL,
adjacent output and release qualification. Next bounded slice: LOC-109.
