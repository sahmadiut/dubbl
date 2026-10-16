// Only invoked against a freshly migrated, randomized disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, contact, invoice, portalAccessToken, periodLock } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { processRecurringJournalsMaintenance } from "../../lib/api/recurring-generate";
import { profitLossUi } from "../../lib/money/financial-statement-ui";
import { publicPaymentSchema, portalStatementSchema, publicEmailMoney } from "../../lib/money/public-ui";
import { documentMoneyText } from "../../lib/documents/render-wire";
import { parseCSV } from "../../lib/import-export/csv-utils";
import { clientJson } from "../../lib/api/client-response";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as profitLoss } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as pay } from "../../app/api/pay/[token]/route";
import { GET as statement } from "../../app/api/v1/portal/[token]/statements/route";
import { GET as render } from "../../app/api/v1/invoices/[id]/pdf/route";
import { GET as exportInvoices } from "../../app/api/v1/export/invoices/route";

const today = new Date().toISOString().slice(0, 10), start = today.slice(0, 7) + "-01";
async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "MON-008 acceptance", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return {
    async call(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { text: string }[])[0].text;
      return { failed: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async close() { await client.close(); await server.close(); },
  };
}
async function snapshot() {
  const rows = [];
  // Capability reads may append portal activity; key-use metadata is also nonfinancial.
  for (const table of ["organization", "contact", "invoice", "invoice_line", "chart_account", "journal_entry", "journal_line",
    "recurring_template", "recurring_template_line", "number_sequence", "audit_log", "period_lock"]) {
    rows.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text as state from ${table} t`))).rows[0].state);
  }
  return JSON.stringify(rows);
}

async function run() {
  const [owner] = await db.insert(users).values({ email: "mon008@example.test" }).returning();
  const [foreign] = await db.insert(organization).values({ name: "Foreign secret", slug: "mon008-foreign" }).returning();
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const [org] = await db.insert(organization).values({ name: `Parent ${currencyCode}`, slug: `mon008-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_mon008_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_mon008",
      keyHash: createHash("sha256").update(key).digest("hex") });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    const mcp = await connect(ctx), denied = await connect({ ...ctx, role: "member", permissions: [] }), other = await connect({ ...ctx, organizationId: foreign.id });
    const request = (path: string, body?: unknown, authorized = true) => new Request(`http://fixture.test/${path}`, {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${authorized ? key : "dk_invalid"}`,
        "content-type": "application/json", "x-organization-id": foreign.id }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await mcp.call(name, args); assert.equal(result.failed, false, `${name}: ${JSON.stringify(result.body)}`); return result.body;
    };
    try {
      const [ar, revenue, expense, cash] = await db.insert(chartAccount).values([
        { code: "1200", name: "AR", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const },
        { code: "5900", name: "Recurring cost", type: "expense" as const }, { code: "1100", name: "Cash", type: "asset" as const },
      ].map(row => ({ ...row, organizationId: org.id, currencyCode }))).returning();
      const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Parent customer", type: "customer", currencyCode }).returning();
      const response = await createInvoice(request("api/v1/invoices", { contactId: party.id, issueDate: today, dueDate: today, currencyCode,
        lines: [{ description: "Exact parent work", accountId: revenue.id, unitPriceMinor: "4000000003" }] }));
      const created = await response.json(); assert.equal(response.status, 201, JSON.stringify(created));
      const doc = (await call("send_invoice", { invoiceId: created.invoice.id })).invoice;
      const token = `pay-mon008-${currencyCode}`, portal = `portal-mon008-${currencyCode}`;
      await db.update(invoice).set({ paymentLinkToken: token }).where(eq(invoice.id, doc.id));
      await db.insert(portalAccessToken).values({ organizationId: org.id, contactId: party.id, token: portal });
      const costTemplate = { name: "Parent cost", frequency: "monthly", startDate: today, maxOccurrences: 1, currencyCode, lines: [
        { description: "DR", accountId: expense.id, debitAmountMinor: "907" },
        { description: "CR", accountId: cash.id, creditAmountMinor: "907" },
      ] };
      const skipped = (await call("create_recurring_journal", costTemplate)).template;
      await db.insert(periodLock).values({ organizationId: org.id, lockDate: today });
      const journalSnapshot = async () => (await db.execute(sql`select jsonb_agg(to_jsonb(l) order by l.id)::text as state
        from journal_line l join journal_entry j on j.id=l.journal_entry_id where j.organization_id=${org.id}`)).rows;
      const locked = await journalSnapshot();
      assert.equal((await processRecurringJournalsMaintenance()).journalsPosted, 0);
      assert.deepEqual(await journalSnapshot(), locked);
      const skippedState = (await db.execute(sql`select status, occurrences_generated::text as occurrences from recurring_template where id=${skipped.id}`)).rows[0];
      assert.deepEqual(skippedState, { status: "completed", occurrences: "1" });
      await db.delete(periodLock).where(eq(periodLock.organizationId, org.id));
      await call("create_recurring_journal", costTemplate);
      assert.equal((await processRecurringJournalsMaintenance()).journalsPosted, 1);
      const saved = (await db.execute(sql`select
        (select total::text from invoice where id=${doc.id}) as total,
        (select sum(debit_amount-credit_amount)::text from journal_line where account_id=${ar.id}) as receivable,
        (select sum(debit_amount-credit_amount)::text from journal_line where account_id=${expense.id}) as expense,
        (select (-sum(debit_amount-credit_amount))::text from journal_line where account_id in (${revenue.id},${expense.id})) as net`)).rows[0];
      assert.deepEqual(saved, { total: "4000000003", receivable: "4000000003", expense: "907", net: "3999999096" });
      assert.deepEqual((await db.execute(sql`select j.id from journal_entry j join journal_line l on l.journal_entry_id=j.id
        where j.organization_id=${org.id} group by j.id having sum(l.debit_amount)<>sum(l.credit_amount)`)).rows, []);
      const beforeReads = await snapshot();
      const range = { startDate: start, endDate: today };
      const report = await profitLoss(request(`api/v1/reports/profit-and-loss?startDate=${start}&endDate=${today}`));
      const restReport = profitLossUi(await clientJson(report, "Unavailable"));
      assert.deepEqual(restReport, profitLossUi(await call("profit_and_loss", range)));
      assert.equal(restReport.currencyCode, currencyCode); assert.equal(restReport.totalRevenue.toString(), saved.total);
      assert.equal(restReport.totalExpenses.toString(), saved.expense); assert.equal(restReport.netIncome.toString(), saved.net);
      const publicRead = async () => publicPaymentSchema.parse(await clientJson(await pay(request("pay"), { params: Promise.resolve({ token }) }), "Unavailable"));
      const publicBody = await publicRead(); assert.equal(publicBody.status, "pending");
      if (publicBody.status !== "pending") throw new Error("Expected pending invoice");
      assert.deepEqual(publicBody, publicPaymentSchema.parse(await call("get_payment_link", { token })));
      assert.equal(publicBody.invoice.totalMinor, saved.total); assert.equal(publicBody.invoice.currencyCode, currencyCode);
      const statementBody = portalStatementSchema.parse(await clientJson(await statement(request("portal"), { params: Promise.resolve({ token: portal }) }), "Unavailable"));
      assert.deepEqual(statementBody, portalStatementSchema.parse(await call("get_portal_statement", { token: portal })));
      assert.equal(statementBody.totalOutstandingMinor, saved.receivable); assert.equal(statementBody.currencyCode, currencyCode);
      const rendered = await render(request("api/v1/invoices/pdf?format=html"), { params: Promise.resolve({ id: doc.id }) });
      assert.equal(rendered.status, 200); const html = await rendered.text();
      const toolRender = await call("render_invoice", { id: doc.id, format: "html" });
      assert.equal(toolRender.document.totalMinor, saved.total); assert.equal(toolRender.document.currencyCode, currencyCode);
      const label = documentMoneyText(4000000003, currencyCode);
      const displayed = currencyCode === "USD" ? "40,000,000.03" : currencyCode === "KWD" ? "4,000,000.003" : "4,000,000,003";
      assert.ok(label.includes(displayed), `${currencyCode}: ${label}`);
      assert.ok(html.includes(label)); assert.ok(toolRender.content.includes(label));
      assert.equal(publicEmailMoney(publicBody.invoice.total, currencyCode), label);
      const csv = await exportInvoices(request("api/v1/export/invoices")); assert.equal(csv.status, 200, await csv.clone().text());
      const exported = await csv.text(); assert.equal((await call("export_csv_data", { entityType: "invoices" })).csv, exported);
      const exportedRows = parseCSV(exported).rows; assert.equal(exportedRows.length, 1);
      assert.equal(exportedRows[0].lineAmountMinor, saved.total); assert.equal(exportedRows[0].lineUnitPriceMinor, saved.total);
      assert.equal(exportedRows[0].lineAmount, "40000000.03"); assert.equal(exportedRows[0].currencyCode, currencyCode);
      assert.deepEqual(await publicRead(), publicBody);
      assert.equal((await processRecurringJournalsMaintenance()).journalsPosted, 0);
      assert.equal(await snapshot(), beforeReads);

      for (const [name, args] of [["profit_and_loss", range], ["get_payment_link", { token }], ["get_portal_statement", { token: portal }],
        ["render_invoice", { id: doc.id, format: "html" }]] as const) {
        assert.equal((await denied.call(name, args)).failed, true, name);
        if (name !== "profit_and_loss") assert.equal((await other.call(name, args)).failed, true, name);
      }
      assert.equal((await profitLoss(request(`api/v1/reports/profit-and-loss?startDate=${start}&endDate=${today}`, undefined, false))).status, 401);
      assert.equal((await pay(request("pay"), { params: Promise.resolve({ token: "missing" }) })).status, 404);
      assert.throws(() => publicPaymentSchema.parse({ ...publicBody, invoice: { ...publicBody.invoice, totalMinor: "4000000002" } }));
      const reportBody = await call("profit_and_loss", range);
      assert.throws(() => profitLossUi({ ...reportBody, netIncomeMinor: "3999999095" }));
      assert.equal(await snapshot(), beforeReads);
      // Persisted corruption must fail before public/render output; no rounded Number adoption.
      await db.execute(sql`update invoice set amount_due=9007199254740992 where id=${doc.id}`);
      const corrupt = await snapshot();
      assert.equal((await pay(request("pay"), { params: Promise.resolve({ token }) })).status, 422);
      assert.equal((await mcp.call("get_payment_link", { token })).failed, true);
      assert.equal((await render(request("api/v1/invoices/pdf?format=html"), { params: Promise.resolve({ id: doc.id }) })).status, 422);
      assert.equal((await mcp.call("render_invoice", { id: doc.id, format: "html" })).failed, true);
      assert.equal(await snapshot(), corrupt);
      await db.execute(sql`update invoice set amount_due=4000000003 where id=${doc.id}`);
      assert.deepEqual(await publicRead(), publicBody); assert.equal(await snapshot(), beforeReads);
    } finally { await mcp.close(); await denied.close(); await other.close(); }
  }
  console.log("Auxiliary public parent REST MCP UI SQL acceptance verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
