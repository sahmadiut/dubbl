import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { catalogId, variantCreateSchema, variantUpdateSchema, supplierCreateSchema, supplierUpdateSchema } from "@/lib/api/inventory-catalog-wire";
import { listInventoryVariants, createInventoryVariant, updateInventoryVariant, deleteInventoryVariant,
  listInventorySuppliers, createInventorySupplier, updateInventorySupplier, deleteInventorySupplier } from "@/lib/api/inventory-catalog";

export function registerInventoryCatalogTools(server: McpServer, ctx: AuthContext) {
  const item = { inventoryItemId: catalogId.describe("Live organization-owned parent inventory item UUID") };
  const variant = { ...item, variantId: catalogId.describe("Live variant UUID belonging to the parent and organization") };
  const supplier = { ...item, supplierId: catalogId.describe("Supplier-link UUID belonging to the parent and organization; not the contact UUID") };
  server.registerTool("list_inventory_variants", { description: "List live variants for an owned item; returns data with numeric cents prices and nullable purchasePriceMinor/salePriceMinor strings. Whole-unit quantity is variant metadata, separate from stock valuation.",
    inputSchema: z.object(item).strict() }, args => wrapTool(ctx, async () => ({ data: await listInventoryVariants(ctx, args.inventoryItemId) })));
  server.registerTool("create_inventory_variant", { description: "Create an owned item variant with manage:inventory, atomically with audit. Prices are nonnegative integer cents or canonical *Minor strings, max 9007199254740991; aliases must agree. Defaults prices/whole-unit metadata quantity to zero, options to {}. Returns inventoryVariant; does not post stock or ledger.",
    inputSchema: variantCreateSchema.extend(item) }, args => wrapTool(ctx, async () => {
      const { inventoryItemId, ...body } = args; return { inventoryVariant: await createInventoryVariant(ctx, inventoryItemId, body) };
    }));
  server.registerTool("update_inventory_variant", { description: "Patch an owned variant with manage:inventory and atomic audit; omitted fields retained. Prices use nonnegative safe integer cents or matching *Minor strings. Whole-unit quantity is metadata only. Returns inventoryVariant with both price aliases.",
    inputSchema: variantUpdateSchema.extend(variant) }, args => wrapTool(ctx, async () => {
      const { inventoryItemId, variantId, ...body } = args; return { inventoryVariant: await updateInventoryVariant(ctx, inventoryItemId, variantId, body) };
    }));
  server.registerTool("delete_inventory_variant", { description: "Soft-delete an owned item variant atomically with audit. Requires manage:inventory; returns success. Parent stock/valuation remains separate.",
    inputSchema: z.object(variant).strict() }, args => wrapTool(ctx, () => deleteInventoryVariant(ctx, args.inventoryItemId, args.variantId)));
  server.registerTool("list_inventory_suppliers", { description: "List an owned item's supplier links; returns data with scoped contactName/contactEmail, numeric cents purchasePrice and nullable purchasePriceMinor string. Historical deleted owned contacts remain visible; foreign contact details are excluded. Lead time is days.",
    inputSchema: z.object(item).strict() }, args => wrapTool(ctx, async () => ({ data: await listInventorySuppliers(ctx, args.inventoryItemId) })));
  server.registerTool("create_inventory_supplier", { description: "Link a live owned supplier/both contact to an owned item atomically with audit; manage:inventory required, duplicate link returns 409. purchasePrice is nonnegative safe integer cents or matching purchasePriceMinor string. Lead time is nonnegative int32 days. Returns inventoryItemSupplier; defaults price/days zero and preferred false, permits multiple preferred links.",
    inputSchema: supplierCreateSchema.extend(item) }, args => wrapTool(ctx, async () => {
      const { inventoryItemId, ...body } = args; return { inventoryItemSupplier: await createInventorySupplier(ctx, inventoryItemId, body) };
    }));
  server.registerTool("update_inventory_supplier", { description: "Patch an owned supplier link atomically with audit and manage:inventory; contact must remain live owned supplier/both. Nonnegative safe integer cents purchasePrice or matching purchasePriceMinor string, leadTimeDays in int32 days. Omitted fields retain values; returns inventoryItemSupplier.",
    inputSchema: supplierUpdateSchema.extend(supplier) }, args => wrapTool(ctx, async () => {
      const { inventoryItemId, supplierId, ...body } = args; return { inventoryItemSupplier: await updateInventorySupplier(ctx, inventoryItemId, supplierId, body) };
    }));
  server.registerTool("delete_inventory_supplier", { description: "Remove an owned item supplier link atomically with audit; manage:inventory required, returns success. Allows removing malformed historical links without exposing their contact details.",
    inputSchema: z.object(supplier).strict() }, args => wrapTool(ctx, () => deleteInventorySupplier(ctx, args.inventoryItemId, args.supplierId)));
}
