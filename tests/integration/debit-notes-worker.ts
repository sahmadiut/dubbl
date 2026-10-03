// Only runs in the randomly named disposable migrated database supplied by the harness.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql, and } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, debitNote, debitNoteLine,
  bill, journalLine, journalEntry, paymentAllocation, inventoryItem, inventoryCostLayer, warehouse, warehouseStock,
  periodLock, fiscalYear, exchangeRate, numberSequence } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/debit-notes/route";
import { GET as detail, PATCH as edit, DELETE as remove } from "../../app/api/v1/debit-notes/[id]/route";
import { POST as send } from "../../app/api/v1/debit-notes/[id]/send/route";
import { POST as apply } from "../../app/api/v1/debit-notes/[id]/apply/route";
import { POST as voidRoute } from "../../app/api/v1/debit-notes/[id]/void/route";
import { POST as createBill } from "../../app/api/v1/bills/route";
import { POST as receiveBill } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as voidBill } from "../../app/api/v1/bills/[id]/void/route";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Debit-note fixture", version: "1.0.0" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["list_debit_notes", "get_debit_note", "create_debit_note", "update_debit_note", "delete_debit_note", "send_debit_note", "apply_debit_note", "void_debit_note"])
    assert.equal(tools.filter(tool => tool.name === name).length, 1);
  assert.match(JSON.stringify(tools.find(t => t.name === "create_debit_note")!.inputSchema), /unitPriceExact/);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Debit A", slug: "dn-a" }, { name: "Debit B", slug: "dn-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "dn-owner@example.test" }, { email: "dn-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_dn_a", b: "dk_dn_b", viewer: "dk_dn_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_dn" });
  const [supplier, foreignSupplier, otherSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "supplier" },
    { organizationId: b.id, name: "B", type: "supplier" }, { organizationId: a.id, name: "Other", type: "supplier" }]).returning();
  const [expense, ap, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "500", name: "Expense", type: "expense" },
    { organizationId: a.id, code: "2100", name: "AP", type: "liability" }, { organizationId: b.id, code: "500", name: "Foreign", type: "expense" }]).returning();
  const [tax, foreignTax, partialTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "VAT", rate: 1000 },
    { organizationId: b.id, name: "Foreign", rate: 1000 }, { organizationId: a.id, name: "Partial", rate: 1000, recoverablePercent: 5000 }]).returning();
  const [store] = await db.insert(warehouse).values({ organizationId: a.id, code: "A", name: "Store" }).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/debit-notes${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const post = (body: unknown, key = keys.a) => create(request("POST", body, key));
  const patch = (id: string, body: unknown, key = keys.a) => edit(request("PATCH", body, key), params(id));
  const sent = (id: string, body?: unknown, key = keys.a) => send(request("POST", body, key), params(id));
  const applied = (id: string, body: unknown, key = keys.a) => apply(request("POST", body, key), params(id));
  const voided = (id: string, key = keys.a) => voidRoute(request("POST", undefined, key), params(id));
  const del = (id: string, key = keys.a) => remove(request("DELETE", undefined, key), params(id));
  const basic = { contactId: supplier.id, issueDate: "2026-10-03", currencyCode: "USD", lines: [{ description: "Expense", unitPrice: 12.5, accountId: expense.id }] };
  const draft = async (patch: Record<string, unknown> = {}) => {
    const response = await post({ ...basic, ...patch }); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).debitNote;
  };
  async function payable(patch: Record<string, unknown> = {}, recognize = true) {
    const response = await createBill(request("POST", { ...basic, dueDate: "2026-10-31", ...patch })); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    const row = (await response.json()).bill;
    if (!recognize) return row;
    const received = await receiveBill(request("POST"), params(row.id)); assert.equal(received.status, 200, JSON.stringify(await received.clone().json())); return (await received.json()).bill;
  }
  const tables = ["debit_note", "debit_note_line", "bill", "bill_line", "journal_entry", "journal_line", "payment", "payment_allocation",
    "inventory_item", "inventory_movement", "inventory_cost_layer", "warehouse_stock", "number_sequence", "audit_log", "document_email_log"];
  const snapshot = async () => Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(result => result.rows)));
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  const legs = (id: string) => db.select({ account: journalLine.accountId, debit: sql<string>`${journalLine.debitAmount}::text`, credit: sql<string>`${journalLine.creditAmount}::text`,
    rate: sql<string>`${journalLine.rateExact}::text`, exchange: journalLine.exchangeRate, currency: journalLine.currencyCode }).from(journalLine).where(eq(journalLine.journalEntryId, id));
  async function mirror(id: string) {
    const [reverse] = await db.select().from(journalEntry).where(eq(journalEntry.reversesEntryId, id)); assert.ok(reverse);
    const normalize = (rows: Awaited<ReturnType<typeof legs>>, swap = false) => rows.map(row => ({ ...row, debit: swap ? row.credit : row.debit, credit: swap ? row.debit : row.credit })).sort((x,y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    assert.deepEqual(normalize(await legs(reverse.id)), normalize(await legs(id), true));
  }
  try {
    const first = await Promise.all([draft(), draft()]); assert.notEqual(first[0].debitNoteNumber, first[1].debitNoteNumber);
    const target = await payable({ lines: [{ description: "Large payable", unitPriceMinor: "100000", accountId: expense.id }] });
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const row = await draft({ lines: [{ description: "Alias", ...price, accountId: expense.id }] });
      assert.equal(row.total, 1250); assert.equal(row.totalMinor, "1250"); assert.equal(row.organizationId, a.id);
      assert.equal((await patch(row.id, { notes: "REST edit" })).status, 200);
      assert.equal((await ma.call("update_debit_note", { debitNoteId: row.id, reference: "MCP edit" })).isError, false);
      const got = (await (await detail(request("GET"), params(row.id))).json()).debitNote;
      assert.equal(got.lines[0].unitPriceMinor, "1250"); assert.equal(got.lines[0].quantity, 100);
      assert.equal((await ma.call("get_debit_note", { debitNoteId: row.id })).body.debitNote.totalMinor, "1250");
      assert.ok((await (await list(request("GET", undefined, keys.a, "?limit=100"))).json()).data.some((r: { id: string }) => r.id === row.id));
      assert.ok((await ma.call("list_debit_notes", { limit: 100 })).body.debitNotes.some((r: { id: string }) => r.id === row.id));
      const recognized = await sent(row.id); assert.equal(recognized.status, 200, JSON.stringify(await recognized.clone().json()));
      const recognizedRow = (await recognized.json()).debitNote;
      assert.equal((await legs(recognizedRow.journalEntryId)).filter(l => l.account === ap.id).reduce((s,l) => s + BigInt(l.debit), 0n), 1250n);
      const result = await applied(row.id, { billId: target.id, amountMinor: "500" }); assert.equal(result.status, 200);
      assert.equal((await result.json()).debitNote.amountRemainingMinor, "750");
      assert.equal((await ma.call("apply_debit_note", { debitNoteId: row.id, billId: target.id, amount: 750, amountMinor: "750" })).body.debitNote.status, "applied");
      assert.equal((await db.select().from(paymentAllocation).where(eq(paymentAllocation.documentId, row.id))).length, 2);
      assert.equal((await voided(row.id)).status, 200); await mirror(recognizedRow.journalEntryId);
      assert.equal((await db.query.bill.findFirst({ where: eq(bill.id, target.id) }))!.amountPaid, 0);
    }
    for (const price of [{ unitPrice: 1250 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 1250, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const mc = await ma.call("create_debit_note", { ...basic, lines: [{ description: "MCP", ...price, accountId: expense.id }] }); assert.equal(mc.isError, false);
      const id = mc.body.debitNote.id; assert.equal(mc.body.debitNote.totalMinor, "1250");
      const sr = await ma.call("send_debit_note", { debitNoteId: id }); assert.equal(sr.isError, false);
      assert.equal((await ma.call("void_debit_note", { debitNoteId: id })).body.debitNote.amountRemainingMinor, "0"); await mirror(sr.body.debitNote.journalEntryId);
    }
    for (const amount of ["2147483648", String(Number.MAX_SAFE_INTEGER)]) {
      const row = await draft({ lines: [{ description: "Range", unitPriceMinor: amount, accountId: expense.id }] });
      const result = await sent(row.id); assert.equal(result.status, 200); assert.equal((await result.json()).debitNote.totalMinor, amount);
      assert.equal((await ma.call("void_debit_note", { debitNoteId: row.id })).isError, false);
    }
    const extended = await draft({ lines: [{ description: "Extended", quantity: 3, unitPriceExact: "0.005", accountId: expense.id }] }); assert.equal(extended.totalMinor, "2");
    assert.equal((await patch(extended.id, { lines: [{ description: "Discount", quantity: 1.5, unitPriceExact: "12.50", discountPercent: 1000, taxRateId: tax.id, accountId: expense.id }] })).status, 200);
    const extendedSent = (await (await sent(extended.id)).json()).debitNote; assert.equal(extendedSent.totalMinor, "1856");
    assert.equal((await voided(extended.id)).status, 200); await mirror(extendedSent.journalEntryId);
    const deleted = await draft(); assert.equal((await del(deleted.id)).status, 200);
    assert.equal((await detail(request("GET"), params(deleted.id))).status, 404); assert.equal((await db.select().from(debitNoteLine).where(eq(debitNoteLine.debitNoteId, deleted.id))).length, 1);
    const md = await draft(); assert.equal((await ma.call("delete_debit_note", { debitNoteId: md.id })).body.success, true);
    // Currency scale and saved bill FX, even when the live quote changes.
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "KWD", targetCurrency: "USD", date: "2026-10-01", rate: 3250000 });
    const fxTarget = await payable({ currencyCode: "KWD", lines: [{ description: "FX", unitPriceExact: "1.250", accountId: expense.id }] });
    await db.update(exchangeRate).set({ rate: 4000000 }).where(eq(exchangeRate.organizationId, a.id));
    const fx = await draft({ billId: fxTarget.id, currencyCode: "KWD", lines: [{ description: "FX", unitPriceExact: "1.250", accountId: expense.id }] });
    const fs = (await (await sent(fx.id)).json()).debitNote; assert.equal(fs.totalMinor, "1250");
    assert.equal((await legs(fs.journalEntryId)).reduce((s,l) => s + BigInt(l.debit), 0n), 406n);
    assert.equal((await applied(fx.id, { billId: fxTarget.id, amountMinor: "1250" })).status, 200);
    assert.equal((await voided(fx.id)).status, 200); await mirror(fs.journalEntryId);
    const otherFx = await draft({ currencyCode: "KWD" }); assert.equal((await sent(otherFx.id)).status, 200);
    await unchanged(async () => { assert.equal((await applied(otherFx.id, { billId: fxTarget.id, amountMinor: "1250" })).status, 422); });
    const jpy = await draft({ currencyCode: "JPY", lines: [{ description: "Scale", unitPriceExact: "1250" }] }); assert.equal(jpy.totalMinor, "1250");
    // Complete average/FIFO stock return copies saved receipt values and restores them on void.
    for (const method of ["average", "fifo"] as const) {
      const [item] = await db.insert(inventoryItem).values({ organizationId: a.id, code: method, name: method, costMethod: method }).returning();
      const stockBill = await payable({ lines: [{ description: "Stock", quantity: 2, unitPriceMinor: "1250", inventoryItemId: item.id, warehouseId: store.id }] });
      const note = await draft({ billId: stockBill.id, lines: [{ description: "Stock", quantity: 2, unitPriceMinor: "1250" }] });
      const originalLayers = await db.select().from(inventoryCostLayer).where(eq(inventoryCostLayer.inventoryItemId, item.id));
      const partial = await draft({ billId: stockBill.id, lines: [{ description: "Partial", unitPriceMinor: "1250" }] });
      await unchanged(async () => { assert.equal((await sent(partial.id)).status, 422); });
      if (method === "fifo") {
        await db.update(inventoryCostLayer).set({ remainingQuantity: 1 }).where(eq(inventoryCostLayer.id, originalLayers[0].id));
        await unchanged(async () => { assert.equal((await sent(note.id)).status, 422); });
        await db.update(inventoryCostLayer).set({ remainingQuantity: 2 }).where(eq(inventoryCostLayer.id, originalLayers[0].id));
      }
      await db.execute(sql.raw("create function fail_dn_stock() returns trigger language plpgsql as $$ begin raise exception 'synthetic stock failure'; end $$; create trigger fail_dn_stock before insert on inventory_movement for each row execute function fail_dn_stock()"));
      try { await unchanged(async () => { assert.equal((await sent(note.id)).status, 500); }); }
      finally { await db.execute(sql.raw("drop trigger fail_dn_stock on inventory_movement; drop function fail_dn_stock()")); }
      const sr = await sent(note.id); assert.equal(sr.status, 200, JSON.stringify(await sr.clone().json())); const recognized = (await sr.json()).debitNote;
      assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.quantityOnHand, 0);
      assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }))!.totalValue, 0);
      await unchanged(async () => { assert.equal((await voidBill(request("POST"), params(stockBill.id))).status, 400); });
      assert.equal((await applied(note.id, { billId: stockBill.id, amountMinor: "2500" })).status, 200);
      await db.execute(sql.raw("create function fail_dn_void() returns trigger language plpgsql as $$ begin raise exception 'synthetic void audit failure'; end $$; create trigger fail_dn_void before insert on audit_log for each row execute function fail_dn_void()"));
      try { await unchanged(async () => { assert.equal((await voided(note.id)).status, 500); }); }
      finally { await db.execute(sql.raw("drop trigger fail_dn_void on audit_log; drop function fail_dn_void()")); }
      assert.equal((await voided(note.id)).status, 200); await mirror(recognized.journalEntryId);
      const restored = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, item.id) }); assert.equal(restored!.quantityOnHand, 2); assert.equal(restored!.totalValue, 2500);
      assert.equal((await db.query.warehouseStock.findFirst({ where: eq(warehouseStock.inventoryItemId, item.id) }))!.quantity, 2);
      assert.deepEqual(await db.select().from(inventoryCostLayer).where(eq(inventoryCostLayer.inventoryItemId, item.id)), originalLayers);
      assert.equal((await voidBill(request("POST"), params(stockBill.id))).status, 200);
    }
    // Role/API-key/organization checks on each selected boundary.
    const editable = await draft();
    const foreign = (await mb.call("create_debit_note", { ...basic, contactId: foreignSupplier.id, lines: [{ description: "Foreign", unitPrice: 1250, accountId: foreignAccount.id }] })).body.debitNote;
    for (const [route, tool] of [[(id: string, key: string) => patch(id, {}, key), "update_debit_note"], [del, "delete_debit_note"],
      [(id: string, key: string) => sent(id, undefined, key), "send_debit_note"], [(id: string, key: string) => applied(id, { billId: target.id, amount: 1 }, key), "apply_debit_note"], [voided, "void_debit_note"]] as const) {
      await unchanged(async () => {
        assert.equal((await route(foreign.id, keys.a)).status, 404); assert.equal((await route(editable.id, keys.viewer)).status, 403); assert.equal((await route(editable.id, "dk_invalid")).status, 401);
        const args = { debitNoteId: editable.id, ...(tool === "apply_debit_note" ? { billId: target.id, amount: 1 } : {}) };
        assert.equal((await mb.call(tool, args)).body.status, 404); assert.equal((await ro.call(tool, args)).body.status, 403);
      });
    }
    await unchanged(async () => {
      assert.equal((await post(basic, keys.viewer)).status, 403); assert.equal((await post(basic, "dk_invalid")).status, 401);
      assert.equal((await ro.call("create_debit_note", { ...basic, lines: [{ description: "Denied", unitPrice: 1250 }] })).body.status, 403);
      assert.equal((await detail(request("GET"), params(foreign.id))).status, 404); assert.equal((await mb.call("get_debit_note", { debitNoteId: editable.id })).body.status, 404);
      for (const route of [list, (r: Request) => detail(r, params(editable.id))]) assert.equal((await route(request("GET", undefined, "dk_invalid"))).status, 401);
      assert.ok(!(await ma.call("list_debit_notes")).body.debitNotes.some((r: { id: string }) => r.id === foreign.id));
    });
    // Invalid aliases, range, references and mass assignment leave every business table unchanged.
    for (const input of [{ issueDate: "2026-02-30" }, { contactId: foreignSupplier.id }, { billId: foreign.id },
      { lines: [{ description: "Bad", unitPriceMinor: "01" }] }, { lines: [{ description: "Bad", unitPrice: 1, unitPriceExact: "2" }] },
      { lines: [{ description: "Bad", unitPriceMinor: "9007199254740992" }] }, { lines: [{ description: "Bad", unitPriceMinor: "9007199254740991", quantity: 2 }] },
      { lines: [{ description: "Bad", accountId: foreignAccount.id }] }, { lines: [{ description: "Bad", taxRateId: foreignTax.id }] }]) {
      await unchanged(async () => { assert.ok((await post({ ...basic, ...input })).status >= 400);
        assert.equal((await ma.call("create_debit_note", { ...basic, ...input, lines: "lines" in input ? input.lines : [{ description: "Bad reference", unitPrice: 1250, accountId: expense.id }] })).isError, true); });
    }
    for (const input of [{ total: 1 }, { organizationId: b.id }, { status: "sent" }, { amountApplied: 1 }, { journalEntryId: target.journalEntryId }])
      await unchanged(async () => { assert.equal((await patch(editable.id, input)).status, 400); });
    const noAccount = await draft({ lines: [{ description: "No account", unitPriceMinor: "1250" }] });
    const unsupportedTax = await draft({ lines: [{ description: "Partial VAT", unitPriceMinor: "1250", taxRateId: partialTax.id, accountId: expense.id }] });
    const negative = await draft({ lines: [{ description: "Negative", unitPriceMinor: "-1250", accountId: expense.id }] });
    const missingFx = await draft({ currencyCode: "JPY" });
    for (const row of [noAccount, unsupportedTax, negative, missingFx]) await unchanged(async () => { assert.ok((await sent(row.id)).status >= 400); });
    const orphan = await draft(); await db.update(debitNote).set({ status: "sent", amountRemaining: 1250 }).where(eq(debitNote.id, orphan.id));
    await unchanged(async () => { assert.equal((await applied(orphan.id, { billId: target.id, amount: 1 })).status, 422); assert.equal((await voided(orphan.id)).status, 422); });
    const unsafe = await draft(); await db.execute(sql`update debit_note set total = 9007199254740992 where id = ${unsafe.id}`);
    await unchanged(async () => { assert.equal((await sent(unsafe.id)).status, 422); assert.equal((await detail(request("GET"), params(unsafe.id))).status, 422); });
    await db.execute(sql`update debit_note set total = 1250 where id = ${unsafe.id}`);
    const openNote = await draft(); await sent(openNote.id);
    const historical = await draft(); const historicalSent = (await (await sent(historical.id)).json()).debitNote;
    await db.update(journalEntry).set({ sourceId: null }).where(eq(journalEntry.id, historicalSent.journalEntryId));
    assert.equal((await detail(request("GET"), params(historical.id))).status, 200);
    await unchanged(async () => { assert.equal((await applied(historical.id, { billId: target.id, amount: 1 })).status, 422); assert.equal((await voided(historical.id)).status, 422); });
    const draftBill = await payable({}, false), otherBill = await payable({ contactId: otherSupplier.id });
    for (const body of [{ billId: draftBill.id, amount: 1 }, { billId: otherBill.id, amount: 1 }, { billId: target.id, amount: 0 },
      { billId: target.id, amountMinor: "9007199254740992" }, { billId: target.id, amount: 2, amountMinor: "1" }, { billId: target.id, amount: 1251 }])
      await unchanged(async () => { assert.ok((await applied(openNote.id, body)).status >= 400); assert.equal((await ma.call("apply_debit_note", { debitNoteId: openNote.id, ...body })).isError, true); });
    await unchanged(async () => { assert.equal((await sent(editable.id, { sendEmail: true })).status, 400); });
    for (const query of ["?limit=NaN", "?page=1.5", "?from=2026-02-30", "?status=bad", "?page=999999999", "?sortBy=amount"])
      await unchanged(async () => { assert.equal((await list(request("GET", undefined, keys.a, query))).status, 400); });
    await unchanged(async () => { assert.equal((await create(new Request("http://fixture.test/", { method: "POST", headers: { authorization: `Bearer ${keys.a}`, "content-type": "application/json" }, body: "{" }))).status, 400); });
    const emailNote = await draft();
    const emailFailed = await sent(emailNote.id, { sendEmail: true, recipientEmail: "fixture@example.test", subject: "Synthetic email",
      templateProps: { organizationName: "Fixture", contactName: "Supplier", documentType: "Debit note", documentNumber: emailNote.debitNoteNumber } });
    assert.equal(emailFailed.status, 502); assert.equal((await emailFailed.json()).debitNote.status, "sent");
    assert.equal((await db.query.debitNote.findFirst({ where: eq(debitNote.id, emailNote.id) }))!.status, "sent");
    await unchanged(async () => { assert.equal((await sent(emailNote.id)).status, 400); });
    // Strict period/closed-year checks precede posting, allocation, edit, delete and void.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-03" }).returning();
    await unchanged(async () => {
      for (const route of [() => post(basic), () => patch(editable.id, {}), () => del(editable.id), () => sent(editable.id),
        () => applied(openNote.id, { billId: target.id, amount: 1 }), () => voided(openNote.id)]) assert.equal((await route()).status, 422);
    }); await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    await unchanged(async () => { assert.equal((await sent(editable.id)).status, 422); }); await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    // Inject failures after mutations to establish transactional rollback including audit.
    for (const [table, action] of [["debit_note_line", () => post(basic)], ["journal_line", () => sent(editable.id)],
      ["payment_allocation", () => applied(openNote.id, { billId: target.id, amount: 1 })], ["audit_log", () => voided(openNote.id)]] as const) {
      await db.execute(sql.raw(`create function fail_dn() returns trigger language plpgsql as $$ begin raise exception 'synthetic debit failure'; end $$; create trigger fail_dn before insert on ${table} for each row execute function fail_dn()`));
      try { await unchanged(async () => { assert.equal((await action()).status, 500); }); }
      finally { await db.execute(sql.raw(`drop trigger fail_dn on ${table}; drop function fail_dn()`)); }
    }
    // Concurrent send/application/void each commit once and preserve sums.
    const concurrent = await draft(); assert.deepEqual((await Promise.all([sent(concurrent.id), sent(concurrent.id)])).map(r => r.status).sort(), [200, 400]);
    const result = await Promise.all([applied(concurrent.id, { billId: target.id, amount: 1250 }), applied(concurrent.id, { billId: target.id, amount: 1250 })]);
    assert.deepEqual(result.map(r => r.status).sort(), [200, 400]);
    const voids = await Promise.all([voided(concurrent.id), voided(concurrent.id)]); assert.deepEqual(voids.map(r => r.status).sort(), [200, 400]);
    const numbering = await Promise.all([draft(), draft()]); assert.notEqual(numbering[0].debitNoteNumber, numbering[1].debitNoteNumber);
    assert.equal((await db.select().from(paymentAllocation).where(and(eq(paymentAllocation.documentType, "debit_note"), eq(paymentAllocation.documentId, concurrent.id)))).length, 0);
    const [seq] = await db.select().from(numberSequence).where(and(eq(numberSequence.organizationId, a.id), eq(numberSequence.entityType, "debit_note")));
    await db.update(numberSequence).set({ lastNumber: 2147483647 }).where(eq(numberSequence.id, seq.id));
    await unchanged(async () => { assert.equal((await post(basic)).status, 422); });
    await db.update(numberSequence).set({ lastNumber: seq.lastNumber }).where(eq(numberSequence.id, seq.id));
  } finally { await ma.close(); await mb.close(); await ro.close(); }
  console.log("REST and MCP debit notes verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
