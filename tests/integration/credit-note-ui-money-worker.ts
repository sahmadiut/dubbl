// Runs only in the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/credit-notes/route";
import { GET } from "../../app/api/v1/credit-notes/[id]/route";
import { POST as APPLY } from "../../app/api/v1/credit-notes/[id]/apply/route";
import { POST as VOID } from "../../app/api/v1/credit-notes/[id]/void/route";
import { GET as SUMMARY } from "../../app/api/v1/credit-notes/summary/route";
import { POST as INVOICE, GET as INVOICES } from "../../app/api/v1/invoices/route";
import { GET as INVOICE_GET } from "../../app/api/v1/invoices/[id]/route";
import { registerCreditNoteTools } from "../../lib/mcp/tools/credit-notes";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { creditNoteEditorLines, creditNoteUiDocument, creditNoteUiHeader, creditNoteUiSummary,
  creditNoteUiInvoice, creditNoteUiInvoiceEligible, creditNoteUiApplication } from "../../lib/money/credit-note-ui";
import { documentEditorPreview } from "../../lib/money/document-editor";
import { invoiceUiDecimal } from "../../lib/money/invoice-ui";

type CreditWire = { id: string; contactId: string; currencyCode: string; status: string; total: number; amountRemaining: number;
  lines: { quantity: number; unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown }[]; [key: string]: unknown };
type TargetWire = { id: string; contactId: string; currencyCode: string; status: string; amountDue: number; [key: string]: unknown };

