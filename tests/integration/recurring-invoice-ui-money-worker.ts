// Runs only in the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate } from "../../lib/db/schema";
import { POST } from "../../app/api/v1/recurring-invoices/route";
import { GET, PATCH } from "../../app/api/v1/recurring/[id]/route";
import { GET as PREVIEW } from "../../app/api/v1/recurring/[id]/preview/route";
import { registerRecurringTemplateTools } from "../../lib/mcp/tools/recurring-templates";
import { processRecurringInvoiceTemplate } from "../../lib/api/recurring-invoice-generate";
import { recurringInvoiceEditorLines, recurringInvoiceEditorPreview, recurringInvoiceUiDocument, recurringInvoiceUiUpcoming } from "../../lib/money/recurring-invoice-ui";

async function run() {
  const [owner] = await db.insert(users).values({ email: "recurring-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Recurring UI ${currencyCode}`, slug: `recurring-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_recurring_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_recurring" });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer", currencyCode: "KWD" }).returning();
    const [account] = await db.insert(chartAccount).values({ organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode }).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
    const server = new McpServer({ name: "Recurring UI", version: "1" });
    registerRecurringTemplateTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
    const client = new Client({ name: "UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/recurring?count=3", { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const line = (price: string, quantity = "1", taxed = false) => ({ description: "Work", quantity, unitPrice: price, accountId: account.id, taxRateId: taxed ? tax.id : "" });
    const base = { name: "Monthly work", contactId: customer.id, frequency: "monthly", startDate: "2026-10-11", endDate: "2026-11-11", maxOccurrences: 2,
      notes: "Preserved notes", reference: "Preserved reference", autoSend: false };
    try {
      const price = currencyCode === "KWD" ? "1.2505" : currencyCode === "USD" ? "12.505" : "12.5";
      const cases: [string, string, boolean][] = [[price, "1.234", true], [price, "0", false], ["", "", false]];
      if (currencyCode === "USD") cases.push(["0.005", "3", false], ["-0.005", "1", false], ["90071992547409.91", "1", false]);
      if (currencyCode === "KWD") cases.push(["9007199254740.991", "1", false]);
      for (const [unitPrice, quantity, taxed] of cases) {
        const lines = [line(unitPrice, quantity, taxed)], payload = { ...base, currencyCode, lines: recurringInvoiceEditorLines(lines) };
        const preview = recurringInvoiceEditorPreview(lines, currencyCode, [{ id: tax.id, rate: tax.rate }]);
        assert.equal(preview.error, null);
        const response = await POST(req("POST", payload)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
        const restCreated = (await response.json()).template;
        const mcpCreated = (await call("create_recurring_template", { ...payload, type: "invoice" })).template;
        for (const created of [restCreated, mcpCreated]) {
          const readResponse = await GET(req("GET"), params(created.id)); assert.equal(readResponse.status, 200);
          const rest = recurringInvoiceUiDocument((await readResponse.json()).template);
          const linked = recurringInvoiceUiDocument((await call("get_recurring_template", { templateId: created.id })).template);
          assert.equal(rest.currencyCode, currencyCode); assert.equal(linked.lines[0].unitPrice, rest.lines[0].unitPrice);
          assert.equal(rest.lines[0].unitPrice, preview.lines[0].priceMinor);
          const stored = (await db.execute(sql`select l.unit_price::text, l.quantity, l.tax_rate_id, l.account_id, t.currency_code, t.frequency, t.start_date, t.end_date, t.max_occurrences, t.auto_send, t.notes, t.reference
            from recurring_template t join recurring_template_line l on l.template_id=t.id where t.id=${created.id}`)).rows[0];
          assert.equal(stored.unit_price, preview.lines[0].priceMinor.toString()); assert.equal(stored.quantity, rest.lines[0].quantity);
          assert.equal(stored.currency_code, currencyCode); assert.equal(stored.account_id, account.id); assert.equal(stored.tax_rate_id, taxed ? tax.id : null);
          assert.equal(stored.frequency, base.frequency); assert.equal(stored.max_occurrences, 2); assert.equal(stored.auto_send, false);
          assert.equal(stored.start_date, base.startDate); assert.equal(stored.end_date, base.endDate); assert.equal(stored.notes, base.notes); assert.equal(stored.reference, base.reference);
          const upcoming = await (await PREVIEW(req("GET"), params(created.id))).json();
          const gross = recurringInvoiceUiUpcoming(upcoming.template);
          const mcpUpcoming = await call("preview_recurring_invoice", { templateId: created.id, count: 3 });
          assert.equal(gross.lineTotal, rest.lines[0].grossMinor); assert.equal(recurringInvoiceUiUpcoming(mcpUpcoming.template).lineTotal, gross.lineTotal);
          assert.deepEqual(upcoming.upcoming.map((row: { date: string }) => row.date), ["2026-10-11", "2026-11-11"]);
          assert.equal((await PATCH(req("PATCH", { status: "paused" }), params(created.id))).status, 200);
          assert.equal(await processRecurringInvoiceTemplate(org.id, created.id, "2026-10-11"), 0);
          await call("update_recurring_template", { templateId: created.id, status: "active" });
          assert.equal((await PATCH(req("PATCH", { reference: created.id }), params(created.id))).status, 200);
          const generated = await processRecurringInvoiceTemplate(org.id, created.id, "2026-10-11");
          assert.equal(generated, 1);
          const invoice = (await db.execute(sql`select i.total::text, l.unit_price::text, l.amount::text, l.tax_amount::text, l.quantity
            from invoice i join invoice_line l on l.invoice_id=i.id where i.organization_id=${org.id} and i.reference=${created.id}`)).rows[0];
          assert.equal(invoice.total, preview.total.toString()); assert.equal(invoice.amount, preview.lines[0].amountMinor.toString());
          assert.equal(invoice.tax_amount, preview.lines[0].taxMinor.toString()); assert.equal(invoice.unit_price, preview.lines[0].priceMinor.toString());
          assert.equal(invoice.quantity, rest.lines[0].quantity);
          const after = (await call("get_recurring_template", { templateId: created.id })).template;
          assert.equal(after.nextRunDate, "2026-11-11"); assert.equal(after.occurrencesGenerated, 1);
        }
      }
      // Omission really defaults USD even with JPY/IRR/KWD org and KWD customer.
      const omitted = { ...base, lines: recurringInvoiceEditorLines([line("1")]) };
      const defaults = await POST(req("POST", omitted)); assert.equal(defaults.status, 201);
      assert.equal((await defaults.json()).template.currencyCode, "USD");
      assert.equal((await call("create_recurring_template", { ...omitted, type: "invoice" })).template.currencyCode, "USD");
    } finally { await client.close(); await server.close(); }
  }
  console.log("Recurring UI REST MCP SQL verified");
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
