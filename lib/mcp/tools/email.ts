import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { documentEmailLog } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { wrapTool } from "@/lib/mcp/errors";
import { sendDocumentSchema, sendRenderedDocumentEmail, resendDocumentEmail } from "@/lib/documents/email-rendering";
import { renderId } from "@/lib/documents/render-wire";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerEmailTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("send_document_email", {
    description: "Send a branded email after validating an owned live document and references. Requires manage:invoices and view:data. amountCents is a safe integer document-currency minor-unit display override (USD cents); amountMinor is its agreeing exact string alias. Uses saved currency for formatted amounts and PDF; errors fail before delivery/log mutation. Returns {success,emailLogId,status}; does not change document status.",
    inputSchema: sendDocumentSchema,
  }, params => wrapTool(ctx, () => sendRenderedDocumentEmail(ctx, params)));

  server.tool(
    "list_document_emails",
    "List email history for a document. Returns all emails sent for the given document, ordered by most recent first.",
    {
      documentType: z
        .enum(["invoice", "quote", "credit_note", "purchase_order", "debit_note"])
        .describe("Type of document"),
      documentId: z
        .string()
        .uuid()
        .describe("UUID of the document"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const emails = await db.query.documentEmailLog.findMany({
          where: and(
            eq(documentEmailLog.organizationId, ctx.organizationId),
            eq(documentEmailLog.documentType, params.documentType),
            eq(documentEmailLog.documentId, params.documentId)
          ),
          orderBy: desc(documentEmailLog.sentAt),
        });

        return {
          emails: emails.map((e) => ({
            id: e.id,
            recipientEmail: e.recipientEmail,
            subject: e.subject,
            status: e.status,
            attachPdf: e.attachPdf,
            sentAt: e.sentAt.toISOString(),
            errorMessage: e.errorMessage,
          })),
          count: emails.length,
        };
      })
  );

  server.registerTool("resend_document_email", {
    description: "Resend an owned email log after document/reference/money preflight. Requires manage:invoices and view:data. Uses saved currency and exact PDF formatting; rendering failures do not silently omit attachments. Returns {success,emailLogId,status}; provider failures retain a failed log.",
    inputSchema: z.strictObject({ emailLogId: renderId }),
  }, params => wrapTool(ctx, async () => {
    const result = await resendDocumentEmail(ctx, params.emailLogId);
    return { success: true, emailLogId: result.emailLog.id, status: result.emailLog.status };
  }));
}
