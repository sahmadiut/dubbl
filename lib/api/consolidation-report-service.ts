import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { consolidationEliminationEntry } from "@/lib/db/schema";
import type { AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { loadConsolidationGroup } from "./consolidation-config";
import { consolidationId } from "./consolidation-config-wire";
import { computeConsolidatedReport } from "./consolidation-report";
import { consolidationReportDto, consolidationWindowSchema } from "./consolidation-report-wire";
import { auditTax, lockTaxOrganization } from "./tax-config-transaction";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export async function getConsolidationReport(ctx: AuthContext, id: string, input: unknown) {
  consolidationId.parse(id); const window = consolidationWindowSchema.parse(input);
  return db.transaction(async tx => {
    const group = await loadConsolidationGroup(tx, ctx, id);
    return consolidationReportDto(await computeConsolidatedReport(group, window, tx));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** Retry only PostgreSQL serialization/deadlock conflicts; failed attempts roll back. */
function retryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; cause?: unknown };
  return e.code === "40001" || e.code === "40P01" || (e.cause !== undefined && retryable(e.cause));
}
export async function persistConsolidationReport(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:reports"); consolidationId.parse(id); const window = consolidationWindowSchema.parse(input);
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async tx => {
        // Same parent lock as group/member/rule writers. Compute and authorize in this snapshot.
        await lockTaxOrganization(tx, ctx.organizationId);
        const group = await loadConsolidationGroup(tx, ctx, id);
        await assertNotLocked(ctx.organizationId, window.endDate, ctx, tx);
        const report = consolidationReportDto(await computeConsolidatedReport(group, window, tx));
        await tx.delete(consolidationEliminationEntry).where(and(eq(consolidationEliminationEntry.groupId, id),
          eq(consolidationEliminationEntry.periodEndDate, window.endDate)));
        const rows = report.elimination.entries.filter(r => !r.skipped && (r.eliminated !== 0 || r.variance !== 0)).map(r => ({
          groupId: id, periodEndDate: window.endDate, ruleId: r.ruleId, currencyCode: report.presentationCurrency,
          amount: r.eliminated, varianceAmount: r.variance,
        }));
        if (rows.length) {
          const saved = await tx.insert(consolidationEliminationEntry).values(rows).returning();
          const expected = new Map(rows.map(row => [row.ruleId, row]));
          // Validate returned storage before commit, including trigger-induced changes.
          if (saved.length !== rows.length || new Set(saved.map(r => r.ruleId)).size !== rows.length || saved.some(r => {
            const row = expected.get(r.ruleId);
            return !row || r.groupId !== row.groupId || r.periodEndDate !== row.periodEndDate ||
              r.currencyCode !== row.currencyCode || r.amount !== row.amount || r.varianceAmount !== row.varianceAmount;
          }))
            throw new WireCompatibilityError("Persisted consolidation entries disagree with the worksheet");
          stringifyWire(saved);
        }
        const result = { persisted: true, ...report };
        stringifyWire(result);
        await auditTax(tx, ctx.organizationId, "consolidation_report", id, "recalculate", {
          startDate: window.startDate, endDate: window.endDate, presentationCurrency: report.presentationCurrency,
          elimination: report.elimination, translation: report.translation,
        }, ctx, request);
        return result;
      }, { isolationLevel: "serializable" });
    } catch (error) { if (attempt >= 2 || !retryable(error)) throw error; }
  }
}
