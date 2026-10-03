import { db } from "@/lib/db";
import { recurringTemplate, recurringTemplateLine, bill, billLine, expenseClaim, expenseItem, contact, journalEntry, journalLine } from "@/lib/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { getNextNumber } from "@/lib/api/numbering";
import { preloadTaxRates, calcTax } from "@/lib/api/tax-calculator";
import { getNextEntryNumber } from "@/lib/api/journal-automation";
import { assertNotLocked, PeriodLockedError } from "@/lib/api/period-lock";
import { recurringJournalScope } from "./recurring-journal";
import { recurringJournalLegs, recurringJournalDto, assertRecurringJournalDates, recurringJournalCreateHeader } from "./recurring-journal-wire";
import { assertJournalReferences } from "./journal-references";
import { WireCompatibilityError } from "@/lib/money/wire";
import { z } from "zod";
import { processRecurringInvoiceTemplate } from "./recurring-invoice-generate";

/**
 * Advance a date by the given frequency.
 */
function advanceDate(date: string, frequency: string): string {
  const d = new Date(date + "T00:00:00Z");
  switch (frequency) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "semi_annual":
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

/** Serialize a template's entire catch-up with edits/runs, committing schedule and entries together. */
async function processJournalTemplate(organizationId: string, id: string, today: string): Promise<number> {
  return db.transaction(async tx => {
    const [tmpl] = await tx.select().from(recurringTemplate).where(recurringJournalScope(id, organizationId)).for("update");
    if (!tmpl || tmpl.status !== "active" || tmpl.nextRunDate > today) return 0;
    recurringJournalDto(tmpl); // Validate saved currency, never fetch or infer a new FX rate.
    recurringJournalCreateHeader.parse(tmpl);
    z.number().int().min(0).max(2147483647).parse(tmpl.occurrencesGenerated);
    assertRecurringJournalDates(tmpl.startDate, tmpl.endDate);
    z.iso.date().parse(tmpl.nextRunDate);
    const lines = await tx.select().from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, id));
    const legs = recurringJournalLegs(lines.map(line => ({ description: line.description, accountId: line.accountId,
      debitAmount: line.debitAmount, creditAmount: line.creditAmount, costCenterId: line.costCenterId })), tmpl.currencyCode);
    await assertJournalReferences(organizationId, legs);
    let nextRun = tmpl.nextRunDate, occurrences = tmpl.occurrencesGenerated;
    const dates: string[] = [];
    // Preflight the whole catch-up before writing entries or consuming the schedule.
    while (nextRun <= today && (tmpl.maxOccurrences === null || occurrences < tmpl.maxOccurrences) && (!tmpl.endDate || nextRun <= tmpl.endDate)) {
      if (occurrences >= 2147483647 || occurrences < 0) throw new WireCompatibilityError("Recurring occurrence count exceeds int32 range");
      try { await assertNotLocked(organizationId, nextRun); dates.push(nextRun); }
      catch (err) { if (!(err instanceof PeriodLockedError)) throw err; } // Preserve locked-date skip policy.
      const advanced = advanceDate(nextRun, tmpl.frequency);
      z.iso.date().parse(advanced);
      if (advanced <= nextRun) throw new Error("Recurring schedule must advance");
      nextRun = advanced; occurrences++;
    }
    for (const runDate of dates) {
      const entryNumber = await getNextEntryNumber(organizationId, tx);
      const [entry] = await tx.insert(journalEntry).values({ organizationId, entryNumber, date: runDate,
        description: tmpl.notes || tmpl.name, reference: tmpl.reference, status: "posted", sourceType: "recurring_journal",
        sourceId: tmpl.id, postedAt: new Date(), createdBy: tmpl.createdBy }).returning();
      await tx.insert(journalLine).values(legs.map((leg, sortOrder) => ({ journalEntryId: entry.id, accountId: leg.accountId,
        description: leg.description, debitAmount: leg.debitAmount, creditAmount: leg.creditAmount, currencyCode: tmpl.currencyCode,
        exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateMigrationStatus: "exact",
        rateProvenance: "recurring_journal_identity", costCenterId: leg.costCenterId ?? null, sortOrder })));
    }
    const completed = (tmpl.maxOccurrences !== null && occurrences >= tmpl.maxOccurrences) || (tmpl.endDate !== null && nextRun > tmpl.endDate);
    await tx.update(recurringTemplate).set({ nextRunDate: nextRun, lastRunDate: today, occurrencesGenerated: occurrences,
      status: completed ? "completed" : "active", updatedAt: new Date() }).where(recurringJournalScope(id, organizationId));
    return dates.length;
  });
}

