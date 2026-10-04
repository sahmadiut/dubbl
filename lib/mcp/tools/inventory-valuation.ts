import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { valuationReportSchema, layerListSchema } from "@/lib/api/inventory-valuation-wire";
import { inventoryValuationReport, listInventoryCostLayers } from "@/lib/api/inventory-valuation-report";
export function registerInventoryValuationTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_inventory_valuation", { description: "Read owned active inventory report. Returns items and summary with numeric stored minor amounts (USD cents) plus Minor strings. Legacy totalCost/totalValue remain purchase/sale price projections; carryingValue is saved perpetual base-currency book value, including landed costs. Quantity is whole units; marginPercent/totalMargin are display percentages. Configured cost method determines carrying values; method never recalculates history.", inputSchema: valuationReportSchema }, p => wrapTool(ctx, () => inventoryValuationReport(ctx, p)));
  server.registerTool("list_inventory_cost_layers", { description: "Read owned item's FIFO layers including exhausted layers and consumption audit. Quantities are whole units. unitCost is original numeric minor cost per unit; remainingValue/value and Minor aliases retain exact carrying/consumed cents after capitalization. Historical null values derive from saved quantity times unitCost. Returns inventoryItem and data, oldest layer first.", inputSchema: layerListSchema }, p => wrapTool(ctx, () => listInventoryCostLayers(ctx, p)));
}
