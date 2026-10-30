import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiStep, aiPrice, aiBudget, aiProviderAttempt, aiUsageAttempt, aiEvent } from "../../lib/db/schema";

let session: unknown;
mock.module("../../lib/auth", { namedExports: { auth: async () => session } });
const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } };
const text = (value: string) => ({ id: "msg", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: value, annotations: [] }] });
const response = (output: unknown[] = [text("SECRET_MODEL PAID https://forged.invalid PRIVATE_REASONING")]) => JSON.stringify({ model: "fixture", status: "completed", output, usage });
const draft = () => response([{ id: randomUUID(), type: "function_call", status: "completed", call_id: randomUUID(), name: "create_expense_claim", arguments: JSON.stringify({ title: "SECRET_TITLE", description: null, currencyCode: "USD", items: [{ date: "2026-10-30", description: "SECRET_ITEM", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] }) }]);
async function until(check: () => Promise<boolean> | boolean, label: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await check()) return; await delay(15); }
  throw new Error(`Timed out: ${label}`);
}

async function main() {
  const { runWorker } = await import("../../lib/ai/worker");
  if (process.argv.includes("--child")) {
    const mode = process.env.AI036_FIXTURE_MODE;
    const controller = new AbortController();
    let finish: (() => void) | undefined, calls = 0;
    process.on("message", message => { if (message === "stop") controller.abort(); if (message === "finish") finish?.(); });
    const result = await runWorker({ signal: controller.signal, concurrency: 1, pollMs: 20, heartbeatMs: 50, maintenanceMs: 50, drainMs: 500,
      transport: async request => {
        calls++;
        if (mode === "clarify") return calls === 1 ? draft() : response([text(JSON.stringify({ kind: "clarification", question: "Which date?" }))]);
        if (mode === "crash" && calls === 1) return draft();
        if (mode === "resume") {
          assert.match(JSON.stringify(request.input), /1250/);
          assert.match(JSON.stringify(request.input), /2026-10-30/);
        }
        // IPC tests use the same AbortController path as the CLI signal handler.
        // Real SIGKILL below exercises process loss, independent of IPC shutdown.
        return new Promise<string>(resolve => {
          finish = () => resolve(response());
          process.stdout.write("PROVIDER_PENDING\n");
        });
      }, onEvent: event => { if (event === "settled" || event === "execution_failed") controller.abort(); },
    });
    process.stdout.write(`DRAINED ${result.unfinished} CALLS ${calls}\n`);
    await db.$client.end(); process.disconnect?.(); return;
  }
  const store = await import("../../lib/ai/persistence");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const submit = await import("../../app/api/v1/ai/runs/route");
  const observation = await import("../../app/api/v1/ai/runs/[id]/observation/route");
  const { registerAiRunTools } = await import("../../lib/mcp/tools/ai-runs");
  const [owner] = await db.insert(users).values({ name: "Combined", email: "ai036@test.invalid" }).returning();
  const [org] = await db.insert(organization).values({ name: "Combined", slug: "ai036" }).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:expenses"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Combined", permissions }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id });
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: object, after = 0) => new Request(`http://test.invalid/api/v1/ai/runs?after=${after}`, { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic combined", adapter: "responses", endpoint: "https://fixture.test.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 5000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 1024, outputTokens: 512, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 5000, credential: "synthetic-unused", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["create_expense_claim", "get_expense_claim"] })));
  await db.insert(aiPrice).values({ organizationId: org.id, providerId: provider.id, model: "fixture", currency: "USD", inputRate: "2000000", outputRate: "4000000", cachedRate: "1000000", reasoningRate: "6000000", evidenceDate: "2026-10-30", source: "synthetic", createdBy: owner.id });
  await db.insert(aiBudget).values([null, owner.id].map(userId => ({ organizationId: org.id, subject: userId ? `user:${userId}` : "organization", userId, currency: "USD", monthlyTokens: "10000000", monthlyCost: "10000000000000000", runTokens: "100000", runCost: "100000000000000", requestsPerMinute: 10000, concurrency: 100 })));
  const row = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const steps = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id)).orderBy(aiStep.createdAt, aiStep.id);
  const attempts = (id: string) => db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, id)).orderBy(aiProviderAttempt.ordinal);
  const charges = (id: string) => db.select().from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, id));
  async function enqueue() {
    const conversation = await store.createConversation(ctx);
    const result = await submit.POST(req({ conversationId: conversation.id, requestKey: randomUUID(), message: "Prepare a draft SECRET_PROMPT" }));
    assert.equal(result.status, 200); return row((await result.json()).id);
  }
  const server = new McpServer({ name: "ai036", version: "1" }); registerAiRunTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(a), client.connect(b)]);
  async function mcp(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, undefined, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function observe(id: string, after = 0) {
    const result = await observation.GET(req(undefined, after), { params: Promise.resolve({ id }) });
    assert.equal(result.status, 200, await result.clone().text()); assert.equal(result.headers.get("cache-control"), "private, no-store");
    const rest = await result.json(), linked = await mcp("get_ai_run_observation", { runId: id, after });
    assert.deepEqual(linked, rest);
    assert.equal(rest.delivery.replace, true); assert.deepEqual(rest.provisional.records, []);
    assert.doesNotMatch(JSON.stringify(rest), /SECRET_|PRIVATE_REASONING|PAID|forged.invalid|credential|leaseOwner|operationKey|argumentDigest/);
    return rest;
  }
  // Compare durable execution/effect/usage state as a whole, independent of the
  // public projection, proving disconnected/runtime-off observations do no work.
  const snapshot = async () => createHash("sha256").update(JSON.stringify((await db.$client.query("select (select jsonb_agg(r order by id) from ai_run r) as runs, (select jsonb_agg(s order by id) from ai_step s) as steps, (select jsonb_agg(a order by id) from ai_provider_attempt a) as attempts, (select jsonb_agg(u order by id) from ai_usage_attempt u) as usage, (select jsonb_agg(e order by id) from ai_event e) as events, (select jsonb_agg(c order by id) from expense_claim c) as claims")).rows)).digest("hex");
  const children = new Set<ReturnType<typeof spawn>>();
  function child(mode: string) {
    const value = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-polling-observation-worker.ts", "--child"], { env: { ...process.env, AI036_FIXTURE_MODE: mode }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    children.add(value); let output = "";
    value.stdout!.on("data", chunk => { output += chunk; }); value.stderr!.on("data", chunk => { output += chunk; });
    const exited = new Promise<number | null>((resolve, reject) => { value.once("exit", code => { children.delete(value); resolve(code); }); value.once("error", reject); });
    return { value, exited, output: () => output };
  }
  const limits = (run: Awaited<ReturnType<typeof row>>) => ({ deadlineAt: run.deadlineAt, config: run.config });
  try {
    // A process exits at a durable clarification after creating a real draft.
    // Observation in the gap cannot resume it or spend another provider attempt.
    const clarified = await enqueue(), first = child("clarify");
    assert.equal(await first.exited, 0, first.output()); assert.match(first.output(), /CALLS 2/);
    const waiting = await row(clarified.id), initialLimits = limits(waiting), receipt = (await steps(clarified.id))[0];
    assert.equal(waiting.state, "awaiting_input");
    let view = await observe(clarified.id);
    assert.equal(view.provisional.state, "unavailable"); assert.equal(view.confirmed.run.code, "INPUT_REQUIRED");
    assert.equal(view.confirmed.steps[0].records[0].amountMinor, "1250");
    const beforeAnswer = await snapshot(); await observe(clarified.id, view.delivery.next); assert.equal(await snapshot(), beforeAnswer);
    const input = await mcp("get_ai_run_input", { runId: clarified.id });
    assert.equal((await mcp("answer_ai_run_input", { runId: clarified.id, inputId: input.input.id, inputVersion: input.input.inputVersion, expectedRunVersion: input.runVersion, requestKey: "answer", answer: { kind: "text", text: "2026-10-30" } })).code, "ANSWER_ACCEPTED");
    const continuation = child("resume");
    await until(() => continuation.output().includes("PROVIDER_PENDING"), "fresh process continuation");
    view = await observe(clarified.id, view.delivery.next);
    assert.equal(view.provisional.code, "WAITING_FOR_RESPONSE"); assert.equal(view.confirmed.steps[0].records[0].id, receipt.recordIds[0]);
    continuation.value.send("finish"); assert.equal(await continuation.exited, 0, continuation.output()); assert.match(continuation.output(), /CALLS 1/);
    assert.deepEqual(limits(await row(clarified.id)), initialLimits);
    assert.deepEqual((await attempts(clarified.id)).map(attempt => attempt.ordinal), [1, 2, 3]);
    assert.equal((await steps(clarified.id)).length, 1); view = await observe(clarified.id);
    assert.equal(view.confirmed.outcome.code, "COMPLETED"); assert.equal(view.provisional.state, "unavailable");

    // A domain-table writer can delay disclosure AFTER the reader's initial
    // authorization checks. Revoked grants must discard that delayed snapshot.
    for (const transport of ["REST", "MCP"]) {
      const gate = await db.$client.connect();
      try {
        await gate.query("begin"); await gate.query("lock table expense_claim in access exclusive mode");
        const delayed = transport === "REST"
          ? observation.GET(req(), { params: Promise.resolve({ id: clarified.id }) }).then(async result => ({ denied: result.status === 409, body: await result.text() }))
          : client.callTool({ name: "get_ai_run_observation", arguments: { runId: clarified.id, after: view.delivery.next } }).then(result => ({ denied: !!result.isError, body: JSON.stringify(result) }));
        await until(async () => {
          await db.$client.query("select pg_stat_clear_snapshot()");
          return (await db.$client.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%from \"expense_claim\"%'")).rows.length > 0;
        }, "observation domain read lock");
        await gate.query("update custom_role set permissions=$1::jsonb where id=$2", [JSON.stringify(["use:ai", "view:ai-history"]), role.id]);
        await gate.query("commit");
        const denied = await delayed;
        assert.equal(denied.denied, true, denied.body); assert.match(denied.body, /disclosure changed/);
        assert.doesNotMatch(denied.body, /1250|SECRET_|purchases\/expenses/);
        assert.deepEqual((await observe(clarified.id, view.delivery.next)).confirmed.steps[0].records, []);
      } finally { await gate.query("rollback"); gate.release(); }
      await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    }

    // Observe a known effect while its next response is pending, then kill that
    // process. A replacement process recovers with an explicitly unknown charge,
    // without reissuing the draft or promoting provisional output to success.
    const crashed = await enqueue(), producer = child("crash");
    await until(() => producer.output().includes("PROVIDER_PENDING"), "known draft before process crash");
    const beforeCrash = await row(crashed.id), originalSteps = await steps(crashed.id), originalAttempts = await attempts(crashed.id), originalCharges = await charges(crashed.id);
    view = await observe(crashed.id); const cursor = view.delivery.next;
    assert.equal(view.provisional.code, "WAITING_FOR_RESPONSE"); assert.equal(view.confirmed.steps[0].code, "DRAFT_CREATED");
    producer.value.kill("SIGKILL"); await producer.exited;
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, crashed.id));
    const staleSnapshot = await snapshot(); view = await observe(crashed.id, cursor);
    assert.equal(view.provisional.code, "OBSERVATION_DELAYED"); assert.equal(await snapshot(), staleSnapshot);
    const recovery = child("recover"); assert.equal(await recovery.exited, 0, recovery.output()); assert.match(recovery.output(), /CALLS 0/);
    assert.equal((await row(crashed.id)).state, "reconciliation_required");
    assert.deepEqual(limits(await row(crashed.id)), limits(beforeCrash));
    assert.deepEqual((await steps(crashed.id)).map(step => [step.id, step.operationKey, step.recordIds]), originalSteps.map(step => [step.id, step.operationKey, step.recordIds]));
    assert.deepEqual((await attempts(crashed.id)).map(attempt => [attempt.id, attempt.ordinal, attempt.snapshot]), originalAttempts.map(attempt => [attempt.id, attempt.ordinal, attempt.snapshot]));
    const chargedSnapshot = (rows: Awaited<ReturnType<typeof charges>>) => rows.map(charge => [charge.id, charge.priceSnapshot, charge.budgetVersions, charge.reservedTokens, charge.reservedCost, charge.chargedTokens, charge.chargedCost]).sort();
    assert.deepEqual(chargedSnapshot(await charges(crashed.id)), chargedSnapshot(originalCharges));
    assert.deepEqual((await charges(crashed.id)).map(charge => charge.state).sort(), ["settled", "unknown"]);
    view = await observe(crashed.id, cursor); assert.equal(view.confirmed.outcome.code, "RECONCILIATION_REQUIRED"); assert.equal(view.provisional.state, "unavailable");
    assert.deepEqual((await db.$client.query("select total_amount::text,status from expense_claim where id=$1", [originalSteps[0].recordIds[0]])).rows, [{ total_amount: "1250", status: "draft" }]);
    assert.equal((await db.$client.query("select count(*)::int as n from expense_claim")).rows[0].n, 2);

    // The same execution cursor cannot keep a revoked receipt visible. All
    // reconnect variants remain reads when both execution gates are off.
    process.env.AI_RUNTIME_ENABLED = "false";
    const offSnapshot = await snapshot();
    for (const after of [0, cursor, view.delivery.next, 2147483647]) await observe(crashed.id, after);
    assert.equal(await snapshot(), offSnapshot);
    const currentCursor = view.delivery.next;
    await db.update(customRole).set({ permissions: ["use:ai", "view:ai-history"] }).where(eq(customRole.id, role.id));
    view = await observe(crashed.id, currentCursor); assert.equal(view.delivery.executionChanged, false); assert.equal(view.confirmed.steps[0].code, "RESULT_RESTRICTED"); assert.deepEqual(view.confirmed.steps[0].records, []);
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    await db.delete(aiEvent).where(eq(aiEvent.runId, crashed.id));
    assert.equal((await observe(crashed.id, currentCursor)).delivery.cursorReset, true);
    process.env.AI_RUNTIME_ENABLED = "true";

    // Graceful shutdown of a fresh process during a provider request must leave
    // an honest persisted reconciliation state visible on reconnect.
    const stopped = await enqueue(), draining = child("crash");
    await until(() => draining.output().includes("PROVIDER_PENDING"), "shutdown provider entry");
    draining.value.send("stop"); assert.equal(await draining.exited, 0, draining.output()); assert.match(draining.output(), /DRAINED 0 CALLS 2/);
    view = await observe(stopped.id); assert.equal(view.confirmed.outcome.code, "RECONCILIATION_REQUIRED"); assert.equal(view.provisional.state, "unavailable"); assert.equal(view.confirmed.steps[0].records[0].amountMinor, "1250");
    const afterShutdown = await snapshot(); await observe(stopped.id, view.delivery.next); assert.equal(await snapshot(), afterShutdown);
    console.log("AI-036 combined polling and observation acceptance verified");
  } finally {
    await Promise.all([...children].map(value => new Promise<void>(resolve => { value.once("exit", () => resolve()); value.kill("SIGKILL"); })));
    await client.close(); await server.close(); await db.$client.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
