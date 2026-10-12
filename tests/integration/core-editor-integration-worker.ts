// Runs only in the wrapper's randomly named, migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount } from "../../lib/db/schema";
import { POST as QUOTE } from "../../app/api/v1/quotes/route";
import { POST as CONVERT } from "../../app/api/v1/quotes/[id]/convert/route";
import { GET as INVOICE } from "../../app/api/v1/invoices/[id]/route";
import { POST as SEND } from "../../app/api/v1/invoices/[id]/send/route";
import { POST as BILL } from "../../app/api/v1/bills/route";
import { GET as BILL_GET } from "../../app/api/v1/bills/[id]/route";
import { POST as RECEIVE } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as BANK } from "../../app/api/v1/bank-accounts/route";
import { POST as IMPORT } from "../../app/api/v1/bank-accounts/[id]/transactions/import/route";
import { GET as MOVEMENTS } from "../../app/api/v1/bank-accounts/[id]/transactions/route";
import { POST as MATCH } from "../../app/api/v1/bank-transactions/[id]/match/route";
import { GET as PAYMENT } from "../../app/api/v1/payments/[id]/route";
import { POST as CREATE_ENTRY, GET as ENTRIES } from "../../app/api/v1/entries/route";
import { POST as POST_ENTRY } from "../../app/api/v1/entries/[id]/post/route";
import { GET as ENTRY } from "../../app/api/v1/entries/[id]/route";
import { GET as ACCOUNT } from "../../app/api/v1/accounts/[id]/route";
import { registerQuoteTools } from "../../lib/mcp/tools/quotes";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { registerBankAccountTools } from "../../lib/mcp/tools/bank-accounts";
import { registerBankImportTools } from "../../lib/mcp/tools/bank-imports";
import { registerBankDocumentMatchTools } from "../../lib/mcp/tools/bank-document-matches";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import { registerAccountTools } from "../../lib/mcp/tools/accounts";
import { documentEditorPreview } from "../../lib/money/document-editor";
import { quoteEditorLines, quoteUiDocument } from "../../lib/money/quote-ui";
import { invoiceUiDecimal, invoiceUiDocument } from "../../lib/money/invoice-ui";
import { billEditorPreview, billLineInputs } from "../../lib/money/bill-editor";
import { billUiDocument } from "../../lib/money/bill-ui";
import { bankUiPreview, bankUiTransaction, bankUiMatchAmount } from "../../lib/money/bank-ui";
import { paymentUiRow } from "../../lib/money/payment-ui";
import { journalEditorPreview, journalRestMinor, journalMoney } from "../../lib/money/journal-display";
import { coreAccountMoney, coreStoredMinor, coreJournalSummary, coreJournalDetail, coreDebitDisplay } from "../../lib/money/core-presentation";

type InvoiceWire = Parameters<typeof invoiceUiDocument>[0];
type BillWire = Parameters<typeof billUiDocument>[0];
type Summary = Parameters<typeof coreJournalSummary>[0] & { id: string };
type Detail = Parameters<typeof coreJournalDetail>[0] & { id: string };

