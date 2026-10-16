import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalEntry, journalLine,
  contact, invoice, bill } from "../../lib/db/schema";
import { GET as profitLoss } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as balanceSheet } from "../../app/api/v1/reports/balance-sheet/route";
import { GET as ledger } from "../../app/api/v1/reports/general-ledger/route";
import { GET as cashFlow } from "../../app/api/v1/reports/cash-flow/route";
import { GET as aging } from "../../app/api/v1/reports/aged-receivables/route";
import { GET as tracking } from "../../app/api/v1/reports/tracking-category/route";
import { GET as forecast } from "../../app/api/v1/reports/cash-flow-forecast/route";
import { GET as trends } from "../../app/api/v1/reports/monthly-trends/route";
import { GET as alerts } from "../../app/api/v1/dashboard/alerts/route";
import { GET as statement } from "../../app/api/v1/contacts/[id]/statement/route";
import { GET as activity } from "../../app/api/v1/contacts/[id]/activity/route";
import { GET as detail } from "../../app/api/v1/contacts/[id]/route";
import { GET as contacts } from "../../app/api/v1/contacts/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { registerContactTools } from "../../lib/mcp/tools/contacts";
import { registerContactStatementTools } from "../../lib/mcp/tools/contact-statements";
import { registerDashboardDataTools } from "../../lib/mcp/tools/dashboard-data";
import { registerForecastFxTools } from "../../lib/mcp/tools/forecast-fx";
import { profitLossUi, balanceSheetUi, statementUiMoney } from "../../lib/money/financial-statement-ui";
import { generalLedgerUi, cashFlowUi, receivablesUi, ledgerExportRows } from "../../lib/money/ledger-aging-ui";
import { trackingReportUi } from "../../lib/money/report-result-ui";
import { contactDetailUi, contactListUi, contactStatementUi, contactActivityUi, cashForecastUi,
  dashboardAlertsUi, dashboardTrendsUi, forecastChartPoint, displayJson,
  contactCreditDecimal, contactCreditInput } from "../../lib/money/contact-dashboard-ui";
import { generateCSV } from "../../lib/import-export/csv-utils";
import type { AuthContext } from "../../lib/api/auth-context";

// Deliberately independent literal SQL expectations, not computed by the adapters.
const revenue = 4000000003, expense = 907, net = "3999999096";
const today = new Date().toISOString().slice(0, 10);
const start = `${today.slice(0, 7)}-01`;
const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Report contact parent", version: "1" });
  registerReportTools(server, ctx); registerContactTools(server, ctx);
  registerContactStatementTools(server, ctx); registerDashboardDataTools(server, ctx); registerForecastFxTools(server, ctx);
  const client = new Client({ name: "Acceptance", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    let body; try { body = JSON.parse(text); } catch { body = { error: text }; }
    return { failed: result.isError === true, body };
  }, async close() { await client.close(); await server.close(); } };
}

async function snapshot() {
  const result: Record<string, unknown> = {};
  // Exclude API-key usage bookkeeping; preserve complete financial/audit SQL text.
  for (const table of ["organization", "chart_account", "journal_entry", "journal_line", "contact", "invoice", "invoice_line",
    "bill", "bill_line", "payment", "payment_allocation", "recurring_template", "recurring_template_line", "audit_log"]) {
    result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
  }
  return result;
}

