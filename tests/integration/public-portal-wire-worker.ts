// Runs only in a randomly named disposable migrated database.
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, contact, invoice, invoiceLine, quote, quoteLine, portalAccessToken, portalActivityLog } from "../../lib/db/schema";
import { registerPublicPortalTools } from "../../lib/mcp/tools/public-portal";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as getPay } from "../../app/api/pay/[token]/route";
import { GET as getIdentity } from "../../app/api/portal/[token]/route";
import { GET as getInvoices } from "../../app/api/portal/[token]/invoices/route";
import { GET as getPayments } from "../../app/api/v1/portal/[token]/payments/route";
import { GET as getQuotes } from "../../app/api/v1/portal/[token]/quotes/route";
import { GET as getStatement } from "../../app/api/v1/portal/[token]/statements/route";
import { POST as accept } from "../../app/api/v1/portal/[token]/quotes/[id]/accept/route";
import { POST as approve } from "../../app/api/portal/[token]/invoices/[id]/approve/route";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Public portal fixture", version: "1.0.0" });
  registerPublicPortalTools(server, ctx);
  const client = new Client({ name: "Fixture client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  assert.ok(tools.tools.some(tool => tool.name === "create_invoice_checkout"));
  assert.ok(tools.tools.every(tool => tool.inputSchema.additionalProperties === false));
  return {
    async call(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as { type: string; text: string }[];
      return { isError: result.isError === true ? true : undefined,
        body: result.isError && !content[0].text.startsWith("{") ? { error: content[0].text } : JSON.parse(content[0].text) };
    },
    async close() { await client.close(); await server.close(); },
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Public fixture A", slug: "public-fixture-a" }, { name: "Public fixture B", slug: "public-fixture-b" },
  ]).returning();
  const [ca, other, cb] = await db.insert(contact).values([
    { organizationId: a.id, name: "Contact A" }, { organizationId: a.id, name: "Other A" }, { organizationId: b.id, name: "Contact B" },
  ]).returning();
  const [ta, tb, revoked, expired, inconsistent] = await db.insert(portalAccessToken).values([
    { organizationId: a.id, contactId: ca.id, token: "portal-a" },
    { organizationId: b.id, contactId: cb.id, token: "portal-b" },
    { organizationId: a.id, contactId: ca.id, token: "revoked", revokedAt: new Date() },
    { organizationId: a.id, contactId: ca.id, token: "expired", expiresAt: new Date("2000-01-01") },
    { organizationId: a.id, contactId: cb.id, token: "inconsistent" },
  ]).returning();
  const doc = { organizationId: a.id, contactId: ca.id, issueDate: "2000-01-01", dueDate: "2000-01-02", status: "sent" as const,
    subtotal: 1000, taxTotal: 250, total: 1250, amountDue: 1000, amountPaid: 250, currencyCode: "USD" };
  const [inv, foreign, otherInv, deleted, badContact] = await db.insert(invoice).values([
    { ...doc, invoiceNumber: "A1", paymentLinkToken: "pay-a" },
    { ...doc, organizationId: b.id, contactId: cb.id, invoiceNumber: "B1", paymentLinkToken: "pay-b" },
    { ...doc, contactId: other.id, invoiceNumber: "Other" },
    { ...doc, invoiceNumber: "Deleted", deletedAt: new Date(), paymentLinkToken: "pay-deleted" },
    { ...doc, contactId: cb.id, invoiceNumber: "Inconsistent", paymentLinkToken: "pay-inconsistent" },
  ]).returning();
  await db.insert(invoiceLine).values({ invoiceId: inv.id, description: "Synthetic line", unitPrice: 1000, amount: 1000, taxAmount: 250, quantity: 150, discountPercent: 1000 });
  const qdoc = { organizationId: a.id, contactId: ca.id, issueDate: "2000-01-01", expiryDate: "2999-01-01", status: "sent" as const,
    subtotal: 1000, taxTotal: 250, total: 1250, billedTotal: 0, currencyCode: "USD" };
  const [q1, q2, q3, qb, qo, qDeleted, qExpired, qDraft] = await db.insert(quote).values([
    { ...qdoc, quoteNumber: "REST accept" }, { ...qdoc, quoteNumber: "REST approve" }, { ...qdoc, quoteNumber: "MCP accept" },
    { ...qdoc, organizationId: b.id, contactId: cb.id, quoteNumber: "Foreign" },
    { ...qdoc, contactId: other.id, quoteNumber: "Other contact" },
    { ...qdoc, quoteNumber: "Deleted", deletedAt: new Date() }, { ...qdoc, quoteNumber: "Expired", expiryDate: "2000-01-02" },
    { ...qdoc, quoteNumber: "Draft", status: "draft" },
  ]).returning();
  await db.insert(quoteLine).values({ quoteId: q1.id, description: "Synthetic quote line", unitPrice: 1000, amount: 1000, taxAmount: 250, quantity: 150, discountPercent: 1000 });
  const req = (method = "GET", body?: unknown) => new Request("http://fixture.test/public", { method,
    headers: { "content-type": "application/json", "x-organization-id": b.id }, body: body === undefined ? undefined : JSON.stringify(body) });
  const params = (token: string, id = q1.id) => ({ params: Promise.resolve({ token, id }) });
  const counts = async () => (await db.execute(sql`select (select count(*) from portal_activity_log)::text as activities,
    (select count(*) from quote where status = 'accepted')::text as accepted`)).rows;
  const ctx: AuthContext = { userId: "00000000-0000-0000-0000-000000000001", organizationId: a.id, role: "owner" };
  const callA = await mcp(ctx), callB = await mcp({ ...ctx, organizationId: b.id });
  const denied = await mcp({ ...ctx, role: "member", permissions: [] });
  const reader = await mcp({ ...ctx, role: "member", permissions: ["view:data"] });

  // Old clients retain numbers/envelopes; exact clients consume additive strings on real operations.
  let response: Response = await getPay(req(), params("pay-a"));
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.invoice.total, 1250); assert.equal(body.invoice.totalMinor, "1250");
  assert.equal(body.invoice.amountDueMinor, "1000");
  assert.equal(body.invoice.lines[0].quantity, 150); assert.equal(body.invoice.lines[0].unitPriceMinor, "1000");
  assert.equal((await getPay(req(), params("missing"))).status, 404);
  assert.equal((await getPay(req(), params("pay-deleted"))).status, 404);
  assert.equal((await getPay(req(), params("pay-inconsistent"))).status, 404);
  body = await (await getIdentity(req(), params(ta.token))).json();
  assert.equal(body.contact.id, ca.id); assert.equal(body.organization.name, a.name);
  body = await (await getInvoices(req(), params(ta.token))).json();
  assert.equal(body.data.length, 1); assert.equal(body.data[0].id, inv.id); assert.equal(body.data[0].totalMinor, "1250");
  body = await (await getPayments(req(), params(ta.token))).json();
  assert.equal(body.data.length, 1); assert.equal(body.data[0].amountPaidMinor, "250");
  body = await (await getQuotes(req(), params(ta.token))).json();
  assert.ok(body.data.every((row: { organizationId: string; contactId: string }) => row.organizationId === a.id && row.contactId === ca.id));
  const line = body.data.find((row: { id: string }) => row.id === q1.id).lines[0];
  assert.equal(line.amountMinor, "1000"); assert.equal(line.quantity, 150); assert.equal(line.discountPercent, 1000);
  body = await (await getStatement(req(), params(ta.token))).json();
  assert.equal(body.totalOutstanding, 1000); assert.equal(body.totalOutstandingMinor, "1000");
  assert.equal(body.currencyCode, "USD"); assert.equal(body.lines[0].runningBalanceMinor, "1000");

  // Public bearer token is the grant; arbitrary organization headers cannot change it.
  assert.equal((await (await getInvoices(req(), params(tb.token))).json()).data[0].id, foreign.id);
  for (const get of [getIdentity, getInvoices, getPayments, getQuotes, getStatement]) {
    for (const token of ["missing", revoked.token, expired.token, inconsistent.token]) {
      const before = await counts();
      assert.ok([401, 404, 410].includes((await get(req(), params(token))).status));
      assert.deepEqual(await counts(), before);
    }
  }
  for (const [status, number] of [["paid", 200], ["draft", 400], ["void", 400]] as const) {
    await db.update(invoice).set({ status }).where(eq(invoice.id, inv.id));
    response = await getPay(req(), params("pay-a")); assert.equal(response.status, number);
    if (status === "paid") assert.deepEqual(await response.json(), { status: "paid", invoice: { invoiceNumber: "A1" } });
  }
  await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, inv.id));

  // Actual SDK/client calls validate strict schemas and organization/role restrictions.
  for (const [name, token] of [["get_payment_link", "pay-a"], ["get_portal_identity", ta.token], ["list_portal_invoices", ta.token],
    ["list_portal_payments", ta.token], ["list_portal_quotes", ta.token], ["get_portal_statement", ta.token]]) {
    assert.equal((await callA.call(name, { token })).isError, undefined);
    const before = await counts();
    assert.equal((await callB.call(name, { token })).isError, true);
    assert.equal((await denied.call(name, { token })).body.status, 403);
    assert.deepEqual(await counts(), before);
    assert.equal((await callA.call(name, { token, totalMinor: "1" })).isError, true);
  }
  assert.equal((await reader.call("get_portal_statement", { token: ta.token })).body.totalOutstandingMinor, "1000");
  assert.equal((await callB.call("get_payment_link", { token: "pay-b" })).body.invoice.totalMinor, "1250");
  for (const name of ["get_portal_identity", "list_portal_invoices", "list_portal_payments", "list_portal_quotes", "get_portal_statement"]) {
    for (const token of ["missing", revoked.token, expired.token, inconsistent.token]) assert.equal((await callA.call(name, { token })).isError, true);
  }

  // Unsupported input, token/contact/org/state and expiry failures leave status/activity unchanged.
  for (const operation of [accept, approve]) {
    for (const token of ["missing", revoked.token, expired.token, inconsistent.token]) {
      const before = await counts();
      assert.ok([401, 404, 410].includes((await operation(req("POST"), params(token))).status));
      assert.deepEqual(await counts(), before);
    }
    const beforeMalformed = await counts();
    assert.equal((await operation(new Request("http://fixture.test", { method: "POST", body: "{" }), params(ta.token))).status, 400);
    assert.equal((await operation(req("POST"), params(ta.token, "invalid-uuid"))).status, 400);
    assert.deepEqual(await counts(), beforeMalformed);
    for (const fields of [{ totalMinor: "1250" }, { amount: 1250 }, { rateExact: "1" }, { total: 1, totalMinor: "2" }]) {
      const before = await counts();
      assert.equal((await operation(req("POST", fields), params(ta.token))).status, 400);
      assert.deepEqual(await counts(), before);
    }
    for (const [token, id, status] of [[ta.token, qb.id, 404], [ta.token, qo.id, 404], [ta.token, qDeleted.id, 404],
      [ta.token, qDraft.id, 404], [ta.token, qExpired.id, 400], [tb.token, q1.id, 404]] as const) {
      const before = await counts();
      assert.equal((await operation(req("POST"), params(token, id))).status, status);
      assert.deepEqual(await counts(), before);
    }
  }
  let before = await counts();
  assert.equal((await callB.call("accept_portal_quote", { token: ta.token, quoteId: q3.id })).isError, true);
  assert.equal((await reader.call("accept_portal_quote", { token: ta.token, quoteId: q3.id })).body.status, 403);
  assert.equal((await callA.call("accept_portal_quote", { token: ta.token, quoteId: q3.id, totalMinor: "1250" })).isError, true);
  assert.deepEqual(await counts(), before);
  // A downstream activity failure must roll back the preceding status update.
  await db.execute(sql`create function fail_portal_activity() returns trigger language plpgsql as $$
    begin if NEW.action = 'approve_quote' then raise exception 'Synthetic portal activity failure'; end if; return NEW; end $$`);
  await db.execute(sql`create trigger portal_activity_failure before insert on portal_activity_log for each row execute function fail_portal_activity()`);
  assert.equal((await accept(req("POST"), params(ta.token, q1.id))).status, 500);
  assert.deepEqual(await counts(), before);
  assert.equal((await db.query.quote.findFirst({ where: eq(quote.id, q1.id) }))?.status, "sent");
  await db.execute(sql`drop trigger portal_activity_failure on portal_activity_log`);
  await db.execute(sql`drop function fail_portal_activity()`);
  response = await accept(req("POST", {}), params(ta.token, q1.id));
  assert.equal(response.status, 200); body = await response.json(); assert.equal(body.status, "accepted"); assert.equal(body.totalMinor, "1250");
  response = await approve(req("POST"), params(ta.token, q2.id));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { quote: { id: q2.id, status: "accepted" } });
  assert.equal((await callA.call("accept_portal_quote", { token: ta.token, quoteId: q3.id })).body.totalMinor, "1250");
  before = await counts();
  assert.equal((await accept(req("POST"), params(ta.token, q1.id))).status, 404);
  assert.equal((await callA.call("accept_portal_quote", { token: ta.token, quoteId: q3.id })).isError, true);
  assert.deepEqual(await counts(), before);

  // Deleted contacts invalidate the bearer grant before any monetary read or activity mutation.
  await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, ca.id));
  before = await counts();
  assert.equal((await getPay(req(), params("pay-a"))).status, 404);
  for (const get of [getIdentity, getInvoices, getPayments, getQuotes, getStatement]) {
    assert.ok([401, 404].includes((await get(req(), params(ta.token))).status));
  }
  assert.equal((await callA.call("list_portal_invoices", { token: ta.token })).body.status, 401);
  assert.deepEqual(await counts(), before);
  await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, ca.id));

  // Signed/large values and multi-currency statements retain units, with no precision recovery guesses.
  for (const currencyCode of ["IRR", "JPY", "KWD"]) {
    await db.update(invoice).set({ currencyCode, total: 2147483648, amountDue: -1250 }).where(eq(invoice.id, inv.id));
    body = await (await getPay(req(), params("pay-a"))).json();
    assert.equal(body.invoice.totalMinor, "2147483648"); assert.equal(body.invoice.amountDueMinor, "-1250");
    assert.equal((await callA.call("get_portal_statement", { token: ta.token })).body.totalOutstandingMinor, "-1250");
  }
  await db.update(invoice).set({ currencyCode: "USD", amountDue: Number.MAX_SAFE_INTEGER, total: Number.MAX_SAFE_INTEGER }).where(eq(invoice.id, inv.id));
  assert.equal((await (await getStatement(req(), params(ta.token))).json()).totalOutstandingMinor, "9007199254740991");
  const [extra] = await db.insert(invoice).values({ ...doc, invoiceNumber: "Sum overflow", amountDue: 1 }).returning();
  assert.equal((await getStatement(req(), params(ta.token))).status, 422);
  assert.equal((await callA.call("get_portal_statement", { token: ta.token })).body.code, "LEGACY_NUMERIC_RANGE");
  await db.update(invoice).set({ currencyCode: "EUR" }).where(eq(invoice.id, extra.id));
  assert.equal((await getStatement(req(), params(ta.token))).status, 422);
  await db.delete(invoice).where(eq(invoice.id, extra.id));

  // Raw historical values outside JS precision fail before activity/status mutations.
  await db.execute(sql`update invoice set total = 9007199254740992 where id = ${inv.id}`);
  before = await counts();
  for (const get of [getPay, getInvoices, getPayments, getStatement]) {
    response = await get(req(), params(get === getPay ? "pay-a" : ta.token));
    assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
  }
  for (const [name, token] of [["get_payment_link", "pay-a"], ["list_portal_invoices", ta.token], ["list_portal_payments", ta.token], ["get_portal_statement", ta.token]]) {
    assert.equal((await callA.call(name, { token })).body.code, "LEGACY_NUMERIC_RANGE");
  }
  assert.deepEqual(await counts(), before);
  await db.execute(sql`update quote set total = 9007199254740992 where id = ${qDraft.id}`);
  assert.equal((await getQuotes(req(), params(ta.token))).status, 422);
  assert.equal((await callA.call("list_portal_quotes", { token: ta.token })).body.status, 422);
  await db.execute(sql`update quote set status = 'sent' where id = ${qDraft.id}`);
  before = await counts();
  assert.equal((await accept(req("POST"), params(ta.token, qDraft.id))).status, 422);
  assert.equal((await approve(req("POST"), params(ta.token, qDraft.id))).status, 422);
  assert.equal((await callA.call("accept_portal_quote", { token: ta.token, quoteId: qDraft.id })).body.status, 422);
  assert.deepEqual(await counts(), before);
  const raw = await db.execute(sql`select total::text, status from quote where id = ${qDraft.id}`);
  assert.equal(raw.rows[0].total, "9007199254740992"); assert.equal(raw.rows[0].status, "sent");
  assert.ok((await db.select().from(portalActivityLog)).some(row => row.action === "approve_quote" && row.entityId === q3.id));
  // Retain fixture references to document ownership expectations.
  assert.notEqual(otherInv.contactId, inv.contactId); assert.ok(deleted.deletedAt); assert.equal(badContact.contactId, cb.id);
  await Promise.all([callA.close(), callB.close(), denied.close(), reader.close()]);
  console.log("Public REST and MCP portal contracts verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
