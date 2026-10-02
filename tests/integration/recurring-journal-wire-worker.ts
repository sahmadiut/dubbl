// Parent test creates and drops a randomly named migrated fixture database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, costCenter, recurringTemplate, recurringTemplateLine,
  journalEntry, journalLine, periodLock, fiscalYear } from "../../lib/db/schema";
import { POST as create, GET as list } from "../../app/api/v1/recurring-journals/route";
import { GET as get, PATCH as patch, DELETE as remove } from "../../app/api/v1/recurring-journals/[id]/route";
import { POST as pause } from "../../app/api/v1/recurring-journals/[id]/pause/route";
import { POST as runNow } from "../../app/api/v1/recurring-journals/run/route";
import { processRecurringJournals, processRecurringTemplates, processRecurringJournalsMaintenance } from "../../lib/api/recurring-generate";
import { registerRecurringJournalTools } from "../../lib/mcp/tools/recurring-journals";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Recurring fixture", version: "1.0.0" });
  registerRecurringJournalTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 8);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_recurring_journal")!.inputSchema).includes("debitAmountMinor"));
  assert.ok(tools.some(tool => tool.name === "update_recurring_journal"));
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async close() { await client.close(); await server.close(); },
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Recurring A", slug: "recurring-a" }, { name: "Recurring B", slug: "recurring-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "recurring-owner@example.test" }, { email: "recurring-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No writes", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_recurring_a", b: "dk_recurring_b", viewer: "dk_recurring_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_recurring" });
  const [account, foreign, inactive] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "A", code: "100", type: "asset" },
    { organizationId: b.id, name: "B", code: "100", type: "asset" }, { organizationId: a.id, name: "Inactive", code: "200", type: "asset", isActive: false }]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, name: "A", code: "A" }, { organizationId: b.id, name: "B", code: "B" }]).returning();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const request = (body?: unknown, key = keys.a, method = "POST") => new Request("http://fixture.test/api/v1/recurring-journals", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const legs = (amount: number | string = 1250, accountId = account.id, costCenterId: string | null = center.id) => [
    { description: "DR", accountId, costCenterId, ...(typeof amount === "number" ? { debitAmount: amount } : { debitAmountMinor: amount }) },
    { description: "CR", accountId, costCenterId, ...(typeof amount === "number" ? { creditAmount: amount } : { creditAmountMinor: amount }) },
  ];
  const body = (amount: number | string = 1250, extra: Record<string, unknown> = {}) => ({ name: "Fixture", frequency: "weekly",
    startDate: today, maxOccurrences: 1, currencyCode: "USD", lines: legs(amount), ...extra });
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from recurring_template t) as templates,
    (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('debit_amount',l.debit_amount::text,'credit_amount',l.credit_amount::text) order by l.id),'[]'::jsonb) from recurring_template_line l) as legs,
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from journal_entry e) as entries,
    (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('debit_amount',l.debit_amount::text,'credit_amount',l.credit_amount::text,'rate_exact',l.rate_exact::text) order by l.id),'[]'::jsonb) from journal_line l) as lines,
    (select count(*)::text from audit_log) as audits`)).rows;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), denied = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await mcp({ ...ctx, role: "member", permissions: ["manage:recurring"] });
  const made: string[] = [];
  const make = async (input = body(), key = keys.a) => {
    const res = await create(request(input, key)); assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
    const row = (await res.json()).template; made.push(row.id); return row;
  };
  const journalRows = async (id: string) => db.query.journalEntry.findMany({ where: eq(journalEntry.sourceId, id), with: { lines: {
    columns: { rateExact: false }, extras: { rateExact: sql<string>`${journalLine.rateExact}::text`.as("rate_text") },
  } } });
  try {
    // Actual legacy/exact/dual clients, every currency scale and safe boundary.
    for (const amount of [1250, "2147483648", String(Number.MAX_SAFE_INTEGER)]) for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      const input = body(amount, { currencyCode, rateExact: "1.000000", exchangeRate: 1000000, rateDirection: "quote_per_base" });
      const created = await make(input);
      const detail = await get(request(undefined, keys.a, "GET"), params(created.id)); assert.equal(detail.status, 200);
      const dto = (await detail.json()).template; assert.equal(dto.organizationId, a.id); assert.equal(dto.rateExact, "1");
      assert.equal(dto.lines[0].debitAmount, Number(amount)); assert.equal(dto.lines[0].debitAmountMinor, String(amount));
      assert.equal(dto.lines[0].currencyCode, currencyCode);
      const m = await ma.call("create_recurring_journal", input); assert.equal(m.isError, false); made.push(m.body.template.id);
      const read = await ma.call("get_recurring_journal", { templateId: m.body.template.id }); assert.equal(read.isError, false);
      assert.equal(read.body.template.lines[0].debitAmountMinor, String(amount));
    }
    const dual = body(1250); dual.lines[0] = { ...dual.lines[0], debitAmountMinor: "1250" };
    const editable = await make(dual);
    // Partial headers retain saved currency; full replacement rolls into the next generation.
    const replacement = legs("2147483648");
    assert.equal((await patch(request({ lines: replacement, notes: "Updated", currencyCode: "IRR" }), params(editable.id))).status, 200);
    assert.equal((await ma.call("update_recurring_journal", { templateId: editable.id, reference: "Synthetic", rateExact: "1" })).isError, false);
    const detail = (await (await get(request(undefined, keys.a, "GET"), params(editable.id))).json()).template;
    assert.equal(detail.currencyCode, "IRR"); assert.equal(detail.notes, "Updated"); assert.equal(detail.lines[0].debitAmountMinor, "2147483648");
    assert.equal((await list(request(undefined, keys.a, "GET"))).status, 200);
    assert.equal((await ma.call("list_recurring_journals")).isError, false);
    // Bad bodies, aliases, sums, dates and cross-tenant dimensions mutate nothing.
    const invalid = [body("9007199254740992"), body("9223372036854775808"), body("01"), body(-1), body(1.1), body(1250, { rateExact: "2" }),
      body(1250, { rateExact: "0.0000001" }), body(1250, { exchangeRate: 2000000, rateExact: "1" }), body(1250, { currencyCode: "INVALID" }),
      body(1250, { startDate: "2026-02-29" }), body(1250, { startDate: today, endDate: yesterday }), body(1250, { maxOccurrences: 2147483648 }),
      body(1250, { lines: legs(1250, foreign.id) }), body(1250, { lines: legs(1250, inactive.id) }), body(1250, { lines: legs(1250, account.id, foreignCenter.id) }),
      body(1250, { lines: [{ ...legs()[0], debitAmountMinor: "1" }, legs()[1]] }),
      body(1250, { lines: [{ ...legs()[0], projectId: account.id }, legs()[1]] }),
      body(1250, { lines: [...legs(Number.MAX_SAFE_INTEGER), ...legs(1)] }), body(1250, { lines: [{ ...legs()[0], creditAmount: 1250 }, legs()[1]] }),
      body(1250, { lines: [{ ...legs()[0], debitAmount: 2 }, { ...legs()[1], creditAmount: 1 }] }),
    ];
    for (const input of invalid) {
      const before = await snapshot();
      assert.ok([400, 422].includes((await create(request(input))).status));
      assert.equal((await ma.call("create_recurring_journal", input)).isError, true);
      // startDate is immutable on PATCH and has no MCP update field.
      if (input.startDate !== today) { assert.deepEqual(await snapshot(), before); continue; }
      const { startDate: omitted, ...update } = input; void omitted;
      assert.ok([400, 422].includes((await patch(request(update), params(editable.id))).status));
      assert.equal((await ma.call("update_recurring_journal", { templateId: editable.id, ...update })).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    const foreignTemplate = await make(body(1250, { lines: legs(1250, foreign.id, null) }), keys.b);
    for (const [id, key, client] of [[editable.id, keys.b, mb], [foreignTemplate.id, keys.a, ma]] as const) {
      const before = await snapshot();
      assert.equal((await get(request(undefined, key, "GET"), params(id))).status, 404);
      assert.equal((await patch(request({ notes: "No" }, key), params(id))).status, 404);
      assert.equal((await pause(request(undefined, key), params(id))).status, 404);
      assert.equal((await remove(request(undefined, key), params(id))).status, 404);
      for (const name of ["get_recurring_journal", "update_recurring_journal", "pause_recurring_journal", "set_recurring_journal_status", "delete_recurring_journal"]) {
        assert.equal((await client.call(name, { templateId: id, notes: "No", status: "paused" })).isError, true);
      }
      assert.deepEqual(await snapshot(), before);
    }
    {
      const before = await snapshot();
      assert.equal((await create(request(body(), keys.viewer))).status, 403);
      assert.equal((await patch(request({ notes: "No" }, keys.viewer), params(editable.id))).status, 403);
      assert.equal((await pause(request(undefined, keys.viewer), params(editable.id))).status, 403);
      assert.equal((await remove(request(undefined, keys.viewer), params(editable.id))).status, 403);
      assert.equal((await runNow(request(undefined, keys.viewer))).status, 403);
      assert.equal((await list(request(undefined, "dk_invalid", "GET"))).status, 401);
      for (const name of ["create_recurring_journal", "update_recurring_journal", "pause_recurring_journal", "set_recurring_journal_status", "delete_recurring_journal", "run_recurring_journals"]) {
        assert.equal((await denied.call(name, { ...body(), templateId: editable.id, status: "paused" })).body.status, 403);
      }
      assert.equal((await denied.call("get_recurring_journal", { templateId: editable.id })).isError, false);
      assert.deepEqual(await snapshot(), before);
    }
    // SQL errors after parent writes and after deleting old legs must roll back every row.
    await db.execute(sql`CREATE FUNCTION fail_recurring_leg() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description = 'FAIL' THEN RAISE EXCEPTION 'synthetic recurring failure'; END IF; RETURN NEW; END $$`);
    await db.execute(sql`CREATE TRIGGER fail_recurring_leg BEFORE INSERT ON recurring_template_line FOR EACH ROW EXECUTE FUNCTION fail_recurring_leg()`);
    const badLegs = legs(); badLegs[0].description = "FAIL";
    {
      const before = await snapshot();
      assert.equal((await create(request(body(1250, { lines: badLegs })))).status, 500);
      assert.equal((await ma.call("create_recurring_journal", body(1250, { lines: badLegs }))).isError, true);
      assert.equal((await patch(request({ notes: "Rollback", lines: badLegs }), params(editable.id))).status, 500);
      assert.equal((await ma.call("update_recurring_journal", { templateId: editable.id, lines: badLegs, notes: "Rollback" })).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`DROP TRIGGER fail_recurring_leg ON recurring_template_line`);
    await db.execute(sql`DROP FUNCTION fail_recurring_leg()`);
    // Pause/resume retains date, soft-delete excludes scheduling; completed toggles reject.
    assert.equal((await pause(request(), params(editable.id))).status, 200);
    assert.equal((await ma.call("pause_recurring_journal", { templateId: editable.id })).isError, false);
    assert.equal((await ma.call("set_recurring_journal_status", { templateId: editable.id, status: "paused" })).isError, false);
    assert.equal((await pause(request(), params(editable.id))).status, 200);
    const deleted = await make(); assert.equal((await remove(request(), params(deleted.id))).status, 200);
    const deletedM = await ma.call("create_recurring_journal", body());
    assert.equal((await ma.call("delete_recurring_journal", { templateId: deletedM.body.template.id })).isError, false);
    assert.equal((await get(request(undefined, keys.a, "GET"), params(deleted.id))).status, 404);
    const total = made.length - 2; // Exclude the deleted REST template and foreign-org template.
    const result = await runNow(request()); assert.equal(result.status, 200);
    assert.equal((await result.json()).posted, total);
    for (const id of made.filter(id => id !== deleted.id && id !== foreignTemplate.id)) {
      const entries = await journalRows(id); assert.equal(entries.length, 1); assert.equal(entries[0].status, "posted");
      const tmpl = await db.query.recurringTemplate.findFirst({ where: eq(recurringTemplate.id, id) });
      assert.equal(tmpl!.status, "completed"); assert.equal(tmpl!.occurrencesGenerated, 1);
      for (const line of entries[0].lines) {
        assert.equal(line.currencyCode, tmpl!.currencyCode); assert.equal(line.exchangeRate, 1000000);
        assert.match(line.rateExact!, /^1\.0+$/); assert.equal(line.rateMigrationStatus, "exact"); assert.equal(line.costCenterId, center.id);
      }
    }
    assert.equal((await journalRows(foreignTemplate.id)).length, 0);
    assert.equal((await journalRows(deleted.id)).length, 0);
    assert.equal((await ma.call("run_recurring_journals")).body.posted, 0);
    assert.equal((await pause(request(), params(editable.id))).status, 400);
    assert.equal((await ma.call("pause_recurring_journal", { templateId: editable.id })).body.status, 400);
    assert.equal((await mb.call("run_recurring_journals")).body.posted, 1);
    // Resume catches up from saved nextRunDate; concurrent runs do not duplicate a template.
    const catchup = await make(body(1250, { startDate: "2026-09-01", frequency: "weekly", maxOccurrences: 3 }));
    assert.equal((await ma.call("set_recurring_journal_status", { templateId: catchup.id, status: "paused" })).isError, false);
    assert.equal((await managed.call("run_recurring_journals")).body.posted, 0);
    assert.equal((await pause(request(), params(catchup.id))).status, 200);
    const concurrent = await Promise.all([processRecurringJournals(a.id), processRecurringJournals(a.id)]);
    assert.equal(concurrent.reduce((sum, value) => sum + value, 0), 3); assert.equal((await journalRows(catchup.id)).length, 3);
    // Existing policy consumes locked/closed occurrences without writing journals.
    const locked = await make();
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: today });
    assert.equal(await processRecurringJournals(a.id), 0); assert.equal((await journalRows(locked.id)).length, 0);
    assert.equal((await db.query.recurringTemplate.findFirst({ where: eq(recurringTemplate.id, locked.id) }))!.occurrencesGenerated, 1);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const closed = await make();
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed synthetic", startDate: today, endDate: today, isClosed: true });
    assert.equal(await processRecurringJournals(a.id), 0); assert.equal((await journalRows(closed.id)).length, 0);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    // Generation failure after entries/legs are written and before schedule commits rolls back catch-up.
    const rollback = await make(body("2147483648", { startDate: "2026-09-01", maxOccurrences: 3 }));
    await db.execute(sql`CREATE FUNCTION fail_recurring_schedule() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.occurrences_generated > OLD.occurrences_generated THEN RAISE EXCEPTION 'synthetic schedule failure'; END IF; RETURN NEW; END $$`);
    await db.execute(sql`CREATE TRIGGER fail_recurring_schedule BEFORE UPDATE ON recurring_template FOR EACH ROW EXECUTE FUNCTION fail_recurring_schedule()`);
    {
      const before = await snapshot(); assert.equal((await runNow(request())).status, 500);
      assert.equal((await ma.call("run_recurring_journals")).isError, true); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`DROP TRIGGER fail_recurring_schedule ON recurring_template`);
    await db.execute(sql`DROP FUNCTION fail_recurring_schedule()`);
    assert.equal(await processRecurringTemplates(a.id, { types: ["journal"] }), 3); assert.equal((await journalRows(rollback.id)).length, 3);
    // Corrupt retained history: generation never filters bad legs or consumes unsupported schedules.
    for (const change of [{ debitAmount: Number.MAX_SAFE_INTEGER, creditAmount: 1 }, { accountId: foreign.id }, { accountId: inactive.id }, { costCenterId: foreignCenter.id }]) {
      const malformed = await make();
      const [first] = await db.select().from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, malformed.id));
      await db.update(recurringTemplateLine).set(change).where(eq(recurringTemplateLine.id, first.id));
      const before = await snapshot(); assert.ok([400, 422].includes((await runNow(request())).status));
      assert.equal((await ma.call("run_recurring_journals")).isError, true); assert.deepEqual(await snapshot(), before);
      await remove(request(), params(malformed.id));
    }
    // Unsafe stored rows classify read failures, while cross-org historical FKs never leak.
    const summed = await make();
    await db.delete(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, summed.id));
    await db.insert(recurringTemplateLine).values([...legs(Number.MAX_SAFE_INTEGER), ...legs(1)].map((line, sortOrder) => ({
      templateId: summed.id, description: line.description, accountId: line.accountId, costCenterId: line.costCenterId,
      debitAmount: "debitAmount" in line ? line.debitAmount : 0, creditAmount: "creditAmount" in line ? line.creditAmount : 0, sortOrder,
    })));
    {
      const before = await snapshot();
      assert.equal((await get(request(undefined, keys.a, "GET"), params(summed.id))).status, 422);
      assert.equal((await ma.call("get_recurring_journal", { templateId: summed.id })).body.status, 422);
      assert.equal((await runNow(request())).status, 422); assert.equal((await ma.call("run_recurring_journals")).body.status, 422);
      assert.deepEqual(await snapshot(), before);
    }
    await remove(request(), params(summed.id));
    const corrupt = await make();
    await db.execute(sql`UPDATE recurring_template_line SET debit_amount = 9007199254740992 WHERE template_id = ${corrupt.id} AND debit_amount > 0`);
    assert.equal((await get(request(undefined, keys.a, "GET"), params(corrupt.id))).status, 422);
    assert.equal((await ma.call("get_recurring_journal", { templateId: corrupt.id })).body.status, 422);
    {
      const before = await snapshot();
      assert.equal((await runNow(request())).status, 422); assert.equal((await ma.call("run_recurring_journals")).body.status, 422);
      assert.deepEqual(await snapshot(), before);
    }
    await remove(request(), params(corrupt.id));
    const scopeCorrupt = await make();
    await db.update(recurringTemplateLine).set({ accountId: foreign.id }).where(eq(recurringTemplateLine.templateId, scopeCorrupt.id));
    assert.equal((await get(request(undefined, keys.a, "GET"), params(scopeCorrupt.id))).status, 400);
    assert.equal((await ma.call("list_recurring_journals")).isError, true);
    await remove(request(), params(scopeCorrupt.id));
    // Cross-org maintenance reuses the guarded generator and excludes deleted templates.
    const maintenance = await make(body(1250, { lines: legs(1250, foreign.id, null) }), keys.b);
    assert.equal((await processRecurringJournalsMaintenance()).journalsPosted, 1); assert.equal((await journalRows(maintenance.id)).length, 1);
    const retained = await journalRows(editable.id);
    assert.equal((await remove(request(), params(editable.id))).status, 200);
    assert.deepEqual(await journalRows(editable.id), retained);
    const remaining = await ma.call("list_recurring_journals"); assert.equal(remaining.isError, false);
    assert.ok(remaining.body.templates.every((template: { organizationId: string }) => template.organizationId === a.id));
    assert.equal((await mb.call("get_recurring_journal", { templateId: editable.id })).isError, true);
    assert.equal((await db.select().from(journalEntry).where(and(eq(journalEntry.organizationId, a.id), eq(journalEntry.sourceType, "recurring_journal")))).length > 0, true);
    console.log("REST and MCP recurring journals verified");
  } finally { await ma.close(); await mb.close(); await denied.close(); await managed.close(); }
}

run().then(() => process.exit(0), err => { console.error(err); process.exit(1); });
