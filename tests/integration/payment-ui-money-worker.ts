// Only runs against the wrapper's migrated, randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount } from "../../lib/db/schema";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { GET as PAYMENTS, POST as PAY } from "../../app/api/v1/payments/route";
import { GET as PAYMENT } from "../../app/api/v1/payments/[id]/route";
import { POST as BATCH, GET as BATCHES } from "../../app/api/v1/payment-batches/route";
import { GET as BATCH_DETAIL } from "../../app/api/v1/payment-batches/[id]/route";
import { POST as SUBMIT } from "../../app/api/v1/payment-batches/[id]/submit/route";
import { GET as REMIT } from "../../app/api/v1/payment-batches/[id]/remittance/route";
import { POST as SCHEDULE, GET as SCHEDULES } from "../../app/api/v1/scheduled-payments/route";
import { POST as PROCESS } from "../../app/api/v1/scheduled-payments/process/route";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { registerPaymentBatchTools } from "../../lib/mcp/tools/payment-batches";
import { registerPurchasingTools } from "../../lib/mcp/tools/purchasing";
import { registerScheduledPaymentTools } from "../../lib/mcp/tools/scheduled-payments";
import { paymentUiAmount, paymentUiRow, paymentUiBill, paymentUiBatch, paymentUiBatchInput, paymentUiBillAmount,
  paymentUiDecimal, paymentUiScheduled, paymentUiRemittance } from "../../lib/money/payment-ui";

type PaymentWire = { id: string; currencyCode: string; allocations: Record<string, unknown>[]; [key: string]: unknown };
type BillWire = { id: string; contactId: string; currencyCode: string; [key: string]: unknown };
type BatchWire = { id: string; currencyCode: string; items: (Record<string, unknown> & { currencyCode: string })[]; [key: string]: unknown };
type RemitWire = { currencyCode: string; lines: (Record<string, unknown> & { currencyCode: string })[]; [key: string]: unknown };

