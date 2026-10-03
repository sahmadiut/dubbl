// Runs only in bill-bulk.test.ts's disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, bill, billLine, periodLock, fiscalYear, numberSequence } from "../../lib/db/schema";
import { POST as IMPORT } from "../../app/api/v1/bulk/bills/import/route";
import { POST as PREVIEW } from "../../app/api/v1/bulk/bills/preview/route";
import { registerBillBulkTools } from "../../lib/mcp/tools/bill-bulk";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Bill bulk fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerBillBulkTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.filter(tool => ["import_bills", "preview_bill_import"].includes(tool.name)).length, 2);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "import_bills")!.inputSchema).includes("lineAmountMinor"));
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Bill bulk A", slug: "bba", defaultCurrency: "JPY" }, { name: "Bill bulk B", slug: "bbb" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "bb-owner@example.test" }, { email: "bb-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_bb_a", b: "dk_bb_b", viewer: "dk_bb_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bb" });
  const [supplier, foreignSupplier, deleted] = await db.insert(contact).values([{ organizationId: a.id, name: "Supplier", type: "supplier", currencyCode: "KWD" },
    { organizationId: b.id, name: "Foreign", type: "supplier" }, { organizationId: a.id, name: "Deleted", deletedAt: new Date() }]).returning();
  const [expense, foreignExpense, inactive] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "500", name: "Expense", type: "expense" },
    { organizationId: b.id, code: "600", name: "Foreign", type: "expense" }, { organizationId: a.id, code: "700", name: "Inactive", type: "expense", isActive: false }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/bulk/bills", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body),
  });
  const basic = { contactName: "Supplier", issueDate: "2026-06-01", dueDate: "2026-07-01", lineDescription: "Service", lineAccountCode: "500" };
  const payload = (rows: unknown[] = [{ ...basic, lineUnitPriceMinor: "1250" }]) => ({ fileName: "fixture.csv", rows });
  const tables = ["bill", "bill_line", "number_sequence", "bulk_import_job", "audit_log", "journal_entry", "journal_line", "inventory_movement", "payment", "payment_allocation"];
  const snapshot = async (excludeJobHistory = false) => {
    const result = [];
    for (const table of tables) if (!excludeJobHistory || !["bulk_import_job", "audit_log"].includes(table))
      result.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    return result;
  };
  const unchanged = async (op: () => Promise<unknown>, excludeJobs = false) => { const before = await snapshot(excludeJobs); await op(); assert.deepEqual(await snapshot(excludeJobs), before); };
  const imported = async (row: Record<string, unknown>, transport: "rest" | "mcp" = "rest") => {
    const before = new Set((await db.select({ id: bill.id }).from(bill)).map(value => value.id));
    const job = transport === "rest" ? await (async () => {
      const response = await IMPORT(req(payload([row]))); assert.equal(response.status, 201); return (await response.json()).job;
    })() : (await ma.call("import_bills", payload([row]))).body.job;
    assert.equal(job.processedRows, 1, JSON.stringify(job));
    return (await db.select().from(bill)).find(value => !before.has(value.id))!;
  };
  const fault = async (table: "bill_line" | "audit_log", op: () => Promise<unknown>) => {
    await db.execute(sql.raw(`alter table ${table} add constraint bb_fault check (false) not valid`));
    try { await op(); } finally { await db.execute(sql.raw(`alter table ${table} drop constraint bb_fault`)); }
  };
  try {
    const template = (await ma.call("get_import_template", { source: "custom", entityType: "bills" })).body;
    assert.ok(template.columns.some((column: { field: string }) => column.field === "lineUnitPriceMinor"));
    for (const price of [{ lineUnitPrice: 12.5 }, { lineUnitPrice: "12.50" }, { lineUnitPriceExact: "12.50" }, { lineUnitPriceMinor: "1250" },
      { lineUnitPrice: 12.5, lineUnitPriceExact: "12.50", lineUnitPriceMinor: "1250" }]) {
      const data = { ...basic, ...price, lineQuantity: "1.50" };
      await unchanged(async () => {
        const response = await PREVIEW(req({ rows: [data] })); assert.equal(response.status, 200);
        const dto = (await response.json()).preview[0]; assert.equal(dto.valid, true); assert.equal(dto.amount, 1875); assert.equal(dto.amountMinor, "1875");
        assert.equal((await ma.call("preview_bill_import", { rows: [data] })).body.preview[0].unitPriceMinor, "1250");
      });
      for (const transport of ["rest", "mcp"] as const) {
        const created = await imported(data, transport); assert.equal(created.total, 1875); assert.equal(created.currencyCode, "USD");
        assert.equal(created.contactId, supplier.id); assert.equal(created.status, "draft"); assert.equal(created.journalEntryId, null);
        const [line] = await db.select().from(billLine).where(eq(billLine.billId, created.id));
        assert.equal(line.accountId, expense.id); assert.equal(line.quantity, 150); assert.equal(line.unitPrice, 1250);
        const dto = (await ma.call("get_bill", { billId: created.id })).body.bill;
        assert.equal(dto.totalMinor, "1875"); assert.equal(dto.lines[0].amountMinor, "1875");
      }
    }
    for (const [currencyCode, expected] of [["JPY", 13], ["IRR", 13], ["KWD", 12500]] as const)
      for (const transport of ["rest", "mcp"] as const) assert.equal((await imported({ ...basic, currencyCode, lineUnitPriceExact: "12.50" }, transport)).total, expected);
    assert.equal((await imported({ ...basic, lineUnitPriceMinor: "9007199254740991" })).total, Number.MAX_SAFE_INTEGER);
    assert.equal((await imported({ ...basic, lineUnitPriceMinor: "2147483648" }, "mcp")).total, 2147483648);
    assert.equal((await imported({ ...basic, lineQuantity: 3, lineUnitPriceExact: "0.005" })).total, 2);
    assert.equal((await imported({ ...basic, lineUnitPriceExact: "-0.015" }, "mcp")).total, -1);
    for (const transport of ["rest", "mcp"] as const) {
      assert.equal((await imported({ ...basic, lineUnitPrice: 1, lineAmount: "$1,234.56", lineAmountExact: "1234.56", lineAmountMinor: "123456" }, transport)).total, 123456);
      assert.equal((await imported({ ...basic, lineAmount: "1.234,56" }, transport)).total, 123456);
      assert.equal((await imported({ ...basic, lineAmount: "(0.015)" }, transport)).total, -2);
      assert.equal((await imported({ ...basic, lineAmountMinor: "0", lineUnitPrice: 12.5 }, transport)).total, 0);
    }
    const flat = { ...basic, billNumber: "External", issueDate: "6/1/2026", dueDate: "7/1/2026", lineUnitPrice: "12.50" };
    const grouped = { ...payload([flat, flat]), source: "quickbooks" };
    const groupPreview = await ma.call("preview_bill_import", grouped); assert.equal(groupPreview.body.totalCount, 2); assert.equal(groupPreview.body.validCount, 2);
    const groupJob = (await (await IMPORT(req(grouped))).json()).job; assert.equal(groupJob.totalRows, 2); assert.equal(groupJob.processedRows, 1);
    const groupedBill = (await db.select().from(bill).orderBy(sql`${bill.createdAt} desc`))[0];
    assert.equal(groupedBill.total, 2500); assert.notEqual(groupedBill.billNumber, "External");
    assert.equal((await db.select().from(billLine).where(eq(billLine.billId, groupedBill.id))).length, 2);
    assert.equal((await ma.call("import_bills", grouped)).body.job.processedRows, 1); // Repeat deliberately creates another bill.
    assert.equal((await ma.call("import_bills", payload([basic, { ...basic, billNumber: "_auto_0" }, basic]))).body.job.processedRows, 3);
    for (const bad of [{ lineUnitPriceMinor: "9007199254740992" }, { lineUnitPriceExact: "1e3" }, { lineUnitPriceMinor: "01" }, { lineUnitPrice: "12junk" },
      { lineUnitPrice: 12.5, lineUnitPriceExact: "12.51" }, { lineUnitPriceMinor: "9007199254740991", lineQuantity: 2, lineAmountMinor: "0" },
      { lineQuantity: "21474836.48" }, { lineAmount: "12junk" }, { lineAmount: "12.50", lineAmountExact: "12.51" },
      { lineAmountExact: "12.50", lineAmountMinor: "1251" }, { issueDate: "2026-02-30" }]) {
      await unchanged(async () => {
        assert.ok([400, 422].includes((await IMPORT(req(payload([basic, { ...basic, ...bad }])))).status));
        assert.equal((await ma.call("import_bills", payload([basic, { ...basic, ...bad }]))).isError, true);
      });
    }
    for (const rows of [[{ ...flat, currencyCode: "USD" }, { ...flat, currencyCode: "JPY" }],
      [{ ...flat, lineAmountMinor: "9007199254740991" }, { ...flat, lineAmountMinor: "1" }]]) {
      await unchanged(async () => { assert.ok([400, 422].includes((await IMPORT(req(payload(rows)))).status)); assert.equal((await ma.call("import_bills", payload(rows))).isError, true); });
      assert.equal((await (await PREVIEW(req({ rows }))).json()).validCount, 0);
    }
    await unchanged(async () => {
      assert.equal((await IMPORT(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }))).status, 400);
      assert.equal((await IMPORT(req(payload(), keys.viewer))).status, 403); assert.equal((await ro.call("import_bills", payload())).body.status, 403);
      assert.equal((await IMPORT(req(payload(), "dk_invalid"))).status, 401);
      assert.equal((await PREVIEW(req({ rows: [basic] }, "dk_invalid"))).status, 401);
      assert.equal((await PREVIEW(req({ rows: [basic] }, keys.viewer))).status, 200);
      assert.equal((await ro.call("preview_bill_import", { rows: [basic] })).isError, false);
      assert.equal((await PREVIEW(req({ rows: [{ ...basic, lineUnitPrice: 9007199254740992 }] }))).status, 422);
      assert.equal((await ma.call("preview_bill_import", { rows: [{ ...basic, lineUnitPrice: 9007199254740992 }] })).isError, true);
    });
    for (const bad of [{ contactName: foreignSupplier.name }, { contactName: deleted.name }, { contactName: "%" },
      { lineAccountCode: foreignExpense.code }, { lineAccountCode: inactive.code }, { lineAccountCode: "missing" }]) {
      const data = { ...basic, ...bad };
      await unchanged(async () => {
        assert.equal((await (await IMPORT(req(payload([data])))).json()).job.processedRows, 0);
        assert.equal((await ma.call("import_bills", payload([data]))).body.job.processedRows, 0);
        assert.equal((await ma.call("preview_bill_import", { rows: [data] })).body.validCount, 0);
      }, true);
    }
    await unchanged(async () => { assert.equal((await mb.call("import_bills", payload())).body.job.processedRows, 0); }, true);
    assert.equal((await imported({ ...basic, contactName: " supplier ", lineAccountCode: " 500 " })).contactId, supplier.id);
    await db.insert(contact).values({ organizationId: a.id, name: "supplier" });
    await unchanged(async () => assert.equal((await ma.call("import_bills", payload())).body.job.processedRows, 0), true);
    await db.delete(contact).where(sql`${contact.organizationId} = ${a.id} and ${contact.name} = 'supplier'`);
    for (const table of ["bill_line", "audit_log"] as const) await fault(table, async () => {
      const auditBefore = (await db.execute(sql`select count(*)::text as count from audit_log where action = 'create' and entity_type = 'bill'`)).rows;
      await unchanged(async () => {
        const job = (await (await IMPORT(req(payload()))).json()).job; assert.equal(job.processedRows, 0); assert.equal(job.errorRows, 1); assert.equal(job.status, "failed");
      }, true);
      assert.deepEqual((await db.execute(sql`select count(*)::text as count from audit_log where action = 'create' and entity_type = 'bill'`)).rows, auditBefore);
    });
    const partial = (await ma.call("import_bills", payload([basic, { ...basic, contactName: "Foreign" }]))).body.job;
    assert.equal(partial.processedRows, 1); assert.equal(partial.errorRows, 1); assert.equal(partial.status, "completed");
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: basic.issueDate, advisorLockDate: basic.issueDate });
    await unchanged(async () => assert.equal((await (await IMPORT(req(payload()))).json()).job.processedRows, 0), true);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true });
    await unchanged(async () => assert.equal((await ma.call("import_bills", payload())).body.job.processedRows, 0), true);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    const beforeNumbers = (await db.select().from(numberSequence).where(eq(numberSequence.organizationId, a.id)))[0].lastNumber;
    const race = await Promise.all([IMPORT(req(payload())), ma.call("import_bills", payload())]);
    assert.equal((await (race[0] as Response).json()).job.processedRows, 1); assert.equal((race[1] as { body: { job: { processedRows: number } } }).body.job.processedRows, 1);
    assert.equal((await db.select().from(numberSequence).where(eq(numberSequence.organizationId, a.id)))[0].lastNumber, beforeNumbers + 2);
    const allBills = await db.select().from(bill).where(eq(bill.organizationId, a.id));
    assert.equal(new Set(allBills.map(value => value.billNumber)).size, allBills.length);
    assert.ok(allBills.every(value => value.billNumber.startsWith("BILL-") && value.taxTotal === 0 && value.amountPaid === 0 && value.amountDue === value.total));
    await db.insert(bill).values({ organizationId: a.id, contactId: supplier.id, billNumber: "BILL-00999", issueDate: basic.issueDate, dueDate: basic.dueDate });
    assert.equal((await imported(basic)).billNumber, "BILL-01000");
    const sequence = (await db.select().from(numberSequence).where(eq(numberSequence.organizationId, a.id)))[0];
    await db.update(numberSequence).set({ lastNumber: 2147483647 }).where(eq(numberSequence.id, sequence.id));
    await unchanged(async () => assert.equal((await ma.call("import_bills", payload())).body.job.processedRows, 0), true);
    for (const table of ["journal_entry", "journal_line", "inventory_movement", "payment", "payment_allocation"])
      assert.equal((await db.execute(sql.raw(`select count(*)::text as count from ${table}`))).rows[0].count, "0");
    console.log("REST and MCP bulk bills verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
try { await run(); } finally { await (db.$client as unknown as { end: () => Promise<void> }).end(); }
