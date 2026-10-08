import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, fiscalYear, budget, budgetLine,
  budgetPeriod, journalEntry, journalLine, notification, notificationPreference, notificationDigestQueue } from "../../lib/db/schema";
import { POST } from "../../app/api/v1/budgets/check-alerts/route";
import { POST as createRest } from "../../app/api/v1/budgets/route";
import { PATCH } from "../../app/api/v1/budgets/[id]/route";
import { GET as notifications } from "../../app/api/v1/notifications/route";
import { registerBudgetTools } from "../../lib/mcp/tools/budgets";
import { checkBudgetAlerts, checkBudgetVariances } from "../../lib/api/budget-alerts";
import { sendNotification } from "../../lib/notifications/send";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Budget alert fixture", version: "1" }); registerBudgetTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 7);
  assert.match(tools.find(tool => tool.name === "check_budget_alerts")!.description!, /Minor strings/);
  return { async call(name = "check_budget_alerts", args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Alert A", slug: "alert-a" }, { name: "Alert B", slug: "alert-b" }]).returning();
  const [owner, admin, deniedUser, newcomer] = await db.insert(users).values(["owner", "admin", "denied", "new"].map(name => ({
    name, email: `alert-${name}@example.test` }))).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No budgets", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: admin.id, role: "admin" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: deniedUser.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_ba_a", b: "dk_ba_b", denied: "dk_ba_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? deniedUser.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ba" });
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), denied = await mcp({ ...ctx, permissions: [] });
  const today = new Date().toISOString().slice(0, 10);
  const offset = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const header = { name: "Threshold", startDate: offset(-1), endDate: offset(1), periodType: "custom" };
  const [account, foreign] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "5000", name: "Spending", type: "expense" as const },
    { organizationId: b.id, code: "5000", name: "Foreign", type: "revenue" as const }]).returning();
  const request = (body: unknown = {}, key = keys.a, path = "/budgets/check-alerts", method = "POST") => new Request(`http://fixture.test/api/v1${path}`, {
    method, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["budget", "budget_line", "budget_period", "journal_entry", "journal_line", "notification", "notification_digest_queue", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  const create = async (amount: number | string = 3, pct: number | null = 50, orgB = false, periods?: Record<string, unknown>[]) => {
    const period = { label: "Now", startDate: header.startDate, endDate: today, ...(typeof amount === "string" ? { amountMinor: amount } : { amount }) };
    const response = await createRest(request({ ...header, varianceThresholdPct: pct,
      lines: [{ accountId: orgB ? foreign.id : account.id, ...(typeof amount === "string" ? { totalMinor: amount } : { total: amount }), periods: periods ?? [period] }] }, orgB ? keys.b : keys.a, "/budgets"));
    assert.equal(response.status, 201); return (await response.json()).budget;
  };
  let sequence = 0;
  const entry = async (debit: number, credit: number, date = today, status: "posted" | "draft" | "void" = "posted", org = a.id, deleted = false, acct = account.id) => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, description: "Synthetic",
      status, deletedAt: deleted ? new Date() : null }).returning();
    await db.insert(journalLine).values({ journalEntryId: saved.id, accountId: acct, debitAmount: debit, creditAmount: credit, currencyCode: "KWD" });
    return saved;
  };
  const stop = (id: string) => db.update(budget).set({ isActive: false }).where(eq(budget.id, id));
  const expectFailure = async (status: number, code?: string) => {
    const before = await snapshot(); const response = await POST(request()); assert.equal(response.status, status);
    if (code) assert.equal((await response.json()).code, code);
    const tool = await ma.call(); assert.equal(tool.isError, true); assert.equal(tool.body.status, status);
    if (code) assert.equal(tool.body.code, code);
    assert.deepEqual(await snapshot(), before);
  };
  try {
    assert.deepEqual(await (await POST(request())).json(), { checked: 0, alerted: 0, evaluations: [] });
    const old = await create();
    await entry(0, 1, header.startDate); await entry(0, 1); // Absolute net credits and inclusive dates.
    for (const status of ["draft", "void"] as const) await entry(999, 0, today, status);
    await entry(999, 0, today, "posted", a.id, true);
    await entry(999, 0, today, "posted", b.id); // Malformed foreign-org journal/account link.
    await entry(999, 0, offset(-2)); await entry(999, 0, offset(1)); // Outside explicit period.
    await db.insert(notificationPreference).values({ organizationId: a.id, userId: owner.id, type: "budget_exceeded", channel: "email", enabled: true, digestIntervalMinutes: 30 });
    const beforeAlert = await snapshot();
    const first = await POST(request()); assert.equal(first.status, 200); const firstBody = await first.json();
    assert.equal(firstBody.checked, 1); assert.equal(firstBody.alerted, 2);
    const value = firstBody.evaluations[0]; assert.equal(value.actualMinor, "2"); assert.equal(value.thresholdMinor, "2");
    assert.equal(value.budgeted, 3); assert.equal(value.budgetedMinor, "3");
    assert.equal((await db.select().from(notificationDigestQueue)).length, 1);
    const afterAlert = await snapshot();
    for (const table of ["budget", "budget_line", "budget_period", "journal_entry", "journal_line", "audit_log"])
      assert.deepEqual(afterAlert[table], beforeAlert[table]);
    const repeated = await ma.call(); assert.deepEqual(repeated.body, { ...firstBody, alerted: 0 });
    const read = await notifications(new Request("http://fixture.test/api/v1/notifications", { headers: { authorization: `Bearer ${keys.a}` } }));
    const own = (await read.json()).data; assert.equal(own.length, 1);
    assert.equal(own[0].body, "Period Now: actual USD 0.02 vs budget USD 0.03 (50% threshold)");
    assert.deepEqual((await mb.call()).body, { checked: 0, alerted: 0, evaluations: [] });
    // New recipient receives its missing notification; reading/deleting existing alerts does not reset deduplication.
    await db.update(notification).set({ readAt: new Date(), deletedAt: new Date() }).where(eq(notification.organizationId, a.id));
    await db.insert(member).values({ organizationId: a.id, userId: newcomer.id, role: "admin" });
    assert.equal((await ma.call()).body.alerted, 1); assert.equal((await ma.call()).body.alerted, 0);
    await stop(old.id);

    // Legacy and exact budget inputs give the same unscaled monetary values in all currency contexts.
    for (const [currency, display] of [["USD", "12.50"], ["IRR", "1250"], ["JPY", "1250"], ["KWD", "1.250"]]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      const saved = await create("1250", 0);
      const [rest, tool] = await Promise.all([POST(request()), ma.call()]);
      const restBody = await rest.json(); assert.equal(rest.status, 200);
      assert.equal(restBody.alerted + tool.body.alerted, 3);
      assert.deepEqual(restBody.evaluations, tool.body.evaluations);
      assert.equal(restBody.evaluations[0].budgetedMinor, "1250");
      const notes = await db.select().from(notification).where(and(eq(notification.organizationId, a.id), eq(notification.entityId, restBody.evaluations[0].periodId)));
      assert.equal(notes.length, 3); assert.ok(notes.every(note => note.body!.includes(`budget ${currency} ${display}`)));
      await stop(saved.id);
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    // Zero/negative budgets and disabled/inactive/deleted/out-of-period records do not notify.
    for (const amount of [0, -3]) { const saved = await create(amount); const result = (await ma.call()).body;
      assert.equal(result.checked, 1); assert.equal(result.alerted, 0); assert.equal(result.evaluations[0].exceedsThreshold, false); await stop(saved.id); }
    await create(3, null);
    const deleted = await create(); await db.update(budget).set({ deletedAt: new Date() }).where(eq(budget.id, deleted.id));
    const future = await create(3, 50, false, [{ label: "Future", startDate: offset(1), endDate: offset(2), amount: 3 }]);
    assert.equal((await ma.call()).body.checked, 0); await stop(future.id);
    // Authorization, strict payload and threshold write validation before mutation.
    const beforeDenied = await snapshot();
    assert.equal((await POST(request({}, "dk_invalid"))).status, 401);
    assert.equal((await POST(request({}, keys.denied))).status, 403);
    assert.equal((await denied.call()).body.status, 403);
    for (const input of [{ organizationId: b.id }, { today }, { amountMinor: "3" }, null]) {
      assert.equal((await POST(request(input))).status, 400);
      if (input !== null) assert.equal((await ma.call("check_budget_alerts", input)).isError, true);
    }
    assert.deepEqual(await snapshot(), beforeDenied);
    const config = await create("3");
    const beforeConfig = await snapshot();
    for (const varianceThresholdPct of [-1, 1.5, "50", 2147483648]) {
      assert.equal((await PATCH(request({ varianceThresholdPct }, keys.a, `/budgets/${config.id}`, "PATCH"), { params: Promise.resolve({ id: config.id }) })).status, 400);
      assert.equal((await ma.call("update_budget", { budgetId: config.id, varianceThresholdPct })).isError, true);
    }
    assert.deepEqual(await snapshot(), beforeConfig);
    const validUpdate = await PATCH(request({ varianceThresholdPct: 0 }, keys.a, `/budgets/${config.id}`, "PATCH"), { params: Promise.resolve({ id: config.id }) });
    assert.equal(validUpdate.status, 200); assert.equal((await validUpdate.json()).budget.varianceThresholdPct, 0);
    const updated = await ma.call("update_budget", { budgetId: config.id, varianceThresholdPct: null });
    assert.equal(updated.body.budget.varianceThresholdPct, null); assert.equal((await ma.call()).body.checked, 0);
    await stop(config.id);

    // Unsupported history in any selected budget is rejected before all alert/digest writes.
    const ready = await create(1, 0), bad = await create(3);
    const [line] = await db.select().from(budgetLine).where(eq(budgetLine.budgetId, bad.id));
    const [period] = await db.select().from(budgetPeriod).where(eq(budgetPeriod.budgetLineId, line.id));
    await db.execute(sql`update ${budgetPeriod} set amount=9007199254740992 where id=${period.id}`); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.update(budgetPeriod).set({ amount: 3 }).where(eq(budgetPeriod.id, period.id));
    await db.execute(sql`update ${budgetLine} set total=9223372036854775807 where id=${line.id}`); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.update(budgetLine).set({ total: 3 }).where(eq(budgetLine.id, line.id));
    await db.update(budget).set({ varianceThresholdPct: -1 }).where(eq(budget.id, bad.id)); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.update(budget).set({ varianceThresholdPct: 50 }).where(eq(budget.id, bad.id));
    await db.update(budgetPeriod).set({ startDate: "2026-02-30" }).where(eq(budgetPeriod.id, period.id)); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.update(budgetPeriod).set({ startDate: header.startDate }).where(eq(budgetPeriod.id, period.id));
    await db.update(organization).set({ defaultCurrency: "BAD" }).where(eq(organization.id, a.id)); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    await db.update(budgetLine).set({ accountId: foreign.id }).where(eq(budgetLine.id, line.id)); await expectFailure(404);
    await db.update(budgetLine).set({ accountId: account.id }).where(eq(budgetLine.id, line.id));
    const [foreignYear] = await db.insert(fiscalYear).values({ organizationId: b.id, name: "Foreign year", startDate: header.startDate, endDate: header.endDate }).returning();
    await db.update(budget).set({ fiscalYearId: foreignYear.id }).where(eq(budget.id, bad.id)); await expectFailure(404);
    await db.update(budget).set({ fiscalYearId: null }).where(eq(budget.id, bad.id));
    await db.update(chartAccount).set({ deletedAt: new Date() }).where(eq(chartAccount.id, account.id)); await expectFailure(404);
    await db.update(chartAccount).set({ deletedAt: null }).where(eq(chartAccount.id, account.id));
    await stop(ready.id); await stop(bad.id);

    // Safe-max inputs, text aggregates with oversized intermediate sums, and threshold/actual overflow.
    const [large] = await db.insert(chartAccount).values({ organizationId: a.id, code: "9999", name: "Large", type: "expense" }).returning();
    const exact = await ma.call("create_budget", { ...header, varianceThresholdPct: 50, lines: [{ accountId: large.id,
      totalMinor: "9007199254740991", periods: [{ label: "Maximum", startDate: header.startDate, endDate: today, amountMinor: "9007199254740991" }] }] });
    assert.equal(exact.isError, false); const maximum = exact.body.budget;
    await entry(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, today, "posted", a.id, false, large.id);
    const activity = await entry(4503599627370496, 0, today, "posted", a.id, false, large.id);
    const maximumBody = (await ma.call()).body; assert.equal(maximumBody.evaluations[0].thresholdMinor, "4503599627370496");
    assert.equal(maximumBody.evaluations[0].actualMinor, "4503599627370496"); assert.equal(maximumBody.alerted, 3);
    assert.deepEqual(await (await POST(request())).json(), { ...maximumBody, alerted: 0 });
    await db.update(budget).set({ varianceThresholdPct: 101 }).where(eq(budget.id, maximum.id)); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.update(budget).set({ varianceThresholdPct: 50 }).where(eq(budget.id, maximum.id));
    await db.execute(sql`update ${journalLine} set debit_amount=9007199254740992 where journal_entry_id=${activity.id}`); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await db.execute(sql`update ${journalLine} set debit_amount=0, credit_amount=9007199254740992 where journal_entry_id=${activity.id}`); await expectFailure(422, "LEGACY_NUMERIC_RANGE");
    await stop(maximum.id);

    // A failure on the second recipient rolls back the first row and never queues email.
    const atomic = await create(1, 0);
    await db.execute(sql.raw("create function fail_alert() returns trigger language plpgsql as $$ begin if exists(select 1 from notification where organization_id=NEW.organization_id and entity_id=NEW.entity_id and type='budget_exceeded') then raise exception 'synthetic alert failure'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger fail_alert before insert on notification for each row execute function fail_alert()"));
    const beforeRollback = await snapshot(); assert.equal((await POST(request())).status, 500); assert.deepEqual(await snapshot(), beforeRollback);
    await db.execute(sql.raw("drop trigger fail_alert on notification; drop function fail_alert()"));
    const concurrent = await Promise.all([POST(request()), ma.call(), checkBudgetAlerts(ctx, {})]);
    const counts = [(await concurrent[0].json()).alerted, concurrent[1].body.alerted, concurrent[2].alerted];
    assert.equal(counts.reduce((sum, n) => sum + n, 0), 3); assert.equal((await ma.call()).body.alerted, 0);
    await stop(atomic.id);
    // Delivery failure happens after commit: counts and in-app deduplication remain accurate.
    const delivery = await create(1, 0);
    const queued = (await db.select().from(notificationDigestQueue)).length;
    await db.execute(sql.raw("create function fail_digest() returns trigger language plpgsql as $$ begin raise exception 'synthetic digest failure'; end $$"));
    await db.execute(sql.raw("create trigger fail_digest before insert on notification_digest_queue for each row execute function fail_digest()"));
    assert.equal((await ma.call()).body.alerted, 3);
    assert.equal((await db.select().from(notificationDigestQueue)).length, queued);
    assert.equal((await ma.call()).body.alerted, 0);
    await db.execute(sql.raw("drop trigger fail_digest on notification_digest_queue; drop function fail_digest()"));
    await stop(delivery.id);
    // Internal scheduler retains its legacy counts and includes the other organization.
    await create("1", 0, true); await entry(0, 1, today, "posted", b.id, false, foreign.id);
    assert.deepEqual(await checkBudgetVariances(), { checked: 1, alerted: 1 });
    assert.deepEqual(await checkBudgetVariances(), { checked: 1, alerted: 0 });
    assert.deepEqual((await ma.call()).body, { checked: 0, alerted: 0, evaluations: [] });
    assert.equal((await mb.call()).body.evaluations[0].actualMinor, "1");
    // Generic callers of sendNotification still receive the committed in-app row.
    const generic = await sendNotification({ orgId: a.id, userId: owner.id, type: "system_alert", title: "Synthetic" });
    assert.equal(generic.title, "Synthetic"); assert.ok(generic.id);
    await assert.rejects(checkBudgetAlerts(ctx, {}, new Date(NaN)), /clock/);
    console.log("REST and MCP budget alerts verified");
  } finally { await ma.close(); await mb.close(); await denied.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
