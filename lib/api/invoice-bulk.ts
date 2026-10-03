import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoice, invoiceLine, organization, bulkImportJob, contact, emailConfig, reminderLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { checkMonthlyLimit, checkMultiCurrency } from "./check-limit";
import { references, taxRates, nextNumber } from "./invoice-writes";
import { sendInvoiceInTransaction } from "./invoice-lifecycle";
import { lifecycleDto } from "./invoice-lifecycle-wire";
import { publicLineDto } from "./public-money-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { logAudit } from "./audit";
import { sendEmail } from "@/lib/email/smtp-client";
import { renderTemplate } from "@/lib/email/template-engine";
import { safeInvoiceMinor } from "./invoice-write-wire";
import { invoiceImportFields, invoiceImportSchema, invoiceImportGroups, invoiceImportRowSchema, invoiceImportTotals,
  invoiceImportPreviewTotals, invoiceBulkIdsFields, invoiceReminderFields, formatInvoiceReminderAmount, type InvoiceImportRow } from "./invoice-bulk-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext, ids: string[]) => and(eq(invoice.organizationId, ctx.organizationId), inArray(invoice.id, ids), isNull(invoice.deletedAt));
const message = (err: unknown) => err instanceof Error ? err.message : "Invoice operation failed";

async function validateImport(tx: Tx, ctx: AuthContext, row: InvoiceImportRow) {
  await references(tx, ctx.organizationId, row.contactId, row.lines);
  const rates = await taxRates(tx, row.lines);
  if ([...rates.values()].some(rate => !Number.isInteger(rate) || rate < 0 || rate > 2147483647))
    throw new WireCompatibilityError("Saved tax rate is outside supported nonnegative int32 basis points");
  const totals = invoiceImportTotals(row, rates);
  await assertNotLocked(ctx.organizationId, row.issueDate);
  await checkMultiCurrency(ctx.organizationId, row.currencyCode);
  return totals;
}

export async function previewInvoiceImport(ctx: AuthContext, input: unknown) {
  const parsed = z.object(invoiceImportFields).parse(input);
  stringifyWire(parsed.rows); // Never echo already rounded unsafe numeric payloads.
  const groups = invoiceImportGroups(parsed.rows, parsed.source);
  const preview = [];
  for (const [i, data] of groups.entries()) {
    try {
      const row = invoiceImportRowSchema.parse(data);
      const totals = await db.transaction(async tx => {
        await references(tx, ctx.organizationId, row.contactId, row.lines);
        return invoiceImportPreviewTotals(row, await taxRates(tx, row.lines));
      });
      preview.push({ row: i + 1, data, valid: true, errors: [], ...totals });
    } catch (err) {
      preview.push({ row: i + 1, data, valid: false, errors: [message(err)] });
    }
  }
  return { preview, validCount: preview.filter(row => row.valid).length, totalCount: preview.length };
}

