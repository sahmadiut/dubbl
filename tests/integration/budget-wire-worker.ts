// Invoked only against a disposable migrated DB by budget-wire.test.ts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, fiscalYear, chartAccount, budget, budgetLine, budgetPeriod, auditLog } from "../../lib/db/schema";
import { GET, POST } from "../../app/api/v1/budgets/route";
import { GET as getBudget, PATCH, DELETE } from "../../app/api/v1/budgets/[id]/route";
import { registerBudgetTools } from "../../lib/mcp/tools/budgets";
import type { AuthContext } from "../../lib/api/auth-context";

type Result = { content: { text: string }[]; isError?: boolean };
function tools(ctx: AuthContext) {
  const registered = new Map<string, { schema: z.ZodObject; handler: (input: unknown) => Promise<Result> }>();
  const server = { tool(name: string, _description: string, shape: z.ZodRawShape, handler: (input: unknown) => Promise<Result>) {
    registered.set(name, { schema: z.object(shape), handler });
  }, registerTool(name: string, config: { inputSchema: z.ZodObject }, handler: (input: unknown) => Promise<Result>) {
    registered.set(name, { schema: config.inputSchema, handler });
  } } as unknown as McpServer;
  registerBudgetTools(server, ctx);
  assert.equal(registered.size, 7); // Report and alert registrations are retained, outside this CRUD slice.
  return async (name: string, input: unknown) => {
    const tool = registered.get(name)!;
    const result = await tool.handler(tool.schema.parse(input));
    return { ...result, body: JSON.parse(result.content[0].text) };
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Budget wire A", slug: "budget-wire-a" }, { name: "Budget wire B", slug: "budget-wire-b" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { name: "Synthetic owner", email: "budget-owner@example.test" }, { name: "Synthetic member", email: "budget-member@example.test" },
  ]).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member" },
  ]);
  const keys = { a: "dk_synthetic_budget_a", b: "dk_synthetic_budget_b", viewer: "dk_synthetic_budget_viewer" };
  for (const [name, key] of Object.entries(keys)) {
    await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id, createdBy: name === "viewer" ? viewer.id : owner.id,
      name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_synthetic" });
  }
  const years = await db.insert(fiscalYear).values([a, b].map(org => ({ organizationId: org.id, name: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }))).returning();
  const accounts = await db.insert(chartAccount).values([a, b].map(org => ({ organizationId: org.id, code: "5000", name: "Expense", type: "expense" as const }))).returning();
  const request = (method: string, body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/budgets", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const snapshot = async () => ({ budgets: await db.select().from(budget).orderBy(budget.id),
    lines: await db.select().from(budgetLine).orderBy(budgetLine.id), periods: await db.select().from(budgetPeriod).orderBy(budgetPeriod.id),
    audits: await db.select().from(auditLog).orderBy(auditLog.id) });
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const callA = tools(ctx), callB = tools({ ...ctx, organizationId: b.id }), denied = tools({ ...ctx, userId: viewer.id, role: "member" });
  const header = { name: "Synthetic budget", fiscalYearId: years[0].id, startDate: "2026-01-01", endDate: "2026-03-31", periodType: "monthly" };
  const period = { label: "Explicit", startDate: "2026-01-01", endDate: "2026-01-31" };
  let id = "";

  // Legacy/exact/dual/default signed totals: actual database values conserve the original integers.
  for (const fields of [{}, { total: 1250 }, { totalMinor: "-1250" }, { total: 2147483648, totalMinor: "2147483648" },
    { totalMinor: String(Number.MAX_SAFE_INTEGER) }]) {
    const response = await POST(request("POST", { ...header, lines: [{ accountId: accounts[0].id, ...fields }] }));
    assert.equal(response.status, 201);
    const saved = (await response.json()).budget;
    assert.equal(saved.organizationId, a.id); id = saved.id;
    const detail = (await (await getBudget(request("GET"), params(id))).json()).budget;
    const line = detail.lines[0];
    const expected = fields.totalMinor ?? String(fields.total ?? 0);
    assert.equal(line.totalMinor, expected); assert.equal(line.total, Number(expected));
    assert.equal(line.periods.reduce((sum: bigint, p: { amountMinor: string }) => sum + BigInt(p.amountMinor), 0n), BigInt(expected));
    assert.equal(line.periods[0].startDate, "2026-01-01");
  }
  const response = await PATCH(request("PATCH", { lines: [{ accountId: accounts[0].id, periods: [{ ...period, amountMinor: "-1250" }] }] }), params(id));
  assert.equal(response.status, 200);
  let detail = (await (await getBudget(request("GET"), params(id))).json()).budget;
  assert.equal(detail.lines[0].totalMinor, "-1250"); assert.equal(detail.lines[0].periods[0].amountMinor, "-1250");
  const lineId = detail.lines[0].id, periodId = detail.lines[0].periods[0].id;
  await PATCH(request("PATCH", { name: "Only rename" }), params(id));
  detail = (await (await getBudget(request("GET"), params(id))).json()).budget;
  assert.equal(detail.lines[0].id, lineId); assert.equal(detail.lines[0].periods[0].id, periodId);

  // Invalid second lines/aliases/sums/reference/date/resource limits never partially modify the first.
  for (const [line, status] of [
    [{ total: 1, totalMinor: "2" }, 400], [{ totalMinor: "01" }, 400], [{ totalMinor: "-0" }, 400],
    [{ totalMinor: "1e3" }, 400], [{ total: Number.MAX_SAFE_INTEGER + 1 }, 400], [{ totalMinor: "9223372036854775808" }, 400],
    [{ totalMinor: "9007199254740992" }, 422], [{ totalMinor: "-9223372036854775808" }, 422],
    [{ periods: [{ ...period, amount: 1, amountMinor: "2" }] }, 400],
    [{ periods: [{ ...period, amountMinor: "9007199254740992" }] }, 422],
    [{ total: 0, periods: [Number.MAX_SAFE_INTEGER, 1].map(amount => ({ ...period, amount })) }, 422],
    [{ accountId: accounts[1].id, totalMinor: "1250" }, 404],
  ] as const) {
    const before = await snapshot();
    const lines = [{ accountId: accounts[0].id, total: 1 }, { accountId: accounts[0].id, ...line }];
    for (const result of [await POST(request("POST", { ...header, lines })), await PATCH(request("PATCH", { name: "Rejected", lines }), params(id))]) {
      assert.equal(result.status, status);
      if (status === 422) assert.equal((await result.json()).code, "LEGACY_NUMERIC_RANGE");
    }
    assert.deepEqual(await snapshot(), before);
  }
  for (const [fields, status] of [[{ fiscalYearId: years[1].id }, 404], [{ startDate: "2026-02-29" }, 400],
    [{ startDate: "2027-01-01" }, 400], [{ periodType: "daily", startDate: "0001-01-01", endDate: "9999-12-31" }, 422]] as const) {
    const before = await snapshot();
    const lines = [{ accountId: accounts[0].id, totalMinor: "1250" }];
    assert.equal((await POST(request("POST", { ...header, ...fields, lines }))).status, status);
    assert.equal((await PATCH(request("PATCH", { ...fields, lines }), params(id))).status, status);
    assert.deepEqual(await snapshot(), before);
  }
  let before = await snapshot();
  assert.equal((await POST(request("POST", { ...header, lines: [{ accountId: accounts[0].id, totalMinor: "1" }] }, keys.viewer))).status, 403);
  assert.equal((await PATCH(request("PATCH", { name: "Denied" }, keys.viewer), params(id))).status, 403);
  assert.equal((await DELETE(request("DELETE", undefined, keys.viewer), params(id))).status, 403);
  assert.equal((await POST(request("POST", { ...header, lines: [] }, "dk_invalid"))).status, 401);
  assert.equal((await getBudget(request("GET", undefined, keys.b), params(id))).status, 404);
  assert.equal((await PATCH(request("PATCH", { name: "Foreign" }, keys.b), params(id))).status, 404);
  assert.equal((await DELETE(request("DELETE", undefined, keys.b), params(id))).status, 404);
  assert.deepEqual(await snapshot(), before);
  const listed = (await (await GET(request("GET"))).json()).data;
  assert.ok(listed.every((row: { organizationId: string }) => row.organizationId === a.id));

  // Registered MCP create/update use the same preflight/service and retain existing header envelopes.
  let mcpId = "";
  for (const fields of [{ total: 1250 }, { totalMinor: "-1250" }, { total: 0, totalMinor: "0" }]) {
    const result = await callA("create_budget", { ...header, lines: [{ accountId: accounts[0].id, ...fields }] });
    assert.equal(result.isError, undefined); mcpId = result.body.budget.id;
    assert.equal((await callA("get_budget", { budgetId: mcpId })).body.budget.lines[0].totalMinor, fields.totalMinor ?? String(fields.total));
  }
  for (const input of [
    { lines: [{ accountId: accounts[0].id, periods: [{ ...period, amount: 1250, amountMinor: "1250" }] }] },
    { lines: [{ accountId: accounts[0].id, totalMinor: String(Number.MIN_SAFE_INTEGER) }] }, { name: "MCP rename" },
  ]) assert.equal((await callA("update_budget", { budgetId: mcpId, ...input })).isError, undefined);
  for (const line of [{ totalMinor: "9007199254740992" }, { total: 1, totalMinor: "2" },
    { accountId: accounts[1].id }, { periods: [{ ...period, amount: 1, amountMinor: "2" }] },
    { periods: [Number.MAX_SAFE_INTEGER, 1].map(amount => ({ ...period, amount })) }]) {
    before = await snapshot();
    const lines = [{ accountId: accounts[0].id, ...line }];
    assert.equal((await callA("create_budget", { ...header, lines })).isError, true);
    assert.equal((await callA("update_budget", { budgetId: mcpId, lines })).isError, true);
    assert.deepEqual(await snapshot(), before);
  }
  before = await snapshot();
  await assert.rejects(callA("create_budget", { ...header, lines: [{ accountId: accounts[0].id, totalMinor: "01" }] }), z.ZodError);
  assert.equal((await denied("create_budget", { ...header, lines: [{ accountId: accounts[0].id }] })).body.status, 403);
  assert.equal((await denied("update_budget", { budgetId: mcpId, name: "Denied" })).body.status, 403);
  assert.equal((await denied("delete_budget", { budgetId: mcpId })).body.status, 403);
  assert.equal((await callB("get_budget", { budgetId: mcpId })).isError, true);
  assert.equal((await callB("update_budget", { budgetId: mcpId, name: "Foreign" })).body.status, 404);
  assert.equal((await callB("delete_budget", { budgetId: mcpId })).body.status, 404);
  assert.deepEqual(await snapshot(), before);
  const foreign = (await callB("create_budget", { ...header, fiscalYearId: years[1].id, lines: [{ accountId: accounts[1].id, totalMinor: "777" }] })).body.budget;
  assert.equal((await callB("list_budgets", {})).body.budgets[0].id, foreign.id);
  assert.ok((await callA("list_budgets", {})).body.budgets.every((row: { organizationId: string }) => row.organizationId === a.id));

  // Existing malformed associations cannot expose another tenant's fiscal year/account details.
  const [badReference] = await db.insert(budget).values({ ...header, organizationId: a.id, fiscalYearId: years[1].id }).returning();
  await db.insert(budgetLine).values({ budgetId: badReference.id, accountId: accounts[1].id, total: 1 });
  assert.equal((await getBudget(request("GET"), params(badReference.id))).status, 404);
  assert.equal((await GET(request("GET"))).status, 404);
  assert.equal((await callA("get_budget", { budgetId: badReference.id })).body.status, 404);
  assert.equal((await callA("list_budgets", {})).body.status, 404);
  await db.update(budget).set({ fiscalYearId: years[0].id }).where(eq(budget.id, badReference.id));
  assert.equal((await getBudget(request("GET"), params(badReference.id))).status, 404);
  assert.equal((await callA("get_budget", { budgetId: badReference.id })).body.status, 404);
  await db.update(budget).set({ deletedAt: new Date() }).where(eq(budget.id, badReference.id));

  // A storage failure after header/line writes rolls the whole create/update transaction back.
  await db.execute(sql`CREATE FUNCTION fixture_reject_period() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.label = 'reject' THEN RAISE EXCEPTION 'Synthetic fixture write failure'; END IF; RETURN NEW; END $$`);
  await db.execute(sql`CREATE TRIGGER fixture_reject_period BEFORE INSERT ON budget_period FOR EACH ROW EXECUTE FUNCTION fixture_reject_period()`);
  const rejectLines = [{ accountId: accounts[0].id, periods: [{ ...period, label: "reject", amountMinor: "1" }] }];
  before = await snapshot();
  assert.equal((await POST(request("POST", { ...header, lines: rejectLines }))).status, 500);
  assert.equal((await PATCH(request("PATCH", { name: "Must rollback", lines: rejectLines }), params(id))).status, 500);
  assert.equal((await callA("create_budget", { ...header, lines: rejectLines })).isError, true);
  assert.equal((await callA("update_budget", { budgetId: mcpId, name: "Must rollback", lines: rejectLines })).isError, true);
  assert.deepEqual(await snapshot(), before);

  // Empty replacement and deletion semantics remain explicit; no orphaned line/period writes.
  assert.equal((await callA("update_budget", { budgetId: mcpId, lines: [] })).isError, undefined);
  assert.equal((await callA("get_budget", { budgetId: mcpId })).body.budget.lines.length, 0);
  assert.equal((await callA("delete_budget", { budgetId: mcpId })).body.success, true);
  assert.equal((await getBudget(request("GET"), params(mcpId))).status, 404);
  const retained = await db.select().from(budgetLine).where(eq(budgetLine.budgetId, id));
  assert.equal((await DELETE(request("DELETE"), params(id))).status, 200);
  assert.equal((await DELETE(request("DELETE"), params(id))).status, 404);
  assert.deepEqual(await db.select().from(budgetLine).where(eq(budgetLine.budgetId, id)), retained);
  assert.equal((await db.query.budget.findFirst({ where: and(eq(budget.id, foreign.id), eq(budget.organizationId, b.id)) }))?.deletedAt, null);
  const audits = await db.select().from(auditLog);
  for (const action of ["create", "update", "delete"]) assert.ok(audits.some(row => row.organizationId === a.id && row.action === action));

  // Unsafe historical amounts cannot be rounded or erased by metadata/replace/delete operations.
  const unsafe = (await callA("create_budget", { ...header, lines: [{ accountId: accounts[0].id, totalMinor: "1" }] })).body.budget;
  await db.execute(sql`update ${budgetLine} set total = 9007199254740992 where budget_id = ${unsafe.id}`);
  const auditCount = (await db.select().from(auditLog)).length;
  assert.equal((await getBudget(request("GET"), params(unsafe.id))).status, 422);
  assert.equal((await PATCH(request("PATCH", { name: "Must not change", lines: [] }), params(unsafe.id))).status, 422);
  assert.equal((await DELETE(request("DELETE"), params(unsafe.id))).status, 422);
  assert.equal((await callA("get_budget", { budgetId: unsafe.id })).body.status, 422);
  assert.equal((await callA("update_budget", { budgetId: unsafe.id, lines: [] })).body.status, 422);
  assert.equal((await callA("delete_budget", { budgetId: unsafe.id })).body.status, 422);
  const stored = await db.execute(sql`select b.name, b.deleted_at, l.total::text as amount from budget b join budget_line l on l.budget_id=b.id where b.id=${unsafe.id}`);
  assert.equal(stored.rows[0].name, header.name); assert.equal(stored.rows[0].deleted_at, null); assert.equal(stored.rows[0].amount, "9007199254740992");
  assert.equal((await db.select().from(auditLog)).length, auditCount);
  console.log("REST and MCP budget CRUD verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
