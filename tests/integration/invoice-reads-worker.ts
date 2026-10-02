// Runs only in invoice-reads.test.ts's randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate,
  invoice, invoiceLine, payment, paymentAllocation, exchangeRate } from "../../lib/db/schema";
import { GET as list } from "../../app/api/v1/invoices/route";
import { GET as get } from "../../app/api/v1/invoices/[id]/route";
import { GET as summary } from "../../app/api/v1/invoices/summary/route";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Invoice reads fixture", version: "1.0.0" });
  registerInvoiceTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some(tool => tool.name === "get_invoice_summary"));
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "list_invoices")!.inputSchema).includes("pending_approval"));
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
  const [a, b] = await db.insert(organization).values([{ name: "Invoice A", slug: "invoice-a" },
    { name: "Invoice B", slug: "invoice-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "invoice-owner@example.test" }, { email: "invoice-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Reads only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_invoice_a", b: "dk_invoice_b", viewer: "dk_invoice_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_invoice" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "customer", creditLimit: 3000 },
    { organizationId: b.id, name: "B", type: "customer", creditLimit: null }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Revenue", code: "400", type: "revenue", isActive: false },
    { organizationId: b.id, name: "Secret revenue", code: "400", type: "revenue" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Tax", rate: 1000 },
    { organizationId: b.id, name: "Foreign tax", rate: 1000 }]).returning();
  let serial = 0;
  const make = async (amount = 1250, currencyCode = "USD", orgId = a.id, contactId = customer.id) => {
    const [row] = await db.insert(invoice).values({ organizationId: orgId, contactId, invoiceNumber: `INV-${++serial}`,
      issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, subtotal: amount, total: amount, amountDue: amount }).returning();
    await db.insert(invoiceLine).values({ invoiceId: row.id, description: "Item", unitPrice: amount, amount,
      quantity: 150, discountPercent: 1000, accountId: orgId === a.id ? account.id : foreignAccount.id,
      taxRateId: orgId === a.id ? tax.id : foreignTax.id });
    return row;
  };
  const request = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/invoices${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  // JSON text retains every digit in snapshots, including intentionally unsafe history.
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from invoice i) as invoices,
    (select coalesce(jsonb_agg(to_jsonb(l)::text order by l.id),'[]'::jsonb) from invoice_line l) as lines,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from payment p) as payments,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from payment_allocation p) as allocations,
    (select coalesce(jsonb_agg(to_jsonb(r)::text order by r.id),'[]'::jsonb) from exchange_rate r) as rates,
    (select count(*)::text from audit_log) as audits,
    (select count(*)::text from journal_entry) as journals`)).rows;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  try {
    const made: Awaited<ReturnType<typeof make>>[] = [];
    for (const amount of [1250, 2147483648, Number.MAX_SAFE_INTEGER]) {
      const row = await make(amount); made.push(row);
      const before = await snapshot();
      const res = await get(request(), params(row.id)); assert.equal(res.status, 200);
      const dto = await res.json();
      assert.equal(dto.invoice.organizationId, a.id); assert.equal(dto.invoice.total, amount);
      assert.equal(dto.invoice.totalMinor, String(amount)); assert.equal(dto.invoice.subtotalMinor, String(amount));
      assert.equal(dto.invoice.lines[0].unitPriceMinor, String(amount)); assert.equal(dto.invoice.lines[0].amountMinor, String(amount));
      assert.equal(dto.invoice.lines[0].taxAmountMinor, "0"); assert.equal(dto.invoice.lines[0].quantity, 150);
      assert.equal(dto.invoice.lines[0].discountPercent, 1000); assert.equal(dto.invoice.contact.creditLimitMinor, "3000");
      assert.equal(dto.base.amounts.totalMinor, String(amount)); assert.equal(dto.base.rateExact, "1");
      assert.equal(dto.base.rateDirection, "quote_per_base"); assert.equal(dto.base.rateBasis, "historical_lookup_millionths");
      const m = await ma.call("get_invoice", { invoiceId: row.id }); assert.equal(m.isError, false);
      assert.equal(m.body.invoice.total, amount); assert.equal(m.body.invoice.totalMinor, String(amount));
      assert.equal(m.body.invoice.lines[0].unitPriceMinor, String(amount)); assert.equal(m.body.payments, undefined);
      assert.equal((await readOnly.call("get_invoice", { invoiceId: row.id })).isError, false);
      assert.deepEqual(await snapshot(), before);
    }
    // All currency scales preserve the stored integer; no magnitude-based rescaling.
    for (const currency of ["IRR", "JPY", "KWD", "EUR"]) {
      const row = await make(1250, currency);
      const dto = await (await get(request(), params(row.id))).json();
      assert.equal(dto.invoice.totalMinor, "1250"); assert.equal(dto.base.amounts.totalMinor, null);
      assert.equal((await ma.call("get_invoice", { invoiceId: row.id })).body.invoice.totalMinor, "1250");
    }
    const foreign = await make(50, "USD", b.id, foreignCustomer.id);
    const [deleted] = await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, made[0].id)).returning();
    const before = await snapshot();
    const restList = await list(request("?sortBy=total&sortOrder=asc&limit=100")); assert.equal(restList.status, 200);
    const page = await restList.json(); assert.equal(page.data.length, 6);
    assert.ok(page.data.every((row: { organizationId: string; totalMinor: string }) => row.organizationId === a.id && typeof row.totalMinor === "string"));
    assert.equal(page.pagination.total, 6);
    const ml = await ma.call("list_invoices", { limit: 100, sortBy: "total", sortOrder: "asc" });
    assert.equal(ml.body.total, page.pagination.total); assert.deepEqual(ml.body.invoices.map((r: { id: string }) => r.id), page.data.map((r: { id: string }) => r.id));
    assert.equal((await get(request(), params(foreign.id))).status, 404);
    assert.equal((await mb.call("get_invoice", { invoiceId: made[1].id })).body.status, 404);
    assert.equal((await get(request(), params(deleted.id))).status, 404);
    assert.equal((await ma.call("get_invoice", { invoiceId: deleted.id })).body.status, 404);
    assert.equal((await (await list(request(`?contactId=${foreignCustomer.id}`))).json()).pagination.total, 0);
    assert.equal((await mb.call("list_invoices")).body.total, 1);
    assert.equal((await (await list(request("?from=2026-10-02"))).json()).data.length, 0);
    assert.equal((await ma.call("list_invoices", { page: 2, limit: 3 })).body.invoices.length, 3);
    assert.equal((await list(request("", keys.viewer))).status, 200);
    for (const read of [() => list(request("", "dk_invalid")), () => get(request("", "dk_invalid"), params(made[1].id)),
      () => summary(request("", "dk_invalid"))]) assert.equal((await read()).status, 401);
    for (const query of ["?from=2026-02-30", "?from=2026-10-03&to=2026-10-01", "?contactId=bad", "?page=bad", "?page=21474837", "?status=bad"]) {
      assert.equal((await list(request(query))).status, 400);
    }
    assert.equal((await get(request(), params("not-a-uuid"))).status, 400);
    assert.equal((await ma.call("list_invoices", { startDate: "2026-10-03", endDate: "2026-10-01" })).isError, true);
    assert.deepEqual(await snapshot(), before);
    // Header/contact/line references are checked even when the parent is correctly scoped.
    const badContact = await make(1, "USD", a.id, foreignCustomer.id);
    const badLine = await make(1);
    await db.update(invoiceLine).set({ accountId: foreignAccount.id }).where(eq(invoiceLine.invoiceId, badLine.id));
    const badTax = await make(1);
    await db.update(invoiceLine).set({ taxRateId: foreignTax.id }).where(eq(invoiceLine.invoiceId, badTax.id));
    let snap = await snapshot();
    for (const row of [badContact, badLine, badTax]) {
      assert.equal((await get(request(), params(row.id))).status, 422);
      assert.equal((await ma.call("get_invoice", { invoiceId: row.id })).body.status, 422);
    }
    assert.equal((await list(request())).status, 422); assert.equal((await ma.call("list_invoices")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, badContact.id));
    // Allocated payment amounts retain document units and guard foreign payment references.
    const [paid] = await db.insert(payment).values({ organizationId: a.id, contactId: customer.id,
      paymentNumber: "PAY-1", type: "received", date: "2026-10-01", amount: 100, currencyCode: "EUR" }).returning();
    const [allocation] = await db.insert(paymentAllocation).values({ paymentId: paid.id, documentId: made[1].id, documentType: "invoice", amount: 50 }).returning();
    const pdto = await (await get(request(), params(made[1].id))).json();
    assert.deepEqual(pdto.payments[0], { id: paid.id, paymentNumber: "PAY-1", date: "2026-10-01", amount: 50, amountMinor: "50", method: "bank_transfer" });
    await db.update(payment).set({ organizationId: b.id }).where(eq(payment.id, paid.id)); snap = await snapshot();
    assert.equal((await get(request(), params(made[1].id))).status, 422); assert.deepEqual(await snapshot(), snap);
    await db.update(payment).set({ organizationId: a.id }).where(eq(payment.id, paid.id));
    await db.execute(sql`update payment_allocation set amount = 9007199254740992 where id = ${allocation.id}`); snap = await snapshot();
    assert.equal((await get(request(), params(made[1].id))).status, 422); assert.deepEqual(await snapshot(), snap);
    await db.update(paymentAllocation).set({ amount: 50 }).where(eq(paymentAllocation.id, allocation.id));
    // Unsafe history is rejected instead of returning already-rounded numeric JSON.
    const unsafe = await make(1);
    await db.execute(sql`update invoice set total = 9007199254740992 where id = ${unsafe.id}`); snap = await snapshot();
    assert.equal((await get(request(), params(unsafe.id))).status, 422);
    assert.equal((await ma.call("get_invoice", { invoiceId: unsafe.id })).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, unsafe.id));
    const unsafeLine = await make(1);
    await db.execute(sql`update invoice_line set unit_price = 9007199254740992 where invoice_id = ${unsafeLine.id}`); snap = await snapshot();
    assert.equal((await get(request(), params(unsafeLine.id))).status, 422);
    assert.equal((await ma.call("get_invoice", { invoiceId: unsafeLine.id })).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, unsafeLine.id));
    await db.execute(sql`update contact set credit_limit = 9007199254740992 where id = ${customer.id}`); snap = await snapshot();
    assert.equal((await get(request(), params(made[1].id))).status, 422);
    assert.equal((await list(request())).status, 422); assert.equal((await ma.call("list_invoices")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(contact).set({ creditLimit: 3000 }).where(eq(contact.id, customer.id));
    // Issue-date display FX is explicitly lookup-derived. Future and foreign-org rates don't leak.
    const euro = await make(1250, "EUR");
    await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 2000000, rateExact: "2", date: "2026-09-30" },
      { organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 3000000, rateExact: "3", date: "2026-10-02" },
      { organizationId: b.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 4000000, rateExact: "4", date: "2026-09-30" }]);
    const edto = await (await get(request(), params(euro.id))).json();
    assert.equal(edto.base.amounts.total, 2500); assert.equal(edto.base.amounts.totalMinor, "2500");
    assert.equal(edto.base.rateExact, "2"); assert.equal(edto.base.status.effectiveDate, "2026-09-30");
    const bigEuro = await make(Number.MAX_SAFE_INTEGER, "EUR"); snap = await snapshot();
    const rejected = await get(request(), params(bigEuro.id)); assert.equal(rejected.status, 422);
    assert.equal((await rejected.json()).code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), snap);
    const jpy = await make(1, "JPY");
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "JPY", targetCurrency: "USD", rate: 1000000, rateExact: "1", date: "2026-09-30" });
    assert.equal((await get(request(), params(jpy.id))).status, 422);
    // Summary counts include drafts, but only sent/partial/overdue monetary rows contribute.
    const empty = await summary(request()); assert.equal(empty.status, 200);
    const emptyDto = await empty.json(); assert.equal(emptyDto.outstandingMinor, "0"); assert.equal(emptyDto.currencyCode, null);
    const sumA = await make(2147483648), sumB = await make(2);
    await db.update(invoice).set({ status: "overdue", dueDate: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) }).where(eq(invoice.id, sumA.id));
    await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, sumB.id));
    snap = await snapshot();
    const s = await summary(request()); assert.equal(s.status, 200); const sdto = await s.json();
    assert.equal(sdto.outstanding, 2147483650); assert.equal(sdto.outstandingMinor, "2147483650");
    assert.equal(sdto.overdueMinor, "2147483648"); assert.equal(sdto.aging["60+"].amountMinor, "2147483648");
    assert.equal(sdto.outstandingCount, 2); assert.equal(sdto.currencyCode, "USD");
    const sm = await ma.call("get_invoice_summary"); assert.equal(sm.isError, false); assert.deepEqual(sm.body, sdto);
    assert.equal((await mb.call("get_invoice_summary")).body.outstandingMinor, "0");
    assert.equal((await readOnly.call("get_invoice_summary")).isError, false); assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ currencyCode: "EUR" }).where(eq(invoice.id, sumB.id)); snap = await snapshot();
    assert.equal((await summary(request())).status, 422); assert.equal((await ma.call("get_invoice_summary")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ currencyCode: "USD", amountDue: Number.MAX_SAFE_INTEGER }).where(eq(invoice.id, sumB.id)); snap = await snapshot();
    assert.equal((await summary(request())).status, 422); assert.equal((await ma.call("get_invoice_summary")).body.status, 422);
    assert.deepEqual(await snapshot(), snap);
    // SQL text bypasses Number decoding and classifies unsafe individual history.
    await db.execute(sql`update invoice set amount_due = 9223372036854775807 where id = ${sumB.id}`); snap = await snapshot();
    assert.equal((await summary(request())).status, 422); assert.equal((await ma.call("get_invoice_summary")).body.code, "LEGACY_NUMERIC_RANGE");
    assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ status: "paid" }).where(eq(invoice.id, sumA.id));
    await db.update(invoice).set({ amountDue: Number.MAX_SAFE_INTEGER }).where(eq(invoice.id, sumB.id));
    snap = await snapshot();
    assert.equal((await (await summary(request())).json()).outstandingMinor, "9007199254740991");
    assert.equal((await ma.call("get_invoice_summary")).body.outstanding, Number.MAX_SAFE_INTEGER);
    assert.deepEqual(await snapshot(), snap);
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, sumB.id));
    await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, foreign.id));
    assert.equal((await (await summary(request())).json()).outstandingMinor, "0");
    assert.equal((await mb.call("get_invoice_summary")).body.outstandingMinor, "50");
    console.log("REST and MCP invoice reads verified");
  } finally { await ma.close(); await mb.close(); await readOnly.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
