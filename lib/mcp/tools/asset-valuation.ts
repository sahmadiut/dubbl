import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { assetMasterId } from "@/lib/api/asset-master-wire";
import { assetRevalueSchema, assetImpairToolSchema, assetDisposeSchema } from "@/lib/api/asset-valuation-wire";
import { revalueAsset, impairAsset, disposeAsset } from "@/lib/api/asset-valuation";

export function registerAssetValuationTools(server: McpServer, ctx: AuthContext) {
  const money = "Money is integer cents with explicit matching Minor strings, max 9007199254740991. No currency override/rescaling. Requires manage:assets, open posting period and capitalized asset. Atomic history, journal, totals and audit; optional retry key rejects conflicting inputs. Unsupported historical signs, chronology, accounts, currency or carrying totals fail closed.";
  server.registerTool("revalue_fixed_asset", {
    description: "Increase asset carrying amount. Reverses net prior P&L impairment first, then credits equity surplus. Returns revaluation with signed changeAmount/surplusAmount/impairmentAmount and Minor aliases, asset and journalEntryId. No GL when asset account is absent. Depreciation after valuation requires a separate schedule contract. " + money,
    inputSchema: assetRevalueSchema.extend({ assetId: assetMasterId }).strict(),
  }, p => { const { assetId, ...input } = p; return wrapTool(ctx, () => revalueAsset(ctx, assetId, input)); });
  server.registerTool("impair_fixed_asset", {
    description: "Decrease asset carrying amount to recoverableAmount/Minor. Consumes equity surplus first, then recognizes negative P&L impairment. Returns impairment with signed changes/Minor aliases, asset and journalEntryId. No GL when asset account is absent. " + money,
    inputSchema: assetImpairToolSchema.extend({ assetId: assetMasterId }).strict(),
  }, p => {
    const { assetId, recoverableAmount, recoverableAmountMinor, ...input } = p;
    return wrapTool(ctx, async () => {
      const result = await impairAsset(ctx, assetId, { ...input, revaluedAmount: recoverableAmount, revaluedAmountMinor: recoverableAmountMinor });
      const { revaluation, ...rest } = result;
      return { impairment: revaluation, ...rest };
    });
  });
  server.registerTool("dispose_fixed_asset", {
    description: "Sell/write off asset. Uses current carrying value, removes adjusted gross cost and accumulated depreciation, recognizes gain/loss and transfers surplus to retained earnings. Catches up one unbooked month only for unrevalued time-based assets; usage/revalued assets receive no implicit catch-up. All depreciation accounts absent permits non-GL tracking. Identical unkeyed disposal replays. Returns asset, signed gainOrLoss/Minor, catchUpAmount/Minor, netBookValueAtDisposal/Minor and disposal/catch-up/surplus journal IDs. " + money,
    inputSchema: assetDisposeSchema.extend({ assetId: assetMasterId }).strict(),
  }, p => { const { assetId, ...input } = p; return wrapTool(ctx, () => disposeAsset(ctx, assetId, input)); });
}
