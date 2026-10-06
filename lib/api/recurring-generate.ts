import { db } from "@/lib/db";
import { recurringTemplate, recurringTemplateLine, journalEntry, journalLine } from "@/lib/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { getNextEntryNumber } from "@/lib/api/journal-automation";
import { assertNotLocked, PeriodLockedError } from "@/lib/api/period-lock";
import { recurringJournalScope } from "./recurring-journal";
import { recurringJournalLegs, recurringJournalDto, assertRecurringJournalDates, recurringJournalCreateHeader } from "./recurring-journal-wire";
import { assertJournalReferences } from "./journal-references";
import { WireCompatibilityError } from "@/lib/money/wire";
import { z } from "zod";
import { processRecurringPayableTemplate } from "./recurring-payable";
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
    generated += await processRecurringPayableTemplate(organizationId, tmpl.id, today);
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
