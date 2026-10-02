// Executes only inside journal-wire.test.ts's randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, costCenter, project, fiscalYear,
  journalEntry, journalLine, periodLock } from "../../lib/db/schema";
import { GET, POST } from "../../app/api/v1/entries/route";
import { GET as getEntry, PUT, PATCH, DELETE } from "../../app/api/v1/entries/[id]/route";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Journal fixture", version: "1.0.0" });
  registerEntryTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const listed = (await client.listTools()).tools;
  assert.ok(listed.some(tool => tool.name === "delete_entry"));
  const schema = listed.find(tool => tool.name === "create_entry")!.inputSchema;
  assert.ok(JSON.stringify(schema).includes("debitAmountMinor"));
  assert.ok(JSON.stringify(schema).includes("rateExact"));
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
  const [a, b] = await db.insert(organization).values([
    { name: "Journal A", slug: "journal-a" }, { name: "Journal B", slug: "journal-b" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { name: "Owner", email: "journal-owner@example.test" }, { name: "Viewer", email: "journal-viewer@example.test" },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No writes", permissions: [] }).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id },
  ]);
  const keys = { a: "dk_journal_a", b: "dk_journal_b", viewer: "dk_journal_viewer" };
  for (const [label, key] of Object.entries(keys)) {
    await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id,
      name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_journal" });
  }
  const [account, foreignAccount, inactive] = await db.insert(chartAccount).values([
    { organizationId: a.id, name: "Cash", code: "100", type: "asset" },
    { organizationId: b.id, name: "Foreign cash", code: "100", type: "asset" },
    { organizationId: a.id, name: "Inactive", code: "101", type: "asset", isActive: false },
  ]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([
    { organizationId: a.id, name: "Center", code: "A" }, { organizationId: b.id, name: "Center", code: "B" },
  ]).returning();
  const [job, foreignJob] = await db.insert(project).values([
    { organizationId: a.id, name: "Job" }, { organizationId: b.id, name: "Job" },
  ]).returning();
  const [year, foreignYear] = await db.insert(fiscalYear).values([
    { organizationId: a.id, name: "Year", startDate: "2026-01-01", endDate: "2026-12-31" },
    { organizationId: b.id, name: "Year", startDate: "2026-01-01", endDate: "2026-12-31" },
  ]).returning();
  const request = (method: string, body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/entries", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const header = { date: "2026-10-01", description: "Synthetic journal" };
  const lines = (amount: number | string, extra: Record<string, unknown> = {}) => [
    { accountId: account.id, ...(typeof amount === "string" ? { debitAmountMinor: amount } : { debitAmount: amount }), ...extra },
    { accountId: account.id, ...(typeof amount === "string" ? { creditAmountMinor: amount } : { creditAmount: amount }), ...extra },
  ];
  // Read exact raw columns for snapshots, including unsafe-history tests; do not coerce to Number.
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb) from journal_entry e) as entries,
    (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('debit_amount', l.debit_amount::text, 'credit_amount', l.credit_amount::text) order by l.id), '[]'::jsonb) from journal_line l) as lines,
    (select count(*)::text from audit_log) as audits`)).rows;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id });
  const denied = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  try {
    let id = "";
    for (const amount of [1250, "2147483648", String(Number.MAX_SAFE_INTEGER)]) {
      const response = await POST(request("POST", { ...header, fiscalYearId: year.id,
        lines: lines(amount, { costCenterId: center.id, projectId: job.id, rateExact: "1" }) }));
      assert.equal(response.status, 201);
      const saved = (await response.json()).entry;
      assert.equal(saved.organizationId, a.id); id = saved.id;
      const detail = (await (await getEntry(request("GET"), params(id))).json()).entry;
      assert.equal(detail.lines[0].debitAmountMinor, String(amount));
      assert.equal(detail.lines[0].rateExact, "1");
      assert.equal(detail.lines[0].rateDirection, "quote_per_base");
      assert.equal(detail.lines[0].costCenterId, center.id);
      assert.equal(detail.lines[0].projectId, job.id);
      assert.equal(detail.lines[0].debitAmount, amount === 1250 ? "12.50" : amount === "2147483648" ? "21474836.48" : "90071992547409.91");
    }
    for (const operation of [PUT, PATCH]) {
      const response = await operation(request("PUT", { ...header, lines: lines("1250", { debitAmount: undefined, exchangeRate: 1250000, rateExact: "1.25" }) }), params(id));
      assert.equal(response.status, 200);
    }
    const dual = [{ accountId: account.id, debitAmount: 1250, debitAmountMinor: "1250", rateExact: "1", exchangeRate: 1000000 },
      { accountId: account.id, creditAmount: 1250, creditAmountMinor: "1250", rateExact: "1", exchangeRate: 1000000 }];
    assert.equal((await POST(request("POST", { ...header, lines: dual }))).status, 201);
    assert.equal((await ma.call("create_entry", { ...header, lines: dual })).isError, false);
    const restList = await GET(request("GET"));
    assert.equal(restList.status, 200);
    assert.ok((await restList.json()).entries.every((row: { totalDebitMinor: string }) => typeof row.totalDebitMinor === "string"));

    // Malformed/conflicting/excess amounts/rates fail before header, legs or audit writes.
    for (const [badLines, status] of [
      [lines("01"), 400], [lines("-1"), 400], [lines("1e3"), 400], [lines("۱۲۵۰"), 400],
      [lines(1, { debitAmountMinor: "2" }), 400], [lines("1250", { exchangeRate: 1000000, rateExact: "2" }), 400],
      [lines("9007199254740992"), 422], [lines("9223372036854775807"), 422], [lines("9223372036854775808"), 400],
      [lines(Number.MAX_SAFE_INTEGER + 1), 400], [lines(1250, { exchangeRate: 0 }), 400],
      [lines(1250, { rateExact: "0.0000001" }), 422], [lines(1250, { rateExact: "2147.483648" }), 422],
      [[...lines(Number.MAX_SAFE_INTEGER), ...lines(1)], 422],
      [lines(0), 400], [lines(1, { accountId: foreignAccount.id }), 400], [lines(1, { accountId: inactive.id }), 400],
      [lines(1, { costCenterId: foreignCenter.id }), 400], [lines(1, { projectId: foreignJob.id }), 400],
    ] as const) {
      const before = await snapshot();
      for (const response of [await POST(request("POST", { ...header, lines: badLines })),
        await PUT(request("PUT", { ...header, lines: badLines }), params(id))]) {
        assert.equal(response.status, status);
        if (status === 422) assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      }
      assert.deepEqual(await snapshot(), before);
    }
    let before = await snapshot();
    for (const date of ["2026-02-30", "2026-10-01T12:00:00Z", "invalid"]) {
      assert.equal((await POST(request("POST", { ...header, date, lines: lines(1250) }))).status, 400);
      assert.equal((await PUT(request("PUT", { ...header, date, lines: lines(1250) }), params(id))).status, 400);
      assert.equal((await ma.call("create_entry", { ...header, date, lines: lines(1250) })).isError, true);
      assert.equal((await ma.call("update_entry", { entryId: id, ...header, date, lines: lines(1250) })).isError, true);
    }
    assert.equal((await POST(request("POST", { ...header, autoReverseDate: "2026-09-30", lines: lines(1250) }))).status, 400);
    assert.equal((await ma.call("create_entry", { ...header, autoReverseDate: "2026-09-30", lines: lines(1250) })).isError, true);
    assert.equal((await POST(request("POST", { ...header, fiscalYearId: foreignYear.id, lines: lines(1250) }))).status, 400);
    assert.equal((await PUT(request("PUT", { ...header, fiscalYearId: foreignYear.id, lines: lines(1250) }), params(id))).status, 400);
    for (const key of [keys.viewer, "dk_invalid"]) {
      const status = key === keys.viewer ? 403 : 401;
      assert.equal((await POST(request("POST", { ...header, lines: lines("1250") }, key))).status, status);
      assert.equal((await PUT(request("PUT", { ...header, lines: lines("1250") }, key), params(id))).status, status);
      assert.equal((await DELETE(request("DELETE", undefined, key), params(id))).status, status);
    }
    assert.equal((await getEntry(request("GET", undefined, keys.b), params(id))).status, 404);
    assert.equal((await PUT(request("PUT", { ...header, lines: lines("1250", { accountId: foreignAccount.id }) }, keys.b), params(id))).status, 404);
    assert.equal((await DELETE(request("DELETE", undefined, keys.b), params(id))).status, 404);
    assert.deepEqual(await snapshot(), before);

    // REST's existing base-balance create policy; edit and MCP retain raw equality.
    const foreignLines = [{ accountId: account.id, debitAmountMinor: "100", currencyCode: "EUR", rateExact: "2" },
      { accountId: account.id, creditAmountMinor: "200", currencyCode: "USD" }];
    const mixed = await POST(request("POST", { ...header, lines: foreignLines }));
    assert.equal(mixed.status, 201);
    const mixedId = (await mixed.json()).entry.id;
    assert.equal((await PUT(request("PUT", { ...header, lines: foreignLines }), params(mixedId))).status, 400);
    const [automated] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 800, ...header,
      sourceType: "invoice", status: "posted" }).returning();
    await db.insert(journalLine).values([
      { journalEntryId: automated.id, accountId: account.id, debitAmount: 200, currencyCode: "EUR", exchangeRate: 2000000 },
      { journalEntryId: automated.id, accountId: account.id, creditAmount: 200, currencyCode: "EUR", exchangeRate: 2000000 },
    ]);
    const storedBase = (await (await getEntry(request("GET"), params(automated.id))).json()).entry;
    assert.equal(storedBase.lines[0].debitAmountMinor, "200", "Automated base amounts must not be converted twice");
    assert.equal(storedBase.lines[0].currencyCode, "EUR"); assert.equal(storedBase.lines[0].rateExact, "2");
    assert.equal((await ma.call("get_entry", { entryId: automated.id })).body.entry.lines[0].debitAmountMinor, "200");
    const [invalidFx] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 801, ...header }).returning();
    // Inject pre-migration invalid history only in this disposable fixture; new writes remain guarded.
    await db.transaction(async tx => {
      await tx.execute(sql`alter table journal_line disable trigger journal_line_exact_sync`);
      await tx.insert(journalLine).values({ journalEntryId: invalidFx.id, accountId: account.id, debitAmount: 1250,
        exchangeRate: 0, rateMigrationStatus: "invalid", rateProvenance: "synthetic-pre-migration-history" });
      await tx.execute(sql`alter table journal_line enable trigger journal_line_exact_sync`);
    });
    const invalidDetail = (await (await getEntry(request("GET"), params(invalidFx.id))).json()).entry.lines[0];
    assert.equal(invalidDetail.rateExact, null); assert.equal(invalidDetail.exchangeRate, 0);
    assert.equal(invalidDetail.rateMigrationStatus, "invalid");
    assert.equal((await ma.call("get_entry", { entryId: invalidFx.id })).body.entry.lines[0].rateExact, null);
    const [badScope] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 802, ...header }).returning();
    await db.insert(journalLine).values({ journalEntryId: badScope.id, accountId: foreignAccount.id, debitAmount: 1250 });
    before = await snapshot();
    assert.equal((await getEntry(request("GET"), params(badScope.id))).status, 422);
    assert.equal((await ma.call("get_entry", { entryId: badScope.id })).body.status, 422);
    assert.deepEqual(await snapshot(), before);
    before = await snapshot();
    assert.equal((await POST(request("POST", { ...header, lines: lines(Number.MAX_SAFE_INTEGER, { rateExact: "2" }) }))).status, 422);
    assert.deepEqual(await snapshot(), before);

    // SDK advertises and executes additive exact aliases using real registered handlers.
    let mcpId = "";
    for (const amount of [1250, "2147483648", String(Number.MAX_SAFE_INTEGER)]) {
      const result = await ma.call("create_entry", { ...header, lines: lines(amount) });
      assert.equal(result.isError, false); mcpId = result.body.entry.id;
      const detail = await ma.call("get_entry", { entryId: mcpId });
      assert.equal(detail.body.entry.lines[0].debitAmountMinor, String(amount));
      assert.equal(detail.body.entry.lines[0].debitAmount, Number(amount));
    }
    assert.equal((await ma.call("update_entry", { entryId: mcpId, ...header, lines: lines("1250", { costCenterId: center.id, projectId: job.id }) })).isError, false);
    const listed = await ma.call("list_entries", {});
    assert.equal(listed.isError, false);
    assert.ok(listed.body.entries.every((row: { totalDebit: number; totalDebitMinor: string }) => String(row.totalDebit) === row.totalDebitMinor));
    for (const badLines of [lines("01"), lines("-1"), lines("9007199254740992"), lines("1250", { debitAmount: 1 }),
      lines(1250, { rateExact: "0.0000001" }), lines(1250, { rateExact: "2", exchangeRate: 1000000 }),
      [...lines(Number.MAX_SAFE_INTEGER), ...lines(1)], lines(1, { accountId: foreignAccount.id }),
      lines(1, { costCenterId: foreignCenter.id }), lines(1, { projectId: foreignJob.id }), foreignLines]) {
      before = await snapshot();
      assert.equal((await ma.call("create_entry", { ...header, lines: badLines })).isError, true);
      assert.equal((await ma.call("update_entry", { entryId: mcpId, ...header, lines: badLines })).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    before = await snapshot();
    assert.equal((await denied.call("create_entry", { ...header, lines: lines("1250") })).body.status, 403);
    assert.equal((await denied.call("update_entry", { entryId: mcpId, ...header, lines: lines("1250") })).body.status, 403);
    assert.equal((await denied.call("delete_entry", { entryId: mcpId })).body.status, 403);
    assert.equal((await mb.call("get_entry", { entryId: mcpId })).isError, true);
    assert.equal((await mb.call("update_entry", { entryId: mcpId, ...header, lines: lines("1250", { accountId: foreignAccount.id }) })).isError, true);
    assert.equal((await mb.call("delete_entry", { entryId: mcpId })).body.status, 404);
    assert.deepEqual(await snapshot(), before);

    // Old AND new period dates block edits; creation and deletion honor lock.
    const future = await POST(request("POST", { ...header, date: "2026-11-01", lines: lines(1250) }));
    assert.equal(future.status, 201);
    const futureId = (await future.json()).entry.id;
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: header.date }).returning();
    before = await snapshot();
    assert.equal((await POST(request("POST", { ...header, lines: lines(1250) }))).status, 422);
    assert.equal((await PUT(request("PUT", { ...header, date: "2026-11-01", lines: lines(1250) }), params(id))).status, 422);
    assert.equal((await DELETE(request("DELETE"), params(id))).status, 422);
    assert.equal((await PUT(request("PUT", { ...header, lines: lines(1250) }), params(futureId))).status, 422);
    assert.equal((await ma.call("create_entry", { ...header, lines: lines(1250) })).body.status, 422);
    assert.equal((await ma.call("update_entry", { entryId: mcpId, ...header, date: "2026-11-01", lines: lines(1250) })).body.status, 422);
    assert.equal((await ma.call("delete_entry", { entryId: mcpId })).body.status, 422);
    assert.equal((await ma.call("update_entry", { entryId: futureId, ...header, lines: lines(1250) })).body.status, 422);
    assert.deepEqual(await snapshot(), before);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    await db.update(fiscalYear).set({ isClosed: true }).where(eq(fiscalYear.id, year.id));
    before = await snapshot();
    assert.equal((await POST(request("POST", { ...header, lines: lines(1250) }))).status, 422);
    assert.equal((await PUT(request("PUT", { ...header, lines: lines(1250) }), params(id))).status, 422);
    assert.equal((await DELETE(request("DELETE"), params(id))).status, 422);
    assert.equal((await ma.call("create_entry", { ...header, lines: lines(1250) })).body.status, 422);
    assert.equal((await ma.call("update_entry", { entryId: mcpId, ...header, lines: lines(1250) })).body.status, 422);
    assert.equal((await ma.call("delete_entry", { entryId: mcpId })).body.status, 422);
    assert.deepEqual(await snapshot(), before);
    await db.update(fiscalYear).set({ isClosed: false }).where(eq(fiscalYear.id, year.id));
    await db.update(journalEntry).set({ status: "posted" }).where(eq(journalEntry.id, id));
    before = await snapshot();
    assert.equal((await PUT(request("PUT", { ...header, lines: lines(1250) }), params(id))).status, 400);
    assert.equal((await DELETE(request("DELETE"), params(id))).status, 400);
    assert.equal((await ma.call("update_entry", { entryId: id, ...header, lines: lines(1250) })).isError, true);
    assert.equal((await ma.call("delete_entry", { entryId: id })).body.status, 400);
    assert.deepEqual(await snapshot(), before);

    // Database failure after header insert/update and line deletion rolls back the whole operation.
    await db.execute(sql`create function journal_fixture_fail() returns trigger language plpgsql as $$
      begin if NEW.description = 'fixture rollback' then raise exception 'synthetic line failure'; end if; return NEW; end $$`);
    await db.execute(sql`create trigger journal_fixture_fail before insert on journal_line for each row execute function journal_fixture_fail()`);
    before = await snapshot();
    const bad = lines(1250, { description: "fixture rollback" });
    assert.equal((await POST(request("POST", { ...header, lines: bad }))).status, 500);
    assert.equal((await PUT(request("PUT", { ...header, description: "must rollback", lines: bad }), params(mcpId))).status, 500);
    assert.equal((await ma.call("create_entry", { ...header, lines: bad })).isError, true);
    assert.equal((await ma.call("update_entry", { entryId: mcpId, ...header, description: "must rollback", lines: bad })).isError, true);
    assert.deepEqual(await snapshot(), before);
    await db.execute(sql`drop trigger journal_fixture_fail on journal_line`);
    await db.execute(sql`drop function journal_fixture_fail()`);

    // Safe individual amounts with unsafe sums reject reads; unsafe raw history stays unchanged.
    const [huge] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 900, ...header }).returning();
    await db.insert(journalLine).values([
      { journalEntryId: huge.id, accountId: account.id, debitAmount: Number.MAX_SAFE_INTEGER },
      { journalEntryId: huge.id, accountId: account.id, debitAmount: 1 },
    ]);
    assert.equal((await GET(request("GET"))).status, 422);
    assert.equal((await ma.call("list_entries", {})).body.status, 422);
    await db.execute(sql`update journal_line set debit_amount = 9007199254740992 where journal_entry_id = ${huge.id}`);
    before = await snapshot();
    assert.equal((await getEntry(request("GET"), params(huge.id))).status, 422);
    assert.equal((await ma.call("get_entry", { entryId: huge.id })).body.status, 422);
    assert.deepEqual(await snapshot(), before);
    await db.delete(journalEntry).where(eq(journalEntry.id, huge.id));

    assert.equal((await ma.call("delete_entry", { entryId: mcpId })).isError, false);
    assert.equal((await db.select().from(journalLine).where(eq(journalLine.journalEntryId, mcpId))).length, 0);
    assert.equal((await DELETE(request("DELETE"), params(mixedId))).status, 200);
    assert.equal((await db.select().from(journalLine).where(eq(journalLine.journalEntryId, mixedId))).length, 0);
    console.log("REST and MCP journal CRUD verified");
  } finally { await ma.close(); await mb.close(); await denied.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
