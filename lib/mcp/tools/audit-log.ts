import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { auditLogSchema, listAuditLog } from "@/lib/api/audit-log";
import { wrapTool } from "../errors";

export function registerAuditLogTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_audit_log", {
    description: "Read this organization's paginated audit history with view:audit-log and plan retention. Returns data and pagination, saved actor/UTC instant and opaque changes in originating units. Exact strings stay intact; no inferred Minor aliases. Unsupported numeric history rejects with LEGACY_NUMERIC_RANGE (422). No history mutation.",
    inputSchema: auditLogSchema,
  }, input => wrapTool(ctx, () => listAuditLog(ctx, input)));
}
