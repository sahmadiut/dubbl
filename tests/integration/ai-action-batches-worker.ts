import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, journalEntry, journalLine, aiProvider, aiProviderConfig, aiToolPolicy, aiActionBatch, aiRun, aiStep, aiConversation, aiUsageAttempt, approvalWorkflow, approvalWorkflowStep, approvalRequest, approvalAction } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.argv.includes("--maintenance-only")) { await runs.maintainRuns(); console.log("Fresh-process batch maintenance verified"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const getRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/route");
  const reviseRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/revise/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  for (const name of ["get_ai_action_batch", "revise_ai_action_batch", "request_ai_action_batch", "post_entry"]) assert.ok(!AI_TOOL_NAMES.some(n => String(n) === name));
  const [owner, coworker, outsider] = await db.insert(users).values(["owner", "coworker", "outsider"].map(name => ({ name, email: `ai045-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Batches", slug: "batch-a" }, { name: "Foreign", slug: "batch-b" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Batch owner", permissions }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: coworker.id, role: "owner" }, { organizationId: foreign.id, userId: outsider.id, role: "owner" }]);
  const [debit, credit] = await db.insert(chartAccount).values([{ organizationId: org.id, code: "100", name: "Cash", type: "asset" as const }, { organizationId: org.id, code: "200", name: "Equity", type: "equity" as const }]).returning();
  let seq = 0, journalNumber = 0;
  async function journal(currencyCode = "USD", extra: Partial<typeof journalEntry.$inferInsert> = {}) {
    const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: ++journalNumber, date: "2026-10-30", description: "Exact journal", ...extra }).returning();
    await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: debit.id, debitAmount: 1250, currencyCode }, { journalEntryId: entry.id, accountId: credit.id, creditAmount: 1250, currencyCode }]);
    return entry;
  }
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const req = (body?: unknown, organizationId = org.id, query = "") => new Request(`http://test.invalid/api/v1/ai/runs/batch${query}`, { method: body ? "POST" : "GET", headers: { "x-organization-id": organizationId, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response, status = 200) { assert.equal(response.status, status, await response.clone().text()); assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json(); }
  login(owner.id); const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  async function start() {
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Prepare a journal proposal" });
    const run = await runs.claimNextRun(); assert.equal(run?.id, r.id); return { c, run: run! };
  }
  const row = async (runId: string) => (await db.select().from(aiRun).where(eq(aiRun.id, runId)))[0];
  const stored = async (runId: string) => db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, runId)).orderBy(aiActionBatch.version);
  type Spec = Parameters<typeof batches.actionBatchSpecSchema.parse>[0];
  const first = await journal(), second = await journal("IRR"), third = await journal();
  const aId = randomUUID(), bId = randomUUID();
  const spec = { requestKey: "initial", items: [{ itemId: aId, action: "post_entry" as const, arguments: { entryId: first.id }, dependsOn: [] as string[] }, { itemId: bId, action: "post_entry" as const, arguments: { entryId: second.id }, dependsOn: [aId] }], selectedItemIds: [] as string[] };
  async function propose(specification: Spec = spec) {
    const started = await start(), receipt = await batches.requestActionBatch(started.run.id, started.run.leaseOwner!, started.run.version, specification);
    return { ...started, receipt };
  }
  const server = new McpServer({ name: "ai045", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(a), client.connect(b)]);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  async function mcp(name: string, args: Record<string, unknown>, error = false) {
    const result = await client.callTool({ name, arguments: args }); assert.equal(!!result.isError, error, JSON.stringify(result));
    return error ? result : JSON.parse((result.content as { text: string }[])[0].text);
  }
  const get = (id: string) => getRoute.GET(req(), params(id)).then(r => data(r));
  const revise = (id: string, body: object) => reviseRoute.POST(req(body), params(id)).then(r => data(r));
  const edit = (view: Awaited<ReturnType<typeof get>>, requestKey = `edit-${++seq}`) => ({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey, items: spec.items, selectedItemIds: [aId, bId] });
  async function hashes() {
    return (await pool.query(`select
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from journal_entry t) as journals,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from journal_line t) as lines,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from ai_run t) as runs,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from ai_action_batch t) as batches,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from ai_step t) as steps,
      (select count(*)::text from ai_event) as events,
      (select count(*)::text from ai_approval) as approvals,
      (select count(*)::text from ai_usage_attempt) as usage,
      (select count(*)::text from document_email_log) as emails,
      (select count(*)::text from payment) as payments,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from approval_request t) as business_requests,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from approval_action t) as business_actions,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from approval_workflow t) as business_policies,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from approval_workflow_step t) as business_steps`)).rows[0];
  }
  async function unchanged<T>(fn: () => Promise<T>) { const before = await hashes(), result = await fn(); assert.deepEqual(await hashes(), before); return result; }
  try {
    const listed = await client.listTools(); assert.ok(!listed.tools.some(t => t.name === "request_ai_action_batch"));
    const initial = await propose(), runId = initial.run.id;
    const run = await row(runId); assert.equal(run.state, "awaiting_approval"); assert.equal(run.leaseOwner, null); assert.equal(run.deadlineAt!.toISOString(), initial.run.deadlineAt!.toISOString());
    await assert.rejects(runs.assertRunLease(runId, initial.run.leaseOwner!), /lease/);
    let view = await unchanged(() => get(runId)); assert.equal(view.code, "BATCH_PREVIEW_ONLY"); assert.equal(view.batch.canApprove, false); assert.equal(view.batch.authority, "preview_only");
    assert.equal(view.batch.display.items.length, 2); assert.deepEqual(view.batch.display.totals, []); assert.ok(view.batch.display.items.every((i: { selected: boolean }) => !i.selected));
    assert.deepEqual(await unchanged(() => mcp("get_ai_action_batch", { runId })), view);
    assert.doesNotMatch(JSON.stringify(view), /"arguments"|"argumentDigest"|credential|leaseOwner|"identity"/);
    const original = (await stored(runId))[0], authority = original.authority as { items: { arguments: unknown }[] };
    assert.deepEqual(authority.items.map(i => i.arguments).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), spec.items.map(i => i.arguments).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    assert.equal((await hashes()).approvals, "0"); assert.equal((await hashes()).payments, "0"); assert.equal((await hashes()).emails, "0");
    const patch = edit(view);
    const [one, two] = await Promise.all([revise(runId, patch), mcp("revise_ai_action_batch", { runId, ...patch })]); assert.deepEqual(one, two);
    assert.equal(one.version, 2); view = await get(runId); assert.equal(view.batch.version, 2); assert.equal(view.batch.expiresAt, original.expiresAt.toISOString());
    assert.deepEqual(view.batch.display.totals, [{ currencyCode: "IRR", debitAmountMinor: "1250", creditAmountMinor: "1250" }, { currencyCode: "USD", debitAmountMinor: "1250", creditAmountMinor: "1250" }]);
    assert.equal(view.batch.display.items.filter((i: { selected: boolean }) => i.selected).length, 2);
    assert.deepEqual(await unchanged(() => revise(runId, patch)), one);
    assert.equal((await stored(runId)).length, 2);
    const states = await db.select({ state: aiStep.state }).from(aiStep).where(eq(aiStep.runId, runId)); assert.equal(states.filter(s => s.state === "prepared").length, 2); assert.equal(states.filter(s => s.state === "skipped").length, 2);
    assert.equal((await revise(runId, { ...patch, selectedItemIds: [] })).code, "BATCH_CONFLICT");
    const stale = { ...edit(view), expectedVersion: 1 }; assert.equal((await unchanged(() => revise(runId, stale))).code, "BATCH_CONFLICT");
    for (const change of [
      { selectedItemIds: [bId] }, { selectedItemIds: [aId, aId] }, { selectedItemIds: [randomUUID()] },
      { items: [spec.items[0], spec.items[0]] }, { items: [{ ...spec.items[0], dependsOn: [bId] }, spec.items[1]] },
      { items: [{ ...spec.items[0], dependsOn: [aId] }, spec.items[1]] },
      { items: [{ ...spec.items[0], dependsOn: [randomUUID()] }, spec.items[1]] },
      { items: [spec.items[0], { ...spec.items[1], arguments: spec.items[0].arguments }] },
    ]) assert.equal((await unchanged(() => revise(runId, { ...edit(view), ...change }))).code, "BATCH_INVALID");
    for (const change of [{ organizationId: foreign.id }, { approval: true }, { runId }, { items: [{ ...spec.items[0], action: "delete_entry" }] }, { items: [{ ...spec.items[0], arguments: { ...spec.items[0].arguments, amountMinor: "1" } }] }]) {
      await data(await reviseRoute.POST(req({ ...edit(view), ...change }), params(runId)), 400);
    }
    await mcp("get_ai_action_batch", { runId, organizationId: foreign.id }, true);
    await mcp("revise_ai_action_batch", { runId, ...edit(view), approved: true }, true);
    await data(await getRoute.GET(req(undefined, org.id, "?approve=true"), params(runId)), 400);
    const beforeStale = view;
    await db.update(journalEntry).set({ reference: "Resource edited without approval" }).where(eq(journalEntry.id, first.id));
    assert.equal((await unchanged(() => get(runId))).code, "BATCH_STALE");
    const refreshed = await revise(runId, { ...edit(beforeStale), items: [spec.items[0], { ...spec.items[1], arguments: { entryId: third.id } }] }); assert.equal(refreshed.version, 3);
    view = await get(runId); assert.notEqual(view.batch.bindingDigest, beforeStale.batch.bindingDigest); assert.equal(view.batch.expiresAt, original.expiresAt.toISOString());
    const raceBody = edit(view), races = await Promise.all([revise(runId, raceBody), revise(runId, { ...raceBody, requestKey: `${raceBody.requestKey}-other`, selectedItemIds: [] })]);
    assert.deepEqual(races.map(r => r.code).sort(), ["BATCH_CONFLICT", "BATCH_PREVIEW_RECORDED"]);
    view = await get(runId);
    process.env.AI_RUNTIME_ENABLED = "false"; assert.equal((await unchanged(() => get(runId))).code, "BATCH_PREVIEW_ONLY");
    assert.equal((await unchanged(() => revise(runId, edit(view)))).code, "BATCH_DISABLED");
    assert.deepEqual(await revise(runId, patch), one); process.env.AI_RUNTIME_ENABLED = "true";
    for (const permission of permissions) {
      await db.update(customRole).set({ permissions: permissions.filter(p => p !== permission) }).where(eq(customRole.id, role.id));
      assert.equal((await get(runId)).code, "BATCH_DENIED"); assert.equal((await revise(runId, edit(view))).code, "BATCH_DENIED");
    }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    login(coworker.id); assert.equal((await get(runId)).code, "BATCH_NOT_FOUND");
    login(outsider.id); assert.equal((await data(await getRoute.GET(req(undefined, foreign.id), params(runId)))).code, "BATCH_NOT_FOUND"); login(owner.id);
    const foreignEntry = await journal("USD", { organizationId: foreign.id, description: "FOREIGN_BATCH_SECRET" });
    assert.equal((await unchanged(() => revise(runId, { ...edit(view), items: [{ ...spec.items[0], arguments: { entryId: foreignEntry.id } }], selectedItemIds: [aId] }))).code, "BATCH_STALE");
    // SQL storage guards: exact scope FK, one pending row, JSON size, digest and version.
    const latest = (await stored(runId)).at(-1)!;
    for (const [bad, constraint] of [
      [{ organizationId: foreign.id }, "ai_action_batch_run_scope"], [{ ownerId: coworker.id }, "ai_action_batch_run_scope"],
      [{ version: 0 }, "ai_action_batch_version"], [{ bindingDigest: "forged" }, "ai_action_batch_digests"],
      [{ display: "x".repeat(60001) }, "ai_action_batch_display_bound"], [{ authority: "x".repeat(32769) }, "ai_action_batch_authority_bound"],
    ] as const) await assert.rejects(db.insert(aiActionBatch).values({ ...latest, id: randomUUID(), requestKey: randomUUID(), state: "superseded", version: 20, ...bad }), (err: unknown) => (err as { cause?: { constraint?: string } }).cause?.constraint === constraint);
    await assert.rejects(db.insert(aiActionBatch).values({ ...latest, id: randomUUID(), requestKey: randomUUID(), version: 20 }), (err: unknown) => (err as { cause?: { constraint?: string } }).cause?.constraint === "ai_action_batch_one_pending");
    // No display, selection or revision has changed any business record status.
    const business = await pool.query("select status,count(*)::text from journal_entry group by status"); assert.deepEqual(business.rows.map(r => r.status), ["draft"]);
    await runs.cancelRun(ctx, { runId }); const cancelled = await stored(runId); assert.ok(cancelled.every(r => r.authority === null && r.display === null));
    assert.equal((await get(runId)).code, "BATCH_UNAVAILABLE");
    assert.ok((await db.select().from(aiStep).where(eq(aiStep.runId, runId))).every(s => s.state === "skipped"));
    // Fixed-expiry maintenance survives a fresh process and never requeues work.
    const expires = await propose(); await db.update(aiActionBatch).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(aiActionBatch.runId, expires.run.id));
    assert.equal((await get(expires.run.id)).code, "BATCH_EXPIRED");
    const restart = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-action-batches-worker.ts", "--maintenance-only"], { env: process.env, encoding: "utf8", timeout: 30000 });
    assert.equal(restart.status, 0, `${restart.stdout}\n${restart.stderr}`); assert.match(restart.stdout, /Fresh-process batch maintenance verified/);
    assert.equal((await row(expires.run.id)).state, "expired"); assert.ok((await stored(expires.run.id)).every(r => r.state === "expired" && !r.authority && !r.display));
    const erased = await propose(); await store.deleteConversation(ctx, erased.c.id); assert.equal((await get(erased.run.id)).code, "BATCH_NOT_FOUND"); assert.ok((await stored(erased.run.id)).every(r => !r.authority && !r.display));
    const retained = await propose(); await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() - 1) }).where(eq(aiConversation.id, retained.c.id));
    await store.purgeExpiredContent(); assert.ok((await stored(retained.run.id)).every(r => !r.authority && !r.display));
    await runs.maintainRuns(); assert.equal((await row(retained.run.id)).state, "expired");
    // Initial proposal creation is lease-fenced and rejects prepared/uncertain work.
    const guarded = await start(); await assert.rejects(batches.requestActionBatch(guarded.run.id, randomUUID(), guarded.run.version, spec), /lease/);
    await assert.rejects(batches.requestActionBatch(guarded.run.id, guarded.run.leaseOwner!, guarded.run.version, { ...spec, selectedItemIds: [aId] }));
    await assert.rejects(batches.requestActionBatch(guarded.run.id, guarded.run.leaseOwner!, guarded.run.version + 1, spec));
    await store.prepareStep(ctx, guarded.run.id, "list_contacts", {}, ["view:data"]);
    await assert.rejects(batches.requestActionBatch(guarded.run.id, guarded.run.leaseOwner!, (await row(guarded.run.id)).version, spec));
    await runs.cancelRun(ctx, { runId: guarded.run.id });
    // Hold a lock compatible with reads but conflicting with step INSERT. A
    // revocation after preview generation must roll back already-inserted data.
    const writeWait = await start(), stepLocker = await pool.connect(); let preparing: ReturnType<typeof batches.requestActionBatch> | undefined;
    try {
      await stepLocker.query("BEGIN"); await stepLocker.query("LOCK TABLE ai_step IN SHARE MODE");
      const before = await hashes();
      preparing = batches.requestActionBatch(writeWait.run.id, writeWait.run.leaseOwner!, writeWait.run.version, spec);
      const rejected = assert.rejects(preparing);
      let blocked = false;
      for (let i = 0; i < 200; i++) { const found = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'insert into \"ai_step\"%' and pid<>pg_backend_pid()"); if (found.rowCount) { blocked = true; break; } await delay(10); }
      assert.equal(blocked, true); await db.update(customRole).set({ permissions: permissions.filter(p => p !== "post:entries") }).where(eq(customRole.id, role.id));
      await stepLocker.query("COMMIT"); await rejected;
      assert.deepEqual(await hashes(), before);
    } finally { await stepLocker.query("ROLLBACK"); stepLocker.release(); await preparing?.catch(() => undefined); }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); await runs.cancelRun(ctx, { runId: writeWait.run.id });
    const configuration = await propose();
    await db.update(aiToolPolicy).set({ enabled: false }).where(eq(aiToolPolicy.organizationId, org.id));
    assert.equal((await unchanged(async () => revise(configuration.run.id, edit(await get(configuration.run.id))))).code, "BATCH_CONFIGURATION_CHANGED");
    await db.update(aiToolPolicy).set({ enabled: true }).where(eq(aiToolPolicy.organizationId, org.id)); await runs.cancelRun(ctx, { runId: configuration.run.id });
    const corrupt = await propose();
    await db.update(aiStep).set({ toolName: "list_contacts" }).where(eq(aiStep.runId, corrupt.run.id));
    assert.equal((await get(corrupt.run.id)).code, "BATCH_UNAVAILABLE");
    await db.update(aiStep).set({ toolName: "post_entry" }).where(eq(aiStep.runId, corrupt.run.id));
    await db.update(aiActionBatch).set({ display: { fabricated: "DO_NOT_EXPOSE" } }).where(eq(aiActionBatch.runId, corrupt.run.id));
    const unavailable = await get(corrupt.run.id); assert.equal(unavailable.code, "BATCH_UNAVAILABLE"); assert.doesNotMatch(JSON.stringify(unavailable), /DO_NOT_EXPOSE/); await runs.cancelRun(ctx, { runId: corrupt.run.id });
    const capacity = await propose(); await db.update(aiRun).set({ payloadBytes: 1048575 }).where(eq(aiRun.id, capacity.run.id));
    assert.equal((await unchanged(async () => revise(capacity.run.id, edit(await get(capacity.run.id))))).code, "BATCH_LIMIT"); await runs.cancelRun(ctx, { runId: capacity.run.id });
    // Current business policy is part of durable proposal authority. No status,
    // selection, revision or metadata action constitutes resource-bound approval.
    const policyBatch = await propose(), policyRunId = policyBatch.run.id;
    let policyView = await get(policyRunId);
    const policyExpiry = policyView.batch.expiresAt;
    const [requester] = await db.select().from(member).where(eq(member.userId, owner.id));
    const [approver] = await db.select().from(member).where(eq(member.userId, coworker.id));
    const [workflow] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "HIDDEN POLICY", entityType: "journal_entry",
      conditions: [{ field: "entryNumber", operator: "eq", value: String(first.entryNumber) }] }).returning();
    const [policyStep] = await db.insert(approvalWorkflowStep).values({ workflowId: workflow.id, stepOrder: 1, approverId: approver.id }).returning();
    const stalePolicy = await unchanged(() => mcp("get_ai_action_batch", { runId: policyRunId }));
    assert.equal(stalePolicy.code, "BATCH_STALE"); assert.equal(stalePolicy.batch, null);
    assert.equal((await revise(policyRunId, edit(policyView))).code, "BATCH_PREVIEW_RECORDED");
    policyView = await get(policyRunId);
    assert.equal(policyView.batch.expiresAt, policyExpiry);
    const observations = policyView.batch.display.items as { preview: { businessApproval: { required: boolean; approvalSatisfied: boolean; policyVersion: string }; schemaVersion: number }; selected: boolean }[];
    assert.equal(observations.filter(i => i.preview.businessApproval.required).length, 1);
    assert.ok(observations.every(i => i.preview.schemaVersion === 2 && !i.preview.businessApproval.approvalSatisfied));
    const policyAuthority = (await stored(policyRunId)).at(-1)!.authority as { items: { adapterVersion: number; policyVersion: string }[] };
    assert.ok(policyAuthority.items.every(i => i.adapterVersion === 2 && /^[a-f0-9]{64}$/.test(i.policyVersion)));
    assert.doesNotMatch(JSON.stringify(policyView), /HIDDEN POLICY|approverId|workflowId|requestedById/);
    await db.update(approvalWorkflowStep).set({ isRequired: false }).where(eq(approvalWorkflowStep.id, policyStep.id));
    assert.equal((await unchanged(() => get(policyRunId))).code, "BATCH_STALE");
    assert.equal((await mcp("revise_ai_action_batch", { runId: policyRunId, ...edit(policyView) })).code, "BATCH_PREVIEW_RECORDED");
    policyView = await get(policyRunId);
    const [businessRequest] = await db.insert(approvalRequest).values({ organizationId: org.id, workflowId: workflow.id, entityType: "journal_entry", entityId: first.id, requestedById: requester.id, status: "approved" }).returning();
    assert.equal((await get(policyRunId)).code, "BATCH_STALE");
    assert.equal((await revise(policyRunId, edit(policyView))).code, "BATCH_PREVIEW_RECORDED"); policyView = await get(policyRunId);
    assert.ok(policyView.batch.display.items.every((i: { preview: { businessApproval: { approvalSatisfied: boolean; canCurrentActorApprove: boolean } } }) => !i.preview.businessApproval.approvalSatisfied && !i.preview.businessApproval.canCurrentActorApprove));
    await db.insert(approvalAction).values({ requestId: businessRequest.id, stepId: policyStep.id, userId: approver.id, action: "approve" });
    assert.equal((await unchanged(() => mcp("get_ai_action_batch", { runId: policyRunId }))).code, "BATCH_STALE");
    await db.update(approvalWorkflow).set({ conditions: [{ field: "total", operator: "gte", value: "1" }] }).where(eq(approvalWorkflow.id, workflow.id));
    assert.equal((await unchanged(() => revise(policyRunId, edit(policyView)))).code, "BATCH_STALE");
    await db.update(approvalWorkflow).set({ conditions: [], isActive: false }).where(eq(approvalWorkflow.id, workflow.id));
    const policyRevision = edit(policyView);
    assert.equal((await revise(policyRunId, policyRevision)).code, "BATCH_PREVIEW_RECORDED");
    policyView = await get(policyRunId); assert.equal(policyView.batch.expiresAt, policyExpiry);
    assert.ok(policyView.batch.display.items.every((i: { preview: { businessApproval: { required: boolean } } }) => !i.preview.businessApproval.required));
    await runs.cancelRun(ctx, { runId: policyRunId });
    // Legacy version-one proposals fail stale; explicit revision upgrades them
    // under the original expiry. This fixture constructs the documented old
    // integrity binding, which has never been execution/approval authority.
    const legacy = await propose(), legacyView = await get(legacy.run.id), legacyRow = (await stored(legacy.run.id))[0];
    const legacyAuthority = legacyRow.authority as { items: { adapterVersion: number; policyVersion?: string }[] };
    for (const i of legacyAuthority.items) { i.adapterVersion = 1; delete i.policyVersion; }
    const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v !== null && typeof v === "object"
      ? `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, value]) => `${JSON.stringify(k)}:${canonical(value)}`).join(",")}}` : JSON.stringify(v);
    const legacyBinding = createHash("sha256").update(canonical({ id: legacyRow.id, runId: legacyRow.runId, ownerId: legacyRow.ownerId, organizationId: legacyRow.organizationId,
      version: legacyRow.version, expiresAt: legacyRow.expiresAt.toISOString(), authority: legacyAuthority, display: legacyRow.display })).digest("hex");
    await db.update(aiActionBatch).set({ authority: legacyAuthority, bindingDigest: legacyBinding }).where(eq(aiActionBatch.id, legacyRow.id));
    assert.equal((await unchanged(() => get(legacy.run.id))).code, "BATCH_STALE");
    assert.equal((await revise(legacy.run.id, edit(legacyView))).code, "BATCH_PREVIEW_RECORDED");
    assert.equal((await get(legacy.run.id)).batch.expiresAt, legacyView.batch.expiresAt);
    await runs.cancelRun(ctx, { runId: legacy.run.id });
    const bigA = await journal(), bigB = await journal();
    await pool.query("update journal_line set debit_amount=case when debit_amount>0 then 9007199254740991 else 0 end,credit_amount=case when credit_amount>0 then 9007199254740991 else 0 end where journal_entry_id=any($1::uuid[])", [[bigA.id, bigB.id]]);
    const bigSpec = { ...spec, items: [{ ...spec.items[0], arguments: { entryId: bigA.id } }, { ...spec.items[1], arguments: { entryId: bigB.id } }] };
    const big = await propose(bigSpec), bigView = await get(big.run.id);
    assert.equal((await revise(big.run.id, { ...edit(bigView), items: bigSpec.items })).code, "BATCH_PREVIEW_RECORDED");
    assert.deepEqual((await get(big.run.id)).batch.display.totals, [{ currencyCode: "USD", debitAmountMinor: "18014398509481982", creditAmountMinor: "18014398509481982" }]);
    await runs.cancelRun(ctx, { runId: big.run.id });
    // Proposal bytes/steps stay bounded, and expiry cannot be reset by revision.
    const bounded = await propose({ ...spec, items: [spec.items[0]] });
    for (let i = 0; i < 19; i++) {
      const v = await get(bounded.run.id); assert.equal((await revise(bounded.run.id, { ...edit(v), items: [spec.items[0]], selectedItemIds: [aId] })).code, "BATCH_PREVIEW_RECORDED");
    }
    const v = await get(bounded.run.id); assert.equal((await unchanged(() => revise(bounded.run.id, { ...edit(v), items: [spec.items[0]], selectedItemIds: [] }))).code, "BATCH_LIMIT");
    await runs.cancelRun(ctx, { runId: bounded.run.id });
    // Revoke domain disclosure while an actual journal read waits on a table lock.
    const delayed = await propose(), locker = await pool.connect(); let waiting: ReturnType<typeof batches.getActionBatch> | undefined;
    try {
      await locker.query("BEGIN"); await locker.query("LOCK TABLE journal_line IN ACCESS EXCLUSIVE MODE"); waiting = batches.getActionBatch(ctx, { runId: delayed.run.id });
      let blocked = false;
      for (let i = 0; i < 200; i++) { const found = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%from \"journal_line\"%' and pid<>pg_backend_pid()"); if (found.rowCount) { blocked = true; break; } await delay(10); }
      assert.equal(blocked, true); await db.update(customRole).set({ permissions: permissions.filter(p => p !== "view:data") }).where(eq(customRole.id, role.id));
      await locker.query("COMMIT"); assert.equal((await waiting).code, "BATCH_DENIED");
    } finally { await locker.query("ROLLBACK"); locker.release(); await waiting; }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); await runs.cancelRun(ctx, { runId: delayed.run.id });
    assert.equal((await hashes()).approvals, "0"); assert.equal((await hashes()).payments, "0"); assert.equal((await hashes()).emails, "0");
    assert.equal((await db.select().from(aiUsageAttempt)).length, 0);
    session = null; await data(await getRoute.GET(req(), params(runId)), 401);
    console.log("AI batch REST/MCP/SQL verified");
  } finally { await client.close(); await server.close(); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