/**
 * Process due recurring templates for an organization and return the count
 * generated.
 *
 * `opts.types` restricts which template types are processed. When omitted, the
 * DOCUMENT types (invoice / bill / expense) are processed but JOURNAL templates
 * are NOT — those are posted exclusively by the dedicated daily recurring-
 * journals task (processRecurringJournals) so the two schedules never double-
 * post the same occurrence. Pass an explicit `types` list to override.
 */
const DEFAULT_RECURRING_TYPES: ("invoice" | "bill" | "expense")[] = [
  "invoice",
  "bill",
  "expense",
];

export async function processRecurringTemplates(
  organizationId: string,
  opts?: { types?: ("invoice" | "bill" | "expense" | "journal")[] }
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  // Find all active templates that are due
  const allowedTypes = opts?.types ?? DEFAULT_RECURRING_TYPES;
  const dueTemplates = await db.query.recurringTemplate.findMany({
    where: and(
      eq(recurringTemplate.organizationId, organizationId),
      eq(recurringTemplate.status, "active"),
      inArray(recurringTemplate.type, allowedTypes),
      lte(recurringTemplate.nextRunDate, today),
      notDeleted(recurringTemplate.deletedAt),
    ),
    with: { lines: true },
  });

  let generated = 0;

  for (const tmpl of dueTemplates) {
    if (tmpl.type === "journal") {
      generated += await processJournalTemplate(organizationId, tmpl.id, today);
      continue;
    }
    if (tmpl.type === "invoice") {
      generated += await processRecurringInvoiceTemplate(organizationId, tmpl.id, today);
      continue;
    }
    // Generate all missed invoices (if nextRunDate is far in the past, catch up)
    let nextRun = tmpl.nextRunDate;
    let occurrences = tmpl.occurrencesGenerated;

    while (nextRun <= today) {
      // Check max occurrences
      if (tmpl.maxOccurrences !== null && occurrences >= tmpl.maxOccurrences) {
        break;
      }
      // Check end date
      if (tmpl.endDate && nextRun > tmpl.endDate) {
        break;
      }

      if (tmpl.type === "bill") {
        // Bill templates always carry a contact (enforced on create). Defensive
        // skip keeps a malformed contactless bill template from inserting a
        // NULL contactId (the column is NOT NULL).
        if (!tmpl.contactId) break;
        const billNumber = await getNextNumber(organizationId, "bill", "bill_number", "BILL");

        // Use contact payment terms for due date
        const contactRecord = await db.query.contact.findFirst({
          where: eq(contact.id, tmpl.contactId),
          columns: { paymentTermsDays: true },
        });
        const termsDays = contactRecord?.paymentTermsDays ?? 30;
        const dueDateBill = new Date(nextRun + "T00:00:00Z");
        dueDateBill.setUTCDate(dueDateBill.getUTCDate() + termsDays);
        const dueDateBillStr = dueDateBill.toISOString().split("T")[0];

        const billTaxRateIds = tmpl.lines.map((l) => l.taxRateId).filter(Boolean) as string[];
        const billRatesMap = await preloadTaxRates(billTaxRateIds);

        let billSubtotal = 0;
        const billLines = tmpl.lines.map((l, i) => {
          const grossAmt = Math.round((l.quantity / 100) * l.unitPrice);
          const discountAmt = l.discountPercent ? Math.round(grossAmt * l.discountPercent / 10000) : 0;
          const amt = grossAmt - discountAmt;
          billSubtotal += amt;
          const taxAmount = l.taxRateId ? calcTax(amt, billRatesMap.get(l.taxRateId) ?? 0) : 0;
          return {
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            accountId: l.accountId,
            taxRateId: l.taxRateId,
            discountPercent: l.discountPercent,
            taxAmount,
            amount: amt,
            sortOrder: l.sortOrder ?? i,
          };
        });

        const billTaxTotal = billLines.reduce((sum, l) => sum + l.taxAmount, 0);
        const billTotal = billSubtotal + billTaxTotal;

        const [createdBill] = await db
          .insert(bill)
          .values({
            organizationId,
            contactId: tmpl.contactId,
            billNumber,
            issueDate: nextRun,
            dueDate: dueDateBillStr,
            reference: tmpl.reference,
            notes: tmpl.notes,
            subtotal: billSubtotal,
            taxTotal: billTaxTotal,
            total: billTotal,
            amountPaid: 0,
            amountDue: billTotal,
            currencyCode: tmpl.currencyCode,
            createdBy: tmpl.createdBy,
          })
          .returning();

        if (billLines.length > 0) {
          await db.insert(billLine).values(
            billLines.map((l) => ({ billId: createdBill.id, ...l }))
          );
        }

        occurrences++;
        generated++;
        nextRun = advanceDate(nextRun, tmpl.frequency);
        continue;
      }

      if (tmpl.type === "expense") {
        let expenseTotal = 0;
        const expenseItems = tmpl.lines.map((l, i) => {
          const amt = Math.round((l.quantity / 100) * l.unitPrice);
          expenseTotal += amt;
          return {
            date: nextRun,
            description: l.description,
            amount: amt,
            accountId: l.accountId,
            sortOrder: l.sortOrder ?? i,
          };
        });

        const [createdClaim] = await db
          .insert(expenseClaim)
          .values({
            organizationId,
            title: tmpl.name,
            description: tmpl.notes,
            submittedBy: tmpl.createdBy!,
            totalAmount: expenseTotal,
            currencyCode: tmpl.currencyCode,
          })
          .returning();

        if (expenseItems.length > 0) {
          await db.insert(expenseItem).values(
            expenseItems.map((item) => ({
              expenseClaimId: createdClaim.id,
              ...item,
            }))
          );
        }

        occurrences++;
        generated++;
        nextRun = advanceDate(nextRun, tmpl.frequency);
        continue;
      }

      break;
    }

    // Determine new status
    const reachedMax = tmpl.maxOccurrences !== null && occurrences >= tmpl.maxOccurrences;
    const pastEnd = tmpl.endDate && nextRun > tmpl.endDate;
    const newStatus = reachedMax || pastEnd ? "completed" : "active";

    // Update the template
    await db
      .update(recurringTemplate)
      .set({
        nextRunDate: nextRun,
        lastRunDate: today,
        occurrencesGenerated: occurrences,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(recurringTemplate.id, tmpl.id));
  }

  return generated;
}

/**
 * Process only the document-producing recurring templates (invoice / bill /
 * expense) for an org — used by the invoicing-maintenance run. Journal templates
 * are handled separately by processRecurringJournals so the two schedules don't
 * double-post.
 */
export async function processRecurringDocuments(organizationId: string): Promise<number> {
  return processRecurringTemplates(organizationId, {
    types: ["invoice", "bill", "expense"],
  });
}

/**
 * Process only the recurring JOURNAL templates for an org — used by the daily
 * recurring-journals trigger task. Each due template posts a balanced, posted
 * manual journal entry per occurrence (re-validating DR==CR + assertNotLocked).
 * Returns the number of journal entries posted.
 */
export async function processRecurringJournals(organizationId: string): Promise<number> {
  return processRecurringTemplates(organizationId, { types: ["journal"] });
}

/**
 * Cross-org daily sweep for recurring JOURNAL templates: find every org with a
 * due, active journal template and post its occurrences. Mirrors the cross-org
 * pattern in processInvoicingMaintenance. Returns the total entries posted.
 */
export async function processRecurringJournalsMaintenance(): Promise<{ journalsPosted: number }> {
  const today = new Date().toISOString().split("T")[0];

  const dueOrgs = await db
    .selectDistinct({ orgId: recurringTemplate.organizationId })
    .from(recurringTemplate)
    .where(
      and(
        eq(recurringTemplate.status, "active"),
        eq(recurringTemplate.type, "journal"),
        lte(recurringTemplate.nextRunDate, today)
      )
    );

  let journalsPosted = 0;
  for (const { orgId } of dueOrgs) {
    journalsPosted += await processRecurringJournals(orgId);
  }
  return { journalsPosted };
}
