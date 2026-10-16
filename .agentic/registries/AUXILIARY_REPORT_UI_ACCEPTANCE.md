# MON-162 auxiliary report UI combined acceptance

This is independent integration acceptance after MON-166/167/168. It supersedes
their MON-162-pending notes, while MON-158 and MON-008 retain independent
acceptance. Existing runtime services and browser adapters already compose;
no duplicate operations, migrations or production flags are introduced.

## Complete consumer ownership

All paths below are pages under `app/(dashboard)/reports/`. The linked child
mappings specify each actual REST route, registered direct-DB MCP operation,
validation boundary and export contract.

| Consumers | Contract and implementation ownership |
|---|---|
| general-ledger, cash-flow, aged-receivables, aged-payables | [MON-166 ledger/aging mapping](LEDGER_AGING_UI_CUTOVER.md); `lib/money/ledger-aging-ui.ts` |
| 1099, tax-summary, vat-return, tracking, consolidation, custom, saved | [MON-167 result mapping](REPORT_RESULT_UI_CUTOVER.md); `lib/money/report-result-ui.ts` |
| bank-cash-flow, bank-reconciliation-status, cash-flow-forecast, duplicate-detection, financial-calendar, executive-summary, expense-analytics, financial-ratios, payment-performance, profitability, vendor-spend | [MON-168 analytical mapping](ANALYTICAL_REPORT_UI_CUTOVER.md); `lib/money/analytical-report-ui.ts`, forecast reuses MON-163 contact/dashboard adapter |
| budget-vs-actual | [MON-157 budget mapping](BUDGET_PROJECT_CRM_UI_CUTOVER.md); existing budget-ui required aliases and bigint state, included in combined regression run |
| pack, schedules, reports index | Pack constructs a server XLSX URL, schedules edit configuration/delivery metadata, index lists navigation. No client monetary arithmetic or adopted monetary result. Compound and schedule backend suites retain their separate export/delivery coverage. |
| balance-sheet, comparative-balance-sheet, profit-and-loss, income-statement, trial-balance, pnl-comparison | [MON-161 financial statements](FINANCIAL_STATEMENT_UI_CUTOVER.md), excluded from this task; MON-158 retains combined acceptance with them |

Source inspection accounts for all 32 report pages (including the index).
Every consumed saved money carrier must agree with its required canonical Minor
string and explicit currency before UI state adoption. Derived money uses bigint.
Bad HTTP/JSON, missing or conflicting carriers, unsafe numbers and invalid
currencies expose errors and suppress successful result/export state. Existing
request cleanup/version guards prevent superseded results from replacing current
data. No new feature requires a new tool; existing MCP operations use scoped
shared direct-DB services.

## Independent combined financial assertions

`tests/integration/auxiliary-ui-cutover-acceptance.test.ts` and its worker create
four separate migrated synthetic tenants: USD, JPY, KWD and IRR. Each has shared
3000000001 revenue, 901 expense, signed bank movements and outstanding documents.
No saved currency is relabeled or rescaled. Authenticated REST handlers and
linked SDK registered MCP tools feed the same browser adapters for twelve
operations spanning all three child families.

Independent SQL text verifies literal cash/bank net 2999999100, receivables
3000000001 and payables 901. These reconcile ledger, cash flow, tracking net,
ratio net income, executive net income, expense analytics, vendor spend, aging,
bank cash flow/status and hidden-carrier custom projections. Currency-scale
display and raw-minor CSV retain the final digits. Repeat responses and complete
SQL JSON-text snapshots preserve financial rows and audit history. API-key
last-use bookkeeping is excluded from financial snapshots.

Every combined operation rejects malformed adoption and unauthorized REST/denied
MCP reads. Hostile organization headers do not change scope; foreign bank IDs
fail in both transports. A balanced additional persisted maximum-safe entry
makes five ledger-derived report families reject overflow with REST 422
LEGACY_NUMERIC_RANGE and MCP failure, unchanged SQL history. UI HTTP adoption
also rejects these failures rather than displaying zero or empty success.

The combined regression run additionally exercises the existing ledger UI,
tax, compound, consolidation, custom, bank, KPI, document, operational, forecast,
payment, budget and schedule suites. Those retain tax refunds, historical FX,
consolidation eliminations, saved configurations, paging, concurrency,
permissions, corrupt history, safe limits, and server export checks. Child
completion alone is not evidence of this parent acceptance.

## Preserved units and limits

- Individual numeric/Minor envelopes retain the existing safe-integer range;
  derived UI totals use bigint. Full-int64 business wire support is separate.
- USD 1250 stays 1250 minor units; JPY/IRR display zero decimals and KWD three.
  Synthetic IRR fixtures do not enable production IRR.
- Raw Minor CSV/custom columns stay integer strings with currency. Bank-status
  CSV retains exact major decimals. Consolidation retains backend raw-unit FX
  and pre-elimination entity versus post-elimination total semantics.
- Ledger running balances retain period-only natural signs; additive ledger
  balances include openings. Paging requires the same context and summaries;
  ledger CSV exports loaded rows. Aging/forecast estimates retain server policy.
- Counts, quantity hundredths, dates, offsets, basis points, percentages and
  decimal ratios keep their units. Ratio exact decimal aliases control display.
  Only chart geometry/axes use approximate numbers; tooltips read exact sources.
- No browser/screenshot, physical print/download, hosted CI, native-language or
  accounting review, provider, Docker, deployment or production qualification is
  claimed. DEC-005 permits behavioral/static verification without screenshots.

Manifest and generated MONEY_BOUNDARIES preserve child ownership and this parent
join; [verification matrix](../docs/TEST_MATRIX.md) and
[money README](../../lib/money/README.md) link the combined acceptance.
