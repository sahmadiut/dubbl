import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, bill, payment, paymentAllocation, subscription } from "../../lib/db/schema";
import { GET as receivables } from "../../app/api/v1/reports/aged-receivables/route";
import { GET as payables } from "../../app/api/v1/reports/aged-payables/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { getAgingReport } from "../../lib/reports/aging";
import { createInvoice } from "../../lib/api/invoice-writes";
import { createBill } from "../../lib/api/bill-writes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Aging fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["aged_receivables", "aged_payables"]) assert.match(tools.find(tool => tool.name === name)!.description!, /grandTotalMinor/);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Aging A", slug: "aga" }, { name: "Aging B", slug: "agb" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "ag-owner@example.test" }, { email: "ag-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 });
  const keys = { a: "dk_ag_a", b: "dk_ag_b", denied: "dk_ag_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ag" });
  const [customer, foreign, other] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
    { organizationId: b.id, name: "Foreign secret", type: "both" }, { organizationId: a.id, name: "Other local", type: "both" }]).returning();
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (kind: string, query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/aged-${kind}${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "payment", "payment_allocation", "journal_entry", "journal_line", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  let sequence = 0;
  const seed = async (kind: string, amount: number, dueDate: string, options: { status?: "draft" | "void" | "paid"; issueDate?: string;
    org?: string; contactId?: string; deleted?: boolean; currency?: string; total?: number } = {}) => {
    const values = { organizationId: options.org ?? a.id, contactId: options.contactId ?? customer.id,
      issueDate: options.issueDate ?? "2024-01-01", dueDate, status: options.status ?? (kind === "receivables" ? "sent" as const : "received" as const),
      total: options.total ?? amount, amountDue: amount, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null };
    return kind === "receivables" ? (await db.insert(invoice).values({ ...values, status: options.status ?? "sent", invoiceNumber: `AGI-${++sequence}` }).returning())[0]
      : (await db.insert(bill).values({ ...values, status: options.status ?? "received", billNumber: `AGB-${++sequence}` }).returning())[0];
  };
  const allocate = async (kind: string, documentId: string, amount: number, options: { org?: string; contactId?: string; date?: string;
    deleted?: boolean; currency?: string; type?: "received" | "made"; carrier?: boolean } = {}) => {
    const [saved] = await db.insert(payment).values({ organizationId: options.org ?? a.id, contactId: options.contactId ?? customer.id,
      paymentNumber: `AGP-${++sequence}`, type: options.type ?? (kind === "receivables" ? "received" : "made"),
      date: options.date ?? "2024-05-01", amount, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null }).returning();
    await db.insert(paymentAllocation).values({ paymentId: saved.id, documentId, documentType: kind === "receivables" ? "invoice" : "bill", amount });
    if (options.carrier) await db.insert(paymentAllocation).values({ paymentId: saved.id, documentId: randomUUID(),
      documentType: kind === "receivables" ? "credit_note" : "debit_note", amount });
    return saved;
  };
  try {
    for (const [kind, handler, tool] of [["receivables", receivables, "aged_receivables"], ["payables", payables, "aged_payables"]] as const) {
      let before = await snapshot();
      const empty = await handler(request(kind)); assert.equal(empty.status, 200);
      const emptyBody = await empty.json(); assert.equal(emptyBody.grandTotalMinor, "0"); assert.equal(emptyBody.buckets.length, 5);
      assert.deepEqual((await ma.call(tool)).body, emptyBody);
      assert.deepEqual(await snapshot(), before);
      const key = kind === "receivables" ? "invoices" : "bills";
      const rows = (body: typeof emptyBody) => body.buckets.flatMap((bucket: typeof emptyBody) => bucket[key]);
      // Real existing writer consumes both legacy decimal prices and exact minor aliases.
      for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
        const input = { contactId: customer.id, issueDate: "2024-01-01", dueDate: "2024-05-01", lines: [{ description: "Actual client", ...price }] };
        if (kind === "receivables") {
          const saved = await createInvoice(ctx, input, "rest"); assert.equal(saved.invoice.totalMinor, "1250");
          await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, saved.invoice.id));
        } else {
          const saved = await createBill(ctx, input, "rest"); assert.equal(saved.bill.totalMinor, "1250");
          await db.update(bill).set({ status: "received" }).where(eq(bill.id, saved.bill.id));
        }
      }
      const late = await seed(kind, 500, "2024-01-31", { status: "paid", total: 1000 });
      await allocate(kind, late.id, 100, { date: "2024-04-30" });
      await allocate(kind, late.id, 150, { carrier: true });
      await allocate(kind, late.id, 200, { date: "2024-05-02" });
      await allocate(kind, late.id, 300, { deleted: true });
      await allocate(kind, late.id, 999, { org: b.id, contactId: foreign.id });
      for (const [date, amount] of [["2024-04-30", 1], ["2024-03-31", 2], ["2024-03-01", 3], ["2024-01-31", 4]] as const) await seed(kind, amount, date);
      await seed(kind, 100, "2024-05-01", { issueDate: "2024-05-02" });
      for (const options of [{ status: "draft" as const }, { status: "void" as const }, { deleted: true }, { org: b.id, contactId: foreign.id }])
        await seed(kind, 900, "2024-05-01", options);
      // Scoped contact projection cannot expose a foreign name even on malformed old references.
      const hidden = await seed(kind, 7, "2024-05-01", { contactId: foreign.id });
      before = await snapshot();
      const response = await handler(request(kind, "?asAt=2024-05-01")); assert.equal(response.status, 200);
      const body = await response.json(); assert.equal(body.grandTotal, 3267); assert.equal(body.grandTotalMinor, "3267");
      assert.equal(rows(body).find((row: typeof body) => row.id === late.id).amountDueMinor, "750");
      assert.equal(rows(body).find((row: typeof body) => row.id === hidden.id).contactName, "Unknown");
      assert.deepEqual(body.buckets.map((bucket: typeof body) => bucket.total), [2507, 1, 2, 3, 754]);
      assert.deepEqual((await ma.call(tool, { asAt: "2024-05-01" })).body, body);
      assert.ok(!JSON.stringify(body).includes("Foreign secret"));
      const foreignReport = (await mb.call(tool, { asAt: "2024-05-01" })).body; assert.equal(foreignReport.grandTotalMinor, "900");
      assert.ok(!rows(foreignReport).some((row: typeof body) => row.id === late.id));
      const live = await (await handler(request(kind))).json(); assert.equal(live.grandTotalMinor, "2617");
      assert.deepEqual((await ma.call(tool)).body, live); assert.ok(!rows(live).some((row: typeof body) => row.id === late.id));
      for (const query of ["?asAt=2023-02-29", "?asAt=", "?format=csv", "?currencyCode=usd", "?unknown=true", "?asAt=2024-05-01&asAt=2024-05-01"]) {
        assert.equal((await handler(request(kind, query))).status, 400);
      }
      for (const args of [{ asAt: "2023-02-29" }, { currencyCode: "XXX" }, { asAt: "" }]) assert.equal((await ma.call(tool, args)).isError, true);
      assert.equal((await handler(request(kind, "", "dk_ag_invalid"))).status, 401);
      assert.equal((await handler(request(kind, "", keys.denied))).status, 403);
      assert.equal((await noRead.call(tool)).body.status, 403);
      assert.equal((await noRead.call("export_financial_statement", { statement: tool, format: "xlsx" })).body.status, 403);
      assert.deepEqual(await snapshot(), before);
      // Both binary renderers consume the same historical statement and root units.
      const ExcelJS = (await import("exceljs")).default;
      const xlsx = await handler(request(kind, "?asAt=2024-05-01&format=xlsx")); assert.equal(xlsx.status, 200);
      assert.match(xlsx.headers.get("content-disposition")!, /2024-05-01.xlsx/);
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as never);
      const lastValues = workbook.worksheets[0].lastRow!.values; assert.ok(Array.isArray(lastValues)); assert.ok(lastValues.includes(32.67));
      const exported = await ma.call("export_financial_statement", { statement: tool, format: "xlsx", asAt: "2024-05-01" });
      assert.equal(exported.isError, false); assert.equal(exported.body.filename, `aged-${kind}-2024-05-01.xlsx`);
      const mWorkbook = new ExcelJS.Workbook(); await mWorkbook.xlsx.load(Buffer.from(exported.body.data, "base64") as never);
      assert.deepEqual(mWorkbook.worksheets[0].getSheetValues(), workbook.worksheets[0].getSheetValues());
      const pdf = await handler(request(kind, "?asAt=2024-05-01&format=pdf")); assert.equal(pdf.status, 200);
      assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
      assert.equal(Buffer.from((await ma.call("export_financial_statement", { statement: tool, format: "pdf", asAt: "2024-05-01" })).body.data, "base64").subarray(0, 4).toString(), "%PDF");
      assert.deepEqual(await snapshot(), before);
      const emptyFiltered = await handler(request(kind, "?asAt=2024-05-01&currencyCode=JPY")); assert.equal(emptyFiltered.status, 200);
      const filteredZero = await emptyFiltered.json(); assert.equal(filteredZero.currencyCode, "JPY"); assert.equal(filteredZero.grandTotalMinor, "0");
      assert.deepEqual((await ma.call(tool, { asAt: "2024-05-01", currencyCode: "JPY" })).body, filteredZero);
      const expectRange = async (query = "?asAt=2024-05-01", args: Record<string, unknown> = { asAt: "2024-05-01" }) => {
        const beforeFailure = await snapshot();
        const result = await handler(request(kind, query)); assert.equal(result.status, 422); assert.equal((await result.json()).code, "LEGACY_NUMERIC_RANGE");
        const resultM = await ma.call(tool, args); assert.equal(resultM.isError, true); assert.equal(resultM.body.code, "LEGACY_NUMERIC_RANGE");
        assert.deepEqual(await snapshot(), beforeFailure);
      };
      for (const options of [{ contactId: other.id }, { currency: "JPY" }, { type: kind === "receivables" ? "made" as const : "received" as const }]) {
        const bad = await allocate(kind, late.id, 1, options); await expectRange(); await db.delete(payment).where(eq(payment.id, bad.id));
      }
      const badAmount = await allocate(kind, late.id, -1); await expectRange(); await db.delete(payment).where(eq(payment.id, badAmount.id));
      for (const currency of ["IRR", "JPY", "KWD"]) {
        const nonUsd = await seed(kind, 1250, "2024-05-01", { currency }); await expectRange();
        const filtered = await handler(request(kind, `?asAt=2024-05-01&currencyCode=${currency}`)); assert.equal(filtered.status, 200);
        const filteredBody = await filtered.json(); assert.equal(filteredBody.grandTotalMinor, "1250"); assert.equal(filteredBody.currencyCode, currency);
        assert.deepEqual((await ma.call(tool, { asAt: "2024-05-01", currencyCode: currency })).body, filteredBody);
        const exp = await handler(request(kind, `?asAt=2024-05-01&currencyCode=${currency}&format=xlsx`)); assert.equal(exp.status, 200);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await exp.arrayBuffer()) as never);
        const values = book.worksheets[0].lastRow!.values; assert.ok(Array.isArray(values)); assert.ok(values.includes(currency === "KWD" ? 1.25 : 1250));
        if (kind === "receivables") await db.delete(invoice).where(eq(invoice.id, nonUsd.id)); else await db.delete(bill).where(eq(bill.id, nonUsd.id));
      }
      const unsupported = await seed(kind, 1, "2024-05-01", { currency: "XXX" }); await expectRange();
      if (kind === "receivables") await db.delete(invoice).where(eq(invoice.id, unsupported.id)); else await db.delete(bill).where(eq(bill.id, unsupported.id));
      // Large safe stored values cancel in bigint before a safe final bucket is narrowed.
      const huge = await seed(kind, Number.MAX_SAFE_INTEGER, "2024-05-01");
      await seed(kind, -Number.MAX_SAFE_INTEGER, "2024-05-01");
      const small = await seed(kind, 1, "2024-05-01");
      assert.equal((await (await handler(request(kind))).json()).grandTotalMinor, "2618");
      await expectRange(); // Historical ignores fully settled/nonpositive rows, so positive total overflows.
      if (kind === "receivables") await db.delete(invoice).where(eq(invoice.id, huge.id)); else await db.delete(bill).where(eq(bill.id, huge.id));
      await db.execute(sql.raw(`update ${kind === "receivables" ? "invoice" : "bill"} set amount_due=9223372036854775807 where id='${small.id}'`));
      await expectRange("", {});
      await db.execute(sql.raw(`update ${kind === "receivables" ? "invoice" : "bill"} set amount_due=1, due_date='infinity' where id='${small.id}'`)); await expectRange();
      if (kind === "receivables") await db.delete(invoice).where(eq(invoice.organizationId, a.id)); else await db.delete(bill).where(eq(bill.organizationId, a.id));
      // A maximum JSON amount is supported but Excel's precision rejects it.
      const edge = await seed(kind, Number.MAX_SAFE_INTEGER, "2024-05-01");
      const maximum = await handler(request(kind, "?asAt=2024-05-01")); assert.equal(maximum.status, 200);
      assert.equal((await maximum.json()).grandTotalMinor, "9007199254740991");
      assert.equal((await ma.call(tool, { asAt: "2024-05-01" })).body.grandTotal, Number.MAX_SAFE_INTEGER);
      assert.equal((await handler(request(kind, "?asAt=2024-05-01&format=xlsx"))).status, 422);
      assert.equal((await ma.call("export_financial_statement", { statement: tool, format: "xlsx", asAt: "2024-05-01" })).body.code, "LEGACY_NUMERIC_RANGE");
      const extra = await seed(kind, 1, "2024-01-31"); await expectRange(); // Safe separate buckets can overflow the root sum.
      if (kind === "receivables") await db.delete(invoice).where(eq(invoice.id, extra.id)); else await db.delete(bill).where(eq(bill.id, extra.id));
      await db.execute(sql.raw(`update ${kind === "receivables" ? "invoice" : "bill"} set total=9223372036854775807 where id='${edge.id}'`));
      await expectRange(); // Unsupported stored input cannot be repaired by stringifying it.
      await db.execute(sql.raw(`update ${kind === "receivables" ? "invoice" : "bill"} set total=9007199254740991, amount_due=-9007199254740991 where id='${edge.id}'`));
      const minimum = await handler(request(kind)); assert.equal(minimum.status, 200); assert.equal((await minimum.json()).grandTotalMinor, "-9007199254740991");
      assert.equal((await ma.call(tool)).body.grandTotal, -Number.MAX_SAFE_INTEGER);
      if (kind === "receivables") await db.delete(invoice).where(eq(invoice.id, edge.id)); else await db.delete(bill).where(eq(bill.id, edge.id));
    }
    await assert.rejects(getAgingReport({ ...ctx, organizationId: randomUUID() }, "receivables", {}), { status: 404 });
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id));
    assert.equal((await receivables(request("receivables"))).status, 422);
    assert.equal((await ma.call("aged_receivables")).body.code, "LEGACY_NUMERIC_RANGE");
    console.log("REST and MCP aging verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
