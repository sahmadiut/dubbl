import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, contact, journalEntry, journalLine,
  aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiConversation, aiActionBatch, aiStep } from "../../lib/db/schema";
import type { ActionItem } from "../../lib/ai/action-adapters";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const runs = await import("../../lib/ai/run-lifecycle"), store = await import("../../lib/ai/persistence"), batches = await import("../../lib/ai/action-batches");
  const { actionPermissions, adapterVersion } = await import("../../lib/ai/action-adapters");
  if (process.argv.includes("--maintenance-only")) { await runs.maintainRuns(); console.log("Versioned mixed storage maintenance verified"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const getRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/route"), reviseRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/revise/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const [owner, other] = await db.insert(users).values(["owner", "other"].map(name => ({ name, email: `ai042-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Versioned storage", slug: "ai042-a", contactEmail: "reply@test.invalid" }, { name: "Foreign", slug: "ai042-b" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries", "edit:entries", "manage:payments", "manage:invoices"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Proposal actor", permissions }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: other.id, role: "owner" }, { organizationId: foreign.id, userId: other.id, role: "owner" }]);
  const [, , cash, revenue, expense] = await db.insert(chartAccount).values([
    { code: "1200", name: "Receivable", type: "asset" as const }, { code: "2100", name: "Payable", type: "liability" as const }, { code: "1100", name: "Cash", type: "asset" as const },
    { code: "4000", name: "Sales", type: "revenue" as const }, { code: "5000", name: "Purchases", type: "expense" as const },
  ].map(a => ({ ...a, organizationId: org.id }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Saved recipient", email: "recipient@test.invalid", type: "both" }).returning();
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const request = (body?: unknown, organizationId = org.id) => new Request("http://test.invalid/api/v1/ai/storage", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", "x-organization-id": organizationId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response) { assert.equal(response.status, 200, await response.clone().text()); assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json(); }
  login(owner.id); const ctx = await getAuthContext(request()), fixtureCtx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  const { createInvoice } = await import("../../lib/api/invoice-writes"), { sendInvoice } = await import("../../lib/api/invoice-lifecycle"), { createBill } = await import("../../lib/api/bill-writes"), { receiveBill } = await import("../../lib/api/bill-lifecycle");
  async function recognized(kind: "invoice" | "bill") {
    const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode: "USD", lines: [{ description: "Storage fixture", unitPriceMinor: "1250", accountId: kind === "invoice" ? revenue.id : expense.id }] };
    if (kind === "invoice") { const c = await createInvoice(fixtureCtx, input, "rest"); return (await sendInvoice(fixtureCtx, c.invoice.id)).invoice; }
    const c = await createBill(fixtureCtx, input, "rest"); return (await receiveBill(fixtureCtx, c.bill.id)).bill;
  }
  const inv = await recognized("invoice"), bill = await recognized("bill"), emailInv = await recognized("invoice"), replacementEmail = await recognized("invoice");
  let seq = 0;
  async function draft(currencyCode: string) {
    const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 1000 + ++seq, date: "2026-10-20", description: "Manual draft", createdBy: owner.id }).returning();
    await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: cash.id, debitAmount: 1250, currencyCode }, { journalEntryId: entry.id, accountId: revenue.id, creditAmount: 1250, currencyCode }]); return entry;
  }
  const post = await draft("USD"), rial = await draft("IRR"), deletion = await draft("USD");
  const ids = Array.from({ length: 6 }, () => randomUUID());
  const items: ActionItem[] = [
    { itemId: ids[0], action: "post_entry", arguments: { entryId: post.id }, dependsOn: [] },
    { itemId: ids[1], action: "post_entry", arguments: { entryId: rial.id }, dependsOn: [ids[0]] },
    { itemId: ids[2], action: "settle_document", arguments: { documentType: "invoice", documentId: inv.id, amountMinor: "500", date: "2026-10-20", method: "cash", reference: "ORIGINAL" }, dependsOn: [ids[1]] },
    { itemId: ids[3], action: "settle_document", arguments: { documentType: "bill", documentId: bill.id, amountMinor: "500", date: "2026-10-20", method: "cash" }, dependsOn: [ids[2]] },
    { itemId: ids[4], action: "delete_draft_journal", arguments: { entryId: deletion.id }, dependsOn: [] },
    { itemId: ids[5], action: "email_invoice", arguments: { documentId: emailInv.id }, dependsOn: [ids[3]] },
  ];
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000, delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const businessTables = ["journal_entry", "journal_line", "invoice", "invoice_line", "bill", "bill_line", "payment", "payment_allocation", "chart_account", "bank_account", "number_sequence", "contact", "audit_log", "document_email_log", "approval_workflow", "approval_workflow_step", "approval_request", "approval_action"];
  const aiTables = ["ai_run", "ai_step", "ai_event", "ai_action_batch", "ai_approval", "ai_usage_attempt", "ai_provider_attempt", "ai_provider_call"];
  async function hashes(tables = businessTables) { return Promise.all(tables.map(async t => (await pool.query(`select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) hash from ${t} t`)).rows[0].hash)); }
  async function unchanged<T>(fn: () => Promise<T>, includeAi = false) { const tables = includeAi ? [...businessTables, ...aiTables] : businessTables, before = await hashes(tables), result = await fn(); assert.deepEqual(await hashes(tables), before); return result; }
  const server = new McpServer({ name: "ai042", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "storage-acceptance", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(st), client.connect(ct)]);
  async function mcp(name: string, args: Record<string, unknown>) { const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, false, JSON.stringify(r)); return JSON.parse((r.content as { text: string }[])[0].text); }
  const get = (runId: string) => getRoute.GET(request(), params(runId)).then(data);
  const revise = (runId: string, body: object) => reviseRoute.POST(request(body), params(runId)).then(data);
  const stored = (runId: string) => db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, runId)).orderBy(aiActionBatch.version);
  const runRow = async (runId: string) => (await db.select().from(aiRun).where(eq(aiRun.id, runId)))[0];
  async function propose() {
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Prepare exact versioned proposals" }), run = await runs.claimNextRun(); assert.equal(run?.id, r.id);
    await unchanged(() => batches.requestActionBatch(run!.id, run!.leaseOwner!, run!.version, { requestKey: `batch-${++seq}`, items, selectedItemIds: [] }));
    return { c, run: run!, view: await get(r.id) };
  }
  const patch = (view: Awaited<ReturnType<typeof get>>, revised = items, selectedItemIds = ids) => ({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: `revision-${++seq}`, items: revised, selectedItemIds });
  async function waitForLock(queryPrefix: string) {
    for (let n = 0; n < 200; n++) {
      const r = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1 and pid<>pg_backend_pid()", [queryPrefix]);
      if (r.rowCount) return;
      await delay(10);
    }
    assert.fail(`Expected real SQL wait: ${queryPrefix}`);
  }
  async function erased(runId: string, expectedRows: number) {
    const rows = await stored(runId); assert.equal(rows.length, expectedRows); assert.ok(rows.every(r => r.authority === null && r.display === null));
    assert.ok((await db.select().from(aiStep).where(eq(aiStep.runId, runId))).every(s => s.state === "skipped" && s.input === null && s.dispatchLease === null));
    assert.equal(await runs.claimNextRun(), null);
  }
  // Stop legitimately writes its own audit record; every other business table
  // must remain byte-for-byte unchanged across the entire parent journey.
  const immutableBusiness = businessTables.filter(t => t !== "audit_log"), businessBefore = await hashes(immutableBusiness);
  try {
    const initial = await propose(), runId = initial.run.id, original = (await stored(runId))[0];
    assert.deepEqual(initial.view.batch.display.totals, []);
    assert.deepEqual(await unchanged(() => mcp("get_ai_action_batch", { runId }), true), initial.view);
    const changed: ActionItem[] = items.map(i => {
      if (i.itemId === ids[0]) return { ...i, action: "delete_draft_journal", arguments: { entryId: post.id } };
      if (i.itemId === ids[4]) return { ...i, action: "post_entry", arguments: { entryId: deletion.id } };
      if (i.action === "settle_document") return { ...i, arguments: { ...i.arguments, amountMinor: "750", date: "2026-10-21", method: "bank_transfer", reference: "REVISED" } };
      if (i.action === "email_invoice") return { ...i, arguments: { documentId: replacementEmail.id } };
      return i;
    });
    const selection = patch(initial.view, changed), receipt = await unchanged(() => revise(runId, selection));
    assert.equal(receipt.version, 2); let view = await get(runId);
    assert.deepEqual(view.batch.display.totals, [{ currencyCode: "IRR", debitAmountMinor: "1250", creditAmountMinor: "1250" }, { currencyCode: "USD", debitAmountMinor: "2750", creditAmountMinor: "2750" }]);
    assert.equal(view.batch.expiresAt, original.expiresAt.toISOString()); assert.notEqual(view.batch.bindingDigest, original.bindingDigest);
    const revisions = await stored(runId); assert.equal(revisions[0].state, "superseded");
    assert.deepEqual(revisions[0].authority, original.authority); assert.deepEqual(revisions[0].display, original.display);
    const authority = revisions[1].authority as { items: (ActionItem & { stepId: string; adapterVersion: number; resourceVersion: string; policyVersion: string })[]; selectedItemIds: string[] };
    assert.deepEqual([...authority.selectedItemIds].sort(), [...ids].sort());
    for (const item of changed) {
      const bound = authority.items.find(i => i.itemId === item.itemId)!;
      assert.deepEqual(bound.arguments, item.arguments); assert.equal(bound.action, item.action); assert.equal(bound.adapterVersion, adapterVersion(item.action));
      assert.match(bound.resourceVersion, /^[a-f0-9]{64}$/); assert.match(bound.policyVersion, /^[a-f0-9]{64}$/);
      const [step] = await db.select().from(aiStep).where(eq(aiStep.id, bound.stepId));
      assert.equal(step.runId, runId); assert.equal(step.organizationId, org.id); assert.equal(step.ownerId, owner.id); assert.equal(step.toolName, item.action); assert.deepEqual(step.requiredPermissions, actionPermissions(item.action));
      assert.equal(step.state, "prepared"); assert.equal(step.input, null); assert.equal(step.dispatchLease, null);
      const displayed = view.batch.display.items.find((i: { itemId: string }) => i.itemId === item.itemId);
      assert.equal(displayed.stepId, bound.stepId); assert.equal(displayed.preview.action, item.action); assert.equal(displayed.preview.expiresAt, view.batch.expiresAt);
      if (item.action === "settle_document") { assert.equal(displayed.preview.payment.amountMinor, "750"); assert.equal(displayed.preview.date, "2026-10-21"); assert.equal(displayed.preview.reference, "REVISED"); }
      if (item.action === "email_invoice") { assert.equal(displayed.preview.target.id, replacementEmail.id); assert.deepEqual(displayed.preview.recipients, [{ email: party.email, name: party.name }]); }
    }
    const oldSteps = await db.select().from(aiStep).where(eq(aiStep.runId, runId)); assert.equal(oldSteps.filter(s => s.state === "skipped").length, 6);
    assert.doesNotMatch(JSON.stringify(view), /"arguments"|"argumentDigest"|credential|leaseOwner/);
    assert.deepEqual(await unchanged(() => mcp("revise_ai_action_batch", { runId, ...selection }), true), receipt);
    assert.equal((await unchanged(() => revise(runId, { ...selection, requestKey: `stale-${++seq}` }), true)).code, "BATCH_CONFLICT");
    assert.equal((await unchanged(() => revise(runId, { ...selection, items }), true)).code, "BATCH_CONFLICT");
    // Competing complete revisions use distinct keys and exact, different amounts.
    const left = patch(view, changed), right = { ...left, requestKey: `race-${++seq}`, items: changed.map(i => i.action === "settle_document" ? { ...i, arguments: { ...i.arguments, amountMinor: "800" } } : i) };
    const results = await unchanged(() => Promise.all([revise(runId, left), mcp("revise_ai_action_batch", { runId, ...right })]));
    assert.deepEqual(results.map(r => r.code).sort(), ["BATCH_CONFLICT", "BATCH_PREVIEW_RECORDED"]);
    view = await get(runId); assert.equal(view.batch.version, 3);
    const winner = results[0].code === "BATCH_PREVIEW_RECORDED" ? left : right, wonReceipt = results.find(r => r.code === "BATCH_PREVIEW_RECORDED");
    assert.deepEqual(await unchanged(() => revise(runId, winner), true), wonReceipt);
    assert.deepEqual(view.batch.display.totals[1], { currencyCode: "USD", debitAmountMinor: winner === left ? "2750" : "2850", creditAmountMinor: winner === left ? "2750" : "2850" });
    assert.equal((await unchanged(() => revise(runId, patch(view, changed)), true)).code, "BATCH_LIMIT");
    const waiting = await runRow(runId); assert.equal(waiting.state, "awaiting_approval"); assert.equal(waiting.leaseOwner, null); assert.equal(waiting.deadlineAt!.toISOString(), initial.run.deadlineAt!.toISOString());
    assert.deepEqual(waiting.identity, initial.run.identity); assert.deepEqual(waiting.config, initial.run.config);
    assert.equal(waiting.startedAt!.toISOString(), initial.run.startedAt!.toISOString()); assert.equal(waiting.requestDigest, initial.run.requestDigest); assert.equal(waiting.payloadBytes > 0, true);
    login(other.id); assert.equal((await get(runId)).code, "BATCH_NOT_FOUND"); assert.equal((await data(await getRoute.GET(request(undefined, foreign.id), params(runId)))).code, "BATCH_NOT_FOUND"); login(owner.id);
    await runs.cancelRun(ctx, { runId }); await erased(runId, 3);
    process.env.AI_RUNTIME_ENABLED = "false";
    assert.deepEqual(await unchanged(() => revise(runId, winner), true), wonReceipt); assert.equal((await get(runId)).code, "BATCH_UNAVAILABLE");
    process.env.AI_RUNTIME_ENABLED = "true";
    // Revision holds the run while blocked on step UPDATE; Stop must erase the
    // newly inserted revision as well as its historical predecessor.
    const race = await propose(), stepLock = await pool.connect();
    await stepLock.query("begin"); await stepLock.query("lock table ai_step in share mode");
    const pendingRevision = revise(race.run.id, patch(race.view, changed)); let stopping: ReturnType<typeof runs.cancelRun> | undefined;
    try {
      await waitForLock('update "ai_step"%'); stopping = runs.cancelRun(ctx, { runId: race.run.id });
      await waitForLock('%from "ai_run"%for update%');
    } finally { await stepLock.query("rollback"); stepLock.release(); }
    assert.equal((await pendingRevision).code, "BATCH_PREVIEW_RECORDED"); await stopping; await erased(race.run.id, 2); assert.equal((await runRow(race.run.id)).state, "cancelled");
    // Reverse lock order: a committed Stop prevents a waiting revision from
    // recreating authority. Observe both real run-lock waits before releasing.
    const stoppedFirst = await propose(), runLock = await pool.connect();
    await runLock.query("begin"); await runLock.query('select id from ai_run where id=$1 for update', [stoppedFirst.run.id]);
    const cancellation = runs.cancelRun(ctx, { runId: stoppedFirst.run.id });
    let lateRevision: ReturnType<typeof revise> | undefined;
    try {
      await waitForLock('%from "ai_run"%for update%'); lateRevision = revise(stoppedFirst.run.id, patch(stoppedFirst.view, changed));
      let bothWaiting = false;
      for (let n = 0; n < 200; n++) {
        const r = await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%from \"ai_run\"%for update%' and pid<>pg_backend_pid()");
        if (r.rows[0].n >= 2) { bothWaiting = true; break; } await delay(10);
      }
      assert.equal(bothWaiting, true);
    } finally { await runLock.query("rollback"); runLock.release(); }
    await cancellation; assert.equal((await lateRevision).code, "BATCH_CONFLICT"); await erased(stoppedFirst.run.id, 1);
    // Retention must erase all versions, including replaced resources/arguments.
    for (const mode of ["delete", "content", "expiry"] as const) {
      const fixture = await propose(); await revise(fixture.run.id, patch(fixture.view, changed));
      if (mode === "delete") { await store.deleteConversation(ctx, fixture.c.id); assert.equal((await get(fixture.run.id)).code, "BATCH_NOT_FOUND"); }
      else {
        if (mode === "content") await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() - 1) }).where(eq(aiConversation.id, fixture.c.id));
        else await db.update(aiActionBatch).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(aiActionBatch.runId, fixture.run.id));
        const restart = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-action-storage-acceptance-worker.ts", "--maintenance-only"], { env: process.env, encoding: "utf8", timeout: 30000 });
        assert.equal(restart.status, 0, `${restart.stdout}\n${restart.stderr}`); assert.match(restart.stdout, /Versioned mixed storage maintenance verified/);
        assert.equal((await runRow(fixture.run.id)).state, "expired");
      }
      await erased(fixture.run.id, 2);
      assert.equal((await unchanged(() => revise(fixture.run.id, patch(fixture.view, changed)), true)).batch, null);
    }
    assert.deepEqual(await hashes(immutableBusiness), businessBefore);
    for (const table of ["payment", "document_email_log", "ai_approval", "ai_usage_attempt", "ai_provider_attempt", "ai_provider_call"]) assert.equal((await pool.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
    console.log("Versioned mixed storage REST/MCP/SQL acceptance verified");
  } finally { await client.close(); await server.close(); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
