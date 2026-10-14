# FX revaluation and remaining background composition (MON-165)

2026-10-14, Asia/Tehran. Bounded MON-159 child; MON-159 and MON-008 retain
independent final acceptance. No schema/migration, new public operation, currency
flag, provider action or history rescaling.

## Actual entry points and contract ownership

| Consumer | Actual composition and public parity | Units, behavior and verification |
|---|---|---|
| trigger/scheduled.ts fxRevaluationTask | processFxRevaluation -> processFxRevaluationForOrg -> settlement revaluationExposure; original invoice/bill recognition and settlements remain shared REST/MCP; generated journals use existing REST/MCP entry reads | Document minor units convert once at period end with explicit source/base scales and exact decimal FX. Recognition legs already contain base minor units. Qualified saved FX, original control amount, actual carrier history and cumulative rounding releases establish remaining carrying value. Never reload issue-date reference FX. Bigint groups and safe numeric final legs/sides. |
| trigger/recurring-journals.ts | processRecurringJournalsMaintenance -> processRecurringJournals -> processJournalTemplate; same generator as REST run and MCP run_recurring_journals; [journal recurrence](RECURRING_JOURNAL_WIRE_CONTRACTS.md) | Stored integer minor legs and identity FX retain template currency tag; no base conversion. Organization/template locks serialize separate-template numbering and retries. Live organization/member creator, transaction-scoped references, period guards and generation audit. Existing locked/closed skip-and-advance policy retained. |
| trigger/scheduled.ts invoicingTask | processInvoicingMaintenance -> processRecurringTemplates -> processRecurringInvoiceTemplate / processRecurringPayableTemplate; [invoice recurrence](RECURRING_INVOICE_WIRE_CONTRACTS.md), [payable recurrence](RECURRING_PAYABLE_WIRE_CONTRACTS.md) | Exact totals, separate quantity hundredths/basis points, scoped references and atomic catch-up/numbering/GL. Document recurrence excludes journals by default. Invoice auto-send follows committed generation. Reminder sending and overdue/quote expiration contain no new monetary writer; no live reminder provider execution. |
| Payroll completion | payroll-runs.ts -> postPayrollRun(ctx, id, tx); authenticated REST/MCP, no Trigger payroll worker; [payroll integration](PAYROLL_INTEGRATION_CONTRACTS.md) | Fixed legacy cents and exact saved run arithmetic/allocations/FX; completion/status/GL atomic. Existing statutory policy only. Actual run/payment/output integration with negative scope/range/currency/period/history cases. |
| Accrual posting | postAccrualEntry; authenticated REST/MCP, no autonomous accrual worker; [accrual contract](ACCRUAL_WIRE_CONTRACTS.md) | REST major input retains fixed-two scale; integer cents, exact allocation/final remainder, explicit target/replay and scoped atomic posting. |
| Payment schedules | processScheduledPayments -> createSettlementPaymentInTransaction; REST process and MCP process_scheduled_payments, no Trigger worker; [payment schedules](SCHEDULED_PAYMENT_WIRE_CONTRACTS.md) | Saved positive document-minor amount/date; each schedule locks/rechecks and atomically posts payment/allocation/base/control/realised-FX/audit/status. Failed targets remain pending; others continue. |
| trigger/scheduled.ts reportSchedulesTask | processReportSchedules -> deliver; shared REST/MCP preflight/export/metadata; [report schedules](REPORT_SCHEDULE_WIRE_CONTRACTS.md) | Validate saved money before attachment/delivery. Schedule row lock prevents overlapping cron/manual occurrences. Real CSV/XLSX/PDF data with local recorded SMTP adapter; no provider calls. DB transaction does not guarantee exactly-once external email after partial recipient success/commit failure. |
| bookkeepingTask -> budget alerts | checkBudgetVariances -> shared exact runBudgetAlerts; scoped REST/MCP check; [budget alerts](BUDGET_ALERT_WIRE_CONTRACTS.md) | SQL-text posted-base sums, bigint thresholds and saved currency formatting; preflight/atomic in-app deduplication before optional email. Invalid budget/history rejects without partial notification writes. |
| bookkeepingTask -> low balances | checkLowBankBalances; existing REST/MCP threshold configuration; [bank accounts](BANK_ACCOUNT_WIRE_CONTRACTS.md) | Cached balance/threshold use SQL-text full-int64 projections and currency formatting. Live org/account lock, threshold recheck, per-recipient UTC-day deduplication and atomic in-app inserts. Email follows commit. Corrupt currency/insert failure leaves account retryable; others continue. |
| Stock costing | invoice-stock / bill-stock / inventory-valuation and assembly/landed-cost services; authenticated REST/MCP, no independent costing job; [inventory integration](INVENTORY_INTEGRATION_CONTRACTS.md) | Saved base carrying value, bigint rational arithmetic, FIFO consumed-value/final residual and average-cost policies. Physical quantities separate. Combined receipt/issue/transfer/count/assembly/cost fixtures assert SQL conservation and rollback. |

