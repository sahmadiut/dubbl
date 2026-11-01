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
    if (process.env.AI008_ACCEPTANCE === "true") {
      const getRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/route");
      const reviseRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/revise/route");
      const rejectRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/reject/route");
      const params = (id: string) => ({ params: Promise.resolve({ id }) });
      async function data(response: Response) {
        assert.equal(response.status, 200, await response.clone().text());
        assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json();
      }
      const read = (p: Proposal) => getRoute.GET(req(), params(p.id)).then(data);
      const body = (view: Proposal["view"], requestKey: string) => ({ batchId: view.batch.id, expectedVersion: view.batch.version,
        expectedRunVersion: view.runVersion, bindingDigest: view.batch.bindingDigest,
        selectedItemIds: view.batch.display.items.filter((i: { selected: boolean }) => i.selected).map((i: { itemId: string }) => i.itemId), requestKey });
      const decide = (p: Proposal, input: object, reject = false) => (reject ? rejectRoute : approveRoute).POST(req(input), params(p.id)).then(data);
      const revise = (p: Proposal, input: object) => reviseRoute.POST(req(input), params(p.id)).then(data);
      const metadata = async (p: Proposal) => (await pool.query(`select
        (select count(*) from ai_action_decision where run_id=$1)::int decisions,
        (select count(*) from ai_action_resume where run_id=$1)::int resumes,
        (select count(*) from ai_action_consumption where run_id=$1)::int consumptions,
        (select count(*) from ai_provider_attempt where run_id=$1)::int providers`, [p.id])).rows[0];

      const p = await propose("IRR", false), view = await read(p);
      assert.deepEqual(view, await mcp("get_ai_action_batch", { runId: p.id }));
      assert.equal(view.batch.display.items.length, 6);
      assert.equal(view.batch.display.items.filter((i: {selected: boolean}) => i.selected).length, 5);
      assert.equal(view.batch.authority, "preview_only");
      assert.ok(!/"(arguments|leaseOwner|credential)"/.test(JSON.stringify(view)));
      const original = (await pool.query("select authority,expires_at from ai_action_batch where run_id=$1 order by version limit 1", [p.id])).rows[0];
      assert.deepEqual(original.authority.selectedItemIds, []); // Trusted creation never preselects.
      assert.equal(new Date(view.batch.expiresAt).getTime(), original.expires_at.getTime());
      const before = await metadata(p);
      const previewOperations = [
        ["journal-post", "preview_ai_journal_post", p.items[0]],
        ["settlement", "preview_ai_settlement", p.items[1]],
        ["settlement", "preview_ai_settlement", p.items[2]],
        ["invoice-email", "preview_ai_invoice_email", p.items[3]],
        ["journal-delete", "preview_ai_journal_delete", p.items[4]],
      ] as const;
      for (const [route, tool, item] of previewOperations) {
        const handler = await import(`../../app/api/v1/ai/previews/${route}/route`);
        const rest = await data(await handler.POST(req(item.arguments))), linked = await mcp(tool, item.arguments);
        assert.equal(rest.code, "PREVIEW_ONLY"); assert.equal(linked.code, rest.code);
        // Observation timestamps differ; the actual business fields and resource binding must agree.
        const { observedAt, expiresAt, ...business } = rest.preview;
        const { observedAt: linkedAt, expiresAt: linkedExpiry, ...linkedBusiness } = linked.preview;
        assert.deepEqual(business, linkedBusiness);
        assert.ok(Date.parse(observedAt) < Date.parse(expiresAt)); assert.ok(Date.parse(linkedAt) < Date.parse(linkedExpiry));
        assert.equal(business.action, item.action); assert.ok(business.labelKey);
        assert.ok(business.target.reference); assert.ok(business.target.href);
        assert.ok(business.before); assert.ok(business.after); assert.ok(business.effects.length);
        assert.equal(business.businessApproval.required, false); assert.equal(business.authority, "preview_only");
        assert.equal(business.resourceVersion, view.batch.display.items.find((i: {itemId: string}) => i.itemId === item.itemId).preview.resourceVersion);
        if (item.action === "settle_document") assert.deepEqual(business.payment, { amountMinor: p.amountMinor, currencyCode: "IRR", direction: item === p.items[1] ? "received" : "made" });
        if (item.action === "email_invoice") assert.deepEqual(business.recipients, [{ email: party.email, name: party.name }]);
      }
      assert.deepEqual(await metadata(p), before); await assertPartial(p, 0); assert.equal(sent.length, 0);
      assert.equal((await resume(p)).code, "BATCH_UNAVAILABLE");
      const firstInput = body(view, "outer-first");
      assert.equal((await approveRoute.POST(req({ ...firstInput, confirmation: "yes", confirmed: true }), params(p.id))).status, 400);
      assert.ok((await client.callTool({ name: "approve_ai_action_batch", arguments: { runId: p.id, ...firstInput, confirmation: "yes" } })).isError);
      const first = await mcp("approve_ai_action_batch", { runId: p.id, ...firstInput });
      assert.equal(first.code, "DECISION_APPROVED"); assert.deepEqual(await decide(p, firstInput), first);
      assert.equal((await runRow(p)).state, "awaiting_approval"); assert.equal(await runs.claimNextRun(), null);
      await assertPartial(p, 0); assert.equal((await metadata(p)).resumes, 0);

      // Revise an already-approved proposal: change both the amount and exact selection.
      // All prior step/decision bindings must lose effect authority, even if their receipt is replayed.
      const approved = await read(p), changedAmount = "1073741824";
      const items = p.items.map(i => i.itemId === p.items[1].itemId ? { ...i, arguments: { ...p.items[1].arguments, amountMinor: changedAmount } } : i);
      const revision = { batchId: approved.batch.id, expectedVersion: approved.batch.version, expectedRunVersion: approved.runVersion,
        requestKey: "outer-revision", items, selectedItemIds: [p.items[0].itemId, p.items[1].itemId] };
      const invalid = await revise(p, { ...revision, selectedItemIds: [p.items[1].itemId] });
      assert.equal(invalid.code, "BATCH_INVALID"); assert.equal((await read(p)).batch.id, approved.batch.id);
      const revised = await revise(p, revision); assert.equal(revised.code, "BATCH_PREVIEW_RECORDED");
      assert.deepEqual(await mcp("revise_ai_action_batch", { runId: p.id, ...revision }), revised);
      const current = await read(p);
      assert.notEqual(current.batch.id, view.batch.id); assert.notEqual(current.batch.bindingDigest, view.batch.bindingDigest);
      assert.equal(current.batch.expiresAt, view.batch.expiresAt); assert.equal(current.batch.decision, undefined);
      assert.equal(current.batch.display.items.find((i: {itemId: string}) => i.itemId === p.items[1].itemId).preview.payment.amountMinor, changedAmount);
      assert.deepEqual(current.batch.display.totals, [{ currencyCode: "IRR", debitAmountMinor: "3221225472", creditAmountMinor: "3221225472" }]);
      assert.deepEqual(await decide(p, firstInput), first); // Stable historical acknowledgement, no new authority.
      p.resumeInput.expectedRunVersion = current.runVersion;
      assert.equal((await resume(p)).code, "BATCH_UNAVAILABLE"); assert.equal(await runs.claimNextRun(), null);
      const secondInput = body(current, "outer-second");
      const decisions = await Promise.all([decide(p, secondInput), mcp("approve_ai_action_batch", { runId: p.id, ...secondInput })]);
      assert.equal(decisions[0].code, "DECISION_APPROVED"); assert.deepEqual(decisions[0], decisions[1]);
      p.resumeInput = { runId: p.id, ...secondInput, expectedRunVersion: (await runRow(p)).version, requestKey: "outer-resume" };
      const queue = await resume(p); assert.deepEqual(await resume(p, "mcp"), queue); await work();
      assert.equal((await runRow(p)).state, "succeeded");
      assert.deepEqual(await metadata(p), { decisions: 2, resumes: 1, consumptions: 2, providers: 0 });
      assert.equal((await pool.query("select status from journal_entry where id=$1", [p.drafts[0].id])).rows[0].status, "posted");
      assert.deepEqual((await pool.query("select status,amount_paid::text,amount_due::text from invoice where id=$1", [p.paid.id])).rows[0], { status: "partial", amount_paid: changedAmount, amount_due: changedAmount });
      assert.equal((await pool.query("select amount_paid::text from bill where id=$1", [p.payable.id])).rows[0].amount_paid, "0");
      assert.equal((await pool.query("select count(*)::int n from journal_entry where id=any($1::uuid[]) and status='draft'", [[p.drafts[1].id, p.drafts[2].id]])).rows[0].n, 2);
      assert.equal(sent.length, 0); assert.equal((await deliveryRows(p)).length, 0);
      assert.ok((await consumptions(p)).every(c => c.batchId === current.batch.id));
      const progressRequest = new Request("http://test.invalid/ai?limit=20", { headers: req().headers });
      const progress = await data(await progressRoute.GET(progressRequest, params(p.id)));
      assert.deepEqual(progress, await mcp("get_ai_run_progress", { runId: p.id, limit: 20 }));
      assert.equal(progress.steps.filter((s: {code: string}) => s.code === "ACTION_COMPLETED").length, 2);
      const receipts = await consumptions(p); assert.deepEqual(await resume(p), queue); assert.equal(await runs.claimNextRun(), null);
      assert.deepEqual(await consumptions(p), receipts);

      // Reject through either transport; the entire selected dependency chain stays unexecuted.
      const rejected = await propose("USD", false), rejectInput = body(rejected.view, "outer-reject");
      const rejections = await Promise.all([decide(rejected, rejectInput, true), mcp("reject_ai_action_batch", { runId: rejected.id, ...rejectInput })]);
      assert.equal(rejections[0].code, "DECISION_REJECTED"); assert.deepEqual(rejections[0], rejections[1]);
      assert.equal((await runRow(rejected)).state, "cancelled"); await assertPartial(rejected, 0);
      assert.ok((await stepRows(rejected)).every(s => s.state === "skipped"));
      assert.equal((await pool.query("select count(*)::int n from ai_action_batch where run_id=$1 and (authority is not null or display is not null)", [rejected.id])).rows[0].n, 0);
      assert.equal((await resume(rejected)).code, "BATCH_CONFLICT"); assert.equal((await metadata(rejected)).consumptions, 0);

      // Safe localized codes travel through real read/decision transports without business detail.
      for (const change of ["resource", "expiry", "permission"] as const) {
        const q = await propose("USD", false), input = body(q.view, `outer-${change}`);
        if (change === "resource") await pool.query("update invoice set reference='edited after preview' where id=$1", [q.paid.id]);
        if (change === "expiry") await pool.query("update ai_run set deadline_at=now()-interval '1 second',started_at=now()-interval '2 minutes' where id=$1", [q.id]);
        if (change === "permission") await db.update(customRole).set({ permissions: permissions.filter(p => p !== "manage:payments") }).where(eq(customRole.id, role.id));
        const expected = change === "resource" ? "BATCH_STALE" : change === "expiry" ? "BATCH_EXPIRED" : "BATCH_DENIED";
        for (const result of [await read(q), await mcp("get_ai_action_batch", { runId: q.id }), await decide(q, input), await mcp("approve_ai_action_batch", { runId: q.id, ...input })]) {
          assert.equal(result.code, expected); assert.equal(result.batch, null);
          assert.deepEqual(result.recovery, change === "resource" ? ["refresh_preview"] : change === "permission" ? ["contact_administrator"] : ["inspect_run", "cancel_run"]);
          assert.doesNotMatch(JSON.stringify(result), /saved@|Original|amountMinor|arguments/);
        }
        await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
        await assertPartial(q, 0); assert.deepEqual(await metadata(q), { decisions: 0, resumes: 0, consumptions: 0, providers: 0 }); await stop(q);
      }
      const [approver] = await db.insert(users).values({ name: "Private independent approver", email: "ai008-approver@test.invalid" }).returning();
      const [approverMember] = await db.insert(member).values({ organizationId: org.id, userId: approver.id, role: "owner" }).returning();
      const workflow = (await pool.query("insert into approval_workflow (organization_id,name,entity_type,conditions) values ($1,'PRIVATE_APPROVAL_POLICY','journal_entry','[]'::jsonb) returning id", [org.id])).rows[0];
      await pool.query("insert into approval_workflow_step (workflow_id,step_order,approver_id) values ($1,1,$2)", [workflow.id, approverMember.id]);
      const policy = await propose("USD", false), policyInput = body(policy.view, "outer-business-policy");
      assert.equal(policy.view.batch.canApprove, false);
      for (const result of [await decide(policy, policyInput), await mcp("approve_ai_action_batch", { runId: policy.id, ...policyInput })]) {
        assert.equal(result.code, "DECISION_BUSINESS_APPROVAL_REQUIRED"); assert.equal(result.batch, null);
        assert.deepEqual(result.nextActors, ["independent_business_approver"]);
        assert.deepEqual(result.recovery, ["complete_business_approval", "refresh_preview", "cancel_run"]);
        for (const privateValue of [approver.id, approverMember.id, workflow.id, "PRIVATE_APPROVAL_POLICY", approver.name]) assert.ok(!JSON.stringify(result).includes(privateValue));
      }
      assert.equal((await resume(policy)).code, "BATCH_UNAVAILABLE");
      // An organization owner still cannot decide or read a sibling user's run.
      session = { user: { id: approver.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
      assert.equal((await read(policy)).code, "BATCH_NOT_FOUND"); assert.equal((await decide(policy, policyInput)).code, "BATCH_NOT_FOUND");
      session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
      await assertPartial(policy, 0); assert.deepEqual(await metadata(policy), { decisions: 0, resumes: 0, consumptions: 0, providers: 0 });
      await stop(policy); await pool.query("delete from approval_workflow where id=$1", [workflow.id]);
      console.log("AI-008 outer action journey REST/MCP/SQL verified");
      return;
    }
    if (process.env.AI044_ACCEPTANCE === "true") {
      const noModel = async () => { throw new Error("Approved execution called the model"); };
      const inputFor = (p: Proposal, lease: string, n: number) => ({ runId: p.id, lease, batchId: p.resumeInput.batchId, itemId: p.items[n].itemId });
      const claim = async (p: Proposal) => {
        const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, p.id); return claimed!.leaseOwner!;
      };
      // A second executor on the same lease cannot pass the process fence. Lose
      // the acknowledgement AFTER a real middle payment/receipt commit, then
      // finish the dependency chain from that original durable receipt.
      const p = await propose("IRR"); const queued = await resume(p, "mcp"), lease = await claim(p);
      const payStep = p.view.batch.display.items.find((i: { itemId: string }) => i.itemId === p.items[1].itemId).stepId;
      let lostAcknowledgements = 0;
      const transaction = db.transaction.bind(db);
      const lostAck = mock.method(db, "transaction", async (...args: Parameters<typeof db.transaction>) => {
        const result = await transaction(...args);
        if (result && typeof result === "object" && "stepId" in result && result.stepId === payStep && "state" in result && result.state === "succeeded" && !lostAcknowledgements++) {
          throw new Error("Lost actual payment COMMIT acknowledgement");
        }
        return result;
      });
      const lock = await pool.connect(); await lock.query("begin"); await lock.query("lock table invoice in row exclusive mode");
      const executing = executeRun(p.id, lease, noModel);
      try {
        await waitFor('lock table %"invoice"%');
        assert.equal((await executeRun(p.id, lease, noModel)).state, "busy");
        await lock.query("commit"); assert.equal((await executing).state, "succeeded");
      } finally { await lock.query("rollback"); lock.release(); await executing; lostAck.mock.restore(); }
      assert.equal(lostAcknowledgements, 1); await assertPartial(p, 5);
      const receipts = await consumptions(p), steps = await stepRows(p), delivered = sent.length;
      assert.equal(receipts.length, 5); assert.equal(new Set(receipts.map(c => c.itemId)).size, 5);
      assert.equal(new Set(receipts.map(c => c.decisionId)).size, 1); assert.equal(delivered, 1);
      const paymentReceipt = steps.find(s => s.id === payStep)!;
      assert.equal((await pool.query("select count(*)::int n from payment where id=$1 and amount::text=$2", [paymentReceipt.recordIds![1], p.amountMinor])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int n from payment_allocation where payment_id=$1 and document_id=$2 and amount::text=$3", [paymentReceipt.recordIds![1], p.paid.id, p.amountMinor])).rows[0].n, 1);
      assert.deepEqual((await pool.query("select count(*)::int n, sum(amount)::text total from payment_allocation where document_id=$1", [p.paid.id])).rows[0], { n: 1, total: p.amountMinor });
      assert.equal((await pool.query("select count(*)::int n from audit_log where action='ai.settle' and changes->>'consumptionId'=$1", [receipts.find(c => c.stepId === payStep)!.id])).rows[0].n, 1);
      assert.equal((await pool.query("select coalesce(sum(debit_amount),0)::text debit, coalesce(sum(credit_amount),0)::text credit from journal_line where journal_entry_id=$1", [paymentReceipt.recordIds![2]])).rows[0].debit, p.amountMinor);
      assert.equal((await pool.query("select coalesce(sum(debit_amount-credit_amount),0)::text balance from journal_line where journal_entry_id=$1", [paymentReceipt.recordIds![2]])).rows[0].balance, "0");
      assert.deepEqual(await resume(p), queued); assert.equal(await runs.claimNextRun(), null);
      assert.deepEqual(await consumptions(p), receipts); assert.deepEqual(await stepRows(p), steps); assert.equal(sent.length, delivered);

      // A succeeded step/domain status alone cannot establish a prerequisite.
      // Damage each distinct durable binding after a real posting, then let a
      // fresh lease recover through the actual worker executor.
      for (const damage of ["missing", "arguments", "policy", "resource"] as const) {
        const q = await propose(); const receipt = await resume(q), originalLease = await claim(q);
        await batches.executeApprovedJournal(inputFor(q, originalLease, 0));
        const [consumed] = await consumptions(q);
        if (damage === "missing") await pool.query("delete from ai_action_consumption where id=$1", [consumed.id]);
        else {
          const column = { arguments: "argument_digest", policy: "policy_version", resource: "resource_version" }[damage];
          await pool.query(`update ai_action_consumption set ${column}=$1 where id=$2`, ["a".repeat(64), consumed.id]);
        }
        await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, q.id));
        await runs.maintainRuns(); await work();
        await assertPartial(q, 1); assert.equal((await runRow(q)).state, "failed");
        assert.equal((await deliveryRows(q)).length, 0);
        assert.deepEqual(await resume(q, "mcp"), receipt); assert.equal(await runs.claimNextRun(), null);
      }

      // The durable consumption is already committed while the payment waits.
      // Expiry or a new business approval policy must still prevent its effect.
      for (const change of ["expiry", "business-policy", "permission"] as const) {
        const q = await propose(); await resume(q); const originalLease = await claim(q);
        const blocker = await pool.connect(); await blocker.query("begin"); await blocker.query("lock table invoice in row exclusive mode");
        const pending = executeRun(q.id, originalLease, noModel);
        let workflowId: string | undefined;
        try {
          await waitFor('lock table %"invoice"%');
          assert.equal((await consumptions(q)).length, 2);
          if (change === "expiry") await pool.query("update ai_run set deadline_at=now()-interval '1 second', started_at=now()-interval '2 minutes' where id=$1", [q.id]);
          else if (change === "permission") await db.update(customRole).set({ permissions: permissions.filter(p => p !== "manage:payments") }).where(eq(customRole.id, role.id));
          else {
            const [approver] = await db.insert(users).values({ name: "Independent approver", email: "ai044-approver@test.invalid" }).returning();
            const [approverMember] = await db.insert(member).values({ organizationId: org.id, userId: approver.id, role: "member" }).returning();
            workflowId = (await pool.query("insert into approval_workflow (organization_id,name,entity_type,conditions) values ($1,'Late required approval','invoice','[]'::jsonb) returning id", [org.id])).rows[0].id;
            await pool.query("insert into approval_workflow_step (workflow_id,step_order,approver_id) values ($1,1,$2)", [workflowId, approverMember.id]);
          }
          await blocker.query("commit"); await pending;
          await assertPartial(q, 1); assert.notEqual((await runRow(q)).state, "succeeded");
          assert.equal((await deliveryRows(q)).length, 0);
          assert.equal((await stepRows(q)).find(s => s.id === (q.view.batch.display.items as {itemId: string; stepId: string}[]).find(i => i.itemId === q.items[1].itemId)!.stepId)!.state, "failed");
        } finally {
          await blocker.query("rollback"); blocker.release(); await pending;
          if (workflowId) await pool.query("delete from approval_workflow where id=$1", [workflowId]);
          await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
        }
      }
      // No clarification, executor primitive or security operation is exposed
      // as an automatic tool; the registered transport has no execution bypass.
      const { AI_TOOL_NAMES, catalogEntry } = await import("../../lib/ai/tool-catalog");
      assert.equal(AI_TOOL_NAMES.length, 7);
      assert.ok(AI_TOOL_NAMES.every(name => ["read", "draft"].includes(catalogEntry(name)!.effect)));
      const tools = (await client.listTools()).tools.map(t => t.name);
      for (const name of ["execute_approved_journal", "execute_approved_settlement", "execute_approved_invoice_email", "consume_approved_action", "update_ai_provider", "update_role"]) {
        assert.equal(catalogEntry(name), undefined); assert.ok(!tools.includes(name));
      }
      assert.equal((await pool.query("select count(*)::int n from ai_provider_attempt")).rows[0].n, 0);
      console.log("AI-044 combined execution acceptance verified");
      return;
    }
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
