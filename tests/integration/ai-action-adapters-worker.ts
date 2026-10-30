import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, contact, bankAccount, journalEntry, journalLine, invoice, attachment, exchangeRate, periodLock, fiscalYear, documentEmailLog,
  aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiActionBatch, aiStep, approvalWorkflow, approvalWorkflowStep, approvalRequest } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const routes = {
    settle_document: await import("../../app/api/v1/ai/previews/settlement/route"),
    delete_draft_journal: await import("../../app/api/v1/ai/previews/journal-delete/route"),
    email_invoice: await import("../../app/api/v1/ai/previews/invoice-email/route"),
  };
  const getRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/route");
  const reviseRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/revise/route");
  const batches = await import("../../lib/ai/action-batches");
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { createInvoice } = await import("../../lib/api/invoice-writes"), { sendInvoice } = await import("../../lib/api/invoice-lifecycle");
  const { createBill } = await import("../../lib/api/bill-writes"), { receiveBill } = await import("../../lib/api/bill-lifecycle");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  assert.equal(AI_TOOL_NAMES.length, 7);
  const [owner, approver, outsider] = await db.insert(users).values(["owner", "approver", "outsider"].map(name => ({ name, email: `ai048-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Finite previews", slug: "ai048-a", contactEmail: "reply@test.invalid" }, { name: "Foreign", slug: "ai048-b" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "edit:entries", "post:entries", "manage:payments", "manage:invoices", "approve:invoices", "manage:bills"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Finite owner", permissions }).returning();
  const members = await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: approver.id, role: "owner" }, { organizationId: foreign.id, userId: outsider.id, role: "owner" }]).returning();
  const [, , cash, revenue, expense, gain] = await db.insert(chartAccount).values([
    { code: "1200", name: "AR", type: "asset" as const }, { code: "2100", name: "AP", type: "liability" as const }, { code: "1100", name: "Cash", type: "asset" as const },
    { code: "4000", name: "Revenue", type: "revenue" as const }, { code: "5000", name: "Expense", type: "expense" as const },
    { code: "4910", name: "FX gain", type: "revenue" as const }, { code: "5930", name: "FX loss", type: "expense" as const },
  ].map(a => ({ ...a, organizationId: org.id }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Saved customer", email: "recipient@test.invalid", type: "both" }).returning();
  const [bank, unlinkedBank] = await db.insert(bankAccount).values([{ organizationId: org.id, accountName: "USD", chartAccountId: cash.id }, { organizationId: org.id, accountName: "Unlinked" }]).returning();
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const request = (body?: unknown, orgId = org.id, search = "") => new Request(`http://test.invalid/api/v1/ai/previews/test${search}`, { method: body === undefined ? "GET" : "POST", headers: { "x-organization-id": orgId, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response, status = 200) { assert.equal(response.status, status, await response.clone().text()); assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json(); }
  login(owner.id); const ctx = await getAuthContext(request());
  const fixtureCtx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  let seq = 0;
  async function recognized(kind: "invoice" | "bill", amount = 1250, currencyCode = "USD") {
    const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, lines: [{ description: "Fixture", unitPriceMinor: String(amount), accountId: kind === "invoice" ? revenue.id : expense.id }] };
    if (kind === "invoice") { const c = await createInvoice(fixtureCtx, input, "rest"); return (await sendInvoice(fixtureCtx, c.invoice.id)).invoice; }
    const c = await createBill(fixtureCtx, input, "rest"); return (await receiveBill(fixtureCtx, c.bill.id)).bill;
  }
  async function journal() {
    const [e] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 1000 + ++seq, date: "2026-10-20", description: "Delete this manual draft", createdBy: owner.id }).returning();
    await db.insert(journalLine).values([{ journalEntryId: e.id, accountId: cash.id, debitAmount: 1250 }, { journalEntryId: e.id, accountId: revenue.id, creditAmount: 1250 }]); return e;
  }
  const inv = await recognized("invoice"), payable = await recognized("bill"), emailInv = await recognized("invoice"), draft = await journal();
  assert.ok("invoiceNumber" in emailInv);
  const server = new McpServer({ name: "ai048", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(st), client.connect(ct)]);
  const tool = { settle_document: "preview_ai_settlement", delete_draft_journal: "preview_ai_journal_delete", email_invoice: "preview_ai_invoice_email" };
  type Action = keyof typeof routes;
  async function mcp(name: string, args: Record<string, unknown>, error = false) { const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, error, JSON.stringify(r)); return error ? r : JSON.parse((r.content as { text: string }[])[0].text); }
  const rest = (action: Action, args: object) => routes[action].POST(request(args)).then(r => data(r));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const tables = ["invoice", "invoice_line", "bill", "bill_line", "journal_entry", "journal_line", "contact", "chart_account", "bank_account", "payment", "payment_allocation", "number_sequence", "audit_log", "document_email_log", "approval_request", "approval_action", "approval_workflow", "approval_workflow_step"];
  async function businessHash() { return Promise.all(tables.map(async t => (await pool.query(`select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) as hash from ${t} t`)).rows[0].hash)); }
  async function unchanged<T>(fn: () => Promise<T>) { const before = await businessHash(), result = await fn(); assert.deepEqual(await businessHash(), before); return result; }
  const inputs = {
    settle_document: { documentType: "invoice", documentId: inv.id, amountMinor: "500", date: "2026-10-20", method: "bank_transfer", bankAccountId: bank.id },
    delete_draft_journal: { entryId: draft.id }, email_invoice: { documentId: emailInv.id },
  };
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000, delegatedOrganizations: [org.id],
    models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  async function propose(items: object[]) { const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Prepare proposal" }); const run = await runs.claimNextRun(); assert.equal(run?.id, r.id); const receipt = await unchanged(() => batches.requestActionBatch(run!.id, run!.leaseOwner!, run!.version, { requestKey: `spec-${++seq}`, items, selectedItemIds: [] })); return { c, run: run!, receipt }; }
  const get = (id: string) => getRoute.GET(request(), params(id)).then(r => data(r));
  const revise = (runId: string, view: Awaited<ReturnType<typeof get>>, items: object[], selectedItemIds: string[]) => reviseRoute.POST(request({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: `revise-${++seq}`, items, selectedItemIds }), params(runId)).then(r => data(r));
  try {
    process.env.AI_RUNTIME_ENABLED = "false";
    for (const action of Object.keys(routes) as Action[]) {
      assert.ok(!AI_TOOL_NAMES.some(n => String(n) === tool[action]));
      const first = await unchanged(() => rest(action, inputs[action])); assert.equal(first.code, "PREVIEW_ONLY", JSON.stringify(first));
      const second = await unchanged(() => mcp(tool[action], inputs[action])); assert.equal(second.preview.resourceVersion, first.preview.resourceVersion);
      assert.equal(first.preview.authority, "preview_only"); assert.equal(first.preview.canApprove, false); assert.equal(first.preview.businessApproval.approvalSatisfied, false);
      assert.doesNotMatch(JSON.stringify(first), /paymentLinkToken|credential|workflowId|approverId/);
      assert.equal((await rest(action, { ...inputs[action], expectedResourceVersion: "f".repeat(64) })).code, "PREVIEW_STALE");
      for (const extra of [{ approved: true }, { organizationId: foreign.id }, { recipientEmail: "redirect@test.invalid" }, { provider: "stripe" }]) {
        await data(await routes[action].POST(request({ ...inputs[action], ...extra })), 400);
        await mcp(tool[action], { ...inputs[action], ...extra }, true);
      }
      await data(await routes[action].POST(request(inputs[action], org.id, "?approve=true")), 400);
      const foreignInput = action === "delete_draft_journal" ? { entryId: randomUUID() } : { ...inputs[action], documentId: randomUUID() };
      assert.equal((await unchanged(() => rest(action, foreignInput))).code, "PREVIEW_NOT_FOUND");
    }
    process.env.AI_RUNTIME_ENABLED = "true";
    const cashPreview = (await rest("settle_document", inputs.settle_document)).preview;
    assert.deepEqual(cashPreview.payment, { amountMinor: "500", currencyCode: "USD", direction: "received" });
    assert.equal(cashPreview.after.amountDueMinor, "750"); assert.equal(cashPreview.fx.cashBaseMinor, "500");
    const billPreview = await unchanged(() => rest("settle_document", { ...inputs.settle_document, documentType: "bill", documentId: payable.id, amountMinor: "1250" }));
    assert.equal(billPreview.code, "PREVIEW_ONLY"); assert.equal(billPreview.preview.payment.direction, "made"); assert.equal(billPreview.preview.after.status, "paid");
    assert.equal((await mcp(tool.settle_document, { ...inputs.settle_document, documentType: "bill", documentId: payable.id })).code, "PREVIEW_ONLY");
    for (const change of [{ amountMinor: "1251" }, { date: "2026-09-30" }, { bankAccountId: unlinkedBank.id }]) assert.equal((await unchanged(() => rest("settle_document", { ...inputs.settle_document, ...change }))).code, "PREVIEW_INVALID_RECORD");
    for (const change of [{ amountMinor: "9007199254740992" }, { amountMinor: "01" }, { amountMinor: "abc" }, { amountMinor: "1.5" }, { amountMinor: "-1" }, { amountMinor: "9".repeat(10000) }, { amount: 500 }, { idempotencyKey: "authority" }, { documentType: "refund" }]) {
      await data(await routes.settle_document.POST(request({ ...inputs.settle_document, ...change })), 400);
      await mcp(tool.settle_document, { ...inputs.settle_document, ...change }, true);
    }
    // Shared period policy is enforced for cash posting and strict draft deletion.
    const [period] = await db.insert(periodLock).values({ organizationId: org.id, lockDate: "2026-10-31" }).returning();
    for (const action of ["settle_document", "delete_draft_journal"] as const) assert.equal((await unchanged(() => rest(action, inputs[action]))).code, "PREVIEW_PERIOD_LOCKED");
    await db.delete(periodLock).where(eq(periodLock.id, period.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: org.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    assert.equal((await rest("settle_document", inputs.settle_document)).code, "PREVIEW_PERIOD_LOCKED"); await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    // Recognition and bank currency/reference changes are never disguised as ready.
    await db.update(bankAccount).set({ currencyCode: "EUR" }).where(eq(bankAccount.id, bank.id));
    assert.equal((await unchanged(() => rest("settle_document", inputs.settle_document))).code, "PREVIEW_INVALID_RECORD"); await db.update(bankAccount).set({ currencyCode: "USD" }).where(eq(bankAccount.id, bank.id));
    await db.update(journalEntry).set({ status: "draft" }).where(eq(journalEntry.id, inv.journalEntryId!));
    assert.equal((await unchanged(() => rest("settle_document", inputs.settle_document))).code, "PREVIEW_INVALID_RECORD"); await db.update(journalEntry).set({ status: "posted" }).where(eq(journalEntry.id, inv.journalEntryId!));
    const deletion = (await rest("delete_draft_journal", inputs.delete_draft_journal)).preview;
    assert.equal(deletion.after.status, "deleted"); assert.equal(deletion.lines.length, 2); assert.ok(deletion.effects.includes("cannot_undo_deletion"));
    const [linked] = await db.insert(attachment).values({ organizationId: org.id, journalEntryId: draft.id, fileName: "evidence", fileSize: 1, mimeType: "text/plain", fileKey: "fixture" }).returning();
    assert.equal((await unchanged(() => rest("delete_draft_journal", inputs.delete_draft_journal))).code, "PREVIEW_UNSUPPORTED"); await db.delete(attachment).where(eq(attachment.id, linked.id));
    const email = (await rest("email_invoice", inputs.email_invoice)).preview; assert.equal(email.recipients[0].email, party.email); assert.equal(email.documentAmounts.totalMinor, "1250"); assert.equal(email.content.attachPdf, false);
    for (const bad of ["a@test.invalid\r\nBcc:b@test.invalid", "a@test.invalid,b@test.invalid", "Someone <a@test.invalid>", "other@test.invalid"]) {
      await db.update(contact).set({ email: bad }).where(eq(contact.id, party.id)); assert.equal((await unchanged(() => rest("email_invoice", inputs.email_invoice))).code, "PREVIEW_INVALID_RECORD");
    }
    await db.update(contact).set({ email: party.email }).where(eq(contact.id, party.id));
    await db.update(invoice).set({ invoiceNumber: "Injected\r\nBcc: someone@test.invalid" }).where(eq(invoice.id, emailInv.id));
    assert.equal((await unchanged(() => rest("email_invoice", inputs.email_invoice))).code, "PREVIEW_INVALID_RECORD"); await db.update(invoice).set({ invoiceNumber: emailInv.invoiceNumber }).where(eq(invoice.id, emailInv.id));
    for (const extra of [{ attachPdf: true }, { personalMessage: "model message" }, { amountMinor: "1" }, { documentType: "quote" }, { viewUrl: "https://redirect.invalid" }]) await data(await routes.email_invoice.POST(request({ ...inputs.email_invoice, ...extra })), 400);
    // Observe the same email quota as direct delivery, without consuming it.
    await db.insert(documentEmailLog).values(Array.from({ length: 25 }, () => ({ organizationId: org.id, documentType: "invoice", documentId: emailInv.id, recipientEmail: party.email!, subject: "Synthetic quota", body: "Fixture", status: "sent" as const, sentBy: owner.id })));
    assert.equal((await unchanged(() => rest("email_invoice", inputs.email_invoice))).code, "PREVIEW_LIMIT_REACHED");
    await db.delete(documentEmailLog).where(eq(documentEmailLog.organizationId, org.id));
    // Qualified FX keeps source cash and base GL amounts separate, with saved recognition.
    await db.insert(exchangeRate).values({ organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 2000000, rateExact: "2", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact", source: "manual" });
    const eur = await recognized("invoice", 1250, "EUR");
    await db.insert(exchangeRate).values({ organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-20", rate: 3000000, rateExact: "3", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact", source: "manual" });
    const fxArgs = { ...inputs.settle_document, documentId: eur.id, bankAccountId: undefined };
    const fx = await unchanged(() => rest("settle_document", fxArgs)); assert.equal(fx.code, "PREVIEW_ONLY"); assert.equal(fx.preview.payment.currencyCode, "EUR"); assert.equal(fx.preview.fx.cashBaseMinor, "1500"); assert.equal(fx.preview.fx.carryingBaseMinor, "1000"); assert.equal(fx.preview.fx.gainBaseMinor, "500");
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, gain.id)); assert.equal((await unchanged(() => rest("settle_document", fxArgs))).code, "PREVIEW_INVALID_RECORD"); await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, gain.id));
    await db.delete(chartAccount).where(eq(chartAccount.id, gain.id)); assert.equal((await unchanged(() => rest("settle_document", fxArgs))).code, "PREVIEW_INVALID_RECORD"); await db.insert(chartAccount).values(gain);
    const itemIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const items = [
      { itemId: itemIds[0], action: "settle_document", arguments: inputs.settle_document, dependsOn: [] },
      { itemId: itemIds[1], action: "settle_document", arguments: { ...inputs.settle_document, documentId: payable.id, documentType: "bill" }, dependsOn: [itemIds[0]] },
      { itemId: itemIds[2], action: "delete_draft_journal", arguments: inputs.delete_draft_journal, dependsOn: [] },
      { itemId: itemIds[3], action: "email_invoice", arguments: inputs.email_invoice, dependsOn: [itemIds[1]] },
    ];
    const proposed = await propose(items), runId = proposed.run.id;
    let view = await unchanged(() => get(runId)); assert.equal(view.code, "BATCH_PREVIEW_ONLY"); assert.equal(view.batch.display.items.length, 4); assert.deepEqual(view.batch.display.totals, []);
    assert.equal((await unchanged(() => revise(runId, view, items, [itemIds[3]]))).code, "BATCH_INVALID");
    assert.equal((await unchanged(() => revise(runId, view, [...items, { ...items[0], itemId: randomUUID(), action: "email_invoice", arguments: { documentId: inv.id } }], []))).code, "BATCH_INVALID");
    assert.equal((await unchanged(() => revise(runId, view, items, itemIds))).code, "BATCH_PREVIEW_RECORDED"); view = await get(runId);
    assert.deepEqual(view.batch.display.totals, [{ currencyCode: "USD", debitAmountMinor: "1000", creditAmountMinor: "1000" }]); // deletion/email have no GL impact
    const row = (await db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, runId))).find(r => r.state === "pending")!;
    assert.equal(row.expiresAt.toISOString(), view.batch.expiresAt);
    const steps = await db.select().from(aiStep).where(eq(aiStep.runId, runId)); assert.ok(steps.filter(s => s.state === "prepared").every(s => s.requiredPermissions.includes(s.toolName === "settle_document" ? "manage:payments" : s.toolName === "email_invoice" ? "manage:invoices" : "edit:entries")));
    await db.update(invoice).set({ reference: "changed without timestamp" }).where(eq(invoice.id, inv.id)); assert.equal((await unchanged(() => get(runId))).code, "BATCH_STALE");
    assert.equal((await unchanged(() => revise(runId, view, items, itemIds))).code, "BATCH_PREVIEW_RECORDED"); view = await get(runId); assert.equal(view.batch.expiresAt, row.expiresAt.toISOString());
    await db.update(journalEntry).set({ reference: "new deletion reference" }).where(eq(journalEntry.id, draft.id));
    await db.update(contact).set({ name: "Changed recipient display" }).where(eq(contact.id, party.id));
    await db.update(chartAccount).set({ name: "Changed cash label" }).where(eq(chartAccount.id, cash.id));
    assert.equal((await unchanged(() => get(runId))).code, "BATCH_STALE");
    assert.equal((await unchanged(() => revise(runId, view, items, itemIds))).code, "BATCH_PREVIEW_RECORDED"); view = await get(runId); assert.equal(view.batch.expiresAt, row.expiresAt.toISOString());
    // Monetary policy uses the existing engine; approved legacy metadata is never resource authority.
    const [workflow] = await db.insert(approvalWorkflow).values({ organizationId: org.id, entityType: "invoice", name: "Hidden policy", conditions: [{ field: "total", operator: "gte", value: "1000" }], isActive: true }).returning();
    await db.insert(approvalWorkflowStep).values({ workflowId: workflow.id, stepOrder: 1, approverId: members[1].id });
    await db.insert(approvalRequest).values({ organizationId: org.id, workflowId: workflow.id, entityType: "invoice", entityId: inv.id, requestedById: members[0].id, status: "approved", currentStepOrder: 1 });
    const policy = await unchanged(() => rest("settle_document", inputs.settle_document)); assert.equal(policy.preview.businessApproval.required, true); assert.equal(policy.preview.businessApproval.approvalSatisfied, false); assert.deepEqual(policy.preview.businessApproval.nextActors, ["independent_business_approver"]);
    assert.equal((await unchanged(() => get(runId))).code, "BATCH_STALE");
    assert.equal((await revise(runId, view, items, itemIds)).code, "BATCH_PREVIEW_RECORDED"); view = await get(runId);
    await db.update(approvalWorkflowStep).set({ approverId: members[0].id }).where(eq(approvalWorkflowStep.workflowId, workflow.id));
    assert.equal((await rest("email_invoice", inputs.email_invoice)).preview.businessApproval.requirement, "policy_repair_required");
    await db.update(approvalWorkflow).set({ conditions: [{ field: "total", operator: "gte", value: "1.5" }] }).where(eq(approvalWorkflow.id, workflow.id));
    assert.equal((await unchanged(() => rest("settle_document", inputs.settle_document))).code, "PREVIEW_POLICY_INVALID"); assert.equal((await rest("email_invoice", inputs.email_invoice)).code, "PREVIEW_POLICY_INVALID");
    await db.update(approvalWorkflow).set({ isActive: false, conditions: [] }).where(eq(approvalWorkflow.id, workflow.id));
    // Direct SQL bigint values must fail before rounding or partial disclosure.
    await pool.query("update invoice set total=9007199254740993 where id=$1", [emailInv.id]); assert.equal((await unchanged(() => rest("email_invoice", inputs.email_invoice))).code, "PREVIEW_INVALID_RECORD"); await db.update(invoice).set({ total: 1250 }).where(eq(invoice.id, emailInv.id));
    await db.update(journalEntry).set({ description: "x".repeat(2001) }).where(eq(journalEntry.id, draft.id)); assert.equal((await rest("delete_draft_journal", inputs.delete_draft_journal)).code, "PREVIEW_TOO_LARGE"); await db.update(journalEntry).set({ description: draft.description }).where(eq(journalEntry.id, draft.id));
    // Every adapter rechecks live action permission after an actual table-read wait.
    for (const [action, table, permission] of [["settle_document", "invoice", "manage:payments"], ["delete_draft_journal", "journal_line", "edit:entries"], ["email_invoice", "invoice_line", "manage:invoices"]] as const) {
      const lock = await pool.connect(); await lock.query("begin"); await lock.query(`lock table ${table} in access exclusive mode`);
      const pending = rest(action, inputs[action]); let blocked = false;
      try {
        for (let n = 0; n < 100; n++) { const r = await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()"); if (r.rows[0].n) { blocked = true; break; } await delay(10); }
        assert.equal(blocked, true); await db.update(customRole).set({ permissions: permissions.filter(p => p !== permission) }).where(eq(customRole.id, role.id));
      } finally { await lock.query("rollback"); lock.release(); }
      assert.equal((await pending).code, "PREVIEW_DENIED"); assert.equal((await mcp(tool[action], inputs[action])).code, "PREVIEW_DENIED"); await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    }
    for (const action of Object.keys(routes) as Action[]) { login(outsider.id); const response = await routes[action].POST(request(inputs[action], foreign.id)); const result = await data(response); assert.equal(result.code, "PREVIEW_NOT_FOUND"); login(owner.id); }
    assert.equal((await pool.query("select count(*)::int n from payment")).rows[0].n, 0); assert.equal((await pool.query("select count(*)::int n from document_email_log")).rows[0].n, 0); assert.equal((await pool.query("select count(*)::int n from ai_approval")).rows[0].n, 0);
    await runs.cancelRun(ctx, { runId }); const cleared = await db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, runId)); assert.ok(cleared.every(r => r.authority === null && r.display === null));
    assert.equal((await db.select().from(aiRun).where(eq(aiRun.id, runId)))[0].state, "cancelled");
    console.log("Finite action adapters REST/MCP/SQL verified");
  } finally { await client.close(); await server.close(); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
