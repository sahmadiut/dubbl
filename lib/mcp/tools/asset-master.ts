import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { assetMasterId, assetCategoryCreateSchema, assetCategoryUpdateSchema, assetCreateSchema, assetUpdateSchema, assetCategoryListSchema, assetListSchema } from "@/lib/api/asset-master-wire";
import { listAssetCategories, getAssetCategory, createAssetCategory, updateAssetCategory, deleteAssetCategory,
  listFixedAssets, getFixedAsset, createFixedAsset, updateFixedAsset, deleteFixedAsset } from "@/lib/api/asset-master";

export function registerAssetMasterTools(server: McpServer, ctx: AuthContext) {
  const money = "Amounts are integer cents with matching canonical Minor strings, limited to 9007199254740991. No acquisition journal is posted. Organization scope and manage:assets permission required.";
  server.registerTool("list_asset_categories", { description: "List live organization asset categories with optional active filter and pagination. Returns categories, total, page and limit. " + money, inputSchema: assetCategoryListSchema },
    p => wrapTool(ctx, () => listAssetCategories(ctx, p)));
  server.registerTool("get_asset_category", { description: "Read one category, default residual cents/Minor and scoped chart accounts. Returns category. " + money, inputSchema: z.object({ categoryId: assetMasterId }).strict() },
    p => wrapTool(ctx, async () => ({ category: await getAssetCategory(ctx, p.categoryId) })));
  server.registerTool("create_asset_category", { description: "Create category defaults. Residual numeric/Minor aliases must agree; omitted residual defaults zero. Life is months, rate is basis points (2000 = 20%). Returns category. " + money, inputSchema: assetCategoryCreateSchema },
    p => wrapTool(ctx, async () => ({ category: await createAssetCategory(ctx, p) })));
  server.registerTool("update_asset_category", { description: "Update category defaults; omitted fields retain values, null clears nullable fields. Does not change existing assets. Returns category. " + money, inputSchema: assetCategoryUpdateSchema.extend({ categoryId: assetMasterId }).strict() },
    p => { const { categoryId, ...input } = p; return wrapTool(ctx, async () => ({ category: await updateAssetCategory(ctx, categoryId, input) })); });
  server.registerTool("delete_asset_category", { description: "Soft-delete category, retaining existing asset associations and history. Returns success. " + money, inputSchema: z.object({ categoryId: assetMasterId }).strict() },
    p => wrapTool(ctx, () => deleteAssetCategory(ctx, p.categoryId)));
  server.registerTool("list_fixed_assets", { description: "List live organization fixed assets, optional status/category filter and pagination. Returns assets, total, page and limit with cents/Minor aliases. " + money, inputSchema: assetListSchema },
    p => wrapTool(ctx, () => listFixedAssets(ctx, p)));
  server.registerTool("get_fixed_asset", { description: "Read asset, category, scoped accounts, depreciation/revaluation/CWIP history and scoped journals with cents/Minor aliases. Returns asset. " + money, inputSchema: z.object({ assetId: assetMasterId }).strict() },
    p => wrapTool(ctx, async () => ({ asset: await getFixedAsset(ctx, p.assetId) })));
  server.registerTool("create_fixed_asset", { description: "Create asset using numeric or Minor cost. Omitted settings inherit category defaults; explicit null clears account defaults. Life is months, units are physical integers, dates Gregorian YYYY-MM-DD. CWIP starts in_progress. Returns asset. " + money, inputSchema: assetCreateSchema },
    p => wrapTool(ctx, async () => ({ asset: await createFixedAsset(ctx, p) })));
  server.registerTool("update_fixed_asset", { description: "Update asset metadata or unused economic settings. Cost is immutable; economic changes with history fail. CWIP state changes require capitalization. Category reassignment does not recopy defaults. Returns asset. " + money, inputSchema: assetUpdateSchema.extend({ assetId: assetMasterId }).strict() },
    p => { const { assetId, ...input } = p; return wrapTool(ctx, async () => ({ asset: await updateFixedAsset(ctx, assetId, input) })); });
  server.registerTool("delete_fixed_asset", { description: "Soft-delete asset retaining depreciation, valuation, CWIP and journal history. Returns success. " + money, inputSchema: z.object({ assetId: assetMasterId }).strict() },
    p => wrapTool(ctx, () => deleteFixedAsset(ctx, p.assetId)));
}