async function run() {
  const [owner] = await db.insert(users).values({ email: "report-contact-parent@example.test" }).returning();
  const [foreign] = await db.insert(organization).values({ name: "Foreign secret", slug: "report-contact-foreign" }).returning();
  const [foreignParty] = await db.insert(contact).values({ organizationId: foreign.id, name: "Foreign secret", type: "both" }).returning();
  await db.insert(invoice).values({ organizationId: foreign.id, contactId: foreignParty.id, invoiceNumber: "FOREIGN",
    issueDate: today, dueDate: tomorrow, status: "sent", total: 777, amountDue: 777 });
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const [org] = await db.insert(organization).values({ name: `Parent ${currencyCode}`, slug: `report-contact-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_report_contact_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Acceptance",
      keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_parent" });
    const [cash, income, cost] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "1000", name: "Cash", type: "asset" as const },
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue" as const },
      { organizationId: org.id, code: "5000", name: "Expense", type: "expense" as const },
    ]).returning();
    async function post(number: number, debit: string, credit: string, amount: number) {
      const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: number, date: today,
        status: "posted", sourceType: "manual", description: "Shared report/contact history" }).returning();
      await db.insert(journalLine).values([
        { journalEntryId: entry.id, accountId: debit, debitAmount: amount, creditAmount: 0, currencyCode },
        { journalEntryId: entry.id, accountId: credit, debitAmount: 0, creditAmount: amount, currencyCode },
      ]);
    }
    await post(1, cash.id, income.id, revenue); await post(2, cost.id, cash.id, expense);
    const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Shared party", type: "both", currencyCode,
      creditLimit: 9007199254740991 }).returning();
    const doc = { organizationId: org.id, contactId: party.id, issueDate: today, dueDate: tomorrow, currencyCode };
    await db.insert(invoice).values({ ...doc, invoiceNumber: "PARENT-INV", status: "sent", total: revenue, subtotal: revenue, amountDue: revenue });
    await db.insert(bill).values({ ...doc, billNumber: "PARENT-BILL", status: "received", total: expense, subtotal: expense, amountDue: expense });
    const ctx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
    const mcp = await connect(ctx), denied = await connect({ ...ctx, role: "member", permissions: [] });
    const request = (path: string, args: Record<string, unknown>, authorized = true) => new Request(
      `http://fixture.test/api/v1/${path}?${new URLSearchParams(Object.entries(args).map(([k, v]) => [k, String(v)]))}`,
      { headers: { authorization: `Bearer ${authorized ? key : "dk_invalid"}`, "x-organization-id": foreign.id } });
    const contactRead = (handler: typeof statement, id = party.id) => (r: Request) => handler(r, { params: Promise.resolve({ id }) });
    type Pair = { path: string; name: string; args: Record<string, unknown>; toolArgs?: Record<string, unknown>;
      handler: (r: Request) => Promise<Response>; parse: (v: unknown) => unknown; corrupt: (v: Record<string, unknown>) => void };
    const range = { startDate: start, endDate: today };
    const pairs: Pair[] = [
      { path: "reports/profit-and-loss", name: "profit_and_loss", args: range, handler: profitLoss, parse: profitLossUi,
        corrupt: v => { v.netIncomeMinor = "1"; } },
      { path: "reports/balance-sheet", name: "balance_sheet", args: { asAt: today }, handler: balanceSheet, parse: balanceSheetUi,
        corrupt: v => { v.currencyCode = "usd"; } },
      { path: "reports/general-ledger", name: "general_ledger", args: range, handler: ledger, parse: generalLedgerUi,
        corrupt: v => { v.currencyCode = null; } },
      { path: "reports/cash-flow", name: "cash_flow_statement", args: range, handler: cashFlow, parse: cashFlowUi,
        corrupt: v => { v.netCashFlowMinor = "1"; } },
      { path: "reports/aged-receivables", name: "aged_receivables", args: { asAt: today }, handler: aging, parse: receivablesUi,
        corrupt: v => { v.grandTotalMinor = "04000000003"; } },
      { path: "reports/tracking-category", name: "tracking_category_report", args: range, handler: tracking, parse: trackingReportUi,
        corrupt: v => { v.currencyCode = "XXX"; } },
      { path: "reports/cash-flow-forecast", name: "cash_flow_forecast", args: { weeks: 1, currencyCode }, handler: forecast, parse: cashForecastUi,
        corrupt: v => { v.netForecastMinor = "1"; } },
      { path: "reports/monthly-trends", name: "monthly_trends", args: { months: 1 }, handler: trends, parse: dashboardTrendsUi,
        corrupt: v => { v.revenueSparklineMinor = ["1"]; } },
      { path: "dashboard/alerts", name: "get_dashboard_alerts", args: { currencyCode }, handler: alerts, parse: dashboardAlertsUi,
        corrupt: v => { v.overdueInvoices = {}; } },
      { path: `contacts/${party.id}/statement`, name: "get_contact_statement", args: { ...range, currencyCode },
        toolArgs: { contactId: party.id, ...range, currencyCode }, handler: contactRead(statement), parse: contactStatementUi,
        corrupt: v => { v.closingBalanceMinor = "1"; } },
      { path: `contacts/${party.id}/activity`, name: "get_contact_activity", args: {}, toolArgs: { contactId: party.id },
        handler: contactRead(activity), parse: contactActivityUi, corrupt: v => { v.activity = [{}]; } },
    ];
    try {
      const stored = (await db.execute(sql`select
        (select sum(l.debit_amount::numeric-l.credit_amount::numeric)::text from journal_line l join journal_entry e on e.id=l.journal_entry_id
          where e.organization_id=${org.id} and l.account_id=${cash.id}) as cash,
        (select sum(total)::text from invoice where organization_id=${org.id}) as receivable,
        (select sum(total)::text from bill where organization_id=${org.id}) as payable,
        (select credit_limit::text from contact where id=${party.id}) as credit`)).rows[0];
      assert.deepEqual(stored, { cash: net, receivable: "4000000003", payable: "907", credit: "9007199254740991" });
      const before = await snapshot(), bodies = new Map<string, unknown>();
      for (const pair of pairs) {
        const response = await pair.handler(request(pair.path, pair.args));
        assert.equal(response.status, 200, `${pair.name}: ${await response.clone().text()}`);
        const body = await response.clone().json(), tool = await mcp.call(pair.name, pair.toolArgs ?? pair.args);
        assert.equal(tool.failed, false, pair.name); assert.deepEqual(tool.body, body);
        assert.ok(!JSON.stringify(body).includes("Foreign secret"));
        if (pair.name !== "get_contact_activity" && pair.name !== "get_dashboard_alerts") {
          assert.equal(body.currencyCode, currencyCode, pair.name);
        }
        assert.deepEqual(pair.parse(tool.body), pair.parse(body));
        assert.deepEqual(await displayJson(response, pair.parse), pair.parse(body));
        assert.deepEqual(await (await pair.handler(request(pair.path, pair.args))).json(), body);
        bodies.set(pair.name, body);
        const damaged = structuredClone(body); pair.corrupt(damaged);
        assert.throws(() => pair.parse(damaged), pair.name);
        await assert.rejects(displayJson(new Response(JSON.stringify(damaged)), pair.parse));
        const unauthorized = await pair.handler(request(pair.path, pair.args, false));
        assert.equal(unauthorized.status, 401, pair.name);
        await assert.rejects(displayJson(unauthorized, pair.parse));
        assert.equal((await denied.call(pair.name, pair.toolArgs ?? pair.args)).failed, true, pair.name);
      }
      const pnl = profitLossUi(bodies.get("profit_and_loss")), bs = balanceSheetUi(bodies.get("balance_sheet"));
      const gl = generalLedgerUi(bodies.get("general_ledger")), cf = cashForecastUi(bodies.get("cash_flow_forecast"));
      const st = contactStatementUi(bodies.get("get_contact_statement"));
      assert.equal(pnl.totalRevenue.toString(), stored.receivable); assert.equal(pnl.totalExpenses.toString(), stored.payable);
      assert.equal(pnl.netIncome.toString(), stored.cash); assert.equal(bs.assets.total.toString(), stored.cash);
      assert.equal(bs.equity.total.toString(), stored.cash);
      assert.equal(gl.accounts.find(row => row.accountId === cash.id)!.balance.toString(), stored.cash);
      assert.equal(cashFlowUi(bodies.get("cash_flow_statement")).netCashFlow.toString(), stored.cash);
      assert.equal(trackingReportUi(bodies.get("tracking_category_report")).netIncome!.total.toString(), stored.cash);
      assert.equal(receivablesUi(bodies.get("aged_receivables")).grandTotal.toString(), stored.receivable);
      assert.equal(st.totalDebit.toString(), stored.receivable); assert.equal(st.totalCredit.toString(), stored.payable);
      assert.equal(st.closingBalance.toString(), stored.cash);
      assert.equal(cf.totalInflows.toString(), stored.receivable); assert.equal(cf.totalOutflows.toString(), stored.payable);
      assert.equal(cf.netForecast.toString(), stored.cash);
      assert.equal(forecastChartPoint(cf.weeks.at(-1)!, currencyCode).balanceExact.toString(), stored.cash);
      const trendBody = bodies.get("monthly_trends") as { netIncomeSparklineMinor: string[]; currencyCode: string };
      assert.deepEqual(trendBody.netIncomeSparklineMinor, [stored.cash]); assert.equal(trendBody.currencyCode, currencyCode);
      const movements = contactActivityUi(bodies.get("get_contact_activity")).activity;
      assert.equal(movements.length, 2); assert.ok(movements.every(row => row.currencyCode === currencyCode));
      assert.equal(movements.find(row => row.type === "invoice")!.amount.toString(), stored.receivable);
      assert.equal(movements.find(row => row.type === "bill")!.amount.toString(), stored.payable);
      // Due-tomorrow documents feed forecast/aging but must not become overdue alerts.
      const alert = dashboardAlertsUi(bodies.get("get_dashboard_alerts"));
      for (const row of [alert.overdueInvoices, alert.overdueBills]) {
        assert.equal(row.count, 0); assert.equal(row.total, 0n); assert.equal(row.currencyCode, currencyCode);
      }
      // Contact list REST adds balances; MCP intentionally returns only saved contact details.
      const listResponse = await contacts(request("contacts", {})); assert.equal(listResponse.status, 200);
      const list = (await listResponse.json()).data;
      const listed = contactListUi(list[0]); assert.equal(listed.owesYou.toString(), stored.receivable);
      assert.equal(listed.youOwe.toString(), stored.payable); assert.equal(listed.currencyCode, currencyCode);
      const detailResponse = await contactRead(detail)(request(`contacts/${party.id}`, {})); assert.equal(detailResponse.status, 200);
      const restContact = (await detailResponse.json()).contact;
      const toolContact = await mcp.call("get_contact", { contactId: party.id }); assert.equal(toolContact.failed, false);
      assert.deepEqual(toolContact.body.contact, restContact);
      const credit = contactDetailUi(restContact); assert.equal(credit.creditLimit!.toString(), stored.credit);
      assert.deepEqual(contactCreditInput(contactCreditDecimal(credit.creditLimit, currencyCode), currencyCode), { creditLimitMinor: stored.credit });
      assert.throws(() => contactDetailUi({ ...restContact, creditLimitMinor: "1" }));
      assert.match(generateCSV(ledgerExportRows(gl), ["currencyCode", "debitMinor", "creditMinor"]), /4000000003/);
      assert.match(statementUiMoney(pnl.totalRevenue, currencyCode), currencyCode === "USD" ? /\.03/ : currencyCode === "KWD" ? /\.003/ : /003/);
      for (const handler of [statement, activity, detail]) {
        assert.equal((await contactRead(handler, foreignParty.id)(request("contacts/foreign", {}))).status, 404);
      }
      for (const name of ["get_contact_statement", "get_contact_activity", "get_contact"]) {
        const args = name === "get_contact_statement" ? { contactId: foreignParty.id, ...range, currencyCode } : { contactId: foreignParty.id };
        assert.equal((await mcp.call(name, args)).failed, true, name);
      }
      assert.deepEqual(await snapshot(), before);
      // Persisted aggregate overflow crosses statements, reports and dashboard trends.
      await post(3, cash.id, income.id, Number.MAX_SAFE_INTEGER);
      await db.insert(invoice).values({ ...doc, invoiceNumber: "PARENT-OVERFLOW", status: "sent",
        total: Number.MAX_SAFE_INTEGER, amountDue: Number.MAX_SAFE_INTEGER });
      const overflowing = await snapshot();
      for (const name of ["profit_and_loss", "balance_sheet", "general_ledger", "cash_flow_statement", "tracking_category_report",
        "monthly_trends", "aged_receivables", "cash_flow_forecast", "get_contact_statement"]) {
        const pair = pairs.find(row => row.name === name)!;
        const response = await pair.handler(request(pair.path, pair.args)); assert.equal(response.status, 422, name);
        assert.equal((await response.clone().json()).code, "LEGACY_NUMERIC_RANGE", name);
        await assert.rejects(displayJson(response, pair.parse));
        const failed = await mcp.call(name, pair.toolArgs ?? pair.args); assert.equal(failed.failed, true, name);
        assert.equal(failed.body.code, "LEGACY_NUMERIC_RANGE", name);
      }
      assert.equal((await contacts(request("contacts", {}))).status, 422);
      assert.deepEqual(await snapshot(), overflowing);
    } finally { await mcp.close(); await denied.close(); }
  }
  console.log("Report contact dashboard parent REST MCP SQL acceptance verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
