import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { registerAllTools, registerSiteTools } from "./tools";
import type { SiteSessionContext } from "@/lib/api/require-site-admin";

export function createSiteMcpServer(ctx: SiteSessionContext): McpServer {
  const server = new McpServer({ name: "dubbl-site", version: "0.1.0" });
  registerSiteTools(server, ctx);
  return server;
}

export function createMcpServer(ctx: AuthContext): McpServer {
  const server = new McpServer({
    name: "dubbl",
    version: "0.1.0",
  });

  registerAllTools(server, ctx);

  return server;
}
