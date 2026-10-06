import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { assetMasterId } from "@/lib/api/asset-master-wire";
import { assetDepreciationSchema, assetDepreciationBatchSchema, assetDepreciationRollbackSchema } from "@/lib/api/asset-depreciation-wire";
import { depreciateAsset, depreciateAssets, rollbackAssetDepreciation } from "@/lib/api/asset-depreciation";

export function registerAssetDepreciationTools(server: McpServer, ctx: AuthContext) {
  const money = "Integer cents and matching canonical Minor strings, max 9007199254740991. Requires manage:assets. Atomic with audit and period checks. Dates default to UTC today. Revalued assets require a separate contract and fail closed. Single-asset depreciation and rollback reject disposed assets with status 400.";
  server.registerTool("run_asset_depreciation", {
    description: "Post one monthly depreciation charge for a capitalized active asset. Positive physical units are required only for units_of_production. Same month/units replays without posting twice; conflicting units reject. Returns depreciationEntry, journalEntryId and asset totals. " + money,
    inputSchema: assetDepreciationSchema.extend({ assetId: assetMasterId }).strict(),
  }, p => { const { assetId, ...input } = p; return wrapTool(ctx, () => depreciateAsset(ctx, assetId, input)); });
  server.registerTool("run_assets_depreciation", {
    description: "Run monthly depreciation for all active organization assets in one transaction. Skips usage-driven, CWIP, future-service, exhausted and already-booked assets. Returns message, processed/skipped counts and results with amount/amountMinor. " + money,
    inputSchema: assetDepreciationBatchSchema,
  }, p => wrapTool(ctx, () => depreciateAssets(ctx, p)));
  server.registerTool("rollback_asset_depreciation", {
    description: "Undo only the latest depreciation entry. Posts an exact reversal of the original GL lines, keeps both journals posted and linked, removes the schedule row and restores totals. Both original and reversal periods must be open. Returns rolledBack, reversedAmount/Minor, reversedDepreciationEntryId, journalEntryId and asset totals; voidedJournalEntryId is null. Specify expected entry or retry key; legacy omission has a daily retry guard. " + money,
    inputSchema: assetDepreciationRollbackSchema.extend({ assetId: assetMasterId }).strict(),
  }, p => { const { assetId, ...input } = p; return wrapTool(ctx, () => rollbackAssetDepreciation(ctx, assetId, input)); });
}
