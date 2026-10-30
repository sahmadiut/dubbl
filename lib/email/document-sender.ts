import { db } from "@/lib/db";
import { documentEmailLog, emailConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkEmailLimit } from "@/lib/api/check-limit";
import { sendPlatformEmail } from "@/lib/email/resend-client";
import { sendEmail } from "@/lib/email/smtp-client";

interface SendDocumentEmailOptions {
  orgId: string;
  userId: string;
  documentType: string;
  documentId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attachPdf: boolean;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  replyTo?: string;
}

/** Shared transport preparation only. The trusted caller owns its durable log,
 * limit checks and final authorization boundary; this never retries or logs. */
export async function prepareDocumentEmailDelivery(options: SendDocumentEmailOptions) {
  const smtp = await db.query.emailConfig.findFirst({ where: eq(emailConfig.organizationId, options.orgId) });
  const attachments = options.attachPdf && options.pdfBuffer && options.pdfFilename
    ? [{ filename: options.pdfFilename, content: options.pdfBuffer }] : undefined;
  return () => smtp?.isVerified
    ? sendEmail(smtp, { to: options.recipientEmail, subject: options.subject, html: options.body, attachments })
    : sendPlatformEmail({ to: options.recipientEmail, subject: options.subject, html: options.body,
      from: "dubbl <invoices@dubbl.dev>", replyTo: options.replyTo || undefined, attachments });
}

export async function sendDocumentEmail(options: SendDocumentEmailOptions): Promise<{
  id: string;
  status: "sent" | "failed";
}> {
  // Check email limit
  await checkEmailLimit(options.orgId);

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;

  try {
    await (await prepareDocumentEmailDelivery(options))();
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  // Insert log entry
  const [logEntry] = await db
    .insert(documentEmailLog)
    .values({
      organizationId: options.orgId,
      documentType: options.documentType,
      documentId: options.documentId,
      recipientEmail: options.recipientEmail,
      subject: options.subject,
      body: options.body,
      attachPdf: options.attachPdf,
      status,
      errorMessage,
      sentBy: options.userId,
    })
    .returning();

  if (status === "failed") {
    throw new Error(errorMessage || "Failed to send email");
  }

  return { id: logEntry.id, status };
}
