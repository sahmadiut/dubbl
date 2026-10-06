import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, fixedAsset, chartAccount, assetRevaluation, depreciationEntry, journalEntry, journalLine, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { POST as revalue } from "../../app/api/v1/fixed-assets/[id]/revalue/route";
import { POST as impair } from "../../app/api/v1/fixed-assets/[id]/impair/route";
import { POST as dispose } from "../../app/api/v1/fixed-assets/[id]/dispose/route";
import { POST as depreciate } from "../../app/api/v1/fixed-assets/[id]/depreciate/route";
import { POST as rollbackDepreciation } from "../../app/api/v1/fixed-assets/[id]/rollback-depreciation/route";
import { GET as get } from "../../app/api/v1/fixed-assets/[id]/route";
import { PATCH as patch } from "../../app/api/v1/fixed-assets/[id]/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { lockAssetSnapshot } from "../../lib/api/asset-depreciation";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Depreciation fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["revalue_fixed_asset", "impair_fixed_asset", "dispose_fixed_asset"]) {
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
    const result = await db.execute(sql.raw("select jsonb_build_object('assets',(select jsonb_agg(to_jsonb(t) order by id) from fixed_asset t),'revaluation',(select jsonb_agg(to_jsonb(t) order by id) from asset_revaluation t),'accounts',(select jsonb_agg(to_jsonb(t) order by id) from chart_account t),'depreciation',(select jsonb_agg(to_jsonb(t) order by id) from depreciation_entry t),'journals',(select jsonb_agg(to_jsonb(t) order by id) from journal_entry t),'lines',(select jsonb_agg(to_jsonb(t) order by id) from journal_line t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(result.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown>, client = ma, status?: number) {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, JSON.stringify(result));
    if (status) assert.equal(result.body.status, status); assert.equal(await snapshot(), before);
  }
  let tag = 0;
  async function asset(values: Partial<typeof fixedAsset.$inferInsert> = {}) {
    const [row] = await db.insert(fixedAsset).values({ organizationId: a.id, name: "Exact", assetNumber: "DEP" + ++tag, purchaseDate: "2024-01-01", purchasePrice: 125003,
      residualValue: 1000, usefulLifeMonths: 60, netBookValue: 125003, assetAccountId: cost.id, depreciationAccountId: expense.id, accumulatedDepAccountId: accum.id, ...values }).returning();
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
    const dep = await data(await depreciate(req({ date: "2024-02-29" }), p(x.id)));
    assert.equal(dep.depreciationEntry.amount, 2067);
    const up = await data(await revalue(req({ date: "2024-03-01", revaluedAmount: 150000, idempotencyKey: "up" }), p(x.id)));
    assert.equal(up.revaluation.changeAmountMinor, "27064"); assert.equal(up.asset.revaluationSurplusBalanceMinor, "27064");
    await balanced(up.journalEntryId, 27064n);
    const before = await snapshot();
    assert.deepEqual((await ma.call("revalue_fixed_asset", { assetId: x.id, date: "2024-03-01", revaluedAmountMinor: "150000", idempotencyKey: "up" })).body, up);
    assert.equal(await snapshot(), before);
    await mdenied("revalue_fixed_asset", { assetId: x.id, date: "2024-03-01", revaluedAmountMinor: "150001", idempotencyKey: "up" }, ma, 409);
    const down = await ma.call("impair_fixed_asset", { assetId: x.id, date: "2024-04-01", recoverableAmountMinor: "100000", idempotencyKey: "down" });
    assert.equal(down.isError, false, JSON.stringify(down));
    assert.equal(down.body.impairment.changeAmountMinor, "-50000"); assert.equal(down.body.impairment.surplusAmountMinor, "-27064");
    assert.equal(down.body.impairment.impairmentAmountMinor, "-22936"); await balanced(down.body.journalEntryId, 50000n);
    const replayDown = await data(await impair(req({ date: "2024-04-01", revaluedAmount: 100000, idempotencyKey: "down" }), p(x.id)));
    assert.deepEqual(replayDown.revaluation, down.body.impairment);
    const recovery = await data(await revalue(req({ date: "2024-05-01", revaluedAmountMinor: "140000" }), p(x.id)));
    assert.equal(recovery.revaluation.impairmentAmountMinor, "22936"); assert.equal(recovery.revaluation.surplusAmountMinor, "17064");
    const detail = await data(await get(req(), p(x.id))); assert.equal(detail.asset.revaluations.length, 3);
    assert.equal(detail.asset.revaluations.find((r: { isImpairment: boolean }) => r.isImpairment).impairmentAmountMinor, "-22936");
    const sold = await ma.call("dispose_fixed_asset", { assetId: x.id, date: "2024-06-01", disposalAmountMinor: "160000" });
    assert.equal(sold.isError, false, JSON.stringify(sold)); assert.equal(sold.body.gainOrLossMinor, "20000"); assert.equal(sold.body.catchUpAmount, 0);
    assert.equal(sold.body.netBookValueAtDisposalMinor, "140000"); assert.equal(sold.body.asset.revaluationSurplusBalance, 0);
    const saleLines = await balanced(sold.body.journalEntryId, 162067n);
    assert.equal(saleLines.find(l => l.accountId === cost.id)?.creditAmount, 142067);
    await balanced(sold.body.surplusJournalEntryId, 17064n);
    const soldState = await snapshot(); assert.deepEqual(await data(await dispose(req({ date: "2024-06-01", disposalAmount: 160000 }), p(x.id))), sold.body);
    assert.equal(await snapshot(), soldState);
    await denied(() => dispose(req({ date: "2024-06-01", disposalAmount: 160001 }), p(x.id)), 409);
    await denied(() => revalue(req({ date: "2024-07-01", revaluedAmount: 170000 }), p(x.id)), 400);
    // Ordinary disposal catches up exactly once; an already-booked month never charges twice.
    const ordinary = await asset();
    const ordinarySale = await data(await dispose(req({ date: "2024-02-29", disposalAmount: 100000 }), p(ordinary.id)));
    assert.equal(ordinarySale.catchUpAmountMinor, "2067"); assert.equal(ordinarySale.gainOrLossMinor, "-22936");
    await balanced(ordinarySale.catchUpJournalEntryId, 2067n); await balanced(ordinarySale.journalEntryId, 125003n);
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, ordinary.id))).length, 1);
    // Disposal-first must reject depreciation and rollback as lifecycle errors,
    // including a replay of the catch-up month, without changing the ledger.
    for (const date of ["2024-02-29", "2024-03-01"]) {
      await denied(() => depreciate(req({ date }), p(ordinary.id)), 400);
      await denied(() => rollbackDepreciation(req({ date }), p(ordinary.id)), 400);
      await mdenied("run_asset_depreciation", { assetId: ordinary.id, date }, ma, 400);
      await mdenied("rollback_asset_depreciation", { assetId: ordinary.id, date }, ma, 400);
    }
    const monthly = await asset(); await data(await depreciate(req({ date: "2024-02-01" }), p(monthly.id)));
    assert.equal((await data(await dispose(req({ date: "2024-02-29", disposalAmount: 122936 }), p(monthly.id)))).catchUpAmount, 0);
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, monthly.id))).length, 1);
    const usage = await asset({ depreciationMethod: "units_of_production", totalExpectedUnits: 100 });
    assert.equal((await ma.call("dispose_fixed_asset", { assetId: usage.id, date: "2024-02-29", disposalAmount: 0 })).body.catchUpAmount, 0);
    const track = await asset({ assetAccountId: null, depreciationAccountId: null, accumulatedDepAccountId: null });
    const tracking = await data(await impair(req({ date: "2024-02-01", revaluedAmountMinor: "100000" }), p(track.id)));
    assert.equal(tracking.journalEntryId, null); assert.equal(tracking.revaluation.impairmentAmountMinor, "-25003");
    const trackingSale = await data(await dispose(req({ date: "2024-03-01", disposalAmount: 100000 }), p(track.id)));
    assert.equal(trackingSale.journalEntryId, null); assert.equal(trackingSale.gainOrLoss, 0);
    const trackDep = await asset({ assetAccountId: null, depreciationAccountId: null, accumulatedDepAccountId: null });
    const trackSale = (await ma.call("dispose_fixed_asset", { assetId: trackDep.id, date: "2024-02-01", disposalAmount: 0 })).body;
    assert.equal(trackSale.catchUpAmount, 2067); assert.equal(trackSale.asset.accumulatedDepreciation, 2067);
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, trackDep.id))).length, 1);
    // Exact-created max-safe cents remain numeric-compatible through signed loss/recovery/disposal.
    const max = (await ma.call("create_fixed_asset", { name: "Max", assetNumber: "MAX", purchaseDate: "2024-01-01", purchasePriceMinor: "9007199254740991", usefulLifeMonths: 1 })).body.asset;
    const zero = await data(await impair(req({ date: "2024-02-01", revaluedAmountMinor: "0" }), p(max.id)));
    assert.equal(zero.revaluation.impairmentAmountMinor, "-9007199254740991");
    const maxUp = (await ma.call("revalue_fixed_asset", { assetId: max.id, date: "2024-03-01", revaluedAmountMinor: "9007199254740991" })).body;
    assert.equal(maxUp.revaluation.impairmentAmountMinor, "9007199254740991"); assert.equal(maxUp.revaluation.surplusAmount, 0);
    const maxSale = await data(await dispose(req({ date: "2024-04-01", disposalAmountMinor: "0" }), p(max.id)));
    assert.equal(maxSale.gainOrLossMinor, "-9007199254740991");
    const fresh = await asset();
    const ops = [
      { rest: revalue, tool: "revalue_fixed_asset", body: { revaluedAmount: 150000 }, args: { revaluedAmount: 150000 } },
      { rest: impair, tool: "impair_fixed_asset", body: { revaluedAmount: 100000 }, args: { recoverableAmount: 100000 } },
      { rest: dispose, tool: "dispose_fixed_asset", body: { disposalAmount: 100000 }, args: { disposalAmount: 100000 } },
    ];
    for (const op of ops) {
      for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) await denied(() => op.rest(req({ date: "2024-02-01", ...op.body }, key), p(fresh.id)), key === keys.b ? 404 : key === keys.viewer ? 403 : 401);
      await mdenied(op.tool, { assetId: fresh.id, date: "2024-02-01", ...op.args }, mb, 404);
      await mdenied(op.tool, { assetId: fresh.id, date: "2024-02-01", ...op.args }, ro, 403);
      for (const body of [{ date: "2024-02-30" }, { date: "2024-02-01", idempotencyKey: " " }, { date: "2024-02-01", currency: "IRR" }]) {
        await denied(() => op.rest(req({ ...op.body, ...body }), p(fresh.id)), 400);
        await mdenied(op.tool, { assetId: fresh.id, ...op.args, ...body });
      }
      await denied(() => op.rest(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), p(fresh.id)), 400);
      await denied(() => op.rest(req({ date: "2023-12-31", ...op.body }), p(fresh.id)), 400);
    }
    for (const amount of [-1, -0, 1.5, "1250", 9007199254740992]) {
      // JSON cannot preserve numeric -0; direct MCP validation does.
      if (!Object.is(amount, -0)) await denied(() => revalue(req({ date: "2024-02-01", revaluedAmount: amount }), p(fresh.id)), 400);
      await mdenied("impair_fixed_asset", { assetId: fresh.id, date: "2024-02-01", recoverableAmount: amount });
    }
    await denied(() => revalue(req({ date: "2024-02-01", revaluedAmountMinor: "9007199254740992" }), p(fresh.id)), 422);
    await denied(() => impair(req({ date: "2024-02-01", revaluedAmount: 100000, revaluedAmountMinor: "100001" }), p(fresh.id)), 400);
    for (const accountId of [foreign.id, expense.id]) {
      if (accountId === expense.id) await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, expense.id));
      await denied(() => revalue(req({ date: "2024-02-01", revaluedAmount: 150000, impairmentExpenseAccountId: accountId }), p(fresh.id)), 422);
      await mdenied("impair_fixed_asset", { assetId: fresh.id, date: "2024-02-01", recoverableAmount: 100000, revaluationReserveAccountId: accountId }, ma, 422);
      await denied(() => dispose(req({ date: "2024-02-01", disposalAmount: 0, proceedsAccountId: accountId }), p(fresh.id)), 422);
      if (accountId === expense.id) await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, expense.id));
    }
    await denied(() => revalue(req({ date: "2024-02-01", revaluedAmount: 150000, revaluationReserveAccountId: cost.id }), p(fresh.id)), 422);
    const partial = await asset({ assetAccountId: null }); await denied(() => dispose(req({ date: "2024-02-01", disposalAmount: 0 }), p(partial.id)), 422);
    const cwip = await asset({ isCwip: true, status: "in_progress" });
    for (const op of ops) await denied(() => op.rest(req({ date: "2024-02-01", ...op.body }), p(cwip.id)), 400);
    const removed = await asset({ deletedAt: new Date() });
    for (const op of ops) await mdenied(op.tool, { assetId: removed.id, date: "2024-02-01", ...op.args }, ma, 404);
    // Staff/advisor tiers and closed years apply to all three pairs.
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-06-30", advisorLockDate: "2024-03-31" });
    for (const op of ops) {
      await denied(() => op.rest(req({ date: "2024-03-01", ...op.body }), p(fresh.id)), 422);
      await mdenied(op.tool, { assetId: fresh.id, date: "2024-04-01", ...op.args }, staff, 422);
      const unlocked = await asset(); assert.equal((await ma.call(op.tool, { assetId: unlocked.id, date: "2024-04-01", ...op.args })).isError, false);
    }
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2023-01-01", endDate: "2023-12-31", isClosed: true });
    const old = await asset({ purchaseDate: "2022-01-01" });
    for (const op of ops) { await denied(() => op.rest(req({ date: "2023-06-01", ...op.body }), p(old.id)), 422); await mdenied(op.tool, { assetId: old.id, date: "2023-06-01", ...op.args }, ma, 422); }
    // Concurrency: same key posts once across transports, and conflicting life-cycle operations serialize.
    const raced = await asset();
    const races = await Promise.all([revalue(req({ date: "2024-07-01", revaluedAmount: 150000, idempotencyKey: "race" }), p(raced.id)),
      ma.call("revalue_fixed_asset", { assetId: raced.id, date: "2024-07-01", revaluedAmountMinor: "150000", idempotencyKey: "race" })]);
    assert.deepEqual(await data(races[0]), races[1].body); assert.equal(races[1].isError, false);
    assert.equal((await db.select().from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, raced.id))).length, 1);
    const sameDay = await asset();
    await data(await revalue(req({ date: "2024-07-01", revaluedAmount: 150000 }), p(sameDay.id)));
    assert.equal((await ma.call("revalue_fixed_asset", { assetId: sameDay.id, date: "2024-07-01", revaluedAmount: 160000 })).isError, false);
    assert.equal((await ma.call("impair_fixed_asset", { assetId: sameDay.id, date: "2024-07-01", recoverableAmount: 140000 })).isError, false);
    assert.equal((await data(await dispose(req({ date: "2024-07-01", disposalAmount: 140000 }), p(sameDay.id)))).gainOrLoss, 0);
    const sales = await Promise.all([dispose(req({ date: "2024-08-01", disposalAmount: 100000 }), p(raced.id)), ma.call("dispose_fixed_asset", { assetId: raced.id, date: "2024-08-01", disposalAmountMinor: "100000" })]);
    assert.deepEqual(await data(sales[0]), sales[1].body); assert.equal(sales[1].isError, false);
    const raceDep = await asset();
    const depRace = await Promise.all([depreciate(req({ date: "2024-07-01" }), p(raceDep.id)), dispose(req({ date: "2024-07-01", disposalAmount: 100000 }), p(raceDep.id))]);
    const depRaceBody = await depRace[0].json();
    assert.ok([200, 400].includes(depRace[0].status), JSON.stringify({ status: depRace[0].status, body: depRaceBody })); await data(depRace[1]);
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, raceDep.id))).length, 1);
    const stale = await asset(); const original = { ...stale };
    await data(await impair(req({ date: "2024-02-01", revaluedAmount: 100000 }), p(stale.id)));
    await assert.rejects(() => db.transaction(tx => lockAssetSnapshot(tx, ctx, original)), /Asset changed/);
    await denied(() => patch(req({ usefulLifeMonths: 2 }), p(stale.id)), 409);
    await denied(() => dispose(req({ date: "2024-01-31", disposalAmount: 0 }), p(stale.id)), 409);
    await denied(() => depreciate(req({ date: "2024-03-01" }), p(stale.id)), 422);
    // Inconsistent legacy MCP positive impairment must not be silently reinterpreted.
    const [staleRev] = await db.select().from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, stale.id));
    await db.update(assetRevaluation).set({ impairmentAmount: 25003 }).where(eq(assetRevaluation.id, staleRev.id));
    for (const op of ops) await denied(() => op.rest(req({ date: "2024-03-01", ...op.body }), p(stale.id)), 422);
    await db.update(assetRevaluation).set({ impairmentAmount: -25003 }).where(eq(assetRevaluation.id, staleRev.id));
    await db.update(fixedAsset).set({ netBookValue: 100001 }).where(eq(fixedAsset.id, stale.id));
    await mdenied("dispose_fixed_asset", { assetId: stale.id, date: "2024-03-01", disposalAmount: 0 }, ma, 422);
    const corrupt = await asset(); await db.execute(sql`update fixed_asset set purchase_price=9007199254740992 where id=${corrupt.id}`);
    for (const op of ops) await mdenied(op.tool, { assetId: corrupt.id, date: "2024-02-01", ...op.args }, ma, 422);
    await db.update(organization).set({ defaultCurrency: "GBP" }).where(eq(organization.id, a.id));
    for (const op of ops) await denied(() => op.rest(req({ date: "2024-03-01", ...op.body }), p(fresh.id)), 422);
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    // Every operation must roll back journals/history/totals/default accounts if audit fails.
    await db.execute(sql.raw("create function valuation_audit_fault() returns trigger language plpgsql as $$ begin if NEW.entity_type='fixed_asset' then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger valuation_audit_fault before insert on audit_log for each row execute function valuation_audit_fault()"));
    for (const op of ops) { await denied(() => op.rest(req({ date: "2024-09-01", ...op.body }), p(fresh.id)), 500); await mdenied(op.tool, { assetId: fresh.id, date: "2024-09-01", ...op.args }); }
    // A new tenant has no default surplus/P&L accounts yet; failing audit must
    // also roll back their on-demand creation in each actual transport.
    const [c] = await db.insert(organization).values({ name: "Fault C", slug: "fault-c" }).returning();
    await db.insert(member).values({ organizationId: c.id, userId: owner.id, role: "owner" });
    const ck = "dk_valuation_c";
    await db.insert(apiKey).values({ organizationId: c.id, createdBy: owner.id, name: "c", keyHash: createHash("sha256").update(ck).digest("hex"), keyPrefix: "dk_val" });
    const [cc] = await db.insert(chartAccount).values({ organizationId: c.id, code: "1501", name: "Cost C", type: "asset" }).returning();
    const ca = await asset({ organizationId: c.id, assetAccountId: cc.id, depreciationAccountId: null, accumulatedDepAccountId: null });
    const mc = await connect({ ...ctx, organizationId: c.id });
    try {
      for (const op of ops) {
        await denied(() => op.rest(req({ date: "2024-09-01", ...op.body }, ck), p(ca.id)), 500);
        await mdenied(op.tool, { assetId: ca.id, date: "2024-09-01", ...op.args }, mc);
      }
    } finally { await mc.close(); }
    await db.execute(sql.raw("drop trigger valuation_audit_fault on audit_log; drop function valuation_audit_fault()"));
    // Unsafe returned root or journal amounts fail inside the transaction.
    await db.execute(sql.raw("create function valuation_money_fault() returns trigger language plpgsql as $$ begin NEW.net_book_value=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger valuation_money_fault before update on fixed_asset for each row execute function valuation_money_fault()"));
    for (const op of ops) { await denied(() => op.rest(req({ date: "2024-09-01", ...op.body }), p(fresh.id)), 422); await mdenied(op.tool, { assetId: fresh.id, date: "2024-09-01", ...op.args }, ma, 422); }
    await db.execute(sql.raw("drop trigger valuation_money_fault on fixed_asset; drop function valuation_money_fault()"));
    await db.execute(sql.raw("create function valuation_line_fault() returns trigger language plpgsql as $$ begin NEW.debit_amount=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger valuation_line_fault before insert on journal_line for each row execute function valuation_line_fault()"));
    await denied(() => revalue(req({ date: "2024-09-01", revaluedAmount: 150000 }), p(fresh.id)), 422);
    await mdenied("dispose_fixed_asset", { assetId: fresh.id, date: "2024-09-01", disposalAmount: 100000 }, ma, 422);
    await db.execute(sql.raw("drop trigger valuation_line_fault on journal_line; drop function valuation_line_fault()"));
    // Foreign links, account/currency history and chronology are preflighted.
    const foreignHistory = await asset(); const fh = await data(await impair(req({ date: "2024-02-01", revaluedAmount: 100000 }), p(foreignHistory.id)));
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2024-02-01", description: "Foreign", status: "posted" }).returning();
    await db.update(assetRevaluation).set({ journalEntryId: foreignJournal.id }).where(eq(assetRevaluation.id, fh.revaluation.id));
    await denied(() => dispose(req({ date: "2024-03-01", disposalAmount: 0 }), p(foreignHistory.id)), 422);
    await db.update(assetRevaluation).set({ journalEntryId: fh.journalEntryId }).where(eq(assetRevaluation.id, fh.revaluation.id));
    await db.update(journalLine).set({ currencyCode: "GBP" }).where(eq(journalLine.journalEntryId, fh.journalEntryId));
    await mdenied("revalue_fixed_asset", { assetId: foreignHistory.id, date: "2024-03-01", revaluedAmount: 150000 }, ma, 422);
    await db.update(journalLine).set({ currencyCode: "USD", debitAmount: 0, creditAmount: 0 }).where(eq(journalLine.journalEntryId, fh.journalEntryId));
    await denied(() => dispose(req({ date: "2024-03-01", disposalAmount: 0 }), p(foreignHistory.id)), 422);
    // All inputs can be safe while the adjusted GL gross cannot fit the bridge.
    const grossRange = await asset({ purchasePrice: Number.MAX_SAFE_INTEGER, netBookValue: Number.MAX_SAFE_INTEGER - 1, accumulatedDepreciation: 1, residualValue: 0 });
    await data(await revalue(req({ date: "2024-02-01", revaluedAmountMinor: "9007199254740991" }), p(grossRange.id)));
    await denied(() => dispose(req({ date: "2024-03-01", disposalAmount: 0 }), p(grossRange.id)), 422);
    console.log("Asset valuation contracts verified: three pairs, exact signed splits, carrying disposal, auth/scope, periods, replay, faults and concurrency");
  } finally { await ma.close(); await mb.close(); await ro.close(); await staff.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