## Revaluation transaction and limits

Organization NO KEY UPDATE serializes domain writers while permitting a period-row
insert's FK KEY SHARE. Strict period-end and reversal checks use the transaction.
A short SHARE table lock on period_lock/fiscal_year protects absent-row insert,
replacement and close races, since legacy lock writers do not consistently lock
the organization. This briefly blocks period configuration writes across orgs;
no provider work occurs while held.

Recognition must be posted, unreversed, scoped to its document/date, with balanced
safe nonnegative amounts and consistent exact FX/version/direction/legacy aliases/
provenance. Bills include qualified GRNI clearing. Controls must be active, scoped,
in current base and correctly typed. Owned historical account/dimension references
remain; foreign ones fail. Unrealised accounts are created/validated in the posting
transaction. Numbering, paired journals, identity-FX base legs, mirrored amounts,
bidirectional links and actual-owner audit commit/roll back together.

Current balances are used only when no retained allocation was settled after
asOfDate. Both later partial and full settlements reject unchanged. This slice
does not reconstruct arbitrary prior-period balances or remediate unqualified
recognition/carrier history. Future-issued docs are excluded. Missing/quarantined
rates, non-lossless legacy FX, unsafe individual conversion/group/journal-side
results and incompatible history reject. Safe Number finals remain required;
bigint intermediate cancellation can exceed that range. Production IRR and
full-int64 financial posting remain disabled/unqualified.

Bills additionally qualify saved line/header sums, original supplier payable
equal to the total and the original AP control equal to a single exact conversion.
The schema has no immutable supplier-payable/tax-kind snapshot: reverse-charge
payables below the total and ambiguous split-GRNI conversion residuals reject
unchanged rather than infer prior tax policy or accept a corrupt outstanding due.
Settlement's existing qualified bill/GRNI contracts are unchanged.

Replay validates one posted pair, matching reversal date, audit provenance,
balanced base legs and exact mirror before count-only no-op. Changed reference FX
does not reprice replay. Deleted/void/incomplete/mismatched historical pairs reject
instead of double-posting. Invalid organizations do not stop the global sweep.

## Verification ownership

New fx-revaluation fixture joins actual authenticated REST invoice creation,
registered SDK MCP bills/recognition/settlement, worker, both entry-read transports
and independent SQL text. USD/JPY/KWD/synthetic IRR scales, partial rounding,
edited issue reference FX, signed low digits, oversized cancellation/overflow,
replay/races, later releases, malformed history/FX/tenant refs, locks/closed years,
owner/deletion and reversal/audit faults are covered. Concurrent absent-row period
insertion verifies the actual lock race. Bank and recurring-journal fixtures add
overlapping sweeps and separate-template numbering. Joint domain/worker fixtures
reverify nonempty recurrence/payroll/accrual/payments/reports/alerts/costing.

tests/background-composition.test.ts guards exact/shared delegates and absence of
invented workers. [MONEY_MANIFEST](MONEY_MANIFEST.md) and regenerated
[MONEY_BOUNDARIES](MONEY_BOUNDARIES.json) map current hashes/occurrences. No full
build/dev server, application DB, external provider call, Trigger deployment,
hosted CI, Docker or independent peer/human/accounting review is claimed.
