import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, recurringTemplate,
  bill, expenseClaim, expenseItem, periodLock, recurringTemplateLine, fiscalYear } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/recurring/route";
import { GET, PATCH, DELETE } from "../../app/api/v1/recurring/[id]/route";
import { GET as SUMMARY } from "../../app/api/v1/recurring/summary/route";
import { GET as PREVIEW } from "../../app/api/v1/recurring/[id]/preview/route";
import { POST as PAUSE } from "../../app/api/v1/recurring/[id]/pause/route";
import { registerRecurringTemplateTools } from "../../lib/mcp/tools/recurring-templates";
import { processRecurringPayableTemplate } from "../../lib/api/recurring-payable";
import { processRecurringTemplates } from "../../lib/api/recurring-generate";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Recurring fixture", version: "1" }); registerRecurringTemplateTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 11);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_recurring_template")!.inputSchema).includes("unitPriceMinor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Recurring A", slug: "ria" }, { name: "Recurring B", slug: "rib" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "ri-owner@example.test" }, { email: "ri-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_ri_a", b: "dk_ri_b", viewer: "dk_ri_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ri" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer", paymentTermsDays: 0 }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [revenue, ar, taxAccount, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2200", name: "Tax", type: "liability" },
    { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  assert.ok(ar.id && taxAccount.id);
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const today = new Date().toISOString().split("T")[0];
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/recurring${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const basic = { type: "bill", name: "Subscription", contactId: customer.id, frequency: "monthly", startDate: today, maxOccurrences: 1,
    lines: [{ description: "Service", unitPriceMinor: "1250", accountId: revenue.id }] };
  const make = async (body: unknown = basic) => { const response = await POST(req("POST", body)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).template; };
  const tables = ["recurring_template", "recurring_template_line", "bill", "bill_line", "expense_claim", "expense_item", "number_sequence", "audit_log"];
  const snapshot = async () => {
    const rows = []; for (const table of tables) rows.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    rows.push((await db.execute(sql`select count(*)::text from audit_log`)).rows); return rows;
  };
  const unchanged = async (op: () => Promise<unknown>) => { const before = await snapshot(); await op(); assert.deepEqual(await snapshot(), before); };
  const fault = async (table: string, event: string, op: () => Promise<unknown>) => {
    assert.ok(tables.includes(table)); assert.ok(["insert", "update"].includes(event));
    await db.execute(sql.raw("create function ri_fault() returns trigger language plpgsql as $$ begin raise exception 'recurring fixture fault'; end $$"));
    await db.execute(sql.raw(`create trigger ri_fault before ${event} on ${table} for each row execute function ri_fault()`));
    try { await unchanged(op); } finally { await db.execute(sql.raw(`drop trigger ri_fault on ${table}`)); await db.execute(sql.raw("drop function ri_fault()")); }
  };
  const bills = async (reference: string) => db.select().from(bill).where(eq(bill.reference, reference));
  try {
    for (const type of ["bill", "expense"]) {
      for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
        for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
          const body = { ...basic, type, currencyCode, lines: [{ description: "Service", ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax.id, accountId: revenue.id }] };
          const row = await make(body), mr = await ma.call("create_recurring_template", body);
          assert.equal(mr.isError, false, JSON.stringify(mr.body));
          for (const id of [row.id, mr.body.template.id]) {
            const rest = await GET(req("GET"), params(id)); assert.equal(rest.status, 200);
            const dto = (await rest.json()).template; assert.equal(dto.lines[0].unitPriceMinor, "1250"); assert.equal(dto.currencyCode, currencyCode);
            assert.equal((await ma.call("get_recurring_template", { templateId: id })).body.template.lines[0].unitPriceMinor, "1250");
            assert.equal(await processRecurringPayableTemplate(a.id, id, today), 1);
          }
        }
      }
    }
    const allBills = await db.select().from(bill), allExpenses = await db.select().from(expenseClaim);
    assert.equal(allBills.length, 32); assert.equal(allExpenses.length, 32);
    assert.ok(allBills.every(row => row.total === 1856 && row.status === "draft"));
    assert.ok(allExpenses.every(row => row.totalAmount === 1875 && row.status === "draft"));
    assert.equal((await db.select().from(expenseItem))[0].taxRateId, null);
    for (const input of [{ contactId: foreignCustomer.id }, { lines: [{ ...basic.lines[0], accountId: foreignAccount.id }] },
      { lines: [{ ...basic.lines[0], taxRateId: foreignTax.id }] }, { startDate: "2026-02-30" }, { endDate: "2000-01-01" },
      { rateExact: "1.2" }, { exchangeRate: 1200000 }, { maxOccurrences: 2147483648 }, { lines: [{ description: "Bad", unitPriceMinor: "9007199254740992" }] },
      { lines: [{ description: "Bad", unitPriceExact: "1e3" }] }, { lines: [{ description: "Bad", unitPrice: 1, unitPriceExact: "2" }] },
      { lines: [{ description: "Bad", unitPriceMinor: "9007199254740991", quantity: 2 }] }]) {
      await unchanged(async () => {
        assert.ok([400, 422].includes((await POST(req("POST", { ...basic, ...input }))).status));
        assert.equal((await ma.call("create_recurring_template", { ...basic, ...input })).isError, true);
      });
    }
    const row = await make();
    assert.ok((await (await LIST(req("GET", undefined, keys.a, "?type=bill"))).json()).data.some((t: { id: string }) => t.id === row.id));
    assert.equal((await ma.call("list_recurring_templates", { type: "bill" })).isError, false);
    assert.equal((await (await PREVIEW(req("GET"), params(row.id))).json()).template.lineTotalMinor, "1250");
    assert.equal((await ma.call("preview_recurring_payable", { templateId: row.id })).body.template.lineTotalMinor, "1250");
    assert.equal((await PAUSE(req("POST"), params(row.id))).status, 200);
    assert.equal((await ma.call("pause_recurring_template", { templateId: row.id })).body.template.status, "active");
    assert.equal((await PATCH(req("PATCH", { currencyCode: "JPY", notes: "Changed" }), params(row.id))).status, 200);
    assert.equal((await ma.call("update_recurring_template", { templateId: row.id, currencyCode: "KWD" })).isError, false);
    assert.equal((await (await GET(req("GET"), params(row.id))).json()).template.lines[0].unitPriceMinor, "1250");
    await unchanged(async () => {
      assert.equal((await GET(req("GET", undefined, keys.b), params(row.id))).status, 404);
      assert.equal((await PATCH(req("PATCH", { notes: "Foreign" }, keys.b), params(row.id))).status, 404);
      assert.equal((await DELETE(req("DELETE", undefined, keys.b), params(row.id))).status, 404);
      assert.equal((await PAUSE(req("POST", undefined, keys.b), params(row.id))).status, 404);
      assert.equal((await PREVIEW(req("GET", undefined, keys.b), params(row.id))).status, 404);
      for (const name of ["get_recurring_template", "update_recurring_template", "pause_recurring_template", "preview_recurring_payable", "delete_recurring_payable", "run_recurring_template"])
        assert.equal((await mb.call(name, { templateId: row.id })).isError, true);
      assert.equal((await POST(req("POST", basic, keys.viewer))).status, 403);
      assert.equal((await PATCH(req("PATCH", { notes: "Denied" }, keys.viewer), params(row.id))).status, 403);
      assert.equal((await DELETE(req("DELETE", undefined, keys.viewer), params(row.id))).status, 403);
      assert.equal((await ro.call("create_recurring_template", basic)).body.status, 403);
      for (const name of ["update_recurring_template", "pause_recurring_template", "delete_recurring_payable", "run_recurring_template"])
        assert.equal((await ro.call(name, { templateId: row.id })).body.status, 403);
      assert.equal((await PATCH(req("PATCH", { rateExact: "1.2" }), params(row.id))).status, 400);
      assert.equal((await ma.call("update_recurring_template", { templateId: row.id, rateExact: "1.2" })).isError, true);
      assert.equal((await PREVIEW(req("GET", undefined, keys.a, "?count=abc"), params(row.id))).status, 400);
    });
    const mc = await ma.call("create_recurring_template", { ...basic, name: "Delete MCP" }); assert.equal(mc.isError, false);
    assert.equal((await ma.call("delete_recurring_payable", { templateId: mc.body.template.id })).isError, false);
    assert.equal((await GET(req("GET"), params(mc.body.template.id))).status, 404);
    assert.equal((await DELETE(req("DELETE"), params(row.id))).status, 200);
    assert.deepEqual((await ma.call("get_recurring_template_summary")).body, await (await SUMMARY(req("GET"))).json());
    assert.equal((await mb.call("get_recurring_template_summary")).body.totalCount, 0);
    await unchanged(async () => {
      assert.equal((await POST(req("POST", basic, "dk_invalid"))).status, 401);
      assert.equal((await GET(req("GET"), params("invalid"))).status, 400);
      assert.equal((await PATCH(req("PATCH", { notes: "Invalid" }), params("invalid"))).status, 400);
      assert.equal((await ma.call("get_recurring_template", { templateId: "invalid" })).isError, true);
      const malformed = new Request("http://fixture.test/api/v1/recurring", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
      assert.equal((await POST(malformed)).status, 400);
    });
    // Audit/header/line write failure must preserve all document and scheduling tables.
    for (const table of ["recurring_template", "recurring_template_line", "audit_log"])
      await fault(table, "insert", async () => { assert.equal((await POST(req("POST", basic))).status, 500); assert.equal((await ma.call("create_recurring_template", basic)).isError, true); });
    const rollback = await make({ ...basic, name: "Rollback", reference: "rollback", startDate: "2026-01-01", frequency: "weekly", maxOccurrences: 3 });
    for (const [table, event] of [["bill_line", "insert"], ["recurring_template", "update"], ["audit_log", "insert"]])
      await fault(table, event, async () => assert.rejects(processRecurringPayableTemplate(a.id, rollback.id, today)));
    await fault("audit_log", "insert", async () => {
      assert.equal((await PATCH(req("PATCH", { notes: "Must rollback" }), params(rollback.id))).status, 500);
      assert.equal((await PAUSE(req("POST"), params(rollback.id))).status, 500);
      assert.equal((await DELETE(req("DELETE"), params(rollback.id))).status, 500);
      assert.equal((await ma.call("update_recurring_template", { templateId: rollback.id, notes: "Must rollback" })).isError, true);
      assert.equal((await ma.call("delete_recurring_payable", { templateId: rollback.id })).isError, true);
    });
    await db.execute(sql.raw("create function ri_second_fault() returns trigger language plpgsql as $$ begin if exists (select 1 from bill where id = new.bill_id and issue_date = '2026-01-08') then raise exception 'second fault'; end if; return new; end $$"));
    await db.execute(sql.raw("create trigger ri_second_fault before insert on bill_line for each row execute function ri_second_fault()"));
    try { await unchanged(async () => assert.rejects(processRecurringPayableTemplate(a.id, rollback.id, today))); }
    finally { await db.execute(sql.raw("drop trigger ri_second_fault on bill_line")); await db.execute(sql.raw("drop function ri_second_fault()")); }
    assert.equal((await bills("rollback")).length, 0);
    const counts = await Promise.all([processRecurringPayableTemplate(a.id, rollback.id, today), processRecurringPayableTemplate(a.id, rollback.id, today)]);
    assert.equal(counts[0] + counts[1], 3); assert.equal(await processRecurringPayableTemplate(a.id, rollback.id, today), 0);
    assert.equal((await bills("rollback")).length, 3); assert.equal(new Set((await bills("rollback")).map(row => row.billNumber)).size, 3);
    const expense = await make({ ...basic, type: "expense" });
    await fault("expense_item", "insert", async () => assert.rejects(processRecurringPayableTemplate(a.id, expense.id, today)));
    await fault("audit_log", "insert", async () => assert.rejects(processRecurringPayableTemplate(a.id, expense.id, today)));
    const ec = await Promise.all([processRecurringPayableTemplate(a.id, expense.id, today), processRecurringPayableTemplate(a.id, expense.id, today)]); assert.equal(ec[0] + ec[1], 1);
    const large = await make({ ...basic, reference: "large", lines: [{ description: "Large", unitPriceMinor: "9007199254740991" }] });
    assert.equal(await processRecurringPayableTemplate(a.id, large.id, today), 1);
    assert.equal((await bills("large"))[0].total, Number.MAX_SAFE_INTEGER);
    const tooMany = await make({ ...basic, startDate: "2000-01-01", frequency: "weekly", maxOccurrences: 1001 });
    await unchanged(async () => assert.rejects(processRecurringPayableTemplate(a.id, tooMany.id, today)));
    await db.update(recurringTemplate).set({ status: "paused" }).where(eq(recurringTemplate.id, tooMany.id));
    // Safe input that a DB trigger turns into unsafe persisted output must roll back.
    await db.execute(sql.raw("create function ri_unsafe() returns trigger language plpgsql as $$ begin new.unit_price = 9007199254740992; return new; end $$"));
    await db.execute(sql.raw("create trigger ri_unsafe before insert on recurring_template_line for each row execute function ri_unsafe()"));
    try { await unchanged(async () => { assert.equal((await POST(req("POST", basic))).status, 422); assert.equal((await ma.call("create_recurring_template", basic)).isError, true); }); }
    finally { await db.execute(sql.raw("drop trigger ri_unsafe on recurring_template_line")); await db.execute(sql.raw("drop function ri_unsafe()")); }
    const saved = await make();
    await db.execute(sql`update recurring_template_line set unit_price = 9007199254740992 where template_id = ${saved.id}`);
    await unchanged(async () => {
      assert.equal((await GET(req("GET"), params(saved.id))).status, 422);
      assert.equal((await PATCH(req("PATCH", { notes: "Unsafe" }), params(saved.id))).status, 422);
      await assert.rejects(processRecurringPayableTemplate(a.id, saved.id, today));
    });
    await db.execute(sql`update recurring_template_line set unit_price = 1250 where template_id = ${saved.id}`);
    await db.update(recurringTemplateLine).set({ accountId: foreignAccount.id }).where(eq(recurringTemplateLine.templateId, saved.id));
    await unchanged(async () => assert.rejects(processRecurringPayableTemplate(a.id, saved.id, today)));
    await db.update(recurringTemplateLine).set({ accountId: revenue.id }).where(eq(recurringTemplateLine.templateId, saved.id));
    await db.update(recurringTemplate).set({ createdBy: viewer.id }).where(eq(recurringTemplate.id, saved.id));
    await db.delete(member).where(eq(member.userId, viewer.id));
    await unchanged(async () => assert.rejects(processRecurringPayableTemplate(a.id, saved.id, today)));
    await db.update(recurringTemplate).set({ createdBy: owner.id }).where(eq(recurringTemplate.id, saved.id));
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: today });
    await unchanged(async () => assert.rejects(processRecurringPayableTemplate(a.id, saved.id, today)));
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true });
    await unchanged(async () => assert.rejects(processRecurringPayableTemplate(a.id, saved.id, today)));
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    assert.equal((await ma.call("run_recurring_template", { templateId: saved.id })).body.generated, 1);
    assert.equal(await processRecurringTemplates(a.id, { types: ["bill", "expense"] }), 0);
    const runByMcp = await make();
    const runResult = await ma.call("run_recurring_template", { templateId: runByMcp.id }); assert.equal(runResult.body.generated, 1);
    const paused = await make(); assert.equal((await PAUSE(req("POST"), params(paused.id))).status, 200);
    assert.equal(await processRecurringPayableTemplate(a.id, paused.id, today), 0);
    const deleted = await make(); assert.equal((await DELETE(req("DELETE"), params(deleted.id))).status, 200);
    assert.equal(await processRecurringPayableTemplate(a.id, deleted.id, today), 0);
    const wrongType = await ma.call("create_recurring_template", { ...basic, type: "invoice" }); assert.equal(wrongType.isError, false);
    await unchanged(async () => {
      assert.equal((await ma.call("delete_recurring_payable", { templateId: wrongType.body.template.id })).isError, true);
      assert.equal((await ma.call("preview_recurring_payable", { templateId: wrongType.body.template.id })).isError, true);
    });
    const future = await make({ ...basic, startDate: "2099-01-01" });
    assert.equal(await processRecurringPayableTemplate(a.id, future.id, today), 0);
    console.log("REST and MCP recurring payables verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
