import { db } from "@/lib/db";
import { journalEntry, journalLine, auditLog } from "@/lib/db/schema";
import { eq, and, lte, isNull, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { lockTaxOrganization } from "./tax-config-transaction";
import { maintenanceContext } from "./maintenance-context";
import { assertNotLocked } from "./period-lock";
import { assertJournalReferences } from "./journal-references";
import { getNextEntryNumber } from "./journal-automation";
import { journalLineDto, journalTotalDebit, journalTotals } from "./journal-wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";

/** Auto-reversal mirrors stored GL amounts; original currency tags never cause a second FX conversion. */
async function reverseEntry(originalId: string, organizationId: string, today: string): Promise<boolean> {
  return db.transaction(async tx => {
    // Match the adopted domain lock order, serializing numbering and overlapping runs.
    await lockTaxOrganization(tx, organizationId);
    const ctx = await maintenanceContext(organizationId, tx);
    if (!ctx) throw new WireCompatibilityError("Auto-reversal requires an organization owner for audit attribution");
    const [original] = await tx.select().from(journalEntry)
      .where(and(eq(journalEntry.id, originalId), eq(journalEntry.organizationId, organizationId))).for("update");
    if (!original || original.status !== "posted" || original.deletedAt || original.reversedByEntryId ||
      !original.autoReverseDate || original.autoReverseDate > today) return false;
    z.iso.date().parse(original.autoReverseDate);
    if (original.autoReverseDate < original.date) throw new WireCompatibilityError("Saved auto-reversal date precedes the original journal");
    // The original can be in a closed period; the new reversing date must be open.
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    await assertNotLocked(organizationId, original.autoReverseDate, undefined, tx);
    const lines = await tx.select({ ...journalLineFields, rateExact: sql<string | null>`${journalLine.rateExact}::text` })
      .from(journalLine).where(eq(journalLine.journalEntryId, originalId)).orderBy(asc(journalLine.id));
    if (!lines.length) throw new WireCompatibilityError("Auto-reversal requires saved journal lines");
    for (const line of lines) {
      legacyMinorSchema.min(0).parse(line.debitAmount); legacyMinorSchema.min(0).parse(line.creditAmount);
      currencyCodeSchema.parse(line.currencyCode);
      journalLineDto(line);
      if ((line.debitAmount > 0 && line.creditAmount > 0) || !line.rateExact || line.rateMigrationStatus !== "exact" ||
        line.rateFormatVersion !== 1 || line.rateProvenance !== "legacy_scaled_1e6:transaction") throw new WireCompatibilityError("Auto-reversal requires qualified saved money and FX metadata");
    }
    const debit = journalTotalDebit(lines), credit = journalTotalDebit(lines.map(line => ({ ...line, debitAmount: line.creditAmount })));
    // Preserve existing manual multi-currency balance policy and already-base automated legs.
    if (debit === 0 || debit !== credit) journalTotals(lines, true);
    await assertJournalReferences(organizationId, lines, original.fiscalYearId, true, tx);
    const entryNumber = await getNextEntryNumber(organizationId, tx);
    z.number().int().positive().max(2147483647).parse(entryNumber);
    const [reversal] = await tx.insert(journalEntry).values({ organizationId, entryNumber,
      date: original.autoReverseDate, description: `Auto-reversal of entry #${original.entryNumber}: ${original.description}`,
      reference: original.reference ? `REV-${original.reference}` : `REV-${original.entryNumber}`,
      status: "posted", sourceType: "auto_reversal", sourceId: original.id, postedAt: new Date(),
      createdBy: original.createdBy, reversesEntryId: original.id }).returning();
    await tx.insert(journalLine).values(lines.map(line => ({ journalEntryId: reversal.id,
      accountId: line.accountId, description: line.description, debitAmount: line.creditAmount, creditAmount: line.debitAmount,
      currencyCode: line.currencyCode, exchangeRate: line.exchangeRate, rateExact: line.rateExact,
      rateDirection: line.rateDirection, rateFormatVersion: line.rateFormatVersion, rateProvenance: line.rateProvenance,
      rateMigrationStatus: line.rateMigrationStatus, costCenterId: line.costCenterId, projectId: line.projectId })));
    await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, updatedAt: new Date() })
      .where(and(eq(journalEntry.id, original.id), eq(journalEntry.organizationId, organizationId)));
    await tx.insert(auditLog).values({ organizationId, userId: ctx.userId, entityType: "journal_entry",
      entityId: original.id, action: "auto_reverse", changes: { reversalEntryId: reversal.id, date: original.autoReverseDate } });
    return true;
  });
}

// Explicit projections retain saved FX text and avoid relation numeric coercion.
const journalLineFields = {
  accountId: journalLine.accountId, description: journalLine.description,
  debitAmount: journalLine.debitAmount, creditAmount: journalLine.creditAmount, currencyCode: journalLine.currencyCode,
  exchangeRate: journalLine.exchangeRate, rateDirection: journalLine.rateDirection, rateFormatVersion: journalLine.rateFormatVersion,
  rateMigrationStatus: journalLine.rateMigrationStatus, rateProvenance: journalLine.rateProvenance,
  costCenterId: journalLine.costCenterId, projectId: journalLine.projectId,
};

/** Trusted daily sweep. Invalid/locked entries remain due and do not abort other organizations. */
export async function processAutoReversals(today: string = new Date().toISOString().slice(0, 10)):
  Promise<{ checked: number; reversed: number; failed: number }> {
  z.iso.date().parse(today);
  const due = await db.select({ id: journalEntry.id, organizationId: journalEntry.organizationId }).from(journalEntry)
    .where(and(eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt), isNull(journalEntry.reversedByEntryId),
      lte(journalEntry.autoReverseDate, today))).orderBy(asc(journalEntry.organizationId), asc(journalEntry.id));
  let reversed = 0, failed = 0;
  for (const entry of due) {
    try { if (await reverseEntry(entry.id, entry.organizationId, today)) reversed++; }
    catch { failed++; } // Count failures without logging monetary history or provider data.
  }
  return { checked: due.length, reversed, failed };
}
