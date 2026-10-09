// Only run inside the harness's migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, subscription, contact, chartAccount,
  taxRate, invoice, bill, journalLine } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as budget } from "../../app/api/v1/reports/budget-vs-actual/route";
import { GET as pnl } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as income } from "../../app/api/v1/reports/income-statement/route";
import { GET as ratios } from "../../app/api/v1/reports/financial-ratios/route";
import { GET as receivables } from "../../app/api/v1/reports/aged-receivables/route";
import { GET as payables } from "../../app/api/v1/reports/aged-payables/route";
import { GET as statement } from "../../app/api/v1/contacts/[id]/statement/route";
import { GET as taxSummary } from "../../app/api/v1/reports/tax-summary/route";
import { GET as salesTax } from "../../app/api/v1/reports/sales-tax/route";
import { GET as scheduleC } from "../../app/api/v1/reports/schedule-c/route";
import { GET as sales } from "../../app/api/v1/reports/sales-by-customer/route";
import { GET as vendor } from "../../app/api/v1/reports/vendor-spend/route";
import { GET as expenseAnalytics } from "../../app/api/v1/reports/expense-analytics/route";
import { GET as executive } from "../../app/api/v1/reports/executive-summary/route";
import { GET as forecast } from "../../app/api/v1/reports/cash-flow-forecast/route";
import { GET as widget } from "../../app/api/v1/dashboard/widgets/[type]/data/route";
import { POST as customRun } from "../../app/api/v1/reports/run/route";
import { POST as savedCreate } from "../../app/api/v1/reports/saved/route";
import { GET as savedExport } from "../../app/api/v1/reports/saved/[id]/export/route";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Report dashboard integration", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, args: object = {}) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

