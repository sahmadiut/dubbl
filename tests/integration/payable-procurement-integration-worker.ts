// Runs only against the migrated disposable database created by the parent fixture.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock } from "node:test";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, inventoryItem,
  warehouse, purchaseOrderLine, goodsReceipt, bill, billLine, journalLine } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";
import { POST as createRequisition } from "../../app/api/v1/purchase-requisitions/route";
import { POST as convertRequisition } from "../../app/api/v1/purchase-requisitions/[id]/convert/route";
import { GET as getOrder, PATCH as editOrder } from "../../app/api/v1/purchase-orders/[id]/route";
import { POST as convertOrder } from "../../app/api/v1/purchase-orders/[id]/convert/route";
import { POST as receiveGoods } from "../../app/api/v1/goods-receipts/route";
import { POST as convertGoods } from "../../app/api/v1/goods-receipts/[id]/create-bill/route";
import { GET as getBill } from "../../app/api/v1/bills/[id]/route";
import { POST as receiveBill } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as voidBill } from "../../app/api/v1/bills/[id]/void/route";
import { POST as createDebit } from "../../app/api/v1/debit-notes/route";
import { POST as applyDebit } from "../../app/api/v1/debit-notes/[id]/apply/route";
import { POST as sendDebit } from "../../app/api/v1/debit-notes/[id]/send/route";
import { PATCH as settings } from "../../app/api/v1/procurement-settings/route";
import { POST as importBills } from "../../app/api/v1/bulk/bills/import/route";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined procurement fixture", version: "1.0.0" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  const names = tools.map(tool => tool.name);
  for (const name of ["create_bill", "get_bill", "get_bill_counts", "receive_bill", "void_bill", "import_bills",
    "create_purchase_order", "convert_po_to_bill", "create_purchase_requisition", "convert_purchase_requisition",
    "receive_goods_receipt", "create_bill_from_goods_receipt", "apply_debit_note", "update_procurement_settings"])
    assert.equal(names.filter(value => value === name).length, 1, name);
  for (const name of ["receive_goods_receipt", "convert_po_to_bill", "list_debit_notes", "create_debit_note", "update_debit_note", "apply_debit_note"])
    assert.equal(tools.find(tool => tool.name === name)!.inputSchema.additionalProperties, false, `${name} rejects unsupported controls`);
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async ok(name: string, args: Record<string, unknown> = {}) {
      const result = await this.call(name, args); assert.equal(result.isError, false, `${name}: ${JSON.stringify(result.body)}`);
      return result.body;
    },
    async close() { await client.close(); await server.close(); },
  };
}

