// Runs only in the wrapper's randomly named, migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount } from "../../lib/db/schema";
import { POST as CREATE } from "../../app/api/v1/invoices/route";
import { GET as GET_INVOICE, PATCH as EDIT } from "../../app/api/v1/invoices/[id]/route";
import { POST as PAY } from "../../app/api/v1/invoices/[id]/pay/route";
import { POST as QUOTE } from "../../app/api/v1/quotes/route";
import { POST as CONVERT } from "../../app/api/v1/quotes/[id]/convert/route";
import { POST as RECURRING } from "../../app/api/v1/recurring-invoices/route";
import { GET as PREVIEW } from "../../app/api/v1/recurring/[id]/preview/route";
import { POST as CREDIT } from "../../app/api/v1/credit-notes/route";
import { POST as APPLY_CREDIT } from "../../app/api/v1/credit-notes/[id]/apply/route";
import { POST as VOID_CREDIT } from "../../app/api/v1/credit-notes/[id]/void/route";
import { POST as PREPAYMENT } from "../../app/api/v1/customer-credits/route";
import { POST as APPLY_PREPAYMENT } from "../../app/api/v1/customer-credits/[id]/apply/route";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { registerQuoteTools } from "../../lib/mcp/tools/quotes";
import { registerRecurringTemplateTools } from "../../lib/mcp/tools/recurring-templates";
import { registerCreditNoteTools } from "../../lib/mcp/tools/credit-notes";
import { registerCustomerCreditTools } from "../../lib/mcp/tools/customer-credits";
import { processRecurringInvoiceTemplate } from "../../lib/api/recurring-invoice-generate";
import { documentLineInputs, documentEditorPreview } from "../../lib/money/document-editor";
import { invoiceUiDocument, invoiceUiCopyLines, invoiceUiDecimal, invoiceUiAmount, invoiceUiBase, invoiceUiMoney } from "../../lib/money/invoice-ui";
import { quoteEditorLines } from "../../lib/money/quote-ui";
import { recurringInvoiceEditorLines, recurringInvoiceEditorPreview, recurringInvoiceUiUpcoming } from "../../lib/money/recurring-invoice-ui";
import { creditNoteUiDocument, creditNoteUiApplication } from "../../lib/money/credit-note-ui";
import { customerPrepaymentAmount, customerPrepaymentRow } from "../../lib/money/customer-prepayment-ui";

