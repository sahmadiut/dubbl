import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { PRESET_ROLES } from "../../lib/plans";
import { users, organization, member, customRole, aiRun, aiMessage, aiStep, aiApproval, aiConversation, aiEvent, auditLog } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence");
  assert.ok(PRESET_ROLES.every(r => !r.permissions.includes("audit:ai-transcripts")));
  if (process.argv[2] === "restart") {
    const [run] = await db.select().from(aiRun).where(eq(aiRun.id, process.argv[3]));
    assert.equal(run.state, "running");
    assert.equal((await store.recoverExpiredRuns()).recovered, 1);
    const [recovered] = await db.select().from(aiRun).where(eq(aiRun.id, run.id));
    assert.equal(recovered.state, "reconciliation_required");
    const [step] = await db.select().from(aiStep).where(eq(aiStep.runId, run.id));
    assert.equal(step.state, "uncertain"); assert.ok(step.result);
    console.log("Fresh process recovered durable uncertain effects"); return;
  }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { executionIdentity } = await import("../../lib/api/execution-identity");
  const { GET: list } = await import("../../app/api/v1/ai/conversations/route");
  const { GET: get, DELETE: remove } = await import("../../app/api/v1/ai/conversations/[id]/route");
  const { POST: audit } = await import("../../app/api/v1/ai/conversations/[id]/audit/route");
  const { registerAiHistoryTools } = await import("../../lib/mcp/tools/ai-history");
  const [owner, other, auditor, foreign] = await db.insert(users).values(["owner", "other", "auditor", "foreign"].map(name => ({ name, email: `ai003-${name}@test.invalid` }))).returning();
  const [a, b] = await db.insert(organization).values([{ name: "AI storage", slug: "ai003-a" }, { name: "Foreign", slug: "ai003-b" }]).returning();
  const [limited] = await db.insert(customRole).values({ organizationId: a.id, name: "History user", permissions: ["use:ai", "view:ai-history", "manage:contacts"] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "member", customRoleId: limited.id }, { organizationId: a.id, userId: other.id, role: "admin" }, { organizationId: a.id, userId: auditor.id, role: "owner" }, { organizationId: b.id, userId: foreign.id, role: "owner" }]);
  function login(id: string) { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; }
  const req = (method = "GET", body?: object, org = a.id) => new Request("http://test.invalid/api/v1/ai/conversations", { method, headers: { "x-organization-id": org, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  login(owner.id); const ctx = await getAuthContext(req()), identity = executionIdentity(ctx);
  const conversation = await store.createConversation(ctx);
  const config = { providerConfigId: randomUUID(), credentialRef: randomUUID(), configVersion: 1, policyVersion: 1 };
  await assert.rejects(store.enqueueRun(ctx, conversation.id, "bad", { ...config, secret: "never persist" } as typeof config));
  const runs = await Promise.all([store.enqueueRun(ctx, conversation.id, "same-key", config), store.enqueueRun(ctx, conversation.id, "same-key", config)]);
  assert.equal(runs[0].id, runs[1].id);
  const run = runs[0];
  const raced = await Promise.allSettled([store.transitionRun(identity, run.id, 1, "running"), store.transitionRun(identity, run.id, 1, "cancelled")]);
  assert.equal(raced.filter(r => r.status === "fulfilled").length, 1);
  let active = (await db.select().from(aiRun).where(eq(aiRun.id, run.id)))[0];
  if (active.state !== "running") {
    const next = await store.enqueueRun(ctx, conversation.id, "running-key", config);
    active = await store.transitionRun(identity, next.id, 1, "running");
  }
  await store.appendMessage(ctx, conversation.id, "user", { note: "Hello Bearer TOPSECRET", password: "HIDDEN_PASSWORD", accessToken: "HIDDEN_TOKEN", text: "api_key=HIDDEN_KEY" }, []);
  await store.appendMessage(ctx, conversation.id, "assistant", "CONTACT_SECRET", ["manage:contacts"]);
  const huge = await store.appendMessage(ctx, conversation.id, "assistant", "x".repeat(70000), ["manage:contacts"]);
  assert.equal(huge.payload?.truncated, true);
  const step = await store.prepareStep(ctx, active.id, "get_contact", { contactId: randomUUID(), password: "HIDDEN_STEP" }, ["manage:contacts"]);
  await store.transitionStep(ctx, step.id, 1, "executing");
  // Persist an already observed partial result to prove restart does not erase it.
  const partialRecordId = randomUUID();
  await db.update(aiStep).set({ result: store.boundedPayload({ partialRecordId }), recordIds: [partialRecordId] }).where(eq(aiStep.id, step.id));
  await db.update(aiRun).set({ leaseOwner: randomUUID(), leaseExpiresAt: new Date(Date.now() - 1000) }).where(eq(aiRun.id, active.id));
  const restarted = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-persistence-worker.ts", "restart", active.id], { env: process.env, encoding: "utf8", timeout: 30000 });
  assert.equal(restarted.status, 0, restarted.stderr); assert.match(restarted.stdout, /Fresh process recovered/);
  const events = await db.select().from(aiEvent).where(eq(aiEvent.runId, active.id));
  assert.equal(new Set(events.map(e => e.sequence)).size, events.length);
  await assert.rejects(store.transitionStep(ctx, step.id, 2, "succeeded"), /state conflict/);

  const server = new McpServer({ name: "AI history", version: "1" }); registerAiHistoryTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown>, error = false) => {
    const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, error, JSON.stringify(r));
    return JSON.parse((r.content as { text: string }[])[0].text);
  };
  try {
    const detail = await call("get_ai_conversation", { conversationId: conversation.id });
    assert.doesNotMatch(JSON.stringify(detail), /TOPSECRET|HIDDEN_|credentialRef|issuedAt|providerConfigId/);
    assert.match(JSON.stringify(detail), /CONTACT_SECRET/);
    assert.equal((await list(req())).status, 200);
    assert.equal((await get(req(), params(conversation.id))).status, 200);
    login(other.id);
    assert.equal((await get(req(), params(conversation.id))).status, 404);
    assert.equal((await audit(req("POST", { reason: "Check access" }), params(conversation.id))).status, 403);
    login(foreign.id);
    assert.equal((await get(req("GET", undefined, b.id), params(conversation.id))).status, 404);
    login(auditor.id);
    assert.equal((await audit(req("POST", { reason: "Review support incident" }), params(conversation.id))).status, 200);
    const logs = await db.select().from(auditLog).where(eq(auditLog.entityId, conversation.id)); assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "ai.transcript.read");
    login(owner.id);
    await db.update(customRole).set({ permissions: ["use:ai", "view:ai-history"] }).where(eq(customRole.id, limited.id));
    const revoked = await call("get_ai_conversation", { conversationId: conversation.id });
    assert.doesNotMatch(JSON.stringify(revoked), /CONTACT_SECRET/); assert.equal(revoked.runs.find((r: { id: string }) => r.id === active.id).steps[0].input, null);
    await db.update(customRole).set({ permissions: ["use:ai"] }).where(eq(customRole.id, limited.id));
    await call("get_ai_conversation", { conversationId: conversation.id }, true);
    await db.update(customRole).set({ permissions: ["use:ai", "view:ai-history"] }).where(eq(customRole.id, limited.id));

    // SQL constraints prevent foreign owner scope, invalid states and oversized storage.
    await assert.rejects(db.insert(aiMessage).values({ organizationId: b.id, ownerId: owner.id, conversationId: conversation.id, role: "user", payload: null, requiredPermissions: [] }));
    await assert.rejects(db.update(aiRun).set({ state: "succeeded", finishedAt: null }).where(eq(aiRun.id, active.id)));
    await assert.rejects(db.update(aiMessage).set({ payload: { value: "x".repeat(70000), bytes: 70000, truncated: false, digest: "x" } }).where(eq(aiMessage.id, huge.id)));
    const safeRun = await store.enqueueRun(ctx, conversation.id, "terminal", config);
    await store.transitionRun(identity, safeRun.id, 1, "running");
    await store.transitionRun(identity, safeRun.id, 2, "succeeded");
    await assert.rejects(store.transitionRun(identity, safeRun.id, 3, "running"), /state conflict/);
    await db.insert(aiApproval).values({ organizationId: a.id, ownerId: owner.id, stepId: step.id, argumentHash: "a".repeat(64), preview: store.boundedPayload({ password: "HIDDEN_APPROVAL" }), expiresAt: new Date(Date.now() + 60000) });
    assert.equal((await remove(req("DELETE"), params(conversation.id))).status, 200);
    assert.equal((await remove(req("DELETE"), params(conversation.id))).status, 200);
    assert.equal((await get(req(), params(conversation.id))).status, 404);
    await assert.rejects(store.appendMessage(ctx, conversation.id, "user", "after deletion", []), /not found/);
    const erased = await db.select().from(aiMessage).where(eq(aiMessage.conversationId, conversation.id));
    assert.ok(erased.every(m => m.payload === null));
    const [approval] = await db.select().from(aiApproval).where(eq(aiApproval.stepId, step.id)); assert.equal(approval.state, "expired"); assert.equal(approval.preview, null);
    assert.equal((await db.select().from(aiRun).where(eq(aiRun.id, active.id)))[0].state, "reconciliation_required");
    assert.deepEqual((await db.select().from(aiStep).where(eq(aiStep.id, step.id)))[0].recordIds, [partialRecordId]);
    const expiring = await store.createConversation(ctx);
    await store.appendMessage(ctx, expiring.id, "user", "EXPIRING_PRIVATE", []);
    await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() - 1000) }).where(eq(aiConversation.id, expiring.id));
    assert.doesNotMatch(JSON.stringify(await store.getConversation(ctx, expiring.id)), /EXPIRING_PRIVATE/);
    await store.purgeExpiredContent();
    assert.equal((await db.select().from(aiMessage).where(eq(aiMessage.conversationId, expiring.id)))[0].payload, null);
    await db.update(aiConversation).set({ metadataExpiresAt: new Date(Date.now() - 1000) }).where(eq(aiConversation.id, expiring.id));
    await store.purgeExpiredContent();
    assert.equal((await db.select().from(aiConversation).where(eq(aiConversation.id, expiring.id))).length, 0);
    const bounded = await store.createConversation(ctx);
    for (let i = 0; i < 17; i++) await store.appendMessage(ctx, bounded.id, "user", "x".repeat(59000), []);
    await assert.rejects(store.appendMessage(ctx, bounded.id, "user", "x".repeat(59000), []), /payload limit/);
    const circular: Record<string, unknown> = {}; circular.self = circular;
    assert.throws(() => store.boundedPayload(circular), /structure exceeds/);
    await db.delete(member).where(eq(member.userId, owner.id));
    await call("list_ai_conversations", {}, true);
  } finally { await client.close(); await server.close(); }
  console.log("AI persistence REST/MCP/SQL and restart verified");
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
