// Only runs against the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, bankAccount, exchangeRate } from "../../lib/db/schema";
import { POST as QUOTE, GET as QUOTES } from "../../app/api/v1/quotes/route";
import { GET as QUOTE_GET } from "../../app/api/v1/quotes/[id]/route";
import { POST as CONVERT } from "../../app/api/v1/quotes/[id]/convert/route";
import { GET as INVOICE_GET } from "../../app/api/v1/invoices/[id]/route";
import { POST as INVOICE_SEND } from "../../app/api/v1/invoices/[id]/send/route";
import { POST as CREDIT } from "../../app/api/v1/credit-notes/route";
import { GET as CREDIT_GET } from "../../app/api/v1/credit-notes/[id]/route";
import { POST as CREDIT_APPLY } from "../../app/api/v1/credit-notes/[id]/apply/route";
import { POST as CREDIT_VOID } from "../../app/api/v1/credit-notes/[id]/void/route";
import { POST as RECEIPT, GET as RECEIPTS } from "../../app/api/v1/sales-receipts/route";
import { GET as RECEIPT_GET } from "../../app/api/v1/sales-receipts/[id]/route";
import { POST as RECEIPT_POST } from "../../app/api/v1/sales-receipts/[id]/post/route";
import { POST as RECEIPT_VOID } from "../../app/api/v1/sales-receipts/[id]/void/route";
import { POST as PREPAYMENT, GET as PREPAYMENTS } from "../../app/api/v1/customer-credits/route";
import { GET as PREPAYMENT_GET } from "../../app/api/v1/customer-credits/[id]/route";
import { POST as PREPAYMENT_APPLY } from "../../app/api/v1/customer-credits/[id]/apply/route";
import { registerQuoteTools } from "../../lib/mcp/tools/quotes";
import { registerCreditNoteTools } from "../../lib/mcp/tools/credit-notes";
import { registerSalesReceiptTools } from "../../lib/mcp/tools/sales-receipts";
import { registerCustomerCreditTools } from "../../lib/mcp/tools/customer-credits";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { quoteEditorLines, quoteUiDocument, quoteUiHeader, quoteUiSummary } from "../../lib/money/quote-ui";
import { creditNoteEditorLines, creditNoteUiDocument, creditNoteUiApplication } from "../../lib/money/credit-note-ui";
import { salesReceiptEditorLines, salesReceiptEditorCurrency, salesReceiptUiDocument, salesReceiptUiHeader,
  salesReceiptUiCollected } from "../../lib/money/sales-receipt-ui";
import { customerPrepaymentAmount, customerPrepaymentCurrency, customerPrepaymentRow, customerPrepaymentSummary,
  customerPrepaymentApplication, customerPrepaymentInvoice } from "../../lib/money/customer-prepayment-ui";
import { documentEditorPreview } from "../../lib/money/document-editor";
import { invoiceUiDocument, invoiceUiDecimal, invoiceUiMoney } from "../../lib/money/invoice-ui";

type DocumentWire = { id: string; contactId: string; currencyCode: string; status: string; total: number;
  amountRemaining: number; lines: { description: string; quantity: number; unitPrice: number; amount: number;
    taxAmount: number; [key: string]: unknown }[]; [key: string]: unknown };
type PrepaymentWire = { id: string; contactId: string; currencyCode: string; status: string; [key: string]: unknown };

