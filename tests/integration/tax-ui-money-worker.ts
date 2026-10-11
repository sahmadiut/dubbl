import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalEntry, journalLine, taxPeriod, taxReturnLine, contact, invoice, invoiceLine, taxRate } from "../../lib/db/schema";
import { GET as PERIOD } from "../../app/api/v1/tax-periods/[id]/route";
import { POST as SETTLE } from "../../app/api/v1/tax-periods/[id]/file/route";
import { GET as SALES } from "../../app/api/v1/reports/sales-tax/route";
import { GET as VAT } from "../../app/api/v1/reports/vat-return/route";
import { GET as BAS } from "../../app/api/v1/reports/bas/route";
import { GET as SCHEDULE } from "../../app/api/v1/reports/schedule-c/route";
import { GET as DRILL } from "../../app/api/v1/reports/vat-return/transactions/route";
import { POST as WORKFLOW } from "../../app/api/v1/approval-workflows/route";
import { POST as RATE } from "../../app/api/v1/exchange-rates/route";
import { registerTaxPeriodTools } from "../../lib/mcp/tools/tax-periods";
import { registerTaxTools } from "../../lib/mcp/tools/tax";
import { registerTaxReportTools } from "../../lib/mcp/tools/tax-reports";
import { registerApprovalTools } from "../../lib/mcp/tools/approvals";
import { registerCurrencyTools } from "../../lib/mcp/tools/currencies";
import { taxUiMinor, taxUiRows, taxUiCurrency, taxUiDecimal, taxUiSettlement, taxUiConditions, taxUiRateInput } from "../../lib/money/tax-ui";