// Numeric aliases are integer money; older financial strings always divide by 100.
function aliases(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("Minor") && typeof child === "string") {
      assert.match(child, /^(0|-?[1-9]\d*)$/);
      const legacy: unknown = (value as Record<string, unknown>)[key.slice(0, -5)];
      if (typeof legacy === "number") { assert.ok(Number.isSafeInteger(legacy)); assert.equal(child, String(legacy)); }
      else if (typeof legacy === "string") {
        assert.match(legacy, /^-?\d+\.\d{2}$/);
        assert.equal(BigInt(legacy.replace(".", "")), BigInt(child));
      }
    }
    aliases(child);
  }
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Reports A", slug: "reports-a" }, { name: "Reports B", slug: "reports-b" }]).returning();
  const [owner, denied, reader] = await db.insert(users).values([
    { email: "reports-owner@example.test" }, { email: "reports-denied@example.test" }, { email: "reports-reader@example.test" },
  ]).returning();
  const roles = await db.insert(customRole).values([{ organizationId: a.id, name: "No data", permissions: [] },
    { organizationId: a.id, name: "Data only", permissions: ["view:data"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: roles[0].id },
    { organizationId: a.id, userId: reader.id, role: "member", customRoleId: roles[1].id }]);
  await db.insert(subscription).values([a, b].map(org => ({ organizationId: org.id, plan: "pro" as const })));
  const keys = { a: "dk_reports_a", b: "dk_reports_b", denied: "dk_reports_denied", reader: "dk_reports_reader" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : label === "reader" ? reader.id : owner.id,
    name: label, keyPrefix: "dk_reports", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id });
  const noRead = await mcp({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const readOnly = await mcp({ ...ctx, userId: reader.id, role: "member", permissions: ["view:data"] });
  const request = (path: string, key = keys.a, body?: unknown) => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = async (response: Response, status = 200) => {
    assert.equal(response.status, status, await response.clone().text()); return response.json();
  };
  const call = async (name: string, input: object = {}) => {
    const result = await ma.call(name, input); assert.equal(result.isError, false, JSON.stringify(result.body)); return result.body;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["organization", "contact", "chart_account", "tax_rate", "invoice", "invoice_line", "bill", "bill_line", "journal_entry", "journal_line",
      "budget", "budget_line", "budget_period", "saved_report", "report_schedule", "notification", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    return result;
  };
  const accounts = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" as const },
    { organizationId: a.id, code: "2100", name: "AP", type: "liability" as const },
    { organizationId: a.id, code: "2200", name: "Output VAT", type: "liability" as const },
    { organizationId: a.id, code: "1500", name: "Input VAT", type: "asset" as const },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const, subType: "income" },
    { organizationId: a.id, code: "5000", name: "Supplies", type: "expense" as const, subType: "supplies" },
  ]).returning();
  const [party, foreign] = await db.insert(contact).values([a, b].map(org => ({ organizationId: org.id, name: org === a ? "Local" : "Foreign secret", type: "both" as const }))).returning();
  const [rate] = await db.insert(taxRate).values({ organizationId: a.id, name: "Synthetic 20%", rate: 2000 }).returning();
  const today = new Date().toISOString().slice(0, 10), period = { startDate: today, endDate: today };
  const config = { dataSource: "invoices", columns: ["subtotal", "taxTotal", "total", "amountDue", "currencyCode"], filters: [], groupBy: [], dateRange: { from: today, to: today } };
  try {
    const ids: string[] = [];
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "2147483750" }]) {
      const input = { contactId: party.id, issueDate: today, dueDate: today,
        lines: [{ description: "Recognized taxed sale", accountId: accounts[4].id, taxRateId: rate.id, ...price }] };
      const saved = "unitPrice" in price ? (await json(await createInvoice(request("invoices", keys.a, input)), 201)).invoice : (await call("create_invoice", input)).invoice;
      ids.push(saved.id); await sendInvoice(ctx, saved.id);
    }
    const purchase = (await call("create_bill", { contactId: party.id, issueDate: today, dueDate: today,
      lines: [{ description: "Recognized supplies", accountId: accounts[5].id, taxRateId: rate.id, unitPriceMinor: "250" }] })).bill;
    await receiveBill(ctx, purchase.id);
    await db.insert(invoice).values({ organizationId: b.id, contactId: foreign.id, invoiceNumber: "FOREIGN", issueDate: today, dueDate: today, status: "sent", total: 777, amountDue: 777 });
    const plan = await call("create_budget", { name: "Revenue and supplies", ...period, periodType: "custom", lines: [
      { accountId: accounts[4].id, totalMinor: "2147485000", periods: [{ label: "Today", ...period, amountMinor: "2147485000" }] },
      { accountId: accounts[5].id, total: 250, periods: [{ label: "Today", ...period, amount: 250 }] },
    ] });
    const savedReport = (await json(await savedCreate(request("reports/saved", keys.a, { name: "Recognized invoice source", config })), 201)).report;
    const pairs = [
      { path: "reports/budget-vs-actual", tool: "budget_vs_actual", handler: budget, input: { budgetId: plan.budget.id } },
      { path: "reports/profit-and-loss", tool: "profit_and_loss", handler: pnl, input: period },
      { path: "reports/income-statement", tool: "income_statement", handler: income, input: { from: today, to: today } },
      { path: "reports/financial-ratios", tool: "financial_ratios", handler: ratios, input: period },
      { path: "reports/aged-receivables", tool: "aged_receivables", handler: receivables, input: { asAt: today } },
      { path: "reports/aged-payables", tool: "aged_payables", handler: payables, input: { asAt: today } },
      { path: `contacts/${party.id}/statement`, tool: "get_contact_statement", handler: (r: Request) => statement(r, { params: Promise.resolve({ id: party.id }) }), input: period, toolExtra: { contactId: party.id } },
      { path: "reports/tax-summary", tool: "tax_summary", handler: taxSummary, input: period },
      { path: "reports/sales-tax", tool: "sales_tax", handler: salesTax, input: period },
      { path: "reports/schedule-c", tool: "schedule_c", handler: scheduleC, input: period },
      { path: "reports/sales-by-customer", tool: "sales_by_customer", handler: sales, input: period },
      { path: "reports/vendor-spend", tool: "vendor_spend", handler: vendor, input: period },
      { path: "reports/expense-analytics", tool: "expense_analytics", handler: expenseAnalytics, input: period },
      { path: "reports/executive-summary", tool: "executive_summary", handler: executive, input: period },
      { path: "reports/cash-flow-forecast", tool: "cash_flow_forecast", handler: forecast, input: { weeks: 1 } },
      ...([["accounts_receivable", "get_dashboard_receivables"], ["accounts_payable", "get_dashboard_payables"]] as const).map(([type, tool]) => ({
        path: `dashboard/widgets/${type}/data`, tool, handler: (r: Request) => widget(r, { params: Promise.resolve({ type }) }), input: {},
      })),
    ];
    const query = (input: object) => new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
    const get = async (pair: typeof pairs[number]) => {
      const body = await json(await pair.handler(request(`${pair.path}?${query(pair.input)}`)));
      assert.deepEqual(body, await call(pair.tool, { ...pair.input, ...("toolExtra" in pair ? pair.toolExtra : {}) }), pair.tool); aliases(body); return body;
    };
    for (const pair of pairs) {
      const tool = ma.tools.find(tool => tool.name === pair.tool)!; assert.ok(tool, pair.tool);
      assert.equal((await ma.call(pair.tool, { ...pair.input, ...("toolExtra" in pair ? pair.toolExtra : {}), organizationId: b.id })).isError, true, `${pair.tool} accepted unknown controls`);
      assert.equal(tool.inputSchema.additionalProperties, false, pair.tool); assert.ok(tool.description);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, pair.tool);
    }
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      // Synthetic report contexts only: no settings operation or production history rewrite.
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      await db.update(invoice).set({ currencyCode: currency }).where(eq(invoice.organizationId, a.id));
      await db.update(bill).set({ currencyCode: currency }).where(eq(bill.organizationId, a.id));
      const before = await snapshot();
      const [br, pl, inc, ra, ar, ap, cs, ts, st, sc, sa, vs, ea, ex, fc, dr, dp] = await Promise.all(pairs.map(get));
      assert.equal(pl.totalRevenueMinor, "2147485000"); assert.equal(pl.totalExpensesMinor, "250"); assert.equal(pl.netIncomeMinor, "2147484750");
      assert.equal(inc.netIncomeMinor, pl.netIncomeMinor); assert.equal(ra.balances.netIncomeMinor, pl.netIncomeMinor);
      assert.equal(br.comparisons.find((r: { accountId: string }) => r.accountId === accounts[4].id).actualMinor, pl.totalRevenueMinor);
      assert.equal(br.comparisons.find((r: { accountId: string }) => r.accountId === accounts[5].id).actualMinor, pl.totalExpensesMinor);
      assert.equal(br.totalVarianceMinor, "0"); assert.equal(br.totalActualMinor, "2147485250"); // Sum of natural signs, not profit.
      assert.equal(sa.totals.netMinor, pl.totalRevenueMinor); assert.equal(sa.totals.taxMinor, "429497000"); assert.equal(sa.totals.grossMinor, "2576982000");
      assert.equal(ts.totalOutputTaxMinor, sa.totals.taxMinor); assert.equal(ts.totalInputTaxMinor, "50"); assert.equal(ts.netTaxPayableMinor, "429496950");
      aliases(st); assert.equal(sc.totalIncomeMinor, pl.totalRevenueMinor); assert.equal(sc.totalExpensesMinor, pl.totalExpensesMinor); assert.equal(sc.netProfitMinor, pl.netIncomeMinor);
      assert.equal(ar.grandTotalMinor, sa.totals.grossMinor); assert.equal(dr.totalMinor, ar.grandTotalMinor);
      assert.equal(ap.grandTotalMinor, "300"); assert.equal(dp.totalMinor, ap.grandTotalMinor); assert.equal(vs.totalSpendMinor, ap.grandTotalMinor);
      assert.equal(cs.closingBalanceMinor, "2576981700"); assert.equal(BigInt(cs.closingBalanceMinor), BigInt(ar.grandTotalMinor) - BigInt(ap.grandTotalMinor));
      assert.equal(ea.totalExpensesMinor, pl.totalExpensesMinor); assert.equal(ex.kpis.find((k: { key: string }) => k.key === "netIncome").currentMinor, pl.netIncomeMinor);
      assert.equal(fc.totalInflowsMinor, ar.grandTotalMinor); assert.equal(fc.totalOutflowsMinor, ap.grandTotalMinor); assert.equal(fc.netForecastMinor, cs.closingBalanceMinor);
      for (const report of [br, pl, inc, ra, ar, ap, ts, st, sc, sa, vs, ea, ex, fc, dr, dp]) assert.equal(report.currencyCode, currency);
      const data = await json(await customRun(request("reports/run", keys.a, config))); assert.deepEqual(data, await call("run_custom_report", config)); aliases(data);
      assert.equal(data.total, 2); assert.equal(data.data.reduce((sum: bigint, row: { totalMinor: string }) => sum + BigInt(row.totalMinor), 0n), BigInt(ar.grandTotalMinor));
      const csv = await savedExport(request("reports/saved"), { params: Promise.resolve({ id: savedReport.id }) }); assert.equal(csv.status, 200);
      assert.equal(await csv.text(), Buffer.from((await call("export_saved_report", { id: savedReport.id })).content, "base64").toString());
      assert.deepEqual(await snapshot(), before);
    }
    const beforeFailures = await snapshot();
    for (const pair of pairs) {
      const args = { ...pair.input, ...("toolExtra" in pair ? pair.toolExtra : {}) }, path = `${pair.path}?${query(pair.input)}`;
      for (const [key, status] of [["dk_invalid", 401], [keys.denied, 403], [keys.reader, 200]] as const)
        assert.equal((await pair.handler(request(path, key))).status, status, pair.tool);
      assert.equal((await noRead.call(pair.tool, args)).body.status, 403); assert.equal((await readOnly.call(pair.tool, args)).isError, false);
      assert.equal((await pair.handler(request(`${path}&organizationId=${b.id}`))).status, 400);
      assert.equal((await ma.call(pair.tool, { ...args, organizationId: b.id })).isError, true);
      const other = await pair.handler(request(path, keys.b)), otherTool = await mb.call(pair.tool, args);
      const foreignStatus = pair.tool === "get_contact_statement" ? 404 : 200;
      assert.equal(other.status, foreignStatus); assert.equal(otherTool.isError, foreignStatus !== 200);
      if (foreignStatus === 200) {
        const foreignBody = await other.json(); assert.deepEqual(foreignBody, otherTool.body);
        assert.ok(!JSON.stringify(foreignBody).includes(party.id), pair.tool);
      }
    }
    assert.deepEqual(await snapshot(), beforeFailures);
    // Stored corruption must fail consistently across document/report/export consumers.
    await db.execute(sql`update invoice set total = 9223372036854775807, amount_due = 9223372036854775807 where id = ${ids[0]}`);
    const corrupt = await snapshot();
    for (const name of ["aged_receivables", "get_dashboard_receivables", "cash_flow_forecast", "get_contact_statement", "run_custom_report", "export_saved_report"]) {
      const input = name === "get_contact_statement" ? { contactId: party.id, ...period } : name === "run_custom_report" ? config : name === "export_saved_report" ? { id: savedReport.id } : {};
      assert.equal((await ma.call(name, input)).body.code, "LEGACY_NUMERIC_RANGE", name);
    }
    assert.equal((await receivables(request("reports/aged-receivables"))).status, 422);
    assert.equal((await customRun(request("reports/run", keys.a, config))).status, 422);
    assert.equal((await savedExport(request("reports/saved"), { params: Promise.resolve({ id: savedReport.id }) })).status, 422);
    assert.deepEqual(await snapshot(), corrupt);
    // Base GL overflow also fails across independent budget, tax and financial readers.
    await db.execute(sql`update journal_line set credit_amount = 9223372036854775807 where account_id = ${accounts[4].id}`);
    const unsafeLedger = await snapshot();
    for (const pair of pairs.filter(pair => ["budget_vs_actual", "profit_and_loss", "income_statement", "schedule_c", "executive_summary"].includes(pair.tool))) {
      assert.equal((await pair.handler(request(`${pair.path}?${query(pair.input)}`))).status, 422, pair.tool);
      assert.equal((await ma.call(pair.tool, pair.input)).body.code, "LEGACY_NUMERIC_RANGE", pair.tool);
    }
    assert.deepEqual(await snapshot(), unsafeLedger);
    // Reads never rewrite original posted lines, even after synthetic currency contexts.
    assert.ok((await db.select({ currencyCode: journalLine.currencyCode }).from(journalLine)).every(line => line.currencyCode === "USD"));
    console.log("Combined report dashboard contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close(), readOnly.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
