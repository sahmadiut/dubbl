import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, fixedAsset, chartAccount, cwipCost, assetCategory, journalEntry, journalLine, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as add } from "../../app/api/v1/fixed-assets/[id]/cwip-cost/route";
import { POST as capitalize } from "../../app/api/v1/fixed-assets/[id]/capitalize/route";
import { PATCH as patch } from "../../app/api/v1/fixed-assets/[id]/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { lockAssetSnapshot } from "../../lib/api/asset-depreciation";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Depreciation fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["list_cwip_costs", "add_cwip_cost", "capitalize_cwip_asset"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Dep A", slug: "dep-a" }, { name: "Dep B", slug: "dep-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "dep-owner@example.test" }, { email: "dep-viewer@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }]);
  const keys = { a: "dk_dep_a", b: "dk_dep_b", viewer: "dk_dep_viewer", expired: "dk_dep_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id, createdBy: name === "viewer" ? viewer.id : owner.id,
    name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_dep", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const [expense, accum, foreign, cost] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "5900", name: "Dep expense", type: "expense" },
    { organizationId: a.id, code: "1590", name: "Accum dep", type: "asset" }, { organizationId: b.id, code: "1590", name: "Foreign", type: "asset" }, { organizationId: a.id, code: "1501", name: "Cost", type: "asset" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const staff = await connect({ ...ctx, role: "member", permissions: ["manage:assets"] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const result = await db.execute(sql.raw("select jsonb_build_object('costs',(select jsonb_agg(to_jsonb(t) order by id) from cwip_cost t),'assets',(select jsonb_agg(to_jsonb(t) order by id) from fixed_asset t),'revaluation',(select jsonb_agg(to_jsonb(t) order by id) from asset_revaluation t),'accounts',(select jsonb_agg(to_jsonb(t) order by id) from chart_account t),'depreciation',(select jsonb_agg(to_jsonb(t) order by id) from depreciation_entry t),'journals',(select jsonb_agg(to_jsonb(t) order by id) from journal_entry t),'lines',(select jsonb_agg(to_jsonb(t) order by id) from journal_line t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(result.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown>, client = ma, status?: number) {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, JSON.stringify(result));
    if (status) assert.equal(result.body.status, status); assert.equal(await snapshot(), before);
  }
  let tag = 0;
  async function asset(values: Partial<typeof fixedAsset.$inferInsert> = {}) {
    const [row] = await db.insert(fixedAsset).values({ organizationId: a.id, name: "Exact", assetNumber: "DEP" + ++tag, purchaseDate: "2024-01-01", purchasePrice: 0, isCwip: true, status: "in_progress",
      residualValue: 0, usefulLifeMonths: 60, netBookValue: 0, assetAccountId: cost.id, depreciationAccountId: expense.id, accumulatedDepAccountId: accum.id, ...values }).returning();
    return row;
  }
  async function balanced(id: string | null, expected?: bigint) {
    assert.ok(id);
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
    const debit = lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n), credit = lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n);
    assert.equal(debit, credit); if (expected !== undefined) assert.equal(debit, expected);
    assert.ok(lines.every(l => l.currencyCode === "USD" && l.rateExact === "1" && l.rateDirection === "quote_per_base"));
    return lines;
  }
  try {
    const x = await asset();
    const empty = await data(await list(req(), p(x.id))); assert.deepEqual(empty, { costs: [], total: 0, totalMinor: "0" });
    const first = await data(await add(req({ date: "2024-02-01", amount: 1250, sourceAccountId: cost.id, idempotencyKey: "first" }), p(x.id)));
    assert.equal(first.cost.amountMinor, "1250"); assert.equal(first.asset.purchasePriceMinor, "1250");
    const firstLines = await balanced(first.journalEntryId, 1250n);
    assert.equal(firstLines.find(l => l.debitAmount > 0)?.accountId, first.asset.cwipAccountId);
    const beforeReplay = await snapshot();
    const retry = await ma.call("add_cwip_cost", { assetId: x.id, date: "2024-02-01", amountMinor: "1250", sourceAccountId: cost.id, idempotencyKey: "first" });
    assert.equal(retry.isError, false); assert.deepEqual(retry.body, first); assert.equal(await snapshot(), beforeReplay);
    await mdenied("add_cwip_cost", { assetId: x.id, date: "2024-02-01", amount: 1251, sourceAccountId: cost.id, idempotencyKey: "first" }, ma, 409);
    const second = (await ma.call("add_cwip_cost", { assetId: x.id, date: "2024-02-29", amountMinor: "2501", sourceAccountId: cost.id })).body;
    assert.equal(second.asset.purchasePrice, 3751); await balanced(second.journalEntryId, 2501n);
    const history = await data(await list(req(), p(x.id)));
    assert.equal(history.totalMinor, "3751"); assert.equal(history.costs[0].amount, 2501); assert.ok(history.costs.every((r: { journalEntry: unknown }) => r.journalEntry));
    assert.deepEqual((await ma.call("list_cwip_costs", { assetId: x.id })).body, history);
    await denied(() => patch(req({ cwipAccountId: cost.id }), p(x.id)), 409);
    await assert.rejects(() => db.transaction(tx => lockAssetSnapshot(tx, ctx, x)), /Asset changed/);
    const cap = await data(await capitalize(req({ date: "2024-03-01", inServiceDate: "2024-03-02" }), p(x.id)));
    assert.equal(cap.capitalizedCostMinor, "3751"); assert.equal(cap.asset.isCwip, false); assert.equal(cap.asset.status, "active");
    assert.equal(cap.asset.inServiceDate, "2024-03-02"); assert.equal(cap.asset.purchasePrice, 3751); assert.equal(cap.asset.netBookValue, 3751);
    const capLines = await balanced(cap.journalEntryId, 3751n);
    assert.equal(capLines.find(l => l.creditAmount)?.accountId, second.asset.cwipAccountId);
    const capState = await snapshot();
    assert.deepEqual((await ma.call("capitalize_cwip_asset", { assetId: x.id, date: "2024-03-01", inServiceDate: "2024-03-02" })).body, cap);
    assert.equal(await snapshot(), capState);
    await denied(() => capitalize(req({ date: "2024-03-03" }), p(x.id)), 409);
    await denied(() => add(req({ date: "2024-03-03", amount: 1, sourceAccountId: cost.id }), p(x.id)), 400);
    // Opening basis must not be lost when tracked costs are present.
    const opening = await asset({ purchasePrice: 10000, netBookValue: 10000, cwipAccountId: first.asset.cwipAccountId });
    await denied(() => patch(req({ cwipAccountId: cost.id }), p(opening.id)), 409);
    await data(await add(req({ date: "2024-02-01", amount: 501, sourceAccountId: cost.id }), p(opening.id)));
    const openingCap = (await ma.call("capitalize_cwip_asset", { assetId: opening.id, date: "2024-03-01" })).body;
    assert.equal(openingCap.capitalizedCost, 10501); await balanced(openingCap.journalEntryId, 10501n);
    const fallback = await asset({ purchasePrice: 123, netBookValue: 123, cwipAccountId: first.asset.cwipAccountId });
    assert.equal((await data(await capitalize(req({ date: "2024-02-01" }), p(fallback.id)))).capitalizedCost, 123);
    const zero = await asset(); const zeroCap = (await ma.call("capitalize_cwip_asset", { assetId: zero.id, date: "2024-02-01" })).body;
    assert.equal(zeroCap.capitalizedCostMinor, "0"); assert.equal(zeroCap.journalEntryId, null);
    const fresh = await asset();
    const ops = [
      { rest: add, tool: "add_cwip_cost", body: { date: "2024-02-01", amount: 1250, sourceAccountId: cost.id } },
      { rest: capitalize, tool: "capitalize_cwip_asset", body: { date: "2024-02-01" } },
      { rest: list, tool: "list_cwip_costs", body: {} },
    ];
    for (const op of ops) {
      for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) await denied(() => op.rest(req(op.body, key), p(fresh.id)), key === keys.b ? 404 : key === keys.viewer ? 403 : 401);
      await mdenied(op.tool, { assetId: fresh.id, ...op.body }, mb, 404);
      await mdenied(op.tool, { assetId: fresh.id, ...op.body }, ro, 403);
      await denied(() => op.rest(req(op.body), p("bad-id")), 400);
    }
    for (const op of ops.slice(0, 2)) {
      for (const date of ["0000-01-01", "2024-02-30", "2024-1-1", "2024-01-01T00:00:00Z"]) {
        await denied(() => op.rest(req({ ...op.body, date }), p(fresh.id)), 400);
        await mdenied(op.tool, { assetId: fresh.id, ...op.body, date });
      }
      await denied(() => op.rest(req({ ...op.body, date: "2023-12-31" }), p(fresh.id)), 400);
      await denied(() => op.rest(req({ ...op.body, extra: true }), p(fresh.id)), 400);
      await mdenied(op.tool, { assetId: fresh.id, ...op.body, extra: true });
      await denied(() => op.rest(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), p(fresh.id)), 400);
    }
    for (const amount of [0, -1, 1.5, "1250", 9007199254740992]) {
      await denied(() => add(req({ ...ops[0].body, amount }), p(fresh.id)), 400);
      await mdenied("add_cwip_cost", { assetId: fresh.id, ...ops[0].body, amount });
    }
    for (const alias of ["01", "-0", "-1", "0", "1.5", "1e3", " 1", "۱"]) await denied(() => add(req({ date: "2024-02-01", amountMinor: alias, sourceAccountId: cost.id }), p(fresh.id)), 400);
    await denied(() => add(req({ date: "2024-02-01", amountMinor: "9007199254740992", sourceAccountId: cost.id }), p(fresh.id)), 422);
    await denied(() => add(req({ ...ops[0].body, amountMinor: "1251" }), p(fresh.id)), 400);
    await denied(() => add(req({ date: "2024-02-01", sourceAccountId: cost.id }), p(fresh.id)), 400);
    await denied(() => capitalize(req({ date: "2024-03-01", inServiceDate: "2024-02-29" }), p(fresh.id)), 400);
    const [inactive, wrongCurrency] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "9991", name: "Inactive", type: "asset", isActive: false },
      { organizationId: a.id, code: "9992", name: "GBP", type: "asset", currencyCode: "GBP" }]).returning();
    for (const accountId of [foreign.id, inactive.id, wrongCurrency.id]) {
      await denied(() => add(req({ ...ops[0].body, sourceAccountId: accountId }), p(fresh.id)), 422);
      await mdenied("capitalize_cwip_asset", { assetId: fresh.id, date: "2024-02-01", assetAccountId: accountId }, ma, 422);
    }
    await denied(() => add(req({ ...ops[0].body, cwipAccountId: expense.id }), p(fresh.id)), 422);
    await denied(() => capitalize(req({ date: "2024-02-01", assetAccountId: expense.id }), p(fresh.id)), 422);
    await denied(() => add(req({ ...ops[0].body, cwipAccountId: cost.id }), p(fresh.id)), 422); // identical debit/credit
    await denied(() => capitalize(req({ date: "2024-02-01", assetAccountId: cost.id, cwipAccountId: cost.id }), p(fresh.id)), 422);
    const [foreignCategory] = await db.insert(assetCategory).values({ organizationId: b.id, name: "Foreign" }).returning();
    const categoryAsset = await asset({ categoryId: foreignCategory.id });
    await denied(() => add(req(ops[0].body), p(categoryAsset.id)), 422);
    await mdenied("capitalize_cwip_asset", { assetId: categoryAsset.id, date: "2024-02-01" }, ma, 422);
    const noHolding = await asset({ purchasePrice: 1, netBookValue: 1 });
    await denied(() => capitalize(req({ date: "2024-02-01" }), p(noHolding.id)), 422);
    const latest = await asset(); await data(await add(req(ops[0].body), p(latest.id)));
    await denied(() => add(req({ ...ops[0].body, date: "2024-01-31" }), p(latest.id)), 409);
    await denied(() => capitalize(req({ date: "2024-01-31" }), p(latest.id)), 409);
    await denied(() => add(req({ ...ops[0].body, cwipAccountId: cost.id }), p(latest.id)), 422);
    // Period tiers and closed-year policy use the same transactional path.
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-06-30", advisorLockDate: "2024-03-31" });
    for (const op of ops.slice(0, 2)) {
      await denied(() => op.rest(req({ ...op.body, date: "2024-03-31" }), p(fresh.id)), 422);
      await mdenied(op.tool, { assetId: fresh.id, ...op.body, date: "2024-04-01" }, staff, 422);
    }
    assert.equal((await ma.call("add_cwip_cost", { assetId: fresh.id, ...ops[0].body, date: "2024-04-01" })).isError, false);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2024-01-01", endDate: "2024-12-31", isClosed: true });
    for (const op of ops.slice(0, 2)) await denied(() => op.rest(req({ ...op.body, date: "2024-05-01" }), p(fresh.id)), 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    // Exact maximum plus one rejects derived overflow before any writes.
    const max = await asset();
    const maxAdded = (await ma.call("add_cwip_cost", { assetId: max.id, date: "2024-02-01", amountMinor: "9007199254740991", sourceAccountId: cost.id })).body;
    assert.equal(maxAdded.asset.purchasePriceMinor, "9007199254740991"); await balanced(maxAdded.journalEntryId, 9007199254740991n);
    assert.equal((await data(await list(req(), p(max.id)))).totalMinor, "9007199254740991");
    await denied(() => add(req({ ...ops[0].body, amount: 1 }), p(max.id)), 422);
    const maxCap = await data(await capitalize(req({ date: "2024-03-01" }), p(max.id))); await balanced(maxCap.journalEntryId, 9007199254740991n);
    // Concurrent cross-transport costs serialize and capitalize only once.
    const concurrent = await asset();
    const twice = await Promise.all([add(req({ ...ops[0].body, idempotencyKey: "same" }), p(concurrent.id)).then(r => data(r)),
      ma.call("add_cwip_cost", { assetId: concurrent.id, ...ops[0].body, idempotencyKey: "same" }).then(r => r.body)]);
    assert.deepEqual(twice[0], twice[1]);
    await Promise.all([add(req({ ...ops[0].body, amount: 1 }), p(concurrent.id)).then(r => data(r)),
      ma.call("add_cwip_cost", { assetId: concurrent.id, ...ops[0].body, amount: 2 }).then(r => assert.equal(r.isError, false))]);
    assert.equal((await data(await list(req(), p(concurrent.id)))).totalMinor, "1253");
    const once = await Promise.all([capitalize(req({ date: "2024-03-01" }), p(concurrent.id)).then(r => data(r)),
      ma.call("capitalize_cwip_asset", { assetId: concurrent.id, date: "2024-03-01" }).then(r => r.body)]);
    assert.deepEqual(once[0], once[1]);
    const race = await asset();
    const racing = await Promise.all([add(req(ops[0].body), p(race.id)), capitalize(req({ date: "2024-03-01" }), p(race.id))]);
    const raceCost = await racing[0].json(), raceCap = await data(racing[1]);
    assert.ok([200, 400].includes(racing[0].status));
    assert.equal(raceCap.capitalizedCost, racing[0].status === 200 ? raceCost.cost.amount : 0);
    // Saved unsupported money/state/history are never silently repaired.
    const corrupt = await asset();
    await db.execute(sql`update fixed_asset set purchase_price=9007199254740992, net_book_value=9007199254740992 where id=${corrupt.id}`);
    for (const op of ops) await denied(() => op.rest(req(op.body), p(corrupt.id)), 422);
    for (const values of [{ status: "disposed" as const }, { isCwip: false }, { accumulatedDepreciation: 1 }, { revaluedAmount: 0 }, { netBookValue: 1 }]) {
      const bad = await asset(values); await denied(() => add(req(ops[0].body), p(bad.id)), values.status || values.isCwip === false ? 400 : 422);
      await mdenied("capitalize_cwip_asset", { assetId: bad.id, date: "2024-02-01" }, ma, values.status || values.isCwip === false ? 400 : 422);
    }
    const badHistory = await asset(); const h = await data(await add(req(ops[0].body), p(badHistory.id)));
    await db.update(cwipCost).set({ journalEntryId: null }).where(eq(cwipCost.id, h.cost.id));
    await denied(() => list(req(), p(badHistory.id)), 422);
    await mdenied("capitalize_cwip_asset", { assetId: badHistory.id, date: "2024-03-01" }, ma, 422);
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2024-02-01", description: "Foreign", status: "posted" }).returning();
    await db.update(cwipCost).set({ journalEntryId: foreignJournal.id }).where(eq(cwipCost.id, h.cost.id));
    for (const op of ops) await denied(() => op.rest(req({ ...op.body, ...(op.tool === "list_cwip_costs" ? {} : { date: "2024-03-01" }) }), p(badHistory.id)), 422);
    await db.update(cwipCost).set({ journalEntryId: h.journalEntryId }).where(eq(cwipCost.id, h.cost.id));
    await db.update(journalLine).set({ currencyCode: "GBP" }).where(eq(journalLine.journalEntryId, h.journalEntryId));
    await mdenied("capitalize_cwip_asset", { assetId: badHistory.id, date: "2024-03-01" }, ma, 422);
    await db.update(journalLine).set({ currencyCode: "USD", debitAmount: 0, creditAmount: 0 }).where(eq(journalLine.journalEntryId, h.journalEntryId));
    await denied(() => list(req(), p(badHistory.id)), 422);
    // Audit/output faults roll back every domain/journal/default-account mutation.
    const fault = await asset({ purchasePrice: 1250, netBookValue: 1250, cwipAccountId: first.asset.cwipAccountId });
    await db.execute(sql.raw("create function cwip_audit_fault() returns trigger language plpgsql as $$ begin if NEW.entity_type='fixed_asset' then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger cwip_audit_fault before insert on audit_log for each row execute function cwip_audit_fault()"));
    for (const op of ops.slice(0, 2)) {
      await denied(() => op.rest(req({ ...op.body, date: "2024-09-01" }), p(fault.id)), 500);
      await mdenied(op.tool, { assetId: fault.id, ...op.body, date: "2024-09-01" });
    }
    // Org B has no defaults: failure must also roll back newly created accounts.
    const bAdd = await asset({ organizationId: b.id, assetAccountId: null, depreciationAccountId: null, accumulatedDepAccountId: null });
    const bCap = await asset({ organizationId: b.id, purchasePrice: 1, netBookValue: 1, cwipAccountId: foreign.id,
      assetAccountId: null, depreciationAccountId: null, accumulatedDepAccountId: null });
    await denied(() => add(req({ date: "2024-09-01", amount: 1, sourceAccountId: foreign.id }, keys.b), p(bAdd.id)), 500);
    await mdenied("add_cwip_cost", { assetId: bAdd.id, date: "2024-09-01", amount: 1, sourceAccountId: foreign.id }, mb);
    await denied(() => capitalize(req({ date: "2024-09-01" }, keys.b), p(bCap.id)), 500);
    await mdenied("capitalize_cwip_asset", { assetId: bCap.id, date: "2024-09-01" }, mb);
    await db.execute(sql.raw("drop trigger cwip_audit_fault on audit_log; drop function cwip_audit_fault()"));
    await db.execute(sql.raw("create function cwip_money_fault() returns trigger language plpgsql as $$ begin NEW.net_book_value=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger cwip_money_fault before update on fixed_asset for each row execute function cwip_money_fault()"));
    for (const op of ops.slice(0, 2)) {
      await denied(() => op.rest(req({ ...op.body, date: "2024-09-01" }), p(fault.id)), 422);
      await mdenied(op.tool, { assetId: fault.id, ...op.body, date: "2024-09-01" }, ma, 422);
    }
    await db.execute(sql.raw("drop trigger cwip_money_fault on fixed_asset; drop function cwip_money_fault()"));
    await db.execute(sql.raw("create function cwip_line_fault() returns trigger language plpgsql as $$ begin NEW.debit_amount=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger cwip_line_fault before insert on journal_line for each row execute function cwip_line_fault()"));
    await denied(() => add(req(ops[0].body), p(fault.id)), 422);
    await mdenied("add_cwip_cost", { assetId: fault.id, ...ops[0].body }, ma, 422);
    await denied(() => capitalize(req({ date: "2024-03-01" }), p(fault.id)), 422);
    await mdenied("capitalize_cwip_asset", { assetId: fault.id, date: "2024-03-01" }, ma, 422);
    await db.execute(sql.raw("drop trigger cwip_line_fault on journal_line; drop function cwip_line_fault()"));
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, fault.id));
    for (const op of ops) await denied(() => op.rest(req(op.body), p(fault.id)), 404);
    console.log("Asset CWIP contracts verified: actual REST/MCP, exact money, ledger, scope, locks, retries, concurrency and atomic failures");
  } finally { await ma.close(); await mb.close(); await ro.close(); await staff.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
