import { db } from "@/lib/db";
import { paymentBatch, payment, journalEntry, organization, auditLog } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { paymentBatchDto } from "./payment-batches";
import { batchIdField, remittanceFields, remittanceSendSchema } from "./payment-batch-wire";
import { publicMoneyDto } from "./public-money-wire";
import { safeInvoiceMinor } from "./invoice-write-wire";
import { formatInvoiceReminderAmount } from "./invoice-bulk-wire";
import { sendDocumentEmail } from "@/lib/email/document-sender";
import { logAudit } from "./audit";
import { z } from "zod";

export interface RemittanceLine {
  billId: string; billNumber: string; billDate: string; billReference: string | null;
  billTotal: number; billTotalMinor: string; amountPaid: number; amountPaidMinor: string; currencyCode: string;
}
export interface RemittanceGroup {
  contactId: string; contactName: string; contactEmail: string | null; currencyCode: string;
  totalPaid: number; totalPaidMinor: string; lines: RemittanceLine[];
}
export interface BatchRemittance {
  batch: typeof paymentBatch.$inferSelect & { totalAmountMinor: string }; groups: RemittanceGroup[];
}

export async function buildBatchRemittance(organizationId: string, batchId: string): Promise<BatchRemittance | null> {
  batchIdField.parse(batchId);
  return db.transaction(async tx => {
    const batch = await tx.query.paymentBatch.findFirst({ where: and(eq(paymentBatch.id, batchId),
      eq(paymentBatch.organizationId, organizationId), isNull(paymentBatch.deletedAt)), with: { items: true } });
    if (!batch) return null;
    const dto = await paymentBatchDto(tx, { organizationId }, batch, true);
    if (batch.status !== "completed") throw new AuthError("Remittance requires a completed payment batch", 400);
    const [submission] = await tx.select({ changes: auditLog.changes }).from(auditLog).where(and(eq(auditLog.organizationId, organizationId),
      eq(auditLog.entityType, "payment_batch"), eq(auditLog.entityId, batchId), eq(auditLog.action, "submit")));
    const parsed = z.object({ settlements: z.array(z.object({ itemId: z.string().uuid(), paymentId: z.string().uuid() })).max(1000) })
      .safeParse(submission?.changes);
    const links = parsed.success ? parsed.data.settlements : undefined;
    if (!links || links.length !== batch.items.length || new Set(links.map(link => link.itemId)).size !== links.length ||
      new Set(links.map(link => link.paymentId)).size !== links.length)
      throw new WireCompatibilityError("Remittance requires qualified batch settlement provenance; legacy status alone cannot prove payment");
    const groups = new Map<string, RemittanceGroup>();
    for (const item of dto.items) {
      if (item.status !== "completed") throw new WireCompatibilityError("Completed batch has an unpaid item");
      const link = links.find(link => link.itemId === item.id);
      const paid = link && await tx.query.payment.findFirst({ where: and(eq(payment.id, link.paymentId),
        eq(payment.organizationId, organizationId)), with: { allocations: true } });
      if (!paid || paid.deletedAt) throw new AuthError("Batch payment was reversed or is unavailable; remittance cannot claim it was paid", 409);
      publicMoneyDto(paid, ["amount"]);
      if (paid.contactId !== item.contactId || paid.currencyCode !== item.currencyCode || paid.type !== "made" || !paid.journalEntryId ||
        paid.amount !== item.amount || paid.allocations.length !== 1 || paid.allocations[0].documentId !== item.billId ||
        paid.allocations[0].documentType !== "bill" || paid.allocations[0].amount !== item.amount)
        throw new WireCompatibilityError("Batch payment provenance disagrees with item allocation");
      const entry = await tx.query.journalEntry.findFirst({ where: and(eq(journalEntry.id, paid.journalEntryId), eq(journalEntry.organizationId, organizationId)) });
      if (!entry || entry.status !== "posted" || entry.deletedAt || entry.reversedByEntryId || entry.sourceType !== "payment" ||
        entry.sourceId !== paid.id || entry.date !== paid.date || paid.date !== resolveBatchPaymentDate(batch))
        throw new WireCompatibilityError("Remittance payment journal is unavailable, reversed or inconsistent");
      const doc = item.bill!, party = item.contact!;
      if (!groups.has(party.id)) groups.set(party.id, { contactId: party.id, contactName: party.name,
        contactEmail: party.email, currencyCode: item.currencyCode, totalPaid: 0, totalPaidMinor: "0", lines: [] });
      const group = groups.get(party.id)!;
      group.lines.push(publicMoneyDto({ billId: doc.id, billNumber: doc.billNumber, billDate: doc.issueDate,
        billReference: doc.reference, billTotal: doc.total, amountPaid: item.amount, currencyCode: item.currencyCode }, ["billTotal", "amountPaid"]));
      group.totalPaid = safeInvoiceMinor(BigInt(group.totalPaid) + BigInt(item.amount));
      group.totalPaidMinor = String(group.totalPaid);
    }
    const result = { batch: publicMoneyDto(batch, ["totalAmount"]), groups: [...groups.values()] };
    stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export function resolveBatchPaymentDate(batch: typeof paymentBatch.$inferSelect): string {
  return (batch.submittedAt ?? batch.completedAt ?? batch.createdAt).toISOString().slice(0, 10);
}
export async function getBatchRemittance(ctx: AuthContext, id: string, input: unknown = {}, transport: "rest" | "mcp" = "rest") {
  requireRole(ctx, "manage:payments");
  const parsed = z.object(remittanceFields).strict().parse(input), result = await buildBatchRemittance(ctx.organizationId, id);
  if (!result) throw new AuthError("Payment batch not found", 404);
  const groups = parsed.contactId ? result.groups.filter(group => group.contactId === parsed.contactId) : result.groups;
  if (parsed.contactId && !groups.length) throw new AuthError("No remittance found for the given contact in this batch", 404);
  const batch = result.batch;
  return { batch: { id: batch.id, name: batch.name, status: batch.status, totalAmount: batch.totalAmount,
    totalAmountMinor: batch.totalAmountMinor, paymentCount: batch.paymentCount, currencyCode: batch.currencyCode, paymentDate: resolveBatchPaymentDate(batch),
    ...(transport === "rest" ? { submittedAt: batch.submittedAt, completedAt: batch.completedAt }
      : {}) }, remittances: groups };
}
function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
export function renderRemittanceHtml(
  orgName: string,
  group: RemittanceGroup,
  batchName: string,
  paymentDate: string,
  personalMessage?: string
): string {
  const formatDate = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    return dt.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const fmt = (minor: number) => formatInvoiceReminderAmount(minor, group.currencyCode);
  orgName = escapeHtml(orgName); batchName = escapeHtml(batchName);
  personalMessage = personalMessage === undefined ? undefined : escapeHtml(personalMessage);

  const rows = group.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${formatDate(l.billDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(l.billNumber)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(l.billReference || "-")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:monospace;">${fmt(l.billTotal)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:monospace;">${fmt(l.amountPaid)}</td>
      </tr>`
    )
    .join("\n");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;padding:0;margin:0;">
  <div style="max-width:700px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 4px;">Remittance Advice</h1>
    <p style="font-size:13px;color:#666;margin:0 0 24px;">${orgName}</p>

    <table style="width:100%;margin-bottom:16px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;"><strong>${escapeHtml(group.contactName)}</strong></td>
        <td style="font-size:12px;text-align:right;color:#666;">Payment date: ${formatDate(paymentDate)}</td>
      </tr>
    </table>

    ${
      personalMessage
        ? `<p style="font-size:13px;color:#525f7f;line-height:22px;margin:0 0 24px;white-space:pre-wrap;">${personalMessage}</p>`
        : ""
    }

    <p style="font-size:13px;color:#444;margin:0 0 16px;">
      The following bills have been paid${batchName ? ` (batch: ${batchName})` : ""}:
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Bill Date</th>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Bill #</th>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Reference</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Bill Total</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Amount Paid</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:#f9f9f9;">
          <td colspan="4" style="padding:8px;font-size:12px;font-weight:600;border-bottom:1px solid #ddd;">Total Paid</td>
          <td style="padding:8px;font-size:12px;font-weight:600;text-align:right;font-family:monospace;border-bottom:1px solid #ddd;">${fmt(group.totalPaid)}</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size:11px;color:#999;margin-top:24px;">
      This remittance advice was generated by ${orgName}.
    </p>
  </div>
</body>
</html>`;
}

export async function sendBatchRemittance(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments");
  const parsed = remittanceSendSchema.parse(input);
  // Preflight every group and render every email before the first delivery/log write.
  const data = await getBatchRemittance(ctx, id, { contactId: parsed.contactId }, "mcp");
  const org = await db.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
  const orgName = org?.name || "Organization";
  const messages = data.remittances.map(group => ({ group,
    html: renderRemittanceHtml(orgName, group, data.batch.name, data.batch.paymentDate!, parsed.personalMessage),
    subject: `Remittance advice from ${orgName} - ${formatInvoiceReminderAmount(group.totalPaid, group.currencyCode)}` }));
  const sent: { contactId: string; recipientEmail: string }[] = [], skipped: { contactId: string; reason: string }[] = [];
  for (const { group, html, subject } of messages) {
    if (!group.contactEmail) { skipped.push({ contactId: group.contactId, reason: "Supplier has no email address" }); continue; }
    await sendDocumentEmail({ orgId: ctx.organizationId, userId: ctx.userId, documentType: "remittance_advice", documentId: id,
      recipientEmail: group.contactEmail, subject, body: html, attachPdf: false, replyTo: org?.contactEmail || undefined });
    sent.push({ contactId: group.contactId, recipientEmail: group.contactEmail });
  }
  await logAudit({ ctx, action: "send_remittance", entityType: "payment_batch", entityId: id,
    changes: { sentCount: sent.length, skippedCount: skipped.length }, request });
  return { success: true, sent, skipped };
}
