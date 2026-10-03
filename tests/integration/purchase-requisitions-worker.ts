// Runs only in purchase-requisitions.test.ts's migrated, randomly named disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate,
  purchaseRequisition, purchaseRequisitionLine, purchaseOrder, purchaseOrderLine, periodLock, fiscalYear, numberSequence } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/purchase-requisitions/route";
import { GET as detail, PUT as update, DELETE as remove } from "../../app/api/v1/purchase-requisitions/[id]/route";
import { POST as approve } from "../../app/api/v1/purchase-requisitions/[id]/approve/route";
import { POST as reject } from "../../app/api/v1/purchase-requisitions/[id]/reject/route";
import { POST as convert } from "../../app/api/v1/purchase-requisitions/[id]/convert/route";
import { POST as createPO } from "../../app/api/v1/purchase-orders/route";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Requisition fixture", version: "1.0.0" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["create_purchase_requisition", "list_purchase_requisitions", "get_purchase_requisition",
    "update_purchase_requisition", "delete_purchase_requisition", "submit_purchase_requisition", "approve_purchase_requisition",
    "reject_purchase_requisition", "convert_purchase_requisition"]) {
    assert.equal(tools.filter(tool => tool.name === name).length, 1, `Unique registration ${name}`);
  }
  assert.match(JSON.stringify(tools.find(tool => tool.name === "create_purchase_requisition")!.inputSchema), /unitPriceExact/);
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async close() { await client.close(); await server.close(); },
  };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "PO A", slug: "po-a" }, { name: "PO B", slug: "po-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "po-owner@example.test" }, { email: "po-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_po_a", b: "dk_po_b", viewer: "dk_po_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_po" });
  const [supplier, foreignSupplier] = await db.insert(contact).values([{ organizationId: a.id, name: "A", type: "supplier" },
    { organizationId: b.id, name: "B", type: "supplier" }]).returning();
  const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, name: "Expense", code: "5000", type: "expense" },
    { organizationId: b.id, name: "Expense", code: "5000", type: "expense" }]).returning();
  await db.insert(chartAccount).values({ organizationId: a.id, name: "Accounts payable", code: "2100", type: "liability" });
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Normal", rate: 1000 },
    { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/purchase-requisitions${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const post = (body: unknown, key = keys.a) => create(request("POST", body, key));
  const put = (id: string, body: unknown, key = keys.a) => update(request("PUT", body, key), params(id));
  const del = (id: string, key = keys.a) => remove(request("DELETE", undefined, key), params(id));
  const approved = (id: string, key = keys.a) => approve(request("POST", undefined, key), params(id));
  const rejected = (id: string, body: unknown = {}, key = keys.a) => reject(request("POST", body, key), params(id));
  const converted = (id: string, key = keys.a) => convert(request("POST", undefined, key), params(id));
  const basic = { contactId: supplier.id, requestDate: "2026-10-03", lines: [{ description: "Item", unitPrice: 12.5 }] };
  const draft = async (patch: Record<string, unknown> = {}) => {
    const response = await post({ ...basic, ...patch }); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    return (await response.json()).requisition;
  };
  const lines = (id: string) => db.select().from(purchaseRequisitionLine).where(eq(purchaseRequisitionLine.requisitionId, id)).orderBy(purchaseRequisitionLine.sortOrder);
  const qualify = async (id: string) => {
    assert.equal((await put(id, { status: "submitted" })).status, 200);
    assert.equal((await approved(id)).status, 200);
  };
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_order i) as orders,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_order_line i) as order_lines,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_requisition i) as requisitions,
    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from purchase_requisition_line i) as requisition_lines,

    (select coalesce(jsonb_agg(to_jsonb(i)::text order by i.id),'[]'::jsonb) from number_sequence i) as numbering,
    (select count(*)::text from audit_log) as audits, (select count(*)::text from journal_entry) as journals,
    (select count(*)::text from inventory_movement) as stock, (select count(*)::text from document_email_log) as emails`)).rows;
  const unchanged = async (fn: () => Promise<void>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  try {
    let editable = "";
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" },
      { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const input = { ...basic, lines: [{ description: "Alias", ...price }] };
      const row = await draft({ lines: input.lines }), mc = await ma.call("create_purchase_requisition", input);
      assert.equal(mc.isError, false); assert.equal(row.total, 1250); assert.equal(row.totalMinor, "1250");
      assert.equal(row.organizationId, a.id); assert.equal(mc.body.requisition.totalMinor, row.totalMinor);
      assert.equal((await put(row.id, { notes: "REST edit" })).status, 200);
      assert.equal((await ma.call("update_purchase_requisition", { requisitionId: row.id, reference: "MCP edit" })).body.requisition.totalMinor, "1250");
      const r = await (await detail(request("GET"), params(row.id))).json();
      assert.equal(r.lines[0].unitPriceMinor, "1250"); assert.equal(r.lines[0].amountMinor, "1250"); assert.equal(r.lines[0].quantity, 100);
      assert.equal((await ma.call("get_purchase_requisition", { requisitionId: row.id })).body.requisition.totalMinor, "1250");
      const listed = await (await list(request("GET", undefined, keys.a, "?limit=100"))).json();
      assert.ok(listed.data.some((value: { id: string; totalMinor: string }) => value.id === row.id && value.totalMinor === "1250"));
      assert.equal(listed.pagination.page, 1);
      const ml = await ma.call("list_purchase_requisitions", { limit: 100 });
      assert.ok(ml.body.requisitions.some((value: { id: string; lines: { amountMinor: string }[] }) => value.id === row.id && value.lines[0].amountMinor === "1250"));
      assert.equal((await ma.call("submit_purchase_requisition", { requisitionId: mc.body.requisition.id })).body.requisition.status, "submitted");
      assert.equal((await ma.call("approve_purchase_requisition", { requisitionId: mc.body.requisition.id })).body.requisition.status, "approved");
      const mpo = await ma.call("convert_purchase_requisition", { requisitionId: mc.body.requisition.id });
      assert.equal(mpo.isError, false); assert.equal(mpo.body.purchaseOrder.totalMinor, "1250");
      await qualify(row.id); const po = await converted(row.id); assert.equal(po.status, 201);
      assert.equal((await po.json()).purchaseOrder.totalMinor, "1250");
      await unchanged(async () => {
        assert.equal((await converted(row.id)).status, 400);
        assert.equal((await ma.call("convert_purchase_requisition", { requisitionId: row.id })).body.status, 400);
        assert.equal((await put(row.id, { notes: "Cannot rewrite approved data" })).status, 400);
        assert.equal((await del(row.id)).status, 400);
      });
      editable = mc.body.requisition.id;
    }
    editable = (await draft()).id;
    for (const amount of ["2147483648", String(Number.MAX_SAFE_INTEGER), "-1250"]) {
      const input = { ...basic, lines: [{ description: "Range", unitPriceMinor: amount }] };
      const row = await draft({ lines: input.lines }); assert.equal(row.totalMinor, amount);
      const mc = await ma.call("create_purchase_requisition", input); assert.equal(mc.body.requisition.totalMinor, amount);
      assert.equal((await ma.call("get_purchase_requisition", { requisitionId: row.id })).body.requisition.totalMinor, amount);
      assert.equal((await put(row.id, { notes: "Range" })).status, 200);
      await qualify(row.id); const result = await converted(row.id); assert.equal(result.status, 201);
      assert.equal((await result.json()).purchaseOrder.totalMinor, amount);
      await ma.call("submit_purchase_requisition", { requisitionId: mc.body.requisition.id });
      await ma.call("approve_purchase_requisition", { requisitionId: mc.body.requisition.id });
      assert.equal((await ma.call("convert_purchase_requisition", { requisitionId: mc.body.requisition.id })).body.purchaseOrder.totalMinor, amount);
    }
    for (const [currencyCode, unitPriceExact] of [["JPY", "1250"], ["KWD", "1.250"]]) {
      const row = await draft({ currencyCode, lines: [{ description: "Currency", unitPriceExact }] });
      assert.equal(row.totalMinor, "1250"); await qualify(row.id);
      const po = (await ma.call("convert_purchase_requisition", { requisitionId: row.id })).body.purchaseOrder;
      assert.equal(po.currencyCode, currencyCode); assert.equal(po.totalMinor, "1250");
    }
    // Saved subminor extended amounts survive conversion; tax reference never charges VAT.
    const subminor = await draft({ lines: [{ description: "Extended", quantity: 3, unitPriceExact: "0.005", accountId: account.id, taxRateId: tax.id }] });
    assert.equal(subminor.totalMinor, "2"); assert.equal(subminor.taxTotalMinor, "0"); await qualify(subminor.id);
    const copied = (await (await converted(subminor.id)).json()).purchaseOrder;
    const [copiedLine] = await db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, copied.id));
    assert.equal(copiedLine.amount, 2); assert.equal(copiedLine.unitPrice, 1); assert.equal(copiedLine.quantity, 300);
    assert.equal(copiedLine.taxRateId, tax.id); assert.equal(copiedLine.taxAmount, 0); assert.equal(copiedLine.accountId, account.id);
    const optional = await draft({ contactId: null }); await qualify(optional.id);
    await unchanged(async () => { assert.equal((await converted(optional.id)).status, 400); });
    const attach = await draft({ contactId: null });
    assert.equal((await ma.call("update_purchase_requisition", { requisitionId: attach.id, contactId: supplier.id, requiredDate: "2026-11-01" })).isError, false);
    await qualify(attach.id); const attachedPO = (await (await converted(attach.id)).json()).purchaseOrder;
    assert.equal(attachedPO.deliveryDate, "2026-11-01");
    const refusal = await draft(); assert.equal((await put(refusal.id, { status: "submitted" })).status, 200);
    const rr = await rejected(refusal.id, { reason: "Budget" }); assert.equal(rr.status, 200); assert.equal((await rr.json()).rejectionReason, "Budget");
    const mr = await draft(); await ma.call("submit_purchase_requisition", { requisitionId: mr.id });
    assert.equal((await ma.call("reject_purchase_requisition", { requisitionId: mr.id, reason: "Budget" })).body.requisition.status, "rejected");
    const deleted = await draft(); assert.equal((await del(deleted.id)).status, 200);
    assert.equal((await detail(request("GET"), params(deleted.id))).status, 404); assert.equal((await lines(deleted.id)).length, 1);
    const md = await draft(); assert.equal((await ma.call("delete_purchase_requisition", { requisitionId: md.id })).body.success, true);
    assert.equal((await ma.call("get_purchase_requisition", { requisitionId: md.id })).body.status, 404);
    // Isolation and actual API-key/custom-role resolution on every operation.
    const foreign = (await mb.call("create_purchase_requisition", { ...basic, contactId: foreignSupplier.id })).body.requisition;
    for (const [route, tool] of [[approved, "approve_purchase_requisition"], [converted, "convert_purchase_requisition"],
      [(id: string, key: string) => rejected(id, {}, key), "reject_purchase_requisition"],
      [(id: string, key: string) => put(id, {}, key), "update_purchase_requisition"], [del, "delete_purchase_requisition"]] as const) {
      await unchanged(async () => {
        assert.equal((await route(foreign.id, keys.a)).status, 404);
        assert.equal((await route(editable, keys.viewer)).status, 403); assert.equal((await route(editable, "dk_invalid")).status, 401);
        assert.equal((await mb.call(tool, { requisitionId: editable })).body.status, 404);
        assert.equal((await ro.call(tool, { requisitionId: editable })).body.status, 403);
      });
    }
    await unchanged(async () => {
      assert.equal((await post(basic, keys.viewer)).status, 403); assert.equal((await post(basic, "dk_invalid")).status, 401);
      assert.equal((await ro.call("create_purchase_requisition", basic)).body.status, 403);
      assert.equal((await put(editable, { status: "submitted" }, keys.viewer)).status, 403);
      assert.equal((await ro.call("submit_purchase_requisition", { requisitionId: editable })).body.status, 403);
      assert.equal((await mb.call("submit_purchase_requisition", { requisitionId: editable })).body.status, 404);
      assert.equal((await detail(request("GET"), params(foreign.id))).status, 404);
      assert.equal((await mb.call("get_purchase_requisition", { requisitionId: editable })).body.status, 404);
      assert.equal((await list(request("GET", undefined, "dk_invalid"))).status, 401);
      assert.equal((await post({ ...basic, contactId: foreignSupplier.id })).status, 400);
      assert.equal((await put(editable, { contactId: foreignSupplier.id })).status, 400);
      assert.equal((await ma.call("create_purchase_requisition", { ...basic, contactId: foreignSupplier.id })).isError, true);
    });
    assert.ok((await (await list(request("GET", undefined, keys.b))).json()).data.every((row: { organizationId: string }) => row.organizationId === b.id));
    assert.equal((await ro.call("list_purchase_requisitions", { limit: 100 })).isError, false);
    for (const [field, id] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id]] as const) await unchanged(async () => {
      const input = { ...basic, lines: [{ description: "Foreign", [field]: id }] };
      assert.equal((await post(input)).status, 400); assert.equal((await ma.call("create_purchase_requisition", input)).isError, true);
    });
    await db.update(purchaseRequisitionLine).set({ accountId: foreignAccount.id }).where(eq(purchaseRequisitionLine.requisitionId, editable));
    await unchanged(async () => {
      assert.equal((await detail(request("GET"), params(editable))).status, 400);
      assert.equal((await ma.call("list_purchase_requisitions", { limit: 100 })).isError, true);
      assert.equal((await put(editable, {})).status, 400); assert.equal((await del(editable)).status, 400);
    });
    await db.update(purchaseRequisitionLine).set({ accountId: null }).where(eq(purchaseRequisitionLine.requisitionId, editable));
    await db.update(purchaseRequisition).set({ contactId: foreignSupplier.id }).where(eq(purchaseRequisition.id, editable));
    await unchanged(async () => { assert.equal((await list(request("GET", undefined, keys.a, "?limit=100"))).status, 400); });
    await db.update(purchaseRequisition).set({ contactId: supplier.id }).where(eq(purchaseRequisition.id, editable));
    // Failed values never change business rows, sequences or audits.
    for (const invalidLines of [[{ description: "Unsafe", unitPriceMinor: "9007199254740992" }],
      [{ description: "Product", unitPriceMinor: String(Number.MAX_SAFE_INTEGER), quantity: 2 }],
      [{ description: "Sum", unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }, { description: "Sum", unitPriceMinor: "1" }]]) await unchanged(async () => {
      assert.equal((await post({ ...basic, lines: invalidLines })).status, 422);
      assert.equal((await ma.call("create_purchase_requisition", { ...basic, lines: invalidLines })).body.status, 422);
    });
    for (const values of [{ unitPrice: 12.5, unitPriceMinor: "12" }, { unitPrice: 12.5, unitPriceExact: "12.51" },
      { unitPriceMinor: "01" }, { unitPriceMinor: "1e3" }, { unitPriceExact: "۱۲" }, { quantity: 21474836.48 }]) await unchanged(async () => {
      assert.equal((await post({ ...basic, lines: [{ description: "Invalid", ...values }] })).status, 400);
      assert.equal((await ma.call("create_purchase_requisition", { ...basic, lines: [{ description: "Invalid", ...values }] })).isError, true);
    });
    await unchanged(async () => {
      assert.equal((await post({ ...basic, requestDate: "2026-02-30" })).status, 400);
      assert.equal((await put(editable, { requiredDate: "2026-02-30" })).status, 400);
      assert.equal((await put(editable, { status: "approved" })).status, 400);
      assert.equal((await approved(editable)).status, 400); assert.equal((await converted(editable)).status, 400);
      const bad = new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
      assert.equal((await create(bad)).status, 400);
    });
    // Strict request-date and generated PO-date locks, including closed fiscal years.
    const forConversion = await draft(); await qualify(forConversion.id);
    await db.update(purchaseRequisitionLine).set({ taxRateId: foreignTax.id }).where(eq(purchaseRequisitionLine.requisitionId, forConversion.id));
    await unchanged(async () => {
      assert.equal((await converted(forConversion.id)).status, 400);
      assert.equal((await ma.call("convert_purchase_requisition", { requisitionId: forConversion.id })).isError, true);
    });
    await db.update(purchaseRequisitionLine).set({ taxRateId: null }).where(eq(purchaseRequisitionLine.requisitionId, forConversion.id));
    const [foreignPO] = await db.insert(purchaseOrder).values({ organizationId: b.id, contactId: foreignSupplier.id,
      poNumber: "PO-00100", issueDate: "2026-10-03" }).returning();
    await db.update(purchaseRequisition).set({ status: "converted", convertedPoId: foreignPO.id }).where(eq(purchaseRequisition.id, editable));
    await unchanged(async () => {
      assert.equal((await detail(request("GET"), params(editable))).status, 400);
      assert.equal((await ma.call("get_purchase_requisition", { requisitionId: editable })).isError, true);
      assert.equal((await del(editable)).status, 400);
    });
    await db.update(purchaseRequisition).set({ status: "draft", convertedPoId: null }).where(eq(purchaseRequisition.id, editable));
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-03" }).returning();
    await unchanged(async () => {
      assert.equal((await post(basic)).status, 422); assert.equal((await put(editable, {})).status, 422);
      assert.equal((await del(editable)).status, 422); assert.equal((await approved(forConversion.id)).status, 422);
      assert.equal((await rejected(forConversion.id)).status, 422); assert.equal((await converted(forConversion.id)).status, 422);
      assert.equal((await ma.call("submit_purchase_requisition", { requisitionId: editable })).body.status, 422);
    });
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    await unchanged(async () => { assert.equal((await post(basic)).status, 422); assert.equal((await ma.call("create_purchase_requisition", basic)).body.status, 422); });
    await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    const today = new Date().toISOString().slice(0, 10);
    const [poLock] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "PO date", startDate: today, endDate: today, isClosed: true }).returning();
    const older = await draft({ requestDate: "2025-01-01" }); await qualify(older.id);
    await unchanged(async () => { assert.equal((await converted(older.id)).status, 422); });
    await db.delete(fiscalYear).where(eq(fiscalYear.id, poLock.id));
    // Unsafe SQL history cannot be silently overwritten or serialized, even with offsetting totals.
    await db.execute(sql`update purchase_requisition_line set unit_price = 9007199254740992 where requisition_id = ${editable}`);
    await unchanged(async () => {
      assert.equal((await detail(request("GET"), params(editable))).status, 422);
      assert.equal((await ma.call("get_purchase_requisition", { requisitionId: editable })).body.status, 422);
      assert.equal((await put(editable, {})).status, 422); assert.equal((await del(editable)).status, 422);
      assert.equal((await list(request("GET", undefined, keys.a, "?limit=100"))).status, 422);
    });
    await db.execute(sql`update purchase_requisition_line set unit_price = 1250 where requisition_id = ${editable}`);
    await db.update(purchaseRequisition).set({ total: 1251 }).where(eq(purchaseRequisition.id, editable));
    await unchanged(async () => { assert.equal((await put(editable, {})).status, 400); assert.equal((await ma.call("submit_purchase_requisition", { requisitionId: editable })).isError, true); });
    await db.update(purchaseRequisition).set({ total: 1250 }).where(eq(purchaseRequisition.id, editable));
    await db.update(purchaseRequisitionLine).set({ taxAmount: 1 }).where(eq(purchaseRequisitionLine.requisitionId, editable));
    await unchanged(async () => { assert.equal((await put(editable, {})).status, 400); });
    await db.update(purchaseRequisitionLine).set({ taxAmount: 0 }).where(eq(purchaseRequisitionLine.requisitionId, editable));
    // Inject DB failures at independent write stages and prove complete transaction rollback.
    await db.execute(sql`alter table purchase_requisition_line add constraint fixture_req_line check (description <> 'ROLLBACK')`);
    await unchanged(async () => { assert.equal((await post({ ...basic, lines: [{ description: "ROLLBACK" }] })).status, 500);
      assert.equal((await ma.call("create_purchase_requisition", { ...basic, lines: [{ description: "ROLLBACK" }] })).isError, true); });
    await db.execute(sql`alter table purchase_requisition_line drop constraint fixture_req_line`);
    for (const statement of [sql`alter table purchase_order add constraint fixture_req_failure check (false) not valid`,
      sql`alter table purchase_order_line add constraint fixture_req_failure check (false) not valid`,
      sql`alter table purchase_requisition add constraint fixture_req_failure check (status <> 'converted') not valid`]) {
      await db.execute(statement);
      await unchanged(async () => { assert.equal((await converted(forConversion.id)).status, 500);
        assert.equal((await ma.call("convert_purchase_requisition", { requisitionId: forConversion.id })).isError, true); });
      await db.execute(sql`alter table purchase_order_line drop constraint if exists fixture_req_failure`);
      await db.execute(sql`alter table purchase_order drop constraint if exists fixture_req_failure`);
      await db.execute(sql`alter table purchase_requisition drop constraint if exists fixture_req_failure`);
    }
    const awaiting = await draft(); await put(awaiting.id, { status: "submitted" });
    await db.execute(sql`alter table audit_log add constraint fixture_req_audit check (entity_type <> 'purchase_requisition') not valid`);
    await unchanged(async () => {
      assert.equal((await post(basic)).status, 500); assert.equal((await put(editable, { notes: "Audit failure" })).status, 500);
      assert.equal((await del(editable)).status, 500); assert.equal((await put(editable, { status: "submitted" })).status, 500);
      assert.equal((await approved(awaiting.id)).status, 500); assert.equal((await rejected(awaiting.id)).status, 500);
      assert.equal((await converted(forConversion.id)).status, 500);
      assert.equal((await ma.call("approve_purchase_requisition", { requisitionId: awaiting.id })).isError, true);
    });
    await db.execute(sql`alter table audit_log drop constraint fixture_req_audit`);
    // Concurrent first numbering, approval/rejection, conversion and PO creation share locks.
    const [freshOrg] = await db.insert(organization).values({ name: "First sequence", slug: "req-first" }).returning();
    await db.insert(member).values({ organizationId: freshOrg.id, userId: owner.id, role: "owner" });
    const firstClient = await mcp({ ...ctx, organizationId: freshOrg.id });
    try {
      const first = await Promise.all(Array.from({ length: 4 }, () => firstClient.call("create_purchase_requisition", { ...basic, contactId: null })));
      assert.ok(first.every(result => !result.isError));
      assert.deepEqual(first.map(result => result.body.requisition.requisitionNumber).sort(), ["REQ-00001", "REQ-00002", "REQ-00003", "REQ-00004"]);
    } finally { await firstClient.close(); }
    const decisions = await Promise.all([approved(awaiting.id), rejected(awaiting.id)]);
    assert.deepEqual(decisions.map(result => result.status).sort(), [200, 400]);
    const concurrent = await draft(); await qualify(concurrent.id);
    const poInput = { contactId: supplier.id, issueDate: today, lines: [{ description: "Concurrent PO", unitPriceMinor: "1" }] };
    const conversions = await Promise.all([converted(concurrent.id), converted(concurrent.id), createPO(request("POST", poInput))]);
    assert.deepEqual(conversions.map(result => result.status).sort(), [201, 201, 400]);
    const orderRows = await db.select().from(purchaseOrder);
    assert.equal(new Set(orderRows.map(row => `${row.organizationId}:${row.poNumber}`)).size, orderRows.length);
    const [number] = await db.select().from(numberSequence).where(sql`${numberSequence.organizationId} = ${a.id} and ${numberSequence.entityType} = 'purchase_requisition'`);
    await db.update(numberSequence).set({ lastNumber: 2147483647 }).where(eq(numberSequence.id, number.id));
    await unchanged(async () => { assert.equal((await post(basic)).status, 400); });
    console.log("REST and MCP purchase requisitions verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
