import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { assetMasterId } from "@/lib/api/asset-master-wire";
import { assetCwipCostSchema, assetCapitalizeSchema } from "@/lib/api/asset-cwip-wire";
import { listCwipCosts, addCwipCost, capitalizeCwipAsset } from "@/lib/api/asset-cwip";
import { z } from "zod";

export function registerAssetCwipTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_cwip_costs", {
    description: "List an organization's asset construction costs, newest first. Returns {costs,total,totalMinor}, with numeric integer cents plus canonical Minor strings and scoped journals. Requires manage:assets. Unsupported saved money/history fails explicitly.",
    inputSchema: z.object({ assetId: assetMasterId }).strict(),
  }, p => wrapTool(ctx, () => listCwipCosts(ctx, p.assetId)));
  server.registerTool("add_cwip_cost", {
    description: "Add a positive construction cost in integer cents (amount or amountMinor) to uncapitalized CWIP. Posts DR CWIP / CR source and increases recorded cost/book value atomically with audit and period checks. Returns {cost,asset,journalEntryId} with safe numeric cents and Minor strings. Optional retry key prevents duplicate costs; unkeyed calls create distinct costs. Requires manage:assets.",
    inputSchema: assetCwipCostSchema.extend({ assetId: assetMasterId }),
  }, ({ assetId, ...p }) => wrapTool(ctx, () => addCwipCost(ctx, assetId, p)));
  server.registerTool("capitalize_cwip_asset", {
    description: "Bring CWIP into service by moving the entire recorded cost (opening basis plus tracked costs) DR asset / CR its saved CWIP account. Opening basis must already be held there. Defaults to saved accounts or 1500/1700 for zero-balance CWIP. Sets active, service date and capitalization date atomically with locks/audit. Returns {asset,capitalizedCost,capitalizedCostMinor,journalEntryId}; amounts are integer cents, max 9007199254740991. Identical retries replay once; changed inputs conflict. Requires manage:assets.",
    inputSchema: assetCapitalizeSchema.extend({ assetId: assetMasterId }),
  }, ({ assetId, ...p }) => wrapTool(ctx, () => capitalizeCwipAsset(ctx, assetId, p)));
}
