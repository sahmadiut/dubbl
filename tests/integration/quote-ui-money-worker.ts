// Runs only in the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact, chartAccount, taxRate } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/quotes/route";
import { GET } from "../../app/api/v1/quotes/[id]/route";
import { POST as CONVERT } from "../../app/api/v1/quotes/[id]/convert/route";
import { registerQuoteTools } from "../../lib/mcp/tools/quotes";
import { quoteEditorLines, quoteUiDocument, quoteUiHeader, quoteUiSummary, quoteUiMoney } from "../../lib/money/quote-ui";
import { documentEditorPreview } from "../../lib/money/document-editor";

async function run() {
  const [org] = await db.insert(organization).values({ name: "Quote UI", slug: "quote-ui", defaultCurrency: "JPY" }).returning();
  const [owner] = await db.insert(users).values({ email: "quote-ui@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const key = "dk_quote_ui_fixture";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_quote" });
  const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", currencyCode: "KWD" }).returning();
  const [account] = await db.insert(chartAccount).values({ organizationId: org.id, code: "400", name: "Revenue", type: "revenue" }).returning();
  const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
  const server = new McpServer({ name: "Quote UI", version: "1.0.0" });
  registerQuoteTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
  const client = new Client({ name: "UI fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  };
  const req = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/quotes", { method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const line = (price: string, quantity = "1", taxed = false) => ({ description: "Work", quantity, unitPrice: price, accountId: account.id, taxRateId: taxed ? tax.id : "" });
  const base = { contactId: customer.id, issueDate: "2026-10-11", expiryDate: "2099-01-01" };
  try {
    for (const [currencyCode, price, quantity, taxed] of [
      ["USD", "12.50", "1.25", true], ["IRR", "1250", "1", true], ["JPY", "1250", "1", true],
      ["KWD", "1.250", "1", true], ["USD", "0.005", "3", false], ["USD", "-0.005", "1", false],
      ["USD", "90071992547409.91", "1", false], ["KWD", "9007199254740.991", "1", false],
    ] as const) {
      const lines = [line(price, quantity, taxed)], payload = { ...base, currencyCode, lines: quoteEditorLines(lines) };
      const preview = documentEditorPreview(lines, currencyCode, [{ id: tax.id, rate: tax.rate }], true);
      assert.equal(preview.error, null);
      const response = await POST(req("POST", payload)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      const made = quoteUiHeader((await response.json()).quote);
      const mcp = quoteUiHeader((await call("create_quote", payload)).quote);
      for (const saved of [made, mcp]) {
        assert.equal(saved.total, preview.total); assert.equal(saved.currencyCode, currencyCode);
        const readResponse = await GET(req("GET"), params(saved.id as string)); assert.equal(readResponse.status, 200);
        const rest = quoteUiDocument((await readResponse.json()).quote);
        const linked = quoteUiDocument((await call("get_quote", { quoteId: saved.id })).quote);
        assert.equal(rest.total, preview.total); assert.equal(linked.total, preview.total);
        assert.equal(rest.lines[0].unitPrice, preview.lines[0].priceMinor); assert.equal(rest.lines[0].amount, preview.lines[0].amountMinor);
        const stored = (await db.execute(sql`select q.total::text, q.currency_code, l.unit_price::text, l.amount::text, l.tax_amount::text, l.quantity, l.account_id, l.tax_rate_id
          from quote q join quote_line l on q.id=l.quote_id where q.id=${saved.id as string}`)).rows[0];
        assert.equal(stored.total, preview.total.toString()); assert.equal(stored.unit_price, preview.lines[0].priceMinor.toString());
        assert.equal(stored.amount, preview.lines[0].amountMinor.toString()); assert.equal(stored.tax_amount, preview.lines[0].taxMinor.toString());
        assert.equal(stored.account_id, account.id); assert.equal(stored.tax_rate_id, taxed ? tax.id : null);
        if (preview.total > 0n && preview.total < 100000n) {
          await call("send_quote", { quoteId: saved.id }); await call("accept_quote", { quoteId: saved.id });
          const converted = await CONVERT(req("POST"), params(saved.id as string)); assert.equal(converted.status, 200);
          const invoice = (await converted.json()).invoice; assert.equal(invoice.totalMinor, preview.total.toString()); assert.equal(invoice.currencyCode, currencyCode);
          const storedInvoice = (await db.execute(sql`select total::text, currency_code from invoice where id=${invoice.id}`)).rows[0];
          assert.equal(storedInvoice.total, preview.total.toString()); assert.equal(storedInvoice.currency_code, currencyCode);
          const after = quoteUiDocument((await call("get_quote", { quoteId: saved.id })).quote);
          assert.equal(after.billedTotal, preview.total); assert.equal(after.status, "converted");
        }
      }
    }
    const defaultResponse = await POST(req("POST", { ...base, lines: quoteEditorLines([line("12.50")]) }));
    assert.equal(defaultResponse.status, 201); assert.equal((await defaultResponse.json()).quote.currencyCode, "USD");
    const listed = await LIST(req("GET")); assert.equal(listed.status, 200);
    const rows = (await listed.json()).data.map((row: Parameters<typeof quoteUiHeader>[0]) => quoteUiHeader(row));
    assert.ok(rows.some((row: { total: bigint }) => row.total === 9007199254740991n));
    const sums = (await db.execute(sql`select currency_code, sum(total)::text as amount from quote where status='draft' group by currency_code order by currency_code`)).rows;
    assert.equal(quoteUiSummary(rows, "draft"), sums.map(row => quoteUiMoney(BigInt(row.amount as string), row.currency_code as string)).join(" · "));
    const linkedList = await call("list_quotes", {}); assert.ok(linkedList.quotes.every((row: Parameters<typeof quoteUiHeader>[0]) => typeof quoteUiHeader(row).total === "bigint"));
    console.log("Quote UI REST MCP SQL verified");
  } finally { await client.close(); await server.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
