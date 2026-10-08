import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { inflateSync } from "node:zlib";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, savedReport, reportSchedule, contact, emailConfig } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/report-schedules/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/report-schedules/[id]/route";
import { POST as trigger } from "../../app/api/v1/report-schedules/[id]/trigger/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerReportScheduleTools } from "../../lib/mcp/tools/report-schedule-tools";
import { encryptPassword } from "../../lib/email/smtp-client";
import { processReportSchedules } from "../../lib/reports/schedule-processor";
import { exportSavedReport } from "../../lib/reports/custom";
import { createInvoice } from "../../lib/api/invoice-writes";
import type { AuthContext } from "../../lib/api/auth-context";

const names = ["create_report_schedule", "list_report_schedules", "get_report_schedule", "update_report_schedule", "delete_report_schedule", "trigger_report_schedule"];
function pdfText(buffer: Buffer) {
  const binary = buffer.toString("latin1");
  return [...binary.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap(match => {
    try { return [...inflateSync(Buffer.from(match[1], "latin1")).toString().matchAll(/<([a-f0-9]+)>/gi)].map(hex => Buffer.from(hex[1], "hex").toString()); }
    catch { return []; }
  }).join("");
}
async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Schedules", version: "1" });
  if (all) registerAllTools(server, ctx); else registerReportScheduleTools(server, ctx);
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
  const [a, b] = await db.insert(organization).values([{ name: "Schedule A", slug: "schedule-a" }, { name: "Schedule B", slug: "schedule-b" }]).returning();
  const [owner, denied, viewer, manager] = await db.insert(users).values(["owner", "denied", "viewer", "manager"].map(name => ({ email: `schedule-${name}@example.test` }))).returning();
  const [noRole, viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "No access", permissions: [] },
    { organizationId: a.id, name: "Read", permissions: ["view:data"] }, { organizationId: a.id, name: "Manage", permissions: ["view:data", "manage:reports"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, customRoleId: noRole.id }, { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id },
    { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  const keys = { owner: "dk_schedule_owner", foreign: "dk_schedule_foreign", denied: "dk_schedule_denied", viewer: "dk_schedule_viewer", manager: "dk_schedule_manager" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "foreign" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_schedule" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, permissions: [] }),
    view = await mcp({ ...ctx, permissions: ["view:data"] }), manage = await mcp({ ...ctx, permissions: ["view:data", "manage:reports"] });
  const req = (method = "GET", body?: unknown, key = keys.owner, query = "") => new Request(`http://fixture.test/api/v1/report-schedules${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const body = async (response: Response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json(); };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["saved_report", "report_schedule", "contact", "invoice", "invoice_line", "audit_log", "email_config"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    return result;
  };
  const [local] = await db.insert(contact).values({ organizationId: a.id, name: 'Local,"name"\nline', creditLimit: 1250, currencyCode: "USD" }).returning();
  await db.insert(contact).values({ organizationId: b.id, name: "Foreign secret", creditLimit: 777 });
  const config = { dataSource: "contacts", columns: ["name", "creditLimit", "currencyCode"], filters: [], groupBy: [] };
  const [report, foreign, deleted, invoices, payroll] = await db.insert(savedReport).values([
    { organizationId: a.id, name: '<Exact "Report">', config }, { organizationId: b.id, name: "Foreign secret", config },
    { organizationId: a.id, name: "Deleted secret", config, deletedAt: new Date() },
    { organizationId: a.id, name: "Invoices", config: { ...config, dataSource: "invoices", columns: ["invoiceNumber", "total", "currencyCode"] } },
    { organizationId: a.id, name: "Payroll", config: { ...config, dataSource: "payroll", columns: ["netAmount"] } },
  ]).returning();
  await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture.test", smtpUsername: "fixture", smtpPassword: encryptPassword("synthetic"), fromEmail: "local@example.test" });
  const delivered: { to: string; from: string; html: string; attachments: { filename: string; content: Buffer }[] }[] = [];
  const originalTransport = nodemailer.createTransport;
  let failAt = -1;
  nodemailer.createTransport = (() => ({ sendMail: async (mail: typeof delivered[number]) => {
    if (delivered.length === failAt) throw new Error("Synthetic SMTP failure");
    delivered.push(mail); return {};
  } })) as typeof nodemailer.createTransport;
  const input = { savedReportId: report.id, frequency: "daily", format: "csv", recipients: ["one@example.test", "two@example.test"], timeOfDay: "08:00", timezone: "Asia/Tehran" };
  try {
    const created = (await body(await create(req("POST", input)), 201)).reportSchedule;
    assert.equal(created.organizationId, a.id); assert.equal(created.savedReport.name, report.name);
    assert.equal(new Date(created.nextRunAt).getUTCMinutes(), 30);
    const mc = await ma.call("create_report_schedule", { ...input, format: "xlsx" }); assert.equal(mc.isError, false);
    const id = created.id, mid = mc.body.id;
    assert.deepEqual((await body(await get(req(), params(id)))).reportSchedule, (await ma.call("get_report_schedule", { id })).body);
    assert.deepEqual(await body(await list(req())), (await ma.call("list_report_schedules")).body);
    assert.equal((await body(await list(req("GET", undefined, keys.owner, "?limit=200")))).pagination.limit, 100);
    const patched = (await body(await update(req("PATCH", { isActive: false }), params(id)))).reportSchedule;
    assert.equal(patched.isActive, false); assert.equal(patched.format, "csv"); assert.equal(patched.timezone, "Asia/Tehran");
    assert.equal((await ma.call("update_report_schedule", { id: mid, frequency: "weekly", dayOfWeek: 0 })).isError, false);
    await body(await trigger(req("POST"), params(id)));
    assert.equal(delivered.length, 2); assert.equal(delivered[0].from, "local@example.test");
    assert.match(delivered[0].html, /&lt;Exact &quot;Report&quot;&gt;/); assert.doesNotMatch(delivered[0].html, /<Exact/);
    const exported = await exportSavedReport(ctx, report.id);
    assert.equal(delivered[0].attachments[0].content.toString(), exported.csv); assert.doesNotMatch(exported.csv, /Foreign secret/);
    assert.match(exported.csv, /1250,USD,1250/);
    assert.equal((await ma.call("trigger_report_schedule", { id: mid })).body.sent, 2);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(delivered[2].attachments[0].content as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    assert.equal(workbook.worksheets[0].getCell("B2").value, "1250"); assert.equal(workbook.worksheets[0].getCell("D2").value, "1250");
    const pdf = await ma.call("create_report_schedule", { ...input, format: "pdf" }); assert.equal(pdf.isError, false);
    await body(await trigger(req("POST"), params(pdf.body.id)));
    assert.equal(delivered[4].attachments[0].content.subarray(0, 5).toString(), "%PDF-");
    assert.ok(delivered[4].attachments[0].content.length > 1000);
    assert.match(pdfText(delivered[4].attachments[0].content), /creditLimitMinor: 1250/);
    // Actual legacy decimal-price and exact Minor writer clients feed the same scheduled CSV.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }])
      await createInvoice(ctx, { contactId: local.id, currencyCode: "USD", issueDate: "2024-02-29", dueDate: "2024-03-01", lines: [{ description: "Client", ...price }] }, "rest");
    const isched = await ma.call("create_report_schedule", { ...input, savedReportId: invoices.id }); assert.equal(isched.isError, false);
    await ma.call("trigger_report_schedule", { id: isched.body.id });
    assert.equal(delivered.at(-1)!.attachments[0].content.toString(), (await exportSavedReport(ctx, invoices.id)).csv);
    assert.equal((delivered.at(-1)!.attachments[0].content.toString().match(/1250,USD,1250/g) ?? []).length, 2);

    // Persisted filters and dates control delivery, including an empty-result attachment.
    const filteredConfig = { ...config, dataSource: "invoices", columns: ["totalMinor", "currencyCode"], filters: [{ field: "totalMinor", operator: "gt", value: "1250" }], dateRange: { from: "2024-02-29", to: "2024-02-29" } };
    await db.update(savedReport).set({ config: filteredConfig }).where(eq(savedReport.id, invoices.id));
    await body(await trigger(req("POST"), params(isched.body.id)));
    assert.equal(delivered.at(-1)!.attachments[0].content.toString(), "totalMinor,currencyCode");
    const psched = await ma.call("create_report_schedule", { ...input, savedReportId: payroll.id }); assert.equal(psched.isError, false);
    const missingSmtp = await mb.call("create_report_schedule", { ...input, savedReportId: foreign.id }); assert.equal(missingSmtp.isError, false);

    const before = await snapshot(), mails = delivered.length;
    for (const invalid of [{ recipients: [] }, { recipients: ["bad"] }, { timeOfDay: "25:00" }, { timezone: "Invalid/Zone" }, { dayOfWeek: 7 }, { dayOfMonth: 29 }, { format: "json" }, { amount: 1 }, { organizationId: b.id }]) {
      await body(await create(req("POST", { ...input, ...invalid })), 400);
      assert.equal((await ma.call("create_report_schedule", { ...input, ...invalid })).isError, true);
      await body(await update(req("PATCH", invalid), params(id)), 400);
      assert.equal((await ma.call("update_report_schedule", { id, ...invalid })).isError, true);
    }
    await body(await update(req("PATCH", {}), params(id)), 400);
    assert.equal((await ma.call("update_report_schedule", { id })).isError, true);
    for (const ref of [foreign.id, deleted.id, randomUUID()]) {
      await body(await create(req("POST", { ...input, savedReportId: ref })), 404);
      assert.equal((await ma.call("create_report_schedule", { ...input, savedReportId: ref })).body.status, 404);
    }
    for (const key of [keys.denied, keys.viewer]) {
      await body(await create(req("POST", input, key)), 403);
      await body(await update(req("PATCH", { isActive: true }, key), params(id)), 403);
      await body(await remove(req("DELETE", undefined, key), params(id)), 403);
      await body(await trigger(req("POST", undefined, key), params(id)), 403);
    }
    await body(await list(req("GET", undefined, keys.denied)), 403);
    await body(await get(req("GET", undefined, keys.denied), params(id)), 403);
    assert.equal((await noRead.call("list_report_schedules")).body.status, 403);
    for (const client of [noRead, view]) for (const name of ["create_report_schedule", "update_report_schedule", "delete_report_schedule", "trigger_report_schedule"])
      assert.equal((await client.call(name, name === "create_report_schedule" ? input : name === "update_report_schedule" ? { id, isActive: true } : { id })).body.status, 403);
    for (const handler of [get, remove, trigger]) await body(await handler(req(handler === get ? "GET" : handler === remove ? "DELETE" : "POST", undefined, keys.foreign), params(id)), 404);
    await body(await update(req("PATCH", { isActive: true }, keys.foreign), params(id)), 404);
    for (const name of ["get_report_schedule", "update_report_schedule", "delete_report_schedule", "trigger_report_schedule"])
      assert.equal((await mb.call(name, name === "update_report_schedule" ? { id, isActive: true } : { id })).body.status, 404);
    await body(await get(req(), params("bad-id")), 400);
    await body(await list(req("GET", undefined, keys.owner, "?page=NaN")), 400);
    await body(await create(req("POST", input, "dk_invalid")), 401);
    await body(await create(req("POST", { ...input, savedReportId: payroll.id }, keys.manager)), 403);
    assert.equal((await manage.call("create_report_schedule", { ...input, savedReportId: payroll.id })).body.status, 403);
    await body(await trigger(req("POST", undefined, keys.manager), params(psched.body.id)), 403);
    assert.equal((await manage.call("trigger_report_schedule", { id: psched.body.id })).body.status, 403);
    assert.equal((await mb.call("trigger_report_schedule", { id: missingSmtp.body.id })).body.status, 422);
    assert.deepEqual(await snapshot(), before); assert.equal(delivered.length, mails);

    // Signed safe endpoints preserve every digit even in XLSX; unsafe int64 data rejects before all side effects.
    for (const amount of ["0", "-1250", "9007199254740991", "-9007199254740991"]) {
      await db.execute(sql`update contact set credit_limit=${amount}::bigint where id=${local.id}`);
      await ma.call("trigger_report_schedule", { id: mid });
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(delivered.at(-1)!.attachments[0].content as unknown as Parameters<typeof wb.xlsx.load>[0]);
      assert.equal(wb.worksheets[0].getCell("B2").value, amount); assert.equal(wb.worksheets[0].getCell("D2").value, amount);
    }
    for (const amount of ["9007199254740992", "-9007199254740992", "9223372036854775807"]) {
      await db.execute(sql`update contact set credit_limit=${amount}::bigint where id=${local.id}`);
      const previous = await snapshot(), count: number = delivered.length;
      assert.equal((await body(await create(req("POST", input)), 422)).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await body(await update(req("PATCH", { isActive: true }), params(id)), 422)).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await body(await trigger(req("POST"), params(id)), 422)).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("trigger_report_schedule", { id })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("create_report_schedule", input)).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("update_report_schedule", { id, isActive: true })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("delete_report_schedule", { id })).body.code, "LEGACY_NUMERIC_RANGE");
      await body(await remove(req("DELETE"), params(id)), 422);
      assert.deepEqual(await snapshot(), previous); assert.equal(delivered.length, count);
    }
    await db.execute(sql`update contact set credit_limit=1250 where id=${local.id}`);
    // Stored config/reference/timestamp corruption never sends, writes or repairs history.
    const cases = [sql`update saved_report set config='{"dataSource":"contacts","columns":["unknown"],"filters":[],"groupBy":[]}'::jsonb where id=${report.id}`,
      sql`update report_schedule set saved_report_id=${foreign.id} where id=${id}`,
      sql`update report_schedule set saved_report_id=${deleted.id} where id=${id}`,
      sql`update report_schedule set recipients='[]'::jsonb where id=${id}`,
      sql`update report_schedule set time_of_day='invalid' where id=${id}`,
      sql`update report_schedule set next_run_at='infinity'::timestamp where id=${id}`,
      sql`update report_schedule set last_run_at='infinity'::timestamp where id=${id}`,
      sql`update report_schedule set created_at='infinity'::timestamp where id=${id}`,
      sql`update saved_report set updated_at='infinity'::timestamp where id=${report.id}`];
    for (const corrupt of cases) {
      await db.update(reportSchedule).set({ isActive: true, nextRunAt: new Date(0) }).where(eq(reportSchedule.id, id));
      await db.execute(corrupt);
      const previous = await snapshot(), count: number = delivered.length;
      for (const handler of [get, trigger, remove]) assert.ok((await handler(req(handler === get ? "GET" : handler === trigger ? "POST" : "DELETE"), params(id))).status >= 400);
      assert.equal((await ma.call("trigger_report_schedule", { id })).isError, true);
      assert.equal((await ma.call("update_report_schedule", { id, isActive: true })).isError, true);
      const batch = await processReportSchedules();
      assert.equal(batch.sent, 0);
      assert.equal(batch.failed, batch.processed);
      assert.deepEqual(await snapshot(), previous); assert.equal(delivered.length, count);
      await db.update(savedReport).set({ config, updatedAt: new Date() }).where(eq(savedReport.id, report.id));
      await db.update(reportSchedule).set({ savedReportId: report.id, recipients: input.recipients, timeOfDay: "08:00", nextRunAt: new Date(Date.now() + 86400000), isActive: false, createdAt: new Date(), lastRunAt: null }).where(eq(reportSchedule.id, id));
    }
    // Due worker uses the same preflight and scoped SMTP; overlapping due workers send one occurrence.
    await db.update(reportSchedule).set({ isActive: false });
    await db.update(reportSchedule).set({ isActive: true, nextRunAt: new Date(0) }).where(eq(reportSchedule.id, id));
    const priorMail = delivered.length;
    const batches = await Promise.all([processReportSchedules(), processReportSchedules()]);
    assert.equal(batches.reduce((sum, result) => sum + result.sent, 0), 1); assert.equal(delivered.length, priorMail + 2);
    await db.update(reportSchedule).set({ nextRunAt: new Date(0) }).where(eq(reportSchedule.id, id));
    await db.execute(sql`update contact set credit_limit='9007199254740992'::bigint where id=${local.id}`);
    const previous = await snapshot(), count = delivered.length;
    assert.equal((await processReportSchedules()).failed, 1);
    assert.deepEqual(await snapshot(), previous); assert.equal(delivered.length, count);
    await db.execute(sql`update contact set credit_limit=1250 where id=${local.id}`);
    failAt = delivered.length;
    const failedSnapshot = await snapshot();
    await body(await trigger(req("POST"), params(id)), 500);
    assert.deepEqual(await snapshot(), failedSnapshot); assert.equal(delivered.length, count); failAt = -1;
    await body(await remove(req("DELETE"), params(id))); assert.equal((await ma.call("delete_report_schedule", { id: mid })).body.success, true);
    await body(await get(req(), params(id)), 404); assert.equal((await ma.call("trigger_report_schedule", { id: mid })).body.status, 404);
    assert.equal((await processReportSchedules()).processed, 0);
    console.log("REST and MCP report schedule contracts verified");
  } finally {
    nodemailer.createTransport = originalTransport;
    await Promise.all([ma.close(), mb.close(), noRead.close(), view.close(), manage.close()]);
  }
}
try { await run(); process.exit(0); } catch (err) { console.error(err); process.exit(1); }
