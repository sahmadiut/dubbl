import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalEntry, journalLine,
  contact, invoice, bill, bankAccount, bankTransaction } from "../../lib/db/schema";
import { GET as ledger } from "../../app/api/v1/reports/general-ledger/route";
import { GET as cash } from "../../app/api/v1/reports/cash-flow/route";
import { GET as ar } from "../../app/api/v1/reports/aged-receivables/route";
import { GET as ap } from "../../app/api/v1/reports/aged-payables/route";
import { GET as tracking } from "../../app/api/v1/reports/tracking-category/route";
import { GET as ratios } from "../../app/api/v1/reports/financial-ratios/route";
import { GET as expenses } from "../../app/api/v1/reports/expense-analytics/route";
import { GET as executive } from "../../app/api/v1/reports/executive-summary/route";
import { GET as vendors } from "../../app/api/v1/reports/vendor-spend/route";
import { GET as bankCash } from "../../app/api/v1/reports/bank-cash-flow/route";
import { GET as bankStatus } from "../../app/api/v1/reports/bank-reconciliation-status/route";
import { POST as custom } from "../../app/api/v1/reports/run/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { registerBankAnalyticsTools } from "../../lib/mcp/tools/bank-analytics";
import { registerCustomReportTools } from "../../lib/mcp/tools/custom-reports";
import { generalLedgerUi, cashFlowUi, receivablesUi, payablesUi, ledgerExportRows,
  agingExportRows, reportUiMoney } from "../../lib/money/ledger-aging-ui";
import { trackingReportUi, customReportUiConfig, customReportUi, customReportCell,
  reportResultJson } from "../../lib/money/report-result-ui";
import { bankCashFlowUi, bankStatusUi, expenseAnalyticsUi, executiveSummaryUi,
  financialRatiosUi, vendorSpendUi } from "../../lib/money/analytical-report-ui";
import { generateCSV } from "../../lib/import-export/csv-utils";
import type { AuthContext } from "../../lib/api/auth-context";

const range = { startDate: "2024-01-01", endDate: "2024-01-31" };
const revenue = 3000000001, cost = 901;
// Literal expectations are independent of report helpers and numeric wire aliases.
const expectedNet = "2999999100";
async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Auxiliary UI parent", version: "1" });
  registerReportTools(server, ctx); registerBankAnalyticsTools(server, ctx); registerCustomReportTools(server, ctx);
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
  const rows: Record<string, unknown> = {};
  // API-key last-use metadata is deliberately excluded; financial history is not.
  for (const table of ["organization", "journal_entry", "journal_line", "chart_account", "contact", "invoice", "bill",
    "bank_account", "bank_transaction", "saved_report", "audit_log"]) {
    rows[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
  }
  return rows;
}

