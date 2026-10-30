import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, contact, journalEntry, journalLine, exchangeRate,
  aiProvider, aiProviderConfig, aiToolPolicy, aiRun, aiConversation, aiActionBatch, aiStep,
  approvalWorkflow, approvalWorkflowStep, approvalRequest } from "../../lib/db/schema";
import type { ActionItem } from "../../lib/ai/action-adapters";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const runs = await import("../../lib/ai/run-lifecycle"), store = await import("../../lib/ai/persistence"), batches = await import("../../lib/ai/action-batches");
  if (process.argv.includes("--maintenance-only")) { await runs.maintainRuns(); console.log("Mixed proposal maintenance after restart verified"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const getRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/route"), reviseRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/revise/route");
  const routes = {
    post_entry: await import("../../app/api/v1/ai/previews/journal-post/route"),
    delete_draft_journal: await import("../../app/api/v1/ai/previews/journal-delete/route"),
    settle_document: await import("../../app/api/v1/ai/previews/settlement/route"),
    email_invoice: await import("../../app/api/v1/ai/previews/invoice-email/route"),
  };
  const names = { post_entry: "preview_ai_journal_post", delete_draft_journal: "preview_ai_journal_delete", settle_document: "preview_ai_settlement", email_invoice: "preview_ai_invoice_email" };
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  assert.equal(AI_TOOL_NAMES.length, 7); for (const name of Object.values(names)) assert.ok(!AI_TOOL_NAMES.some(n => String(n) === name));
  const [owner, reviewer, other] = await db.insert(users).values(["owner", "reviewer", "other"].map(name => ({ name, email: `ai046-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Combined finite observations", slug: "ai046-a", contactEmail: "reply@test.invalid" }, { name: "Foreign", slug: "ai046-b" }]).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries", "edit:entries", "manage:payments", "manage:invoices"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Combined actor", permissions }).returning();
  const memberships = await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: reviewer.id, role: "owner" }, { organizationId: org.id, userId: other.id, role: "owner" }, { organizationId: foreign.id, userId: other.id, role: "owner" }]).returning();
  const [, , cash, revenue, expense] = await db.insert(chartAccount).values([
    { code: "1200", name: "Receivable", type: "asset" as const }, { code: "2100", name: "Payable", type: "liability" as const }, { code: "1100", name: "Cash", type: "asset" as const },
    { code: "4000", name: "Sales", type: "revenue" as const }, { code: "5000", name: "Purchases", type: "expense" as const }, { code: "4910", name: "Gain", type: "revenue" as const }, { code: "5930", name: "Loss", type: "expense" as const },
  ].map(a => ({ ...a, organizationId: org.id }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Mixed currency contact", email: "recipient@test.invalid", type: "both" }).returning();
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const request = (body?: unknown, organizationId = org.id) => new Request("http://test.invalid/api/v1/ai/combined", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", "x-organization-id": organizationId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response, status = 200) { assert.equal(response.status, status, await response.clone().text()); assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json(); }
  login(owner.id); const ctx = await getAuthContext(request()), fixtureCtx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  const { createInvoice } = await import("../../lib/api/invoice-writes"), { sendInvoice } = await import("../../lib/api/invoice-lifecycle"), { createBill } = await import("../../lib/api/bill-writes"), { receiveBill } = await import("../../lib/api/bill-lifecycle");
  const initialRate = { organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 2000000, rateExact: "2", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact" as const, source: "manual" as const };
  await db.insert(exchangeRate).values(initialRate);
  async function recognized(kind: "invoice" | "bill", currencyCode = "USD") {
    const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, lines: [{ description: "Combined fixture", unitPriceMinor: "1250", accountId: kind === "invoice" ? revenue.id : expense.id }] };
    if (kind === "invoice") { const c = await createInvoice(fixtureCtx, input, "rest"); return (await sendInvoice(fixtureCtx, c.invoice.id)).invoice; }
    const c = await createBill(fixtureCtx, input, "rest"); return (await receiveBill(fixtureCtx, c.bill.id)).bill;
  }
  const inv = await recognized("invoice"), payable = await recognized("bill", "EUR"), emailInv = await recognized("invoice");
  const [cashRate] = await db.insert(exchangeRate).values({ ...initialRate, date: "2026-10-20", rate: 3000000, rateExact: "3" }).returning();
  let seq = 0;
  async function draft(currencyCode: string) {
    const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 1000 + ++seq, date: "2026-10-20", reference: "governed", description: "Complete manual draft", createdBy: owner.id }).returning();
    await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: cash.id, debitAmount: 1250, currencyCode }, { journalEntryId: entry.id, accountId: revenue.id, creditAmount: 1250, currencyCode }]); return entry;
  }
  const post = await draft("USD"), rial = await draft("IRR"), deletion = await draft("USD");
  const workflows = [];
  for (const entityType of ["journal_entry", "invoice", "bill"] as const) {
    const [w] = await db.insert(approvalWorkflow).values({ organizationId: org.id, entityType, name: "HIDDEN_WORKFLOW", conditions: entityType === "journal_entry" ? [{ field: "reference", operator: "eq", value: "governed" }] : [{ field: "total", operator: "gte", value: "1000" }], isActive: true }).returning();
    const [step] = await db.insert(approvalWorkflowStep).values({ workflowId: w.id, stepOrder: 1, approverId: memberships[1].id }).returning(); workflows.push({ w, step });
    const ids = entityType === "journal_entry" ? [post.id, rial.id, deletion.id] : entityType === "invoice" ? [inv.id, emailInv.id] : [payable.id];
    await db.insert(approvalRequest).values(ids.map(entityId => ({ organizationId: org.id, workflowId: w.id, entityType, entityId, requestedById: memberships[0].id, status: "approved" as const, currentStepOrder: 1 })));
  }
  const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-${"a" + String(i + 1).padStart(11, "0")}`);
  const items: ActionItem[] = [
    { itemId: ids[0], action: "post_entry", arguments: { entryId: post.id }, dependsOn: [] },
    { itemId: ids[1], action: "post_entry", arguments: { entryId: rial.id }, dependsOn: [ids[0]] },
    { itemId: ids[2], action: "settle_document", arguments: { documentType: "invoice", documentId: inv.id, amountMinor: "500", date: "2026-10-20", method: "cash" }, dependsOn: [ids[1]] },
    { itemId: ids[3], action: "settle_document", arguments: { documentType: "bill", documentId: payable.id, amountMinor: "500", date: "2026-10-20", method: "bank_transfer" }, dependsOn: [ids[2]] },
    { itemId: ids[4], action: "delete_draft_journal", arguments: { entryId: deletion.id }, dependsOn: [] },
    { itemId: ids[5], action: "email_invoice", arguments: { documentId: emailInv.id }, dependsOn: [ids[3]] },
  ];
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000, delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-30" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const businessTables = ["journal_entry", "journal_line", "invoice", "invoice_line", "bill", "bill_line", "payment", "payment_allocation", "chart_account", "bank_account", "number_sequence", "contact", "audit_log", "document_email_log", "approval_workflow", "approval_workflow_step", "approval_request", "approval_action"];
  const aiTables = ["ai_run", "ai_step", "ai_event", "ai_action_batch", "ai_approval", "ai_usage_attempt", "ai_provider_attempt", "ai_provider_call"];
  async function hashes(tables = businessTables) { return Promise.all(tables.map(async t => (await pool.query(`select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) hash from ${t} t`)).rows[0].hash)); }
  async function unchanged<T>(fn: () => Promise<T>, includeAi = false) { const tables = includeAi ? [...businessTables, ...aiTables] : businessTables, before = await hashes(tables), result = await fn(); assert.deepEqual(await hashes(tables), before); return result; }
  const server = new McpServer({ name: "ai046", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "acceptance", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(st), client.connect(ct)]);
  async function mcp(name: string, args: Record<string, unknown>, error = false) { const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, error, JSON.stringify(r)); return error ? r : JSON.parse((r.content as { text: string }[])[0].text); }
  const get = (runId: string) => getRoute.GET(request(), params(runId)).then(r => data(r));
  const stored = (runId: string) => db.select().from(aiActionBatch).where(eq(aiActionBatch.runId, runId)).orderBy(aiActionBatch.version);
  async function start() { const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Observe mixed effects" }), run = await runs.claimNextRun(); assert.equal(run?.id, r.id); return { c, run: run! }; }
  async function propose() { const s = await start(); const receipt = await unchanged(() => batches.requestActionBatch(s.run.id, s.run.leaseOwner!, s.run.version, { requestKey: `batch-${++seq}`, items, selectedItemIds: [] })); return { ...s, receipt }; }
  const patch = (view: Awaited<ReturnType<typeof get>>, selectedItemIds = ids) => ({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: `revision-${++seq}`, items, selectedItemIds });
  const revise = (runId: string, body: object) => reviseRoute.POST(request(body), params(runId)).then(r => data(r));
  try {
    for (const item of items) {
      const rest = await unchanged(() => routes[item.action].POST(request(item.arguments)).then(r => data(r)), true);
      const linked = await unchanged(() => mcp(names[item.action], item.arguments), true);
      assert.equal(rest.code, "PREVIEW_ONLY"); assert.equal(linked.preview.resourceVersion, rest.preview.resourceVersion);
      assert.equal(rest.preview.action, item.action); assert.equal(rest.preview.canApprove, false); assert.ok(rest.preview.target.href.startsWith("/"));
      const policy = rest.preview.businessApproval; assert.equal(policy.required, true); assert.equal(policy.latestRequestStatus, "approved"); assert.equal(policy.approvalSatisfied, false); assert.equal(policy.resourceBoundApproval, false); assert.equal(policy.canCurrentActorApprove, false); assert.deepEqual(policy.nextActors, ["independent_business_approver"]);
      assert.doesNotMatch(JSON.stringify(rest), /HIDDEN_WORKFLOW|requestedById|approverId|workflowId|paymentLinkToken|credential/);
      if (item.action === "post_entry" || item.action === "delete_draft_journal") {
        assert.equal(rest.preview.before.status, "draft"); assert.equal(rest.preview.after.status, item.action === "post_entry" ? "posted" : "deleted"); assert.equal(rest.preview.lines.length, 2);
        assert.equal(rest.preview.amounts[0].debitAmountMinor, "1250");
        if (item.action === "delete_draft_journal") assert.ok(rest.preview.effects.includes("cannot_undo_deletion"));
      }
      if (item.action === "email_invoice") { assert.deepEqual(rest.preview.recipients, [{ email: party.email, name: party.name }]); assert.equal(rest.preview.before.status, rest.preview.after.status); assert.equal(rest.preview.content.amountMinor, "1250"); assert.equal(rest.preview.content.attachPdf, false); }
    }
    const initial = await propose(), runId = initial.run.id; let view = await unchanged(() => get(runId), true);
    assert.equal(view.code, "BATCH_PREVIEW_ONLY"); assert.equal(view.batch.display.items.length, 6); assert.deepEqual(view.batch.display.totals, []);
    assert.deepEqual(await unchanged(() => mcp("get_ai_action_batch", { runId }), true), view);
    assert.doesNotMatch(JSON.stringify(view), /"arguments"|credential|leaseOwner|HIDDEN_WORKFLOW/);
    assert.equal((await unchanged(() => revise(runId, patch(view, [ids[5]])), true)).code, "BATCH_INVALID");
    // UUID spelling cannot create a second effect on the same underlying row.
    const alias = { itemId: randomUUID(), action: "delete_draft_journal", arguments: { entryId: post.id.toUpperCase() }, dependsOn: [] };
    assert.equal((await unchanged(() => revise(runId, { ...patch(view), items: [items[0], alias], selectedItemIds: [] }), true)).code, "BATCH_INVALID");
    const itemAlias = { ...items[5], itemId: ids[0].toUpperCase() };
    assert.equal((await unchanged(() => revise(runId, { ...patch(view), items: [items[0], itemAlias], selectedItemIds: [] }), true)).code, "BATCH_INVALID");
    process.env.AI_RUNTIME_ENABLED = "false";
    assert.equal((await unchanged(() => get(runId), true)).code, "BATCH_PREVIEW_ONLY"); assert.equal((await unchanged(() => revise(runId, patch(view)), true)).code, "BATCH_DISABLED"); process.env.AI_RUNTIME_ENABLED = "true";
    const selection = patch(view), spelledSelection = { ...selection, items: items.map(i => ({ ...i, itemId: i.itemId.toUpperCase(), dependsOn: i.dependsOn.map(d => d.toUpperCase()) })), selectedItemIds: ids.map(id => id.toUpperCase()) };
    const [restReceipt, mcpReceipt] = await unchanged(() => Promise.all([revise(runId, spelledSelection), mcp("revise_ai_action_batch", { runId, ...selection })]));
    assert.deepEqual(restReceipt, mcpReceipt); assert.equal(restReceipt.version, 2); view = await get(runId);
    const prepared = await db.select().from(aiStep).where(eq(aiStep.runId, runId));
    assert.equal(prepared.filter(s => s.state === "prepared").length, 6); assert.equal(prepared.filter(s => s.state === "skipped").length, 6);
    const domainGrants = new Map([["post_entry", "post:entries"], ["delete_draft_journal", "edit:entries"], ["settle_document", "manage:payments"], ["email_invoice", "manage:invoices"]]);
    for (const step of prepared.filter(s => s.state === "prepared")) { assert.deepEqual(step.requiredPermissions, ["view:data", domainGrants.get(step.toolName)]); assert.equal(step.operationKey, step.id); assert.equal(step.input, null); assert.equal(step.dispatchLease, null); }
    const waiting = (await db.select().from(aiRun).where(eq(aiRun.id, runId)))[0]; assert.equal(waiting.state, "awaiting_approval"); assert.equal(waiting.leaseOwner, null); assert.equal(waiting.deadlineAt!.toISOString(), initial.run.deadlineAt!.toISOString());
    assert.deepEqual(view.batch.display.totals, [{ currencyCode: "IRR", debitAmountMinor: "1250", creditAmountMinor: "1250" }, { currencyCode: "USD", debitAmountMinor: "3250", creditAmountMinor: "3250" }]);
    const billDisplay = view.batch.display.items.find((i: { itemId: string }) => i.itemId === ids[3]).preview;
    assert.deepEqual(billDisplay.payment, { amountMinor: "500", currencyCode: "EUR", direction: "made" }); assert.equal(billDisplay.fx.carryingBaseMinor, "1000"); assert.equal(billDisplay.fx.cashBaseMinor, "1500"); assert.equal(billDisplay.fx.gainBaseMinor, "-500");
    const originalExpiry = view.batch.expiresAt; assert.deepEqual(await unchanged(() => revise(runId, selection), true), restReceipt);
    // A stale single adapter withholds the complete batch and failed revision rolls back all previous work.
    const billPolicy = workflows.find(w => w.w.entityType === "bill")!;
    await db.update(approvalWorkflow).set({ conditions: [{ field: "total", operator: "gte", value: "invalid" }] }).where(eq(approvalWorkflow.id, billPolicy.w.id));
    assert.equal((await unchanged(() => get(runId), true)).code, "BATCH_STALE"); assert.equal((await unchanged(() => revise(runId, patch(view)), true)).code, "BATCH_STALE");
    await db.update(approvalWorkflow).set({ conditions: [{ field: "total", operator: "gte", value: "1000" }] }).where(eq(approvalWorkflow.id, billPolicy.w.id));
    await db.update(approvalWorkflowStep).set({ approverId: memberships[0].id }).where(eq(approvalWorkflowStep.id, billPolicy.step.id));
    const self = await routes.settle_document.POST(request(items[3].arguments)).then(r => data(r)); assert.equal(self.preview.businessApproval.requirement, "policy_repair_required"); assert.equal(self.preview.canApprove, false);
    await db.update(approvalWorkflowStep).set({ approverId: memberships[1].id }).where(eq(approvalWorkflowStep.id, billPolicy.step.id));
    await db.update(journalEntry).set({ description: "Edited without updatedAt" }).where(eq(journalEntry.id, post.id));
    await db.update(contact).set({ name: "Edited saved contact label" }).where(eq(contact.id, party.id));
    await db.update(exchangeRate).set({ rate: 4000000, rateExact: "4" }).where(eq(exchangeRate.id, cashRate.id));
    assert.equal((await unchanged(() => get(runId), true)).code, "BATCH_STALE");
    assert.equal((await unchanged(() => revise(runId, patch(view)))).code, "BATCH_PREVIEW_RECORDED"); view = await get(runId); assert.equal(view.batch.version, 3); assert.equal(view.batch.expiresAt, originalExpiry);
    assert.deepEqual(view.batch.display.totals, [{ currencyCode: "IRR", debitAmountMinor: "1250", creditAmountMinor: "1250" }, { currencyCode: "USD", debitAmountMinor: "3750", creditAmountMinor: "3750" }]);
    assert.equal((await unchanged(() => revise(runId, patch(view)), true)).code, "BATCH_LIMIT");
    for (const permission of ["post:entries", "edit:entries", "manage:payments", "manage:invoices"]) {
      await db.update(customRole).set({ permissions: permissions.filter(p => p !== permission) }).where(eq(customRole.id, role.id));
      assert.equal((await unchanged(() => get(runId), true)).code, "BATCH_DENIED"); await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    }
    // Earlier posting permission is rechecked after waiting on the later email adapter.
    const lock = await pool.connect(); await lock.query("begin"); await lock.query("lock table invoice_line in access exclusive mode"); const pending = get(runId); let blocked = false;
    try {
      for (let n = 0; n < 100; n++) { const r = await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()"); if (r.rows[0].n) { blocked = true; break; } await delay(10); }
      assert.equal(blocked, true); await db.update(customRole).set({ permissions: permissions.filter(p => p !== "post:entries") }).where(eq(customRole.id, role.id));
    } finally { await lock.query("rollback"); lock.release(); }
    assert.equal((await pending).code, "BATCH_DENIED"); await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    login(other.id); assert.equal((await get(runId)).code, "BATCH_NOT_FOUND"); assert.equal((await data(await getRoute.GET(request(undefined, foreign.id), params(runId)))).code, "BATCH_NOT_FOUND"); login(owner.id);
    const forbidden = ["delete_payment", "refund_payment", "stripe_sync", "update_ai_provider", "update_custom_role"];
    for (const action of forbidden) { const invalid = { ...patch(view), items: [{ ...items[0], action }] }; await data(await reviseRoute.POST(request(invalid), params(runId)), 400); await mcp("revise_ai_action_batch", { runId, ...invalid }, true); }
    await runs.cancelRun(ctx, { runId }); assert.ok((await stored(runId)).every(r => !r.authority && !r.display));
    // Revocation after all six observations and a partial INSERT rolls back the
    // entire mixed proposal, including its run version, event and prepared steps.
    const writeWait = await start(), insertLock = await pool.connect();
    await insertLock.query("begin"); await insertLock.query("lock table ai_step in share mode");
    const beforeInsert = await hashes([...businessTables, ...aiTables]);
    const preparing = batches.requestActionBatch(writeWait.run.id, writeWait.run.leaseOwner!, writeWait.run.version, { requestKey: `wait-${++seq}`, items, selectedItemIds: [] });
    const rejected = assert.rejects(preparing); blocked = false;
    try {
      for (let n = 0; n < 200; n++) { const r = await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'insert into \"ai_step\"%' and pid<>pg_backend_pid()"); if (r.rows[0].n) { blocked = true; break; } await delay(10); }
      assert.equal(blocked, true); await db.update(customRole).set({ permissions: permissions.filter(p => p !== "manage:payments") }).where(eq(customRole.id, role.id));
    } finally { await insertLock.query("rollback"); insertLock.release(); await rejected; }
    assert.deepEqual(await hashes([...businessTables, ...aiTables]), beforeInsert);
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); await runs.cancelRun(ctx, { runId: writeWait.run.id });
    // All six adapter payloads obey erase/content retention/batch expiry after restart.
    const erased = await propose(); await unchanged(() => store.deleteConversation(ctx, erased.c.id)); assert.equal((await get(erased.run.id)).code, "BATCH_NOT_FOUND"); assert.ok((await stored(erased.run.id)).every(r => !r.authority && !r.display));
    const retained = await propose(); await db.update(aiConversation).set({ contentExpiresAt: new Date(Date.now() - 1) }).where(eq(aiConversation.id, retained.c.id)); await unchanged(() => store.purgeExpiredContent()); await runs.maintainRuns(); assert.ok((await stored(retained.run.id)).every(r => !r.authority && !r.display));
    const expired = await propose(); await db.update(aiActionBatch).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(aiActionBatch.runId, expired.run.id)); assert.equal((await get(expired.run.id)).code, "BATCH_EXPIRED");
    const restart = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-action-integration-worker.ts", "--maintenance-only"], { env: process.env, encoding: "utf8", timeout: 30000 }); assert.equal(restart.status, 0, `${restart.stdout}\n${restart.stderr}`);
    assert.match(restart.stdout, /Mixed proposal maintenance after restart verified/); assert.ok((await stored(expired.run.id)).every(r => !r.authority && !r.display && r.state === "expired")); assert.equal((await db.select().from(aiRun).where(eq(aiRun.id, expired.run.id)))[0].state, "expired");
    for (const table of ["payment", "document_email_log", "ai_approval", "ai_provider_attempt", "ai_provider_call"]) assert.equal((await pool.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
    console.log("Combined sensitive observations REST/MCP/SQL verified");
  } finally { await client.close(); await server.close(); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
