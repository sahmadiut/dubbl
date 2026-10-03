// Runs only in the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, costCenter, inventoryItem,
  priceList, priceListItem, quote, quoteLine, invoiceLine, periodLock } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/quotes/route";
import { GET, PATCH, DELETE } from "../../app/api/v1/quotes/[id]/route";
import { POST as SEND } from "../../app/api/v1/quotes/[id]/send/route";
import { POST as ACCEPT } from "../../app/api/v1/quotes/[id]/accept/route";
import { POST as DECLINE } from "../../app/api/v1/quotes/[id]/decline/route";
import { POST as CONVERT } from "../../app/api/v1/quotes/[id]/convert/route";
import { registerQuoteTools } from "../../lib/mcp/tools/quotes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Quote fixture", version: "1.0.0" }); registerQuoteTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 9);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_quote")!.inputSchema).includes("unitPriceMinor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Quote A", slug: "qa" }, { name: "Quote B", slug: "qb" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "quote-owner@example.test" }, { email: "quote-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_quote_a", b: "dk_quote_b", viewer: "dk_quote_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_quote" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer", paymentTermsDays: 0 }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "400", name: "Revenue", type: "revenue" }, { organizationId: b.id, code: "400", name: "Foreign", type: "revenue" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, name: "Center", code: "A" }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [item, foreignItem] = await db.insert(inventoryItem).values([{ organizationId: a.id, name: "Item", code: "A", salePrice: 999 }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [list, foreignList, euroList] = await db.insert(priceList).values([{ organizationId: a.id, name: "USD" }, { organizationId: b.id, name: "Foreign" }, { organizationId: a.id, name: "EUR", currencyCode: "EUR" }]).returning();
  await db.insert(priceListItem).values([{ priceListId: list.id, inventoryItemId: item.id, minQuantity: 1, unitPrice: 800 }, { priceListId: list.id, inventoryItemId: item.id, minQuantity: 3, unitPrice: 700 }]);
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method: string, body?: unknown, key = keys.a, raw?: string) => new Request("http://fixture.test/api/v1/quotes", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(raw !== undefined ? { body: raw } : body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const basic = { contactId: customer.id, issueDate: "2026-10-01", expiryDate: "2099-01-01", reference: "REF", notes: "Notes", lines: [{ description: "Line", unitPriceMinor: "1250" }] };
  const make = async (body: unknown = basic) => { const response = await POST(req("POST", body)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).quote; };
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(q)::text order by q.id),'[]'::jsonb) from quote q) quotes,
    (select coalesce(jsonb_agg(to_jsonb(l)::text order by l.id),'[]'::jsonb) from quote_line l) lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from invoice i) invoices,
    (select coalesce(jsonb_agg(to_jsonb(l)::text order by l.id),'[]'::jsonb) from invoice_line l) invoice_lines,
    (select coalesce(jsonb_agg(to_jsonb(s)::text order by s.id),'[]'::jsonb) from number_sequence s) sequences,
    (select count(*)::text from audit_log) audits`)).rows;
  const unchanged = async (operation: () => Promise<unknown>) => { const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before); };
  const accepted = async (body: unknown = basic) => {
    const row = await make(body); assert.equal((await SEND(req("POST"), params(row.id))).status, 200);
    assert.equal((await ma.call("accept_quote", { quoteId: row.id })).isError, false); return row.id;
  };
  try {
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }, { unitPriceExact: "12.50" }, { unitPrice: 12.5, unitPriceMinor: "1250", unitPriceExact: "12.50" }]) {
      const body = { ...basic, lines: [{ description: "Line", ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax.id, accountId: account.id, costCenterId: center.id }] };
      const row = await make(body); assert.equal(row.totalMinor, "1856"); assert.equal(row.total, 1856);
      const mbody = { ...body, lines: body.lines.map(line => ({ ...line, unitPrice: line.unitPrice === undefined ? undefined : 1250 })) };
      const made = await ma.call("create_quote", mbody); assert.equal(made.isError, false); assert.equal(made.body.quote.totalMinor, "1856");
      const read = await (await GET(req("GET"), params(row.id))).json(); assert.equal(read.quote.lines[0].quantity, 150); assert.equal(read.quote.lines[0].unitPriceMinor, "1250");
      assert.equal((await ma.call("get_quote", { quoteId: row.id })).body.quote.totalMinor, "1856");
      assert.equal((await PATCH(req("PATCH", { notes: "Edited" }), params(row.id))).status, 200);
      assert.equal((await ma.call("update_quote", { quoteId: made.body.quote.id, lines: [{ description: "Changed", unitPrice: 99 }] })).body.quote.totalMinor, "99");
      assert.equal((await DELETE(req("DELETE"), params(row.id))).status, 200);
      assert.equal((await ma.call("delete_quote", { quoteId: made.body.quote.id })).body.success, true);
      assert.equal((await GET(req("GET"), params(row.id))).status, 404);
    }
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      const body = { ...basic, currencyCode: currency }; assert.equal((await make(body)).totalMinor, "1250");
      assert.equal((await ma.call("create_quote", body)).body.quote.totalMinor, "1250");
      const id = await accepted(body), converted = await CONVERT(req("POST"), params(id)); assert.equal(converted.status, 200);
      const payload = await converted.json(); assert.equal(payload.invoice.totalMinor, "1250"); assert.equal(payload.invoice.currencyCode, currency);
    }
    assert.equal((await make({ ...basic, lines: [{ description: "Half", quantity: 3, unitPriceExact: "0.005" }] })).total, 3);
    const lookup = { ...basic, priceListId: list.id, lines: [{ description: "Item", quantity: 3, inventoryItemId: item.id }] };
    assert.equal((await make(lookup)).total, 2100); assert.equal((await ma.call("create_quote", lookup)).body.quote.total, 2100);
    assert.equal((await make({ ...lookup, priceListId: undefined })).total, 2997);
    assert.equal((await ma.call("create_quote", { ...lookup, priceListId: undefined })).body.quote.total, 2997);
    assert.equal((await make({ ...lookup, lines: [{ ...lookup.lines[0], unitPriceMinor: "500" }] })).total, 1500);
    await db.update(priceList).set({ isActive: false }).where(eq(priceList.id, list.id)); assert.equal((await make(lookup)).total, 2997);
    await db.update(priceList).set({ isActive: true, effectiveFrom: "2026-10-02" }).where(eq(priceList.id, list.id)); assert.equal((await make(lookup)).total, 2997);
    await db.update(priceList).set({ effectiveFrom: null }).where(eq(priceList.id, list.id));
    const editable = await make();
    assert.equal((await PATCH(req("PATCH", { currencyCode: "KWD" }), params(editable.id))).status, 200);
    assert.equal((await ma.call("get_quote", { quoteId: editable.id })).body.quote.totalMinor, "1250");
    assert.equal((await PATCH(req("PATCH", { currencyCode: "USD" }), params(editable.id))).status, 200);
    for (const [field, foreign] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id], ["costCenterId", foreignCenter.id], ["inventoryItemId", foreignItem.id], ["priceListId", foreignList.id]] as const) {
      const lines = [{ description: "Foreign", unitPriceMinor: "1250", [field]: foreign }];
      await unchanged(async () => { assert.equal((await POST(req("POST", { ...basic, lines }))).status, 400);
        assert.equal((await ma.call("create_quote", { ...basic, lines })).isError, true);
        assert.equal((await PATCH(req("PATCH", { lines }), params(editable.id))).status, 400); });
    }
    for (const bad of [{ ...basic, contactId: foreignCustomer.id }, { ...basic, issueDate: "2026-02-30" }, { ...lookup, priceListId: euroList.id },
      { ...lookup, currencyCode: "EUR", priceListId: undefined }, ...[{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "01" },
        { unitPriceExact: "1e3" }, { unitPriceMinor: "9007199254740991", quantity: 2 }, { unitPriceMinor: "1250", unitPrice: 1 }].map(line => ({ ...basic, lines: [{ description: "Bad", ...line }] }))])
      await unchanged(async () => { assert.ok([400, 422].includes((await POST(req("POST", bad))).status)); assert.equal((await ma.call("create_quote", bad)).isError, true); });
    for (const body of [{ organizationId: b.id }, { status: "accepted" }, { total: 1 }, { contactId: foreignCustomer.id }])
      await unchanged(async () => { assert.equal((await PATCH(req("PATCH", body), params(editable.id))).status, 400); });
    await unchanged(async () => {
      assert.equal((await POST(req("POST", basic, "dk_invalid"))).status, 401);
      assert.equal((await POST(req("POST", basic, keys.viewer))).status, 403); assert.equal((await ro.call("create_quote", basic)).body.status, 403);
      for (const handler of [PATCH, DELETE, SEND, ACCEPT, DECLINE, CONVERT]) {
        assert.equal((await handler(req(handler === PATCH ? "PATCH" : handler === DELETE ? "DELETE" : "POST", {}, keys.viewer), params(editable.id))).status, 403);
        assert.equal((await handler(req(handler === PATCH ? "PATCH" : handler === DELETE ? "DELETE" : "POST", {}, keys.b), params(editable.id))).status, 404);
      }
      for (const name of ["update_quote", "delete_quote", "send_quote", "accept_quote", "decline_quote", "convert_quote_to_invoice"]) {
        assert.equal((await ro.call(name, { quoteId: editable.id })).body.status, 403);
        assert.equal((await mb.call(name, { quoteId: editable.id })).body.status, 404);
      }
      assert.equal((await GET(req("GET", undefined, keys.b), params(editable.id))).status, 404);
      assert.equal((await mb.call("get_quote", { quoteId: editable.id })).body.status, 404);
    });
    assert.equal((await (await LIST(req("GET"))).json()).data.some((row: { id: string }) => row.id === editable.id), true);
    assert.equal((await ma.call("list_quotes")).body.quotes.some((row: { id: string }) => row.id === editable.id), true);
    assert.equal((await mb.call("list_quotes")).body.total, 0);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-09-30" });
    await unchanged(async () => { assert.equal((await POST(req("POST", { ...basic, issueDate: "2026-09-01" }))).status, 422);
      assert.equal((await PATCH(req("PATCH", { issueDate: "2026-09-01" }), params(editable.id))).status, 422); });
    await db.update(quote).set({ issueDate: "2026-09-01" }).where(eq(quote.id, editable.id));
    await unchanged(async () => { assert.equal((await SEND(req("POST"), params(editable.id))).status, 422); assert.equal((await DELETE(req("DELETE"), params(editable.id))).status, 422); });
    await unchanged(async () => { assert.equal((await PATCH(req("PATCH", { issueDate: "2026-10-02" }), params(editable.id))).status, 422); });
    await db.delete(periodLock); await db.update(quote).set({ issueDate: basic.issueDate }).where(eq(quote.id, editable.id));
    await unchanged(async () => { assert.equal((await SEND(req("POST", { sendEmail: true }), params(editable.id))).status, 400); });
    assert.equal((await ma.call("send_quote", { quoteId: editable.id })).isError, false);
    assert.equal((await DECLINE(req("POST"), params(editable.id))).status, 200);
    const expired = await make({ ...basic, expiryDate: "2026-01-01" }); await ma.call("send_quote", { quoteId: expired.id });
    await unchanged(async () => { assert.equal((await ACCEPT(req("POST"), params(expired.id))).status, 400); assert.equal((await ma.call("accept_quote", { quoteId: expired.id })).body.status, 400); });
    const billId = await accepted({ ...basic, lines: [{ description: "Taxed", unitPriceMinor: "1250", discountPercent: 1000, taxRateId: tax.id, accountId: account.id, costCenterId: center.id }] });
    const first = await CONVERT(req("POST", { percentage: 50 }), params(billId)); assert.equal(first.status, 200); const round = await first.json();
    assert.equal(round.billing.invoicedMinor, "620"); assert.equal(round.quote.status, "accepted"); assert.equal(round.invoice.reference, "REF");
    const second = await ma.call("convert_quote_to_invoice", { quoteId: billId }); assert.equal(second.isError, false);
    assert.equal(second.body.billing.invoicedMinor, "618"); assert.equal(second.body.billing.remainingMinor, "0"); assert.equal(second.body.quote.status, "converted");
    assert.equal(second.body.quote.convertedInvoiceId, second.body.invoice.id);
    const copied = await db.query.invoiceLine.findFirst({ where: eq(invoiceLine.invoiceId, round.invoice.id) }); assert.equal(copied?.costCenterId, center.id); assert.equal(copied?.accountId, account.id);
    const milestoneId = await accepted(), milestoneLine = (await db.query.quoteLine.findFirst({ where: eq(quoteLine.quoteId, milestoneId) }))!;
    const milestone = await ma.call("convert_quote_to_invoice", { quoteId: milestoneId, percentage: 100, lines: [{ quoteLineId: milestoneLine.id, quantity: 0.5 }] });
    assert.equal(milestone.body.billing.invoicedMinor, "625");
    await unchanged(async () => { assert.equal((await CONVERT(req("POST", undefined, keys.a, "{bad"), params(milestoneId))).status, 400);
      const over = await CONVERT(req("POST", { percentage: 100 }), params(milestoneId)); assert.equal(over.status, 400);
      const payload = await over.json(); assert.equal(payload.remaining, 625); assert.equal(payload.remainingMinor, "625"); assert.equal(payload.requestedMinor, "1250");
      assert.equal((await ma.call("convert_quote_to_invoice", { quoteId: milestoneId, lines: [{ quoteLineId: randomUUID(), quantity: 1 }] })).isError, true); });
    const pennyId = await accepted({ ...basic, lines: [1, 2, 3].map(n => ({ description: `Penny ${n}`, unitPriceMinor: "1" })) });
    const pennyLine = (await db.query.quoteLine.findFirst({ where: eq(quoteLine.quoteId, pennyId) }))!;
    assert.equal((await ma.call("convert_quote_to_invoice", { quoteId: pennyId, lines: [{ quoteLineId: pennyLine.id, quantity: 1 }] })).body.billing.invoiced, 1);
    const pennyRest = await (await CONVERT(req("POST"), params(pennyId))).json(); assert.equal(pennyRest.billing.invoiced, 2); assert.equal(pennyRest.billing.remaining, 0);
    const lockedConversion = await accepted();
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2099-01-01" });
    await unchanged(async () => { assert.equal((await CONVERT(req("POST"), params(lockedConversion))).status, 422);
      assert.equal((await ma.call("convert_quote_to_invoice", { quoteId: lockedConversion })).body.status, 422); });
    await db.delete(periodLock);
    const raceId = await accepted(); const race = await Promise.all([CONVERT(req("POST"), params(raceId)), ma.call("convert_quote_to_invoice", { quoteId: raceId })]);
    assert.equal(Number(race[0].status === 200) + Number(!race[1].isError), 1);
    const sendRace = await make(); const sends = await Promise.all([SEND(req("POST"), params(sendRace.id)), ma.call("send_quote", { quoteId: sendRace.id })]);
    assert.equal(Number(sends[0].status === 200) + Number(!sends[1].isError), 1);
    const wide = await make({ ...basic, lines: [{ description: "Wide", unitPriceMinor: "2147483648" }] }); assert.equal(wide.total, 2147483648);
    const max = await accepted({ ...basic, lines: [{ description: "Max", unitPriceMinor: "9007199254740991" }] });
    assert.equal((await ma.call("convert_quote_to_invoice", { quoteId: max })).body.invoice.totalMinor, "9007199254740991");
    const unsafe = await make(); await db.execute(sql`update quote set total = 9007199254740992 where id = ${unsafe.id}`);
    await unchanged(async () => { assert.equal((await PATCH(req("PATCH", { notes: "Bad" }), params(unsafe.id))).status, 422);
      assert.equal((await DELETE(req("DELETE"), params(unsafe.id))).status, 422); assert.equal((await ma.call("send_quote", { quoteId: unsafe.id })).body.status, 422); });
    await db.update(quote).set({ total: 1250 }).where(eq(quote.id, unsafe.id));
    await db.execute(sql`update quote_line set amount = 9007199254740992 where quote_id = ${unsafe.id}`);
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(unsafe.id))).status, 422); assert.equal((await ma.call("delete_quote", { quoteId: unsafe.id })).body.status, 422); });
    await db.update(quoteLine).set({ amount: 1250, accountId: foreignAccount.id }).where(eq(quoteLine.quoteId, unsafe.id));
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(unsafe.id))).status, 422); assert.equal((await SEND(req("POST"), params(unsafe.id))).status, 400); });
    await db.update(quoteLine).set({ accountId: null }).where(eq(quoteLine.quoteId, unsafe.id));
    await db.update(contact).set({ creditLimit: Number.MAX_SAFE_INTEGER }).where(eq(contact.id, customer.id));
    await db.execute(sql`update contact set credit_limit = 9007199254740992 where id = ${customer.id}`);
    assert.equal((await GET(req("GET"), params(unsafe.id))).status, 422); assert.equal((await ma.call("list_quotes")).body.status, 422);
    await db.update(contact).set({ creditLimit: null }).where(eq(contact.id, customer.id));
    await db.update(quote).set({ contactId: foreignCustomer.id }).where(eq(quote.id, unsafe.id));
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(unsafe.id))).status, 422); assert.equal((await PATCH(req("PATCH", { notes: "Foreign saved" }), params(unsafe.id))).status, 400); });
    await db.update(quote).set({ contactId: customer.id }).where(eq(quote.id, unsafe.id));
    await db.update(quoteLine).set({ accountId: account.id }).where(eq(quoteLine.quoteId, unsafe.id));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, account.id));
    assert.equal((await PATCH(req("PATCH", { notes: "Retained inactive" }), params(unsafe.id))).status, 200);
    await unchanged(async () => { assert.equal((await PATCH(req("PATCH", { lines: [{ description: "New inactive", accountId: account.id, unitPriceMinor: "1250" }] }), params(unsafe.id))).status, 400); });
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, account.id));
    const overflowing = { ...basic, lines: [{ description: "Max", unitPriceMinor: "9007199254740991" }, { description: "One", unitPriceMinor: "1" }] };
    await unchanged(async () => { assert.equal((await POST(req("POST", overflowing))).status, 422); assert.equal((await ma.call("create_quote", overflowing)).body.status, 422); });
    // Database faults after numbering/header/line writes must roll back the whole operation.
    await db.execute(sql`create function quote_fixture_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$`);
    await db.execute(sql`create trigger quote_fixture_fail before insert on quote_line for each row execute function quote_fixture_fail()`);
    await unchanged(async () => { assert.equal((await POST(req("POST", basic))).status, 500); assert.equal((await PATCH(req("PATCH", { lines: basic.lines }), params(unsafe.id))).status, 500); });
    await db.execute(sql`drop trigger quote_fixture_fail on quote_line`);
    await db.execute(sql`create trigger quote_fixture_fail before update on quote for each row execute function quote_fixture_fail()`);
    await unchanged(async () => { assert.equal((await DELETE(req("DELETE"), params(unsafe.id))).status, 500); });
    await db.execute(sql`drop trigger quote_fixture_fail on quote`);
    const rollback = await accepted(); await db.execute(sql`create trigger quote_fixture_fail before update on quote for each row execute function quote_fixture_fail()`);
    await unchanged(async () => { assert.equal((await CONVERT(req("POST"), params(rollback))).status, 500); });
    await db.execute(sql`drop trigger quote_fixture_fail on quote`); await db.execute(sql`drop function quote_fixture_fail()`);
    const consecutive = await Promise.all([make(), make(), ma.call("create_quote", basic)]);
    assert.equal(new Set([consecutive[0].quoteNumber, consecutive[1].quoteNumber, consecutive[2].body.quote.quoteNumber]).size, 3);
    console.log("REST and MCP quotes verified: units, aliases, auth, scope, state, locks, prices, residuals, races and rollback");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
