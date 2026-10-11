import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate, invoiceLine } from "../../lib/db/schema";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as getContact } from "../../app/api/v1/contacts/[id]/route";
import { GET as getOrganization } from "../../app/api/v1/organization/route";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { documentEditorPreview, documentEditorDecimal, invoiceEditorCurrency } from "../../lib/money/document-editor";

async function run() {
  const [org] = await db.insert(organization).values({ name: "Invoice UI", slug: "invoice-ui", defaultCurrency: "KWD" }).returning();
  const [user] = await db.insert(users).values({ email: "invoice-ui@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
  await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
  const key = "dk_invoice_ui_fixture";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "UI fixture",
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_invoice" });
  const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Invoice customer", type: "customer", currencyCode: "JPY" }).returning();
  const [account] = await db.insert(chartAccount).values({ organizationId: org.id, name: "Revenue", code: "400", type: "revenue" }).returning();
  const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
  const server = new McpServer({ name: "Invoice UI fixture", version: "1" });
  registerInvoiceTools(server, { organizationId: org.id, userId: user.id, role: "owner" });
  const client = new Client({ name: "UI fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const request = (body?: unknown) => new Request("http://fixture.test/api/v1/invoices", {
    method: body ? "POST" : "GET", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": org.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function ok(response: Response) {
    const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body;
  }
  const row = (unitPrice: string, quantity = "1", taxed = false) => ({ description: "UI item", unitPrice, quantity, accountId: account.id, taxRateId: taxed ? tax.id : "" });
  const rates = [{ id: tax.id, rate: tax.rate }];
  try {
    const customerData = await ok(await getContact(request(), { params: Promise.resolve({ id: customer.id }) }));
    const orgData = await ok(await getOrganization(request()));
    const code = invoiceEditorCurrency(null, customerData.contact.currencyCode, orgData.organization.defaultCurrency);
    assert.equal(code, "JPY");
    const implicit = await ok(await createInvoice(request({ contactId: customer.id, issueDate: "2026-10-11", lines: documentEditorPreview([row("1250")], code, rates, true).inputs })));
    assert.equal(implicit.invoice.currencyCode, code); assert.equal(implicit.invoice.totalMinor, "1250");
    for (const [currency, text, expected] of [
      ["USD", "90071992547409.91", "9007199254740991"], ["JPY", "1250", "1250"],
      ["IRR", "1250", "1250"], ["KWD", "1.251", "1251"],
    ]) {
      const currencyCode = invoiceEditorCurrency(currency, customerData.contact.currencyCode, orgData.organization.defaultCurrency);
      const preview = documentEditorPreview([row(text)], currencyCode, rates, true);
      assert.equal(preview.error, null); assert.equal(String(preview.total), expected);
      const payload = { contactId: customer.id, issueDate: "2026-10-11", currencyCode, lines: preview.inputs };
      const rest = await ok(await createInvoice(request(payload)));
      const mcp = await client.callTool({ name: "create_invoice", arguments: payload });
      assert.equal(mcp.isError, undefined, JSON.stringify(mcp.content));
      const mcpBody = JSON.parse((mcp.content as { text: string }[])[0].text);
      for (const saved of [rest.invoice, mcpBody.invoice]) {
        assert.equal(saved.currencyCode, currencyCode); assert.equal(saved.totalMinor, expected);
        assert.equal(saved.amountDueMinor, expected);
        const raw = await db.select({ price: sql<string>`${invoiceLine.unitPrice}::text`, amount: sql<string>`${invoiceLine.amount}::text` })
          .from(invoiceLine).where(eq(invoiceLine.invoiceId, saved.id));
        assert.equal(raw[0].price, expected); assert.equal(raw[0].amount, expected);
        assert.equal(documentEditorDecimal(BigInt(raw[0].amount), currencyCode), text);
      }
    }
    // REST creation rounds a sub-minor price before extending; MCP keeps its
    // independently adopted extended-price contract. Assert each policy explicitly.
    for (const [lines, expected] of [
      [[row("0.005", "3")], "3"], [[row("-0.005", "3")], "0"],
      [[row("0.10", "1", true), row("0.20", "1", true)], "33"],
      [[row("40000000000000.01"), row("0.02")], "4000000000000003"],
      [[row("1.005", "1.25", true)], "139"],
    ] as const) {
      const preview = documentEditorPreview(lines, "USD", rates, true);
      assert.equal(preview.error, null); assert.equal(String(preview.total), expected);
      const payload = { contactId: customer.id, issueDate: "2026-10-11", currencyCode: "USD", lines: preview.inputs };
      const rest = await ok(await createInvoice(request(payload)));
      assert.equal(rest.invoice.totalMinor, expected); assert.equal(rest.invoice.subtotalMinor, String(preview.subtotal));
      assert.equal(rest.invoice.taxTotalMinor, String(preview.taxTotal));
      const raw = await db.execute(sql`select sum(amount::numeric)::text amount, sum(tax_amount::numeric)::text tax from invoice_line where invoice_id=${rest.invoice.id}`);
      assert.equal(String(raw.rows[0].amount), String(preview.subtotal)); assert.equal(String(raw.rows[0].tax), String(preview.taxTotal));
      const mcp = await client.callTool({ name: "create_invoice", arguments: payload });
      assert.equal(mcp.isError, undefined, JSON.stringify(mcp.content));
      const mcpBody = JSON.parse((mcp.content as { text: string }[])[0].text);
      assert.equal(mcpBody.invoice.totalMinor, String(documentEditorPreview(lines, "USD", rates, false).total));
    }
    console.log("Invoice editor stored totals verified");
  } finally { await client.close(); await server.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
