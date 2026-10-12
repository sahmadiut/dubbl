// Runs only against the wrapper's randomly named, migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, chartAccount, contact, taxRate } from "../../lib/db/schema";
import { POST as OPENING, GET as OPENING_GET } from "../../app/api/v1/opening-balances/route";
import { POST as INVOICE } from "../../app/api/v1/invoices/route";
import { POST as SEND } from "../../app/api/v1/invoices/[id]/send/route";
import { GET as INVOICE_GET } from "../../app/api/v1/invoices/[id]/route";
import { POST as RATE } from "../../app/api/v1/exchange-rates/route";
import { POST as BANK } from "../../app/api/v1/bank-accounts/route";
import { POST as IMPORT } from "../../app/api/v1/bank-accounts/[id]/transactions/import/route";
import { GET as MOVEMENTS } from "../../app/api/v1/bank-accounts/[id]/transactions/route";
import { POST as MATCH } from "../../app/api/v1/bank-transactions/[id]/match/route";
import { GET as PROOF } from "../../app/api/v1/bank-accounts/[id]/reconciliation/route";
import { POST as SESSION } from "../../app/api/v1/bank-accounts/[id]/reconciliations/route";
import { GET as PAYMENT } from "../../app/api/v1/payments/[id]/route";
import { POST as EXPENSE } from "../../app/api/v1/expenses/route";
import { GET as EXPENSE_GET } from "../../app/api/v1/expenses/[id]/route";
import { POST as SUBMIT } from "../../app/api/v1/expenses/[id]/submit/route";
import { POST as APPROVE } from "../../app/api/v1/expenses/[id]/approve/route";
import { POST as PAY } from "../../app/api/v1/expenses/[id]/pay/route";
import { POST as PERIOD } from "../../app/api/v1/tax-periods/route";
import { GET as PERIOD_GET } from "../../app/api/v1/tax-periods/[id]/route";
import { POST as FILE } from "../../app/api/v1/tax-periods/[id]/file/route";
import { GET as ACCOUNT } from "../../app/api/v1/accounts/[id]/route";
import { GET as ENTRIES } from "../../app/api/v1/entries/route";
import { GET as ENTRY } from "../../app/api/v1/entries/[id]/route";
import { registerOpeningBalanceTools } from "../../lib/mcp/tools/opening-balances";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { registerBankAccountTools } from "../../lib/mcp/tools/bank-accounts";
import { registerBankImportTools } from "../../lib/mcp/tools/bank-imports";
import { registerBankDocumentMatchTools } from "../../lib/mcp/tools/bank-document-matches";
import { registerBankReconciliationTools } from "../../lib/mcp/tools/bank-reconciliations";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { registerExpenseCrudTools } from "../../lib/mcp/tools/expense-crud";
import { registerExpenseTools } from "../../lib/mcp/tools/expenses";
import { registerTaxPeriodTools } from "../../lib/mcp/tools/tax-periods";
import { registerTaxTools } from "../../lib/mcp/tools/tax";
import { registerAccountTools } from "../../lib/mcp/tools/accounts";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import { registerCurrencyTools } from "../../lib/mcp/tools/currencies";
import { openingBalancePreview, openingBalanceSaved } from "../../lib/money/opening-balance-ui";
import { bankUiDecimal, bankUiPreview, bankUiTransaction, bankUiMatchAmount, bankUiReport } from "../../lib/money/bank-ui";
import { paymentUiAmount, paymentUiRow } from "../../lib/money/payment-ui";
import { expenseEditorItems, expenseEditorPreview, expenseUiDocument, expenseUiMinor } from "../../lib/money/expense-ui";
import { taxUiRows, taxUiSettlement, taxUiMinor, taxUiRateInput } from "../../lib/money/tax-ui";
import { invoiceUiBase, invoiceUiDocument } from "../../lib/money/invoice-ui";
import { coreAccountMoney, coreLedgerMoney, coreJournalDetail, coreJournalSummary, coreDebitDisplay, coreStoredMinor } from "../../lib/money/core-presentation";
import { journalRestMinor, journalMoney } from "../../lib/money/journal-display";