async function run() {
  const [owner] = await db.insert(users).values({ email: "receivable-parent@example.test" }).returning();
  let foreignInvoiceId: string | undefined;
  let workflows = 0;
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"] as const) {
    const [org] = await db.insert(organization).values({ name: `Receivable parent ${currencyCode}`, slug: `receivable-parent-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_receivable_parent_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_parent" });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer", currencyCode }).returning();
    const [revenue, cash] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode },
      { organizationId: org.id, code: "1100", name: "Cash", type: "asset", currencyCode },
      { organizationId: org.id, code: "1200", name: "AR", type: "asset", currencyCode },
    ]).returning();
    const server = new McpServer({ name: "Receivable parent", version: "1" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    for (const register of [registerInvoiceTools, registerInvoiceLifecycleTools, registerQuoteTools,
      registerRecurringTemplateTools, registerCreditNoteTools, registerCustomerCreditTools]) register(server, ctx);
    const client = new Client({ name: "Receivable UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const badCall = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `Expected ${name} to reject`);
    };
    const req = (method = "GET", body?: unknown) => new Request("http://fixture.test/api/v1/fixture?count=2", { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const ok = async (response: Response) => { const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data; };
    const date = "2026-10-11";
    const halfMinor = { USD: "0.005", JPY: "0.5", IRR: "0.5", KWD: "0.0005" }[currencyCode];
    const line = (unitPrice: string, quantity = "1") => ({ description: "Work", quantity, unitPrice, accountId: revenue.id, taxRateId: "" });
    const lines = [line(invoiceUiDecimal(3000000001n, currencyCode)), line(halfMinor, "3")];
    const base = { contactId: customer.id, currencyCode, issueDate: date, dueDate: "2099-01-01" };
    const snapshot = async () => (await db.execute(sql`select
      (select jsonb_agg(row_to_json(i) order by i.id)::text from invoice i where organization_id=${org.id}) as invoices,
      (select jsonb_agg(row_to_json(l) order by l.id)::text from invoice_line l join invoice i on i.id=l.invoice_id where i.organization_id=${org.id}) as lines,
      (select count(*)::text from payment where organization_id=${org.id}) as payments,
      (select count(*)::text from journal_entry where organization_id=${org.id}) as journals,
      (select sum(amount_remaining)::text from customer_credit where organization_id=${org.id}) as prepayments`)).rows;
    try {
      if (foreignInvoiceId) {
        assert.equal((await GET_INVOICE(req(), params(foreignInvoiceId))).status, 404);
        await badCall("get_invoice", { invoiceId: foreignInvoiceId });
        await badCall("pay_invoice", { invoiceId: foreignInvoiceId, amountMinor: "1", date });
      }
      for (const origin of ["direct", "quote", "recurring"] as const) {
        for (const transport of ["rest", "mcp"] as const) {
          const preview = origin === "recurring" ? recurringInvoiceEditorPreview(lines, currencyCode, [])
            : documentEditorPreview(lines, currencyCode, [], origin === "quote" || transport === "rest");
          assert.equal(preview.error, null);
          const expected = origin === "direct" && transport === "mcp" ? 3000000003n : 3000000004n;
          assert.equal(preview.total, expected);
          let invoiceId: string;
          if (origin === "direct") {
            const payload = { ...base, lines: documentLineInputs(lines) };
            invoiceId = (transport === "rest" ? await ok(await CREATE(req("POST", payload))) : await call("create_invoice", payload)).invoice.id;
          } else if (origin === "quote") {
            const payload = { contactId: customer.id, currencyCode, issueDate: date, expiryDate: "2099-01-01", lines: quoteEditorLines(lines) };
            const quote = (transport === "rest" ? await ok(await QUOTE(req("POST", payload))) : await call("create_quote", payload)).quote;
            await call("send_quote", { quoteId: quote.id });
            await call("accept_quote", { quoteId: quote.id });
            invoiceId = (transport === "rest" ? await ok(await CONVERT(req("POST"), params(quote.id))) : await call("convert_quote_to_invoice", { quoteId: quote.id })).invoice.id;
          } else {
            const reference = `${currencyCode}-${transport}-recurring`;
            const payload = { name: reference, contactId: customer.id, currencyCode, reference, frequency: "monthly", startDate: date,
              endDate: "2026-11-11", maxOccurrences: 2, autoSend: false, lines: recurringInvoiceEditorLines(lines) };
            const template = (transport === "rest" ? await ok(await RECURRING(req("POST", payload))) : await call("create_recurring_template", { ...payload, type: "invoice" })).template;
            const upcoming = await ok(await PREVIEW(req(), params(template.id)));
            assert.equal(recurringInvoiceUiUpcoming(upcoming.template).lineTotal, expected);
            assert.equal(recurringInvoiceUiUpcoming((await call("preview_recurring_invoice", { templateId: template.id, count: 2 })).template).lineTotal, expected);
            assert.deepEqual(upcoming.upcoming.map((row: { date: string }) => row.date), [date, "2026-11-11"]);
            assert.equal(await processRecurringInvoiceTemplate(org.id, template.id, date), 1);
            const generated = (await db.execute(sql`select id from invoice where organization_id=${org.id} and reference=${reference}`)).rows;
            assert.equal(generated.length, 1); invoiceId = generated[0].id as string;
            const after = (await call("get_recurring_template", { templateId: template.id })).template;
            assert.equal(after.nextRunDate, "2026-11-11"); assert.equal(after.occurrencesGenerated, 1);
          }
          foreignInvoiceId = invoiceId;
          const firstRead = await ok(await GET_INVOICE(req(), params(invoiceId)));
          // Quote conversion deliberately uses today's issue date, while direct and
          // scheduled origins retain their supplied date. Settle against saved history.
          const settlementDate = firstRead.invoice.issueDate as string;
          const saved = invoiceUiDocument(firstRead.invoice);
          assert.equal(saved.total, expected); assert.equal(saved.lines![1].amount, expected - 3000000001n);
          assert.equal(saved.lines![1].unitPrice, 1n); assert.equal(saved.lines![1].quantity, 300);
          // Copy/edit uses the saved rounded price, so MCP's original 2-unit line becomes 3.
          const copiedLines = invoiceUiCopyLines(saved.lines!, currencyCode);
          const copied = await ok(await CREATE(req("POST", { ...base, lines: copiedLines })));
          assert.equal(invoiceUiDocument(copied.invoice).total, 3000000004n);
          if (transport === "rest") await ok(await EDIT(req("PATCH", { lines: copiedLines }), params(invoiceId)));
          else await call("update_invoice", { invoiceId, lines: copiedLines });
          await call("send_invoice", { invoiceId });
          const priorDate = new Date(new Date(`${settlementDate}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
          const beforeEarlyPayment = await snapshot();
          const early = { amountMinor: "1", date: priorDate, method: "cash" };
          const earlyResponse = await PAY(req("POST", early), params(invoiceId));
          assert.equal(earlyResponse.status, 400);
          assert.match((await earlyResponse.json()).error, /cannot predate document recognition/);
          await badCall("pay_invoice", { invoiceId, ...early });
          assert.deepEqual(await snapshot(), beforeEarlyPayment);
          const payment = { ...invoiceUiAmount(invoiceUiDecimal(1n, currencyCode), currencyCode), date: settlementDate, method: "cash" };
          if (transport === "rest") await ok(await PAY(req("POST", payment), params(invoiceId)));
          else await call("pay_invoice", { invoiceId, ...payment });
          const prepaidPayload = { contactId: customer.id, currencyCode, date: settlementDate, sourceType: "prepayment", depositAccountId: cash.id,
            ...customerPrepaymentAmount(invoiceUiDecimal(1250n, currencyCode), currencyCode) };
          const prepaid = (transport === "rest" ? await ok(await PREPAYMENT(req("POST", prepaidPayload))) : await call("create_customer_credit", prepaidPayload)).customerCredit;
          if (transport === "rest") await ok(await APPLY_PREPAYMENT(req("POST", { invoiceId, amountMinor: "1", date: settlementDate }), params(prepaid.id)));
          else await call("apply_customer_credit", { customerCreditId: prepaid.id, invoiceId, amountMinor: "1", date: settlementDate });
          const copiedCredit = copiedLines[1];
          const creditPayload = { contactId: customer.id, currencyCode, issueDate: date, lines: [{ description: copiedCredit.description,
            quantity: copiedCredit.quantity, unitPriceExact: copiedCredit.unitPriceExact, accountId: copiedCredit.accountId,
            taxRateId: copiedCredit.taxRateId, discountPercent: copiedCredit.discountPercent, costCenterId: copiedCredit.costCenterId }] };
          const credit = (transport === "rest" ? await ok(await CREDIT(req("POST", creditPayload))) : await call("create_credit_note", creditPayload)).creditNote;
          await call("send_credit_note", { creditNoteId: credit.id });
          const available = creditNoteUiDocument((await call("get_credit_note", { creditNoteId: credit.id })).creditNote as {
            contactId: string; currencyCode: string; total: number; amountRemaining: number;
            lines: (Record<string, unknown> & { quantity: number })[]; [key: string]: unknown });
          assert.equal(available.total, 3n);
          const outstandingWire = (await call("get_invoice", { invoiceId })).invoice;
          assert.equal(outstandingWire.contactId, customer.id); assert.equal(outstandingWire.currencyCode, currencyCode);
          const outstanding = { ...invoiceUiDocument(outstandingWire), id: invoiceId, contactId: customer.id,
            currencyCode, status: outstandingWire.status as string };
          const allocation = creditNoteUiApplication(invoiceUiDecimal(2n, currencyCode), available, outstanding);
          if (transport === "rest") await ok(await APPLY_CREDIT(req("POST", allocation), params(credit.id)));
          else await call("apply_credit_note", { creditNoteId: credit.id, ...allocation });
          const stored = (await db.execute(sql`select i.total::text, i.amount_paid::text, i.amount_due::text,
            c.amount_remaining::text as credit_remaining, p.amount_remaining::text as prepaid_remaining
            from invoice i, credit_note c, customer_credit p where i.id=${invoiceId} and c.id=${credit.id} and p.id=${prepaid.id}`)).rows[0];
          assert.deepEqual(stored, { total: "3000000004", amount_paid: "4", amount_due: "3000000000", credit_remaining: "1", prepaid_remaining: "1249" });
          const rest = await ok(await GET_INVOICE(req(), params(invoiceId)));
          for (const row of [rest.invoice, (await call("get_invoice", { invoiceId })).invoice]) {
            const ui = invoiceUiDocument(row); assert.equal(ui.amountDue, 3000000000n); assert.equal(ui.amountPaid, 4n);
            assert.equal(invoiceUiMoney(ui.total, currencyCode), invoiceUiMoney(3000000004n, currencyCode));
            assert.throws(() => invoiceUiDocument({ ...row, totalMinor: "3000000005" }));
          }
          assert.equal(invoiceUiBase(rest.base).amounts.amountDue, 3000000000n);
          const journal = (await db.execute(sql`select sum(l.debit_amount)::text as debit, sum(l.credit_amount)::text as credit
            from journal_line l join invoice i on i.journal_entry_id=l.journal_entry_id where i.id=${invoiceId}`)).rows[0];
          assert.deepEqual(journal, { debit: "3000000004", credit: "3000000004" });
          const before = await snapshot();
          const malformed = { ...base, lines: [{ description: "Invalid", quantity: 1, unitPriceExact: "1e3", accountId: revenue.id }] };
          assert.equal((await CREATE(req("POST", malformed))).ok, false); await badCall("create_invoice", malformed);
          assert.equal((await PAY(req("POST", { ...payment, amountMinor: "3000000001" }), params(invoiceId))).ok, false);
          await badCall("pay_invoice", { invoiceId, ...payment, amountMinor: "3000000001" });
          assert.equal((await APPLY_PREPAYMENT(req("POST", { invoiceId, amountMinor: "1250", date: settlementDate }), params(prepaid.id))).ok, false);
          await badCall("apply_customer_credit", { customerCreditId: prepaid.id, invoiceId, amountMinor: "1250", date: settlementDate });
          assert.deepEqual(await snapshot(), before);
          if (transport === "rest") await ok(await VOID_CREDIT(req("POST"), params(credit.id)));
          else await call("void_credit_note", { creditNoteId: credit.id });
          const undone = invoiceUiDocument((await call("get_invoice", { invoiceId })).invoice);
          assert.equal(undone.amountPaid, 2n); assert.equal(undone.amountDue, 3000000002n);
          assert.equal(customerPrepaymentRow((await call("get_customer_credit", { customerCreditId: prepaid.id })).customerCredit).amountRemaining, 1249n);
          workflows++;
        }
      }
    } finally { await client.close(); await server.close(); }
  }
  console.log(`Receivable document UI REST MCP SQL verified: ${workflows} workflows`);
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
