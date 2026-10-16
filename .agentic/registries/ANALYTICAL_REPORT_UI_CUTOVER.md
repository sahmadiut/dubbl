# MON-168 analytical and bank report UI money

Eleven report result pages adopt saved numeric/Minor pairs before state changes.
`lib/money/analytical-report-ui.ts` validates required money fields, supported
explicit currencies and report identities. Forecast reuses the MON-163
`cashForecastUi` validator. All money state and derived sums use bigint.
MON-162, MON-158 and MON-008 retain independent combined acceptance.

Paths below are under `app/(dashboard)/reports/`; each row refers to `page.tsx`.

| Page | Existing REST report / registered MCP operation | Validation and presentation |
|---|---|---|
| bank-cash-flow | bank-cash-flow / bank_cash_flow; bank-analytics.ts | Required inflow/outflow/net/running aliases and exact period/report identities. Outflows retain their signed source, with exact absolute display. CSV contains raw minor integers and currency. Account picker checks its HTTP/JSON shape. |
| bank-reconciliation-status | bank-reconciliation-status / bank_reconciliation_status; bank-analytics.ts | Account balance/discrepancy, review total and all aging bucket aliases; bucket count/amount identities. Totals group by currency using bigint, including values above Number safe range. CSV preserves exact major decimals and currency. |
| cash-flow-forecast | cash-flow-forecast / cash_flow_forecast; forecast-fx.ts | Shared forecast aliases, nonnegative directional flows, week order, net/cumulative/report identities. Approximate chart geometry uses exact source integers for tooltip/table values. |
| duplicate-detection | duplicate-detection / duplicate_detection; operational.ts | Each group retains its own currency and exact amount; group/item counts are checked. No aggregation across currencies. |
| financial-calendar | financial-calendar / financial_calendar; operational.ts | Every invoice, bill, recurring estimate and budget event requires its own exact amount and currency. No aggregate or implicit FX. |
| executive-summary | executive-summary / executive_summary; kpi-analytics.ts | Current/prior/delta aliases and exact signed differences; saved books currency. Server PDF export continues using its existing exact statement contract. |
| expense-analytics | expense-analytics / expense_analytics; kpi-analytics.ts | Category/month totals, report total and monthly average aliases. Category/month sums reconcile to the report; chart coordinates are approximate, tooltips use bigint source totals. |
| financial-ratios | financial-ratios / financial_ratios; compound.ts | All underlying balance aliases use bigint and explicit books currency. RatiosExact decimal strings agree with numeric ratios and control displayed digits; null ratios remain unavailable. |
| payment-performance | payment-performance / payment_performance; payment-performance.ts | Both required collection/payment numeric/Minor pairs validate before display and CSV. Counts/days/on-time percentages remain numeric. CSV preserves explicit Minor strings with currency. |
| profitability | profitability / contact_profitability; kpi-analytics.ts | Required per-contact/report revenue/cost/profit aliases; exact profit identities and contact sums. Saved document currency controls display and filtering. |
| vendor-spend | vendor-spend / vendor_spend; document-analytics.ts | Required vendor spend/average/report aliases and exact vendor sum. Currency filter uses the existing REST/MCP contract; saved currency replaces implicit USD. CSV contains raw minor integers plus currency. |

Services above are under `lib/reports/`. No REST or MCP operation/schema changes
are needed: the existing tools use the same scoped direct-DB services. This task
does not add storage, migrations, FX conversion or amount rescaling.

## Inspected adjacent consumers and unit exceptions

- `pack/page.tsx` only constructs the existing server XLSX download URL; it does
  not adopt or calculate money. `compound.test.ts` continues to verify REST/MCP
  report-pack binary exports, safe spreadsheet precision and currency scales.
- `schedules/page.tsx` edits schedule/report configuration and lists delivery
  metadata; it has no client monetary fields or arithmetic. Its server contracts
  remain owned by MON-112 and existing schedule integration tests.
- `budget-vs-actual/page.tsx` already uses MON-157 `budgetJson`/`budgetMoney`,
  required aliases and bigint state; failures suppress its report. Existing
  budget UI and report integration coverage is retained without duplicate edits.
- Source values remain raw minor integers: USD 1250 is 12.50, JPY/IRR 1250 is
  1250, KWD 1250 is 1.250. Document/recurring projection semantics remain those
  of the existing backend; calendar/forecast estimates do not become postings.
- CSV raw-minor columns retain integer strings; bank-status CSV uses exact major
  decimals. Every monetary CSV includes currency. Counts, dates, quantities,
  percentages, ratios and chart axes keep their documented nonmoney units.
- Chart coordinates alone use Number after exact decimal conversion. Tooltips
  read the original bigint amounts, never the approximate chart coordinates.
- Failed HTTP, malformed JSON, missing/conflicting/unsafe money and unsupported
  currencies fail before state adoption and expose English alerts. Failed reads
  clear result rows; CSV buttons suppress stale data during loading/errors.
  Existing effect cleanup guards superseded requests across all eleven pages.

## Evidence

Eight groups in `tests/analytical-report-ui.test.ts` verify signed low digits,
four currency scales, safe limits, malformed/error rejection, grouped bank sums,
forecast/KPI identities, payment aliases, exact CSV and decimal ratio aliases.
Seven migrated PostgreSQL fixtures consume authenticated REST and linked
registered MCP responses with these adapters. Independent SQL-text checks tie
adopted bank net, expense totals, vendor totals, collected payments, budget events,
forecast safe-max amounts and ratio net income to stored integers.

Inventory ownership maps these eleven pages/shared adapter to MON-168. Eleven
obsolete legacy allowances are removed. See [execution evidence](../evidence/MON-168-attempt-1.md)
and [self-review](../evidence/MON-168-review-1.md). Browser/physical downloads,
hosted CI and production qualification are not claimed.