async function run() {
  const [owner] = await db.insert(users).values({ email: "auxiliary-parent@example.test" }).returning();
  const [foreign] = await db.insert(organization).values({ name: "Foreign secret", slug: "auxiliary-foreign" }).returning();
  const [foreignBank] = await db.insert(bankAccount).values({ organizationId: foreign.id, accountName: "Foreign secret", balance: 777 }).returning();
  await db.insert(bankTransaction).values({ bankAccountId: foreignBank.id, date: "2024-01-10", description: "Foreign secret", amount: 777 });
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    // Separate synthetic tenants preserve saved currency history; no relabeling/rescaling.
    const [org] = await db.insert(organization).values({ name: `Auxiliary ${currencyCode}`, slug: `auxiliary-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_auxiliary_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Acceptance",
      keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_auxiliary" });
    const [cashAccount, income, expense] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "1000", name: "Bank", type: "asset" as const, subType: "bank" },
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue" as const },
      { organizationId: org.id, code: "5000", name: "Expense", type: "expense" as const },
    ]).returning();
    async function post(number: number, debit: string, credit: string, amount: number) {
      const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: number,
        date: "2024-01-10", status: "posted", sourceType: "manual", description: "Shared synthetic history" }).returning();
      await db.insert(journalLine).values([
        { journalEntryId: entry.id, accountId: debit, debitAmount: amount, creditAmount: 0, currencyCode },
        { journalEntryId: entry.id, accountId: credit, debitAmount: 0, creditAmount: amount, currencyCode },
      ]);
    }
    await post(1, cashAccount.id, income.id, revenue); await post(2, expense.id, cashAccount.id, cost);
    const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Shared party", type: "both", currencyCode }).returning();
    const doc = { organizationId: org.id, contactId: party.id, issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode };
    await db.insert(invoice).values({ ...doc, invoiceNumber: "PARENT-INV", status: "sent", total: revenue, subtotal: revenue, amountDue: revenue });
    await db.insert(bill).values({ ...doc, billNumber: "PARENT-BILL", status: "received", total: cost, subtotal: cost, amountDue: cost });
    const [bank] = await db.insert(bankAccount).values({ organizationId: org.id, chartAccountId: cashAccount.id,
      accountName: "Shared bank", currencyCode, balance: 2999999100 }).returning();
    await db.insert(bankTransaction).values([
      { bankAccountId: bank.id, date: "2024-01-10", amount: revenue, currencyCode, description: "Shared inflow" },
      { bankAccountId: bank.id, date: "2024-01-11", amount: -cost, currencyCode, description: "Shared outflow" },
    ]);
    const ctx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
    const mcp = await connect(ctx), denied = await connect({ ...ctx, role: "member", permissions: [] });
    function request(path: string, args: Record<string, unknown>, authorized = true, post = false) {
      return new Request(`http://fixture.test/api/v1/reports/${path}?${post ? "" : new URLSearchParams(Object.entries(args).map(([k, v]) => [k, String(v)]))}`, {
        method: post ? "POST" : "GET", headers: { authorization: `Bearer ${authorized ? key : "dk_invalid"}`,
          "x-organization-id": foreign.id, "content-type": "application/json" }, ...(post ? { body: JSON.stringify(args) } : {}),
      });
    }
    const config = customReportUiConfig({ dataSource: "transactions", columns: ["id", "amountMinor"],
      dateRange: { from: range.startDate, to: range.endDate } });
    const pairs: { path: string; name: string; handler: (r: Request) => Promise<Response>; args: Record<string, unknown>;
      parse: (v: unknown) => unknown; corrupt: (v: Record<string, unknown>) => void }[] = [
      { path: "general-ledger", name: "general_ledger", handler: ledger, args: range, parse: generalLedgerUi,
        corrupt: v => { v.currencyCode = "usd"; } },
      { path: "cash-flow", name: "cash_flow_statement", handler: cash, args: range, parse: cashFlowUi,
        corrupt: v => { v.netCashFlowMinor = "1"; } },
      { path: "aged-receivables", name: "aged_receivables", handler: ar, args: { asAt: range.endDate }, parse: receivablesUi,
        corrupt: v => { v.grandTotalMinor = "1"; } },
      { path: "aged-payables", name: "aged_payables", handler: ap, args: { asAt: range.endDate }, parse: payablesUi,
        corrupt: v => { v.grandTotalMinor = "1"; } },
      { path: "tracking-category", name: "tracking_category_report", handler: tracking, args: range, parse: trackingReportUi,
        corrupt: v => { v.currencyCode = null; } },
      { path: "financial-ratios", name: "financial_ratios", handler: ratios, args: range, parse: financialRatiosUi,
        corrupt: v => { v.currencyCode = "XXX"; } },
      { path: "expense-analytics", name: "expense_analytics", handler: expenses, args: range, parse: expenseAnalyticsUi,
        corrupt: v => { v.totalExpensesMinor = "0901"; } },
      { path: "executive-summary", name: "executive_summary", handler: executive, args: range, parse: executiveSummaryUi,
        corrupt: v => { v.currencyCode = null; } },
      { path: "vendor-spend", name: "vendor_spend", handler: vendors, args: { ...range, currencyCode }, parse: vendorSpendUi,
        corrupt: v => { v.totalSpend = Number.MAX_SAFE_INTEGER + 1; } },
      { path: "bank-cash-flow", name: "bank_cash_flow", handler: bankCash, args: { ...range, bankAccountId: bank.id }, parse: bankCashFlowUi,
        corrupt: v => { v.currencyCode = "usd"; } },
      { path: "bank-reconciliation-status", name: "bank_reconciliation_status", handler: bankStatus, args: { bankAccountId: bank.id }, parse: bankStatusUi,
        corrupt: v => { v.accounts = [{}]; } },
      { path: "run", name: "run_custom_report", handler: custom, args: config, parse: v => customReportUi(v, config),
        corrupt: v => { v.data = [{ id: "missing-carriers", amountMinor: "1" }]; } },
    ];
    try {
      const [stored] = (await db.execute(sql`select
        (select sum(l.debit_amount::numeric-l.credit_amount::numeric)::text from journal_line l join journal_entry e on e.id=l.journal_entry_id
          where e.organization_id=${org.id} and l.account_id=${cashAccount.id}) as cash,
        (select sum(amount)::text from bank_transaction where bank_account_id=${bank.id}) as bank,
        (select sum(amount_due)::text from invoice where organization_id=${org.id}) as receivable,
        (select sum(amount_due)::text from bill where organization_id=${org.id}) as payable`)).rows;
      assert.deepEqual(stored, { cash: expectedNet, bank: expectedNet, receivable: "3000000001", payable: "901" });
      const before = await snapshot();
      const bodies = new Map<string, unknown>();
      for (const pair of pairs) {
        const post = pair.path === "run";
        const response = await pair.handler(request(pair.path, pair.args, true, post));
        assert.equal(response.status, 200, `${pair.name}: ${await response.clone().text()}`);
        const body = await response.clone().json(), tool = await mcp.call(pair.name, pair.args);
        assert.equal(tool.failed, false, pair.name); assert.deepEqual(tool.body, body);
        if (pair.path === "run") assert.ok(body.data.every((row: { currencyCode: string }) => row.currencyCode === currencyCode));
        else if (pair.path === "bank-reconciliation-status") assert.equal(body.accounts[0].currencyCode, currencyCode);
        else assert.equal(body.currencyCode, currencyCode, pair.name);
        assert.ok(!JSON.stringify(body).includes("Foreign secret"));
        assert.deepEqual(pair.parse(tool.body), pair.parse(body)); bodies.set(pair.name, body);
        assert.deepEqual(await reportResultJson(response, pair.parse), pair.parse(body));
        // Repeated reads preserve transport result and all saved financial history.
        assert.deepEqual(await (await pair.handler(request(pair.path, pair.args, true, post))).json(), body);
        const damaged = structuredClone(body); pair.corrupt(damaged);
        assert.throws(() => pair.parse(damaged), pair.name);
        await assert.rejects(reportResultJson(new Response(JSON.stringify(damaged)), pair.parse));
        const unauthorized = await pair.handler(request(pair.path, pair.args, false, post));
        assert.equal(unauthorized.status, 401, pair.name);
        await assert.rejects(reportResultJson(unauthorized, pair.parse));
        assert.equal((await denied.call(pair.name, pair.args)).failed, true, pair.name);
      }
      const gl = generalLedgerUi(bodies.get("general_ledger"));
      assert.equal(gl.currencyCode, currencyCode);
      assert.equal(gl.accounts.find(a => a.accountId === cashAccount.id)!.balance.toString(), stored.cash);
      assert.equal(cashFlowUi(bodies.get("cash_flow_statement")).netCashFlow.toString(), stored.cash);
      assert.equal(trackingReportUi(bodies.get("tracking_category_report")).netIncome!.total.toString(), stored.cash);
      assert.equal(financialRatiosUi(bodies.get("financial_ratios")).balances.netIncome.toString(), stored.cash);
      assert.equal(expenseAnalyticsUi(bodies.get("expense_analytics")).totalExpenses.toString(), stored.payable);
      assert.equal(executiveSummaryUi(bodies.get("executive_summary")).kpis.find(k => k.key === "netIncome")!.current.toString(), stored.cash);
      assert.equal(vendorSpendUi(bodies.get("vendor_spend")).totalSpend.toString(), stored.payable);
      assert.equal(receivablesUi(bodies.get("aged_receivables")).grandTotal.toString(), stored.receivable);
      assert.equal(payablesUi(bodies.get("aged_payables")).grandTotal.toString(), stored.payable);
      assert.equal(bankCashFlowUi(bodies.get("bank_cash_flow")).totals.net.toString(), stored.bank);
      assert.equal(bankStatusUi(bodies.get("bank_reconciliation_status")).accounts[0].balanceDiscrepancy, 0n);
      const rows = customReportUi(bodies.get("run_custom_report"), config);
      assert.equal(rows.reduce((total, row) => total + (row.amount as bigint), 0n).toString(), stored.bank);
      assert.equal(customReportCell(rows.find(row => row.amount === 3000000001n)!, "amount"), reportUiMoney(3000000001n, currencyCode));
      assert.match(generateCSV(ledgerExportRows(gl), ["currencyCode", "creditMinor", "debitMinor"]), /3000000001/);
      assert.match(generateCSV(agingExportRows(receivablesUi(bodies.get("aged_receivables"))), ["currencyCode", "amountDueMinor"]), new RegExp(`${currencyCode},3000000001`));
      const formatted = reportUiMoney(3000000001n, currencyCode);
      assert.match(formatted, currencyCode === "USD" ? /\.01/ : currencyCode === "KWD" ? /\.001/ : /001/);
      assert.deepEqual(await snapshot(), before);
      // Cross-tenant identifier injection must fail in both actual transports.
      const forbidden = await bankCash(request("bank-cash-flow", { ...range, bankAccountId: foreignBank.id }));
      assert.equal(forbidden.status, 404);
      assert.equal((await mcp.call("bank_cash_flow", { ...range, bankAccountId: foreignBank.id })).failed, true);
      assert.deepEqual(await snapshot(), before);
      // Independent persisted overflow makes every ledger-derived family fail closed.
      await post(3, cashAccount.id, income.id, Number.MAX_SAFE_INTEGER);
      const overflowing = await snapshot();
      for (const name of ["general_ledger", "cash_flow_statement", "tracking_category_report", "financial_ratios", "executive_summary"]) {
        const pair = pairs.find(pair => pair.name === name)!;
        const response = await pair.handler(request(pair.path, pair.args));
        assert.equal(response.status, 422, name);
        assert.equal((await response.clone().json()).code, "LEGACY_NUMERIC_RANGE", name);
        await assert.rejects(reportResultJson(response, pair.parse));
        const failedTool = await mcp.call(name, pair.args);
        assert.equal(failedTool.failed, true, name);
        assert.equal(failedTool.body.code, "LEGACY_NUMERIC_RANGE", name);
      }
      assert.deepEqual(await snapshot(), overflowing);
    } finally { await mcp.close(); await denied.close(); }
  }
  console.log("Auxiliary UI parent REST MCP SQL acceptance verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
