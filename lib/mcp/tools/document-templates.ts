import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { listDocumentTemplates, getDocumentTemplate, createDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate,
  templateCreateSchema, templateUpdateSchema, templateIdSchema } from "@/lib/api/document-template-settings";

export function registerDocumentTemplateTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_document_templates", {
    description: "List live organization-owned document templates in creation order. Returns templates with saved presentation fields; no monetary input.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => listDocumentTemplates(ctx)));
  server.registerTool("get_document_template", {
    description: "Get one live organization-owned document template by UUID. Returns template or not found.",
    inputSchema: z.strictObject({ id: templateIdSchema }),
  }, p => wrapTool(ctx, () => getDocumentTemplate(ctx, p.id)));
  server.registerTool("create_document_template", {
    description: "Create a document template; requires manage:invoices. Saved HTML and template tokens are caller content. Setting default replaces the default for the same type. Returns template.",
    inputSchema: templateCreateSchema.strict(),
  }, p => wrapTool(ctx, () => createDocumentTemplate(ctx, p)));
  server.registerTool("update_document_template", {
    description: "Patch a live template; requires manage:invoices. Omitted fields remain unchanged, nullable fields accept null, type is immutable. Setting default replaces the same-type default. Returns template.",
    inputSchema: templateUpdateSchema.extend({ id: templateIdSchema }).strict(),
  }, ({ id, ...p }) => wrapTool(ctx, () => updateDocumentTemplate(ctx, id, p)));
  server.registerTool("delete_document_template", {
    description: "Soft-delete a live organization-owned document template; requires manage:invoices. Returns success; template remains recoverable in trash.",
    inputSchema: z.strictObject({ id: templateIdSchema }),
  }, p => wrapTool(ctx, () => deleteDocumentTemplate(ctx, p.id)));
}
