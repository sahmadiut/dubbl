import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { pricingId, priceListCreateSchema, priceListUpdateSchema, priceItemCreateSchema, priceItemUpdateSchema, priceResolveSchema } from "@/lib/api/pricing-wire";
import { listPriceLists, getPriceList, createPriceList, updatePriceList, deletePriceList, listPriceItems, addPriceItem, updatePriceItem, deletePriceItem, resolvePrice } from "@/lib/api/pricing";

export function registerPricingTools(server: McpServer, ctx: AuthContext) {
  const units = "Prices are integer cents in list currency, with canonical unitPriceMinor strings; range 0..9007199254740991. Quantities are whole physical units 1..2147483647. No FX conversion. Writes require manage:inventory; reads require authentication.";
  const listId = { priceListId: pricingId.describe("Organization-owned price-list UUID") };
  const rowIds = { ...listId, priceListItemId: pricingId.describe("Price-row UUID belonging to the selected list") };
  server.registerTool("list_price_lists", { description: "List live organization price books. Returns priceLists metadata. " + units, inputSchema: z.object({}).strict() },
    () => wrapTool(ctx, async () => ({ priceLists: await listPriceLists(ctx) })));
  server.registerTool("get_price_list", { description: "Get price book and its item tiers including itemCode/itemName and exact cents aliases. Returns priceList. " + units, inputSchema: z.object(listId).strict() },
    p => wrapTool(ctx, async () => {
      const list = await getPriceList(ctx, p.priceListId);
      return { priceList: { ...list, items: list.items.map(({ inventoryItem, ...row }) => ({ ...row, itemCode: inventoryItem.code, itemName: inventoryItem.name })) } };
    }));
  server.registerTool("create_price_list", { description: "Create price book, default USD/active; optional inclusive Gregorian dates, null unbounded. Returns priceList. " + units, inputSchema: priceListCreateSchema },
    p => wrapTool(ctx, async () => ({ priceList: await createPriceList(ctx, p) })));
  server.registerTool("update_price_list", { description: "Update metadata; omitted fields retained, null clears dates. Changing currency keeps saved integer cents and reinterprets them in that currency, without FX. Returns priceList. " + units, inputSchema: priceListUpdateSchema.extend(listId).strict() },
    p => { const { priceListId, ...input } = p; return wrapTool(ctx, async () => ({ priceList: await updatePriceList(ctx, priceListId, input) })); });
  server.registerTool("delete_price_list", { description: "Soft-delete price book retaining tiers/history; no longer resolves. Returns success and deletedPriceListId. " + units, inputSchema: z.object(listId).strict() },
    p => wrapTool(ctx, async () => ({ ...await deletePriceList(ctx, p.priceListId), deletedPriceListId: p.priceListId })));
  server.registerTool("list_price_list_items", { description: "List tiers in a price book, with owned inventory records and exact cents aliases. Returns priceListItems. " + units, inputSchema: z.object(listId).strict() },
    p => wrapTool(ctx, async () => ({ priceListItems: await listPriceItems(ctx, p.priceListId) })));
  server.registerTool("add_price_list_item", { description: "Add unique inventory-item/quantity tier. Provide unitPrice or unitPriceMinor or matching aliases; minQuantity defaults 1. Returns priceListItem. " + units, inputSchema: priceItemCreateSchema.extend(listId).strict() },
    p => { const { priceListId, ...input } = p; return wrapTool(ctx, async () => ({ priceListItem: await addPriceItem(ctx, priceListId, input) })); });
  server.registerTool("update_price_list_item", { description: "Update price or quantity tier; aliases must agree and tier must remain unique. Omitted fields retained. Returns priceListItem. " + units, inputSchema: priceItemUpdateSchema.extend(rowIds).strict() },
    p => { const { priceListId, priceListItemId, ...input } = p; return wrapTool(ctx, async () => ({ priceListItem: await updatePriceItem(ctx, priceListId, priceListItemId, input) })); });
  server.registerTool("delete_price_list_item", { description: "Remove one price tier with atomic audit. Returns success and deletedPriceListItemId. " + units, inputSchema: z.object(rowIds).strict() },
    p => wrapTool(ctx, async () => ({ ...await deletePriceItem(ctx, p.priceListId, p.priceListItemId), deletedPriceListItemId: p.priceListItemId })));
  server.registerTool("resolve_price", { description: "Resolve highest minQuantity <= quantity at asOf (default UTC today). Returns resolved price/Minor/currency/list/tier, or null for missing/foreign/deleted/inactive/out-of-window list or unavailable item/tier. " + units, inputSchema: priceResolveSchema.extend(listId).strict() },
    p => wrapTool(ctx, async () => ({ resolved: await resolvePrice(ctx.organizationId, p.inventoryItemId, p.priceListId, p.quantity ?? 1, p.asOf) })));
}