async function run() {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-09T12:00:00Z") });
  const date = "2026-10-09";
  const [a, b] = await db.insert(organization).values([{ name: "Procurement A", slug: "combined-a" },
    { name: "Procurement B", slug: "combined-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "combined-owner@example.test" },
    { email: "combined-reader@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Reader", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_combined_a", b: "dk_combined_b", viewer: "dk_combined_reader" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_combined" });
  const [supplier, foreign] = await db.insert(contact).values([{ organizationId: a.id, name: "Combined Supplier", type: "supplier" },
    { organizationId: b.id, name: "Foreign Supplier", type: "supplier" }]).returning();
  const [expense] = await db.insert(chartAccount).values({ organizationId: a.id, name: "Expense", code: "5000", type: "expense" }).returning();
  await db.insert(chartAccount).values([{ organizationId: a.id, name: "AP", code: "2100", type: "liability" },
    { organizationId: a.id, name: "Inventory", code: "1300", type: "asset" },
    { organizationId: a.id, name: "GRNI", code: "2150", type: "liability" }]);
  const [item] = await db.insert(inventoryItem).values({ organizationId: a.id, name: "Combined stock", code: "S" }).returning();
  const [store] = await db.insert(warehouse).values({ organizationId: a.id, name: "Store", code: "S" }).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (method: string, body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/fixture", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function json(response: Response, status = 200) {
    const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
  }
  const tally = async (id: string) => (await db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.id, id)))[0];
  const stock = async () => (await db.select().from(inventoryItem).where(eq(inventoryItem.id, item.id)))[0];
  // JSON text is produced by PostgreSQL before pg can round int64 business money.
  const snapshot = async () => (await db.execute(sql`select
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from purchase_requisition t) as requisitions,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from purchase_requisition_line t) as requisition_lines,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from purchase_order t) as orders,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from purchase_order_line t) as order_lines,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from goods_receipt t) as receipts,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from goods_receipt_line t) as receipt_lines,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from bill t) as bills,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from bill_line t) as bill_lines,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from debit_note t) as notes,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from debit_note_line t) as note_lines,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from payment t) as payments,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from payment_allocation t) as allocations,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from inventory_item t) as stock,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from warehouse_stock t) as warehouse_stock,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from inventory_cost_layer t) as layers,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from bill_purchase_order t) as links,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from procurement_settings t) as settings,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from journal_line t) as journal_lines,
    (select jsonb_agg(to_jsonb(t)::text order by t.id) from number_sequence t) as numbers,
    (select count(*)::text from journal_entry) as journals, (select count(*)::text from journal_line) as legs,
    (select count(*)::text from inventory_movement) as movements, (select count(*)::text from audit_log) as audits,
    (select count(*)::text from bulk_import_job) as jobs`)).rows;
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  try {
    // Settings saved through both transports govern the subsequently converted documents.
    await json(await settings(request("PATCH", { requireGrnBeforeBill: true, priceTolerancePercent: 500 })));
    const controls = (await ma.ok("update_procurement_settings", { blockOverBill: true })).procurementSettings;
    assert.equal(controls.priceTolerancePercent, 500); assert.equal(controls.requireGrnBeforeBill, true);
    assert.equal((await mb.ok("get_procurement_settings")).procurementSettings.requireGrnBeforeBill, false);

    // Requisition -> PO -> nonstock GRN -> recognized bill -> supplier credit -> reversal.
    const input = { contactId: supplier.id, requestDate: date,
      lines: [{ description: "Services", quantity: 2, unitPrice: 12.5, unitPriceExact: "12.50", accountId: expense.id }] };
    const requisition = (await json(await createRequisition(request("POST", input)), 201)).requisition;
    assert.equal(requisition.totalMinor, "2500");
    await ma.ok("submit_purchase_requisition", { requisitionId: requisition.id });
    await ma.ok("approve_purchase_requisition", { requisitionId: requisition.id });
    const order = (await json(await convertRequisition(request("POST"), params(requisition.id)), 201)).purchaseOrder;
    assert.equal(order.totalMinor, "2500");
    await ma.ok("send_purchase_order", { purchaseOrderId: order.id });
    const ol = (await json(await getOrder(request("GET"), params(order.id)))).purchaseOrder.lines[0];
    const receipt = (await ma.ok("receive_goods_receipt", { purchaseOrderId: order.id, date,
      lines: [{ purchaseOrderLineId: ol.id, quantityExact: "2.00" }] })).goodsReceipt;
    assert.equal(receipt.lines[0].quantityReceived, 200); assert.equal(receipt.lines[0].unitCostMinor, "1250");
    const draft = (await json(await convertGoods(request("POST"), params(receipt.id)), 201)).bill;
    assert.equal(draft.totalMinor, order.totalMinor);
    await unchanged(async () => {
      assert.equal((await editOrder(request("PATCH", { notes: "Blocked linked edit" }), params(order.id))).status, 400);
      assert.equal((await mb.call("get_bill", { billId: draft.id })).body.status, 404);
      assert.equal((await getBill(request("GET", undefined, keys.b), params(draft.id))).status, 404);
      assert.equal((await receiveBill(request("POST", undefined, keys.viewer), params(draft.id))).status, 403);
      assert.equal((await ro.call("receive_bill", { billId: draft.id })).body.status, 403);
    });
    await json(await receiveBill(request("POST"), params(draft.id)));
    assert.equal((await tally(ol.id)).quantityBilled, 200);
    const note = (await json(await createDebit(request("POST", { contactId: supplier.id, billId: draft.id, issueDate: date,
      lines: [{ description: "Supplier allowance", unitPrice: 5, unitPriceMinor: "500", accountId: expense.id }] })), 201)).debitNote;
    const noteInput = { contactId: supplier.id, issueDate: date,
      lines: [{ description: "MCP minor-unit legacy price", unitPrice: 500, unitPriceExact: "5.00", accountId: expense.id }] };
    const mcpNote = (await ma.ok("create_debit_note", noteInput)).debitNote;
    assert.equal(mcpNote.totalMinor, note.totalMinor);
    await ma.ok("delete_debit_note", { debitNoteId: mcpNote.id });
    await unchanged(async () => {
      for (const [name, args] of [["create_debit_note", noteInput], ["list_debit_notes", {}],
        ["update_debit_note", { debitNoteId: note.id }], ["apply_debit_note", { debitNoteId: note.id, billId: draft.id, amountMinor: "500" }]] as const)
        assert.equal((await ma.call(name, { ...args, unsupportedControl: true })).isError, true);
    });
    await db.update(goodsReceipt).set({ organizationId: b.id }).where(eq(goodsReceipt.id, receipt.id));
    await unchanged(async () => {
      assert.equal((await sendDebit(request("POST"), params(note.id))).status, 422);
      assert.equal((await ma.call("send_debit_note", { debitNoteId: note.id })).body.status, 422);
    });
    await db.update(goodsReceipt).set({ organizationId: a.id }).where(eq(goodsReceipt.id, receipt.id));
    await db.execute(sql`create function reject_combined_debit_audit() returns trigger language plpgsql as $$
      begin if new.entity_type = 'debit_note' and new.action = 'send' then raise exception 'fixture audit failure'; end if; return new; end $$`);
    await db.execute(sql`create trigger reject_combined_debit_audit before insert on audit_log
      for each row execute function reject_combined_debit_audit()`);
    try {
      await unchanged(async () => {
        assert.equal((await sendDebit(request("POST"), params(note.id))).status, 500);
        assert.equal((await ma.call("send_debit_note", { debitNoteId: note.id })).isError, true);
      });
    } finally {
      await db.execute(sql`drop trigger reject_combined_debit_audit on audit_log`);
      await db.execute(sql`drop function reject_combined_debit_audit()`);
    }
    await ma.ok("send_debit_note", { debitNoteId: note.id });
    const applied = await json(await applyDebit(request("POST", { billId: draft.id, amount: 500, amountMinor: "500" }), params(note.id)));
    assert.equal(applied.bill.amountDueMinor, "2000"); assert.equal(applied.bill.amountPaidMinor, "500");
    await unchanged(async () => { assert.equal((await voidBill(request("POST"), params(draft.id))).status, 400); });
    await ma.ok("void_debit_note", { debitNoteId: note.id });
    assert.equal((await ma.ok("get_bill", { billId: draft.id })).bill.amountDueMinor, "2500");
    await json(await voidBill(request("POST"), params(draft.id)));
    assert.equal((await tally(ol.id)).quantityBilled, 0);
    const retry = (await ma.ok("create_bill_from_goods_receipt", { goodsReceiptId: receipt.id })).bill;
    await ma.ok("receive_bill", { billId: retry.id });
    assert.equal((await tally(ol.id)).quantityBilled, 200);

    // Stock uses the other conversion entry point: receipt accrual clears once, void releases the reservation.
    const stockOrder = (await ma.ok("create_purchase_order", { contactId: supplier.id, issueDate: date,
      lines: [{ description: "Stock", quantity: 2, unitPriceMinor: "1250", inventoryItemId: item.id, warehouseId: store.id }] })).purchaseOrder;
    await ma.ok("send_purchase_order", { purchaseOrderId: stockOrder.id });
    const sl = (await ma.ok("get_purchase_order", { purchaseOrderId: stockOrder.id })).purchaseOrder.lines[0];
    const stockReceipt = (await json(await receiveGoods(request("POST", { purchaseOrderId: stockOrder.id, date,
      lines: [{ purchaseOrderLineId: sl.id, quantity: 2, quantityExact: "2.00" }] })), 201)).goodsReceipt;
    assert.equal((await stock()).quantityOnHand, 2); assert.equal((await stock()).totalValue, 2500);
    const stockBill = (await json(await convertOrder(request("POST"), params(stockOrder.id)), 201)).bill;
    const linked = await db.select().from(billLine).where(eq(billLine.billId, stockBill.id));
    assert.equal(linked[0].goodsReceiptLineId, stockReceipt.lines[0].id);
    await unchanged(async () => {
      assert.equal((await convertGoods(request("POST"), params(stockReceipt.id))).status, 400);
      assert.equal((await ma.call("create_bill_from_goods_receipt", { goodsReceiptId: stockReceipt.id })).isError, true);
    });
    await ma.ok("receive_bill", { billId: stockBill.id });
    assert.equal((await tally(sl.id)).quantityBilled, 200);
    assert.equal((await stock()).quantityOnHand, 2); assert.equal((await stock()).totalValue, 2500);
    await ma.ok("void_bill", { billId: stockBill.id });
    assert.equal((await tally(sl.id)).quantityBilled, 0); assert.equal((await stock()).quantityOnHand, 2);

    // A GRN-created draft must also exclude overlapping PO conversion, in the reverse operation order.
    const fromGrn = (await ma.ok("create_bill_from_goods_receipt", { goodsReceiptId: stockReceipt.id })).bill;
    await unchanged(async () => {
      assert.ok((await convertOrder(request("POST"), params(stockOrder.id))).status >= 400);
      assert.equal((await ma.call("convert_po_to_bill", { purchaseOrderId: stockOrder.id })).isError, true);
    });
    await ma.ok("receive_bill", { billId: fromGrn.id });
    assert.equal((await stock()).quantityOnHand, 2); assert.equal((await tally(sl.id)).quantityBilled, 200);
    await ma.ok("void_bill", { billId: fromGrn.id });

    // A mixed REST/MCP race has one conversion winner even without match controls.
    await ma.ok("update_procurement_settings", { requireGrnBeforeBill: false, blockOverBill: false });
    await unchanged(async () => {
      assert.equal((await ma.call("convert_po_to_bill", { purchaseOrderId: stockOrder.id, unsupportedControl: true })).isError, true);
      assert.equal((await ma.call("receive_goods_receipt", { purchaseOrderId: stockOrder.id, date,
        lines: [{ purchaseOrderLineId: sl.id, quantity: 1 }], unsupportedControl: true })).isError, true);
    });
    const raced = await Promise.all([convertOrder(request("POST"), params(stockOrder.id)),
      ma.call("create_bill_from_goods_receipt", { goodsReceiptId: stockReceipt.id })]);
    const restBody = await raced[0].json();
    assert.equal(Number(raced[0].status === 201) + Number(!raced[1].isError), 1);
    const winner = raced[0].status === 201 ? restBody.bill : raced[1].body.bill;
    await ma.ok("receive_bill", { billId: winner.id });
    assert.equal((await stock()).quantityOnHand, 2); assert.equal((await stock()).totalValue, 2500);
    assert.equal((await tally(sl.id)).quantityBilled, 200);
    await ma.ok("void_bill", { billId: winner.id });

    // Currency scales and a safe above-int32 value survive bulk/CRUD/read consumers without rescaling.
    for (const [currencyCode, unitPriceExact] of [["USD", "12.50"], ["JPY", "1250"], ["KWD", "1.250"]]) {
      const row = (await ma.ok("create_bill", { contactId: supplier.id, issueDate: date, dueDate: date, currencyCode,
        lines: [{ description: "Currency", unitPriceExact, accountId: expense.id }] })).bill;
      assert.equal(row.totalMinor, "1250");
      assert.equal((await json(await getBill(request("GET"), params(row.id)))).bill.lines[0].unitPriceMinor, "1250");
      await ma.ok("delete_bill", { billId: row.id });
    }
    const rows = [{ contactName: supplier.name, issueDate: date, dueDate: date, lineDescription: "Imported", lineUnitPriceMinor: "2147483648", lineAccountCode: "5000" }];
    assert.equal((await ma.ok("preview_bill_import", { rows })).validCount, 1);
    const beforeIds = new Set((await db.select({ id: bill.id }).from(bill)).map(row => row.id));
    const job = (await json(await importBills(request("POST", { fileName: "combined.csv", rows })), 201)).job;
    assert.equal(job.processedRows, 1); assert.equal(job.errorRows, 0);
    const imported = (await db.select().from(bill)).find(row => !beforeIds.has(row.id))!;
    assert.equal((await ma.ok("get_bill", { billId: imported.id })).bill.totalMinor, "2147483648");
    await ma.ok("update_bill", { billId: imported.id, notes: "Imported draft edited" });
    assert.equal((await ma.ok("get_bill_counts")).counts.draft.amountMinor, "2147483648");
    await unchanged(async () => {
      assert.equal((await ma.call("create_bill", { contactId: foreign.id, issueDate: date, dueDate: date, lines: [{ description: "Foreign", unitPriceMinor: "1250" }] })).isError, true);
      assert.equal((await ma.call("import_bills", { fileName: "bad.csv", rows: [{ ...rows[0], lineUnitPrice: 12.5 }] })).isError, true);
    });
    await db.execute(sql`update bill set total = 9007199254740992 where id = ${imported.id}`);
    await unchanged(async () => {
      assert.equal((await getBill(request("GET"), params(imported.id))).status, 422);
      assert.equal((await ma.call("get_bill", { billId: imported.id })).body.status, 422);
      assert.equal((await ma.call("update_bill", { billId: imported.id, notes: "Unsafe history" })).isError, true);
    });

    // Every actual journal remains exactly balanced after recognition/credit/void/retry.
    const imbalance = await db.execute(sql`select journal_entry_id from journal_line group by journal_entry_id having sum(debit_amount::numeric) <> sum(credit_amount::numeric)`);
    assert.equal(imbalance.rows.length, 0);
    assert.ok((await db.select().from(journalLine)).length > 0);
    const balances = await db.execute(sql`select a.code, sum(l.debit_amount::numeric - l.credit_amount::numeric)::text as balance
      from journal_line l join chart_account a on a.id = l.account_id join journal_entry j on j.id = l.journal_entry_id
      where j.organization_id = ${a.id} and j.status = 'posted' group by a.code`);
    const byCode = new Map(balances.rows.map(row => [row.code, row.balance]));
    assert.equal(byCode.get("5000"), "2500"); assert.equal(byCode.get("2100"), "-2500");
    assert.equal(byCode.get("1300"), "2500"); assert.equal(byCode.get("2150"), "-2500");
    console.log("Combined payable/procurement contracts verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); mock.timers.reset(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
