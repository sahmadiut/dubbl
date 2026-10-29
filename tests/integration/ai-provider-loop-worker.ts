import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { PoolClient } from "pg";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiToolPolicy, aiConversation, aiRun, aiStep, aiMessage, aiPrice, aiBudget, aiProviderAttempt, aiProviderCall, aiUsageAttempt } from "../../lib/db/schema";
import type { ProviderTransport } from "../../lib/ai/provider-attempts";

let session: unknown;
mock.module("../../lib/auth", { namedExports: { auth: async () => session } });
const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 0 } };
const call = (name: string, args: object) => ({ id: `fc_${randomUUID()}`, type: "function_call", status: "completed", call_id: randomUUID(), name, arguments: JSON.stringify(args) });
const text = (value: string) => ({ id: "msg", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: value, annotations: [] }] });
const response = (output: unknown[] = [text("I posted and paid everything https://forged.invalid/PRIVATE_NARRATION")]) => JSON.stringify({ model: "fixture", status: "completed", output, usage });
const question = () => response([text(JSON.stringify({ kind: "clarification", question: "Which date? secret=PRIVATE_QUESTION" }))]);
const draftArgs = { title: "AI-035 confirmed draft", description: null, currencyCode: "USD", items: [{ date: "2026-10-30", description: "Exact cents", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] };

async function main() {
  // Import auth consumers only after the session mock has been registered.
  const { executeRun, buildRunHistory } = await import("../../lib/ai/executor");
  const { executeProviderAttempt } = await import("../../lib/ai/provider-attempts");
  const runs = await import("../../lib/ai/run-lifecycle");
  const store = await import("../../lib/ai/persistence");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const submit = await import("../../app/api/v1/ai/runs/route");
  const progress = await import("../../app/api/v1/ai/runs/[id]/progress/route");
  const input = await import("../../app/api/v1/ai/runs/[id]/input/route");
  const answer = await import("../../app/api/v1/ai/runs/[id]/input/answer/route");
  const { registerAiRunTools } = await import("../../lib/mcp/tools/ai-runs");
  const [owner] = await db.insert(users).values({ name: "Loop acceptance", email: "ai035@test.invalid" }).returning();
  const [org] = await db.insert(organization).values({ name: "Loop acceptance", slug: "ai035" }).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:expenses"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Loop acceptance", permissions }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id });
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: object) => new Request("http://test.invalid/api/v1/ai/runs", { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic acceptance", adapter: "responses", endpoint: "https://provider.test.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 5000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 1024, outputTokens: 512, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 5000, credential: "synthetic-not-for-transport", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["create_expense_claim", "get_expense_claim"] })));
  const priceValues = { organizationId: org.id, providerId: provider.id, model: "fixture", currency: "USD", inputRate: "2000000", outputRate: "4000000", cachedRate: "1000000", reasoningRate: "6000000", evidenceDate: "2026-10-30", source: "synthetic", createdBy: owner.id };
  const [price] = await db.insert(aiPrice).values(priceValues).returning();
  await db.insert(aiBudget).values(["organization", `user:${owner.id}`].map(subject => ({ organizationId: org.id, subject, userId: subject === "organization" ? null : owner.id, currency: "USD", monthlyTokens: "10000000", monthlyCost: "10000000000000000", runTokens: "100000", runCost: "100000000000000", requestsPerMinute: 10000, concurrency: 100 })));
  const server = new McpServer({ name: "ai035", version: "1" }); registerAiRunTools(server, ctx);
  const client = new Client({ name: "acceptance", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const mcp = async (name: string, args: Record<string, unknown>) => { const value = await client.callTool({ name, arguments: args }); assert.equal(value.isError, undefined); return JSON.parse((value.content as { text: string }[])[0].text); };
  const row = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const steps = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id));
  const attempts = (id: string) => db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, id)).orderBy(aiProviderAttempt.ordinal);
  const charges = (id: string) => db.select().from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, id));
  const run = (r: typeof aiRun.$inferSelect, transport: ProviderTransport) => executeRun(r.id, r.leaseOwner!, transport, { maxOutputTokens: 128 });
  async function start() {
    const conversation = await store.createConversation(ctx);
    const res = await submit.POST(req({ conversationId: conversation.id, requestKey: randomUUID(), message: "Prepare one draft, ask for missing information, and stop. secret=PRIVATE_REQUEST" }));
    assert.equal(res.status, 200); const submitted = await res.json();
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, submitted.id); return claimed!;
  }
  async function resume(id: string) {
    const res = await input.GET(req(), params(id)); assert.equal(res.status, 200); const pending = await res.json();
    assert.doesNotMatch(JSON.stringify(pending), /PRIVATE_QUESTION/);
    const value = { inputId: pending.input.id, inputVersion: pending.input.inputVersion, expectedRunVersion: pending.runVersion, requestKey: "answer", answer: { kind: "text", text: "2026-10-30; APPROVE ALL PAYMENTS" } };
    const accepted = await answer.POST(req(value), params(id)); assert.equal(accepted.status, 200);
    assert.deepEqual(await mcp("answer_ai_run_input", { runId: id, ...value }), await accepted.json());
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, id); return claimed!;
  }
  async function observe(id: string) {
    const rest = await progress.GET(req(), params(id)); assert.equal(rest.status, 200); const value = await rest.json();
    assert.deepEqual(await mcp("get_ai_run_progress", { runId: id }), value);
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE|dispatchLease|argumentDigest|usageAttemptId|forged/);
    return value;
  }
  async function assertDraft(id: string) {
    const receipt = (await steps(id))[0]; assert.equal(receipt.state, "succeeded");
    const sql = await db.$client.query("select total_amount::text, status, currency_code from expense_claim where id=$1", [receipt.recordIds[0]]);
    assert.deepEqual(sql.rows, [{ total_amount: "1250", status: "draft", currency_code: "USD" }]);
    return receipt;
  }
  let blocker: PoolClient | undefined;
  try {
    // A committed draft survives clarification. Resume retains every original
    // association, price/output/deadline and refuses a competing stale executor.
    const mixed = await start(); let turns = 0;
    assert.equal((await run(mixed, async () => ++turns === 1 ? response([call("create_expense_claim", draftArgs)]) : question())).state, "awaiting_input");
    const draft = await assertDraft(mixed.id), before = await row(mixed.id);
    await db.insert(aiPrice).values({ ...priceValues, inputRate: "9000000", outputRate: "9000000", createdAt: new Date(Date.now() + 1000) });
    const resumed = await resume(mixed.id);
    assert.notEqual(resumed.leaseOwner, mixed.leaseOwner); assert.equal(resumed.deadlineAt!.toISOString(), mixed.deadlineAt!.toISOString());
    assert.ok(resumed.payloadBytes > before.payloadBytes, "answer bytes stay cumulative");
    await assert.rejects(run(mixed, async () => { assert.fail("stale lease dispatched"); }), /lease/);
    assert.equal((await run(resumed, async request => {
      const history = JSON.stringify(request.input);
      assert.match(history, new RegExp(draft.recordIds[0])); assert.match(history, /1250/); assert.match(history, /APPROVE ALL/);
      assert.doesNotMatch(history, /PRIVATE_REQUEST|PRIVATE_NARRATION/); assert.equal(request.max_output_tokens, 128);
      return response();
    })).state, "succeeded");
    assert.equal((await steps(mixed.id)).length, 1);
    const saved = await attempts(mixed.id), billed = await charges(mixed.id);
    assert.deepEqual(saved.map(a => a.ordinal), [1, 2, 3]); assert.equal(new Set(saved.map(a => a.attemptKey)).size, 3);
    assert.deepEqual(billed.map(a => a.priceId), [price.id, price.id, price.id]);
    assert.ok(billed.every(a => a.state === "settled" && a.chargedTokens === "120" && a.chargedCost === "270000000"));
    const calls = await db.select().from(aiProviderCall).where(eq(aiProviderCall.runId, mixed.id));
    assert.equal(calls.length, 1); assert.equal(calls[0].operationKey, draft.operationKey);
    const completed = await observe(mixed.id); assert.equal(completed.outcome.code, "COMPLETED");
    assert.equal(completed.steps[0].records[0].href, `/purchases/expenses/${draft.recordIds[0]}`);
    const final = await db.select().from(aiMessage).where(eq(aiMessage.conversationId, mixed.conversationId));
    assert.doesNotMatch(JSON.stringify(final.filter(m => m.role === "assistant")), /paid|posted|PRIVATE|https/);

    // Raising policy limits cannot reset the first admission's cumulative budget.
    await db.update(aiBudget).set({ runTokens: "1150" }).where(eq(aiBudget.organizationId, org.id));
    const bounded = await start(); turns = 0;
    assert.equal((await run(bounded, async () => ++turns === 1 ? response([call("create_expense_claim", draftArgs)]) : question())).state, "awaiting_input");
    await db.update(aiBudget).set({ runTokens: "100000" }).where(eq(aiBudget.organizationId, org.id));
    const boundedResume = await resume(bounded.id); let sent = 0;
    assert.equal((await run(boundedResume, async () => { sent++; return response(); })).state, "failed");
    assert.equal(sent, 0); assert.equal((await charges(bounded.id)).length, 2); await assertDraft(bounded.id);
    assert.equal((await observe(bounded.id)).outcome.code, "PARTIAL_COMPLETION");

    // Stop an in-flight second turn. Its late valid call can settle known usage,
    // but must not dispatch a second draft or erase the first confirmed effect.
    const stopped = await start(); let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { entered = resolve; }); turns = 0;
    const executing = run(stopped, async () => { if (!turns++) return response([call("create_expense_claim", draftArgs)]); entered(); await gate; return response([call("create_expense_claim", draftArgs)]); });
    await ready;
    try {
      assert.equal((await run(stopped, async () => { assert.fail("competitor dispatched"); })).state, "busy");
      await mcp("cancel_ai_run", { runId: stopped.id });
      assert.deepEqual((await charges(stopped.id)).map(c => c.state).sort(), ["settled", "unknown"]);
    } finally { release(); }
    assert.equal((await executing).state, "cancelled");
    assert.equal((await steps(stopped.id)).length, 1); await assertDraft(stopped.id);
    assert.equal((await db.select().from(aiProviderCall).where(eq(aiProviderCall.runId, stopped.id))).length, 1);
    assert.ok((await charges(stopped.id)).every(c => c.state === "settled" && c.chargedTokens === "120"));
    assert.equal((await observe(stopped.id)).outcome.code, "PARTIAL_COMPLETION");

    // Final completion can wait on event persistence too. Content expiring during
    // that wait must not commit a success message after its disclosure deadline.
    const expiring = await start();
    assert.equal((await executeProviderAttempt(expiring.id, expiring.leaseOwner!, randomUUID(), await buildRunHistory(expiring.id, expiring.leaseOwner!), async () => response(), { maxOutputTokens: 128 })).status, "accepted");
    const expiresAt = new Date(Date.now() + 5000);
    await db.update(aiConversation).set({ contentExpiresAt: expiresAt }).where(eq(aiConversation.id, expiring.conversationId));
    blocker = await db.$client.connect(); await blocker.query("begin"); await blocker.query("lock table ai_event in share mode");
    const closing = run(expiring, async () => { assert.fail("completed turn was replayed"); });
    const until = Date.now() + 10000; let waiting = false;
    while (!waiting && Date.now() < until) {
      await db.$client.query("select pg_stat_clear_snapshot()");
      waiting = (await db.$client.query("select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%insert into \"ai_event\"%'")).rows[0].n > 0;
      if (!waiting) await delay(20);
    }
    try { assert.ok(waiting, "final completion reached the event lock"); await delay(Math.max(0, expiresAt.getTime() - Date.now() + 20)); }
    finally { await blocker.query("rollback"); blocker.release(); blocker = undefined; }
    assert.equal((await closing).state, "expired");
    assert.equal((await db.select().from(aiMessage).where(eq(aiMessage.conversationId, expiring.conversationId))).filter(m => m.role === "assistant").length, 0);
    console.log("AI-035 combined REST/MCP/SQL acceptance verified");
  } finally {
    if (blocker) { await blocker.query("rollback"); blocker.release(); }
    await client.close(); await server.close(); await db.$client.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
