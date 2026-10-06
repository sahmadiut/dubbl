import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, invoiceLine, bill, inventoryItem, subscription } from "../../lib/db/schema";
import { GET as vendorSpend } from "../../app/api/v1/reports/vendor-spend/route";
import { GET as customerSales } from "../../app/api/v1/reports/sales-by-customer/route";
import { GET as itemSales } from "../../app/api/v1/reports/sales-by-item/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { getDocumentAnalytics } from "../../lib/reports/document-analytics";
import { createInvoice } from "../../lib/api/invoice-writes";
import { createBill } from "../../lib/api/bill-writes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Analytics fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["sales_by_customer", "sales_by_item", "vendor_spend"]) assert.match(tools.find(tool => tool.name === name)!.description!, /Minor/);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Analytics A", slug: "ana" }, { name: "Analytics B", slug: "anb" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "an-owner@example.test" }, { email: "an-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 });
  const keys = { a: "dk_an_a", b: "dk_an_b", denied: "dk_an_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_an" });
  const [local, foreign, other, deleted] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
    { organizationId: b.id, name: "Foreign secret", type: "both" }, { organizationId: a.id, name: "Other local", type: "both" },
    { organizationId: a.id, name: "Deleted secret", type: "both", deletedAt: new Date() }]).returning();
  const [item, foreignItem] = await db.insert(inventoryItem).values([{ organizationId: a.id, code: "LOCAL", name: "Local item" },
    { organizationId: b.id, code: "SECRET", name: "Foreign item secret" }]).returning();
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const args = { startDate: "2024-01-01", endDate: "2024-12-31" };
  const query = "?startDate=2024-01-01&endDate=2024-12-31";
  const request = (kind: string, suffix = query, key = keys.a) => new Request(`http://fixture.test/api/v1/reports/${kind}${suffix}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "journal_entry", "journal_line", "audit_log", "inventory_item"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  let sequence = 0;
  const seed = async (kind: string, amount: number, options: { org?: string; contactId?: string; currency?: string; date?: string;
    status?: "draft" | "void"; deleted?: boolean; tax?: number; itemId?: string | null; quantity?: number } = {}) => {
    const values = { organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id,
      issueDate: options.date ?? "2024-01-01", dueDate: "2024-12-31", total: amount, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null };
    if (kind === "vendor-spend") return (await db.insert(bill).values({ ...values, billNumber: `ANB-${++sequence}`, status: options.status ?? "received" }).returning())[0].id;
    const [saved] = await db.insert(invoice).values({ ...values, invoiceNumber: `ANI-${++sequence}`, status: options.status ?? "sent" }).returning();
    await db.insert(invoiceLine).values({ invoiceId: saved.id, description: "Analytics line", amount, taxAmount: options.tax ?? 0,
      inventoryItemId: options.itemId === undefined ? item.id : options.itemId, quantity: options.quantity ?? 100 });
    return saved.id;
  };
  const clear = async (kind: string) => {
    if (kind === "vendor-spend") await db.delete(bill).where(eq(bill.organizationId, a.id));
    else await db.delete(invoice).where(eq(invoice.organizationId, a.id));
  };
  try {
    for (const [kind, handler, tool] of [["vendor-spend", vendorSpend, "vendor_spend"], ["sales-by-customer", customerSales, "sales_by_customer"], ["sales-by-item", itemSales, "sales_by_item"]] as const) {
      const report = async (suffix = query) => {
        const response = await handler(request(kind, suffix)); assert.equal(response.status, 200); return response.json();
      };
      const empty = await report(); assert.equal(empty.currencyCode, "USD"); assert.deepEqual((await ma.call(tool, args)).body, empty);
      assert.deepEqual((await ma.call(tool)).body, await report(""));
      // Both public writer input contracts feed the same legacy/exact report outputs.
      for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
        const input = { contactId: local.id, issueDate: "2024-01-01", dueDate: "2024-05-01", lines: [{ description: "Actual client", ...price }] };
        if (kind === "vendor-spend") { const saved = await createBill(ctx, input, "rest"); await db.update(bill).set({ status: "received" }).where(eq(bill.id, saved.bill.id)); }
        else { const saved = await createInvoice(ctx, input, "rest"); await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, saved.invoice.id)); }
      }
      await seed(kind, 1001, { date: "2024-02-01", tax: 10, quantity: 250 });
      await seed(kind, 1002, { date: "2024-03-01", tax: 20 });
      await seed(kind, -1, { date: "2024-03-31", contactId: other.id, itemId: null, quantity: -100 });
      await seed(kind, 7, { contactId: foreign.id, itemId: foreignItem.id });
      await seed(kind, 9, { contactId: deleted.id, itemId: null });
      for (const options of [{ status: "draft" as const }, { status: "void" as const }, { deleted: true }, { date: "2023-12-31" },
        { date: "2025-01-01" }, { org: b.id, contactId: foreign.id, itemId: foreignItem.id }]) await seed(kind, 900, options);
      let before = await snapshot();
      const body = await report(); assert.deepEqual((await ma.call(tool, args)).body, body);
      assert.ok(!JSON.stringify(body).includes("secret"));
      if (kind === "vendor-spend") {
        assert.equal(body.totalSpend, 4518); assert.equal(body.totalSpendMinor, "4518"); assert.equal(body.vendorCount, 4);
        const v = body.vendors.find((v: { contactId: string }) => v.contactId === local.id);
        assert.equal(v.totalSpendMinor, "4503"); assert.equal(v.billCount, 4); assert.equal(v.avgBillAmountMinor, "1126");
        assert.equal(v.lastBillDate, "2024-03-01"); assert.equal(v.percentage, 99.67);
        assert.deepEqual(body.monthlyTrend.filter((v: { contactId: string }) => v.contactId === local.id).map((v: { totalMinor: string }) => v.totalMinor), ["2500", "1001", "1002"]);
      } else {
        assert.equal(body.totals.netMinor, "4518"); assert.equal(body.totals.taxMinor, "30"); assert.equal(body.totals.grossMinor, "4548");
        if (kind === "sales-by-customer") assert.equal(body.totals.invoiceCount, 7);
        else { assert.equal(body.totals.quantity, 650); assert.equal(body.totals.lineCount, 7); }
      }
      const foreignBody = await (await handler(request(kind, query, keys.b))).json();
      assert.deepEqual((await mb.call(tool, args)).body, foreignBody);
      assert.equal(kind === "vendor-spend" ? foreignBody.totalSpendMinor : foreignBody.totals.netMinor, "900");
      assert.equal((await handler(request(kind, query, "dk_an_invalid"))).status, 401);
      assert.equal((await handler(request(kind, query, keys.denied))).status, 403);
      assert.equal((await noRead.call(tool, args)).body.status, 403);
      for (const suffix of ["?startDate=2023-02-29", "?startDate=2024-02-01&endDate=2024-01-01", "?currencyCode=usd", "?currencyCode=XXX", "?startDate=", "?unknown=x", "?endDate=2024-01-01&endDate=2024-01-01", "?format=csv"]) {
        assert.equal((await handler(request(kind, suffix))).status, 400);
      }
      for (const input of [{ ...args, startDate: "2023-02-29" }, { ...args, currencyCode: "XXX" }, { ...args, endDate: "2023-01-01" }]) assert.equal((await ma.call(tool, input)).isError, true);
      assert.deepEqual(await snapshot(), before);
      if (kind !== "vendor-spend") {
        const ExcelJS = (await import("exceljs")).default;
        const xlsx = await handler(request(kind, query + "&format=xlsx")); assert.equal(xlsx.status, 200);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as never);
        const values = book.worksheets[0].lastRow!.values; assert.ok(Array.isArray(values)); assert.ok(values.includes(45.18)); assert.ok(values.includes(45.48));
        const pdf = await handler(request(kind, query + "&format=pdf")); assert.equal(pdf.status, 200);
        assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
        assert.deepEqual(await snapshot(), before);
      }
      const expectRange = async (suffix = query, input: Record<string, unknown> = args) => {
        const saved = await snapshot(); const response = await handler(request(kind, suffix)); assert.equal(response.status, 422);
        assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
        const m = await ma.call(tool, input); assert.equal(m.isError, true); assert.equal(m.body.code, "LEGACY_NUMERIC_RANGE");
        assert.deepEqual(await snapshot(), saved);
      };
      for (const currency of ["IRR", "JPY", "KWD"]) {
        const id = await seed(kind, 1250, { currency }); await expectRange();
        const filtered = await report(query + `&currencyCode=${currency}`); assert.equal(filtered.currencyCode, currency);
        assert.equal(kind === "vendor-spend" ? filtered.totalSpendMinor : filtered.totals.netMinor, "1250");
        assert.deepEqual((await ma.call(tool, { ...args, currencyCode: currency })).body, filtered);
        if (kind !== "vendor-spend") {
          const ExcelJS = (await import("exceljs")).default; const book = new ExcelJS.Workbook();
          const response = await handler(request(kind, query + `&currencyCode=${currency}&format=xlsx`)); assert.equal(response.status, 200);
          await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
          const values = book.worksheets[0].lastRow!.values; assert.ok(Array.isArray(values)); assert.ok(values.includes(currency === "KWD" ? 1.25 : 1250));
        }
        if (kind === "vendor-spend") await db.delete(bill).where(eq(bill.id, id)); else await db.delete(invoice).where(eq(invoice.id, id));
      }
      await clear(kind);
      if (kind === "vendor-spend") {
        const contacts = await db.insert(contact).values(Array.from({ length: 6 }, (_, index) => ({
          organizationId: a.id, name: `Ranking ${index}`, type: "both" as const }))).returning();
        for (let i = 0; i < contacts.length; i++) await seed(kind, (i + 1) * 10, { contactId: contacts[i].id });
        const ranked = await report(); assert.equal(ranked.vendorCount, 6); assert.equal(ranked.monthlyTrend.length, 5);
        assert.deepEqual(ranked.vendors.map((v: { totalSpend: number }) => v.totalSpend), [60, 50, 40, 30, 20, 10]);
        assert.ok(!ranked.monthlyTrend.some((v: { contactId: string }) => v.contactId === contacts[0].id));
        assert.deepEqual((await ma.call(tool, args)).body, ranked);
      } else {
        const id = await seed(kind, 100, { tax: 10 });
        await db.insert(invoiceLine).values({ invoiceId: id, description: "Second line", amount: 25, taxAmount: 2, inventoryItemId: item.id, quantity: 50 });
        const multiLine = await report(); assert.equal(multiLine.totals.netMinor, "125"); assert.equal(multiLine.totals.taxMinor, "12");
        if (kind === "sales-by-customer") assert.equal(multiLine.totals.invoiceCount, 1);
        else { assert.equal(multiLine.totals.lineCount, 2); assert.equal(multiLine.totals.quantity, 150); }
        assert.deepEqual((await ma.call(tool, args)).body, multiLine);
      }
      await clear(kind);
      const unsupported = await seed(kind, 1, { currency: "XXX" }); await expectRange();
      if (kind === "vendor-spend") await db.delete(bill).where(eq(bill.id, unsupported)); else await db.delete(invoice).where(eq(invoice.id, unsupported));
      // Exact cancellation must happen before narrowing, independently of row order.
      await seed(kind, Number.MAX_SAFE_INTEGER); await seed(kind, 1); await seed(kind, -Number.MAX_SAFE_INTEGER);
      const cancellation = await report(); assert.equal(kind === "vendor-spend" ? cancellation.totalSpendMinor : cancellation.totals.netMinor, "1");
      assert.deepEqual((await ma.call(tool, args)).body, cancellation); await clear(kind);
      const edge = await seed(kind, Number.MAX_SAFE_INTEGER);
      const edgeBody = await report(); assert.equal(kind === "vendor-spend" ? edgeBody.totalSpend : edgeBody.totals.net, Number.MAX_SAFE_INTEGER);
      if (kind !== "vendor-spend") assert.equal((await handler(request(kind, query + "&format=xlsx"))).status, 422);
      // Two individually safe groups overflow the root total.
      await seed(kind, 1, { contactId: other.id, itemId: null }); await expectRange(); await clear(kind);
      if (kind !== "vendor-spend") { await seed(kind, Number.MAX_SAFE_INTEGER, { tax: 1 }); await expectRange(); await clear(kind); }
      const unsafe = await seed(kind, 1);
      if (kind === "vendor-spend") await db.execute(sql`update ${bill} set total=9223372036854775807 where id=${unsafe}`);
      else await db.execute(sql`update ${invoiceLine} set amount=9223372036854775807 where invoice_id=${unsafe}`);
      await expectRange(); await clear(kind);
      if (kind !== "vendor-spend") {
        const unsafeTax = await seed(kind, 1);
        await db.execute(sql`update ${invoiceLine} set tax_amount=9223372036854775807 where invoice_id=${unsafeTax}`);
        await expectRange(); await clear(kind);
      }
      await seed(kind, -Number.MAX_SAFE_INTEGER);
      const minimum = await report(); assert.equal(kind === "vendor-spend" ? minimum.totalSpend : minimum.totals.net, -Number.MAX_SAFE_INTEGER);
      before = await snapshot(); assert.deepEqual((await ma.call(tool, args)).body, minimum); assert.deepEqual(await snapshot(), before);
      await clear(kind);
      const emptyFiltered = await report(query + "&currencyCode=JPY"); assert.equal(emptyFiltered.currencyCode, "JPY");
      assert.equal(kind === "vendor-spend" ? emptyFiltered.totalSpend : emptyFiltered.totals.net, 0);
      if (kind === "vendor-spend") await db.delete(bill).where(eq(bill.organizationId, b.id));
      else await db.delete(invoice).where(eq(invoice.organizationId, b.id));
      assert.ok(edge);
    }
    await assert.rejects(getDocumentAnalytics({ ...ctx, organizationId: randomUUID() }, "vendor-spend", args), { status: 404 });
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id));
    for (const [kind, handler] of [["vendor-spend", vendorSpend], ["sales-by-customer", customerSales], ["sales-by-item", itemSales]] as const)
      assert.equal((await handler(request(kind))).status, 422);
    console.log("REST and MCP document analytics verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
