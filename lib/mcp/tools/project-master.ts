import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { executeProjectOperation } from "@/lib/api/project-master";
import { projectOperations } from "@/lib/api/project-master-operations";
import { wrapTool } from "@/lib/mcp/errors";

export function registerProjectMasterTools(server: McpServer, ctx: AuthContext) {
  for (const op of projectOperations) server.registerTool(op.name, {
    description: op.description, inputSchema: op.schema,
  }, params => wrapTool(ctx, () => executeProjectOperation(ctx, op.name, params)));
}
