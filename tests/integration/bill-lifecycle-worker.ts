// Only run in the randomly named migrated disposable DB supplied by the harness.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql, and } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, bill, billLine, journalEntry, journalLine,
  inventoryItem, inventoryMovement, inventoryCostLayer, warehouse, warehouseStock, purchaseOrder, purchaseOrderLine,
  goodsReceipt, goodsReceiptLine, procurementSettings, periodLock, fiscalYear, exchangeRate, approvalWorkflow,
  approvalWorkflowStep, approvalRequest } from "../../lib/db/schema";
import { POST as createGoodsReceipt } from "../../app/api/v1/goods-receipts/route";
import { POST as pay } from "../../app/api/v1/bills/[id]/pay/route";
import { POST as create } from "../../app/api/v1/bills/route";
import { POST as receive } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as approve } from "../../app/api/v1/bills/[id]/approve/route";
import { POST as reject } from "../../app/api/v1/bills/[id]/reject/route";
import { POST as voidRoute } from "../../app/api/v1/bills/[id]/void/route";
import { POST as requestAction } from "../../app/api/v1/approval-requests/[id]/action/route";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { registerApprovalTools } from "../../lib/mcp/tools/approvals";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bill lifecycle fixture", version: "1.0.0" });
  registerBillTools(server, ctx); registerApprovalTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const listed = (await client.listTools()).tools;
  for (const name of ["receive_bill", "approve_bill", "reject_bill", "void_bill"])
    assert.ok(listed.find(tool => tool.name === name)?.inputSchema);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Lifecycle A", slug: "bl-a" }, { name: "Lifecycle B", slug: "bl-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "bl-owner@example.test" }, { email: "bl-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  const [ownerMember, viewerMember] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }, { organizationId: b.id, userId: owner.id, role: "owner" }]).returning();
  const keys = { a: "dk_bl_a", b: "dk_bl_b", viewer: "dk_bl_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bl" });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "Supplier", type: "supplier" },
    { organizationId: b.id, name: "Foreign supplier", type: "supplier" }]).returning();
  const [expense, ap, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "500", name: "Expense", type: "expense" },
    { organizationId: a.id, code: "2100", name: "AP", type: "liability" }, { organizationId: b.id, code: "500", name: "Foreign", type: "expense" }]).returning();
  const [standard, partial, reverse] = await db.insert(taxRate).values([{ organizationId: a.id, name: "VAT", rate: 1000 },
    { organizationId: a.id, name: "Partial", rate: 1000, recoverablePercent: 5000 },
    { organizationId: a.id, name: "Reverse", rate: 1000, kind: "reverse_charge", recoverablePercent: 5000 }]).returning();
  const [store] = await db.insert(warehouse).values({ organizationId: a.id, code: "A", name: "Store" }).returning();
  const [item, fifo] = await db.insert(inventoryItem).values([{ organizationId: a.id, code: "A", name: "Average" },
    { organizationId: a.id, code: "F", name: "FIFO", costMethod: "fifo" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/bills", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const basic = { contactId: supplier.id, currencyCode: "USD", issueDate: "2026-10-03", dueDate: "2026-10-31",
    lines: [{ description: "Expense", unitPriceMinor: "1250", accountId: expense.id }] };
  async function draft(patch: Record<string, unknown> = {}) {
    const response = await create(request({ ...basic, ...patch })); assert.equal(response.status, 201); return (await response.json()).bill;
  }
  const tables = ["bill", "bill_line", "journal_entry", "journal_line", "inventory_item", "inventory_movement", "inventory_cost_layer", "warehouse_stock",
    "purchase_order_line", "goods_receipt", "goods_receipt_line", "audit_log", "approval_request", "approval_action"];
  const snapshot = async () => Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(result => result.rows)));
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  const savedLegs = (id: string) => db.select({ account: journalLine.accountId, debit: sql<string>`${journalLine.debitAmount}::text`, credit: sql<string>`${journalLine.creditAmount}::text`,
    rate: sql<string>`${journalLine.rateExact}::text`, exchange: journalLine.exchangeRate, currency: journalLine.currencyCode }).from(journalLine).where(eq(journalLine.journalEntryId, id)).orderBy(journalLine.accountId, journalLine.debitAmount, journalLine.creditAmount);
  async function mirror(id: string) {
    const [reversal] = await db.select().from(journalEntry).where(eq(journalEntry.reversesEntryId, id)); assert.ok(reversal);
    const before = await savedLegs(id), after = await savedLegs(reversal.id);
    const normalize = (rows: typeof before, swap = false) => rows.map(row => ({ ...row, debit: swap ? row.credit : row.debit, credit: swap ? row.debit : row.credit })).sort((x,y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    assert.deepEqual(normalize(after), normalize(before, true));
  }
  try {
    // Actual handlers and registered SDK retain legacy/exact write clients and numeric envelopes.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" },
      { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const input = { ...basic, lines: [{ description: "Alias", accountId: expense.id, ...price }] };
      const rest = await create(request(input)), created = (await rest.json()).bill;
      const received = await receive(request(), params(created.id)); assert.equal(received.status, 200);
      const row = (await received.json()).bill; assert.equal(row.total, 1250); assert.equal(row.totalMinor, "1250"); assert.equal(row.organizationId, a.id);
      assert.ok(row.journalEntryId); assert.equal(row.status, "received");
      const mc = (await ma.call("create_bill", input)).body.bill, result = await ma.call("receive_bill", { billId: mc.id });
      assert.equal(result.isError, false); assert.equal(result.body.bill.totalMinor, row.totalMinor);
      const legs = await savedLegs(row.journalEntryId); assert.ok(legs.every(line => /^1(?:\.0+)?$/.test(line.rate) && line.currency === "USD"), JSON.stringify(legs));
      assert.equal(legs.reduce((s,l) => s + BigInt(l.debit), 0n), 1250n);
      assert.equal((await voidRoute(request(), params(row.id))).status, 200); await mirror(row.journalEntryId);
      assert.equal((await ma.call("void_bill", { billId: mc.id })).body.bill.amountDueMinor, "0");
    }
    for (const amount of ["2147483648", String(Number.MAX_SAFE_INTEGER)]) {
      const row = await draft({ lines: [{ description: "Large", unitPriceMinor: amount, accountId: expense.id }] });
      const result = await ma.call("receive_bill", { billId: row.id }); assert.equal(result.isError, false); assert.equal(result.body.bill.totalMinor, amount);
      assert.equal((await ma.call("void_bill", { billId: row.id })).isError, false); await mirror(result.body.bill.journalEntryId);
    }
    for (const tax of [standard, partial, reverse]) {
      const row = await draft({ lines: [{ description: "Tax", unitPriceMinor: "1250", accountId: expense.id, taxRateId: tax.id }] });
      const response = await receive(request(), params(row.id)); assert.equal(response.status, 200); const posted = (await response.json()).bill;
      const legs = await savedLegs(posted.journalEntryId); const apCredit = legs.filter(l => l.account === ap.id).reduce((s,l) => s + BigInt(l.credit)-BigInt(l.debit), 0n);
      assert.equal(apCredit, tax.id === reverse.id ? 1250n : 1375n); assert.equal(posted.amountDueMinor, apCredit.toString());
      assert.equal((await voidRoute(request(), params(row.id))).status, 200); await mirror(posted.journalEntryId);
    }
    // FX converts with currency scales and saves qualified aliases; void ignores newer live FX.
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "KWD", targetCurrency: "USD", date: "2026-10-01", rate: 3250000 });
    const fxBill = await draft({ currencyCode: "KWD" });
    const fxResult = await receive(request(), params(fxBill.id)); assert.equal(fxResult.status, 200); const fxPosted = (await fxResult.json()).bill;
    assert.equal((await savedLegs(fxPosted.journalEntryId)).reduce((s,l) => s + BigInt(l.debit), 0n), 406n);
    await db.update(exchangeRate).set({ rate: 4000000 }).where(eq(exchangeRate.organizationId, a.id));
    assert.equal((await voidRoute(request(), params(fxBill.id))).status, 200); await mirror(fxPosted.journalEntryId);
    const tinyStock = await draft({ currencyCode: "KWD", lines: [1,2].map(n => ({ description: `Tiny ${n}`, unitPriceMinor: "1", inventoryItemId: item.id })) });
    const tinyReceived = await receive(request(), params(tinyStock.id)); assert.equal(tinyReceived.status, 200); const tinyPosted = (await tinyReceived.json()).bill;
    const tinyMovements = await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, tinyStock.id));
    assert.equal(tinyMovements.reduce((s,m) => s + BigInt(m.value), 0n), 1n);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.totalValue, 1);
    assert.equal((await voidRoute(request(), params(tinyStock.id))).status, 200); await mirror(tinyPosted.journalEntryId);
    // Concurrent receives/voids serialize without duplicate journals/stock/audit.
    const concurrent = await draft(); const both = await Promise.all([receive(request(), params(concurrent.id)), receive(request(), params(concurrent.id))]);
    assert.deepEqual(both.map(r => r.status).sort(), [200,400]);
    const vb = await Promise.all([ma.call("void_bill", { billId: concurrent.id }), ma.call("void_bill", { billId: concurrent.id })]);
    assert.equal(vb.filter(r => !r.isError).length, 1);
    // Stock receipt and reversal preserve original GL value, whole-unit rounding and FIFO layers.
    for (const stock of [item, fifo]) {
      const row = await draft({ lines: [{ description: "Stock", quantity: 2, unitPriceMinor: "1250", inventoryItemId: stock.id, warehouseId: store.id }] });
      const received = await receive(request(), params(row.id)); assert.equal(received.status, 200); const posted = (await received.json()).bill;
      const current = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, stock.id) });
      assert.equal(current!.quantityOnHand, 2); assert.equal(current!.totalValue, 2500);
      if (stock.id === item.id) await db.update(inventoryItem).set({ averageCost: 7777 }).where(eq(inventoryItem.id, item.id));
      assert.equal((await ma.call("void_bill", { billId: row.id })).isError, false); await mirror(posted.journalEntryId);
      const restored = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, stock.id) }); assert.equal(restored!.quantityOnHand, 0); assert.equal(restored!.totalValue, 0);
      assert.equal((await db.query.warehouseStock.findFirst({ where: eq(warehouseStock.inventoryItemId, stock.id) }))!.quantity, 0);
    }
    const consumed = await draft({ lines: [{ description: "FIFO", unitPriceMinor: "1250", inventoryItemId: fifo.id }] });
    assert.equal((await receive(request(), params(consumed.id))).status, 200);
    await db.update(inventoryCostLayer).set({ remainingQuantity: 0 }).where(eq(inventoryCostLayer.inventoryItemId, fifo.id));
    await unchanged(async () => { assert.equal((await voidRoute(request(), params(consumed.id))).status, 422); });
    // Approval without workflow retains direct pending-state behavior; reject has no posting effects.
    const pending = await draft({ submitForApproval: true });
    assert.equal((await reject(request({ reason: "Duplicate" }), params(pending.id))).status, 200);
    assert.equal((await db.query.bill.findFirst({ where: eq(bill.id, pending.id) }))!.rejectionReason, "Duplicate");
    const restPending = await draft({ submitForApproval: true });
    const restApproved = await approve(request(), params(restPending.id)); assert.equal(restApproved.status, 200); assert.ok((await restApproved.json()).bill.journalEntryId);
    const direct = await draft({ submitForApproval: true }); const approved = await ma.call("approve_bill", { billId: direct.id });
    assert.equal(approved.isError, false); assert.ok(approved.body.bill.journalEntryId);
    const toReject = await draft({ submitForApproval: true }); assert.equal((await ma.call("reject_bill", { billId: toReject.id, reason: "Wrong" })).body.bill.status, "draft");
    // Generic approval boundaries cannot bypass posting. Non-assignees and foreign requests reject.
    const [workflow] = await db.insert(approvalWorkflow).values({ organizationId: a.id, entityType: "bill", name: "Two steps" }).returning();
    const steps = await db.insert(approvalWorkflowStep).values([{ workflowId: workflow.id, stepOrder: 1, approverId: ownerMember.id },
      { workflowId: workflow.id, stepOrder: 3, approverId: ownerMember.id }]).returning();
    assert.equal(steps.length, 2);
    const multi = await draft({ submitForApproval: true });
    const [ar] = await db.insert(approvalRequest).values({ organizationId: a.id, workflowId: workflow.id, entityType: "bill", entityId: multi.id, requestedById: ownerMember.id }).returning();
    assert.equal((await ma.call("approve_request", { requestId: ar.id })).body.request.currentStepOrder, 3);
    assert.equal((await db.query.bill.findFirst({ where: eq(bill.id, multi.id) }))!.journalEntryId, null);
    const final = await requestAction(request({ action: "approve" }), params(ar.id)); assert.equal(final.status, 200);
    assert.equal((await final.json()).request.status, "approved"); assert.ok((await db.query.bill.findFirst({ where: eq(bill.id, multi.id) }))!.journalEntryId);
    const cancellation = await draft({ submitForApproval: true });
    const [cancelReq] = await db.insert(approvalRequest).values({ organizationId: a.id, workflowId: workflow.id, entityType: "bill", entityId: cancellation.id, requestedById: ownerMember.id }).returning();
    assert.equal((await ma.call("void_bill", { billId: cancellation.id })).isError, false);
    assert.equal((await db.query.approvalRequest.findFirst({ where: eq(approvalRequest.id, cancelReq.id) }))!.status, "cancelled");
    const wrong = await draft({ submitForApproval: true });
    const [wrongWorkflow] = await db.insert(approvalWorkflow).values({ organizationId: a.id, entityType: "bill", name: "Other assignee" }).returning();
    await db.insert(approvalWorkflowStep).values({ workflowId: wrongWorkflow.id, stepOrder: 1, approverId: viewerMember.id });
    await db.insert(approvalRequest).values({ organizationId: a.id, workflowId: wrongWorkflow.id, entityType: "bill", entityId: wrong.id, requestedById: ownerMember.id });
    await unchanged(async () => { assert.equal((await approve(request(), params(wrong.id))).status, 403); });
    // GRNI has no second stock receipt; PPV revalues on-hand stock and void restores GRNI/PO/receipt history.
    await db.update(inventoryItem).set({ quantityOnHand: 0, averageCost: 0, totalValue: 0 }).where(eq(inventoryItem.id, item.id));
    const [po] = await db.insert(purchaseOrder).values({ organizationId: a.id, contactId: supplier.id, poNumber: "PO", issueDate: "2026-10-01", status: "sent" }).returning();
    const [pol] = await db.insert(purchaseOrderLine).values({ purchaseOrderId: po.id, description: "Stock", quantity: 200, quantityReceived: 0, unitPrice: 1000, inventoryItemId: item.id }).returning();
    const grnResponse = await createGoodsReceipt(request({ purchaseOrderId: po.id, date: "2026-10-01", lines: [{ purchaseOrderLineId: pol.id, quantity: 2 }] }));
    assert.equal(grnResponse.status, 201); const grn = (await grnResponse.json()).goodsReceipt;
    const grnl = (await db.select().from(goodsReceiptLine).where(eq(goodsReceiptLine.goodsReceiptId, grn.id)))[0];
    const accrualId = grnl.journalEntryId;
    const matched = await draft({ lines: [{ description: "Matched", quantity: 2, unitPriceMinor: "1250", inventoryItemId: item.id, goodsReceiptLineId: grnl.id, taxRateId: partial.id }] });
    const matchResponse = await receive(request(), params(matched.id)); assert.equal(matchResponse.status, 200); const matchResult = await matchResponse.json();
    assert.ok(matchResult.grniEntryId); assert.ok(matchResult.warnings.length); assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.quantityOnHand, 2);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.totalValue, 2625);
    assert.equal((await db.query.purchaseOrderLine.findFirst({ where: eq(purchaseOrderLine.id, pol.id) }))!.quantityBilled, 200);
    assert.equal((await ma.call("void_bill", { billId: matched.id })).isError, false); await mirror(matchResult.grniEntryId); await mirror(matchResult.bill.journalEntryId);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.totalValue, 2000);
    assert.equal((await db.query.purchaseOrderLine.findFirst({ where: eq(purchaseOrderLine.id, pol.id) }))!.quantityBilled, 0);
    assert.equal((await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, grn.id) }))!.status, "received");
    assert.equal((await db.query.goodsReceiptLine.findFirst({ where: eq(goodsReceiptLine.id, grnl.id) }))!.journalEntryId, accrualId);
    // Several bills clear only the remaining accrual; voiding either preserves the other bill.
    const partialBills = [];
    for (let n = 0; n < 2; n++) {
      const row = await draft({ lines: [{ description: "Partial receipt", quantity: 1, unitPriceMinor: "1000", goodsReceiptLineId: grnl.id }] });
      const result = await ma.call("receive_bill", { billId: row.id }); assert.equal(result.isError, false); partialBills.push(result.body);
    }
    assert.equal((await db.query.purchaseOrderLine.findFirst({ where: eq(purchaseOrderLine.id, pol.id) }))!.quantityBilled, 200);
    for (const result of partialBills) assert.equal((await ma.call("void_bill", { billId: result.bill.id })).isError, false);
    assert.equal((await db.query.purchaseOrderLine.findFirst({ where: eq(purchaseOrderLine.id, pol.id) }))!.quantityBilled, 0);
    await db.insert(procurementSettings).values({ organizationId: a.id, blockOverBill: true, requireGrnBeforeBill: true });
    const over = await draft({ lines: [{ description: "Over", quantity: 3, unitPriceMinor: "1000", goodsReceiptLineId: grnl.id }] });
    const missingReceipt = await draft({ lines: [{ description: "No GRN", unitPriceMinor: "1000", inventoryItemId: item.id }] });
    await unchanged(async () => { assert.equal((await receive(request(), params(over.id))).status, 422); assert.equal((await ma.call("receive_bill", { billId: missingReceipt.id })).body.status, 422); });
    // Authorization, invalid credentials and tenant isolation for every lifecycle operation.
    const ordinary = await draft(), pending2 = await draft({ submitForApproval: true });
    const foreign = (await mb.call("create_bill", { ...basic, contactId: foreignSupplier.id, lines: [{ description: "Foreign", accountId: foreignAccount.id, unitPriceMinor: "1250" }] })).body.bill;
    for (const [route, tool] of [[receive,"receive_bill"],[approve,"approve_bill"],[reject,"reject_bill"],[voidRoute,"void_bill"]] as const) await unchanged(async () => {
      assert.equal((await route(request({}, keys.viewer), params(ordinary.id))).status, 403);
      assert.equal((await route(request({}, "dk_bad"), params(ordinary.id))).status, 401);
      assert.equal((await route(request({}), params(foreign.id))).status, 404);
      assert.equal((await ro.call(tool, { billId: ordinary.id })).body.status, 403);
      assert.equal((await mb.call(tool, { billId: ordinary.id })).body.status, 404);
    });
    await unchanged(async () => { assert.equal((await reject(request({ reason: {} }), params(pending2.id))).status, 400); assert.equal((await ma.call("reject_bill", { billId: pending2.id, reason: 1 })).isError, true); });
    // Unsafe saved money, missing FX, inconsistent balances, foreign references and period locks never mutate business data.
    const badHeader = await draft(); await db.execute(sql`update bill set total=9007199254740992 where id=${badHeader.id}`);
    const badLine = await draft(); await db.execute(sql`update bill_line set amount=9007199254740992 where bill_id=${badLine.id}`);
    const badReference = await draft(); await db.update(billLine).set({ accountId: foreignAccount.id }).where(eq(billLine.billId, badReference.id));
    const inconsistent = await draft(); await db.update(bill).set({ subtotal: 1 }).where(eq(bill.id, inconsistent.id));
    const noFx = await draft({ currencyCode: "EUR" });
    for (const row of [badHeader, badLine, badReference, inconsistent, noFx]) await unchanged(async () => {
      assert.ok([400,422].includes((await receive(request(), params(row.id))).status)); assert.equal((await ma.call("receive_bill", { billId: row.id })).isError, true);
    });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-03" });
    for (const [route, id] of [[receive, ordinary.id],[approve,pending2.id],[reject,pending2.id],[voidRoute,ordinary.id]] as const)
      await unchanged(async () => { assert.equal((await route(request({}), params(id))).status, 422); });
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    await unchanged(async () => { assert.equal((await ma.call("receive_bill", { billId: ordinary.id })).body.status, 422); });
    await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    // Settlement remains MON-021, but lifecycle refuses existing payments/credits and orphan posted states.
    const settled = await draft(); await db.update(bill).set({ amountPaid: 1 }).where(eq(bill.id, settled.id));
    const orphan = await draft(); await db.update(bill).set({ status: "received" }).where(eq(bill.id, orphan.id));
    await unchanged(async () => { assert.equal((await voidRoute(request(), params(settled.id))).status, 400); assert.equal((await ma.call("void_bill", { billId: orphan.id })).body.status, 422); });
    await unchanged(async () => {
      for (const row of [ordinary, pending2, orphan]) {
        assert.equal((await pay(request({ amount: 1, date: "2026-10-03" }), params(row.id))).status, 400);
        assert.equal((await ma.call("pay_bill", { billId: row.id, amount: 1 })).body.status, 400);
      }
      assert.equal((await pay(request({ amount: 1, date: "2026-10-03" }, keys.viewer), params(direct.id))).status, 403);
    });
    // Fault injections prove journal, stock, approval, header and audit rollback together.
    const failure = await draft({ submitForApproval: true });
    const [failureRequest] = await db.insert(approvalRequest).values({ organizationId: a.id, workflowId: workflow.id, entityType: "bill", entityId: failure.id, requestedById: ownerMember.id, currentStepOrder: 3 }).returning();
    for (const table of ["journal_line", "bill", "audit_log"]) {
      await db.execute(sql.raw(`alter table ${table} add constraint mon048_fail check(false) not valid`));
      try { await unchanged(async () => { assert.equal((await approve(request(), params(failure.id))).status, 500); }); }
      finally { await db.execute(sql.raw(`alter table ${table} drop constraint mon048_fail`)); }
    }
    assert.equal((await db.query.approvalRequest.findFirst({ where: eq(approvalRequest.id, failureRequest.id) }))!.status, "pending");
    await db.delete(procurementSettings).where(eq(procurementSettings.organizationId, a.id));
    const stockFailure = await draft({ lines: [{ description: "Fail stock", unitPriceMinor: "1000", inventoryItemId: item.id }] });
    await db.execute(sql.raw('alter table inventory_movement add constraint mon048_fail check(false) not valid'));
    try { await unchanged(async () => { assert.equal((await receive(request(), params(stockFailure.id))).status, 500); }); }
    finally { await db.execute(sql.raw('alter table inventory_movement drop constraint mon048_fail')); }
    const rollbackVoid = await draft(); assert.equal((await receive(request(), params(rollbackVoid.id))).status, 200);
    await db.execute(sql.raw('alter table audit_log add constraint mon048_fail check(false) not valid'));
    try { await unchanged(async () => { assert.equal((await voidRoute(request(), params(rollbackVoid.id))).status, 500); }); }
    finally { await db.execute(sql.raw('alter table audit_log drop constraint mon048_fail')); }
    // Missing AP does not silently receive a bill without posting.
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, ap.id));
    await unchanged(async () => { assert.equal((await receive(request(), params(ordinary.id))).status, 400); });
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, ap.id));
    assert.ok((await db.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, a.id), eq(inventoryMovement.referenceType, "bill_void")))).length);
    console.log("REST and MCP bill lifecycle verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
