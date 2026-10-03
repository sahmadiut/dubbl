import { db } from "@/lib/db";
import { organization, portalAccessToken } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { sendQuote } from "@/lib/api/quotes";
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
  attachPdf: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    const text = await request.text();
    let rawBody: unknown = {};
    if (text.trim()) {
      try { rawBody = JSON.parse(text); }
      catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON send body" }]); }
    }
    const options = z.object({ sendEmail: z.boolean().optional() }).passthrough().parse(rawBody);
    const emailParsed = options.sendEmail === true ? sendBodySchema.safeParse(rawBody) : null;
    if (emailParsed && !emailParsed.success) throw emailParsed.error;
    const result = await sendQuote(ctx, id, request);
    const found = result.quote;

    if (emailParsed?.success) {
      const { recipientEmail, subject, templateProps } = emailParsed.data;

      // Generate portal access URL for the quote
      if (found.contactId) {
        let token = await db.query.portalAccessToken.findFirst({
          where: and(
            eq(portalAccessToken.organizationId, ctx.organizationId),
            eq(portalAccessToken.contactId, found.contactId),
            isNull(portalAccessToken.revokedAt),
          ),
        });
        if (!token) {
          const [created] = await db
            .insert(portalAccessToken)
            .values({
              organizationId: ctx.organizationId,
              contactId: found.contactId,
              token: randomBytes(32).toString("hex"),
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })
            .returning();
          token = created;
        }
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        templateProps.viewUrl = `${APP_URL}/portal/${token.token}/quotes`;
        templateProps.buttonLabel = "View quote";
      }

      const html = await renderDocumentEmailHtml(templateProps);
      const org = await db.query.organization.findFirst({
        where: eq(organization.id, ctx.organizationId),
      });

      await sendDocumentEmail({
        orgId: ctx.organizationId,
        userId: ctx.userId,
        documentType: "quote",
        documentId: id,
        recipientEmail,
        subject,
        body: html,
        attachPdf: false,
        replyTo: org?.contactEmail || undefined,
      });
    }

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