async function run() {
  const [owner] = await db.insert(users).values({ email: "combined-ui@example.test" }).returning();
  let foreignQuoteId: string | undefined;
  let workflows = 0;
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Combined UI ${currencyCode}`, slug: `combined-ui-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_combined_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_combined" });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer", currencyCode: "KWD" }).returning();
    const [revenue] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode },
      { organizationId: org.id, code: "1200", name: "AR", type: "asset", currencyCode },
    ]).returning();
    const [bank] = await db.insert(bankAccount).values({ organizationId: org.id, accountName: "Cash", accountType: "cash", currencyCode }).returning();
    // Synthetic rate solely for the different-currency prepayment default cases.
    if (currencyCode !== "KWD") await db.insert(exchangeRate).values({ organizationId: org.id,
      baseCurrency: "KWD", targetCurrency: currencyCode, date: "2026-10-11", rate: 1000000,
      rateExact: "1", rateProvenance: "MON-136 synthetic fixture", source: "manual" });
    const server = new McpServer({ name: "Combined receivable UI", version: "1" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    for (const register of [registerQuoteTools, registerCreditNoteTools, registerSalesReceiptTools,
      registerCustomerCreditTools, registerInvoiceTools, registerInvoiceLifecycleTools]) register(server, ctx);
    const client = new Client({ name: "Combined UI fixture", version: "1" });
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
    const req = (method = "GET", body?: unknown) => new Request("http://fixture.test/api/v1/fixture", { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const ok = async (response: Response) => { const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data; };
    const line = (unitPrice: string, quantity = "1") => ({ description: "Work", quantity, unitPrice, accountId: revenue.id, taxRateId: "" });
    const date = "2026-10-11";
    const quoteBase = { contactId: customer.id, issueDate: date, expiryDate: "2099-01-01" };
    const creditBase = { contactId: customer.id, issueDate: date };
    const cashBase = { contactId: customer.id, date, bankAccountId: bank.id };
    const prepaymentBase = { ...cashBase, sourceType: "prepayment" };
    const halfMinor = { USD: "0.005", JPY: "0.5", IRR: "0.5", KWD: "0.0005" }[currencyCode]!;
    const tiny = [line(halfMinor, "3")];
    const quoteLines = [line(invoiceUiDecimal(3000000001n, currencyCode)), ...tiny];
    const quoted = documentEditorPreview(quoteLines, currencyCode, [], true);
    const credited = documentEditorPreview(tiny, currencyCode, [], false);
    assert.equal(quoted.error, null); assert.equal(credited.error, null);
    assert.equal(quoted.total, 3000000004n); assert.equal(credited.total, 2n);
    const snapshot = async () => (await db.execute(sql`select
      (select count(*)::text from quote where organization_id=${org.id}) as quotes,
      (select count(*)::text from credit_note where organization_id=${org.id}) as credits,
      (select count(*)::text from sales_receipt where organization_id=${org.id}) as receipts,
      (select count(*)::text from customer_credit where organization_id=${org.id}) as prepayments,
      (select sum(amount_paid)::text from invoice where organization_id=${org.id}) as paid,
      (select sum(amount_remaining)::text from customer_credit where organization_id=${org.id}) as remaining,
      (select count(*)::text from payment_allocation a join payment p on p.id=a.payment_id where p.organization_id=${org.id}) as allocations,
      (select count(*)::text from journal_entry where organization_id=${org.id}) as journals`)).rows;
    try {
      if (foreignQuoteId) {
        assert.equal((await QUOTE_GET(req(), params(foreignQuoteId))).status, 404);
        await badCall("get_quote", { quoteId: foreignQuoteId });
      }
      for (const transport of ["rest", "mcp"] as const) {
        const quotePayload = { ...quoteBase, currencyCode, lines: quoteEditorLines(quoteLines) };
        const q = (transport === "rest" ? await ok(await QUOTE(req("POST", quotePayload))) : await call("create_quote", quotePayload)).quote as DocumentWire;
        foreignQuoteId = q.id;
        for (const read of [(await ok(await QUOTE_GET(req(), params(q.id)))).quote, (await call("get_quote", { quoteId: q.id })).quote]) {
          const saved = quoteUiDocument(read as DocumentWire);
          assert.equal(saved.total, quoted.total); assert.equal(saved.lines[1].amount, 3n);
          assert.throws(() => quoteUiHeader({ ...read, totalMinor: "3000000005" }));
        }
        await call("send_quote", { quoteId: q.id }); await call("accept_quote", { quoteId: q.id });
        const converted = transport === "rest" ? await ok(await CONVERT(req("POST"), params(q.id))) : await call("convert_quote_to_invoice", { quoteId: q.id });
        const invoiceId = converted.invoice.id as string;
        const convertedQuote = quoteUiDocument((await call("get_quote", { quoteId: q.id })).quote as DocumentWire);
        assert.equal(convertedQuote.billedTotal, quoted.total); assert.equal(convertedQuote.status, "converted");
        if (transport === "rest") await ok(await INVOICE_SEND(req("POST"), params(invoiceId)));
        else await call("send_invoice", { invoiceId });
        const invoice = customerPrepaymentInvoice((await ok(await INVOICE_GET(req(), params(invoiceId)))).invoice as DocumentWire);
        assert.equal(invoice.amountDue, quoted.total); assert.equal(invoice.currencyCode, currencyCode);

        const creditPayload = { ...creditBase, currencyCode, lines: creditNoteEditorLines(tiny) };
        const c = (transport === "rest" ? await ok(await CREDIT(req("POST", creditPayload))) : await call("create_credit_note", creditPayload)).creditNote as DocumentWire;
        await call("send_credit_note", { creditNoteId: c.id });
        const credit = creditNoteUiDocument((await ok(await CREDIT_GET(req(), params(c.id)))).creditNote as DocumentWire);
        assert.equal(credit.total, credited.total); assert.equal(credit.amountRemaining, 2n); assert.equal(credit.lines[0].amount, 2n);
        assert.throws(() => creditNoteUiApplication(invoiceUiDecimal(1n, currencyCode), credit, { ...invoice, currencyCode: currencyCode === "USD" ? "KWD" : "USD" }));
        const creditApply = creditNoteUiApplication(invoiceUiDecimal(2n, currencyCode), credit, invoice);
        if (transport === "rest") await ok(await CREDIT_APPLY(req("POST", creditApply), params(c.id)));
        else await call("apply_credit_note", { creditNoteId: c.id, ...creditApply });

        const prepaymentPayload = { ...prepaymentBase, currencyCode, ...customerPrepaymentAmount(invoiceUiDecimal(1250n, currencyCode), currencyCode) };
        const p = (transport === "rest" ? await ok(await PREPAYMENT(req("POST", prepaymentPayload))) : await call("create_customer_credit", prepaymentPayload)).customerCredit as PrepaymentWire;
        const prepayment = customerPrepaymentRow((await ok(await PREPAYMENT_GET(req(), params(p.id)))).customerCredit as PrepaymentWire);
        assert.equal(prepayment.originalAmount, 1250n);
        const remainingInvoice = customerPrepaymentInvoice((await call("get_invoice", { invoiceId })).invoice as DocumentWire);
        assert.equal(remainingInvoice.amountDue, quoted.total - 2n);
        const prepaymentApply = customerPrepaymentApplication(invoiceUiDecimal(1n, currencyCode), prepayment, remainingInvoice);
        if (transport === "rest") await ok(await PREPAYMENT_APPLY(req("POST", prepaymentApply), params(p.id)));
        else await call("apply_customer_credit", { customerCreditId: p.id, ...prepaymentApply, date });
        const stored = (await db.execute(sql`select i.total::text, i.amount_paid::text, i.amount_due::text,
          c.amount_applied::text, c.amount_remaining::text as credit_remaining, p.original_amount::text,
          p.amount_remaining::text as prepayment_remaining from invoice i, credit_note c, customer_credit p
          where i.id=${invoiceId} and c.id=${c.id} and p.id=${p.id}`)).rows[0];
        assert.deepEqual(stored, { total: "3000000004", amount_paid: "3", amount_due: "3000000001", amount_applied: "2",
          credit_remaining: "0", original_amount: "1250", prepayment_remaining: "1249" });
        for (const read of [(await ok(await INVOICE_GET(req(), params(invoiceId)))).invoice, (await call("get_invoice", { invoiceId })).invoice]) {
          const saved = invoiceUiDocument(read as DocumentWire);
          assert.equal(saved.total, quoted.total); assert.equal(saved.amountDue, 3000000001n); assert.equal(saved.amountPaid, 3n);
        }

        const receiptPayload = { ...cashBase, currencyCode, lines: salesReceiptEditorLines(tiny) };
        const r = (transport === "rest" ? await ok(await RECEIPT(req("POST", receiptPayload))) : await call("create_sales_receipt", receiptPayload)).salesReceipt as DocumentWire;
        if (transport === "rest") await ok(await RECEIPT_POST(req("POST"), params(r.id)));
        else await call("post_sales_receipt", { salesReceiptId: r.id });
        const receipt = salesReceiptUiDocument((await ok(await RECEIPT_GET(req(), params(r.id)))).salesReceipt as DocumentWire);
        assert.equal(receipt.total, 2n); assert.equal(receipt.lines[0].amount, 2n);
        assert.equal(salesReceiptUiCollected([receipt]), invoiceUiMoney(2n, currencyCode));
        const rawLines = (await db.execute(sql`select q.total::text as quote_total, q.currency_code,
          ql.unit_price::text as quote_price, ql.amount::text as quote_amount, ql.quantity,
          cl.amount::text as credit_amount, rl.amount::text as receipt_amount
          from quote q join quote_line ql on ql.quote_id=q.id,
          credit_note_line cl, sales_receipt_line rl
          where q.id=${q.id} and ql.quantity=300 and cl.credit_note_id=${c.id} and rl.sales_receipt_id=${r.id}`)).rows[0];
        assert.deepEqual(rawLines, { quote_total: "3000000004", currency_code: currencyCode, quote_price: "1",
          quote_amount: "3", quantity: 300, credit_amount: "2", receipt_amount: "2" });
        const linkedCredit = creditNoteUiDocument((await call("get_credit_note", { creditNoteId: c.id })).creditNote as DocumentWire);
        assert.equal(linkedCredit.amountApplied, 2n); assert.equal(linkedCredit.amountRemaining, 0n);
        const linkedReceipt = salesReceiptUiDocument((await call("get_sales_receipt", { salesReceiptId: r.id })).salesReceipt as DocumentWire);
        assert.equal(linkedReceipt.total, receipt.total); assert.equal(linkedReceipt.status, "paid");
        const linkedPrepayment = customerPrepaymentRow((await call("get_customer_credit", { customerCreditId: p.id })).customerCredit as PrepaymentWire);
        assert.equal(linkedPrepayment.amountRemaining, 1249n);
        const recognition = (await db.execute(sql`select sum(l.debit_amount)::text as debit, sum(l.credit_amount)::text as credit
          from journal_line l join sales_receipt r on r.journal_entry_id=l.journal_entry_id where r.id=${r.id}`)).rows[0];
        assert.deepEqual(recognition, { debit: "2", credit: "2" });

        // Invalid writes/applications must leave all four domains and invoice settlement unchanged.
        const before = await snapshot();
        const invalidLine = [{ description: "Invalid", quantity: 1, unitPriceExact: "1e3", accountId: revenue.id }];
        for (const [post, name, base] of [[QUOTE, "create_quote", quoteBase], [CREDIT, "create_credit_note", creditBase],
          [RECEIPT, "create_sales_receipt", cashBase]] as const) {
          assert.equal((await post(req("POST", { ...base, currencyCode, lines: invalidLine }))).ok, false);
          await badCall(name, { ...base, currencyCode, lines: invalidLine });
        }
        assert.equal((await PREPAYMENT(req("POST", { ...prepaymentBase, currencyCode, amountMinor: "9007199254740992" }))).ok, false);
        await badCall("create_customer_credit", { ...prepaymentBase, currencyCode, amountMinor: "9007199254740992" });
        assert.equal((await PREPAYMENT_APPLY(req("POST", { invoiceId, amountMinor: "1250" }), params(p.id))).ok, false);
        await badCall("apply_customer_credit", { customerCreditId: p.id, invoiceId, amountMinor: "1250", date });
        assert.deepEqual(await snapshot(), before);

        if (transport === "rest") { await ok(await CREDIT_VOID(req("POST"), params(c.id))); await ok(await RECEIPT_VOID(req("POST"), params(r.id))); }
        else { await call("void_credit_note", { creditNoteId: c.id }); await call("void_sales_receipt", { salesReceiptId: r.id }); }
        const undone = invoiceUiDocument((await call("get_invoice", { invoiceId })).invoice as DocumentWire);
        assert.equal(undone.amountPaid, 1n); assert.equal(undone.amountDue, quoted.total - 1n);
        const kept = customerPrepaymentRow((await call("get_customer_credit", { customerCreditId: p.id })).customerCredit as PrepaymentWire);
        assert.equal(kept.amountRemaining, 1249n);
        const voidReceipt = salesReceiptUiDocument((await call("get_sales_receipt", { salesReceiptId: r.id })).salesReceipt as DocumentWire);
        assert.equal(salesReceiptUiCollected([voidReceipt]), "—");
        assert.equal((await db.execute(sql`select amount_due::text from invoice where id=${invoiceId}`)).rows[0].amount_due, "3000000003");
        assert.throws(() => customerPrepaymentRow({ ...p, amountRemainingMinor: "01250" }));
        assert.throws(() => salesReceiptUiHeader({ ...r, totalMinor: "3" }));
        assert.throws(() => creditNoteUiDocument({ ...c, totalMinor: "3" }));
        workflows++;
      }

      const quotes = (await ok(await QUOTES(req()))).data.map((row: DocumentWire) => quoteUiHeader(row));
      assert.equal(quoteUiSummary(quotes, "converted"), invoiceUiMoney(6000000008n, currencyCode));
      const receipts = (await ok(await RECEIPTS(req()))).data.map((row: DocumentWire) => salesReceiptUiHeader(row));
      assert.equal(salesReceiptUiCollected(receipts), "—");
      const prepays = (await ok(await PREPAYMENTS(req()))).data.map((row: PrepaymentWire) => customerPrepaymentRow(row));
      assert.deepEqual(customerPrepaymentSummary(prepays), { received: invoiceUiMoney(2500n, currencyCode), remaining: invoiceUiMoney(2498n, currencyCode) });

      // The four domains retain different defaults even in the same organization/customer context.
      for (const customerCurrency of ["KWD", null]) {
        await db.update(contact).set({ currencyCode: customerCurrency }).where(eq(contact.id, customer.id));
        const resolved = salesReceiptEditorCurrency(null, customerCurrency, org.defaultCurrency);
        assert.equal(customerPrepaymentCurrency(null, customerCurrency, org.defaultCurrency), resolved);
        const [defaultBank] = await db.insert(bankAccount).values({ organizationId: org.id, accountName: `Default ${resolved}`, accountType: "cash", currencyCode: resolved }).returning();
        for (const transport of ["rest", "mcp"] as const) {
          const quotePayload = { ...quoteBase, lines: quoteEditorLines([line("1")]) };
          const creditPayload = { ...creditBase, lines: creditNoteEditorLines([line("1")]) };
          const receiptPayload = { ...cashBase, bankAccountId: defaultBank.id, lines: salesReceiptEditorLines([line("1")]) };
          const prepaymentPayload = { ...prepaymentBase, bankAccountId: defaultBank.id, amountMinor: "1250" };
          const q = (transport === "rest" ? await ok(await QUOTE(req("POST", quotePayload))) : await call("create_quote", quotePayload)).quote;
          const c = (transport === "rest" ? await ok(await CREDIT(req("POST", creditPayload))) : await call("create_credit_note", creditPayload)).creditNote;
          const r = (transport === "rest" ? await ok(await RECEIPT(req("POST", receiptPayload))) : await call("create_sales_receipt", receiptPayload)).salesReceipt;
          const p = (transport === "rest" ? await ok(await PREPAYMENT(req("POST", prepaymentPayload))) : await call("create_customer_credit", prepaymentPayload)).customerCredit;
          assert.equal(q.currencyCode, "USD"); assert.equal(c.currencyCode, "USD");
          assert.equal(r.currencyCode, resolved); assert.equal(p.currencyCode, resolved); assert.equal(p.originalAmountMinor, "1250");
        }
      }
      // List summaries follow saved tags even when defaults introduced a second currency.
      const mixed = (await ok(await PREPAYMENTS(req()))).data.map((row: PrepaymentWire) => customerPrepaymentRow(row));
      const grouped = (await db.execute(sql`select currency_code, sum(original_amount)::text as received,
        sum(amount_remaining)::text as remaining from customer_credit where organization_id=${org.id}
        and status<>'void' group by currency_code order by currency_code`)).rows;
      assert.deepEqual(customerPrepaymentSummary(mixed), {
        received: grouped.map(row => invoiceUiMoney(BigInt(row.received as string), row.currency_code as string)).join(" · "),
        remaining: grouped.map(row => invoiceUiMoney(BigInt(row.remaining as string), row.currency_code as string)).join(" · "),
      });
    } finally { await client.close(); await server.close(); }
  }
  console.log(`Combined receivable UI REST MCP SQL verified: ${workflows} workflows`);
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
