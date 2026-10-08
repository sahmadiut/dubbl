// Runs only against the parent harness's migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, inventoryItem, inventoryCostLayer, purchaseOrder, purchaseOrderLine, periodLock, chartAccount } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as itemCreate } from "../../app/api/v1/inventory/route";
import { GET as itemGet, PATCH as itemUpdate } from "../../app/api/v1/inventory/[id]/route";
import { POST as variantCreate } from "../../app/api/v1/inventory/[id]/variants/route";
import { POST as supplierCreate } from "../../app/api/v1/inventory/[id]/suppliers/route";
import { POST as receiptCreate } from "../../app/api/v1/goods-receipts/route";
import { POST as landedCreate } from "../../app/api/v1/landed-costs/route";
import { POST as landedAllocate } from "../../app/api/v1/landed-costs/[id]/allocate/route";
import { GET as valuation } from "../../app/api/v1/reports/inventory-valuation/route";
import { GET as layers } from "../../app/api/v1/inventory/[id]/cost-layers/route";
import { POST as takeApply } from "../../app/api/v1/stock-takes/[id]/apply/route";
import { POST as assemblyBuild } from "../../app/api/v1/inventory/assembly-orders/[id]/complete/route";
import { POST as itemAdjust } from "../../app/api/v1/inventory/[id]/adjust/route";
import { POST as invoiceSend } from "../../app/api/v1/invoices/[id]/send/route";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined inventory fixture", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const catalog = (await client.listTools()).tools;
  assert.equal(new Set(catalog.map(t => t.name)).size, catalog.length);
  const required = ["create_inventory_item", "get_inventory_item", "update_inventory_item", "import_inventory_csv",
    "create_inventory_variant", "list_inventory_variants", "create_inventory_supplier", "list_inventory_suppliers",
    "create_warehouse", "get_warehouse_stock", "transfer_inventory_stock", "create_stock_take", "get_stock_take",
    "update_stock_take", "count_stock_take_line", "apply_stock_take", "adjust_inventory_stock", "adjust_inventory_items_stock",
    "bulk_adjust_inventory_stock", "list_inventory_movements", "get_inventory_valuation", "list_inventory_cost_layers",
    "create_landed_cost", "allocate_landed_cost", "get_landed_cost", "create_bom", "add_bom_component",
    "create_assembly_order", "build_assembly", "receive_goods_receipt"];
  for (const name of required) {
    const tool = catalog.find(t => t.name === name); assert.ok(tool, name); assert.ok(tool.description, name);
    assert.equal(tool.inputSchema.additionalProperties, false, name);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Inventory combined", slug: "inventory-combined", defaultCurrency: "KWD" },
    { name: "Inventory foreign", slug: "inventory-foreign", defaultCurrency: "USD" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "inventory-owner@example.test" }, { email: "inventory-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No inventory writes", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_inventory_combined_a", b: "dk_inventory_combined_b", viewer: "dk_inventory_combined_viewer", expired: "dk_inventory_combined_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyPrefix: "dk_inventory", keyHash: createHash("sha256").update(key).digest("hex"),
    expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), denied = await mcp({ ...ctx, userId: viewer.id, permissions: [] });
  const request = (body?: unknown, key = keys.a, path = "inventory", method = "POST") => new Request(`http://fixture.test/api/v1/${path}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const json = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const good = async (name: string, args: Record<string, unknown> = {}, client = ma) => {
    const r = await client.call(name, args); assert.equal(r.error, false, JSON.stringify(r.body)); return r.body;
  };
  const tables = ["inventory_item", "inventory_variant", "inventory_item_supplier", "warehouse", "warehouse_stock", "inventory_transfer", "inventory_transfer_line",
    "stock_take", "stock_take_line", "inventory_movement", "inventory_cost_layer", "inventory_layer_consumption", "bill_of_materials", "bom_component", "assembly_order",
    "goods_receipt", "goods_receipt_line", "purchase_order", "purchase_order_line", "landed_cost_allocation", "landed_cost_component", "landed_cost_line_allocation",
    "invoice", "invoice_line", "journal_entry", "journal_line", "chart_account", "audit_log"];
  const snapshot = async () => Promise.all(tables.map(t => db.execute(sql.raw(`select row_to_json(t)::text as row from ${t} t order by id`)).then(r => r.rows)));
  const financial = async () => (await snapshot()).filter((_, i) => ![0, 1, 2, tables.length - 1].includes(i));
  const rejected = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await json(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mRejected = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => {
    const before = await snapshot(), r = await client.call(name, args); assert.equal(r.error, true, name);
    if (status !== undefined) assert.equal(r.body.status, status, JSON.stringify(r.body)); assert.deepEqual(await snapshot(), before);
  };
  const saved = async (id: string) => (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, id) }))!;
  const today = new Date().toISOString().slice(0, 10);
  let sequence = 0;
  const item = async (method: "fifo" | "average", price = 29) => {
    const row = (await good("create_inventory_item", { code: `COM-${++sequence}`, name: "Combined stock", purchasePriceMinor: String(price), salePrice: 40 })).inventoryItem;
    // Cost-method configuration is not exposed by the adopted master contract.
    await db.update(inventoryItem).set({ costMethod: method }).where(eq(inventoryItem.id, row.id)); return row;
  };
  const [supplier] = await db.insert(contact).values({ organizationId: a.id, name: "Local supplier", type: "supplier", currencyCode: "KWD" }).returning();
  const po = async (itemId: string, quantity: number, price: number, warehouseId?: string) => {
    const value = quantity * price;
    const [order] = await db.insert(purchaseOrder).values({ organizationId: a.id, contactId: supplier.id, poNumber: `COM-PO-${++sequence}`,
      issueDate: today, currencyCode: "KWD", status: "sent", subtotal: value, total: value }).returning();
    const [line] = await db.insert(purchaseOrderLine).values({ purchaseOrderId: order.id, inventoryItemId: itemId, warehouseId: warehouseId ?? null,
      description: "Combined receipt", quantity: quantity * 100, unitPrice: price, amount: value }).returning();
    return { order, input: { purchaseOrderId: order.id, date: today, lines: [{ purchaseOrderLineId: line.id, quantityExact: String(quantity) }] } };
  };
  const recipe = async (componentId: string, finishedId: string, quantity: number, labor = 0) => {
    const bom = (await good("create_bom", { assemblyItemId: finishedId, name: "Combined kit", laborCostCentsMinor: String(labor) })).bom;
    await good("add_bom_component", { bomId: bom.id, componentItemId: componentId, quantityExact: "1" });
    return (await good("create_assembly_order", { bomId: bom.id, quantity })).order;
  };
  const balanced = async () => {
    const rows = await db.execute(sql`select e.id, sum(l.debit_amount::numeric)::text as debit, sum(l.credit_amount::numeric)::text as credit
      from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.organization_id=${a.id} group by e.id`);
    assert.ok(rows.rows.length); for (const row of rows.rows) assert.equal(row.debit, row.credit);
    const currencies = await db.execute(sql`select distinct l.currency_code from journal_line l join journal_entry e on e.id=l.journal_entry_id where e.organization_id=${a.id}`);
    assert.deepEqual(currencies.rows, [{ currency_code: "KWD" }]);
    const totals = await db.execute(sql`select
      (select coalesce(sum(total_value::numeric),0)::text from inventory_item where organization_id=${a.id}) as stock,
      (select coalesce(sum(l.debit_amount::numeric-l.credit_amount::numeric),0)::text from journal_line l
        join journal_entry e on e.id=l.journal_entry_id join chart_account c on c.id=l.account_id
        where e.organization_id=${a.id} and c.code in ('1300','1320')) as ledger`);
    assert.equal(totals.rows[0].stock, totals.rows[0].ledger, "Inventory carrying value must reconcile to inventory GL");
  };
  try {
    const raw = (await json(await itemCreate(request({ code: "REST-LEGACY", name: "Legacy opening", purchasePrice: 1250, quantityOnHand: 1 })), 201)).inventoryItem;
    assert.equal(raw.totalValueMinor, "1250"); // KWD does not rescale the v1 input.
    const component = await item("fifo"), finished = await item("fifo", 0);
    const wh1 = (await good("create_warehouse", { name: "Receiving", code: "RCV" })).warehouse;
    const wh2 = (await good("create_warehouse", { name: "Counting", code: "CNT" })).warehouse;
    const beforeCatalog = await financial();
    const variant = (await json(await variantCreate(request({ name: "Large catalog", purchasePriceMinor: "3000000000", salePrice: 3000000001, quantityOnHand: 13 }), params(component.id)), 201)).inventoryVariant;
    assert.equal(variant.purchasePrice, 3000000000); assert.equal(variant.purchasePriceMinor, "3000000000");
    const link = (await json(await supplierCreate(request({ contactId: supplier.id, purchasePrice: 29, purchasePriceMinor: "29" }), params(component.id)), 201)).inventoryItemSupplier;
    assert.equal((await good("list_inventory_suppliers", { inventoryItemId: component.id })).data[0].id, link.id);
    assert.equal((await good("list_inventory_variants", { inventoryItemId: component.id })).data[0].quantityOnHand, 13);
    assert.deepEqual(await financial(), beforeCatalog); assert.equal((await saved(component.id)).quantityOnHand, 0);

    const source = await po(component.id, 3, 29, wh1.id);
    const received = await json(await receiptCreate(request(source.input)), 201);
    assert.ok(received.journalEntryId); assert.equal((await saved(component.id)).totalValue, 87);
    const landed = (await json(await landedCreate(request({ name: "Residual freight", purchaseOrderId: source.order.id, currencyCode: "KWD",
      components: [{ description: "Freight", amount: 0.01, amountMinor: "1" }] })), 201)).allocation;
    const allocated = await good("allocate_landed_cost", { landedCostId: landed.id });
    assert.equal(allocated.lineAllocations[0].allocatedAmountMinor, "1"); assert.equal((await saved(component.id)).totalValue, 88);
    const report = await json(await valuation(request(undefined, keys.a, "reports/inventory-valuation", "GET")));
    assert.deepEqual(report, await good("get_inventory_valuation"));
    const projection = report.items.find((i: { id: string }) => i.id === component.id);
    assert.equal(projection.totalCostMinor, "87"); assert.equal(projection.carryingValueMinor, "88"); assert.equal(projection.currencyCode, "KWD");
    const beforeTransfer = await db.query.journalEntry.findMany();
    await good("transfer_inventory_stock", { inventoryItemId: component.id, fromWarehouseId: wh1.id, toWarehouseId: wh2.id, quantity: 2 });
    assert.deepEqual(await db.query.journalEntry.findMany(), beforeTransfer);
    assert.equal((await saved(component.id)).totalValue, 88);
    const take = (await good("create_stock_take", { name: "Location count", warehouseId: wh2.id })).stockTake;
    await good("update_stock_take", { stockTakeId: take.id, status: "in_progress" });
    const takeLine = (await good("get_stock_take", { stockTakeId: take.id })).stockTake.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === component.id);
    assert.equal(takeLine.expectedQuantity, 2);
    await good("count_stock_take_line", { stockTakeId: take.id, lineId: takeLine.id, countedQuantity: 1 });
    const applied = await json(await takeApply(request(), params(take.id)));
    assert.equal(applied.stockTake.lines.find((l: { id: string }) => l.id === takeLine.id).valueAdjustmentMinor, "-29");
    assert.equal((await saved(component.id)).quantityOnHand, 2); assert.equal((await saved(component.id)).totalValue, 59);
    const locatedOrder = await recipe(component.id, finished.id, 2, 3);
    await rejected(() => assemblyBuild(request(), params(locatedOrder.id)), 422);
    await mRejected("build_assembly", { assemblyOrderId: locatedOrder.id }, ma, 422);
    // Assembly has no warehouse-allocation input. Qualify its supported unassigned
    // path separately while preserving the located receipt/count balances.
    const assemblyComponent = await item("fifo"), assemblySource = await po(assemblyComponent.id, 2, 29);
    await good("receive_goods_receipt", assemblySource.input);
    const assemblyFreight = (await good("create_landed_cost", { name: "Assembly freight", purchaseOrderId: assemblySource.order.id, currencyCode: "KWD",
      components: [{ description: "Freight", amountMinor: "1" }] })).allocation;
    await good("allocate_landed_cost", { landedCostId: assemblyFreight.id });
    const order = await recipe(assemblyComponent.id, finished.id, 2, 3);
    for (const tracked of [assemblyComponent, finished]) {
      for (const trackingMethod of ["serial", "lot", "batch"] as const) {
        await db.update(inventoryItem).set({ trackingMethod }).where(eq(inventoryItem.id, tracked.id));
        await rejected(() => assemblyBuild(request(), params(order.id)), 422);
        await mRejected("build_assembly", { assemblyOrderId: order.id }, ma, 422);
      }
      await db.update(inventoryItem).set({ trackingMethod: "none" }).where(eq(inventoryItem.id, tracked.id));
    }
    // Bad historical location metadata cannot evade the stock-row guard.
    await db.update(inventoryCostLayer).set({ warehouseId: wh1.id }).where(eq(inventoryCostLayer.inventoryItemId, assemblyComponent.id));
    await rejected(() => assemblyBuild(request(), params(order.id)), 422);
    await mRejected("build_assembly", { assemblyOrderId: order.id }, ma, 422);
    await db.update(inventoryCostLayer).set({ warehouseId: null }).where(eq(inventoryCostLayer.inventoryItemId, assemblyComponent.id));
    // Infrastructure failure after combined cost-flow/journal work rolls everything back.
    await db.execute(sql.raw("create function reject_combined_build() returns trigger language plpgsql as $$ begin if new.action='build_assembly' then raise exception 'MON024 injected audit failure'; end if; return new; end $$"));
    await db.execute(sql.raw("create trigger reject_combined_build before insert on audit_log for each row execute function reject_combined_build()"));
    const logged: unknown[] = [], originalError = console.error;
    console.error = (...args: unknown[]) => { logged.push(...args); };
    try { await rejected(() => assemblyBuild(request(), params(order.id)), 500); }
    finally { console.error = originalError; }
    assert.ok(logged.some(error => error instanceof Error && (error.cause as Error)?.message === "MON024 injected audit failure"));
    await db.execute(sql.raw("drop trigger reject_combined_build on audit_log"));
    await db.execute(sql.raw("drop function reject_combined_build()"));
    const built = await good("build_assembly", { assemblyOrderId: order.id });
    assert.equal(built.componentCostMinor, "59"); assert.equal(built.conversionCostMinor, "6"); assert.equal(built.totalCostMinor, "65"); assert.equal(built.unitCostMinor, "33");
    assert.equal((await saved(assemblyComponent.id)).totalValue, 0); assert.equal((await saved(finished.id)).totalValue, 65);
    assert.equal((await saved(component.id)).quantityOnHand, 2); assert.equal((await saved(component.id)).totalValue, 59);
    assert.deepEqual(await json(await layers(request(), params(finished.id))), await good("list_inventory_cost_layers", { inventoryItemId: finished.id }));
    const [customer] = await db.insert(contact).values({ organizationId: a.id, name: "Assembly buyer", type: "customer", currencyCode: "KWD" }).returning();
    const [, revenue] = await db.insert(chartAccount).values([
      { organizationId: a.id, code: "1200", name: "Receivables", type: "asset", currencyCode: "KWD" },
      { organizationId: a.id, code: "4000", name: "Sales", type: "revenue", currencyCode: "KWD" },
    ]).returning();
    for (const quantity of [1, 2]) {
      const sale = (await good("create_invoice", { contactId: customer.id, issueDate: today, currencyCode: "KWD",
        lines: [{ description: "Finished kit", inventoryItemId: finished.id, accountId: revenue.id, quantity, unitPriceMinor: "50" }] })).invoice;
      if (quantity === 1) await json(await invoiceSend(request(), params(sale.id)));
      else await good("send_invoice", { invoiceId: sale.id });
      const remaining = quantity === 1 ? 32 : 0;
      assert.equal((await saved(finished.id)).totalValue, remaining);
      assert.equal((await good("list_inventory_cost_layers", { inventoryItemId: finished.id })).data[0].remainingValueMinor, String(remaining));
      await good("void_invoice", { invoiceId: sale.id });
      assert.equal((await saved(finished.id)).totalValue, 65);
      assert.equal((await saved(finished.id)).averageCost, 33);
      assert.equal((await good("list_inventory_cost_layers", { inventoryItemId: finished.id })).data[0].remainingValueMinor, "65");
    }
    const firstIssue = await good("adjust_inventory_stock", { inventoryItemId: finished.id, kind: "quantity", quantityDelta: -1, reason: "First issue" });
    assert.equal(firstIssue.movement.valueMinor, "-33");
    await good("adjust_inventory_items_stock", { ids: [finished.id], adjustment: -1, reason: "Exhaust residual" });
    assert.equal((await saved(finished.id)).totalValue, 0);
    const finishedLayers = (await good("list_inventory_cost_layers", { inventoryItemId: finished.id })).data;
    assert.equal(finishedLayers[0].remainingValueMinor, "0");
    assert.deepEqual(finishedLayers[0].consumptions.map((c: { valueMinor: string }) => c.valueMinor).sort(), ["32", "33", "33", "65"]);
    const tinyComponent = await item("average", 1), tinySource = await po(tinyComponent.id, 1, 1), averageFinished = await item("average", 0);
    await good("receive_goods_receipt", tinySource.input);
    const tinyBom = (await good("create_bom", { assemblyItemId: averageFinished.id, name: "Average residual" })).bom;
    await good("add_bom_component", { bomId: tinyBom.id, componentItemId: tinyComponent.id, quantityExact: "0.1" });
    const tinyOrder = (await good("create_assembly_order", { bomId: tinyBom.id, quantity: 2 })).order;
    assert.equal((await good("build_assembly", { assemblyOrderId: tinyOrder.id })).totalCostMinor, "1");
    const tinySale = (await good("create_invoice", { contactId: customer.id, issueDate: today, currencyCode: "KWD",
      lines: [{ description: "Average residual kit", inventoryItemId: averageFinished.id, accountId: revenue.id, quantity: 2, unitPriceMinor: "50" }] })).invoice;
    await good("send_invoice", { invoiceId: tinySale.id });
    assert.equal((await saved(averageFinished.id)).totalValue, 0);
    const tinyIssues = await good("list_inventory_movements", { inventoryItemId: averageFinished.id, type: "sale" });
    assert.equal(tinyIssues.movements[0].valueMinor, "-1");
    await good("void_invoice", { invoiceId: tinySale.id });
    assert.equal((await saved(averageFinished.id)).totalValue, 1); assert.equal((await saved(averageFinished.id)).averageCost, 1);
    const openingBefore = await saved(raw.id), ledgerBefore = await financial();
    const imported = await good("import_inventory_csv", { csv: "code,name,purchasePriceMinor,quantityOnHand\nREST-LEGACY,Changed master,31,999" });
    assert.equal(imported.updated, 1); assert.equal((await saved(raw.id)).totalValue, openingBefore.totalValue);
    assert.equal((await saved(raw.id)).quantityOnHand, 1); assert.deepEqual(await financial(), ledgerBefore);

    // Different writer families serialize one receipt and one adjustment without a lost update.
    const raced = await item("average", 10), initialPo = await po(raced.id, 1, 10);
    await good("receive_goods_receipt", initialPo.input);
    const racePo = await po(raced.id, 6, 10);
    const races = await Promise.all([receiptCreate(request(racePo.input)), ma.call("bulk_adjust_inventory_stock", { adjustments: [{ itemId: raced.id, quantity: 1 }] })]);
    await json(races[0], 201); assert.equal(races[1].error, false, JSON.stringify(races[1].body));
    assert.equal((await saved(raced.id)).quantityOnHand, 8); assert.equal((await saved(raced.id)).totalValue, 80);

    // Capitalization and assembly may choose either serial order; both conserve all 96 units of value.
    const raceComponent = await item("fifo"), raceFinished = await item("fifo", 0), raceSource = await po(raceComponent.id, 3, 29);
    await good("receive_goods_receipt", raceSource.input);
    const raceLanded = (await good("create_landed_cost", { name: "Concurrent freight", purchaseOrderId: raceSource.order.id, currencyCode: "KWD", components: [{ description: "Freight", amountMinor: "9" }] })).allocation;
    const raceOrder = await recipe(raceComponent.id, raceFinished.id, 1);
    const outcomes = await Promise.all([landedAllocate(request(), params(raceLanded.id)), ma.call("build_assembly", { assemblyOrderId: raceOrder.id })]);
    await json(outcomes[0]); assert.equal(outcomes[1].error, false, JSON.stringify(outcomes[1].body));
    assert.equal((await saved(raceComponent.id)).quantityOnHand, 2);
    assert.equal((await saved(raceComponent.id)).totalValue + (await saved(raceFinished.id)).totalValue, 96);
    assert.ok([29, 32].includes((await saved(raceFinished.id)).totalValue));
    await balanced();

    const foreign = (await good("create_inventory_item", { code: "FOREIGN", name: "Foreign" }, mb)).inventoryItem;
    await rejected(() => itemGet(request(), params(foreign.id)), 404);
    await mRejected("get_inventory_item", { inventoryItemId: component.id }, mb, 404);
    await mRejected("create_inventory_variant", { inventoryItemId: foreign.id, name: "Foreign parent" }, ma, 404);
    await mRejected("get_inventory_valuation", {}, denied, 403);
    await rejected(() => valuation(request(undefined, keys.viewer, "reports/inventory-valuation", "GET")), 403);
    for (const key of [keys.expired, "dk_invalid"]) await rejected(() => itemCreate(request({ code: "DENIED", name: "Denied" }, key)), 401);
    await rejected(() => itemUpdate(request({ name: "Denied" }, keys.viewer), params(component.id)), 403);
    await mRejected("bulk_adjust_inventory_stock", { adjustments: [{ itemId: raced.id, quantity: 1 }] }, denied, 403);
    await rejected(() => itemUpdate(request({ purchasePrice: 1, purchasePriceMinor: "2" }), params(raced.id)), 400);
    await mRejected("update_inventory_item", { inventoryItemId: raced.id, purchasePriceMinor: "9007199254740992" }, ma, 422);
    await mRejected("create_inventory_item", { code: "OVERRIDE", name: "Override", organizationId: b.id });
    await mRejected("build_assembly", { assemblyOrderId: raceOrder.id, organizationId: b.id });
    await rejected(() => itemAdjust(request({ adjustment: -0.5, reason: "Fraction" }), params(raced.id)), 400);
    await mRejected("allocate_landed_cost", { landedCostId: landed.id }, ma, 409);
    await mRejected("build_assembly", { assemblyOrderId: order.id }, ma, 409);
    await rejected(() => takeApply(request(), params(take.id)), 400);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2999-12-31", lockedBy: owner.id });
    await mRejected("adjust_inventory_stock", { inventoryItemId: raced.id, kind: "quantity", quantityDelta: 1, reason: "Locked" }, ma, 422);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.execute(sql`update inventory_item set total_value=9007199254740992 where id=${raced.id}`);
    await rejected(() => itemGet(request(), params(raced.id)), 422);
    await mRejected("get_inventory_valuation", {}, ma, 422);
    await mRejected("adjust_inventory_stock", { inventoryItemId: raced.id, kind: "quantity", quantityDelta: 1, reason: "Unsafe history" }, ma, 422);
    await db.update(inventoryItem).set({ totalValue: 80 }).where(eq(inventoryItem.id, raced.id));
    await balanced();
    console.log("Combined inventory contracts verified");
  } finally { await ma.close(); await mb.close(); await denied.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