async function run() {
  const [owner] = await db.insert(users).values({ email: "core-editors@example.test" }).returning();
  const date = new Date().toISOString().slice(0, 10);
  let foreignBill: string | undefined, foreignInvoice: string | undefined;
  let workflows = 0;
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"] as const) for (const transport of ["rest", "mcp"] as const) {
    const label = `${currencyCode}-${transport}`;
    const [org] = await db.insert(organization).values({ name: `Core editors ${label}`, slug: `core-editors-${label}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_core_editors_${label}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_core", keyHash: createHash("sha256").update(key).digest("hex") });
    const [customer, supplier] = await db.insert(contact).values([
      { name: "Buyer", type: "customer" as const }, { name: "Seller", type: "supplier" as const },
    ].map(row => ({ ...row, organizationId: org.id, currencyCode }))).returning();
    const [income, cost, equity] = await db.insert(chartAccount).values([
      { code: "4000", name: "Income", type: "revenue" as const }, { code: "5900", name: "Cost", type: "expense" as const },
      { code: "3100", name: "Equity", type: "equity" as const }, { code: "1200", name: "AR", type: "asset" as const },
      { code: "2100", name: "AP", type: "liability" as const },
    ].map(row => ({ ...row, organizationId: org.id, currencyCode }))).returning();
    const server = new McpServer({ name: "Combined core editors", version: "1" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    for (const register of [registerQuoteTools, registerInvoiceTools, registerInvoiceLifecycleTools, registerBillTools,
      registerBankAccountTools, registerBankImportTools, registerBankDocumentMatchTools, registerPaymentTools,
      registerEntryTools, registerAccountTools]) register(server, ctx);
    const client = new Client({ name: "Core editor fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, `${label} ${name}: ${JSON.stringify(result.content)}`);
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const badCall = async (name: string, args: Record<string, unknown>) => {
      assert.equal((await client.callTool({ name, arguments: args })).isError, true, `${label} ${name} must reject`);
    };
    const req = (body?: unknown) => new Request("http://fixture.test/api/v1/fixture?limit=100", {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const ok = async (response: Response) => { const body = await response.json(); assert.ok(response.ok, `${label}: ${JSON.stringify(body)}`); return body; };
    const snapshot = async () => (await db.execute(sql`select
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from invoice t where organization_id=${org.id}) as invoices,
      (select jsonb_agg(to_jsonb(l)::text order by l.id) from invoice_line l join invoice d on d.id=l.invoice_id where d.organization_id=${org.id}) as invoice_lines,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from bill t where organization_id=${org.id}) as bills,
      (select jsonb_agg(to_jsonb(l)::text order by l.id) from bill_line l join bill d on d.id=l.bill_id where d.organization_id=${org.id}) as bill_lines,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from quote t where organization_id=${org.id}) as quotes,
      (select jsonb_agg(to_jsonb(l)::text order by l.id) from quote_line l join quote d on d.id=l.quote_id where d.organization_id=${org.id}) as quote_lines,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from chart_account t where organization_id=${org.id}) as accounts,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from bank_account t where organization_id=${org.id}) as banks,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from journal_entry t where organization_id=${org.id}) as entries,
      (select jsonb_agg(to_jsonb(l)::text order by l.id) from journal_line l join journal_entry j on j.id=l.journal_entry_id where j.organization_id=${org.id}) as legs,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from payment t where organization_id=${org.id}) as payments,
      (select jsonb_agg(to_jsonb(a)::text order by a.id) from payment_allocation a join payment p on p.id=a.payment_id where p.organization_id=${org.id}) as allocations,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from bank_transaction t join bank_account b on b.id=t.bank_account_id where b.organization_id=${org.id}) as movements`)).rows;
    try {
      const beforeForeign = await snapshot();
      if (foreignBill && foreignInvoice) {
        assert.equal((await BILL_GET(req(), params(foreignBill))).status, 404);
        assert.equal((await INVOICE(req(), params(foreignInvoice))).status, 404);
        await badCall("get_bill", { billId: foreignBill }); await badCall("get_invoice", { invoiceId: foreignInvoice });
        await badCall("pay_bill", { billId: foreignBill, amountMinor: "1", date });
        await badCall("pay_invoice", { invoiceId: foreignInvoice, amountMinor: "1", date });
      }
      assert.deepEqual(await snapshot(), beforeForeign);
      const half = { USD: "0.005", JPY: "0.5", IRR: "0.5", KWD: "0.0005" }[currencyCode];
      const lines = (accountId: string) => [
        { description: "Low digits", quantity: "1", unitPrice: invoiceUiDecimal(3000000001n, currencyCode), accountId, taxRateId: "" },
        { description: "Sub-minor tie", quantity: "3", unitPrice: half, accountId, taxRateId: "" },
      ];
      // Quote price-first and bill extended-price rounding must remain different.
      const salePreview = documentEditorPreview(lines(income.id), currencyCode, [], true);
      const costPreview = billEditorPreview(lines(cost.id), currencyCode, []);
      assert.equal(salePreview.error, null); assert.equal(costPreview.error, null);
      assert.equal(salePreview.total, 3000000004n); assert.equal(costPreview.total, 3000000003n);
      const quoteInput = { contactId: customer.id, currencyCode, issueDate: date, expiryDate: "2099-01-01", lines: quoteEditorLines(lines(income.id)) };
      const quoted = (transport === "rest" ? await ok(await QUOTE(req(quoteInput))) : await call("create_quote", quoteInput)).quote;
      assert.equal(quoteUiDocument((await call("get_quote", { quoteId: quoted.id })).quote).total, salePreview.total);
      await call("send_quote", { quoteId: quoted.id }); await call("accept_quote", { quoteId: quoted.id });
      const sale = (transport === "rest" ? await ok(await CONVERT(req({}), params(quoted.id))) : await call("convert_quote_to_invoice", { quoteId: quoted.id })).invoice;
      if (transport === "rest") await ok(await SEND(req({}), params(sale.id))); else await call("send_invoice", { invoiceId: sale.id });
      const billInput = { contactId: supplier.id, currencyCode, issueDate: date, dueDate: date, lines: billLineInputs(lines(cost.id)) };
      const bought = (transport === "rest" ? await ok(await BILL(req(billInput))) : await call("create_bill", billInput)).bill;
      if (transport === "rest") await ok(await RECEIVE(req({}), params(bought.id))); else await call("receive_bill", { billId: bought.id });
      const bank = (transport === "rest" ? await ok(await BANK(req({ accountName: "Core cash", currencyCode }))) : await call("create_bank_account", { accountName: "Core cash", currencyCode })).bankAccount;
      const bankGl = (await db.execute(sql`select chart_account_id as id from bank_account where id=${bank.id}`)).rows[0].id as string;
      const content = `date,description,amount\n${date},Buyer cash,${invoiceUiDecimal(salePreview.total, currencyCode)}\n${date},Supplier cash,-${invoiceUiDecimal(costPreview.total, currencyCode)}`;
      const preview = bankUiPreview((await ok(await IMPORT(req({ mode: "preview", format: "csv", content }), params(bank.id)))).preview, currencyCode);
      assert.deepEqual(preview.transactions.map(row => row.amount), [salePreview.total, -costPreview.total]);
      if (transport === "rest") await ok(await IMPORT(req({ mode: "commit", format: "csv", content }), params(bank.id)));
      else await call("import_bank_statement", { bankAccountId: bank.id, format: "csv", content });
      const movements = (await ok(await MOVEMENTS(req(), params(bank.id)))).data;
      for (const [kind, document, due] of [["invoice", sale, salePreview.total], ["bill", bought, costPreview.total]] as const) {
        const movement = movements.find((row: { description: string }) => row.description === (kind === "invoice" ? "Buyer cash" : "Supplier cash"));
        assert.ok(movement);
        const savedMovement = bankUiTransaction(movement, currencyCode);
        const input = { [kind === "invoice" ? "invoiceId" : "billId"]: document.id,
          ...bankUiMatchAmount(invoiceUiDecimal(due, currencyCode), currencyCode, savedMovement, { currencyCode, amountDue: due }) };
        const beforeMatch = await snapshot();
        assert.equal((await MATCH(req({ ...input, amountMinor: String(due + 1n) }), params(movement.id))).ok, false);
        await badCall(`match_to_${kind}`, { transactionId: movement.id, ...input, amountMinor: String(due + 1n) });
        assert.deepEqual(await snapshot(), beforeMatch);
        const matched = transport === "rest" ? await ok(await MATCH(req(input), params(movement.id))) : await call(`match_to_${kind}`, { transactionId: movement.id, ...input });
        for (const raw of [(await ok(await PAYMENT(req(), params(matched.payment.id)))).payment, (await call("get_payment", { paymentId: matched.payment.id })).payment]) {
          const payment = paymentUiRow(raw);
          assert.equal(payment.amount, due); assert.equal(payment.allocated, due); assert.equal(payment.unallocated, 0n);
        }
      }
      for (const raw of [(await ok(await INVOICE(req(), params(sale.id)))).invoice, (await call("get_invoice", { invoiceId: sale.id })).invoice]) {
        const saved = invoiceUiDocument(raw as InvoiceWire);
        assert.equal(saved.total, salePreview.total); assert.equal(saved.amountDue, 0n);
        assert.equal(saved.lines![1].unitPrice, 1n); assert.equal(saved.lines![1].amount, 3n); assert.equal(saved.lines![1].quantity, 300);
        assert.throws(() => invoiceUiDocument({ ...raw, totalMinor: "3000000005" } as InvoiceWire));
      }
      for (const raw of [(await ok(await BILL_GET(req(), params(bought.id)))).bill, (await call("get_bill", { billId: bought.id })).bill]) {
        const saved = billUiDocument(raw as BillWire);
        assert.equal(saved.total, costPreview.total); assert.equal(saved.amountDue, 0n);
        assert.equal(saved.lines![1].unitPrice, 1n); assert.equal(saved.lines![1].amount, 2n); assert.equal(saved.lines![1].quantity, 300);
        assert.throws(() => billUiDocument({ ...raw, amountPaidMinor: "3000000004" } as BillWire));
      }
      const manual = journalEditorPreview([
        { accountId: bankGl, description: "Cash adjustment", debit: invoiceUiDecimal(7n, currencyCode), credit: "", currencyCode },
        { accountId: equity.id, description: "Equity adjustment", debit: "", credit: invoiceUiDecimal(7n, currencyCode), currencyCode },
      ]);
      assert.equal(manual.isBalanced, true); assert.equal(manual.totalDebit, 7n);
      const entryInput = { date, description: "Core exact adjustment", lines: manual.lines };
      const entry = (transport === "rest" ? await ok(await CREATE_ENTRY(req(entryInput))) : await call("create_entry", entryInput)).entry;
      if (transport === "rest") await ok(await POST_ENTRY(req({}), params(entry.id))); else await call("post_entry", { entryId: entry.id });
      const beforeReads = await snapshot();
      // SQL text is the oracle, independent of the UI preview and wire calculators.
      const rawCash = (await db.execute(sql`select sum(l.debit_amount-l.credit_amount)::text as net from journal_line l
        join journal_entry j on j.id=l.journal_entry_id where l.account_id=${bankGl} and j.status='posted' and j.deleted_at is null`)).rows[0].net;
      assert.equal(rawCash, "8");
      const settled = (await db.execute(sql`select 'invoice' as kind, total::text, amount_paid::text as paid, amount_due::text as due
        from invoice where id=${sale.id} union all select 'bill', total::text, amount_paid::text, amount_due::text
        from bill where id=${bought.id} order by kind`)).rows;
      assert.deepEqual(settled, [{ kind: "bill", total: "3000000003", paid: "3000000003", due: "0" },
        { kind: "invoice", total: "3000000004", paid: "3000000004", due: "0" }]);
      for (const raw of [(await ok(await ACCOUNT(req(), params(bankGl)))).account, (await call("get_account", { accountId: bankGl })).account]) {
        const account = coreAccountMoney(raw); assert.equal(account.amountCurrencyCode, currencyCode);
        assert.equal(coreStoredMinor(account.balance, account.balanceMinor), 8n);
        assert.equal(journalMoney(8n, currencyCode), journalMoney(coreStoredMinor(account.balance, account.balanceMinor), currencyCode));
      }
      const entries = (await ok(await ENTRIES(req()))).entries.map((row: Summary) => coreJournalSummary(row));
      assert.equal(entries.length, 5); // Recognition and settlement for each side, plus manual GL.
      for (const summary of entries) {
        const detail = coreJournalDetail((await ok(await ENTRY(req(), params(summary.id)))).entry as Detail);
        const linked = (await call("get_entry", { entryId: summary.id })).entry;
        const stored = (await db.execute(sql`select sum(debit_amount)::text as debit, sum(credit_amount)::text as credit
          from journal_line where journal_entry_id=${summary.id}`)).rows[0];
        assert.equal(stored.debit, stored.credit); assert.equal(stored.debit, summary.totalDebitMinor);
        for (const line of detail.lines) {
          assert.equal(line.amountCurrencyCode, currencyCode);
          const other = linked.lines.find((row: { id: string }) => row.id === (line as typeof line & { id: string }).id);
          assert.ok(other); assert.equal(other.amountCurrencyCode, currencyCode);
          assert.equal(journalRestMinor(line.debitAmount, line.debitAmountMinor), coreStoredMinor(other.debitAmount, other.debitAmountMinor));
          assert.equal(journalRestMinor(line.creditAmount, line.creditAmountMinor), coreStoredMinor(other.creditAmount, other.creditAmountMinor));
        }
      }
      assert.equal(coreDebitDisplay(entries), journalMoney(12000000021n, currencyCode));
      const storedLines = (await db.execute(sql`select 'invoice' as kind, l.amount::text, l.unit_price::text as price, l.quantity
        from invoice_line l where invoice_id=${sale.id} and description='Sub-minor tie'
        union all select 'bill', l.amount::text, l.unit_price::text, l.quantity from bill_line l
        where bill_id=${bought.id} and description='Sub-minor tie' order by kind`)).rows;
      assert.deepEqual(storedLines, [{ kind: "bill", amount: "2", price: "1", quantity: 300 }, { kind: "invoice", amount: "3", price: "1", quantity: 300 }]);
      assert.deepEqual(await snapshot(), beforeReads);
      const beforeBad = await snapshot();
      for (const unitPriceExact of ["1e3", "9007199254740992"]) {
        const invalid = { ...billInput, lines: [{ description: "Invalid", unitPriceExact, accountId: cost.id }] };
        assert.equal((await BILL(req(invalid))).ok, false); await badCall("create_bill", invalid);
      }
      const conflict = { ...quoteInput, lines: [{ description: "Conflict", unitPrice: 1, unitPriceMinor: "2", accountId: income.id }] };
      assert.equal((await QUOTE(req(conflict))).ok, false); await badCall("create_quote", conflict);
      assert.deepEqual(await snapshot(), beforeBad);
      foreignInvoice = sale.id; foreignBill = bought.id; workflows++;
    } finally { await client.close(); await server.close(); }
  }
  console.log(`Combined core editors REST MCP SQL verified: ${workflows} workflows`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$client.end());
