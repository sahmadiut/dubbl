import { Resend } from "resend";
import { EmailDeliveryRejectedError } from "./delivery-errors";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}

/**
 * Send a platform-level email using the RESEND_API_KEY env var.
 * Used for system emails like notification digests.
 */
export async function sendPlatformEmail(options: EmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable not set");
  }

  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from: options.from || "dubbl <noreply@dubbl.dev>",
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo || undefined,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });
  // The SDK resolves API rejections rather than throwing. Never record those
  // responses as confirmed delivery, or persist their payload in AI metadata.
  if (result.error) throw new EmailDeliveryRejectedError();
  if (!result.data?.id) throw new Error("Email provider acknowledgement unavailable");
}
