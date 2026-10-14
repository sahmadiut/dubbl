import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("remaining background consumers retain exact shared domain composition", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const fx = read("lib/api/fx-revaluation.ts");
  assert.doesNotMatch(fx, /getExchangeRate|convertAmount|parseFloat\(|Math\.(?:round|ceil|floor)/);
  for (const guard of [/revaluationExposure\(tx, ctx/, /paymentCashBase\(row.amountDue/, /delta: bigint/, /group.delta \+= delta/,
    /assertNotLocked\(orgId, asOfDate, undefined, tx\)/, /assertNotLocked\(orgId, reversalDate, undefined, tx\)/,
    /lock table period_lock, fiscal_year in share mode/, /await auditTax\(tx/]) assert.match(fx, guard);
  const scheduled = read("trigger/scheduled.ts");
  for (const operation of ["processInvoicingMaintenance", "processBookkeepingMaintenance", "processReportSchedules", "processFxRevaluation"]) assert.match(scheduled, new RegExp(`return ${operation}\\(|=> ${operation}\\(`));
  const recurring = read("lib/api/recurring-generate.ts");
  for (const operation of ["processRecurringInvoiceTemplate", "processRecurringPayableTemplate", "processJournalTemplate"]) assert.match(recurring, new RegExp(`await ${operation}\\(`));
  assert.match(read("lib/api/payroll-runs.ts"), /await postPayrollRun\(ctx, row.id, tx/);
  assert.match(read("lib/api/scheduled-payments.ts"), /createSettlementPaymentInTransaction\(ctx/);
  assert.match(read("lib/api/bookkeeping-maintenance.ts"), /await checkBudgetVariances\(\)/);
  assert.match(read("lib/api/bookkeeping-maintenance.ts"), /await checkLowBankBalances\(\)/);
  // Payroll/accrual/payment schedules and stock costing have no invented autonomous jobs.
  const jobs = [scheduled, read("trigger/recurring-journals.ts"), read("trigger/auto-reverse.ts"), read("trigger/webhooks.ts")].join("\n");
  assert.doesNotMatch(jobs, /postPayrollRun\(|postAccrualEntry\(|processScheduledPayments\(|issueStock\(/);
  const alert = read("lib/api/bank-balance-alerts.ts");
  assert.match(alert, /balance: sql<string>/); assert.match(alert, /BigInt\(account.balance\)/);
  assert.match(alert, /for\("update"\)/); assert.match(alert, /await deliverNotificationEmail/);
});
