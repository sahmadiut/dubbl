import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, inArray } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiStep, aiPrice, aiBudget, aiProviderAttempt, aiUsageAttempt } from "../../lib/db/schema";
import type { ProviderTransport } from "../../lib/ai/provider-attempts";

let session: unknown;
mock.module("../../lib/auth", { namedExports: { auth: async () => session } });
const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } };
const text = (value: string) => ({ id: "msg", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: value, annotations: [] }] });
const response = (output: unknown[] = [text("forged paid https://untrusted.invalid")]) => JSON.stringify({ model: "fixture", status: "completed", output, usage });
const draftArgs = { title: "AI-039 real draft", description: null, currencyCode: "USD", items: [{ date: "2026-10-30", description: "Exact amount", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] };
const draft = () => response([{ id: `fc_${randomUUID()}`, type: "function_call", status: "completed", call_id: randomUUID(), name: "create_expense_claim", arguments: JSON.stringify(draftArgs) }]);
const childArgs = ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-worker-fixture.ts"];
async function until(check: () => Promise<boolean> | boolean, label: string, ms = 15000) {
  const limit = Date.now() + ms;
  while (Date.now() < limit) { if (await check()) return; await delay(20); }
  throw new Error(`Timed out: ${label}`);
}
async function main() {
  const { runWorker } = await import("../../lib/ai/worker");
  const runs = await import("../../lib/ai/run-lifecycle");
  if (process.argv.includes("--child")) {
    const fixture = JSON.parse(process.env.AI_WORKER_FIXTURE!);
    const controller = new AbortController();
    // IPC makes graceful shutdown portable to Windows, where SIGTERM forcibly
    // terminates a child. The production CLI's signal handler calls the same API.
    process.on("message", message => { if (message === "stop") controller.abort(); });
    let received = 0;
    const result = await runWorker({ signal: controller.signal, pollMs: 30, heartbeatMs: 50, maintenanceMs: 50, drainMs: 300,
      transport: async () => {
        received++;
        if (fixture.mode === "crash") {
          if (received === 1) return draft();
          process.stdout.write("DRAFT_AND_PROVIDER_COMMITTED\n"); return new Promise(() => {});
        }
        if (fixture.mode === "shutdown") { process.stdout.write("PROVIDER_COMMITTED\n"); return new Promise(() => {}); }
        return response();
      }, onEvent: event => { if (event === "settled" || event === "execution_failed") controller.abort(); },
    });
    process.stdout.write(`CHILD_DRAINED ${result.unfinished}\n`); process.exit(0);
  }
  const store = await import("../../lib/ai/persistence");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const submit = await import("../../app/api/v1/ai/runs/route");
  const progress = await import("../../app/api/v1/ai/runs/[id]/progress/route");
  const { registerAiRunTools } = await import("../../lib/mcp/tools/ai-runs");
  const [owner, other] = await db.insert(users).values([{ name: "Poller", email: "ai039@test.invalid" }, { name: "Other", email: "ai039-other@test.invalid" }]).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Poller", slug: "ai039" }, { name: "Other tenant", slug: "ai039-foreign" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:expenses"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Poller", permissions }).returning();
  await db.insert(member).values([owner, other].map(user => ({ organizationId: org.id, userId: user.id, role: "member" as const, customRoleId: role.id })));
  const [foreignRole] = await db.insert(customRole).values({ organizationId: foreign.id, name: "Other tenant", permissions }).returning();
  await db.insert(member).values({ organizationId: foreign.id, userId: owner.id, role: "member", customRoleId: foreignRole.id });
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  login(owner.id);
  const req = (body?: object, organizationId = org.id) => new Request("http://test.invalid/api/v1/ai/runs", { method: body ? "POST" : "GET", headers: { "x-organization-id": organizationId, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic poller", adapter: "responses", endpoint: "https://fixture.test.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 5000,
    delegatedOrganizations: [org.id, foreign.id], models: [{ id: "fixture", contextTokens: 1024, outputTokens: 512, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  const [config] = await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 5000, credential: "synthetic-unused", keyVersion: "fixture" }).returning();
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["create_expense_claim", "get_expense_claim"] })));
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: foreign.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 5000, credential: "synthetic-unused", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: foreign.id, subject, enabled: true, allowedTools: ["create_expense_claim"] })));
  await db.insert(aiPrice).values({ organizationId: org.id, providerId: provider.id, model: "fixture", currency: "USD", inputRate: "2000000", outputRate: "4000000", cachedRate: "1000000", reasoningRate: "6000000", evidenceDate: "2026-10-30", source: "synthetic", createdBy: owner.id });
  await db.insert(aiBudget).values([null, owner.id, other.id].map(userId => ({ organizationId: org.id, subject: userId ? `user:${userId}` : "organization", userId, currency: "USD", monthlyTokens: "10000000", monthlyCost: "10000000000000000", runTokens: "100000", runCost: "100000000000000", requestsPerMinute: 10000, concurrency: 100 })));
  const row = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const steps = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id));
  const attempts = (id: string) => db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, id)).orderBy(aiProviderAttempt.ordinal);
  const charges = (id: string) => db.select().from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, id));
  async function enqueue(message = "Prepare the requested draft") {
    const conversation = await store.createConversation(ctx);
    const res = await submit.POST(req({ conversationId: conversation.id, requestKey: randomUUID(), message })); assert.equal(res.status, 200); return await row((await res.json()).id);
  }
  const server = new McpServer({ name: "ai039", version: "1" }); registerAiRunTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(a), client.connect(b)]);
  const mcp = async (name: string, args: Record<string, unknown>) => { const res = await client.callTool({ name, arguments: args }); assert.equal(res.isError, undefined); return JSON.parse((res.content as { text: string }[])[0].text); };
  async function workerUntil(id: string, transport: ProviderTransport, state: string) {
    const controller = new AbortController();
    const running = runWorker({ signal: controller.signal, transport, pollMs: 30, heartbeatMs: 50, maintenanceMs: 100, drainMs: 1000 });
    try { await until(async () => (await row(id)).state === state, state); }
    finally { controller.abort(); assert.equal((await running).unfinished, 0); }
  }
  const children = new Set<ReturnType<typeof spawn>>();
  async function child(mode: string) {
    const value = spawn(process.execPath, [...childArgs, "--child"], { env: { ...process.env, AI_WORKER_FIXTURE: JSON.stringify({ mode }) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] }); children.add(value);
    let output = ""; value.stdout!.on("data", chunk => { output += chunk; }); value.stderr!.on("data", chunk => { output += chunk; });
    const exited = new Promise<number | null>((resolve, reject) => { value.once("exit", code => { children.delete(value); resolve(code); }); value.once("error", reject); });
    return { value, exited, output: () => output };
  }
  try {
    // The actual production CLI rejects default-off before importing the DB.
    const disabled = spawnSync(process.execPath, ["--import", "tsx", "scripts/ai-worker.ts"], { env: { ...process.env, DATABASE_URL: "invalid://must-not-connect", AI_RUNTIME_ENABLED: "false" }, windowsHide: true, encoding: "utf8", timeout: 10000 });
    assert.equal(disabled.status, 1); assert.match(disabled.stderr, /AI_WORKER_STOPPED/); assert.doesNotMatch(disabled.stderr, /invalid:\/\//);
    const off = await enqueue(); await assert.rejects(runWorker({ signal: new AbortController().signal }), /disabled/);
    assert.equal((await row(off.id)).state, "queued"); assert.equal((await charges(off.id)).length, 0); await runs.cancelRun(ctx, { runId: off.id });

    // Capacity filtering precedes the 100-row scan. Another owner can run even
    // when the first owner has 101 older queued requests and an active lease.
    const blocked = await enqueue(); await runs.claimNextRun(); const blockedRow = await row(blocked.id);
    const backlog = Array.from({ length: 101 }, () => ({ ...blockedRow, id: randomUUID(), requestKey: randomUUID(), state: "queued" as const, leaseOwner: null, leaseExpiresAt: null, createdAt: new Date(Date.now() - 10000) }));
    await db.insert(aiRun).values(backlog);
    login(other.id); const otherCtx = await getAuthContext(req()), c = await store.createConversation(otherCtx);
    const eligible = await runs.submitRun(otherCtx, { conversationId: c.id, requestKey: "eligible", message: "Eligible owner" }); login(owner.id);
    const admitted = await runs.claimNextRun(); assert.equal(admitted?.id, eligible.id);
    const foreignCtx = await getAuthContext(req(undefined, foreign.id)), foreignConversation = await store.createConversation(foreignCtx);
    const foreignRun = await runs.submitRun(foreignCtx, { conversationId: foreignConversation.id, requestKey: "other_tenant", message: "Eligible tenant" });
    assert.equal((await runs.claimNextRun())?.id, foreignRun.id, "a full tenant cannot hide another tenant behind its backlog");
    await runs.cancelRun(foreignCtx, { runId: foreignRun.id });
    await runs.cancelRun(otherCtx, { runId: eligible.id }); await runs.cancelRun(ctx, { runId: blocked.id });
    await db.update(aiRun).set({ state: "cancelled", finishedAt: new Date() }).where(inArray(aiRun.id, backlog.map(r => r.id)));

    // A real heartbeat waits on the run lock across lease expiry. It must reject
    // the old lease instead of calculating validity from pre-wait wall time.
    const expired = await enqueue(); const leased = await runs.claimNextRun(); assert.equal(leased?.id, expired.id);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() + 500) }).where(eq(aiRun.id, expired.id));
    const lock = await db.$client.connect(); await lock.query("begin"); await lock.query("select id from ai_run where id=$1 for update", [expired.id]);
    const denied = assert.rejects(runs.heartbeatRun(expired.id, leased!.leaseOwner!), /lease/);
    try { await delay(600); } finally { await lock.query("rollback"); lock.release(); } await denied;
    assert.ok((await row(expired.id)).leaseExpiresAt!.getTime() <= Date.now()); await runs.cancelRun(ctx, { runId: expired.id });

    // Dependent MCP-backed draft, durable question, same-run continuation and
    // grounded REST/MCP result under actual poll/claim/heartbeat scheduling.
    const clarified = await enqueue(); let turns = 0;
    await workerUntil(clarified.id, async () => ++turns === 1 ? draft() : response([text(JSON.stringify({ kind: "clarification", question: "Which date?" }))]), "awaiting_input");
    const waiting = await row(clarified.id), question = await mcp("get_ai_run_input", { runId: clarified.id });
    const receipt = await mcp("answer_ai_run_input", { runId: clarified.id, inputId: question.input.id, inputVersion: question.input.inputVersion, expectedRunVersion: question.runVersion, requestKey: "answer", answer: { kind: "text", text: "2026-10-30" } }); assert.equal(receipt.code, "ANSWER_ACCEPTED");
    await workerUntil(clarified.id, async request => { assert.match(JSON.stringify(request.input), /1250/); return response(); }, "succeeded");
    assert.equal((await row(clarified.id)).deadlineAt!.toISOString(), waiting.deadlineAt!.toISOString()); assert.deepEqual((await attempts(clarified.id)).map(a => a.ordinal), [1, 2, 3]);
    const step = (await steps(clarified.id))[0]; assert.equal(step.state, "succeeded");
    assert.deepEqual((await db.$client.query("select total_amount::text,status from expense_claim where id=$1", [step.recordIds[0]])).rows, [{ total_amount: "1250", status: "draft" }]);
    const rest = await (await progress.GET(req(), { params: Promise.resolve({ id: clarified.id }) })).json(); assert.deepEqual(await mcp("get_ai_run_progress", { runId: clarified.id }), rest);
    assert.equal(rest.steps[0].records[0].href, `/purchases/expenses/${step.recordIds[0]}`); assert.equal(rest.outcome.code, "COMPLETED");

    // Two real loops compete; only one provider invocation/usage reservation.
    const competing = await enqueue(); const s1 = new AbortController(), s2 = new AbortController(); let calls = 0, renewed = false;
    const transport: ProviderTransport = async () => {
      calls++; const originalLease = (await row(competing.id)).leaseExpiresAt!.getTime();
      await until(async () => (await row(competing.id)).leaseExpiresAt!.getTime() > originalLease, "live lease renewal");
      renewed = true; return response();
    };
    const pair = [s1, s2].map(signal => runWorker({ signal: signal.signal, transport, pollMs: 30, heartbeatMs: 50, maintenanceMs: 100, drainMs: 1000 }));
    try { await until(async () => (await row(competing.id)).state === "succeeded", "competing workers"); }
    finally { s1.abort(); s2.abort(); await Promise.all(pair); }
    assert.equal(calls, 1); assert.equal((await charges(competing.id)).length, 1); assert.equal(renewed, true);

    // Live cancellation and revocation abort pending provider work before timeout.
    for (const action of ["cancel", "config", "kill"] as const) {
      const stopped = await enqueue(), controller = new AbortController(); let aborted = false, entered = false;
      const running = runWorker({ signal: controller.signal, pollMs: 30, heartbeatMs: 50, maintenanceMs: 100, drainMs: 1000,
        transport: async (_request, signal) => { entered = true; signal.addEventListener("abort", () => { aborted = true; }, { once: true }); return new Promise(() => {}); } });
      try {
        await until(() => entered, "provider transport entry");
        if (action === "cancel") await mcp("cancel_ai_run", { runId: stopped.id });
        if (action === "config") await db.update(aiProviderConfig).set({ version: 2 }).where(eq(aiProviderConfig.id, config.id));
        if (action === "kill") process.env.AI_RUNTIME_KILL_SWITCH = "true";
        await until(() => aborted, "provider abort");
      } finally { controller.abort(); await running; delete process.env.AI_RUNTIME_KILL_SWITCH; await db.update(aiProviderConfig).set({ version: 1 }).where(eq(aiProviderConfig.id, config.id)); }
      assert.equal((await steps(stopped.id)).length, 0); assert.equal((await charges(stopped.id))[0].state, "unknown");
    }
    for (const field of ["requestsPerMinute", "runTokens"] as const) {
      const deniedRun = await enqueue(); await db.update(aiBudget).set({ [field]: field === "runTokens" ? "0" : 0 }).where(eq(aiBudget.organizationId, org.id));
      let sent = 0; await workerUntil(deniedRun.id, async () => { sent++; return response(); }, "failed"); assert.equal(sent, 0); assert.equal((await charges(deniedRun.id)).length, 0);
      await db.update(aiBudget).set({ requestsPerMinute: 10000, runTokens: "100000" }).where(eq(aiBudget.organizationId, org.id));
    }

    // Hold the ACTUAL registered draft inside PostgreSQL. Cancellation waits for
    // its safe business boundary; process shutdown has a bounded drain instead.
    await db.$client.query("create function ai039_gate() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(390039); return NEW; end $$");
    await db.$client.query("create trigger ai039_gate before insert on expense_claim for each row execute function ai039_gate()");
    async function blockedQuery(part: string) {
      await db.$client.query("select pg_stat_clear_snapshot()");
      return (await db.$client.query("select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1", [`%${part}%`])).rows[0].n > 0;
    }
    for (const action of ["cancel", "shutdown"] as const) {
      const effect = await enqueue(), pending = action === "shutdown" ? await enqueue("Keep queued during shutdown") : null, controller = new AbortController();
      const gate = await db.$client.connect(); await gate.query("select pg_advisory_lock(390039)");
      let sent = 0;
      const running = runWorker({ signal: controller.signal, concurrency: 1, pollMs: 30, heartbeatMs: 50, maintenanceMs: 100, drainMs: 100,
        transport: async () => { sent++; return draft(); } });
      try {
        await until(() => blockedQuery('insert into "expense_claim"'), "business transaction paused");
        assert.equal((await steps(effect.id))[0].state, "executing");
        const provisional = await mcp("get_ai_run_progress", { runId: effect.id }); assert.deepEqual(provisional.steps[0].records, []);
        if (action === "cancel") {
          const cancellation = mcp("cancel_ai_run", { runId: effect.id });
          await until(() => blockedQuery('insert into "ai_event"'), "stop waits for business boundary");
          await gate.query("select pg_advisory_unlock(390039)"); await cancellation;
          await until(async () => (await row(effect.id)).state === "cancelled", "known cancelled write receipt");
          controller.abort(); await running;
        } else {
          controller.abort(); assert.equal((await running).unfinished, 1);
          assert.equal((await row(pending!.id)).state, "queued", "shutdown does not claim queued work");
          await gate.query("select pg_advisory_unlock(390039)");
          await until(async () => (await row(effect.id)).state === "failed", "late known write settles safely");
        }
        assert.equal(sent, 1); assert.equal((await steps(effect.id)).length, 1);
        assert.equal((await steps(effect.id))[0].state, "succeeded");
        assert.equal((await mcp("get_ai_run_progress", { runId: effect.id })).outcome.code, "PARTIAL_COMPLETION");
      } finally {
        controller.abort(); await gate.query("select pg_advisory_unlock(390039)"); gate.release(); await running;
        if (pending) await runs.cancelRun(ctx, { runId: pending.id });
      }
    }

    // Shutdown a separately running process during a provider request. Its
    // ignored transport abort cannot keep execution authority or a lease alive.
    const graceful = await enqueue(), gracefulChild = await child("shutdown");
    await until(() => gracefulChild.output().includes("PROVIDER_COMMITTED"), "child provider dispatch"); gracefulChild.value.send("stop");
    assert.equal(await gracefulChild.exited, 0); assert.match(gracefulChild.output(), /CHILD_DRAINED 0/);
    assert.equal((await row(graceful.id)).state, "reconciliation_required"); assert.equal((await charges(graceful.id))[0].state, "unknown");

    // Kill one polling process after a committed business draft and second
    // provider dispatch; another polling process recovers without action replay.
    const crashed = await enqueue(), crashChild = await child("crash");
    await until(() => crashChild.output().includes("DRAFT_AND_PROVIDER_COMMITTED"), "child committed draft");
    const deadline = (await row(crashed.id)).deadlineAt!.toISOString(); crashChild.value.kill("SIGKILL"); await crashChild.exited;
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, crashed.id));
    const recovery = await child("recover"); assert.equal(await recovery.exited, 0);
    assert.equal((await row(crashed.id)).state, "reconciliation_required"); assert.equal((await row(crashed.id)).deadlineAt!.toISOString(), deadline);
    assert.equal((await steps(crashed.id)).length, 1); assert.deepEqual((await attempts(crashed.id)).map(a => a.ordinal), [1, 2]);
    assert.deepEqual((await charges(crashed.id)).map(a => a.state).sort(), ["settled", "unknown"]);
    console.log("AI-039 polling REST/MCP/SQL and process lifecycle verified");
  } finally {
    for (const value of children) value.kill("SIGKILL");
    await client.close(); await server.close(); await db.$client.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