type ExpenseWire = Parameters<typeof expenseUiDocument>[0] & { id: string; totalAmountMinor: string };
type PaymentWire = Parameters<typeof paymentUiRow>[0];
type Detail = Parameters<typeof coreJournalDetail>[0];
type Summary = Parameters<typeof coreJournalSummary>[0] & { id: string };

async function run() {
  const date = new Date().toISOString().slice(0, 10);
  const [owner] = await db.insert(users).values({ email: "combined-core@example.test" }).returning();
  let foreignAccount: string | undefined, foreignEntry: string | undefined;
  let workflows = 0;
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) for (const transport of ["rest", "mcp"] as const) {
    const label = `${currencyCode}-${transport}`;
    const [org] = await db.insert(organization).values({ name: `Core UI ${label}`, slug: `combined-core-${label}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_combined_core_${label}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_core", keyHash: createHash("sha256").update(key).digest("hex") });
    const [income, cost, openingAsset, equity] = await db.insert(chartAccount).values([
      { code: "4000", name: "Income", type: "revenue" as const }, { code: "5900", name: "Cost", type: "expense" as const },
      { code: "1900", name: "Opening asset", type: "asset" as const }, { code: "3100", name: "Opening equity", type: "equity" as const },
      { code: "1200", name: "Receivables", type: "asset" as const }, { code: "2200", name: "Output VAT", type: "liability" as const },
    ].map(row => ({ ...row, organizationId: org.id, currencyCode }))).returning();
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Buyer", type: "customer", currencyCode }).returning();
    const [rate] = await db.insert(taxRate).values({ organizationId: org.id, name: "Fixture 10 percent", rate: 1000, type: "sales" }).returning();
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    const server = new McpServer({ name: "Combined core UI", version: "1" });
    for (const register of [registerOpeningBalanceTools, registerInvoiceTools, registerInvoiceLifecycleTools,
      registerBankAccountTools, registerBankImportTools, registerBankDocumentMatchTools, registerBankReconciliationTools,
      registerPaymentTools, registerExpenseCrudTools, registerExpenseTools, registerTaxPeriodTools, registerTaxTools,
      registerAccountTools, registerEntryTools, registerCurrencyTools]) register(server, ctx);
    const client = new Client({ name: "Core UI fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, `${label} ${name}: ${JSON.stringify(result.content)}`);
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const badCall = async (name: string, args: Record<string, unknown>) => {
      assert.equal((await client.callTool({ name, arguments: args })).isError, true, `${label} ${name} must reject`);
    };
    const req = (body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/fixture${query}`, {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const ok = async (response: Response) => { const body = await response.json(); assert.ok(response.ok, `${label}: ${JSON.stringify(body)}`); return body; };
    const snapshot = async () => (await db.execute(sql`select
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from journal_entry t where organization_id=${org.id}) as entries,
      (select jsonb_agg(to_jsonb(l)::text order by l.id) from journal_line l join journal_entry j on j.id=l.journal_entry_id where j.organization_id=${org.id}) as lines,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from payment t where organization_id=${org.id}) as payments,
      (select jsonb_agg(to_jsonb(a)::text order by a.id) from payment_allocation a join payment p on p.id=a.payment_id where p.organization_id=${org.id}) as allocations,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from invoice t where organization_id=${org.id}) as invoices,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from bank_transaction t join bank_account b on b.id=t.bank_account_id where b.organization_id=${org.id}) as movements,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from tax_period t where organization_id=${org.id}) as periods,
      (select jsonb_agg(to_jsonb(l)::text order by l.id) from tax_return_line l join tax_period p on p.id=l.tax_period_id where p.organization_id=${org.id}) as frozen,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from expense_claim t where organization_id=${org.id}) as expenses,
      (select jsonb_agg(to_jsonb(i)::text order by i.id) from expense_item i join expense_claim c on c.id=i.expense_claim_id where c.organization_id=${org.id}) as items,
      (select jsonb_agg(to_jsonb(t)::text order by t.id) from exchange_rate t where organization_id=${org.id}) as rates`)).rows;
    try {
      if (foreignAccount && foreignEntry) {
        assert.equal((await ACCOUNT(req(), params(foreignAccount))).status, 404);
        assert.equal((await ENTRY(req(), params(foreignEntry))).status, 404);
        await badCall("get_account", { accountId: foreignAccount }); await badCall("get_entry", { entryId: foreignEntry });
      }
      // The numeric opening contract remains USD cents even in zero/three-scale organizations.
      const opening = openingBalancePreview([{ accountId: openingAsset.id, debit: "12.50", credit: "" }, { accountId: equity.id, debit: "", credit: "12.50" }]);
      assert.equal(opening.isBalanced, true);
      const openingInput = { date, balances: opening.balances };
      const opened = transport === "rest" ? await ok(await OPENING(req(openingInput))) : await call("set_opening_balances", openingInput);
      const readOpening = await ok(await OPENING_GET(req()));
      assert.equal(openingBalanceSaved(readOpening.entry.lines).totalDebit, 1250n);
      const openingDetail = coreJournalDetail((await ok(await ENTRY(req(), params(opened.entry.id)))).entry as Detail);
      assert.ok(openingDetail.lines.every(line => line.amountCurrencyCode === "USD"));
      assert.equal(journalMoney(journalRestMinor(openingDetail.lines[0].debitAmount, openingDetail.lines[0].debitAmountMinor), "USD"), "$12.50");

      const bank = (transport === "rest" ? await ok(await BANK(req({ accountName: "Cash", currencyCode }))) : await call("create_bank_account", { accountName: "Cash", currencyCode })).bankAccount;
      const bankGl = (await db.execute(sql`select a.id, a.code from bank_account b join chart_account a on a.id=b.chart_account_id where b.id=${bank.id}`)).rows[0] as { id: string; code: string };
      const invoiceInput = { contactId: customer.id, currencyCode, issueDate: date, dueDate: date,
        lines: [{ description: "Low digits", unitPriceMinor: "3000000001", accountId: income.id, taxRateId: rate.id }] };
      const sale = (transport === "rest" ? await ok(await INVOICE(req(invoiceInput))) : await call("create_invoice", invoiceInput)).invoice;
      if (transport === "rest") await ok(await SEND(req({}), params(sale.id))); else await call("send_invoice", { invoiceId: sale.id });
      const raw = 3300000001n;
      assert.equal(sale.totalMinor, String(raw));
      const decimal = bankUiDecimal(raw, currencyCode);
      assert.deepEqual(paymentUiAmount(decimal, currencyCode), { amountMinor: String(raw) });
      const content = `date,description,amount\n${date},Low digits,${decimal}`;
      const imported = await ok(await IMPORT(req({ mode: "preview", format: "csv", content }), params(bank.id)));
      assert.equal(bankUiPreview(imported.preview, currencyCode).transactions[0].amount, raw);
      if (transport === "rest") await ok(await IMPORT(req({ mode: "commit", format: "csv", content }), params(bank.id)));
      else await call("import_bank_statement", { bankAccountId: bank.id, format: "csv", content });
      const movement = (await ok(await MOVEMENTS(req(), params(bank.id)))).data[0];
      const matchInput = { invoiceId: sale.id, ...bankUiMatchAmount(decimal, currencyCode, bankUiTransaction(movement, currencyCode), { currencyCode, amountDue: raw }) };
      const beforeMatch = await snapshot();
      assert.equal((await MATCH(req({ invoiceId: sale.id, amountMinor: String(raw + 1n) }), params(movement.id))).ok, false);
      await badCall("match_to_invoice", { transactionId: movement.id, invoiceId: sale.id, amountMinor: String(raw + 1n) });
      assert.deepEqual(await snapshot(), beforeMatch);
      const matched = transport === "rest" ? await ok(await MATCH(req(matchInput), params(movement.id))) : await call("match_to_invoice", { transactionId: movement.id, ...matchInput });
      for (const saved of [(await ok(await PAYMENT(req(), params(matched.payment.id)))).payment, (await call("get_payment", { paymentId: matched.payment.id })).payment]) {
        const payment = paymentUiRow(saved as PaymentWire); assert.equal(payment.amount, raw); assert.equal(payment.allocated, raw); assert.equal(payment.unallocated, 0n);
        assert.throws(() => paymentUiRow({ ...saved, amountMinor: "3300000002" } as PaymentWire));
      }
      const stored = (await db.execute(sql`select i.total::text, i.amount_paid::text, i.amount_due::text, p.amount::text, a.amount::text as allocation
        from invoice i join payment_allocation a on a.document_id=i.id join payment p on p.id=a.payment_id where i.id=${sale.id}`)).rows[0];
      assert.deepEqual(stored, { total: String(raw), amount_paid: String(raw), amount_due: "0", amount: String(raw), allocation: String(raw) });
      const session = { startDate: date, endDate: date, startBalanceMinor: "0", endBalanceMinor: String(raw) };
      if (transport === "rest") await ok(await SESSION(req(session), params(bank.id)));
      else await call("create_bank_reconciliation", { bankAccountId: bank.id, ...session });
      const proof = bankUiReport(await ok(await PROOF(req(), params(bank.id))));
      assert.equal(proof.statementEndBalance, raw); assert.equal(proof.glBalance, raw); assert.equal(proof.difference, 0n);
      assert.deepEqual(bankUiReport(await call("reconciliation_report", { bankAccountId: bank.id })), proof);

      // Expense rounding and physical mileage metadata feed actual recognition and cash GL.
      const expenseItems = [{ date, description: "Cost", amount: bankUiDecimal(3000000001n, currencyCode), category: "Travel", accountId: cost.id, receiptFileKey: "", receiptFileName: "" },
        { date, description: "Mileage", amount: "", category: "Travel", accountId: cost.id, receiptFileKey: "", receiptFileName: "", isMileage: true, distanceMiles: "3", mileageRate: bankUiDecimal(1n, currencyCode) }];
      const expensePreview = expenseEditorPreview(expenseItems, currencyCode), expensePayload = expenseEditorItems(expenseItems, currencyCode, true);
      assert.equal(expensePreview.error, null); assert.equal(expensePayload.total, 3000000004n);
      const draft = (transport === "rest" ? await ok(await EXPENSE(req({ title: "Combined", currencyCode, items: expensePayload.items }))) : await call("create_expense_claim", { title: "Combined", currencyCode, items: expensePayload.items })).expenseClaim;
      const savedExpense = expenseUiDocument((await ok(await EXPENSE_GET(req(), params(draft.id)))).expenseClaim as ExpenseWire);
      assert.equal(expenseUiMinor(savedExpense, "totalAmount"), expensePreview.total);
      assert.equal(savedExpense.items[1].distanceMiles, 300); assert.equal(savedExpense.items[1].mileageRate, 1);
      if (transport === "rest") await ok(await SUBMIT(req({}), params(draft.id))); else await call("submit_expense_claim", { expenseClaimId: draft.id });
      if (transport === "rest") { await ok(await APPROVE(req({}), params(draft.id))); await ok(await PAY(req({ date, bankAccountCode: bankGl.code }), params(draft.id))); }
      else { await call("approve_expense_claim", { expenseClaimId: draft.id }); await call("pay_expense_claim", { expenseClaimId: draft.id, date, bankAccountCode: bankGl.code }); }
      const paid = expenseUiDocument((await call("get_expense_claim", { expenseClaimId: draft.id })).expenseClaim as ExpenseWire);
      assert.equal(expenseUiMinor(paid, "totalAmount"), expensePreview.total);

      // Filing freezes the real invoice VAT, then the same preview owns cash settlement.
      const periodInput = { name: "Combined period", startDate: date, endDate: date, type: "monthly" };
      const period = (transport === "rest" ? await ok(await PERIOD(req(periodInput))) : await call("create_tax_period", periodInput)).taxPeriod;
      let settlement = 0n;
      if (currencyCode === "IRR") {
        const before = await snapshot(); assert.equal((await FILE(req({ mode: "file", basis: "accrual" }), params(period.id))).ok, false);
        await badCall("file_tax_period", { taxPeriodId: period.id, basis: "accrual" }); assert.deepEqual(await snapshot(), before);
      } else {
        const filed = transport === "rest" ? await ok(await FILE(req({ mode: "file", basis: "accrual" }), params(period.id))) : await call("file_tax_period", { taxPeriodId: period.id, basis: "accrual" });
        assert.equal(taxUiMinor(filed.net, filed.netMinor), 300000000n);
        const frozen = (await ok(await PERIOD_GET(req(), params(period.id)))).taxPeriod;
        const lines = taxUiRows(frozen.lines as { boxNumber: string; amount: number; amountMinor: string }[], ["amount"]);
        const net = lines.find(line => line.boxNumber === "5")!.amount;
        const preview = taxUiSettlement(bankUiDecimal(net, currencyCode), currencyCode); assert.equal(preview.error, null);
        const input = { date, bankGlAccountId: bankGl.id, amountMinor: preview.amountMinor };
        const settled = transport === "rest" ? await ok(await FILE(req({ mode: "settle", ...input }), params(period.id))) : await call("record_vat_settlement", { taxPeriodId: period.id, ...input });
        assert.equal(taxUiMinor(settled.amount, settled.amountMinor), preview.amount); settlement = preview.amount;
      }

      const expectedBalance = raw - expensePreview.total - settlement;
      const account = coreAccountMoney((await ok(await ACCOUNT(req(), params(bankGl.id)))).account);
      assert.equal(account.balanceMinor, String(expectedBalance)); assert.equal(account.amountCurrencyCode, currencyCode);
      assert.equal(coreAccountMoney((await call("get_account", { accountId: bankGl.id })).account).balanceMinor, String(expectedBalance));
      const ledger = await ok(await ACCOUNT(req(undefined, "?limit=1&sortOrder=asc"), params(bankGl.id)));
      assert.equal(coreLedgerMoney(ledger.data[0]).balanceMinor, String(raw));
      const last = await ok(await ACCOUNT(req(undefined, `?limit=1&sortOrder=asc&page=${ledger.pagination.total}`), params(bankGl.id)));
      assert.equal(coreLedgerMoney(last.data[0]).balanceMinor, String(expectedBalance));
      const sqlBalance = (await db.execute(sql`select sum(l.debit_amount-l.credit_amount)::text as balance from journal_line l join journal_entry e on e.id=l.journal_entry_id where l.account_id=${bankGl.id} and e.status='posted' and e.deleted_at is null`)).rows[0];
      assert.equal(sqlBalance.balance, String(expectedBalance));

      // The source document keeps EUR units; its automated journal stores base units once.
      const quote = { baseCurrency: "EUR", targetCurrency: currencyCode, date, ...taxUiRateInput("0.3333") };
      if (transport === "rest") await ok(await RATE(req({ rates: [quote] })));
      else await call("set_exchange_rate", quote);
      const foreignInput = { contactId: customer.id, currencyCode: "EUR", issueDate: date, dueDate: date,
        lines: [{ description: "Source versus base", unitPriceMinor: "1251", accountId: income.id }] };
      const foreign = (transport === "rest" ? await ok(await INVOICE(req(foreignInput))) : await call("create_invoice", foreignInput)).invoice;
      if (transport === "rest") await ok(await SEND(req({}), params(foreign.id))); else await call("send_invoice", { invoiceId: foreign.id });
      if (currencyCode === "USD") {
        const foreignRead = await ok(await INVOICE_GET(req(), params(foreign.id)));
        assert.equal(invoiceUiDocument(foreignRead.invoice).total, 1251n);
        assert.equal(invoiceUiBase(foreignRead.base).amounts.total, 417n);
      } else {
        // Retained document-base read policy rejects different scales; it cannot invent FX units.
        const rejected = await INVOICE_GET(req(), params(foreign.id)); assert.equal(rejected.status, 422);
        assert.equal((await rejected.json()).code, "LEGACY_NUMERIC_RANGE");
      }
      // MCP retains {invoice}, without REST's base-display envelope.
      assert.equal(invoiceUiDocument((await call("get_invoice", { invoiceId: foreign.id })).invoice).total, 1251n);
      const foreignSql = (await db.execute(sql`select l.debit_amount::text, l.credit_amount::text, l.currency_code, l.rate_exact::text
        from journal_line l join invoice i on i.journal_entry_id=l.journal_entry_id where i.id=${foreign.id} order by l.id`)).rows;
      assert.ok(foreignSql.every(line => line.currency_code === "EUR"));
      const foreignBase = currencyCode === "USD" ? 417n : currencyCode === "KWD" ? 4170n : 4n;
      assert.equal(foreignSql.reduce((sum, line) => sum + BigInt(line.debit_amount as string), 0n), foreignBase);
      assert.ok(foreignSql.every(line => /^0\.33330*$/.test(line.rate_exact as string)));
      assert.equal((await db.execute(sql`select total::text from invoice where id=${foreign.id}`)).rows[0].total, "1251");
      const entries = (await ok(await ENTRIES(req()))).entries as Summary[];
      const mcpEntries = (await call("list_entries", {})).entries;
      const beforeReads = await snapshot();
      for (const entry of entries) {
        coreJournalSummary(entry);
        assert.deepEqual(entry.debitTotals, mcpEntries.find((other: { id: string }) => other.id === entry.id).debitTotals);
        const detail = coreJournalDetail((await ok(await ENTRY(req(), params(entry.id)))).entry as Detail);
        assert.ok(detail.lines.every(line => line.amountCurrencyCode === (entry.id === opened.entry.id ? "USD" : currencyCode)));
        const linked = (await call("get_entry", { entryId: entry.id })).entry;
        assert.equal(linked.lines.length, detail.lines.length);
        for (let index = 0; index < detail.lines.length; index++) {
          const line = detail.lines[index], other = linked.lines[index];
          assert.equal(line.amountCurrencyCode, other.amountCurrencyCode);
          assert.equal(journalRestMinor(line.debitAmount, line.debitAmountMinor), coreStoredMinor(other.debitAmount, other.debitAmountMinor));
          assert.equal(journalRestMinor(line.creditAmount, line.creditAmountMinor), coreStoredMinor(other.creditAmount, other.creditAmountMinor));
        }
        const totals = new Map<string, bigint>();
        for (const line of detail.lines) totals.set(line.amountCurrencyCode, (totals.get(line.amountCurrencyCode) ?? 0n) + journalRestMinor(line.debitAmount, line.debitAmountMinor));
        for (const group of entry.debitTotals) assert.equal(totals.get(group.currencyCode), BigInt(group.totalDebitMinor));
        const savedTotals = (await db.execute(sql`select sum(debit_amount)::text as debit, sum(credit_amount)::text as credit from journal_line where journal_entry_id=${entry.id}`)).rows[0];
        assert.equal(savedTotals.debit, entry.totalDebitMinor); assert.equal(savedTotals.credit, entry.totalDebitMinor);
      }
      const display = coreDebitDisplay(entries); assert.ok(display.includes("$"));
      if (currencyCode === "KWD") assert.ok(display.includes("KWD"));
      assert.deepEqual(await snapshot(), beforeReads);

      // Malformed, conflicting and overflowing requests leave all composed domains unchanged.
      const before = await snapshot();
      for (const amountMinor of ["1e3", "9007199254740992"]) {
        assert.equal((await MATCH(req({ invoiceId: sale.id, amountMinor }), params(movement.id))).ok, false);
        await badCall("match_to_invoice", { transactionId: movement.id, invoiceId: sale.id, amountMinor });
      }
      assert.equal((await EXPENSE(req({ title: "Conflict", currencyCode, items: [{ date, description: "Conflict", amount: 1, amountMinor: "2" }] }))).ok, false);
      await badCall("create_expense_claim", { title: "Conflict", currencyCode, items: [{ date, description: "Conflict", amount: 1, amountMinor: "2" }] });
      assert.deepEqual(await snapshot(), before);
      foreignAccount = bankGl.id; foreignEntry = opened.entry.id; workflows++;
    } finally { await client.close(); await server.close(); }
  }
  console.log(`Combined core UI REST MCP SQL verified: ${workflows} workflows`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$client.end());
