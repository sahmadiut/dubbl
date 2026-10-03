// Only runs in the wrapper's randomly named disposable database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, costCenter, project,
  inventoryItem, warehouse, priceList, priceListItem, invoice, invoiceLine, subscription, periodLock,
  customerCredit, approvalWorkflow, approvalWorkflowStep, approvalRequest } from "../../lib/db/schema";
import { POST } from "../../app/api/v1/invoices/route";
import { PATCH, DELETE } from "../../app/api/v1/invoices/[id]/route";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Invoice writes fixture", version: "1.0.0" }); registerInvoiceTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["create_invoice", "update_invoice", "delete_invoice"]) assert.ok(tools.some(tool => tool.name === name));
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_invoice")!.inputSchema).includes("unitPriceMinor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Write A", slug: "write-a" }, { name: "Write B", slug: "write-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "write-owner@example.test" }, { email: "write-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  const [ownerMember] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]).returning();
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_write_a", b: "dk_write_b", viewer: "dk_write_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_write" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer", paymentTermsDays: 0 }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Revenue", code: "400", type: "revenue" }, { organizationId: b.id, name: "Foreign", code: "400", type: "revenue" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, name: "Center", code: "A" }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [job, foreignJob] = await db.insert(project).values([{ organizationId: a.id, name: "Job" }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [item, foreignItem] = await db.insert(inventoryItem).values([{ organizationId: a.id, name: "Item", code: "A", salePrice: 999 }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [store, foreignStore] = await db.insert(warehouse).values([{ organizationId: a.id, name: "Warehouse", code: "A" }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [list, foreignList, euroList] = await db.insert(priceList).values([{ organizationId: a.id, name: "USD", currencyCode: "USD" },
    { organizationId: b.id, name: "Foreign" }, { organizationId: a.id, name: "EUR", currencyCode: "EUR" }]).returning();
  await db.insert(priceListItem).values([{ priceListId: list.id, inventoryItemId: item.id, minQuantity: 1, unitPrice: 800 },
    { priceListId: list.id, inventoryItemId: item.id, minQuantity: 3, unitPrice: 700 }]);
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const request = (method: string, body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/invoices", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const basic = { contactId: customer.id, issueDate: "2026-10-01", lines: [{ description: "Line", unitPrice: 12.5 }] };
  const post = (body: unknown, key = keys.a) => POST(request("POST", body, key));
  const patch = (id: string, body: unknown, key = keys.a) => PATCH(request("PATCH", body, key), params(id));
  const del = (id: string, key = keys.a) => DELETE(request("DELETE", undefined, key), params(id));
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from invoice i) invoices,
    (select coalesce(jsonb_agg(to_jsonb(l)::text order by l.id),'[]'::jsonb) from invoice_line l) lines,
    (select coalesce(jsonb_agg(to_jsonb(s)::text order by s.id),'[]'::jsonb) from number_sequence s) sequences,
    (select coalesce(jsonb_agg(to_jsonb(r)::text order by r.id),'[]'::jsonb) from approval_request r) approvals,
    (select count(*)::text from audit_log) audits`)).rows;
  const unchanged = async (operation: () => Promise<unknown>) => { const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before); };
  try {
    // Old and new contracts use real authentication and direct registered MCP callbacks.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }, { unitPriceExact: "12.50" }, { unitPrice: 12.5, unitPriceMinor: "1250", unitPriceExact: "12.50" }]) {
      const body = { ...basic, lines: [{ description: "Line", ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax.id,
        accountId: account.id, costCenterId: center.id, projectId: job.id, inventoryItemId: item.id, warehouseId: store.id }] };
      const response = await post(body); assert.equal(response.status, 201); const dto = await response.json();
      assert.equal(dto.invoice.total, 1856); assert.equal(dto.invoice.totalMinor, "1856"); assert.equal(dto.invoice.dueDate, "2026-10-31");
      assert.equal(dto.creditLimitWarning, null);
      const made = await ma.call("create_invoice", body); assert.equal(made.isError, false); assert.equal(made.body.invoice.totalMinor, "1856");
      const updated = await patch(dto.invoice.id, { lines: [{ description: "Replacement", unitPriceMinor: "99" }] });
      assert.equal(updated.status, 200); assert.equal((await updated.json()).invoice.totalMinor, "99");
      const mu = await ma.call("update_invoice", { invoiceId: made.body.invoice.id, notes: "Changed", lines: [{ description: "Replacement", unitPriceExact: "0.99" }] });
      assert.equal(mu.isError, false); assert.equal(mu.body.invoice.amountDueMinor, "99");
      assert.equal((await del(dto.invoice.id)).status, 200); assert.equal((await ma.call("delete_invoice", { invoiceId: made.body.invoice.id })).body.success, true);
      assert.equal((await db.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, dto.invoice.id))).length, 0);
      assert.ok((await db.query.invoice.findFirst({ where: eq(invoice.id, dto.invoice.id) }))!.deletedAt);
    }
    const rounded = await (await post({ ...basic, lines: [{ description: "Half", quantity: 3, unitPriceExact: "0.005" }] })).json();
    assert.equal(rounded.invoice.total, 3);
    assert.equal((await ma.call("create_invoice", { ...basic, lines: [{ description: "Half", quantity: 3, unitPriceExact: "0.005" }] })).body.invoice.total, 2);
    assert.equal((await (await patch(rounded.invoice.id, { lines: [{ description: "Half", quantity: 3, unitPriceExact: "0.005" }] })).json()).invoice.total, 2);
    // Currency fallback and zero/three-decimal aliases never rescale stored history.
    await db.update(contact).set({ currencyCode: "JPY" }).where(eq(contact.id, customer.id));
    assert.equal((await (await post(basic)).json()).invoice.currencyCode, "JPY");
    assert.equal((await ma.call("create_invoice", basic)).body.invoice.currencyCode, "USD");
    await db.update(contact).set({ currencyCode: "USD" }).where(eq(contact.id, customer.id));
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      const body = { ...basic, currencyCode: currency, lines: [{ description: "Units", unitPriceMinor: "1250" }] };
      assert.equal((await (await post(body)).json()).invoice.totalMinor, "1250");
      assert.equal((await ma.call("create_invoice", body)).body.invoice.totalMinor, "1250");
    }
    // Actual price lookup, quantity tiers, per-line override and MCP omission default.
    const lookup = { ...basic, lines: [{ description: "Item", inventoryItemId: item.id, quantity: 3 }], priceListId: list.id };
    assert.equal((await (await post(lookup)).json()).invoice.totalMinor, "2100");
    assert.equal((await ma.call("create_invoice", lookup)).body.invoice.totalMinor, "2100");
    assert.equal((await (await post({ ...lookup, priceListId: undefined })).json()).invoice.totalMinor, "2997");
    assert.equal((await ma.call("create_invoice", { ...lookup, priceListId: undefined })).body.invoice.totalMinor, "0");
    assert.equal((await (await post({ ...lookup, lines: [{ ...lookup.lines[0], unitPriceMinor: "500" }] })).json()).invoice.totalMinor, "1500");
    await db.update(priceList).set({ isActive: false }).where(eq(priceList.id, list.id));
    assert.equal((await (await post(lookup)).json()).invoice.totalMinor, "2997");
    await db.update(priceList).set({ isActive: true, effectiveFrom: "2026-10-02" }).where(eq(priceList.id, list.id));
    assert.equal((await (await post(lookup)).json()).invoice.totalMinor, "2997");
    await db.update(priceList).set({ effectiveFrom: null }).where(eq(priceList.id, list.id));
    await unchanged(async () => { assert.equal((await post({ ...lookup, currencyCode: "EUR", priceListId: undefined })).status, 422); });
    const editable = (await (await post(basic)).json()).invoice.id;
    for (const [field, foreign] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id], ["costCenterId", foreignCenter.id],
      ["projectId", foreignJob.id], ["inventoryItemId", foreignItem.id], ["warehouseId", foreignStore.id], ["priceListId", foreignList.id]] as const) {
      const lines = [{ description: "Bad", unitPriceMinor: "1250", [field]: foreign }];
      await unchanged(async () => { assert.equal((await post({ ...basic, lines })).status, 400); assert.equal((await patch(editable, { lines })).status, 400);
        assert.equal((await ma.call("create_invoice", { ...basic, lines })).isError, true); assert.equal((await ma.call("update_invoice", { invoiceId: editable, lines })).isError, true); });
    }
    for (const bad of [
      { ...basic, contactId: foreignCustomer.id }, { ...basic, contactId: randomUUID() }, { ...basic, issueDate: "2026-02-30" },
      { ...basic, priceListId: foreignList.id }, { ...lookup, priceListId: euroList.id },
      ...[{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "1250", unitPrice: 1 }, { unitPriceMinor: "01" },
        { unitPriceExact: "1e3" }, { unitPriceMinor: String(Number.MAX_SAFE_INTEGER), quantity: 2 }, { quantity: 21474836.48 }]
        .map(value => ({ ...basic, lines: [{ description: "Bad", ...value }] })),
      { ...basic, lines: [{ description: "Max", unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }, { description: "One", unitPriceMinor: "1" }] },
    ]) await unchanged(async () => {
      const response = await post(bad); assert.ok([400, 422].includes(response.status), `Unexpected ${response.status}`);
      assert.equal((await ma.call("create_invoice", bad)).isError, true);
    });
    await unchanged(async () => {
      assert.equal((await post(basic, keys.viewer)).status, 403); assert.equal((await patch(editable, {}, keys.viewer)).status, 403);
      assert.equal((await del(editable, keys.viewer)).status, 403); assert.equal((await post(basic, "dk_invalid")).status, 401);
      for (const [name, args] of [["create_invoice", basic], ["update_invoice", { invoiceId: editable }], ["delete_invoice", { invoiceId: editable }]] as const)
        assert.equal((await ro.call(name, args)).body.status, 403);
      assert.equal((await patch(editable, {}, keys.b)).status, 404); assert.equal((await del(editable, keys.b)).status, 404);
      assert.equal((await mb.call("update_invoice", { invoiceId: editable })).body.status, 404);
      assert.equal((await mb.call("delete_invoice", { invoiceId: editable })).body.status, 404);
    });
    // Locks on old and new issue dates prevent moving draft history out of a locked period.
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-09-30" });
    await unchanged(async () => {
      assert.equal((await post({ ...basic, issueDate: "2026-09-01" })).status, 422);
      assert.equal((await patch(editable, { issueDate: "2026-09-01" })).status, 422);
      assert.equal((await ma.call("update_invoice", { invoiceId: editable, issueDate: "2026-09-01" })).body.status, 422);
    });
    await db.update(invoice).set({ issueDate: "2026-09-01" }).where(eq(invoice.id, editable));
    await unchanged(async () => { assert.equal((await patch(editable, { issueDate: "2026-10-02" })).status, 422);
      assert.equal((await del(editable)).status, 422); assert.equal((await ma.call("delete_invoice", { invoiceId: editable })).body.status, 422); });
    await db.delete(periodLock); await db.update(invoice).set({ issueDate: "2026-10-01", status: "sent" }).where(eq(invoice.id, editable));
    await unchanged(async () => { assert.equal((await patch(editable, {})).status, 400); assert.equal((await del(editable)).status, 400);
      assert.equal((await ma.call("update_invoice", { invoiceId: editable })).body.status, 400); assert.equal((await ma.call("delete_invoice", { invoiceId: editable })).body.status, 400); });
    await db.update(invoice).set({ status: "draft" }).where(eq(invoice.id, editable));
    // Unsafe persisted headers/lines fail before even metadata updates/deletion.
    await db.execute(sql`update invoice set total = 9007199254740992 where id = ${editable}`);
    await unchanged(async () => { assert.equal((await patch(editable, { notes: "Fail" })).status, 422); assert.equal((await del(editable)).status, 422); });
    await db.update(invoice).set({ total: 1250 }).where(eq(invoice.id, editable));
    await db.execute(sql`update invoice_line set amount = 9007199254740992 where invoice_id = ${editable}`);
    await unchanged(async () => { assert.equal((await ma.call("update_invoice", { invoiceId: editable })).body.status, 422); assert.equal((await ma.call("delete_invoice", { invoiceId: editable })).body.status, 422); });
    await db.update(invoiceLine).set({ amount: 1250 }).where(eq(invoiceLine.invoiceId, editable));
    await db.update(invoice).set({ senderSnapshot: { unsafe: 9007199254740992 } }).where(eq(invoice.id, editable));
    await unchanged(async () => { assert.equal((await patch(editable, { notes: "Fail" })).status, 422);
      assert.equal((await ma.call("update_invoice", { invoiceId: editable, notes: "Fail" })).body.status, 422); });
    await db.update(invoice).set({ senderSnapshot: null }).where(eq(invoice.id, editable));
    // Retained dimensions may be inactive; a new line cannot use them.
    await db.update(invoiceLine).set({ accountId: account.id }).where(eq(invoiceLine.invoiceId, editable));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, account.id));
    assert.equal((await patch(editable, { notes: "Retained inactive reference" })).status, 200);
    await unchanged(async () => { assert.equal((await patch(editable, { lines: [{ description: "Inactive", accountId: account.id }] })).status, 400); });
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, account.id));
    await db.update(invoiceLine).set({ projectId: foreignJob.id }).where(eq(invoiceLine.invoiceId, editable));
    await unchanged(async () => { assert.equal((await patch(editable, {})).status, 400); assert.equal((await del(editable)).status, 400); });
    await db.update(invoiceLine).set({ projectId: null }).where(eq(invoiceLine.invoiceId, editable));
    const wide = await post({ ...basic, lines: [{ description: "Wide", unitPriceMinor: "2147483648" }] });
    assert.equal(wide.status, 201); assert.equal((await wide.json()).invoice.totalMinor, "2147483648");
    // Largest supported amount remains an exact safe numeric response.
    const maxDoc = await post({ ...basic, lines: [{ description: "Max", unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }] });
    assert.equal(maxDoc.status, 201); const maxId = (await maxDoc.json()).invoice.id;
    await db.update(invoice).set({ amountPaid: -Number.MAX_SAFE_INTEGER }).where(eq(invoice.id, maxId));
    await unchanged(async () => { assert.equal((await patch(maxId, { lines: [{ description: "Due overflow", unitPriceMinor: "1" }] })).status, 422);
      assert.equal((await ma.call("update_invoice", { invoiceId: maxId, lines: [{ description: "Due overflow", unitPriceMinor: "1" }] })).body.status, 422); });
    await db.update(invoice).set({ amountPaid: 0 }).where(eq(invoice.id, maxId));
    assert.equal((await del(maxId)).status, 200);
    // Credit sums use text/bigint, reject mixed currency/unsafe offsets; warnings have exact aliases.
    await db.update(invoice).set({ deletedAt: new Date() });
    await db.update(contact).set({ creditLimit: 1000 }).where(eq(contact.id, customer.id));
    const soft = await (await post(basic)).json(); assert.equal(soft.creditLimitWarning.exceededByMinor, "250");
    await unchanged(async () => { const response = await post({ ...basic, enforceCreditLimit: true }); assert.equal(response.status, 403);
      assert.equal((await response.json()).creditLimitWarning.projectedOutstandingMinor, "2500");
      assert.equal((await ma.call("create_invoice", { ...basic, enforceCreditLimit: true })).body.status, 403); });
    await unchanged(async () => { assert.equal((await post({ ...basic, currencyCode: "EUR" })).status, 422);
      assert.equal((await ma.call("create_invoice", { ...basic, currencyCode: "EUR" })).body.status, 422); });
    await db.insert(customerCredit).values({ organizationId: a.id, contactId: customer.id, originalAmount: 1000, amountRemaining: 1000, currencyCode: "USD", sourceType: "overpayment", date: "2026-10-01" });
    assert.equal((await (await post(basic)).json()).creditLimitWarning.currentOutstandingMinor, "250");
    await db.update(customerCredit).set({ currencyCode: "EUR" });
    await unchanged(async () => { assert.equal((await post(basic)).status, 422); assert.equal((await ma.call("create_invoice", basic)).body.status, 422); });
    await db.update(customerCredit).set({ currencyCode: "USD" });
    await db.execute(sql`update invoice set amount_due = 9007199254740992 where id = ${soft.invoice.id}`);
    await unchanged(async () => { assert.equal((await post(basic)).status, 422); });
    await db.update(contact).set({ creditLimit: null }).where(eq(contact.id, customer.id));
    // Fault injection proves rollback of numbering/header/line replacement and approval creation.
    await db.execute(sql`alter table invoice_line add constraint fixture_reject_line check (description <> 'ROLLBACK')`);
    await unchanged(async () => { assert.equal((await post({ ...basic, lines: [{ description: "ROLLBACK", unitPriceMinor: "1" }] })).status, 500); });
    const rollbackId = (await (await post(basic)).json()).invoice.id;
    await unchanged(async () => { assert.equal((await patch(rollbackId, { lines: [{ description: "ROLLBACK", unitPriceMinor: "1" }] })).status, 500);
      assert.equal((await ma.call("update_invoice", { invoiceId: rollbackId, lines: [{ description: "ROLLBACK", unitPriceMinor: "1" }] })).isError, true); });
    await db.execute(sql`alter table invoice_line drop constraint fixture_reject_line`);
    await db.execute(sql`alter table invoice add constraint fixture_reject_delete check (deleted_at is null) not valid`);
    await unchanged(async () => { assert.equal((await del(rollbackId)).status, 500);
      assert.equal((await ma.call("delete_invoice", { invoiceId: rollbackId })).isError, true); });
    await db.execute(sql`alter table invoice drop constraint fixture_reject_delete`);
    const [workflow] = await db.insert(approvalWorkflow).values({ organizationId: a.id, name: "Invoice approval", entityType: "invoice" }).returning();
    await db.insert(approvalWorkflowStep).values({ workflowId: workflow.id, stepOrder: 1, approverId: ownerMember.id });
    const pending = await (await post({ ...basic, submitForApproval: true })).json(); assert.equal(pending.invoice.status, "pending_approval");
    assert.ok(await db.query.approvalRequest.findFirst({ where: eq(approvalRequest.entityId, pending.invoice.id) }));
    assert.equal((await ma.call("create_invoice", { ...basic, submitForApproval: true })).body.invoice.status, "pending_approval");
    await unchanged(async () => { assert.equal((await del(pending.invoice.id)).status, 400);
      assert.equal((await ma.call("update_invoice", { invoiceId: pending.invoice.id, notes: "Blocked" })).body.status, 400); });
    await db.execute(sql`alter table approval_request add constraint fixture_reject_approval check (current_step_order <> 1) not valid`);
    await unchanged(async () => { assert.equal((await post({ ...basic, submitForApproval: true })).status, 500); });
    await db.execute(sql`alter table approval_request drop constraint fixture_reject_approval`);
    await db.update(approvalWorkflow).set({ isActive: false }).where(eq(approvalWorkflow.id, workflow.id));
    assert.equal((await (await post({ ...basic, submitForApproval: true })).json()).invoice.status, "draft");
    // Same-service concurrent creates serialize numbering; no duplicated first-sequence race.
    const parallel = await Promise.all(Array.from({ length: 3 }, () => ma.call("create_invoice", basic)));
    assert.ok(parallel.every(result => !result.isError)); assert.equal(new Set(parallel.map(result => result.body.invoice.invoiceNumber)).size, 3);
    const firstParallel = await Promise.all(Array.from({ length: 3 }, () => mb.call("create_invoice", { ...basic, contactId: foreignCustomer.id })));
    assert.ok(firstParallel.every(result => !result.isError));
    assert.deepEqual(firstParallel.map(result => result.body.invoice.invoiceNumber).sort(), ["INV-00001", "INV-00002", "INV-00003"]);
    // Default fixture is self-hosted/unlimited. A synthetic key enables only the
    // existing local plan evaluator; these invoice operations make no provider calls.
    process.env.STRIPE_SECRET_KEY = "sk_test_invoice_fixture_no_network";
    await db.update(subscription).set({ overrideInvoicesPerMonth: 0 }).where(eq(subscription.organizationId, a.id));
    await unchanged(async () => { assert.equal((await post(basic)).status, 403); assert.equal((await ma.call("create_invoice", basic)).body.status, 403); });
    await db.update(subscription).set({ overrideInvoicesPerMonth: 1000, overrideMultiCurrency: false }).where(eq(subscription.organizationId, a.id));
    await unchanged(async () => { assert.equal((await post({ ...basic, currencyCode: "EUR" })).status, 403);
      assert.equal((await ma.call("create_invoice", { ...basic, currencyCode: "EUR" })).body.status, 403); });
    process.env.STRIPE_SECRET_KEY = "";
    console.log("REST and MCP invoice writes verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
