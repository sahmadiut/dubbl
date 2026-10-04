import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, purchaseOrder, purchaseOrderLine, inventoryItem, inventoryCostLayer, inventoryLayerConsumption, landedCostAllocation, landedCostComponent, chartAccount, periodLock, bill } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/landed-costs/route";
import { GET as get, PUT as update, DELETE as remove } from "../../app/api/v1/landed-costs/[id]/route";
import { POST as allocate } from "../../app/api/v1/landed-costs/[id]/allocate/route";
import { GET as report } from "../../app/api/v1/reports/inventory-valuation/route";
import { GET as layers } from "../../app/api/v1/inventory/[id]/cost-layers/route";
import { POST as receive } from "../../app/api/v1/goods-receipts/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerLandedCostTools } from "../../lib/mcp/tools/landed-costs";
import { registerInventoryValuationTools } from "../../lib/mcp/tools/inventory-valuation";
import { allocateLandedCost, createLandedCost, updateLandedCost, deleteLandedCost } from "../../lib/api/landed-costs";
import { recordInventoryIssue, recordInventoryReceipt } from "../../lib/api/inventory-valuation";
import { adjustInventory } from "../../lib/api/inventory-movements";
import { billStockMovement } from "../../lib/api/bill-stock";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Valuation fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else { registerLandedCostTools(server, ctx); registerInventoryValuationTools(server, ctx); }
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) { assert.equal(tools.length, 8); for (const t of tools) {
    assert.equal(t.inputSchema.additionalProperties, false, t.name);
    for (const p of Object.values(t.inputSchema.properties ?? {})) assert.ok((p as { description?: string }).description, t.name);
  } }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { error: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Valuation A", slug: "valuation-a" }, { name: "Valuation B", slug: "valuation-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "valuation-owner@example.test" }, { email: "valuation-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_valuation_a", b: "dk_valuation_b", viewer: "dk_valuation_viewer", expired: "dk_valuation_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_valuation", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "Supplier A", type: "supplier" }, { organizationId: b.id, name: "Supplier B", type: "supplier" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [] }), full = await mcp(ctx, true);
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/landed-costs${query}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const cp = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const good = async (name: string, args: Record<string, unknown> = {}, client = ma) => { const r = await client.call(name, args); assert.equal(r.error, false, JSON.stringify(r.body)); return r.body; };
  const tables = ["inventory_item", "inventory_movement", "inventory_cost_layer", "inventory_layer_consumption", "landed_cost_allocation", "landed_cost_component", "landed_cost_line_allocation", "journal_entry", "journal_line", "chart_account", "audit_log", "goods_receipt", "goods_receipt_line", "purchase_order_line"];
  const snapshot = async () => Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => { const before = await snapshot(), r = await client.call(name, args); assert.equal(r.error, true, name); if (status) assert.equal(r.body.status, status, JSON.stringify(r.body)); assert.deepEqual(await snapshot(), before); };
  const saved = async (id: string) => (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, id) }))!;
  const today = new Date().toISOString().slice(0, 10);
  const batch = (po: string, amountMinor = "1", extra: object = {}) => ({ name: "Freight", purchaseOrderId: po, components: [{ description: "Freight", amountMinor }], ...extra });
  const newPo = async (id: string, items: string[], currencyCode = "USD") => {
    const [po] = await db.insert(purchaseOrder).values({ organizationId: id, contactId: id === a.id ? supplier.id : foreignSupplier.id, poNumber: `PO-${Math.random()}`, issueDate: today, status: "sent", currencyCode, subtotal: items.length * 87, total: items.length * 87 }).returning();
    const lines = await db.insert(purchaseOrderLine).values(items.map((item, i) => ({ purchaseOrderId: po.id, inventoryItemId: item, description: "Stock", quantity: 300, unitPrice: 29, amount: 87, sortOrder: i }))).returning();
    return { po, lines };
  };
  try {
    const [fifo, average, other] = await db.insert(inventoryItem).values([{ organizationId: a.id, code: "FIFO", name: "FIFO", costMethod: "fifo", purchasePrice: 29, salePrice: 50 }, { organizationId: a.id, code: "AVG", name: "Average", purchasePrice: 29, salePrice: 50 }, { organizationId: b.id, code: "OTHER", name: "Other" }]).returning();
    const { po, lines } = await newPo(a.id, [fifo.id, average.id]);
    const gr = await data(await receive(req({ purchaseOrderId: po.id, date: today, lines: lines.map(l => ({ purchaseOrderLineId: l.id, quantityExact: "3" })) })), 201);
    assert.ok(gr.journalEntryId); assert.equal((await saved(fifo.id)).totalValue, 87);
    const historical = await db.query.inventoryCostLayer.findFirst({ where: eq(inventoryCostLayer.inventoryItemId, fifo.id) }); assert.ok(historical);
    // Simulate old layer rows; read derives the same old product without a backfill.
    await db.update(inventoryCostLayer).set({ remainingValue: null }).where(eq(inventoryCostLayer.id, historical.id));
    assert.equal((await data(await layers(req(), cp(fifo.id)))).data[0].remainingValueMinor, "87");
    const created = (await data(await create(req(batch(po.id, "1"))), 201)).allocation;
    assert.equal(created.totalCostAmountMinor, "1");
    const allocated = await data(await allocate(req(), cp(created.id))); assert.ok(allocated.journalEntryId);
    assert.deepEqual(allocated.lineAllocations.map((l: { allocatedAmountMinor: string }) => l.allocatedAmountMinor), ["1", "0"]);
    const fifoAfter = await saved(fifo.id); assert.equal(fifoAfter.totalValue, 88);
    const layer = (await data(await layers(req(), cp(fifo.id)))).data[0]; assert.equal(layer.remainingValueMinor, "88"); assert.equal(layer.unitCostMinor, "29");
    const r = await data(await report(req())); assert.equal(r.summary.carryingValueMinor, "175"); assert.equal(r.summary.totalCostMinor, "174");
    assert.equal((await good("get_inventory_valuation")).summary.carryingValueMinor, "175");
    assert.equal((await good("list_inventory_cost_layers", { inventoryItemId: fifo.id })).data[0].remainingValueMinor, "88");
    const detail = await data(await get(req(), cp(created.id))); assert.equal(detail.components[0].amountMinor, "1"); assert.equal(detail.purchaseOrder.lines[0].unitPriceMinor, "29");
    assert.equal((await good("get_landed_cost", { landedCostId: created.id })).allocation.totalCostAmountMinor, "1");
    assert.equal((await data(await list(req()))).pagination.total, 1); assert.equal((await good("list_landed_costs")).total, 1);
    // Common FIFO engine and master adjustment consume residuals on final exhaustion.
    const first = await adjustInventory(ctx, fifo.id, { adjustment: -1, reason: "First FIFO issue" }); assert.equal(first.movement?.valueMinor, "-29");
    const final = await adjustInventory(ctx, fifo.id, { adjustment: -2, reason: "Exhaust FIFO" }); assert.equal(final.movement?.valueMinor, "-59");
    assert.equal((await saved(fifo.id)).totalValue, 0);
    const exhausted = (await good("list_inventory_cost_layers", { inventoryItemId: fifo.id })).data[0];
    assert.equal(exhausted.remainingValueMinor, "0"); assert.equal(exhausted.consumptions.reduce((s: number, c: { value: number }) => s + c.value, 0), 88);
    // Legacy major input rounds exactly; by-quantity preserves component totals too.
    const legacy = (await good("create_landed_cost", { ...batch(po.id), components: [{ description: "Shipping", amount: 1.005, amountMinor: "101" }], allocationMethod: "by_quantity" })).allocation;
    assert.equal(legacy.totalCostAmount, 101); await good("update_landed_cost", { landedCostId: legacy.id, name: "Renamed" });
    await data(await update(req({ allocationMethod: "by_value" }), cp(legacy.id))); await good("delete_landed_cost", { landedCostId: legacy.id }); await denied(() => get(req(), cp(legacy.id)), 404);
    const draft = (await data(await create(req(batch(po.id))), 201)).allocation; await data(await remove(req(), cp(draft.id)));
    const averagePo = await newPo(a.id, [average.id]);
    const legacyAllocate = (await data(await create(req({ name: "Legacy", purchaseOrderId: averagePo.po.id, components: [{ description: "Freight", amount: 0.03 }] })), 201)).allocation;
    await good("allocate_landed_cost", { landedCostId: legacyAllocate.id }); assert.equal((await saved(average.id)).totalValue, 90);
    const free = await createLandedCost(ctx, batch(averagePo.po.id, "0"));
    const freeResult = await allocateLandedCost(ctx, free.id); assert.equal(freeResult.journalEntryId, null); assert.equal((await saved(average.id)).totalValue, 90);
    const unsupportedMethod = await createLandedCost(ctx, batch(averagePo.po.id));
    await db.update(landedCostAllocation).set({ allocationMethod: "by_weight" }).where(eq(landedCostAllocation.id, unsupportedMethod.id));
    await data(await get(req(), cp(unsupportedMethod.id))); await denied(() => allocate(req(), cp(unsupportedMethod.id)), 422);
    await updateLandedCost(ctx, unsupportedMethod.id, { allocationMethod: "by_value" }); await deleteLandedCost(ctx, unsupportedMethod.id);
    const unsupportedStock = await createLandedCost(ctx, batch(averagePo.po.id));
    await db.update(inventoryItem).set({ costMethod: "standard" }).where(eq(inventoryItem.id, average.id));
    await mdenied("allocate_landed_cost", { landedCostId: unsupportedStock.id }, ma, 422);
    await db.update(inventoryItem).set({ costMethod: "average" }).where(eq(inventoryItem.id, average.id));
    await db.update(purchaseOrderLine).set({ inventoryItemId: null }).where(eq(purchaseOrderLine.id, averagePo.lines[0].id));
    await denied(() => allocate(req(), cp(unsupportedStock.id)), 422);
    await db.update(purchaseOrderLine).set({ inventoryItemId: average.id }).where(eq(purchaseOrderLine.id, averagePo.lines[0].id));
    // Stock writer integration: next receipt blends authoritative value, not rounded prior average.
    const avgBefore = await saved(average.id);
    await db.transaction(tx => recordInventoryReceipt(tx, { item: avgBefore, quantity: 1, unitCost: 29 }));
    assert.equal((await saved(average.id)).totalValue, 119);
    // Actual auth/tenant failures with complete table snapshots.
    const foreignPo = await newPo(b.id, [other.id]);
    const [foreignAccount] = await db.insert(chartAccount).values({ organizationId: b.id, name: "Foreign", code: "1300", type: "asset" }).returning();
    const [foreignBill] = await db.insert(bill).values({ organizationId: b.id, contactId: foreignSupplier.id, billNumber: "FOREIGN", issueDate: today, dueDate: today }).returning();
    for (const key of ["dk_invalid", keys.expired]) { await denied(() => list(req({}, key)), 401); await denied(() => create(req(batch(po.id), key)), 401); }
    for (const fn of [() => create(req(batch(po.id), keys.viewer)), () => update(req({ name: "Denied" }, keys.viewer), cp(created.id)), () => remove(req({}, keys.viewer), cp(created.id)), () => allocate(req({}, keys.viewer), cp(created.id))]) await denied(fn, 403);
    for (const [name, input] of [["create_landed_cost", batch(po.id)], ["update_landed_cost", { landedCostId: created.id, name: "Denied" }], ["delete_landed_cost", { landedCostId: created.id }], ["allocate_landed_cost", { landedCostId: created.id }]] as const) await mdenied(name, input, ro, 403);
    await denied(() => get(req({}, keys.b), cp(created.id)), 404); await mdenied("get_landed_cost", { landedCostId: created.id }, mb, 404);
    await denied(() => layers(req(), cp(other.id)), 404); await mdenied("list_inventory_cost_layers", { inventoryItemId: other.id }, ma, 404);
    await denied(() => create(req(batch(foreignPo.po.id))), 404); await mdenied("create_landed_cost", batch(po.id, "1", { billId: foreignBill.id }), ma, 404);
    await denied(() => create(req({ ...batch(po.id), components: [{ description: "Foreign", amountMinor: "1", accountId: foreignAccount.id }] })), 404);
    assert.equal((await good("get_inventory_valuation", {}, mb)).items.length, 1); await data(await report(req({}, keys.viewer)));
    // Malformed/unsafe/unknown inputs and totals never mutate.
    for (const input of [batch(po.id, "01"), batch(po.id, "-1"), batch(po.id, "1", { allocationMethod: "manual" }), batch(po.id, "1", { unknown: 1 }), { ...batch(po.id), components: [{ description: "Mismatch", amount: 0.01, amountMinor: "2" }] }]) await denied(() => create(req(input)), 400);
    await denied(() => create(req(batch(po.id, "9007199254740992"))), 422); await mdenied("create_landed_cost", batch(po.id, "9007199254740992"), ma, 422);
    await denied(() => create(req({ ...batch(po.id), components: [{ description: "Max", amountMinor: "9007199254740991" }, { description: "Overflow", amountMinor: "1" }] })), 422);
    await denied(() => report(req({}, keys.a, "?method=garbage")), 400);
    await denied(() => list(req({}, keys.a, "?page=1e2")), 400);
    // Repeated posting and edits of allocated history reject, with no partial effects.
    await denied(() => allocate(req(), cp(created.id)), 409); await mdenied("allocate_landed_cost", { landedCostId: created.id }, ma, 409);
    await denied(() => update(req({ name: "History" }), cp(created.id)), 409); await denied(() => remove(req(), cp(created.id)), 409);
    const pending = await createLandedCost(ctx, batch(averagePo.po.id));
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today }).returning();
    await denied(() => allocate(req(), cp(pending.id)), 422); await mdenied("allocate_landed_cost", { landedCostId: pending.id }, ma, 422); await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    // Concurrency: one winner and exactly one capitalization.
    const beforeRace = (await saved(average.id)).totalValue;
    const race = await Promise.allSettled([allocateLandedCost(ctx, pending.id), allocateLandedCost(ctx, pending.id)]);
    assert.equal(race.filter(r => r.status === "fulfilled").length, 1); assert.equal((await saved(average.id)).totalValue, beforeRace + 1);
    // Unsupported and corrupted histories stay unchanged.
    const unsupported = await createLandedCost(ctx, batch(po.id)); await denied(() => allocate(req(), cp(unsupported.id)), 422); // exhausted FIFO
    const zeroBasis = await createLandedCost(ctx, batch(averagePo.po.id)); await db.update(purchaseOrderLine).set({ amount: 0 }).where(eq(purchaseOrderLine.purchaseOrderId, averagePo.po.id));
    await denied(() => allocate(req(), cp(zeroBasis.id)), 422); await db.update(purchaseOrderLine).set({ amount: 87 }).where(eq(purchaseOrderLine.purchaseOrderId, averagePo.po.id));
    const foreignCurrency = await createLandedCost(ctx, batch(averagePo.po.id, "1", { currencyCode: "KWD" })); await mdenied("allocate_landed_cost", { landedCostId: foreignCurrency.id }, ma, 422);
    const corrupt = await createLandedCost(ctx, batch(averagePo.po.id)); await db.update(landedCostAllocation).set({ purchaseOrderId: foreignPo.po.id }).where(eq(landedCostAllocation.id, corrupt.id));
    await denied(() => get(req(), cp(corrupt.id)), 404); await mdenied("allocate_landed_cost", { landedCostId: corrupt.id }, ma, 404);
    await db.update(landedCostAllocation).set({ purchaseOrderId: averagePo.po.id }).where(eq(landedCostAllocation.id, corrupt.id));
    await db.update(landedCostComponent).set({ amount: 2 }).where(eq(landedCostComponent.allocationId, corrupt.id)); await denied(() => allocate(req(), cp(corrupt.id)), 422);
    // Rollback even after the service reaches the final audit write.
    const rollback = await createLandedCost(ctx, batch(averagePo.po.id));
    await db.execute(sql.raw("CREATE FUNCTION fail_valuation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='landed_cost' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw("CREATE TRIGGER fail_valuation_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_valuation_audit()"));
    for (const fn of [() => createLandedCost(ctx, batch(averagePo.po.id)), () => updateLandedCost(ctx, rollback.id, { name: "Rollback" }), () => deleteLandedCost(ctx, rollback.id), () => allocateLandedCost(ctx, rollback.id)]) {
      const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql.raw("DROP TRIGGER fail_valuation_audit ON audit_log")); await db.execute(sql.raw("DROP FUNCTION fail_valuation_audit()"));
    // Unsafe saved int64 fails both transports, without bigint crashes or rounding.
    await db.execute(sql`update landed_cost_allocation set total_cost_amount=9007199254740992 where id=${rollback.id}`);
    await denied(() => get(req(), cp(rollback.id)), 422); await mdenied("get_landed_cost", { landedCostId: rollback.id }, ma, 422);
    await db.execute(sql`update landed_cost_allocation set total_cost_amount=1 where id=${rollback.id}`);
    // Foreign item/account links and malformed FIFO history cannot capitalize anything.
    await db.update(purchaseOrderLine).set({ inventoryItemId: other.id }).where(eq(purchaseOrderLine.id, averagePo.lines[0].id));
    await denied(() => allocate(req(), cp(rollback.id)), 404);
    await db.update(purchaseOrderLine).set({ inventoryItemId: average.id }).where(eq(purchaseOrderLine.id, averagePo.lines[0].id));
    await db.update(inventoryItem).set({ inventoryAccountId: foreignAccount.id }).where(eq(inventoryItem.id, average.id));
    await mdenied("allocate_landed_cost", { landedCostId: rollback.id }, ma, 422);
    await db.update(inventoryItem).set({ inventoryAccountId: null }).where(eq(inventoryItem.id, average.id));
    const [layered] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "LAYERS", name: "Layers", costMethod: "fifo", quantityOnHand: 4, totalValue: 40, averageCost: 10 }).returning();
    await db.insert(inventoryCostLayer).values([
      { organizationId: a.id, inventoryItemId: layered.id, originalQuantity: 1, remainingQuantity: 1, unitCost: 10, receivedAt: new Date("2026-01-01") },
      { organizationId: a.id, inventoryItemId: layered.id, originalQuantity: 3, remainingQuantity: 3, unitCost: 10, receivedAt: new Date("2026-01-02") },
    ]);
    const layeredPo = await newPo(a.id, [layered.id]), layeredBatch = await createLandedCost(ctx, batch(layeredPo.po.id, "3"));
    await db.update(inventoryItem).set({ totalValue: 39 }).where(eq(inventoryItem.id, layered.id));
    await denied(() => allocate(req(), cp(layeredBatch.id)), 422);
    await db.update(inventoryItem).set({ totalValue: 40 }).where(eq(inventoryItem.id, layered.id));
    await allocateLandedCost(ctx, layeredBatch.id);
    const layerData = (await good("list_inventory_cost_layers", { inventoryItemId: layered.id })).data;
    assert.deepEqual(layerData.map((l: { remainingValue: number }) => l.remainingValue), [11, 32]);
    const layeredIssue = await adjustInventory(ctx, layered.id, { adjustment: -4, reason: "Layer exhaustion" }); assert.equal(layeredIssue.movement?.valueMinor, "-43");
    // By-quantity differs from by-value, with duplicate item lines rolled up once.
    const quantityPo = await newPo(a.id, [average.id, average.id]);
    await db.update(purchaseOrderLine).set({ quantity: 100 }).where(eq(purchaseOrderLine.id, quantityPo.lines[0].id));
    const quantityBatch = await createLandedCost(ctx, batch(quantityPo.po.id, "3", { allocationMethod: "by_quantity" }));
    const priorQuantityCost = (await saved(average.id)).totalValue, quantityResult = await allocateLandedCost(ctx, quantityBatch.id);
    assert.deepEqual(quantityResult.lineAllocations.map(l => l.allocatedAmount), [1, 2]); assert.equal((await saved(average.id)).totalValue, priorQuantityCost + 3);
    // All aggregate aliases remain exact beyond int32; unsafe aggregate rejects.
    const [large] = await db.insert(inventoryItem).values({ organizationId: a.id, name: "Large", code: "LARGE", quantityOnHand: 1, totalValue: 4294967296, purchasePrice: 4294967296, salePrice: 4294967296 }).returning();
    const largeReport = await data(await report(req())); assert.ok(BigInt(largeReport.summary.carryingValueMinor) > 4294967296n);
    await db.update(inventoryItem).set({ totalValue: Number.MAX_SAFE_INTEGER }).where(eq(inventoryItem.id, large.id));
    await denied(() => report(req()), 422); await mdenied("get_inventory_valuation", {}, ma, 422);
    await db.update(inventoryItem).set({ totalValue: 4294967296 }).where(eq(inventoryItem.id, large.id));
    const balanced = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.organization_id=${a.id} group by e.id having sum(l.debit_amount) <> sum(l.credit_amount)`); assert.equal(balanced.rows.length, 0);
    const totals = await db.execute(sql`select a.id from landed_cost_allocation a join landed_cost_line_allocation l on l.allocation_id=a.id where a.status='allocated' group by a.id,a.total_cost_amount having sum(l.allocated_amount) <> a.total_cost_amount`); assert.equal(totals.rows.length, 0);
    // Shared direct issue retains final residual; bill receipt reversal rejects capitalized layers.
    const [f2] = await db.insert(inventoryItem).values({ organizationId: a.id, name: "Direct FIFO", code: "DIRECT", costMethod: "fifo" }).returning();
    const receipt = await db.transaction(tx => billStockMovement(tx, ctx, { itemId: f2.id, billId: po.id, warehouseId: null, quantity: 3, value: 87, journalEntryId: null, referenceType: "goods_receipt" }));
    const f2po = await newPo(a.id, [f2.id]); const f2batch = await createLandedCost(ctx, batch(f2po.po.id)); await allocateLandedCost(ctx, f2batch.id);
    const beforeReversal = await snapshot(); await assert.rejects(() => db.transaction(tx => billStockMovement(tx, ctx, { itemId: f2.id, billId: po.id, warehouseId: null, quantity: -3, value: -87, journalEntryId: receipt.journalEntryId, reverseMovementId: receipt.id }))); assert.deepEqual(await snapshot(), beforeReversal);
    const issued = await db.transaction(tx => recordInventoryIssue(tx, { item: { ...f2, quantityOnHand: 3, totalValue: 88, averageCost: 29 }, quantity: 3 })); assert.equal(issued.cost, 88);
    const consumed = await db.query.inventoryLayerConsumption.findFirst({ where: eq(inventoryLayerConsumption.issueMovementId, issued.movementId) }); assert.equal(consumed?.value, 88);
    console.log("Inventory valuation contracts verified: REST/MCP, exact/legacy inputs, FIFO residuals, procurement, 2 tenants, locks, races and 4 audit rollbacks");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), full.close()]); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  const pool = (db as unknown as { $client?: { end(): Promise<void> } }).$client; void pool?.end();
});
