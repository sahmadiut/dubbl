// Only runs against the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, bankAccount } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/customer-credits/route";
import { GET } from "../../app/api/v1/customer-credits/[id]/route";
import { POST as APPLY } from "../../app/api/v1/customer-credits/[id]/apply/route";
import { POST as INVOICE, GET as INVOICES } from "../../app/api/v1/invoices/route";
import { POST as SEND } from "../../app/api/v1/invoices/[id]/send/route";
import { registerCustomerCreditTools } from "../../lib/mcp/tools/customer-credits";
import { customerPrepaymentAmount, customerPrepaymentCurrency, customerPrepaymentDecimal, customerPrepaymentRow,
  customerPrepaymentInvoice, customerPrepaymentInvoiceEligible, customerPrepaymentApplication } from "../../lib/money/customer-prepayment-ui";

type CreditWire = { id: string; currencyCode: string; contactId: string; status: string; [key: string]: unknown };
type InvoiceWire = { id: string; currencyCode: string; contactId: string; status: string; [key: string]: unknown };

async function run() {
  const [owner] = await db.insert(users).values({ email: "prepayment-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Prepayment UI ${currencyCode}`, slug: `prepayment-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_prepayment_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_prepay" });
    const [customer, other] = await db.insert(contact).values([
      { organizationId: org.id, name: "Customer", type: "customer", currencyCode },
      { organizationId: org.id, name: "Other customer", type: "customer", currencyCode },
    ]).returning();
    const [revenue] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode },
      { organizationId: org.id, code: "1200", name: "AR", type: "asset", currencyCode },
    ]).returning();
    const [bank] = await db.insert(bankAccount).values({ organizationId: org.id, accountName: "Cash", accountType: "cash", currencyCode }).returning();
    const server = new McpServer({ name: "Prepayment UI", version: "1" });
    registerCustomerCreditTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
    const client = new Client({ name: "UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method = "GET", body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/customer-credits${query}`, { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    async function ok(response: Response) { const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body; }
    const base = { contactId: customer.id, date: "2026-10-11", sourceType: "prepayment", bankAccountId: bank.id, notes: "Advance" };
    async function target(contactId = customer.id) {
      const made = await ok(await INVOICE(req("POST", { contactId, currencyCode, issueDate: base.date, dueDate: "2026-11-11",
        lines: [{ description: "Work", accountId: revenue.id, unitPriceExact: customerPrepaymentDecimal(2500n, currencyCode), quantity: 1 }] })));
      await ok(await SEND(req("POST"), params(made.invoice.id)));
      return made.invoice.id as string;
    }
    try {
      for (const original of [1250n, 3000000001n]) {
        const text = customerPrepaymentDecimal(original, currencyCode);
        const payload = { ...base, currencyCode: customerPrepaymentCurrency(null, customer.currencyCode, org.defaultCurrency), ...customerPrepaymentAmount(text, currencyCode) };
        const rest = customerPrepaymentRow((await ok(await POST(req("POST", payload)))).customerCredit as CreditWire);
        const mcp = customerPrepaymentRow((await call("create_customer_credit", payload)).customerCredit as CreditWire);
        for (const [transport, saved] of [["rest", rest], ["mcp", mcp]] as const) {
          assert.equal(saved.originalAmount, original); assert.equal(saved.amountRemaining, original); assert.equal(saved.currencyCode, currencyCode);
          const read = customerPrepaymentRow((await ok(await GET(req(), params(saved.id)))).customerCredit as CreditWire);
          const linked = customerPrepaymentRow((await call("get_customer_credit", { customerCreditId: saved.id })).customerCredit as CreditWire);
          assert.equal(read.originalAmount, original); assert.equal(linked.originalAmount, original);
          const stored = (await db.execute(sql`select c.original_amount::text, c.amount_remaining::text, c.currency_code, c.contact_id, c.source_type, c.notes,
            sum(l.debit_amount)::text as debit, sum(l.credit_amount)::text as credit from customer_credit c
            join journal_line l on l.journal_entry_id=c.journal_entry_id where c.id=${saved.id} group by c.id`)).rows[0];
          assert.equal(stored.original_amount, original.toString()); assert.equal(stored.amount_remaining, original.toString());
          assert.equal(stored.currency_code, currencyCode); assert.equal(stored.contact_id, customer.id); assert.equal(stored.source_type, "prepayment");
          assert.equal(stored.notes, "Advance"); assert.equal(stored.debit, original.toString()); assert.equal(stored.credit, original.toString());
          const invoiceId = await target();
          const options = (await ok(await INVOICES(req("GET", undefined, `?contactId=${customer.id}&limit=100`)))).data as InvoiceWire[];
          const selected = options.map(customerPrepaymentInvoice).find(inv => inv.id === invoiceId)!;
          assert.equal(customerPrepaymentInvoiceEligible(read, selected), true);
          const apply = customerPrepaymentApplication(customerPrepaymentDecimal(1n, currencyCode), read, selected);
          const updated = transport === "rest" ? await ok(await APPLY(req("POST", apply), params(saved.id)))
            : await call("apply_customer_credit", { customerCreditId: saved.id, ...apply, date: base.date });
          const remaining = customerPrepaymentRow(updated.customerCredit as CreditWire);
          assert.equal(remaining.amountRemaining, original - 1n); assert.equal(remaining.originalAmount - remaining.amountRemaining, 1n);
          assert.equal(updated.invoice.amountDueMinor, "2499");
          const balances = (await db.execute(sql`select c.amount_remaining::text, i.amount_due::text, i.amount_paid::text from customer_credit c
            join invoice i on i.id=${invoiceId} where c.id=${saved.id}`)).rows[0];
          assert.equal(balances.amount_remaining, (original - 1n).toString()); assert.equal(balances.amount_due, "2499"); assert.equal(balances.amount_paid, "1");
        }
      }
      // Both omitted-currency transports match contact/org resolution without rescaling.
      for (const customerCurrency of [currencyCode, null]) {
        await db.update(contact).set({ currencyCode: customerCurrency }).where(eq(contact.id, customer.id));
        const resolved = customerPrepaymentCurrency(null, customerCurrency, org.defaultCurrency);
        for (const made of [await ok(await POST(req("POST", { ...base, amountMinor: "1250" }))), await call("create_customer_credit", { ...base, amountMinor: "1250" })]) {
          assert.equal(made.customerCredit.currencyCode, resolved); assert.equal(made.customerCredit.originalAmountMinor, "1250");
        }
      }
      const listed = (await ok(await LIST(req()))).data as CreditWire[];
      assert.equal(listed.length, 8); listed.forEach(customerPrepaymentRow);
      const mcpList = await call("list_customer_credits", {});
      assert.equal(mcpList.customerCredits.length, 8); mcpList.customerCredits.forEach(customerPrepaymentRow);
      const foreignInvoice = await target(other.id);
      const credit = customerPrepaymentRow(listed[0]);
      assert.equal((await APPLY(req("POST", { invoiceId: foreignInvoice, amountMinor: "1" }), params(credit.id))).status, 400);
      const bad = await client.callTool({ name: "apply_customer_credit", arguments: { customerCreditId: credit.id, invoiceId: foreignInvoice, amountMinor: "1" } });
      assert.equal(bad.isError, true);
      assert.equal((await GET(req(), params(credit.id))).status, 200);
    } finally { await client.close(); await server.close(); }
  }
  console.log("Prepayment UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
