import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bulkImportJob, chartAccount, journalEntry, journalLine } from "@/lib/db/schema";
import type { AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { getNextEntryNumber } from "./journal-automation";
import { logAudit } from "./audit";
import { stringifyWire } from "@/lib/money/wire";
import { journalImportGroups, journalImportTotals, type JournalImportRow } from "./journal-import-wire";

export async function importJournals(ctx: AuthContext, rows: JournalImportRow[], fileName: string, post: boolean, request?: Request) {
  requireRole(ctx, "manage:entries");
  if (post) requireRole(ctx, "post:entries");
  const groups = journalImportGroups(rows);
  for (const group of groups.values()) journalImportTotals(group);
  const prepared = [];
  let index = 0;
  // Preflight every group before any journal mutation. Business errors remain per-group
  // job results; malformed money/date/alias/range inputs were rejected before this service.
  for (const group of groups.values()) {
    index++;
    try {
      const first = group[0], totals = journalImportTotals(group);
      if (group.length < 2 || totals.totalDebit === 0 || totals.imbalance !== 0) throw new Error("Entry must have at least two balanced non-zero lines");
      if (!group.every(row => row.date === first.date && row.description === first.description && row.reference === first.reference)) throw new Error("Grouped entry headers must agree");
      const lines = [];
      for (const row of group) {
        if (row.debitAmount && row.creditAmount) throw new Error("A line cannot have both a debit and a credit");
        // Equality, not ILIKE patterns: account codes containing %/_ must stay literal.
        const accounts = await db.select({ id: chartAccount.id }).from(chartAccount).where(and(
          eq(chartAccount.organizationId, ctx.organizationId), sql`lower(${chartAccount.code}) = lower(${row.lineAccountCode})`,
          eq(chartAccount.isActive, true), isNull(chartAccount.deletedAt)));
        if (accounts.length !== 1) throw new Error(`Active account not uniquely found: "${row.lineAccountCode}"`);
        lines.push({ accountId: accounts[0].id, debitAmount: row.debitAmount, creditAmount: row.creditAmount });
      }
      if (post) await assertNotLocked(ctx.organizationId, first.date, ctx);
      prepared.push({ index, first, lines, error: null });
    } catch (err) {
      prepared.push({ index, first: group[0], lines: [], error: err instanceof Error ? err.message : "Invalid group" });
    }
  }
  const [job] = await db.insert(bulkImportJob).values({ organizationId: ctx.organizationId, type: "entries", fileName,
    totalRows: rows.length, status: "processing", createdBy: ctx.userId }).returning();
  let processedRows = 0;
  const errors: { row: number; error: string }[] = [];
  for (const group of prepared) {
    if (group.error) { errors.push({ row: group.index, error: group.error }); continue; }
    try {
      await db.transaction(async tx => {
        // A failed leg insert rolls back its header; other qualified groups still commit.
        const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId,
          entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date: group.first.date, description: group.first.description,
          reference: group.first.reference || null, status: post ? "posted" : "draft", postedAt: post ? new Date() : null,
          sourceType: "manual", createdBy: ctx.userId }).returning();
        await tx.insert(journalLine).values(group.lines.map(line => ({ journalEntryId: entry.id, ...line })));
        stringifyWire(entry);
      });
      processedRows++;
    } catch (err) { errors.push({ row: group.index, error: err instanceof Error ? err.message : "Unknown error" }); }
  }
  const [updated] = await db.update(bulkImportJob).set({ processedRows, errorRows: errors.length,
    errorDetails: errors.length ? errors : null, status: errors.length === groups.size ? "failed" : "completed", completedAt: new Date() })
    .where(and(eq(bulkImportJob.id, job.id), eq(bulkImportJob.organizationId, ctx.organizationId))).returning();
  await logAudit({ ctx, action: "import", entityType: "journal_entry", entityId: ctx.organizationId,
    changes: { count: processedRows, jobId: job.id, posted: post }, request });
  return { job: updated, summary: { jobId: job.id, totalEntries: groups.size, processedEntries: processedRows,
    errorEntries: errors.length, posted: post, status: updated.status, errors: errors.slice(0, 10) } };
}
