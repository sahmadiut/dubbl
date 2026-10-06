import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, pipeline, deal, dealActivity } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as pipelines, POST as createPipeline } from "../../app/api/v1/crm/pipelines/route";
import { GET as getPipeline, PATCH as patchPipeline, DELETE as deletePipeline } from "../../app/api/v1/crm/pipelines/[id]/route";
import { GET as deals, POST as createDeal } from "../../app/api/v1/crm/deals/route";
import { GET as getDeal, PATCH as patchDeal, DELETE as deleteDeal } from "../../app/api/v1/crm/deals/[id]/route";
import { PATCH as move } from "../../app/api/v1/crm/deals/[id]/stage/route";
import { POST as won } from "../../app/api/v1/crm/deals/[id]/won/route";
import { POST as lost } from "../../app/api/v1/crm/deals/[id]/lost/route";
import { GET as activities, POST as activity } from "../../app/api/v1/crm/deals/[id]/activities/route";
import { GET as analytics } from "../../app/api/v1/crm/analytics/route";
import { registerAllTools } from "../../lib/mcp/tools";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "CRM fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["list_pipelines", "get_pipeline", "create_pipeline", "update_pipeline", "delete_pipeline", "list_deals", "get_deal", "create_deal", "update_deal", "delete_deal", "move_deal_stage", "mark_deal_won", "mark_deal_lost", "list_deal_activities", "add_deal_activity", "get_crm_analytics"]) {
    const t = tools.find(t => t.name === name); assert.ok(t); assert.equal(t.inputSchema.additionalProperties, false);
    for (const f of Object.values(t.inputSchema.properties ?? {})) assert.ok((f as { description?: string }).description, `${name}: missing description`);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "CRM A", slug: "crm-a" }, { name: "CRM B", slug: "crm-b" }]).returning();
  const [owner, viewer, outsider] = await db.insert(users).values([{ email: "crm-owner@example.test", passwordHash: "private" }, { email: "crm-viewer@example.test" }, { email: "crm-outsider@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }, { organizationId: b.id, userId: outsider.id, role: "member" }]);
  const keys = { a: "dk_crm_a", b: "dk_crm_b", viewer: "dk_crm_viewer", expired: "dk_crm_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_crm", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const [c, fc, dc] = await db.insert(contact).values([{ organizationId: a.id, name: "Owned", creditLimit: 123 }, { organizationId: b.id, name: "Foreign" }, { organizationId: a.id, name: "Deleted", deletedAt: new Date() }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await connect({ ...ctx, role: "member", permissions: ["manage:contacts"] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request("http://fixture.test/crm" + query,
    { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const r = await db.execute(sql.raw("select jsonb_build_object('pipelines',(select jsonb_agg(to_jsonb(t) order by id) from pipeline t),'deals',(select jsonb_agg(to_jsonb(t) order by id) from deal t),'activities',(select jsonb_agg(to_jsonb(t) order by id) from deal_activity t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown> = {}, client = ma, status?: number) {
    const before = await snapshot(), r = await client.call(name, args); assert.equal(r.isError, true, JSON.stringify(r));
    if (status) assert.equal(r.body.status, status, `${name}: ${JSON.stringify(r)}`); assert.equal(await snapshot(), before);
  }
  const stages = [{ id: "lead", name: "Lead", color: "#aaaaaa" }, { id: "qualified", name: "Qualified", color: "#bbbbbb" }];
  try {
    const pl = (await data(await createPipeline(req({ name: "Main", stages, isDefault: true })), 201)).pipeline;
    const pl2 = (await managed.call("create_pipeline", { name: "Other", stages, isDefault: true })).body.pipeline;
    assert.equal((await data(await getPipeline(req(), p(pl.id)))).pipeline.isDefault, false);
    await data(await patchPipeline(req({ isDefault: true }), p(pl.id)));
    await ma.call("update_pipeline", { pipelineId: pl2.id, name: "Renamed" });
    assert.deepEqual((await data(await pipelines(req()))).pipelines, (await ma.call("list_pipelines")).body.pipelines);
    const foreignPipeline = (await mb.call("create_pipeline", { name: "Foreign", stages })).body.pipeline;
    const d = (await data(await createDeal(req({ pipelineId: pl.id, stageId: "lead", title: "Legacy", valueCents: 1250, contactId: c.id, assignedTo: owner.id, probability: 33, expectedCloseDate: "2024-02-29" })), 201)).deal;
    assert.equal(d.valueCentsMinor, "1250"); assert.equal(d.organizationId, a.id);
    const exact = (await ro.call("create_deal", { pipelineId: pl.id, stageId: "lead", title: "Exact", valueCentsMinor: "2", probability: null })).body.deal;
    assert.equal(exact.valueCents, 2); assert.equal(exact.probability, null);
    const maxima = (await ma.call("create_deal", { pipelineId: pl2.id, stageId: "lead", title: "Max", valueCentsMinor: "9007199254740991", currency: "JPY" })).body.deal;
    assert.equal(maxima.valueCents, Number.MAX_SAFE_INTEGER);
    const detail = (await data(await getDeal(req(), p(d.id)))).deal;
    assert.equal(detail.contact.creditLimitMinor, "123"); assert.equal(detail.assignedUser.id, owner.id); assert.equal(Object.hasOwn(detail.assignedUser, "passwordHash"), false);
    assert.deepEqual(detail, (await ma.call("get_deal", { dealId: d.id })).body.deal);
    assert.deepEqual((await data(await getPipeline(req(), p(pl.id)))).pipeline, (await ma.call("get_pipeline", { pipelineId: pl.id })).body.pipeline);
    const ls = await data(await deals(req({}, keys.a, `?pipelineId=${pl.id}&search=Legacy&limit=1`)));
    assert.equal(ls.data.length, 1); assert.equal(ls.summary.totalDeals, 2); assert.equal(ls.summary.activeValueMinor, "1252"); assert.equal(ls.summary.currency, "USD");
    const mls = (await ma.call("list_deals", { pipelineId: pl.id, search: "Legacy", limit: 1 })).body;
    assert.deepEqual(mls.deals, ls.data); assert.deepEqual(mls.summary, ls.summary);
    await denied(() => analytics(req()), 422); await mdenied("get_crm_analytics", {}, ma, 422);
    await denied(() => deals(req()), 422); await mdenied("list_deals", {}, ma, 422);
    assert.equal((await data(await analytics(req({}, keys.a, "?currency=JPY")))).totalPipelineValueMinor, "9007199254740991");
    await data(await patchDeal(req({ valueCentsMinor: "3", valueCents: 3 }), p(exact.id)));
    await ma.call("update_deal", { dealId: d.id, valueCentsMinor: "1" });
    assert.equal((await data(await move(req({ stageId: "qualified" }), p(d.id)))).deal.stageId, "qualified");
    assert.equal((await ma.call("move_deal_stage", { dealId: exact.id, stageId: "qualified" })).body.deal.stageId, "qualified");
    const w = (await data(await won(req(), p(d.id)))).deal;
    const beforeRetry = await snapshot(); assert.equal((await ma.call("mark_deal_won", { dealId: d.id })).body.deal.wonAt, w.wonAt); assert.equal(await snapshot(), beforeRetry);
    await ma.call("mark_deal_won", { dealId: exact.id });
    const totals = await data(await analytics(req({}, keys.a, "?currency=USD")));
    assert.equal(totals.wonValueMinor, "4"); assert.equal(totals.avgDealValueMinor, "2"); assert.equal(totals.conversionRate, 100);
    assert.deepEqual(totals, (await ma.call("get_crm_analytics", { currency: "USD" })).body);
    const l = (await data(await lost(req({ reason: "No budget" }), p(exact.id)))).deal; assert.equal(l.wonAt, null); assert.equal(l.probability, 0);
    const lretry = await snapshot(); assert.equal((await ma.call("mark_deal_lost", { dealId: exact.id, reason: "retry" })).body.deal.lostAt, l.lostAt); assert.equal(await snapshot(), lretry);
    assert.equal((await data(await analytics(req({}, keys.a, "?currency=USD")))).conversionRate, 50);
    const act = (await data(await activity(req({ type: "call", content: "Phone", scheduledAt: "2024-01-01T10:00:00+03:30" }), p(d.id)), 201)).activity;
    assert.equal(act.scheduledAt, "2024-01-01T06:30:00.000Z");
    await ma.call("add_deal_activity", { dealId: d.id, type: "note", content: "Memo" });
    const acts = await data(await activities(req({}, keys.a, "?type=call&search=Phone&limit=1"), p(d.id)));
    assert.equal(acts.activities.length, 1); assert.equal(acts.totalAll, 2); assert.equal(acts.typeCounts.note, 1); assert.equal(Object.hasOwn(acts.activities[0].user, "passwordHash"), false);
    assert.deepEqual(acts, (await ma.call("list_deal_activities", { dealId: d.id, type: "call", search: "Phone", limit: 1 })).body);
    // All CRM readers authenticate; pipeline writers require manage:contacts, existing deal/activity policy remains authenticated-only.
    for (const key of [keys.expired, "dk_bad"]) await denied(() => createDeal(req({ pipelineId: pl.id, stageId: "lead", title: "No" }, key)), 401);
    for (const fn of [() => createPipeline(req({ name: "No", stages }, keys.viewer)), () => patchPipeline(req({ name: "No" }, keys.viewer), p(pl.id)), () => deletePipeline(req({}, keys.viewer), p(pl2.id))]) await denied(fn, 403);
    for (const [name, args] of [["create_pipeline", { name: "No", stages }], ["update_pipeline", { pipelineId: pl.id, name: "No" }], ["delete_pipeline", { pipelineId: pl2.id }]] as const) await mdenied(name, args, ro, 403);
    for (const [fn, name, args] of [
      [() => getDeal(req({}, keys.b), p(d.id)), "get_deal", { dealId: d.id }],
      [() => patchDeal(req({ title: "No" }, keys.b), p(d.id)), "update_deal", { dealId: d.id, title: "No" }],
      [() => deleteDeal(req({}, keys.b), p(d.id)), "delete_deal", { dealId: d.id }],
      [() => move(req({ stageId: "lead" }, keys.b), p(d.id)), "move_deal_stage", { dealId: d.id, stageId: "lead" }],
      [() => won(req({}, keys.b), p(d.id)), "mark_deal_won", { dealId: d.id }],
      [() => lost(req({}, keys.b), p(d.id)), "mark_deal_lost", { dealId: d.id }],
      [() => activities(req({}, keys.b), p(d.id)), "list_deal_activities", { dealId: d.id }],
      [() => activity(req({ type: "note" }, keys.b), p(d.id)), "add_deal_activity", { dealId: d.id, type: "note" }],
      [() => getPipeline(req({}, keys.b), p(pl.id)), "get_pipeline", { pipelineId: pl.id }],
      [() => patchPipeline(req({ name: "No" }, keys.b), p(pl.id)), "update_pipeline", { pipelineId: pl.id, name: "No" }],
      [() => deletePipeline(req({}, keys.b), p(pl.id)), "delete_pipeline", { pipelineId: pl.id }],
    ] as const) { await denied(fn, 404); await mdenied(name, args, mb, 404); }
    for (const bad of [{ pipelineId: foreignPipeline.id }, { contactId: fc.id }, { contactId: dc.id }, { assignedTo: outsider.id }]) {
      await denied(() => createDeal(req({ pipelineId: pl.id, stageId: "lead", title: "No", ...bad })), 404);
      await mdenied("create_deal", { pipelineId: pl.id, stageId: "lead", title: "No", ...bad }, ma, 404);
    }
    for (const bad of [{ contactId: fc.id }, { contactId: dc.id }, { assignedTo: outsider.id }]) {
      await denied(() => patchDeal(req(bad), p(d.id)), 404); await mdenied("update_deal", { dealId: d.id, ...bad }, ma, 404);
    }
    for (const bad of [{ valueCents: 1.1 }, { valueCents: -1 }, { valueCents: "1" }, { valueCentsMinor: "01" }, { valueCents: 1, valueCentsMinor: "2" }, { valueCentsMinor: "9223372036854775808" }, { probability: 101 }, { expectedCloseDate: "2024-02-30" }, { unknown: true }]) {
      await denied(() => createDeal(req({ pipelineId: pl.id, stageId: "lead", title: "No", ...bad })), 400);
      await mdenied("create_deal", { pipelineId: pl.id, stageId: "lead", title: "No", ...bad });
      await denied(() => patchDeal(req(bad), p(d.id)), 400); await mdenied("update_deal", { dealId: d.id, ...bad });
    }
    await denied(() => patchDeal(req({ valueCentsMinor: "9007199254740992" }), p(d.id)), 422);
    await mdenied("update_deal", { dealId: d.id, valueCentsMinor: "9007199254740992" }, ma, 422);
    await denied(() => move(req({ stageId: "missing" }), p(d.id)), 422); await mdenied("move_deal_stage", { dealId: d.id, stageId: "missing" }, ma, 422);
    await denied(() => activity(req({ type: "note", scheduledAt: "2024-02-30T10:00:00Z" }), p(d.id)), 400);
    await mdenied("add_deal_activity", { dealId: d.id, type: "note", scheduledAt: "bad" });
    for (const q of ["?page=01", "?limit=1.5", "?page=1&page=2", "?currency=XYZ", "?unknown=true", "?status=bad", "?sortBy=bad"]) await denied(() => deals(req({}, keys.a, q)), 400);
    await denied(() => getDeal(req(), p("bad")), 400);
    await denied(() => createDeal(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    for (const bad of [{ stages: [] }, { stages: [...stages, ...stages] }, { name: "" }, { unknown: true }]) {
      await denied(() => patchPipeline(req(bad), p(pl.id)), 400); await mdenied("update_pipeline", { pipelineId: pl.id, ...bad });
    }
    const active = (await ma.call("create_deal", { pipelineId: pl.id, stageId: "lead", title: "Active" })).body.deal;
    await denied(() => patchPipeline(req({ stages: [stages[1]] }), p(pl.id)), 409);
    await mdenied("update_pipeline", { pipelineId: pl.id, stages: [stages[1]] }, ma, 409);
    await denied(() => deletePipeline(req(), p(pl.id)), 409); await mdenied("delete_pipeline", { pipelineId: pl.id }, ma, 409);
    // Exact aggregate bounds and unsupported stored values fail closed.
    const over = (await ma.call("create_deal", { pipelineId: pl2.id, stageId: "lead", title: "Overflow", currency: "JPY", valueCents: 1 })).body.deal;
    await denied(() => analytics(req({}, keys.a, "?currency=JPY")), 422); await mdenied("get_crm_analytics", { currency: "JPY" }, ma, 422);
    await data(await deleteDeal(req(), p(over.id)));
    await db.execute(sql.raw(`update deal set value_cents=9007199254740992 where id='${d.id}'`));
    await denied(() => getDeal(req(), p(d.id)), 422); await mdenied("get_deal", { dealId: d.id }, ma, 422);
    await denied(() => patchDeal(req({ title: "No" }), p(d.id)), 422); await mdenied("update_deal", { dealId: d.id, title: "No" }, ma, 422);
    await db.execute(sql.raw(`update deal set value_cents=1 where id='${d.id}'`));
    await db.update(deal).set({ currency: "XYZ" }).where(eq(deal.id, d.id));
    await denied(() => getDeal(req(), p(d.id)), 422); await mdenied("get_deal", { dealId: d.id }, ma, 422);
    await denied(() => patchDeal(req({ title: "No" }), p(d.id)), 422);
    await db.update(deal).set({ currency: "USD", wonAt: new Date(), lostAt: new Date() }).where(eq(deal.id, d.id));
    await denied(() => getDeal(req(), p(d.id)), 422); await mdenied("get_deal", { dealId: d.id }, ma, 422);
    await db.update(deal).set({ lostAt: null }).where(eq(deal.id, d.id));
    await db.update(pipeline).set({ stages: [] }).where(eq(pipeline.id, pl.id));
    await denied(() => getPipeline(req(), p(pl.id)), 422); await mdenied("get_pipeline", { pipelineId: pl.id }, ma, 422);
    await denied(() => patchPipeline(req({ name: "No" }), p(pl.id)), 422);
    await db.update(pipeline).set({ stages }).where(eq(pipeline.id, pl.id));
    // Foreign historical joins never leak public or monetary data.
    for (const bad of [{ contactId: fc.id }, { assignedTo: outsider.id }, { pipelineId: foreignPipeline.id }]) {
      await db.update(deal).set(bad).where(eq(deal.id, d.id));
      await denied(() => getDeal(req(), p(d.id)), 404); await mdenied("get_deal", { dealId: d.id }, ma, 404);
      await db.update(deal).set({ contactId: c.id, assignedTo: owner.id, pipelineId: pl.id }).where(eq(deal.id, d.id));
    }
    const [foreignNested] = await db.insert(deal).values({ organizationId: b.id, pipelineId: pl.id, stageId: "lead", title: "Foreign nested", valueCents: 123 }).returning();
    assert.equal((await data(await getPipeline(req(), p(pl.id)))).pipeline.deals.some((r: { id: string }) => r.id === foreignNested.id), false);
    assert.equal((await ma.call("get_pipeline", { pipelineId: pl.id })).body.pipeline.deals.some((r: { id: string }) => r.id === foreignNested.id), false);
    await db.delete(deal).where(eq(deal.id, foreignNested.id));
    await db.update(dealActivity).set({ userId: outsider.id }).where(eq(dealActivity.id, act.id));
    await denied(() => activities(req(), p(d.id)), 404); await mdenied("list_deal_activities", { dealId: d.id }, ma, 404);
    await db.update(dealActivity).set({ userId: owner.id }).where(eq(dealActivity.id, act.id));
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, c.id));
    assert.equal((await data(await getDeal(req(), p(d.id)))).deal.contact.name, "Owned");
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, c.id));
    // Every mutation is tested against actual failing audit inserts, in both transports.
    const empty = (await ma.call("create_pipeline", { name: "Empty", stages })).body.pipeline;
    await db.execute(sql.raw("create function crm_audit_fault() returns trigger language plpgsql as $$ begin raise exception 'fixture audit fault'; end $$"));
    await db.execute(sql.raw("create trigger crm_audit_fault before insert on audit_log for each row execute function crm_audit_fault()"));
    const writes = [
      [() => createPipeline(req({ name: "Rollback", stages })), "create_pipeline", { name: "Rollback", stages }],
      [() => patchPipeline(req({ name: "Rollback" }), p(empty.id)), "update_pipeline", { pipelineId: empty.id, name: "Rollback" }],
      [() => deletePipeline(req(), p(empty.id)), "delete_pipeline", { pipelineId: empty.id }],
      [() => createDeal(req({ pipelineId: pl.id, stageId: "lead", title: "Rollback" })), "create_deal", { pipelineId: pl.id, stageId: "lead", title: "Rollback" }],
      [() => patchDeal(req({ title: "Rollback" }), p(active.id)), "update_deal", { dealId: active.id, title: "Rollback" }],
      [() => deleteDeal(req(), p(active.id)), "delete_deal", { dealId: active.id }],
      [() => move(req({ stageId: "qualified" }), p(active.id)), "move_deal_stage", { dealId: active.id, stageId: "qualified" }],
      [() => won(req(), p(active.id)), "mark_deal_won", { dealId: active.id }],
      [() => lost(req({ reason: "Rollback" }), p(active.id)), "mark_deal_lost", { dealId: active.id, reason: "Rollback" }],
      [() => activity(req({ type: "note" }), p(active.id)), "add_deal_activity", { dealId: active.id, type: "note" }],
    ] as const;
    for (const [fn, name, args] of writes) { await denied(fn, 500); await mdenied(name, args); }
    await db.execute(sql.raw("drop trigger crm_audit_fault on audit_log; drop function crm_audit_fault()"));
    await db.execute(sql.raw("create function crm_output_fault() returns trigger language plpgsql as $$ begin NEW.value_cents=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger crm_output_fault before insert or update on deal for each row execute function crm_output_fault()"));
    for (const [fn, name, args] of writes.filter(([,name]) => ["create_deal", "update_deal", "delete_deal", "move_deal_stage", "mark_deal_won", "mark_deal_lost"].includes(name))) { await denied(fn, 422); await mdenied(name, args, ma, 422); }
    await db.execute(sql.raw("drop trigger crm_output_fault on deal; drop function crm_output_fault()"));
    await db.execute(sql.raw("create function crm_pipeline_output_fault() returns trigger language plpgsql as $$ begin NEW.stages='[]'::jsonb; return NEW; end $$"));
    await db.execute(sql.raw("create trigger crm_pipeline_output_fault before insert or update on pipeline for each row execute function crm_pipeline_output_fault()"));
    for (const [fn, name, args] of writes.filter(([,name]) => ["create_pipeline", "update_pipeline", "delete_pipeline"].includes(name))) { await denied(fn, 422); await mdenied(name, args, ma, 422); }
    await db.execute(sql.raw("drop trigger crm_pipeline_output_fault on pipeline; drop function crm_pipeline_output_fault()"));
    await db.execute(sql.raw(`create function crm_activity_output_fault() returns trigger language plpgsql as $$ begin NEW.user_id='${outsider.id}'::uuid; return NEW; end $$`));
    await db.execute(sql.raw("create trigger crm_activity_output_fault before insert on deal_activity for each row execute function crm_activity_output_fault()"));
    await denied(() => activity(req({ type: "note" }), p(active.id)), 422); await mdenied("add_deal_activity", { dealId: active.id, type: "note" }, ma, 422);
    await db.execute(sql.raw("drop trigger crm_activity_output_fault on deal_activity; drop function crm_activity_output_fault()"));
    // Concurrent closing serializes, leaving one lifecycle. Same-state retries don't duplicate audit/history.
    const race = await Promise.all([won(req(), p(active.id)), ma.call("mark_deal_lost", { dealId: active.id })]);
    assert.equal(race[0].status, 200); assert.equal(race[1].isError, false);
    const closed = (await data(await getDeal(req(), p(active.id)))).deal; assert.notEqual(!!closed.wonAt, !!closed.lostAt);
    const defaults = await Promise.all([patchPipeline(req({ isDefault: true }), p(pl.id)), ma.call("update_pipeline", { pipelineId: pl2.id, isDefault: true })]);
    assert.equal(defaults[0].status, 200); assert.equal(defaults[1].isError, false);
    assert.equal((await data(await pipelines(req()))).pipelines.filter((v: { isDefault: boolean }) => v.isDefault).length, 1);
    await data(await deletePipeline(req(), p(empty.id))); await mdenied("get_pipeline", { pipelineId: empty.id }, ma, 404);
    const deletedRace = await Promise.all([deleteDeal(req(), p(active.id)), ma.call("delete_deal", { dealId: active.id })]);
    assert.equal(Number(deletedRace[0].status === 200) + Number(!deletedRace[1].isError), 1);
    await denied(() => activity(req({ type: "note" }), p(active.id)), 404); await mdenied("add_deal_activity", { dealId: active.id, type: "note" }, ma, 404);
    await ma.call("delete_deal", { dealId: d.id }); await data(await deleteDeal(req(), p(exact.id)));
    assert.equal((await data(await getPipeline(req(), p(pl.id)))).pipeline.deals.length, 0);
    assert.equal((await ma.call("delete_pipeline", { pipelineId: pl.id })).body.success, true);
    await data(await deleteDeal(req(), p(maxima.id))); await data(await deletePipeline(req(), p(pl2.id)));
    console.log("CRM contracts verified: sixteen REST/MCP pairs, exact cents/currency/probability, scoped public joins, lifecycle retries, concurrency and atomic rollback");
  } finally { await ma.close(); await mb.close(); await ro.close(); await managed.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
