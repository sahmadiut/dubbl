import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/inventory/route";
import { POST as adjust } from "../../app/api/v1/inventory/[id]/adjust/route";
import { GET as valuation } from "../../app/api/v1/reports/inventory-valuation/route";
import { GET as reorder } from "../../app/api/v1/inventory/reorder-suggestions/route";
import { inventoryValuationJson, inventoryAlertsJson } from "../../i18n/inventory-report-presentation";
import { GET as variants, POST as createVariant } from "../../app/api/v1/inventory/[id]/variants/route";
import { GET as suppliers, POST as createSupplier } from "../../app/api/v1/inventory/[id]/suppliers/route";
import { GET as movements } from "../../app/api/v1/inventory/[id]/movements/route";
import { GET as bomRead } from "../../app/api/v1/inventory/bom/[id]/route";
import { GET as boms } from "../../app/api/v1/inventory/bom/route";
import { POST as createOrder, GET as orders } from "../../app/api/v1/inventory/assembly-orders/route";
import { GET as takeRead } from "../../app/api/v1/stock-takes/[id]/route";
import { registerInventoryMasterTools } from "../../lib/mcp/tools/inventory-master";
import { registerInventoryMovementTools } from "../../lib/mcp/tools/inventory-movements";
import { registerInventoryValuationTools } from "../../lib/mcp/tools/inventory-valuation";
import { registerInventoryCatalogTools } from "../../lib/mcp/tools/inventory-catalog";
import { registerInventoryAssemblyTools } from "../../lib/mcp/tools/inventory-assembly";
import { inventoryUiItem, inventoryUiCatalog, inventoryUiMovement, inventoryUiListSummary,
  inventoryUiValuation, inventoryUiBom, inventoryUiBomDetail, inventoryUiAssembly, inventoryUiStockTake,
  inventoryPercent, inventoryAverageMargin } from "../../lib/money/inventory-ui";
import { catalogPriceMinor } from "../../lib/money/catalog-input";

