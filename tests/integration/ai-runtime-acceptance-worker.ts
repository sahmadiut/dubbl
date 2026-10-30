import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { RequestOptions } from "node:https";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiStep, aiProviderAttempt, aiProviderCall, aiUsageAttempt, aiMessage, aiPrice, aiBudget } from "../../lib/db/schema";

let session: unknown;
mock.module("../../lib/auth", { namedExports: { auth: async () => session } });
const endpoint = "https://runtime.fixture.invalid/v1/responses";
type Reply = { body: string; status?: number; beforeEnd?: () => Promise<void> };
let wire: (request: Record<string, unknown>) => Promise<Reply>, dnsHook: (() => Promise<void>) | undefined, sent = 0, abortedRequests = 0;
const mockFailures: unknown[] = [];
mock.module("node:dns/promises", { namedExports: { lookup: async () => { await dnsHook?.(); return [{ address: "8.8.8.8", family: 4 }]; } } });
// Every HTTPS request is intercepted before network access. The production
// encrypted-credential adapter/security/protocol/worker code remains in use.
mock.module("node:https", { namedExports: { request: (url: URL, options: RequestOptions, callback: (response: PassThrough) => void) => {
  sent++; assert.equal(url.href, endpoint); assert.equal(options.method, "POST"); assert.equal(options.agent, false);
  assert.equal((options.headers as Record<string, string>).authorization, "Bearer synthetic-runtime-secret");
  options.lookup!(url.hostname, {}, (error, address) => { assert.equal(error, null); assert.equal(address, "8.8.8.8"); });
  const req = new EventEmitter() as EventEmitter & { end: (body: string) => void };
  const aborted = () => { abortedRequests++; req.emit("error", new Error("PRIVATE_TRANSPORT")); };
  options.signal?.addEventListener("abort", aborted, { once: true });
  req.end = body => {
    void (async () => {
      const request = JSON.parse(body);
      assert.equal(request.store, false); assert.equal(request.stream, false); assert.equal(request.parallel_tool_calls, false); assert.equal(request.model, "fixture");
      const reply = await wire(request);
      const stream = Object.assign(new PassThrough(), { statusCode: reply.status ?? 200, headers: {} });
      stream.once("close", () => options.signal?.removeEventListener("abort", aborted));
      callback(stream);
      // Withhold the final JSON byte so complete-looking earlier calls cannot
      // escape validation while the rest of the response is still in flight.
      stream.write(reply.body.slice(0, -1)); await reply.beforeEnd?.(); stream.end(reply.body.slice(-1));
    })().catch(error => { mockFailures.push(error); req.emit("error", error); });
  };
  return req;
} } });
const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 0 } };
const text = (value = "PRIVATE_NARRATION PAID https://forged.invalid PRIVATE_REASONING") => ({ id: "msg", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: value, annotations: [] }] });
const response = (output: unknown[] = [text()]) => JSON.stringify({ model: "fixture", status: "completed", output, usage });
const call = (name = "create_expense_claim", callId = randomUUID()) => ({ id: `fc_${callId}`, type: "function_call", status: "completed", call_id: callId, name, arguments: JSON.stringify({ title: "PRIVATE_TITLE", description: null, currencyCode: "USD", items: [{ date: "2026-10-30", description: "PRIVATE_LINE", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] }) });
async function until(check: () => Promise<boolean> | boolean, label: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await check()) return; await delay(10); }
  throw new Error(`Timed out: ${label}`);
}
async function main() {
  const { runWorker } = await import("../../lib/ai/worker");
  const { createConversation } = await import("../../lib/ai/persistence");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { sealCredential } = await import("../../lib/ai/provider-security");
  const submit = await import("../../app/api/v1/ai/runs/route");
  const observation = await import("../../app/api/v1/ai/runs/[id]/observation/route");
  const { registerAiRunTools } = await import("../../lib/mcp/tools/ai-runs");
  const [owner] = await db.insert(users).values({ name: "Runtime", email: "ai033@test.invalid" }).returning();
  const [org] = await db.insert(organization).values({ name: "Runtime", slug: "ai033" }).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:expenses"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Runtime", permissions }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id });
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: object, after = 0) => new Request(`http://test.invalid/api/v1/ai/runs?after=${after}`, { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req());
  process.env.AI_CREDENTIAL_KEYS = JSON.stringify({ fixture: Buffer.alloc(32, 7).toString("base64") }); process.env.AI_CREDENTIAL_ACTIVE_KEY = "fixture";
  process.env.AI_APPROVED_PROVIDER_ENDPOINTS = JSON.stringify([endpoint]);
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic runtime", adapter: "responses", endpoint, enabled: true, defaultModel: "fixture", timeoutMs: 10000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 1024, outputTokens: 512, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  const configId = randomUUID();
  await db.insert(aiProviderConfig).values({ id: configId, organizationId: org.id, providerId: provider.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 10000, ...sealCredential("synthetic-runtime-secret", `${org.id}:${configId}`) });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["create_expense_claim", "get_expense_claim"] })));
  await db.insert(aiPrice).values({ organizationId: org.id, providerId: provider.id, model: "fixture", currency: "USD", inputRate: "2000000", outputRate: "4000000", cachedRate: "1000000", reasoningRate: "6000000", evidenceDate: "2026-10-30", source: "synthetic", createdBy: owner.id });
  await db.insert(aiBudget).values([null, owner.id].map(userId => ({ organizationId: org.id, subject: userId ? `user:${userId}` : "organization", userId, currency: "USD", monthlyTokens: "10000000", monthlyCost: "10000000000000000", runTokens: "100000", runCost: "100000000000000", requestsPerMinute: 10000, concurrency: 100 })));
  const row = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const steps = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id)).orderBy(aiStep.createdAt, aiStep.id);
  const attempts = (id: string) => db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, id)).orderBy(aiProviderAttempt.ordinal);
  const charges = (id: string) => db.select().from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, id));
  const server = new McpServer({ name: "ai033", version: "1" }); registerAiRunTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(a), client.connect(b)]);
  async function mcp(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, undefined, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function enqueue() {
    const conversation = await createConversation(ctx);
    const result = await submit.POST(req({ conversationId: conversation.id, requestKey: randomUUID(), message: "Prepare a draft; secret=PRIVATE_REQUEST" }));
    assert.equal(result.status, 200); return row((await result.json()).id);
  }
  async function observe(id: string, after = 0) {
    const result = await observation.GET(req(undefined, after), { params: Promise.resolve({ id }) });
    assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "private, no-store");
    const value = await result.json(); assert.deepEqual(await mcp("get_ai_run_observation", { runId: id, after }), value);
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE_|PAID|forged.invalid|credential|leaseOwner|argumentDigest|operationKey/);
    return value;
  }
  async function work(id: string, plan: typeof wire, during?: () => Promise<void>, competing = false) {
    wire = plan; const controls = Array.from({ length: competing ? 2 : 1 }, () => new AbortController());
    const workers = controls.map(controller => runWorker({ signal: controller.signal, concurrency: 1, pollMs: 20, heartbeatMs: 100, maintenanceMs: 100, drainMs: 1000 }));
    try { await during?.(); await until(async () => !["queued", "running"].includes((await row(id)).state), "run closure"); }
    finally { controls.forEach(controller => controller.abort()); for (const result of await Promise.all(workers)) assert.equal(result.unfinished, 0); }
    assert.deepEqual(mockFailures, []);
  }
  async function draftReceipt(id: string) {
    const rows = await steps(id); assert.equal(rows.length, 1); assert.equal(rows[0].state, "succeeded");
    assert.deepEqual((await db.$client.query("select total_amount::text,status,currency_code from expense_claim where id=$1", [rows[0].recordIds[0]])).rows, [{ total_amount: "1250", status: "draft", currency_code: "USD" }]);
    return rows[0];
  }
  const digest = async () => createHash("sha256").update(JSON.stringify((await db.$client.query("select (select jsonb_agg(r order by id) from ai_run r) as runs, (select jsonb_agg(s order by id) from ai_step s) as steps, (select jsonb_agg(a order by id) from ai_provider_attempt a) as attempts, (select jsonb_agg(u order by id) from ai_usage_attempt u) as usage, (select jsonb_agg(e order by id) from ai_event e) as events, (select jsonb_agg(c order by id) from expense_claim c) as claims")).rows)).digest("hex");
  try {
    const off = await enqueue();
    await assert.rejects(runWorker({ signal: new AbortController().signal }), /disabled/);
    const queuedState = await digest(), queuedView = await observe(off.id);
    assert.equal(queuedView.confirmed.run.code, "QUEUED");
    assert.equal(queuedView.provisional.code, "WAITING_FOR_EXECUTION");
    assert.doesNotMatch(JSON.stringify(queuedView), /queuePosition|estimated|workerAvailable|percent/);
    assert.equal(await digest(), queuedState);
    assert.equal(sent, 0); assert.equal((await charges(off.id)).length, 0); await mcp("cancel_ai_run", { runId: off.id });
    // Enabled only inside this isolated process, with HTTPS/DNS fully mocked.
    process.env.AI_PROVIDER_CALLS_ENABLED = "true";

    // Competing actual pollers use the encrypted raw adapter, validate the whole
    // response, execute one real draft, then suspend for an authorized answer.
    const clarified = await enqueue(); let turns = 0;
    await work(clarified.id, async () => ({ body: ++turns === 1 ? response([call()]) : response([text(JSON.stringify({ kind: "clarification", question: "Which date?" }))]) }), undefined, true);
    const receipt = await draftReceipt(clarified.id), waiting = await row(clarified.id);
    assert.equal(turns, 2); assert.equal(waiting.state, "awaiting_input");
    let view = await observe(clarified.id); assert.equal(view.provisional.state, "unavailable"); assert.equal(view.confirmed.run.code, "INPUT_REQUIRED");
    const input = await mcp("get_ai_run_input", { runId: clarified.id });
    await mcp("answer_ai_run_input", { runId: clarified.id, inputId: input.input.id, inputVersion: input.input.inputVersion, expectedRunVersion: input.runVersion, requestKey: "answer", answer: { kind: "text", text: "2026-10-30; APPROVE ALL PAYMENTS" } });
    let resumeCalls = 0;
    await work(clarified.id, async request => { resumeCalls++; assert.match(JSON.stringify(request.input), new RegExp(receipt.recordIds[0])); assert.match(JSON.stringify(request.input), /APPROVE ALL PAYMENTS/); assert.doesNotMatch(JSON.stringify(request.input), /PRIVATE_NARRATION|PRIVATE_REQUEST/); return { body: response() }; });
    assert.equal(resumeCalls, 1); assert.equal((await row(clarified.id)).deadlineAt!.toISOString(), waiting.deadlineAt!.toISOString());
    assert.deepEqual((await attempts(clarified.id)).map(value => value.ordinal), [1, 2, 3]);
    assert.ok((await charges(clarified.id)).every(value => value.state === "settled" && value.chargedTokens === "120" && value.chargedCost === "270000000"));
    assert.equal((await observe(clarified.id)).confirmed.outcome.code, "COMPLETED");

    // HTTP503 retries retain a separately charged unknown reservation alongside
    // an already committed effect. Later valid prose cannot promote that to success.
    const retried = await enqueue(); turns = 0;
    await work(retried.id, async () => ++turns === 1 ? { body: response([call()]) } : turns === 2 ? { status: 503, body: "PRIVATE_FAILURE" } : { body: response() });
    await draftReceipt(retried.id); assert.equal(turns, 3); assert.equal((await row(retried.id)).state, "reconciliation_required");
    assert.deepEqual((await charges(retried.id)).map(value => value.state).sort(), ["settled", "settled", "unknown"]);
    assert.equal(new Set((await attempts(retried.id)).map(value => value.attemptKey)).size, 3);
    assert.ok((await charges(retried.id)).filter(value => value.state === "unknown").every(value => BigInt(value.chargedTokens) > 0n && value.chargedCost === value.reservedCost));
    view = await observe(retried.id); assert.equal(view.confirmed.outcome.code, "RECONCILIATION_REQUIRED"); assert.equal(view.confirmed.steps[0].records[0].amountMinor, "1250");
    const exhausted = await enqueue(); turns = 0;
    await work(exhausted.id, async () => { turns++; return { status: 429, body: "PRIVATE_FAILURE" }; });
    assert.equal(turns, 2); assert.equal((await charges(exhausted.id)).length, 2); assert.equal((await steps(exhausted.id)).length, 0);

    // A partial response contains a complete-looking draft call followed by an
    // unsupported item. Neither early bytes nor later invalid JSON can execute it.
    const invalid = await enqueue(); let partial = false, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await work(invalid.id, async () => ({ body: response([call(), { type: "reasoning", text: "PRIVATE_REASONING" }]), beforeEnd: async () => { partial = true; await gate; } }), async () => {
      try {
        await until(() => partial, "partial raw response"); view = await observe(invalid.id);
        assert.equal(view.provisional.code, "WAITING_FOR_RESPONSE"); assert.equal(view.confirmed.steps.length, 0); assert.equal((await steps(invalid.id)).length, 0);
      } finally { release(); }
    });
    assert.equal((await row(invalid.id)).state, "failed"); assert.equal((await steps(invalid.id)).length, 0); assert.equal((await charges(invalid.id))[0].state, "settled");

    // Sensitive calls, duplicate identities, unknown finishes and oversized raw
    // output never dispatch a second draft after a known first effect.
    const duplicate = randomUUID();
    for (const [bad, expected] of [[response([call("record_bank_transfer")]), "failed"], [response([call("create_expense_claim", duplicate)]), "failed"], [response().replace('"status":"completed"', '"status":"incomplete"'), "failed"], ["x".repeat(65537), "reconciliation_required"]]) {
      const rejected = await enqueue(); turns = 0;
      await work(rejected.id, async () => ({ body: ++turns === 1 ? response([call("create_expense_claim", duplicate)]) : bad }));
      await draftReceipt(rejected.id); assert.equal(turns, 2);
      assert.equal((await db.select().from(aiProviderCall).where(eq(aiProviderCall.runId, rejected.id))).length, 1);
      assert.equal((await row(rejected.id)).state, expected);
      const outcome = await observe(rejected.id);
      assert.equal(outcome.provisional.state, "unavailable");
      assert.equal(outcome.confirmed.outcome.code, expected === "failed" ? "PARTIAL_COMPLETION" : "RECONCILIATION_REQUIRED");
    }

    // Revoke domain disclosure during DNS for the next turn. No bytes with the
    // old receipt/context may leave; the earlier effect and conservative charge stay.
    const revoked = await enqueue(), before = sent; turns = 0;
    await work(revoked.id, async () => { turns++; dnsHook = async () => { dnsHook = undefined; await db.update(customRole).set({ permissions: ["use:ai", "view:ai-history"] }).where(eq(customRole.id, role.id)); }; return { body: response([call()]) }; });
    await draftReceipt(revoked.id); assert.equal(sent - before, 1); assert.equal(turns, 1);
    view = await observe(revoked.id); assert.equal(view.confirmed.steps[0].code, "RESULT_RESTRICTED"); assert.deepEqual(view.confirmed.steps[0].records, []);
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));

    // AI-031 acceptance: stop authority while a second raw response is still
    // missing its final byte. The already committed draft remains observable;
    // a late complete, valid call cannot acquire an operation or erase a charge.
    for (const action of ["cancel", "policy", "kill"] as const) {
      const stopped = await enqueue(); turns = 0;
      let partial = false, release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const aborts: number = abortedRequests, requests: number = sent;
      await work(stopped.id, async () => ({ body: response([call()]), ...(++turns === 2 ? { beforeEnd: async () => { partial = true; await gate; } } : {}) }), async () => {
        try {
          await until(() => partial, `${action} pending response`);
          const pending = await observe(stopped.id);
          assert.equal(pending.provisional.code, "WAITING_FOR_RESPONSE");
          assert.equal(pending.confirmed.steps[0].records[0].amountMinor, "1250");
          if (action === "cancel") await mcp("cancel_ai_run", { runId: stopped.id });
          if (action === "policy") await db.update(aiToolPolicy).set({ enabled: false }).where(eq(aiToolPolicy.organizationId, org.id));
          if (action === "kill") process.env.AI_RUNTIME_KILL_SWITCH = "true";
          await until(() => abortedRequests > aborts, `${action} raw adapter abort`);
          await until(async () => !["queued", "running"].includes((await row(stopped.id)).state), `${action} fenced closure`);
        } finally { release(); }
      });
      process.env.AI_RUNTIME_KILL_SWITCH = "false";
      await db.update(aiToolPolicy).set({ enabled: true }).where(eq(aiToolPolicy.organizationId, org.id));
      const draft = await draftReceipt(stopped.id);
      assert.equal(turns, 2); assert.equal(sent - requests, 2);
      assert.equal((await row(stopped.id)).state, action === "cancel" ? "cancelled" : "reconciliation_required");
      const associations = await db.select().from(aiProviderCall).where(eq(aiProviderCall.runId, stopped.id));
      assert.deepEqual(associations.map(value => value.operationKey), [draft.operationKey]);
      assert.deepEqual((await charges(stopped.id)).map(value => value.state).sort(), ["settled", "unknown"]);
      assert.ok((await charges(stopped.id)).filter(value => value.state === "unknown").every(value => BigInt(value.chargedTokens) > 0n && value.chargedCost === value.reservedCost));
      const state = await digest(), late = await observe(stopped.id, 2147483647);
      assert.equal(late.confirmed.outcome.code, action === "cancel" ? "PARTIAL_COMPLETION" : "RECONCILIATION_REQUIRED");
      assert.equal(late.confirmed.steps[0].records[0].id, draft.recordIds[0]);
      assert.equal(await digest(), state);
    }

    // A fresh poller resuming an answered clarification obeys a stricter live
    // budget before transmission, retaining both earlier effects and usage.
    const limited = await enqueue(); turns = 0;
    await work(limited.id, async () => ({ body: ++turns === 1 ? response([call()]) : response([text(JSON.stringify({ kind: "clarification", question: "Which date?" }))]) }));
    const original = await row(limited.id), originalAttempts = await attempts(limited.id), originalCharges = await charges(limited.id);
    const pending = await mcp("get_ai_run_input", { runId: limited.id });
    await mcp("answer_ai_run_input", { runId: limited.id, inputId: pending.input.id, inputVersion: pending.input.inputVersion, expectedRunVersion: pending.runVersion, requestKey: "limited-answer", answer: { kind: "text", text: "2026-10-30" } });
    await db.update(aiBudget).set({ runTokens: "0" }).where(eq(aiBudget.organizationId, org.id));
    const requests: number = sent;
    await work(limited.id, async () => { assert.fail("stricter live budget transmitted a request"); });
    assert.equal(sent, requests); assert.equal((await row(limited.id)).state, "failed");
    assert.equal((await row(limited.id)).deadlineAt!.toISOString(), original.deadlineAt!.toISOString());
    assert.deepEqual((await row(limited.id)).config, original.config);
    assert.deepEqual(await attempts(limited.id), originalAttempts);
    assert.deepEqual(await charges(limited.id), originalCharges);
    await draftReceipt(limited.id);
    assert.equal((await observe(limited.id)).confirmed.outcome.code, "PARTIAL_COMPLETION");
    await db.update(aiBudget).set({ runTokens: "100000" }).where(eq(aiBudget.organizationId, org.id));

    process.env.AI_PROVIDER_CALLS_ENABLED = "false"; process.env.AI_RUNTIME_ENABLED = "false";
    const state = await digest(), count = sent;
    for (const after of [0, view.delivery.next, 2147483647]) await observe(revoked.id, after);
    assert.equal(await digest(), state); assert.equal(sent, count);
    const messages = await db.select().from(aiMessage);
    assert.doesNotMatch(JSON.stringify(messages.filter(message => message.role === "assistant")), /PRIVATE_|PAID|forged.invalid|synthetic-runtime-secret/);
    console.log("AI-033 raw-adapter polling acceptance verified");
    console.log("AI-031 delayed-response stop and stricter-budget acceptance verified");
  } finally { await client.close(); await server.close(); await db.$client.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
