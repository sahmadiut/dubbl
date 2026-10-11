// Runs only in the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/debit-notes/route";
import { GET, PATCH } from "../../app/api/v1/debit-notes/[id]/route";
import { POST as APPLY } from "../../app/api/v1/debit-notes/[id]/apply/route";
import { POST as VOID } from "../../app/api/v1/debit-notes/[id]/void/route";
import { POST as BILL, GET as BILLS } from "../../app/api/v1/bills/route";
import { GET as BILL_GET } from "../../app/api/v1/bills/[id]/route";
import { registerDebitNoteTools } from "../../lib/mcp/tools/debit-notes";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { debitNoteEditorLines, debitNoteUiDocument, debitNoteUiHeader, debitNoteUiOverview,
  debitNoteUiBill, debitNoteUiBillEligible, debitNoteUiApplication } from "../../lib/money/debit-note-ui";
import { documentEditorPreview } from "../../lib/money/document-editor";
import { invoiceUiDecimal } from "../../lib/money/invoice-ui";

type DebitWire = { id: string; contactId: string; currencyCode: string; status: string; total: number; amountRemaining: number;
  lines: { quantity: number; unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown }[]; [key: string]: unknown };
type TargetWire = { id: string; contactId: string; currencyCode: string; status: string; amountDue: number; [key: string]: unknown };