export async function importInvoices(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const parsed = invoiceImportSchema.parse(input);
  const rows = invoiceImportGroups(parsed.rows, parsed.source).map(row => invoiceImportRowSchema.parse(row));
  // Malformed aliases, prices, products and header sums reject the entire request before a job.
  // Tax rates are loaded after scoped reference validation; missing references are per-group errors.
  for (const row of rows) invoiceImportTotals({ ...row, lines: row.lines.map(line => ({ ...line, taxRateId: null })) });
  const prepared: { row: InvoiceImportRow; error?: string }[] = [];
  for (const row of rows) {
    try { await db.transaction(tx => validateImport(tx, ctx, row)); prepared.push({ row }); }
    catch (err) {
      if (err instanceof WireCompatibilityError) throw err;
      prepared.push({ row, error: message(err) });
    }
  }
  const [job] = await db.insert(bulkImportJob).values({ organizationId: ctx.organizationId, type: "invoices",
    fileName: parsed.fileName, totalRows: rows.length, status: "processing", createdBy: ctx.userId }).returning();
  let processedRows = 0;
  const errorDetails: { row: number; error: string }[] = [];
  for (const [index, group] of prepared.entries()) {
    if (group.error) { errorDetails.push({ row: index + 1, error: group.error }); continue; }
    try {
      const created = await db.transaction(async tx => {
        const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
        if (!org) throw new AuthError("Organization not found", 404);
        const totals = await validateImport(tx, ctx, group.row);
        await checkMonthlyLimit(ctx.organizationId, invoice, invoice.organizationId, invoice.createdAt, "invoicesPerMonth", invoice.deletedAt);
        const [created] = await tx.insert(invoice).values({ organizationId: ctx.organizationId, contactId: group.row.contactId,
          invoiceNumber: await nextNumber(tx, ctx.organizationId), issueDate: group.row.issueDate, dueDate: group.row.dueDate,
          reference: group.row.reference || null, currencyCode: group.row.currencyCode, subtotal: totals.subtotal,
          taxTotal: totals.taxTotal, total: totals.total, amountPaid: 0, amountDue: totals.total, createdBy: ctx.userId }).returning();
        await tx.insert(invoiceLine).values(totals.processedLines.map(line => ({ ...line, invoiceId: created.id })));
        lifecycleDto(created); return created;
      });
      processedRows++;
      await logAudit({ ctx, action: "create", entityType: "invoice", entityId: created.id, changes: { jobId: job.id }, request });
    } catch (err) { errorDetails.push({ row: index + 1, error: message(err) }); }
  }
  const [updated] = await db.update(bulkImportJob).set({ processedRows, errorRows: errorDetails.length,
    errorDetails: errorDetails.length ? errorDetails : null, status: errorDetails.length === rows.length ? "failed" : "completed", completedAt: new Date() })
    .where(and(eq(bulkImportJob.id, job.id), eq(bulkImportJob.organizationId, ctx.organizationId))).returning();
  await logAudit({ ctx, action: "import", entityType: "invoice", entityId: ctx.organizationId, changes: { count: processedRows, jobId: job.id }, request });
  return { job: updated };
}

async function selected(tx: Tx, ctx: AuthContext, ids: string[]) {
  await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  const rows = await tx.select().from(invoice).where(scope(ctx, ids)).for("update");
  for (const row of rows) {
    lifecycleDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate); rateDateSchema.parse(row.dueDate);
    const [customer] = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId))).for("share");
    if (!customer) throw new WireCompatibilityError("Invoice customer belongs to another organization");
    const lines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, row.id));
    lines.forEach(publicLineDto);
    safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.amount), 0n));
    safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n));
    safeInvoiceMinor(BigInt(row.subtotal) + BigInt(row.taxTotal));
    await references(tx, ctx.organizationId, row.contactId, lines.map(line => ({ ...line, quantity: line.quantity / 100 })), true);
  }
  return rows;
}

/** Whole-batch accounting transaction. Foreign/deleted/non-draft IDs remain ignored. */
export async function bulkSendInvoices(ctx: AuthContext, input: unknown, request?: Request, maximum = 100) {
  requireRole(ctx, "approve:invoices");
  const ids = [...new Set(z.array(z.string().uuid()).min(1).max(maximum).parse(input))];
  const updated = await db.transaction(async tx => {
    const rows = await selected(tx, ctx, ids);
    const eligible = new Map(rows.filter(row => row.status === "draft").map(row => [row.id, row]));
    const sent: string[] = [];
    for (const id of ids) if (eligible.has(id)) { await sendInvoiceInTransaction(tx, ctx, id); sent.push(id); }
    return sent;
  });
  for (const id of updated) await logAudit({ ctx, action: "send", entityType: "invoice", entityId: id, changes: { bulk: true }, request });
  return { updated: updated.length, ids: updated };
}