async function run() {
  const [owner] = await db.insert(users).values({ email: "inventory-consumer@example.test" }).returning();
  let workflows = 0;
  for (const currency of ["USD", "JPY", "KWD"]) for (const transport of ["rest", "mcp"]) {
    const [org] = await db.insert(organization).values({ name: `Consumer ${currency} ${transport}`, slug: `consumer-${currency}-${transport}`, defaultCurrency: currency }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_consumer_${currency}_${transport}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_consumer" });
    const server = new McpServer({ name: "Inventory consumers", version: "1" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerInventoryMasterTools(server, ctx); registerInventoryMovementTools(server, ctx);
    registerInventoryValuationTools(server, ctx); registerInventoryCatalogTools(server, ctx); registerInventoryAssemblyTools(server, ctx);
    const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    const req = (body?: unknown) => new Request("http://fixture.test/api/v1/inventory", {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const data = async (response: Response, status = 200) => {
      const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
    };
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      const value = JSON.parse((result.content as { text: string }[])[0].text);
      assert.ok(!result.isError, JSON.stringify(value)); return value;
    };
    const snapshot = async () => {
      const tables = ["inventory_item", "inventory_variant", "inventory_item_supplier", "inventory_movement", "inventory_cost_layer", "inventory_layer_consumption", "journal_entry", "journal_line", "chart_account", "audit_log"];
      return Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
    };
    try {
      const payload = { code: "LOW", name: "Low digits", quantityOnHand: 3, reorderPoint: 10, purchasePriceMinor: catalogPriceMinor("30000000.01"), salePriceMinor: catalogPriceMinor("30000000.02") };
      const created = transport === "rest" ? await data(await create(req(payload)), 201) : await call("create_inventory_item", payload);
      const item = inventoryUiItem(created.inventoryItem), id = item.id;
      await data(await adjust(req({ adjustmentType: "write_down", valueDeltaMinor: "3000000001", reason: "Damage" }), params(id)));
      const restList = await data(await list(req())), mcpList = await call("list_inventory_items", { activeOnly: false });
      restList.data.forEach(inventoryUiItem); mcpList.items.forEach(inventoryUiItem);
      inventoryUiListSummary(restList.summary); inventoryUiListSummary(mcpList.summary);
      assert.deepEqual(restList.summary, mcpList.summary);
      assert.equal(restList.summary.totalValueMinor, "9000000003");
      const savedMargin = await db.execute(sql`select coalesce(avg(case when purchase_price > 0 then (sale_price::numeric-purchase_price::numeric)/purchase_price::numeric*100 end),0)::text as margin from inventory_item where organization_id=${org.id}`);
      assert.equal(restList.summary.avgMarginExact, savedMargin.rows[0].margin);
      assert.equal(inventoryAverageMargin(restList.summary.avgMarginExact), "0.0");
      const restReport = inventoryUiValuation(await data(await valuation(req()))), mcpReport = inventoryUiValuation(await call("get_inventory_valuation"));
      assert.deepEqual(restReport, mcpReport);
      assert.deepEqual(await inventoryValuationJson(await valuation(req())), await inventoryValuationJson(Response.json(mcpReport)));
      assert.equal(restReport.items[0].totalCostMinor, "9000000003");
      assert.equal(restReport.items[0].carryingValueMinor, "6000000002");
      assert.equal(restReport.items[0].marginMinor, "3");
      assert.equal(inventoryPercent(3n, 9000000003n), "0.0");
      assert.deepEqual((await db.execute(sql`select purchase_price::text as price, total_value::text as carrying, average_cost::text as average from inventory_item where id=${id}`)).rows,
        [{ price: "3000000001", carrying: "6000000002", average: "2000000001" }]);

      await data(await createVariant(req({ name: "Variant", purchasePriceMinor: "3000000001", salePriceMinor: "3000000002", quantityOnHand: 1 }), params(id)), 201);
      const restVariants = (await data(await variants(req(), params(id)))).data, mcpVariants = (await call("list_inventory_variants", { inventoryItemId: id })).data;
      restVariants.forEach(inventoryUiCatalog); mcpVariants.forEach(inventoryUiCatalog); assert.deepEqual(restVariants, mcpVariants);
      const [supplier] = await db.insert(contact).values({ organizationId: org.id, name: "Supplier", type: "supplier" }).returning();
      await data(await createSupplier(req({ contactId: supplier.id, purchasePriceMinor: "3000000001", isPreferred: true }), params(id)), 201);
      const restSuppliers = (await data(await suppliers(req(), params(id)))).data, mcpSuppliers = (await call("list_inventory_suppliers", { inventoryItemId: id })).data;
      restSuppliers.forEach(inventoryUiCatalog); mcpSuppliers.forEach(inventoryUiCatalog); assert.deepEqual(restSuppliers, mcpSuppliers);
      const restAlerts = await inventoryAlertsJson(await reorder(req()));
      const mcpAlerts = await inventoryAlertsJson(Response.json(await call("list_inventory_reorder_suggestions")));
      assert.deepEqual(restAlerts, mcpAlerts);
      assert.equal(restAlerts[0].id, id);
      assert.equal(restAlerts[0].suggestedReorderQuantity, 17);
      assert.deepEqual(restAlerts[0].preferredSupplier, { contactId: supplier.id, contactName: "Supplier" });
      assert.deepEqual((await db.execute(sql`select quantity_on_hand::text as quantity, reorder_point::text as point, (reorder_point::bigint*2-quantity_on_hand)::text as suggestion from inventory_item where id=${id}`)).rows,
        [{ quantity: "3", point: "10", suggestion: "17" }]);
      const restMoves = (await data(await movements(req(), params(id)))).data, mcpMoves = (await call("list_inventory_movements", { inventoryItemId: id })).movements;
      restMoves.forEach(inventoryUiMovement); mcpMoves.forEach(inventoryUiMovement); assert.deepEqual(restMoves, mcpMoves);

      const finished = (await call("create_inventory_item", { code: "FIN", name: "Finished" })).inventoryItem;
      const bomId = (await call("create_bom", { assemblyItemId: finished.id, name: "Recipe", laborCostCentsMinor: "1", overheadCostCentsMinor: "2" })).bom.id;
      await call("add_bom_component", { bomId, componentItemId: id, quantityExact: "0.5" });
      const restBom = inventoryUiBomDetail(await data(await bomRead(req(), params(bomId))));
      const mcpBom = inventoryUiBomDetail(await call("get_bom", { bomId }));
      assert.deepEqual(restBom, mcpBom); assert.equal(restBom.costBreakdown.totalCostMinor, "1500000004");
      (await data(await boms(req()))).data.forEach(inventoryUiBom);
      (await call("list_boms")).data.forEach(inventoryUiBom);
      await data(await createOrder(req({ bomId, quantity: 1 })), 201);
      const restOrders = (await data(await orders(req()))).data, mcpOrders = (await call("list_assembly_orders")).data;
      restOrders.forEach(inventoryUiAssembly); mcpOrders.forEach(inventoryUiAssembly); assert.deepEqual(restOrders, mcpOrders);

      const takeId = (await call("create_stock_take", { name: "Count" })).stockTake.id;
      const started = (await call("update_stock_take", { stockTakeId: takeId, status: "in_progress" })).stockTake;
      inventoryUiStockTake(started);
      const lineId = started.lines.find((line: { inventoryItemId: string }) => line.inventoryItemId === id).id;
      await call("count_stock_take_line", { stockTakeId: takeId, lineId, countedQuantity: 2 });
      const applied = await call("apply_stock_take", { stockTakeId: takeId }); inventoryUiStockTake(applied.stockTake);
      const restTake = inventoryUiStockTake((await data(await takeRead(req(), params(takeId)))).stockTake);
      assert.deepEqual(restTake, applied.stockTake);
      assert.equal(restTake.lines.find((line: { id: string }) => line.id === lineId).valueAdjustmentMinor, "-2000000001");
      assert.deepEqual((await db.execute(sql`select total_value::text as carrying from inventory_item where id=${id}`)).rows, [{ carrying: "4000000001" }]);

      const before = await snapshot();
      await data(await createVariant(req({ name: "Conflict", purchasePrice: 1, purchasePriceMinor: "2" }), params(id)), 400);
      const rejected = await client.callTool({ name: "create_inventory_variant", arguments: { inventoryItemId: id, name: "Conflict", purchasePrice: 1, purchasePriceMinor: "2" } });
      assert.equal(rejected.isError, true); assert.deepEqual(await snapshot(), before);
      const unbalanced = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.organization_id=${org.id} group by e.id having sum(l.debit_amount::numeric-l.credit_amount::numeric)<>0`);
      assert.equal(unbalanced.rows.length, 0);
      workflows++;
    } finally { await client.close(); await server.close(); }
  }
  console.log(`Inventory consumer REST MCP SQL verified: ${workflows} workflows`);
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
