import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, journalEntry, journalLine, aiProvider, aiProviderConfig, aiToolPolicy,
  aiActionBatch, aiActionDecision, aiActionConsumption, aiRun, aiStep, aiEvent, approvalWorkflow, approvalWorkflowStep } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.env.AI049_RECOVER === "true") { await runs.maintainRuns(); console.log("Fresh process recovered consumed operation"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const [owner, other] = await db.insert(users).values(["owner", "other"].map(name => ({ name, email: `ai049-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Consume", slug: "consume" }, { name: "Foreign", slug: "foreign" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries", "edit:entries"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Operator", permissions }).returning();
  const [ownerMember] = await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: other.id, role: "owner" }]).returning();
  const [debit, credit] = await db.insert(chartAccount).values([{ organizationId: org.id, code: "100", name: "Cash", type: "asset" as const }, { organizationId: org.id, code: "200", name: "Equity", type: "equity" as const }]).returning();
  let seq = 0;
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: unknown) => new Request("http://test.invalid/api/v1/ai/runs/consume", { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-31" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  const server = new McpServer({ name: "ai049", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  async function mcp(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  const runRow = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const stepRows = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id)).orderBy(aiStep.id);
  const consumedRows = (id: string) => db.select().from(aiActionConsumption).where(eq(aiActionConsumption.runId, id));
  const decisionBody = (view: Awaited<ReturnType<typeof mcp>>) => ({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, bindingDigest: view.batch.bindingDigest,
    selectedItemIds: view.batch.display.items.filter((i: { selected: boolean }) => i.selected).map((i: { itemId: string }) => i.itemId).sort(), requestKey: `approve-${++seq}` });
  async function propose(approve = true, deletion = false, ttl?: number) {
    const items: { itemId: string; action: "post_entry" | "delete_draft_journal"; arguments: { entryId: string }; dependsOn: string[] }[] = [];
    for (let n = 0; n < 3; n++) {
      const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: ++seq, date: "2026-10-31", description: "Consumption journal" }).returning();
      await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: debit.id, debitAmount: 1250, currencyCode: "USD" }, { journalEntryId: entry.id, accountId: credit.id, creditAmount: 1250, currencyCode: "USD" }]);
      items.push({ itemId: randomUUID(), action: deletion ? "delete_draft_journal" as const : "post_entry" as const, arguments: { entryId: entry.id }, dependsOn: n === 1 ? [items[0].itemId] : [] });
    }
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Prepare actions" });
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, r.id);
    if (ttl) await db.update(aiRun).set({ deadlineAt: new Date(Date.now() + ttl) }).where(eq(aiRun.id, r.id));
    await batches.requestActionBatch(r.id, claimed!.leaseOwner!, claimed!.version, { requestKey: "initial", items, selectedItemIds: [] });
    let view = await mcp("get_ai_action_batch", { runId: r.id });
    await mcp("revise_ai_action_batch", { runId: r.id, batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: "selection", items, selectedItemIds: items.slice(0, 2).map(i => i.itemId) });
    view = await mcp("get_ai_action_batch", { runId: r.id });
    if (approve) {
      const response = await approveRoute.POST(req(decisionBody(view)), { params: Promise.resolve({ id: r.id }) });
      assert.equal(response.status, 200); assert.equal((await response.json()).code, "DECISION_APPROVED");
    }
    return { id: r.id, view, items, c };
  }
  // Foundation qualification supplies this SQL setup explicitly. No application
  // resume route, automatic queue transition or sensitive worker dispatch exists.
  async function claim(p: Awaited<ReturnType<typeof propose>>) {
    await db.update(aiRun).set({ state: "queued" }).where(eq(aiRun.id, p.id));
    const r = await runs.claimNextRun(); assert.equal(r?.id, p.id);
    return { runId: p.id, lease: r!.leaseOwner!, batchId: p.view.batch.id, itemId: p.items[0].itemId };
  }
  async function hashes() {
    const tables = ["journal_entry", "journal_line", "payment", "document_email_log", "approval_request", "approval_action", "ai_provider_attempt", "ai_provider_call", "ai_usage_attempt"];
    return Object.fromEntries(await Promise.all(tables.map(async t => [t, (await pool.query(`select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) as hash from ${t} t`)).rows[0].hash])));
  }
  async function unchanged(p: Awaited<ReturnType<typeof propose>>, fn: () => Promise<unknown>) {
    const before = { r: await runRow(p.id), s: await stepRows(p.id), c: await consumedRows(p.id), events: await db.select().from(aiEvent).where(eq(aiEvent.runId, p.id)) };
    await assert.rejects(fn);
    assert.deepEqual({ r: await runRow(p.id), s: await stepRows(p.id), c: await consumedRows(p.id), events: await db.select().from(aiEvent).where(eq(aiEvent.runId, p.id)) }, before);
  }
  async function waitForInsert() {
    for (let i = 0; i < 300; i++) {
      if ((await pool.query("select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like 'insert into \"ai_action_consumption\"%'")).rowCount) return;
      await delay(10);
    }
    throw new Error("No real consumption INSERT lock wait");
  }
  try {
    const toolNames = (await client.listTools()).tools.map(t => t.name);
    assert.ok(!toolNames.includes("consume_approved_action")); assert.ok(!toolNames.includes("settle_approved_action"));
    const p = await propose(), input = await claim(p), beforeBusiness = await hashes();
    await unchanged(p, () => batches.consumeApprovedAction({ ...input, itemId: p.items[1].itemId })); // dependency has no receipt
    await unchanged(p, () => batches.consumeApprovedAction({ ...input, itemId: p.items[2].itemId })); // unselected
    await unchanged(p, () => batches.consumeApprovedAction({ ...input, lease: randomUUID() }));
    await unchanged(p, () => batches.consumeApprovedAction({ ...input, arguments: { entryId: randomUUID() } }));
    const uppercase = Object.fromEntries(Object.entries(input).map(([k, value]) => [k, value.toUpperCase()]));
    const pair = await Promise.all([batches.consumeApprovedAction(input), batches.consumeApprovedAction(uppercase)]);
    const fresh = pair.find(r => r.code === "ACTION_CONSUMED")!;
    assert.equal(pair.filter(r => r.code === "ACTION_CONSUMED").length, 1); assert.equal(pair.filter(r => r.code === "ACTION_ALREADY_CONSUMED").length, 1);
    assert.ok("action" in fresh); assert.deepEqual(fresh.action, p.items[0]);
    const retry = await batches.consumeApprovedAction(input); assert.equal(retry.code, "ACTION_ALREADY_CONSUMED"); assert.ok(!("action" in retry));
    assert.equal((await consumedRows(p.id)).length, 1);
    const consumed = (await consumedRows(p.id))[0]; assert.doesNotMatch(JSON.stringify(consumed), /entryId|1250|credential|arguments|description/);
    await unchanged(p, () => batches.consumeApprovedAction({ ...input, itemId: p.items[1].itemId }));
    const firstReceipt = await batches.settleApprovedAction(p.id, input.lease, fresh.consumptionId, { state: "succeeded", recordIds: [p.items[0].arguments.entryId] });
    assert.equal(firstReceipt.state, "succeeded");
    assert.deepEqual(await batches.settleApprovedAction(p.id, input.lease, fresh.consumptionId, { state: "failed", recordIds: [] }), firstReceipt);
    await unchanged(p, () => batches.settleApprovedAction(p.id, randomUUID(), fresh.consumptionId, { state: "failed", recordIds: [] }));
    const second = await batches.consumeApprovedAction({ ...input, itemId: p.items[1].itemId }); assert.equal(second.code, "ACTION_CONSUMED");
    await batches.settleApprovedAction(p.id, input.lease, second.consumptionId, { state: "failed", recordIds: [] });
    assert.equal((await runRow(p.id)).state, "failed");
    assert.deepEqual((await stepRows(p.id)).find(s => s.id === firstReceipt.stepId)?.recordIds, firstReceipt.recordIds);
    assert.deepEqual(await hashes(), beforeBusiness); // receipts are simulated trusted callbacks, no domain execution claimed
    assert.equal((await db.select().from(aiActionBatch).where(eq(aiActionBatch.id, input.batchId)))[0].authority, null);

    // Composite FKs bind both decision and step to the same run/tenant/owner.
    const target = await propose(), targetInput = await claim(target), targetDecision = (await db.select().from(aiActionDecision).where(eq(aiActionDecision.runId, target.id)))[0];
    const targetStep = (await stepRows(target.id))[0];
    const base = { decisionId: targetDecision.id, batchId: targetDecision.batchId, runId: target.id, organizationId: org.id, ownerId: owner.id, stepId: targetStep.id, itemId: target.items[0].itemId, dispatchLease: targetInput.lease, argumentDigest: "a".repeat(64), resourceVersion: "b".repeat(64), policyVersion: "c".repeat(64) };
    for (const [bad, constraint] of [[{ ownerId: other.id }, "ai_action_consumption_decision_scope"], [{ organizationId: foreign.id }, "ai_action_consumption_decision_scope"], [{ stepId: (await stepRows(p.id)).find(s => s.state === "skipped")!.id }, "ai_action_consumption_step_scope"], [{ argumentDigest: "x" }, "ai_action_consumption_digests"]] as const) {
      await assert.rejects(db.insert(aiActionConsumption).values({ ...base, ...bad }), (err: unknown) => { assert.equal((err as { cause?: { constraint?: string } }).cause?.constraint, constraint); return true; });
    }
    await runs.cancelRun(ctx, { runId: target.id });

    for (const mode of ["missing", "stale", "revoked", "expired", "policy", "disabled", "config", "fake-prerequisite", "rejected", "session", "batch-expired"] as const) {
      const q = await propose(mode !== "missing" && mode !== "rejected", false, mode === "batch-expired" ? 4000 : undefined);
      if (mode === "rejected") await mcp("reject_ai_action_batch", { runId: q.id, ...decisionBody(q.view) });
      const args = mode === "rejected" ? { runId: q.id, lease: randomUUID(), batchId: q.view.batch.id, itemId: q.items[0].itemId } : await claim(q);
      if (mode === "stale") await db.update(journalEntry).set({ description: "Edited without updatedAt" }).where(eq(journalEntry.id, q.items[0].arguments.entryId));
      if (mode === "revoked") await db.update(customRole).set({ permissions: permissions.filter(p => p !== "post:entries") }).where(eq(customRole.id, role.id));
      if (mode === "expired") await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, q.id));
      let workflow: string | undefined;
      if (mode === "policy") {
        const [w] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "New policy", entityType: "journal_entry", conditions: [], isActive: true }).returning(); workflow = w.id;
        await db.insert(approvalWorkflowStep).values({ workflowId: w.id, stepOrder: 1, approverId: ownerMember.id });
      }
      if (mode === "disabled") process.env.AI_RUNTIME_ENABLED = "false";
      if (mode === "session") await db.update(users).set({ sessionRevokedAt: new Date() }).where(eq(users.id, owner.id));
      if (mode === "batch-expired") await delay(4100);
      if (mode === "config") await db.update(aiProvider).set({ version: provider.version + 1 }).where(eq(aiProvider.id, provider.id));
      if (mode === "fake-prerequisite") {
        const authority = (await db.select().from(aiActionBatch).where(eq(aiActionBatch.id, args.batchId)))[0].authority as { items: { stepId: string; itemId: string }[] };
        await db.update(aiStep).set({ state: "succeeded" }).where(eq(aiStep.id, authority.items.find(i => i.itemId === q.items[0].itemId)!.stepId)); args.itemId = q.items[1].itemId;
      }
      await unchanged(q, () => batches.consumeApprovedAction(args));
      process.env.AI_RUNTIME_ENABLED = "true";
      await db.update(users).set({ sessionRevokedAt: null }).where(eq(users.id, owner.id));
      await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
      await db.update(aiProvider).set({ version: provider.version }).where(eq(aiProvider.id, provider.id));
      if (workflow) await db.delete(approvalWorkflow).where(eq(approvalWorkflow.id, workflow));
      await runs.cancelRun(ctx, { runId: q.id });
    }

    // An old immutable decision cannot consume the superseding revision.
    const revised = await propose();
    await mcp("revise_ai_action_batch", { runId: revised.id, batchId: revised.view.batch.id, expectedVersion: revised.view.batch.version, expectedRunVersion: (await runRow(revised.id)).version, requestKey: "new-selection", items: revised.items, selectedItemIds: revised.items.slice(0, 2).map(i => i.itemId) });
    const revisedInput = await claim(revised);
    await unchanged(revised, () => batches.consumeApprovedAction(revisedInput));
    const latest = (await db.select().from(aiActionBatch).where(and(eq(aiActionBatch.runId, revised.id), eq(aiActionBatch.state, "pending"))))[0];
    await unchanged(revised, () => batches.consumeApprovedAction({ ...revisedInput, batchId: latest.id }));
    await runs.cancelRun(ctx, { runId: revised.id });

    // Late live checks run after a real SQL INSERT wait and roll back the fence.
    for (const mode of ["revoked", "resource", "lease"] as const) {
      const q = await propose(), args = await claim(q), locked = await pool.connect();
      if (mode === "lease") await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() + 1500) }).where(eq(aiRun.id, q.id));
      const beforeWaitSteps = await stepRows(q.id);
      await locked.query("begin"); await locked.query("lock table ai_action_consumption in share mode");
      const pending = batches.consumeApprovedAction(args); const observed = pending.then(value => ({ value }), error => ({ error }));
      try {
        await waitForInsert();
        if (mode === "revoked") await db.update(customRole).set({ permissions: permissions.filter(p => p !== "post:entries") }).where(eq(customRole.id, role.id));
        if (mode === "resource") await db.update(journalEntry).set({ description: "Edited while INSERT waited" }).where(eq(journalEntry.id, q.items[0].arguments.entryId));
        if (mode === "lease") await delay(1700); // real run lease expires during wait
      } finally { await locked.query("rollback"); locked.release(); }
      assert.ok("error" in await observed); assert.equal((await consumedRows(q.id)).length, 0);
      assert.deepEqual(await stepRows(q.id), beforeWaitSteps);
      await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
      await runs.cancelRun(ctx, { runId: q.id });
    }

    // Stop preserves a confirmed effect; an in-flight known receipt may settle
    // after authority erasure, but it cannot launch its unconsumed dependent.
    const stopped = await propose(true, true), stoppedArgs = await claim(stopped), stoppedFirst = await batches.consumeApprovedAction(stoppedArgs);
    await runs.cancelRun(ctx, { runId: stopped.id });
    assert.equal((await runRow(stopped.id)).state, "running");
    assert.equal((await batches.settleApprovedAction(stopped.id, stoppedArgs.lease, stoppedFirst.consumptionId, { state: "succeeded", recordIds: [] })).state, "succeeded");
    assert.equal((await runRow(stopped.id)).state, "cancelled");
    await unchanged(stopped, () => batches.consumeApprovedAction({ ...stoppedArgs, itemId: stopped.items[1].itemId }));

    const cancelled = await propose(), cancelledArgs = await claim(cancelled);
    await runs.cancelRun(ctx, { runId: cancelled.id });
    await unchanged(cancelled, () => batches.consumeApprovedAction(cancelledArgs));

    const unsure = await propose(), unsureArgs = await claim(unsure), unsureClaim = await batches.consumeApprovedAction(unsureArgs);
    const unsureReceipt = await batches.settleApprovedAction(unsure.id, unsureArgs.lease, unsureClaim.consumptionId, { state: "uncertain", recordIds: [] });
    assert.equal(unsureReceipt.state, "uncertain"); assert.equal((await runRow(unsure.id)).state, "reconciliation_required");
    assert.ok((await stepRows(unsure.id)).filter(s => s.id !== unsureReceipt.stepId).every(s => s.state === "skipped"));
    await unchanged(unsure, () => batches.consumeApprovedAction({ ...unsureArgs, itemId: unsure.items[1].itemId }));
    assert.deepEqual(await batches.settleApprovedAction(unsure.id, unsureArgs.lease, unsureClaim.consumptionId, { state: "succeeded", recordIds: [] }), unsureReceipt);

    // Fresh-process maintenance turns a lost executing handoff into uncertainty.
    const lost = await propose(), lostArgs = await claim(lost), lostClaim = await batches.consumeApprovedAction(lostArgs);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, lost.id));
    const recovery = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-action-consumption-worker.ts"], { env: { ...process.env, AI049_RECOVER: "true" }, encoding: "utf8", timeout: 30000 });
    assert.equal(recovery.status, 0, recovery.stdout + recovery.stderr); assert.match(recovery.stdout, /Fresh process recovered/);
    assert.equal((await runRow(lost.id)).state, "reconciliation_required");
    const uncertain = (await stepRows(lost.id)).find(s => s.id === lostClaim.stepId)!; assert.equal(uncertain.state, "uncertain");
    assert.equal((await batches.settleApprovedAction(lost.id, lostArgs.lease, lostClaim.consumptionId, { state: "succeeded", recordIds: [] })).state, "uncertain");
    await unchanged(lost, () => batches.consumeApprovedAction(lostArgs)); assert.equal(await runs.claimNextRun(), null);
    assert.deepEqual((await consumedRows(lost.id)).map(c => c.id), [lostClaim.consumptionId]);
    console.log("AI consumption decisions/SQL/restart verified");
  } finally { await client.close(); await server.close(); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
