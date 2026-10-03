import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { ok, handleError } from "@/lib/api/response";
import { sendCreditNote } from "@/lib/api/credits";
import { sendDocumentEmail } from "@/lib/email/document-sender";
import { renderDocumentEmailHtml } from "@/lib/email/render-document-email";
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
  attachPdf: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    requireRole(ctx, "manage:credit-notes");
    const text = await request.text();
    let body: unknown = {};
    if (text.trim()) {
      try { body = JSON.parse(text); }
      catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON send body" }]); }
    }
    const options = z.object({ sendEmail: z.boolean().optional() }).passthrough().parse(body);
    const email = options.sendEmail === true ? sendBodySchema.parse(body) : null;
    const result = await sendCreditNote(ctx, id, request);
    if (email) {
      const org = await db.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
      await sendDocumentEmail({ orgId: ctx.organizationId, userId: ctx.userId, documentType: "credit_note", documentId: id,
        recipientEmail: email.recipientEmail, subject: email.subject, body: await renderDocumentEmailHtml(email.templateProps),
        attachPdf: false, replyTo: org?.contactEmail || undefined });
    }
    return ok({ creditNote: result.creditNote });
  } catch (err) { return handleError(err); }
}
