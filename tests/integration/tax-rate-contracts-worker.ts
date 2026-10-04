import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, taxRate, taxComponent, taxJurisdiction } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/tax-rates/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/tax-rates/[id]/route";
import { GET as profiles, POST as seed } from "../../app/api/v1/tax-profiles/route";
import { GET as lookup, POST as save, DELETE as drop } from "../../app/api/v1/tax-lookup/route";
import { registerTaxRateTools } from "../../lib/mcp/tools/tax-rates";
import { registerTaxProfileTools } from "../../lib/mcp/tools/tax-profiles";
import { registerTaxLookupTools } from "../../lib/mcp/tools/tax-lookup";
import { createTaxRate, updateTaxRate, deleteTaxRate } from "../../lib/api/tax-rates";
import { seedTaxProfile } from "../../lib/api/tax-profile-contracts";
import { saveTaxJurisdiction, deleteTaxJurisdiction } from "../../lib/tax/lookup";
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Tax fixture", version: "1" });
  registerTaxRateTools(server, ctx); registerTaxProfileTools(server, ctx); registerTaxLookupTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 11);
  for (const tool of tools.filter(t => t.name !== "report_1099")) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, tool.name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b, lazy] = await db.insert(organization).values([
    { name: "Tax A", slug: "tax-a", countryCode: "GB", taxRegime: "vat" },
    { name: "Tax B", slug: "tax-b", countryCode: "AU", taxRegime: "gst" },
    { name: "Lazy", slug: "tax-lazy", countryCode: "GB", taxRegime: "vat" },
  ]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "tax-owner@example.test" }, { email: "tax-view@example.test" }, { email: "tax-manage@example.test" }]).returning();
  const roles = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Tax", permissions: ["manage:tax-rates"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: lazy.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: roles[0].id }, { organizationId: a.id, userId: manager.id, customRoleId: roles[1].id }]);
  const keys = { a: "dk_tax_a", b: "dk_tax_b", lazy: "dk_tax_lazy", viewer: "dk_tax_view", manager: "dk_tax_manage", expired: "dk_tax_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : label === "lazy" ? lazy.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_tax", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" }, ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/tax-rates${query}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["tax_rate", "tax_component", "tax_jurisdiction", "audit_log"].map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  const [gl, foreign, inactive, deleted] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "2200", name: "Own", type: "liability" }, { organizationId: b.id, code: "2200", name: "Foreign", type: "liability" },
    { organizationId: a.id, code: "2201", name: "Inactive", type: "liability", isActive: false }, { organizationId: a.id, code: "2202", name: "Deleted", type: "liability", deletedAt: new Date() },
  ]).returning();
  const rate = (extra = {}) => ({ name: "Compound", rate: 1350, recoverablePercent: 5000, components: [{ name: "Part", rate: 500, accountId: gl.id }], ...extra });
  try {
    const own = (await data(await create(req(rate())), 201)).taxRate;
    for (const key of [keys.expired, "dk_invalid"])
      for (const route of [list, profiles, lookup]) await denied(() => route(req({}, key)), 401);
    assert.equal(own.organizationId, a.id); assert.equal(own.rate, 1350);
    const detail = (await data(await get(req(), params(own.id)))).taxRate; assert.equal(detail.components[0].rate, 500);
    assert.deepEqual((await ma.call("get_tax_rate", { taxRateId: own.id })).body.taxRate, detail);
    assert.equal((await ma.call("list_tax_rates")).body.taxRates[0].rate, 1350);
    assert.equal((await data(await list(req({}, keys.viewer)))).taxRates.length, 1);
    for (const key of [keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.viewer ? 403 : 401;
      await denied(() => create(req(rate(), key)), status); await denied(() => update(req({ name: "Bad" }, key), params(own.id)), status);
      await denied(() => remove(req({}, key), params(own.id)), status); await denied(() => seed(req({ country: "GB" }, key)), status);
      await denied(() => save(req({ country: "US", combinedRate: 1000 }, key)), status); await denied(() => drop(req({}, key, `?id=${own.id}`)), status);
    }
    for (const route of [get, update, remove]) await denied(() => route(req({}, keys.b), params(own.id)), 404);
    await denied(() => get(req(), params("bad")), 400);
    for (const accountId of [foreign.id, inactive.id, deleted.id]) {
      await denied(() => create(req(rate({ components: [{ name: "Part", rate: 500, accountId }] }))), 404);
      await denied(() => update(req({ components: [{ name: "Part", rate: 500, accountId }] }), params(own.id)), 404);
    }
    for (const extra of [{ rate: 2147483648 }, { rate: "1000" }, { rate: 1.25 }, { recoverablePercent: 10001 }, { rateMinor: "1000" }, { rateExact: "0.1" }, { unknown: true }, { components: [{ name: "Part", rate: -1 }] }])
      await denied(() => create(req(rate(extra))), 400);
    const malformed = () => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    for (const route of [create, seed, save]) await denied(() => route(malformed()), 400);
    await denied(() => update(malformed(), params(own.id)), 400);
    for (const [name, args] of [["create_tax_rate", rate()], ["update_tax_rate", { taxRateId: own.id, name: "Bad" }], ["delete_tax_rate", { taxRateId: own.id }], ["apply_tax_profile", { country: "GB" }], ["save_tax_jurisdiction", { country: "US", combinedRate: 1000 }], ["delete_tax_jurisdiction", { jurisdictionId: own.id }]] as const) {
      await mdenied(name, args, ro); await mdenied(name, { ...args, unknown: true });
    }
    for (const name of ["get_tax_rate", "update_tax_rate", "delete_tax_rate"]) await mdenied(name, { taxRateId: own.id }, mb);
    for (const v of ["1000", 2147483648, -1]) await mdenied("create_tax_rate", rate({ rate: v }));
    const max = await ma.call("create_tax_rate", rate({ name: "Max", rate: 2147483647, components: [] })); assert.equal(max.isError, false); assert.equal(max.body.taxRate.rate, 2147483647);
    const patched = await data(await update(req({ name: "Renamed" }), params(own.id))); assert.equal(patched.taxRate.rate, 1350); assert.equal(patched.taxRate.recoverablePercent, 5000);
    assert.equal((await data(await get(req(), params(own.id)))).taxRate.components.length, 1);
    const component = (await db.select().from(taxComponent).where(eq(taxComponent.taxRateId, own.id)))[0];
    await db.update(taxComponent).set({ rate: -1 }).where(eq(taxComponent.id, component.id));
    await denied(() => get(req(), params(own.id)), 422); await mdenied("list_tax_rates", {});
    await db.update(taxComponent).set({ rate: 500 }).where(eq(taxComponent.id, component.id));
    assert.equal((await ma.call("update_tax_rate", { taxRateId: own.id, components: [] })).isError, false);
    assert.equal((await data(await get(req(), params(own.id)))).taxRate.components.length, 0);
    const defaults = await Promise.all([create(req(rate({ name: "Default1", isDefault: true }))), create(req(rate({ name: "Default2", isDefault: true })))]);
    await Promise.all(defaults.map(r => data(r, 201)));
    assert.equal((await db.select().from(taxRate).where(and(eq(taxRate.organizationId, a.id), eq(taxRate.isDefault, true), isNull(taxRate.deletedAt)))).length, 1);
    const beforeDefault = (await db.select().from(taxRate).where(and(eq(taxRate.organizationId, a.id), eq(taxRate.isDefault, true))))[0].id;
    const pr = await Promise.all([seed(req({ country: "gb" })), seed(req({ country: "GB" }))]);
    const seeded = await Promise.all(pr.map(r => data(r, 201))); assert.deepEqual(seeded.map(r => r.created.length).sort(), [0, 6]);
    assert.equal((await db.select().from(taxRate).where(and(eq(taxRate.organizationId, a.id), eq(taxRate.isDefault, true))))[0].id, beforeDefault);
    assert.equal((await ma.call("apply_tax_profile", { country: "GB" })).body.created.length, 0);
    const catalogue = await data(await profiles(req())); assert.equal(catalogue.recommendedCountry, "GB"); assert.deepEqual((await ma.call("list_tax_profiles")).body, catalogue);
    assert.equal((await data(await profiles(req({}, keys.a, "?country=gb")))).profile.country, "GB");
    assert.equal((await ma.call("list_tax_profiles", { country: "gb" })).body.profile.country, "GB");
    await denied(() => profiles(req({}, keys.a, "?country=ZZ")), 404); await denied(() => seed(req({ country: "ZZ" })), 400); await denied(() => seed(req({ country: " GB" })), 400);
    assert.equal((await mb.call("list_tax_profiles")).body.recommendedCountry, "AU");
    assert.equal((await data(await list(req({}, keys.lazy)))).taxRates.length, 6);
    const lazyDefaults = await db.select().from(taxRate).where(and(eq(taxRate.organizationId, lazy.id), eq(taxRate.isDefault, true))); assert.equal(lazyDefaults.length, 1);
    const jurisdiction = { country: "US", combinedRate: 825, stateRate: 600, countyRate: 125, cityRate: 100 };
    const jr = await Promise.all([save(req(jurisdiction)), save(req(jurisdiction))]); const saved = await Promise.all(jr.map(r => data(r, 201))); assert.equal(saved[0].jurisdiction.id, saved[1].jurisdiction.id);
    assert.equal((await db.select().from(taxJurisdiction).where(eq(taxJurisdiction.organizationId, a.id))).length, 1);
    assert.deepEqual((await ma.call("lookup_tax_rate", { country: "US" })).body, await data(await lookup(req({}, keys.a, "?country=US"))));
    await db.update(taxJurisdiction).set({ specialRate: -1 }).where(eq(taxJurisdiction.id, saved[0].jurisdiction.id));
    await denied(() => lookup(req({}, keys.a, "?country=US")), 422); await mdenied("lookup_tax_rate", { country: "US" });
    await db.update(taxJurisdiction).set({ specialRate: 0 }).where(eq(taxJurisdiction.id, saved[0].jurisdiction.id));
    assert.equal((await data(await lookup(req({}, keys.b, "?country=US")))).found, false);
    assert.equal((await mb.call("lookup_tax_rate", { country: "US" })).body.found, false);
    await denied(() => drop(req({}, keys.b, `?id=${saved[0].jurisdiction.id}`)), 404);
    await mdenied("delete_tax_jurisdiction", { jurisdictionId: saved[0].jurisdiction.id }, mb);
    for (const extra of [{ combinedRate: 2147483648 }, { specialRate: -1 }, { amountMinor: "1000" }]) await denied(() => save(req({ ...jurisdiction, ...extra })), 400);
    await denied(() => lookup(req()), 400);
    const updated = await ma.call("save_tax_jurisdiction", { country: "US", combinedRate: 1000 }); assert.equal(updated.body.jurisdiction.id, saved[0].jurisdiction.id); assert.equal(updated.body.jurisdiction.stateRate, 0);
    const scoped = await ma.call("save_tax_jurisdiction", { ...jurisdiction, state: "CA", postalCode: "90210" }); assert.equal(scoped.isError, false);
    assert.equal((await ma.call("lookup_tax_rate", { country: "US", state: "CA", postalCode: "90210" })).body.rate.combinedRate, 825);
    assert.equal((await ma.call("delete_tax_jurisdiction", { jurisdictionId: scoped.body.jurisdiction.id })).isError, false);
    await data(await drop(req({}, keys.a, `?id=${saved[0].jurisdiction.id}`)));
    // Custom manage:tax-rates permission grants rate and jurisdiction writes.
    await data(await create(req(rate({ name: "Manager" }), keys.manager)), 201);
    await data(await remove(req(), params(max.body.taxRate.id))); await denied(() => get(req(), params(max.body.taxRate.id)), 404);
    await db.update(taxRate).set({ rate: -1 }).where(eq(taxRate.id, own.id));
    await denied(() => get(req(), params(own.id)), 422); await mdenied("get_tax_rate", { taxRateId: own.id });
    await denied(() => update(req({ name: "Invalid retained rate" }), params(own.id)), 422);
    await db.update(taxRate).set({ rate: 1350 }).where(eq(taxRate.id, own.id));
    const auditTarget = (await saveTaxJurisdiction(ctx, jurisdiction)).id;
    // Audit failure rolls back default changes, components, seeding and cache writes.
    await db.execute(sql`create function fail_tax_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure'; end $$`);
    await db.execute(sql`create trigger fail_tax_audit before insert on audit_log for each row execute function fail_tax_audit()`);
    for (const fn of [() => createTaxRate(ctx, rate({ name: "Rollback", isDefault: true })),
      () => updateTaxRate(ctx, own.id, { rate: 1000, components: [{ name: "Rollback", rate: 1000, accountId: gl.id }], isDefault: true }),
      () => deleteTaxRate(ctx, own.id), () => seedTaxProfile(ctx, { country: "IE" }),
      () => saveTaxJurisdiction(ctx, jurisdiction), () => deleteTaxJurisdiction(ctx, auditTarget)]) {
      const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_tax_audit on audit_log`); await db.execute(sql`drop function fail_tax_audit()`);
    assert.equal((await db.select().from(taxComponent).where(eq(taxComponent.taxRateId, own.id))).length, 0);
    console.log("REST and MCP tax contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
