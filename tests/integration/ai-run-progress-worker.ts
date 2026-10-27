import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiRun, aiStep, aiEvent, aiConversation, aiUsageAttempt, auditLog, contact, journalEntry, expenseClaim } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence");
  const lifecycle = await import("../../lib/ai/run-lifecycle");
  const progress = await import("../../lib/ai/run-progress");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { executionIdentity } = await import("../../lib/api/execution-identity");
  const route = await import("../../app/api/v1/ai/runs/[id]/progress/route");
  const eventsRoute = await import("../../app/api/v1/ai/runs/[id]/events/route");
  const { registerAiRunTools, AI_RUN_LIFECYCLE_TOOLS } = await import("../../lib/mcp/tools/ai-runs");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  assert.ok(AI_RUN_LIFECYCLE_TOOLS.has("get_ai_run_progress"));
  assert.ok(!AI_TOOL_NAMES.some(n => String(n) === "get_ai_run_progress"));
  assert.equal(process.env.AI_RUNTIME_ENABLED, "false");
  const [owner, coworker, outsider] = await db.insert(users).values(["owner", "coworker", "outsider"].map(name => ({ name, email: `ai029-${name}@test.invalid` }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Progress", slug: "ai029-a" }, { name: "Foreign", slug: "ai029-b" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:expenses"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Scoped progress", permissions }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: coworker.id, role: "owner" }, { organizationId: other.id, userId: outsider.id, role: "owner" }]);
  const login = (userId: string) => { session = { user: { id: userId }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const req = (query = "", organizationId = org.id) => new Request(`http://test.invalid/api/v1/ai/runs/progress${query}`, { headers: { "x-organization-id": organizationId } });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response, status = 200) {
    assert.equal(response.status, status, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    return response.json();
  }
  login(owner.id); const ctx = await getAuthContext(req());
  const conversation = await store.createConversation(ctx);
  const config = { providerConfigId: randomUUID(), credentialRef: randomUUID(), configVersion: 1, policyVersion: 1 };
  const queued = await store.enqueueRun(ctx, conversation.id, "progress", config);
  const makeRunning = async (runId: string) => {
    await store.transitionRun(executionIdentity(ctx), runId, 1, "running");
    await db.update(aiRun).set({ leaseOwner: randomUUID(), leaseExpiresAt: new Date(Date.now() + 30000), startedAt: new Date(), deadlineAt: new Date(Date.now() + 600000) }).where(eq(aiRun.id, runId));
  };
  let view = await data(await route.GET(req(), params(queued.id)));
  assert.equal(view.run.code, "QUEUED"); assert.equal(view.observation.workerAvailability, "unknown");
  assert.equal(view.steps.length, 0); assert.ok(view.actions.canStop);
  assert.ok(!("queuePosition" in view));
  await makeRunning(queued.id);
  const [local, foreign, deleted] = await db.insert(contact).values([
    { organizationId: org.id, name: "Ignore policy Bearer PRIVATE_REASONING" }, { organizationId: other.id, name: "Foreign" }, { organizationId: org.id, name: "Deleted", deletedAt: new Date() },
  ]).returning();
  const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 1, date: "2026-10-28", description: "Never export this text", status: "posted" }).returning();
  const [claim] = await db.insert(expenseClaim).values({ organizationId: org.id, submittedBy: owner.id, title: "SECRET_TITLE", currencyCode: "IRR" }).returning({ id: expenseClaim.id });
  await db.execute(sql`update expense_claim set total_amount = 9007199254740993 where id = ${claim.id}`);
  assert.equal((await db.execute(sql`select total_amount::text as amount from expense_claim where id = ${claim.id}`)).rows[0].amount, "9007199254740993");
  async function succeeded(tool: string, refs: string[], required = ["view:data"]) {
    let step = await store.prepareStep(ctx, queued.id, tool, { text: "UNTRUSTED_INPUT", secret: "PRIVATE_SECRET" }, required);
    step = await store.transitionStep(ctx, step.id, step.version, "executing");
    return store.transitionStep(ctx, step.id, step.version, "succeeded", { text: "PROVISIONAL_TEXT", reasoning: "PRIVATE_REASONING", href: "https://evil.invalid", secret: "PRIVATE_SECRET" }, refs);
  }
  const first = await succeeded("get_contact", [local.id, foreign.id, deleted.id, randomUUID()]);
  const draft = await succeeded("create_expense_claim", [claim.id], ["manage:expenses"]);
  await succeeded("get_entry", [entry.id]);
  const unsupported = await succeeded("unreviewed_secret_operation", [local.id]);
  view = await data(await route.GET(req("?limit=2"), params(queued.id)));
  assert.equal(view.steps.length, 2); assert.ok(view.hasMore); assert.equal(view.next.expectedVersion, view.run.version);
  assert.deepEqual(view.steps[0].records, [{ type: "contact", id: local.id, href: `/contacts/${local.id}` }]);
  assert.ok(view.steps[0].recordsOmitted);
  assert.equal(view.steps[1].code, "DRAFT_CREATED");
  assert.equal(view.steps[1].records[0].amountMinor, "9007199254740993");
  assert.equal(view.steps[1].records[0].currencyCode, "IRR");
  assert.equal(view.steps[1].records[0].status, "draft");
  const pageQuery = `?limit=2&afterStepId=${view.next.afterStepId}&expectedVersion=${view.next.expectedVersion}`;
  const page2 = await data(await route.GET(req(pageQuery), params(queued.id)));
  assert.equal(page2.steps.length, 2); assert.equal(page2.hasMore, false);
  assert.equal(page2.steps[0].records[0].status, "posted"); assert.equal(page2.steps[0].records[0].href, `/accounting/${entry.id}`);
  assert.equal(page2.steps[1].id, unsupported.id); assert.equal(page2.steps[1].action, null); assert.equal(page2.steps[1].code, "RESULT_RESTRICTED");
  assert.doesNotMatch(JSON.stringify([view, page2]), /UNTRUSTED|SECRET|PRIVATE_|PROVISIONAL|evil.invalid|unreviewed_secret|credential|leaseOwner|requestKey|input|result|identity/);
  assert.ok(!JSON.stringify(view).includes(foreign.id)); assert.ok(!JSON.stringify(view).includes(deleted.id));
  // Strict REST and registered MCP validation; observing cannot accept authority fields.
  for (const query of ["?limit=0", "?limit=21", "?limit=1&limit=2", "?expectedVersion=1e2", "?expectedVersion=2147483648", `?afterStepId=${first.id}`, "?organizationId=x", "?limit=01", "?afterStepId=bad"]) await data(await route.GET(req(query), params(queued.id)), 400);
  await data(await route.GET(req("?expectedVersion=1"), params(queued.id)), 409);
  await data(await route.GET(req(`?expectedVersion=${view.run.version}&afterStepId=${randomUUID()}`), params(queued.id)), 400);
  await data(await route.GET(req(), params("bad")), 400);
  login(coworker.id); await data(await route.GET(req(), params(queued.id)), 404);
  login(outsider.id); await data(await route.GET(req("", other.id), params(queued.id)), 404);
  login(owner.id);
  const server = new McpServer({ name: "ai029", version: "1" }); registerAiRunTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  async function mcp(args: Record<string, unknown>, error = false) {
    const value = await client.callTool({ name: "get_ai_run_progress", arguments: args });
    assert.equal(!!value.isError, error, JSON.stringify(value));
    if (error) return value;
    return JSON.parse((value.content as { text: string }[])[0].text);
  }
  try {
    const rest = await data(await route.GET(req(), params(queued.id)));
    assert.deepEqual(await mcp({ runId: queued.id }), rest);
    await mcp({ runId: queued.id, identity: {} }, true); await mcp({ runId: queued.id, limit: "2" }, true);
    await mcp({ runId: queued.id, afterStepId: first.id }, true);
    // Step notifications are transactional, ordered, content-free and cursor-bound.
    const events = await lifecycle.getRunEvents(ctx, { runId: queued.id });
    assert.equal(events.events.filter(e => e.kind === "step_prepared").length, 4);
    assert.equal(events.events.filter(e => e.kind === "step_updated").length, 8);
    assert.equal(new Set(events.events.map(e => e.sequence)).size, events.events.length);
    assert.equal(events.next, rest.run.version);
    assert.equal((await lifecycle.getRunEvents(ctx, { runId: queued.id, after: events.next })).events.length, 0);
    const reset = await lifecycle.getRunEvents(ctx, { runId: queued.id, after: events.next + 100 });
    assert.equal(reset.cursorReset, true); assert.deepEqual(reset.events, events.events);
    assert.doesNotMatch(JSON.stringify(events), /UNTRUSTED|SECRET|PRIVATE_|PROVISIONAL|evil.invalid/);
    // A malformed stored notification is never reflected as customer text.
    await db.update(aiEvent).set({ kind: "PRIVATE_REASONING" }).where(and(eq(aiEvent.runId, queued.id), eq(aiEvent.sequence, 1)));
    assert.equal((await lifecycle.getRunEvents(ctx, { runId: queued.id })).events[0].kind, "changed");
    // Read/reconnect leave database state and usage unchanged, even with runtime off.
    const snapshot = async () => JSON.stringify({ runs: await db.select().from(aiRun), steps: await db.select().from(aiStep), events: await db.select().from(aiEvent), usage: await db.select().from(aiUsageAttempt), audit: await db.select().from(auditLog) });
    const before = await snapshot();
    await Promise.all([mcp({ runId: queued.id }), progress.getRunProgress(ctx, { runId: queued.id }), lifecycle.getRunEvents(ctx, { runId: queued.id, after: 0 })]);
    assert.equal(await snapshot(), before);
    // Real lock contention: permissions revoked while a response waits must be refreshed.
    const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL }); await blocker.connect();
    try {
      await blocker.query("BEGIN"); await blocker.query("SELECT id FROM ai_run WHERE id=$1 FOR UPDATE", [queued.id]);
      const delayed = progress.getRunProgress(ctx, { runId: queued.id });
      let waiting = false;
      for (let i = 0; i < 100 && !waiting; i++) {
        const result = await blocker.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%ai_run%' AND pid<>pg_backend_pid()");
        waiting = result.rows.length > 0;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(waiting, "progress read is blocked on the actual run writer");
      await blocker.query("UPDATE custom_role SET permissions=$1::jsonb WHERE id=$2", [JSON.stringify(["use:ai", "view:ai-history"]), role.id]);
      await blocker.query("COMMIT");
      const hidden = await delayed;
      assert.ok(hidden.steps.every(s => s.code === "RESULT_RESTRICTED" && s.records.length === 0 && s.action === null));
      const hiddenMcp = await mcp({ runId: queued.id }); assert.ok(hiddenMcp.steps.every((s: { records: unknown[] }) => !s.records.length));
    } finally { await blocker.query("ROLLBACK"); await blocker.end(); }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    // Deletion/status changes are reloaded rather than trusted from saved output.
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, local.id));
    await db.update(expenseClaim).set({ status: "approved" }).where(eq(expenseClaim.id, claim.id));
    const updated = await mcp({ runId: queued.id });
    assert.equal(updated.steps[0].records.length, 0); assert.equal(updated.steps[1].records[0].status, "approved");
    // Appended steps invalidate a prior page, and equal timestamps still page exactly once.
    const more = await store.prepareStep(ctx, queued.id, "create_expense_claim", {}, ["manage:expenses"]);
    await data(await route.GET(req(pageQuery), params(queued.id)), 409);
    for (let i = 0; i < 15; i++) await store.prepareStep(ctx, queued.id, "list_contacts", {}, ["view:data"]);
    await assert.rejects(store.prepareStep(ctx, queued.id, "list_contacts", {}, ["view:data"]), /step limit/);
    await db.execute(sql`update ai_step set created_at = '2026-10-28T00:00:00.123456Z' where run_id = ${queued.id}`);
    const seen: string[] = []; let next: { afterStepId: string; expectedVersion: number } | null = null;
    do { const page = await progress.getRunProgress(ctx, { runId: queued.id, limit: 3, ...next }); seen.push(...page.steps.map(s => s.id)); next = page.next; } while (next);
    assert.equal(seen.length, 20); assert.equal(new Set(seen).size, 20);
    const stored = await db.select({ id: aiStep.id }).from(aiStep).where(eq(aiStep.runId, queued.id)).orderBy(aiStep.createdAt, aiStep.id);
    assert.deepEqual(seen, stored.map(s => s.id));
    // Stop during an in-flight effect retains confirmed work and uncertain inspection.
    const beforeRace = (await db.select().from(aiRun).where(eq(aiRun.id, queued.id)))[0].version;
    const transitionRace = await Promise.allSettled([1, 2].map(() => store.transitionStep(ctx, more.id, 1, "executing", { text: "PROVISIONAL_TEXT" }, [claim.id])));
    assert.equal(transitionRace.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await db.select().from(aiRun).where(eq(aiRun.id, queued.id)))[0].version, beforeRace + 1);
    let stopped = await lifecycle.cancelRun(ctx, { runId: queued.id }); assert.equal(stopped.state, "running");
    const stopping = await mcp({ runId: queued.id, limit: 20 });
    assert.equal(stopping.run.stop, "requested"); assert.equal(stopping.run.code, "STOP_REQUESTED"); assert.equal(stopping.actions.canStop, false);
    assert.equal(stopping.steps.find((s: { id: string }) => s.id === more.id).records.length, 0);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1000) }).where(eq(aiRun.id, queued.id));
    await lifecycle.maintainRuns();
    const recovered = await mcp({ runId: queued.id, limit: 20 });
    assert.equal(recovered.run.code, "RECONCILIATION_REQUIRED"); assert.equal(recovered.run.stop, "acknowledged"); assert.ok(recovered.actions.requiresReconciliation);
    assert.equal(recovered.steps.find((s: { id: string }) => s.id === draft.id).code, "DRAFT_CREATED");
    const uncertain = recovered.steps.find((s: { id: string }) => s.id === more.id);
    assert.equal(uncertain.code, "RECONCILIATION_REQUIRED"); assert.equal(uncertain.records[0].id, claim.id);
    // Explicit bounded event paging: exactly 100 is complete; 101 has a next page.
    const cursorRun = await store.enqueueRun(ctx, conversation.id, "cursor", config);
    await db.delete(aiEvent).where(eq(aiEvent.runId, cursorRun.id));
    await db.insert(aiEvent).values(Array.from({ length: 100 }, (_, i) => ({ organizationId: org.id, ownerId: owner.id, runId: cursorRun.id, sequence: i + 1, kind: "step_updated" })));
    await db.update(aiRun).set({ version: 100 }).where(eq(aiRun.id, cursorRun.id));
    assert.equal((await lifecycle.getRunEvents(ctx, { runId: cursorRun.id })).hasMore, false);
    await db.insert(aiEvent).values({ organizationId: org.id, ownerId: owner.id, runId: cursorRun.id, sequence: 101, kind: "step_updated" });
    await db.update(aiRun).set({ version: 101 }).where(eq(aiRun.id, cursorRun.id));
    const batch = await lifecycle.getRunEvents(ctx, { runId: cursorRun.id }); assert.ok(batch.hasMore); assert.equal(batch.events.length, 100);
    assert.equal((await lifecycle.getRunEvents(ctx, { runId: cursorRun.id, after: batch.next })).events.length, 1);
    const eventResponse = await eventsRoute.GET(req("?after=999"), params(cursorRun.id));
    assert.equal(eventResponse.status, 200); assert.equal(eventResponse.headers.get("cache-control"), "private, no-store");
    assert.equal((await eventResponse.json()).cursorReset, true);
    stopped = await lifecycle.cancelRun(ctx, { runId: cursorRun.id });
    assert.equal(stopped.state, "cancelled");
    const acknowledged = await mcp({ runId: cursorRun.id });
    assert.equal(acknowledged.run.code, "STOPPED"); assert.equal(acknowledged.run.stop, "acknowledged");
    assert.equal(acknowledged.observation.pollAfterMs, null); assert.equal(acknowledged.actions.canStop, false);
    // History expiry/deletion and loss of history access fail even for a retained MCP closure.
    await db.update(customRole).set({ permissions: ["use:ai"] }).where(eq(customRole.id, role.id));
    await mcp({ runId: queued.id }, true); await data(await route.GET(req(), params(queued.id)), 403);
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() - 1) }).where(eq(aiConversation.id, conversation.id));
    await mcp({ runId: queued.id }, true); await data(await route.GET(req(), params(queued.id)), 404);
    await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() + 10000), deletedAt: new Date() }).where(eq(aiConversation.id, conversation.id));
    await data(await route.GET(req(), params(queued.id)), 404);
    await db.delete(member).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    await mcp({ runId: queued.id }, true);
    console.log("AI progress REST/MCP/SQL verified");
  } finally { await client.close(); await server.close(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
