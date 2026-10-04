import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, inventoryItem, inventoryCostLayer, bomComponent, billOfMaterials, chartAccount, periodLock, fiscalYear, contact, purchaseOrder, purchaseOrderLine } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as boms, POST as createBom } from "../../app/api/v1/inventory/bom/route";
import { GET as getBom, PATCH as updateBom, DELETE as deleteBom } from "../../app/api/v1/inventory/bom/[id]/route";
import { GET as components, POST as addComponent, PATCH as editComponent, DELETE as removeComponent } from "../../app/api/v1/inventory/bom/[id]/components/route";
import { GET as orders, POST as createOrder } from "../../app/api/v1/inventory/assembly-orders/route";
import { GET as getOrder, PATCH as updateOrder, DELETE as deleteOrder } from "../../app/api/v1/inventory/assembly-orders/[id]/route";
import { POST as complete } from "../../app/api/v1/inventory/assembly-orders/[id]/complete/route";
import { POST as receiveGoods } from "../../app/api/v1/goods-receipts/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerInventoryTools } from "../../lib/mcp/tools/inventory";
import { registerInventoryAssemblyTools } from "../../lib/mcp/tools/inventory-assembly";
import { createLandedCost, allocateLandedCost } from "../../lib/api/landed-costs";
import { recordInventoryReceipt } from "../../lib/api/inventory-valuation";
import { adjustInventory } from "../../lib/api/inventory-movements";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Assembly fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else { registerInventoryTools(server, ctx); registerInventoryAssemblyTools(server, ctx); }
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) {
    assert.equal(tools.length, 15);
    for (const t of tools) { assert.equal(t.inputSchema.additionalProperties, false, t.name);
      for (const p of Object.values(t.inputSchema.properties ?? {})) assert.ok((p as { description?: string }).description, t.name);
    }
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { error: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Assembly A", slug: "assembly-a" }, { name: "Assembly B", slug: "assembly-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "assembly-owner@example.test" }, { email: "assembly-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_assembly_a", b: "dk_assembly_b", viewer: "dk_assembly_viewer", expired: "dk_assembly_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_assembly", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, permissions: [] }), full = await mcp(ctx, true);
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/inventory${query}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const cp = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const good = async (name: string, args: Record<string, unknown> = {}, client = ma) => { const r = await client.call(name, args); assert.equal(r.error, false, JSON.stringify(r.body)); return r.body; };
  const tables = ["bill_of_materials", "bom_component", "assembly_order", "inventory_item", "inventory_movement", "inventory_cost_layer", "inventory_layer_consumption", "journal_entry", "journal_line", "chart_account", "audit_log"];
  const snapshot = async () => Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => { const before = await snapshot(), r = await client.call(name, args); assert.equal(r.error, true, name); if (status) assert.equal(r.body.status, status, JSON.stringify(r.body)); assert.deepEqual(await snapshot(), before); };
  const saved = async (id: string) => (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, id) }))!;
  const today = new Date().toISOString().slice(0, 10);
  let serial = 0;
  const item = async (org = a.id, method: "average" | "fifo" | "standard" = "average", quantity = 0, price = 0) => {
    const [row] = await db.insert(inventoryItem).values({ organizationId: org, code: `I-${++serial}`, name: `Stock ${serial}`, costMethod: method, purchasePrice: price }).returning();
    if (quantity) await db.transaction(tx => recordInventoryReceipt(tx, { item: row, quantity, unitCost: price }));
    return row;
  };
  const recipe = async (finished: string, component: string, quantity = "1", extra: object = {}) => {
    const r = (await good("create_bom", { assemblyItemId: finished, name: "Kit", ...extra })).bom;
    await good("add_bom_component", { bomId: r.id, componentItemId: component, quantityExact: quantity }); return r;
  };
  const newOrder = async (bomId: string, quantity = 1) => (await good("create_assembly_order", { bomId, quantity })).order;
  try {
    const component = await item(a.id, "fifo", 0, 29), finished = await item(a.id, "fifo"), foreign = await item(b.id);
    // Actual MON-052 receipt followed by MON-077 capitalization, then assembly.
    const [supplier] = await db.insert(contact).values({ organizationId: a.id, name: "Supplier", type: "supplier" }).returning();
    const [po] = await db.insert(purchaseOrder).values({ organizationId: a.id, contactId: supplier.id, poNumber: "ASM-PO", issueDate: today, currencyCode: "USD", status: "sent", total: 87, subtotal: 87 }).returning();
    const [pol] = await db.insert(purchaseOrderLine).values({ purchaseOrderId: po.id, inventoryItemId: component.id, description: "Stock", quantity: 300, unitPrice: 29, amount: 87 }).returning();
    await data(await receiveGoods(req({ purchaseOrderId: po.id, date: today, lines: [{ purchaseOrderLineId: pol.id, quantityExact: "3" }] })), 201);
    const lc = await createLandedCost(ctx, { name: "Freight", purchaseOrderId: po.id, components: [{ description: "Freight", amountMinor: "1" }] });
    await allocateLandedCost(ctx, lc.id);
    const bom = (await data(await createBom(req({ assemblyItemId: finished.id, name: "Kit", laborCostCents: 2, laborCostCentsMinor: "2", overheadCostCentsMinor: "1" })), 201)).bom;
    assert.equal(bom.laborCostCents, 2); assert.equal(bom.overheadCostCentsMinor, "1");
    const comp = (await data(await addComponent(req({ componentItemId: component.id, quantity: 1, quantityExact: "1.0", wastagePercent: 0 }), cp(bom.id)), 201)).component;
    assert.equal(comp.quantityExact, "1.0");
    assert.equal((await data(await getBom(req(), cp(bom.id)))).costBreakdown.totalCostMinor, "32");
    assert.equal((await good("get_bom", { bomId: bom.id })).bom.currencyCode, "USD");
    assert.equal((await data(await boms(req()))).data.length, 1); assert.equal((await good("list_boms")).data.length, 1);
    assert.equal((await data(await components(req(), cp(bom.id)))).components.length, 1);
    assert.equal((await good("list_bom_components", { bomId: bom.id })).components[0].componentItem.purchasePriceMinor, "29");
    await data(await updateBom(req({ description: "Retained costs" }), cp(bom.id)));
    await good("update_bom", { bomId: bom.id, name: "Exact kit" });
    await data(await editComponent(req({ quantityExact: "1" }, keys.a, `?componentId=${comp.id}`), cp(bom.id)));
    await good("update_bom_component", { bomId: bom.id, componentId: comp.id, wastagePercentExact: "0" });
    const order = (await data(await createOrder(req({ bomId: bom.id, quantity: 3 })), 201)).order;
    await data(await updateOrder(req({ status: "in_progress" }), cp(order.id)));
    assert.equal((await data(await getOrder(req(), cp(order.id)))).order.quantity, 3);
    assert.equal((await good("get_assembly_order", { assemblyOrderId: order.id })).order.bom.laborCostCentsMinor, "2");
    assert.equal((await data(await orders(req()))).data.length, 1); assert.equal((await good("list_assembly_orders")).data.length, 1);
    const built = await data(await complete(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` } }), cp(order.id)));
    assert.equal(built.totalCostMinor, "97"); assert.equal(built.unitCostMinor, "32"); assert.equal(built.componentCostMinor, "88"); assert.equal(built.conversionCostMinor, "9");
    assert.equal((await saved(component.id)).totalValue, 0); assert.equal((await saved(finished.id)).totalValue, 97);
    const layer = (await db.query.inventoryCostLayer.findFirst({ where: eq(inventoryCostLayer.inventoryItemId, finished.id) }))!;
    assert.equal(layer.unitCost, 32); assert.equal(layer.remainingValue, 97);
    const legs = await db.query.journalLine.findMany({ where: (l, { eq }) => eq(l.journalEntryId, built.journalEntryId) });
    assert.equal(legs.reduce((s, l) => s + l.debitAmount, 0), 97); assert.equal(legs.reduce((s, l) => s + l.creditAmount, 0), 97);
    assert.equal(legs.find(l => l.creditAmount === 9)?.currencyCode, "USD");
    await denied(() => complete(req(), cp(order.id)), 409); await mdenied("build_assembly", { assemblyOrderId: order.id }, ma, 409);
    await denied(() => updateOrder(req({ status: "draft" }), cp(order.id)), 409); await denied(() => deleteOrder(req(), cp(order.id)), 409);
    assert.equal((await adjustInventory(ctx, finished.id, { adjustment: -1, reason: "Partial sale" })).movement?.valueMinor, "-32");
    assert.equal((await adjustInventory(ctx, finished.id, { adjustment: -2, reason: "Exhaust residual" })).movement?.valueMinor, "-65");
    assert.equal((await saved(finished.id)).totalValue, 0);

    const stock = await item(a.id, "average", 20, 1), target = await item();
    const duplicate = await recipe(target.id, stock.id, "0.1");
    const second = (await good("add_bom_component", { bomId: duplicate.id, componentItemId: stock.id, quantity: 0.2 })).component;
    const dupOrder = await newOrder(duplicate.id, 3);
    const dupResult = await good("build_assembly", { assemblyOrderId: dupOrder.id, date: today });
    assert.equal(dupResult.totalCostMinor, "2"); assert.equal((await saved(stock.id)).quantityOnHand, 18);
    assert.equal((await saved(target.id)).totalValue, 2); // rounded per-unit 1 must not receive 3
    const exactCeil = await recipe((await item()).id, stock.id, "0.07"), ceilOrder = await newOrder(exactCeil.id, 100);
    assert.equal((await good("build_assembly", { assemblyOrderId: ceilOrder.id })).componentCostMinor, "7");
    const wasteBom = await recipe((await item()).id, stock.id, "0.5");
    const wasteComponent = (await good("list_bom_components", { bomId: wasteBom.id })).components[0];
    await good("update_bom_component", { bomId: wasteBom.id, componentId: wasteComponent.id, wastagePercentExact: "10" });
    const wasteOrder = await newOrder(wasteBom.id, 2);
    assert.equal((await good("build_assembly", { assemblyOrderId: wasteOrder.id })).componentCostMinor, "2");

    const foreignBom = (await good("create_bom", { assemblyItemId: foreign.id, name: "Other" }, mb)).bom;
    const foreignOrder = (await good("create_assembly_order", { bomId: foreignBom.id, quantity: 1 }, mb)).order;
    for (const key of [keys.expired, "dk_invalid"]) await denied(() => boms(req({}, key)), 401);
    assert.ok((await data(await boms(req({}, keys.viewer)))).data.length);
    await denied(() => createBom(req({ assemblyItemId: target.id, name: "Denied" }, keys.viewer)), 403);
    for (const [name, args] of [
      ["create_bom", { assemblyItemId: target.id, name: "Denied" }], ["update_bom", { bomId: bom.id, name: "Denied" }], ["delete_bom", { bomId: bom.id }],
      ["add_bom_component", { bomId: bom.id, componentItemId: stock.id, quantity: 1 }], ["update_bom_component", { bomId: duplicate.id, componentId: second.id, quantity: 1 }], ["remove_bom_component", { bomId: duplicate.id, componentId: second.id }],
      ["create_assembly_order", { bomId: bom.id, quantity: 1 }], ["update_assembly_order", { assemblyOrderId: order.id, notes: "Denied" }], ["delete_assembly_order", { assemblyOrderId: order.id }], ["build_assembly", { assemblyOrderId: order.id }],
    ] as const) await mdenied(name, args, ro, 403);
    assert.ok((await good("list_assembly_orders", {}, ro)).data.length);
    await denied(() => getBom(req(), cp(foreignBom.id)), 404); await denied(() => getOrder(req(), cp(foreignOrder.id)), 404);
    await denied(() => removeComponent(req({}, keys.b, `?componentId=${second.id}`), cp(duplicate.id)), 404);
    await mdenied("create_bom", { assemblyItemId: foreign.id, name: "Foreign" }, ma, 404);
    await mdenied("add_bom_component", { bomId: duplicate.id, componentItemId: foreign.id, quantity: 1 }, ma, 404);
    await mdenied("create_assembly_order", { bomId: foreignBom.id, quantity: 1 }, ma, 404);
    await mdenied("build_assembly", { assemblyOrderId: foreignOrder.id }, ma, 404);
    await denied(() => addComponent(req({ componentItemId: target.id, quantity: 1 }), cp(duplicate.id)), 422);
    await denied(() => createBom(req({ assemblyItemId: target.id, name: "Bad", laborCostCents: 1, laborCostCentsMinor: "2" })), 400);
    await denied(() => createBom(req({ assemblyItemId: target.id, name: "Unsafe", laborCostCentsMinor: "9007199254740992" })), 422);
    await denied(() => createBom(req({ assemblyItemId: target.id, name: "Unsafe total", laborCostCentsMinor: "9007199254740991", overheadCostCents: 1 })), 422);
    await denied(() => updateBom(req({ laborCostCentsMinor: "9007199254740991" }), cp(bom.id)), 422);
    await denied(() => updateOrder(req({ status: "completed" }), cp(dupOrder.id)), 400);
    await denied(() => addComponent(req({ componentItemId: stock.id, quantity: "-1" }), cp(duplicate.id)), 400);
    await denied(() => addComponent(req({ componentItemId: stock.id, quantityExact: "0.0000001" }), cp(duplicate.id)), 400);
    await denied(() => complete(req({ date: "2025-02-29" }), cp(dupOrder.id)), 400);
    await mdenied("build_assembly", { assemblyOrderId: dupOrder.id, unexpected: 1 });
    await denied(() => createBom(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);

    const pending = await newOrder(duplicate.id, 2);
    await good("update_bom", { bomId: duplicate.id, isActive: false });
    await denied(() => complete(req(), cp(pending.id)), 422);
    await mdenied("create_assembly_order", { bomId: duplicate.id, quantity: 1 }, ma, 422);
    await good("update_bom", { bomId: duplicate.id, isActive: true });
    await denied(() => deleteBom(req(), cp(duplicate.id)), 409);
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today, advisorLockDate: today }).returning();
    await denied(() => complete(req(), cp(pending.id)), 422); await mdenied("build_assembly", { assemblyOrderId: pending.id }, ma, 422);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [tierLock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today, advisorLockDate: "2020-01-01" }).returning();
    const staff = await mcp({ ...ctx, permissions: ["manage:inventory"] });
    await mdenied("build_assembly", { assemblyOrderId: pending.id }, staff, 422); await staff.close();
    const unlockedOrder = await newOrder(duplicate.id);
    assert.equal((await good("build_assembly", { assemblyOrderId: unlockedOrder.id })).order.status, "completed");
    await db.delete(periodLock).where(eq(periodLock.id, tierLock.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2020-01-01", endDate: "2020-12-31", isClosed: true }).returning();
    await mdenied("build_assembly", { assemblyOrderId: pending.id, date: "2020-06-01" }, ma, 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    await good("update_assembly_order", { assemblyOrderId: pending.id, status: "cancelled" });
    await mdenied("build_assembly", { assemblyOrderId: pending.id }, ma, 409);
    await good("delete_assembly_order", { assemblyOrderId: pending.id });
    await good("remove_bom_component", { bomId: duplicate.id, componentId: second.id });
    await denied(() => removeComponent(req({}, keys.a, `?componentId=${second.id}`), cp(duplicate.id)), 404);
    await data(await removeComponent(req({}, keys.a, `?componentId=${comp.id}`), cp(bom.id)));

    // Duplicates cannot overdraw one item even when each separate line appears affordable.
    const scarce = await item(a.id, "average", 1, 5), scarceBom = await recipe((await item()).id, scarce.id);
    await good("add_bom_component", { bomId: scarceBom.id, componentItemId: scarce.id, quantity: 1 });
    const scarceOrder = await newOrder(scarceBom.id); await denied(() => complete(req(), cp(scarceOrder.id)), 422);
    const corruptedBom = await recipe((await item()).id, stock.id), corruptedOrder = await newOrder(corruptedBom.id);
    const corruptedComp = (await db.query.bomComponent.findFirst({ where: eq(bomComponent.bomId, corruptedBom.id) }))!;
    await db.update(bomComponent).set({ componentItemId: foreign.id }).where(eq(bomComponent.id, corruptedComp.id));
    await denied(() => getBom(req(), cp(corruptedBom.id)), 404); await mdenied("build_assembly", { assemblyOrderId: corruptedOrder.id }, ma, 404);
    await db.update(bomComponent).set({ componentItemId: stock.id }).where(eq(bomComponent.id, corruptedComp.id));
    const badFifo = await item(a.id, "fifo", 2, 5), badFifoBom = await recipe((await item()).id, badFifo.id), badFifoOrder = await newOrder(badFifoBom.id);
    await db.update(inventoryItem).set({ totalValue: 11 }).where(eq(inventoryItem.id, badFifo.id));
    await mdenied("build_assembly", { assemblyOrderId: badFifoOrder.id }, ma, 422);
    await db.update(inventoryItem).set({ totalValue: 10 }).where(eq(inventoryItem.id, badFifo.id));
    await db.update(inventoryCostLayer).set({ originalQuantity: 1 }).where(eq(inventoryCostLayer.inventoryItemId, badFifo.id));
    await mdenied("build_assembly", { assemblyOrderId: badFifoOrder.id }, ma, 422);
    await db.update(inventoryCostLayer).set({ originalQuantity: 2 }).where(eq(inventoryCostLayer.inventoryItemId, badFifo.id));
    const standard = await item(a.id, "standard", 2, 5), standardBom = await recipe((await item()).id, standard.id), standardOrder = await newOrder(standardBom.id);
    await mdenied("build_assembly", { assemblyOrderId: standardOrder.id }, ma, 422);
    await db.update(inventoryItem).set({ isActive: false }).where(eq(inventoryItem.id, stock.id));
    await denied(() => complete(req(), cp(corruptedOrder.id)), 404); await db.update(inventoryItem).set({ isActive: true }).where(eq(inventoryItem.id, stock.id));
    const [foreignAccount] = await db.insert(chartAccount).values({ organizationId: b.id, code: "FOREIGN", name: "Foreign inventory", type: "asset", currencyCode: "USD" }).returning();
    await db.update(inventoryItem).set({ inventoryAccountId: foreignAccount.id }).where(eq(inventoryItem.id, stock.id));
    await mdenied("build_assembly", { assemblyOrderId: corruptedOrder.id }, ma, 422);
    await db.update(inventoryItem).set({ inventoryAccountId: null }).where(eq(inventoryItem.id, stock.id));

    // Audit failures must roll back all CRUD, movements, FIFO layers, journal and status.
    await db.execute(sql.raw("create function reject_assembly_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type in ('bill_of_materials','assembly_order') then raise exception 'injected assembly audit failure'; end if; return NEW; end $$; create trigger reject_assembly_audit before insert on audit_log for each row execute function reject_assembly_audit()"));
    await denied(() => createBom(req({ assemblyItemId: target.id, name: "Rollback" })), 500);
    await denied(() => addComponent(req({ componentItemId: stock.id, quantity: 1 }), cp(duplicate.id)), 500);
    await denied(() => updateBom(req({ name: "Rollback" }), cp(duplicate.id)), 500);
    await denied(() => editComponent(req({ quantity: 2 }, keys.a, `?componentId=${corruptedComp.id}`), cp(corruptedBom.id)), 500);
    await denied(() => createOrder(req({ bomId: duplicate.id, quantity: 1 })), 500);
    await denied(() => updateOrder(req({ notes: "Rollback" }), cp(corruptedOrder.id)), 500);
    await denied(() => deleteOrder(req(), cp(corruptedOrder.id)), 500);
    await denied(() => complete(req(), cp(corruptedOrder.id)), 500);
    await denied(() => removeComponent(req({}, keys.a, `?componentId=${corruptedComp.id}`), cp(corruptedBom.id)), 500);
    const emptyForDelete = (await db.query.billOfMaterials.findFirst({ where: eq(billOfMaterials.id, bom.id) }))!;
    await denied(() => deleteBom(req(), cp(emptyForDelete.id)), 500);
    await db.execute(sql.raw("drop trigger reject_assembly_audit on audit_log; drop function reject_assembly_audit()"));

    // One winner across simultaneous REST/MCP completions.
    const concurrent = await newOrder(duplicate.id);
    const [rest, tool] = await Promise.all([complete(req(), cp(concurrent.id)), ma.call("build_assembly", { assemblyOrderId: concurrent.id })]);
    assert.ok((rest.status === 200 && tool.error && tool.body.status === 409) || (rest.status === 409 && !tool.error));
    const count = await db.execute(sql`select count(*)::int as count from journal_entry where source_id=${concurrent.id}`); assert.equal(count.rows[0].count, 1);
    const high = await item(a.id, "average", 2, 2147483648), highBom = await recipe((await item()).id, high.id), highOrder = await newOrder(highBom.id);
    assert.equal((await good("build_assembly", { assemblyOrderId: highOrder.id })).totalCostMinor, "2147483648");
    const overflowStock = await item(a.id, "average", 2);
    const overflow = await recipe((await item()).id, overflowStock.id, "1", { laborCostCentsMinor: "9007199254740991" }), overflowOrder = await newOrder(overflow.id, 2);
    await denied(() => complete(req(), cp(overflowOrder.id)), 422);
    await db.execute(sql`update bill_of_materials set labor_cost_cents=9007199254740992 where id=${overflow.id}`);
    await denied(() => getBom(req(), cp(overflow.id)), 422); await db.update(billOfMaterials).set({ laborCostCents: 0 }).where(eq(billOfMaterials.id, overflow.id));
    const zeroStock = await item(a.id, "average", 1), zeroBom = await recipe((await item()).id, zeroStock.id), zeroOrder = await newOrder(zeroBom.id);
    assert.equal((await good("build_assembly", { assemblyOrderId: zeroOrder.id })).totalCostMinor, "0");
    const emptyBom = (await good("create_bom", { assemblyItemId: target.id, name: "Empty" })).bom;
    const emptyOrder = await newOrder(emptyBom.id);
    await denied(() => complete(req(), cp(emptyOrder.id)), 422);
    const disposable = (await good("create_bom", { assemblyItemId: target.id, name: "Disposable" })).bom;
    await good("delete_bom", { bomId: disposable.id }); await denied(() => updateBom(req({ name: "Revive" }), cp(disposable.id)), 404);
    const disposableRest = (await good("create_bom", { assemblyItemId: target.id, name: "Disposable REST" })).bom;
    await data(await deleteBom(req(), cp(disposableRest.id)));
    const orderToDelete = await newOrder(duplicate.id); await data(await deleteOrder(req(), cp(orderToDelete.id)));
    // Historical null carrying fields retain their original unit-cost product.
    const historical = await item(a.id, "fifo", 2, 7), historicalBom = await recipe((await item()).id, historical.id), historicalOrder = await newOrder(historicalBom.id, 2);
    await db.update(inventoryCostLayer).set({ remainingValue: null }).where(eq(inventoryCostLayer.inventoryItemId, historical.id));
    assert.equal((await good("build_assembly", { assemblyOrderId: historicalOrder.id })).totalCostMinor, "14");
    // Financial invariants across all successfully posted entries and linked assembly movements.
    const unbalanced = await db.execute(sql.raw("select journal_entry_id from journal_line group by journal_entry_id having sum(debit_amount)<>sum(credit_amount)")); assert.equal(unbalanced.rows.length, 0);
    const unlinked = await db.execute(sql.raw("select id from inventory_movement where reference_type='assembly_order' and journal_entry_id is null")); assert.equal(unlinked.rows.length, 0);
    assert.ok((await full.call("list_boms")).error === false);
    console.log("Inventory assembly contracts verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); await full.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
