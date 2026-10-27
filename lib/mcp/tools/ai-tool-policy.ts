import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "../errors";
import { configureToolPolicy, listToolPolicies, discoverAgentTools, discoverySchema, toolPolicySchema } from "@/lib/ai/tool-registry";

export function registerAiToolPolicyTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("configure_ai_tool_policy", { description: "Administration only, never available to ordinary chat. Configure organization or agent allowlist with optimistic version. Requires manage:ai-policy; cannot bypass actor/domain grants or enable unreviewed tools. Missing policy denies all operations.", inputSchema: toolPolicySchema }, input => wrapTool(ctx, () => configureToolPolicy(ctx, input)));
  server.registerTool("list_ai_tool_policies", { description: "Administration only, never available to ordinary chat. List this organization's current versioned allowlists. Requires manage:ai-policy. No business payloads or credentials returned.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listToolPolicies(ctx)));
  server.registerTool("list_authorized_ai_tools", { description: "Discover reviewed tools in the intersection of live actor grants and current organization/agent policies. Returns strict JSON input schemas, money/effect/retry/approval contracts; no arbitrary execution endpoint or automatic sensitive operations. Discovery alone never authorizes later dispatch.", inputSchema: discoverySchema }, input => wrapTool(ctx, () => discoverAgentTools(ctx, input)));
}
