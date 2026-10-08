import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, savedReport, contact, invoice, inventoryItem,
  expenseClaim, bankAccount, bankTransaction, bankStatementImport, payrollEmployee, payrollRun, payrollItem } from "../../lib/db/schema";
import { POST as runReport } from "../../app/api/v1/reports/run/route";
import { GET as list, POST as create } from "../../app/api/v1/reports/saved/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/reports/saved/[id]/route";
import { GET as exportReport } from "../../app/api/v1/reports/saved/[id]/export/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerCustomReportTools } from "../../lib/mcp/tools/custom-reports";
import { createInvoice } from "../../lib/api/invoice-writes";
import type { AuthContext } from "../../lib/api/auth-context";

const names = ["run_custom_report", "list_saved_reports", "get_saved_report", "create_saved_report", "update_saved_report", "delete_saved_report", "export_saved_report"];
async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Custom reports", version: "1" });
  if (all) registerAllTools(server, ctx); else registerCustomReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  for (const name of names) {
    const tool = (await client.listTools()).tools.find(tool => tool.name === name)!; assert.ok(tool);
    assert.match(tool.description!, /integer cents/);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    let body; try { body = JSON.parse(text); } catch { body = { error: text }; }
    return { isError: result.isError === true, body };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Report A", slug: "report-a" }, { name: "Report B", slug: "report-b" }]).returning();
  const [owner, denied, viewer] = await db.insert(users).values([{ email: "report-owner@example.test" }, { email: "report-denied@example.test" }, { email: "report-viewer@example.test" }]).returning();
  const [noRole, viewRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "No read", permissions: [] }, { organizationId: a.id, name: "Read", permissions: ["view:data"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, customRoleId: noRole.id }, { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 });
  const keys = { owner: "dk_report_owner", foreign: "dk_report_foreign", denied: "dk_report_denied", viewer: "dk_report_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "foreign" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : label === "viewer" ? viewer.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_report" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, permissions: [] }), view = await mcp({ ...ctx, permissions: ["view:data"] });
  const req = (method = "GET", body?: unknown, key = keys.owner) => new Request("http://fixture.test/api/v1/reports", {
    method, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["saved_report", "invoice", "invoice_line", "contact", "inventory_item", "expense_claim", "bank_transaction", "payroll_item", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    return result;
  };
  const body = async (response: Response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json(); };
  const [local, foreign] = await db.insert(contact).values([{ organizationId: a.id, name: 'Local,"label"\nline', creditLimit: 0, paymentTermsDays: 0, currencyCode: "USD" },
    { organizationId: b.id, name: "Foreign secret" }]).returning();
  const [item] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "ITEM", name: "Item", purchasePrice: 1250, salePrice: 0, quantityOnHand: 250, reorderPoint: 0, isActive: false }).returning();
  const [expense] = await db.insert(expenseClaim).values({ organizationId: a.id, submittedBy: owner.id, title: 'Travel,"expense"\nline', totalAmount: 1250,
    submittedAt: new Date("2024-02-29T23:59:59Z"), currencyCode: "KWD" }).returning();
  const [account, foreignAccount, deletedAccount] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Local", currencyCode: "JPY" },
    { organizationId: b.id, accountName: "Foreign secret" }, { organizationId: a.id, accountName: "Deleted secret", deletedAt: new Date() }]).returning();
  const [txn] = await db.insert(bankTransaction).values({ bankAccountId: account.id, description: "Bank", date: "2024-02-29", amount: -1250 }).returning();
  const [employee, foreignEmployee] = await db.insert(payrollEmployee).values([{ organizationId: a.id, name: "Employee", employeeNumber: "1", salary: 1250, startDate: "2024-01-01" },
    { organizationId: b.id, name: "Foreign payroll secret", employeeNumber: "2", salary: 1250, startDate: "2024-01-01" }]).returning();
  const [payRun, foreignRun, deletedRun] = await db.insert(payrollRun).values([{ organizationId: a.id, payPeriodStart: "2024-02-29", payPeriodEnd: "2024-03-01" },
    { organizationId: b.id, payPeriodStart: "2024-02-29", payPeriodEnd: "2024-03-01" }, { organizationId: a.id, payPeriodStart: "2024-02-29", payPeriodEnd: "2024-03-01", deletedAt: new Date() }]).returning();
  const [payItem] = await db.insert(payrollItem).values({ payrollRunId: payRun.id, employeeId: employee.id, grossAmount: 1250, taxAmount: 0, deductions: 250, netAmount: 1000, currency: "IRR" }).returning();
  // Foreign/deleted roots and malformed cross-org references never expose tenant data.
  await db.insert(payrollItem).values([{ payrollRunId: foreignRun.id, employeeId: foreignEmployee.id, grossAmount: 777, taxAmount: 0, netAmount: 777 },
    { payrollRunId: payRun.id, employeeId: foreignEmployee.id, grossAmount: 777, taxAmount: 0, netAmount: 777 },
    { payrollRunId: deletedRun.id, employeeId: employee.id, grossAmount: 777, taxAmount: 0, netAmount: 777 }]);
  for (const bankAccountId of [foreignAccount.id, deletedAccount.id]) await db.insert(bankTransaction).values({ bankAccountId, description: "Foreign secret", date: "2024-02-29", amount: 777 });
  const [badImport] = await db.insert(bankStatementImport).values({ organizationId: b.id, bankAccountId: account.id, format: "csv", fileName: "Foreign secret", contentHash: "bad" }).returning();
  await db.insert(bankTransaction).values({ bankAccountId: account.id, importId: badImport.id, description: "Foreign secret", date: "2024-02-29", amount: 777 });
  await db.insert(expenseClaim).values([{ organizationId: b.id, submittedBy: owner.id, title: "Foreign secret", totalAmount: 777 },
    { organizationId: a.id, submittedBy: owner.id, title: "Deleted secret", deletedAt: new Date(), totalAmount: 777 }]);
  await db.insert(inventoryItem).values([{ organizationId: b.id, code: "FOREIGN", name: "Foreign secret" }, { organizationId: a.id, code: "DELETED", name: "Deleted secret", deletedAt: new Date() }]);
  await db.insert(contact).values({ organizationId: a.id, name: "Deleted secret", deletedAt: new Date() });
  try {
    // Real public writer adapters preserve legacy decimal-price and exact minor clients.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }])
      await createInvoice(ctx, { contactId: local.id, currencyCode: "USD", issueDate: "2024-02-29", dueDate: "2024-03-01", lines: [{ description: "Client", ...price }] }, "rest");
    await db.insert(invoice).values({ organizationId: a.id, contactId: foreign.id, invoiceNumber: "CROSS", issueDate: "2024-01-01", dueDate: "2024-01-02", total: 777 });
    await db.insert(invoice).values([{ organizationId: b.id, contactId: foreign.id, invoiceNumber: "FOREIGN", issueDate: "2024-02-29", dueDate: "2024-03-01", total: 777 },
      { organizationId: a.id, contactId: local.id, invoiceNumber: "DELETED", issueDate: "2024-02-29", dueDate: "2024-03-01", total: 777, deletedAt: new Date() }]);
    const dateRange = { from: "2024-02-29", to: "2024-02-29" };
    const configs = [
      { dataSource: "invoices", columns: ["id", "contactName", "subtotal", "taxTotal", "total", "amountPaid", "amountDue", "currencyCode"], dateRange },
      { dataSource: "contacts", columns: ["name", "creditLimit", "paymentTermsDays", "currencyCode"], filters: [{ field: "creditLimitMinor", operator: "equals", value: "0" }] },
      { dataSource: "inventory", columns: ["name", "purchasePrice", "salePrice", "quantityOnHand", "isActive", "currencyCode"], filters: [{ field: "quantityOnHand", operator: "gte", value: "250" }, { field: "isActive", operator: "equals", value: "false" }] },
      { dataSource: "transactions", columns: ["description", "amount", "currencyCode"], dateRange, filters: [{ field: "amountMinor", operator: "lte", value: "-1250" }] },
      { dataSource: "expenses", columns: ["title", "totalAmount", "currencyCode", "submittedAt", "approvedAt"], dateRange, filters: [{ field: "title", operator: "contains", value: "TRAVEL" }] },
      { dataSource: "payroll", columns: ["employeeName", "grossAmount", "taxAmount", "deductions", "netAmount", "currencyCode"], dateRange },
    ];
    const ids: string[] = [];
    for (const config of configs) {
      const before = await snapshot();
      const result = await body(await runReport(req("POST", config)));
      assert.deepEqual((await ma.call("run_custom_report", config)).body, result);
      assert.equal(result.total, config.dataSource === "invoices" ? 2 : 1); assert.ok(!JSON.stringify(result).includes("secret"));
      for (const row of result.data) for (const [key, value] of Object.entries(row)) if (key.endsWith("Minor")) assert.equal(String(row[key.slice(0, -5)]), value);
      assert.deepEqual(await snapshot(), before);
      const saved = await body(await create(req("POST", { name: config.dataSource, description: "Literal", config })), 201); const id = saved.report.id; ids.push(id);
      const fetched = await body(await get(req(), params(id))); assert.deepEqual((await ma.call("get_saved_report", { id })).body, fetched);
      assert.deepEqual(fetched, saved);
      const exported = await exportReport(req(), params(id)); assert.equal(exported.status, 200);
      const csv = await exported.text(), m = await ma.call("export_saved_report", { id }); assert.equal(m.isError, false);
      assert.equal(Buffer.from(m.body.content, "base64").toString("utf8"), csv); assert.equal(m.body.encoding, "base64");
      assert.equal(csv.split("\n")[0].split(",").length, Object.keys(result.data[0]).length);
      assert.match(csv, /Minor/);
      if (config.dataSource === "expenses") { assert.match(csv, /"Travel,""expense""\nline"/); assert.match(csv, /1250,.*1250/s); }
    }
    const emptyConfig = { dataSource: "invoices", columns: ["total"], filters: [{ field: "total", operator: "gt", value: "9007199254740991" }] };
    assert.deepEqual(await body(await runReport(req("POST", emptyConfig))), { data: [], total: 0 });
    assert.deepEqual((await ma.call("run_custom_report", emptyConfig)).body, { data: [], total: 0 });
    const emptySaved = await ma.call("create_saved_report", { name: "Empty", config: emptyConfig }); assert.equal(emptySaved.isError, false);
    assert.equal(await (await exportReport(req(), params(emptySaved.body.report.id))).text(), "total,totalMinor");
    assert.equal(Buffer.from((await ma.call("export_saved_report", { id: emptySaved.body.report.id })).body.content, "base64").toString(), "total,totalMinor");
    await db.delete(savedReport).where(eq(savedReport.id, emptySaved.body.report.id));
    assert.deepEqual((await ma.call("list_saved_reports")).body, await body(await list(req())));
    const mSaved = await ma.call("create_saved_report", { name: "MCP", config: configs[0] }); assert.equal(mSaved.isError, false); ids.push(mSaved.body.report.id);
    assert.deepEqual(await body(await get(req(), params(ids[6]))), { report: mSaved.body.report });
    assert.equal((await update(req("PATCH", { name: "Renamed", description: null }), params(ids[0]))).status, 200);
    assert.equal((await ma.call("update_saved_report", { id: ids[0], description: "Exact literal", config: { dataSource: "invoices", columns: ["totalMinor"], filters: [{ field: "totalMinor", operator: "gte", value: "1250" }] } })).isError, false);
    assert.deepEqual((await ma.call("get_saved_report", { id: ids[0] })).body, await body(await get(req(), params(ids[0]))));
    assert.equal((await body(await runReport(req("POST", { dataSource: "invoices", columns: ["totalMinor"], filters: [{ field: "total", operator: "gt", value: "1249" }] })))).total, 2);
    assert.equal((await body(await runReport(req("POST", { dataSource: "invoices", columns: ["contactName"] })))).data.find((r: { contactName: string }) => r.contactName === "-" ).contactName, "-");

    const operations = [
      [list, "GET", undefined, "list_saved_reports", {}], [get, "GET", undefined, "get_saved_report", { id: ids[0] }],
      [create, "POST", { name: "Bad", config: configs[0] }, "create_saved_report", { name: "Bad", config: configs[0] }],
      [update, "PATCH", { name: "Bad" }, "update_saved_report", { id: ids[0], name: "Bad" }],
      [remove, "DELETE", undefined, "delete_saved_report", { id: ids[0] }], [exportReport, "GET", undefined, "export_saved_report", { id: ids[0] }],
      [runReport, "POST", configs[0], "run_custom_report", configs[0]],
    ] as const;
    let before = await snapshot();
    for (const [handler, method, input, tool, args] of operations) {
      assert.equal((await handler(req(method, input, "dk_report_invalid"), params(ids[0]))).status, 401);
      assert.equal((await handler(req(method, input, keys.denied), params(ids[0]))).status, 403);
      assert.equal((await noRead.call(tool, args)).body.status, 403);
    }
    assert.deepEqual(await snapshot(), before);
    assert.equal((await runReport(req("POST", configs[5], keys.viewer))).status, 403);
    assert.equal((await view.call("run_custom_report", configs[5])).body.status, 403);
    assert.equal((await exportReport(req("GET", undefined, keys.viewer), params(ids[5]))).status, 403);
    assert.equal((await view.call("export_saved_report", { id: ids[5] })).body.status, 403);
    assert.deepEqual(await body(await list(req("GET", undefined, keys.foreign))), { reports: [] });
    assert.deepEqual((await mb.call("list_saved_reports")).body, { reports: [] });
    for (const [handler, method, input, tool, args] of operations.filter(op => ["get_saved_report", "update_saved_report", "delete_saved_report", "export_saved_report"].includes(op[3]))) {
      assert.equal((await handler(req(method, input, keys.foreign), params(ids[0]))).status, 404);
      assert.equal((await mb.call(tool, args)).body.status, 404);
    }
    const foreignResult = await body(await runReport(req("POST", configs[0], keys.foreign))); assert.equal(foreignResult.total, 1);
    assert.deepEqual((await mb.call("run_custom_report", configs[0])).body, foreignResult);
    assert.deepEqual(await snapshot(), before);
    for (const bad of [{ ...configs[0], columns: ["__proto__"] }, { ...configs[0], columns: [] }, { ...configs[0], groupBy: ["status"] },
      { ...configs[0], filters: [{ field: "total", operator: "bad", value: "1" }] }, { ...configs[0], filters: [{ field: "total", operator: "gt", value: "9007199254740992" }] },
      { ...configs[0], dateRange: { from: "2024-02-30", to: "2024-03-01" } }, { ...configs[0], organizationId: b.id }]) {
      assert.equal((await runReport(req("POST", bad))).status, 400);
      assert.equal((await ma.call("run_custom_report", bad)).isError, true);
      assert.equal((await create(req("POST", { name: "Bad", config: bad }))).status, 400);
      assert.equal((await ma.call("create_saved_report", { name: "Bad", config: bad })).isError, true);
      assert.equal((await update(req("PATCH", { config: bad }), params(ids[0]))).status, 400);
      assert.equal((await ma.call("update_saved_report", { id: ids[0], config: bad })).isError, true);
    }
    for (const bad of [{}, { name: "" }, { organizationId: b.id }, { config: null }]) {
      assert.equal((await update(req("PATCH", bad), params(ids[0]))).status, 400);
      assert.equal((await ma.call("update_saved_report", { id: ids[0], ...bad })).isError, true);
    }
    for (const [handler, method, input, tool, args] of operations.filter(op => ["get_saved_report", "update_saved_report", "delete_saved_report", "export_saved_report"].includes(op[3]))) {
      assert.equal((await handler(req(method, input), params("bad-id"))).status, 400);
      assert.equal((await ma.call(tool, { ...args, id: "bad-id" })).isError, true);
      assert.equal((await handler(req(method, input), params(randomUUID()))).status, 404);
    }
    for (const [handler, method] of [[create, "POST"], [update, "PATCH"], [runReport, "POST"]] as const)
      assert.equal((await handler(new Request("http://fixture.test", { method, headers: { authorization: `Bearer ${keys.owner}` }, body: "{" }), params(ids[0]))).status, 400);
    assert.deepEqual(await snapshot(), before);

    // Every source keeps signed maximum safe values exactly and rejects unsafe stored int64 values.
    for (const [config, table, column, id, field, savedId] of [
      [configs[1], "contact", "credit_limit", local.id, "creditLimit", ids[1]], [configs[2], "inventory_item", "purchase_price", item.id, "purchasePrice", ids[2]],
      [configs[3], "bank_transaction", "amount", txn.id, "amount", ids[3]], [configs[4], "expense_claim", "total_amount", expense.id, "totalAmount", ids[4]],
      [configs[5], "payroll_item", "gross_amount", payItem.id, "grossAmount", ids[5]],
    ] as const) {
      const original = (await db.execute(sql.raw(`select ${column}::text as value from ${table} where id = '${id}'`))).rows[0].value as string;
      for (const value of ["9007199254740991", "-9007199254740991"]) {
        await db.execute(sql.raw(`update ${table} set ${column} = ${value} where id = '${id}'`));
        const input = { ...config, filters: [] };
        const result = await body(await runReport(req("POST", input)));
        assert.equal(result.data[0][field], Number(value)); assert.equal(result.data[0][`${field}Minor`], value);
        assert.deepEqual((await ma.call("run_custom_report", input)).body, result);
      }
      for (const value of ["9007199254740992", "-9007199254740992", "9223372036854775807"]) {
        await db.execute(sql.raw(`update ${table} set ${column} = ${value} where id = '${id}'`)); before = await snapshot();
        const response = await runReport(req("POST", config)); assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("run_custom_report", config)).body.code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await exportReport(req(), params(savedId))).status, 422);
        assert.equal((await ma.call("export_saved_report", { id: savedId })).body.code, "LEGACY_NUMERIC_RANGE");
        assert.deepEqual(await snapshot(), before);
      }
      await db.execute(sql.raw(`update ${table} set ${column} = ${original} where id = '${id}'`));
    }
    const invoiceId = (await db.query.invoice.findFirst({ where: eq(invoice.organizationId, a.id) }))!.id;
    await db.execute(sql`update invoice set total = 9007199254740992 where id = ${invoiceId}`);
    assert.equal((await runReport(req("POST", configs[0]))).status, 422);
    assert.equal((await ma.call("run_custom_report", configs[0])).body.code, "LEGACY_NUMERIC_RANGE");
    await db.execute(sql`update invoice set total = 1250 where id = ${invoiceId}`);
    await db.execute(sql`update bank_transaction set currency_code = 'USD' where id = ${txn.id}`);
    assert.equal((await runReport(req("POST", configs[3]))).status, 422); await db.execute(sql`update bank_transaction set currency_code = null where id = ${txn.id}`);
    await db.execute(sql`update expense_claim set submitted_at = 'infinity' where id = ${expense.id}`);
    assert.equal((await runReport(req("POST", configs[4]))).status, 422); assert.equal((await ma.call("export_saved_report", { id: ids[4] })).body.status, 422);
    await db.update(expenseClaim).set({ submittedAt: new Date("2024-02-29T23:59:59Z") }).where(eq(expenseClaim.id, expense.id));
    // Stored opaque configs are parsed again on every boundary; unsupported history is not rewritten.
    const original = (await db.query.savedReport.findFirst({ where: eq(savedReport.id, ids[0]) }))!.config;
    for (const corrupt of [{ ...original, columns: ["constructor"] }, { ...original, filters: [{ field: "totalMinor", operator: "gte", value: "01" }] }]) {
      await db.execute(sql`update saved_report set config = ${JSON.stringify(corrupt)}::jsonb where id = ${ids[0]}`); before = await snapshot();
      for (const [handler, method, input, tool, args] of operations.filter(op => ["list_saved_reports", "get_saved_report", "update_saved_report", "delete_saved_report", "export_saved_report"].includes(op[3]))) {
        assert.equal((await handler(req(method, input), params(ids[0]))).status, 422);
        assert.equal((await ma.call(tool, args)).body.status, 422);
      }
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual((await mb.call("list_saved_reports")).body, { reports: [] });
    }
    await db.update(savedReport).set({ config: original }).where(eq(savedReport.id, ids[0]));
    await db.execute(sql`update saved_report set updated_at = 'infinity' where id = ${ids[0]}`); before = await snapshot();
    assert.equal((await get(req(), params(ids[0]))).status, 422); assert.equal((await ma.call("get_saved_report", { id: ids[0] })).body.status, 422);
    assert.equal((await update(req("PATCH", { name: "Repair" }), params(ids[0]))).status, 422); assert.deepEqual(await snapshot(), before);
    await db.update(savedReport).set({ updatedAt: new Date() }).where(eq(savedReport.id, ids[0]));
    for (const [index, id] of ids.entries()) {
      if (index % 2) assert.deepEqual((await ma.call("delete_saved_report", { id })).body, { success: true });
      else assert.deepEqual(await body(await remove(req("DELETE"), params(id))), { success: true });
      assert.equal((await get(req(), params(id))).status, 404); assert.equal((await ma.call("delete_saved_report", { id })).body.status, 404);
    }
    assert.deepEqual(await body(await list(req())), { reports: [] });
    assert.equal((await db.execute(sql`select count(*)::text as count from audit_log where entity_type = 'saved_report' and action = 'delete'`)).rows[0].count, String(ids.length));
    console.log("REST and MCP custom report contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close(), view.close()]); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