async function run() {
  const [owner] = await db.insert(users).values({ email: "credit-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Credit UI ${currencyCode}`, slug: `credit-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_credit_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_credit" });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer", currencyCode: "KWD" }).returning();
    const [account] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode },
      { organizationId: org.id, code: "1200", name: "AR", type: "asset", currencyCode },
      { organizationId: org.id, code: "2200", name: "Tax payable", type: "liability", currencyCode },
    ]).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
    const server = new McpServer({ name: "Credit UI", version: "1.0.0" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerCreditNoteTools(server, ctx); registerInvoiceLifecycleTools(server, ctx);
    const client = new Client({ name: "UI fixture", version: "1.0.0" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method: string, body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/credit-notes${query}`, { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const ok = async (response: Response) => { const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data; };
    const line = (price: string, quantity = "1", taxed = false) => ({ description: "Work", quantity, unitPrice: price, accountId: account.id, taxRateId: taxed ? tax.id : "" });
    const base = { contactId: customer.id, issueDate: "2026-10-11" };
    try {
      const empty = creditNoteUiSummary(await ok(await SUMMARY(req("GET"))));
      assert.equal(empty.currencyCode, null); assert.equal(empty.totalAmount, 0n);
      const lines = [line(invoiceUiDecimal(1250n, currencyCode), "1.25", true)];
      const payload = { ...base, currencyCode, lines: creditNoteEditorLines(lines) };
      const preview = documentEditorPreview(lines, currencyCode, [{ id: tax.id, rate: tax.rate }], false);
      assert.equal(preview.error, null);
      const made = creditNoteUiHeader((await ok(await POST(req("POST", payload)))).creditNote);
      const linkedMade = creditNoteUiHeader((await call("create_credit_note", payload)).creditNote);
      for (const [saved, transport] of [[made, "rest"], [linkedMade, "mcp"]] as const) {
        assert.equal(saved.total, preview.total); assert.equal(saved.currencyCode, currencyCode);
        const rest = creditNoteUiDocument((await ok(await GET(req("GET"), params(saved.id as string)))).creditNote);
        const linked = creditNoteUiDocument((await call("get_credit_note", { creditNoteId: saved.id })).creditNote);
        assert.equal(rest.total, preview.total); assert.equal(linked.total, preview.total);
        assert.equal(rest.lines[0].unitPrice, preview.lines[0].priceMinor); assert.equal(rest.lines[0].amount, preview.lines[0].amountMinor);
        const stored = (await db.execute(sql`select q.total::text, q.currency_code, l.unit_price::text, l.amount::text, l.tax_amount::text, l.quantity, l.account_id, l.tax_rate_id
          from credit_note q join credit_note_line l on q.id=l.credit_note_id where q.id=${saved.id as string}`)).rows[0];
        assert.equal(stored.total, preview.total.toString()); assert.equal(stored.unit_price, preview.lines[0].priceMinor.toString());
        assert.equal(stored.amount, preview.lines[0].amountMinor.toString()); assert.equal(stored.tax_amount, preview.lines[0].taxMinor.toString());
        assert.equal(stored.currency_code, currencyCode); assert.equal(stored.quantity, 125); assert.equal(stored.account_id, account.id); assert.equal(stored.tax_rate_id, tax.id);
        await call("send_credit_note", { creditNoteId: saved.id });
        const credit = creditNoteUiDocument((await ok(await GET(req("GET"), params(saved.id as string)))).creditNote as CreditWire);
        assert.equal(credit.amountRemaining, preview.total); assert.equal(credit.status, "sent");
        const invoice: { id: string } = (await ok(await INVOICE(req("POST", { ...base, dueDate: "2026-11-11", currencyCode,
          lines: [{ description: "Invoice", quantity: 1, unitPriceMinor: String(preview.total * 2n), accountId: account.id }] })))).invoice;
        await call("send_invoice", { invoiceId: invoice.id });
        const candidates = (await ok(await INVOICES(req("GET", undefined, `?limit=100&contactId=${customer.id}`)))).data as TargetWire[];
        const inv = candidates.map(row => creditNoteUiInvoice(row)).find(row => row.id === invoice.id);
        assert.ok(inv);
        assert.ok(creditNoteUiInvoiceEligible(credit, inv));
        const amount = creditNoteUiApplication(invoiceUiDecimal(preview.total, currencyCode), credit, inv);
        if (transport === "rest") await ok(await APPLY(req("POST", amount), params(saved.id as string)));
        else await call("apply_credit_note", { creditNoteId: saved.id, ...amount });
        const applied = creditNoteUiDocument((await call("get_credit_note", { creditNoteId: saved.id })).creditNote);
        assert.equal(applied.amountApplied, preview.total); assert.equal(applied.amountRemaining, 0n); assert.equal(applied.status, "applied");
        const paid = (await db.execute(sql`select amount_paid::text, amount_due::text from invoice where id=${invoice.id}`)).rows[0];
        assert.equal(paid.amount_paid, preview.total.toString()); assert.equal(paid.amount_due, preview.total.toString());
        const allocations = (await db.execute(sql`select amount::text from payment_allocation where document_id=${saved.id as string}`)).rows;
        assert.equal(allocations.length, 1); assert.equal(allocations[0].amount, amount.amountMinor);
        if (transport === "rest") await ok(await VOID(req("POST"), params(saved.id as string)));
        else await call("void_credit_note", { creditNoteId: saved.id });
        const voided = creditNoteUiDocument((await ok(await GET(req("GET"), params(saved.id as string)))).creditNote);
        assert.equal(voided.status, "void"); assert.equal(voided.amountApplied, 0n); assert.equal(voided.amountRemaining, preview.total);
        const undone = creditNoteUiInvoice((await ok(await INVOICE_GET(req("GET"), params(invoice.id)))).invoice as TargetWire);
        assert.equal(undone.amountDue, preview.total * 2n);
      }
      const summary = creditNoteUiSummary(await ok(await SUMMARY(req("GET"))));
      const linkedSummary = creditNoteUiSummary(await call("get_credit_note_summary", {}));
      assert.equal(summary.totalAmount, preview.total * 2n); assert.equal(summary.totalAmount, linkedSummary.totalAmount);
      const sums = (await db.execute(sql`select sum(total)::text as total, sum(amount_applied)::text as applied, sum(amount_remaining)::text as remaining from credit_note where organization_id=${org.id}`)).rows[0];
      assert.equal(summary.totalAmount.toString(), sums.total); assert.equal(summary.totalApplied.toString(), sums.applied); assert.equal(summary.totalRemaining.toString(), sums.remaining);
      for (const [price, quantity] of [[invoiceUiDecimal(9007199254740991n, currencyCode), "1"], ...(currencyCode === "USD" ? [["0.005", "3"], ["-0.005", "1"]] : [])]) {
        const lines = [line(price, quantity)], preview = documentEditorPreview(lines, currencyCode, [], false);
        for (const transport of ["rest", "mcp"]) {
          const payload = { ...base, currencyCode, lines: creditNoteEditorLines(lines) };
          const created = transport === "rest" ? (await ok(await POST(req("POST", payload)))).creditNote : (await call("create_credit_note", payload)).creditNote;
          const read = creditNoteUiDocument((await call("get_credit_note", { creditNoteId: created.id })).creditNote);
          assert.equal(read.total, preview.total); assert.equal(read.lines[0].amount, preview.lines[0].amountMinor);
          const stored = (await db.execute(sql`select total::text from credit_note where id=${created.id}`)).rows[0]; assert.equal(stored.total, preview.total.toString());
        }
      }
      const listed = (await ok(await LIST(req("GET")))).data.map((row: Parameters<typeof creditNoteUiHeader>[0]) => creditNoteUiHeader(row));
      assert.ok(listed.some((row: { total: bigint }) => row.total === 9007199254740991n));
      const linkedList = await call("list_credit_notes", {}); assert.ok(linkedList.creditNotes.every((row: Parameters<typeof creditNoteUiHeader>[0]) => typeof creditNoteUiHeader(row).total === "bigint"));
      // Omitted currency remains USD even with a KWD customer and a non-USD org.
      const defaultPayload = { ...base, lines: creditNoteEditorLines([line("12.50")]) };
      assert.equal((await ok(await POST(req("POST", defaultPayload)))).creditNote.currencyCode, "USD");
      assert.equal((await call("create_credit_note", defaultPayload)).creditNote.currencyCode, "USD");
      const unavailable = await SUMMARY(req("GET")); assert.equal(unavailable.status, 422);
    } finally { await client.close(); await server.close(); }
  }
  console.log("Credit UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
