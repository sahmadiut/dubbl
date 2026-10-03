import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate, invoice, invoiceLine, member } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { lockRecurringInvoiceOrg, loadRecurringInvoice, recurringInvoiceScope, recurringInvoiceReferences } from "./recurring-invoice";
import { taxRates, nextNumber, references } from "./invoice-writes";
import { recurringInvoiceCreateSchema, recurringInvoiceTotals, advanceRecurringInvoiceDate } from "./recurring-invoice-wire";
import { invoiceWriteDto } from "./invoice-write-wire";
import { sendInvoiceInTransaction } from "./invoice-lifecycle";
import { assertNotLocked } from "./period-lock";
import { WireCompatibilityError } from "@/lib/money/wire";
import { logAudit } from "./audit";
import { buildSenderSnapshot } from "@/lib/documents/snapshots";
import { sendDocumentEmail } from "@/lib/email/document-sender";
import { renderDocumentEmailHtml } from "@/lib/email/render-document-email";

/** Whole catch-up is atomic. Row and organization locks serialize runs with edits and numbering. */
export async function processRecurringInvoiceTemplate(orgId: string, id: string, today: string) {
  const result = await db.transaction(async tx => {
    await lockRecurringInvoiceOrg(tx, orgId);
    // A paused/deleted template selected before the lock must not be generated.
    const [candidate] = await tx.select().from(recurringTemplate).where(recurringInvoiceScope(id, orgId)).for("update");
    if (!candidate || candidate.status !== "active" || candidate.nextRunDate > today) return { rows: [], email: null, ctx: null };
    const tmpl = await loadRecurringInvoice(tx, orgId, id, true);
    recurringInvoiceCreateSchema.omit({ lines: true }).strip().parse(tmpl);
    z.iso.date().parse(today); z.iso.date().parse(tmpl.nextRunDate);
    z.number().int().min(0).max(2147483647).parse(tmpl.occurrencesGenerated);
    // Background work uses the saved creator only when still an organization member.
    const creator = tmpl.createdBy ? await tx.select({ userId: member.userId }).from(member).where(eq(member.organizationId, orgId)) : [];
    const userId = creator.some(row => row.userId === tmpl.createdBy) ? tmpl.createdBy : null;
    const ctx: AuthContext = { organizationId: orgId, userId: userId ?? "", role: "owner" };
    await references(tx, orgId, tmpl.contactId!, recurringInvoiceReferences(tmpl.lines));
    const totals = recurringInvoiceTotals(tmpl.lines, await taxRates(tx, recurringInvoiceReferences(tmpl.lines)));
    const terms = z.number().int().min(0).max(2147483647).parse(tmpl.contact.paymentTermsDays ?? 30);
    let nextRun = tmpl.nextRunDate, occurrences = tmpl.occurrencesGenerated;
    const dates: { issueDate: string; dueDate: string }[] = [];
    while (nextRun <= today && (tmpl.maxOccurrences === null || occurrences < tmpl.maxOccurrences) && (!tmpl.endDate || nextRun <= tmpl.endDate)) {
      if (occurrences === 2147483647) throw new WireCompatibilityError("Recurring occurrence count exceeds int32 range");
      // A locked date leaves the entire catch-up pending instead of consuming occurrences.
      await assertNotLocked(orgId, nextRun);
      const due = new Date(`${nextRun}T00:00:00Z`); due.setUTCDate(due.getUTCDate() + terms);
      const dueDate = due.toISOString().split("T")[0]; z.iso.date().parse(dueDate);
      dates.push({ issueDate: nextRun, dueDate }); nextRun = advanceRecurringInvoiceDate(nextRun, tmpl.frequency); occurrences++;
    }
    const rows = [];
    for (const date of dates) {
      const [row] = await tx.insert(invoice).values({ organizationId: orgId, contactId: tmpl.contactId!,
        invoiceNumber: await nextNumber(tx, orgId), ...date, reference: tmpl.reference, notes: tmpl.notes,
        subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total, amountDue: totals.total,
        amountPaid: 0, currencyCode: tmpl.currencyCode, createdBy: userId }).returning();
      await tx.insert(invoiceLine).values(totals.processedLines.map(line => ({ ...line, invoiceId: row.id })));
      // Posting failure rolls back numbering, documents and schedule together; FX is saved by posting.
      if (tmpl.autoSend || tmpl.createAsApproved) {
        if (!userId) throw new AuthError("Automated posting requires an organization member as template creator", 422);
        rows.push((await sendInvoiceInTransaction(tx, ctx, row.id)).invoice);
      } else rows.push(invoiceWriteDto(row));
    }
    const completed = (tmpl.maxOccurrences !== null && occurrences >= tmpl.maxOccurrences) || (tmpl.endDate !== null && nextRun > tmpl.endDate);
    await tx.update(recurringTemplate).set({ nextRunDate: nextRun, lastRunDate: today, occurrencesGenerated: occurrences,
      status: completed ? "completed" : "active", updatedAt: new Date() }).where(recurringInvoiceScope(id, orgId));
    return { rows, email: tmpl.autoSend ? tmpl.contact : null, ctx };
  });
  for (const inv of result.rows) {
    await logAudit({ ctx: result.ctx!, action: "generate", entityType: "recurring_invoice", entityId: id, changes: { invoiceId: inv.id, issueDate: inv.issueDate } });
    // External delivery follows committed posting; failed delivery never duplicates a document on rerun.
    if (result.email?.email) {
      try {
        const sender = await buildSenderSnapshot(orgId);
        const html = await renderDocumentEmailHtml({ organizationName: sender.name, contactName: result.email.name,
          documentType: "Invoice", documentNumber: inv.invoiceNumber, issueDateFormatted: inv.issueDate, dueDateFormatted: inv.dueDate });
        await sendDocumentEmail({ orgId, userId: result.ctx!.userId, documentType: "invoice", documentId: inv.id,
          recipientEmail: result.email.email, subject: `Invoice ${inv.invoiceNumber}`, body: html, attachPdf: false });
      } catch { /* Existing delivery policy is best effort; failed sends are visible in document email history. */ }
    }
  }
  return result.rows.length;
}
