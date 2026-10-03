// Runs only in bill-writes.test.ts's randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate,
  bill, billLine, billPurchaseOrder, purchaseOrder, goodsReceipt, goodsReceiptLine, inventoryItem,
  warehouse, project, periodLock, fiscalYear, numberSequence } from "../../lib/db/schema";
import { POST } from "../../app/api/v1/bills/route";
import { PATCH, DELETE } from "../../app/api/v1/bills/[id]/route";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bill writes fixture", version: "1.0.0" });
  registerBillTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some(tool => tool.name === "get_bill"));
  assert.ok(tools.some(tool => tool.name === "update_bill"));
  const schema = tools.find(tool => tool.name === "list_bills")!.inputSchema;
  assert.ok(JSON.stringify(schema).includes("pending_approval"));
  assert.ok(JSON.stringify(schema).includes("Bills per page"));
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
  const [a, b] = await db.insert(organization).values([{ name: "Bill write A", slug: "bill-write-a" },
    { name: "Bill write B", slug: "bill-write-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "bw-owner@example.test" }, { email: "bw-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_bw_a", b: "dk_bw_b", viewer: "dk_bw_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bw" });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "supplier" },
    { organizationId: b.id, name: "B", type: "supplier" }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Expense", code: "500", type: "expense" },
    { organizationId: b.id, name: "Expense", code: "500", type: "expense" }]).returning();
  const [tax, reverse, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Normal", rate: 1000 },
    { organizationId: a.id, name: "RC", rate: 1000, kind: "reverse_charge" }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const [item, foreignItem] = await db.insert(inventoryItem).values([{ organizationId: a.id, name: "Item", code: "A" },
    { organizationId: b.id, name: "Item", code: "B" }]).returning();
  const [store, foreignStore] = await db.insert(warehouse).values([{ organizationId: a.id, name: "Store", code: "A" },
    { organizationId: b.id, name: "Store", code: "B" }]).returning();
  const [job, foreignJob] = await db.insert(project).values([{ organizationId: a.id, name: "Job" }, { organizationId: b.id, name: "Job" }]).returning();
  const [po, foreignPo] = await db.insert(purchaseOrder).values([{ organizationId: a.id, contactId: supplier.id, poNumber: "PO-A", issueDate: "2026-10-01" },
    { organizationId: b.id, contactId: foreignSupplier.id, poNumber: "PO-B", issueDate: "2026-10-01" }]).returning();
  const [grn, foreignGrn] = await db.insert(goodsReceipt).values([{ organizationId: a.id, contactId: supplier.id, receiptNumber: "GRN-A", date: "2026-10-01" },
    { organizationId: b.id, contactId: foreignSupplier.id, receiptNumber: "GRN-B", date: "2026-10-01" }]).returning();
  const [grnLine, foreignGrnLine] = await db.insert(goodsReceiptLine).values([{ goodsReceiptId: grn.id, description: "Item" },
    { goodsReceiptId: foreignGrn.id, description: "Item" }]).returning();
  const request = (method: string, body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/bills", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const post = (body: unknown, key = keys.a) => POST(request("POST", body, key));
  const patch = (id: string, body: unknown, key = keys.a) => PATCH(request("PATCH", body, key), params(id));
  const del = (id: string, key = keys.a) => DELETE(request("DELETE", undefined, key), params(id));
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill i) as bills,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill_line i) as lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill_purchase_order i) as links,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from number_sequence i) as numbering,
    (select count(*)::text from audit_log) as audits,
    (select count(*)::text from journal_entry) as journals,
    (select count(*)::text from payment_allocation) as allocations,
    (select count(*)::text from inventory_movement) as movements`)).rows;
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const basic = { contactId: supplier.id, issueDate: "2026-10-03", dueDate: "2026-10-31", lines: [{ description: "Item", unitPrice: 12.5 }] };
  try {
    // Real legacy and exact consumers observe the same units and aliases.
    let editable = "";
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" },
      { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const input = { ...basic, lines: [{ description: "Item", ...price }] };
      const response = await post(input); assert.equal(response.status, 201);
      const rest = (await response.json()).bill, m = await ma.call("create_bill", input);
      assert.equal(m.isError, false); assert.equal(rest.total, 1250); assert.equal(rest.totalMinor, "1250");
      assert.equal(rest.organizationId, a.id); assert.equal(m.body.bill.totalMinor, rest.totalMinor);
      assert.equal(rest.amountPaidMinor, "0"); editable = rest.id;
      const lines = await db.query.billLine.findMany({ where: eq(billLine.billId, rest.id) });
      assert.equal(lines[0].unitPrice, 1250); assert.equal(lines[0].quantity, 100);
      assert.equal((await (await patch(rest.id, { lines: input.lines })).json()).bill.totalMinor, "1250");
      assert.equal((await ma.call("update_bill", { billId: rest.id, lines: input.lines })).body.bill.totalMinor, "1250");
      const audit = (await db.execute(sql`select action, organization_id from audit_log where entity_id = ${rest.id} order by created_at`)).rows;
      assert.deepEqual(audit.map(row => row.action), ["create", "update", "update"]);
      assert.ok(audit.every(row => row.organization_id === a.id));
    }
    for (const amount of ["2147483648", String(Number.MAX_SAFE_INTEGER), "-1250"]) {
      const input = { ...basic, lines: [{ description: "Range", unitPriceMinor: amount }] };
      const created = (await (await post(input)).json()).bill;
      assert.equal(created.totalMinor, amount);
      assert.equal((await ma.call("create_bill", input)).body.bill.totalMinor, amount);
      assert.equal((await (await patch(created.id, { lines: input.lines })).json()).bill.totalMinor, amount);
      assert.equal((await ma.call("update_bill", { billId: created.id, lines: input.lines })).body.bill.totalMinor, amount);
    }
    const linked = await (await post({ ...basic, purchaseOrderIds: [po.id, po.id], lines: [{ description: "Linked", quantity: 1.5,
      unitPriceMinor: "1250", discountPercent: 1000, taxRateId: tax.id, inventoryItemId: item.id, warehouseId: store.id,
      projectId: job.id, goodsReceiptLineId: grnLine.id, accountId: account.id }] })).json();
    assert.equal(linked.bill.totalMinor, "1856"); assert.equal(linked.bill.amountDueMinor, "1856");
    const saved = await db.query.billLine.findFirst({ where: eq(billLine.billId, linked.bill.id) });
    assert.equal(saved!.quantity, 150); assert.equal(saved!.goodsReceiptLineId, grnLine.id); assert.equal(saved!.projectId, job.id);
    assert.equal((await db.select().from(billPurchaseOrder).where(eq(billPurchaseOrder.billId, linked.bill.id))).length, 1);
    const ml = await ma.call("create_bill", { ...basic, purchaseOrderIds: [po.id], lines: [{ description: "Linked", goodsReceiptLineId: grnLine.id, unitPrice: 12.5 }] });
    assert.equal(ml.isError, false);
    const rcInput = { ...basic, lines: [{ description: "RC", unitPriceMinor: "1250", taxRateId: reverse.id }] };
    for (const row of [(await (await post(rcInput)).json()).bill, (await ma.call("create_bill", rcInput)).body.bill]) {
      assert.equal(row.totalMinor, "1375"); assert.equal(row.amountDueMinor, "1250");
      const changed = await (await patch(row.id, { lines: rcInput.lines })).json();
      assert.equal(changed.bill.amountDueMinor, "1250");
      const changedM = await ma.call("update_bill", { billId: row.id, lines: rcInput.lines });
      assert.equal(changedM.body.bill.amountDueMinor, "1250");
    }
    assert.equal((await (await patch(editable, { notes: "Edited", contactId: supplier.id, total: 99, status: "paid" })).json()).bill.totalMinor, "1250");
    assert.equal((await ma.call("update_bill", { billId: editable, lines: [{ description: "Half cent", quantity: 3, unitPriceExact: "0.005" }] })).body.bill.totalMinor, "2");
    assert.equal((await ma.call("update_bill", { billId: editable, lines: [{ description: "Default" }] })).body.bill.totalMinor, "0");
    await db.update(contact).set({ currencyCode: "JPY" }).where(eq(contact.id, supplier.id));
    assert.equal((await (await post({ ...basic, lines: [{ description: "JPY", unitPrice: 1250 }] })).json()).bill.totalMinor, "1250");
    assert.equal((await ma.call("create_bill", basic)).body.bill.currencyCode, "USD");
    assert.equal((await (await post({ ...basic, currencyCode: "KWD", lines: [{ description: "KWD", unitPriceExact: "1.250" }] })).json()).bill.totalMinor, "1250");
    await db.update(contact).set({ currencyCode: "USD" }).where(eq(contact.id, supplier.id));
    const foreign = (await mb.call("create_bill", { ...basic, contactId: foreignSupplier.id })).body.bill;
    await unchanged(async () => {
      assert.equal((await patch(foreign.id, { notes: "Unauthorized" })).status, 404); assert.equal((await del(foreign.id)).status, 404);
      assert.equal((await mb.call("update_bill", { billId: editable, notes: "Unauthorized" })).body.status, 404);
      assert.equal((await mb.call("delete_bill", { billId: editable })).body.status, 404);
      assert.equal((await post(basic, keys.viewer)).status, 403); assert.equal((await patch(editable, {}, keys.viewer)).status, 403); assert.equal((await del(editable, keys.viewer)).status, 403);
      for (const name of ["create_bill", "update_bill", "delete_bill"]) assert.equal((await ro.call(name, { ...basic, billId: editable })).isError, true);
      assert.equal((await post(basic, "dk_invalid")).status, 401); assert.equal((await patch(editable, {}, "dk_invalid")).status, 401); assert.equal((await del(editable, "dk_invalid")).status, 401);
      assert.equal((await post({ ...basic, contactId: foreignSupplier.id })).status, 400);
      assert.equal((await ma.call("create_bill", { ...basic, contactId: foreignSupplier.id })).isError, true);
      assert.equal((await patch(editable, { contactId: foreignSupplier.id })).status, 400);
    });
    for (const [field, id] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id], ["inventoryItemId", foreignItem.id],
      ["warehouseId", foreignStore.id], ["projectId", foreignJob.id], ["goodsReceiptLineId", foreignGrnLine.id]] as const) {
      const lines = [{ description: "Foreign", unitPriceMinor: "1", [field]: id }];
      await unchanged(async () => {
        assert.equal((await post({ ...basic, lines })).status, 400); assert.equal((await patch(editable, { lines })).status, 400);
        assert.equal((await ma.call("create_bill", { ...basic, lines })).isError, true);
        assert.equal((await ma.call("update_bill", { billId: editable, lines })).isError, true);
      });
    }
    await unchanged(async () => { assert.equal((await post({ ...basic, purchaseOrderIds: [foreignPo.id] })).status, 400);
      assert.equal((await ma.call("create_bill", { ...basic, purchaseOrderIds: [foreignPo.id] })).isError, true); });
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, account.id));
    assert.equal((await patch(linked.bill.id, { notes: "Retain inactive history" })).status, 200);
    await unchanged(async () => { assert.equal((await post({ ...basic, lines: [{ description: "Inactive", accountId: account.id }] })).status, 400); });
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, account.id));
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, supplier.id));
    assert.equal((await patch(editable, { notes: "Retain deleted supplier history" })).status, 200);
    await unchanged(async () => { assert.equal((await post(basic)).status, 400); assert.equal((await ma.call("create_bill", basic)).isError, true); });
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, supplier.id));
    await db.update(billLine).set({ accountId: foreignAccount.id }).where(eq(billLine.billId, editable));
    await unchanged(async () => { assert.equal((await patch(editable, { lines: basic.lines })).status, 400); assert.equal((await del(editable)).status, 400);
      assert.equal((await ma.call("update_bill", { billId: editable, lines: basic.lines })).isError, true); });
    await db.update(billLine).set({ accountId: null }).where(eq(billLine.billId, editable));
    // Duplicate strategies and concurrency use the shared organization lock.
    const duplicate = { ...basic, billNumber: "  SUP-INV-001  " };
    const first = (await (await post(duplicate)).json()).bill;
    await unchanged(async () => {
      const warning = await post(duplicate); assert.equal(warning.status, 409); const body = await warning.json();
      assert.equal(body.warning, "duplicate_bill"); assert.equal(body.duplicate.id, first.id);
      assert.equal((await ma.call("create_bill", duplicate)).body.status, 409);
    });
    assert.equal((await post({ ...duplicate, confirmDuplicate: true })).status, 201);
    await db.update(organization).set({ duplicateBillStrategy: "block" }).where(eq(organization.id, a.id));
    await unchanged(async () => { assert.equal((await post({ ...duplicate, confirmDuplicate: true })).status, 409);
      assert.equal((await ma.call("create_bill", { ...duplicate, confirmDuplicate: true })).body.status, 409); });
    const blockedRace = await Promise.all(Array.from({ length: 3 }, () => post({ ...basic, billNumber: "RACE" })));
    assert.deepEqual(blockedRace.map(r => r.status).sort(), [201, 409, 409]);
    const voidedDuplicate = (await (await post({ ...basic, billNumber: "IGNORE-VOID" })).json()).bill;
    await db.update(bill).set({ status: "void" }).where(eq(bill.id, voidedDuplicate.id));
    assert.equal((await post({ ...basic, billNumber: "IGNORE-VOID" })).status, 201);
    const deletedDuplicate = (await (await post({ ...basic, billNumber: "IGNORE-DELETE" })).json()).bill;
    assert.equal((await del(deletedDuplicate.id)).status, 200);
    assert.equal((await ma.call("create_bill", { ...basic, billNumber: "IGNORE-DELETE" })).isError, false);
    await db.update(organization).set({ duplicateBillStrategy: "hold" }).where(eq(organization.id, a.id));
    const held = await (await post(duplicate)).json(); assert.equal(held.held, true); assert.equal(held.bill.status, "pending_approval");
    assert.equal((await ma.call("create_bill", duplicate)).body.held, true);
    await db.update(organization).set({ duplicateBillStrategy: "off" }).where(eq(organization.id, a.id));
    assert.equal((await ma.call("create_bill", duplicate)).body.bill.status, "draft");
    const pending = (await ma.call("create_bill", { ...basic, submitForApproval: true })).body.bill;
    assert.equal(pending.status, "pending_approval");
    assert.equal((await (await post({ ...basic, submitForApproval: true })).json()).bill.status, "pending_approval");
    await unchanged(async () => { assert.equal((await patch(pending.id, {})).status, 400); assert.equal((await del(pending.id)).status, 400);
      assert.equal((await ma.call("update_bill", { billId: pending.id, notes: "Blocked" })).body.status, 400); });
    // Strict period checks cover old and replacement dates, and closed years.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-02" }).returning();
    await unchanged(async () => { assert.equal((await post({ ...basic, issueDate: "2026-10-02" })).status, 422);
      assert.equal((await patch(editable, { issueDate: "2026-10-02" })).status, 422); });
    await db.update(periodLock).set({ lockDate: "2026-10-03" }).where(eq(periodLock.id, lock.id));
    await unchanged(async () => { assert.equal((await patch(editable, { issueDate: "2026-10-04" })).status, 422);
      assert.equal((await del(editable)).status, 422); assert.equal((await ma.call("delete_bill", { billId: editable })).body.status, 422); });
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    await unchanged(async () => { assert.equal((await post(basic)).status, 422); assert.equal((await ma.call("create_bill", basic)).body.status, 422); });
    await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    for (const lines of [[{ description: "Unsafe", unitPriceMinor: "9007199254740992" }],
      [{ description: "Product", unitPriceMinor: String(Number.MAX_SAFE_INTEGER), quantity: 2, discountPercent: 10000 }],
      [{ description: "Tax", unitPriceMinor: String(Number.MAX_SAFE_INTEGER), taxRateId: tax.id }],
      [{ description: "Sum", unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }, { description: "Sum", unitPriceMinor: "1" }]]) {
      await unchanged(async () => { assert.equal((await post({ ...basic, lines })).status, 422); assert.equal((await patch(editable, { lines })).status, 422);
        assert.equal((await ma.call("create_bill", { ...basic, lines })).body.status, 422); assert.equal((await ma.call("update_bill", { billId: editable, lines })).body.status, 422); });
    }
    await unchanged(async () => { assert.equal((await post({ ...basic, issueDate: "2026-02-30" })).status, 400);
      assert.equal((await post({ ...basic, lines: [{ description: "Conflict", unitPrice: 12.5, unitPriceMinor: "12" }] })).status, 400);
      assert.equal((await patch(editable, { lines: [] })).status, 400); assert.equal((await del("malformed")).status, 400); });
    await db.execute(sql`update bill set total = 9007199254740992 where id = ${editable}`);
    await unchanged(async () => { assert.equal((await patch(editable, {})).status, 422); assert.equal((await del(editable)).status, 422); });
    await db.update(bill).set({ total: 0 }).where(eq(bill.id, editable));
    await db.execute(sql`update bill_line set amount = 9007199254740992 where bill_id = ${editable}`);
    await unchanged(async () => { assert.equal((await patch(editable, { lines: basic.lines })).status, 422); assert.equal((await del(editable)).status, 422); });
    await db.update(billLine).set({ amount: 0 }).where(eq(billLine.billId, editable));
    await db.update(bill).set({ amountPaid: 1 }).where(eq(bill.id, editable));
    await unchanged(async () => { assert.equal((await patch(editable, {})).status, 400); assert.equal((await del(editable)).status, 400); });
    await db.update(bill).set({ amountPaid: 0 }).where(eq(bill.id, editable));
    // Fault injection verifies whole-operation rollback, including transactional audit.
    await db.execute(sql`alter table bill_line add constraint fixture_reject_line check (description <> 'ROLLBACK')`);
    await unchanged(async () => { assert.equal((await post({ ...basic, lines: [{ description: "ROLLBACK", unitPrice: 1 }] })).status, 500);
      assert.equal((await patch(editable, { lines: [{ description: "ROLLBACK", unitPrice: 1 }] })).status, 500);
      assert.equal((await ma.call("update_bill", { billId: editable, lines: [{ description: "ROLLBACK" }] })).isError, true); });
    await db.execute(sql`alter table bill_line drop constraint fixture_reject_line`);
    await db.execute(sql`alter table bill_purchase_order add constraint fixture_reject_link check (false) not valid`);
    await unchanged(async () => { assert.equal((await post({ ...basic, purchaseOrderIds: [po.id] })).status, 500); });
    await db.execute(sql`alter table bill_purchase_order drop constraint fixture_reject_link`);
    await db.execute(sql`alter table audit_log add constraint fixture_reject_audit check (entity_type <> 'bill') not valid`);
    await unchanged(async () => { assert.equal((await post(basic)).status, 500); assert.equal((await patch(editable, { notes: "Rollback" })).status, 500);
      assert.equal((await del(editable)).status, 500); assert.equal((await ma.call("delete_bill", { billId: editable })).isError, true); });
    await db.execute(sql`alter table audit_log drop constraint fixture_reject_audit`);
    await db.execute(sql`alter table bill add constraint fixture_reject_delete check (deleted_at is null) not valid`);
    await unchanged(async () => { assert.equal((await del(editable)).status, 500); });
    await db.execute(sql`alter table bill drop constraint fixture_reject_delete`);
    const parallel = await Promise.all(Array.from({ length: 3 }, () => ma.call("create_bill", basic)));
    assert.ok(parallel.every(r => !r.isError)); assert.equal(new Set(parallel.map(r => r.body.bill.billNumber)).size, 3);
    await db.delete(numberSequence).where(eq(numberSequence.organizationId, b.id));
    await db.delete(bill).where(eq(bill.organizationId, b.id));
    const firstParallel = await Promise.all(Array.from({ length: 3 }, () => mb.call("create_bill", { ...basic, contactId: foreignSupplier.id })));
    assert.deepEqual(firstParallel.map(r => r.body.bill.billNumber).sort(), ["BILL-00001", "BILL-00002", "BILL-00003"]);
    assert.equal((await mb.call("create_bill", { ...basic, contactId: foreignSupplier.id, billNumber: "BILL-00005" })).isError, false);
    assert.equal((await mb.call("create_bill", { ...basic, contactId: foreignSupplier.id })).body.bill.billNumber, "BILL-00006");
    await db.update(numberSequence).set({ lastNumber: 2147483647 }).where(eq(numberSequence.organizationId, b.id));
    await unchanged(async () => { assert.equal((await mb.call("create_bill", { ...basic, contactId: foreignSupplier.id })).isError, true); });
    assert.equal((await del(editable)).status, 200);
    await unchanged(async () => { assert.equal((await del(editable)).status, 404); assert.equal((await ma.call("update_bill", { billId: editable, notes: "Deleted" })).body.status, 404); });
    assert.equal((await ma.call("delete_bill", { billId: linked.bill.id })).body.success, true);
    assert.equal((await db.select().from(billPurchaseOrder).where(eq(billPurchaseOrder.billId, linked.bill.id))).length, 1);
    assert.equal((await db.query.billLine.findMany({ where: eq(billLine.billId, linked.bill.id) })).length, 0);
    const counts = (await db.execute(sql`select (select count(*) from journal_entry)::text as journals,
      (select count(*) from inventory_movement)::text as stock, (select count(*) from payment_allocation)::text as allocations`)).rows[0];
    assert.deepEqual(counts, { journals: "0", stock: "0", allocations: "0" });
    console.log("REST and MCP bill writes verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
