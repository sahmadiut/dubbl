// Invoked only by the wrapper in a randomly named, migrated disposable database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, invoice, invoiceLine, journalEntry, journalLine,
  inventoryItem, inventoryMovement, inventoryCostLayer, inventoryLayerConsumption, warehouse, warehouseStock,
  exchangeRate, periodLock, approvalWorkflow, approvalWorkflowStep, approvalRequest, approvalAction } from "../../lib/db/schema";
import { POST as send } from "../../app/api/v1/invoices/[id]/send/route";
import { POST as voidInvoice } from "../../app/api/v1/invoices/[id]/void/route";
import { POST as debt } from "../../app/api/v1/invoices/[id]/write-off/route";
import { POST as charge } from "../../app/api/v1/invoices/[id]/charge-interest/route";
import { POST as preview } from "../../app/api/v1/invoices/calculate-interest/route";
import { POST as submit } from "../../app/api/v1/invoices/[id]/submit-for-approval/route";
import { POST as approve } from "../../app/api/v1/invoices/[id]/approve/route";
import { POST as reject } from "../../app/api/v1/invoices/[id]/reject/route";
import { POST as requestAction } from "../../app/api/v1/approval-requests/[id]/action/route";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { registerApprovalTools } from "../../lib/mcp/tools/approvals";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext, fullRegistration = false) {
  const server = new McpServer({ name: "Invoice lifecycle", version: "1" });
  if (fullRegistration) registerAllTools(server, ctx);
  else { registerInvoiceLifecycleTools(server, ctx); registerApprovalTools(server, ctx); }
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["send_invoice", "void_invoice", "write_off_invoice", "recover_written_off_invoice", "calculate_invoice_interest",
    "charge_invoice_interest", "submit_invoice_for_approval", "approve_invoice", "reject_invoice"]) assert.ok(tools.some(tool => tool.name === name));
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "charge_invoice_interest")!.inputSchema).includes("amountExact"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }); const value = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: value.startsWith("{") ? JSON.parse(value) : { error: value } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Lifecycle A", slug: "life-a", interestRate: 500 }, { name: "Lifecycle B", slug: "life-b", interestRate: 500 }]).returning();
  const [owner, viewer, second] = await db.insert(users).values([{ email: "life-owner@example.test" }, { email: "life-viewer@example.test" }, { email: "life-second@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  const [ownerMember, secondMember] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: second.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]).returning();
  const keys = { a: "dk_life_a", b: "dk_life_b", viewer: "dk_life_viewer", second: "dk_life_second" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : name === "second" ? second.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_life" });
  const [customer, otherCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer" }, { organizationId: b.id, name: "Other" }]).returning();
  const accounts = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "2200", name: "VAT", type: "liability" }, { organizationId: a.id, code: "4100", name: "Interest", type: "revenue" },
    { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" },
  ]).returning();
  const revenue = accounts[1], interest = accounts[3], foreign = accounts[4];
  const [store] = await db.insert(warehouse).values({ organizationId: a.id, code: "W", name: "Stock" }).returning();
  const [item] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "I", name: "Average stock", averageCost: 300, quantityOnHand: 10, totalValue: 3000 }).returning();
  await db.insert(warehouseStock).values({ organizationId: a.id, inventoryItemId: item.id, warehouseId: store.id, quantity: 10 });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const secondMcp = await mcp({ ...ctx, userId: second.id });
  const today = new Date().toISOString().slice(0, 10), earlier = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const request = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/invoices", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const call = (handler: typeof send, id: string, body: unknown = {}, key = keys.a) => handler(request(body, key), params(id));
  let serial = 0;
  const make = async (patch: Partial<typeof invoice.$inferInsert> = {}, linePatch: Partial<typeof invoiceLine.$inferInsert> = {}) => {
    const [row] = await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: `INV-${++serial}`,
      issueDate: earlier, dueDate: earlier, subtotal: 1250, taxTotal: 0, total: 1250, amountPaid: 0, amountDue: 1250, ...patch }).returning();
    await db.insert(invoiceLine).values({ invoiceId: row.id, description: "Line", quantity: 100, unitPrice: 1250, amount: 1250, accountId: revenue.id, ...linePatch });
    return row.id;
  };
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from invoice t) invoices,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from invoice_line t) lines,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from journal_entry t) entries,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from journal_line t) legs,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from chart_account t) accounts,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from inventory_item t) stock,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from inventory_movement t) movements,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from inventory_cost_layer t) layers,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from inventory_layer_consumption t) consumptions,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from warehouse_stock t) warehouses,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from number_sequence t) sequences,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from approval_request t) requests,
    (select coalesce(jsonb_agg(to_jsonb(t)::text order by id),'[]'::jsonb) from approval_action t) actions,
    (select count(*)::text from audit_log) audits`)).rows;
  const unchanged = async (operation: () => Promise<unknown>) => { const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before); };
  const allBalanced = async () => {
    const rows = (await db.execute(sql`select e.id, sum(l.debit_amount)::text d, sum(l.credit_amount)::text c from journal_entry e
      left join journal_line l on l.journal_entry_id=e.id group by e.id`)).rows;
    assert.ok(rows.length); for (const row of rows) { assert.ok(row.d && row.c, "No empty journals"); assert.equal(row.d, row.c); }
  };
  const setRate = async (currency: string, target: string, value: number, date = earlier) => {
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currency, targetCurrency: target, rate: value, date, source: "manual" })
      .onConflictDoUpdate({ target: [exchangeRate.organizationId, exchangeRate.baseCurrency, exchangeRate.targetCurrency, exchangeRate.date], set: { rate: value } });
  };
  try {
    const sent = await make({}, { inventoryItemId: item.id, warehouseId: store.id, quantity: 200, unitPrice: 625 });
    const response = await call(send, sent); assert.equal(response.status, 200); const sentDto = await response.json();
    assert.equal(sentDto.invoice.total, 1250); assert.equal(sentDto.invoice.totalMinor, "1250"); assert.equal(sentDto.invoice.status, "sent");
    assert.equal(sentDto.invoice.senderSnapshot.name, a.name); assert.equal(sentDto.invoice.recipientSnapshot.name, customer.name);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.quantityOnHand, 8);
    const source = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, sentDto.invoice.journalEntryId));
    assert.equal(source[0].rateExact, "1"); assert.equal(source[0].rateMigrationStatus, "exact");
    await unchanged(async () => { assert.equal((await call(send, sent)).status, 400); assert.equal((await ma.call("send_invoice", { invoiceId: sent })).body.status, 400); });
    // Restore original COGS and stock value even after the current cost changes.
    await db.update(inventoryItem).set({ averageCost: 999 }).where(eq(inventoryItem.id, item.id));
    const voided = await ma.call("void_invoice", { invoiceId: sent }); assert.equal(voided.isError, false); assert.equal(voided.body.invoice.amountDueMinor, "0");
    const restored = (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!; assert.equal(restored.quantityOnHand, 10); assert.equal(restored.totalValue, 3000);
    const reversed = (await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, sentDto.invoice.journalEntryId) }))!;
    assert.ok(reversed.reversedByEntryId); const mirrors = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, reversed.reversedByEntryId!));
    for (const original of source) { const mirror = mirrors.find(line => line.accountId === original.accountId)!;
      assert.equal(mirror.creditAmount, original.debitAmount); assert.equal(mirror.debitAmount, original.creditAmount); assert.equal(mirror.rateExact, original.rateExact); }
    await unchanged(async () => { assert.equal((await call(voidInvoice, sent)).status, 400); });
    const draft = await make({}, { inventoryItemId: item.id, warehouseId: store.id }); const beforeQty = restored.quantityOnHand;
    assert.equal((await call(voidInvoice, draft)).status, 200); assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.quantityOnHand, beforeQty);
    const [fifo] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "FIFO", name: "FIFO", costMethod: "fifo", averageCost: 500, quantityOnHand: 5, totalValue: 2500 }).returning();
    const layers = await db.insert(inventoryCostLayer).values([{ organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 1, remainingQuantity: 1, unitCost: 300, receivedAt: new Date("2026-01-01") },
      { organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 1, remainingQuantity: 1, unitCost: 600, receivedAt: new Date("2026-01-02") }]).returning();
    const fifoInvoice = await make({}, { inventoryItemId: fifo.id, quantity: 300 });
    assert.equal((await call(send, fifoInvoice)).status, 200);
    const fifoIssues = await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, fifoInvoice));
    assert.equal(fifoIssues[0].value, -1400); assert.equal((await db.select().from(inventoryLayerConsumption)).length, 2);
    await db.update(inventoryItem).set({ averageCost: 900 }).where(eq(inventoryItem.id, fifo.id));
    assert.equal((await call(voidInvoice, fifoInvoice)).status, 200);
    for (const layer of layers) assert.equal((await db.query.inventoryCostLayer.findFirst({ where: eq(inventoryCostLayer.id, layer.id) }))!.remainingQuantity, 1);
    const returnedLayers = await db.select().from(inventoryCostLayer).where(eq(inventoryCostLayer.inventoryItemId, fifo.id));
    assert.equal(returnedLayers.length, 3); assert.equal(returnedLayers.find(row => !layers.some(layer => layer.id === row.id))!.unitCost, 500);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, fifo.id) }))!.totalValue, 2500);
    const paid = await make({ status: "partial", amountPaid: 1, amountDue: 1249 });
    await unchanged(async () => { assert.equal((await call(voidInvoice, paid)).status, 400); assert.equal((await ma.call("void_invoice", { invoiceId: paid })).isError, true); });
    // Legacy, exact and dual interest overrides; recovery amounts have different units.
    for (const amount of [{ amount: 12.5 }, { amountExact: "12.50" }, { amountMinor: "1250" }, { amount: 12.5, amountExact: "12.50", amountMinor: "1250" }]) {
      const id = await make(); assert.equal((await ma.call("send_invoice", { invoiceId: id })).isError, false);
      const charged = await call(charge, id, amount); assert.equal(charged.status, 201); const body = await charged.json();
      assert.equal(body.interestAmount, 1250); assert.equal(body.interestAmountMinor, "1250"); assert.equal(body.invoice.totalMinor, "1250"); assert.ok(body.invoice.journalEntryId);
      const mc = await ma.call("charge_invoice_interest", { invoiceId: id, ...amount }); assert.equal(mc.isError, false); assert.equal(mc.body.interestAmountMinor, "1250");
      const written = await ma.call("write_off_invoice", { invoiceId: id, method: "allowance" }); assert.equal(written.isError, false); assert.equal(written.body.amountWrittenOffMinor, "1250");
      const recovered = await call(debt, id, { action: "recover", amount: 1250, amountMinor: "1250" }); assert.equal(recovered.status, 200); assert.equal((await recovered.json()).recoveredMinor, "1250");
      const rm = await ma.call("recover_written_off_invoice", { invoiceId: id, amountMinor: "1" }); assert.equal(rm.isError, false); assert.equal(rm.body.recovered, 1);
    }
    const unpaid = await make(); assert.equal((await call(send, unpaid)).status, 200);
    const estimated = await preview(request()); assert.equal(estimated.status, 200); const estimate = (await estimated.json()).data.find((row: { invoiceId: string }) => row.invoiceId === unpaid);
    assert.ok(estimate); assert.equal(estimate.interestAmountMinor, String(estimate.interestAmount));
    assert.equal((await ma.call("calculate_invoice_interest")).isError, false);
    assert.equal((await call(charge, unpaid)).status, 201); assert.equal((await call(debt, unpaid)).status, 200);
    assert.equal((await ma.call("recover_written_off_invoice", { invoiceId: unpaid })).body.recovered, 1250);
    const editable = await make();
    // All lifecycle authorization, API-key scope, custom permissions and tenant isolation.
    const handlers = [send, voidInvoice, debt, charge, submit, approve, reject];
    const names = ["send_invoice", "void_invoice", "write_off_invoice", "charge_invoice_interest", "submit_invoice_for_approval", "approve_invoice", "reject_invoice", "recover_written_off_invoice"];
    await unchanged(async () => {
      for (const handler of handlers) { assert.equal((await call(handler, editable, {}, keys.viewer)).status, 403); assert.equal((await call(handler, editable, {}, keys.b)).status, 404); }
      for (const name of names) { assert.equal((await ro.call(name, { invoiceId: editable })).body.status, 403); assert.equal((await mb.call(name, { invoiceId: editable })).body.status, 404); }
      assert.equal((await call(send, editable, {}, "dk_invalid")).status, 401);
      assert.equal((await call(send, randomUUID())).status, 404);
    });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: today });
    await unchanged(async () => { for (const handler of [send, voidInvoice, debt, submit]) assert.equal((await call(handler, editable)).status, 422);
      for (const name of ["send_invoice", "void_invoice", "submit_invoice_for_approval"]) assert.equal((await ma.call(name, { invoiceId: editable })).body.status, 422); });
    await db.delete(periodLock);
    // Persisted unsafe header/line/opaque JSON and foreign retained dimensions fail without mutations.
    for (const statement of [sql`update invoice set total=9007199254740992 where id=${editable}`,
      sql`update invoice_line set amount=9007199254740992 where invoice_id=${editable}`,
      sql`update invoice set sender_snapshot='{"unsafe":9007199254740992}'::jsonb where id=${editable}`]) {
      await db.execute(statement);
      await unchanged(async () => { assert.equal((await call(send, editable)).status, 422); assert.equal((await ma.call("void_invoice", { invoiceId: editable })).body.status, 422); });
      await db.update(invoice).set({ total: 1250, senderSnapshot: null }).where(eq(invoice.id, editable));
      await db.update(invoiceLine).set({ amount: 1250 }).where(eq(invoiceLine.invoiceId, editable));
    }
    await db.update(invoice).set({ contactId: otherCustomer.id }).where(eq(invoice.id, editable));
    await unchanged(async () => { assert.equal((await call(send, editable)).status, 422); });
    await db.update(invoice).set({ contactId: customer.id }).where(eq(invoice.id, editable));
    await db.update(invoiceLine).set({ accountId: foreign.id }).where(eq(invoiceLine.invoiceId, editable));
    await unchanged(async () => { assert.equal((await call(send, editable)).status, 422); });
    await db.update(invoiceLine).set({ accountId: revenue.id }).where(eq(invoiceLine.invoiceId, editable));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, revenue.id));
    await unchanged(async () => { assert.equal((await call(send, editable)).status, 400); });
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, revenue.id));
    await unchanged(async () => { assert.equal((await call(send, editable, { sendEmail: true, recipientEmail: "invalid" })).status, 400); });
    // Valid sent source for invalid amount, state, missing-account and FX-overflow failures.
    const candidate = await make(); assert.equal((await call(send, candidate)).status, 200);
    const recognized = (await db.query.invoice.findFirst({ where: eq(invoice.id, candidate) }))!;
    const mislinked = await make({ status: "sent", journalEntryId: recognized.journalEntryId });
    await unchanged(async () => { assert.equal((await call(voidInvoice, mislinked)).status, 422); assert.equal((await call(debt, mislinked)).status, 422); });
    for (const body of [{ amount: 1, amountMinor: "2" }, { amountMinor: "9007199254740992" }, { amountMinor: "-1" }, { amountExact: "1e3" }, { amount: 0 }])
      await unchanged(async () => { assert.ok([400, 422].includes((await call(charge, candidate, body)).status)); assert.equal((await ma.call("charge_invoice_interest", { invoiceId: candidate, ...body })).isError, true); });
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, interest.id));
    await unchanged(async () => { assert.equal((await call(charge, candidate, { amountMinor: "1250" })).status, 400); });
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, interest.id));
    await unchanged(async () => { assert.equal((await call(debt, editable)).status, 400); assert.equal((await ma.call("recover_written_off_invoice", { invoiceId: candidate })).isError, true); });
    // Saved FX stays authoritative after provider/manual changes; reversal never re-converts base amounts.
    await setRate("EUR", "USD", 1500000);
    const euro = await make({ currencyCode: "EUR" }); const eurSend = await call(send, euro); assert.equal(eurSend.status, 200); const eurDto = await eurSend.json();
    await setRate("EUR", "USD", 2000000);
    assert.equal((await call(debt, euro)).status, 200);
    const debtEntry = await db.query.journalEntry.findFirst({ where: sql`${journalEntry.sourceId}=${euro} and ${journalEntry.sourceType}='bad_debt_write_off'` });
    const debtLegs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, debtEntry!.id));
    assert.equal(debtLegs[0].rateExact, "1.5"); assert.equal(debtLegs[0].debitAmount, 1875);
    const eurVoid = await make({ currencyCode: "EUR" }); const eurV = await (await call(send, eurVoid)).json();
    await db.delete(exchangeRate); assert.equal((await call(voidInvoice, eurVoid)).status, 200);
    assert.ok((await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, eurV.invoice.journalEntryId) }))!.reversedByEntryId);
    const missing = await make({ currencyCode: "EUR" });
    await unchanged(async () => { assert.equal((await call(send, missing)).status, 422); assert.equal((await ma.call("send_invoice", { invoiceId: missing })).body.status, 422); });
    // Different zero/three-decimal base scales and safe maximum outputs.
    await setRate("USD", "JPY", 150000000); await db.update(organization).set({ defaultCurrency: "JPY" }).where(eq(organization.id, a.id));
    const yenBase = await make(); const yenSend = await (await call(send, yenBase)).json();
    const yenLegs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, yenSend.invoice.journalEntryId)); assert.equal(yenLegs[0].debitAmount, 1875);
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    await unchanged(async () => { assert.equal((await call(debt, yenBase)).status, 422); });
    for (const [currency, fx, override, expected] of [["JPY", 10000, "12.5", 13], ["KWD", 3000000, "12.50", 12500]] as const) {
      await setRate(currency, "USD", fx);
      const scale = await make({ currencyCode: currency }); assert.equal((await call(send, scale)).status, 200);
      const scaled = await ma.call("charge_invoice_interest", { invoiceId: scale, amountExact: override, amountMinor: String(expected) });
      assert.equal(scaled.isError, false); assert.equal(scaled.body.invoice.totalMinor, String(expected));
    }
    const wide = await make({ subtotal: Number.MAX_SAFE_INTEGER, total: Number.MAX_SAFE_INTEGER, amountDue: Number.MAX_SAFE_INTEGER }, { unitPrice: Number.MAX_SAFE_INTEGER, amount: Number.MAX_SAFE_INTEGER });
    assert.equal((await call(send, wide)).status, 200); assert.equal((await call(voidInvoice, wide)).status, 200);
    await setRate("EUR", "USD", 2000000);
    const overflow = await make({ currencyCode: "EUR", subtotal: Number.MAX_SAFE_INTEGER, total: Number.MAX_SAFE_INTEGER, amountDue: Number.MAX_SAFE_INTEGER }, { unitPrice: Number.MAX_SAFE_INTEGER, amount: Number.MAX_SAFE_INTEGER });
    await unchanged(async () => { assert.equal((await call(send, overflow)).status, 422); });
    // Multi-step approval, assigned approver, generic request parity and unsafe history rejection.
    const [flow] = await db.insert(approvalWorkflow).values({ organizationId: a.id, name: "Invoice workflow", entityType: "invoice" }).returning();
    await db.insert(approvalWorkflowStep).values([{ workflowId: flow.id, stepOrder: 1, approverId: ownerMember.id }, { workflowId: flow.id, stepOrder: 2, approverId: secondMember.id }]);
    const pending = await make(); assert.equal((await call(submit, pending)).status, 200);
    await unchanged(async () => { assert.equal((await call(send, pending)).status, 400); assert.equal((await secondMcp.call("approve_invoice", { invoiceId: pending })).body.status, 403); });
    const first = await ma.call("approve_invoice", { invoiceId: pending, comment: "First" }); assert.equal(first.isError, false); assert.equal(first.body.invoice.status, "pending_approval");
    const secondResponse = await call(approve, pending, {}, keys.second); assert.equal(secondResponse.status, 200); assert.equal((await secondResponse.json()).invoice.status, "draft");
    const rejected = await make(); assert.equal((await ma.call("submit_invoice_for_approval", { invoiceId: rejected })).isError, false);
    assert.equal((await call(reject, rejected, { reason: "No" })).status, 200);
    const rejectedMcp = await make(); await call(submit, rejectedMcp);
    assert.equal((await ma.call("reject_invoice", { invoiceId: rejectedMcp, reason: "No" })).body.invoice.status, "rejected");
    const generic = await make(); await call(submit, generic);
    const pendingRequest = (await db.query.approvalRequest.findFirst({ where: eq(approvalRequest.entityId, generic) }))!;
    await db.execute(sql`update invoice set total=9007199254740992 where id=${generic}`);
    await unchanged(async () => { assert.equal((await call(requestAction, pendingRequest.id, { action: "approve" })).status, 422);
      assert.equal((await ma.call("approve_request", { requestId: pendingRequest.id })).body.status, 422); });
    await db.update(invoice).set({ total: 1250 }).where(eq(invoice.id, generic));
    assert.equal((await call(requestAction, pendingRequest.id, { action: "comment", comment: "Reviewed" })).status, 200);
    assert.equal((await ma.call("approve_request", { requestId: pendingRequest.id })).isError, false);
    assert.equal((await secondMcp.call("reject_request", { requestId: pendingRequest.id })).isError, false);
    assert.equal((await db.query.invoice.findFirst({ where: eq(invoice.id, generic) }))!.status, "rejected");
    // Duplicate sends/voids serialize around organization + invoice locks.
    const race = await make(); const sends = await Promise.all([call(send, race), call(send, race)]); assert.deepEqual(sends.map(r => r.status).sort(), [200, 400]);
    const voids = await Promise.all([call(voidInvoice, race), call(voidInvoice, race)]); assert.deepEqual(voids.map(r => r.status).sort(), [200, 400]);
    // Forced failures after partial work verify transaction rollback, including created accounts and numbering.
    const fault = async (table: string, event: string, operation: () => Promise<unknown>) => {
      assert.ok(["invoice", "invoice_line", "journal_line", "approval_request", "approval_action"].includes(table));
      assert.ok(["insert", "update"].includes(event));
      await db.execute(sql.raw("create function lifecycle_fault() returns trigger language plpgsql as $$ begin raise exception 'MON-040 forced rollback'; end $$"));
      await db.execute(sql.raw(`create trigger lifecycle_fault before ${event} on ${table} for each row execute function lifecycle_fault()`));
      try { await unchanged(operation); } finally { await db.execute(sql.raw(`drop trigger lifecycle_fault on ${table}`)); await db.execute(sql.raw("drop function lifecycle_fault()")); }
    };
    const sendFail = await make();
    await fault("invoice", "update", async () => { assert.equal((await call(send, sendFail)).status, 500); });
    await fault("invoice_line", "insert", async () => { assert.equal((await call(charge, candidate, { amountMinor: "1250" })).status, 500); });
    await fault("journal_line", "insert", async () => { assert.equal((await ma.call("charge_invoice_interest", { invoiceId: candidate, amountMinor: "1250" })).isError, true); });
    const debtFail = await make(); await call(send, debtFail);
    await fault("invoice", "update", async () => { assert.equal((await call(debt, debtFail)).status, 500); });
    await fault("approval_request", "insert", async () => { assert.equal((await call(submit, sendFail)).status, 500); });
    await call(submit, sendFail);
    await fault("approval_request", "update", async () => { assert.equal((await call(approve, sendFail)).status, 500); });
    await fault("approval_action", "insert", async () => { assert.equal((await ma.call("reject_invoice", { invoiceId: sendFail })).isError, true); });
    await call(approve, sendFail);
    await fault("invoice", "update", async () => { assert.equal((await call(approve, sendFail, {}, keys.second)).status, 500); });
    const voidFail = await make(); await call(send, voidFail);
    await fault("invoice", "update", async () => { assert.equal((await call(voidInvoice, voidFail)).status, 500); });
    const stockFail = await make({}, { inventoryItemId: fifo.id, quantity: 100 });
    await fault("invoice", "update", async () => { assert.equal((await call(send, stockFail)).status, 500); });
    // Deleted history is invisible to every scoped operation.
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, editable));
    await unchanged(async () => { for (const handler of handlers) assert.equal((await call(handler, editable)).status, 404); });
    await allBalanced();
    assert.ok((await db.select().from(approvalAction)).length); assert.ok((await db.select().from(inventoryMovement)).length);
    assert.ok((await db.select().from(journalLine)).every(line => line.rateMigrationStatus === "exact"));
    assert.equal((await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, eurDto.invoice.journalEntryId) }))!.status, "posted");
    console.log("REST and MCP invoice lifecycle verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); await secondMcp.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