async function run() {
  const [owner] = await db.insert(users).values({ email: "payment-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Payment UI ${currencyCode}`, slug: `payment-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_payment_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_payui" });
    const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Customer and supplier", type: "both", currencyCode }).returning();
    const [expense, revenue] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "5000", name: "Expense", type: "expense", currencyCode },
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode },
      { organizationId: org.id, code: "1100", name: "Cash", type: "asset", currencyCode },
      { organizationId: org.id, code: "1200", name: "AR", type: "asset", currencyCode },
      { organizationId: org.id, code: "2100", name: "AP", type: "liability", currencyCode },
    ]).returning();
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    const server = new McpServer({ name: "Payment UI", version: "1" });
    registerPaymentTools(server, ctx); registerPaymentBatchTools(server, ctx); registerScheduledPaymentTools(server, ctx); registerPurchasingTools(server, ctx);
    const client = new Client({ name: "UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method = "GET", body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/payments${query}`, { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    async function ok(response: Response) { const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body; }
    const date = new Date().toISOString().slice(0, 10);
    async function document(kind: "invoice" | "bill", amount: bigint) {
      const input = { contactId: party.id, currencyCode, issueDate: date, dueDate: date,
        lines: [{ description: "Work", unitPriceMinor: amount.toString(), accountId: kind === "invoice" ? revenue.id : expense.id }] };
      if (kind === "invoice") { const made = await createInvoice(ctx, input, "rest"); return (await sendInvoice(ctx, made.invoice.id)).invoice; }
      const made = await createBill(ctx, input, "rest"); return (await receiveBill(ctx, made.bill.id)).bill;
    }
    try {
      for (const transport of ["rest", "mcp"]) {
        for (const original of [1250n, 3000000001n]) {
          const invoice = await document("invoice", original);
          const input = { contactId: party.id, currencyCode, type: "received", date,
            ...paymentUiAmount(paymentUiDecimal(original, currencyCode), currencyCode),
            allocations: [{ documentType: "invoice", documentId: invoice.id, amountMinor: original.toString() }] };
          const created = transport === "rest" ? await ok(await PAY(req("POST", input))) : await call("create_payment", input);
          const saved = paymentUiRow(created.payment as PaymentWire);
          assert.equal(saved.amount, original); assert.equal(saved.allocated, original); assert.equal(saved.unallocated, 0n);
          assert.equal(paymentUiRow((await ok(await PAYMENT(req(), params(saved.id)))).payment as PaymentWire).amount, original);
          assert.equal(paymentUiRow((await call("get_payment", { paymentId: saved.id })).payment as PaymentWire).amount, original);
          const stored = (await db.execute(sql`select p.amount::text, sum(a.amount)::text as allocated from payment p
            join payment_allocation a on a.payment_id=p.id where p.id=${saved.id} group by p.id`)).rows[0];
          assert.equal(stored.amount, original.toString()); assert.equal(stored.allocated, original.toString());

          const bills = [await document("bill", original), await document("bill", 1n)].map(row => paymentUiBill(row as BillWire));
          const preview = paymentUiBatchInput(bills.map(bill => ({ billId: bill.id, contactId: bill.contactId, currencyCode,
            amount: paymentUiDecimal(bill.amountDue, currencyCode) })), bills);
          const batchInput = { name: "Exact preview", currencyCode: preview.currencyCode, items: preview.items };
          const batchMade = transport === "rest" ? await ok(await BATCH(req("POST", batchInput))) : await call("create_payment_batch", batchInput);
          const batch = paymentUiBatch(batchMade.batch as BatchWire);
          assert.equal(batch.totalAmount, preview.total); assert.equal(batch.totalAmount, original + 1n);
          const batchRead = paymentUiBatch((await ok(await BATCH_DETAIL(req(), params(batch.id)))).batch as BatchWire);
          assert.equal(batchRead.items[0].amount + batchRead.items[1].amount, preview.total);
          assert.equal(paymentUiBatch((await call("get_payment_batch", { batchId: batch.id })).batch as BatchWire).totalAmount, preview.total);
          if (transport === "rest") await ok(await SUBMIT(req("POST"), params(batch.id)));
          else await call("submit_payment_batch", { batchId: batch.id });
          const remittance = await ok(await REMIT(req(), params(batch.id)));
          assert.equal(paymentUiRemittance(remittance.remittances[0] as RemitWire).totalPaid, preview.total);
          const mcpRemit = await call("generate_remittance", { paymentBatchId: batch.id });
          assert.equal(paymentUiRemittance(mcpRemit.remittances[0] as RemitWire).totalPaid, preview.total);
          const totals = (await db.execute(sql`select b.total_amount::text, sum(i.amount)::text as items from payment_batch b
            join payment_batch_item i on i.batch_id=b.id where b.id=${batch.id} group by b.id`)).rows[0];
          assert.equal(totals.total_amount, preview.total.toString()); assert.equal(totals.items, preview.total.toString());

          const scheduledBill = paymentUiBill(await document("bill", original) as BillWire);
          const scheduleInput = { billId: scheduledBill.id, contactId: party.id, currencyCode, scheduledDate: date,
            ...paymentUiBillAmount(paymentUiDecimal(original, currencyCode), scheduledBill) };
          const scheduleMade = transport === "rest" ? await ok(await SCHEDULE(req("POST", scheduleInput))) : await call("create_scheduled_payment", scheduleInput);
          const schedule = paymentUiScheduled(scheduleMade.scheduledPayment as BillWire);
          assert.equal(schedule.amount, original);
          if (transport === "rest") await ok(await PROCESS(req("POST"))); else await call("process_scheduled_payments", {});
          const scheduleSQL = (await db.execute(sql`select s.amount::text, s.status, b.amount_paid::text, b.amount_due::text from scheduled_payment s
            join bill b on b.id=s.bill_id where s.id=${schedule.id}`)).rows[0];
          assert.equal(scheduleSQL.amount, original.toString()); assert.equal(scheduleSQL.status, "completed");
          assert.equal(scheduleSQL.amount_paid, original.toString()); assert.equal(scheduleSQL.amount_due, "0");
        }
      }
      const listed = await ok(await PAYMENTS(req("GET", undefined, "?type=received&limit=100")));
      assert.equal(listed.data.length, 4); listed.data.forEach((row: PaymentWire) => paymentUiRow(row));
      (await ok(await BATCHES(req()))).data.forEach((row: BatchWire) => paymentUiBatch(row));
      (await ok(await SCHEDULES(req()))).data.forEach((row: BillWire) => paymentUiScheduled(row));
    } finally { await client.close(); await server.close(); }
  }
  console.log("Payment UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
