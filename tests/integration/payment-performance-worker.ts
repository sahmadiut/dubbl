import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, bill } from "../../lib/db/schema";
import { GET } from "../../app/api/v1/reports/payment-performance/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { getPaymentPerformance } from "../../lib/reports/payment-performance";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Payment performance fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tool = (await client.listTools()).tools.find(tool => tool.name === "payment_performance")!;
  assert.match(tool.description!, /totalCollectedMinor\/totalPaidMinor/);
  for (const field of Object.values(tool.inputSchema.properties!)) assert.ok((field as { description?: string }).description);
  return { async call(args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name: "payment_performance", arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Timing A", slug: "timing-a" }, { name: "Timing B", slug: "timing-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "timing-owner@example.test" }, { email: "timing-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_timing_a", b: "dk_timing_b", denied: "dk_timing_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_timing" });
  const [local, other, foreign, deleted] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
    { organizationId: a.id, name: "Other", type: "both" }, { organizationId: b.id, name: "Foreign secret", type: "both" },
    { organizationId: a.id, name: "Deleted secret", type: "both", deletedAt: new Date() }]).returning();
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const customRead = await mcp({ ...ctx, role: "member", permissions: ["view:data"] });
  const args = { startDate: "2024-01-01", endDate: "2024-12-31" };
  const query = "?startDate=2024-01-01&endDate=2024-12-31";
  const request = (suffix = query, key = keys.a) => new Request(`http://fixture.test/api/v1/reports/payment-performance${suffix}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "contact", "organization", "journal_entry", "journal_line", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  let sequence = 0;
  const seed = async (kind: "invoice" | "bill", amount: number, options: { org?: string; contactId?: string; currency?: string; date?: string;
    due?: string; paid?: string | null; status?: "draft" | "void"; excluded?: boolean; deleted?: boolean } = {}) => {
    const values = { organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id,
      issueDate: options.date ?? "2024-01-01", dueDate: options.due ?? "2024-01-02", total: amount,
      currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null,
      paidAt: options.paid === null ? null : new Date(options.paid ?? "2024-01-02T23:59:59Z") };
    if (kind === "invoice") return (await db.insert(invoice).values({ ...values, invoiceNumber: `TI-${++sequence}`, status: options.status ?? (options.excluded ? "sent" : "paid") }).returning())[0].id;
    return (await db.insert(bill).values({ ...values, billNumber: `TB-${++sequence}`, status: options.status ?? (options.excluded ? "received" : "paid") }).returning())[0].id;
  };
  const clear = async () => {
    await db.delete(invoice).where(eq(invoice.organizationId, a.id)); await db.delete(bill).where(eq(bill.organizationId, a.id));
  };
  const report = async (suffix = query) => {
    const response = await GET(request(suffix)); assert.equal(response.status, 200); return response.json();
  };
  const parity = async (suffix = query, input: Record<string, unknown> = args) => {
    const before = await snapshot(); const body = await report(suffix);
    const result = await ma.call(input); assert.equal(result.isError, false); assert.deepEqual(result.body, body);
    assert.deepEqual(await snapshot(), before); return body;
  };
  const expectRange = async () => {
    const before = await snapshot(); const response = await GET(request()); assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
    const m = await ma.call(args); assert.equal(m.isError, true); assert.equal(m.body.code, "LEGACY_NUMERIC_RANGE");
    assert.deepEqual(await snapshot(), before);
  };
  try {
    const empty = await parity(); assert.equal(empty.currencyCode, "USD"); assert.equal(empty.avgDaysToCollect, 0); assert.equal(empty.avgDaysToPay, 0);
    assert.deepEqual(empty.receivables, []); assert.deepEqual(empty.payables, []);
    await parity("", {});
    await seed("invoice", 1001); await seed("invoice", 1002, { paid: "2024-01-03T00:00:00Z" });
    await seed("invoice", -1, { due: "2024-01-01", paid: "2024-01-01T12:00:00Z" });
    await seed("invoice", 10, { contactId: other.id, paid: "2024-01-06T12:00:00Z" });
    await seed("invoice", 7, { contactId: foreign.id, paid: "2024-01-01T12:00:00Z" });
    await seed("invoice", 9, { contactId: deleted.id, paid: "2024-01-01T12:00:00Z" });
    await seed("bill", 1001, { due: "2023-12-31", paid: "2023-12-31T23:59:59Z" });
    await seed("bill", 1002, { due: "2024-01-01", paid: "2023-12-30T12:00:00Z" });
    // Inclusive issue-date selection is independent of the paidAt year.
    await seed("bill", 5, { date: "2024-12-31", due: "2025-01-01", paid: "2025-01-01T23:59:59Z", contactId: other.id });
    for (const kind of ["invoice", "bill"] as const) {
      for (const options of [{ excluded: true }, { status: "draft" as const }, { status: "void" as const }, { paid: null }, { deleted: true }, { date: "2023-12-31" }, { date: "2025-01-01" }])
        await seed(kind, 900, { ...options, currency: "XXX" });
      await seed(kind, 800, { org: b.id, contactId: foreign.id });
    }
    const body = await parity(); assert.ok(!JSON.stringify(body).includes("secret"));
    assert.deepEqual((await customRead.call(args)).body, body);
    assert.deepEqual(body.receivables.find((r: { contactId: string }) => r.contactId === local.id), {
      contactId: local.id, contactName: "Local", avgDays: 1, avgTermDays: 1, lateCount: 1, onTimeRate: 67,
      invoiceCount: 3, totalCollected: 2002, totalCollectedMinor: "2002",
    });
    assert.equal(body.receivables[0].contactId, other.id); assert.equal(body.avgDaysToCollect, 1);
    assert.deepEqual(body.receivables.filter((r: { avgDays: number }) => r.avgDays === 0).map((r: { contactId: string }) => r.contactId),
      [foreign.id, deleted.id].sort((a, b) => a.localeCompare(b)));
    const p = body.payables.find((r: { contactId: string }) => r.contactId === local.id);
    assert.equal(p.avgDays, -1); assert.equal(p.avgTermDays, 0); assert.equal(p.onTimeRate, 100);
    assert.equal(p.billCount, 2); assert.equal(p.totalPaid, 2003); assert.equal(p.totalPaidMinor, "2003");
    assert.equal(body.avgDaysToPay, 0);
    const foreignBody = await (await GET(request(query, keys.b))).json(); assert.deepEqual((await mb.call(args)).body, foreignBody);
    assert.equal(foreignBody.receivables[0].totalCollectedMinor, "800"); assert.equal(foreignBody.payables[0].totalPaidMinor, "800");
    const before = await snapshot();
    assert.equal((await GET(request(query, "dk_timing_invalid"))).status, 401);
    assert.equal((await GET(request(query, keys.denied))).status, 403);
    assert.equal((await noRead.call(args)).body.status, 403);
    await assert.rejects(getPaymentPerformance({ ...ctx, organizationId: randomUUID() }, args), { status: 404 });
    for (const suffix of ["?startDate=2023-02-29", "?startDate=2024-02-01&endDate=2024-01-01", "?currencyCode=usd", "?currencyCode=XXX",
      "?startDate=", "?endDate=", "?unknown=x", "?endDate=2024-01-01&endDate=2024-01-01", "?format=json"]) assert.equal((await GET(request(suffix))).status, 400);
    for (const input of [{ ...args, startDate: "2023-02-29" }, { ...args, currencyCode: "XXX" }, { ...args, endDate: "2023-01-01" }, { ...args, startDate: 1 }])
      assert.equal((await ma.call(input)).isError, true);
    await assert.rejects(getPaymentPerformance(ctx, { ...args, unknown: true }));
    assert.deepEqual(await snapshot(), before);
    await clear();
    // Preserve count-weighted rounded contact means (1), rather than a global raw mean (0).
    await seed("invoice", 1, { paid: "2024-01-01T12:00:00Z" }); await seed("invoice", 1);
    await seed("invoice", 1, { contactId: other.id, paid: "2024-01-01T12:00:00Z" });
    assert.equal((await parity()).avgDaysToCollect, 1); await clear();
    // Ordering uses raw means even when both displayed means round to 1.
    await seed("invoice", 1, { paid: "2024-01-01T12:00:00Z" }); await seed("invoice", 1);
    await seed("invoice", 1, { contactId: other.id, paid: "2024-01-01T12:00:00Z" });
    await seed("invoice", 1, { contactId: other.id }); await seed("invoice", 1, { contactId: other.id });
    const ranked = await parity(); assert.equal(ranked.receivables[0].contactId, other.id);
    assert.deepEqual(ranked.receivables.map((r: { avgDays: number }) => r.avgDays), [1, 1]); await clear();
    for (const currency of ["IRR", "JPY", "KWD"]) {
      await seed("invoice", 1250, { currency }); await seed("bill", 1250, { currency });
      const single = await parity(); assert.equal(single.currencyCode, currency);
      assert.equal(single.receivables[0].totalCollectedMinor, "1250"); assert.equal(single.payables[0].totalPaidMinor, "1250");
      await seed("invoice", 1); await expectRange();
      const filtered = await parity(query + `&currencyCode=${currency}`, { ...args, currencyCode: currency });
      assert.equal(filtered.receivables[0].totalCollected, 1250); assert.equal(filtered.payables[0].totalPaid, 1250); await clear();
    }
    await seed("invoice", 1); await seed("bill", 1, { currency: "JPY" }); await expectRange(); await clear();
    for (const kind of ["invoice", "bill"] as const) {
      const collection = kind === "invoice" ? "receivables" : "payables", alias = kind === "invoice" ? "totalCollected" : "totalPaid";
      await seed(kind, Number.MAX_SAFE_INTEGER); await seed(kind, 1); await seed(kind, -Number.MAX_SAFE_INTEGER);
      const cancellation = await parity(); assert.equal(cancellation[collection][0][alias], 1); assert.equal(cancellation[collection][0][`${alias}Minor`], "1"); await clear();
      for (const edge of [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
        await seed(kind, edge); const safe = await parity(); assert.equal(safe[collection][0][alias], edge);
        assert.equal(BigInt(safe[collection][0][`${alias}Minor`]), BigInt(edge));
        await seed(kind, Math.sign(edge)); await expectRange(); await clear();
      }
      // No invented cross-contact money total: each emitted contact may reach its safe limit.
      await seed(kind, Number.MAX_SAFE_INTEGER); await seed(kind, Number.MAX_SAFE_INTEGER, { contactId: other.id });
      assert.equal((await parity())[collection].length, 2); await clear();
      const unsafe = await seed(kind, 1); const table = kind === "invoice" ? invoice : bill;
      await db.execute(sql`update ${table} set total=9223372036854775807 where id=${unsafe}`); await expectRange();
      await db.execute(sql`update ${table} set total=-9223372036854775808 where id=${unsafe}`); await expectRange();
      await db.execute(sql`update ${table} set total=9007199254740992 where id=${unsafe}`);
      await seed(kind, -Number.MAX_SAFE_INTEGER); await expectRange(); await clear();
      await seed(kind, 1, { currency: "XXX" }); await expectRange(); await clear();
      const badDate = await seed(kind, 1);
      await db.execute(sql`update ${table} set paid_at='10000-01-01'::timestamp where id=${badDate}`); await expectRange(); await clear();
      const infinitePaid = await seed(kind, 1);
      await db.execute(sql`update ${table} set paid_at='infinity'::timestamp where id=${infinitePaid}`); await expectRange(); await clear();
      const infiniteDue = await seed(kind, 1);
      await db.execute(sql`update ${table} set due_date='infinity'::date where id=${infiniteDue}`); await expectRange(); await clear();
    }
    const filteredEmpty = await parity(query + "&currencyCode=JPY", { ...args, currencyCode: "JPY" }); assert.equal(filteredEmpty.currencyCode, "JPY");
    await db.update(organization).set({ defaultCurrency: "IRR" }).where(eq(organization.id, a.id));
    assert.equal((await parity()).currencyCode, "IRR");
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id)); await expectRange();
    assert.equal((await parity(query + "&currencyCode=IRR", { ...args, currencyCode: "IRR" })).currencyCode, "IRR");
    console.log("REST and MCP payment performance verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close(), customRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
