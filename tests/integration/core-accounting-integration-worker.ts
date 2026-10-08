// Invoked only in core-accounting-integration.test.ts's migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, subscription, chartAccount, periodLock } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as createContact, GET as listContacts } from "../../app/api/v1/contacts/route";
import { GET as getContact, PATCH as editContact } from "../../app/api/v1/contacts/[id]/route";
import { POST as mergeContacts } from "../../app/api/v1/contacts/[id]/merge/route";
import { PUT as mileage } from "../../app/api/v1/organization/mileage-rate/route";
import { POST as createEntry } from "../../app/api/v1/entries/route";
import { GET as getEntry, PUT as editEntry } from "../../app/api/v1/entries/[id]/route";
import { POST as voidEntry } from "../../app/api/v1/entries/[id]/void/route";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as getInvoice } from "../../app/api/v1/invoices/[id]/route";
import { POST as payInvoice } from "../../app/api/v1/invoices/[id]/pay/route";
import { POST as createBill } from "../../app/api/v1/bills/route";
import { POST as receiveBill } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as payBill } from "../../app/api/v1/bills/[id]/pay/route";
import { DELETE as deletePayment } from "../../app/api/v1/payments/[id]/route";
import { POST as createExpense } from "../../app/api/v1/expenses/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function data(response: Response, status = 200) {
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
}
const tables = ["organization", "contact", "chart_account", "tax_rate", "tax_component", "invoice", "invoice_line", "bill", "bill_line",
  "payment", "payment_allocation", "bank_account", "bank_transaction", "expense_claim", "expense_item", "journal_entry", "journal_line", "number_sequence", "period_lock"];
