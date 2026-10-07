import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, bill, chartAccount, journalEntry, journalLine, subscription } from "../../lib/db/schema";
import { GET as expense } from "../../app/api/v1/reports/expense-analytics/route";
import { GET as monthly } from "../../app/api/v1/reports/monthly-trends/route";
import { GET as executive } from "../../app/api/v1/reports/executive-summary/route";
import { GET as profitability } from "../../app/api/v1/reports/profitability/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { getKpiAnalytics } from "../../lib/reports/kpi-analytics";
import { createInvoice } from "../../lib/api/invoice-writes";
import { createBill } from "../../lib/api/bill-writes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "KPI fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["expense_analytics", "monthly_trends", "executive_summary", "contact_profitability", "export_executive_summary"])
    assert.ok(tools.find(tool => tool.name === name)?.description);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "KPI A", slug: "kpi-a" }, { name: "KPI B", slug: "kpi-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "kpi-owner@example.test" }, { email: "kpi-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 });
  const keys = { a: "dk_kpi_a", b: "dk_kpi_b", denied: "dk_kpi_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_kpi" });
  const [local, other, foreign, deleted] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
    { organizationId: a.id, name: "Other", type: "both" }, { organizationId: b.id, name: "Foreign secret", type: "both" },
    { organizationId: a.id, name: "Deleted secret", type: "both", deletedAt: new Date() }]).returning();
  const [rev, exp, cogs, bank, foreignExp] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
    { organizationId: a.id, code: "5100", name: "COGS", type: "expense" as const, subType: "cogs" },
    { organizationId: a.id, code: "1000", name: "Bank", type: "asset" as const, subType: "bank" },
    { organizationId: b.id, code: "5000", name: "Foreign secret", type: "expense" as const },
  ]).returning();
  let sequence = 0;
  const entry = async (accountId: string, amount: number, date = "2024-03-01", options: { org?: string; status?: "draft" | "void"; deleted?: boolean; source?: string; credit?: boolean } = {}) => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: options.org ?? a.id, entryNumber: ++sequence, date, description: "Synthetic KPI",
      status: options.status ?? "posted", deletedAt: options.deleted ? new Date() : null, sourceType: options.source ?? "manual" }).returning();
    await db.insert(journalLine).values({ journalEntryId: saved.id, accountId, debitAmount: options.credit ? 0 : amount, creditAmount: options.credit ? amount : 0 });
    return saved.id;
  };
  const document = async (table: typeof invoice | typeof bill, total: number, options: { org?: string; contactId?: string; date?: string; currency?: string; status?: "draft" | "void"; deleted?: boolean } = {}) => {
    const values = { organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id, issueDate: options.date ?? "2024-03-01",
      dueDate: "2024-03-31", total, amountDue: total, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null };
    if (table === invoice) return (await db.insert(invoice).values({ ...values, invoiceNumber: `KPI-${++sequence}`, status: options.status ?? "sent" }).returning())[0].id;
    return (await db.insert(bill).values({ ...values, billNumber: `KPB-${++sequence}`, status: options.status ?? "received" }).returning())[0].id;
  };
  const clear = async () => { await db.delete(journalEntry); await db.delete(invoice); await db.delete(bill); };
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, permissions: [] });
  const args = { startDate: "2024-03-01", endDate: "2024-03-31" }, query = "?startDate=2024-03-01&endDate=2024-03-31";
  const request = (suffix = query, key = keys.a) => new Request(`http://fixture.test/api/v1/reports/kpi${suffix}`, { headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id } });
  const body = async (handler: typeof expense, suffix = query) => { const response = await handler(request(suffix)); assert.equal(response.status, 200); return response.json(); };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "invoice", "bill", "invoice_line", "bill_line", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  try {
    for (const [handler, tool, input, suffix] of [[expense, "expense_analytics", args, query], [executive, "executive_summary", args, query],
      [profitability, "contact_profitability", args, query], [monthly, "monthly_trends", { months: 3 }, "?months=3"]] as const) {
      const empty = await body(handler, suffix); assert.deepEqual((await ma.call(tool, input)).body, empty);
      assert.deepEqual((await ma.call(tool)).body, await body(handler, ""));
      assert.equal((await handler(request(suffix, "dk_kpi_invalid"))).status, 401);
      assert.equal((await handler(request(suffix, keys.denied))).status, 403); assert.equal((await noRead.call(tool, input)).body.status, 403);
      assert.deepEqual((await mb.call(tool, input)).body, await (await handler(request(suffix, keys.b))).json());
      for (const invalid of ["?unknown=1", suffix + "&unknown=1", suffix + (tool === "monthly_trends" ? "&months=3" : "&startDate=2024-03-01")]) assert.equal((await handler(request(invalid))).status, 400);
    }
    for (const handler of [expense, executive, profitability]) for (const invalid of ["?startDate=2023-02-29", "?startDate=", "?startDate=2024-04-01&endDate=2024-03-01"])
      assert.equal((await handler(request(invalid))).status, 400);
    for (const invalid of [{ startDate: "2024-02-30" }, { basis: "invalid" }, { startDate: "0001-01-01", endDate: "0001-01-02" }])
      assert.equal((await ma.call("executive_summary", invalid)).isError, true);
    for (const invalid of ["?basis=bad", "?format=csv", "?startDate=0001-01-01&endDate=0001-01-02"]) assert.equal((await executive(request(invalid))).status, 400);
    assert.equal((await profitability(request(query + "&groupBy=bad"))).status, 400);
    assert.equal((await profitability(request(query + "&groupBy=project"))).status, 200);
    for (const value of ["0", "-1", "25", "6x", "1.5", ""]) assert.equal((await monthly(request(`?months=${value}`))).status, 400);
    for (const months of [0, -1, 25, 1.5, "6"]) assert.equal((await ma.call("monthly_trends", { months })).isError, true);
    for (const currencyCode of ["usd", "XXX", ""]) {
      assert.equal((await profitability(request(query + `&currencyCode=${currencyCode}`))).status, 400);
      assert.equal((await ma.call("contact_profitability", { ...args, currencyCode })).isError, true);
    }
    assert.equal((await noRead.call("export_executive_summary", { ...args, format: "pdf" })).body.status, 403);
    await entry(rev.id, 1000, "2024-03-01", { credit: true }); await entry(exp.id, 101); await entry(exp.id, 1);
    await entry(cogs.id, 200, "2024-03-31"); await entry(bank.id, 600);
    await entry(rev.id, 500, "2024-02-29", { credit: true, source: "payment" }); await entry(exp.id, 50, "2024-02-29", { source: "payment" });
    for (const options of [{ status: "draft" as const }, { status: "void" as const }, { deleted: true }, { org: b.id }]) await entry(exp.id, 900, "2024-03-10", options);
    await entry(foreignExp.id, 900);
    await entry(foreignExp.id, 777, "2024-03-10", { org: b.id });
    const expenses = await body(expense); assert.equal(expenses.totalExpensesMinor, "302"); assert.equal(expenses.monthlyAverageMinor, "302");
    assert.equal(expenses.categories.find((row: { accountId: string }) => row.accountId === exp.id).transactions, 2);
    assert.deepEqual((await ma.call("expense_analytics", args)).body, expenses); assert.ok(!JSON.stringify(expenses).includes("secret"));
    const foreignExpenses = await (await expense(request(query, keys.b))).json();
    assert.equal(foreignExpenses.totalExpensesMinor, "777"); assert.deepEqual((await mb.call("expense_analytics", args)).body, foreignExpenses);
    const summary = await body(executive); assert.equal(summary.kpis[0].currentMinor, "1000"); assert.equal(summary.kpis[0].priorMinor, "500");
    assert.equal(summary.kpis[0].deltaPercent, 100); assert.equal(summary.kpis[1].currentMinor, "800"); assert.equal(summary.kpis[3].currentMinor, "698");
    assert.equal(summary.kpis[4].currentMinor, "600"); assert.deepEqual((await ma.call("executive_summary", args)).body, summary);
    const cash = await body(executive, query + "&basis=cash"); assert.equal(cash.kpis[0].currentMinor, "0"); assert.equal(cash.kpis[0].priorMinor, "500");
    assert.deepEqual((await ma.call("executive_summary", { ...args, basis: "cash" })).body, cash);
    const before = await snapshot();
    const pdf = await executive(request(query + "&format=pdf")); assert.equal(pdf.status, 200); assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
    const pdfMcp = await ma.call("export_executive_summary", { ...args, format: "pdf" }); assert.equal(Buffer.from(pdfMcp.body.data, "base64").subarray(0, 4).toString(), "%PDF");
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      assert.equal((await body(executive)).kpis[0].currentMinor, "1000");
      const ExcelJS = (await import("exceljs")).default;
      for (const bytes of [Buffer.from(await (await executive(request(query + "&format=xlsx"))).arrayBuffer()),
        Buffer.from((await ma.call("export_executive_summary", { ...args, format: "xlsx" })).body.data, "base64")]) {
        const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as never);
        assert.ok(book.worksheets[0].getSheetValues().some(row => Array.isArray(row) && row.includes(currency === "KWD" ? 1 : currency === "USD" ? 10 : 1000)));
      }
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    assert.deepEqual(await snapshot(), before);
    await clear();
    const now = new Date(), month = now.toISOString().slice(0, 7), today = now.toISOString().slice(0, 10);
    await entry(rev.id, 1250, today, { credit: true }); await entry(exp.id, 250, today);
    const trend = await body(monthly, "?months=3"); assert.equal(trend.months.length, 3); assert.equal(trend.months[2].month, month);
    assert.equal(trend.months[2].netIncomeMinor, "1000"); assert.deepEqual(trend.netIncomeSparklineMinor, ["0", "0", "1000"]);
    assert.deepEqual((await ma.call("monthly_trends", { months: 3 })).body, trend);
    await clear();
    // Existing legacy and exact document-writer clients feed identical report units.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
      const input = { contactId: local.id, issueDate: "2024-03-01", dueDate: "2024-03-31", lines: [{ description: "Client", ...price }] };
      const i = await createInvoice(ctx, input, "rest"); await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, i.invoice.id));
      const b = await createBill(ctx, input, "rest"); await db.update(bill).set({ status: "received" }).where(eq(bill.id, b.bill.id));
    }
    await document(invoice, 100, { contactId: foreign.id }); await document(invoice, 50, { contactId: deleted.id });
    await document(bill, 999, { contactId: other.id });
    for (const table of [invoice, bill]) for (const options of [{ status: "draft" as const }, { status: "void" as const }, { deleted: true }, { date: "2024-02-29" }, { date: "2024-04-01" }, { org: b.id, contactId: foreign.id }]) await document(table, 900, options);
    const profits = await body(profitability); assert.equal(profits.totalRevenueMinor, "2650"); assert.equal(profits.totalCostsMinor, "2500");
    assert.equal(profits.totalProfitMinor, "150"); assert.equal(profits.entries.length, 3); assert.ok(!JSON.stringify(profits).includes("secret"));
    assert.deepEqual((await ma.call("contact_profitability", args)).body, profits);
    const foreignProfit = await (await profitability(request(query, keys.b))).json(); assert.equal(foreignProfit.totalRevenueMinor, "900");
    assert.deepEqual((await mb.call("contact_profitability", args)).body, foreignProfit);
    const populatedSnapshot = await snapshot(); await body(profitability); await ma.call("contact_profitability", args); assert.deepEqual(await snapshot(), populatedSnapshot);
    await clear();
    await document(invoice, 300, { date: "2024-02-29" }); await document(invoice, 400); await document(invoice, 999, { date: "2024-04-01" });
    await document(bill, 100, { date: "2024-02-29" }); await document(bill, 200);
    const outstanding = await body(executive); assert.equal(outstanding.kpis[5].currentMinor, "700"); assert.equal(outstanding.kpis[5].priorMinor, "300");
    assert.equal(outstanding.kpis[6].currentMinor, "300"); assert.equal(outstanding.kpis[6].priorMinor, "100");
    assert.deepEqual((await ma.call("executive_summary", args)).body, outstanding); await clear();
    for (const currency of ["IRR", "JPY", "KWD"]) {
      await document(invoice, 1250, { currency }); await document(invoice, 1);
      assert.equal((await profitability(request())).status, 422); assert.equal((await ma.call("contact_profitability", args)).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await executive(request())).status, 422);
      const filtered = await body(profitability, query + `&currencyCode=${currency}`); assert.equal(filtered.totalRevenueMinor, "1250"); assert.equal(filtered.currencyCode, currency);
      assert.deepEqual((await ma.call("contact_profitability", { ...args, currencyCode: currency })).body, filtered); await clear();
    }
    // Signed compatibility edges, final total/delta overflow and exact cancellation.
    const limit = Number.MAX_SAFE_INTEGER;
    for (const [handler, tool, seed, suffix, input] of [
      [expense, "expense_analytics", (n: number) => entry(exp.id, n), query, args],
      [executive, "executive_summary", (n: number) => entry(rev.id, n, "2024-03-01", { credit: true }), query, args],
      [profitability, "contact_profitability", (n: number) => document(invoice, n), query, args],
      [monthly, "monthly_trends", (n: number) => entry(rev.id, n, today, { credit: true }), "?months=3", { months: 3 }],
    ] as const) {
      await seed(limit); assert.equal((await handler(request(suffix))).status, 200);
      await seed(1); const saved = await snapshot(); assert.equal((await handler(request(suffix))).status, 422);
      assert.equal((await ma.call(tool, input)).body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), saved);
      await seed(-limit); assert.equal((await handler(request(suffix))).status, 200); assert.deepEqual((await ma.call(tool, input)).body, await body(handler, suffix));
      await clear(); await seed(-limit); assert.equal((await handler(request(suffix))).status, 200); await clear();
    }
    await entry(rev.id, limit, "2024-03-01", { credit: true }); await entry(rev.id, -1, "2024-02-29", { credit: true });
    assert.equal((await executive(request())).status, 422); await clear();
    await entry(exp.id, limit); await entry(cogs.id, 1); assert.equal((await expense(request())).status, 422); await clear();
    await document(invoice, limit); await document(bill, -1); assert.equal((await profitability(request())).status, 422); await clear();
    await entry(rev.id, limit, today, { credit: true }); await entry(exp.id, -1, today); assert.equal((await monthly(request("?months=3"))).status, 422); await clear();
    // SQL aggregates above int64 cancel exactly before final compatibility projection.
    for (let i = 0; i < 2; i++) {
      const id = await entry(exp.id, 0);
      await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807,credit_amount=9223372036854775807 where journal_entry_id=${id}`);
    }
    assert.equal((await body(expense)).totalExpensesMinor, "0"); assert.deepEqual((await ma.call("expense_analytics", args)).body, await body(expense)); await clear();
    const unsafe = await document(invoice, 1); await db.execute(sql`update ${invoice} set total=9223372036854775807,amount_due=9223372036854775807 where id=${unsafe}`);
    assert.equal((await profitability(request())).status, 422); assert.equal((await executive(request())).status, 422); await clear();
    await entry(rev.id, limit, "2024-03-01", { credit: true });
    assert.equal((await executive(request(query + "&format=xlsx"))).status, 422);
    assert.equal((await ma.call("export_executive_summary", { ...args, format: "xlsx" })).body.code, "LEGACY_NUMERIC_RANGE"); await clear();
    await assert.rejects(getKpiAnalytics({ ...ctx, organizationId: randomUUID() }, "expense-analytics", args), { status: 404 });
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id));
    for (const handler of [expense, monthly, executive, profitability]) assert.equal((await handler(request(""))).status, 422);
    console.log("REST and MCP KPI contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
