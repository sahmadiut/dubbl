import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, inventoryItem, inventoryMovement, inventoryCostLayer, warehouseStock, warehouse, chartAccount, periodLock, inventoryTransfer, serialNumber } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as whList, POST as whCreate } from "../../app/api/v1/warehouses/route";
import { GET as whGet, PATCH as whPatch, DELETE as whDelete } from "../../app/api/v1/warehouses/[id]/route";
import { GET as whStock } from "../../app/api/v1/warehouses/[id]/stock/route";
import { GET as itemStock } from "../../app/api/v1/inventory/[id]/warehouse-stock/route";
import { POST as adjust } from "../../app/api/v1/inventory/[id]/adjust/route";
import { POST as bulk } from "../../app/api/v1/bulk/inventory/adjust/route";
import { GET as trList, POST as trCreate } from "../../app/api/v1/inventory/transfers/route";
import { GET as trGet, PATCH as trPatch } from "../../app/api/v1/inventory/transfers/[id]/route";
import { POST as trComplete } from "../../app/api/v1/inventory/transfers/[id]/complete/route";
import { GET as takeList, POST as takeCreate } from "../../app/api/v1/stock-takes/route";
import { GET as takeGet, PATCH as takePatch, DELETE as takeDelete } from "../../app/api/v1/stock-takes/[id]/route";
import { PATCH as count } from "../../app/api/v1/stock-takes/[id]/lines/[lineId]/route";
import { POST as apply } from "../../app/api/v1/stock-takes/[id]/apply/route";
import { GET as moves } from "../../app/api/v1/inventory/[id]/movements/route";
import { GET as chart } from "../../app/api/v1/inventory/movements/chart/route";
import { GET as serialList, POST as serialCreate } from "../../app/api/v1/inventory/[id]/serials/route";
import { GET as lotList, POST as lotCreate } from "../../app/api/v1/inventory/[id]/lots/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerInventoryMovementTools } from "../../lib/mcp/tools/inventory-movements";
import { registerWarehouseTools } from "../../lib/mcp/tools/warehouses";
import { createInventoryItem, bulkInventoryItems } from "../../lib/api/inventory-master";
import { adjustInventory, completeInventoryTransfer, applyStockTake, writeWarehouse, deleteWarehouse, createInventoryTransfer, updateInventoryTransfer, createStockTake, updateStockTake, deleteStockTake, countStockTakeLine, createSerials, createLot, bulkAdjustInventory } from "../../lib/api/inventory-movements";
import { recordInventoryReceipt } from "../../lib/api/inventory-valuation";
import { billStockMovement } from "../../lib/api/bill-stock";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Movement fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else { registerInventoryMovementTools(server, ctx); registerWarehouseTools(server, ctx); }
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) {
    assert.equal(tools.length, 28);
    for (const tool of tools) { assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, tool.name); }
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Movement A", slug: "movement-a", defaultCurrency: "KWD" }, { name: "Movement B", slug: "movement-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "movement-owner@example.test" }, { email: "movement-viewer@example.test" }, { email: "movement-manager@example.test" }]).returning();
  const [viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Read", permissions: [] }, { organizationId: a.id, name: "Inventory", permissions: ["manage:inventory"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]);
  const keys = { a: "dk_movement_a", b: "dk_movement_b", viewer: "dk_movement_viewer", manager: "dk_movement_manager", expired: "dk_movement_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_movement", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [] }), full = await mcp(ctx, true);
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/inventory${query}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const cp = (id: string) => ({ params: Promise.resolve({ id }) });
  const lp = (id: string, lineId: string) => ({ params: Promise.resolve({ id, lineId }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const good = async (name: string, args: Record<string, unknown> = {}, client = ma) => { const r = await client.call(name, args); assert.equal(r.isError, false, JSON.stringify(r.body)); return r.body; };
  const tables = ["inventory_item", "inventory_movement", "warehouse", "warehouse_stock", "inventory_cost_layer", "inventory_layer_consumption", "inventory_transfer", "inventory_transfer_line", "stock_take", "stock_take_line", "serial_number", "lot_batch", "journal_entry", "journal_line", "chart_account", "audit_log"];
  const snapshot = async () => Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => { const before = await snapshot(), r = await client.call(name, args); assert.equal(r.isError, true, name); if (status) assert.equal(r.body.status, status); assert.deepEqual(await snapshot(), before); };
  const saved = async (id: string) => (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, id) }))!;
  try {
    const w1 = (await data(await whCreate(req({ code: "ONE", name: "One", isDefault: true })), 201)).warehouse;
    const w2 = (await good("create_warehouse", { code: "TWO", name: "Two", isDefault: true })).warehouse;
    assert.equal((await data(await whGet(req(), cp(w1.id)))).warehouse.isDefault, false);
    assert.equal((await data(await whPatch(req({ address: "Fixture" }), cp(w1.id)))).warehouse.address, "Fixture");
    assert.equal((await good("update_warehouse", { warehouseId: w2.id, address: "Two" })).warehouse.address, "Two");
    assert.equal((await data(await whList(req()))).data.length, 2);
    assert.equal((await good("list_warehouses")).warehouses.length, 2);
    assert.equal((await good("get_warehouse", { warehouseId: w1.id })).warehouse.id, w1.id);
    const empty = (await good("create_warehouse", { code: "EMPTY", name: "Empty" })).warehouse;
    await good("delete_warehouse", { warehouseId: empty.id });
    const empty2 = (await data(await whCreate(req({ code: "EMPTY2", name: "Empty2" }, keys.manager)), 201)).warehouse;
    await data(await whDelete(req({}, keys.manager), cp(empty2.id)));
    const item = await createInventoryItem(ctx, { code: "ITEM", name: "Item", purchasePriceMinor: "29", quantityOnHand: 10 });
    await db.insert(warehouseStock).values([{ organizationId: a.id, inventoryItemId: item.id, warehouseId: w1.id, quantity: 6 }, { organizationId: a.id, inventoryItemId: item.id, warehouseId: w2.id, quantity: 4 }]);
    const q = await data(await adjust(req({ adjustment: 1, reason: "Found" }), cp(item.id))); assert.equal(q.inventoryItem.totalValueMinor, "319"); assert.equal(q.movement.valueMinor, "29");
    assert.equal((await good("adjust_inventory_stock", { inventoryItemId: item.id, kind: "quantity", quantityDelta: -1, reason: "Loss" })).movement.valueMinor, "-29");
    const revalue = await data(await adjust(req({ adjustmentType: "revaluation", newTotalValueMinor: "3000000000", reason: "Value" }), cp(item.id))); assert.equal(revalue.newValueMinor, "3000000000");
    assert.equal((await good("adjust_inventory_stock", { inventoryItemId: item.id, kind: "revaluation", amount: 1, amountMinor: "1", reason: "Up" })).valueDeltaMinor, "1");
    assert.equal((await good("adjust_inventory_stock", { inventoryItemId: item.id, kind: "revaluation", amountMinor: "-1", reason: "Down" })).valueDeltaMinor, "-1");
    assert.equal((await data(await adjust(req({ adjustmentType: "write_down", valueDelta: 1000000000, valueDeltaMinor: "1000000000", reason: "WD" }), cp(item.id)))).newValueMinor, "2000000000");
    await good("adjust_inventory_stock", { inventoryItemId: item.id, kind: "write_down", amountMinor: "1999999710", reason: "Reset" });
    const normalized = await saved(item.id); assert.equal(normalized.totalValue, 290); assert.equal(normalized.averageCost, 29);
    await data(await bulk(req({ adjustments: [{ itemId: item.id, quantity: 1 }] })));
    await good("bulk_adjust_inventory_stock", { adjustments: [{ itemId: item.id, quantity: -1 }] });
    assert.equal((await data(await whStock(req(), cp(w1.id)))).data[0].quantity, 6);
    assert.equal((await data(await itemStock(req(), cp(item.id)))).data.length, 2);
    assert.equal((await good("get_warehouse_stock", { warehouseId: w1.id })).stock[0].quantity, 6);
    assert.equal((await good("get_inventory_warehouse_stock", { inventoryItemId: item.id })).data.length, 2);
    const transfer = (await data(await trCreate(req({ fromWarehouseId: w1.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: item.id, quantity: 2 }] })), 201)).transfer;
    assert.equal((await data(await trGet(req(), cp(transfer.id)))).transfer.status, "draft");
    await data(await trPatch(req({ status: "in_transit" }), cp(transfer.id)));
    await good("get_inventory_transfer", { transferId: transfer.id }); await good("list_inventory_transfers"); await data(await trList(req()));
    const beforeValue = await saved(item.id); await data(await trComplete(req(), cp(transfer.id))); assert.deepEqual(await saved(item.id), beforeValue);
    await denied(() => trComplete(req(), cp(transfer.id)), 409); await mdenied("update_inventory_transfer", { transferId: transfer.id, status: "draft" }, ma, 409);
    const mt = (await good("create_inventory_transfer", { fromWarehouseId: w2.id, toWarehouseId: w1.id, lines: [{ inventoryItemId: item.id, quantity: 1 }] })).transfer;
    await good("update_inventory_transfer", { transferId: mt.id, notes: "Fixture" }); await good("complete_inventory_transfer", { transferId: mt.id });
    await good("transfer_inventory_stock", { inventoryItemId: item.id, fromWarehouseId: w2.id, toWarehouseId: w1.id, quantity: 1 });
    assert.equal((await data(await whStock(req(), cp(w1.id)))).data[0].quantity, 6);
    // Warehouse count: global 10, source 6 -> counted 5 must change global to 9.
    const take = (await data(await takeCreate(req({ name: "Warehouse", warehouseId: w1.id })), 201)).stockTake;
    await data(await takePatch(req({ status: "in_progress" }), cp(take.id)));
    const line = (await data(await takeGet(req(), cp(take.id)))).stockTake.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === item.id);
    assert.equal(line.expectedQuantity, 6); await data(await count(req({ countedQuantity: 5 }), lp(take.id, line.id)));
    const applied = await data(await apply(req(), cp(take.id))); assert.equal(applied.adjustedCount, 1); assert.equal(applied.stockTake.lines[0].valueAdjustmentMinor, "-29");
    assert.equal((await saved(item.id)).quantityOnHand, 9); assert.equal((await data(await whStock(req(), cp(w1.id)))).data[0].quantity, 5);
    await mdenied("apply_stock_take", { stockTakeId: take.id }, ma, 400); await denied(() => takePatch(req({ status: "draft" }), cp(take.id)), 409);
    const global = (await good("create_stock_take", { name: "Global" })).stockTake;
    await good("update_stock_take", { stockTakeId: global.id, status: "in_progress" });
    const gl = (await good("get_stock_take", { stockTakeId: global.id })).stockTake.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === item.id);
    await good("count_stock_take_line", { stockTakeId: global.id, lineId: gl.id, countedQuantity: 9 }); // stored discrepancy zero
    await bulkInventoryItems(ctx, { action: "adjust_stock", ids: [item.id], adjustment: 1 });
    const appliedGlobal = await good("apply_stock_take", { stockTakeId: global.id }); assert.equal(appliedGlobal.adjustedCount, 1); assert.equal((await saved(item.id)).quantityOnHand, 9);
    const draft = (await good("create_stock_take", { name: "Draft" })).stockTake; await good("delete_stock_take", { stockTakeId: draft.id });
    const draft2 = (await data(await takeCreate(req({ name: "Draft2" })), 201)).stockTake; await data(await takeDelete(req(), cp(draft2.id)));
    assert.equal((await good("list_stock_takes")).stockTakes.length, 2); await data(await takeList(req()));
    // Serial/lot operations are allocation metadata, not physical receipts.
    const physicalBefore = await saved(item.id);
    await data(await serialCreate(req({ serialNumbers: ["S1", "S2"], warehouseId: w1.id }), cp(item.id)), 201);
    await good("create_inventory_serials", { inventoryItemId: item.id, serialNumbers: ["S3"] });
    assert.equal((await data(await serialList(req(), cp(item.id)))).pagination.total, 3);
    assert.equal((await good("list_inventory_serials", { inventoryItemId: item.id })).data.length, 3);
    await data(await lotCreate(req({ lotNumber: "L1", quantity: 3, warehouseId: w1.id, manufacturingDate: "2026-10-01", expiryDate: "2026-10-31" }), cp(item.id)), 201);
    await good("create_inventory_lot", { inventoryItemId: item.id, batchNumber: "B1", quantity: 2 });
    assert.equal((await data(await lotList(req(), cp(item.id)))).pagination.total, 2);
    assert.equal((await good("list_inventory_lots", { inventoryItemId: item.id })).data.length, 2); assert.deepEqual(await saved(item.id), physicalBefore);
    const rows = (await data(await moves(req(), cp(item.id)))).data; assert.ok(rows.some((r: { valueMinor: string }) => r.valueMinor === "-29")); assert.ok(rows.every((r: { value: number; valueMinor: string }) => String(r.value) === r.valueMinor));
    await good("list_inventory_movements", { inventoryItemId: item.id });
    for (const period of ["30d", "90d", "12m"]) { await data(await chart(req({}, keys.viewer, `?period=${period}`))); await good("get_inventory_movement_chart", { period }); }
    // Actual authorization and tenant isolation on both transports.
    const [foreignWh] = await db.insert(warehouse).values({ organizationId: b.id, name: "Foreign", code: "FOREIGN" }).returning();
    const foreignItem = await createInventoryItem({ ...ctx, organizationId: b.id }, { code: "FOREIGN", name: "Foreign" });
    for (const fn of [() => whGet(req(), cp(foreignWh.id)), () => whStock(req(), cp(foreignWh.id)), () => itemStock(req(), cp(foreignItem.id)), () => moves(req(), cp(foreignItem.id)), () => lotList(req(), cp(foreignItem.id)), () => serialList(req(), cp(foreignItem.id))]) await denied(fn, 404);
    await denied(() => trCreate(req({ fromWarehouseId: foreignWh.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: item.id, quantity: 1 }] })), 404);
    await mdenied("create_inventory_transfer", { fromWarehouseId: w1.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: foreignItem.id, quantity: 1 }] }, ma, 404);
    await denied(() => takeCreate(req({ name: "Foreign", warehouseId: foreignWh.id })), 404);
    await denied(() => serialCreate(req({ serialNumbers: ["Foreign"], warehouseId: foreignWh.id }), cp(item.id)), 404);
    await mdenied("create_inventory_lot", { inventoryItemId: item.id, quantity: 1, warehouseId: foreignWh.id }, ma, 404);
    await mdenied("get_stock_take", { stockTakeId: take.id }, mb, 404); await mdenied("get_inventory_transfer", { transferId: transfer.id }, mb, 404);
    await mdenied("get_warehouse_stock", { warehouseId: w1.id }, mb, 404); await mdenied("adjust_inventory_stock", { inventoryItemId: item.id, kind: "quantity", quantityDelta: 1, reason: "Foreign" }, mb, 404);
    // Corrupt legacy references must fail scoped reads/completion, never expand foreign metadata.
    const [corrupt] = await db.insert(inventoryTransfer).values({ organizationId: a.id, fromWarehouseId: foreignWh.id, toWarehouseId: w1.id }).returning();
    await denied(() => trGet(req(), cp(corrupt.id)), 404); await denied(() => trComplete(req(), cp(corrupt.id)), 404);
    await db.delete(inventoryTransfer).where(eq(inventoryTransfer.id, corrupt.id));
    const [corruptSerial] = await db.insert(serialNumber).values({ organizationId: a.id, inventoryItemId: item.id, serialNumber: "CORRUPT", warehouseId: foreignWh.id }).returning();
    await denied(() => serialList(req(), cp(item.id)), 404); await db.delete(serialNumber).where(eq(serialNumber.id, corruptSerial.id));
    const [foreignAccount] = await db.insert(chartAccount).values({ organizationId: b.id, code: "FOREIGN", name: "Foreign", type: "asset" }).returning();
    await db.update(inventoryItem).set({ inventoryAccountId: foreignAccount.id }).where(eq(inventoryItem.id, item.id));
    await denied(() => adjust(req({ adjustment: 1, reason: "Foreign account" }), cp(item.id)), 404);
    await mdenied("adjust_inventory_stock", { inventoryItemId: item.id, kind: "write_down", amountMinor: "1", reason: "Foreign account" }, ma, 422);
    await db.update(inventoryItem).set({ inventoryAccountId: null }).where(eq(inventoryItem.id, item.id));
    for (const key of ["dk_invalid", keys.expired]) { await denied(() => whList(req({}, key)), 401); await denied(() => adjust(req({ adjustment: 1, reason: "Denied" }, key), cp(item.id)), 401); }
    await denied(() => adjust(req({ adjustment: 1, reason: "Denied" }, keys.viewer), cp(item.id)), 403);
    await denied(() => whCreate(req({ code: "DENY", name: "Denied" }, keys.viewer)), 403);
    await mdenied("create_warehouse", { code: "DENY", name: "Denied" }, ro, 403);
    await mdenied("apply_stock_take", { stockTakeId: take.id }, ro, 403);
    await mdenied("create_inventory_serials", { inventoryItemId: item.id, serialNumbers: ["DENY"] }, ro, 403);
    const writeDenials = [() => whPatch(req({ name: "Denied" }, keys.viewer), cp(w1.id)), () => whDelete(req({}, keys.viewer), cp(w1.id)),
      () => bulk(req({ adjustments: [{ itemId: item.id, quantity: 1 }] }, keys.viewer)), () => trCreate(req({ fromWarehouseId: w1.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: item.id, quantity: 1 }] }, keys.viewer)),
      () => trPatch(req({ notes: "Denied" }, keys.viewer), cp(transfer.id)), () => trComplete(req({}, keys.viewer), cp(transfer.id)),
      () => takeCreate(req({ name: "Denied" }, keys.viewer)), () => takePatch(req({ name: "Denied" }, keys.viewer), cp(take.id)), () => takeDelete(req({}, keys.viewer), cp(take.id)),
      () => count(req({ countedQuantity: 1 }, keys.viewer), lp(take.id, line.id)), () => apply(req({}, keys.viewer), cp(take.id)),
      () => serialCreate(req({ serialNumbers: ["DENY"] }, keys.viewer), cp(item.id)), () => lotCreate(req({ quantity: 1 }, keys.viewer), cp(item.id))];
    for (const fn of writeDenials) await denied(fn, 403);
    await data(await adjust(req({ adjustment: 1, reason: "Manager" }, keys.manager), cp(item.id)));
    for (const body of [{ adjustment: 0, reason: "Invalid" }, { adjustment: 1.5, reason: "Invalid" }, { adjustment: 2147483648, reason: "Invalid" }, { adjustment: -999, reason: "Invalid" }, { adjustmentType: "write_down", valueDeltaMinor: "01", reason: "Invalid" }, { adjustmentType: "write_down", valueDelta: 1, valueDeltaMinor: "2", reason: "Invalid" }, { adjustmentType: "revaluation", newTotalValueMinor: "-1", reason: "Invalid" }, { adjustment: 1, reason: "Invalid", unknown: 1 }]) await denied(() => adjust(req(body), cp(item.id)), 400);
    await denied(() => adjust(req({ adjustmentType: "revaluation", newTotalValueMinor: "9007199254740992", reason: "Range" }), cp(item.id)), 422);
    await mdenied("adjust_inventory_stock", { inventoryItemId: item.id, kind: "write_down", amountMinor: "9007199254740992", reason: "Range" }, ma, 422);
    await denied(() => bulk(req({ adjustments: [{ itemId: item.id, quantity: 1 }, { itemId: item.id, quantity: 1 }] })), 400);
    await denied(() => bulk(req({ adjustments: [{ itemId: item.id, quantity: 1 }, { itemId: foreignItem.id, quantity: 1 }] })), 404);
    await denied(() => count(req({ countedQuantity: 1.5 }), lp(take.id, line.id)), 400);
    await denied(() => takePatch(req({ status: "completed" }), cp(take.id)), 400);
    await denied(() => chart(req({}, keys.a, "?period=bad")), 400);
    await denied(() => moves(req({}, keys.a, "?page=1junk"), cp(item.id)), 400);
    await denied(() => lotCreate(req({ quantity: 1, manufacturingDate: "2026-02-30" }), cp(item.id)), 400);
    await denied(() => serialCreate(req({ serialNumbers: ["NEW", "S1"] }), cp(item.id)), 409);
    await denied(() => whDelete(req(), cp(w1.id)), 409);
    await mdenied("transfer_inventory_stock", { inventoryItemId: item.id, fromWarehouseId: w1.id, toWarehouseId: w2.id, quantity: 999 }, ma, 400);
    await mdenied("adjust_inventory_stock", { inventoryItemId: item.id, kind: "quantity", quantityDelta: 1, reason: "Date", date: "2026-02-30" });
    // Unsafe saved bigint, products and chart aggregate range.
    await db.execute(sql`update inventory_item set total_value=9007199254740992 where id=${item.id}`);
    await denied(() => adjust(req({ adjustment: 1, reason: "Stored" }), cp(item.id)), 422);
    await db.execute(sql`update inventory_item set total_value=290 where id=${item.id}`);
    const huge = await createInventoryItem(ctx, { code: "HUGE", name: "Huge", purchasePriceMinor: "0" });
    await db.update(inventoryItem).set({ averageCost: Number.MAX_SAFE_INTEGER, quantityOnHand: 1, totalValue: Number.MAX_SAFE_INTEGER }).where(eq(inventoryItem.id, huge.id));
    await denied(() => adjust(req({ adjustment: 1, reason: "Product" }), cp(huge.id)), 422);
    await db.update(inventoryItem).set({ averageCost: 0, quantityOnHand: 0, totalValue: 0 }).where(eq(inventoryItem.id, huge.id));
    const [unsafeMove] = await db.insert(inventoryMovement).values({ organizationId: a.id, inventoryItemId: huge.id, type: "adjustment", quantity: 0, previousQuantity: 0, newQuantity: 0 }).returning();
    await db.execute(sql`update inventory_movement set value=9007199254740992 where id=${unsafeMove.id}`);
    await denied(() => moves(req(), cp(huge.id)), 422); await mdenied("list_inventory_movements", { inventoryItemId: huge.id }, ma, 422);
    await db.delete(inventoryMovement).where(eq(inventoryMovement.id, unsafeMove.id));
    // Chart physical sums exceed int32 without integer SQL overflow; negating int32 min is safe.
    const chartMoves = await db.insert(inventoryMovement).values([2147483647, 2147483647, -2147483648].map(quantity => ({ organizationId: a.id, inventoryItemId: huge.id, type: "adjustment" as const, quantity, previousQuantity: 0, newQuantity: 0 }))).returning();
    const physicalChart = await data(await chart(req())); assert.ok(physicalChart.data.some((r: { in: number; out: number }) => r.in >= 4294967294 && r.out >= 2147483648));
    for (const m of chartMoves) await db.delete(inventoryMovement).where(eq(inventoryMovement.id, m.id));
    // FIFO costs, average exhaustion rounding, no-cost quantities.
    const fifo = await createInventoryItem(ctx, { code: "FIFO", name: "FIFO", purchasePrice: 40, quantityOnHand: 3 });
    await db.update(inventoryItem).set({ costMethod: "fifo", averageCost: 33, totalValue: 100 }).where(eq(inventoryItem.id, fifo.id));
    await db.insert(inventoryCostLayer).values([{ organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 1, remainingQuantity: 1, unitCost: 20, receivedAt: new Date("2026-01-01") }, { organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 2, remainingQuantity: 2, unitCost: 40, receivedAt: new Date("2026-01-02") }]);
    const fi = await data(await adjust(req({ adjustment: -2, reason: "FIFO" }), cp(fifo.id))); assert.equal(fi.movement.valueMinor, "-60"); assert.equal(fi.inventoryItem.totalValueMinor, "40");
    await denied(() => adjust(req({ adjustmentType: "write_down", valueDeltaMinor: "1", reason: "Unsupported FIFO" }), cp(fifo.id)), 422);
    const rounding = await createInventoryItem(ctx, { code: "ROUND", name: "Rounding", purchasePrice: 1, quantityOnHand: 2 });
    await adjustInventory(ctx, rounding.id, { adjustmentType: "revaluation", newTotalValueMinor: "1", reason: "Rounding" });
    const exhausted = await data(await adjust(req({ adjustment: -2, reason: "Exhaust" }), cp(rounding.id))); assert.equal(exhausted.movement.valueMinor, "-1"); assert.equal(exhausted.inventoryItem.totalValueMinor, "0");
    // A rounded unit-cost product may exceed safe range even though the exact
    // authoritative carrying value and the final movement are representable.
    const edge = await createInventoryItem(ctx, { code: "EDGE", name: "Edge" });
    await db.update(inventoryItem).set({ quantityOnHand: 2, totalValue: Number.MAX_SAFE_INTEGER, averageCost: 4503599627370496 }).where(eq(inventoryItem.id, edge.id));
    const edgeIssue = await data(await adjust(req({ adjustment: -2, reason: "Exact exhaustion" }), cp(edge.id)));
    assert.equal(edgeIssue.movement.valueMinor, "-9007199254740991"); assert.equal(edgeIssue.inventoryItem.totalValueMinor, "0");
    const zero = await createInventoryItem(ctx, { code: "ZERO", name: "Zero" }); const zr = await adjustInventory(ctx, zero.id, { adjustment: 1, reason: "Free" }); assert.equal(zr.journalEntryId, null); assert.equal(zr.movement?.valueMinor, "0");
    // Period lock must protect both stock and value adjustments/takes.
    const date = new Date().toISOString().slice(0, 10); const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: date }).returning();
    await denied(() => adjust(req({ adjustment: 1, reason: "Locked" }), cp(item.id)), 422);
    await mdenied("adjust_inventory_stock", { inventoryItemId: item.id, kind: "revaluation", amountMinor: "1", reason: "Locked" }, ma, 422);
    await denied(() => apply(req(), cp(take.id)), 422); await mdenied("apply_stock_take", { stockTakeId: global.id }, ma, 422);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    // Concurrent completion and different stock writers must not double-spend/overwrite.
    const concurrent = (await good("create_inventory_transfer", { fromWarehouseId: w1.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: item.id, quantity: 1 }] })).transfer;
    const cr = await Promise.allSettled([completeInventoryTransfer(ctx, concurrent.id), completeInventoryTransfer(ctx, concurrent.id)]); assert.equal(cr.filter(r => r.status === "fulfilled").length, 1);
    const prior = await saved(item.id); await Promise.all([adjustInventory(ctx, item.id, { adjustment: 1, reason: "Concurrent" }), bulkInventoryItems(ctx, { action: "adjust_stock", ids: [item.id], adjustment: 1 })]);
    assert.equal((await saved(item.id)).quantityOnHand, prior.quantityOnHand + 2);
    const stale = await saved(item.id); await adjustInventory(ctx, item.id, { adjustment: 1, reason: "Fresh" }); const staleSnapshot = await snapshot();
    await assert.rejects(() => db.transaction(tx => recordInventoryReceipt(tx, { item: stale, quantity: 1, unitCost: 29 })), /concurrently/); assert.deepEqual(await snapshot(), staleSnapshot);
    // Same item lock shared with MON-052 receipt writer. No financial receipt semantics changed.
    const priorReceipt = await saved(item.id);
    await Promise.all([db.transaction(tx => billStockMovement(tx, ctx, { billId: item.id, itemId: item.id, warehouseId: w1.id, quantity: 1, value: 29, journalEntryId: null, referenceType: "goods_receipt" })), adjustInventory(ctx, item.id, { adjustment: 1, reason: "Receipt race" })]);
    assert.equal((await saved(item.id)).quantityOnHand, priorReceipt.quantityOnHand + 2); assert.equal((await saved(item.id)).totalValue, priorReceipt.totalValue + 58);
    // Inject audit failure; every mutation family must roll back physical/GL/state rows.
    const auditTake = await createStockTake(ctx, { name: "Audit take" }); await updateStockTake(ctx, auditTake.id, { status: "in_progress" });
    const auditLine = (await good("get_stock_take", { stockTakeId: auditTake.id })).stockTake.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === item.id);
    await countStockTakeLine(ctx, auditTake.id, auditLine.id, { countedQuantity: (await saved(item.id)).quantityOnHand + 1 });
    const auditDraft = await createStockTake(ctx, { name: "Delete audit" });
    const auditWh = await writeWarehouse(ctx, { code: "AUDIT", name: "Audit" });
    const auditTransfer = await createInventoryTransfer(ctx, { fromWarehouseId: w1.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: item.id, quantity: 1 }] });
    await db.execute(sql.raw("CREATE FUNCTION fail_movement_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$; CREATE TRIGGER movement_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_movement_audit();"));
    const failures = [() => adjustInventory(ctx, item.id, { adjustment: 1, reason: "Audit" }), () => adjustInventory(ctx, item.id, { adjustmentType: "revaluation", newTotalValueMinor: "1000", reason: "Audit" }),
      () => bulkAdjustInventory(ctx, { adjustments: [{ itemId: item.id, quantity: 1 }] }), () => writeWarehouse(ctx, { code: "FAIL", name: "Fail" }), () => writeWarehouse(ctx, { name: "Fail" }, auditWh.id), () => deleteWarehouse(ctx, auditWh.id),
      () => createInventoryTransfer(ctx, { fromWarehouseId: w1.id, toWarehouseId: w2.id, lines: [{ inventoryItemId: item.id, quantity: 1 }] }), () => completeInventoryTransfer(ctx, auditTransfer.id), () => updateInventoryTransfer(ctx, auditTransfer.id, { notes: "Fail" }),
      () => createStockTake(ctx, { name: "Fail" }), () => updateStockTake(ctx, auditTake.id, { name: "Fail" }), () => deleteStockTake(ctx, auditDraft.id), () => countStockTakeLine(ctx, auditTake.id, auditLine.id, { countedQuantity: 1 }), () => applyStockTake(ctx, auditTake.id),
      () => createSerials(ctx, item.id, { serialNumbers: ["FAIL"] }), () => createLot(ctx, item.id, { quantity: 1 })];
    for (const fn of failures) { const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before); }
    await db.execute(sql.raw("DROP TRIGGER movement_audit_failure ON audit_log; DROP FUNCTION fail_movement_audit();"));
    const balanced = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.organization_id=${a.id} group by e.id having sum(l.debit_amount) <> sum(l.credit_amount)`); assert.equal(balanced.rows.length, 0);
    const mismatched = await db.execute(sql`select m.id from inventory_movement m join journal_line l on l.journal_entry_id=m.journal_entry_id join chart_account c on c.id=l.account_id where m.organization_id=${a.id} and c.type='asset' group by m.id,m.value having sum(l.debit_amount-l.credit_amount) <> m.value`); assert.equal(mismatched.rows.length, 0);
    const wrongCurrency = await db.execute(sql`select l.id from journal_line l join journal_entry e on e.id=l.journal_entry_id where e.organization_id=${a.id} and l.currency_code <> 'KWD'`); assert.equal(wrongCurrency.rows.length, 0);
    const unlinked = await db.execute(sql`select id from inventory_movement where organization_id=${a.id} and value<>0 and type not in ('transfer_in','transfer_out') and journal_entry_id is null`);
    // Only the explicitly synthetic cross-writer receipt (above) omits its GL fixture.
    assert.equal(unlinked.rows.length, 1);
    console.log("Inventory movement contracts verified: REST/MCP, exact/legacy money, 2 tenants, cost flow, locks, counts, transfers, races and 16 audit rollbacks");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), full.close()]); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  const pool = (db as unknown as { $client?: { end(): Promise<void> } }).$client; void pool?.end();
});
