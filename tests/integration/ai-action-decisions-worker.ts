import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, journalEntry, journalLine, aiProvider, aiProviderConfig, aiToolPolicy,
  aiActionBatch, aiActionDecision, aiRun, aiStep, approvalWorkflow, approvalWorkflowStep, approvalRequest, mcpAccessToken } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  const { getAuthContext } = await import("../../lib/api/auth-context"), { resolveExecutionIdentity } = await import("../../lib/api/execution-identity");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route"), rejectRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/reject/route");
  const getRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/route"), reviseRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/revise/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  for (const name of ["approve_ai_action_batch", "reject_ai_action_batch"]) assert.ok(!AI_TOOL_NAMES.some(n => String(n) === name));
  const [owner, coworker, outsider] = await db.insert(users).values(["owner", "coworker", "outsider"].map(name => ({ name, email: `ai043-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Decisions", slug: "decisions-a" }, { name: "Foreign", slug: "decisions-b" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries", "edit:entries"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Decision owner", permissions }).returning();
  const [ownerMember, otherMember] = await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: coworker.id, role: "owner" }, { organizationId: foreign.id, userId: outsider.id, role: "owner" }]).returning();
  const [debit, credit] = await db.insert(chartAccount).values([{ organizationId: org.id, code: "100", name: "Cash", type: "asset" as const }, { organizationId: org.id, code: "200", name: "Equity", type: "equity" as const }]).returning();
  let seq = 0;
  async function journal() {
    const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: ++seq, date: "2026-10-30", description: "Decision journal" }).returning();
    await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: debit.id, debitAmount: 1250, currencyCode: "USD" }, { journalEntryId: entry.id, accountId: credit.id, creditAmount: 1250, currencyCode: "USD" }]);
    return entry;
  }
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const req = (body?: unknown, organizationId = org.id, query = "") => new Request(`http://test.invalid/api/v1/ai/runs/decision${query}`, { method: body ? "POST" : "GET", headers: { "x-organization-id": organizationId, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response, status = 200) { assert.equal(response.status, status, await response.clone().text()); assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json(); }
  login(owner.id); const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  const [config] = await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" }).returning();
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const clients: Client[] = [], servers: McpServer[] = [];
  async function connect(context: typeof ctx) {
    const server = new McpServer({ name: "ai043", version: "1" }); registerAiActionPreviewTools(server, context);
    const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]); clients.push(client); servers.push(server);
    return async (name: string, args: Record<string, unknown>, error = false) => {
      const result = await client.callTool({ name, arguments: args }); assert.equal(!!result.isError, error, JSON.stringify(result));
      return error ? result : JSON.parse((result.content as { text: string }[])[0].text);
    };
  }
  const mcp = await connect(ctx);
  const get = (id: string) => getRoute.GET(req(), params(id)).then(r => data(r));
  const decide = (id: string, body: object, reject = false) => (reject ? rejectRoute : approveRoute).POST(req(body), params(id)).then(r => data(r));
  const row = async (runId: string) => (await db.select().from(aiRun).where(eq(aiRun.id, runId)))[0];
  const steps = (runId: string) => db.select().from(aiStep).where(eq(aiStep.runId, runId)).orderBy(aiStep.id);
  const body = (view: Awaited<ReturnType<typeof get>>, requestKey = `decide-${++seq}`) => ({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, bindingDigest: view.batch.bindingDigest,
    selectedItemIds: view.batch.display.items.filter((i: { selected: boolean }) => i.selected).map((i: { itemId: string }) => i.itemId).sort(), requestKey });
  async function propose(selected = true, deletion = false, ttl?: number) {
    const entries = [await journal(), await journal()], a = randomUUID(), b = randomUUID();
    const items = entries.map((e, index) => ({ itemId: index ? b : a, action: deletion ? "delete_draft_journal" as const : "post_entry" as const, arguments: { entryId: e.id }, dependsOn: index ? [a] : [] }));
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Prepare a proposal" });
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, r.id);
    if (ttl) await db.update(aiRun).set({ deadlineAt: new Date(Date.now() + ttl) }).where(eq(aiRun.id, r.id));
    await batches.requestActionBatch(r.id, claimed!.leaseOwner!, claimed!.version, { requestKey: "initial", items, selectedItemIds: [] });
    let view = await get(r.id);
    if (selected) {
      await data(await reviseRoute.POST(req({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: `select-${++seq}`, items, selectedItemIds: [a, b] }), params(r.id)));
      view = await get(r.id);
    }
    return { id: r.id, view, items, entries, c };
  }
  async function hashes(ai = true) {
    const tables = ["journal_entry", "journal_line", "payment", "document_email_log", "approval_request", "approval_action", "approval_workflow", "approval_workflow_step", "ai_usage_attempt", "ai_provider_attempt", "ai_provider_call", "ai_approval",
      ...(ai ? ["ai_action_decision", "ai_action_batch", "ai_step", "ai_run", "ai_event"] : [])];
    return Object.fromEntries(await Promise.all(tables.map(async t => [t, (await pool.query(`select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) as hash from ${t} t`)).rows[0].hash])));
  }
  async function unchanged<T>(fn: () => Promise<T>) { const before = await hashes(), result = await fn(); assert.deepEqual(await hashes(), before); return result; }
  async function waitFor(query: string) {
    for (let i = 0; i < 200; i++) { if ((await pool.query(query)).rowCount) return; await delay(10); }
    throw new Error("Expected real SQL lock wait");
  }
  try {
    // Real registered MCP with a server-bound session exercises shared positive
    // semantics; production OAuth-token MCP is separately denied below.
    const initial = await propose(), input = body(initial.view), beforeRun = await row(initial.id), beforeBusiness = await hashes(false);
    const [rest, linked] = await Promise.all([decide(initial.id, input), mcp("approve_ai_action_batch", { runId: initial.id, ...input })]);
    assert.deepEqual(rest, linked); assert.equal(rest.code, "DECISION_APPROVED"); assert.equal(rest.authority, "decision_only");
    assert.deepEqual(await hashes(false), beforeBusiness);
    const after = await row(initial.id); assert.equal(after.state, "awaiting_approval"); assert.equal(after.version, beforeRun.version + 1);
    assert.equal(initial.view.batch.canApprove, true);
    const decidedView = await get(initial.id); assert.equal(decidedView.batch.canApprove, false); assert.deepEqual(decidedView.batch.decision, rest);
    for (const key of ["startedAt", "deadlineAt", "payloadBytes", "identity", "config", "requestDigest"] as const) assert.deepEqual(after[key], beforeRun[key]);
    assert.equal(after.leaseOwner, null); assert.equal(await runs.claimNextRun(), null);
    assert.deepEqual(await unchanged(() => decide(initial.id, input)), rest);
    assert.equal((await unchanged(() => decide(initial.id, { ...input, requestKey: "different" }))).code, "BATCH_CONFLICT");
    assert.equal((await unchanged(() => decide(initial.id, input, true))).code, "BATCH_CONFLICT");
    assert.equal((await unchanged(() => decide(initial.id, { ...input, selectedItemIds: [] }))).code, "BATCH_CONFLICT");
    const recorded = (await db.select().from(aiActionDecision).where(eq(aiActionDecision.runId, initial.id)))[0];
    assert.equal(recorded.bindingDigest, input.bindingDigest); assert.equal(recorded.ownerId, owner.id); assert.equal(recorded.organizationId, org.id);
    assert.equal(recorded.batchVersion, input.expectedVersion); assert.equal(recorded.expiresAt.toISOString(), initial.view.batch.expiresAt);
    assert.doesNotMatch(JSON.stringify(rest), /arguments|credential|resourceVersion|policyVersion|recipient|1250/);
    for (const [bad, constraint] of [[{ ownerId: coworker.id }, "ai_action_decision_batch_scope"], [{ organizationId: foreign.id }, "ai_action_decision_batch_scope"], [{ bindingDigest: "x" }, "ai_action_decision_digests"]] as const) {
      // A second synthetic scope requires another valid batch to avoid the
      // intentional unique-batch constraint masking the FK under inspection.
      const target = await propose();
      await assert.rejects(db.insert(aiActionDecision).values({ ...recorded, id: randomUUID(), runId: target.id, batchId: target.view.batch.id, requestKey: randomUUID(), ...bad }),
        (err: unknown) => (err as { cause?: { constraint?: string } }).cause?.constraint === constraint);
      await runs.cancelRun(ctx, { runId: target.id });
    }
    // Old approvals have no authority over a revision, and historical receipt
    // retries cannot re-approve the changed action set or queue anything.
    const refreshed = await get(initial.id);
    await data(await reviseRoute.POST(req({ batchId: refreshed.batch.id, expectedVersion: refreshed.batch.version, expectedRunVersion: refreshed.runVersion, requestKey: "after-approval", items: initial.items, selectedItemIds: [] }), params(initial.id)));
    assert.deepEqual(await unchanged(() => decide(initial.id, input)), rest);
    assert.equal((await get(initial.id)).batch.version, input.expectedVersion + 1);
    await runs.cancelRun(ctx, { runId: initial.id });
    process.env.AI_RUNTIME_ENABLED = "false";
    assert.deepEqual(await unchanged(() => decide(initial.id, input)), rest); process.env.AI_RUNTIME_ENABLED = "true";

    // Competing decisions serialize; one immutable receipt/event wins.
    const race = await propose(), raceInput = body(race.view);
    const outcomes = await Promise.all([decide(race.id, raceInput), mcp("reject_ai_action_batch", { runId: race.id, ...raceInput, requestKey: "competing" })]);
    assert.equal(outcomes.filter(o => ["DECISION_APPROVED", "DECISION_REJECTED"].includes(o.code)).length, 1);
    assert.equal(outcomes.filter(o => o.code === "BATCH_CONFLICT").length, 1);
    assert.equal((await db.select().from(aiActionDecision).where(eq(aiActionDecision.runId, race.id))).length, 1);
    await runs.cancelRun(ctx, { runId: race.id });

    const rejecting = await propose(), rejectInput = body(rejecting.view);
    await db.insert(aiStep).values({ runId: rejecting.id, organizationId: org.id, ownerId: owner.id, toolName: "list_contacts", state: "succeeded", result: { value: { code: "completed" }, digest: "0".repeat(64), bytes: 20, truncated: false }, requiredPermissions: [] });
    const completed = (await steps(rejecting.id)).find(s => s.state === "succeeded");
    process.env.AI_RUNTIME_ENABLED = "false";
    const rejected = await mcp("reject_ai_action_batch", { runId: rejecting.id, ...rejectInput }); assert.equal(rejected.code, "DECISION_REJECTED");
    assert.deepEqual(await unchanged(() => decide(rejecting.id, rejectInput, true)), rejected);
    assert.deepEqual((await steps(rejecting.id)).find(s => s.state === "succeeded"), completed);
    assert.ok((await steps(rejecting.id)).filter(s => s.id !== completed!.id).every(s => s.state === "skipped"));
    assert.ok((await db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, rejecting.id))).every(b => b.authority === null && b.display === null));
    assert.equal((await row(rejecting.id)).state, "cancelled"); process.env.AI_RUNTIME_ENABLED = "true";
    await db.update(customRole).set({ permissions: permissions.filter(p => p !== "post:entries") }).where(eq(customRole.id, role.id));
    assert.equal((await unchanged(() => decide(rejecting.id, rejectInput, true))).code, "BATCH_DENIED");
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    const deletion = await propose(true, true), deletionInput = body(deletion.view);
    await db.update(customRole).set({ permissions: permissions.filter(p => p !== "edit:entries") }).where(eq(customRole.id, role.id));
    assert.equal((await unchanged(() => decide(deletion.id, deletionInput))).code, "BATCH_DENIED");
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    const deletionBusiness = await hashes(false);
    assert.equal((await decide(deletion.id, deletionInput)).code, "DECISION_APPROVED");
    assert.deepEqual(await hashes(false), deletionBusiness); await runs.cancelRun(ctx, { runId: deletion.id });

    const stale = await propose(), staleInput = body(stale.view);
    await db.update(journalEntry).set({ reference: "edited-without-timestamp" }).where(eq(journalEntry.id, stale.entries[0].id));
    assert.equal((await unchanged(() => decide(stale.id, staleInput))).code, "BATCH_STALE");
    const valid = await propose(), validInput = body(valid.view);
    for (const patch of [{ selectedItemIds: [validInput.selectedItemIds[1]] }, { bindingDigest: "f".repeat(64) }, { expectedVersion: 1 }, { selectedItemIds: [validInput.selectedItemIds[0], validInput.selectedItemIds[0]] }]) {
      const result = await unchanged(() => decide(valid.id, { ...validInput, ...patch })); assert.ok(["BATCH_CONFLICT", "BATCH_STALE", "BATCH_INVALID"].includes(result.code));
    }
    const empty = await propose(false); assert.equal((await unchanged(() => decide(empty.id, body(empty.view)))).code, "BATCH_INVALID");
    for (const patch of [{ approved: true }, { confirmation: "yes" }, { runId: valid.id }, { policyVersion: 1 }, { items: valid.items }, { actorId: owner.id }]) {
      await data(await approveRoute.POST(req({ ...validInput, ...patch }), params(valid.id)), 400);
      await mcp("approve_ai_action_batch", { runId: valid.id, ...validInput, ...patch, unexpected: true }, true);
    }
    await data(await approveRoute.POST(req(validInput, org.id, "?approve=true"), params(valid.id)), 400);
    await mcp("approve_ai_action_batch", { runId: valid.id, text: "yes" }, true);
    for (const permission of permissions.slice(0, 4)) {
      await db.update(customRole).set({ permissions: permissions.filter(p => p !== permission) }).where(eq(customRole.id, role.id));
      assert.equal((await unchanged(() => decide(valid.id, validInput))).code, "BATCH_DENIED");
    }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    login(coworker.id); assert.equal((await unchanged(() => decide(valid.id, validInput))).code, "BATCH_NOT_FOUND");
    login(outsider.id); assert.equal((await data(await approveRoute.POST(req(validInput, foreign.id), params(valid.id)))).code, "BATCH_NOT_FOUND"); login(owner.id);
    process.env.AI_RUNTIME_ENABLED = "false"; assert.equal((await unchanged(() => decide(valid.id, validInput))).code, "BATCH_DISABLED"); process.env.AI_RUNTIME_ENABLED = "true";
    await db.update(aiProviderConfig).set({ version: config.version + 1 }).where(eq(aiProviderConfig.id, config.id));
    assert.equal((await unchanged(() => decide(valid.id, validInput))).code, "BATCH_CONFIGURATION_CHANGED");
    await db.update(aiProviderConfig).set({ version: config.version }).where(eq(aiProviderConfig.id, config.id));

    const [token] = await db.insert(mcpAccessToken).values({ userId: owner.id, organizationId: org.id, clientId: "fixture", tokenHash: "synthetic", expiresAt: new Date(Date.now() + 3600000) }).returning();
    const tokenCtx = await resolveExecutionIdentity({ kind: "mcp", userId: owner.id, organizationId: org.id, credentialId: token.id }), tokenMcp = await connect(tokenCtx);
    assert.equal((await unchanged(() => tokenMcp("approve_ai_action_batch", { runId: valid.id, ...validInput }))).code, "DECISION_INTERACTION_REQUIRED");
    // Safe rejection remains available via an actual token-backed registered MCP.
    const tokenRejected = await tokenMcp("reject_ai_action_batch", { runId: valid.id, ...validInput }); assert.equal(tokenRejected.code, "DECISION_REJECTED");
    await db.delete(mcpAccessToken).where(eq(mcpAccessToken.id, token.id));
    await unchanged(() => tokenMcp("reject_ai_action_batch", { runId: valid.id, ...validInput }, true));
    await db.update(users).set({ sessionRevokedAt: new Date() }).where(eq(users.id, owner.id));
    await data(await approveRoute.POST(req(staleInput), params(stale.id)), 401);
    await db.update(users).set({ sessionRevokedAt: null }).where(eq(users.id, owner.id)); login(owner.id);

    const expired = await propose(); await db.update(aiActionBatch).set({ expiresAt: new Date(0) }).where(eq(aiActionBatch.id, expired.view.batch.id));
    assert.equal((await unchanged(() => decide(expired.id, body(expired.view)))).code, "BATCH_EXPIRED");
    const cancelled = await propose(); await runs.cancelRun(ctx, { runId: cancelled.id });
    assert.equal((await unchanged(() => decide(cancelled.id, body(cancelled.view)))).code, "BATCH_CONFLICT");

    // Business workflow approvals remain independent and resource-unbound legacy
    // status cannot become authority. No approver identity is disclosed.
    const [workflow] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "HIDDEN_POLICY", entityType: "journal_entry", conditions: [] }).returning();
    const [policyStep] = await db.insert(approvalWorkflowStep).values({ workflowId: workflow.id, stepOrder: 1, approverId: otherMember.id }).returning();
    const policy = await propose(), policyInput = body(policy.view);
    const denied = await unchanged(() => decide(policy.id, policyInput)); assert.equal(denied.code, "DECISION_BUSINESS_APPROVAL_REQUIRED");
    assert.deepEqual(denied.nextActors, ["independent_business_approver"]); assert.doesNotMatch(JSON.stringify(denied), new RegExp(`HIDDEN_POLICY|${coworker.id}|${otherMember.id}|${workflow.id}`));
    await db.insert(approvalRequest).values({ organizationId: org.id, workflowId: workflow.id, entityType: "journal_entry", entityId: policy.entries[0].id, requestedById: ownerMember.id, status: "approved" });
    assert.equal((await unchanged(() => decide(policy.id, policyInput))).code, "BATCH_STALE");
    await db.update(approvalWorkflowStep).set({ approverId: ownerMember.id }).where(eq(approvalWorkflowStep.id, policyStep.id));
    const selfAssigned = await propose(); const selfDenied = await unchanged(() => decide(selfAssigned.id, body(selfAssigned.view)));
    assert.deepEqual(selfDenied.nextActors, ["approval_administrator"]);
    await db.update(approvalWorkflow).set({ isActive: false }).where(eq(approvalWorkflow.id, workflow.id));

    // Direct SQL lock waits force late credential/resource/expiry drift after the
    // initial observations, including rollback after receipt INSERT has started.
    for (const change of ["permission", "resource", "expiry"] as const) {
      const target = await propose(true, false, change === "expiry" ? 1500 : undefined), targetInput = body(target.view), lock = await pool.connect();
      await lock.query("begin"); await lock.query("lock table ai_action_decision in share mode");
      const pending = decide(target.id, targetInput);
      try {
        await waitFor("select pid from pg_stat_activity where wait_event_type='Lock' and query like 'insert into \"ai_action_decision\"%'");
        if (change === "permission") await db.update(customRole).set({ permissions: ["view:ai-history"] }).where(eq(customRole.id, role.id));
        if (change === "resource") await db.update(journalEntry).set({ reference: "late-edit" }).where(eq(journalEntry.id, target.entries[0].id));
        if (change === "expiry") await delay(1600);
        await lock.query("commit");
        const result = await pending;
        assert.equal(result.code, change === "permission" ? "BATCH_DENIED" : change === "resource" ? "BATCH_STALE" : "BATCH_EXPIRED");
        assert.equal((await db.select().from(aiActionDecision).where(eq(aiActionDecision.runId, target.id))).length, 0);
      } finally { await lock.query("rollback"); lock.release(); await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); }
    }
    // Stop wins the run-lock queue: the later decision cannot restore authority.
    const stopFirst = await propose(), stopLock = await pool.connect();
    await stopLock.query("begin"); await stopLock.query("select id from ai_run where id=$1 for update", [stopFirst.id]);
    const stopPending = runs.cancelRun(ctx, { runId: stopFirst.id });
    await waitFor("select pid from pg_stat_activity where wait_event_type='Lock' and query like '%from \"ai_run\"%'");
    const afterStop = decide(stopFirst.id, body(stopFirst.view));
    await stopLock.query("commit"); stopLock.release();
    await stopPending; assert.equal((await afterStop).code, "BATCH_CONFLICT");
    assert.equal((await db.select().from(aiActionDecision).where(eq(aiActionDecision.runId, stopFirst.id))).length, 0);
    // Decision wins, then Stop clears the proposal while preserving the original
    // metadata receipt. Neither ordering ever puts sensitive work in the queue.
    const decisionFirst = await propose(), firstInput = body(decisionFirst.view), insertLock = await pool.connect();
    await insertLock.query("begin"); await insertLock.query("lock table ai_action_decision in share mode");
    const decisionPending = decide(decisionFirst.id, firstInput);
    await waitFor("select pid from pg_stat_activity where wait_event_type='Lock' and query like 'insert into \"ai_action_decision\"%'");
    const laterStop = runs.cancelRun(ctx, { runId: decisionFirst.id });
    await insertLock.query("commit"); insertLock.release();
    const firstReceipt = await decisionPending; assert.equal(firstReceipt.code, "DECISION_APPROVED"); await laterStop;
    assert.deepEqual(await unchanged(() => decide(decisionFirst.id, firstInput)), firstReceipt);
    assert.equal((await row(decisionFirst.id)).state, "cancelled");
    assert.ok((await db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, decisionFirst.id))).every(b => b.authority === null && b.display === null));
    console.log("AI decision REST/MCP/SQL verified");
  } finally { await Promise.all(clients.map(c => c.close())); await Promise.all(servers.map(s => s.close())); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