async function snapshot() {
  return [...await Promise.all(tables.map(t => db.execute(sql.raw(
    `select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`,
  )).then(r => r.rows))), (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows
    from audit_log t where entity_type <> 'api_key'`)).rows];
}
async function unchanged(operation: () => Promise<unknown>) {
  const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before);
}
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined core accounting", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const listed = (await client.listTools()).tools;
  assert.equal(listed.length, new Set(listed.map(t => t.name)).size);
  for (const name of ["list_contacts", "get_contact", "create_contact", "update_contact", "merge_contacts", "delete_contact"]) {
    const tool = listed.find(t => t.name === name)!;
    assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false, name);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async ok(name: string, args: Record<string, unknown> = {}) {
      const result = await this.call(name, args); assert.equal(result.isError, false, `${name}: ${JSON.stringify(result.body)}`); return result.body;
    },
    async reject(name: string, args: Record<string, unknown>) {
      await unchanged(async () => assert.equal((await this.call(name, args)).isError, true, name));
    },
    async close() { await client.close(); await server.close(); },
  };
}
async function net(id: string) {
  const result = await db.execute(sql`select coalesce(sum(l.debit_amount::numeric-l.credit_amount::numeric),0)::text as net
    from journal_line l join journal_entry e on e.id=l.journal_entry_id where l.account_id=${id} and e.status='posted' and e.deleted_at is null`);
  return BigInt(String(result.rows[0].net));
}
async function scenario(currency: string, value: number, exactWriter: boolean) {
  const slug = `core-${currency}-${value}`;
  const [own, foreign] = await db.insert(organization).values([
    { name: slug, slug, defaultCurrency: currency }, { name: `${slug}-foreign`, slug: `${slug}-foreign`, defaultCurrency: currency },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: `${slug}@example.test` }, { email: `${slug}-denied@example.test` }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: own.id, name: "Denied", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: own.id, userId: owner.id, role: "owner" }, { organizationId: foreign.id, userId: owner.id, role: "owner" },
    { organizationId: own.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: own.id, plan: "pro" });
  const keys = { own: `dk_${slug}`, foreign: `dk_${slug}_foreign`, denied: `dk_${slug}_denied` };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "foreign" ? foreign.id : own.id,
    createdBy: label === "denied" ? viewer.id : owner.id, name: label, keyPrefix: "dk_core", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: own.id, userId: owner.id, role: "owner" };
  const client = await mcp(ctx), other = await mcp({ ...ctx, organizationId: foreign.id }), denied = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (body?: unknown, method = body === undefined ? "GET" : "POST", key = keys.own) => new Request("http://fixture.test/api/v1/core", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": foreign.id }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const date = "2026-10-01", dueDate = "2026-10-31", today = new Date().toISOString().slice(0, 10);
  const scale = currency === "KWD" ? 1000 : ["JPY", "IRR"].includes(currency) ? 1 : 100;
  const [cash, revenue, expense, ar, ap] = await db.insert(chartAccount).values([
    { organizationId: own.id, code: "1100", name: "Bank", type: "asset", subType: "bank", currencyCode: currency },
    { organizationId: own.id, code: "4000", name: "Revenue", type: "revenue", currencyCode: currency },
    { organizationId: own.id, code: "5990", name: "Expense", type: "expense", currencyCode: currency },
    { organizationId: own.id, code: "1200", name: "AR", type: "asset", currencyCode: currency },
    { organizationId: own.id, code: "2100", name: "AP", type: "liability", currencyCode: currency },
  ]).returning();
  try {
    await data(await mileage(request({ mileageRate: value }, "PUT")));
    assert.equal((await client.ok("get_organization_mileage_rate")).mileageRateMinor, String(value));
    await client.ok("update_organization_mileage_rate", { mileageRateMinor: String(value) });
    const partyBody = { name: "Shared party", type: "both", currencyCode: currency };
    const party = (exactWriter ? await client.ok("create_contact", { ...partyBody, creditLimitMinor: String(value) })
      : await data(await createContact(request({ ...partyBody, creditLimit: value })), 201)).contact;
    assert.equal(party.organizationId, own.id); assert.equal(party.creditLimitMinor, String(value));
    await client.ok("update_contact", { contactId: party.id, creditLimit: value, creditLimitMinor: String(value) });
    assert.equal((await data(await getContact(request(), params(party.id)))).contact.creditLimitMinor, String(value));
    // Unknown exact aliases must not be stripped and commit an unrelated change.
    await client.reject("create_contact", { ...partyBody, creditLimitExact: "1" });
    await unchanged(async () => data(await createContact(request({ ...partyBody, creditLimitExact: "1" })), 400));
    await client.reject("update_contact", { contactId: party.id, name: "Must not save", creditLimitExact: "1" });
    await unchanged(async () => data(await editContact(request({ name: "Must not save", creditLimitExact: "1" }, "PATCH"), params(party.id)), 400));
    for (const patch of [{ creditLimit: 1, creditLimitMinor: "2" }, { creditLimitMinor: "9007199254740992" }, { creditLimitMinor: "01" }]) {
      await client.reject("update_contact", { contactId: party.id, ...patch });
      await unchanged(async () => data(await editContact(request(patch, "PATCH"), params(party.id)), patch.creditLimitMinor === "9007199254740992" ? 422 : 400));
    }
    const lines = [{ accountId: cash.id, currencyCode: currency, debitAmountMinor: "250" }, { accountId: expense.id, currencyCode: currency, creditAmountMinor: "250" }];
    const entryBody = { date, description: "Manual cash adjustment", lines };
    // Invalid nested aliases cannot become a zero leg or vanish before replacement.
    const unsupported = { ...entryBody, lines: lines.map(l => ({ ...l, debitAmountExact: "99" })) };
    await client.reject("create_entry", unsupported);
    await unchanged(async () => data(await createEntry(request(unsupported)), 400));
    const manual = (await data(await createEntry(request({ ...entryBody, lines: [
      { accountId: cash.id, currencyCode: currency, debitAmount: 250 }, { accountId: expense.id, currencyCode: currency, creditAmount: 250 },
    ] })), 201)).entry;
    await client.ok("update_entry", { entryId: manual.id, ...entryBody });
    await client.reject("update_entry", { entryId: manual.id, ...unsupported });
    await unchanged(async () => data(await editEntry(request(unsupported, "PUT"), params(manual.id)), 400));
    await client.ok("post_entry", { entryId: manual.id });
    const manualRead = (await data(await getEntry(request(), params(manual.id)))).entry;
    assert.equal(manualRead.lines.find((l: { debitAmountMinor: string }) => l.debitAmountMinor === "250").debitAmount, "2.50");
    assert.equal((await client.ok("get_entry", { entryId: manual.id })).entry.lines.find((l: { debitAmount: number }) => l.debitAmount === 250).debitAmountMinor, "250");
    const bank = (await client.ok("create_bank_account", { accountName: "Core cash", chartAccountId: cash.id, currencyCode: currency, balanceMinor: "0" })).bankAccount;
    const docBody = { contactId: party.id, issueDate: date, dueDate, currencyCode: currency };
    const line = (accountId: string, exact: boolean) => ({ description: "Core accounting", accountId, ...(exact ? { unitPriceMinor: String(value) } : { unitPrice: value / scale }) });
    const sale = (exactWriter ? await client.ok("create_invoice", { ...docBody, lines: [line(revenue.id, true)] })
      : await data(await createInvoice(request({ ...docBody, lines: [line(revenue.id, false)] })), 201)).invoice;
    const purchase = (exactWriter ? await data(await createBill(request({ ...docBody, lines: [line(expense.id, false)] })), 201)
      : await client.ok("create_bill", { ...docBody, lines: [line(expense.id, true)] })).bill;
    assert.equal(sale.totalMinor, String(value)); assert.equal(purchase.totalMinor, String(value));
    await client.ok("send_invoice", { invoiceId: sale.id }); await data(await receiveBill(request({}), params(purchase.id)));
    assert.equal(await net(ar.id), BigInt(value)); assert.equal(await net(ap.id), -BigInt(value));
    const balances = async (contactId: string, owes: number, owed: number) => {
      const row = (await data(await listContacts(request()))).data.find((r: { id: string }) => r.id === contactId);
      assert.ok(row); assert.equal(row.owesYouMinor, String(owes)); assert.equal(row.youOweMinor, String(owed));
      assert.equal(row.owesYou, owes); assert.equal(row.youOwe, owed);
    };
    await balances(party.id, value, value);
    const settlement = { date, bankAccountId: bank.id, amountMinor: String(value) };
    for (const c of [other, denied]) {
      await c.reject("pay_invoice", { invoiceId: sale.id, ...settlement }); await c.reject("pay_bill", { billId: purchase.id, ...settlement });
      await c.reject("update_contact", { contactId: party.id, creditLimitMinor: "1" });
      await c.reject("void_entry", { entryId: manual.id, reason: "Denied" });
    }
    for (const [key, status] of [[keys.foreign, 404], [keys.denied, 403], ["dk_invalid", 401]] as const)
      await unchanged(async () => data(await payInvoice(request(settlement, "POST", key), params(sale.id)), status));
    await unchanged(async () => data(await getInvoice(request(undefined, "GET", keys.foreign), params(sale.id)), 404));
    for (const patch of [{ amountMinor: "9007199254740992" }, { amount: 1, amountMinor: "2" }]) {
      await client.reject("pay_invoice", { invoiceId: sale.id, ...settlement, ...patch });
      await unchanged(async () => data(await payBill(request({ ...settlement, ...patch }), params(purchase.id)), "amount" in patch ? 400 : 422));
    }
    const [lock] = await db.insert(periodLock).values({ organizationId: own.id, lockDate: date, lockedBy: owner.id }).returning();
    await client.reject("pay_invoice", { invoiceId: sale.id, ...settlement });
    await unchanged(async () => data(await payBill(request(settlement), params(purchase.id)), 422));
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const received = await client.ok("pay_invoice", { invoiceId: sale.id, ...settlement, idempotencyKey: "core-receipt" });
    assert.equal(received.payment.amount, value); assert.equal(received.payment.amountMinor, String(value));
    await unchanged(async () => assert.deepEqual(await client.ok("pay_invoice", { invoiceId: sale.id, ...settlement, idempotencyKey: "core-receipt" }), received));
    const paid = await data(await payBill(request({ date, bankAccountId: bank.id, amount: value, idempotencyKey: "core-outgoing" }), params(purchase.id)));
    assert.equal(paid.payment.amountMinor, String(value)); await balances(party.id, 0, 0);
    assert.equal(await net(ar.id), 0n); assert.equal(await net(ap.id), 0n); assert.equal(await net(cash.id), 250n);
    const claim = (await data(await createExpense(request({ title: "Core reimbursement", currencyCode: currency,
      items: [{ date: today, description: "Core expense", accountId: expense.id, amount: 250 / scale, amountMinor: "250" }] })), 201)).expenseClaim;
    await client.ok("submit_expense_claim", { expenseClaimId: claim.id }); await client.ok("approve_expense_claim", { expenseClaimId: claim.id });
    await client.ok("pay_expense_claim", { expenseClaimId: claim.id, date: today, bankAccountCode: "1100" });
    assert.equal(await net(cash.id), 0n); await client.ok("reverse_expense_claim", { expenseClaimId: claim.id });
    assert.equal(await net(cash.id), 250n);
    // Merge crosses all adopted references without changing saved money or ownership.
    const target = (await client.ok("create_contact", { ...partyBody, name: "Merged party", creditLimitMinor: "1250" })).contact;
    await data(await mergeContacts(request({ targetContactId: target.id }), params(party.id)));
    assert.equal((await client.ok("get_invoice", { invoiceId: sale.id })).invoice.contactId, target.id);
    assert.equal((await client.ok("get_bill", { billId: purchase.id })).bill.contactId, target.id);
    assert.equal((await client.ok("get_payment", { paymentId: received.payment.id })).payment.contactId, target.id);
    await data(await deletePayment(request(undefined, "DELETE"), params(received.payment.id)));
    await balances(target.id, value, 0); assert.equal(await net(ar.id), BigInt(value));
    await client.ok("delete_payment", { paymentId: paid.payment.id }); await balances(target.id, value, value);
    assert.equal(await net(ap.id), -BigInt(value)); assert.equal(await net(cash.id), 250n);
    await data(await voidEntry(request({ reason: "Restore manual adjustment" }), params(manual.id)));
    assert.equal(await net(cash.id), 0n);
    const unbalanced = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id
      where e.organization_id=${own.id} and e.status='posted' and e.deleted_at is null group by e.id
      having sum(l.debit_amount::numeric) <> sum(l.credit_amount::numeric)`);
    assert.equal(unbalanced.rows.length, 0);
    assert.equal((await client.ok("get_contact", { contactId: target.id })).contact.creditLimitMinor, "1250");
    const extra = (await client.ok("create_contact", { ...partyBody, name: "SDK merge source", creditLimit: 1250 })).contact;
    await client.ok("merge_contacts", { sourceContactId: extra.id, targetContactId: target.id });
    const removable = (await client.ok("create_contact", { ...partyBody, name: "SDK delete", creditLimitMinor: null })).contact;
    await client.reject("delete_contact", { contactId: removable.id, amountMinor: "1" });
    await client.ok("delete_contact", { contactId: removable.id });
    const listed = (await client.ok("list_contacts", {})).contacts;
    assert.ok(listed.some((c: { id: string }) => c.id === target.id));
    assert.ok(listed.every((c: { id: string; organizationId: string }) => c.organizationId === own.id && ![party.id, extra.id, removable.id].includes(c.id)));
    console.log(`Core ${currency} ${value} ${exactWriter ? "exact" : "legacy"} composed`);
  } finally { await client.close(); await other.close(); await denied.close(); }
}
try {
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
    await scenario(currency, 1250, false); await scenario(currency, 3000000000, true);
  }
  console.log("Combined core accounting contracts verified");
} finally { await db.$client.end(); }
