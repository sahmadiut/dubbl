// Runs only inside journal-integration.test.ts's disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, costCenter,
  journalEntry, periodLock } from "../../lib/db/schema";
import { GET as listEntries, POST as createEntry } from "../../app/api/v1/entries/route";
import { GET as getEntry, PUT as editEntry, DELETE as deleteEntry } from "../../app/api/v1/entries/[id]/route";
import { POST as postEntry } from "../../app/api/v1/entries/[id]/post/route";
import { POST as voidEntry } from "../../app/api/v1/entries/[id]/void/route";
import { POST as recode } from "../../app/api/v1/entries/recode/route";
import { POST as importEntries } from "../../app/api/v1/bulk/entries/import/route";
import { POST as previewEntries } from "../../app/api/v1/bulk/entries/preview/route";
import { GET as listTemplates, POST as createTemplate } from "../../app/api/v1/recurring-journals/route";
import { GET as getTemplate, PATCH as editTemplate, DELETE as deleteTemplate } from "../../app/api/v1/recurring-journals/[id]/route";
import { POST as pauseTemplate } from "../../app/api/v1/recurring-journals/[id]/pause/route";
import { POST as runTemplates } from "../../app/api/v1/recurring-journals/run/route";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import { registerImportExportTools } from "../../lib/mcp/tools/import-export";
import { registerRecurringJournalTools } from "../../lib/mcp/tools/recurring-journals";
import type { AuthContext } from "../../lib/api/auth-context";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined journal fixture", version: "1.0.0" });
  registerEntryTools(server, ctx);
  registerImportExportTools(server, ctx);
  registerRecurringJournalTools(server, ctx);
  const client = new Client({ name: "Journal fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(tool => tool.name)).size, tools.length);
  for (const name of ["create_entry", "import_journal_entries", "create_recurring_journal"]) {
    assert.ok(JSON.stringify(tools.find(tool => tool.name === name)!.inputSchema).includes("debitAmountMinor"));
  }
  for (const name of ["create_recurring_journal", "update_recurring_journal"]) {
    assert.equal(tools.find(tool => tool.name === name)!.inputSchema.additionalProperties, false);
  }
  return {
    tools,
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async ok(name: string, args: Record<string, unknown> = {}) {
      const result = await this.call(name, args);
      assert.equal(result.isError, false, `${name}: ${JSON.stringify(result.body)}`);
      return result.body;
    },
    async close() { await client.close(); await server.close(); },
  };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Integration A", slug: "journal-integration-a" }, { name: "Integration B", slug: "journal-integration-b" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { email: "journal-integration-owner@example.test" }, { email: "journal-integration-viewer@example.test" },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No writes", permissions: [] }).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id },
  ]);
  const keys = { a: "dk_combined_journal_a", b: "dk_combined_journal_b", viewer: "dk_combined_journal_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_combined",
  });
  const [account, target, foreign] = await db.insert(chartAccount).values([
    { organizationId: a.id, name: "Original", code: "100", type: "asset" },
    { organizationId: a.id, name: "Recoded", code: "101", type: "asset" },
    { organizationId: b.id, name: "Other tenant", code: "200", type: "asset" },
  ]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([
    { organizationId: a.id, name: "Local", code: "A" }, { organizationId: b.id, name: "Foreign", code: "B" },
  ]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id });
  const denied = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const today = new Date().toISOString().slice(0, 10);
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const request = (body?: unknown, method = "POST", key = keys.a) => new Request("http://fixture.test/api/v1/entries", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const rest = async (response: Promise<Response>, status = 200) => {
    const result = await response, body = await result.json();
    assert.equal(result.status, status, JSON.stringify(body)); return body;
  };
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from journal_entry e) as entries,
    (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('debit_amount',l.debit_amount::text,'credit_amount',l.credit_amount::text,'rate_exact',l.rate_exact::text) order by l.id),'[]'::jsonb) from journal_line l) as lines,
    (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from recurring_template t) as templates,
    (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('debit_amount',l.debit_amount::text,'credit_amount',l.credit_amount::text) order by l.id),'[]'::jsonb) from recurring_template_line l) as template_lines,
    (select coalesce(jsonb_agg(to_jsonb(j) order by j.id),'[]'::jsonb) from bulk_import_job j) as jobs,
    (select count(*)::text from audit_log) as audits`)).rows;
  const legs = (amount: string, mode = "exact", accountId = account.id) => ["debit", "credit"].map(side => ({
    accountId, description: side, costCenterId: center.id,
    ...(mode !== "exact" ? { [side + "Amount"]: Number(amount) } : {}),
    ...(mode !== "legacy" ? { [side + "AmountMinor"]: amount } : {}),
  }));
  const entryBody = (amount = "1250", mode = "exact") => ({ date: today, description: "Combined", lines: legs(amount, mode) });
  const templateBody = (amount = "1250", mode = "exact") => ({ name: "Combined template", frequency: "monthly",
    startDate: today, maxOccurrences: 1, currencyCode: "IRR", lines: legs(amount, mode) });
  const importRows = (amount = "1250", mode = "exact", restUnits = false, description = "Combined import") => ["debit", "credit"].map(side => ({
    date: today, description, lineAccountCode: "100",
    ...(mode !== "exact" ? { [side]: restUnits ? `${BigInt(amount) / BigInt(100)}.${(BigInt(amount) % BigInt(100)).toString().padStart(2, "0")}` : Number(amount) } : {}),
    ...(mode !== "legacy" ? { [side + "AmountMinor"]: amount } : {}),
  }));
  // Assert values via both transports, preserving their distinct legacy output units.
  const read = async (id: string, amount: string, currency: string, rate = "1", accountId = account.id) => {
    const r = (await rest(getEntry(request(undefined, "GET"), params(id)))).entry;
    const m = (await ma.ok("get_entry", { entryId: id })).entry;
    assert.equal(r.organizationId, a.id); assert.equal(m.organizationId, a.id);
    for (const entry of [r, m]) {
      assert.equal(entry.lines.length, 2);
      const dr = entry.lines.find((line: { debitAmountMinor: string }) => line.debitAmountMinor === amount);
      const cr = entry.lines.find((line: { creditAmountMinor: string }) => line.creditAmountMinor === amount);
      assert.ok(dr); assert.ok(cr);
      for (const line of entry.lines) {
        assert.equal(line.accountId, accountId); assert.equal(line.currencyCode, currency);
        assert.equal(line.rateExact, rate); assert.equal(line.rateDirection, "quote_per_base");
      }
    }
    const dr = r.lines.find((line: { debitAmountMinor: string }) => line.debitAmountMinor === amount);
    assert.equal(dr.debitAmount, `${BigInt(amount) / BigInt(100)}.${(BigInt(amount) % BigInt(100)).toString().padStart(2, "0")}`);
    assert.equal(m.lines.find((line: { debitAmountMinor: string }) => line.debitAmountMinor === amount).debitAmount, Number(amount));
    return r;
  };
  try {
    // Unsupported fields cannot vanish at the SDK boundary before strict validation.
    for (const extra of [{ fxRate: "2" }, { projectId: foreign.id }, { startDate: today }]) {
      const before = await snapshot();
      if (!("startDate" in extra)) {
        assert.equal((await createTemplate(request({ ...templateBody(), ...extra }))).status, 400);
        assert.equal((await ma.call("create_recurring_journal", { ...templateBody(), ...extra })).isError, true);
      } else {
        const t = (await rest(createTemplate(request(templateBody())), 201)).template;
        const created = await snapshot();
        assert.equal((await editTemplate(request(extra, "PATCH"), params(t.id))).status, 400);
        assert.equal((await ma.call("update_recurring_journal", { templateId: t.id, ...extra })).isError, true);
        assert.deepEqual(await snapshot(), created);
        await rest(deleteTemplate(request(undefined, "DELETE"), params(t.id)));
        continue;
      }
      assert.deepEqual(await snapshot(), before);
    }

    let index = 0;
    for (const origin of ["manual", "import", "recurring"]) for (const viaMcp of [false, true]) {
      for (const [mode, amount] of [["legacy", "1250"], ["exact", "2147483648"], ["dual", String(Number.MAX_SAFE_INTEGER)]]) {
        const description = `Combined ${origin} ${index++}`;
        let id: string, currency = "USD";
        if (origin === "manual") {
          const body = { ...entryBody(amount, mode), description };
          id = (viaMcp ? await ma.ok("create_entry", body) : await rest(createEntry(request(body)), 201)).entry.id;
        } else if (origin === "import") {
          const rows = importRows(amount, mode, !viaMcp, description);
          const before = await snapshot();
          const preview = viaMcp ? await ma.ok("preview_journal_entries", { rows }) : await rest(previewEntries(request({ rows })));
          assert.equal(preview.entries[0].totalDebitMinor, amount); assert.equal(preview.entries[0].balanced, true);
          assert.deepEqual(await snapshot(), before);
          if (viaMcp) assert.equal((await ma.ok("import_journal_entries", { rows })).processedEntries, 1);
          else assert.equal((await rest(importEntries(request({ fileName: "combined.csv", rows })), 201)).job.processedRows, 1);
          id = (await db.query.journalEntry.findFirst({ where: eq(journalEntry.description, description) }))!.id;
        } else {
          currency = mode === "legacy" ? "IRR" : mode === "exact" ? "JPY" : "KWD";
          const body = { ...templateBody(amount, mode), name: description, notes: description, currencyCode: currency };
          const t = (viaMcp ? await ma.ok("create_recurring_journal", body) : await rest(createTemplate(request(body)), 201)).template;
          // Edit and pause/resume through the opposite transport before posting saved legs.
          if (viaMcp) {
            await rest(editTemplate(request({ reference: description }, "PATCH"), params(t.id)));
            await rest(pauseTemplate(request(), params(t.id))); await rest(pauseTemplate(request(), params(t.id)));
          } else {
            await ma.ok("update_recurring_journal", { templateId: t.id, reference: description });
            await ma.ok("set_recurring_journal_status", { templateId: t.id, status: "paused" });
            await ma.ok("pause_recurring_journal", { templateId: t.id });
          }
          const saved = (await ma.ok("get_recurring_journal", { templateId: t.id })).template;
          assert.equal(saved.currencyCode, currency); assert.equal(saved.lines[0].debitAmountMinor, amount);
          assert.equal((await rest(getTemplate(request(undefined, "GET"), params(t.id)))).template.rateExact, "1");
          const run = viaMcp ? await rest(runTemplates(request())) : await ma.ok("run_recurring_journals");
          assert.equal(run.posted, 1);
          const after = await snapshot();
          assert.equal((viaMcp ? await ma.ok("run_recurring_journals") : await rest(runTemplates(request()))).posted, 0);
          assert.deepEqual(await snapshot().then(rows => rows.map(row => ({ ...row, audits: undefined }))),
            after.map(row => ({ ...row, audits: undefined }))); // A successful no-op run still audits.
          id = (await db.query.journalEntry.findFirst({ where: eq(journalEntry.description, description) }))!.id;
          await ma.ok("delete_recurring_journal", { templateId: t.id });
        }
        await read(id, amount, currency);
        if (origin !== "recurring") {
          const body = { ...entryBody(amount, mode), description, lines: legs(amount, mode).map(line => ({ ...line, currencyCode: currency })) };
          if (viaMcp) await rest(editEntry(request(body, "PUT"), params(id)));
          else await ma.ok("update_entry", { entryId: id, ...body });
          await ma.ok("set_auto_reverse_date", { entryId: id, autoReverseDate: today });
          assert.equal((await read(id, amount, currency)).autoReverseDate, today);
          await ma.ok("set_auto_reverse_date", { entryId: id, autoReverseDate: null });
        }
        const recodeBody = { filter: { accountId: account.id }, target: { accountId: target.id, costCenterId: center.id }, draftOnly: origin !== "recurring" };
        const changed = viaMcp ? await rest(recode(request(recodeBody))) : await ma.ok("recode_entries", recodeBody);
        assert.equal(changed.recoded, 2); await read(id, amount, currency, "1", target.id);
        if (origin !== "recurring") {
          if (viaMcp) await rest(postEntry(request(), params(id))); else await ma.ok("post_entry", { entryId: id });
        }
        const beforeRetry = await snapshot();
        assert.equal((await ma.call("post_entry", { entryId: id })).isError, true);
        assert.equal((await postEntry(request(), params(id))).status, 400);
        assert.deepEqual(await snapshot(), beforeRetry);
        const mirrorId = viaMcp ? (await rest(voidEntry(request({ reason: "Combined" }), params(id)))).entry.reversedByEntryId
          : (await ma.ok("void_entry", { entryId: id, reason: "Combined" })).reversalEntry.id;
        const mirror = await read(mirrorId, amount, currency, "1", target.id);
        assert.equal(mirror.reversesEntryId, id); assert.equal(mirror.sourceType, "manual_reversal");
        assert.equal((await read(id, amount, currency, "1", target.id)).reversedByEntryId, mirrorId);
        const after = await snapshot();
        assert.equal((await ma.call("void_entry", { entryId: id, reason: "Retry" })).isError, true);
        assert.equal((await voidEntry(request({ reason: "Retry" }), params(id))).status, 400);
        assert.deepEqual(await snapshot(), after);
      }
    }
    // Saved manual FX survives lifecycle changes without re-converting stored units.
    const fx = (await ma.ok("create_entry", { ...entryBody(), lines: legs("1250").map(line => ({ ...line, currencyCode: "EUR", rateExact: "1.25" })) })).entry;
    await rest(postEntry(request(), params(fx.id)));
    const fxMirror = (await ma.ok("void_entry", { entryId: fx.id, reason: "FX" })).reversalEntry.id;
    await read(fxMirror, "1250", "EUR", "1.25", account.id);

    // One snapshot spans all three writers, templates/schedules, jobs and audits.
    for (const amount of ["01", "9007199254740992"]) {
      const status = amount === "01" ? 400 : 422, before = await snapshot();
      for (const response of [await createEntry(request(entryBody(amount))), await createTemplate(request(templateBody(amount))),
        await importEntries(request({ fileName: "bad.csv", rows: importRows(amount) }))]) {
        assert.equal(response.status, status);
        if (status === 422) assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      }
      for (const [name, args] of [["create_entry", entryBody(amount)], ["create_recurring_journal", templateBody(amount)],
        ["import_journal_entries", { rows: importRows(amount) }]] as const) {
        const response = await ma.call(name, args); assert.equal(response.isError, true);
        if (status === 422) assert.equal(response.body.code, "LEGACY_NUMERIC_RANGE");
      }
      assert.deepEqual(await snapshot(), before);
    }
    const draft = (await rest(createEntry(request(entryBody())), 201)).entry;
    const template = (await ma.ok("create_recurring_journal", templateBody())).template;
    for (const [key, client, expected] of [[keys.viewer, denied, 403], [keys.b, mb, 404]] as const) {
      const before = await snapshot();
      const replacement = key === keys.b ? { ...entryBody(), lines: legs("1250", "exact", foreign.id).map(line => ({ ...line, costCenterId: null })) } : entryBody();
      for (const response of [await postEntry(request(undefined, "POST", key), params(draft.id)),
        await editEntry(request(replacement, "PUT", key), params(draft.id)),
        await deleteEntry(request(undefined, "DELETE", key), params(draft.id)),
        await editTemplate(request({ notes: "Denied" }, "PATCH", key), params(template.id)),
        await deleteTemplate(request(undefined, "DELETE", key), params(template.id))]) assert.equal(response.status, expected);
      for (const [name, args] of [["post_entry", { entryId: draft.id }], ["update_entry", { entryId: draft.id, ...entryBody() }],
        ["delete_entry", { entryId: draft.id }], ["update_recurring_journal", { templateId: template.id, notes: "Denied" }],
        ["delete_recurring_journal", { templateId: template.id }]] as const) assert.equal((await client.call(name, args)).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    const before = await snapshot();
    for (const response of [await createEntry(request(entryBody(), "POST", "dk_invalid")),
      await createTemplate(request(templateBody(), "POST", "dk_invalid")),
      await importEntries(request({ fileName: "bad.csv", rows: importRows() }, "POST", "dk_invalid"))]) assert.equal(response.status, 401);
    for (const [name, args] of [["create_entry", entryBody()], ["create_recurring_journal", templateBody()],
      ["import_journal_entries", { rows: importRows() }], ["run_recurring_journals", {}]] as const) assert.equal((await denied.call(name, args)).isError, true);
    assert.equal((await mb.ok("list_entries")).entries.length, 0);
    assert.equal((await mb.ok("list_recurring_journals")).templates.length, 0);
    assert.equal((await listEntries(request(undefined, "GET", keys.b))).status, 200);
    assert.equal((await rest(listTemplates(request(undefined, "GET", keys.b)))).data.length, 0);
    assert.deepEqual(await snapshot(), before);
    for (const foreignLegs of [legs("1250", "exact", foreign.id), legs("1250").map(line => ({ ...line, costCenterId: foreignCenter.id }))]) {
      const before = await snapshot();
      assert.equal((await createEntry(request({ ...entryBody(), lines: foreignLegs }))).status, 400);
      assert.equal((await ma.call("create_recurring_journal", { ...templateBody(), lines: foreignLegs })).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: today });
    const locked = await snapshot();
    assert.equal((await postEntry(request(), params(draft.id))).status, 422);
    assert.equal((await ma.call("post_entry", { entryId: draft.id })).body.status, 422);
    assert.equal((await deleteEntry(request(undefined, "DELETE"), params(draft.id))).status, 422);
    assert.deepEqual(await snapshot(), locked);
    console.log("Combined journal contracts verified: 18 cross-transport writer/lifecycle flows, exact aliases, saved FX, strict templates, tenant/role/lock/range snapshots");
  } finally { await ma.close(); await mb.close(); await denied.close(); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
