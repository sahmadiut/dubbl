import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, chartAccount, contact } from "../../lib/db/schema";
import { POST as ACCOUNT } from "../../app/api/v1/bank-accounts/route";
import { GET as BANK } from "../../app/api/v1/bank-accounts/[id]/route";
import { POST as IMPORT } from "../../app/api/v1/bank-accounts/[id]/transactions/import/route";
import { GET as MOVEMENTS } from "../../app/api/v1/bank-accounts/[id]/transactions/route";
import { POST as TRANSFER } from "../../app/api/v1/bank-transfers/route";
import { POST as SPLIT } from "../../app/api/v1/bank-transactions/[id]/split-account/route";
import { GET as REPORT } from "../../app/api/v1/bank-accounts/[id]/reconciliation/route";
import { POST as SESSION } from "../../app/api/v1/bank-accounts/[id]/reconciliations/route";
import { POST as MATCH, GET as MATCH_READ } from "../../app/api/v1/bank-transactions/[id]/match/route";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { registerBankAccountTools } from "../../lib/mcp/tools/bank-accounts";
import { registerBankImportTools } from "../../lib/mcp/tools/bank-imports";
import { registerBankTransferTools } from "../../lib/mcp/tools/bank-transfers";
import { registerBankCategorizationTools } from "../../lib/mcp/tools/bank-categorization";
import { registerBankReconciliationTools } from "../../lib/mcp/tools/bank-reconciliations";
import { registerBankDocumentMatchTools } from "../../lib/mcp/tools/bank-document-matches";
import { bankUiAccount, bankUiBalance, bankUiDecimal, bankUiPreview, bankUiTransaction, bankUiTransfer, bankUiSplit, bankUiReport, bankUiReconciliation, bankUiDocument, bankUiMatchAmount } from "../../lib/money/bank-ui";