/** Compatibility annotation only. Payment/allocation/settlement posting belongs to MON-021. */
export async function bulkMarkInvoicesPaid(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const { ids } = z.object(invoiceBulkIdsFields).parse({ ids: input });
  const updated = await db.transaction(async tx => {
    const rows = await selected(tx, ctx, [...new Set(ids)]);
    const eligible = rows.filter(row => ["sent", "partial", "overdue"].includes(row.status));
    for (const row of eligible) {
      if (row.total <= 0 || row.amountPaid < 0 || row.amountDue <= 0 || BigInt(row.amountPaid) + BigInt(row.amountDue) !== BigInt(row.total))
        throw new WireCompatibilityError("Invoice balances must agree before marking paid");
      const lines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, row.id));
      if (BigInt(row.subtotal) + BigInt(row.taxTotal) !== BigInt(row.total) ||
        lines.reduce((sum, line) => sum + BigInt(line.amount), 0n) !== BigInt(row.subtotal) ||
        lines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n) !== BigInt(row.taxTotal))
        throw new WireCompatibilityError("Invoice header and line totals must agree before marking paid");
      await assertNotLocked(ctx.organizationId, row.issueDate, ctx);
    }
    for (const row of eligible) await tx.update(invoice).set({ status: "paid", amountPaid: row.total, amountDue: 0, paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoice.id, row.id), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt)));
    return eligible.map(row => row.id);
  });
  if (updated.length) await logAudit({ ctx, action: "pay", entityType: "invoice", entityId: ctx.organizationId,
    changes: { count: updated.length, ids: updated, bulk: true, annotationOnly: true }, request });
  return { updated: updated.length };
}

type BulkResult = { invoiceId: string; status: "sent" | "skipped" | "failed"; message?: string };
export function invoiceBulkSummary(results: BulkResult[]) {
  return { total: results.length, sent: results.filter(row => row.status === "sent").length,
    skipped: results.filter(row => row.status === "skipped").length, failed: results.filter(row => row.status === "failed").length };
}
export async function bulkSendReminders(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:recurring");
  const { invoiceIds } = z.object(invoiceReminderFields).parse({ invoiceIds: input });
  const ids = [...new Set(invoiceIds)];
  // Validate all saved monetary values/references before external delivery or dunning writes.
  const rows = await db.transaction(tx => selected(tx, ctx, ids));
  const config = await db.query.emailConfig.findFirst({ where: eq(emailConfig.organizationId, ctx.organizationId) });
  if (!config?.isVerified) throw new AuthError("Email is not set up yet. Connect and verify your email to send reminders.", 400);
  const org = await db.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
  const byId = new Map(rows.map(row => [row.id, row]));
  const results: BulkResult[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { results.push({ invoiceId: id, status: "skipped", message: "Not found" }); continue; }
    if (!["sent", "partial", "overdue"].includes(row.status) || row.amountDue <= 0) {
      results.push({ invoiceId: id, status: "skipped", message: "Nothing owed on this invoice" }); continue;
    }
    const customer = await db.query.contact.findFirst({ where: and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId)) });
    if (!customer?.email) { results.push({ invoiceId: id, status: "skipped", message: "Customer has no email" }); continue; }
    const vars = { contactName: customer.name, documentNumber: row.invoiceNumber, amountDue: formatInvoiceReminderAmount(row.amountDue, row.currencyCode),
      dueDate: row.dueDate, organizationName: org?.name || "" };
    const subject = renderTemplate("Reminder: invoice {{documentNumber}} from {{organizationName}}", vars);
    const html = renderTemplate("<p>Hi {{contactName}},</p><p>This is a friendly reminder that invoice <strong>{{documentNumber}}</strong> for <strong>{{amountDue}}</strong> was due on {{dueDate}}.</p><p>If you've already paid, please ignore this message. Thank you!</p><p>{{organizationName}}</p>", vars);
    try {
      await sendEmail(config, { to: customer.email, subject, html });
      await db.transaction(async tx => {
        await tx.insert(reminderLog).values({ organizationId: ctx.organizationId, documentType: "invoice", documentId: id, recipientEmail: customer.email!, subject, status: "sent" });
        await tx.update(invoice).set({ dunningLevel: sql`${invoice.dunningLevel} + 1` }).where(scope(ctx, [id]));
      });
      results.push({ invoiceId: id, status: "sent", message: `Sent to ${customer.email}` });
    } catch (err) {
      const error = message(err);
      await db.insert(reminderLog).values({ organizationId: ctx.organizationId, documentType: "invoice", documentId: id, recipientEmail: customer.email, subject, status: "failed", errorMessage: error });
      results.push({ invoiceId: id, status: "failed", message: error });
    }
  }
  await logAudit({ ctx, action: "bulk-send-reminder", entityType: "invoice", entityId: ids.join(","), changes: { requested: ids.length, sent: invoiceBulkSummary(results).sent }, request });
  return { action: "send-reminder", results, summary: invoiceBulkSummary(results) };
}
