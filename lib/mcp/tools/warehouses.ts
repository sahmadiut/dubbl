import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { catalogId } from "@/lib/api/inventory-catalog-wire";
import { warehouseCreateSchema, warehouseUpdateSchema } from "@/lib/api/inventory-movement-wire";
import { listWarehouses, getWarehouse, writeWarehouse, deleteWarehouse, warehouseStocks } from "@/lib/api/inventory-movements";

export function registerWarehouseTools(server: McpServer, ctx: AuthContext) {
  const id = z.object({ warehouseId: catalogId.describe("Live owned warehouse UUID") }).strict();
  server.registerTool("list_warehouses", { description: "List live organization warehouses; locations have no money fields. Returns { warehouses }.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => ({ warehouses: await listWarehouses(ctx) })));
  server.registerTool("get_warehouse", { description: "Read an owned warehouse by UUID. Returns { warehouse } with location metadata.", inputSchema: id }, p => wrapTool(ctx, async () => ({ warehouse: await getWarehouse(ctx, p.warehouseId) })));
  server.registerTool("create_warehouse", { description: "Create a warehouse with unique code; default flag clears other defaults. Returns { warehouse }; audited atomically.", inputSchema: warehouseCreateSchema }, p => wrapTool(ctx, async () => ({ warehouse: await writeWarehouse(ctx, p) })));
  server.registerTool("update_warehouse", { description: "Update supplied location fields for an owned warehouse. Returns { warehouse }; audited atomically.", inputSchema: warehouseUpdateSchema.extend(id.shape) }, p => wrapTool(ctx, async () => { const { warehouseId, ...fields } = p; return { warehouse: await writeWarehouse(ctx, fields, warehouseId) }; }));
  server.registerTool("delete_warehouse", { description: "Soft-delete an owned warehouse with zero stock. Returns { success: true }; nonzero stock rejects.", inputSchema: id }, p => wrapTool(ctx, () => deleteWarehouse(ctx, p.warehouseId)));
  server.registerTool("get_warehouse_stock", { description: "Read owned warehouse stock by live owned item, whole physical units. Returns { stock }; no monetary fields.", inputSchema: id }, p => wrapTool(ctx, async () => ({ stock: await warehouseStocks(ctx, p.warehouseId) })));
}
