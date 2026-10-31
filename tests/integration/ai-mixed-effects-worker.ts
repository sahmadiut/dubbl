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
  if (process.env.AI050_CRASH_SEND) { console.log("AI050_PROVIDER_ACCEPTED"); await new Promise(() => {}); }
  if (outcome === "uncertain") throw new Error("synthetic private acknowledgement loss");
  return { data: { id: "private-provider-id" }, error: null };
} }; } } });
process.env.RESEND_API_KEY = "synthetic";

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.env.AI050_EXECUTE) { await batches.executeApprovedInvoiceEmail(JSON.parse(process.env.AI050_EXECUTE)); return; }
  if (process.env.AI050_RECOVER) { await runs.maintainRuns(); console.log("Mixed recovery completed without dispatch"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { createInvoice } = await import("../../lib/api/invoice-writes"), { sendInvoice } = await import("../../lib/api/invoice-lifecycle");
  const { createBill } = await import("../../lib/api/bill-writes"), { receiveBill } = await import("../../lib/api/bill-lifecycle");
  const { resendDocumentEmail } = await import("../../lib/documents/email-rendering");
  const [owner] = await db.insert(users).values({ name: "Operator", email: "ai050@test.invalid" }).returning();
  const [org] = await db.insert(organization).values({ name: "Mixed effects", slug: "ai050", contactEmail: "sender@test.invalid" }).returning();
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
  const server = new McpServer({ name: "ai050", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  async function mcp(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  let sequence = 10000;
  async function propose(currencyCode = "USD") {
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
    const response = await approveRoute.POST(req({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion,
      bindingDigest: view.batch.bindingDigest, selectedItemIds, requestKey: "approve" }), { params: Promise.resolve({ id: r.id }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).code, "DECISION_APPROVED");
    // Fixture-only resume; AI-051 owns application queue/worker orchestration.
    await db.update(aiRun).set({ state: "queued" }).where(eq(aiRun.id, r.id));
    const lease = await runs.claimNextRun(); assert.equal(lease?.id, r.id);
    const inputs = items.map(i => ({ runId: r.id, lease: lease!.leaseOwner!, batchId: view.batch.id as string, itemId: i.itemId }));
    return { id: r.id, items, inputs, drafts, paid, payable, emailed, amountMinor, view };
  }
  type Proposal = Awaited<ReturnType<typeof propose>>;
  const stepRows = (p: Proposal) => db.select().from(aiStep).where(eq(aiStep.runId, p.id));
  const consumptions = (p: Proposal) => db.select().from(aiActionConsumption).where(eq(aiActionConsumption.runId, p.id));
  const runRow = async (p: Proposal) => (await db.select().from(aiRun).where(eq(aiRun.id, p.id)))[0];
  const deliveryRows = async (p: Proposal) => (await pool.query("select d.*, e.status from ai_action_delivery d join ai_action_consumption c on c.id=d.consumption_id join document_email_log e on e.id=d.email_log_id where c.run_id=$1", [p.id])).rows;
  const execute = (p: Proposal, n: number) => n === 1 || n === 2 ? batches.executeApprovedSettlement(p.inputs[n]) : n === 3 ? batches.executeApprovedInvoiceEmail(p.inputs[n]) : batches.executeApprovedJournal(p.inputs[n]);
  const stop = (p: Proposal) => runs.cancelRun(ctx, { runId: p.id });
  async function prefix(p: Proposal, count: number) {
    for (let n = 0; n < count; n++) assert.equal((await execute(p, n)).code, "ACTION_EXECUTED", `Mixed effect ${n}`);
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
      assert.equal(c.dispatchLease, p.inputs[0].lease); assert.equal(c.batchId, p.inputs[0].batchId);
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
      await assert.rejects(execute(p, 1)); // Real cross-adapter prerequisite.
      await assert.rejects(execute(p, 5)); // Unselected.
      await assert.rejects(batches.executeApprovedInvoiceEmail(p.inputs[0])); // Wrong domain.
      await assert.rejects(batches.executeApprovedSettlement({ ...p.inputs[1], arguments: { amountMinor: "1" } }));
      assert.equal((await consumptions(p)).length, 0);
      // A lost acknowledgement after a real middle payment COMMIT cannot replay.
      await prefix(p, 1);
      const original = db.transaction.bind(db);
      const lostAck = mock.method(db, "transaction", async (...args: Parameters<typeof db.transaction>) => {
        const result = await original(...args);
        if (result && typeof result === "object" && "state" in result && result.state === "succeeded") throw new Error("Lost committed middle receipt acknowledgement");
        return result;
      });
      try { assert.equal((await execute(p, 1)).code, "ACTION_EXECUTED"); } finally { lostAck.mock.restore(); }
      for (let n = 2; n < 5; n++) assert.equal((await execute(p, n)).code, "ACTION_EXECUTED");
      await assertPartial(p, 5);
      assert.equal(sent.length, before + 1); assert.equal(sent.at(-1)!.to, party.email);
      assert.ok(sent.at(-1)!.html.includes(currency === "IRR" ? "2,147,483,648" : "12.50"));
      const originalRows = await consumptions(p), originalSteps = await stepRows(p);
      for (let n = 0; n < 5; n++) assert.equal((await execute(p, n)).code, "ACTION_ALREADY_CONSUMED");
      assert.deepEqual(await consumptions(p), originalRows); assert.deepEqual(await stepRows(p), originalSteps);
      assert.equal(originalRows.length, 5); assert.equal(new Set(originalRows.map(c => c.decisionId)).size, 1);
      assert.equal((await deliveryRows(p))[0].state, "confirmed"); assert.equal(sent.length, before + 1);
      const payments = (await pool.query("select p.*, a.amount::text allocated from payment p join payment_allocation a on a.payment_id=p.id where a.document_id=any($1::uuid[])", [[p.paid.id, p.payable.id]])).rows;
      assert.equal(payments.length, 2);
      for (const payment of payments) {
        assert.equal(String(payment.amount), p.amountMinor); assert.equal(payment.allocated, p.amountMinor); assert.equal(payment.currency_code, currency);
        const balance = (await pool.query("select sum(debit_amount)::text debit, sum(credit_amount)::text credit from journal_line where journal_entry_id=$1", [payment.journal_entry_id])).rows[0];
        assert.deepEqual(balance, { debit: p.amountMinor, credit: p.amountMinor });
      }
      for (const c of originalRows) assert.equal((await pool.query("select count(*)::int n from audit_log where changes->>'consumptionId'=$1", [c.id])).rows[0].n, 1);
      await stop(p); await assertPartial(p, 5);
    }

    // Stop between domains retains exactly the committed prefix and skips rest.
    const stopped = await propose(); await prefix(stopped, 2); await stop(stopped);
    await assertPartial(stopped, 2); await assert.rejects(execute(stopped, 2));
    assert.equal((await runRow(stopped)).state, "cancelled"); assert.equal((await consumptions(stopped)).length, 2);
    assert.equal((await deliveryRows(stopped)).length, 0);

    // Later SQL waits race live resources, permission, Stop and lease expiry.
    for (const race of ["resource", "permission", "stop", "lease"] as const) {
      const p = await propose(); await prefix(p, 1);
      const blocker = await pool.connect(); await blocker.query("begin"); await blocker.query("lock table journal_entry, journal_line in row exclusive mode");
      const pending = execute(p, 1);
      try {
        await waitFor('lock table "journal_entry"%'); assert.equal((await consumptions(p)).length, 2);
        if (race === "resource") await blocker.query("update invoice set reference='changed without timestamp' where id=$1", [p.paid.id]);
        if (race === "permission") await db.update(customRole).set({ permissions: permissions.filter(v => v !== "manage:payments") }).where(eq(customRole.id, role.id));
        if (race === "stop") await stop(p);
        if (race === "lease") await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, p.id));
        await blocker.query("commit"); assert.notEqual((await pending).code, "ACTION_EXECUTED");
        await assertPartial(p, 1); assert.equal((await deliveryRows(p)).length, 0);
      } finally {
        await blocker.query("rollback"); blocker.release(); await pending;
        await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
        await stop(p);
      }
    }

    // Delivery failure/uncertainty preserves earlier GL effects, skips deletion.
    for (const failure of ["rejected", "uncertain"] as const) {
      const p = await propose(); await prefix(p, 3); outcome = failure;
      const result = await execute(p, 3); outcome = "success";
      assert.equal(result.code, failure === "rejected" ? "ACTION_FAILED" : "ACTION_RECONCILIATION_REQUIRED");
      assert.equal((await deliveryRows(p))[0].state, failure === "rejected" ? "failed" : "uncertain");
      await assertPartial(p, 3); await assert.rejects(execute(p, 4));
      const before = sent.length, rows = await consumptions(p);
      await assert.rejects(execute(p, 3)); assert.equal(sent.length, before); assert.deepEqual(await consumptions(p), rows);
      await assert.rejects(resendDocumentEmail(ctx, (await deliveryRows(p))[0].email_log_id));
      assert.ok(!/private|saved@|acknowledgement/.test(JSON.stringify(await deliveryRows(p))));
      assert.equal((await runRow(p)).state, failure === "rejected" ? "failed" : "reconciliation_required");
    }

    // A subsequent domain rollback cannot undo an acknowledged external effect.
    const later = await propose(); await prefix(later, 4);
    await pool.query(`create function ai050_fail_delete() returns trigger language plpgsql as $$ begin raise exception 'synthetic domain fault'; end $$;
      create trigger ai050_fail_delete before delete on journal_entry for each row execute function ai050_fail_delete()`);
    try { assert.equal((await execute(later, 4)).code, "ACTION_RECONCILIATION_REQUIRED"); }
    finally { await pool.query("drop trigger ai050_fail_delete on journal_entry; drop function ai050_fail_delete()"); }
    await assertPartial(later, 4); assert.equal((await deliveryRows(later))[0].state, "confirmed");

    // Crash after earlier financial commits and simulated provider acceptance.
    const crash = await propose(); await prefix(crash, 3);
    const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-mixed-effects-worker.ts"], {
      env: { ...process.env, AI050_EXECUTE: JSON.stringify(crash.inputs[3]), AI050_CRASH_SEND: "true" }, stdio: "pipe",
    });
    let output = ""; child.stdout.on("data", chunk => { output += String(chunk); });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    try {
      for (let n = 0; n < 500 && !output.includes("AI050_PROVIDER_ACCEPTED"); n++) await delay(10);
      assert.match(output, /AI050_PROVIDER_ACCEPTED/);
    } finally { child.kill(); await closed; }
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, crash.id));
    const recovery = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-mixed-effects-worker.ts"], {
      env: { ...process.env, AI050_RECOVER: "true" }, encoding: "utf8", timeout: 30000,
    });
    assert.equal(recovery.status, 0, recovery.stderr); assert.match(recovery.stdout, /Mixed recovery completed/);
    await assertPartial(crash, 3); assert.equal((await runRow(crash)).state, "reconciliation_required");
    assert.equal((await deliveryRows(crash))[0].state, "uncertain"); assert.equal((await consumptions(crash)).length, 4);
    const receipts = await stepRows(crash), before = sent.length;
    await assert.rejects(execute(crash, 3)); await assert.rejects(execute(crash, 4));
    await assert.rejects(resendDocumentEmail(ctx, (await deliveryRows(crash))[0].email_log_id));
    await runs.maintainRuns(); assert.deepEqual(await stepRows(crash), receipts); assert.equal(sent.length, before);
    console.log("Mixed approved effects/SQL/restart verified");
  } finally { await client.close(); await server.close(); }
}
try { await main(); } finally { await pool.end(); await db.$client.end(); }
