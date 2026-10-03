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

      let pdfBuffer: Buffer | undefined;
      let pdfFilename: string | undefined;

      if (attachPdf) {
        try {
          const { renderInvoicePdf } = await import("@/lib/documents/pdf-renderer");
          const org = await db.query.organization.findFirst({
            where: eq(organization.id, ctx.organizationId),
          });
          const buf = await renderInvoicePdf(
            {
              invoiceNumber: found.invoiceNumber,
              issueDate: found.issueDate,
              dueDate: found.dueDate,
              currencyCode: found.currencyCode,
              lines: found.lines.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                taxAmount: l.taxAmount,
                amount: l.amount,
              })),
              subtotal: found.subtotal,
              taxTotal: found.taxTotal,
              total: found.total,
              notes: found.notes,
            },
            { name: org?.name || "" },
            found.contact ? { name: found.contact.name } : { name: "Unknown" },
            {}
          );
          pdfBuffer = Buffer.from(buf);
          pdfFilename = `invoice-${found.invoiceNumber}.pdf`;
        } catch {
          // PDF generation failed, send without attachment
        }
      }

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
