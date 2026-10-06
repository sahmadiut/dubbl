import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, desc, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, fixedAsset, chartAccount, depreciationEntry, journalEntry, journalLine, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { POST as post } from "../../app/api/v1/fixed-assets/[id]/depreciate/route";
import { POST as rollback } from "../../app/api/v1/fixed-assets/[id]/rollback-depreciation/route";
import { POST as batch } from "../../app/api/v1/fixed-assets/run-depreciation/route";
import { PATCH as patch } from "../../app/api/v1/fixed-assets/[id]/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { lockAssetSnapshot } from "../../lib/api/asset-depreciation";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Depreciation fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["run_asset_depreciation", "run_assets_depreciation", "rollback_asset_depreciation"]) {
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
  const [expense, accum, foreign] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "5900", name: "Dep expense", type: "expense" },
    { organizationId: a.id, code: "1590", name: "Accum dep", type: "asset" }, { organizationId: b.id, code: "1590", name: "Foreign", type: "asset" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const staff = await connect({ ...ctx, role: "member", permissions: ["manage:assets"] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const result = await db.execute(sql.raw("select jsonb_build_object('assets',(select jsonb_agg(to_jsonb(t) order by id) from fixed_asset t),'depreciation',(select jsonb_agg(to_jsonb(t) order by id) from depreciation_entry t),'journals',(select jsonb_agg(to_jsonb(t) order by id) from journal_entry t),'lines',(select jsonb_agg(to_jsonb(t) order by id) from journal_line t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
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
      residualValue: 1000, usefulLifeMonths: 60, netBookValue: 125003, depreciationAccountId: expense.id, accumulatedDepAccountId: accum.id, ...values }).returning();
    return row;
  }
  try {
    const x = await asset();
    const first = await data(await post(req({ date: "2024-02-29", idempotencyKey: "first" }), p(x.id)));
    assert.equal(first.depreciationEntry.amount, 2067); assert.equal(first.depreciationEntry.amountMinor, "2067");
    assert.equal(first.asset.accumulatedDepreciationMinor, "2067"); assert.equal(first.asset.netBookValueMinor, "122936");
    assert.equal(first.depreciationEntry.periodEnd, "2024-02-29");
    const firstLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, first.journalEntryId));
    assert.equal(firstLines[0].currencyCode, "USD"); assert.equal(firstLines[0].rateExact, "1");
    const before = await snapshot();
    const duplicate = await ma.call("run_asset_depreciation", { assetId: x.id, date: "2024-02-29", idempotencyKey: "first" });
    assert.equal(duplicate.isError, false); assert.deepEqual(duplicate.body, first); assert.equal(await snapshot(), before);
    assert.equal((await data(await post(req({ date: "2024-02-10" }), p(x.id)))).depreciationEntry.id, first.depreciationEntry.id);
    assert.equal(await snapshot(), before);
    await mdenied("run_asset_depreciation", { assetId: x.id, date: "2024-03-01", idempotencyKey: "first" }, ma, 409);
    const second = (await ma.call("run_asset_depreciation", { assetId: x.id, date: "2024-03-31" })).body;
    await denied(() => rollback(req({ date: "2024-04-01", depreciationEntryId: first.depreciationEntry.id }), p(x.id)), 409);
    const reversed = await data(await rollback(req({ date: "2024-04-01", depreciationEntryId: second.depreciationEntry.id }), p(x.id)));
    assert.equal(reversed.reversedAmountMinor, "2067"); assert.equal(reversed.voidedJournalEntryId, null);
    const [original] = await db.select().from(journalEntry).where(eq(journalEntry.id, second.journalEntryId));
    assert.equal(original.status, "posted"); assert.equal(original.reversedByEntryId, reversed.journalEntryId);
    const [rev] = await db.select().from(journalEntry).where(eq(journalEntry.id, reversed.journalEntryId)); assert.equal(rev.reversesEntryId, original.id);
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, reversed.journalEntryId));
    assert.equal(lines.find(l => l.accountId === accum.id)?.debitAmount, 2067); assert.equal(lines.find(l => l.accountId === expense.id)?.creditAmount, 2067);
    assert.equal(lines[0].rateExact, "1"); assert.equal(lines[0].rateProvenance, "legacy_scaled_1e6:transaction");
    const undoState = await snapshot(); assert.deepEqual((await ma.call("rollback_asset_depreciation", { assetId: x.id, date: "2024-04-01", depreciationEntryId: second.depreciationEntry.id })).body, reversed);
    assert.equal(await snapshot(), undoState);
    // Undo reuses original accounts, including historically inactive accounts.
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, expense.id));
    await data(await rollback(req({ date: "2024-04-01", depreciationEntryId: first.depreciationEntry.id }), p(x.id)));
    await denied(() => post(req({ date: "2024-04-01" }), p(x.id)), 422);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, expense.id));
    // Posting stamps the current base, while older depreciation blocks repricing.
    await db.update(organization).set({ defaultCurrency: "GBP" }).where(eq(organization.id, a.id));
    await denied(() => post(req({ date: "2024-04-01" }), p(x.id)), 422);
    const pound = await asset({ usefulLifeMonths: 1 });
    const poundDep = await data(await post(req({ date: "2024-04-01" }), p(pound.id)));
    assert.equal((await db.select().from(journalLine).where(eq(journalLine.journalEntryId, poundDep.journalEntryId)))[0].currencyCode, "GBP");
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    await db.transaction(async tx => {
      await tx.execute(sql`alter table journal_line disable trigger journal_line_exact_sync`);
      await tx.update(journalLine).set({ rateProvenance: "authoritative_fixture" }).where(eq(journalLine.journalEntryId, poundDep.journalEntryId));
      await tx.execute(sql`alter table journal_line enable trigger journal_line_exact_sync`);
    });
    await mdenied("rollback_asset_depreciation", { assetId: pound.id, date: "2024-04-01", depreciationEntryId: poundDep.depreciationEntry.id }, ma, 422);
    await db.update(journalLine).set({ rateProvenance: "legacy_scaled_1e6:transaction" }).where(eq(journalLine.journalEntryId, poundDep.journalEntryId));
    const poundUndo = (await ma.call("rollback_asset_depreciation", { assetId: pound.id, date: "2024-04-01", depreciationEntryId: poundDep.depreciationEntry.id })).body;
    assert.equal((await db.select().from(journalLine).where(eq(journalLine.journalEntryId, poundUndo.journalEntryId)))[0].currencyCode, "GBP");
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, pound.id));
    // Actual REST/MCP timing paths close the depreciable base exactly.
    for (const method of ["straight_line", "declining_balance", "sum_of_years_digits"] as const) {
      for (const convention of ["full_month", "mid_month", "half_year", "mid_quarter", "pro_rata_days", "full_at_purchase"] as const) {
        const timed = await asset({ purchaseDate: "2024-02-29", purchasePrice: 101, netBookValue: 101, residualValue: 1, usefulLifeMonths: 2, depreciationMethod: method, convention });
        const opening = await data(await post(req({ date: "2024-02-29" }), p(timed.id)));
        let total = opening.depreciationEntry.amount;
        if (opening.asset.status === "active") {
          const closing = await ma.call("run_asset_depreciation", { assetId: timed.id, date: "2024-03-31" }); assert.equal(closing.isError, false);
          total += closing.body.depreciationEntry.amount; assert.equal(closing.body.asset.netBookValueMinor, "1");
        }
        assert.equal(total, 100);
        const state = await snapshot();
        assert.equal((await ma.call("run_asset_depreciation", { assetId: timed.id, date: "2024-03-01" })).isError, convention === "full_at_purchase" || (method === "declining_balance" && convention === "full_month"));
        assert.equal(await snapshot(), state);
      }
    }
    const noGl = await asset({ depreciationAccountId: null, accumulatedDepAccountId: null, usefulLifeMonths: 1 });
    const noGlPosted = await data(await post(req({ date: "2024-04-01" }), p(noGl.id))); assert.equal(noGlPosted.journalEntryId, null);
    const noGlUndone = (await ma.call("rollback_asset_depreciation", { assetId: noGl.id, date: "2024-04-01", depreciationEntryId: noGlPosted.depreciationEntry.id })).body;
    assert.equal(noGlUndone.journalEntryId, null); assert.equal(noGlUndone.asset.accumulatedDepreciationMinor, "0");
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, noGl.id));
    const future = await asset({ inServiceDate: "9999-01-01" }); await denied(() => post(req({ date: "2024-04-01" }), p(future.id)), 400);
    const revalued = await asset({ revaluedAmount: 125003 }); await mdenied("run_asset_depreciation", { assetId: revalued.id }, ma, 422);
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, revalued.id));
    // Max-safe exact-created asset and exact rational multiplication.
    const maximal = (await ma.call("create_fixed_asset", { name: "Max", assetNumber: "MAX", purchaseDate: "2024-01-01", purchasePriceMinor: "9007199254740991",
      usefulLifeMonths: 2147483647, depreciationMethod: "sum_of_years_digits", depreciationAccountId: expense.id, accumulatedDepAccountId: accum.id })).body.asset;
    const maxCharge = (await ma.call("run_asset_depreciation", { assetId: maximal.id, date: "2024-04-01" })).body;
    assert.equal(maxCharge.depreciationEntry.amountMinor, "8388608"); assert.equal(maxCharge.asset.netBookValueMinor, "9007199246352383");
    const usage = await asset({ depreciationMethod: "units_of_production", totalExpectedUnits: 100 });
    await denied(() => post(req({ date: "2024-02-01" }), p(usage.id)), 400);
    const used = (await ma.call("run_asset_depreciation", { assetId: usage.id, date: "2024-02-01", unitsThisPeriod: 25 })).body;
    assert.equal(used.depreciationEntry.amountMinor, "31001");
    await mdenied("run_asset_depreciation", { assetId: usage.id, date: "2024-02-02", unitsThisPeriod: 26 }, ma, 409);
    await denied(() => post(req({ date: "2024-02-01", unitsThisPeriod: 1 }), p(x.id)), 400);
    for (const body of [{ date: "2024-02-30" }, { unitsThisPeriod: 1.5 }, { unitsThisPeriod: -1 }, { unitsThisPeriod: 2147483648 }, { unitsThisPeriod: "1" }, { amountMinor: "100" }, { idempotencyKey: " " }]) {
      await denied(() => post(req(body), p(x.id)), 400); await mdenied("run_asset_depreciation", { assetId: x.id, ...body });
    }
    await denied(() => post(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), p(x.id)), 400);
    // Every operation checks auth/scope; foreign batch returns only foreign results.
    for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.b ? 404 : key === keys.viewer ? 403 : 401;
      await denied(() => post(req({}, key), p(x.id)), status); await denied(() => rollback(req({}, key), p(x.id)), status);
      if (key !== keys.b) await denied(() => batch(req({}, key)), status);
    }
    for (const name of ["run_asset_depreciation", "rollback_asset_depreciation"]) {
      await mdenied(name, { assetId: x.id }, mb, 404); await mdenied(name, { assetId: x.id }, ro, 403);
    }
    await mdenied("run_assets_depreciation", {}, ro, 403);
    assert.equal((await mb.call("run_assets_depreciation", {})).body.processed, 0);
    const retired = await asset({ deletedAt: new Date() }); await denied(() => post(req(), p(retired.id)), 404);
    const cwip = await asset({ isCwip: true, status: "in_progress" }); await mdenied("run_asset_depreciation", { assetId: cwip.id }, ma, 400);
    const badAccount = await asset({ accumulatedDepAccountId: foreign.id }); await denied(() => post(req(), p(badAccount.id)), 422);
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, badAccount.id));
    const partial = await asset({ accumulatedDepAccountId: null }); await mdenied("run_asset_depreciation", { assetId: partial.id }, ma, 422);
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, partial.id));
    // Staff/advisor tiers and closed fiscal year in actual transports.
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-06-30", advisorLockDate: "2024-03-31" });
    const locked = await asset();
    await denied(() => post(req({ date: "2024-03-31" }), p(locked.id)), 422);
    await mdenied("run_asset_depreciation", { assetId: locked.id, date: "2024-04-01" }, staff, 422);
    assert.equal((await ma.call("run_asset_depreciation", { assetId: locked.id, date: "2024-04-01" })).isError, false);
    await db.update(periodLock).set({ advisorLockDate: "2024-06-30" }).where(eq(periodLock.organizationId, a.id));
    await denied(() => rollback(req({ date: "2024-07-01" }), p(locked.id)), 422);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2023-01-01", endDate: "2023-12-31", isClosed: true });
    await mdenied("run_asset_depreciation", { assetId: locked.id, date: "2023-06-01" }, ma, 400); // service-date guard wins
    const old = await asset({ purchaseDate: "2022-01-01" }); await denied(() => post(req({ date: "2023-06-01" }), p(old.id)), 422);
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, old.id));
    // Corrupt money/root/history fail before writes; no unsafe Number repairs.
    const corrupt = await asset();
    await db.execute(sql`update fixed_asset set purchase_price=9007199254740992 where id=${corrupt.id}`);
    await denied(() => post(req(), p(corrupt.id)), 422); await mdenied("rollback_asset_depreciation", { assetId: corrupt.id }, ma, 422);
    await db.update(fixedAsset).set({ purchasePrice: 125003, netBookValue: 1 }).where(eq(fixedAsset.id, corrupt.id));
    await denied(() => post(req(), p(corrupt.id)), 422);
    await db.update(fixedAsset).set({ deletedAt: new Date() }).where(eq(fixedAsset.id, corrupt.id));
    // Concurrent single/batch requests produce at most one charge per asset/month.
    const raced = await asset({ purchaseDate: "2024-01-01" });
    const races = await Promise.all([post(req({ date: "2024-07-01" }), p(raced.id)), ma.call("run_assets_depreciation", { date: "2024-07-01", idempotencyKey: "batch-july" })]);
    await data(races[0]); assert.equal(races[1].isError, false, JSON.stringify(races[1]));
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, raced.id))).length, 1);
    const batchState = await snapshot(); assert.deepEqual((await data(await batch(req({ date: "2024-07-01", idempotencyKey: "batch-july" })))), races[1].body);
    assert.equal(await snapshot(), batchState);
    const undoRace = await Promise.all([rollback(req({ date: "2024-08-01" }), p(raced.id)), ma.call("rollback_asset_depreciation", { assetId: raced.id, date: "2024-08-01" })]);
    assert.deepEqual(await data(undoRace[0]), undoRace[1].body); assert.equal(undoRace[1].isError, false);
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, raced.id))).length, 0);
    // A legacy lifecycle writer holding a stale preflight snapshot cannot overwrite depreciation.
    const [fresh] = await db.select().from(fixedAsset).where(eq(fixedAsset.id, x.id));
    await data(await post(req({ date: "2024-08-01" }), p(x.id)));
    await assert.rejects(() => db.transaction(tx => lockAssetSnapshot(tx, ctx, fresh)), /Asset changed/);
    await denied(() => patch(req({ usefulLifeMonths: 2 }), p(x.id)), 409);
    // All operation writes, journals, totals and audit roll back on audit failure.
    await db.execute(sql.raw("create function dep_audit_fault() returns trigger language plpgsql as $$ begin if NEW.entity_type='fixed_asset' then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger dep_audit_fault before insert on audit_log for each row execute function dep_audit_fault()"));
    await denied(() => post(req({ date: "2024-09-01" }), p(x.id)), 500);
    await mdenied("run_asset_depreciation", { assetId: x.id, date: "2024-09-01" });
    await denied(() => rollback(req({ date: "2024-09-01" }), p(x.id)), 500);
    await mdenied("rollback_asset_depreciation", { assetId: x.id, date: "2024-09-01" });
    await denied(() => batch(req({ date: "2024-09-01" })), 500); await mdenied("run_assets_depreciation", { date: "2024-09-01" });
    await db.execute(sql.raw("drop trigger dep_audit_fault on audit_log; drop function dep_audit_fault()"));
    // Fail only the final batch audit, after every candidate was processed.
    await db.execute(sql.raw("create function dep_batch_fault() returns trigger language plpgsql as $$ begin if NEW.action='run_depreciation' then raise exception 'fixture final batch audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger dep_batch_fault before insert on audit_log for each row execute function dep_batch_fault()"));
    await denied(() => batch(req({ date: "2024-09-01" })), 500);
    await mdenied("run_assets_depreciation", { date: "2024-09-01" });
    await db.execute(sql.raw("drop trigger dep_batch_fault on audit_log; drop function dep_batch_fault()"));
    // Saved/output preflight after writes is still inside the transaction.
    await db.execute(sql.raw("create function dep_money_fault() returns trigger language plpgsql as $$ begin NEW.net_book_value=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger dep_money_fault before update on fixed_asset for each row execute function dep_money_fault()"));
    await denied(() => post(req({ date: "2024-09-01" }), p(x.id)), 422);
    await mdenied("rollback_asset_depreciation", { assetId: x.id, date: "2024-09-01" }, ma, 422);
    await db.execute(sql.raw("drop trigger dep_money_fault on fixed_asset; drop function dep_money_fault()"));
    // Foreign saved journal links and mismatched original amounts reject rollback.
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2024-08-01", status: "posted", description: "Foreign" }).returning();
    const [current] = await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, x.id)).orderBy(desc(depreciationEntry.date));
    await db.update(depreciationEntry).set({ journalEntryId: foreignJournal.id }).where(eq(depreciationEntry.id, current.id));
    await denied(() => rollback(req({ date: "2024-09-01" }), p(x.id)), 422); await mdenied("run_asset_depreciation", { assetId: x.id, date: "2024-09-01" }, ma, 422);
    await db.update(depreciationEntry).set({ journalEntryId: current.journalEntryId }).where(eq(depreciationEntry.id, current.id));
    await db.update(journalLine).set({ debitAmount: 1 }).where(eq(journalLine.journalEntryId, current.journalEntryId!));
    await denied(() => rollback(req({ date: "2024-09-01" }), p(x.id)), 422);
    await db.update(depreciationEntry).set({ unitsThisPeriod: -1 }).where(eq(depreciationEntry.id, current.id));
    await denied(() => post(req({ date: "2024-09-01" }), p(x.id)), 422);
    await db.update(depreciationEntry).set({ unitsThisPeriod: null }).where(eq(depreciationEntry.id, current.id));
    await db.update(fixedAsset).set({ inServiceDate: "2023-01-01" }).where(eq(fixedAsset.id, x.id));
    await mdenied("run_asset_depreciation", { assetId: x.id, date: "2024-09-01" }, ma, 422);
    console.log("Asset depreciation contracts verified: three pairs, exact ledger, organization/auth, timing, retry, locks, faults and concurrency");
  } finally { await ma.close(); await mb.close(); await ro.close(); await staff.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
