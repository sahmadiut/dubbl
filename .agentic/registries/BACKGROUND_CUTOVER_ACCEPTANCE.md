# MON-159 background consumer integration acceptance

2026-10-15, Asia/Tehran. This parent independently composes MON-164 and MON-165.
It supersedes their MON-159-pending notes; MON-008 remains independently open.
Runtime services already share the adopted domain contracts. No duplicate writer,
new tool, schema/migration, history rescaling or production flag is required.

## Complete scoped ownership

| Actual consumer | Exact contract and retained exception | Verification |
|---|---|---|
| trigger/scheduled.ts bookkeepingTask -> processBookkeepingMaintenance -> depreciation, loan payments, revenue recognition | [Bookkeeping mapping](BACKGROUND_BOOKKEEPING_CUTOVER.md); shared asset/loan/revenue services validate saved history, scope, periods, target replay and audit. Fixed legacy cents remain cents in USD/JPY/KWD/synthetic IRR; no inferred currency-scale rescaling. Bigint intermediates and final remainders preserve low digits. | background-cutover-acceptance, background-bookkeeping, asset-depreciation, loans, revenue-schedules, asset-loan-integration |
| Same bookkeeping orchestrator -> autoReconcileBankTransactions, checkBudgetVariances, checkLowBankBalances | [Bank rules](BANK_RULE_WIRE_CONTRACTS.md), [budget alerts](BUDGET_ALERT_WIRE_CONTRACTS.md), [bank accounts](BANK_ACCOUNT_WIRE_CONTRACTS.md). Reconciliation links existing exact cash rather than creating another payment. Budget aggregates use bigint; cached bank balance/threshold read SQL text across int64 and format saved currency. Recipient/account/day in-app deduplication is atomic. | bank-rules, budget-alerts, bank-accounts; parent fixture verifies nonempty low-balance delivery inside actual bookkeeping |
| trigger/auto-reverse.ts -> processAutoReversals | Saved raw balanced GL legs and all FX/dimensions are mirrored, including tagged manual journals; no second conversion. Actual-owner audit, bidirectional links, scope/reversal-date checks and numbering share the transaction. | parent fixture, background-bookkeeping, journal-lifecycle-wire, journal-integration |
| trigger/recurring-journals.ts and invoicingTask -> recurring-generate / recurring invoice/payable services | [Composition mapping](BACKGROUND_COMPOSITION_CUTOVER.md), recurring journal/invoice/payable registries. Stored integer units, separate quantity hundredths/basis points, scoped numbering/creator/period/audit guards, transactional catch-up. Journal template currency tags use saved identity FX. Locked recurring journal dates retain skip-and-advance policy. | parent fixture, recurring-journal-wire, recurring-invoices, recurring-payables |
| trigger/scheduled.ts fxRevaluationTask -> processFxRevaluation -> processFxRevaluationForOrg | Saved recognition/cumulative carrying, exact decimal period-end source/base-scale conversion and bigint grouping. Base GL is never repriced. Atomic paired reversal, replay validation and both-date period guards. | parent fixture and fx-revaluation, with payment-settlements regression |
| Payroll completion, accrual posting, payment schedules | Existing authenticated REST/MCP shared domain services; no autonomous Trigger workers exist. Fixed cents/accrual fixed-two REST major input and document-minor settlement units retain their separate contracts. | payroll-integration, accrual-schedules, scheduled-payments |
| Report schedules | Actual reportSchedulesTask -> processReportSchedules, shared export/preflight. Saved money validates before delivery; schedule locks and exact CSV/XLSX/PDF data. | report-schedules with recorded local SMTP; no external provider |
| Inventory costing | Shared invoice-stock/bill-stock, valuation, FIFO/average/assembly/landed-cost services; no autonomous costing worker. Base carrying minor units, physical quantities separate, bigint rational costs and final residual conservation. | inventory-integration |
| Remaining scheduled/provider/opaque entry points | Digest email, Stripe retry, webhook retry, exchange-rate sync, backups and trash purge retain existing contracts. They introduce no independent bookkeeping arithmetic. [Public/render/export/provider ownership](PUBLIC_RENDER_EXPORT_UI_CUTOVER.md) and MONEY_MANIFEST retain the exact provider/rate/opaque/backup boundaries. No provider invocation is needed for this background integration. | Source composition review; existing public/provider qualification belongs to MON-160 and independent MON-008 acceptance |

## Parent financial assertions

`tests/integration/background-cutover-acceptance*` uses one migrated disposable
tenant and real authenticated REST plus linked registered SDK MCP. Original
EUR 3000000001 at 1.2 recognizes USD 3600000001. Editing the issue reference to
0.9 leaves recognition unchanged; period-end 1.3 posts 300000000 and its exact
mirror. Depreciation is 1000000000 from raw 3000000001 / 3. Recurring JPY-tagged
and manual KWD-tagged journals retain 3000000001; manual saved FX 1.234567 is
not applied again by auto-reversal. Seven journals have unique numbers and
independent SQL-text literal debit totals; every entry balances, and the FX pair
has zero final AR movement. Original recognition/manual legs stay byte-equivalent
as SQL JSON text. Low-bank-balance body retains -30000000.01 and threshold
-30000000.00. Reads preserve REST fixed-two and MCP numeric-minor envelopes.

A shared period lock blocks both child families with unchanged financial
snapshots. Corrupt asset book value and invoice due reject unchanged, then become
retryable after fixture repair. Concurrent bookkeeping/recurrence/revaluation and
subsequent reversal compose on the same organization. Repeating all services and
both transport reads leaves the complete saved financial snapshot unchanged.
Existing joint domain fixtures extend scale, tenant/role, rounding, overflow,
concurrency, later-settlement and injected audit/insert rollback coverage.

## Limits retained

See the child mappings for exact policies. Safe Number final business-posting
values remain required, even when intermediate bigint cancellation is larger.
FX does not reconstruct old outstanding balances after later settlements or
guess missing immutable bill payable/tax history. Incomplete historical pairs and
unqualified metadata reject rather than being repaired automatically. Period
table locks can briefly block configuration across organizations. External email
exactly-once behavior, provider availability and scheduled deployment are not
qualified. Local tests do not prove hosted CI, production IRR, full-int64 posting,
migration, localization, browser/print layout or independent accounting approval.

The current [money manifest](MONEY_MANIFEST.md) and source-hash inventory
[MONEY_BOUNDARIES](MONEY_BOUNDARIES.json) retain all scoped ownership. Existing
background bookkeeping/composition source guards prevent duplicate float writers
and protect actual Trigger delegation. MON-008 retains final auxiliary/public
integration acceptance; this document does not change its criteria or status.
