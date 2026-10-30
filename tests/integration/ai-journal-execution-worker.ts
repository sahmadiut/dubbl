import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, journalEntry, journalLine, aiProvider, aiProviderConfig, aiToolPolicy,
  aiActionConsumption, aiRun, aiStep, approvalWorkflow, approvalWorkflowStep, periodLock, payment, fiscalYear } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.env.AI052_EXECUTE) { console.log(JSON.stringify(await batches.executeApprovedJournal(JSON.parse(process.env.AI052_EXECUTE)))); return; }
  if (process.env.AI052_RECOVER === "true") { await runs.maintainRuns(); console.log("Fresh process recovered consumed operation"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const [owner, other] = await db.insert(users).values(["owner", "other"].map(name => ({ name, email: `ai052-${name}@test.invalid` }))).returning();
  const [org] = await db.insert(organization).values({ name: "Execute", slug: "execute" }).returning();
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
  const server = new McpServer({ name: "ai052", version: "1" }); registerAiActionPreviewTools(server, ctx);
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
  async function propose(approve = true, deletion = false, ttl?: number, currencyCode = "USD") {
    const items: { itemId: string; action: "post_entry" | "delete_draft_journal"; arguments: { entryId: string }; dependsOn: string[] }[] = [];
    for (let n = 0; n < 3; n++) {
      const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: ++seq, date: "2026-10-31", description: "Execution journal" }).returning();
      const amount = currencyCode === "IRR" ? 2147483648 : 1250;
      await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: debit.id, debitAmount: amount, currencyCode }, { journalEntryId: entry.id, accountId: credit.id, creditAmount: amount, currencyCode }]);
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
  const entryRow = async (id: string) => (await db.select().from(journalEntry).where(eq(journalEntry.id, id)))[0];
  const lines = (id: string) => db.select().from(journalLine).where(eq(journalLine.journalEntryId, id)).orderBy(journalLine.id);
  async function waitFor(query: string) {
    for (let i = 0; i < 400; i++) {
      if ((await pool.query("select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like $1", [query])).rowCount) return;
      await delay(10);
    }
    throw new Error(`No expected SQL wait: ${query}`);
  }
  async function stop(p: Awaited<ReturnType<typeof propose>>) { await runs.cancelRun(ctx, { runId: p.id }); }
  try {
    for (const deletion of [false, true]) for (const currency of ["USD", "IRR"]) {
      const p = await propose(true, deletion, undefined, currency), input = await claim(p), original = await lines(p.items[0].arguments.entryId);
      const results = await Promise.all([batches.executeApprovedJournal(input), batches.executeApprovedJournal(input)]);
      assert.equal(results.filter(r => r.code === "ACTION_EXECUTED").length, 1);
      assert.equal(results.filter(r => r.code === "ACTION_ALREADY_CONSUMED").length, 1);
      const receipt = results.find(r => r.code === "ACTION_EXECUTED")!.receipt;
      assert.equal(receipt.state, "succeeded"); assert.deepEqual(receipt.recordIds, [p.items[0].arguments.entryId]);
      assert.equal((await consumedRows(p.id)).length, 1);
      if (deletion) { assert.equal(await entryRow(p.items[0].arguments.entryId), undefined); assert.deepEqual(await lines(p.items[0].arguments.entryId), []); }
      else { assert.equal((await entryRow(p.items[0].arguments.entryId)).status, "posted"); assert.deepEqual(await lines(p.items[0].arguments.entryId), original); }
      assert.equal((await entryRow(p.items[1].arguments.entryId)).status, "draft");
      assert.equal((await entryRow(p.items[2].arguments.entryId)).status, "draft"); // unselected
      const second = await batches.executeApprovedJournal({ ...input, itemId: p.items[1].itemId });
      assert.equal(second.code, "ACTION_EXECUTED"); assert.equal(second.receipt.state, "succeeded");
      const retry = await batches.executeApprovedJournal(input); assert.equal(retry.code, "ACTION_ALREADY_CONSUMED"); assert.deepEqual(retry.receipt, receipt);
      await stop(p); assert.equal((await stepRows(p.id)).find(s => s.id === receipt.stepId)?.state, "succeeded");
      assert.equal((await pool.query("select count(*)::int n from audit_log where changes->>'consumptionId'=$1", [results.find(r => r.code === "ACTION_EXECUTED")!.consumptionId])).rows[0].n, 1);
    }
    // Lose only the acknowledgement AFTER a real domain/receipt COMMIT. The
    // adapter reconciles the immutable receipt and does not execute a second time.
    const ack = await propose(), ackInput = await claim(ack);
    const originalTransaction = db.transaction.bind(db);
    const lostAck = mock.method(db, "transaction", async (...args: Parameters<typeof db.transaction>) => {
      const result = await originalTransaction(...args);
      if (result && typeof result === "object" && "state" in result && result.state === "succeeded" && "stepId" in result) throw new Error("Fixture lost commit acknowledgement");
      return result;
    });
    try {
      const reconciled = await batches.executeApprovedJournal(ackInput);
      assert.equal(reconciled.code, "ACTION_EXECUTED"); assert.equal(reconciled.receipt.state, "succeeded");
      assert.equal((await entryRow(ack.items[0].arguments.entryId)).status, "posted");
    } finally { lostAck.mock.restore(); }
    assert.equal((await batches.executeApprovedJournal(ackInput)).code, "ACTION_ALREADY_CONSUMED");
    assert.equal((await consumedRows(ack.id)).length, 1); await stop(ack);

    // Handoff loss, unknown IDs and argument injection cannot reacquire execution.
    const lost = await propose(), lostInput = await claim(lost);
    const handed = await batches.consumeApprovedAction(lostInput); assert.equal(handed.code, "ACTION_CONSUMED");
    assert.equal((await batches.executeApprovedJournal(lostInput)).code, "ACTION_ALREADY_CONSUMED");
    assert.equal((await entryRow(lost.items[0].arguments.entryId)).status, "draft");
    await assert.rejects(batches.executeApprovedJournal({ ...lostInput, arguments: { entryId: lost.items[2].arguments.entryId } }));
    await assert.rejects(batches.executeApprovedJournal({ ...lostInput, lease: randomUUID() }));
    await stop(lost);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, lost.id));
    await runs.maintainRuns();

    // Actual effect-boundary lock waits happen AFTER durable consumption. A
    // committed resource/authority/Stop change during that gap must prevent writes.
    for (const deletion of [false, true]) for (const mode of ["resource", "line", "permission", "session", "policy", "period", "fiscal", "account", "stop", "lease", "config", "runtime", "link"] as const) {
      if (mode === "link" && !deletion) continue;
      const p = await propose(true, deletion), input = await claim(p), target = p.items[0].arguments.entryId;
      const blocker = await pool.connect();
      await blocker.query("begin"); await blocker.query("lock table journal_entry, journal_line in row exclusive mode");
      const pending = batches.executeApprovedJournal(input); const observed = pending.then(value => ({ value }), error => ({ error }));
      let workflow: string | undefined, fy: string | undefined;
      try {
        await waitFor('lock table "journal_entry"%');
        assert.equal((await consumedRows(p.id)).length, 1);
        if (mode === "resource") await blocker.query("update journal_entry set reference='changed without timestamp' where id=$1", [target]);
        if (mode === "line") await blocker.query("update journal_line set description='Changed line' where journal_entry_id=$1", [target]);
        if (mode === "permission") await db.update(customRole).set({ permissions: permissions.filter(v => v !== (deletion ? "edit:entries" : "post:entries")) }).where(eq(customRole.id, role.id));
        if (mode === "session") await db.update(users).set({ sessionRevokedAt: new Date() }).where(eq(users.id, owner.id));
        if (mode === "account") await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, debit.id));
        if (mode === "policy") {
          const [w] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "Late rule", entityType: "journal_entry", conditions: [], isActive: true }).returning(); workflow = w.id;
          await db.insert(approvalWorkflowStep).values({ workflowId: w.id, stepOrder: 1, approverId: ownerMember.id });
        }
        if (mode === "period") await db.insert(periodLock).values({ organizationId: org.id, lockDate: "2026-10-31" });
        if (mode === "fiscal") { const [f] = await db.insert(fiscalYear).values({ organizationId: org.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning(); fy = f.id; }
        if (mode === "stop") await stop(p);
        if (mode === "lease") await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, p.id));
        if (mode === "config") await db.update(aiProvider).set({ version: provider.version + 1 }).where(eq(aiProvider.id, provider.id));
        if (mode === "runtime") process.env.AI_RUNTIME_ENABLED = "false";
        if (mode === "link") await blocker.query("insert into journal_entry (organization_id,entry_number,date,description,reverses_entry_id) values ($1,$2,'2026-10-31','Linked reversal',$3)", [org.id, ++seq, target]);
        await blocker.query("commit");
        const result = await observed; assert.ok("value" in result, JSON.stringify(result));
        assert.notEqual(result.value.code, "ACTION_EXECUTED", `${deletion}/${mode}`);
        assert.notEqual(result.value.receipt.state, "succeeded");
        assert.equal((await entryRow(target)).status, "draft"); assert.equal((await lines(target)).length, 2);
        assert.equal((await pool.query("select count(*)::int n from audit_log where changes->>'consumptionId'=$1", [(await consumedRows(p.id))[0].id])).rows[0].n, 0);
      } finally {
        await blocker.query("rollback"); blocker.release(); await observed;
        process.env.AI_RUNTIME_ENABLED = "true";
        await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
        await db.update(users).set({ sessionRevokedAt: null }).where(eq(users.id, owner.id));
        await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, debit.id));
        await db.update(aiProvider).set({ version: provider.version }).where(eq(aiProvider.id, provider.id));
        if (workflow) await db.delete(approvalWorkflow).where(eq(approvalWorkflow.id, workflow));
        if (fy) await db.delete(fiscalYear).where(eq(fiscalYear.id, fy));
        await db.delete(periodLock).where(eq(periodLock.organizationId, org.id));
        await stop(p);
      }
    }

    // Lease expiry behind the domain audit INSERT rolls back BOTH mutation and
    // success receipt. A later operation cannot claim the journal was posted.
    for (const deletion of [false, true]) {
      const p = await propose(true, deletion), input = await claim(p), target = p.items[0].arguments.entryId;
      const resource = await pool.connect(), audit = await pool.connect();
      await resource.query("begin"); await resource.query("lock table journal_entry in row exclusive mode");
      const pending = batches.executeApprovedJournal(input); const observed = pending.then(value => ({ value }), error => ({ error }));
      try {
        await waitFor('lock table "journal_entry"%');
        await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() + 1200) }).where(eq(aiRun.id, p.id));
        await audit.query("begin"); await audit.query("lock table audit_log in share mode");
        await resource.query("commit");
        await waitFor('insert into "audit_log"%');
        const revoke = pool.query("update custom_role set permissions='[]'::jsonb where id=$1", [role.id]);
        await waitFor('update custom_role%'); // Auth writes serialize behind the actual effect transaction.
        await delay(1300);
        await audit.query("commit");
        await revoke;
        const result = await observed; assert.ok("value" in result); assert.equal(result.value.receipt.state, "failed");
        assert.equal((await entryRow(target)).status, "draft"); assert.equal((await lines(target)).length, 2);
        await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
        await stop(p);
      } finally { await resource.query("rollback"); await audit.query("rollback"); resource.release(); audit.release(); await observed; }
    }

    // A database failure after the second mutation preserves the first committed
    // effect and rolls back the second effect/receipt/audit as one transaction.
    const partial = await propose(), partialInput = await claim(partial);
    const confirmed = await batches.executeApprovedJournal(partialInput); assert.equal(confirmed.receipt.state, "succeeded");
    await pool.query(`create function ai052_fail_receipt() returns trigger language plpgsql as $$ begin
      if exists(select 1 from ai_step where run_id=new.run_id and state='succeeded' and id <> '${confirmed.receipt.stepId}') then
        raise exception 'fixture receipt failure'; end if; return new; end $$`);
    await pool.query("create trigger ai052_receipt before insert on ai_event for each row execute function ai052_fail_receipt()");
    try {
      const failed = await batches.executeApprovedJournal({ ...partialInput, itemId: partial.items[1].itemId });
      assert.equal(failed.code, "ACTION_RECONCILIATION_REQUIRED"); assert.equal(failed.receipt.state, "uncertain");
      assert.equal((await entryRow(partial.items[0].arguments.entryId)).status, "posted");
      assert.equal((await entryRow(partial.items[1].arguments.entryId)).status, "draft");
      assert.deepEqual((await stepRows(partial.id)).find(s => s.id === confirmed.receipt.stepId)?.recordIds, confirmed.receipt.recordIds);
      assert.equal((await runRow(partial.id)).state, "reconciliation_required");
      await assert.rejects(batches.executeApprovedJournal({ ...partialInput, itemId: partial.items[1].itemId }));
    } finally { await pool.query("drop trigger ai052_receipt on ai_event"); await pool.query("drop function ai052_fail_receipt()"); }

    // Kill a fresh worker with an uncommitted mutation, then recover in another
    // process. PostgreSQL rolls back the journal; recovery keeps uncertainty and
    // never replays the consumed operation, including on an old lease.
    const crash = await propose(), crashInput = await claim(crash), target = crash.items[0].arguments.entryId;
    const resource = await pool.connect(), audit = await pool.connect();
    await resource.query("begin"); await resource.query("lock table journal_entry in row exclusive mode");
    const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-journal-execution-worker.ts"], {
      env: { ...process.env, AI052_EXECUTE: JSON.stringify(crashInput) }, stdio: "pipe",
    });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    try {
      await waitFor('lock table "journal_entry"%');
      await audit.query("begin"); await audit.query("lock table audit_log in share mode");
      await resource.query("commit"); await waitFor('insert into "audit_log"%');
      child.kill(); await closed; await audit.query("commit");
      assert.equal((await entryRow(target)).status, "draft");
      await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, crash.id));
      const recovered = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-journal-execution-worker.ts"], { env: { ...process.env, AI052_RECOVER: "true" }, encoding: "utf8", timeout: 30000 });
      assert.equal(recovered.status, 0, recovered.stderr);
      assert.equal((await runRow(crash.id)).state, "reconciliation_required");
      assert.ok((await stepRows(crash.id)).some(s => s.state === "uncertain"));
      await assert.rejects(batches.executeApprovedJournal(crashInput));
      assert.equal((await entryRow(target)).status, "draft");
    } finally { child.kill(); await closed; await resource.query("rollback"); await audit.query("rollback"); resource.release(); audit.release(); }
    assert.equal((await db.select().from(payment)).length, 0);
    console.log("AI journal effects/SQL/restart verified");
  } finally { await pool.end(); await client.close(); await server.close(); }
}
main().then(() => process.exit(0), err => { console.error(err); process.exit(1); });
