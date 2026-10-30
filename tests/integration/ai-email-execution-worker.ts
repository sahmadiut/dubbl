import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, contact, invoice, aiProvider, aiProviderConfig, aiToolPolicy,
  aiActionConsumption, aiRun, aiStep, emailConfig, subscription, approvalWorkflow, approvalWorkflowStep } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const sent: { to: string; subject: string; html: string; attachments?: unknown }[] = [];
let transport: "smtp" | "platform" = "platform", outcome: "success" | "lost_ack" | "rejected" = "success";
let onSend: (() => Promise<void>) | undefined;
async function deliver(message: typeof sent[number]) {
  // A second connection sees the immutable attempt BEFORE provider invocation.
  const rows = await pool.query("select d.state, e.status, e.recipient_email from ai_action_delivery d join document_email_log e on e.id=d.email_log_id where e.recipient_email=$1 and d.state='uncertain'", [message.to]);
  assert.ok(rows.rowCount); assert.ok(rows.rows.every(r => r.status === "uncertain"));
  sent.push(message); await onSend?.();
  if (process.env.AI054_CRASH_SEND) {
    console.log("AI054_PROVIDER_ACCEPTED");
    await new Promise(() => {});
  }
  if (outcome === "lost_ack") throw new Error("synthetic private provider response / secret body");
}
mock.module("nodemailer", { defaultExport: { createTransport: () => ({ sendMail: async (message: typeof sent[number]) => {
  assert.equal(transport, "smtp"); if (outcome === "rejected") return { accepted: [], rejected: [message.to] };
  await deliver(message); return { accepted: [message.to], rejected: [] };
} }) } });
mock.module("resend", { namedExports: { Resend: class { emails = { send: async (message: typeof sent[number]) => {
  assert.equal(transport, "platform");
  if (outcome === "rejected") return { data: null, error: { message: "private provider response" } };
  await deliver(message); return { data: { id: "private-provider-id" }, error: null };
} }; } } });
process.env.RESEND_API_KEY = "synthetic";
process.env.EMAIL_ENCRYPTION_KEY = "11".repeat(32);

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.env.AI054_EXECUTE) { console.log(JSON.stringify(await batches.executeApprovedInvoiceEmail(JSON.parse(process.env.AI054_EXECUTE)))); return; }
  if (process.env.AI054_RECOVER) { await runs.maintainRuns(); console.log("Fresh process recovered delivery without resend"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route");
  const { createInvoice } = await import("../../lib/api/invoice-writes"), { sendInvoice } = await import("../../lib/api/invoice-lifecycle");
  const { resendDocumentEmail } = await import("../../lib/documents/email-rendering");
  const { encryptPassword } = await import("../../lib/email/smtp-client");
  const [owner] = await db.insert(users).values({ name: "Owner", email: "ai054-owner@test.invalid" }).returning();
  const [org] = await db.insert(organization).values({ name: "Saved sender", slug: "ai054", contactEmail: "sender@test.invalid" }).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "manage:invoices"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Operator", permissions }).returning();
  const [membership] = await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }).returning();
  const [, revenue] = await db.insert(chartAccount).values([{ code: "1200", name: "AR", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const }].map(a => ({ ...a, organizationId: org.id }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Saved recipient", type: "customer", email: "saved@test.invalid" }).returning();
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-31" }] }).returning();
  const [config] = await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" }).returning();
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: unknown) => new Request("http://test.invalid/ai", { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req()), fixtureCtx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  let sequence = 0;
  const runRow = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const steps = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id));
  const attempts = async (id: string) => (await pool.query("select d.*, e.status, e.body, e.recipient_email from ai_action_delivery d join ai_action_consumption c on c.id=d.consumption_id join document_email_log e on e.id=d.email_log_id where c.run_id=$1", [id])).rows;
  async function propose(currency = "USD") {
    const saved = (await createInvoice(fixtureCtx, { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode: currency,
      lines: [{ description: "Saved invoice item", unitPriceMinor: currency === "IRR" ? "2147483648" : "1250", accountId: revenue.id }] }, "rest")).invoice;
    await sendInvoice(fixtureCtx, saved.id);
    const item = { itemId: randomUUID(), action: "email_invoice" as const, arguments: { documentId: saved.id }, dependsOn: [] };
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++sequence}`, message: "Prepare email" });
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, r.id);
    await batches.requestActionBatch(r.id, claimed!.leaseOwner!, claimed!.version, { requestKey: "initial", items: [item], selectedItemIds: [] });
    let view = await batches.getActionBatch(ctx, { runId: r.id }); assert.ok(view.batch);
    await batches.reviseActionBatch(ctx, { runId: r.id, batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion,
      requestKey: "selected", items: [item], selectedItemIds: [item.itemId] });
    view = await batches.getActionBatch(ctx, { runId: r.id }); assert.ok(view.batch);
    const response = await approveRoute.POST(req({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion,
      bindingDigest: view.batch.bindingDigest, selectedItemIds: [item.itemId], requestKey: "approve" }), { params: Promise.resolve({ id: r.id }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).code, "DECISION_APPROVED");
    // Explicit fixture-only resume; application/worker integration stays AI-051.
    await db.update(aiRun).set({ state: "queued" }).where(eq(aiRun.id, r.id));
    const lease = await runs.claimNextRun(); assert.equal(lease?.id, r.id);
    return { id: r.id, c, saved, input: { runId: r.id, lease: lease!.leaseOwner!, batchId: view.batch.id, itemId: item.itemId } };
  }
  const stop = (p: Awaited<ReturnType<typeof propose>>) => runs.cancelRun(ctx, { runId: p.id });
  async function waitFor(query: string) {
    for (let i = 0; i < 400; i++) {
      if ((await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1", [query])).rowCount) return;
      await delay(10);
    }
    throw new Error(`Expected SQL wait: ${query}`);
  }
  for (const kind of ["platform", "smtp"] as const) {
    transport = kind;
    if (kind === "smtp") await db.insert(emailConfig).values({ organizationId: org.id, smtpHost: "synthetic.invalid", smtpUsername: "synthetic", smtpPassword: encryptPassword("synthetic"), fromEmail: "sender@test.invalid", isVerified: true });
    const p = await propose(), before = sent.length;
    await assert.rejects(batches.executeApprovedSettlement(p.input));
    await assert.rejects(batches.executeApprovedInvoiceEmail({ ...p.input, recipientEmail: "override@test.invalid" }));
    const result = await Promise.all([batches.executeApprovedInvoiceEmail(p.input), batches.executeApprovedInvoiceEmail(p.input)]);
    assert.equal(result.filter(r => r.code === "ACTION_EXECUTED").length, 1);
    assert.equal(result.filter(r => r.code === "ACTION_ALREADY_CONSUMED").length, 1);
    assert.equal(sent.length, before + 1); assert.equal(sent.at(-1)!.to, party.email);
    assert.ok(sent.at(-1)!.html.includes(p.saved.invoiceNumber)); assert.ok(sent.at(-1)!.html.includes("12.50")); assert.equal(sent.at(-1)!.attachments, undefined);
    const [attempt] = await attempts(p.id); assert.equal(attempt.state, "confirmed"); assert.equal(attempt.status, "sent");
    assert.deepEqual(result.find(r => r.code === "ACTION_EXECUTED")!.receipt.recordIds, [p.saved.id, attempt.email_log_id]);
    await assert.rejects(resendDocumentEmail(ctx, attempt.email_log_id));
    assert.equal((await batches.executeApprovedInvoiceEmail(p.input)).code, "ACTION_ALREADY_CONSUMED");
    assert.equal(sent.length, before + 1); await stop(p);
    assert.equal((await attempts(p.id))[0].state, "confirmed");
    if (kind === "smtp") {
      const rejected = await propose(); outcome = "rejected";
      assert.equal((await batches.executeApprovedInvoiceEmail(rejected.input)).code, "ACTION_FAILED");
      assert.equal((await attempts(rejected.id))[0].state, "failed"); assert.equal(sent.length, before + 1);
      outcome = "success";
    }
  }
  await db.delete(emailConfig).where(eq(emailConfig.organizationId, org.id)); transport = "platform";
  await db.update(organization).set({ defaultCurrency: "IRR" }).where(eq(organization.id, org.id));
  await pool.query("update chart_account set currency_code='IRR'");
  const irr = await propose("IRR"); assert.equal((await batches.executeApprovedInvoiceEmail(irr.input)).receipt.state, "succeeded");
  assert.ok(sent.at(-1)!.html.includes("2,147,483,648")); await stop(irr);
  await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, org.id)); await pool.query("update chart_account set currency_code='USD'");

  for (const failure of ["lost_ack", "rejected"] as const) {
    const p = await propose(); outcome = failure;
    const result = await batches.executeApprovedInvoiceEmail(p.input);
    assert.equal(result.code, failure === "rejected" ? "ACTION_FAILED" : "ACTION_RECONCILIATION_REQUIRED"); assert.equal(result.receipt.state, failure === "rejected" ? "failed" : "uncertain");
    assert.equal((await attempts(p.id))[0].state, failure === "rejected" ? "failed" : "uncertain");
    assert.equal((await runRow(p.id)).state, failure === "rejected" ? "failed" : "reconciliation_required");
    const before = sent.length; await assert.rejects(batches.executeApprovedInvoiceEmail(p.input)); assert.equal(sent.length, before);
    const raw = JSON.stringify((await pool.query("select * from ai_action_delivery where consumption_id=$1", [result.consumptionId])).rows);
    assert.ok(!/private|secret|saved@|synthetic/.test(raw)); outcome = "success";
  }

  // Post-consumption, pre-dispatch SQL waits let current resource/Stop writers win.
  const races = ["recipient", "resource", "permission", "member", "policy", "config", "transport", "limit", "runtime", "lease", "deadline", "stop"] as const;
  for (const race of races) {
    const p = await propose(), before = sent.length, blocker = await pool.connect();
    await blocker.query("begin"); await blocker.query("lock table invoice in row exclusive mode");
    const execution = batches.executeApprovedInvoiceEmail(p.input);
    let workflowId: string | undefined;
    try {
      await waitFor('lock table "invoice"%'); assert.equal((await attempts(p.id)).length, 1);
      if (race === "recipient") await db.update(contact).set({ email: "changed@test.invalid" }).where(eq(contact.id, party.id));
      if (race === "resource") await db.update(invoice).set({ notes: "Changed after approval" }).where(eq(invoice.id, p.saved.id));
      if (race === "permission") await db.update(customRole).set({ permissions: permissions.filter(p => p !== "manage:invoices") }).where(eq(customRole.id, role.id));
      if (race === "member") await db.delete(member).where(eq(member.id, membership.id));
      if (race === "policy") {
        const [w] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "New policy", entityType: "invoice", conditions: [], isActive: true }).returning(); workflowId = w.id;
        await db.insert(approvalWorkflowStep).values({ workflowId: w.id, stepOrder: 1, approverId: membership.id });
      }
      if (race === "config") await db.update(aiProviderConfig).set({ version: config.version + 1 }).where(eq(aiProviderConfig.id, config.id));
      if (race === "transport") await db.insert(emailConfig).values({ organizationId: org.id, smtpHost: "changed.invalid", smtpUsername: "synthetic", smtpPassword: encryptPassword("synthetic"), fromEmail: "changed@test.invalid", isVerified: true });
      if (race === "limit") await db.insert(subscription).values({ organizationId: org.id, plan: "free", storagePlan: "free" });
      if (race === "limit") await pool.query("insert into document_email_log (organization_id,document_type,document_id,recipient_email,subject,body,attach_pdf,status) select $1,'invoice',$2,'limit@test.invalid','limit','limit',false,'sent' from generate_series(1,1000)", [org.id, p.saved.id]);
      if (race === "runtime") process.env.AI_RUNTIME_ENABLED = "false";
      if (race === "lease") await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, p.id));
      if (race === "deadline") await db.update(aiRun).set({ deadlineAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, p.id));
      if (race === "stop") await stop(p);
      await blocker.query("commit");
      const result = await execution; assert.ok(result.code !== "ACTION_EXECUTED", race);
      assert.equal(sent.length, before, race); assert.equal((await attempts(p.id))[0].state, "failed", race);
    } finally {
      await blocker.query("rollback"); blocker.release();
      process.env.AI_RUNTIME_ENABLED = "true";
      await db.update(contact).set({ email: party.email }).where(eq(contact.id, party.id));
      await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
      await db.insert(member).values(membership).onConflictDoUpdate({ target: member.id, set: { role: "member", customRoleId: role.id } });
      await db.update(aiProviderConfig).set({ version: config.version }).where(eq(aiProviderConfig.id, config.id));
      if (workflowId) await db.delete(approvalWorkflow).where(eq(approvalWorkflow.id, workflowId));
      if (race === "transport") await db.delete(emailConfig).where(eq(emailConfig.organizationId, org.id));
      if (race === "limit") { await pool.query("delete from document_email_log where recipient_email='limit@test.invalid'"); await db.delete(subscription).where(eq(subscription.organizationId, org.id)); }
      await stop(p);
    }
  }

  // Expiry while waiting on the LAST audit write must still prevent dispatch.
  const expiry = await propose(), beforeExpiry = sent.length, resourceWait = await pool.connect(), auditWait = await pool.connect();
  await resourceWait.query("begin"); await resourceWait.query("lock table invoice in row exclusive mode");
  const expiring = batches.executeApprovedInvoiceEmail(expiry.input);
  try {
    await waitFor('lock table "invoice"%');
    await auditWait.query("begin"); await auditWait.query("lock table audit_log in share mode");
    await db.update(aiRun).set({ deadlineAt: new Date(Date.now() + 500) }).where(eq(aiRun.id, expiry.id));
    await resourceWait.query("commit"); await waitFor('insert into "audit_log"%');
    await delay(550); await auditWait.query("commit");
    assert.equal((await expiring).code, "ACTION_FAILED"); assert.equal(sent.length, beforeExpiry);
    assert.equal((await attempts(expiry.id))[0].state, "failed");
  } finally { await resourceWait.query("rollback"); await auditWait.query("rollback"); resourceWait.release(); auditWait.release(); await stop(expiry); }

  // A real COMMIT with a lost acknowledgement reconciles the durable receipt.
  const ack = await propose(), beforeAck = sent.length, original = db.transaction.bind(db);
  const ackMock = mock.method(db, "transaction", async (...args: Parameters<typeof db.transaction>) => {
    const result = await original(...args);
    if (result && typeof result === "object" && "state" in result && result.state === "succeeded") throw new Error("Lost COMMIT acknowledgement");
    return result;
  });
  try { assert.equal((await batches.executeApprovedInvoiceEmail(ack.input)).code, "ACTION_EXECUTED"); } finally { ackMock.mock.restore(); }
  assert.equal(sent.length, beforeAck + 1); assert.equal((await attempts(ack.id))[0].state, "confirmed"); await stop(ack);

  // Stop during provider acknowledgement waits for the already-started boundary.
  const late = await propose(); let stopping: Promise<unknown> | undefined;
  onSend = async () => { stopping = stop(late); await waitFor('select%from "ai_run"%for update%'); };
  assert.equal((await batches.executeApprovedInvoiceEmail(late.input)).receipt.state, "succeeded"); await stopping; onSend = undefined;
  assert.equal((await runRow(late.id)).state, "cancelled"); assert.equal((await attempts(late.id))[0].state, "confirmed");

  // Kill a separate worker after its durable attempt and before dispatch. A new
  // process recovers uncertainty; old leases and the domain resend both refuse.
  for (const afterSend of [false, true]) {
  const crash = await propose(), resource = await pool.connect();
  await resource.query("begin"); await resource.query("lock table invoice in row exclusive mode");
  const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-email-execution-worker.ts"], { env: { ...process.env, AI054_EXECUTE: JSON.stringify(crash.input), ...(afterSend ? { AI054_CRASH_SEND: "true" } : {}) }, stdio: "pipe" });
  const accepted = new Promise<void>(resolve => child.stdout.on("data", chunk => { if (String(chunk).includes("AI054_PROVIDER_ACCEPTED")) resolve(); }));
  const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
  try {
    await waitFor('lock table "invoice"%'); assert.equal((await attempts(crash.id))[0].state, "uncertain");
    if (afterSend) { await resource.query("commit"); await accepted; }
    child.kill(); await closed; await resource.query("commit");
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 1) }).where(eq(aiRun.id, crash.id));
    const recovered = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-email-execution-worker.ts"], { env: { ...process.env, AI054_RECOVER: "true" }, encoding: "utf8", timeout: 30000 });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.equal((await runRow(crash.id)).state, "reconciliation_required"); assert.ok((await steps(crash.id)).some(s => s.state === "uncertain"));
    await assert.rejects(batches.executeApprovedInvoiceEmail(crash.input));
    await assert.rejects(resendDocumentEmail(ctx, (await attempts(crash.id))[0].email_log_id));
  } finally { child.kill(); await closed; await resource.query("rollback"); resource.release(); }
  }
  assert.ok((await db.select().from(aiActionConsumption)).length > 0);
  console.log("AI email effects/SQL/restart verified");
}
main().then(() => pool.end()).then(() => process.exit(0), err => { console.error(err); process.exit(1); });
