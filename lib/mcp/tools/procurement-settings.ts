import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { readProcurementSettings, updateProcurementSettings } from "@/lib/api/procurement-settings";
import { procurementSettingsUpdateSchema } from "@/lib/api/procurement-settings-wire";
import { wrapTool } from "@/lib/mcp/errors";

export function registerProcurementSettingsTools(server: McpServer, ctx: AuthContext) {
  server.tool("get_procurement_settings",
    "Get this organization's three-way-match settings. Returns procurementSettings with numeric integer basis-point tolerances (500 = 5%, range 0..100000) and boolean controls; never currency amounts or money aliases. Returns zero/false defaults without creating a row when unconfigured.",
    {}, () => wrapTool(ctx, readProcurementSettings));
  server.tool("update_procurement_settings",
    "Partially upsert this organization's three-way-match settings; requires manage:bills. Tolerances are numeric integer basis points (500 = 5%, range 0..100000), not money. Only supplied fields change; omitted fields keep existing values or default to zero/false on first save. Returns procurementSettings with numeric tolerances, booleans and saved row metadata; settings and audit commit together.",
    procurementSettingsUpdateSchema.shape,
    params => wrapTool(ctx, auth => updateProcurementSettings(auth, params)));
}
