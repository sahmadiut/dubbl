import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, assetCategory, fixedAsset, chartAccount, depreciationEntry, assetRevaluation, cwipCost, journalEntry } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as categories, POST as createCategory } from "../../app/api/v1/asset-categories/route";
import { GET as category, PATCH as patchCategory, DELETE as removeCategory } from "../../app/api/v1/asset-categories/[id]/route";
import { GET as assets, POST as createAsset } from "../../app/api/v1/fixed-assets/route";
import { GET as asset, PATCH as patchAsset, DELETE as removeAsset } from "../../app/api/v1/fixed-assets/[id]/route";
import { registerAssetMasterTools } from "../../lib/mcp/tools/asset-master";
import { registerAllTools } from "../../lib/mcp/tools";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Asset master fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerAssetMasterTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  const names = ["list_asset_categories", "get_asset_category", "create_asset_category", "update_asset_category", "delete_asset_category",
    "list_fixed_assets", "get_fixed_asset", "create_fixed_asset", "update_fixed_asset", "delete_fixed_asset"];
  if (!full) assert.equal(tools.length, 10);
  for (const name of names) {
    const tool = tools.find(t => t.name === name); assert.ok(tool, name); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Asset A", slug: "asset-master-a" }, { name: "Asset B", slug: "asset-master-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "asset-owner@example.test" }, { email: "asset-viewer@example.test" }, { email: "asset-manager@example.test" }]).returning();
  const [role, readRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Asset manager", permissions: ["manage:assets"] }, { organizationId: a.id, name: "No permissions", permissions: [] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: readRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: role.id }]);
  const keys = { a: "dk_asset_master_a", b: "dk_asset_master_b", viewer: "dk_asset_master_viewer", manager: "dk_asset_master_manager", expired: "dk_asset_master_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_asset", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [own, foreign, inactive, deleted] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1500", name: "Own", type: "asset" as const }, { organizationId: b.id, code: "1500", name: "Foreign", type: "asset" as const },
    { organizationId: a.id, code: "1501", name: "Inactive", type: "asset" as const, isActive: false }, { organizationId: a.id, code: "1502", name: "Deleted", type: "asset" as const, deletedAt: new Date() },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", customRoleId: readRole.id, permissions: [] });
  const managed = await mcp({ ...ctx, userId: manager.id, role: "member", permissions: ["manage:assets"] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request("http://fixture.test/api/v1/assets" + query, { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["asset_category", "fixed_asset", "depreciation_entry", "asset_revaluation", "cwip_cost", "journal_entry", "journal_line", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, name);
    if (status) assert.equal(result.body.status, status); assert.deepEqual(await snapshot(), before);
  };
  const base = { name: "Legacy", assetNumber: "A1", purchaseDate: "2024-02-29", usefulLifeMonths: 60 };
  try {
    const c = (await data(await createCategory(req({ name: "Legacy", defaultResidualValue: 1250, defaultUsefulLifeMonths: 60, assetAccountId: own.id })), 201)).category;
    assert.equal(c.defaultResidualValueMinor, "1250"); assert.equal(c.organizationId, a.id);
    const cm = (await ma.call("create_asset_category", { name: "Exact", defaultResidualValueMinor: "9007199254740991" })).body.category;
    assert.equal(cm.defaultResidualValue, Number.MAX_SAFE_INTEGER);
    await data(await createCategory(req({ name: "Dual", defaultResidualValue: 29, defaultResidualValueMinor: "29" })), 201);
    assert.equal((await ma.call("update_asset_category", { categoryId: cm.id, name: "Retained" })).body.category.defaultResidualValueMinor, "9007199254740991");
    assert.equal((await data(await patchCategory(req({ defaultResidualValueMinor: "3000000000", defaultUsefulLifeMonths: null, isActive: false }), p(cm.id)))).category.defaultResidualValue, 3000000000);
    const e = (await data(await createAsset(req({ ...base, purchasePrice: 3000000000, categoryId: c.id })), 201)).asset;
    assert.equal(e.purchasePriceMinor, "3000000000"); assert.equal(e.residualValue, 1250); assert.equal(e.assetAccountId, own.id);
    const em = (await ma.call("create_fixed_asset", { name: "Exact", assetNumber: "A2", purchaseDate: "2024-02-29", purchasePriceMinor: "9007199254740991", categoryId: c.id, assetAccountId: null })).body.asset;
    assert.equal(em.purchasePrice, Number.MAX_SAFE_INTEGER); assert.equal(em.usefulLifeMonths, 60); assert.equal(em.residualValue, 1250); assert.equal(em.assetAccountId, null);
    await data(await createAsset(req({ ...base, purchasePrice: 29, purchasePriceMinor: "29", residualValueMinor: "0" })), 201);
    const zero = (await ma.call("create_fixed_asset", { ...base, purchasePriceMinor: "0", isCwip: true })).body.asset;
    assert.equal(zero.status, "in_progress"); assert.equal(zero.revaluedAmountMinor, null);
    assert.equal((await data(await patchAsset(req({ residualValueMinor: "29", categoryId: null }), p(e.id)))).asset.residualValue, 29);
    assert.equal((await ma.call("update_fixed_asset", { assetId: e.id, name: "Renamed" })).body.asset.residualValueMinor, "29");
    const orphan = (await ma.call("create_fixed_asset", { ...base, purchasePrice: 100 })).body.asset;
    await db.update(fixedAsset).set({ accumulatedDepreciation: 29, netBookValue: 71 }).where(eq(fixedAsset.id, orphan.id));
    await denied(() => patchAsset(req({ usefulLifeMonths: 12 }), p(orphan.id)), 409);
    const detail = (await data(await asset(req(), p(e.id)))).asset;
    assert.equal(detail.assetAccount.organizationId, a.id); assert.deepEqual(detail.cwipCosts, []);
    assert.equal((await ma.call("get_fixed_asset", { assetId: em.id })).body.asset.residualValueMinor, "1250");
    assert.equal((await data(await category(req(), p(c.id)))).category.assetAccount.id, own.id);
    assert.equal((await ma.call("get_asset_category", { categoryId: cm.id })).body.category.defaultResidualValue, 3000000000);
    assert.equal((await data(await categories(req({}, keys.a, "?isActive=false&limit=200")))).data[0].id, cm.id);
    assert.equal((await ma.call("list_asset_categories", { isActive: false })).body.categories[0].id, cm.id);
    assert.equal((await data(await assets(req({}, keys.a, "?status=in_progress")))).data[0].id, zero.id);
    assert.equal((await ma.call("list_fixed_assets", { categoryId: c.id })).body.total, 1);
    for (const money of ["01", "-1", "-0", "1e3", "9007199254740992", "9223372036854775808"]) {
      const status = money === "9007199254740992" ? 422 : 400;
      await denied(() => createCategory(req({ name: "Bad", defaultResidualValueMinor: money })), status);
      await mdenied("create_fixed_asset", { ...base, purchasePriceMinor: money });
    }
    for (const bad of [{ purchasePrice: 1, purchasePriceMinor: "2" }, { purchasePrice: 9007199254740992 }, { purchasePrice: 1.1 }, { purchasePrice: -1 },
      { purchasePrice: 10, residualValue: 11 }, { purchasePrice: 10, purchaseDate: "2024-02-30" }, { purchasePrice: 10, inServiceDate: "2024-01-01" },
      { purchasePrice: 10, depreciationMethod: "units_of_production", totalExpectedUnits: 0 }, { purchasePrice: 10, usefulLifeMonths: 2147483648 }, { purchasePrice: 10, currency: "USD" }]) {
      await denied(() => createAsset(req({ ...base, ...bad })), 400); await mdenied("create_fixed_asset", { ...base, ...bad });
    }
    for (const account of [foreign, inactive, deleted]) {
      await denied(() => createCategory(req({ name: "Bad", assetAccountId: account.id })), 404);
      await mdenied("update_fixed_asset", { assetId: em.id, assetAccountId: account.id }, ma, 404);
    }
    const foreignCategory = (await mb.call("create_asset_category", { name: "Foreign", defaultUsefulLifeMonths: 12 })).body.category;
    await denied(() => patchAsset(req({ categoryId: foreignCategory.id }), p(e.id)), 404);
    await mdenied("create_fixed_asset", { ...base, purchasePrice: 0, categoryId: foreignCategory.id }, ma, 404);
    for (const query of ["?limit=201", "?page=0", "?page=1.5", "?isActive=invalid"]) await denied(() => categories(req({}, keys.a, query)), 400);
    await denied(() => assets(req({}, keys.a, "?status=invalid")), 400);
    await denied(() => createAsset(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    const operations = [["get_asset_category", { categoryId: c.id }], ["update_asset_category", { categoryId: c.id, name: "Denied" }], ["delete_asset_category", { categoryId: c.id }],
      ["get_fixed_asset", { assetId: e.id }], ["update_fixed_asset", { assetId: e.id, name: "Denied" }], ["delete_fixed_asset", { assetId: e.id }]] as const;
    for (const [name, args] of operations) { await mdenied(name, args, mb, 404); await mdenied(name, args, ro, 403); }
    for (const [name, args] of [["list_asset_categories", {}], ["create_asset_category", { name: "Denied" }], ["list_fixed_assets", {}], ["create_fixed_asset", { ...base, purchasePrice: 0 }]] as const) await mdenied(name, args, ro, 403);
    for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.b ? 404 : key === keys.viewer ? 403 : 401;
      for (const fn of [() => category(req({}, key), p(c.id)), () => patchCategory(req({ name: "Denied" }, key), p(c.id)), () => removeCategory(req({}, key), p(c.id)),
        () => asset(req({}, key), p(e.id)), () => patchAsset(req({ name: "Denied" }, key), p(e.id)), () => removeAsset(req({}, key), p(e.id))]) await denied(fn, status);
    }
    for (const fn of [() => categories(req({}, keys.viewer)), () => createCategory(req({ name: "Denied" }, keys.viewer)), () => assets(req({}, keys.viewer)), () => createAsset(req({ ...base, purchasePrice: 0 }, keys.viewer))]) await denied(fn, 403);
    const mc = (await data(await createCategory(req({ name: "Managed" }, keys.manager)), 201)).category;
    const me = (await managed.call("create_fixed_asset", { ...base, purchasePrice: 0 })).body.asset;
    assert.equal((await managed.call("delete_asset_category", { categoryId: mc.id })).body.success, true);
    await data(await removeAsset(req({}, keys.manager), p(me.id)));
    await denied(() => asset(req(), p("invalid")), 400); await mdenied("get_asset_category", { categoryId: "invalid" });
    // Historical child aliases and journals never disclose foreign-organization data.
    const [journal] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1, date: "2024-03-01", description: "History", status: "posted" }).returning();
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2024-03-01", description: "Foreign", status: "posted" }).returning();
    const [dep] = await db.insert(depreciationEntry).values({ fixedAssetId: e.id, date: "2024-03-01", amount: 29, journalEntryId: journal.id }).returning();
    await db.insert(assetRevaluation).values({ fixedAssetId: e.id, date: "2024-03-01", previousCarryingAmount: 100, revaluedAmount: 71, changeAmount: -29, surplusAmount: -29, impairmentAmount: 0 });
    await db.insert(cwipCost).values({ fixedAssetId: zero.id, date: "2024-03-01", amount: 29 });
    assert.equal((await ma.call("get_fixed_asset", { assetId: e.id })).body.asset.revaluations[0].changeAmountMinor, "-29");
    assert.equal((await data(await asset(req(), p(e.id)))).asset.depreciationEntries[0].amountMinor, "29");
    assert.equal((await data(await asset(req(), p(zero.id)))).asset.cwipCosts[0].amountMinor, "29");
    await denied(() => patchAsset(req({ usefulLifeMonths: 24 }), p(e.id)), 409);
    await mdenied("update_fixed_asset", { assetId: zero.id, isCwip: false }, ma, 409);
    await mdenied("update_fixed_asset", { assetId: e.id, residualValueMinor: "3000000001" }, ma, 400);
    await data(await patchAsset(req({ name: "History retained" }), p(e.id)));
    await db.update(depreciationEntry).set({ journalEntryId: foreignJournal.id }).where(eq(depreciationEntry.id, dep.id));
    await denied(() => asset(req(), p(e.id)), 422); await mdenied("get_fixed_asset", { assetId: e.id }, ma, 422);
    await db.update(depreciationEntry).set({ journalEntryId: journal.id }).where(eq(depreciationEntry.id, dep.id));
    await db.update(fixedAsset).set({ categoryId: foreignCategory.id }).where(eq(fixedAsset.id, e.id));
    await denied(() => asset(req(), p(e.id)), 422);
    await mdenied("update_fixed_asset", { assetId: e.id, name: "Mask category" }, ma, 422);
    await db.update(fixedAsset).set({ categoryId: c.id, assetAccountId: foreign.id }).where(eq(fixedAsset.id, e.id));
    await mdenied("get_fixed_asset", { assetId: e.id }, ma, 422);
    await db.update(fixedAsset).set({ assetAccountId: own.id }).where(eq(fixedAsset.id, e.id));
    // Unsafe history fails before an unrelated mutation, including deletion.
    await db.execute(sql`update fixed_asset set purchase_price=9007199254740992 where id=${em.id}`);
    await denied(() => assets(req()), 422); await mdenied("update_fixed_asset", { assetId: em.id, name: "Mask" }, ma, 422); await denied(() => removeAsset(req(), p(em.id)), 422);
    await db.update(fixedAsset).set({ purchasePrice: Number.MAX_SAFE_INTEGER }).where(eq(fixedAsset.id, em.id));
    await db.execute(sql`update asset_category set default_residual_value=9007199254740992 where id=${cm.id}`);
    await denied(() => patchCategory(req({ name: "Mask" }), p(cm.id)), 422); await mdenied("list_asset_categories", {}, ma, 422);
    await db.update(assetCategory).set({ defaultResidualValue: 3000000000 }).where(eq(assetCategory.id, cm.id));
    await db.update(assetCategory).set({ defaultDepreciationRateBp: 100001 }).where(eq(assetCategory.id, cm.id));
    await denied(() => patchCategory(req({ name: "Mask rate" }), p(cm.id)), 422);
    await db.update(assetCategory).set({ defaultDepreciationRateBp: null }).where(eq(assetCategory.id, cm.id));
    await db.update(fixedAsset).set({ usefulLifeMonths: 0 }).where(eq(fixedAsset.id, em.id));
    await mdenied("update_fixed_asset", { assetId: em.id, name: "Mask life" }, ma, 422);
    await db.update(fixedAsset).set({ usefulLifeMonths: 60 }).where(eq(fixedAsset.id, em.id));
    // Fault injection proves all six master writes roll back when audit fails.
    await db.execute(sql.raw("create function asset_audit_fault() returns trigger language plpgsql as $$ begin if NEW.entity_type in ('fixed_asset','asset_category') then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger asset_audit_fault before insert on audit_log for each row execute function asset_audit_fault()"));
    for (const fn of [() => createCategory(req({ name: "Rollback" })), () => patchCategory(req({ name: "Rollback" }), p(c.id)), () => removeCategory(req(), p(c.id)),
      () => createAsset(req({ ...base, purchasePrice: 0 })), () => patchAsset(req({ name: "Rollback" }), p(e.id)), () => removeAsset(req(), p(e.id))]) await denied(fn, 500);
    for (const [name, args] of [["create_asset_category", { name: "Rollback" }], ["update_asset_category", { categoryId: c.id, name: "Rollback" }], ["delete_asset_category", { categoryId: c.id }],
      ["create_fixed_asset", { ...base, purchasePrice: 0 }], ["update_fixed_asset", { assetId: e.id, name: "Rollback" }], ["delete_fixed_asset", { assetId: e.id }]] as const) await mdenied(name, args);
    await db.execute(sql.raw("drop trigger asset_audit_fault on audit_log; drop function asset_audit_fault()"));
    // A post-insert ORM/DTO failure must also roll back the insert and audit.
    await db.execute(sql.raw("create function asset_money_fault() returns trigger language plpgsql as $$ begin NEW.net_book_value=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger asset_money_fault before insert on fixed_asset for each row execute function asset_money_fault()"));
    await denied(() => createAsset(req({ ...base, purchasePrice: 0 })), 422); await mdenied("create_fixed_asset", { ...base, purchasePrice: 0 }, ma, 422);
    await db.execute(sql.raw("drop trigger asset_money_fault on fixed_asset; drop function asset_money_fault()"));
    await data(await removeCategory(req(), p(c.id)));
    assert.equal((await ma.call("get_fixed_asset", { assetId: e.id })).body.asset.category.id, c.id);
    await mdenied("create_fixed_asset", { ...base, purchasePrice: 0, categoryId: c.id }, ma, 404);
    const race = await Promise.all([removeAsset(req(), p(e.id)), ma.call("delete_fixed_asset", { assetId: e.id })]);
    assert.equal(Number(race[0].status === 200) + Number(!race[1].isError), 1);
    assert.equal((await db.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, e.id))).length, 1);
    assert.equal((await db.select().from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, e.id))).length, 1);
    await mdenied("get_fixed_asset", { assetId: e.id }, ma, 404);
    assert.equal((await ma.call("delete_fixed_asset", { assetId: em.id })).body.success, true);
    await data(await removeCategory(req(), p(cm.id)));
    console.log("Asset master contracts verified: ten pairs, aliases/defaults, scope/auth, history, rollback and concurrency");
  } finally { await ma.close(); await mb.close(); await ro.close(); await managed.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
