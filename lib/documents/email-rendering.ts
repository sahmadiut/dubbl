import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { documentEmailLog, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { renderDocument } from "./render-service";
import { renderId, documentMoneyText } from "./render-wire";
import { exactMinorSchema, legacyMinor } from "@/lib/money/wire";
import { reportDateSchema } from "@/lib/reports/statement-wire";
import { renderDocumentEmailHtml } from "@/lib/email/render-document-email";
import { sendDocumentEmail } from "@/lib/email/document-sender";

const label = (description: string) => z.string().max(10000).describe(description);
export const emailPreviewSchema = z.strictObject({
  organizationName: label("Organization display name"), contactName: label("Contact display name"),
  documentType: z.enum(["invoice", "quote", "credit_note", "purchase_order", "debit_note"]).describe("Document presentation type"),
  documentNumber: label("Document display number"), personalMessage: label("Optional message text").optional(),
  amountFormatted: label("Already formatted amount text; no numeric conversion or money input").optional(),
  dueDateFormatted: label("Formatted due date text").optional(), issueDateFormatted: label("Formatted issue date text").optional(),
  viewUrl: z.string().url().max(2048).refine(v => ["http:", "https:"].includes(new URL(v).protocol)).optional().describe("Optional HTTP(S) document link"),
  buttonLabel: label("Optional link button text").optional(),
});
export async function previewDocumentEmail(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:invoices");
  return { html: await renderDocumentEmailHtml(emailPreviewSchema.parse(input)) };
}
export const sendDocumentSchema = z.strictObject({
  documentType: emailPreviewSchema.shape.documentType, documentId: renderId,
  documentNumber: label("Document display number"), recipientEmail: z.string().email().describe("Recipient email address"),
  recipientName: label("Recipient display name"), personalMessage: label("Optional message").optional(),
  amountCents: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional().describe("Legacy integer document-currency minor amount (USD cents); optional display override"),
  amountMinor: exactMinorSchema.optional().describe("Exact minor-unit display override within safe numeric range; must agree with amountCents"),
  dueDate: reportDateSchema.optional().describe("Optional real Gregorian due date YYYY-MM-DD"),
  issueDate: reportDateSchema.optional().describe("Optional real Gregorian issue date YYYY-MM-DD"),
  attachPdf: z.boolean().default(false).describe("Attach the validated document PDF using saved currency"),
  buttonLabel: label("Optional link button text").optional(),
});
export async function sendRenderedDocumentEmail(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:invoices");
  const parsed = sendDocumentSchema.parse(input);
  if (parsed.amountCents !== undefined && parsed.amountMinor !== undefined && BigInt(parsed.amountCents) !== BigInt(parsed.amountMinor))
    throw new z.ZodError([{ code: "custom", path: ["amountMinor"], message: "Amount aliases disagree" }]);
  const amount = parsed.amountMinor !== undefined ? legacyMinor(BigInt(parsed.amountMinor)) : parsed.amountCents;
  const rendered = await renderDocument(ctx, parsed.documentType, parsed.documentId, parsed.attachPdf ? "pdf" : "html");
  const org = await db.query.organization.findFirst({ where: and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)) });
  if (!org) throw new AuthError("Organization not found", 404);
  const fmtDate = (date?: string) => date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : undefined;
  const html = await renderDocumentEmailHtml({ organizationName: org.name, contactName: parsed.recipientName,
    documentType: parsed.documentType, documentNumber: parsed.documentNumber, personalMessage: parsed.personalMessage,
    amountFormatted: amount === undefined ? undefined : documentMoneyText(amount, rendered.document.currencyCode),
    dueDateFormatted: fmtDate(parsed.dueDate), issueDateFormatted: fmtDate(parsed.issueDate), buttonLabel: parsed.buttonLabel });
  const result = await sendDocumentEmail({ orgId: ctx.organizationId, userId: ctx.userId, documentType: parsed.documentType, documentId: parsed.documentId,
    recipientEmail: parsed.recipientEmail, subject: `${parsed.documentType.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase())} ${parsed.documentNumber} from ${org.name}`,
    body: html, attachPdf: parsed.attachPdf, ...(parsed.attachPdf ? { pdfBuffer: Buffer.from(rendered.content, "base64"), pdfFilename: rendered.filename } : {}), replyTo: org.contactEmail || undefined });
  return { success: true, emailLogId: result.id, status: result.status };
}
export async function resendDocumentEmail(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:invoices"); renderId.parse(id);
  const entry = await db.query.documentEmailLog.findFirst({ where: and(eq(documentEmailLog.id, id), eq(documentEmailLog.organizationId, ctx.organizationId)) });
  const org = await db.query.organization.findFirst({ where: and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)) });
  if (!entry || !org) throw new AuthError("Email log entry not found", 404);
  const kind = z.enum(["invoice", "quote", "credit_note", "purchase_order", "debit_note"]).parse(entry.documentType);
  // Validate the owning document even without an attachment. Failed rendering
  // must not silently send a different email or create a success log.
  const rendered = await renderDocument(ctx, kind, entry.documentId, entry.attachPdf ? "pdf" : "html");
  const result = await sendDocumentEmail({ orgId: ctx.organizationId, userId: ctx.userId, documentType: kind, documentId: entry.documentId,
    recipientEmail: entry.recipientEmail, subject: entry.subject, body: entry.body, attachPdf: entry.attachPdf,
    ...(entry.attachPdf ? { pdfBuffer: Buffer.from(rendered.content, "base64"), pdfFilename: rendered.filename } : {}), replyTo: org.contactEmail || undefined });
  return { emailLog: result };
}
