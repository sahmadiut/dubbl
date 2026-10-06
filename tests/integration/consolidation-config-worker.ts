import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, consolidationGroup, consolidationGroupMember,
  consolidationRate, consolidationEliminationRule, consolidationEliminationEntry } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/consolidation/groups/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/consolidation/groups/[id]/route";
import { GET as members, POST as add, DELETE as unlink } from "../../app/api/v1/consolidation/groups/[id]/members/route";
import { GET as rules, POST as rule } from "../../app/api/v1/consolidation/groups/[id]/rules/route";
import { DELETE as unrule } from "../../app/api/v1/consolidation/groups/[id]/rules/[ruleId]/route";
import { registerAllTools } from "../../lib/mcp/tools";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Consolidation fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["list_consolidation_groups", "get_consolidation_group", "create_consolidation_group", "update_consolidation_group", "delete_consolidation_group",
    "list_consolidation_members", "add_consolidation_member", "remove_consolidation_member", "list_consolidation_elimination_rules", "create_consolidation_elimination_rule", "delete_consolidation_elimination_rule"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const f of Object.values(tool.inputSchema.properties ?? {})) assert.ok((f as { description?: string }).description, `${name}: missing description`);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b, c, d] = await db.insert(organization).values([
    { name: "Parent", slug: "con-parent", billApprovalThreshold: 123, mileageRate: 456, peppolId: "private" },
    { name: "Child", slug: "con-child", defaultCurrency: "JPY", billApprovalThreshold: 789 },
    { name: "Outsider", slug: "con-outside" }, { name: "Other child", slug: "con-other" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "con-owner@example.test" }, { email: "con-viewer@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: d.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }]);
  const keys = { a: "dk_con_a", b: "dk_con_b", viewer: "dk_con_viewer", expired: "dk_con_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_con", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await connect({ ...ctx, role: "member", permissions: ["manage:reports"] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/consolidation", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string, ruleId?: string) => ({ params: Promise.resolve({ id, ruleId: ruleId ?? "" }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const r = await db.execute(sql.raw("select jsonb_build_object('groups',(select jsonb_agg(to_jsonb(t) order by id) from consolidation_group t),'members',(select jsonb_agg(to_jsonb(t) order by id) from consolidation_group_member t),'rules',(select jsonb_agg(to_jsonb(t) order by id) from consolidation_elimination_rule t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown> = {}, client = ma, status?: number) {
    const before = await snapshot(), r = await client.call(name, args); assert.equal(r.isError, true, JSON.stringify(r));
    if (status) assert.equal(r.body.status, status, `${name}: ${JSON.stringify(r)}`); assert.equal(await snapshot(), before);
  }
  try {
    const g = (await data(await create(req({ name: "Legacy" })), 201)).group;
    assert.equal(g.presentationCurrency, "USD"); assert.equal(g.parentOrgId, a.id);
    const h = (await managed.call("create_consolidation_group", { name: "Exact configuration", presentationCurrency: "kwd" })).body.group;
    assert.equal(h.presentationCurrency, "KWD");
    const foreign = (await mb.call("create_consolidation_group", { name: "Foreign" })).body.group;
    const link = (await data(await add(req({ orgId: b.id }), p(g.id)), 201)).member;
    assert.equal(link.functionalCurrency, null);
    const detail = (await data(await get(req(), p(g.id)))).group;
    assert.deepEqual(Object.keys(detail.members[0].organization).sort(), ["defaultCurrency", "id", "name", "slug"]);
    assert.equal(detail.members[0].organization.defaultCurrency, "JPY");
    assert.deepEqual(detail, (await ma.call("get_consolidation_group", { groupId: g.id })).body.group);
    assert.deepEqual((await data(await members(req(), p(g.id)))), (await ma.call("list_consolidation_members", { groupId: g.id })).body);
    const listed = await data(await list(req())); const mlisted = (await ma.call("list_consolidation_groups")).body.groups;
    assert.equal(listed.groups.length, 2); assert.equal(mlisted.find((v: { id: string }) => v.id === g.id).memberCount, 1);
    assert.equal(mlisted.find((v: { id: string }) => v.id === g.id).members[0].functionalCurrency, "JPY");
    await data(await update(req({ name: "Renamed", presentationCurrency: "IRR" }), p(h.id)));
    const hu = await ma.call("update_consolidation_group", { groupId: h.id, name: "Again" }); assert.equal(hu.isError, false); assert.equal(hu.body.group.presentationCurrency, "IRR");
    const ruleInput = { name: "AR/AP", kind: "ar_ap", debitAccountMatch: "1200", creditAccountMatch: "2100" };
    const r = (await data(await rule(req(ruleInput), p(g.id)), 201)).rule;
    const r2 = (await ma.call("create_consolidation_elimination_rule", { groupId: g.id, ...ruleInput, kind: "custom" })).body.rule;
    assert.deepEqual(await data(await rules(req(), p(g.id))), (await ma.call("list_consolidation_elimination_rules", { groupId: g.id })).body);
    await data(await unrule(req(), p(g.id, r2.id))); await mdenied("delete_consolidation_elimination_rule", { groupId: g.id, ruleId: r2.id }, ma, 404);
    const hr = (await ma.call("create_consolidation_elimination_rule", { groupId: h.id, ...ruleInput })).body.rule;
    await denied(() => unrule(req(), p(g.id, hr.id)), 404); await mdenied("delete_consolidation_elimination_rule", { groupId: g.id, ruleId: hr.id }, ma, 404);
    await ma.call("add_consolidation_member", { groupId: h.id, orgId: d.id, functionalCurrency: "usd", label: "Alias" });
    assert.equal((await ma.call("list_consolidation_members", { groupId: h.id })).body.members[0].functionalCurrency, "USD");
    const writes = [
      [() => create(req({ name: "Rollback" })), "create_consolidation_group", { name: "Rollback" }],
      [() => update(req({ name: "Rollback" }), p(g.id)), "update_consolidation_group", { groupId: g.id, name: "Rollback" }],
      [() => remove(req(), p(g.id)), "delete_consolidation_group", { groupId: g.id }],
      [() => add(req({ orgId: d.id }), p(g.id)), "add_consolidation_member", { groupId: g.id, orgId: d.id }],
      [() => unlink(req({ orgId: b.id }), p(g.id)), "remove_consolidation_member", { groupId: g.id, orgId: b.id }],
      [() => rule(req(ruleInput), p(g.id)), "create_consolidation_elimination_rule", { groupId: g.id, ...ruleInput }],
      [() => unrule(req(), p(g.id, r.id)), "delete_consolidation_elimination_rule", { groupId: g.id, ruleId: r.id }],
    ] as const;
    // Auth/custom-role failures are checked on every config mutation.
    const viewerReq = (body: unknown = {}) => req(body, keys.viewer);
    for (const [fn, name, args] of [
      [() => create(viewerReq({ name: "No" })), "create_consolidation_group", { name: "No" }],
      [() => update(viewerReq({ name: "No" }), p(g.id)), "update_consolidation_group", { groupId: g.id, name: "No" }],
      [() => remove(viewerReq(), p(g.id)), "delete_consolidation_group", { groupId: g.id }],
      [() => add(viewerReq({ orgId: d.id }), p(g.id)), "add_consolidation_member", { groupId: g.id, orgId: d.id }],
      [() => unlink(viewerReq({ orgId: b.id }), p(g.id)), "remove_consolidation_member", { groupId: g.id, orgId: b.id }],
      [() => rule(viewerReq(ruleInput), p(g.id)), "create_consolidation_elimination_rule", { groupId: g.id, ...ruleInput }],
      [() => unrule(viewerReq(), p(g.id, r.id)), "delete_consolidation_elimination_rule", { groupId: g.id, ruleId: r.id }],
    ] as const) { await denied(fn, 403); await mdenied(name, args, ro, 403); }
    for (const key of [keys.expired, "dk_bad"]) await denied(() => list(req({}, key)), 401);
    for (const [fn, name, args] of [
      [() => get(req({}, keys.b), p(g.id)), "get_consolidation_group", { groupId: g.id }],
      [() => update(req({ name: "No" }, keys.b), p(g.id)), "update_consolidation_group", { groupId: g.id, name: "No" }],
      [() => remove(req({}, keys.b), p(g.id)), "delete_consolidation_group", { groupId: g.id }],
      [() => members(req({}, keys.b), p(g.id)), "list_consolidation_members", { groupId: g.id }],
      [() => add(req({ orgId: b.id }, keys.b), p(g.id)), "add_consolidation_member", { groupId: g.id, orgId: b.id }],
      [() => unlink(req({ orgId: b.id }, keys.b), p(g.id)), "remove_consolidation_member", { groupId: g.id, orgId: b.id }],
      [() => rules(req({}, keys.b), p(g.id)), "list_consolidation_elimination_rules", { groupId: g.id }],
      [() => rule(req(ruleInput, keys.b), p(g.id)), "create_consolidation_elimination_rule", { groupId: g.id, ...ruleInput }],
      [() => unrule(req({}, keys.b), p(g.id, r.id)), "delete_consolidation_elimination_rule", { groupId: g.id, ruleId: r.id }],
    ] as const) { await denied(fn, 404); await mdenied(name, args, mb, 404); }
    await denied(() => add(req({ orgId: c.id }), p(g.id)), 403); await mdenied("add_consolidation_member", { groupId: g.id, orgId: c.id }, ma, 403);
    await denied(() => add(req({ orgId: b.id }), p(g.id)), 409); await mdenied("add_consolidation_member", { groupId: g.id, orgId: b.id }, ma, 409);
    for (const bad of [{ name: "" }, { name: " " }, { presentationCurrency: "XYZ" }, { presentationCurrency: 1 }, { totalAmountMinor: "1" }, { unknown: true }]) {
      await denied(() => create(req({ name: "No", ...bad })), 400); await mdenied("create_consolidation_group", { name: "No", ...bad });
      await denied(() => update(req(bad), p(g.id)), 400); await mdenied("update_consolidation_group", { groupId: g.id, ...bad });
    }
    await denied(() => update(req({}), p(g.id)), 400); await mdenied("update_consolidation_group", { groupId: g.id });
    for (const bad of [{ orgId: "bad" }, { functionalCurrency: "XYZ" }, { label: 1 }, { unknown: true }]) {
      await denied(() => add(req({ orgId: d.id, ...bad }), p(g.id)), 400); await mdenied("add_consolidation_member", { groupId: g.id, orgId: d.id, ...bad });
    }
    for (const bad of [{ name: "" }, { kind: "bad" }, { debitAccountMatch: 123 }, { amountMinor: "1" }]) {
      await denied(() => rule(req({ ...ruleInput, ...bad }), p(g.id)), 400); await mdenied("create_consolidation_elimination_rule", { groupId: g.id, ...ruleInput, ...bad });
    }
    await denied(() => get(req(), p("bad")), 400);
    await denied(() => create(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    // Unsafe organization money is never projected through these cross-organization configuration reads.
    await db.execute(sql.raw(`update organization set bill_approval_threshold=9007199254740992 where id='${b.id}'`));
    assert.equal((await data(await get(req(), p(g.id)))).group.members[0].organization.id, b.id);
    // Saved rates or elimination entries freeze presentation units.
    await db.insert(consolidationRate).values({ groupId: g.id, currencyCode: "JPY", rateType: "closing", rate: 1000000, periodEndDate: "2024-01-31" });
    await denied(() => update(req({ presentationCurrency: "KWD" }), p(g.id)), 409); await mdenied("update_consolidation_group", { groupId: g.id, presentationCurrency: "KWD" }, ma, 409);
    await db.delete(consolidationRate).where(eq(consolidationRate.groupId, g.id));
    await db.insert(consolidationEliminationEntry).values({ groupId: g.id, ruleId: r.id, periodEndDate: "2024-01-31", currencyCode: "USD", amount: 1250 });
    await denied(() => update(req({ presentationCurrency: "KWD" }), p(g.id)), 409);
    await db.update(consolidationGroup).set({ presentationCurrency: "XYZ" }).where(eq(consolidationGroup.id, g.id));
    await denied(() => get(req(), p(g.id)), 422); await mdenied("get_consolidation_group", { groupId: g.id }, ma, 422);
    await denied(() => update(req({ name: "No" }), p(g.id)), 422);
    await mdenied("update_consolidation_group", { groupId: g.id, name: "No" }, ma, 422);
    await db.update(consolidationGroup).set({ presentationCurrency: "USD" }).where(eq(consolidationGroup.id, g.id));
    await db.update(consolidationGroupMember).set({ functionalCurrency: "XYZ" }).where(eq(consolidationGroupMember.id, link.id));
    await denied(() => get(req(), p(g.id)), 422); await mdenied("list_consolidation_members", { groupId: g.id }, ma, 422);
    await db.update(consolidationGroupMember).set({ functionalCurrency: null }).where(eq(consolidationGroupMember.id, link.id));
    await db.update(consolidationEliminationRule).set({ name: "" }).where(eq(consolidationEliminationRule.id, r.id));
    await denied(() => rules(req(), p(g.id)), 422); await mdenied("list_consolidation_elimination_rules", { groupId: g.id }, ma, 422);
    await denied(() => unrule(req(), p(g.id, r.id)), 422); await mdenied("delete_consolidation_elimination_rule", { groupId: g.id, ruleId: r.id }, ma, 422);
    await db.update(consolidationEliminationRule).set({ name: "AR/AP" }).where(eq(consolidationEliminationRule.id, r.id));
    await db.insert(consolidationGroupMember).values({ groupId: g.id, orgId: b.id });
    await denied(() => get(req(), p(g.id)), 422); await mdenied("get_consolidation_group", { groupId: g.id }, ma, 422);
    await db.delete(consolidationGroupMember).where(and(eq(consolidationGroupMember.groupId, g.id), eq(consolidationGroupMember.orgId, b.id), sql`${consolidationGroupMember.id} <> ${link.id}`));
    // Revoked/deleted child organizations are inaccessible; unlink remains available to parent manager.
    await db.delete(member).where(and(eq(member.organizationId, b.id), eq(member.userId, owner.id)));
    await denied(() => get(req(), p(g.id)), 403); await mdenied("list_consolidation_groups", {}, ma, 403);
    await data(await unlink(req({ orgId: b.id }), p(g.id)));
    await db.insert(member).values({ organizationId: b.id, userId: owner.id, role: "owner" });
    await data(await add(req({ orgId: b.id }), p(g.id)), 201);
    await db.update(organization).set({ deletedAt: new Date() }).where(eq(organization.id, b.id));
    await denied(() => get(req(), p(g.id)), 403); await mdenied("add_consolidation_member", { groupId: h.id, orgId: b.id }, ma, 403);
    await db.update(organization).set({ deletedAt: null }).where(eq(organization.id, b.id));
    // Audit fault injection proves rollback for each writer on both transports.
    await db.execute(sql.raw("create function con_audit_fault() returns trigger language plpgsql as $$ begin raise exception 'fixture audit fault'; end $$"));
    await db.execute(sql.raw("create trigger con_audit_fault before insert on audit_log for each row execute function con_audit_fault()"));
    for (const [fn, name, args] of writes) { await denied(fn, 500); await mdenied(name, args); }
    await db.execute(sql.raw("drop trigger con_audit_fault on audit_log; drop function con_audit_fault()"));
    await db.execute(sql.raw("create function con_output_fault() returns trigger language plpgsql as $$ begin NEW.presentation_currency='XYZ'; return NEW; end $$"));
    await db.execute(sql.raw("create trigger con_output_fault before insert or update on consolidation_group for each row execute function con_output_fault()"));
    for (const [fn, name, args] of writes.slice(0, 3)) { await denied(fn, 422); await mdenied(name, args, ma, 422); }
    await db.execute(sql.raw("drop trigger con_output_fault on consolidation_group; drop function con_output_fault()"));
    await db.execute(sql.raw("create function con_member_fault() returns trigger language plpgsql as $$ begin NEW.functional_currency='XYZ'; return NEW; end $$"));
    await db.execute(sql.raw("create trigger con_member_fault before insert on consolidation_group_member for each row execute function con_member_fault()"));
    await denied(() => add(req({ orgId: d.id }), p(g.id)), 422); await mdenied("add_consolidation_member", { groupId: g.id, orgId: d.id }, ma, 422);
    await db.execute(sql.raw("drop trigger con_member_fault on consolidation_group_member; drop function con_member_fault()"));
    await db.execute(sql.raw("create function con_rule_fault() returns trigger language plpgsql as $$ begin NEW.name=''; return NEW; end $$"));
    await db.execute(sql.raw("create trigger con_rule_fault before insert or update on consolidation_elimination_rule for each row execute function con_rule_fault()"));
    for (const [fn, name, args] of writes.slice(5)) { await denied(fn, 422); await mdenied(name, args, ma, 422); }
    await db.execute(sql.raw("drop trigger con_rule_fault on consolidation_elimination_rule; drop function con_rule_fault()"));
    const race = await Promise.all([add(req({ orgId: d.id }), p(g.id)), ma.call("add_consolidation_member", { groupId: g.id, orgId: d.id })]);
    assert.equal(Number(race[0].status === 201) + Number(!race[1].isError), 1);
    assert.equal((await db.select().from(consolidationGroupMember).where(and(eq(consolidationGroupMember.groupId, g.id), eq(consolidationGroupMember.orgId, d.id)))).length, 1);
    await ma.call("remove_consolidation_member", { groupId: g.id, orgId: d.id });
    const deletion = await Promise.all([remove(req(), p(g.id)), ma.call("add_consolidation_member", { groupId: g.id, orgId: d.id })]);
    assert.equal(deletion[0].status, 200);
    await denied(() => get(req(), p(g.id)), 404); await mdenied("get_consolidation_group", { groupId: g.id }, ma, 404);
    await denied(() => add(req({ orgId: d.id }), p(g.id)), 404); await mdenied("create_consolidation_elimination_rule", { groupId: g.id, ...ruleInput }, ma, 404);
    assert.equal((await ma.call("delete_consolidation_elimination_rule", { groupId: h.id, ruleId: hr.id })).body.success, true);
    assert.equal((await ma.call("delete_consolidation_group", { groupId: h.id })).body.success, true);
    assert.equal((await data(await list(req()))).groups.length, 0);
    assert.equal((await mb.call("get_consolidation_group", { groupId: foreign.id })).body.group.id, foreign.id);
    console.log("Consolidation configuration contracts verified: eleven REST/MCP pairs, currencies, public joins, auth/scope, saved-history guards, audit/output rollback and concurrency");
  } finally { await ma.close(); await mb.close(); await ro.close(); await managed.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
