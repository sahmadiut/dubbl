// Only executed by goods-receipts.test.ts in a migrated disposable database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mock } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, inventoryItem, warehouse, warehouseStock,
  inventoryMovement, inventoryCostLayer, purchaseOrder, purchaseOrderLine, goodsReceiptLine, bill, billLine,
  journalEntry, journalLine, auditLog, exchangeRate, periodLock } from "../../lib/db/schema";
import { GET as list, POST as receive } from "../../app/api/v1/goods-receipts/route";
import { GET as detail } from "../../app/api/v1/goods-receipts/[id]/route";
import { POST as createBill } from "../../app/api/v1/goods-receipts/[id]/create-bill/route";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Receipt fixture", version: "1.0.0" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["receive_goods_receipt", "list_purchase_goods_receipts", "get_goods_receipt", "create_bill_from_goods_receipt"])
    assert.equal(tools.filter(tool => tool.name === name).length, 1, name);
  assert.match(JSON.stringify(tools.find(tool => tool.name === "receive_goods_receipt")!.inputSchema), /quantityExact/);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-04T12:00:00Z") });
  const [a, b] = await db.insert(organization).values([{ name: "GRN A", slug: "grn-a" }, { name: "GRN B", slug: "grn-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "grn-owner@example.test" }, { email: "grn-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_grn_a", b: "dk_grn_b", viewer: "dk_grn_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_grn" });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "supplier" },
    { organizationId: b.id, name: "B", type: "supplier" }]).returning();
  const [expense, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Expense", code: "5000", type: "expense" },
    { organizationId: b.id, name: "Inventory", code: "1300", type: "asset" }]).returning();
  await db.insert(chartAccount).values({ organizationId: a.id, name: "Payable", code: "2100", type: "liability" });
  const [item, foreignItem, fifo, badAccountItem] = await db.insert(inventoryItem).values([
    { organizationId: a.id, name: "Item", code: "A" }, { organizationId: b.id, name: "Item", code: "B" },
    { organizationId: a.id, name: "FIFO", code: "F", costMethod: "fifo" },
    { organizationId: a.id, name: "Bad account", code: "BA", inventoryAccountId: foreignAccount.id },
  ]).returning();
  const [store, foreignStore] = await db.insert(warehouse).values([{ organizationId: a.id, name: "A", code: "A" },
    { organizationId: b.id, name: "B", code: "B" }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/goods-receipts${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const post = (body: unknown, key = keys.a) => receive(request("POST", body, key));
  const converted = (id: string, key = keys.a) => createBill(request("POST", undefined, key), params(id));
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from goods_receipt i) as receipts,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from goods_receipt_line i) as receipt_lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_order i) as orders,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_order_line i) as order_lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from inventory_item i) as items,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from warehouse_stock i) as warehouse_stock,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from inventory_cost_layer i) as layers,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from number_sequence i) as numbering,
    (select count(*)::text from bill) as bills, (select count(*)::text from bill_line) as bill_lines,
    (select count(*)::text from bill_purchase_order) as links, (select count(*)::text from chart_account) as accounts,
    (select count(*)::text from journal_entry) as journals, (select count(*)::text from journal_line) as legs,
    (select count(*)::text from inventory_movement) as movements, (select count(*)::text from audit_log) as audits`)).rows;
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  let poCount = 0;
  async function po(options: { cost?: number; quantity?: number; stock?: string | null; warehouseId?: string | null; currency?: string;
    supplier?: string; status?: "draft" | "sent" | "closed" | "void"; org?: string } = {}) {
    const quantity = options.quantity ?? 200, cost = options.cost ?? 1250;
    const amount = Number((BigInt(cost) * BigInt(quantity) + 50n) / 100n);
    const [header] = await db.insert(purchaseOrder).values({ organizationId: options.org ?? a.id, contactId: options.supplier ?? supplier.id,
      poNumber: `PO-${++poCount}`, issueDate: "2026-10-04", status: options.status ?? "sent", currencyCode: options.currency ?? "USD",
      subtotal: amount, taxTotal: 0, total: amount }).returning();
    const [line] = await db.insert(purchaseOrderLine).values({ purchaseOrderId: header.id, description: "Received", quantity, unitPrice: cost,
      amount, accountId: expense.id, inventoryItemId: options.stock === undefined ? item.id : options.stock,
      warehouseId: options.warehouseId === undefined ? store.id : options.warehouseId }).returning();
    return { header, line, input: { purchaseOrderId: header.id, date: "2026-10-04", lines: [{ purchaseOrderLineId: line.id, quantity: 1 }] } };
  }
  async function received(input: unknown) {
    const response = await post(input); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    return response.json();
  }
  const tally = async (id: string) => (await db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.id, id)))[0];
  try {
    const p = await po();
    const first = await received(p.input);
    assert.equal(first.goodsReceipt.lines[0].unitCostMinor, "1250"); assert.equal(first.goodsReceipt.lines[0].quantityReceivedExact, "1.00");
    assert.equal(first.purchaseOrderStatus, "partial"); assert.ok(first.journalEntryId);
    const second = await ma.call("receive_goods_receipt", { ...p.input, lines: [{ purchaseOrderLineId: p.line.id, quantityExact: "1.00" }] });
    assert.equal(second.isError, false, JSON.stringify(second.body)); assert.equal(second.body.purchaseOrderStatus, "received");
    assert.equal((await tally(p.line.id)).quantityReceived, 200);
    const [stock] = await db.select().from(inventoryItem).where(eq(inventoryItem.id, item.id));
    assert.equal(stock.quantityOnHand, 2); assert.equal(stock.totalValue, 2500); assert.equal(stock.averageCost, 1250);
    const [ws] = await db.select().from(warehouseStock).where(eq(warehouseStock.inventoryItemId, item.id)); assert.equal(ws.quantity, 2);
    const movement = await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, first.goodsReceipt.id));
    assert.equal(movement[0].value, 1250); assert.equal(movement[0].journalEntryId, first.journalEntryId); assert.equal(movement[0].referenceType, "goods_receipt");
    const entry = (await db.select().from(journalEntry).where(eq(journalEntry.id, first.journalEntryId)))[0]; assert.equal(entry.sourceId, first.goodsReceipt.id);
    const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
    assert.equal(legs.reduce((sum, leg) => sum + leg.debitAmount, 0), 1250); assert.equal(legs.reduce((sum, leg) => sum + leg.creditAmount, 0), 1250);
    assert.equal(legs[0].rateMigrationStatus, "exact");
    const get = await (await detail(request("GET"), params(first.goodsReceipt.id))).json();
    assert.equal(get.goodsReceipt.lines[0].inventoryItem.totalValueMinor, "2500"); assert.equal(get.goodsReceipt.purchaseOrder.totalMinor, "2500");
    assert.equal((await ma.call("get_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).body.goodsReceipt.lines[0].unitCostMinor, "1250");
    assert.equal((await (await list(request("GET", undefined, keys.a, `?purchaseOrderId=${p.header.id}`))).json()).data.length, 2);
    assert.equal((await ma.call("list_purchase_goods_receipts", { purchaseOrderId: p.header.id })).body.total, 2);
    await unchanged(async () => {
      assert.equal((await post(p.input)).status, 400);
      assert.equal((await ma.call("receive_goods_receipt", p.input)).isError, true);
      assert.equal((await detail(request("GET", undefined, keys.b), params(first.goodsReceipt.id))).status, 404);
      assert.equal((await mb.call("get_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).body.status, 404);
      assert.equal((await converted(first.goodsReceipt.id, keys.b)).status, 404);
      assert.equal((await mb.call("create_bill_from_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).body.status, 404);
      assert.equal((await post(p.input, keys.viewer)).status, 403);
      assert.equal((await ro.call("receive_goods_receipt", p.input)).body.status, 403);
      assert.equal((await converted(first.goodsReceipt.id, keys.viewer)).status, 403);
      assert.equal((await ro.call("create_bill_from_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).body.status, 403);
    });
    assert.equal((await (await list(request("GET", undefined, keys.b))).json()).data.length, 0);
    assert.equal((await mb.call("list_purchase_goods_receipts", {})).body.total, 0);
    const billResult = await converted(first.goodsReceipt.id); assert.equal(billResult.status, 201);
    const draft = (await billResult.json()).bill; assert.equal(draft.totalMinor, "1250"); assert.equal(draft.currencyCode, "USD");
    const bl = (await db.select().from(billLine).where(eq(billLine.billId, draft.id)))[0]; assert.equal(bl.goodsReceiptLineId, first.goodsReceipt.lines[0].id);
    await unchanged(async () => { assert.equal((await converted(first.goodsReceipt.id)).status, 400);
      assert.equal((await ma.call("create_bill_from_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).body.status, 400); });
    assert.equal((await ma.call("receive_bill", { billId: draft.id })).isError, false);
    assert.equal((await tally(p.line.id)).quantityBilled, 100);
    assert.equal((await ma.call("get_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).body.goodsReceipt.status, "billed");
    assert.equal((await ma.call("void_bill", { billId: draft.id })).isError, false);
    assert.equal((await tally(p.line.id)).quantityBilled, 0);
    assert.equal((await ma.call("create_bill_from_goods_receipt", { goodsReceiptId: first.goodsReceipt.id })).isError, false);
    const secondDraft = await ma.call("create_bill_from_goods_receipt", { goodsReceiptId: second.body.goodsReceipt.id }); assert.equal(secondDraft.isError, false);
    assert.equal((await ma.call("receive_bill", { billId: secondDraft.body.bill.id })).isError, false);
    // Exact physical fractions for nonstock, plus a real recognition/void round trip.
    const service = await po({ stock: null, quantity: 101 });
    const nonstock = await received({ ...service.input, lines: [{ purchaseOrderLineId: service.line.id, quantity: 1.005, quantityExact: "1.005" }] });
    assert.equal(nonstock.goodsReceipt.lines[0].quantityReceived, 101); assert.equal(nonstock.journalEntryId, null);
    const serviceBill = await converted(nonstock.goodsReceipt.id); assert.equal(serviceBill.status, 201);
    const serviceDraft = (await serviceBill.json()).bill; assert.equal(serviceDraft.totalMinor, "1263");
    const serviceRecognized = await ma.call("receive_bill", { billId: serviceDraft.id }); assert.equal(serviceRecognized.isError, false, JSON.stringify(serviceRecognized.body));
    assert.equal((await tally(service.line.id)).quantityBilled, 101);
    assert.equal((await ma.call("void_bill", { billId: serviceDraft.id })).isError, false);
    // Foreign full receipt with saved FX; same-rate full clearing does not receive stock twice.
    for (const date of new Set(["2026-10-04", new Date().toISOString().slice(0, 10)]))
      await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date, rate: 1500000, source: "manual" });
    const euro = await po({ currency: "EUR", quantity: 200, cost: 1000 });
    const eur = await received({ ...euro.input, lines: [{ purchaseOrderLineId: euro.line.id, quantity: 2 }] });
    const eurLegs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, eur.journalEntryId));
    assert.equal(eurLegs.reduce((sum, leg) => sum + leg.debitAmount, 0), 3000); assert.equal(eurLegs[0].currencyCode, "EUR"); assert.equal(eurLegs[0].exchangeRate, 1500000);
    const eurDraft = (await (await converted(eur.goodsReceipt.id)).json()).bill; assert.equal(eurDraft.totalMinor, "2000");
    const beforeStock = (await db.select().from(inventoryItem).where(eq(inventoryItem.id, item.id)))[0];
    const eurRecognized = await ma.call("receive_bill", { billId: eurDraft.id }); assert.equal(eurRecognized.isError, false, JSON.stringify(eurRecognized.body));
    const eurClearing = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, eurRecognized.body.grniEntryId));
    assert.equal(eurClearing.reduce((sum, leg) => sum + leg.debitAmount, 0), eurLegs.reduce((sum, leg) => sum + leg.creditAmount, 0));
    const afterStock = (await db.select().from(inventoryItem).where(eq(inventoryItem.id, item.id)))[0];
    assert.equal(afterStock.totalValue, beforeStock.totalValue); assert.equal(afterStock.quantityOnHand, beforeStock.quantityOnHand);
    assert.equal((await ma.call("void_bill", { billId: eurDraft.id })).isError, false);
    await db.update(exchangeRate).set({ rate: 1600000 }).where(eq(exchangeRate.baseCurrency, "EUR"));
    const changedDraft = (await (await converted(eur.goodsReceipt.id)).json()).bill;
    await unchanged(async () => assert.equal((await ma.call("receive_bill", { billId: changedDraft.id })).body.status, 422));
    await db.update(exchangeRate).set({ rate: 1500000 }).where(eq(exchangeRate.baseCurrency, "EUR"));
    await db.update(billLine).set({ quantity: 100, amount: 1000 }).where(eq(billLine.billId, changedDraft.id));
    await db.update(bill).set({ subtotal: 1000, total: 1000, amountDue: 1000 }).where(eq(bill.id, changedDraft.id));
    await unchanged(async () => assert.equal((await ma.call("receive_bill", { billId: changedDraft.id })).body.status, 422));
    await db.update(billLine).set({ quantity: 200, amount: 2000 }).where(eq(billLine.billId, changedDraft.id));
    await db.update(bill).set({ subtotal: 2000, total: 2000, amountDue: 2000 }).where(eq(bill.id, changedDraft.id));
    const event = (await db.select().from(auditLog).where(and(eq(auditLog.entityType, "goods_receipt"), eq(auditLog.entityId, eur.goodsReceipt.id), eq(auditLog.action, "create"))))[0];
    await db.update(auditLog).set({ changes: {} }).where(eq(auditLog.id, event.id));
    await unchanged(async () => assert.equal((await ma.call("receive_bill", { billId: changedDraft.id })).body.status, 422));
    await db.update(auditLog).set({ changes: event.changes }).where(eq(auditLog.id, event.id));
    await db.update(exchangeRate).set({ rate: 1600000 }).where(eq(exchangeRate.baseCurrency, "EUR"));
    for (const [currency, rate, baseValue] of [["KWD", 2000000, 250], ["JPY", 1000000, 125000]] as const) {
      for (const date of new Set(["2026-10-04", new Date().toISOString().slice(0, 10)]))
        await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currency, targetCurrency: "USD", date, rate, source: "manual" });
      const scaled = await po({ quantity: 100, currency }); const sr = await received(scaled.input);
      assert.equal(sr.goodsReceipt.lines[0].unitCostMinor, "1250"); assert.equal(sr.goodsReceipt.currencyCode, currency);
      const stock = (await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, sr.goodsReceipt.id)))[0]; assert.equal(stock.value, baseValue);
      const draft = (await (await converted(sr.goodsReceipt.id)).json()).bill;
      const recognized = await ma.call("receive_bill", { billId: draft.id }); assert.equal(recognized.isError, false, JSON.stringify(recognized.body));
    }
    // FIFO layers, zero cost, safe range and failed overflow without stock/ledger drift.
    const fp = await po({ stock: fifo.id, quantity: 200, cost: 1250 }); const fr = await received({ ...fp.input, lines: [{ purchaseOrderLineId: fp.line.id, quantity: 2 }] });
    const layers = await db.select().from(inventoryCostLayer).where(eq(inventoryCostLayer.inventoryItemId, fifo.id)); assert.equal(layers[0].unitCost, 1250); assert.equal(layers[0].remainingQuantity, 2);
    const zero = await po({ cost: 0, quantity: 100 }); const zr = await received(zero.input); assert.equal(zr.journalEntryId, null);
    const big = await po({ stock: null, cost: Number.MAX_SAFE_INTEGER, quantity: 100 });
    const br = await received(big.input); assert.equal(br.goodsReceipt.lines[0].unitCostMinor, String(Number.MAX_SAFE_INTEGER));
    assert.equal((await ma.call("get_goods_receipt", { goodsReceiptId: br.goodsReceipt.id })).body.goodsReceipt.lines[0].unitCostMinor, String(Number.MAX_SAFE_INTEGER));
    assert.equal((await (await converted(br.goodsReceipt.id)).json()).bill.totalMinor, String(Number.MAX_SAFE_INTEGER));
    const capacity = await po({ cost: 1, quantity: 2147483647, stock: null });
    assert.equal((await ma.call("receive_goods_receipt", { ...capacity.input, lines: [{ purchaseOrderLineId: capacity.line.id, quantityExact: "21474836.47" }] })).isError, false);
    const overflow = await po({ stock: null, quantity: 100, cost: Number.MAX_SAFE_INTEGER });
    await db.update(purchaseOrderLine).set({ quantity: 200 }).where(eq(purchaseOrderLine.id, overflow.line.id));
    const overflowInput = { ...overflow.input, lines: [{ purchaseOrderLineId: overflow.line.id, quantity: 2 }] };
    await unchanged(async () => { assert.equal((await post(overflowInput)).status, 422);
      assert.equal((await ma.call("receive_goods_receipt", overflowInput)).body.status, 422); });
    const fullStock = await po({ quantity: 100, cost: 1 });
    const prior = (await db.select().from(inventoryItem).where(eq(inventoryItem.id, item.id)))[0];
    await db.update(inventoryItem).set({ totalValue: Number.MAX_SAFE_INTEGER }).where(eq(inventoryItem.id, item.id));
    await unchanged(async () => { assert.equal((await post(fullStock.input)).status, 422);
      assert.equal((await ma.call("receive_goods_receipt", fullStock.input)).body.status, 422); });
    await db.update(inventoryItem).set({ totalValue: prior.totalValue }).where(eq(inventoryItem.id, item.id));
    const fifoRound = await po({ stock: fifo.id, quantity: 200, cost: 1, currency: "EUR" });
    // FX 1.6 gives 3 base minor units for two units, which cannot form an integer FIFO unit cost.
    await unchanged(async () => { assert.equal((await post({ ...fifoRound.input, lines: [{ purchaseOrderLineId: fifoRound.line.id, quantity: 2 }] })).status, 422); });
    const tinyFx = await po({ quantity: 100, cost: 1, currency: "CAD" });
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "CAD", targetCurrency: "USD", date: "2026-10-04", rate: 500000, source: "manual" });
    const tinyLines = await db.insert(purchaseOrderLine).values(Array.from({ length: 3 }, (_, i) => ({ purchaseOrderId: tinyFx.header.id,
      description: `Tiny ${i}`, quantity: 100, unitPrice: 1, amount: 1, inventoryItemId: item.id, warehouseId: store.id }))).returning();
    await db.update(purchaseOrder).set({ subtotal: 4, total: 4 }).where(eq(purchaseOrder.id, tinyFx.header.id));
    const tinyInput = { ...tinyFx.input, lines: [tinyFx.line, ...tinyLines].map(line => ({ purchaseOrderLineId: line.id, quantity: 1 })) };
    await unchanged(async () => { assert.equal((await post(tinyInput)).status, 422); assert.equal((await ma.call("receive_goods_receipt", tinyInput)).body.status, 422); });
    await db.update(inventoryItem).set({ trackingMethod: "serial" }).where(eq(inventoryItem.id, item.id));
    await unchanged(async () => { assert.equal((await post(fullStock.input)).status, 422); assert.equal((await ma.call("receive_goods_receipt", fullStock.input)).body.status, 422); });
    await db.update(inventoryItem).set({ trackingMethod: "none" }).where(eq(inventoryItem.id, item.id));
    const legacyMcp = await po({ stock: null, quantity: 100 });
    assert.equal((await ma.call("receive_goods_receipt", legacyMcp.input)).isError, false);
    const dualMcp = await po({ stock: null, quantity: 100 });
    assert.equal((await ma.call("receive_goods_receipt", { ...dualMcp.input, lines: [{ purchaseOrderLineId: dualMcp.line.id, quantity: 1, quantityExact: "1.00" }] })).isError, false);
    const [largeItem] = await db.insert(inventoryItem).values({ organizationId: a.id, name: "Large", code: "LARGE" }).returning();
    const wide = await po({ stock: largeItem.id, cost: 2147483648, quantity: 100 }); const wr = await received(wide.input);
    assert.equal(wr.goodsReceipt.lines[0].unitCostMinor, "2147483648");
    assert.equal((await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, wr.goodsReceipt.id)))[0].value, 2147483648);
    const unsafe = await po({ stock: null, quantity: 100 });
    await db.execute(sql`update purchase_order_line set unit_price = 9007199254740992 where id = ${unsafe.line.id}`);
    await unchanged(async () => { assert.equal((await post(unsafe.input)).status, 422); assert.equal((await ma.call("receive_goods_receipt", unsafe.input)).body.status, 422); });
    // Negative schemas, exact mismatch, duplicate lines, whole-unit rule and invalid references.
    for (const input of [ { ...fp.input, lines: [{ purchaseOrderLineId: fp.line.id, quantity: 0.5 }] },
      { ...fp.input, lines: [{ purchaseOrderLineId: fp.line.id, quantity: 1, quantityExact: "2" }] },
      { ...fp.input, lines: [fp.input.lines[0], fp.input.lines[0]] }, { ...fp.input, date: "2026-02-30" },
      { ...fp.input, lines: [{ purchaseOrderLineId: randomUUID(), quantity: 1 }] },
      { ...fp.input, lines: [{ purchaseOrderLineId: fp.line.id, quantityExact: "21474836.475" }] } ])
      await unchanged(async () => { assert.ok((await post(input)).status >= 400); assert.equal((await ma.call("receive_goods_receipt", input)).isError, true); });
    for (const options of [{ supplier: foreignSupplier.id }, { stock: foreignItem.id }, { warehouseId: foreignStore.id },
      { stock: badAccountItem.id }, { currency: "GBP" }, { status: "draft" as const }, { status: "void" as const },
      { org: b.id, supplier: foreignSupplier.id, stock: foreignItem.id, warehouseId: foreignStore.id }]) {
      const bad = await po(options);
      await unchanged(async () => { assert.ok((await post(bad.input)).status >= 400); assert.equal((await ma.call("receive_goods_receipt", bad.input)).isError, true); });
    }
    // Repeated concurrent receipt and conversion have exactly one winner.
    const concurrent = await po({ quantity: 100 });
    const receivedRace = await Promise.all([post(concurrent.input), post(concurrent.input)]); assert.deepEqual(receivedRace.map(result => result.status).sort(), [201, 400]);
    const winner = await receivedRace.find(result => result.status === 201)!.json();
    const billRace = await Promise.all([converted(winner.goodsReceipt.id), ma.call("create_bill_from_goods_receipt", { goodsReceiptId: winner.goodsReceipt.id })]);
    assert.equal(Number(billRace[0].status === 201) + Number(!billRace[1].isError), 1);
    // Corrupt history is never leaked to another org or repaired by a receipt operation.
    await db.update(goodsReceiptLine).set({ warehouseId: foreignStore.id }).where(eq(goodsReceiptLine.goodsReceiptId, fr.goodsReceipt.id));
    await unchanged(async () => { assert.equal((await detail(request("GET"), params(fr.goodsReceipt.id))).status, 422);
      assert.equal((await ma.call("get_goods_receipt", { goodsReceiptId: fr.goodsReceipt.id })).body.status, 422);
      assert.equal((await converted(fr.goodsReceipt.id)).status, 422); });
    // Period locks and injected audit/stock errors roll back numbering, control accounts and writes.
    const locked = await po();
    // Conversion dates its bill today; exercise a UTC day change after receipt.
    mock.timers.setTime(Date.parse("2026-10-05T12:00:00Z"));
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-05", lockedBy: owner.id });
    await unchanged(async () => { assert.equal((await post(locked.input)).status, 422); assert.equal((await ma.call("receive_goods_receipt", locked.input)).body.status, 422);
      assert.equal((await converted(zr.goodsReceipt.id)).status, 422); });
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.execute(sql`CREATE FUNCTION fail_grn_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type = 'goods_receipt' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`);
    await db.execute(sql`CREATE TRIGGER fail_grn_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_grn_audit()`);
    await unchanged(async () => { assert.equal((await post(locked.input)).status, 500); assert.equal((await ma.call("receive_goods_receipt", locked.input)).isError, true);
      assert.equal((await converted(zr.goodsReceipt.id)).status, 500); });
    await db.execute(sql`DROP TRIGGER fail_grn_audit ON audit_log`);
    await db.execute(sql`CREATE FUNCTION fail_grn_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture stock failure'; END $$`);
    await db.execute(sql`CREATE TRIGGER fail_grn_stock BEFORE INSERT ON inventory_movement FOR EACH ROW EXECUTE FUNCTION fail_grn_stock()`);
    await unchanged(async () => assert.equal((await post(locked.input)).status, 500));
    await db.execute(sql`DROP TRIGGER fail_grn_stock ON inventory_movement`);
    assert.ok((await db.select().from(auditLog).where(and(eq(auditLog.entityType, "goods_receipt"), eq(auditLog.entityId, first.goodsReceipt.id)))).length >= 2);
    // Schema/read input errors do not mutate anything.
    await unchanged(async () => { for (const query of ["?page=0", "?limit=101", "?page=1.2", "?status=bad", "?purchaseOrderId=no"])
      assert.equal((await list(request("GET", undefined, keys.a, query))).status, 400);
      assert.equal((await detail(request("GET"), params("bad"))).status, 400);
      assert.equal((await list(request("GET", undefined, "dk_invalid"))).status, 401);
      assert.equal((await post(locked.input, "dk_invalid")).status, 401);
      assert.equal((await converted(zr.goodsReceipt.id, "dk_invalid")).status, 401);
      assert.equal((await receive(new Request("http://fixture.test/api/v1/goods-receipts", { method: "POST",
        headers: { authorization: `Bearer ${keys.a}` }, body: "{" }))).status, 400); });
    console.log("REST and MCP goods receipts verified");
  } finally { mock.timers.reset(); await ma.close(); await mb.close(); await ro.close(); }
}
try { await run(); process.exit(0); } catch (error) { console.error(error); process.exit(1); }
