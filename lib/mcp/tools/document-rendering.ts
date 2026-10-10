import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { previewDocumentTemplate, renderDocument } from "@/lib/documents/render-service";
import { renderFormat, renderId } from "@/lib/documents/render-wire";
import { renderPortalStatement } from "@/lib/documents/portal-statement";
import { statementFields } from "@/lib/api/contact-statement-wire";
import { emailPreviewSchema, previewDocumentEmail } from "@/lib/documents/email-rendering";

export function registerDocumentRenderingTools(server: McpServer, ctx: AuthContext) {
  for (const kind of ["invoice", "quote", "credit_note", "purchase_order", "debit_note"] as const) {
    server.registerTool(`render_${kind}`, {
      description: `Render an organization-owned live ${kind} as HTML or PDF. Requires view:data; validates contact ownership, saved party text and safe integer minor units (USD cents) before rendering. Returns content (HTML or PDF base64), filename, contentType, and document data with numeric money plus exact *Minor strings and saved currency. Quantity remains hundredths.`,
      inputSchema: z.strictObject({ id: renderId, format: renderFormat }),
    }, params => wrapTool(ctx, () => renderDocument(ctx, kind, params.id, params.format)));
  }
  server.registerTool("preview_document_template", {
    description: "Render an owned live template using sample amounts in organization currency minor units. Requires manage:invoices. Returns HTML or PDF base64, filename, contentType and sample document numeric money with *Minor strings. Read-only; does not send email.",
    inputSchema: z.strictObject({ id: renderId, format: renderFormat }),
  }, params => wrapTool(ctx, () => previewDocumentTemplate(ctx, params.id, params.format)));
  const token = z.string().min(1).max(256).describe("Existing opaque capability token in the authenticated organization");
  server.registerTool("render_payment_link_invoice", {
    description: "Render an existing payment-link invoice in the authenticated organization. Rejects draft/void/deleted documents and foreign contacts. Returns HTML or PDF base64 and document money in safe numeric minor units with exact *Minor strings and saved currency.",
    inputSchema: z.strictObject({ token, format: renderFormat }),
  }, params => wrapTool(ctx, () => renderDocument(ctx, "invoice", "", params.format, { type: "pay", token: params.token })));
  server.registerTool("render_portal_invoice", {
    description: "Render an invoice belonging to an existing portal token's contact in the authenticated organization. Returns HTML or PDF base64, filename, contentType and document numeric minor units with exact *Minor strings and currency. Requires view:data and an active capability.",
    inputSchema: z.strictObject({ token, id: renderId, format: renderFormat }),
  }, params => wrapTool(ctx, () => renderDocument(ctx, "invoice", params.id, params.format, { type: "portal", token: params.token })));
  server.registerTool("render_portal_statement", {
    description: "Render the exact dated statement for an existing portal token in the authenticated organization. Returns HTML or PDF base64 with single-currency statement numeric minor units and *Minor strings. Mixed currencies require a currencyCode filter. Read-only; token limits contact scope.",
    inputSchema: z.strictObject({ token: z.string().min(1).max(256).describe("Existing opaque portal capability token"), format: renderFormat, ...statementFields }),
  }, params => wrapTool(ctx, () => { const { token, format, ...input } = params; return renderPortalStatement(token, input, format, ctx); }));
  server.registerTool("preview_document_email", {
    description: "Preview document email HTML using display labels; amountFormatted is text, never a money input. Requires manage:invoices; does not send email. Returns {html}.", inputSchema: emailPreviewSchema,
  }, params => wrapTool(ctx, () => previewDocumentEmail(ctx, params)));
}
