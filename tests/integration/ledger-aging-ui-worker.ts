import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalEntry, journalLine, contact, invoice, bill } from "../../lib/db/schema";
import { GET as generalLedger } from "../../app/api/v1/reports/general-ledger/route";
import { GET as cashFlow } from "../../app/api/v1/reports/cash-flow/route";
import { GET as receivables } from "../../app/api/v1/reports/aged-receivables/route";
import { GET as payables } from "../../app/api/v1/reports/aged-payables/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { generalLedgerUi, cashFlowUi, receivablesUi, payablesUi, ledgerPageUi, appendLedgerPage,
  ledgerAgingJson, reportUiMoney, ledgerExportRows, agingExportRows } from "../../lib/money/ledger-aging-ui";
import { generateCSV } from "../../lib/import-export/csv-utils";

async function run() {
  const [org, other] = await db.insert(organization).values([{ name: "Ledger aging UI", slug: "ledger-aging-ui" }, { name: "Foreign UI", slug: "foreign-ui" }]).returning();
  const [owner] = await db.insert(users).values({ email: "ledger-aging-ui@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const key = "dk_ledger_aging_ui";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture",
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ledger" });
  const [cash, revenue, expense] = await db.insert(chartAccount).values([
    { organizationId: org.id, code: "1000", name: "Cash", type: "asset" as const, subType: "bank" },
    { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: org.id, code: "5000", name: "Expense", type: "expense" as const },
  ]).returning();
  const [foreign] = await db.insert(chartAccount).values({ organizationId: other.id, code: "4000", name: "Foreign secret", type: "revenue" }).returning();
  let sequence = 0;
  async function post(date: string, debitId: string, creditId: string, amount: number, organizationId = org.id) {
    const [entry] = await db.insert(journalEntry).values({ organizationId, entryNumber: ++sequence, date, description: "Synthetic UI entry", status: "posted", sourceType: "manual" }).returning();
    await db.insert(journalLine).values([
      { journalEntryId: entry.id, accountId: debitId, debitAmount: amount, creditAmount: 0, currencyCode: "USD" },
      { journalEntryId: entry.id, accountId: creditId, debitAmount: 0, creditAmount: amount, currencyCode: "USD" },
    ]);
    return entry;
  }
  await post("2023-12-10", cash.id, revenue.id, 101);
  await post("2024-01-10", cash.id, revenue.id, 9007199253000001);
  await post("2024-01-20", expense.id, cash.id, 901);
  for (let i = 0; i < 50; i++) await post("2024-01-25", cash.id, revenue.id, 1);
  await post("2024-01-10", cash.id, foreign.id, 777, other.id);
  const [localContact, foreignContact] = await db.insert(contact).values([
    { organizationId: org.id, name: "Local contact", type: "both" }, { organizationId: other.id, name: "Foreign secret", type: "both" },
  ]).returning();
  for (const [organizationId, contactId] of [[org.id, localContact.id], [other.id, foreignContact.id]]) {
    const base = { organizationId, contactId, issueDate: "2024-01-01", dueDate: "2024-01-31", total: organizationId === org.id ? 9007199253000001 : 777,
      amountDue: organizationId === org.id ? 9007199253000001 : 777, currencyCode: "USD" };
    await db.insert(invoice).values({ ...base, invoiceNumber: "UI-INV", status: "sent" });
    await db.insert(bill).values({ ...base, billNumber: "UI-BILL", status: "received" });
    if (organizationId === org.id) {
      await db.insert(invoice).values({ ...base, dueDate: "2023-12-01", invoiceNumber: "UI-INV-2", total: 1250, amountDue: 1250, status: "sent" });
      await db.insert(bill).values({ ...base, dueDate: "2023-12-01", billNumber: "UI-BILL-2", total: 1250, amountDue: 1250, status: "received" });
    }
  }
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "invoice", "bill", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  const server = new McpServer({ name: "Ledger aging UI fixture", version: "1" });
  const ctx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const deniedServer = new McpServer({ name: "Denied fixture", version: "1" });
  registerReportTools(deniedServer, { ...ctx, role: "member", permissions: [] });
  const deniedClient = new Client({ name: "Denied fixture", version: "1" });
  const [dct, dst] = InMemoryTransport.createLinkedPair(); await deniedServer.connect(dst); await deniedClient.connect(dct);
  const request = (path: string, query: string, authorization = key) => new Request(`http://fixture.test/api/v1/reports/${path}${query}`, {
    headers: { authorization: `Bearer ${authorization}`, "x-organization-id": other.id },
  });
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await client.callTool({ name, arguments: args }); assert.ok(!response.isError, JSON.stringify(response.content));
    return JSON.parse((response.content as { text: string }[])[0].text);
  };
  const range = { startDate: "2024-01-01", endDate: "2024-01-31" };
  const query = "?startDate=2024-01-01&endDate=2024-01-31";
  const pairs = [
    ["general-ledger", "general_ledger", generalLedger, query, range, generalLedgerUi],
    ["cash-flow", "cash_flow_statement", cashFlow, query, range, cashFlowUi],
    ["aged-receivables", "aged_receivables", receivables, "?asAt=2024-01-31", { asAt: "2024-01-31" }, receivablesUi],
    ["aged-payables", "aged_payables", payables, "?asAt=2024-01-31", { asAt: "2024-01-31" }, payablesUi],
  ] as const;
  try {
    const cashSql = (await db.execute(sql`select sum(l.debit_amount::numeric-l.credit_amount::numeric)::text as amount from journal_line l
      join journal_entry e on e.id=l.journal_entry_id where e.organization_id=${org.id} and l.account_id=${cash.id} and e.status='posted'
      and e.date >= '2024-01-01' and e.date <= '2024-01-31'`)).rows[0].amount;
    assert.equal(cashSql, "9007199252999150");
    for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
      await db.update(organization).set({ defaultCurrency: currencyCode }).where(eq(organization.id, org.id));
      await db.update(invoice).set({ currencyCode }).where(eq(invoice.organizationId, org.id));
      await db.update(bill).set({ currencyCode }).where(eq(bill.organizationId, org.id));
      const before = await snapshot();
      for (const [path, name, handler, suffix, args, parse] of pairs) {
        const response = await handler(request(path, suffix)); assert.equal(response.status, 200);
        const body = await response.json(), mcpBody = await call(name, args);
        assert.deepEqual(mcpBody, body); assert.ok(!JSON.stringify(body).includes("Foreign secret"));
        assert.equal(body.currencyCode, currencyCode);
        const parsed = parse(body); assert.deepEqual(parse(mcpBody), parsed);
        await ledgerAgingJson(new Response(JSON.stringify(body)), parse as (body: unknown) => unknown);
        const malformed = structuredClone(body);
        if (name === "general_ledger") {
          const data = generalLedgerUi(body), cashAccount = data.accounts.find(row => row.accountId === cash.id)!;
          assert.equal(cashAccount.balance.toString(), cashSql); assert.equal(cashAccount.entries.length, 50); assert.equal(cashAccount.totalEntries, 52);
          const pageArgs = { ...range, accountId: cash.id, offset: 50, limit: 200 };
          const pageResponse = await generalLedger(request(path, query + `&accountId=${cash.id}&offset=50&limit=200`));
          assert.equal(pageResponse.status, 200); const pageBody = await pageResponse.json();
          assert.deepEqual(await call(name, pageArgs), pageBody);
          const completed = appendLedgerPage(data, cash.id, ledgerPageUi(pageBody));
          assert.equal(completed.accounts.find(row => row.accountId === cash.id)!.entries.at(-1)!.ledgerBalance, 9007199252999251n);
          assert.match(generateCSV(ledgerExportRows(completed), ["currencyCode", "debitMinor", "ledgerBalanceMinor"]), /9007199253000102/);
          assert.throws(() => appendLedgerPage(data, cash.id, ledgerPageUi({ ...pageBody, currencyCode: "EUR" })));
          malformed.accounts[0].totalDebitMinor = "1";
        } else if (name === "cash_flow_statement") {
          const data = cashFlowUi(body); assert.equal(data.netCashFlow.toString(), cashSql);
          assert.equal(data.totalOperating, 9007199252999150n);
          for (const method of ["direct", "indirect"]) {
            const methodResponse = await handler(request(path, query + `&method=${method}`)); assert.equal(methodResponse.status, 200);
            const methodBody = await methodResponse.json(); assert.deepEqual(await call(name, { ...range, method }), methodBody);
            assert.equal(cashFlowUi(methodBody).netCashFlow.toString(), cashSql);
          }
          malformed.operating[0].amountMinor = "1";
        } else {
          const data = (name === "aged_receivables" ? receivablesUi : payablesUi)(body);
          const table = name === "aged_receivables" ? "invoice" : "bill";
          const expected = (await db.execute(sql.raw(`select sum(total)::text as amount from ${table} where organization_id='${org.id}'`))).rows[0].amount;
          assert.equal(expected, "9007199253001251"); assert.equal(data.grandTotal.toString(), expected);
          assert.match(generateCSV(agingExportRows(data), ["currencyCode", "amountDueMinor"]), /9007199253000001/);
          assert.match(reportUiMoney(data.buckets[0].total, currencyCode), currencyCode === "KWD" ? /\.001/ : currencyCode === "USD" ? /\.01/ : /001/);
          malformed.buckets[0][name === "aged_receivables" ? "invoices" : "bills"][0].currencyCode = "EUR";
        }
        assert.throws(() => parse(malformed));
        await assert.rejects(ledgerAgingJson(new Response(JSON.stringify(malformed)), parse as (body: unknown) => unknown), /Saved report amounts are invalid/);
        const badAuth = await handler(request(path, suffix, "dk_invalid")); assert.equal(badAuth.status, 401);
        await assert.rejects(ledgerAgingJson(badAuth, parse as (body: unknown) => unknown), /Unable to load/);
        assert.ok((await deniedClient.callTool({ name, arguments: args })).isError);
      }
      assert.deepEqual(await snapshot(), before);
    }
    // Real backend overflow is a failed report, never an empty/zero-valued UI.
    const overflow = await post("2024-01-25", cash.id, revenue.id, 2000000);
    const overflowing = await snapshot();
    for (const [path, name, handler] of pairs.slice(0, 2)) {
      const response = await handler(request(path, query)); assert.equal(response.status, 422);
      assert.equal((await response.clone().json()).code, "LEGACY_NUMERIC_RANGE");
      await assert.rejects(ledgerAgingJson(response, name === "general_ledger" ? generalLedgerUi : cashFlowUi as (body: unknown) => unknown), /Unable to load/);
      assert.ok((await client.callTool({ name, arguments: range })).isError);
    }
    assert.deepEqual(await snapshot(), overflowing);
    await db.delete(journalLine).where(eq(journalLine.journalEntryId, overflow.id)); await db.delete(journalEntry).where(eq(journalEntry.id, overflow.id));
    console.log("Ledger aging UI REST MCP SQL verified");
  } finally { await client.close(); await server.close(); await deniedClient.close(); await deniedServer.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
