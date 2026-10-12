import { db } from "@/lib/db";
import { fixedAsset, loan, loanSchedule, revenueSchedule, revenueEntry, organization } from "@/lib/db/schema";
import { eq, and, lte, isNull, asc } from "drizzle-orm";
import { maintenanceContext } from "./maintenance-context";
import { depreciateAssetForMaintenance } from "./asset-depreciation";
import { postLoanPayment } from "./loans";
import { recognizeRevenueEntry } from "./revenue-schedules";
import { autoReconcileBankTransactions } from "./bank-auto-reconcile";
import { checkBudgetVariances } from "./budget-alerts";
import { checkLowBankBalances } from "./bank-balance-alerts";

/** One exact monthly charge per asset, using the same validation/posting as REST/MCP. */
export async function processDepreciation(): Promise<{ processed: number; skipped: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select({ id: fixedAsset.id, organizationId: fixedAsset.organizationId }).from(fixedAsset)
    .where(and(eq(fixedAsset.status, "active"), isNull(fixedAsset.deletedAt))).orderBy(asc(fixedAsset.id));
  let processed = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ctx = await maintenanceContext(row.organizationId);
      if (ctx && await depreciateAssetForMaintenance(ctx, row.id, today)) processed++;
      else skipped++;
    } catch {
      // Invalid history or a locked period leaves this asset unchanged; others continue.
      skipped++;
    }
  }
  return { processed, skipped };
}

/** Catch up in saved schedule order; each domain transaction rechecks its target. */
export async function processLoanPayments(): Promise<{ processed: number; skipped: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select({ id: loan.id, organizationId: loan.organizationId }).from(loan)
    .where(and(eq(loan.status, "active"), isNull(loan.deletedAt))).orderBy(asc(loan.id));
  let processed = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ctx = await maintenanceContext(row.organizationId);
      if (!ctx) { skipped++; continue; }
      const due = await db.select({ id: loanSchedule.id }).from(loanSchedule)
        .where(and(eq(loanSchedule.loanId, row.id), eq(loanSchedule.posted, false), lte(loanSchedule.date, today)))
        .orderBy(asc(loanSchedule.periodNumber), asc(loanSchedule.id));
      if (!due.length) { skipped++; continue; }
      for (const entry of due) {
        // Explicit target prevents a cron/manual race from consuming the next period.
        await postLoanPayment(ctx, row.id, { scheduleEntryId: entry.id });
        processed++;
      }
    } catch {
      // Stop this loan at the first blocked/invalid period; never leap over it.
      skipped++;
    }
  }
  return { processed, skipped };
}

/** Fixed-cents revenue policy, saved allocations and base-currency guards are shared. */
export async function processRevenueRecognition(): Promise<{ processed: number; skipped: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select({ id: revenueSchedule.id, organizationId: revenueSchedule.organizationId }).from(revenueSchedule)
    .where(eq(revenueSchedule.status, "active")).orderBy(asc(revenueSchedule.id));
  let processed = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ctx = await maintenanceContext(row.organizationId);
      if (!ctx) { skipped++; continue; }
      const due = await db.select({ id: revenueEntry.id }).from(revenueEntry)
        .where(and(eq(revenueEntry.scheduleId, row.id), eq(revenueEntry.recognized, false), lte(revenueEntry.periodDate, today)))
        .orderBy(asc(revenueEntry.sortOrder), asc(revenueEntry.id));
      if (!due.length) { skipped++; continue; }
      for (const entry of due) {
        await recognizeRevenueEntry(ctx, row.id, { entryId: entry.id });
        processed++;
      }
    } catch {
      skipped++;
    }
  }
  return { processed, skipped };
}

export async function processBookkeepingMaintenance(): Promise<{
  depreciation: { processed: number; skipped: number };
  loanPayments: { processed: number; skipped: number };
  revenueRecognition: { processed: number; skipped: number };
  autoReconciliation: { checked: number; reconciled: number; skipped: number };
  budgetAlerts: { checked: number; alerted: number };
  balanceAlerts: { checked: number; alerted: number };
}> {
  const depreciation = await processDepreciation();
  const loanPayments = await processLoanPayments();
  const revenueRecognition = await processRevenueRecognition();

  // Auto-reconcile for all orgs with unreconciled transactions
  let totalChecked = 0;
  let totalReconciled = 0;
  let totalSkipped = 0;

  const orgs = await db
    .select({ id: organization.id })
    .from(organization);

  for (const org of orgs) {
    try {
      const ctx = await maintenanceContext(org.id);
      if (!ctx) continue;
      const result = await autoReconcileBankTransactions(ctx);
      totalChecked += result.checked;
      totalReconciled += result.reconciled;
      totalSkipped += result.skipped;
    } catch {
      // Non-critical, continue
    }
  }

  const budgetAlerts = await checkBudgetVariances();
  const balanceAlerts = await checkLowBankBalances();

  return {
    depreciation,
    loanPayments,
    revenueRecognition,
    autoReconciliation: { checked: totalChecked, reconciled: totalReconciled, skipped: totalSkipped },
    budgetAlerts,
    balanceAlerts,
  };
}
