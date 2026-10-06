import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, accrualSchedule, accrualEntry, journalEntry, journalLine, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/accrual-schedules/route";
import { GET as get, DELETE as cancel } from "../../app/api/v1/accrual-schedules/[id]/route";
import { POST as post } from "../../app/api/v1/accrual-schedules/[id]/post/route";
import { registerAllTools } from "../../lib/mcp/tools";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Accrual fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["list_accrual_schedules", "get_accrual_schedule", "create_accrual_schedule", "post_accrual_entry", "cancel_accrual_schedule"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Accrual A", slug: "acc-a" }, { name: "Accrual B", slug: "acc-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "acc-owner@example.test" }, { email: "acc-viewer@example.test" }, { email: "acc-manager@example.test" }]).returning();
  const [none, manage] = await db.insert(customRole).values([{ organizationId: a.id, name: "None", permissions: [] }, { organizationId: a.id, name: "Manage", permissions: ["manage:accruals"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }, { organizationId: a.id, userId: manager.id, role: "member", customRoleId: manage.id }]);
  const keys = { a: "dk_acc_a", b: "dk_acc_b", viewer: "dk_acc_viewer", manager: "dk_acc_manager", expired: "dk_acc_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : name === "manager" ? manager.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"),
    keyPrefix: "dk_acc", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const [own, reverse, foreign, inactive, deleted, fx] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "Prepayment", type: "asset" }, { organizationId: a.id, code: "5900", name: "Expense", type: "expense" },
    { organizationId: b.id, code: "1000", name: "Foreign", type: "asset" }, { organizationId: a.id, code: "1001", name: "Inactive", type: "asset", isActive: false },
    { organizationId: a.id, code: "1002", name: "Deleted", type: "asset", deletedAt: new Date() }, { organizationId: a.id, code: "1003", name: "FX", type: "asset", currencyCode: "EUR" },
  ]).returning();
  const [source, foreignSource, draft] = await db.insert(journalEntry).values([
    { organizationId: a.id, entryNumber: 1, date: "2024-01-01", description: "Source", status: "posted" },
    { organizationId: b.id, entryNumber: 1, date: "2024-01-01", description: "Foreign", status: "posted" },
    { organizationId: a.id, entryNumber: 2, date: "2024-01-01", description: "Draft", status: "draft" },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await connect({ ...ctx, userId: manager.id, role: "member", permissions: ["manage:accruals"] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request("http://fixture.test/accrual" + query, { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const r = await db.execute(sql.raw("select jsonb_build_object('schedules',(select jsonb_agg(to_jsonb(t) order by id) from accrual_schedule t),'entries',(select jsonb_agg(to_jsonb(t) order by id) from accrual_entry t),'journals',(select jsonb_agg(to_jsonb(t) order by id) from journal_entry t),'lines',(select jsonb_agg(to_jsonb(t) order by id) from journal_line t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown> = {}, client = ma, status?: number) {
    const before = await snapshot(), r = await client.call(name, args); assert.equal(r.isError, true, JSON.stringify(r));
    if (status) assert.equal(r.body.status, status, `${name}: ${JSON.stringify(r)}`); assert.equal(await snapshot(), before);
  }
  const base = { description: "Spread", startDate: "2024-01-31", endDate: "2024-04-30", periods: 3, accountId: own.id, reverseAccountId: reverse.id };
  try {
    const legacy = (await data(await create(req({ ...base, sourceEntryId: source.id, totalAmount: 12.5, idempotencyKey: "create" })), 201)).schedule;
    assert.equal(legacy.totalAmount, 1250); assert.equal(legacy.totalAmountMinor, "1250");
    assert.deepEqual(legacy.entries.map((e: { amount: number }) => e.amount), [416, 416, 418]);
    assert.deepEqual(legacy.entries.map((e: { periodDate: string }) => e.periodDate), ["2024-01-31", "2024-03-02", "2024-03-31"]);
    const snap = await snapshot();
    const replay = await ma.call("create_accrual_schedule", { ...base, sourceEntryId: source.id, totalAmountMinor: "1250", idempotencyKey: "create" });
    assert.equal(replay.isError, false); assert.deepEqual(replay.body.accrualSchedule, legacy); assert.equal(await snapshot(), snap);
    await denied(() => create(req({ ...base, sourceEntryId: source.id, totalAmount: 13, idempotencyKey: "create" })), 409);
    const exact = (await ma.call("create_accrual_schedule", { ...base, totalAmountMinor: "9007199254740991" })).body.accrualSchedule;
    assert.equal(exact.totalAmount, Number.MAX_SAFE_INTEGER);
    assert.equal(exact.entries.reduce((s: bigint, e: { amountMinor: string }) => s + BigInt(e.amountMinor), 0n), 9007199254740991n);
    const max = (await data(await create(req({ ...base, totalAmountExact: "90071992547409.91" })), 201)).schedule;
    assert.equal(max.totalAmountMinor, "9007199254740991");
    const dual = (await data(await create(req({ ...base, totalAmount: 1.005, totalAmountExact: "1.005", totalAmountMinor: "101" })), 201)).schedule;
    assert.equal(dual.totalAmount, 101);
    const cents = (await ma.call("create_accrual_schedule", { ...base, totalAmount: 1250, totalAmountMinor: "1250" })).body.accrualSchedule;
    assert.equal(cents.totalAmount, 1250);
    assert.deepEqual((await data(await get(req(), p(legacy.id)))).schedule, (await ma.call("get_accrual_schedule", { scheduleId: legacy.id })).body.accrualSchedule);
    const listed = await data(await list(req())), ml = (await ma.call("list_accrual_schedules")).body;
    assert.deepEqual(listed.data, ml.accrualSchedules); assert.equal(listed.pagination.total, ml.total);
    for (const bad of [{ totalAmountMinor: "01" }, { totalAmountMinor: "-1" }, { totalAmountMinor: "-0" }, { totalAmountMinor: "1e3" },
      { totalAmountMinor: "9223372036854775808" }, { totalAmount: 1, totalAmountMinor: "2" }, { totalAmount: 1, totalAmountExact: "1.0001" },
      { totalAmountExact: "0.001" }, { totalAmount: 1, startDate: "2024-02-30" }, { totalAmount: 1, endDate: "2024-02-29" },
      { totalAmount: 1, periods: 1201 }, { totalAmount: 1, accountId: reverse.id }, { totalAmount: 1, currency: "IRR" }]) {
      const status = "accountId" in bad ? 422 : 400;
      await denied(() => create(req({ ...base, ...bad })), status);
    }
    await denied(() => create(req({ ...base, totalAmountMinor: "9007199254740992" })), 422);
    await mdenied("create_accrual_schedule", { ...base, totalAmountMinor: "9007199254740992" }, ma, 422);
    for (const bad of [{ totalAmount: 1.1 }, { totalAmount: 9007199254740992 }, { totalAmount: 1, totalAmountMinor: "2" }, { totalAmountExact: "1" }])
      await mdenied("create_accrual_schedule", { ...base, ...bad });
    for (const account of [foreign, inactive, deleted, fx]) {
      const status = account.id === foreign.id ? 404 : 422;
      await denied(() => create(req({ ...base, totalAmount: 1, accountId: account.id })), status);
      await mdenied("create_accrual_schedule", { ...base, totalAmount: 100, reverseAccountId: account.id }, ma, status);
    }
    for (const src of [foreignSource, draft]) {
      const status = src.id === foreignSource.id ? 404 : 422;
      await denied(() => create(req({ ...base, totalAmount: 1, sourceEntryId: src.id })), status);
      await mdenied("create_accrual_schedule", { ...base, totalAmount: 100, sourceEntryId: src.id }, ma, status);
    }
    for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.b ? 404 : key === keys.viewer ? 403 : 401;
      for (const fn of [() => get(req({}, key), p(legacy.id)), () => cancel(req({}, key), p(legacy.id)), () => post(req({}, key), p(legacy.id))]) await denied(fn, status);
    }
    for (const [name, args] of [["get_accrual_schedule", { scheduleId: legacy.id }], ["post_accrual_entry", { scheduleId: legacy.id }], ["cancel_accrual_schedule", { scheduleId: legacy.id }]] as const) {
      await mdenied(name, args, mb, 404); await mdenied(name, args, ro, 403);
    }
    await denied(() => list(req({}, keys.viewer)), 403); await denied(() => create(req({ ...base, totalAmount: 1 }, keys.viewer)), 403);
    await mdenied("list_accrual_schedules", {}, ro, 403); await mdenied("create_accrual_schedule", { ...base, totalAmount: 100 }, ro, 403);
    await denied(() => get(req(), p("invalid")), 400);
    for (const query of ["?page=0", "?limit=101", "?page=1.5", "?status=bad", "?limit=oops"]) await denied(() => list(req({}, keys.a, query)), 400);
    await denied(() => create(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    const firstId = legacy.entries[0].id;
    await denied(() => post(req({ entryId: legacy.entries[1].id }), p(legacy.id)), 409);
    await mdenied("post_accrual_entry", { scheduleId: legacy.id, entryId: exact.entries[0].id }, ma, 404);
    const race = await Promise.all([post(req({ entryId: firstId, idempotencyKey: "first" }), p(legacy.id)), ma.call("post_accrual_entry", { scheduleId: legacy.id, entryId: firstId, idempotencyKey: "first" })]);
    const first = (await data(race[0])).entry; assert.equal(race[1].isError, false); assert.deepEqual(first, race[1].body.accrualEntry);
    assert.equal(first.amountMinor, "416");
    const postedSnap = await snapshot();
    await data(await post(req({ entryId: firstId, idempotencyKey: "first" }), p(legacy.id))); assert.equal(await snapshot(), postedSnap);
    await mdenied("post_accrual_entry", { scheduleId: legacy.id, entryId: legacy.entries[1].id, idempotencyKey: "first" }, ma, 409);
    await data(await post(req({ entryId: firstId }), p(legacy.id))); assert.equal(await snapshot(), postedSnap);
    const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, first.journalEntryId));
    assert.equal(legs.reduce((s, l) => s + BigInt(l.debitAmount) - BigInt(l.creditAmount), 0n), 0n);
    assert.ok(legs.every(l => l.currencyCode === "USD" && l.rateExact === "1"));
    // Legacy no-body post remains supported; retry key identifies a command.
    const empty = new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` } });
    await data(await post(empty, p(legacy.id)));
    await ma.call("post_accrual_entry", { scheduleId: legacy.id, idempotencyKey: "last" });
    assert.equal((await data(await get(req(), p(legacy.id)))).schedule.status, "completed");
    const completeSnap = await snapshot();
    assert.equal((await ma.call("post_accrual_entry", { scheduleId: legacy.id, idempotencyKey: "last" })).isError, false); assert.equal(await snapshot(), completeSnap);
    await denied(() => cancel(req(), p(legacy.id)), 400);
    await mdenied("post_accrual_entry", { scheduleId: legacy.id }, ma, 400);
    // Cancellation is permission-gated and idempotent, preserving existing journals.
    await managed.call("post_accrual_entry", { scheduleId: cents.id, entryId: cents.entries[0].id });
    await data(await cancel(req({}, keys.manager), p(cents.id)));
    const cancelledSnap = await snapshot(); await managed.call("cancel_accrual_schedule", { scheduleId: cents.id }); assert.equal(await snapshot(), cancelledSnap);
    await mdenied("post_accrual_entry", { scheduleId: cents.id }, ma, 400);
    assert.equal((await data(await list(req({}, keys.a, "?status=cancelled")))).pagination.total, 1);
    // Large saved amounts post without Number allocation drift.
    const maxFirst = (await data(await post(req({ entryId: exact.entries[0].id }), p(exact.id)))).entry;
    assert.equal(maxFirst.amountMinor, exact.entries[0].amountMinor);
    // Synthetic pre-expansion history: synchronization otherwise backfills exact FX.
    await db.execute(sql.raw("alter table journal_line disable trigger user"));
    await db.update(journalLine).set({ rateExact: null }).where(eq(journalLine.journalEntryId, maxFirst.journalEntryId));
    await db.execute(sql.raw("alter table journal_line enable trigger user"));
    assert.equal((await data(await get(req(), p(exact.id)))).schedule.entries[0].amountMinor, maxFirst.amountMinor);
    // Period and fiscal-year barriers are checked inside posting transaction.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-12-31", advisorLockDate: "2024-02-01", lockedBy: owner.id }).returning();
    await denied(() => post(req({}, keys.manager), p(dual.id)), 422);
    await mdenied("post_accrual_entry", { scheduleId: dual.id }, ma, 422);
    const unlockedForAdvisor = (await data(await create(req({ ...base, startDate: "2024-03-01", endDate: "2024-05-01", totalAmount: 1 })), 201)).schedule;
    await mdenied("post_accrual_entry", { scheduleId: unlockedForAdvisor.id }, managed, 422);
    await data(await post(req(), p(unlockedForAdvisor.id)));
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2024-01-01", endDate: "2024-12-31", isClosed: true }).returning();
    await denied(() => post(req(), p(dual.id)), 422); await mdenied("post_accrual_entry", { scheduleId: dual.id }, ma, 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    // Foreign saved references and unsafe history fail without disclosure/mutation.
    await db.update(accrualSchedule).set({ sourceEntryId: foreignSource.id }).where(eq(accrualSchedule.id, dual.id));
    await denied(() => get(req(), p(dual.id)), 422); await mdenied("cancel_accrual_schedule", { scheduleId: dual.id }, ma, 422);
    await db.update(accrualSchedule).set({ sourceEntryId: null, accountId: foreign.id }).where(eq(accrualSchedule.id, dual.id));
    await denied(() => get(req(), p(dual.id)), 422); await mdenied("post_accrual_entry", { scheduleId: dual.id }, ma, 422);
    await db.update(accrualSchedule).set({ accountId: own.id }).where(eq(accrualSchedule.id, dual.id));
    await db.execute(sql`update accrual_schedule set total_amount=9007199254740992 where id=${dual.id}`);
    await denied(() => cancel(req(), p(dual.id)), 422); await mdenied("list_accrual_schedules", {}, ma, 422);
    await db.update(accrualSchedule).set({ totalAmount: 101 }).where(eq(accrualSchedule.id, dual.id));
    await db.update(accrualEntry).set({ amount: 34 }).where(eq(accrualEntry.id, dual.entries[0].id));
    await denied(() => post(req(), p(dual.id)), 422);
    await db.update(accrualEntry).set({ amount: 33 }).where(eq(accrualEntry.id, dual.entries[0].id));
    const [orphan] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 100, date: "2024-01-31", description: "Partial legacy post", status: "posted", sourceType: "accrual", sourceId: dual.id }).returning();
    await denied(() => post(req(), p(dual.id)), 422); await mdenied("get_accrual_schedule", { scheduleId: dual.id }, ma, 422);
    await db.delete(journalEntry).where(eq(journalEntry.id, orphan.id));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, own.id));
    await denied(() => post(req(), p(dual.id)), 422);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, own.id));
    // All writes roll back on audit faults, including a journal already inserted.
    await db.execute(sql.raw("create function accrual_audit_fault() returns trigger language plpgsql as $$ begin if NEW.entity_type='accrual_schedule' then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger accrual_audit_fault before insert on audit_log for each row execute function accrual_audit_fault()"));
    for (const fn of [() => create(req({ ...base, totalAmount: 1 })), () => cancel(req(), p(dual.id)), () => post(req(), p(dual.id))]) await denied(fn, 500);
    for (const [name, args] of [["create_accrual_schedule", { ...base, totalAmount: 100 }], ["cancel_accrual_schedule", { scheduleId: dual.id }], ["post_accrual_entry", { scheduleId: dual.id }]] as const) await mdenied(name, args);
    await db.execute(sql.raw("drop trigger accrual_audit_fault on audit_log; drop function accrual_audit_fault()"));
    // Response/history validation occurs before commit after saved output disagrees.
    await db.execute(sql.raw("create function accrual_money_fault() returns trigger language plpgsql as $$ begin NEW.amount=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger accrual_money_fault before insert on accrual_entry for each row execute function accrual_money_fault()"));
    await denied(() => create(req({ ...base, totalAmount: 1 })), 422); await mdenied("create_accrual_schedule", { ...base, totalAmount: 100 }, ma, 422);
    await db.execute(sql.raw("drop trigger accrual_money_fault on accrual_entry; drop function accrual_money_fault()"));
    await db.execute(sql.raw("create function accrual_leg_fault() returns trigger language plpgsql as $$ begin NEW.debit_amount=NEW.debit_amount+1; return NEW; end $$"));
    await db.execute(sql.raw("create trigger accrual_leg_fault before insert on journal_line for each row execute function accrual_leg_fault()"));
    await denied(() => post(req(), p(dual.id)), 422); await mdenied("post_accrual_entry", { scheduleId: dual.id }, ma, 422);
    await db.execute(sql.raw("drop trigger accrual_leg_fault on journal_line; drop function accrual_leg_fault()"));
    // A bounded journal-number retry restarts the entire rolled-back transaction.
    await db.execute(sql.raw("create sequence accrual_retry_counter; create function accrual_retry_fault() returns trigger language plpgsql as $$ begin if NEW.source_type='accrual' and nextval('accrual_retry_counter')=1 then raise unique_violation using constraint='journal_entry_org_number_idx'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger accrual_retry_fault before insert on journal_entry for each row execute function accrual_retry_fault()"));
    await data(await post(req({ entryId: dual.entries[0].id }), p(dual.id)));
    await db.execute(sql.raw("drop trigger accrual_retry_fault on journal_entry; drop function accrual_retry_fault(); drop sequence accrual_retry_counter"));
    // Two unkeyed commands advance distinct periods rather than duplicate one.
    const advance = await Promise.all([post(req(), p(dual.id)), ma.call("post_accrual_entry", { scheduleId: dual.id })]);
    const advanced = (await data(advance[0])).entry; assert.equal(advance[1].isError, false); assert.notEqual(advanced.id, advance[1].body.accrualEntry.id);
    // Concurrent normalized creates produce one root; cancel/post serialize.
    const cr = await Promise.all([create(req({ ...base, totalAmount: 1, idempotencyKey: "race-create" })), ma.call("create_accrual_schedule", { ...base, totalAmountMinor: "100", idempotencyKey: "race-create" })]);
    const fresh = (await data(cr[0], 201)).schedule; assert.equal(cr[1].body.accrualSchedule.id, fresh.id);
    const cp = await Promise.all([cancel(req(), p(fresh.id)), ma.call("post_accrual_entry", { scheduleId: fresh.id })]);
    await data(cp[0]); const ended = (await data(await get(req(), p(fresh.id)))).schedule;
    assert.equal(ended.status, "cancelled"); assert.equal(ended.entries.filter((e: { posted: boolean }) => e.posted).length, cp[1].isError ? 0 : 1);
    // Fixed cents stay fixed for legacy non-two-decimal currencies; posting rejects unqualified scales.
    for (const currency of ["JPY", "KWD", "IRR"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      await db.update(chartAccount).set({ currencyCode: currency }).where(eq(chartAccount.id, own.id));
      await db.update(chartAccount).set({ currencyCode: currency }).where(eq(chartAccount.id, reverse.id));
      const s = (await data(await create(req({ ...base, totalAmount: 12.5 })), 201)).schedule;
      assert.equal(s.totalAmountMinor, "1250"); assert.equal((await ma.call("get_accrual_schedule", { scheduleId: s.id })).body.accrualSchedule.totalAmount, 1250);
      await denied(() => post(req(), p(s.id)), 422); await mdenied("post_accrual_entry", { scheduleId: s.id }, ma, 422);
    }
    console.log("Accrual contracts verified: five pairs, units/aliases, exact conservation, scope/auth, period locks, retries, rollback and concurrency");
  } finally { await ma.close(); await mb.close(); await ro.close(); await managed.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