async function run() {
  const [owner] = await db.insert(users).values({ email: "debit-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Debit UI ${currencyCode}`, slug: `debit-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_debit_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_debit" });
    const [supplier] = await db.insert(contact).values({ organizationId: org.id, name: "Supplier", type: "supplier", currencyCode: "KWD" }).returning();
    const [account] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "5000", name: "Expense", type: "expense", currencyCode },
      { organizationId: org.id, code: "2100", name: "AP", type: "liability", currencyCode },
      { organizationId: org.id, code: "1210", name: "Input VAT", type: "asset", currencyCode },
    ]).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
    const server = new McpServer({ name: "Debit UI", version: "1.0.0" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerDebitNoteTools(server, ctx); registerBillTools(server, ctx);
    const client = new Client({ name: "UI fixture", version: "1.0.0" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method: string, body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/debit-notes${query}`, { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const ok = async (response: Response) => { const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data; };
    const line = (price: string, quantity = "1", taxed = false) => ({ description: "Work", quantity, unitPrice: price, accountId: account.id, taxRateId: taxed ? tax.id : "" });
    const base = { contactId: supplier.id, issueDate: "2026-10-11" };
    try {
      const lines = [line(invoiceUiDecimal(1250n, currencyCode), "1.25", true)];
      const payload = { ...base, currencyCode, lines: debitNoteEditorLines(lines) };
      const preview = documentEditorPreview(lines, currencyCode, [{ id: tax.id, rate: tax.rate }], false);
      assert.equal(preview.error, null);
      const made = debitNoteUiHeader((await ok(await POST(req("POST", payload)))).debitNote);
      const linkedMade = debitNoteUiHeader((await call("create_debit_note", payload)).debitNote);
      // The supported exact replacement contract remains identical before recognition.
      const edited = debitNoteUiHeader((await ok(await PATCH(req("PATCH", { lines: payload.lines }), params(made.id as string)))).debitNote);
      assert.equal(edited.total, preview.total);
      const linkedEdit = debitNoteUiHeader((await call("update_debit_note", { debitNoteId: linkedMade.id, lines: payload.lines })).debitNote);
      assert.equal(linkedEdit.total, preview.total);
      const before = (await db.execute(sql`select count(*)::text as count, sum(total)::text as total from debit_note where organization_id=${org.id}`)).rows;
      for (const unitPriceExact of ["1x", "1e3", invoiceUiDecimal(9007199254740992n, currencyCode)]) {
        const invalid = { ...payload, lines: [{ ...payload.lines[0], quantity: 1, unitPriceExact }] };
        const response = await POST(req("POST", invalid));
        assert.ok([400, 422].includes(response.status));
        assert.equal((await client.callTool({ name: "create_debit_note", arguments: invalid })).isError, true);
      }
      const after = (await db.execute(sql`select count(*)::text as count, sum(total)::text as total from debit_note where organization_id=${org.id}`)).rows;
      assert.deepEqual(after, before);
      for (const [saved, transport] of [[made, "rest"], [linkedMade, "mcp"]] as const) {
        assert.equal(saved.total, preview.total); assert.equal(saved.currencyCode, currencyCode);
        const rest = debitNoteUiDocument((await ok(await GET(req("GET"), params(saved.id as string)))).debitNote);
        const linked = debitNoteUiDocument((await call("get_debit_note", { debitNoteId: saved.id })).debitNote);
        assert.equal(rest.total, preview.total); assert.equal(linked.total, preview.total);
        assert.equal(rest.lines[0].unitPrice, preview.lines[0].priceMinor); assert.equal(rest.lines[0].amount, preview.lines[0].amountMinor);
        const stored = (await db.execute(sql`select q.total::text, q.currency_code, l.unit_price::text, l.amount::text, l.tax_amount::text, l.quantity, l.account_id, l.tax_rate_id
          from debit_note q join debit_note_line l on q.id=l.debit_note_id where q.id=${saved.id as string}`)).rows[0];
        assert.equal(stored.total, preview.total.toString()); assert.equal(stored.unit_price, preview.lines[0].priceMinor.toString());
        assert.equal(stored.amount, preview.lines[0].amountMinor.toString()); assert.equal(stored.tax_amount, preview.lines[0].taxMinor.toString());
        assert.equal(stored.currency_code, currencyCode); assert.equal(stored.quantity, 125); assert.equal(stored.account_id, account.id); assert.equal(stored.tax_rate_id, tax.id);
        await call("send_debit_note", { debitNoteId: saved.id });
        const credit = debitNoteUiDocument((await ok(await GET(req("GET"), params(saved.id as string)))).debitNote as DebitWire);
        assert.equal(credit.amountRemaining, preview.total); assert.equal(credit.status, "sent");
        const bill: { id: string } = (await ok(await BILL(req("POST", { ...base, dueDate: "2026-11-11", currencyCode,
          lines: [{ description: "Bill", quantity: 1, unitPriceMinor: String(preview.total * 2n), accountId: account.id }] })))).bill;
        await call("receive_bill", { billId: bill.id });
        const candidates = (await ok(await BILLS(req("GET", undefined, "?limit=100")))).data as TargetWire[];
        const inv = candidates.map(row => debitNoteUiBill(row)).find(row => row.id === bill.id);
        assert.ok(inv);
        assert.ok(debitNoteUiBillEligible(credit, inv));
        const amount = debitNoteUiApplication(invoiceUiDecimal(preview.total, currencyCode), credit, inv);
        if (transport === "rest") await ok(await APPLY(req("POST", amount), params(saved.id as string)));
        else await call("apply_debit_note", { debitNoteId: saved.id, ...amount });
        const applied = debitNoteUiDocument((await call("get_debit_note", { debitNoteId: saved.id })).debitNote);
        assert.equal(applied.amountApplied, preview.total); assert.equal(applied.amountRemaining, 0n); assert.equal(applied.status, "applied");
        const paid = (await db.execute(sql`select amount_paid::text, amount_due::text from bill where id=${bill.id}`)).rows[0];
        assert.equal(paid.amount_paid, preview.total.toString()); assert.equal(paid.amount_due, preview.total.toString());
        const allocations = (await db.execute(sql`select amount::text from payment_allocation where document_id=${saved.id as string}`)).rows;
        assert.equal(allocations.length, 1); assert.equal(allocations[0].amount, amount.amountMinor);
        if (transport === "rest") await ok(await VOID(req("POST"), params(saved.id as string)));
        else await call("void_debit_note", { debitNoteId: saved.id });
        const voided = debitNoteUiDocument((await ok(await GET(req("GET"), params(saved.id as string)))).debitNote);
        assert.equal(voided.status, "void"); assert.equal(voided.amountApplied, 0n); assert.equal(voided.amountRemaining, 0n);
        const undone = debitNoteUiBill((await ok(await BILL_GET(req("GET"), params(bill.id)))).bill as TargetWire);
        assert.equal(undone.amountDue, preview.total * 2n);
      }
      for (const [price, quantity] of [[invoiceUiDecimal(9007199254740991n, currencyCode), "1"], ...(currencyCode === "USD" ? [["0.005", "3"], ["-0.005", "1"]] : [])]) {
        const lines = [line(price, quantity)], preview = documentEditorPreview(lines, currencyCode, [], false);
        for (const transport of ["rest", "mcp"]) {
          const payload = { ...base, currencyCode, lines: debitNoteEditorLines(lines) };
          const created = transport === "rest" ? (await ok(await POST(req("POST", payload)))).debitNote : (await call("create_debit_note", payload)).debitNote;
          const read = debitNoteUiDocument((await call("get_debit_note", { debitNoteId: created.id })).debitNote);
          assert.equal(read.total, preview.total); assert.equal(read.lines[0].amount, preview.lines[0].amountMinor);
          const stored = (await db.execute(sql`select total::text from debit_note where id=${created.id}`)).rows[0]; assert.equal(stored.total, preview.total.toString());
        }
      }
      // Omitted currency remains USD even with a KWD supplier and a non-USD org.
      const defaultPayload = { ...base, lines: debitNoteEditorLines([line("12.50")]) };
      assert.equal((await ok(await POST(req("POST", defaultPayload)))).debitNote.currencyCode, "USD");
      assert.equal((await call("create_debit_note", defaultPayload)).debitNote.currencyCode, "USD");
      const listed = (await ok(await LIST(req("GET")))).data.map((row: Parameters<typeof debitNoteUiHeader>[0]) => debitNoteUiHeader(row));
      assert.ok(listed.some((row: { total: bigint }) => row.total === 9007199254740991n));
      const linkedList = await call("list_debit_notes", {}); assert.ok(linkedList.debitNotes.every((row: Parameters<typeof debitNoteUiHeader>[0]) => typeof debitNoteUiHeader(row).total === "bigint"));
      const groups = debitNoteUiOverview(listed);
      const group = groups.find(group => group.currencyCode === currencyCode);
      assert.ok(group);
      const sums = (await db.execute(sql`select sum(total)::text as total, sum(amount_applied)::text as applied, sum(amount_remaining)::text as remaining
        from debit_note where organization_id=${org.id} and currency_code=${currencyCode} and status != 'void'`)).rows[0];
      assert.equal(group.total.toString(), sums.total); assert.equal(group.amountApplied.toString(), sums.applied);
      assert.equal(group.amountRemaining.toString(), sums.remaining);
    } finally { await client.close(); await server.close(); }
  }
  console.log("Debit UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
