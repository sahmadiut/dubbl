// Invoked only against the wrapper's randomly named, disposable, migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, costCenter, project,
  salesReceipt, salesReceiptLine, periodLock, journalEntry, journalLine, exchangeRate, inventoryItem,
  inventoryMovement, inventoryCostLayer, bankAccount, warehouse, warehouseStock } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/sales-receipts/route";
import { GET, PATCH, DELETE } from "../../app/api/v1/sales-receipts/[id]/route";
import { POST as POST_RECEIPT } from "../../app/api/v1/sales-receipts/[id]/post/route";
import { POST as VOID } from "../../app/api/v1/sales-receipts/[id]/void/route";
import { registerSalesReceiptTools } from "../../lib/mcp/tools/sales-receipts";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Receipt fixture", version: "1.0.0" }); registerSalesReceiptTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 7);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_sales_receipt")!.inputSchema).includes("unitPriceMinor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Receipt A", slug: "ra" }, { name: "Receipt B", slug: "rb" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "receipt-owner@example.test" }, { email: "receipt-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_receipt_a", b: "dk_receipt_b", viewer: "dk_receipt_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_receipt" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer" }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [revenue, cash, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "1100", name: "Cash", type: "asset" }, { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, name: "Center", code: "A" }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [job, foreignJob] = await db.insert(project).values([{ organizationId: a.id, name: "Job" }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [store, foreignStore] = await db.insert(warehouse).values([{ organizationId: a.id, code: "A", name: "Store" }, { organizationId: b.id, code: "B", name: "Foreign" }]).returning();
  const [stock, foreignStock] = await db.insert(inventoryItem).values([{ organizationId: a.id, code: "STOCK", name: "Stock", averageCost: 300, totalValue: 3000, quantityOnHand: 10 },
    { organizationId: b.id, code: "STOCK", name: "Foreign" }]).returning();
  const [bank, foreignBank, euroBank, faultBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Bank", accountType: "checking", currencyCode: "USD" },
    { organizationId: b.id, accountName: "Foreign", accountType: "checking", currencyCode: "USD" },
    { organizationId: a.id, accountName: "Euro", accountType: "checking", currencyCode: "EUR" },
    { organizationId: a.id, accountName: "Fault bank", accountType: "checking", currencyCode: "USD" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method: string, body?: unknown, key = keys.a, raw?: string, query = "") => new Request(`http://fixture.test/api/v1/sales-receipts${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(raw !== undefined ? { body: raw } : body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const basic = { contactId: customer.id, date: "2026-10-01", lines: [{ description: "Sale", unitPriceMinor: "1250", accountId: revenue.id }] };
  const make = async (body: unknown = basic) => { const response = await POST(req("POST", body)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).salesReceipt; };
  const posted = async (body: unknown = basic) => { const row = await make(body), response = await POST_RECEIPT(req("POST"), params(row.id)); assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return (await response.json()).salesReceipt; };
  const tables = ["sales_receipt", "sales_receipt_line", "journal_entry", "journal_line", "number_sequence", "chart_account", "bank_account",
    "inventory_item", "inventory_movement", "inventory_cost_layer", "inventory_layer_consumption", "warehouse_stock"];
  const snapshot = async () => {
    const rows = [];
    for (const table of tables) rows.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    rows.push((await db.execute(sql`select count(*)::text from audit_log`)).rows); return rows;
  };
  const unchanged = async (op: () => Promise<unknown>) => { const before = await snapshot(); await op(); assert.deepEqual(await snapshot(), before); };
  const fault = async (table: string, event: string, op: () => Promise<unknown>) => {
    assert.ok(tables.includes(table)); assert.ok(["insert", "update"].includes(event));
    await db.execute(sql.raw("create function receipt_fault() returns trigger language plpgsql as $$ begin raise exception 'receipt fixture fault'; end $$"));
    await db.execute(sql.raw(`create trigger receipt_fault before ${event} on ${table} for each row execute function receipt_fault()`));
    try { await unchanged(op); } finally { await db.execute(sql.raw(`drop trigger receipt_fault on ${table}`)); await db.execute(sql.raw("drop function receipt_fault()")); }
  };
  try {
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const body = { ...basic, lines: [{ ...basic.lines[0], unitPriceMinor: undefined, ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax.id }] };
      const row = await make(body); assert.equal(row.total, 1856); assert.equal(row.totalMinor, "1856");
      const result = await ma.call("create_sales_receipt", body); assert.equal(result.isError, false); assert.equal(result.body.salesReceipt.totalMinor, "1856");
      const found = (await (await GET(req("GET"), params(row.id))).json()).salesReceipt; assert.equal(found.lines[0].unitPriceMinor, "1250"); assert.equal(found.lines[0].quantity, 150);
      assert.equal((await ma.call("get_sales_receipt", { salesReceiptId: row.id })).body.salesReceipt.total, 1856);
    }
    for (const [currencyCode, unitPriceExact] of [["USD", "12.5"], ["JPY", "1250"], ["KWD", "1.25"]]) {
      const row = await make({ ...basic, currencyCode, lines: [{ ...basic.lines[0], unitPriceMinor: undefined, unitPriceExact }] }); assert.equal(row.totalMinor, "1250");
    }
    const subminor = await make({ ...basic, lines: [{ description: "Subminor", unitPriceExact: "0.005", quantity: 3 }] }); assert.equal(subminor.totalMinor, "2");
    const editable = await make();
    assert.equal((await PATCH(req("PATCH", { notes: "Changed", lines: [{ ...basic.lines[0], unitPriceExact: "12.5" }] }), params(editable.id))).status, 200);
    assert.equal((await ma.call("update_sales_receipt", { salesReceiptId: editable.id, notes: null })).body.salesReceipt.notes, null);
    assert.equal((await (await LIST(req("GET", undefined, keys.a, undefined, "?limit=2&page=2&sortBy=number&sortOrder=asc"))).json()).data.length, 2);
    assert.ok((await ma.call("list_sales_receipts")).body.salesReceipts.length > 0);
    assert.equal((await mb.call("list_sales_receipts")).body.total, 0);
    assert.equal((await (await LIST(req("GET", undefined, keys.b))).json()).data.length, 0);
    const deletable = await make(); assert.equal((await DELETE(req("DELETE"), params(deletable.id))).status, 200); assert.equal((await GET(req("GET"), params(deletable.id))).status, 404);
    const mcpDelete = await ma.call("create_sales_receipt", basic); assert.equal((await ma.call("delete_sales_receipt", { salesReceiptId: mcpDelete.body.salesReceipt.id })).body.success, true);
    for (const [field, foreign] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id], ["costCenterId", foreignCenter.id],
      ["projectId", foreignJob.id], ["inventoryItemId", foreignStock.id], ["warehouseId", foreignStore.id]] as const) {
      const body = { ...basic, lines: [{ ...basic.lines[0], [field]: foreign }] };
      await unchanged(async () => { assert.equal((await POST(req("POST", body))).status, 400); assert.equal((await ma.call("create_sales_receipt", body)).isError, true);
        assert.equal((await PATCH(req("PATCH", { lines: body.lines }), params(editable.id))).status, 400); });
    }
    for (const body of [{ ...basic, contactId: foreignCustomer.id }, { ...basic, bankAccountId: foreignBank.id }, { ...basic, depositAccountId: foreignAccount.id },
      { ...basic, date: "2026-02-30" }, ...[{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "01" }, { unitPriceExact: "1e3" },
        { unitPriceMinor: "9007199254740991", quantity: 2 }, { unitPriceMinor: "1250", unitPrice: 1 }].map(line => ({ ...basic, lines: [{ description: "Bad", ...line }] }))])
      await unchanged(async () => { assert.ok([400, 422].includes((await POST(req("POST", body))).status)); assert.equal((await ma.call("create_sales_receipt", body)).isError, true); });
    for (const body of [{ organizationId: b.id }, { status: "paid" }, { total: 1 }, { contactId: foreignCustomer.id }])
      await unchanged(async () => { assert.equal((await PATCH(req("PATCH", body), params(editable.id))).status, 400); });
    await unchanged(async () => { assert.equal((await POST(req("POST", undefined, keys.a, "{bad"))).status, 400);
      for (const handler of [POST_RECEIPT, VOID]) assert.equal((await handler(req("POST", undefined, keys.a, "{bad"), params(editable.id))).status, 400);
      assert.equal((await POST_RECEIPT(req("POST", { bankAccountId: foreignBank.id }), params(editable.id))).status, 400); });
    await unchanged(async () => {
      assert.equal((await POST(req("POST", basic, "dk_invalid"))).status, 401); assert.equal((await POST(req("POST", basic, keys.viewer))).status, 403);
      assert.equal((await ro.call("create_sales_receipt", basic)).body.status, 403);
      for (const handler of [PATCH, DELETE, POST_RECEIPT, VOID]) assert.equal((await handler(req(handler === PATCH ? "PATCH" : handler === DELETE ? "DELETE" : "POST", {}, keys.viewer), params(editable.id))).status, 403);
      for (const name of ["update_sales_receipt", "delete_sales_receipt", "post_sales_receipt", "void_sales_receipt"]) {
        assert.equal((await ro.call(name, { salesReceiptId: editable.id })).body.status, 403); assert.equal((await mb.call(name, { salesReceiptId: editable.id })).body.status, 404);
      }
      for (const handler of [GET, PATCH, DELETE, POST_RECEIPT, VOID]) assert.equal((await handler(req(handler === GET ? "GET" : handler === PATCH ? "PATCH" : handler === DELETE ? "DELETE" : "POST", handler === GET ? undefined : {}, keys.b), params(editable.id))).status, 404);
      assert.equal((await mb.call("get_sales_receipt", { salesReceiptId: editable.id })).body.status, 404);
    });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-09-30" });
    await unchanged(async () => { assert.equal((await POST(req("POST", { ...basic, date: "2026-09-01" }))).status, 422); assert.equal((await PATCH(req("PATCH", { date: "2026-09-01" }), params(editable.id))).status, 422); });
    await db.update(salesReceipt).set({ date: "2026-09-01" }).where(eq(salesReceipt.id, editable.id));
    await unchanged(async () => { for (const handler of [POST_RECEIPT, VOID, DELETE]) assert.equal((await handler(req(handler === DELETE ? "DELETE" : "POST"), params(editable.id))).status, 422);
      assert.equal((await ma.call("post_sales_receipt", { salesReceiptId: editable.id })).body.status, 422); assert.equal((await PATCH(req("PATCH", { date: "2026-10-02" }), params(editable.id))).status, 422); });
    await db.delete(periodLock); await db.update(salesReceipt).set({ date: "2026-10-01" }).where(eq(salesReceipt.id, editable.id));
    const sale = await posted({ ...basic, depositAccountId: cash.id, lines: [{ ...basic.lines[0], taxRateId: tax.id, costCenterId: center.id, projectId: job.id }] });
    assert.equal(sale.status, "paid"); assert.equal(sale.totalMinor, "1375");
    const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, sale.journalEntryId));
    assert.equal(legs.find(line => line.accountId === cash.id)!.debitAmount, 1375); assert.equal(legs.find(line => line.accountId === revenue.id)!.projectId, job.id);
    assert.ok(!legs.some(line => line.creditAmount < 0 || line.debitAmount < 0));
    await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(sale.id))).status, 400); assert.equal((await PATCH(req("PATCH", { notes: "No" }), params(sale.id))).status, 400); assert.equal((await DELETE(req("DELETE"), params(sale.id))).status, 400); });
    const voidResult = await ma.call("void_sales_receipt", { salesReceiptId: sale.id }); assert.equal(voidResult.body.salesReceipt.status, "void");
    const original = (await db.select().from(journalEntry).where(eq(journalEntry.id, sale.journalEntryId)))[0]; assert.ok(original.reversedByEntryId);
    const reversed = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, original.reversedByEntryId!));
    assert.deepEqual(reversed.map(line => [line.accountId, line.debitAmount, line.creditAmount, line.rateExact, line.projectId]).sort(),
      legs.map(line => [line.accountId, line.creditAmount, line.debitAmount, line.rateExact, line.projectId]).sort());
    await unchanged(async () => { assert.equal((await VOID(req("POST"), params(sale.id))).status, 400); });
    const draftVoid = await make(); assert.equal((await VOID(req("POST"), params(draftVoid.id))).status, 200);
    const bankSale = await posted({ ...basic, bankAccountId: bank.id, depositAccountId: cash.id });
    assert.ok((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }))!.chartAccountId);
    assert.equal((await (await GET(req("GET"), params(bankSale.id))).json()).salesReceipt.bankAccount.balanceMinor, "0");
    const maximum = await posted({ ...basic, lines: [{ ...basic.lines[0], unitPriceMinor: "9007199254740991" }] });
    assert.equal(maximum.totalMinor, "9007199254740991"); assert.equal((await VOID(req("POST"), params(maximum.id))).status, 200);
    const wrongBank = await make({ ...basic, bankAccountId: euroBank.id }); await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(wrongBank.id))).status, 422); });
    const noAccount = await make({ ...basic, lines: [{ description: "No account", unitPriceMinor: "1250" }] }); await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(noAccount.id))).status, 400); });
    // FX posting uses exact historic ratios; void uses saved amounts after rate changes.
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 1200000, source: "manual" });
    const euro = await posted({ ...basic, currencyCode: "EUR", bankAccountId: euroBank.id });
    const euroLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, euro.journalEntryId)); assert.equal(euroLines[0].rateExact, "1.2");
    assert.equal(euroLines.reduce((s, line) => s + line.debitAmount, 0), 1500);
    await db.update(exchangeRate).set({ rate: 2000000 }).where(eq(exchangeRate.organizationId, a.id)); assert.equal((await VOID(req("POST"), params(euro.id))).status, 200);
    const missingFx = await make({ ...basic, currencyCode: "KWD" }); await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(missingFx.id))).status, 422); });
    const fxOverflow = await make({ ...basic, currencyCode: "EUR", lines: [{ ...basic.lines[0], unitPriceMinor: "9007199254740991" }] });
    await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(fxOverflow.id))).status, 422); });
    // Average and FIFO issues restore captured costs and warehouse quantities.
    await db.insert(warehouseStock).values({ organizationId: a.id, warehouseId: store.id, inventoryItemId: stock.id, quantity: 10 });
    const stockBody = { ...basic, lines: [{ ...basic.lines[0], quantity: 2, inventoryItemId: stock.id, warehouseId: store.id }] };
    const stocked = await posted(stockBody); assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, stock.id) }))!.quantityOnHand, 8);
    await db.update(inventoryItem).set({ averageCost: 999 }).where(eq(inventoryItem.id, stock.id));
    assert.equal((await VOID(req("POST"), params(stocked.id))).status, 200);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, stock.id) }))!.totalValue, 3000);
    assert.equal((await db.query.warehouseStock.findFirst({ where: eq(warehouseStock.inventoryItemId, stock.id) }))!.quantity, 10);
    const [fifo] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "FIFO", name: "FIFO", costMethod: "fifo", averageCost: 500, totalValue: 3000, quantityOnHand: 10 }).returning();
    const [layer] = await db.insert(inventoryCostLayer).values({ organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 10, remainingQuantity: 10, unitCost: 300 }).returning();
    const fifoSale = await posted({ ...basic, lines: [{ ...basic.lines[0], quantity: 2, inventoryItemId: fifo.id }] });
    assert.equal((await db.query.inventoryCostLayer.findFirst({ where: eq(inventoryCostLayer.id, layer.id) }))!.remainingQuantity, 8);
    assert.equal((await VOID(req("POST"), params(fifoSale.id))).status, 200);
    assert.equal((await db.query.inventoryCostLayer.findFirst({ where: eq(inventoryCostLayer.id, layer.id) }))!.remainingQuantity, 10);
    const missingIssue = await posted(stockBody);
    const issue = (await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, missingIssue.id)))[0];
    await db.update(inventoryMovement).set({ referenceId: null }).where(eq(inventoryMovement.id, issue.id));
    await unchanged(async () => { assert.equal((await VOID(req("POST"), params(missingIssue.id))).status, 422); });
    await db.update(inventoryMovement).set({ referenceId: missingIssue.id }).where(eq(inventoryMovement.id, issue.id));
    await db.update(inventoryMovement).set({ value: issue.value - 1 }).where(eq(inventoryMovement.id, issue.id));
    await unchanged(async () => { assert.equal((await VOID(req("POST"), params(missingIssue.id))).status, 422); });
    await db.update(inventoryMovement).set({ value: issue.value }).where(eq(inventoryMovement.id, issue.id));
    const zeroCost = await db.insert(inventoryItem).values({ organizationId: a.id, code: "FREE", name: "Free", quantityOnHand: 5 }).returning();
    const freeSale = await posted({ ...basic, lines: [{ ...basic.lines[0], inventoryItemId: zeroCost[0].id }] });
    assert.equal((await VOID(req("POST"), params(freeSale.id))).status, 200);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, zeroCost[0].id) }))!.quantityOnHand, 5);
    // Rounded average cost can exceed remaining carrying value; issues cap at that
    // value, and REST/MCP voids restore the captured cost rather than unitCost * qty.
    for (const viaMcp of [false, true]) {
      const [residual] = await db.insert(inventoryItem).values({ organizationId: a.id, code: `RESIDUAL-${viaMcp}`, name: "Rounded average",
        quantityOnHand: 4, averageCost: 1, totalValue: 2 }).returning();
      const receipt = await make({ ...basic, lines: [{ ...basic.lines[0], quantity: 3, inventoryItemId: residual.id }] });
      if (viaMcp) assert.equal((await ma.call("post_sales_receipt", { salesReceiptId: receipt.id })).isError, false);
      else assert.equal((await POST_RECEIPT(req("POST"), params(receipt.id))).status, 200);
      const issued = (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, residual.id) }))!;
      assert.equal(issued.quantityOnHand, 1); assert.equal(issued.totalValue, 0);
      const [movement] = await db.select().from(inventoryMovement).where(eq(inventoryMovement.referenceId, receipt.id));
      assert.equal(movement.value, -2); assert.equal(movement.unitCost, 1);
      const cogs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, movement.journalEntryId!));
      assert.equal(cogs.reduce((sum, line) => sum + line.debitAmount, 0), 2);
      assert.equal(cogs.reduce((sum, line) => sum + line.creditAmount, 0), 2);
      if (viaMcp) assert.equal((await ma.call("void_sales_receipt", { salesReceiptId: receipt.id })).isError, false);
      else assert.equal((await VOID(req("POST"), params(receipt.id))).status, 200);
      const restored = (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, residual.id) }))!;
      assert.equal(restored.quantityOnHand, 4); assert.equal(restored.totalValue, 2); assert.equal(restored.averageCost, 1);
    }
    // Unsafe/corrupt stored rows are rejected and every failed operation preserves snapshots.
    const corrupt = await make(); await db.execute(sql`update sales_receipt set total=9007199254740992 where id=${corrupt.id}`);
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(corrupt.id))).status, 422); assert.equal((await POST_RECEIPT(req("POST"), params(corrupt.id))).status, 422); assert.equal((await ma.call("get_sales_receipt", { salesReceiptId: corrupt.id })).isError, true); });
    await db.update(salesReceipt).set({ total: 1250 }).where(eq(salesReceipt.id, corrupt.id));
    await db.execute(sql`update sales_receipt_line set unit_price=9007199254740992 where sales_receipt_id=${corrupt.id}`);
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(corrupt.id))).status, 422); assert.equal((await POST_RECEIPT(req("POST"), params(corrupt.id))).status, 422); });
    await db.update(salesReceiptLine).set({ unitPrice: 1250 }).where(eq(salesReceiptLine.salesReceiptId, corrupt.id));
    await db.update(salesReceiptLine).set({ accountId: foreignAccount.id }).where(eq(salesReceiptLine.salesReceiptId, corrupt.id));
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(corrupt.id))).status, 422); assert.equal((await POST_RECEIPT(req("POST"), params(corrupt.id))).status, 400); });
    await db.update(salesReceiptLine).set({ accountId: revenue.id }).where(eq(salesReceiptLine.salesReceiptId, corrupt.id));
    await db.update(salesReceipt).set({ total: 1 }).where(eq(salesReceipt.id, corrupt.id)); await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(corrupt.id))).status, 400); });
    await db.update(salesReceipt).set({ total: 1250 }).where(eq(salesReceipt.id, corrupt.id));
    const orphan = await posted(); await db.update(salesReceipt).set({ journalEntryId: null }).where(eq(salesReceipt.id, orphan.id)); await unchanged(async () => { assert.equal((await VOID(req("POST"), params(orphan.id))).status, 422); });
    const wrongJournal = await posted(); await db.update(salesReceipt).set({ journalEntryId: bankSale.journalEntryId }).where(eq(salesReceipt.id, wrongJournal.id));
    await unchanged(async () => { assert.equal((await VOID(req("POST"), params(wrongJournal.id))).status, 422); });
    const missingRevenue = await make(); await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, revenue.id));
    await unchanged(async () => { assert.equal((await POST_RECEIPT(req("POST"), params(missingRevenue.id))).status, 400); });
    // Historical reversals can still use inactive organization-owned accounts.
    assert.equal((await VOID(req("POST"), params(bankSale.id))).status, 200);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, revenue.id));
    // MAX_SAFE_INTEGER * quantity is a bigint intermediate that may safely cap at
    // carrying value. Use a genuinely unsafe stored cost to test numeric rejection.
    const unsafeStock = await make(stockBody); await db.execute(sql`update inventory_item set average_cost=9007199254740992 where id=${stock.id}`);
    await unchanged(async () => {
      const response = await POST_RECEIPT(req("POST"), params(unsafeStock.id));
      assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      const result = await ma.call("post_sales_receipt", { salesReceiptId: unsafeStock.id });
      assert.equal(result.isError, true); assert.equal(result.body.status, 422); assert.equal(result.body.code, "LEGACY_NUMERIC_RANGE");
    });
    await db.update(inventoryItem).set({ averageCost: 300 }).where(eq(inventoryItem.id, stock.id));
    // Faults after headers/sequence, ledger and stock writes roll everything back.
    await fault("sales_receipt_line", "insert", async () => { assert.equal((await POST(req("POST", basic))).status, 500); assert.equal((await ma.call("create_sales_receipt", basic)).isError, true); });
    await fault("sales_receipt_line", "insert", async () => { assert.equal((await PATCH(req("PATCH", { lines: basic.lines }), params(editable.id))).status, 500); });
    const faultRow = await make(stockBody);
    await fault("sales_receipt", "update", async () => { assert.equal((await POST_RECEIPT(req("POST", { bankAccountId: euroBank.id, depositAccountId: null }), params(faultRow.id))).status, 422);
      assert.equal((await POST_RECEIPT(req("POST", { bankAccountId: faultBank.id }), params(faultRow.id))).status, 500); });
    assert.equal((await POST_RECEIPT(req("POST"), params(faultRow.id))).status, 200);
    await fault("sales_receipt", "update", async () => { assert.equal((await VOID(req("POST"), params(faultRow.id))).status, 500); });
    // Mixed REST/MCP lifecycle callers serialize, including first-sequence drafts.
    const race = await make(stockBody);
    const races = await Promise.all([POST_RECEIPT(req("POST"), params(race.id)), ma.call("post_sales_receipt", { salesReceiptId: race.id })]);
    assert.equal(races.filter(result => result instanceof Response ? result.status === 200 : !result.isError).length, 1);
    const voidRaces = await Promise.all([VOID(req("POST"), params(race.id)), ma.call("void_sales_receipt", { salesReceiptId: race.id })]);
    assert.equal(voidRaces.filter(result => result instanceof Response ? result.status === 200 : !result.isError).length, 1);
    const newBody = { ...basic, contactId: foreignCustomer.id, lines: [{ ...basic.lines[0], accountId: foreignAccount.id }] };
    const creates = await Promise.all([POST(req("POST", newBody, keys.b)), mb.call("create_sales_receipt", newBody)]);
    const createdRest = await (creates[0] as Response).json(), createdMcp = creates[1] as Awaited<ReturnType<typeof mb.call>>;
    assert.deepEqual([createdRest.salesReceipt.receiptNumber, createdMcp.body.salesReceipt.receiptNumber].sort(), ["SR-00001", "SR-00002"]);
    const unbalanced = await db.execute(sql`select journal_entry_id from journal_line group by journal_entry_id having sum(debit_amount)!=sum(credit_amount)`); assert.equal(unbalanced.rows.length, 0);
    assert.ok((await db.execute(sql`select id from audit_log where entity_type='sales_receipt'`)).rows.length > 0);
    assert.ok((await db.select().from(inventoryMovement)).length > 0);
    console.log("REST and MCP sales receipts verified: exact/legacy/dual, CRUD, tenants, roles, locks, FX, stock, concurrency and rollback");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
