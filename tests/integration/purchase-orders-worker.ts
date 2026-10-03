// Runs only in purchase-orders.test.ts's migrated, randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, inventoryItem, warehouse,
  purchaseOrder, purchaseOrderLine, goodsReceipt, goodsReceiptLine, billLine, periodLock, fiscalYear, numberSequence,
  journalEntry, journalLine, auditLog, procurementSettings } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/purchase-orders/route";
import { GET as detail, PATCH as update, DELETE as remove } from "../../app/api/v1/purchase-orders/[id]/route";
import { GET as counts } from "../../app/api/v1/purchase-orders/counts/route";
import { POST as send } from "../../app/api/v1/purchase-orders/[id]/send/route";
import { POST as convert } from "../../app/api/v1/purchase-orders/[id]/convert/route";
import { PATCH as editBill, DELETE as deleteBill } from "../../app/api/v1/bills/[id]/route";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";
import { getNextEntryNumber } from "../../lib/api/journal-automation";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Purchase order fixture", version: "1.0.0" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["create_purchase_order", "list_purchase_orders", "get_purchase_order", "get_purchase_order_counts",
    "update_purchase_order", "delete_purchase_order", "send_purchase_order", "convert_po_to_bill"]) {
    assert.equal(tools.filter(tool => tool.name === name).length, 1, `Unique registration ${name}`);
  }
  assert.match(JSON.stringify(tools.find(tool => tool.name === "create_purchase_order")!.inputSchema), /unitPriceExact/);
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async close() { await client.close(); await server.close(); },
  };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "PO A", slug: "po-a" }, { name: "PO B", slug: "po-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "po-owner@example.test" }, { email: "po-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_po_a", b: "dk_po_b", viewer: "dk_po_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_po" });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "supplier" },
    { organizationId: b.id, name: "B", type: "supplier" }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Expense", code: "5000", type: "expense" },
    { organizationId: b.id, name: "Expense", code: "5000", type: "expense" }]).returning();
  await db.insert(chartAccount).values({ organizationId: a.id, name: "Accounts payable", code: "2100", type: "liability" });
  const [tax, reverse, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Normal", rate: 1000 },
    { organizationId: a.id, name: "Reverse", rate: 1000, kind: "reverse_charge" }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const [item, foreignItem] = await db.insert(inventoryItem).values([{ organizationId: a.id, name: "Item", code: "A" },
    { organizationId: b.id, name: "Item", code: "B" }]).returning();
  const [store, foreignStore] = await db.insert(warehouse).values([{ organizationId: a.id, name: "Store", code: "A" },
    { organizationId: b.id, name: "Store", code: "B" }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/purchase-orders${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const post = (body: unknown, key = keys.a) => create(request("POST", body, key));
  const patch = (id: string, body: unknown, key = keys.a) => update(request("PATCH", body, key), params(id));
  const del = (id: string, key = keys.a) => remove(request("DELETE", undefined, key), params(id));
  const sent = (id: string, body: unknown = {}, key = keys.a) => send(request("POST", body, key), params(id));
  const converted = (id: string, body: unknown = {}, key = keys.a) => convert(request("POST", body, key), params(id));
  const basic = { contactId: supplier.id, issueDate: "2026-10-03", lines: [{ description: "Item", unitPrice: 12.5 }] };
  const draft = async (patch: Record<string, unknown> = {}) => {
    const response = await post({ ...basic, ...patch }); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    return (await response.json()).purchaseOrder;
  };
  const lines = (id: string) => db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, id)).orderBy(purchaseOrderLine.sortOrder);
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_order i) as orders,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_order_line i) as order_lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill i) as bills,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill_line i) as bill_lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill_purchase_order i) as links,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from number_sequence i) as numbering,
    (select count(*)::text from audit_log) as audits, (select count(*)::text from journal_entry) as journals,
    (select count(*)::text from inventory_movement) as stock, (select count(*)::text from document_email_log) as emails`)).rows;
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  try {
    let editable = "";
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" },
      { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const input = { ...basic, lines: [{ description: "Alias", ...price }] };
      const row = await draft({ lines: input.lines }), mc = await ma.call("create_purchase_order", input);
      assert.equal(mc.isError, false); assert.equal(row.total, 1250); assert.equal(row.totalMinor, "1250");
      assert.equal(row.organizationId, a.id); assert.equal(mc.body.purchaseOrder.totalMinor, row.totalMinor);
      assert.equal((await patch(row.id, { lines: input.lines })).status, 200);
      assert.equal((await ma.call("update_purchase_order", { purchaseOrderId: row.id, lines: input.lines })).body.purchaseOrder.totalMinor, "1250");
      const r = (await (await detail(request("GET"), params(row.id))).json()).purchaseOrder;
      assert.equal(r.lines[0].unitPriceMinor, "1250"); assert.equal(r.lines[0].quantity, 100);
      assert.equal((await ma.call("get_purchase_order", { purchaseOrderId: row.id })).body.purchaseOrder.totalMinor, "1250");
      const listed = await (await list(request("GET", undefined, keys.a, "?limit=100"))).json();
      assert.ok(listed.data.some((value: { id: string; totalMinor: string }) => value.id === row.id && value.totalMinor === "1250"));
      assert.equal(listed.pagination.page, 1);
      const ml = await ma.call("list_purchase_orders", { contactId: supplier.id, limit: 100 });
      assert.ok(ml.body.purchaseOrders.some((value: { id: string; lines: { amountMinor: string }[] }) => value.id === row.id && value.lines[0].amountMinor === "1250"));
      editable = row.id;
    }
    for (const amount of ["2147483648", String(Number.MAX_SAFE_INTEGER), "-1250"]) {
      const input = { ...basic, lines: [{ description: "Range", unitPriceMinor: amount }] };
      const row = await draft({ lines: input.lines }); assert.equal(row.totalMinor, amount);
      assert.equal((await ma.call("create_purchase_order", input)).body.purchaseOrder.totalMinor, amount);
      assert.equal((await (await patch(row.id, { lines: input.lines })).json()).purchaseOrder.totalMinor, amount);
      assert.equal((await ma.call("update_purchase_order", { purchaseOrderId: row.id, lines: input.lines })).body.purchaseOrder.totalMinor, amount);
      assert.equal((await ma.call("get_purchase_order", { purchaseOrderId: row.id })).body.purchaseOrder.totalMinor, amount);
      assert.equal((await sent(row.id)).status, 200);
      const result = await converted(row.id); assert.equal(result.status, 201); assert.equal((await result.json()).bill.totalMinor, amount);
    }
    // Restore count buckets after the deliberate large sum fixtures; all rows themselves remain exact.
    const rangeOrders = await db.select({ id: purchaseOrder.id }).from(purchaseOrder).where(sql`${purchaseOrder.total} >= 2147483648 or ${purchaseOrder.total} < 0`);
    for (const row of rangeOrders) await db.update(purchaseOrder).set({ status: "void" }).where(eq(purchaseOrder.id, row.id));
    // Safe and mixed currency counts are verified later in isolated states.
    const discounted = await draft({ lines: [{ description: "Discount", quantity: 1.5, unitPriceMinor: "1250", discountPercent: 1000,
      taxRateId: tax.id, accountId: account.id, inventoryItemId: item.id, warehouseId: store.id }] });
    assert.equal(discounted.totalMinor, "1856"); assert.equal((await lines(discounted.id))[0].quantity, 150);
    const updated = await (await patch(discounted.id, { lines: [{ description: "PATCH", quantity: 1.5, unitPriceExact: "12.50", taxRateId: tax.id }] })).json();
    assert.equal(updated.purchaseOrder.totalMinor, "1875"); assert.equal(updated.purchaseOrder.taxTotalMinor, "0");
    assert.equal((await lines(discounted.id))[0].taxRateId, tax.id);
    assert.equal((await ma.call("update_purchase_order", { purchaseOrderId: discounted.id, notes: "Header only" })).body.purchaseOrder.totalMinor, "1875");
    for (const [currencyCode, unitPriceExact] of [["JPY", "1250"], ["KWD", "1.250"]]) {
      const row = await draft({ currencyCode, lines: [{ description: "Currency", unitPriceExact }] });
      assert.equal(row.totalMinor, "1250"); assert.equal((await ma.call("get_purchase_order", { purchaseOrderId: row.id })).body.purchaseOrder.currencyCode, currencyCode);
      await del(row.id);
    }
    // Partial conversion, full remaining conversion, saved discounts and exact residuals.
    const partial = await draft({ lines: [{ description: "Net", quantity: 3, unitPriceMinor: "37", discountPercent: 1000, taxRateId: tax.id, accountId: account.id }] });
    assert.equal(partial.subtotalMinor, "100"); assert.equal(partial.taxTotalMinor, "10");
    assert.equal((await ma.call("send_purchase_order", { purchaseOrderId: partial.id })).body.purchaseOrder.status, "sent");
    const pol = (await lines(partial.id))[0];
    const first = await (await converted(partial.id, { lines: [{ purchaseOrderLineId: pol.id, quantity: 1 }] })).json();
    assert.equal(first.bill.totalMinor, "36"); assert.equal(first.purchaseOrder.status, "partial");
    const second = await ma.call("convert_po_to_bill", { purchaseOrderId: partial.id, lines: [{ purchaseOrderLineId: pol.id, quantity: 1 }] });
    assert.equal(second.body.bill.totalMinor, "38"); assert.equal(second.body.purchaseOrderStatus, "partial");
    await unchanged(async () => { assert.equal((await editBill(request("PATCH", { notes: "Invalid reservation edit" }), params(first.bill.id))).status, 400);
      assert.equal((await deleteBill(request("DELETE"), params(first.bill.id))).status, 400); });
    assert.equal((await ma.call("void_bill", { billId: first.bill.id })).isError, false);
    assert.equal((await lines(partial.id))[0].quantityBilled, 100);
    const final = await (await converted(partial.id)).json(); assert.equal(final.bill.totalMinor, "72");
    assert.equal(final.purchaseOrder.status, "closed"); assert.equal(final.purchaseOrder.convertedBillId, first.bill.id);
    assert.equal((await lines(partial.id))[0].quantityBilled, 300);
    assert.equal(second.body.bill.total + final.bill.total, partial.total);
    await unchanged(async () => { assert.equal((await converted(partial.id)).status, 400); assert.equal((await patch(partial.id, {})).status, 400); assert.equal((await del(partial.id)).status, 400); });
    const recognizedFinal = await ma.call("receive_bill", { billId: final.bill.id });
    assert.equal(recognizedFinal.isError, false, JSON.stringify(recognizedFinal.body));
    assert.equal((await lines(partial.id))[0].quantityBilled, 300);
    assert.equal((await ma.call("void_bill", { billId: final.bill.id })).isError, false);
    assert.equal((await lines(partial.id))[0].quantityBilled, 100);
    // Reverse charge due excludes supplier-unpayable output VAT.
    const rc = await draft({ lines: [{ description: "RC", unitPriceMinor: "1250", taxRateId: reverse.id }] });
    await sent(rc.id); const rcBill = (await ma.call("convert_po_to_bill", { purchaseOrderId: rc.id })).body.bill;
    assert.equal(rcBill.totalMinor, "1375"); assert.equal(rcBill.amountDueMinor, "1250");
    const rcResidual = await draft({ lines: [{ description: "RC residual", quantity: 3, unitPriceMinor: "37", discountPercent: 1000, taxRateId: reverse.id }] });
    await sent(rcResidual.id); const rcLine = (await lines(rcResidual.id))[0];
    const rcFirst = await converted(rcResidual.id, { lines: [{ purchaseOrderLineId: rcLine.id, quantity: 1 }] });
    assert.equal(rcFirst.status, 201);
    await unchanged(async () => {
      assert.equal((await converted(rcResidual.id, { lines: [{ purchaseOrderLineId: rcLine.id, quantity: 1 }] })).status, 422);
      assert.equal((await ma.call("convert_po_to_bill", { purchaseOrderId: rcResidual.id,
        lines: [{ purchaseOrderLineId: rcLine.id, quantity: 1 }] })).body.status, 422);
    });
    // GRN slices are not reused: receive then convert in two rounds and recognize without a second tally increment.
    const received = await draft({ lines: [{ description: "GRN", quantity: 2, unitPriceMinor: "1000", accountId: account.id }] });
    await sent(received.id); const rl = (await lines(received.id))[0];
    const [grn] = await db.insert(goodsReceipt).values({ organizationId: a.id, contactId: supplier.id, purchaseOrderId: received.id,
      receiptNumber: "GRN-PO", date: "2026-10-03", status: "received" }).returning();
    const [grni, inventory] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "GRNI", code: "2150", type: "liability" },
      { organizationId: a.id, name: "Inventory", code: "1300", type: "asset" }]).returning();
    const [accrual] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: await getNextEntryNumber(a.id), date: "2026-10-03", description: "GRN accrual",
      sourceType: "goods_receipt", reference: grn.receiptNumber, status: "posted" }).returning();
    await db.insert(journalLine).values([{ journalEntryId: accrual.id, accountId: inventory.id, debitAmount: 2000, creditAmount: 0 },
      { journalEntryId: accrual.id, accountId: grni.id, debitAmount: 0, creditAmount: 2000 }]);
    const grns = await db.insert(goodsReceiptLine).values([0, 1].map(sortOrder => ({ goodsReceiptId: grn.id, purchaseOrderLineId: rl.id,
      description: "GRN", quantityReceived: 100, unitCost: 1000, journalEntryId: accrual.id, sortOrder }))).returning();
    await db.update(purchaseOrderLine).set({ quantityReceived: 200 }).where(eq(purchaseOrderLine.id, rl.id));
    const g1 = await (await converted(received.id, { lines: [{ purchaseOrderLineId: rl.id, quantity: 1 }] })).json();
    const g2 = (await ma.call("convert_po_to_bill", { purchaseOrderId: received.id })).body;
    assert.equal((await db.select().from(billLine).where(eq(billLine.billId, g1.bill.id)))[0].goodsReceiptLineId, grns[0].id);
    assert.equal((await db.select().from(billLine).where(eq(billLine.billId, g2.bill.id)))[0].goodsReceiptLineId, grns[1].id);
    await db.insert(procurementSettings).values({ organizationId: a.id, requireGrnBeforeBill: true, blockOverBill: true });
    assert.equal((await ma.call("receive_bill", { billId: g1.bill.id })).isError, false);
    assert.equal((await lines(received.id))[0].quantityBilled, 200);
    assert.equal((await ma.call("receive_bill", { billId: g2.bill.id })).isError, false);
    assert.equal((await lines(received.id))[0].quantityBilled, 200);
    assert.equal((await ma.call("void_bill", { billId: g1.bill.id })).isError, false);
    assert.equal((await lines(received.id))[0].quantityBilled, 100);
    assert.equal((await ma.call("void_bill", { billId: g2.bill.id })).isError, false);
    assert.equal((await lines(received.id))[0].quantityBilled, 0);
    await db.update(goodsReceipt).set({ organizationId: b.id }).where(eq(goodsReceipt.id, grn.id));
    await unchanged(async () => { assert.equal((await converted(received.id)).status, 400);
      assert.equal((await ma.call("convert_po_to_bill", { purchaseOrderId: received.id })).isError, true); });
    await db.update(goodsReceipt).set({ organizationId: a.id }).where(eq(goodsReceipt.id, grn.id));
    // All operations enforce API-key scope, roles and isolation.
    const foreign = (await mb.call("create_purchase_order", { ...basic, contactId: foreignSupplier.id })).body.purchaseOrder;
    for (const [route, tool] of [[sent, "send_purchase_order"], [converted, "convert_po_to_bill"], [patch, "update_purchase_order"]] as const) await unchanged(async () => {
      assert.equal((await route(foreign.id, {})).status, 404);
      assert.equal((await route(editable, {}, keys.viewer)).status, 403); assert.equal((await route(editable, {}, "dk_invalid")).status, 401);
      assert.equal((await mb.call(tool, { purchaseOrderId: editable })).body.status, 404);
      assert.equal((await ro.call(tool, { purchaseOrderId: editable })).body.status, 403);
    });
    await unchanged(async () => {
      assert.equal((await post(basic, keys.viewer)).status, 403); assert.equal((await post(basic, "dk_invalid")).status, 401);
      assert.equal((await ro.call("create_purchase_order", basic)).body.status, 403);
      assert.equal((await del(foreign.id)).status, 404); assert.equal((await del(editable, keys.viewer)).status, 403);
      assert.equal((await mb.call("delete_purchase_order", { purchaseOrderId: editable })).body.status, 404);
      assert.equal((await ro.call("delete_purchase_order", { purchaseOrderId: editable })).body.status, 403);
      assert.equal((await detail(request("GET"), params(foreign.id))).status, 404);
      assert.equal((await mb.call("get_purchase_order", { purchaseOrderId: editable })).body.status, 404);
      assert.equal((await list(request("GET", undefined, "dk_invalid"))).status, 401);
      assert.equal((await counts(request("GET", undefined, "dk_invalid"))).status, 401);
      assert.equal((await post({ ...basic, contactId: foreignSupplier.id })).status, 400);
      assert.equal((await patch(editable, { contactId: foreignSupplier.id })).status, 400);
    });
    assert.ok((await (await list(request("GET", undefined, keys.b))).json()).data.every((row: { organizationId: string }) => row.organizationId === b.id));
    assert.equal((await mb.call("get_purchase_order_counts")).body.total, 1);
    for (const [field, id] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id], ["inventoryItemId", foreignItem.id], ["warehouseId", foreignStore.id]] as const) {
      const invalidLines = [{ description: "Foreign", unitPriceMinor: "1", [field]: id }];
      await unchanged(async () => {
        assert.equal((await post({ ...basic, lines: invalidLines })).status, 400); assert.equal((await patch(editable, { lines: invalidLines })).status, 400);
        assert.equal((await ma.call("create_purchase_order", { ...basic, lines: invalidLines })).isError, true);
        assert.equal((await ma.call("update_purchase_order", { purchaseOrderId: editable, lines: invalidLines })).isError, true);
      });
    }
    await db.update(purchaseOrderLine).set({ inventoryItemId: foreignItem.id }).where(eq(purchaseOrderLine.purchaseOrderId, editable));
    await unchanged(async () => {
      assert.equal((await detail(request("GET"), params(editable))).status, 400);
      assert.equal((await ma.call("list_purchase_orders", { limit: 100 })).isError, true);
      assert.equal((await patch(editable, { lines: basic.lines })).status, 400); assert.equal((await del(editable)).status, 400); assert.equal((await sent(editable)).status, 400);
    });
    await db.update(purchaseOrderLine).set({ inventoryItemId: null }).where(eq(purchaseOrderLine.purchaseOrderId, editable));
    // Locked dates and unsupported inputs/history cannot be overwritten or consumed.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-03" }).returning();
    await unchanged(async () => {
      assert.equal((await post(basic)).status, 422); assert.equal((await patch(editable, { issueDate: "2026-10-04" })).status, 422);
      assert.equal((await del(editable)).status, 422); assert.equal((await sent(editable)).status, 422);
      assert.equal((await converted(received.id)).status, 422); assert.equal((await ma.call("send_purchase_order", { purchaseOrderId: editable })).body.status, 422);
    });
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [oldLock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-02" }).returning();
    await unchanged(async () => { assert.equal((await patch(editable, { issueDate: "2026-10-02" })).status, 422); });
    await db.delete(periodLock).where(eq(periodLock.id, oldLock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    await unchanged(async () => { assert.equal((await post(basic)).status, 422); assert.equal((await ma.call("create_purchase_order", basic)).body.status, 422); });
    await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    for (const invalidLines of [[{ description: "Unsafe", unitPriceMinor: "9007199254740992" }],
      [{ description: "Product", unitPriceMinor: String(Number.MAX_SAFE_INTEGER), quantity: 2, discountPercent: 10000 }],
      [{ description: "Sum", unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }, { description: "Sum", unitPriceMinor: "1" }]]) await unchanged(async () => {
      assert.equal((await post({ ...basic, lines: invalidLines })).status, 422); assert.equal((await patch(editable, { lines: invalidLines })).status, 422);
      assert.equal((await ma.call("create_purchase_order", { ...basic, lines: invalidLines })).body.status, 422);
      assert.equal((await ma.call("update_purchase_order", { purchaseOrderId: editable, lines: invalidLines })).body.status, 422);
    });
    await unchanged(async () => {
      assert.equal((await post({ ...basic, issueDate: "2026-02-30" })).status, 400);
      assert.equal((await post({ ...basic, lines: [{ description: "Conflict", unitPrice: 12.5, unitPriceMinor: "12" }] })).status, 400);
      assert.equal((await sent(editable, { sendEmail: true })).status, 400); assert.equal((await converted(received.id, { lines: [] })).status, 400);
      assert.equal((await converted(received.id, { lines: [{ purchaseOrderLineId: rl.id, quantity: 3 }] })).status, 400);
      assert.equal((await converted(received.id, { lines: [{ purchaseOrderLineId: rl.id, quantity: 1 }, { purchaseOrderLineId: rl.id, quantity: 1 }] })).status, 400);
      assert.equal((await converted(received.id, { lines: [{ purchaseOrderLineId: pol.id, quantity: 1 }] })).status, 400);
      assert.equal((await del("invalid")).status, 400); assert.equal((await detail(request("GET"), params("invalid"))).status, 400);
      for (const route of [send, convert]) assert.equal((await route(new Request("http://fixture.test", { method: "POST",
        headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), params(editable))).status, 400);
    });
    await db.execute(sql`update purchase_order set total = 9007199254740992 where id = ${editable}`);
    await unchanged(async () => {
      assert.equal((await patch(editable, {})).status, 422); assert.equal((await del(editable)).status, 422); assert.equal((await sent(editable)).status, 422);
      assert.equal((await detail(request("GET"), params(editable))).status, 422);
    });
    await db.update(purchaseOrder).set({ total: 1250 }).where(eq(purchaseOrder.id, editable));
    await db.execute(sql`update purchase_order_line set amount = 9007199254740992 where purchase_order_id = ${editable}`);
    await unchanged(async () => { assert.equal((await patch(editable, { lines: basic.lines })).status, 422); assert.equal((await del(editable)).status, 422);
      assert.equal((await ma.call("get_purchase_order", { purchaseOrderId: editable })).body.status, 422); });
    await db.update(purchaseOrderLine).set({ amount: 1250 }).where(eq(purchaseOrderLine.purchaseOrderId, editable));
    // Unknown pre-adoption partial allocation history rejects instead of guessing a monetary residual.
    await db.update(purchaseOrderLine).set({ quantityBilled: 100 }).where(eq(purchaseOrderLine.id, rl.id));
    await unchanged(async () => { assert.equal((await converted(received.id)).status, 422); assert.equal((await ma.call("convert_po_to_bill", { purchaseOrderId: received.id })).body.status, 422); });
    await db.update(purchaseOrderLine).set({ quantityBilled: 0 }).where(eq(purchaseOrderLine.id, rl.id));
    // Faults in lines, bill/links, tally/status and audit roll back all operation effects, including numbers.
    await db.execute(sql`alter table purchase_order_line add constraint fixture_po_line check (description <> 'ROLLBACK')`);
    await unchanged(async () => { assert.equal((await post({ ...basic, lines: [{ description: "ROLLBACK", unitPrice: 1 }] })).status, 500);
      assert.equal((await patch(editable, { lines: [{ description: "ROLLBACK", unitPrice: 1 }] })).status, 500); });
    await db.execute(sql`alter table purchase_order_line drop constraint fixture_po_line`);
    for (const statement of [sql`alter table bill_line add constraint fixture_po_failure check (false) not valid`,
      sql`alter table bill_purchase_order add constraint fixture_po_failure check (false) not valid`,
      sql`alter table purchase_order_line add constraint fixture_po_failure check (quantity_billed = 0) not valid`]) {
      await db.execute(statement); await unchanged(async () => { assert.equal((await converted(received.id)).status, 500); });
      await db.execute(sql`alter table bill_line drop constraint if exists fixture_po_failure`);
      await db.execute(sql`alter table bill_purchase_order drop constraint if exists fixture_po_failure`);
      await db.execute(sql`alter table purchase_order_line drop constraint if exists fixture_po_failure`);
    }
    await db.execute(sql`alter table audit_log add constraint fixture_po_audit check (entity_type <> 'purchase_order') not valid`);
    await unchanged(async () => {
      assert.equal((await post(basic)).status, 500); assert.equal((await patch(editable, { notes: "Rollback" })).status, 500);
      assert.equal((await del(editable)).status, 500); assert.equal((await sent(editable)).status, 500); assert.equal((await converted(received.id)).status, 500);
      assert.equal((await sent(editable, { sendEmail: true, recipientEmail: "supplier@example.test", subject: "PO",
        templateProps: { organizationName: "Fixture", contactName: "Supplier", documentType: "Purchase order", documentNumber: "PO" } })).status, 500);
      assert.equal((await ma.call("convert_po_to_bill", { purchaseOrderId: received.id })).isError, true);
    });
    await db.execute(sql`alter table audit_log drop constraint fixture_po_audit`);
    const concurrent = await Promise.all(Array.from({ length: 3 }, () => ma.call("create_purchase_order", basic)));
    assert.ok(concurrent.every(result => !result.isError)); assert.equal(new Set(concurrent.map(result => result.body.purchaseOrder.poNumber)).size, 3);
    const firstRace = await Promise.all(Array.from({ length: 3 }, () => mb.call("create_purchase_order", { ...basic, contactId: foreignSupplier.id })));
    assert.deepEqual(firstRace.map(result => result.body.purchaseOrder.poNumber).sort(), ["PO-00002", "PO-00003", "PO-00004"]);
    const [freshOrg] = await db.insert(organization).values({ name: "Fresh PO numbering", slug: "po-fresh" }).returning();
    await db.insert(member).values({ organizationId: freshOrg.id, userId: owner.id, role: "owner" });
    const [freshSupplier] = await db.insert(contact).values({ organizationId: freshOrg.id, name: "Fresh supplier", type: "supplier" }).returning();
    const freshClient = await mcp({ ...ctx, organizationId: freshOrg.id });
    try {
      const fresh = await Promise.all(Array.from({ length: 3 }, () => freshClient.call("create_purchase_order", { ...basic, contactId: freshSupplier.id })));
      assert.ok(fresh.every(result => !result.isError));
      assert.deepEqual(fresh.map(result => result.body.purchaseOrder.poNumber).sort(), ["PO-00001", "PO-00002", "PO-00003"]);
    } finally { await freshClient.close(); }
    const race = await draft();
    const sends = await Promise.all(Array.from({ length: 3 }, () => sent(race.id))); assert.deepEqual(sends.map(response => response.status).sort(), [200, 400, 400]);
    const conversions = await Promise.all(Array.from({ length: 3 }, () => converted(race.id)));
    assert.deepEqual(conversions.map(response => response.status).sort(), [201, 400, 400]);
    const deleting = await draft();
    const deletes = await Promise.all(Array.from({ length: 3 }, () => ma.call("delete_purchase_order", { purchaseOrderId: deleting.id })));
    assert.equal(deletes.filter(result => !result.isError).length, 1); assert.equal((await lines(deleting.id)).length, 0);
    await db.update(numberSequence).set({ lastNumber: 2147483647 }).where(sql`${numberSequence.organizationId} = ${b.id} and ${numberSequence.entityType} = 'purchase_order'`);
    await unchanged(async () => { assert.equal((await mb.call("create_purchase_order", { ...basic, contactId: foreignSupplier.id })).isError, true); });
    const mcount = (await mb.call("get_purchase_order_counts")).body;
    assert.equal(mcount.counts.draft.amountMinor, "5000"); assert.equal(mcount.counts.draft.currencyCode, "USD");
    const restCount = await counts(request("GET", undefined, keys.b)); assert.deepEqual(await restCount.json(), mcount);
    const mixed = (await mb.call("create_purchase_order", { ...basic, contactId: foreignSupplier.id, currencyCode: "JPY", lines: [{ description: "JPY", unitPriceMinor: "1250" }] }));
    assert.equal(mixed.isError, true); // Number capacity remains exhausted.
    await db.update(numberSequence).set({ lastNumber: 4 }).where(sql`${numberSequence.organizationId} = ${b.id} and ${numberSequence.entityType} = 'purchase_order'`);
    const mixedRow = (await mb.call("create_purchase_order", { ...basic, contactId: foreignSupplier.id, currencyCode: "JPY", lines: [{ description: "JPY", unitPriceMinor: "1250" }] })).body.purchaseOrder;
    assert.equal((await counts(request("GET", undefined, keys.b))).status, 422); assert.equal((await mb.call("get_purchase_order_counts")).body.status, 422);
    await mb.call("delete_purchase_order", { purchaseOrderId: mixedRow.id });
    await db.execute(sql`update purchase_order set total = 9007199254740992 where id = ${foreign.id}`);
    assert.equal((await counts(request("GET", undefined, keys.b))).status, 422); assert.equal((await mb.call("get_purchase_order_counts")).body.status, 422);
    await db.update(purchaseOrder).set({ total: 1250 }).where(eq(purchaseOrder.id, foreign.id));
    const sumOrder = firstRace[0].body.purchaseOrder;
    await db.execute(sql`update purchase_order set total = 9007199254740991 where id = ${sumOrder.id}`);
    assert.equal((await counts(request("GET", undefined, keys.b))).status, 422);
    await db.update(purchaseOrder).set({ total: 1250 }).where(eq(purchaseOrder.id, sumOrder.id));
    await db.execute(sql`update purchase_order set total = case when id = ${foreign.id} then 9007199254740992 else -9007199254740992 end
      where id in (${foreign.id}, ${sumOrder.id})`);
    assert.equal((await counts(request("GET", undefined, keys.b))).status, 422);
    await db.execute(sql`update purchase_order set total = 1250 where id in (${foreign.id}, ${sumOrder.id})`);
    const emailBody = { sendEmail: true, recipientEmail: "supplier@example.test", subject: "PO", attachPdf: true,
      templateProps: { organizationName: "Fixture", contactName: "Supplier", documentType: "Purchase order", documentNumber: "PO" } };
    // RESEND_API_KEY is explicitly blank in this worker; no SMTP fixture or network provider exists.
    for (const transport of ["rest", "mcp"]) {
      const emailOrder = await draft();
      if (transport === "rest") assert.equal((await sent(emailOrder.id, emailBody)).status, 502);
      else assert.equal((await ma.call("send_purchase_order", { purchaseOrderId: emailOrder.id, ...emailBody })).body.status, 502);
      const savedEmailOrder = await db.query.purchaseOrder.findFirst({ where: eq(purchaseOrder.id, emailOrder.id) });
      assert.equal(savedEmailOrder!.status, "sent"); assert.ok(savedEmailOrder!.sentAt);
      const logs = (await db.execute(sql`select status, attach_pdf from document_email_log where document_id = ${emailOrder.id}`)).rows;
      assert.deepEqual(logs, [{ status: "failed", attach_pdf: false }]);
    }
    assert.equal((await ma.call("delete_purchase_order", { purchaseOrderId: editable })).body.success, true);
    assert.equal((await detail(request("GET"), params(editable))).status, 404);
    const audit = await db.select().from(auditLog).where(eq(auditLog.entityId, race.id));
    assert.deepEqual(audit.map(row => row.action).sort(), ["convert", "create", "send"]);
    assert.ok(audit.every(row => row.organizationId === a.id));
    console.log("REST and MCP purchase orders verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
