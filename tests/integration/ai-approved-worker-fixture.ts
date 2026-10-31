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
import { users, organization, member, customRole, chartAccount, contact, journalEntry, journalLine,
  aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiStep, aiActionConsumption } from "../../lib/db/schema";
import type { ActionItem } from "../../lib/ai/action-adapters";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const sent: { to: string; subject: string; html: string }[] = [];
let outcome: "success" | "uncertain" | "rejected" = "success";
mock.module("resend", { namedExports: { Resend: class { emails = { send: async (message: typeof sent[number]) => {
  // Observe the pre-dispatch attempt through a separate committed SQL connection.
  const attempt = await pool.query("select d.id from ai_action_delivery d join document_email_log e on e.id=d.email_log_id where d.state='uncertain' and e.recipient_email=$1", [message.to]);
  assert.ok(attempt.rowCount);
  if (outcome === "rejected") return { error: { message: "synthetic private rejection" } };
  sent.push(message);
  if (process.env.AI051_CRASH_SEND) { console.log("AI051_PROVIDER_ACCEPTED"); await new Promise(() => {}); }
  if (outcome === "uncertain") throw new Error("synthetic private acknowledgement loss");
  return { data: { id: "private-provider-id" }, error: null };
} }; } } });
process.env.RESEND_API_KEY = "synthetic";

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.env.AI051_EXECUTE) {
    const { runWorker } = await import("../../lib/ai/worker");
    await runWorker({ signal: new AbortController().signal, transport: async () => { throw new Error("Unexpected model call"); }, pollMs: 20 }); return;
  }
  if (process.env.AI051_RECOVER) { await runs.maintainRuns(); console.log("Mixed recovery completed without dispatch"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const resumeRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/resume/route");
  const { runWorker } = await import("../../lib/ai/worker");
  const { executeRun } = await import("../../lib/ai/executor");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { createInvoice } = await import("../../lib/api/invoice-writes"), { sendInvoice } = await import("../../lib/api/invoice-lifecycle");
  const { createBill } = await import("../../lib/api/bill-writes"), { receiveBill } = await import("../../lib/api/bill-lifecycle");
  const { resendDocumentEmail } = await import("../../lib/documents/email-rendering");
  const [owner] = await db.insert(users).values({ name: "Operator", email: "ai051@test.invalid" }).returning();
  const [org] = await db.insert(organization).values({ name: "Mixed effects", slug: "ai051", contactEmail: "sender@test.invalid" }).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries", "edit:entries", "manage:payments", "manage:invoices"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Operator", permissions }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id });
  const [cash, revenue, , , expense] = await db.insert(chartAccount).values([
    { code: "1100", name: "Cash", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const },
    { code: "1200", name: "AR", type: "asset" as const }, { code: "2100", name: "AP", type: "liability" as const }, { code: "5000", name: "Expense", type: "expense" as const },
  ].map(a => ({ ...a, organizationId: org.id }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Saved party", type: "both", email: "saved@test.invalid" }).returning();
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-31" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: unknown) => new Request("http://test.invalid/ai", { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req()), fixtureCtx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  const server = new McpServer({ name: "ai051", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const { registerAiRunTools } = await import("../../lib/mcp/tools/ai-runs"); registerAiRunTools(server, ctx);
  const progressRoute = await import("../../app/api/v1/ai/runs/[id]/progress/route");
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  async function mcp(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  let sequence = 10000;
  async function propose(currencyCode = "USD", approved = true) {
    const amountMinor = currencyCode === "IRR" ? "2147483648" : "1250";
    await db.update(organization).set({ defaultCurrency: currencyCode }).where(eq(organization.id, org.id));
    await pool.query("update chart_account set currency_code=$1", [currencyCode]);
    const drafts = [];
    for (let i = 0; i < 3; i++) {
      const entryNumber = (await pool.query("select coalesce(max(entry_number),0)+1 next from journal_entry where organization_id=$1", [org.id])).rows[0].next;
      const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber, date: "2026-10-31", description: "Original mixed journal" }).returning();
      await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: cash.id, debitAmount: Number(amountMinor), currencyCode }, { journalEntryId: entry.id, accountId: revenue.id, creditAmount: Number(amountMinor), currencyCode }]);
      drafts.push(entry);
    }
    const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, lines: [{ description: "Saved mixed item", unitPriceMinor: amountMinor, accountId: revenue.id }] };
    const paid = (await createInvoice(fixtureCtx, input, "rest")).invoice;
    const emailed = (await createInvoice(fixtureCtx, input, "rest")).invoice;
    await sendInvoice(fixtureCtx, paid.id); await sendInvoice(fixtureCtx, emailed.id);
    const payable = (await createBill(fixtureCtx, { ...input, lines: [{ ...input.lines[0], accountId: expense.id }] }, "rest")).bill;
    await receiveBill(fixtureCtx, payable.id);
    const postId = randomUUID(), payId = randomUUID(), billId = randomUUID(), emailId = randomUUID();
    const items: ActionItem[] = [
      { itemId: postId, action: "post_entry", arguments: { entryId: drafts[0].id }, dependsOn: [] },
      { itemId: payId, action: "settle_document", arguments: { documentType: "invoice", documentId: paid.id, amountMinor, date: "2026-10-31", method: "cash", reference: "Original exact selection" }, dependsOn: [postId] },
      { itemId: billId, action: "settle_document", arguments: { documentType: "bill", documentId: payable.id, amountMinor, date: "2026-10-31", method: "cash", reference: "Original payable selection" }, dependsOn: [payId] },
      { itemId: emailId, action: "email_invoice", arguments: { documentId: emailed.id }, dependsOn: [billId] },
      { itemId: randomUUID(), action: "delete_draft_journal", arguments: { entryId: drafts[1].id }, dependsOn: [emailId] },
      { itemId: randomUUID(), action: "post_entry", arguments: { entryId: drafts[2].id }, dependsOn: [] },
    ];
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `mixed-${++sequence}`, message: "Prepare mixed effects" });
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, r.id);
    // One saved resource cannot receive speculative payment AND email in a batch.
    await assert.rejects(batches.requestActionBatch(r.id, claimed!.leaseOwner!, claimed!.version, { requestKey: "duplicate", selectedItemIds: [], items: [{ ...items[1], dependsOn: [] }, { ...items[3], dependsOn: [], arguments: { documentId: paid.id } }] }), { code: "BATCH_INVALID" });
    await batches.requestActionBatch(r.id, claimed!.leaseOwner!, claimed!.version, { requestKey: "initial", items, selectedItemIds: [] });
    let view = await mcp("get_ai_action_batch", { runId: r.id }); assert.ok(view.batch);
    const selectedItemIds = items.slice(0, 5).map(i => i.itemId);
    await mcp("revise_ai_action_batch", { runId: r.id, batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: "selection", items, selectedItemIds });
    view = await mcp("get_ai_action_batch", { runId: r.id });
    // Deletion/email are excluded from GL totals. Posting plus two cash effects.
    assert.deepEqual(view.batch.display.totals, [{ currencyCode, debitAmountMinor: String(BigInt(amountMinor) * 3n), creditAmountMinor: String(BigInt(amountMinor) * 3n) }]);
    if (approved) { const response = await approveRoute.POST(req({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion,
      bindingDigest: view.batch.bindingDigest, selectedItemIds, requestKey: "approve" }), { params: Promise.resolve({ id: r.id }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).code, "DECISION_APPROVED");
    }
    const resumeInput = { runId: r.id, batchId: view.batch.id as string, expectedVersion: view.batch.version as number,
      expectedRunVersion: (await runs.getRun(ctx, { runId: r.id })).version, bindingDigest: view.batch.bindingDigest as string, selectedItemIds, requestKey: "resume" };
    return { id: r.id, items, drafts, paid, payable, emailed, amountMinor, view, resumeInput };

  }
  type Proposal = Awaited<ReturnType<typeof propose>>;
  const stepRows = (p: Proposal) => db.select().from(aiStep).where(eq(aiStep.runId, p.id));
  const consumptions = (p: Proposal) => db.select().from(aiActionConsumption).where(eq(aiActionConsumption.runId, p.id));
  const runRow = async (p: Proposal) => (await db.select().from(aiRun).where(eq(aiRun.id, p.id)))[0];
  const deliveryRows = async (p: Proposal) => (await pool.query("select d.*, e.status from ai_action_delivery d join ai_action_consumption c on c.id=d.consumption_id join document_email_log e on e.id=d.email_log_id where c.run_id=$1", [p.id])).rows;
  const stop = (p: Proposal) => runs.cancelRun(ctx, { runId: p.id });
  async function work() {
    const signal = new AbortController();
    const timeout = setTimeout(() => signal.abort(), 15000);
    try { await runWorker({ signal: signal.signal, pollMs: 20, heartbeatMs: 20, maintenanceMs: 30,
      transport: async () => { throw new Error("Unexpected provider/model call"); },
      onEvent: event => { if (event === "settled" || event === "execution_failed") signal.abort(); } }); }
    finally { clearTimeout(timeout); }
  }
  async function resume(p: Proposal, transport: "rest" | "mcp" = "rest") {
    if (transport === "mcp") return mcp("resume_ai_action_batch", p.resumeInput);
    const { runId, ...body } = p.resumeInput;
    const response = await resumeRoute.POST(req(body), { params: Promise.resolve({ id: runId }) });
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json();
  }
  async function assertPartial(p: Proposal, completed: number) {
    const posted = (await pool.query("select status from journal_entry where id=$1", [p.drafts[0].id])).rows[0];
    assert.equal(posted.status, completed > 0 ? "posted" : "draft");
    for (const [index, table, id] of [[1, "invoice", p.paid.id], [2, "bill", p.payable.id]] as const) {
      const doc = (await pool.query(`select status, amount_paid::text, amount_due::text from ${table} where id=$1`, [id])).rows[0];
      assert.equal(doc.amount_paid, completed > index ? p.amountMinor : "0");
      assert.equal(doc.amount_due, completed > index ? "0" : p.amountMinor);
      assert.equal(doc.status, completed > index ? "paid" : table === "bill" ? "received" : "sent");
    }
    assert.equal((await pool.query("select count(*)::int n from journal_entry where id=$1", [p.drafts[1].id])).rows[0].n, completed === 5 ? 0 : 1);
    assert.equal((await pool.query("select status from journal_entry where id=$1", [p.drafts[2].id])).rows[0].status, "draft");
    const all = await stepRows(p), current = p.view.batch.display.items as { itemId: string; stepId: string }[];
    for (let n = 0; n < completed; n++) assert.equal(all.find(s => s.id === current.find(i => i.itemId === p.items[n].itemId)!.stepId)!.state, "succeeded");
    for (const c of await consumptions(p)) {
      assert.equal(c.batchId, p.resumeInput.batchId);
      assert.equal(all.find(s => s.id === c.stepId)!.operationKey, c.stepId);
    }
  }
  async function waitFor(query: string) {
    for (let i = 0; i < 400; i++) {
      if ((await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1", [query])).rowCount) return;
      await delay(10);
    }
    throw new Error(`Missing SQL wait: ${query}`);
  }
  try {
    for (const currency of ["USD", "IRR"]) {
      const p = await propose(currency), before = sent.length;
      assert.equal((await runRow(p)).state, "awaiting_approval");
      assert.equal(await runs.claimNextRun(), null); // Decision alone never queues.
      const receipt = await resume(p, currency === "USD" ? "rest" : "mcp");
      assert.equal(receipt.code, "BATCH_RESUMED"); assert.equal((await runRow(p)).state, "queued");
      assert.deepEqual(await resume(p, "mcp"), receipt); // Lost queue acknowledgement.
      const providerCalls = (await pool.query("select count(*)::int n from ai_provider_attempt")).rows[0].n;
      await work(); await assertPartial(p, 5);
      assert.equal((await runRow(p)).state, "succeeded"); assert.equal(sent.length, before + 1);
      assert.equal((await pool.query("select count(*)::int n from ai_provider_attempt")).rows[0].n, providerCalls);
      const receipts = await consumptions(p), steps = await stepRows(p);
      const progress = await mcp("get_ai_run_progress", { runId: p.id, limit: 20 });
      assert.equal(progress.run.state, "succeeded");
      assert.equal(progress.steps.filter((s: {code: string}) => s.code === "ACTION_COMPLETED").length, 5);
      assert.ok(progress.steps.some((s: {records: {type: string}[]}) => s.records.some(r => r.type === "invoice")));
      const response = await progressRoute.GET(req(), { params: Promise.resolve({ id: p.id }) });
      assert.equal(response.status, 200); assert.equal((await response.json()).run.state, "succeeded");
      assert.equal(receipts.length, 5); assert.equal(new Set(receipts.map(c => c.dispatchLease)).size, 1);
      assert.equal(steps.find(s => s.id === p.view.batch.display.items.find((i: {itemId: string}) => i.itemId === p.items[5].itemId).stepId)!.state, "skipped");
      assert.deepEqual(await resume(p), receipt); assert.equal(await runs.claimNextRun(), null);
      assert.deepEqual(await consumptions(p), receipts); assert.deepEqual(await stepRows(p), steps);
      assert.equal((await deliveryRows(p))[0].state, "confirmed");
      const stored = (await pool.query("select * from ai_action_resume where run_id=$1", [p.id])).rows;
      assert.equal(stored.length, 1); assert.ok(!/saved@|Original|amountMinor|arguments/.test(JSON.stringify(stored)));
      assert.equal((await batches.resumeActionBatch(ctx, { ...p.resumeInput, bindingDigest: "a".repeat(64) })).code, "BATCH_CONFLICT");
    }
    // No approval, changed selection, model/argument injection, stale resources.
    const unapproved = await propose("USD", false);
    assert.equal((await resume(unapproved)).code, "BATCH_UNAVAILABLE");
    assert.equal(await runs.claimNextRun(), null); await stop(unapproved);
    const altered = await propose();
    assert.equal((await batches.resumeActionBatch(ctx, { ...altered.resumeInput, selectedItemIds: altered.resumeInput.selectedItemIds.slice(1) })).code, "BATCH_STALE");
    await assert.rejects(batches.resumeActionBatch(ctx, { ...altered.resumeInput, arguments: {}, confirmed: true }));
    assert.ok((await client.callTool({ name: "resume_ai_action_batch", arguments: { ...altered.resumeInput, confirmed: true } })).isError);
    const { runId, ...restBody } = altered.resumeInput;
    assert.equal((await resumeRoute.POST(req({ ...restBody, runId }), { params: Promise.resolve({ id: runId }) })).status, 400);
    await pool.query("update invoice set reference='changed' where id=$1", [altered.paid.id]);
    assert.equal((await resume(altered)).code, "BATCH_STALE"); await stop(altered);
    const denied = await propose();
    await db.update(customRole).set({ permissions: permissions.filter(p => p !== "manage:payments") }).where(eq(customRole.id, role.id));
    assert.equal((await batches.resumeActionBatch(ctx, denied.resumeInput)).code, "BATCH_DENIED");
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); await stop(denied);
    const expired = await propose();
    await pool.query("update ai_run set deadline_at=now()-interval '1 second', started_at=now()-interval '2 minutes' where id=$1", [expired.id]);
    assert.equal((await resume(expired)).code, "BATCH_EXPIRED"); await stop(expired);
    const disabled = await propose(); process.env.AI_RUNTIME_ENABLED = "false";
    assert.equal((await resume(disabled)).code, "BATCH_DISABLED"); process.env.AI_RUNTIME_ENABLED = "true"; await stop(disabled);
    const revision = await propose();
    await mcp("revise_ai_action_batch", { runId: revision.id, batchId: revision.resumeInput.batchId, expectedVersion: revision.resumeInput.expectedVersion,
      expectedRunVersion: revision.resumeInput.expectedRunVersion, items: revision.items, selectedItemIds: revision.resumeInput.selectedItemIds, requestKey: "edited" });
    assert.equal((await resume(revision)).code, "BATCH_CONFLICT"); assert.equal(await runs.claimNextRun(), null); await stop(revision);
    const lost = await propose();
    const transaction = db.transaction.bind(db);
    const lostAck = mock.method(db, "transaction", async (...args: Parameters<typeof db.transaction>) => {
      const result = await transaction(...args);
      if (result && typeof result === "object" && "code" in result && result.code === "BATCH_RESUMED") throw new Error("Lost resume COMMIT acknowledgement");
      return result;
    });
    try { await assert.rejects(batches.resumeActionBatch(ctx, lost.resumeInput), /Lost resume/); } finally { lostAck.mock.restore(); }
    assert.equal((await resume(lost)).code, "BATCH_RESUMED");
    assert.equal((await pool.query("select count(*)::int n from ai_event where run_id=$1 and kind='approval_resumed'", [lost.id])).rows[0].n, 1);
    await stop(lost);
    // Competing callers serialize into one stable receipt and one queue event.
    const concurrent = await propose();
    const competed = await Promise.all([resume(concurrent), resume(concurrent, "mcp")]);
    assert.deepEqual(competed[0], competed[1]);
    assert.equal((await pool.query("select count(*)::int n from ai_event where run_id=$1 and kind='approval_resumed'", [concurrent.id])).rows[0].n, 1);
    await stop(concurrent); assert.deepEqual(await resume(concurrent), competed[0]); assert.equal(await runs.claimNextRun(), null);
    // Permission changes during a real resume audit wait roll back both queue and receipt.
    const race = await propose();
    const blocker = await pool.connect(); await blocker.query("begin"); await blocker.query("lock table audit_log in access exclusive mode");
    const pending = resume(race);
    try {
      await waitFor('insert into "audit_log"%');
      await db.update(customRole).set({ permissions: permissions.filter(p => p !== "manage:payments") }).where(eq(customRole.id, role.id));
      await blocker.query("commit"); assert.equal((await pending).code, "BATCH_DENIED");
      assert.equal((await runRow(race)).state, "awaiting_approval");
      assert.equal((await pool.query("select count(*)::int n from ai_action_resume where run_id=$1", [race.id])).rows[0].n, 0);
    } finally { await blocker.query("rollback"); blocker.release(); await pending;
      await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); await stop(race); }
    // Stop wins while the worker waits at the next domain boundary.
    const stopped = await propose(); await resume(stopped);
    const lock = await pool.connect(); await lock.query("begin"); await lock.query("lock table invoice in row exclusive mode");
    const working = work();
    try {
      await waitFor('lock table %"invoice"%');
      await mcp("cancel_ai_run", { runId: stopped.id }); await lock.query("commit"); await working;
      await assertPartial(stopped, 1); assert.equal((await runRow(stopped)).state, "cancelled");
      assert.equal((await deliveryRows(stopped)).length, 0);
    } finally { await lock.query("rollback"); lock.release(); await working; }
    // Domain changes after queuing retain only the confirmed prefix.
    const stale = await propose(); await resume(stale);
    await pool.query("update invoice set reference='edited after resume' where id=$1", [stale.paid.id]);
    await work(); await assertPartial(stale, 1); assert.equal((await runRow(stale)).state, "failed");
    for (const failure of ["rejected", "uncertain"] as const) {
      const p = await propose(); await resume(p); const before = sent.length; outcome = failure;
      await work(); outcome = "success"; await assertPartial(p, 3);
      assert.equal((await runRow(p)).state, failure === "rejected" ? "failed" : "reconciliation_required");
      assert.equal((await consumptions(p)).length, 4); assert.equal((await deliveryRows(p))[0].state, failure === "rejected" ? "failed" : "uncertain");
      const receipts = await stepRows(p); await resume(p); assert.equal(await runs.claimNextRun(), null);
      await runs.maintainRuns(); assert.deepEqual(await stepRows(p), receipts); assert.equal(sent.length, before + (failure === "uncertain" ? 1 : 0));
      await assert.rejects(resendDocumentEmail(ctx, (await deliveryRows(p))[0].email_log_id));
    }
    // New worker lease after a crash between committed effects continues only
    // unconsumed work; succeeded prerequisites require original durable receipts.
    const prefix = await propose(); await resume(prefix);
    const original = await runs.claimNextRun(); assert.equal(original!.id, prefix.id);
    for (let n = 0; n < 2; n++) {
      const input = { runId: prefix.id, lease: original!.leaseOwner!, batchId: prefix.resumeInput.batchId, itemId: prefix.items[n].itemId };
      assert.equal((await (n ? batches.executeApprovedSettlement(input) : batches.executeApprovedJournal(input))).receipt.state, "succeeded");
    }
    const consumedPrefix = await consumptions(prefix);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, prefix.id)); await runs.maintainRuns();
    await work(); await assertPartial(prefix, 5); assert.equal((await runRow(prefix)).state, "succeeded");
    assert.deepEqual((await consumptions(prefix)).filter(c => consumedPrefix.some(p => p.id === c.id)), consumedPrefix);
    assert.equal(new Set((await consumptions(prefix)).map(c => c.dispatchLease)).size, 2);
    // Kill an actual polling worker after simulated email acceptance. Recovery
    // in a new process cannot resend or execute the remaining deletion.
    const crash = await propose(); await resume(crash);
    const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-approved-worker-fixture.ts"], {
      env: { ...process.env, AI051_EXECUTE: "true", AI051_CRASH_SEND: "true" }, stdio: "pipe", windowsHide: true,
    });
    let output = "", errors = ""; child.stdout.on("data", c => { output += String(c); }); child.stderr.on("data", c => { errors += String(c); });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    try { for (let n = 0; n < 800 && !output.includes("AI051_PROVIDER_ACCEPTED"); n++) await delay(10); assert.match(output, /AI051_PROVIDER_ACCEPTED/, errors); }
    finally { child.kill(); await closed; }
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, crash.id));
    const recovery = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-approved-worker-fixture.ts"], {
      env: { ...process.env, AI051_RECOVER: "true" }, encoding: "utf8", timeout: 30000, windowsHide: true,
    });
    assert.equal(recovery.status, 0, recovery.stderr); await assertPartial(crash, 3);
    assert.equal((await runRow(crash)).state, "reconciliation_required"); assert.equal((await deliveryRows(crash))[0].state, "uncertain");
    const receipts = await stepRows(crash); await resume(crash); assert.equal(await runs.claimNextRun(), null);
    await runs.maintainRuns(); assert.deepEqual(await stepRows(crash), receipts);
    await assert.rejects(resendDocumentEmail(ctx, (await deliveryRows(crash))[0].email_log_id));
    // A queued proposal without a resume receipt never falls through to model work.
    const bypass = await propose(); await db.update(aiRun).set({ state: "queued" }).where(eq(aiRun.id, bypass.id));
    const claimed = await runs.claimNextRun(); assert.equal(claimed!.id, bypass.id);
    assert.equal((await executeRun(bypass.id, claimed!.leaseOwner!, async () => { throw new Error("Model called"); })).state, "failed");
    await assertPartial(bypass, 0);
    console.log("Approved resume REST/MCP/worker/SQL/restart verified");
  } finally { await client.close(); await server.close(); }
}
try { await main(); } finally { await pool.end(); await db.$client.end(); }
