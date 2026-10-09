// Invoked only against the randomly named migrated database created by the parent fixture.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, costCenter, project, fiscalYear,
  journalEntry, journalLine, periodLock } from "../../lib/db/schema";
import { POST as create } from "../../app/api/v1/entries/route";
import { POST as post } from "../../app/api/v1/entries/[id]/post/route";
import { POST as voidEntry } from "../../app/api/v1/entries/[id]/void/route";
import { POST as recode } from "../../app/api/v1/entries/recode/route";
import { POST as preview } from "../../app/api/v1/bulk/entries/preview/route";
import { POST as importEntries } from "../../app/api/v1/bulk/entries/import/route";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import { registerImportExportTools } from "../../lib/mcp/tools/import-export";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Lifecycle fixture", version: "1.0.0" });
  registerEntryTools(server, ctx); registerImportExportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const listed = (await client.listTools()).tools;
  assert.ok(listed.some(tool => tool.name === "preview_journal_entries"));
  assert.ok(JSON.stringify(listed.find(tool => tool.name === "import_journal_entries")!.inputSchema).includes("debitAmountMinor"));
  return {
    async call(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async close() { await client.close(); await server.close(); },
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Lifecycle A", slug: "lifecycle-a" }, { name: "Lifecycle B", slug: "lifecycle-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "lifecycle-owner@example.test" }, { email: "lifecycle-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No writes", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_lifecycle_a", b: "dk_lifecycle_b", viewer: "dk_lifecycle_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_lifecycle" });
  const [account, target, foreignAccount, inactive] = await db.insert(chartAccount).values([
    { organizationId: a.id, name: "Cash", code: "100", type: "asset" }, { organizationId: a.id, name: "Target", code: "200", type: "asset" },
    { organizationId: b.id, name: "Foreign", code: "300", type: "asset" }, { organizationId: a.id, name: "Inactive", code: "400", type: "asset", isActive: false },
  ]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, name: "A", code: "A" }, { organizationId: b.id, name: "B", code: "B" }]).returning();
  const [job, foreignJob] = await db.insert(project).values([{ organizationId: a.id, name: "A" }, { organizationId: b.id, name: "B" }]).returning();
  const request = (body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/entries", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from journal_entry e) as entries,
    (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('debit_amount',l.debit_amount::text,'credit_amount',l.credit_amount::text,'rate_exact',l.rate_exact::text) order by l.id),'[]'::jsonb) from journal_line l) as lines,
    (select coalesce(jsonb_agg(to_jsonb(j) order by j.id),'[]'::jsonb) from bulk_import_job j) as jobs,
    (select count(*)::text from audit_log) as audits`)).rows;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), denied = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const importOnly = await mcp({ ...ctx, role: "member", permissions: ["manage:entries"] });
  const make = async (amount: number | string = 1250, extra: Record<string, unknown> = {}, key = keys.a) => {
    const amounts = typeof amount === "number" ? [{ debitAmount: amount }, { creditAmount: amount }] : [{ debitAmountMinor: amount }, { creditAmountMinor: amount }];
    const res = await create(request({ date: "2026-10-02", description: "Lifecycle", lines: amounts.map(amount => ({ accountId: key === keys.b ? foreignAccount.id : account.id, ...amount, ...extra })) }, key));
    assert.equal(res.status, 201); return (await res.json()).entry;
  };
  const importRows = (rest = false, exact = false, code = "100", amount = "1250") => [
    { date: "2026-10-02", description: "Imported", lineAccountCode: code, ...(exact ? { debitAmountMinor: amount } : { debit: rest ? "12.50" : 1250 }) },
    { date: "2026-10-02", description: "Imported", lineAccountCode: code, ...(exact ? { creditAmountMinor: amount } : { credit: rest ? "12.50" : 1250 }) },
  ];
  try {
    // Both transports post/void legacy and exact-created entries, preserving stored money/rates/dimensions.
    for (const amount of [1250, "2147483648", String(Number.MAX_SAFE_INTEGER)]) {
      const entry = await make(amount, { rateExact: "1", currencyCode: "IRR", costCenterId: center.id, projectId: job.id });
      const posted = await post(request(), params(entry.id)); assert.equal(posted.status, 200);
      const detail = (await posted.json()).entry;
      assert.equal(detail.lines[0].debitAmountMinor, String(amount)); assert.equal(detail.lines[0].rateExact, "1");
      assert.equal(detail.lines[0].debitAmount, amount === 1250 ? "12.50" : amount === "2147483648" ? "21474836.48" : "90071992547409.91");
      const result = await voidEntry(request({ reason: "Fixture" }), params(entry.id)); assert.equal(result.status, 200);
      const original = (await result.json()).entry;
      assert.equal(original.status, "posted"); assert.ok(original.reversedByEntryId);
      const mirror = await db.query.journalLine.findMany({ where: eq(journalLine.journalEntryId, original.reversedByEntryId), columns: { rateExact: false }, extras: { rateExact: sql<string>`${journalLine.rateExact}::text`.as("rate_text") } });
      assert.equal(mirror[0].creditAmount, Number(amount)); assert.equal(mirror[0].currencyCode, "IRR");
      assert.equal(mirror[0].costCenterId, center.id); assert.equal(mirror[0].projectId, job.id); assert.match(mirror[0].rateExact, /^1\.0+$/);
      const before = await snapshot(); assert.equal((await voidEntry(request({ reason: "Again" }), params(entry.id))).status, 400); assert.deepEqual(await snapshot(), before);
      const m = await make(amount, { rateExact: "0.000001" });
      assert.equal((await ma.call("post_entry", { entryId: m.id })).isError, false);
      const v = await ma.call("void_entry", { entryId: m.id, reason: "Fixture" }); assert.equal(v.isError, false);
      const saved = await db.query.journalLine.findMany({ where: eq(journalLine.journalEntryId, v.body.reversalEntry.id) });
      assert.equal(saved[0].exchangeRate, 1); assert.equal(saved[0].creditAmount, Number(amount)); // No FX product/conversion at reversal.
    }
    const draft = await make(), foreign = await make(1250, {}, keys.b);
    // Mirroring existing history keeps same-org inactive accounts available for reversal.
    const inactiveHistory = await make();
    await db.update(journalEntry).set({ status: "posted" }).where(eq(journalEntry.id, inactiveHistory.id));
    await db.update(journalLine).set({ accountId: inactive.id }).where(eq(journalLine.journalEntryId, inactiveHistory.id));
    assert.equal((await ma.call("void_entry", { entryId: inactiveHistory.id, reason: "Historical inactive account" })).isError, false);
    // All lifecycle writes enforce org/permissions, and failures leave financial and job state unchanged.
    for (const entry of [draft, foreign]) {
      const key = entry.id === draft.id ? keys.b : keys.a, client = entry.id === draft.id ? mb : ma;
      const before = await snapshot();
      assert.equal((await post(request(undefined, key), params(entry.id))).status, 404);
      assert.equal((await voidEntry(request({ reason: "No" }, key), params(entry.id))).status, 404);
      for (const name of ["post_entry", "void_entry", "set_auto_reverse_date"]) assert.equal((await client.call(name, { entryId: entry.id, reason: "No", autoReverseDate: "2026-10-03" })).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    let before = await snapshot();
    assert.equal((await post(request(undefined, keys.viewer), params(draft.id))).status, 403);
    assert.equal((await voidEntry(request({ reason: "No" }, keys.viewer), params(draft.id))).status, 403);
    assert.equal((await recode(request({ filter: { sourceType: "manual" }, target: { accountId: target.id } }, keys.viewer))).status, 403);
    for (const name of ["post_entry", "void_entry", "set_auto_reverse_date", "recode_entries", "import_journal_entries"]) {
      // Import now rejects unknown controls at SDK validation; send its actual
      // valid schema here so this assertion specifically exercises permission.
      const input = name === "import_journal_entries" ? { rows: importRows() } : { entryId: draft.id, reason: "No", autoReverseDate: null,
        filter: { sourceType: "manual" }, target: { accountId: target.id }, rows: importRows() };
      assert.equal((await denied.call(name, input)).body.status, 403);
    }
    assert.deepEqual(await snapshot(), before);
    before = await snapshot();
    assert.equal((await post(request(undefined, "dk_invalid"), params(draft.id))).status, 401);
    assert.equal((await importEntries(request({}, "dk_invalid"))).status, 401);
    assert.equal((await voidEntry(request({ reason: "" }), params(draft.id))).status, 400);
    assert.equal((await ma.call("void_entry", { entryId: draft.id, reason: "" })).isError, true);
    assert.deepEqual(await snapshot(), before);
    // MCP scheduling checks date validity/order, old and target locks; clear preserves monetary legs.
    assert.equal((await ma.call("set_auto_reverse_date", { entryId: draft.id, autoReverseDate: "2026-10-03" })).isError, false);
    assert.equal((await ma.call("set_auto_reverse_date", { entryId: draft.id, autoReverseDate: null })).isError, false);
    before = await snapshot();
    for (const date of ["2026-02-30", "2026-10-01"]) assert.equal((await ma.call("set_auto_reverse_date", { entryId: draft.id, autoReverseDate: date })).isError, true);
    assert.deepEqual(await snapshot(), before);
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-02", lockedBy: owner.id }).returning();
    before = await snapshot();
    assert.equal((await post(request(), params(draft.id))).status, 422);
    assert.equal((await ma.call("post_entry", { entryId: draft.id })).body.status, 422);
    assert.equal((await ma.call("set_auto_reverse_date", { entryId: draft.id, autoReverseDate: null })).body.status, 422);
    assert.equal((await recode(request({ filter: { accountId: account.id }, target: { accountId: target.id } }))).status, 422);
    assert.equal((await ma.call("recode_entries", { filter: { accountId: account.id }, target: { accountId: target.id } })).body.status, 422);
    assert.deepEqual(await snapshot(), before);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed future", startDate: "2026-11-01", endDate: "2026-11-30", isClosed: true }).returning();
    before = await snapshot(); assert.equal((await ma.call("set_auto_reverse_date", { entryId: draft.id, autoReverseDate: "2026-11-02" })).body.status, 422); assert.deepEqual(await snapshot(), before);
    await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    const [closedOriginal] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed original", startDate: "2026-10-01", endDate: "2026-10-31", isClosed: true }).returning();
    before = await snapshot();
    assert.equal((await post(request(), params(draft.id))).status, 422);
    assert.equal((await ma.call("post_entry", { entryId: draft.id })).body.status, 422);
    assert.deepEqual(await snapshot(), before);
    await db.delete(fiscalYear).where(eq(fiscalYear.id, closedOriginal.id));
    // Recode rejects foreign/inactive targets (including empty selections), validates dates, defaults drafts and clears dimensions.
    for (const bad of [{ accountId: foreignAccount.id }, { accountId: inactive.id }, { costCenterId: foreignCenter.id }, { projectId: foreignJob.id }]) {
      before = await snapshot();
      for (const filter of [{ accountId: account.id }, { sourceType: "no-match" }]) {
        assert.equal((await recode(request({ filter, target: bad }))).status, 400);
        assert.equal((await ma.call("recode_entries", { filter, target: bad })).isError, true);
      }
      assert.deepEqual(await snapshot(), before);
    }
    before = await snapshot();
    for (const filter of [{}, { startDate: "2026-10-03", endDate: "2026-10-02" }, { startDate: "2026-02-30" }]) {
      assert.equal((await recode(request({ filter, target: { accountId: target.id } }))).status, 400);
      assert.equal((await ma.call("recode_entries", { filter, target: { accountId: target.id } })).isError, true);
    }
    assert.deepEqual(await snapshot(), before);
    const oldLegs = await db.query.journalLine.findMany({ where: eq(journalLine.journalEntryId, draft.id) });
    const changed = await recode(request({ filter: { accountId: account.id }, target: { accountId: target.id, costCenterId: center.id, projectId: job.id } }));
    assert.equal(changed.status, 200); assert.equal((await changed.json()).recoded, 2);
    const newLegs = await db.query.journalLine.findMany({ where: eq(journalLine.journalEntryId, draft.id) });
    assert.equal(newLegs[0].debitAmount, oldLegs[0].debitAmount); assert.equal(newLegs[0].exchangeRate, oldLegs[0].exchangeRate);
    assert.equal((await ma.call("recode_entries", { filter: { accountId: target.id }, target: { costCenterId: null, projectId: null } })).body.recoded, 2);
    // Already-posted/base-converted amounts are retained; explicit opt-in recodes them.
    assert.equal((await ma.call("recode_entries", { filter: { accountId: account.id }, target: { projectId: job.id }, draftOnly: false })).isError, false);
    // No response-range failure can commit an unsafe historical post/void.
    const huge = await make();
    await db.execute(sql`update journal_line set debit_amount = 9007199254740992 where journal_entry_id = ${huge.id} and debit_amount > 0`);
    before = await snapshot(); assert.equal((await post(request(), params(huge.id))).status, 422);
    assert.equal((await ma.call("post_entry", { entryId: huge.id })).body.status, 422); assert.deepEqual(await snapshot(), before);
    await db.delete(journalEntry).where(eq(journalEntry.id, huge.id));
    const overflowing = await make();
    const extra = await db.query.journalLine.findFirst({ where: eq(journalLine.journalEntryId, overflowing.id) });
    await db.insert(journalLine).values({ journalEntryId: overflowing.id, accountId: account.id, debitAmount: Number.MAX_SAFE_INTEGER });
    before = await snapshot(); assert.equal((await post(request(), params(overflowing.id))).status, 422);
    assert.equal((await ma.call("post_entry", { entryId: overflowing.id })).body.status, 422); assert.deepEqual(await snapshot(), before);
    await db.delete(journalEntry).where(eq(journalEntry.id, overflowing.id));
    assert.ok(extra);
    // Cross-tenant legacy FKs and unqualified FX history are never exposed or repaired by lifecycle writes.
    const corrupt = await make();
    await db.update(journalLine).set({ accountId: foreignAccount.id }).where(eq(journalLine.journalEntryId, corrupt.id));
    before = await snapshot(); assert.equal((await post(request(), params(corrupt.id))).status, 422);
    assert.equal((await ma.call("post_entry", { entryId: corrupt.id })).body.status, 422); assert.deepEqual(await snapshot(), before);
    await db.delete(journalEntry).where(eq(journalEntry.id, corrupt.id));
    const pending = await make();
    await db.update(journalEntry).set({ status: "posted" }).where(eq(journalEntry.id, pending.id));
    await db.transaction(async tx => {
      await tx.execute(sql`ALTER TABLE journal_line DISABLE TRIGGER journal_line_exact_sync`);
      await tx.execute(sql`ALTER TABLE journal_line DISABLE TRIGGER journal_line_exact_input_guard`);
      await tx.execute(sql`UPDATE journal_line SET rate_exact = null, rate_migration_status = 'pending' WHERE journal_entry_id = ${pending.id}`);
      await tx.execute(sql`ALTER TABLE journal_line ENABLE TRIGGER journal_line_exact_sync`);
      await tx.execute(sql`ALTER TABLE journal_line ENABLE TRIGGER journal_line_exact_input_guard`);
    });
    before = await snapshot();
    assert.equal((await voidEntry(request({ reason: "No guessed FX" }), params(pending.id))).status, 422);
    assert.equal((await ma.call("void_entry", { entryId: pending.id, reason: "No guessed FX" })).body.status, 422);
    assert.equal((await recode(request({ filter: { accountId: account.id }, target: { accountId: target.id }, draftOnly: false }))).status, 422);
    assert.deepEqual(await snapshot(), before);
    await db.delete(journalEntry).where(eq(journalEntry.id, pending.id));
    // Import preview and writes qualify each legacy unit contract, exact and dual clients at safe edges.
    for (const exact of [false, true]) {
      for (const transport of ["rest", "mcp"]) {
        const rest = transport === "rest", rows = importRows(rest, exact);
        const p = rest ? await (await preview(request({ rows, source: "xero" }))).json() : (await ma.call("preview_journal_entries", { rows })).body;
        assert.equal(p.entries[0].totalDebit, 1250); assert.equal(p.entries[0].totalDebitMinor, "1250"); assert.equal(p.balancedEntryCount, 1);
        const result = rest ? await (await importEntries(request({ fileName: "fixture.csv", rows }))).json() : (await ma.call("import_journal_entries", { rows })).body;
        assert.equal(rest ? result.job.processedRows : result.processedEntries, 1);
      }
    }
    const exactMax = importRows(false, true, "100", String(Number.MAX_SAFE_INTEGER));
    assert.equal((await ma.call("import_journal_entries", { rows: exactMax, post: true })).body.processedEntries, 1);
    assert.equal((await importEntries(request({ rows: exactMax, fileName: "exact-max.csv", post: true }))).status, 201);
    const dual = importRows(false, true).map((row, i) => ({ ...row, ...(i ? { credit: 1250 } : { debit: 1250 }) }));
    assert.equal((await ma.call("import_journal_entries", { rows: dual })).body.processedEntries, 1);
    assert.equal((await importEntries(request({ rows: dual.map((row, i) => ({ ...row, debit: i ? undefined : "12.50", credit: i ? "12.50" : undefined })), fileName: "dual.csv" }))).status, 201);
    // Wire errors are global rejection before job/audit/financial writes.
    for (const bad of ["01", "-1", "1e3", "9007199254740992", "9223372036854775808"]) {
      before = await snapshot();
      const rows = importRows(false, true, "100", bad);
      assert.ok([400, 422].includes((await importEntries(request({ fileName: "bad.csv", rows }))).status));
      assert.equal((await ma.call("import_journal_entries", { rows })).isError, true); assert.deepEqual(await snapshot(), before);
    }
    for (const bad of ["1.005", "junk", "-1", "1e3"]) {
      before = await snapshot(); assert.equal((await importEntries(request({ fileName: "bad.csv", rows: importRows(true).map(row => ({ ...row, debit: bad })) }))).status, 400); assert.deepEqual(await snapshot(), before);
    }
    before = await snapshot();
    const sumOverflow = [...exactMax, { ...exactMax[0], debitAmountMinor: "1" }];
    assert.equal((await importEntries(request({ fileName: "sum.csv", rows: sumOverflow }))).status, 422);
    assert.equal((await ma.call("import_journal_entries", { rows: sumOverflow })).body.status, 422);
    assert.equal((await importEntries(request({ fileName: "denied.csv", rows: importRows(true) }, keys.viewer))).status, 403);
    assert.equal((await importOnly.call("import_journal_entries", { rows: importRows(), post: true })).body.status, 403);
    assert.deepEqual(await snapshot(), before);
    before = await snapshot();
    const conflict = importRows(false, true).map((row, i) => ({ ...row, ...(i ? { credit: 1 } : { debit: 1 }) }));
    assert.equal((await ma.call("import_journal_entries", { rows: conflict })).isError, true);
    assert.equal((await importEntries(request({ fileName: "conflict.csv", rows: conflict }))).status, 400);
    for (const operation of [preview, importEntries]) assert.equal((await operation(request({ fileName: "date.csv", rows: importRows(true).map(row => ({ ...row, date: "2026-02-30" })) }))).status, operation === preview ? 200 : 400);
    assert.deepEqual(await snapshot(), before);
    // Foreign/inactive/wildcard accounts and locked post fail per group; other valid groups commit.
    for (const code of ["300", "400", "%", "10_"]) {
      const result = await ma.call("import_journal_entries", { rows: importRows(false, false, code) });
      assert.equal(result.body.processedEntries, 0); assert.equal(result.body.errorEntries, 1);
    }
    const failedRest = await importEntries(request({ fileName: "foreign.csv", rows: importRows(true, false, "100") }, keys.b));
    assert.equal((await failedRest.json()).job.processedRows, 0);
    const [locked] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-02", lockedBy: owner.id }).returning();
    const lockedPost = await ma.call("import_journal_entries", { rows: importRows(), post: true }); assert.equal(lockedPost.body.processedEntries, 0);
    assert.equal((await ma.call("import_journal_entries", { rows: importRows() })).body.processedEntries, 1); // Draft import retains legacy lock policy.
    const posted = await db.query.journalEntry.findFirst({ where: (entry, { and, eq, isNull }) => and(eq(entry.organizationId, a.id), eq(entry.status, "posted"), isNull(entry.reversedByEntryId)) });
    before = await snapshot(); assert.equal((await voidEntry(request({ reason: "Locked" }), params(posted!.id))).status, 422);
    assert.equal((await ma.call("void_entry", { entryId: posted!.id, reason: "Locked" })).body.status, 422); assert.deepEqual(await snapshot(), before);
    await db.delete(periodLock).where(eq(periodLock.id, locked.id));
    // Per-group failures remain visible while independent valid groups commit.
    const partialRows = [...importRows(true).map(row => ({ ...row, entryNumber: "valid" })),
      ...importRows(true).map((row, i) => ({ ...row, entryNumber: "invalid", credit: i ? "1" : undefined }))];
    const partial = await (await importEntries(request({ fileName: "partial.csv", rows: partialRows }))).json();
    assert.equal(partial.job.processedRows, 1); assert.equal(partial.job.errorRows, 1); assert.equal(partial.job.status, "completed");
    // Storage faults after one successful dimension update roll back the entire recode.
    const recodeDraft = await make();
    await db.update(journalEntry).set({ sourceType: "fixture-recode" }).where(eq(journalEntry.id, recodeDraft.id));
    await db.execute(sql`CREATE SEQUENCE fixture_update_counter`);
    await db.execute(sql`CREATE FUNCTION fixture_fail_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF nextval('fixture_update_counter') = 2 THEN RAISE EXCEPTION 'fixture second update failure'; END IF; RETURN NEW; END $$`);
    await db.execute(sql`CREATE TRIGGER fixture_fail_update BEFORE UPDATE ON journal_line FOR EACH ROW EXECUTE FUNCTION fixture_fail_update()`);
    for (const transport of ["rest", "mcp"]) {
      await db.execute(sql`ALTER SEQUENCE fixture_update_counter RESTART WITH 1`);
      before = await snapshot();
      const input = { filter: { sourceType: "fixture-recode" }, target: { accountId: target.id } };
      if (transport === "rest") assert.equal((await recode(request(input))).status, 500);
      else assert.equal((await ma.call("recode_entries", input)).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`DROP TRIGGER fixture_fail_update ON journal_line`);
    // Trigger faults prove whole reversal and each imported header/legs roll back.
    const failEntry = await make(); assert.equal((await post(request(), params(failEntry.id))).status, 200);
    await db.execute(sql`CREATE FUNCTION fixture_fail_leg() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture leg failure'; END $$`);
    await db.execute(sql`CREATE TRIGGER fixture_fail_leg BEFORE INSERT ON journal_line FOR EACH ROW EXECUTE FUNCTION fixture_fail_leg()`);
    before = await snapshot(); assert.equal((await voidEntry(request({ reason: "Rollback" }), params(failEntry.id))).status, 500);
    assert.equal((await ma.call("void_entry", { entryId: failEntry.id, reason: "Rollback" })).isError, true); assert.deepEqual(await snapshot(), before);
    const headerCount = (await db.execute(sql`select count(*)::text as count from journal_entry`)).rows[0].count;
    assert.equal((await ma.call("import_journal_entries", { rows: importRows() })).body.processedEntries, 0);
    assert.equal((await (await importEntries(request({ rows: importRows(true), fileName: "rollback.csv" }))).json()).job.processedRows, 0);
    assert.equal((await db.execute(sql`select count(*)::text as count from journal_entry`)).rows[0].count, headerCount);
    await db.execute(sql`DROP TRIGGER fixture_fail_leg ON journal_line`);
    // Concurrent reversal calls serialize on the original, preventing double mirrors.
    const results = await Promise.all([voidEntry(request({ reason: "First" }), params(failEntry.id)), voidEntry(request({ reason: "Second" }), params(failEntry.id))]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    console.log("REST and MCP journal lifecycle and imports verified");
  } finally { await ma.close(); await mb.close(); await denied.close(); await importOnly.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