async function run() {
  const [owner] = await db.insert(users).values({ email: "bank-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Bank UI ${currencyCode}`, slug: `bank-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_bank_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bank_ui" });
    const server = new McpServer({ name: "Bank UI", version: "1" }), ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerBankAccountTools(server, ctx); registerBankImportTools(server, ctx); registerBankTransferTools(server, ctx);
    registerBankCategorizationTools(server, ctx); registerBankReconciliationTools(server, ctx);
    registerBankDocumentMatchTools(server, ctx);
    const client = new Client({ name: "Bank UI", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/bank-accounts", {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const body = async (response: Response, status: number) => { const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result; };
    try {
      // Same payload produced by the account drawer: no invented opening GL.
      const bank = (await body(await ACCOUNT(req("POST", { accountName: "Source", currencyCode })), 201)).bankAccount;
      const target = (await call("create_bank_account", { accountName: "Target", currencyCode })).bankAccount;
      assert.equal(bankUiAccount(bank).balance, 0n);
      const decimal = bankUiDecimal(1250n, currencyCode);
      const content = `date,description,amount\n2026-10-04,First,-${decimal}\n2026-10-05,Second,-${decimal}`;
      const preview = bankUiPreview((await body(await IMPORT(req("POST", { mode: "preview", content, format: "csv" }), params(bank.id)), 200)).preview, currencyCode);
      const mcpPreview = bankUiPreview((await call("preview_bank_statement_import", { bankAccountId: bank.id, content, format: "csv" })).preview, currencyCode);
      assert.deepEqual(preview.transactions.map(row => row.amount), [-1250n, -1250n]); assert.deepEqual(mcpPreview, preview);
      await body(await IMPORT(req("POST", { mode: "commit", content, format: "csv" }), params(bank.id)), 201);
      const rows = (await body(await MOVEMENTS(req("GET"), params(bank.id)), 200)).data;
      assert.equal(rows.length, 2); rows.forEach((row: Record<string, unknown>) => assert.equal(bankUiTransaction(row, currencyCode).amount, -1250n));
      const [category] = await db.insert(chartAccount).values({ organizationId: org.id, code: "5900", name: "Expense", type: "expense", currencyCode }).returning();
      const allocations = bankUiSplit([{ accountId: category.id, amount: bankUiDecimal(600n, currencyCode), taxRateId: "none", memo: "" },
        { accountId: category.id, amount: bankUiDecimal(650n, currencyCode), taxRateId: "none", memo: "" }], currencyCode, -1250n);
      const splitRest = await body(await SPLIT(req("POST", { allocations }), params(rows[0].id)), 201);
      const splitMcp = await call("split_bank_transaction", { transactionId: rows[1].id, allocations });
      for (const result of [splitRest, splitMcp]) {
        const saved = await db.execute(sql`select sum(debit_amount)::text debit, sum(credit_amount)::text credit from journal_line where journal_entry_id=${result.journalEntryId}`);
        assert.deepEqual(saved.rows[0], { debit: "1250", credit: "1250" });
      }
      const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Party", type: "both", currencyCode }).returning();
      const [revenue] = await db.insert(chartAccount).values({ organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode }).returning();
      await db.insert(chartAccount).values([{ organizationId: org.id, code: "1200", name: "Receivables", type: "asset", currencyCode },
        { organizationId: org.id, code: "2100", name: "Payables", type: "liability", currencyCode }]);
      await body(await IMPORT(req("POST", { mode: "commit", format: "csv", content: `date,description,amount\n2026-10-07,Invoice,${decimal}\n2026-10-08,Bill,-${decimal}` }), params(bank.id)), 201);
      const matchRows = (await body(await MOVEMENTS(req("GET"), params(bank.id)), 200)).data;
      for (const kind of ["invoice", "bill"] as const) {
        const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode,
          lines: [{ description: "Document", unitPriceMinor: "1250", accountId: kind === "invoice" ? revenue.id : category.id }] };
        const doc = kind === "invoice" ? (await sendInvoice(ctx, (await createInvoice(ctx, input, "rest")).invoice.id)).invoice
          : (await receiveBill(ctx, (await createBill(ctx, input, "rest")).bill.id)).bill;
        const raw = matchRows.find((row: { description: string }) => row.description === (kind === "invoice" ? "Invoice" : "Bill"));
        const transaction = bankUiTransaction(raw, currencyCode);
        const options = await body(await MATCH_READ(req("GET"), params(raw.id)), 200);
        const saved = bankUiDocument(options[kind === "invoice" ? "openInvoices" : "openBills"].find((row: { id: string }) => row.id === doc.id), currencyCode);
        const payload = { [kind === "invoice" ? "invoiceId" : "billId"]: doc.id,
          ...bankUiMatchAmount(decimal, currencyCode, transaction, { currencyCode, amountDue: saved.amountDue }) };
        const matched = kind === "invoice" ? await body(await MATCH(req("POST", payload), params(raw.id)), 200)
          : await call("match_to_bill", { transactionId: raw.id, ...payload });
        assert.equal(matched.payment.amountMinor, "1250");
        const stored = await db.execute(sql`select amount::text amount from payment where id=${matched.payment.id}`);
        assert.equal(stored.rows[0].amount, "1250");
      }
      for (const raw of [1250n, 9007199254740991n]) {
        const payload = { fromBankAccountId: bank.id, toBankAccountId: target.id, date: "2026-10-06", ...bankUiTransfer(bankUiDecimal(raw, currencyCode), bank, target) };
        const rest = await body(await TRANSFER(req("POST", payload)), 201), mcp = await call("record_bank_transfer", payload);
        for (const result of [rest, mcp]) {
          const saved = await db.execute(sql`select amount::text amount from bank_transaction where journal_entry_id=${result.journalEntryId} order by amount`);
          assert.deepEqual(saved.rows.map(row => row.amount), [String(-raw), String(raw)]);
        }
      }
      const savedBank = (await body(await BANK(req("GET"), params(bank.id)), 200)).bankAccount;
      assert.equal(bankUiAccount(savedBank).balance, bankUiAccount((await call("get_bank_account", { bankAccountId: bank.id })).bankAccount).balance);
      // Reconciliation reports sum all GL history; use an empty bank after maximum transfers.
      const empty = (await call("create_bank_account", { accountName: "Statement", currencyCode })).bankAccount;
      const sessionPayload = { startDate: "2026-10-01", endDate: "2026-10-10", startBalanceMinor: bankUiBalance("0", currencyCode), endBalanceMinor: bankUiBalance(decimal, currencyCode) };
      const rec = (await body(await SESSION(req("POST", sessionPayload), params(empty.id)), 201)).reconciliation;
      assert.equal(bankUiReconciliation(rec).endBalance, 1250n);
      const report = bankUiReport(await body(await REPORT(req("GET"), params(empty.id)), 200));
      const mcpReport = bankUiReport(await call("reconciliation_report", { bankAccountId: empty.id }));
      assert.deepEqual(report, mcpReport); assert.equal(report.statementEndBalance, 1250n); assert.equal(report.difference, 1250n);
      // A changed alias is rejected before UI state or a save payload can be produced.
      assert.throws(() => bankUiAccount({ ...savedBank, balanceMinor: "1" }));
    } finally { await client.close(); await server.close(); }
  }
  console.log("Bank UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
