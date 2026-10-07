import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, contact, invoice, bill, creditNote, debitNote, payment, paymentAllocation, emailConfig, quote } from "../../lib/db/schema";
import { GET as statement } from "../../app/api/v1/contacts/[id]/statement/route";
import { GET as supplier } from "../../app/api/v1/contacts/[id]/supplier-statement/route";
import { GET as activity } from "../../app/api/v1/contacts/[id]/activity/route";
import { GET as print } from "../../app/api/v1/contacts/[id]/statement/pdf/route";
import { POST as email } from "../../app/api/v1/contacts/[id]/statement/email/route";
import { registerContactStatementTools } from "../../lib/mcp/tools/contact-statements";
import { getContactStatement } from "../../lib/api/contact-statements";
import { createInvoice } from "../../lib/api/invoice-writes";
import { encryptPassword } from "../../lib/email/smtp-client";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Statement fixture", version: "1" }); registerContactStatementTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  assert.equal((await client.listTools()).tools.length, 5);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Statement <A>", slug: "sta" }, { name: "Statement B", slug: "stb" }]).returning();
  const [owner, denied, reader] = await db.insert(users).values([{ email: "st-owner@example.test" }, { email: "st-denied@example.test" }, { email: "st-reader@example.test" }]).returning();
  const roles = await db.insert(customRole).values([{ organizationId: a.id, name: "No read", permissions: [] }, { organizationId: a.id, name: "Only read", permissions: ["view:data"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: roles[0].id }, { organizationId: a.id, userId: reader.id, role: "member", customRoleId: roles[1].id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_st_a", b: "dk_st_b", denied: "dk_st_denied", reader: "dk_st_reader" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : label === "reader" ? reader.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_st" });
  const [c, foreign, customer, empty] = await db.insert(contact).values([{ organizationId: a.id, name: "<script>secret</script>", type: "both", email: "contact@example.test" },
    { organizationId: b.id, name: "Foreign secret", type: "both" }, { organizationId: a.id, name: "Customer", type: "customer" }, { organizationId: a.id, name: "Empty", type: "both" }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), noRead = await mcp({ ...ctx, permissions: [] }), readOnly = await mcp({ ...ctx, permissions: ["view:data"] }), mb = await mcp({ ...ctx, organizationId: b.id });
  const params = (id = c.id) => ({ params: Promise.resolve({ id }) });
  const period = { startDate: "2024-02-01", endDate: "2024-02-29" };
  const query = "?startDate=2024-02-01&endDate=2024-02-29";
  const request = (suffix: string, q = query, key = keys.a, body?: unknown) => new Request(`http://fixture.test/api/v1/contacts/${c.id}/${suffix}${q}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" }, method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "bill", "quote", "credit_note", "debit_note", "payment", "payment_allocation", "audit_log", "email_config"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  const delivered: { to: string; subject: string; html: string }[] = [];
  const originalTransport = nodemailer.createTransport;
  // Record only; the fixture never contacts SMTP or sends a real message.
  nodemailer.createTransport = (() => ({ sendMail: async (mail: typeof delivered[number]) => { delivered.push(mail); return {}; } })) as typeof nodemailer.createTransport;
  let sequence = 0;
  const inv = async (amount: number, date: string, options: { currency?: string; status?: "sent" | "draft" | "void"; deleted?: boolean; org?: string; contactId?: string } = {}) =>
    (await db.insert(invoice).values({ organizationId: options.org ?? a.id, contactId: options.contactId ?? c.id, invoiceNumber: `STI-${++sequence}`,
      issueDate: date, dueDate: date, status: options.status ?? "sent", total: amount, amountDue: 0, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null }).returning())[0];
  const pay = async (amount: number, date: string, type: "received" | "made" = "received") =>
    (await db.insert(payment).values({ organizationId: a.id, contactId: c.id, paymentNumber: `STP-${++sequence}`, date, amount, type, currencyCode: "USD" }).returning())[0];
  try {
    assert.equal((await (await statement(request("statement"), params(empty.id))).json()).closingBalanceMinor, "0");
    assert.equal((await supplier(request("supplier-statement"), params(customer.id))).status, 400);
    const prior = await inv(1000, "2024-01-01"); await pay(200, "2024-01-15");
    await db.insert(bill).values([{ organizationId: a.id, contactId: c.id, billNumber: "STB-prior", issueDate: "2024-01-01", dueDate: "2024-01-01", status: "received", total: 500, amountDue: 0 },
      { organizationId: a.id, contactId: c.id, billNumber: "STB-now", issueDate: "2024-02-01", dueDate: "2024-02-01", status: "received", total: 400, amountDue: 0 }]);
    await pay(100, "2024-01-20", "made");
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
      const saved = await createInvoice(ctx, { contactId: c.id, issueDate: "2024-02-01", dueDate: "2024-02-29", lines: [{ description: "<unsafe & text>", ...price }] }, "rest");
      await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, saved.invoice.id));
    }
    const [cn] = await db.insert(creditNote).values({ organizationId: a.id, contactId: c.id, creditNoteNumber: "STCN", issueDate: "2024-02-01", status: "sent", total: 50 }).returning();
    await db.insert(debitNote).values({ organizationId: a.id, contactId: c.id, debitNoteNumber: "STDN", issueDate: "2024-02-01", status: "sent", total: 25 });
    await pay(100, "2024-02-29"); await pay(75, "2024-02-29", "made");
    const carrier = await pay(50, "2024-02-10"); await db.insert(paymentAllocation).values({ paymentId: carrier.id, documentType: "credit_note", documentId: cn.id, amount: 50 });
    await db.insert(paymentAllocation).values({ paymentId: carrier.id, documentType: "invoice", documentId: prior.id, amount: 50 });
    await db.insert(quote).values({ organizationId: a.id, contactId: c.id, quoteNumber: "STQ", issueDate: "2024-02-05", expiryDate: "2024-03-01", total: 99 });
    for (const options of [{ status: "draft" as const }, { status: "void" as const }, { deleted: true }, { org: b.id, contactId: foreign.id }]) await inv(999, "2024-02-01", options);
    await inv(999, "2024-03-01");
    let before = await snapshot();
    const json = await (await statement(request("statement"), params())).json();
    assert.equal(json.openingBalanceMinor, "400"); assert.equal(json.closingBalanceMinor, "2450");
    assert.equal(json.totalDebitMinor, "2600"); assert.equal(json.totalCreditMinor, "550");
    assert.equal(json.transactions.length, 7); assert.deepEqual((await ma.call("get_contact_statement", { contactId: c.id, ...period })).body, json);
    const ap = await (await supplier(request("supplier-statement"), params())).json();
    assert.equal(ap.openingBalanceMinor, "400"); assert.equal(ap.closingBalanceMinor, "700"); assert.equal(ap.totalBilledMinor, "400"); assert.equal(ap.totalPaidOrCreditedMinor, "100");
    assert.deepEqual((await ma.call("get_purchasing_supplier_statement", { contactId: c.id, ...period })).body.statement, ap);
    const html = await (await print(request("statement/pdf"), params())).text();
    assert.match(html, /\$24\.50/); assert.match(html, /&lt;script&gt;secret/); assert.ok(!html.includes("<script>secret"));
    assert.equal((await ma.call("export_contact_statement", { contactId: c.id, ...period })).body.html, html);
    const feed = await (await activity(request("activity", "?startDate=2024-02-01&endDate=2024-02-29&limit=100"), params())).json();
    assert.deepEqual((await ma.call("get_contact_activity", { contactId: c.id, ...period, limit: 100 })).body, feed);
    assert.ok(feed.activity.some((r: { type: string; amountMinor: string }) => r.type === "quote" && r.amountMinor === "99"));
    const page = await (await activity(request("activity", "?limit=1"), params())).json(); assert.equal(page.activity.length, 1); assert.equal(page.hasMore, true);
    assert.equal((await activity(request("activity", `?cursor=${encodeURIComponent(page.nextCursor)}&limit=1`), params())).status, 200);
    for (const [handler, suffix, tool] of [[statement, "statement", "get_contact_statement"], [supplier, "supplier-statement", "get_purchasing_supplier_statement"], [activity, "activity", "get_contact_activity"], [print, "statement/pdf", "export_contact_statement"]] as const) {
      const q = handler === activity ? "" : query;
      assert.equal((await handler(request(suffix, q, keys.denied), params())).status, 403);
      assert.equal((await handler(request(suffix, q, "dk_invalid"), params())).status, 401);
      assert.equal((await handler(request(suffix, q, keys.b), params())).status, 404);
      assert.equal((await handler(request(suffix, q), params(foreign.id))).status, 404);
      assert.equal((await handler(request(suffix, q), params("bad"))).status, 400);
      assert.equal((await noRead.call(tool, { contactId: c.id })).body.status, 403);
      assert.equal((await mb.call(tool, { contactId: c.id })).body.status, 404);
    }
    for (const q of ["?startDate=2023-02-29", "?endDate=", "?unknown=1", "?startDate=2024-03-01&endDate=2024-02-29"])
      for (const handler of [statement, supplier, print]) assert.equal((await handler(request("statement", q), params())).status, 400);
    for (const q of ["?limit=0", "?limit=30x", "?cursor=invalid", "?type=unknown", "?startDate=infinity"])
      assert.equal((await activity(request("activity", q), params())).status, 400);
    assert.equal((await ma.call("get_contact_statement", { contactId: c.id, startDate: "2023-02-29" })).isError, true);
    assert.equal((await email(request("statement/email", "", keys.reader, period), params())).status, 403);
    assert.equal((await readOnly.call("email_contact_statement", { contactId: c.id, ...period })).body.status, 403);
    assert.equal((await noRead.call("email_contact_statement", { contactId: c.id, ...period })).body.status, 403);
    assert.equal((await mb.call("email_contact_statement", { contactId: c.id, ...period })).body.status, 404);
    assert.equal((await ma.call("email_contact_statement", { contactId: foreign.id, ...period })).body.status, 404);
    assert.equal((await ma.call("get_purchasing_supplier_statement", { contactId: customer.id, ...period })).body.status, 400);
    assert.equal((await email(request("statement/email", "", keys.a, period), params())).status, 400); // no SMTP config
    assert.equal(delivered.length, 0); assert.deepEqual(await snapshot(), before);
    await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture.invalid", smtpUsername: "fixture", smtpPassword: encryptPassword("synthetic"), fromEmail: "from@example.test" });
    before = await snapshot();
    assert.equal((await email(request("statement/email", "", keys.a, period), params())).status, 200);
    assert.equal((await ma.call("email_contact_statement", { contactId: c.id, ...period })).body.success, true);
    assert.equal(delivered.length, 2); assert.equal(delivered[0].html, delivered[1].html); assert.equal(delivered[0].to, c.email);
    assert.match(delivered[0].html, /\$24\.50/); assert.ok(!delivered[0].html.includes("<script>secret"));
    for (const body of [{ startDate: "" }, { ...period, amountMinor: "1" }, { startDate: "2024-03-01", endDate: "2024-02-29" }])
      assert.equal((await email(request("statement/email", "", keys.a, body), params())).status, 400);
    assert.equal((await email(request("statement/email", "", keys.a, period), params(foreign.id))).status, 404);
    assert.equal(delivered.length, 2); assert.deepEqual(await snapshot(), before);
    assert.equal((await email(request("statement/email", "", "dk_invalid", period), params())).status, 401);
    assert.equal((await email(request("statement/email", "", keys.a, period), params(empty.id))).status, 400);
    const malformed = new Request("http://fixture.test/email", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    assert.equal((await email(malformed, params())).status, 400); assert.equal(delivered.length, 2);
    const jpy = await inv(1250, "2024-02-01", { currency: "JPY" });
    assert.equal((await statement(request("statement"), params())).status, 422);
    assert.equal((await print(request("statement/pdf"), params())).status, 422);
    assert.equal((await email(request("statement/email", "", keys.a, period), params())).status, 422);
    assert.equal((await ma.call("get_contact_statement", { contactId: c.id, ...period })).body.code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await ma.call("email_contact_statement", { contactId: c.id, ...period })).body.code, "LEGACY_NUMERIC_RANGE");
    const filtered = await (await statement(request("statement", query + "&currencyCode=JPY"), params())).json(); assert.equal(filtered.closingBalanceMinor, "1250"); assert.equal(filtered.currencyCode, "JPY");
    assert.match(await (await print(request("statement/pdf", query + "&currencyCode=JPY"), params())).text(), /1,250/);
    for (const [currencyCode, pattern] of [["IRR", /1,250/], ["KWD", /1\.250/]] as const) {
      await db.update(invoice).set({ currencyCode }).where(eq(invoice.id, jpy.id));
      const filteredQuery = query + `&currencyCode=${currencyCode}`;
      assert.equal((await (await statement(request("statement", filteredQuery), params())).json()).closingBalanceMinor, "1250");
      assert.match(await (await print(request("statement/pdf", filteredQuery), params())).text(), pattern);
      assert.deepEqual((await ma.call("get_contact_statement", { contactId: c.id, ...period, currencyCode })).body,
        await (await statement(request("statement", filteredQuery), params())).json());
    }
    assert.equal(delivered.length, 2);
    await db.delete(invoice).where(eq(invoice.id, jpy.id));
    // Exact safe limits, intermediate cancellation and unsafe final balances.
    await db.delete(invoice).where(eq(invoice.organizationId, a.id)); await db.delete(bill).where(eq(bill.organizationId, a.id));
    await db.delete(creditNote).where(eq(creditNote.organizationId, a.id)); await db.delete(debitNote).where(eq(debitNote.organizationId, a.id));
    await db.delete(payment).where(eq(payment.organizationId, a.id));
    const edge = await inv(Number.MAX_SAFE_INTEGER, "2024-01-01");
    assert.equal((await (await statement(request("statement"), params())).json()).closingBalanceMinor, "9007199254740991");
    await inv(Number.MAX_SAFE_INTEGER, "2024-01-01"); await pay(Number.MAX_SAFE_INTEGER, "2024-01-01");
    assert.equal((await (await statement(request("statement"), params())).json()).openingBalanceMinor, "9007199254740991");
    const extra = await inv(1, "2024-02-01");
    before = await snapshot();
    for (const handler of [statement, print]) assert.equal((await handler(request("statement"), params())).status, 422);
    assert.equal((await email(request("statement/email", "", keys.a, period), params())).status, 422); assert.equal(delivered.length, 2);
    assert.equal((await ma.call("email_contact_statement", { contactId: c.id, ...period })).body.code, "LEGACY_NUMERIC_RANGE"); assert.equal(delivered.length, 2);
    assert.equal((await ma.call("get_contact_statement", { contactId: c.id, ...period })).body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), before);
    await db.delete(invoice).where(eq(invoice.id, extra.id));
    await db.execute(sql`update ${invoice} set total = 9223372036854775807 where id = ${edge.id}`);
    for (const handler of [statement, activity]) assert.equal((await handler(request("statement", ""), params())).status, 422);
    await db.execute(sql`update ${invoice} set total = -9007199254740991 where id = ${edge.id}`);
    assert.equal((await (await statement(request("statement"), params())).json()).closingBalanceMinor, "-9007199254740991");
    await assert.rejects(getContactStatement({ ...ctx, permissions: [] }, c.id, {}), { status: 403 });
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, c.id));
    assert.equal((await statement(request("statement"), params())).status, 404); assert.equal((await activity(request("activity", ""), params())).status, 404);
    await assert.rejects(getContactStatement(ctx, randomUUID(), {}), { status: 404 });
    console.log("REST and MCP contact statements verified");
  } finally { nodemailer.createTransport = originalTransport; await Promise.all([ma.close(), mb.close(), noRead.close(), readOnly.close()]); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
