// Runs only in bill-reads.test.ts's randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate,
  bill, billLine, billStatusEnum, exchangeRate } from "../../lib/db/schema";
import { GET as list } from "../../app/api/v1/bills/route";
import { GET as get } from "../../app/api/v1/bills/[id]/route";
import { GET as counts } from "../../app/api/v1/bills/counts/route";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bill reads fixture", version: "1.0.0" });
  registerBillTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some(tool => tool.name === "get_bill"));
  assert.ok(tools.some(tool => tool.name === "get_bill_counts"));
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
  const [a, b] = await db.insert(organization).values([{ name: "Bill A", slug: "bill-a" },
    { name: "Bill B", slug: "bill-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "bill-owner@example.test" }, { email: "bill-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Reads only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_bill_a", b: "dk_bill_b", viewer: "dk_bill_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bill" });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "supplier", creditLimit: 3000 },
    { organizationId: b.id, name: "B", type: "supplier", creditLimit: null }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Expense", code: "500", type: "expense", isActive: false },
    { organizationId: b.id, name: "Secret expense", code: "500", type: "expense" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Tax", rate: 1000 },
    { organizationId: b.id, name: "Foreign tax", rate: 1000 }]).returning();
  let serial = 0;
  const make = async (amount = 1250, currencyCode = "USD", orgId = a.id, contactId = supplier.id) => {
    const [row] = await db.insert(bill).values({ organizationId: orgId, contactId, billNumber: `BILL-${++serial}`,
      issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, subtotal: amount, total: amount, amountDue: amount }).returning();
    await db.insert(billLine).values({ billId: row.id, description: "Item", unitPrice: amount, amount,
      quantity: 150, discountPercent: 1000, accountId: orgId === a.id ? account.id : foreignAccount.id,
      taxRateId: orgId === a.id ? tax.id : foreignTax.id });
    return row;
  };
  const request = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/bills${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  // SQL JSON text keeps every digit, including deliberately unsupported history.
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from bill i) as bills,
    (select coalesce(jsonb_agg(to_jsonb(l)::text order by l.id),'[]'::jsonb) from bill_line l) as lines,
    (select coalesce(jsonb_agg(to_jsonb(c)::text order by c.id),'[]'::jsonb) from contact c) as contacts,
    (select coalesce(jsonb_agg(to_jsonb(r)::text order by r.id),'[]'::jsonb) from exchange_rate r) as rates,
    (select count(*)::text from audit_log) as audits,
    (select count(*)::text from journal_entry) as journals,
    (select count(*)::text from payment_allocation) as allocations,
    (select count(*)::text from inventory_movement) as movements`)).rows;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  try {
    assert.deepEqual(await (await counts(request())).json(), { counts: {}, total: 0 });
    assert.deepEqual((await ma.call("get_bill_counts")).body, { counts: {}, total: 0 });
    const made: Awaited<ReturnType<typeof make>>[] = [];
    for (const amount of [1250, 2147483648, Number.MAX_SAFE_INTEGER, -1250]) {
      const row = await make(amount); made.push(row);
      const before = await snapshot();
      const res = await get(request(), params(row.id)); assert.equal(res.status, 200);
      const dto = await res.json();
      assert.equal(dto.bill.organizationId, a.id);
      for (const field of ["total", "subtotal", "amountDue"]) {
        assert.equal(dto.bill[field], amount); assert.equal(dto.bill[`${field}Minor`], String(amount));
      }
      assert.equal(dto.bill.taxTotalMinor, "0"); assert.equal(dto.bill.amountPaidMinor, "0");
      assert.equal(dto.bill.lines[0].unitPriceMinor, String(amount)); assert.equal(dto.bill.lines[0].amountMinor, String(amount));
      assert.equal(dto.bill.lines[0].taxAmountMinor, "0"); assert.equal(dto.bill.lines[0].quantity, 150);
      assert.equal(dto.bill.lines[0].discountPercent, 1000); assert.equal(dto.bill.contact.creditLimitMinor, "3000");
      assert.equal(dto.base.amounts.totalMinor, String(amount)); assert.equal(dto.base.rateExact, "1");
      assert.equal(dto.base.rateDirection, "quote_per_base"); assert.equal(dto.base.rateBasis, "historical_lookup_millionths");
      const m = await ma.call("get_bill", { billId: row.id }); assert.equal(m.isError, false); assert.deepEqual(m.body, dto);
      assert.equal((await readOnly.call("get_bill", { billId: row.id })).isError, false);
      assert.equal((await get(request("", keys.viewer), params(row.id))).status, 200);
      assert.deepEqual(await snapshot(), before);
    }
    for (const currency of ["IRR", "JPY", "KWD", "EUR"]) {
      const row = await make(1250, currency);
      const dto = await (await get(request(), params(row.id))).json();
      assert.equal(dto.bill.totalMinor, "1250"); assert.equal(dto.base.amounts.totalMinor, null); assert.equal(dto.base.rateExact, null);
      assert.equal((await ma.call("get_bill", { billId: row.id })).body.bill.totalMinor, "1250");
    }
    const foreign = await make(50, "USD", b.id, foreignSupplier.id);
    await db.update(bill).set({ deletedAt: new Date() }).where(eq(bill.id, made[0].id));
    let snap = await snapshot();
    const restList = await list(request("?limit=100")); assert.equal(restList.status, 200);
    const page = await restList.json(); assert.equal(page.data.length, 7); assert.equal(page.pagination.total, 7);
    assert.ok(page.data.every((row: { organizationId: string; totalMinor: string }) => row.organizationId === a.id && typeof row.totalMinor === "string"));
    const ml = await ma.call("list_bills", { limit: 100 }); assert.equal(ml.isError, false);
    assert.deepEqual(ml.body.bills, page.data); assert.equal(ml.body.total, page.pagination.total);
    const nextPage = await (await list(request("?limit=2&page=2"))).json();
    assert.deepEqual(nextPage.data, page.data.slice(2, 4));
    assert.deepEqual((await ma.call("list_bills", { limit: 2, page: 2 })).body.bills, nextPage.data);
    assert.equal((await list(request("", keys.viewer))).status, 200);
    assert.equal((await readOnly.call("list_bills")).isError, false);
    assert.equal((await get(request(), params(foreign.id))).status, 404);
    assert.equal((await mb.call("get_bill", { billId: made[1].id })).body.status, 404);
    assert.equal((await get(request(), params(made[0].id))).status, 404);
    assert.equal((await ma.call("get_bill", { billId: made[0].id })).body.status, 404);
    for (const handler of [list, counts]) assert.equal((await handler(request("", "dk_invalid"))).status, 401);
    assert.equal((await get(request("", "dk_invalid"), params(made[1].id))).status, 401);
    for (const query of ["?status=unknown", "?page=not-a-page", "?page=21474837", "?limit=not-a-number"]) assert.equal((await list(request(query))).status, 400);
    assert.equal((await ma.call("list_bills", { page: 21474837 })).isError, true);
    assert.equal((await get(request(), params("malformed"))).status, 400);
    assert.equal((await ma.call("get_bill", { billId: "malformed" })).isError, true);
    assert.deepEqual(await snapshot(), snap);
    await db.update(bill).set({ status: "pending_approval" }).where(eq(bill.id, made[1].id));
    const filtered = await (await list(request("?status=pending_approval"))).json();
    assert.equal(filtered.pagination.total, 1); assert.equal(filtered.data[0].id, made[1].id);
    assert.deepEqual((await ma.call("list_bills", { status: "pending_approval" })).body.bills, filtered.data);
    // Historical inactive/deleted same-tenant references remain visible. Foreign references fail.
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, supplier.id));
    assert.equal((await get(request(), params(made[1].id))).status, 200);
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, supplier.id));
    await db.update(bill).set({ contactId: foreignSupplier.id }).where(eq(bill.id, made[1].id)); snap = await snapshot();
    assert.equal((await get(request(), params(made[1].id))).status, 422);
    assert.equal((await ma.call("get_bill", { billId: made[1].id })).body.status, 422);
    assert.equal((await list(request())).status, 422); assert.equal((await ma.call("list_bills")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(bill).set({ contactId: supplier.id }).where(eq(bill.id, made[1].id));
    for (const [field, foreignId, ownId] of [["accountId", foreignAccount.id, account.id], ["taxRateId", foreignTax.id, tax.id]] as const) {
      await db.update(billLine).set({ [field]: foreignId }).where(eq(billLine.billId, made[1].id)); snap = await snapshot();
      assert.equal((await get(request(), params(made[1].id))).status, 422);
      assert.equal((await ma.call("get_bill", { billId: made[1].id })).body.status, 422); assert.deepEqual(await snapshot(), snap);
      await db.update(billLine).set({ [field]: ownId }).where(eq(billLine.billId, made[1].id));
    }
    // Raw unsupported history must fail before JSON; bridge cannot recover rounded numbers.
    await db.execute(sql`update bill set total = 9007199254740992 where id = ${made[1].id}`); snap = await snapshot();
    assert.equal((await get(request(), params(made[1].id))).status, 422);
    assert.equal((await ma.call("get_bill", { billId: made[1].id })).body.code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await list(request())).status, 422); assert.equal((await ma.call("list_bills")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(bill).set({ total: 2147483648 }).where(eq(bill.id, made[1].id));
    for (const field of ["unit_price", "amount", "tax_amount"]) {
      await db.execute(sql.raw(`update bill_line set ${field} = 9007199254740992 where bill_id = '${made[1].id}'`)); snap = await snapshot();
      assert.equal((await get(request(), params(made[1].id))).status, 422);
      assert.equal((await ma.call("get_bill", { billId: made[1].id })).body.status, 422); assert.deepEqual(await snapshot(), snap);
      await db.update(billLine).set({ unitPrice: 2147483648, amount: 2147483648, taxAmount: 0 }).where(eq(billLine.billId, made[1].id));
    }
    await db.execute(sql`update contact set credit_limit = 9007199254740992 where id = ${supplier.id}`); snap = await snapshot();
    assert.equal((await get(request(), params(made[1].id))).status, 422);
    assert.equal((await list(request())).status, 422); assert.equal((await ma.call("list_bills")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(contact).set({ creditLimit: 3000 }).where(eq(contact.id, supplier.id));
    const euro = await make(1250, "EUR");
    await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 2000000, rateExact: "2", date: "2026-09-30" },
      { organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 3000000, rateExact: "3", date: "2026-10-02" },
      { organizationId: b.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 4000000, rateExact: "4", date: "2026-09-30" }]);
    snap = await snapshot();
    const edto = await (await get(request(), params(euro.id))).json();
    assert.equal(edto.base.amounts.total, 2500); assert.equal(edto.base.amounts.totalMinor, "2500");
    assert.equal(edto.base.rateExact, "2"); assert.equal(edto.base.status.effectiveDate, "2026-09-30");
    assert.deepEqual((await ma.call("get_bill", { billId: euro.id })).body, edto); assert.deepEqual(await snapshot(), snap);
    const bigEuro = await make(Number.MAX_SAFE_INTEGER, "EUR"); snap = await snapshot();
    assert.equal((await get(request(), params(bigEuro.id))).status, 422);
    assert.equal((await ma.call("get_bill", { billId: bigEuro.id })).body.status, 422); assert.deepEqual(await snapshot(), snap);
    const jpy = await make(1, "JPY");
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "JPY", targetCurrency: "USD", rate: 1000000, rateExact: "1", date: "2026-09-30" }); snap = await snapshot();
    assert.equal((await get(request(), params(jpy.id))).status, 422);
    assert.equal((await ma.call("get_bill", { billId: jpy.id })).body.status, 422); assert.deepEqual(await snapshot(), snap);
    // Isolate count fixtures; no resets/deletions outside this disposable database.
    await db.update(bill).set({ deletedAt: new Date() }).where(eq(bill.organizationId, a.id));
    const statuses: Awaited<ReturnType<typeof make>>[] = [];
    for (const status of billStatusEnum.enumValues) {
      const row = await make(2147483648); statuses.push(row);
      await db.update(bill).set({ status }).where(eq(bill.id, row.id));
    }
    snap = await snapshot();
    const c = await counts(request()); assert.equal(c.status, 200); const cdto = await c.json();
    assert.equal(cdto.total, 7);
    for (const status of billStatusEnum.enumValues) assert.deepEqual(cdto.counts[status], { count: 1, amount: 2147483648, amountMinor: "2147483648", currencyCode: "USD" });
    assert.deepEqual((await ma.call("get_bill_counts")).body, cdto);
    assert.deepEqual((await readOnly.call("get_bill_counts")).body, cdto);
    assert.deepEqual(await (await counts(request("", keys.viewer))).json(), cdto);
    assert.equal((await mb.call("get_bill_counts")).body.counts.draft.amountMinor, "50"); assert.deepEqual(await snapshot(), snap);
    // Different status buckets may have different currencies; only each summed bucket must be homogeneous.
    await db.update(bill).set({ currencyCode: "EUR" }).where(eq(bill.id, statuses[1].id));
    assert.equal((await (await counts(request())).json()).counts.pending_approval.currencyCode, "EUR");
    const extra = await make(2, "EUR"); snap = await snapshot();
    assert.equal((await counts(request())).status, 422); assert.equal((await ma.call("get_bill_counts")).body.status, 422); assert.deepEqual(await snapshot(), snap);
    await db.update(bill).set({ currencyCode: "USD", amountDue: Number.MAX_SAFE_INTEGER }).where(eq(bill.id, extra.id)); snap = await snapshot();
    assert.equal((await counts(request())).status, 422); assert.equal((await ma.call("get_bill_counts")).body.status, 422); assert.deepEqual(await snapshot(), snap);
    await db.update(bill).set({ amountDue: -2147483648 }).where(eq(bill.id, statuses[0].id));
    assert.equal((await (await counts(request())).json()).counts.draft.amountMinor, "9007197107257343");
    // Even a cancelling sum of zero must reject an unsupported individual int64 amount.
    await db.execute(sql`update bill set amount_due = 9223372036854775807 where id = ${extra.id}`);
    await db.execute(sql`update bill set amount_due = -9223372036854775807 where id = ${statuses[0].id}`); snap = await snapshot();
    assert.equal((await counts(request())).status, 422); assert.equal((await ma.call("get_bill_counts")).body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), snap);
    await db.update(bill).set({ amountDue: Number.MAX_SAFE_INTEGER }).where(eq(bill.id, extra.id));
    await db.update(bill).set({ amountDue: 0 }).where(eq(bill.id, statuses[0].id));
    assert.equal((await (await counts(request())).json()).counts.draft.amountMinor, "9007199254740991");
    assert.equal((await ma.call("get_bill_counts")).body.counts.draft.amount, Number.MAX_SAFE_INTEGER);
    await db.update(bill).set({ deletedAt: new Date() }).where(eq(bill.id, extra.id));
    assert.equal((await (await counts(request())).json()).counts.draft.amountMinor, "0");
    console.log("REST and MCP bill reads verified");
  } finally { await ma.close(); await mb.close(); await readOnly.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
