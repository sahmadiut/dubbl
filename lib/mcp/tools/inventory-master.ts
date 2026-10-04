import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { catalogId, catalogQuantity } from "@/lib/api/inventory-catalog-wire";
import { itemCreateSchema, itemUpdateSchema, itemListSchema, categoryCreateSchema, categoryUpdateSchema, inventoryCsvSchema } from "@/lib/api/inventory-master-wire";
import { createInventoryItem, getInventoryItem, updateInventoryItem, deleteInventoryItem, listInventoryItems, listInventoryCategories,
  writeInventoryCategory, deleteInventoryCategory, bulkInventoryItems, importInventoryCsv, reorderInventorySuggestions } from "@/lib/api/inventory-master";

export function registerInventoryMasterTools(server: McpServer, ctx: AuthContext) {
  const id = { inventoryItemId: catalogId.describe("Live organization-owned inventory item UUID") };
  const cents = "Prices are nonnegative integer cents or matching canonical *Minor strings, max 9007199254740991. Outputs retain numeric money and add *Minor strings; quantities are whole physical units. ";
  server.registerTool("list_inventory_items", { description: "List owned live inventory items. " + cents + "Returns items, total, page, limit, categories and unfiltered summary; summary.totalValue is quantity times purchasePrice, not book value. Active-only default preserved.",
    inputSchema: itemListSchema.extend({ activeOnly: z.boolean().default(true).describe("Default true filters active items when status is omitted; false includes inactive") }) }, args => wrapTool(ctx, async () => {
      const { activeOnly, ...p } = args; const r = await listInventoryItems(ctx, { ...p, status: p.status ?? (activeOnly ? "active" : undefined) });
      return { items: r.data, total: r.pagination.total, page: r.pagination.page, limit: r.pagination.limit, categories: r.categories, summary: r.summary };
    }));
  server.registerTool("create_inventory_item", { description: "Create owned inventory item with manage:inventory and atomic audit. " + cents + "Positive opening quantity and price receive stock and post DR Inventory / CR Opening Balance Equity; otherwise stock starts at zero. Locked periods, invalid references and unsafe products fail before mutation. Returns inventoryItem.",
    inputSchema: itemCreateSchema }, args => wrapTool(ctx, async () => ({ inventoryItem: await createInventoryItem(ctx, args) })));
  server.registerTool("get_inventory_item", { description: "Get owned live item. " + cents + "Returns inventoryItem with purchase/sale/average/standard costs, book totalValue and priceValue (quantity times purchasePrice).",
    inputSchema: z.object(id).strict() }, args => wrapTool(ctx, async () => ({ inventoryItem: await getInventoryItem(ctx, args.inventoryItemId) })));
  server.registerTool("update_inventory_item", { description: "Patch owned inventory master with manage:inventory and atomic audit. " + cents + "Omitted fields retained, nullable references can clear. Does not change stock or book valuation. Returns inventoryItem.",
    inputSchema: itemUpdateSchema.extend(id) }, args => wrapTool(ctx, async () => {
      const { inventoryItemId, ...body } = args; return { inventoryItem: await updateInventoryItem(ctx, inventoryItemId, body) };
    }));
  server.registerTool("delete_inventory_item", { description: "Soft-delete owned live inventory item with manage:inventory and atomic audit. Retains stock/ledger history. Returns success.",
    inputSchema: z.object(id).strict() }, args => wrapTool(ctx, () => deleteInventoryItem(ctx, args.inventoryItemId)));
  server.registerTool("list_inventory_categories", { description: "List owned live categories; returns flat list and roots with immediate children, matching REST. No monetary fields.",
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listInventoryCategories(ctx)));
  server.registerTool("create_inventory_category", { description: "Create unique owned category with manage:inventory and atomic audit; parent must be live and owned. Returns category. No money.",
    inputSchema: categoryCreateSchema }, args => wrapTool(ctx, async () => ({ category: await writeInventoryCategory(ctx, args) })));
  const categoryId = { categoryId: catalogId.describe("Live organization-owned category UUID") };
  server.registerTool("update_inventory_category", { description: "Patch owned category with manage:inventory and atomic audit; omitted fields retained; cyclic or foreign parent rejected. Returns category.",
    inputSchema: categoryUpdateSchema.extend(categoryId) }, args => wrapTool(ctx, async () => {
      const { categoryId, ...body } = args; return { category: await writeInventoryCategory(ctx, body, categoryId) };
    }));
  server.registerTool("delete_inventory_category", { description: "Soft-delete owned category with manage:inventory and atomic audit, detach live child categories and item category references. Returns success.",
    inputSchema: z.object(categoryId).strict() }, args => wrapTool(ctx, () => deleteInventoryCategory(ctx, args.categoryId)));
  server.registerTool("import_inventory_csv", { description: "Import inventory CSV with manage:inventory. Legacy purchasePrice/salePrice columns use two-decimal major units; *Minor columns use canonical integer cents, safe Number range, aliases must agree. Whole-unit quantities. New valued stock posts opening GL; existing items update master only. Each valid row commits atomically; invalid rows return errors. Returns created, updated, total, errors with logical row numbers.",
    inputSchema: inventoryCsvSchema }, args => wrapTool(ctx, () => importInventoryCsv(ctx, args.csv)));
  server.registerTool("list_inventory_reorder_suggestions", { description: "List owned active low-stock items with scoped suppliers. " + cents + "Returns data with suggestedReorderQuantity = 2*reorderPoint - quantityOnHand; suggestion is a safe integer count, may exceed int32 and is not a writable stock quantity.",
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => ({ data: await reorderInventorySuggestions(ctx) })));
  const ids = z.array(catalogId).min(1).max(200).describe("1..200 distinct live owned inventory item UUIDs");
  const registerBulk = (name: string, action: "delete" | "set_active" | "set_inactive") => {
    server.registerTool(name, { description: `Bulk ${action} owned items with manage:inventory and atomic audit; all IDs must exist. Returns success and affected count. No money or stock changes.`,
      inputSchema: z.object({ ids }).strict() }, args => wrapTool(ctx, () => bulkInventoryItems(ctx, { ...args, action })));
  };
  registerBulk("delete_inventory_items", "delete"); registerBulk("activate_inventory_items", "set_active"); registerBulk("deactivate_inventory_items", "set_inactive");
  server.registerTool("set_inventory_items_category", { description: "Set free-text category on owned items with manage:inventory and atomic audit; empty clears. Returns success and affected count. Does not change categoryId or money.",
    inputSchema: z.object({ ids, category: z.string().max(10000).describe("Free-text category; empty clears") }).strict() }, args => wrapTool(ctx, () => bulkInventoryItems(ctx, { ...args, action: "set_category" })));
  server.registerTool("adjust_inventory_items_stock", { description: "Apply nonzero whole-unit quantity adjustment to owned items atomically with valuation, journal and audit. manage:inventory and unlocked date required. Negative results, int32 quantity overflow and unsafe money products rejected. Returns success and affected count. FIFO/average paths preserved; no price input.",
    inputSchema: z.object({ ids, adjustment: catalogQuantity.describe("Nonzero signed int32 whole physical units"), reason: z.string().max(10000).optional().describe("Optional adjustment reason") }).strict() }, args => wrapTool(ctx, () => bulkInventoryItems(ctx, { ...args, action: "adjust_stock" })));
}