async function run() {
  const [owner] = await db.insert(users).values({ email: "tax-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const [org] = await db.insert(organization).values({ name: `Tax UI ${currencyCode}`, slug: `tax-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    const [approver] = await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" }).returning();
    const key = `dk_tax_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_tax", keyHash: createHash("sha256").update(key).digest("hex") });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    const server = new McpServer({ name: "Tax UI", version: "1" });
    registerTaxPeriodTools(server, ctx); registerTaxTools(server, ctx); registerTaxReportTools(server, ctx); registerApprovalTools(server, ctx); registerCurrencyTools(server, ctx);
    const client = new Client({ name: "Tax UI fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    const mcp = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { text: string }[])[0].text;
      return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    };
    const request = (body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/tax-ui${query}`, {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
    const [output, bank, income] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "2200", name: "Output", type: "liability" as const, currencyCode },
      { organizationId: org.id, code: "1000", name: "Bank", type: "asset" as const, subType: "bank", currencyCode },
      { organizationId: org.id, code: "4000", name: "Income", type: "revenue" as const, subType: "income", currencyCode },
    ]).returning();
    const raw = 3000000001;
    const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 1, date: "2026-01-15", description: "Synthetic source", status: "posted" }).returning();
    await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: bank.id, debitAmount: raw * 2, currencyCode },
      { journalEntryId: entry.id, accountId: output.id, creditAmount: raw, currencyCode }, { journalEntryId: entry.id, accountId: income.id, creditAmount: raw, currencyCode }]);
    const [period] = await db.insert(taxPeriod).values({ organizationId: org.id, name: "Synthetic frozen return", type: "monthly", startDate: "2026-01-01", endDate: "2026-01-31", status: "filed" }).returning();
    await db.insert(taxReturnLine).values({ taxPeriodId: period.id, boxNumber: "5", label: "Net", amount: raw, sortOrder: 5 });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Synthetic buyer" }).returning();
    const [rate] = await db.insert(taxRate).values({ organizationId: org.id, name: "Rate", rate: 1000 }).returning();
    const [sale] = await db.insert(invoice).values({ organizationId: org.id, contactId: customer.id, invoiceNumber: "I1", issueDate: "2026-01-15", dueDate: "2026-01-31", status: "sent", currencyCode, subtotal: raw, total: raw * 2 }).returning();
    await db.insert(invoiceLine).values({ invoiceId: sale.id, description: "Synthetic", amount: raw, taxAmount: raw, taxRateId: rate.id });
    const params = { params: Promise.resolve({ id: period.id }) }, dates = { startDate: "2026-01-01", endDate: "2026-01-31" };
    try {
      const saved = (await data(await PERIOD(request(), params))).taxPeriod;
      assert.deepEqual((await mcp("get_tax_period", { taxPeriodId: period.id })).body.taxPeriod, saved);
      const rows = taxUiRows(saved.lines as { amount: number; amountMinor: string }[], ["amount"]);
      assert.equal(rows[0].amount, BigInt(raw));
      const preview = taxUiSettlement(taxUiDecimal(rows[0].amount, currencyCode), currencyCode);
      assert.equal(preview.amountMinor, String(raw)); assert.equal(preview.error, null);
      const sqlSaved = (await db.execute(sql`select amount::text as amount from tax_return_line where tax_period_id=${period.id}`)).rows[0];
      assert.equal(sqlSaved.amount, preview.amountMinor);
      for (const [handler, name, key, moneyKey] of [[SALES, "sales_tax", "breakdown", "taxCollected"], [VAT, "vat_return", "boxes", "amount"], [BAS, "bas", "fields", "amount"], [SCHEDULE, "schedule_c", "lines", "amount"]] as const) {
        const body = await data(await handler(request(undefined, `?${new URLSearchParams(dates)}`)));
        assert.deepEqual((await mcp(name, dates)).body, body); assert.equal(taxUiCurrency(body.currencyCode), currencyCode);
        const adapted = taxUiRows(body[key] as Record<typeof moneyKey, number>[], [moneyKey]);
        assert.ok(adapted.some(row => row[moneyKey] === BigInt(raw)));
        if (key === "breakdown") assert.equal(taxUiRows(body.breakdown as { taxableAmount: number }[], ["taxableAmount"])[0].taxableAmount, BigInt(raw));
        if (key === "lines") assert.equal(taxUiMinor(body.totalIncome, body.totalIncomeMinor), BigInt(raw));
      }
      const drillArgs = { ...dates, box: "1" };
      const drill = await data(await DRILL(request(undefined, `?${new URLSearchParams(drillArgs)}`)));
      assert.deepEqual((await mcp("vat_return_transactions", drillArgs)).body, drill);
      assert.equal(taxUiRows(drill.transactions as { amount: number }[], ["amount"])[0].amount, BigInt(raw));
      const settlement = { bankGlAccountId: bank.id, amountMinor: preview.amountMinor, date: "2026-02-01" };
      if (currencyCode === "IRR") {
        await data(await SETTLE(request({ mode: "settle", ...settlement }), params), 403);
        assert.equal((await mcp("record_vat_settlement", { taxPeriodId: period.id, ...settlement })).error, true);
      } else {
        for (const isRefund of [false, true]) {
          const response = await data(await SETTLE(request({ mode: "settle", ...settlement, isRefund }), params));
          assert.equal(taxUiMinor(response.amount, response.amountMinor), preview.amount); assert.equal(response.currencyCode, currencyCode);
          const posted = (await db.execute(sql`select sum(debit_amount)::text as debit, sum(credit_amount)::text as credit from journal_line where journal_entry_id=${response.settlementJournalEntryId}`)).rows[0];
          assert.equal(posted.debit, preview.amountMinor); assert.equal(posted.credit, preview.amountMinor);
          const result = await mcp("record_vat_settlement", { taxPeriodId: period.id, ...settlement, isRefund });
          assert.equal(result.error, false); assert.equal(taxUiMinor(result.body.amount, result.body.amountMinor), preview.amount);
        }
      }
      const conditions = taxUiConditions("bill", [{ field: "total", operator: "gte", value: "9223372036854775807" }]);
      const workflow = { name: "Exact threshold", entityType: "bill", conditions, steps: [{ approverId: approver.id, isRequired: true }] };
      const restWorkflow = await data(await WORKFLOW(request(workflow)), 201);
      assert.deepEqual(taxUiConditions("bill", restWorkflow.workflow.conditions), conditions);
      const toolWorkflow = await mcp("create_approval_workflow", workflow); assert.equal(toolWorkflow.error, false);
      assert.deepEqual(taxUiConditions("bill", toolWorkflow.body.workflow.conditions), conditions);
      const exact = taxUiRateInput("1.234567");
      await data(await RATE(request({ rates: [{ baseCurrency: "USD", targetCurrency: "JPY", date: "2026-02-01", ...exact }] })), 201);
      const toolRate = await mcp("set_exchange_rate", { baseCurrency: "USD", targetCurrency: "JPY", date: "2026-02-02", ...exact });
      assert.equal(toolRate.error, false, JSON.stringify(toolRate.body));
      assert.equal((await db.execute(sql`select rate_exact = 1.234567::numeric as exact from exchange_rate where organization_id=${org.id} order by date limit 1`)).rows[0].exact, true);
    } finally { await client.close(); await server.close(); }
  }
  console.log("Tax UI REST MCP SQL verified");
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$client.end());
