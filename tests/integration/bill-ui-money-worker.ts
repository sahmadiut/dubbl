import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact, chartAccount, taxRate, bill, billLine, debitNoteLine } from "../../lib/db/schema";
import { POST as create, GET as list } from "../../app/api/v1/bills/route";
import { GET as get, PATCH as edit } from "../../app/api/v1/bills/[id]/route";
import { POST as receive } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as pay } from "../../app/api/v1/bills/[id]/pay/route";
import { GET as counts } from "../../app/api/v1/bills/counts/route";
import { POST as credit } from "../../app/api/v1/debit-notes/route";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { registerDebitNoteTools } from "../../lib/mcp/tools/debit-notes";
import { billUiDocument, billUiList, billUiBase, billUiCounts, billUiAging, billUiDecimal,
  billUiPaymentAmount, billUiSupplierCreditLines } from "../../lib/money/bill-ui";

async function run() {
  const [user] = await db.insert(users).values({ email: "saved-bill-ui@example.test" }).returning();
  for (const currency of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Saved Bill ${currency}`, slug: `saved-bill-${currency}`, defaultCurrency: currency }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
    const key = `dk_saved_bill_${currency}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "UI fixture", keyPrefix: "dk_bill",
      keyHash: createHash("sha256").update(key).digest("hex") });
    const [supplier] = await db.insert(contact).values({ organizationId: org.id, name: "Supplier", type: "supplier", currencyCode: currency }).returning();
    const [expense] = await db.insert(chartAccount).values([
      { organizationId: org.id, name: "Expense", code: "500", type: "expense", currencyCode: currency },
      { organizationId: org.id, name: "AP", code: "2100", type: "liability", currencyCode: currency },
      { organizationId: org.id, name: "Cash", code: "1100", type: "asset", currencyCode: currency },
    ]).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
    const ctx = { organizationId: org.id, userId: user.id, role: "owner" as const };
    const server = new McpServer({ name: "Saved bill UI fixture", version: "1" });
    registerBillTools(server, ctx); registerDebitNoteTools(server, ctx);
    const client = new Client({ name: "UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const request = (method = "GET", body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/bills${query}`, {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": org.id },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    async function ok(response: Response) { const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body; }
    async function mcp(name: string, arguments_: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, undefined, JSON.stringify(result.content));
      return JSON.parse((result.content as { text: string }[])[0].text);
    }
    try {
      const payload = { contactId: supplier.id, currencyCode: currency, issueDate: "2026-10-11", dueDate: "2026-11-11",
        lines: [{ description: "Saved", quantity: 1.25, unitPriceExact: billUiDecimal(1250n, currency),
          accountId: expense.id, taxRateId: tax.id, discountPercent: 1000 }] };
      const rest = await ok(await create(request("POST", payload)));
      const viaMcp = await mcp("create_bill", payload);
      for (const saved of [rest.bill, viaMcp.bill]) {
        const result = await ok(await get(request(), params(saved.id)));
        const doc = billUiDocument(result.bill), same = billUiDocument((await mcp("get_bill", { billId: saved.id })).bill);
        assert.equal(doc.total, 1548n); assert.equal(doc.total, same.total); assert.equal(doc.lines![0].unitPrice, 1250n);
        assert.equal(billUiBase(result.base).amounts.total, doc.total);
        // Copy only supported debit-note dimensions; also exercise exact draft bill PATCH.
        const creditLines = billUiSupplierCreditLines(doc.lines!, currency);
        const updateLines = creditLines.map(line => ({ description: line.description, quantity: line.quantity,
          unitPriceExact: line.unitPriceExact, accountId: line.accountId, taxRateId: line.taxRateId, discountPercent: line.discountPercent }));
        const updated = await ok(await edit(request("PATCH", { lines: updateLines, notes: "Draft UI precision" }), params(saved.id)));
        assert.equal(updated.bill.totalMinor, "1548");
        const updatedMcp = await mcp("update_bill", { billId: saved.id, lines: updateLines });
        assert.equal(updatedMcp.bill.totalMinor, "1548");
        const copied = { contactId: supplier.id, billId: saved.id, currencyCode: currency, issueDate: "2026-10-11", lines: creditLines };
        const noteRest = await ok(await credit(request("POST", copied)));
        const noteMcp = await mcp("create_debit_note", copied);
        for (const note of [noteRest.debitNote, noteMcp.debitNote]) {
          assert.equal(note.totalMinor, "1548");
          const [stored] = await db.select({ price: sql<string>`${debitNoteLine.unitPrice}::text`,
            amount: sql<string>`${debitNoteLine.amount}::text`, tax: sql<string>`${debitNoteLine.taxAmount}::text`,
            qty: debitNoteLine.quantity, account: debitNoteLine.accountId, taxId: debitNoteLine.taxRateId }).from(debitNoteLine).where(eq(debitNoteLine.debitNoteId, note.id));
          assert.deepEqual(stored, { price: "1250", amount: "1407", tax: "141", qty: 125, account: expense.id, taxId: tax.id });
        }
        await ok(await receive(request("POST"), params(saved.id)));
        const amount = billUiPaymentAmount(billUiDecimal(100n, currency), currency, doc.amountDue);
        await ok(await pay(request("POST", { ...amount, date: "2026-10-11" }), params(saved.id)));
        await mcp("pay_bill", { billId: saved.id, ...amount, date: "2026-10-11" });
        const refreshed = billUiDocument((await ok(await get(request(), params(saved.id)))).bill);
        assert.equal(refreshed.amountPaid, 200n); assert.equal(refreshed.amountDue, 1348n);
        const [stored] = await db.select({ total: sql<string>`${bill.total}::text`, paid: sql<string>`${bill.amountPaid}::text`,
          due: sql<string>`${bill.amountDue}::text` }).from(bill).where(eq(bill.id, saved.id));
        assert.deepEqual(stored, { total: "1548", paid: "200", due: "1348" });
      }
      const rows = (await ok(await list(request("GET", undefined, "?limit=100")))).data.map(billUiList);
      const viaList = (await mcp("list_bills", { limit: 100 })).bills.map(billUiList);
      assert.equal(rows.length, 2); assert.equal(viaList[0].amountDue, rows[0].amountDue);
      const summary = billUiCounts(await ok(await counts(request())));
      assert.equal(summary.currencies[0].outstanding, 2696n);
      assert.equal(billUiCounts(await mcp("get_bill_counts")).currencies[0].currencyCode, currency);
      assert.equal(billUiAging(rows, new Date("2026-10-11T00:00:00Z"))[0].total, 2696n);
      if (currency === "USD") {
        const foreign = await ok(await create(request("POST", { ...payload, currencyCode: "JPY",
          lines: [{ description: "Foreign source", unitPriceMinor: "1250" }] })));
        const display = await ok(await get(request(), params(foreign.bill.id)));
        assert.equal(billUiDocument(display.bill).total, 1250n);
        assert.equal(billUiBase(display.base).amounts.total, null);
        assert.equal(display.base.baseCurrency, "USD");
        await ok(await create(request("POST", { ...payload, currencyCode: "IRR",
          lines: [{ description: "Other source", unitPriceMinor: "1250" }] })));
        assert.equal((await counts(request())).status, 422);
        const rejected = await client.callTool({ name: "get_bill_counts", arguments: {} });
        assert.equal(rejected.isError, true);
        const mixed = (await ok(await list(request("GET", undefined, "?limit=100")))).data.map(billUiList);
        assert.ok(mixed.some((row: { currencyCode: string; total: bigint }) => row.currencyCode === "JPY" && row.total === 1250n));
      }
      const edge = await ok(await create(request("POST", { ...payload, lines: [{ description: "Safe edge", unitPriceMinor: "9007199254740991" }] })));
      assert.equal(billUiDocument((await ok(await get(request(), params(edge.bill.id)))).bill).total, 9007199254740991n);
      const [edgeLine] = await db.select({ price: sql<string>`${billLine.unitPrice}::text` }).from(billLine).where(eq(billLine.billId, edge.bill.id));
      assert.equal(edgeLine.price, "9007199254740991");
      const exactCopy = billUiSupplierCreditLines(billUiDocument((await ok(await get(request(), params(edge.bill.id)))).bill).lines!, currency);
      assert.equal(exactCopy[0].unitPriceExact, billUiDecimal(9007199254740991n, currency));
    } finally { await client.close(); await server.close(); }
  }
  console.log("Saved bill UI SQL verified");
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
