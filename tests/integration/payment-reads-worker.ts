// Runs only in payment-reads.test.ts's randomly named disposable database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, bankAccount,
  payment, paymentAllocation, invoice, bill, creditNote, debitNote, customerCredit, journalEntry, bankTransaction } from "../../lib/db/schema";
import { GET as list } from "../../app/api/v1/payments/route";
import { GET as get } from "../../app/api/v1/payments/[id]/route";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Payment reads fixture", version: "1.0.0" });
  registerPaymentTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.find(tool => tool.name === "list_payments")!.description!.includes("amountMinor"));
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "get_payment")!.inputSchema).includes("UUID"));
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async close() { await client.close(); await server.close(); },
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Payment A", slug: "payment-a" }, { name: "Payment B", slug: "payment-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "pay-owner@example.test" }, { email: "pay-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Reads only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_payment_a", b: "dk_payment_b", viewer: "dk_payment_viewer", expired: "dk_payment_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_pay",
    expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [ownContact, otherContact] = await db.insert(contact).values([{ organizationId: a.id, name: "Own", type: "both", creditLimit: 3000 },
    { organizationId: b.id, name: "Secret", type: "both" }]).returning();
  const [bank, otherBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Own bank", balance: -2147483648, lowBalanceThreshold: 0 },
    { organizationId: b.id, accountName: "Secret bank" }]).returning();
  const [journal, otherJournal] = await db.insert(journalEntry).values([
    { organizationId: a.id, entryNumber: 1, date: "2026-10-01", description: "Own" },
    { organizationId: b.id, entryNumber: 1, date: "2026-10-01", description: "Secret" },
  ]).returning();
  const [statement, otherStatement] = await db.insert(bankTransaction).values([
    { bankAccountId: bank.id, date: "2026-10-01", description: "Own", amount: 1250 },
    { bankAccountId: otherBank.id, date: "2026-10-01", description: "Secret", amount: 1250 },
  ]).returning();
  let serial = 0;
  const make = async (amount = 1250, currencyCode = "USD", orgId = a.id, type: "received" | "made" = "received") => {
    const [row] = await db.insert(payment).values({ organizationId: orgId, contactId: orgId === a.id ? ownContact.id : otherContact.id,
      bankAccountId: orgId === a.id ? bank.id : otherBank.id, paymentNumber: `PAY-${++serial}`, date: "2026-10-01", type, amount, currencyCode,
      createdAt: new Date("2026-10-01T12:00:00Z") }).returning();
    return row;
  };
  const docs = async (orgId: string) => {
    const contactId = orgId === a.id ? ownContact.id : otherContact.id;
    const common = { organizationId: orgId, contactId, issueDate: "2026-10-01" };
    const [inv] = await db.insert(invoice).values({ ...common, invoiceNumber: `I-${orgId}`, dueDate: "2026-10-31" }).returning();
    const [bl] = await db.insert(bill).values({ ...common, billNumber: `B-${orgId}`, dueDate: "2026-10-31" }).returning();
    const [cn] = await db.insert(creditNote).values({ ...common, creditNoteNumber: `C-${orgId}` }).returning();
    const [dn] = await db.insert(debitNote).values({ ...common, debitNoteNumber: `D-${orgId}` }).returning();
    const [cc] = await db.insert(customerCredit).values({ organizationId: orgId, contactId, date: "2026-10-01", sourceType: "prepayment" }).returning();
    return { invoice: inv.id, bill: bl.id, credit_note: cn.id, debit_note: dn.id, prepayment: cc.id };
  };
  const ownDocs = await docs(a.id), otherDocs = await docs(b.id);
  const request = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/payments${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from payment p) as payments,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from payment_allocation p) as allocations,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from bank_account p) as banks,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from contact p) as contacts,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from invoice p) as invoices,
    (select coalesce(jsonb_agg(to_jsonb(p)::text order by p.id),'[]'::jsonb) from bill p) as bills,
    (select count(*)::text from journal_entry) as journals,
    (select count(*)::text from audit_log where entity_type <> 'api_key') as audits`)).rows;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  try {
    assert.deepEqual((await (await list(request())).json()).data, []);
    const made = [];
    for (const [amount, currency] of [[1250, "USD"], [1250, "IRR"], [1250, "JPY"], [1250, "KWD"], [2147483648, "USD"],
      [Number.MAX_SAFE_INTEGER, "USD"], [-1250, "USD"], [0, "USD"]] as const) {
      const row = await make(amount, currency); made.push(row);
      await db.insert(paymentAllocation).values({ paymentId: row.id, documentType: "invoice", documentId: ownDocs.invoice, amount });
    }
    const outgoing = await make(50, "USD", a.id, "made"), foreign = await make(50, "USD", b.id), deleted = await make();
    await db.update(payment).set({ deletedAt: new Date() }).where(eq(payment.id, deleted.id));
    let snap = await snapshot();
    const dto = await (await list(request())).json(); assert.equal(dto.pagination.total, 9);
    assert.deepEqual((await ma.call("list_payments")).body.payments, dto.data);
    assert.deepEqual((await readOnly.call("list_payments")).body.payments, dto.data);
    assert.deepEqual((await (await list(request("", keys.viewer))).json()).data, dto.data);
    assert.equal((await mb.call("list_payments")).body.total, 1);
    assert.equal(Object.hasOwn(dto.data[0], "bankAccount"), false);
    assert.equal((await (await list(request("?type=made"))).json()).data[0].id, outgoing.id);
    assert.equal((await ma.call("list_payments", { type: "made" })).body.payments[0].id, outgoing.id);
    assert.equal((await (await list(request(`?contactId=${otherContact.id}`))).json()).pagination.total, 0);
    for (const row of made) {
      const res = await get(request(), params(row.id)); assert.equal(res.status, 200);
      const detail = await res.json(); assert.deepEqual((await ma.call("get_payment", { paymentId: row.id })).body, detail);
      assert.equal(detail.payment.amount, row.amount); assert.equal(detail.payment.amountMinor, String(row.amount));
      assert.equal(detail.payment.allocations[0].amountMinor, String(row.amount));
      assert.equal(detail.payment.bankAccount.balanceMinor, "-2147483648"); assert.equal(detail.payment.bankAccount.lowBalanceThresholdMinor, "0");
      assert.equal(detail.payment.contact.creditLimitMinor, "3000"); assert.equal(detail.payment.date, "2026-10-01");
    }
    const page1 = await (await list(request("?limit=2&page=1"))).json(), page2 = await (await list(request("?limit=2&page=2"))).json();
    assert.equal(new Set([...page1.data, ...page2.data].map((row: { id: string }) => row.id)).size, 4);
    assert.deepEqual((await ma.call("list_payments", { limit: 2, page: 2 })).body.payments, page2.data);
    for (const id of [foreign.id, deleted.id, randomUUID()]) {
      assert.equal((await get(request(), params(id))).status, 404); assert.equal((await ma.call("get_payment", { paymentId: id })).body.status, 404);
    }
    for (const key of ["dk_invalid", keys.expired]) {
      assert.equal((await list(request("", key))).status, 401); assert.equal((await get(request("", key), params(made[0].id))).status, 401);
    }
    for (const query of ["?type=unknown", "?contactId=bad", "?page=no", "?limit=no", "?page=21474837", "?page=1.5", "?limit=101", "?limit=0"]) assert.equal((await list(request(query))).status, 400);
    assert.equal((await get(request(), params("bad"))).status, 400);
    assert.equal((await ma.call("get_payment", { paymentId: "bad" })).isError, true);
    assert.equal((await ma.call("list_payments", { page: 21474837 })).isError, true); assert.deepEqual(await snapshot(), snap);
    const target = made[0];
    const rejectBoth = async () => {
      const before = await snapshot();
      assert.equal((await get(request(), params(target.id))).status, 422);
      assert.equal((await ma.call("get_payment", { paymentId: target.id })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await list(request())).status, 422); assert.equal((await ma.call("list_payments")).body.status, 422);
      assert.deepEqual(await snapshot(), before);
    };
    await db.update(payment).set({ contactId: otherContact.id }).where(eq(payment.id, target.id)); await rejectBoth();
    await db.update(payment).set({ contactId: ownContact.id, bankAccountId: otherBank.id }).where(eq(payment.id, target.id)); await rejectBoth();
    await db.update(payment).set({ bankAccountId: bank.id }).where(eq(payment.id, target.id));
    await db.update(payment).set({ journalEntryId: otherJournal.id }).where(eq(payment.id, target.id)); await rejectBoth();
    await db.update(payment).set({ journalEntryId: journal.id, bankTransactionId: otherStatement.id }).where(eq(payment.id, target.id)); await rejectBoth();
    await db.update(payment).set({ bankTransactionId: statement.id }).where(eq(payment.id, target.id));
    const linked = await (await get(request(), params(target.id))).json();
    assert.equal(linked.payment.journalEntryId, journal.id); assert.equal(linked.payment.bankTransactionId, statement.id);
    for (const [documentType, documentId] of Object.entries(ownDocs)) {
      await db.update(paymentAllocation).set({ documentType, documentId }).where(eq(paymentAllocation.paymentId, target.id));
      assert.equal((await get(request(), params(target.id))).status, 200);
      await db.update(paymentAllocation).set({ documentId: otherDocs[documentType as keyof typeof otherDocs] }).where(eq(paymentAllocation.paymentId, target.id)); await rejectBoth();
    }
    for (const update of [{ documentType: "unknown", documentId: ownDocs.invoice }, { documentType: "invoice", documentId: randomUUID() }]) {
      await db.update(paymentAllocation).set(update).where(eq(paymentAllocation.paymentId, target.id)); await rejectBoth();
    }
    await db.update(paymentAllocation).set({ documentType: "invoice", documentId: ownDocs.invoice }).where(eq(paymentAllocation.paymentId, target.id));
    // Paired noncash offsets retain each allocation; they are not doubled or summed into cash.
    await db.update(payment).set({ amount: 0, method: "other", bankAccountId: null, journalEntryId: null, bankTransactionId: null }).where(eq(payment.id, target.id));
    await db.insert(paymentAllocation).values({ paymentId: target.id, documentType: "credit_note", documentId: ownDocs.credit_note, amount: 1250 });
    const carrier = await (await get(request(), params(target.id))).json();
    assert.equal(carrier.payment.amountMinor, "0"); assert.equal(carrier.payment.allocations.length, 2); assert.equal(carrier.payment.bankAccount, null);
    assert.deepEqual((await ma.call("get_payment", { paymentId: target.id })).body, carrier);
    await db.update(payment).set({ amount: 1250, bankAccountId: bank.id }).where(eq(payment.id, target.id));
    for (const [table, field, id] of [["payment", "amount", target.id], ["payment_allocation", "amount", carrier.payment.allocations[0].id],
      ["contact", "credit_limit", ownContact.id], ["bank_account", "balance", bank.id], ["bank_account", "low_balance_threshold", bank.id]] as const) {
      await db.execute(sql.raw(`update ${table} set ${field} = 9223372036854775807 where id = '${id}'`)); await rejectBoth();
      await db.execute(sql.raw(`update ${table} set ${field} = 1250 where id = '${id}'`));
    }
    await db.update(contact).set({ deletedAt: new Date(), creditLimit: null }).where(eq(contact.id, ownContact.id));
    await db.update(bankAccount).set({ isActive: false, deletedAt: new Date(), lowBalanceThreshold: null }).where(eq(bankAccount.id, bank.id));
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, ownDocs.invoice)); snap = await snapshot();
    const historical = await (await get(request(), params(target.id))).json();
    assert.equal(historical.payment.contact.creditLimitMinor, null); assert.equal(historical.payment.bankAccount.lowBalanceThresholdMinor, null);
    assert.deepEqual((await ma.call("get_payment", { paymentId: target.id })).body, historical); assert.deepEqual(await snapshot(), snap);
    console.log("REST and MCP payment reads verified");
  } finally {
    await ma.close(); await mb.close(); await readOnly.close();
    await (db as unknown as { $client: { end(): Promise<void> } }).$client.end();
  }
}
await run();
