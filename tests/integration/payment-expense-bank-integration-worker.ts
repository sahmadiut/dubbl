// Runs only in the harness's migrated disposable database, with synthetic tenants.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, subscription, contact, chartAccount,
  bankTransaction, invoice, bill, payment, paymentAllocation, journalEntry } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { POST as payInvoice } from "../../app/api/v1/invoices/[id]/pay/route";
import { GET as getPayment, DELETE as deletePayment } from "../../app/api/v1/payments/[id]/route";
import { POST as importStatement } from "../../app/api/v1/bank-accounts/[id]/transactions/import/route";
import { POST as bankMatch } from "../../app/api/v1/bank-transactions/[id]/match/route";
import { POST as bankUndo } from "../../app/api/v1/bank-transactions/[id]/unreconcile/route";
import { GET as bankProof } from "../../app/api/v1/bank-accounts/[id]/reconciliation/route";
import { POST as createExpense } from "../../app/api/v1/expenses/route";
import { createCreditNote, sendCreditNote, applyCredit } from "../../lib/api/credits";
import { createDebitNote, sendDebitNote, applyDebitNote } from "../../lib/api/debit-notes";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { registerExpenseCrudTools } from "../../lib/mcp/tools/expense-crud";
import { registerExpenseTools } from "../../lib/mcp/tools/expenses";
import { registerBankAccountTools } from "../../lib/mcp/tools/bank-accounts";
import { registerBankImportTools } from "../../lib/mcp/tools/bank-imports";
import { registerBankTransactionReadTools } from "../../lib/mcp/tools/bank-transaction-reads";
import { registerBankDocumentMatchTools } from "../../lib/mcp/tools/bank-document-matches";
import { registerBankReconciliationTools } from "../../lib/mcp/tools/bank-reconciliations";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined payments expenses banking", version: "1" });
  for (const register of [registerPaymentTools, registerInvoiceTools, registerInvoiceLifecycleTools, registerBillTools, registerExpenseCrudTools,
    registerExpenseTools, registerBankAccountTools, registerBankImportTools, registerBankTransactionReadTools,
    registerBankDocumentMatchTools, registerBankReconciliationTools]) register(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, new Set(tools.map(t => t.name)).size);
  for (const name of ["list_payments", "get_payment", "create_payment", "record_payment_batch", "delete_payment", "pay_invoice", "pay_bill"]) {
    const tool = tools.find(t => t.name === name)!;
    assert.equal(tool.inputSchema.additionalProperties, false, `${name} must reject unknown fields`);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

const snapshot = async () => {
  const tables = ["invoice", "bill", "credit_note", "debit_note", "payment", "payment_allocation", "expense_claim", "expense_item",
    "bank_account", "bank_transaction", "bank_statement_import", "bank_reconciliation", "chart_account", "journal_entry", "journal_line", "number_sequence"];
  return [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
};
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const data = async (response: Response, status = 200) => {
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
};
const journalNet = async (accountId: string) => {
  const result = await db.execute(sql`select coalesce(sum(l.debit_amount::numeric - l.credit_amount::numeric), 0)::text as net
    from journal_line l join journal_entry e on e.id=l.journal_entry_id
    where l.account_id=${accountId} and e.status='posted' and e.deleted_at is null`);
  return BigInt(String(result.rows[0].net));
};

async function scenario(currency: string) {
  const [own, foreign] = await db.insert(organization).values([
    { name: `Combined ${currency}`, slug: `combined-${currency}`, defaultCurrency: currency },
    { name: `Other ${currency}`, slug: `other-${currency}`, defaultCurrency: currency },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { email: `combined-${currency}@example.test` }, { email: `combined-viewer-${currency}@example.test` },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: own.id, name: "Denied", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: own.id, userId: owner.id, role: "owner" },
    { organizationId: foreign.id, userId: owner.id, role: "owner" }, { organizationId: own.id, userId: viewer.id, customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: own.id, plan: "pro" });
  const keys = { own: `dk_combined_${currency}`, foreign: `dk_foreign_${currency}`, denied: `dk_denied_${currency}` };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "foreign" ? foreign.id : own.id, createdBy: label === "denied" ? viewer.id : owner.id,
    name: label, keyPrefix: "dk_combined", keyHash: createHash("sha256").update(key).digest("hex"),
  });
  const ctx: AuthContext = { organizationId: own.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: foreign.id });
  const deniedClient = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body?: unknown, key = keys.own, method = body === undefined ? "GET" : "POST") => new Request("http://fixture.test/api/v1/combined", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": foreign.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const tool = async (name: string, args: Record<string, unknown>) => {
    const result = await ma.call(name, args); assert.equal(result.isError, false, `${name}: ${JSON.stringify(result.body)}`); return result.body;
  };
  const rejectTool = async (name: string, args: Record<string, unknown>, client = ma) => {
    const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true, name); assert.deepEqual(await snapshot(), before);
  };
  const rejectRest = async (work: () => Promise<Response>, status: number) => {
    const before = await snapshot(); await data(await work(), status); assert.deepEqual(await snapshot(), before);
  };
  const date = "2026-10-01", cashDate = "2026-10-04", today = new Date().toISOString().slice(0, 10);
  const [party] = await db.insert(contact).values({ organizationId: own.id, name: "Both", type: "both", currencyCode: currency }).returning();
  const [cash, revenue, expense] = await db.insert(chartAccount).values([
    { organizationId: own.id, code: "1100", name: "Bank", type: "asset", subType: "bank", currencyCode: currency },
    { organizationId: own.id, code: "4000", name: "Revenue", type: "revenue", currencyCode: currency },
    { organizationId: own.id, code: "5990", name: "Expense", type: "expense", currencyCode: currency },
    { organizationId: own.id, code: "1200", name: "AR", type: "asset", currencyCode: currency },
    { organizationId: own.id, code: "2100", name: "AP", type: "liability", currencyCode: currency },
  ]).returning();
  const input = (accountId: string, value = "1250") => ({ contactId: party.id, issueDate: date, dueDate: "2026-10-31", currencyCode: currency,
    lines: [{ description: "Combined fixture", unitPriceMinor: value, accountId }] });
  try {
    const bank = (await tool("create_bank_account", { accountName: "Combined bank", currencyCode: currency, chartAccountId: cash.id, balanceMinor: "0" })).bankAccount;
    const inv = (await data(await createInvoice(req(input(revenue.id))), 201)).invoice;
    await tool("send_invoice", { invoiceId: inv.id });
    const bl = (await tool("create_bill", input(expense.id))).bill; await tool("receive_bill", { billId: bl.id });
    const noteInput = (accountId: string) => ({ contactId: party.id, issueDate: date, currencyCode: currency,
      lines: [{ description: "Combined offset", unitPriceMinor: "250", accountId }] });
    const cn = (await createCreditNote(ctx, noteInput(revenue.id), "rest")).creditNote;
    await sendCreditNote(ctx, cn.id); await applyCredit(ctx, cn.id, { invoiceId: inv.id, amountMinor: "250" });
    const dn = (await createDebitNote(ctx, noteInput(expense.id), "rest")).debitNote;
    await sendDebitNote(ctx, dn.id); await applyDebitNote(ctx, dn.id, { billId: bl.id, amountMinor: "250" });
    const common = { date: cashDate, bankAccountId: bank.id };
    const alloc = { documentType: "invoice", documentId: inv.id, amountMinor: "500" };
    const batch = { ...common, contactId: party.id, type: "received", allocations: [alloc] };
    for (const [name, args] of [
      ["list_payments", {}], ["get_payment", { paymentId: (await db.select().from(payment).where(eq(payment.organizationId, own.id)))[0].id }],
      ["create_payment", { ...common, contactId: party.id, type: "received", amountMinor: "500", allocations: [alloc] }],
      ["record_payment_batch", batch], ["pay_invoice", { ...common, invoiceId: inv.id, amountMinor: "500" }],
      ["pay_bill", { ...common, billId: bl.id, amountMinor: "500" }],
    ] as const) await rejectTool(name, { ...args, amountTypo: "900" });
    for (const client of [mb, deniedClient]) {
      await rejectTool("pay_invoice", { ...common, invoiceId: inv.id, amountMinor: "500" }, client);
      await rejectTool("pay_bill", { ...common, billId: bl.id, amountMinor: "500" }, client);
      await rejectTool("create_expense_claim", { title: "Denied", items: [{ date, description: "Denied", amountMinor: "250", accountId: expense.id }] }, client);
    }
    for (const [key, status] of [[keys.foreign, 404], [keys.denied, 403], ["dk_invalid", 401]] as const)
      await rejectRest(() => payInvoice(req({ ...common, amountMinor: "500" }, key), params(inv.id)), status);
    for (const patch of [{ amountMinor: "9007199254740992" }, { amount: 501, amountMinor: "500" }]) {
      await rejectRest(() => payInvoice(req({ ...common, ...patch }), params(inv.id)), "amount" in patch ? 400 : 422);
      await rejectTool("pay_invoice", { ...common, invoiceId: inv.id, ...patch });
    }
    const first = await data(await payInvoice(req({ ...common, amount: 500, idempotencyKey: "combined-first" }), params(inv.id)));
    assert.equal(first.payment.amountMinor, "500"); assert.equal(first.invoice.amountDueMinor, "500");
    await rejectTool("delete_payment", { paymentId: first.payment.id, unexpected: true });
    const saved = await snapshot();
    assert.deepEqual(await tool("pay_invoice", { ...common, invoiceId: inv.id, amountMinor: "500", idempotencyKey: "combined-first" }), first);
    assert.deepEqual(await snapshot(), saved);
    const scale = currency === "KWD" ? 1000 : ["IRR", "JPY"].includes(currency) ? 1 : 100;
    const second = (await tool("record_payment_batch", { ...batch, allocations: [{ ...alloc, amount: 500 / scale, amountExact: String(500 / scale) }] })).payment;
    assert.equal(second.amountMinor, "500");
    const csv = `date,description,amountMinor,balanceMinor\n${cashDate},Receipt one,500,500\n${cashDate},Receipt two,500,1000\n${cashDate},Supplier,-1000,0`;
    const imported = await data(await importStatement(req({ format: "csv", content: csv }), params(bank.id)), 201);
    assert.equal(imported.import.imported, 3);
    assert.equal((await tool("import_bank_statement", { bankAccountId: bank.id, format: "csv", content: csv })).import.imported, 0);
    const rows = await db.select().from(bankTransaction).where(eq(bankTransaction.bankAccountId, bank.id));
    const receipt1 = rows.find(r => r.description === "Receipt one")!, receipt2 = rows.find(r => r.description === "Receipt two")!, outgoing = rows.find(r => r.amount === -1000)!;
    await tool("match_to_existing_payment", { transactionId: receipt1.id, paymentId: first.payment.id });
    await data(await bankMatch(req({ paymentId: second.id }), params(receipt2.id)));
    const supplier = await tool("match_to_bill", { transactionId: outgoing.id, billId: bl.id, amountMinor: "1000" });
    assert.equal(supplier.payment.amountMinor, "1000"); assert.equal(supplier.billStatus, "paid");
    const cashRead = await data(await getPayment(req(), params(first.payment.id)));
    assert.deepEqual(await tool("get_payment", { paymentId: first.payment.id }), cashRead);
    const carriers = await db.select().from(payment).where(and(eq(payment.organizationId, own.id), isNull(payment.journalEntryId)));
    assert.equal(carriers.length, 2);
    for (const carrier of carriers) {
      const dto = (await tool("get_payment", { paymentId: carrier.id })).payment;
      assert.equal(dto.amountMinor, "250"); assert.equal(dto.allocations.length, 2);
      assert.ok(dto.allocations.every((r: { amountMinor: string }) => r.amountMinor === "250"));
      await rejectTool("match_to_existing_payment", { transactionId: receipt1.id, paymentId: carrier.id });
    }
    assert.equal(await journalNet(cash.id), 0n);
    const rec = (await tool("create_bank_reconciliation", { bankAccountId: bank.id, startDate: cashDate, endDate: cashDate, startBalance: 0, endBalanceMinor: "0" })).reconciliation;
    const proof = await data(await bankProof(req(), params(bank.id)));
    assert.deepEqual(await tool("reconciliation_report", { bankAccountId: bank.id }), proof);
    assert.equal(proof.glBalanceMinor, "0"); assert.equal(proof.differenceMinor, "0"); assert.equal(proof.isBalanced, true);
    await tool("complete_bank_reconciliation", { bankAccountId: bank.id, reconciliationId: rec.id });
    await rejectTool("delete_payment", { paymentId: first.payment.id, unexpected: true });
    await rejectRest(() => deletePayment(req(undefined, keys.own, "DELETE"), params(first.payment.id)), 409);
    // Existing cash is detached without reversal; a bank-created settlement is reversed on undo.
    await tool("unreconcile_bank_transaction", { transactionId: receipt1.id });
    assert.equal((await db.select().from(journalEntry).where(eq(journalEntry.id, first.payment.journalEntryId)))[0].reversedByEntryId, null);
    await data(await deletePayment(req(undefined, keys.own, "DELETE"), params(first.payment.id)));
    assert.equal((await db.select().from(invoice).where(eq(invoice.id, inv.id)))[0].amountDue, 500);
    await data(await bankUndo(req({}), params(outgoing.id)));
    assert.equal((await db.select().from(bill).where(eq(bill.id, bl.id)))[0].amountDue, 1000);
    assert.ok((await db.select().from(payment).where(eq(payment.id, supplier.payment.id)))[0].deletedAt);
    // Ordinary employee reimbursements use the same bank GL without creating settlement carriers.
    const beforeExpenseCash = await journalNet(cash.id);
    const claim = (await data(await createExpense(req({ title: "Combined expense", currencyCode: currency,
      items: [{ date: today, description: "Travel", amount: 250 / scale, amountMinor: "250", accountId: expense.id }] })), 201)).expenseClaim;
    assert.equal(claim.totalAmountMinor, "250");
    await tool("submit_expense_claim", { expenseClaimId: claim.id }); await tool("approve_expense_claim", { expenseClaimId: claim.id });
    const paymentCount = (await db.select().from(payment)).length;
    await tool("pay_expense_claim", { expenseClaimId: claim.id, date: today, bankAccountCode: "1100" });
    assert.equal(await journalNet(cash.id), beforeExpenseCash - 250n);
    assert.equal((await db.select().from(payment)).length, paymentCount);
    await tool("reverse_expense_claim", { expenseClaimId: claim.id }); assert.equal(await journalNet(cash.id), beforeExpenseCash);
    // Different entry points serialize settlement of the same outstanding document.
    const race = (await data(await createInvoice(req(input(revenue.id))), 201)).invoice; await tool("send_invoice", { invoiceId: race.id });
    const [movement] = await db.insert(bankTransaction).values({ bankAccountId: bank.id, date: today, description: "Concurrent receipt", amount: 1250, currencyCode: currency }).returning();
    const [restRace, mcpRace] = await Promise.all([
      payInvoice(req({ date: today, bankAccountId: bank.id, amountMinor: "1250" }), params(race.id)),
      ma.call("match_to_invoice", { transactionId: movement.id, invoiceId: race.id, amount: 1250 }),
    ]);
    assert.equal(Number(restRace.status === 200) + Number(!mcpRace.isError), 1);
    assert.equal((await db.select().from(invoice).where(eq(invoice.id, race.id)))[0].amountDue, 0);
    const allocations = await db.select().from(paymentAllocation).where(eq(paymentAllocation.documentId, race.id));
    assert.equal(allocations.length, 1); assert.equal(allocations[0].amount, 1250);
    const [racePayment] = await db.select().from(payment).where(eq(payment.id, allocations[0].paymentId));
    if (restRace.status === 200) await tool("match_to_existing_payment", { transactionId: movement.id, paymentId: racePayment.id });
    await tool("unreconcile_bank_transaction", { transactionId: movement.id });
    if (restRace.status === 200) await tool("delete_payment", { paymentId: racePayment.id });
    assert.equal((await db.select().from(invoice).where(eq(invoice.id, race.id)))[0].amountDue, 1250);
    assert.equal(await journalNet(cash.id), beforeExpenseCash);
    const balanceCheck = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id
      where e.organization_id=${own.id} and e.status='posted' group by e.id
      having sum(l.debit_amount::numeric) <> sum(l.credit_amount::numeric)`);
    assert.equal(balanceCheck.rows.length, 0);
  } finally { await ma.close(); await mb.close(); await deniedClient.close(); }
}

async function run() {
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) await scenario(currency);
  console.log("Combined payment expense bank contracts verified");
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
