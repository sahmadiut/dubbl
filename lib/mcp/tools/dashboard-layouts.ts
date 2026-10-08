import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { createDashboardLayout, deleteDashboardLayout, getDashboardLayout, listDashboardLayouts, updateDashboardLayout } from "@/lib/api/dashboard-layouts";
import { createDashboardLayoutSchema, dashboardLayoutIdSchema, updateDashboardLayoutSchema } from "@/lib/api/dashboard-layout-wire";
import { wrapTool } from "@/lib/mcp/errors";

export function registerDashboardLayoutTools(server: McpServer, ctx: AuthContext) {
  const contract = " User and organization owned. Grid values are safe finite numbers; config is opaque JSON with exact strings preserved, no money aliases or rescaling. Limits: depth 32, 10000 nodes, 256 KiB. No financial data permission required for personal layouts.";
  server.registerTool("list_dashboard_layouts", { description: "Return {layouts} with IDs, names, flags, widgets, ownership and timestamps." + contract,
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listDashboardLayouts(ctx)));
  server.registerTool("get_dashboard_layout", { description: "Return {layout} for the supplied layout UUID." + contract,
    inputSchema: z.object({ id: dashboardLayoutIdSchema }).strict() }, ({ id }) => wrapTool(ctx, () => getDashboardLayout(ctx, id)));
  server.registerTool("create_dashboard_layout", { description: "Save name, ordered widget layout and optional isDefault; return {layout}. Does not change other default flags." + contract,
    inputSchema: createDashboardLayoutSchema }, params => wrapTool(ctx, () => createDashboardLayout(ctx, params)));
  server.registerTool("update_dashboard_layout", { description: "Patch supplied name, isDefault and/or layout by UUID; require at least one changed field; return {layout}." + contract,
    inputSchema: updateDashboardLayoutSchema.safeExtend({ id: dashboardLayoutIdSchema }) }, ({ id, ...params }) => wrapTool(ctx, () => updateDashboardLayout(ctx, id, params)));
  server.registerTool("delete_dashboard_layout", { description: "Delete the supplied layout UUID; return {success:true}. Unsupported stored layouts are rejected before deletion." + contract,
    inputSchema: z.object({ id: dashboardLayoutIdSchema }).strict() }, ({ id }) => wrapTool(ctx, () => deleteDashboardLayout(ctx, id)));
}
