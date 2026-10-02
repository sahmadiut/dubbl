// Invoked only against a disposable migrated database by contact-wire.test.ts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, contactPerson, invoice, bill, auditLog,
  bankAccount, bankTransaction, paymentBatch, paymentBatchItem, tag, entityTag } from "../../lib/db/schema";
import { GET, POST } from "../../app/api/v1/contacts/route";
import { GET as getContact, PATCH, DELETE } from "../../app/api/v1/contacts/[id]/route";
import { POST as mergeContacts } from "../../app/api/v1/contacts/[id]/merge/route";
import { registerContactTools } from "../../lib/mcp/tools/contacts";
import type { AuthContext } from "../../lib/api/auth-context";

type Result = { content: { text: string }[]; isError?: boolean };
function tools(ctx: AuthContext) {
  const registered = new Map<string, { schema: z.ZodObject; handler: (input: unknown) => Promise<Result> }>();
  const server = { tool(name: string, _description: string, shape: z.ZodRawShape, handler: (input: unknown) => Promise<Result>) {
    registered.set(name, { schema: z.object(shape), handler });
  } } as unknown as McpServer;
  registerContactTools(server, ctx);
  assert.equal(registered.size, 6);
  return async (name: string, input: unknown) => {
    const tool = registered.get(name)!;
    const result = await tool.handler(tool.schema.parse(input));
    return { ...result, body: JSON.parse(result.content[0].text) };
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Contact wire A", slug: "contact-wire-a" }, { name: "Contact wire B", slug: "contact-wire-b" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { name: "Synthetic owner", email: "contact-owner@example.test" }, { name: "Synthetic viewer", email: "contact-viewer@example.test" },
  ]).returning();
  const [readOnly] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: readOnly.id },
  ]);
  const keys = { a: "dk_synthetic_contact_a", b: "dk_synthetic_contact_b", viewer: "dk_synthetic_contact_viewer" };
  for (const [name, key] of Object.entries(keys)) {
    await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id, createdBy: name === "viewer" ? viewer.id : owner.id,
      name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_synthetic" });
  }
  const request = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/contacts${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const snapshot = async () => ({ contacts: await db.select().from(contact).orderBy(contact.id), audits: await db.select().from(auditLog).orderBy(auditLog.id) });
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const callA = tools(ctx), callB = tools({ ...ctx, organizationId: b.id });
  const denied = tools({ ...ctx, userId: viewer.id, role: "member", permissions: [] });

  // Legacy-only, exact-only, dual and omitted create inputs retain envelopes and units.
  let id = "";
  for (const fields of [{}, { creditLimit: 1250 }, { creditLimitMinor: "2147483648" },
    { creditLimit: 0, creditLimitMinor: "0" }, { creditLimitMinor: String(Number.MAX_SAFE_INTEGER) }]) {
    const response = await POST(request("POST", { name: "REST fixture", ...fields }));
    assert.equal(response.status, 201);
    const saved = (await response.json()).contact;
    assert.equal(saved.organizationId, a.id, "API-key organization overrides arbitrary organization header");
    assert.equal(saved.currencyCode, "USD");
    assert.equal(saved.creditLimitMinor, saved.creditLimit === null ? null : String(saved.creditLimit));
    id = saved.id;
  }
  for (const fields of [{ creditLimit: 1250 }, { creditLimitMinor: "2147483648" },
    { creditLimit: 0, creditLimitMinor: "0" }, { creditLimitMinor: null }, { creditLimit: null }]) {
    const response = await PATCH(request("PATCH", fields), params(id));
    assert.equal(response.status, 200);
    const saved = (await response.json()).contact;
    assert.equal(saved.creditLimitMinor, saved.creditLimit === null ? null : String(saved.creditLimit));
  }
  await PATCH(request("PATCH", { creditLimitMinor: "1250" }), params(id));
  await PATCH(request("PATCH", { name: "Rename preserves limit" }), params(id));
  assert.equal((await (await getContact(request("GET"), params(id))).json()).contact.creditLimitMinor, "1250");

  // Every malformed/conflicting/unsupported request leaves contacts and audits untouched.
  for (const [fields, status] of [
    [{ creditLimit: 1250, creditLimitMinor: "1251" }, 400], [{ creditLimit: null, creditLimitMinor: "0" }, 400],
    [{ creditLimit: 0, creditLimitMinor: null }, 400], [{ creditLimitMinor: "01" }, 400], [{ creditLimitMinor: "-1" }, 400],
    [{ creditLimitMinor: "۱" }, 400], [{ creditLimitMinor: "1e3" }, 400], [{ creditLimit: Number.MAX_SAFE_INTEGER + 1 }, 400],
    [{ creditLimitMinor: "9007199254740992" }, 422], [{ creditLimitMinor: "9223372036854775807" }, 422],
    [{ creditLimitMinor: "9223372036854775808" }, 400],
  ] as const) {
    const before = await snapshot();
    for (const response of [await POST(request("POST", { name: "Rejected", ...fields })), await PATCH(request("PATCH", fields), params(id))]) {
      assert.equal(response.status, status);
      if (status === 422) assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
    }
    assert.deepEqual(await snapshot(), before);
  }
  let before = await snapshot();
  assert.equal((await POST(request("POST", { name: "Denied", creditLimitMinor: "1250" }, keys.viewer))).status, 403);
  assert.equal((await PATCH(request("PATCH", { creditLimitMinor: "1250" }, keys.viewer), params(id))).status, 403);
  assert.equal((await DELETE(request("DELETE", undefined, keys.viewer), params(id))).status, 403);
  assert.equal((await POST(request("POST", { name: "Unauthenticated" }, "dk_invalid"))).status, 401);
  assert.equal((await getContact(request("GET", undefined, keys.b), params(id))).status, 404);
  assert.equal((await PATCH(request("PATCH", { creditLimitMinor: "1" }, keys.b), params(id))).status, 404);
  assert.equal((await DELETE(request("DELETE", undefined, keys.b), params(id))).status, 404);
  assert.equal((await mergeContacts(request("POST", { targetContactId: id }, keys.b), params(id))).status, 400);
  assert.equal((await mergeContacts(request("POST", { targetContactId: id }, keys.viewer), params(id))).status, 403);
  assert.deepEqual(await snapshot(), before);

  // Real SQL aggregates no longer cast to int32; ignore deleted/draft/foreign-org rows.
  const doc = { contactId: id, issueDate: "2000-01-01", dueDate: "2000-01-02", currencyCode: "USD" };
  await db.insert(invoice).values([
    { ...doc, organizationId: a.id, invoiceNumber: "A1", status: "sent", amountDue: 2147483648 },
    { ...doc, organizationId: a.id, invoiceNumber: "A2", status: "partial", amountDue: 1250 },
    { ...doc, organizationId: a.id, invoiceNumber: "Draft", status: "draft", amountDue: 999 },
    { ...doc, organizationId: a.id, invoiceNumber: "Deleted", status: "sent", amountDue: 999, deletedAt: new Date() },
    { ...doc, organizationId: b.id, invoiceNumber: "Foreign", status: "sent", amountDue: 999 },
  ]);
  await db.insert(bill).values({ ...doc, organizationId: a.id, billNumber: "B1", status: "received", amountDue: 2147483648 });
  let response = await GET(request("GET"));
  assert.equal(response.status, 200);
  const listed = (await response.json()).data;
  assert.ok(listed.every((row: { organizationId: string }) => row.organizationId === a.id));
  const balance = listed.find((row: { id: string }) => row.id === id);
  assert.equal(balance.owesYou, 2147484898); assert.equal(balance.owesYouMinor, "2147484898");
  assert.equal(balance.youOweMinor, "2147483648"); assert.equal(balance.overdueMinor, "4294968546");
  assert.equal(balance.creditLimitMinor, "1250");
  const [foreignCurrency] = await db.insert(invoice).values({ ...doc, currencyCode: "EUR", organizationId: a.id, invoiceNumber: "EUR", status: "sent", amountDue: 1 }).returning();
  assert.equal((await GET(request("GET"))).status, 422);
  await db.delete(invoice).where(eq(invoice.id, foreignCurrency.id));
  const [large] = await db.insert(invoice).values({ ...doc, organizationId: a.id, invoiceNumber: "Large", status: "sent", amountDue: Number.MAX_SAFE_INTEGER }).returning();
  response = await GET(request("GET"));
  assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
  await db.delete(invoice).where(eq(invoice.id, large.id));

  // Combined overdue must be guarded even when each document-side total is safe.
  const [edge] = await db.insert(contact).values({ organizationId: a.id, name: "Aggregate edge" }).returning();
  await db.insert(invoice).values({ ...doc, contactId: edge.id, organizationId: a.id, invoiceNumber: "Edge", status: "sent", amountDue: Number.MAX_SAFE_INTEGER });
  const [edgeBill] = await db.insert(bill).values({ ...doc, contactId: edge.id, organizationId: a.id, billNumber: "Edge", status: "received", amountDue: 1 }).returning();
  assert.equal((await GET(request("GET", undefined, keys.a, "?search=Aggregate%20edge"))).status, 422);
  await db.update(bill).set({ dueDate: "2999-01-01" }).where(eq(bill.id, edgeBill.id));
  response = await GET(request("GET", undefined, keys.a, "?search=Aggregate%20edge"));
  assert.equal(response.status, 200);
  const edgeBalance = (await response.json()).data[0];
  assert.equal(edgeBalance.owesYou, Number.MAX_SAFE_INTEGER);
  assert.equal(edgeBalance.owesYouMinor, "9007199254740991");
  assert.equal(edgeBalance.overdueMinor, "9007199254740991");

  // Actual registered tools validate before writes and maintain numeric/string compatibility.
  let mcpId = "";
  for (const fields of [{}, { creditLimit: 1250 }, { creditLimitMinor: "2147483648" }, { creditLimit: 0, creditLimitMinor: "0" }]) {
    const saved = await callA("create_contact", { name: "MCP fixture", currencyCode: " usd ", ...fields });
    assert.equal(saved.isError, undefined);
    assert.equal(saved.body.contact.currencyCode, "USD");
    mcpId = saved.body.contact.id;
    assert.equal(saved.body.contact.creditLimitMinor, saved.body.contact.creditLimit === null ? null : String(saved.body.contact.creditLimit));
  }
  for (const fields of [{ creditLimit: 1250 }, { creditLimitMinor: String(Number.MAX_SAFE_INTEGER) },
    { creditLimit: 0, creditLimitMinor: "0" }, { creditLimitMinor: null }, { name: "Rename" }]) {
    assert.equal((await callA("update_contact", { contactId: mcpId, ...fields })).isError, undefined);
  }
  for (const input of [{ creditLimitMinor: "9007199254740992" }, { creditLimit: 1, creditLimitMinor: "2" }, { creditLimit: 0, creditLimitMinor: null }]) {
    before = await snapshot();
    assert.equal((await callA("create_contact", { name: "Rejected MCP", ...input })).isError, true);
    assert.equal((await callA("update_contact", { contactId: mcpId, ...input })).isError, true);
    assert.deepEqual(await snapshot(), before);
  }
  for (const input of [{ creditLimitMinor: "01" }, { creditLimitMinor: "-1" }, { creditLimit: Number.MAX_SAFE_INTEGER + 1 }]) {
    before = await snapshot();
    await assert.rejects(callA("create_contact", { name: "Malformed", ...input }), z.ZodError);
    await assert.rejects(callA("update_contact", { contactId: mcpId, ...input }), z.ZodError);
    assert.deepEqual(await snapshot(), before);
  }
  before = await snapshot();
  await assert.rejects(callA("create_contact", { name: "Invalid currency", currencyCode: "INVALID", creditLimitMinor: "1250" }), z.ZodError);
  assert.deepEqual(await snapshot(), before);
  before = await snapshot();
  assert.equal((await denied("create_contact", { name: "Denied" })).body.status, 403);
  assert.equal((await denied("update_contact", { contactId: mcpId, creditLimitMinor: "1" })).body.status, 403);
  assert.equal((await denied("delete_contact", { contactId: mcpId })).body.status, 403);
  assert.equal((await denied("merge_contacts", { sourceContactId: mcpId, targetContactId: id })).body.status, 403);
  assert.equal((await callB("get_contact", { contactId: mcpId })).isError, true);
  assert.equal((await callB("update_contact", { contactId: mcpId, creditLimitMinor: "1" })).isError, true);
  assert.equal((await callB("delete_contact", { contactId: mcpId })).isError, true);
  assert.equal((await callB("merge_contacts", { sourceContactId: mcpId, targetContactId: id })).isError, true);
  assert.deepEqual(await snapshot(), before);
  const [tenantB] = await db.insert(contact).values({ organizationId: b.id, name: "Tenant B", creditLimit: 777 }).returning();
  assert.ok((await callA("list_contacts", {})).body.contacts.every((row: { organizationId: string }) => row.organizationId === a.id));
  assert.equal((await callB("list_contacts", {})).body.contacts[0].creditLimitMinor, "777");
  assert.equal((await callB("get_contact", { contactId: tenantB.id })).body.contact.creditLimitMinor, "777");
  assert.equal((await callA("get_contact", { contactId: mcpId })).body.contact.creditLimitMinor, null);

  // Parent-scoped merge mutations do not modify other tenants' inconsistent child references.
  const accounts = await db.insert(bankAccount).values([
    { organizationId: a.id, accountName: "Parent A" }, { organizationId: b.id, accountName: "Parent B" },
  ]).returning();
  const batches = await db.insert(paymentBatch).values([
    { organizationId: a.id, name: "Parent A" }, { organizationId: b.id, name: "Parent B" },
  ]).returning();
  const tags = await db.insert(tag).values([
    { organizationId: a.id, name: "Move" }, { organizationId: b.id, name: "Foreign" }, { organizationId: a.id, name: "Dedupe" },
  ]).returning();
  await db.insert(entityTag).values({ tagId: tags[2].id, entityType: "contact", entityId: id });
  for (const transport of ["REST", "MCP"]) {
    const [source] = await db.insert(contact).values({ organizationId: a.id, name: `Merge ${transport}`, creditLimit: 222 }).returning();
    const bankRows = await db.insert(bankTransaction).values(accounts.map(account => ({ bankAccountId: account.id,
      contactId: source.id, date: "2000-01-01", description: "Synthetic merge reference", amount: 1250 }))).returning();
    const batchRows = await db.insert(paymentBatchItem).values(batches.map(batch => ({ batchId: batch.id, contactId: source.id, amount: 1250 }))).returning();
    const tagRows = await db.insert(entityTag).values(tags.map(value => ({ tagId: value.id, entityType: "contact", entityId: source.id }))).returning();
    const [person] = await db.insert(contactPerson).values({ contactId: source.id, name: "Synthetic person" }).returning();
    const beforeMerge = await snapshot();
    assert.equal((await mergeContacts(request("POST", { targetContactId: id }, keys.b), params(source.id))).status, 404);
    assert.equal((await callB("merge_contacts", { sourceContactId: source.id, targetContactId: id })).isError, true);
    assert.deepEqual(await snapshot(), beforeMerge);
    if (transport === "REST") {
      const merged = await mergeContacts(request("POST", { targetContactId: id }), params(source.id));
      assert.equal(merged.status, 200); assert.equal((await merged.json()).success, true);
    } else {
      assert.equal((await callA("merge_contacts", { sourceContactId: source.id, targetContactId: id })).body.success, true);
    }
    for (let i = 0; i < 2; i++) {
      const bankRow = await db.query.bankTransaction.findFirst({ where: eq(bankTransaction.id, bankRows[i].id) });
      const batchRow = await db.query.paymentBatchItem.findFirst({ where: eq(paymentBatchItem.id, batchRows[i].id) });
      assert.equal(bankRow?.contactId, i === 0 ? id : source.id); assert.equal(bankRow?.amount, 1250);
      assert.equal(batchRow?.contactId, i === 0 ? id : source.id); assert.equal(batchRow?.amount, 1250);
    }
    assert.equal((await db.query.entityTag.findFirst({ where: eq(entityTag.id, tagRows[0].id) }))?.entityId, transport === "REST" ? id : undefined);
    assert.ok(await db.query.entityTag.findFirst({ where: and(eq(entityTag.tagId, tags[0].id), eq(entityTag.entityId, id)) }));
    assert.equal((await db.query.entityTag.findFirst({ where: eq(entityTag.id, tagRows[1].id) }))?.entityId, source.id);
    assert.equal(await db.query.entityTag.findFirst({ where: eq(entityTag.id, tagRows[2].id) }), undefined);
    assert.equal((await db.query.contactPerson.findFirst({ where: eq(contactPerson.id, person.id) }))?.contactId, id);
    assert.equal((await getContact(request("GET"), params(source.id))).status, 404);
  }

  // Existing merge and soft-delete paths preserve amounts, target limit and foreign organization.
  const mergeDoc = await db.insert(invoice).values({ ...doc, contactId: mcpId, organizationId: a.id, invoiceNumber: "Merge", status: "sent", amountDue: 1250 }).returning();
  assert.equal((await callA("merge_contacts", { sourceContactId: mcpId, targetContactId: id })).body.success, true);
  const moved = await db.query.invoice.findFirst({ where: eq(invoice.id, mergeDoc[0].id) });
  assert.equal(moved?.contactId, id); assert.equal(moved?.amountDue, 1250);
  assert.equal((await callA("get_contact", { contactId: mcpId })).isError, true);
  assert.equal((await callA("get_contact", { contactId: id })).body.contact.creditLimitMinor, "1250");
  const extra = (await callA("create_contact", { name: "Delete fixture", creditLimitMinor: "1250" })).body.contact;
  assert.equal((await callA("delete_contact", { contactId: extra.id })).body.success, true);
  assert.equal((await getContact(request("GET"), params(extra.id))).status, 404);
  assert.equal((await DELETE(request("DELETE"), params(id))).status, 200);
  assert.equal((await DELETE(request("DELETE"), params(id))).status, 404);
  const foreign = await db.query.contact.findFirst({ where: and(eq(contact.id, tenantB.id), eq(contact.organizationId, b.id)) });
  assert.equal(foreign?.creditLimit, 777); assert.equal(foreign?.deletedAt, null);
  const audits = await db.select().from(auditLog);
  for (const action of ["create", "update", "delete", "merge"]) assert.ok(audits.some(row => row.action === action && row.organizationId === a.id));

  // Unsafe historical ORM reads fail before update/merge/delete; no rounded recovery alias.
  const [unsafe] = await db.insert(contact).values({ organizationId: a.id, name: "Unsafe history" }).returning();
  await db.execute(sql`update ${contact} set credit_limit = 9007199254740992 where id = ${unsafe.id}`);
  response = await PATCH(request("PATCH", { name: "Must not mutate" }), params(unsafe.id));
  assert.equal(response.status, 422);
  assert.equal((await DELETE(request("DELETE"), params(unsafe.id))).status, 422);
  assert.equal((await getContact(request("GET"), params(unsafe.id))).status, 422);
  assert.equal((await GET(request("GET"))).status, 422);
  assert.equal((await mergeContacts(request("POST", { targetContactId: tenantB.id }), params(unsafe.id))).status, 422);
  assert.equal((await callA("list_contacts", {})).body.status, 422);
  assert.equal((await callA("get_contact", { contactId: unsafe.id })).body.status, 422);
  assert.equal((await callA("update_contact", { contactId: unsafe.id, name: "Must not mutate" })).body.status, 422);
  assert.equal((await callA("delete_contact", { contactId: unsafe.id })).body.status, 422);
  assert.equal((await callA("merge_contacts", { sourceContactId: unsafe.id, targetContactId: tenantB.id })).body.status, 422);
  const raw = await db.execute(sql`select name, credit_limit::text as amount, deleted_at from ${contact} where id = ${unsafe.id}`);
  assert.equal(raw.rows[0].name, "Unsafe history"); assert.equal(raw.rows[0].amount, "9007199254740992"); assert.equal(raw.rows[0].deleted_at, null);
  assert.equal((await db.select().from(auditLog)).length, audits.length);
  console.log("REST and MCP contact contracts verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
