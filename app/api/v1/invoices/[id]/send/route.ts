import { db } from "@/lib/db";
import { invoice, organization } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { sendInvoice } from "@/lib/api/invoice-lifecycle";
import { sendDocumentEmail } from "@/lib/email/document-sender";
import { renderDocumentEmailHtml } from "@/lib/email/render-document-email";
import { randomBytes } from "crypto";
import { z } from "zod";
import { renderDocument } from "@/lib/documents/render-service";

const templatePropsSchema = z.object({
  organizationName: z.string(),
  contactName: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  personalMessage: z.string().optional(),
  amountFormatted: z.string().optional(),
  dueDateFormatted: z.string().optional(),
  issueDateFormatted: z.string().optional(),
  viewUrl: z.string().optional(),
  buttonLabel: z.string().optional(),
});

const sendBodySchema = z.object({
  sendEmail: z.literal(true),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  templateProps: templatePropsSchema,
  attachPdf: z.boolean().default(true),
  includePaymentLink: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const rawBody = await request.json().catch(() => ({}));
    // An explicitly requested email must validate before posting; never silently ignore invalid options.
    const emailParsed = rawBody?.sendEmail === true ? sendBodySchema.safeParse(rawBody) : null;
    if (emailParsed && !emailParsed.success) throw emailParsed.error;
    // Complete PDF/reference/range preflight before posting or creating a link.
    const attachment = emailParsed?.success && emailParsed.data.attachPdf
      ? await renderDocument(ctx, "invoice", id, "pdf") : null;
    const result = await sendInvoice(ctx, id, request);
    const found = (await db.query.invoice.findFirst({ where: and(eq(invoice.id, id), eq(invoice.organizationId, ctx.organizationId)), with: { lines: true, contact: true } }))!;
    // Send email if requested
    if (emailParsed?.success) {
      const { recipientEmail, subject, templateProps, attachPdf, includePaymentLink } = emailParsed.data;

      // Generate payment link if requested
      if (includePaymentLink) {
        let paymentLinkToken = found.paymentLinkToken;
        if (!paymentLinkToken) {
          paymentLinkToken = randomBytes(24).toString("hex");
          await db
            .update(invoice)
            .set({ paymentLinkToken, updatedAt: new Date() })
            .where(eq(invoice.id, id));
        }
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        templateProps.viewUrl = `${APP_URL}/pay/${paymentLinkToken}`;
        templateProps.buttonLabel = "Pay invoice";
      }

      // Render the structured email template to HTML
      const html = await renderDocumentEmailHtml(templateProps);

      const pdfBuffer = attachment ? Buffer.from(attachment.content, "base64") : undefined;
      const pdfFilename = attachment?.filename;

      // Get org contact email for reply-to
      const org = await db.query.organization.findFirst({
        where: eq(organization.id, ctx.organizationId),
      });

      await sendDocumentEmail({
        orgId: ctx.organizationId,
        userId: ctx.userId,
        documentType: "invoice",
        documentId: id,
        recipientEmail,
        subject,
        body: html,
        attachPdf,
        pdfBuffer,
        pdfFilename,
        replyTo: org?.contactEmail || undefined,
      });
    }

    // Return the committed lifecycle DTO, including any payment-link token created for email.
    if (emailParsed?.success && emailParsed.data.includePaymentLink) {
      const latest = await db.query.invoice.findFirst({ where: eq(invoice.id, id), columns: { paymentLinkToken: true } });
      result.invoice.paymentLinkToken = latest?.paymentLinkToken ?? null;
    }
    return ok(result);
  } catch (err) { return handleError(err); }
}
