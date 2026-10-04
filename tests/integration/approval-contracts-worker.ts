import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, approvalWorkflow, approvalWorkflowStep, approvalRequest, approvalAction, expenseClaim, contact, chartAccount } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/approval-workflows/route";
import { GET as get, PATCH as patch, DELETE as remove } from "../../app/api/v1/approval-workflows/[id]/route";
import { GET as requests } from "../../app/api/v1/approval-requests/route";
import { GET as detail } from "../../app/api/v1/approval-requests/[id]/route";
import { POST as act } from "../../app/api/v1/approval-requests/[id]/action/route";
import { registerApprovalTools } from "../../lib/mcp/tools/approvals";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { createApprovalRequest, checkApprovalRequired } from "../../lib/approvals/engine";
import { createWorkflow, updateWorkflow, deleteWorkflow, actApprovalRequest } from "../../lib/approvals/service";

async function mcp(ctx: AuthContext, invoices = false) {
  const server = new McpServer({ name: "Approval fixture", version: "1" });
  if (invoices) registerInvoiceTools(server, ctx); else registerApprovalTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  if (!invoices) assert.equal(tools.length, 10);
  for (const tool of invoices ? [] : tools) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, tool.name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Approval A", slug: "approval-a", defaultCurrency: "KWD" }, { name: "Approval B", slug: "approval-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "approval-owner@example.test", passwordHash: "SYNTHETIC_PRIVATE_HASH" }, { email: "approval-view@example.test" }, { email: "approval-manager@example.test" }]).returning();
  const [viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Manage workflows", permissions: ["manage:bills"] }]).returning();
  const [maMember, mbMember, viewMember, manageMember] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]).returning();
  const keys = { a: "dk_approval_a", b: "dk_approval_b", viewer: "dk_approval_viewer", manager: "dk_approval_manager", expired: "dk_approval_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_approval", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] }), invoiceClient = await mcp(ctx, true);
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/approval-workflows${query}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["approval_workflow", "approval_workflow_step", "approval_request", "approval_action", "expense_claim", "invoice", "invoice_line", "number_sequence", "journal_entry", "journal_line", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true, name); assert.deepEqual(await snapshot(), before); };
  const wf = (extra = {}) => ({ name: "Expense review", entityType: "expense", conditions: [{ field: "totalAmount", operator: "gte", value: "3000000000" }],
    steps: [{ approverId: maMember.id }, { approverId: maMember.id, isRequired: false }], ...extra });
  const [expense, foreignExpense] = await db.insert(expenseClaim).values([{ organizationId: a.id, title: "Synthetic expense", submittedBy: owner.id, totalAmount: 3000000000, currencyCode: "KWD" },
    { organizationId: b.id, title: "Foreign expense", submittedBy: owner.id }]).returning();
  try {
    // Exact conditions govern the actual invoice create/submission paths in both transports.
    const [customer] = await db.insert(contact).values({ organizationId: a.id, name: "Synthetic customer", type: "customer", currencyCode: "KWD" }).returning();
    const [revenue] = await db.insert(chartAccount).values({ organizationId: a.id, name: "Revenue", code: "4000", type: "revenue" }).returning();
    const invoiceWorkflow = (await ma.call("create_approval_workflow", { name: "Large invoice", entityType: "invoice", conditions: [{ field: "total", operator: "gte", valueMinor: "3000000000" }], steps: [{ approverId: maMember.id }] })).body.workflow;
    const invoiceBody = { contactId: customer.id, issueDate: "2026-10-04", dueDate: "2026-11-04", currencyCode: "KWD", submitForApproval: true,
      lines: [{ description: "Synthetic sale", quantity: 1, unitPriceMinor: "3000000000", accountId: revenue.id }] };
    const createdInvoice = (await data(await createInvoice(req(invoiceBody)), 201)).invoice;
    assert.equal(createdInvoice.total, 3000000000); assert.equal(createdInvoice.totalMinor, "3000000000"); assert.equal(createdInvoice.status, "pending_approval");
    const mInvoice = await invoiceClient.call("create_invoice", invoiceBody);
    assert.equal(mInvoice.isError, false); assert.equal(mInvoice.body.invoice.status, "pending_approval");
    const invoiceRequest = (await db.query.approvalRequest.findFirst({ where: eq(approvalRequest.entityId, createdInvoice.id) }))!;
    assert.equal((await ma.call("approve_request", { requestId: invoiceRequest.id })).body.request.status, "approved");
    // Conditions cannot be bypassed by rounded/partial stored JSON or foreign step members.
    await db.update(approvalWorkflow).set({ conditions: [{ field: "total", operator: "gt", value: "1e3" }] }).where(eq(approvalWorkflow.id, invoiceWorkflow.id));
    await denied(() => createInvoice(req(invoiceBody)), 422);
    const beforeInvalid = await snapshot(); assert.equal((await invoiceClient.call("create_invoice", invoiceBody)).isError, true); assert.deepEqual(await snapshot(), beforeInvalid);
    await data(await patch(req({ conditions: [{ field: "total", operator: "gte", valueMinor: "3000000000" }] }), params(invoiceWorkflow.id)));
    await db.update(approvalWorkflowStep).set({ approverId: mbMember.id }).where(eq(approvalWorkflowStep.workflowId, invoiceWorkflow.id));
    await denied(() => createInvoice(req(invoiceBody)), 422);
    await db.update(approvalWorkflowStep).set({ approverId: maMember.id }).where(eq(approvalWorkflowStep.workflowId, invoiceWorkflow.id));
    await data(await remove(req(), params(invoiceWorkflow.id)));
    const own = (await data(await create(req(wf())), 201)).workflow;
    assert.equal(own.organizationId, a.id); assert.equal(own.conditions[0].valueMinor, "3000000000");
    assert.equal(JSON.stringify(own).includes("SYNTHETIC_PRIVATE_HASH"), false);
    assert.equal(JSON.stringify(own).includes("passwordHash"), false);
    assert.deepEqual((await ma.call("get_approval_workflow", { workflowId: own.id })).body.workflow, (await data(await get(req(), params(own.id)))).workflow);
    assert.equal((await ma.call("list_approval_workflows")).body.workflows.length, 1);
    assert.equal((await data(await list(req({}, keys.viewer)))).data.length, 1);
    const exact = (await ma.call("create_approval_workflow", wf({ name: "Int64 threshold", conditions: [{ field: "totalAmount", operator: "gt", valueMinor: "9223372036854775807" }] }))).body.workflow;
    assert.equal(exact.conditions[0].value, "9223372036854775807");
    assert.equal((await checkApprovalRequired(a.id, "expense", expense))?.id, own.id);
    assert.equal(await checkApprovalRequired(b.id, "expense", foreignExpense), null);
    assert.equal((await data(await patch(req({ name: "REST patched", conditions: [{ field: "totalAmount", operator: "gte", value: "3000000000", valueMinor: "3000000000" }] }), params(own.id)))).workflow.name, "REST patched");
    assert.equal((await ma.call("update_approval_workflow", { workflowId: own.id, name: "MCP patched" })).isError, false);
    const manageable = (await data(await create(req(wf({ name: "Manager", isActive: false }), keys.manager)), 201)).workflow;
    await data(await patch(req({ isActive: true }, keys.manager), params(manageable.id))); await data(await remove(req({}, keys.manager), params(manageable.id)));
    for (const key of [keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.viewer ? 403 : 401;
      await denied(() => create(req(wf(), key)), status); await denied(() => patch(req({ name: "Denied" }, key), params(own.id)), status);
      await denied(() => remove(req({}, key), params(own.id)), status);
    }
    for (const route of [get, patch, remove]) await denied(() => route(req({}, keys.b), params(own.id)), 404);
    for (const name of ["get_approval_workflow", "update_approval_workflow", "delete_approval_workflow"]) await mdenied(name, { workflowId: own.id }, mb);
    for (const [name, args] of [["create_approval_workflow", wf()], ["update_approval_workflow", { workflowId: own.id, name: "Denied" }], ["delete_approval_workflow", { workflowId: own.id }]] as const) await mdenied(name, args, ro);
    for (const steps of [[{ approverId: mbMember.id }], [{ approverId: owner.id }], [{ approverId: "9e4dde86-34a3-4f38-8f9e-af77b165dfac" }]]) {
      await denied(() => create(req(wf({ steps }))), 404); await denied(() => patch(req({ steps }), params(own.id)), 404);
      await mdenied("create_approval_workflow", wf({ steps }));
    }
    for (const conditions of [[{ field: "totalAmount", operator: "gt", value: "1e3" }], [{ field: "totalAmount", operator: "gt", value: "1", valueMinor: "2" }],
      [{ field: "totalAmount", operator: "gt", value: 1 }], [{ field: "totalAmount", operator: "gt", valueMinor: "9223372036854775808" }],
      [{ field: "totalAmount", operator: "gt", value: "1.5" }], [{ field: "totalAmount", operator: "gt", value: "9007199254740992.1" }],
      [{ field: "title", operator: "gt", value: "text" }], [{ field: "__proto__", operator: "eq", value: "x" }]]) {
      await denied(() => create(req(wf({ conditions }))), 400); await denied(() => patch(req({ conditions }), params(own.id)), 400);
      await mdenied("create_approval_workflow", wf({ conditions })); await mdenied("update_approval_workflow", { workflowId: own.id, conditions });
    }
    await denied(() => patch(req({ entityType: "invoice" }), params(own.id)), 400);
    await denied(() => create(req(wf({ unknown: true }))), 400); await mdenied("create_approval_workflow", wf({ unknown: true }));
    for (const query of ["?page=1x", "?limit=101", "?page=0", "?entityType=nope"]) for (const route of [list, requests]) await denied(() => route(req({}, keys.a, query)), 400);
    await denied(() => requests(req({}, keys.a, "?status=nope")), 400);
    const malformed = () => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    await denied(() => create(malformed()), 400); await denied(() => patch(malformed(), params(own.id)), 400);
    await denied(() => get(req(), params("bad")), 400);
    // Historical workflows may have non-contiguous step orders; retain their sequential decisions.
    await db.update(approvalWorkflowStep).set({ stepOrder: 3 }).where(eq(approvalWorkflowStep.id, own.steps[1].id));
    const ar = await createApprovalRequest(a.id, own.id, "expense", expense.id, maMember.id);
    for (const key of [keys.expired, "dk_invalid"]) {
      for (const route of [list, requests]) await denied(() => route(req({}, key)), 401);
      for (const route of [get, detail, act]) await denied(() => route(req({ action: "approve" }, key), params(route === get ? own.id : ar.id)), 401);
    }
    const read = (await data(await detail(req(), params(ar.id)))).request;
    assert.equal(read.workflow.conditions[0].valueMinor, "3000000000");
    assert.deepEqual((await ma.call("get_approval_request", { requestId: ar.id })).body.request, read);
    assert.equal((await ma.call("list_approval_requests", { entityType: "expense", status: "pending", approverId: maMember.id })).body.requests.length, 1);
    assert.equal((await data(await requests(req({}, keys.a, `?entityType=expense&approverId=${maMember.id}`)))).data.length, 1);
    await denied(() => requests(req({}, keys.a, `?approverId=${mbMember.id}`)), 404);
    for (const route of [detail, act]) await denied(() => route(req({ action: "comment", comment: "cross org" }, keys.b), params(ar.id)), 404);
    for (const name of ["get_approval_request", "approve_request", "reject_request", "comment_approval_request"]) await mdenied(name, { requestId: ar.id, ...(name === "get_approval_request" ? {} : { comment: "cross org" }) }, mb);
    await denied(() => act(req({ action: "approve" }, keys.viewer), params(ar.id)), 403);
    await denied(() => act(req({ action: "reject" }, keys.manager), params(ar.id)), 403);
    await denied(() => act(req({ action: "approve", unknown: true }), params(ar.id)), 400);
    await denied(() => act(malformed(), params(ar.id)), 400);
    await data(await act(req({ action: "comment", comment: "View member note" }, keys.viewer), params(ar.id)));
    assert.equal((await ro.call("comment_approval_request", { requestId: ar.id, comment: "MCP note" })).isError, false);
    assert.equal((await ma.call("approve_request", { requestId: ar.id })).body.request.currentStepOrder, 3);
    assert.equal((await data(await act(req({ action: "approve" }), params(ar.id)))).request.status, "approved");
    await db.update(expenseClaim).set({ deletedAt: new Date() }).where(eq(expenseClaim.id, expense.id));
    assert.equal((await data(await detail(req(), params(ar.id)))).request.status, "approved");
    await db.update(expenseClaim).set({ deletedAt: null }).where(eq(expenseClaim.id, expense.id));
    await denied(() => act(req({ action: "approve" }), params(ar.id)), 422);
    await mdenied("approve_request", { requestId: ar.id });
    await data(await patch(req({ name: "UI metadata edit", entityType: "expense", conditions: own.conditions,
      steps: own.steps.map((s: { approverId: string; isRequired: boolean }) => ({ approverId: s.approverId, isRequired: s.isRequired })) }), params(own.id)));
    await denied(() => patch(req({ steps: [{ approverId: maMember.id }] }), params(own.id)), 422);
    await mdenied("update_approval_workflow", { workflowId: own.id, steps: [{ approverId: maMember.id }] });
    for (const transport of ["REST", "MCP"]) {
      const reject = await createApprovalRequest(a.id, own.id, "expense", expense.id, maMember.id);
      if (transport === "REST") assert.equal((await data(await act(req({ action: "reject", comment: "No" }), params(reject.id)))).request.status, "rejected");
      else assert.equal((await ma.call("reject_request", { requestId: reject.id, comment: "No" })).body.request.status, "rejected");
    }
    const single = (await ma.call("create_approval_workflow", wf({ conditions: [], steps: [{ approverId: maMember.id }] }))).body.workflow;
    const race = await createApprovalRequest(a.id, single.id, "expense", expense.id, maMember.id);
    const results = await Promise.all([act(req({ action: "approve" }), params(race.id)), ma.call("approve_request", { requestId: race.id })]);
    assert.equal(Number((results[0] as Response).status === 200) + Number(!(results[1] as { isError: boolean }).isError), 1);
    assert.equal((await db.select().from(approvalAction).where(eq(approvalAction.requestId, race.id))).length, 1);
    const assigned = (await ma.call("create_approval_workflow", wf({ name: "Assigned member", steps: [{ approverId: viewMember.id }] }))).body.workflow;
    const assignedRequest = await createApprovalRequest(a.id, assigned.id, "expense", expense.id, maMember.id);
    await mdenied("approve_request", { requestId: assignedRequest.id });
    assert.equal((await ro.call("approve_request", { requestId: assignedRequest.id })).body.request.status, "approved");
    await data(await remove(req(), params(assigned.id)));
    // Existing malformed JSON and cross-tenant relations fail before any action writes.
    const bad = await createApprovalRequest(a.id, single.id, "expense", expense.id, maMember.id);
    const foreignWorkflow = (await mb.call("create_approval_workflow", wf({ name: "Foreign workflow", steps: [{ approverId: mbMember.id }] }))).body.workflow;
    await db.update(approvalRequest).set({ workflowId: foreignWorkflow.id }).where(eq(approvalRequest.id, bad.id));
    await denied(() => act(req({ action: "comment" }), params(bad.id)), 422);
    await mdenied("comment_approval_request", { requestId: bad.id });
    await db.update(approvalRequest).set({ workflowId: single.id }).where(eq(approvalRequest.id, bad.id));
    for (const changed of [{ workflowId: exact.id, requestedById: mbMember.id }, { workflowId: single.id, requestedById: maMember.id, entityId: foreignExpense.id }]) {
      await db.update(approvalRequest).set(changed).where(eq(approvalRequest.id, bad.id));
      await denied(() => act(req({ action: "comment" }), params(bad.id)), changed.requestedById === mbMember.id ? 422 : 404);
      await mdenied("comment_approval_request", { requestId: bad.id });
    }
    await db.update(approvalRequest).set({ workflowId: single.id, requestedById: maMember.id, entityId: expense.id }).where(eq(approvalRequest.id, bad.id));
    await db.update(approvalWorkflow).set({ conditions: [{ field: "totalAmount", operator: "gt", value: "1e3" }] }).where(eq(approvalWorkflow.id, single.id));
    await denied(() => get(req(), params(single.id)), 422); await denied(() => act(req({ action: "approve" }), params(bad.id)), 422);
    await mdenied("get_approval_request", { requestId: bad.id });
    await assert.rejects(() => checkApprovalRequired(a.id, "expense", expense));
    // An explicit condition replacement repairs invalid historical JSON; unrelated patches do not.
    await denied(() => patch(req({ name: "Cannot mask invalid conditions" }), params(single.id)), 422);
    await data(await patch(req({ conditions: [] }), params(single.id)));
    // Audit/step insertion failure must roll back every adopted write.
    await db.execute(sql`create function fail_approval_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure'; end $$`);
    await db.execute(sql`create trigger fail_approval_audit before insert on audit_log for each row execute function fail_approval_audit()`);
    for (const fn of [() => createWorkflow(ctx, wf()), () => updateWorkflow(ctx, exact.id, { name: "Rollback", steps: [{ approverId: manageMember.id }] }),
      () => deleteWorkflow(ctx, exact.id), () => actApprovalRequest(ctx, bad.id, { action: "approve" })]) {
      const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_approval_audit on audit_log`); await db.execute(sql`drop function fail_approval_audit()`);
    await db.execute(sql`create function fail_approval_steps() returns trigger language plpgsql as $$ begin raise exception 'Synthetic steps failure'; end $$`);
    await db.execute(sql`create trigger fail_approval_steps before insert on approval_workflow_step for each row execute function fail_approval_steps()`);
    for (const fn of [() => createWorkflow(ctx, wf()), () => updateWorkflow(ctx, exact.id, { steps: [{ approverId: maMember.id }] })]) {
      const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_approval_steps on approval_workflow_step`); await db.execute(sql`drop function fail_approval_steps()`);
    await data(await remove(req(), params(exact.id))); await denied(() => get(req(), params(exact.id)), 404);
    const toDelete = (await ma.call("create_approval_workflow", wf({ isActive: false }))).body.workflow;
    assert.equal((await ma.call("delete_approval_workflow", { workflowId: toDelete.id })).body.success, true);
    await data(await remove(req(), params(own.id))); // Historical request remains readable after workflow deletion.
    assert.equal((await data(await detail(req(), params(ar.id)))).request.status, "approved");
    console.log("REST and MCP approval contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), invoiceClient.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
