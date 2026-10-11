// Runs only in the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate, bankAccount } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/sales-receipts/route";
import { GET } from "../../app/api/v1/sales-receipts/[id]/route";
import { POST as POST_RECEIPT } from "../../app/api/v1/sales-receipts/[id]/post/route";
import { POST as VOID } from "../../app/api/v1/sales-receipts/[id]/void/route";
import { registerSalesReceiptTools } from "../../lib/mcp/tools/sales-receipts";
import { salesReceiptEditorLines, salesReceiptEditorCurrency, salesReceiptUiDocument, salesReceiptUiHeader,
  salesReceiptUiCollected, salesReceiptUiMoney } from "../../lib/money/sales-receipt-ui";
import { documentEditorPreview } from "../../lib/money/document-editor";

type ReceiptWire = { id: string; currencyCode: string; status: string; total: number;
  lines: { quantity: number; unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown }[]; [key: string]: unknown };

async function run() {
  const [owner] = await db.insert(users).values({ email: "receipt-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Receipt UI ${currencyCode}`, slug: `receipt-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_receipt_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_receipt" });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer", currencyCode: "KWD" }).returning();
    const [account] = await db.insert(chartAccount).values({ organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode }).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
    const [bank] = await db.insert(bankAccount).values({ organizationId: org.id, accountName: "Cash", accountType: "cash", currencyCode }).returning();
    const server = new McpServer({ name: "Receipt UI", version: "1.0.0" });
    registerSalesReceiptTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
    const client = new Client({ name: "UI fixture", version: "1.0.0" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/sales-receipts", { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const line = (price: string, quantity = "1", taxed = false) => ({ description: "Work", quantity, unitPrice: price, accountId: account.id, taxRateId: taxed ? tax.id : "" });
    const base = { contactId: customer.id, date: "2026-10-11", bankAccountId: bank.id };
    try {
      const price = currencyCode === "KWD" ? "1.250" : currencyCode === "USD" ? "12.50" : "1250";
      const cases: [string, string, boolean][] = [[price, "1.25", true], [price, "0", false], ["", "", false]];
      if (currencyCode === "USD") cases.push(["0.005", "3", false], ["-0.005", "1", false], ["90071992547409.91", "1", false]);
      if (currencyCode === "KWD") cases.push(["9007199254740.991", "1", false]);
      for (const [unitPrice, quantity, taxed] of cases) {
        const lines = [line(unitPrice, quantity, taxed)], payload = { ...base, currencyCode, lines: salesReceiptEditorLines(lines) };
        const preview = documentEditorPreview(lines, currencyCode, [{ id: tax.id, rate: tax.rate }], false);
        assert.equal(preview.error, null);
        const response = await POST(req("POST", payload)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
        const made = salesReceiptUiHeader((await response.json()).salesReceipt as ReceiptWire);
        const mcp = salesReceiptUiHeader((await call("create_sales_receipt", payload)).salesReceipt as ReceiptWire);
        for (const [transport, saved] of [["rest", made], ["mcp", mcp]] as const) {
          assert.equal(saved.total, preview.total); assert.equal(saved.currencyCode, currencyCode); assert.equal(saved.status, "draft");
          const readResponse = await GET(req("GET"), params(saved.id)); assert.equal(readResponse.status, 200);
          const rest = salesReceiptUiDocument((await readResponse.json()).salesReceipt as ReceiptWire);
          const linked = salesReceiptUiDocument((await call("get_sales_receipt", { salesReceiptId: saved.id })).salesReceipt as ReceiptWire);
          assert.equal(rest.total, preview.total); assert.equal(linked.total, preview.total);
          assert.equal(rest.lines[0].unitPrice, preview.lines[0].priceMinor); assert.equal(rest.lines[0].amount, preview.lines[0].amountMinor);
          assert.equal(rest.lines[0].quantity, quantity === "1.25" ? 125 : quantity === "0" ? 0 : quantity === "3" ? 300 : 100);
          const stored = (await db.execute(sql`select r.total::text, r.currency_code, r.bank_account_id, l.unit_price::text, l.amount::text, l.tax_amount::text, l.quantity, l.account_id, l.tax_rate_id
            from sales_receipt r join sales_receipt_line l on r.id=l.sales_receipt_id where r.id=${saved.id}`)).rows[0];
          assert.equal(stored.total, preview.total.toString()); assert.equal(stored.unit_price, preview.lines[0].priceMinor.toString());
          assert.equal(stored.amount, preview.lines[0].amountMinor.toString()); assert.equal(stored.tax_amount, preview.lines[0].taxMinor.toString());
          assert.equal(stored.currency_code, currencyCode); assert.equal(stored.bank_account_id, bank.id);
          assert.equal(stored.quantity, rest.lines[0].quantity); assert.equal(stored.account_id, account.id); assert.equal(stored.tax_rate_id, taxed ? tax.id : null);
          if (preview.total > 0n && preview.total < 100000n) {
            if (transport === "rest") { const posted = await POST_RECEIPT(req("POST"), params(saved.id)); assert.equal(posted.status, 200, JSON.stringify(await posted.clone().json())); }
            else await call("post_sales_receipt", { salesReceiptId: saved.id });
            const paid = salesReceiptUiDocument((await call("get_sales_receipt", { salesReceiptId: saved.id })).salesReceipt as ReceiptWire);
            assert.equal(paid.status, "paid"); assert.equal(paid.total, preview.total);
            assert.equal(salesReceiptUiCollected([paid]), salesReceiptUiMoney(preview.total, currencyCode));
            const journal = (await db.execute(sql`select sum(l.debit_amount)::text as debit, sum(l.credit_amount)::text as credit
              from journal_line l join sales_receipt r on r.journal_entry_id=l.journal_entry_id where r.id=${saved.id}`)).rows[0];
            assert.equal(journal.debit, preview.total.toString()); assert.equal(journal.credit, preview.total.toString());
            if (transport === "rest") { const voided = await VOID(req("POST"), params(saved.id)); assert.equal(voided.status, 200, JSON.stringify(await voided.clone().json())); }
            else await call("void_sales_receipt", { salesReceiptId: saved.id });
            const voided = salesReceiptUiDocument((await call("get_sales_receipt", { salesReceiptId: saved.id })).salesReceipt as ReceiptWire);
            assert.equal(voided.status, "void"); assert.equal(voided.total, preview.total); assert.equal(salesReceiptUiCollected([voided]), "—");
            const reversal = (await db.execute(sql`select sum(l.debit_amount-l.credit_amount)::text as net from journal_line l
              join journal_entry j on j.id=l.journal_entry_id where j.source_id=${saved.id}`)).rows[0]; assert.equal(reversal.net, "0");
          }
        }
      }
      // Resolve currency from the same saved contact/org chain as the create services.
      for (const customerCurrency of ["KWD", null]) {
        await db.update(contact).set({ currencyCode: customerCurrency }).where(eq(contact.id, customer.id));
        const code = salesReceiptEditorCurrency(null, customerCurrency, currencyCode);
        const explicit = await POST(req("POST", { ...base, currencyCode: code, lines: salesReceiptEditorLines([line("1")]) }));
        const omitted = await POST(req("POST", { ...base, lines: salesReceiptEditorLines([line("1")]) }));
        assert.equal(explicit.status, 201); assert.equal(omitted.status, 201);
        const chosen = (await explicit.json()).salesReceipt, fallback = (await omitted.json()).salesReceipt;
        assert.equal(chosen.currencyCode, code); assert.equal(fallback.currencyCode, code); assert.equal(chosen.totalMinor, fallback.totalMinor);
        assert.equal((await call("create_sales_receipt", { ...base, lines: salesReceiptEditorLines([line("1")]) })).salesReceipt.currencyCode, code);
      }
      const listed = await LIST(req("GET")); assert.equal(listed.status, 200);
      const rows = (await listed.json()).data.map((row: ReceiptWire) => salesReceiptUiHeader(row));
      assert.equal(salesReceiptUiCollected(rows), "—");
      const linkedList = await call("list_sales_receipts", {}); assert.ok(linkedList.salesReceipts.every((row: ReceiptWire) => typeof salesReceiptUiHeader(row).total === "bigint"));
    } finally { await client.close(); await server.close(); }
  }
  console.log("Receipt UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
