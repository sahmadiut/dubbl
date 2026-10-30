import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiConversation, aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiStep, aiPrice, aiBudget, aiProviderAttempt, aiUsageAttempt, aiEvent, expenseClaim } from "../../lib/db/schema";
import type { ProviderTransport } from "../../lib/ai/provider-attempts";

let session: unknown;
mock.module("../../lib/auth", { namedExports: { auth: async () => session } });
const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } };
const narration = { id: "msg", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: "PAID https://evil.invalid PRIVATE_REASONING Bearer SECRET_RAW", annotations: [] }] };
const response = (output: unknown[] = [narration]) => JSON.stringify({ model: "fixture", status: "completed", output, usage });
const draftArgs = { title: "SECRET_TITLE", description: null, currencyCode: "USD", items: [{ date: "2026-10-30", description: "SECRET_RAW", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] };
const draft = () => response([{ id: randomUUID(), type: "function_call", status: "completed", call_id: randomUUID(), name: "create_expense_claim", arguments: JSON.stringify(draftArgs) }, narration]);
async function until(check: () => Promise<boolean> | boolean, label: string) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await check()) return; await delay(10); }
  throw new Error(`Timed out: ${label}`);
}
async function main() {
  const { runWorker } = await import("../../lib/ai/worker");
  const lifecycle = await import("../../lib/ai/run-lifecycle");
  const store = await import("../../lib/ai/persistence");
  const { getRunObservation } = await import("../../lib/ai/run-progress");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const submit = await import("../../app/api/v1/ai/runs/route");
  const route = await import("../../app/api/v1/ai/runs/[id]/observation/route");
  const { registerAiRunTools, AI_RUN_LIFECYCLE_TOOLS } = await import("../../lib/mcp/tools/ai-runs");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  assert.ok(AI_RUN_LIFECYCLE_TOOLS.has("get_ai_run_observation"));
  assert.ok(!AI_TOOL_NAMES.some(n => String(n) === "get_ai_run_observation"));
  const [owner, coworker] = await db.insert(users).values(["owner", "coworker"].map(name => ({ name, email: `ai040-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Observation", slug: "ai040" }, { name: "Foreign", slug: "ai040-foreign" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:expenses"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Observer", permissions }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: coworker.id, role: "owner" }, { organizationId: foreign.id, userId: owner.id, role: "owner" }]);
  const login = (userId: string) => { session = { user: { id: userId }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const req = (query = "", organizationId = org.id, body?: object) => new Request(`http://test.invalid/api/v1/ai/runs${query}`, { method: body ? "POST" : "GET", headers: { "x-organization-id": organizationId, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  login(owner.id); const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic observer", adapter: "responses", endpoint: "https://fixture.test.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 5000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 1024, outputTokens: 512, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 5000, credential: "synthetic-unused", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["create_expense_claim", "get_expense_claim"] })));
  await db.insert(aiPrice).values({ organizationId: org.id, providerId: provider.id, model: "fixture", currency: "USD", inputRate: "2000000", outputRate: "4000000", cachedRate: "1000000", reasoningRate: "6000000", evidenceDate: "2026-10-30", source: "synthetic", createdBy: owner.id });
  await db.insert(aiBudget).values([null, owner.id].map(userId => ({ organizationId: org.id, subject: userId ? `user:${userId}` : "organization", userId, currency: "USD", monthlyTokens: "10000000", monthlyCost: "10000000000000000", runTokens: "100000", runCost: "100000000000000", requestsPerMinute: 10000, concurrency: 100 })));
  const row = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const steps = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id));
  const attempts = (id: string) => db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, id)).orderBy(aiProviderAttempt.ordinal);
  async function enqueue(message = "Prepare a draft SECRET_PROMPT") {
    const conversation = await store.createConversation(ctx);
    const result = await submit.POST(req("", org.id, { conversationId: conversation.id, requestKey: randomUUID(), message }));
    assert.equal(result.status, 200); return row((await result.json()).id);
  }
  async function rest(id: string, query = "", status = 200, organizationId = org.id) {
    const result = await route.GET(req(query, organizationId), params(id));
    assert.equal(result.status, status, await result.clone().text());
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    return result.json();
  }
  const server = new McpServer({ name: "ai040", version: "1" }); registerAiRunTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(a), client.connect(b)]);
  async function mcp(args: Record<string, unknown>, error = false) {
    const result = await client.callTool({ name: "get_ai_run_observation", arguments: args });
    assert.equal(!!result.isError, error, JSON.stringify(result));
    return error ? result : JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function work(id: string, transport: ProviderTransport, during?: () => Promise<void>) {
    const controller = new AbortController();
    const running = runWorker({ signal: controller.signal, transport, concurrency: 1, pollMs: 20, heartbeatMs: 50, maintenanceMs: 100, drainMs: 1000 });
    try {
      await during?.();
      await until(async () => (await row(id)).state !== "queued" && (await row(id)).state !== "running", "run closure");
    } finally { controller.abort(); assert.equal((await running).unfinished, 0); }
  }
  const safe = (view: unknown) => assert.doesNotMatch(JSON.stringify(view), /SECRET_|PRIVATE_REASONING|PAID|evil.invalid|Bearer|credential|dispatchLease|argumentDigest|operationKey|requestKey|tool_arguments/);
  const snapshot = async () => createHash("sha256").update(JSON.stringify((await db.$client.query("select (select jsonb_agg(r order by id) from ai_run r) as runs, (select jsonb_agg(s order by id) from ai_step s) as steps, (select jsonb_agg(a order by id) from ai_provider_attempt a) as attempts, (select jsonb_agg(u order by id) from ai_usage_attempt u) as usage, (select jsonb_agg(e order by id) from ai_event e) as events, (select jsonb_agg(c order by id) from expense_claim c) as claims")).rows)).digest("hex");
  async function blocked(part: string) {
    await db.$client.query("select pg_stat_clear_snapshot()");
    return (await db.$client.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1", [`%${part}%`])).rows.length > 0;
  }
  try {
    const first = await enqueue();
    let view = await rest(first.id); assert.equal(view.provisional.code, "WAITING_FOR_EXECUTION"); assert.equal(view.provisional.state, "provisional");
    assert.deepEqual(await mcp({ runId: first.id }), view);
    for (const query of ["?after=-1", "?after=01", "?after=1e2", "?after=2147483648", "?after=1&after=2", "?after=", "?limit=2", "?retry=true", "?organizationId=x"]) await rest(first.id, query, 400);
    await rest("bad", "", 400);
    for (const args of [{ runId: first.id, retry: true }, { runId: first.id, after: "1" }, { runId: first.id, after: 2147483648 }, { runId: first.id, identity: {} }]) await mcp(args, true);
    login(coworker.id); await rest(first.id, "", 404); login(owner.id); await rest(first.id, "", 404, foreign.id);
    let release!: (raw: string) => void, entered = false;
    const pending = new Promise<string>(resolve => { release = resolve; });
    await work(first.id, async () => { entered = true; return pending; }, async () => {
      await until(() => entered, "provider entry");
      view = await rest(first.id); assert.equal(view.provisional.code, "WAITING_FOR_RESPONSE"); assert.deepEqual(view.provisional.records, []); assert.equal(view.confirmed.steps.length, 0); safe(view);
      // Repeated observations do not create another provider attempt or effect.
      for (let i = 0; i < 3; i++) { safe(await rest(first.id, `?after=${view.delivery.next}`)); safe(await mcp({ runId: first.id, after: view.delivery.next })); }
      assert.equal((await db.select().from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, first.id))).length, 1);
      assert.equal((await steps(first.id)).length, 0);
      // A partial tool call and narration cannot appear or execute before whole
      // response validation, or after malformed raw JSON is finally delivered.
      release('{"model":"fixture","status":"completed","output":[{"type":"function_call","name":"create_expense_claim","arguments":"{');
    });
    assert.equal((await steps(first.id)).length, 0); assert.equal((await attempts(first.id)).length, 1);
    view = await rest(first.id); safe(view); assert.equal(view.provisional.state, "unavailable"); assert.equal(view.confirmed.outcome.code, "RECONCILIATION_REQUIRED");
    // With no running worker, whole-database checks prove runtime-off reconnect
    // does not perform maintenance, claims, settlement or any other mutation.
    process.env.AI_RUNTIME_ENABLED = "false";
    const beforeOff = await snapshot(); await rest(first.id); await mcp({ runId: first.id, after: view.delivery.next }); assert.equal(await snapshot(), beforeOff);
    process.env.AI_RUNTIME_ENABLED = "true";

    // Actual draft receipt plus another pending provider response. Only the live
    // receipt supplies a record link, status and exact money; narration cannot.
    const dependent = await enqueue(); let turns = 0, secondEntered = false, finish!: (raw: string) => void;
    const second = new Promise<string>(resolve => { finish = resolve; });
    await work(dependent.id, async () => { turns++; if (turns === 1) return draft(); secondEntered = true; return second; }, async () => {
      await until(() => secondEntered, "dependent response");
      view = await rest(dependent.id); safe(view);
      assert.equal(view.provisional.code, "WAITING_FOR_RESPONSE"); assert.equal(view.confirmed.steps[0].code, "DRAFT_CREATED");
      assert.equal(view.confirmed.steps[0].records[0].amountMinor, "1250"); assert.equal(view.confirmed.steps[0].records[0].status, "draft");
      assert.deepEqual(await mcp({ runId: dependent.id }), view); finish(response());
    });
    view = await rest(dependent.id); safe(view); assert.equal(view.provisional.state, "unavailable"); assert.equal(view.confirmed.outcome.code, "COMPLETED");
    const cursor = view.delivery.next, step = (await steps(dependent.id))[0];
    assert.deepEqual((await db.$client.query("select total_amount::text,status from expense_claim where id=$1", [step.recordIds[0]])).rows, [{ total_amount: "1250", status: "draft" }]);
    const beforeReconnect = await snapshot();
    for (const after of [0, cursor, 2147483647]) { const next = await mcp({ runId: dependent.id, after }); safe(next); assert.equal(next.delivery.replace, true); assert.equal(next.delivery.next, cursor); assert.equal(next.delivery.cursorReset, after > cursor); }
    assert.equal(await snapshot(), beforeReconnect); assert.equal(turns, 2);
    // The execution cursor is not a cache validator for domain access.
    await db.update(customRole).set({ permissions: ["use:ai", "view:ai-history"] }).where(eq(customRole.id, role.id));
    const hidden = await mcp({ runId: dependent.id, after: cursor }); assert.equal(hidden.delivery.executionChanged, false); assert.equal(hidden.confirmed.steps[0].code, "RESULT_RESTRICTED"); assert.deepEqual(hidden.confirmed.steps[0].records, []);
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    await db.update(expenseClaim).set({ deletedAt: new Date() }).where(eq(expenseClaim.id, step.recordIds[0]));
    assert.deepEqual((await rest(dependent.id, `?after=${cursor}`)).confirmed.steps[0].records, []);
    await db.delete(aiEvent).where(eq(aiEvent.runId, dependent.id));
    assert.equal((await rest(dependent.id, `?after=${cursor}`)).delivery.cursorReset, true);

    // Permissions change while a real run writer delays the response.
    const gate = await db.$client.connect();
    try {
      await gate.query("begin"); await gate.query("select id from ai_run where id=$1 for update", [dependent.id]);
      const delayed = getRunObservation(ctx, { runId: dependent.id });
      await until(() => blocked('from "ai_run"'), "observation run lock");
      await gate.query("update custom_role set permissions=$1::jsonb where id=$2", [JSON.stringify(["use:ai", "view:ai-history"]), role.id]);
      await gate.query("commit");
      assert.equal((await delayed).confirmed.steps[0].code, "RESULT_RESTRICTED");
    } finally { await gate.query("rollback"); gate.release(); }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));

    // Expiry is wall-clock sensitive even though the reader locked the row before
    // waiting for a run writer. No expired response is released after that wait.
    await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() + 200) }).where(eq(aiConversation.id, dependent.conversationId));
    const expiryGate = await db.$client.connect();
    try {
      await expiryGate.query("begin"); await expiryGate.query("select id from ai_run where id=$1 for update", [dependent.id]);
      const expired = rest(dependent.id, "", 404);
      await until(() => blocked('from "ai_run"'), "expiry lock"); await delay(220); await expiryGate.query("commit"); await expired;
    } finally { await expiryGate.query("rollback"); expiryGate.release(); }
    await mcp({ runId: dependent.id }, true);

    // A dead lease is observed as delayed; reads never renew or maintain it.
    const stale = await enqueue(); const claimed = await lifecycle.claimNextRun(); assert.equal(claimed?.id, stale.id);
    for (let i = 0; i < 20; i++) await store.prepareStep(ctx, stale.id, "get_expense_claim", { text: "SECRET_RAW" }, ["manage:expenses"]);
    await assert.rejects(store.prepareStep(ctx, stale.id, "get_expense_claim", {}, ["manage:expenses"]), /step limit/);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, stale.id));
    const beforeStale = await snapshot(); const bounded = await rest(stale.id); assert.equal(bounded.provisional.code, "OBSERVATION_DELAYED"); assert.equal(bounded.confirmed.steps.length, 20); safe(bounded); assert.equal(await snapshot(), beforeStale);
    await lifecycle.cancelRun(ctx, { runId: stale.id });

    // Cancellation during an actual business INSERT preserves its single known
    // receipt. A blocked/delayed observer gains no execution authority.
    await db.$client.query("create function ai040_gate() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(400040); return NEW; end $$");
    await db.$client.query("create trigger ai040_gate before insert on expense_claim for each row execute function ai040_gate()");
    const effect = await enqueue(), effectGate = await db.$client.connect(); let sent = 0;
    await effectGate.query("select pg_advisory_lock(400040)");
    try {
      await work(effect.id, async () => { sent++; return draft(); }, async () => {
        await until(() => blocked('insert into "expense_claim"'), "actual draft insert");
        const observed = rest(effect.id);
        const stop = lifecycle.cancelRun(ctx, { runId: effect.id });
        await delay(30); await effectGate.query("select pg_advisory_unlock(400040)");
        safe(await observed); await stop;
      });
    } finally { await effectGate.query("select pg_advisory_unlock(400040)"); effectGate.release(); }
    view = await rest(effect.id); safe(view); assert.equal(view.confirmed.outcome.code, "PARTIAL_COMPLETION"); assert.equal(view.provisional.state, "unavailable");
    assert.equal((await steps(effect.id)).length, 1); assert.equal(sent, 1);
    const afterStop = await snapshot(); await mcp({ runId: effect.id, after: view.delivery.next }); await rest(effect.id, "?after=0"); assert.equal(await snapshot(), afterStop);
    // Long authorized input stays in the bounded provider path; observation
    // remains small and never returns the original text or model narration.
    const long = await enqueue("SECRET_PROMPT".repeat(600)); let longCalls = 0;
    await work(long.id, async () => { longCalls++; return response(); });
    assert.equal(longCalls, 1); safe(await rest(long.id)); assert.ok(JSON.stringify(await mcp({ runId: long.id })).length < 4096);
    await db.update(aiConversation).set({ deletedAt: new Date() }).where(eq(aiConversation.id, effect.conversationId)); await rest(effect.id, "", 404);
    await db.update(customRole).set({ permissions: ["use:ai"] }).where(eq(customRole.id, role.id)); await rest(long.id, "", 403); await mcp({ runId: long.id }, true);
    console.log("AI-040 observation REST/MCP/SQL and worker races verified");
  } finally { await client.close(); await server.close(); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
