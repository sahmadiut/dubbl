// Invoked only in the parent test's migrated disposable database; SMTP is recorded locally.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, subscription, contact, invoice, chartAccount,
  inventoryItem, savedReport, reportSchedule, emailConfig, journalLine, notification } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as invoiceCreate } from "../../app/api/v1/invoices/route";
import { POST as entryCreate } from "../../app/api/v1/entries/route";
import { POST as entryPost } from "../../app/api/v1/entries/[id]/post/route";
import { GET as widget } from "../../app/api/v1/dashboard/widgets/[type]/data/route";
import { GET as dashboardAlerts } from "../../app/api/v1/dashboard/alerts/route";
import { POST as layoutCreate, GET as layoutList } from "../../app/api/v1/dashboard/layouts/route";
import { GET as layoutGet } from "../../app/api/v1/dashboard/layouts/[id]/route";
import { POST as reportCreate } from "../../app/api/v1/reports/saved/route";
import { GET as reportGet, PATCH as reportUpdate } from "../../app/api/v1/reports/saved/[id]/route";
import { POST as reportRun } from "../../app/api/v1/reports/run/route";
import { GET as reportExport } from "../../app/api/v1/reports/saved/[id]/export/route";
import { POST as scheduleCreate } from "../../app/api/v1/report-schedules/route";
import { POST as scheduleTrigger } from "../../app/api/v1/report-schedules/[id]/trigger/route";
import { POST as budgetCreate } from "../../app/api/v1/budgets/route";
import { POST as budgetCheck } from "../../app/api/v1/budgets/check-alerts/route";
import { GET as notificationList } from "../../app/api/v1/notifications/route";
import { createBill } from "../../lib/api/bill-writes";
import { createBankAccount } from "../../lib/api/bank-accounts";
import { checkBudgetVariances } from "../../lib/api/budget-alerts";
import { processReportSchedules } from "../../lib/reports/schedule-processor";
import { encryptPassword } from "../../lib/email/smtp-client";
import type { AuthContext } from "../../lib/api/auth-context";

const dashboardPairs = [
  ["accounts_receivable", "get_dashboard_receivables"], ["accounts_payable", "get_dashboard_payables"],
  ["bank_balances", "get_dashboard_bank_balances"], ["inventory_alerts", "get_dashboard_inventory_alerts"],
  ["quick_actions", "get_dashboard_quick_actions"], ["alerts", "get_dashboard_alerts"],
] as const;

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined dashboard/report fixture", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  const required = [...dashboardPairs.map(([, name]) => name), "list_dashboard_layouts", "get_dashboard_layout", "create_dashboard_layout",
    "update_dashboard_layout", "delete_dashboard_layout", "run_custom_report", "list_saved_reports", "get_saved_report",
    "create_saved_report", "update_saved_report", "delete_saved_report", "export_saved_report", "create_report_schedule",
    "list_report_schedules", "get_report_schedule", "update_report_schedule", "delete_report_schedule", "trigger_report_schedule", "check_budget_alerts"];
  for (const name of required) {
    const tool = tools.find(tool => tool.name === name); assert.ok(tool, name); assert.ok(tool.description, name);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Combined local", slug: "combined-local" }, { name: "Combined foreign", slug: "combined-foreign" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "combined-owner@example.test" }, { email: "combined-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No financial access", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values([a, b].map(org => ({ organizationId: org.id, plan: "pro" as const })));
  const keys = { a: "dk_combined_dashboard_a", b: "dk_combined_dashboard_b", denied: "dk_combined_dashboard_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_combined", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, userId: denied.id, permissions: [] });
  const request = (path: string, method = "GET", body?: unknown, key = keys.a) => new Request(`http://fixture.test/api/v1/${path}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const json = async (response: Response, status = 200) => {
    assert.equal(response.status, status, await response.clone().text()); return response.json();
  };
  const call = async (name: string, input: Record<string, unknown> = {}) => {
    const result = await ma.call(name, input); assert.equal(result.isError, false, JSON.stringify(result.body)); return result.body;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["dashboard_layout", "saved_report", "report_schedule", "invoice", "invoice_line", "bill", "bill_line", "bank_account",
      "inventory_item", "budget", "budget_line", "budget_period", "journal_entry", "journal_line", "audit_log", "notification", "notification_digest_queue"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    return result;
  };
  const financial = async () => {
    const all = await snapshot();
    return Object.fromEntries(Object.entries(all).filter(([table]) => !["dashboard_layout", "saved_report", "report_schedule", "audit_log", "notification", "notification_digest_queue"].includes(table)));
  };
  const mails: { to: string; attachments: { content: Buffer }[] }[] = [];
  const originalTransport = nodemailer.createTransport;
  nodemailer.createTransport = (() => ({ sendMail: async (mail: typeof mails[number]) => { mails.push(mail); return {}; } })) as typeof nodemailer.createTransport;
  const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  try {
    // Use actual legacy REST and exact MCP invoice writers in the same organization.
    const [local, foreign] = await db.insert(contact).values([a, b].map(org => ({ organizationId: org.id, name: org === a ? "Local" : "Foreign secret", currencyCode: "USD", type: "both" as const }))).returning();
    const doc = { contactId: local.id, currencyCode: "USD", issueDate: yesterday, dueDate: yesterday };
    const legacy = (await json(await invoiceCreate(request("invoices", "POST", { ...doc, lines: [{ description: "Legacy", unitPrice: 12.5 }] })), 201)).invoice;
    const exact = (await call("create_invoice", { ...doc, lines: [{ description: "Exact", unitPriceMinor: "1250" }] })).invoice;
    assert.equal((await mb.call("create_invoice", { ...doc, contactId: foreign.id, lines: [{ description: "Foreign secret", unitPriceMinor: "777" }] })).isError, false);
    for (const id of [legacy.id, exact.id]) await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, id));
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) await createBill(ctx, { ...doc, lines: [{ description: "Bill", ...price }] }, "rest");
    await createBankAccount(ctx, { accountName: "Local bank", currencyCode: "USD", balanceMinor: "1250" });
    await db.insert(inventoryItem).values({ organizationId: a.id, code: "LOW", name: "Low stock", quantityOnHand: 1, reorderPoint: 2 });
    const seededFinancial = await financial();

    // Opaque layout values remain literal; only each widget's documented filter is dispatched.
    const layoutInput = { name: "Exact overview", layout: dashboardPairs.filter(([type]) => type !== "alerts").map(([widgetType]) => ({
      widgetType, x: 0, y: 0, w: 2, h: 1, config: { ...(widgetType === "inventory_alerts" || widgetType === "quick_actions" ? {} : { currencyCode: "USD" }),
        legacyAmount: 1250, exactAmount: "9223372036854775807" },
    })) };
    const savedLayout = (await json(await layoutCreate(request("dashboard/layouts", "POST", layoutInput)), 201)).layout;
    assert.deepEqual(savedLayout.layout, layoutInput.layout);
    assert.deepEqual((await json(await layoutGet(request("dashboard/layouts"), params(savedLayout.id)))), await call("get_dashboard_layout", { id: savedLayout.id }));
    assert.deepEqual(await json(await layoutList(request("dashboard/layouts"))), await call("list_dashboard_layouts"));
    for (const placement of savedLayout.layout) {
      const input: Record<string, string> = placement.config.currencyCode ? { currencyCode: placement.config.currencyCode } : {};
      const suffix = new URLSearchParams(input).toString();
      const rest = await json(await widget(request(`dashboard/widgets/${placement.widgetType}/data?${suffix}`), { params: Promise.resolve({ type: placement.widgetType }) }));
      assert.deepEqual(rest, await call(dashboardPairs.find(([type]) => type === placement.widgetType)![1], input));
      if (placement.widgetType === "accounts_receivable" || placement.widgetType === "accounts_payable") { assert.equal(rest.total, 2500); assert.equal(rest.totalMinor, "2500"); }
      if (placement.widgetType === "bank_balances") assert.equal(rest.accounts[0].balanceMinor, "1250");
      if (placement.widgetType === "inventory_alerts") assert.equal(rest.lowStockCount, 1);
    }
    const alerts = await json(await dashboardAlerts(request("dashboard/alerts?currencyCode=USD")));
    assert.deepEqual(alerts, await call("get_dashboard_alerts", { currencyCode: "USD" }));
    assert.equal(alerts.overdueInvoices.totalMinor, "2500"); assert.equal(alerts.overdueBills.count, 0); // Draft bills stay outside action alerts.

    const config = { dataSource: "invoices", columns: ["total", "amountDue", "currencyCode"], filters: [], groupBy: [], dateRange: { from: yesterday, to: today } };
    const report = (await json(await reportCreate(request("reports/saved", "POST", { name: "Combined invoices", config })), 201)).report;
    const readReport = await json(await reportGet(request("reports/saved"), params(report.id)));
    assert.deepEqual(readReport, await call("get_saved_report", { id: report.id }));
    const data = await json(await reportRun(request("reports/run", "POST", readReport.report.config)));
    assert.deepEqual(data, await call("run_custom_report", readReport.report.config)); assert.equal(data.total, 2);
    assert.ok(data.data.every((row: Record<string, unknown>) => row.total === 1250 && row.totalMinor === "1250" && row.amountDueMinor === "1250"));
    const exported = await reportExport(request("reports/saved"), params(report.id)); assert.equal(exported.status, 200);
    const csv = await exported.text(); assert.equal(csv, Buffer.from((await call("export_saved_report", { id: report.id })).content, "base64").toString());

    // Delivery uses the report saved through REST; metadata updates cannot alter financial rows.
    await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture.test", smtpUsername: "fixture", smtpPassword: encryptPassword("synthetic"), fromEmail: "combined@example.test" });
    const scheduleInput = { savedReportId: report.id, frequency: "daily", format: "csv", recipients: ["recipient@example.test"], timezone: "Asia/Tehran" };
    const schedule = (await json(await scheduleCreate(request("report-schedules", "POST", scheduleInput)), 201)).reportSchedule;
    const financialBefore = await financial();
    assert.deepEqual(await json(await scheduleTrigger(request("report-schedules", "POST"), params(schedule.id))), { sent: 1 });
    assert.equal(mails.at(-1)!.attachments[0].content.toString(), csv);
    assert.deepEqual(await call("trigger_report_schedule", { id: schedule.id }), { sent: 1 });
    assert.equal(mails.at(-1)!.attachments[0].content.toString(), csv);
    await call("update_report_schedule", { id: schedule.id, format: "xlsx", isActive: false });
    await call("trigger_report_schedule", { id: schedule.id });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(mails.at(-1)!.attachments[0].content as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    assert.equal(workbook.worksheets[0].getCell("A2").value, "1250");
    assert.equal(workbook.worksheets[0].getCell("D2").value, "1250");
    const filtered = { ...config, filters: [{ field: "totalMinor", operator: "gt", value: "1250" }] };
    await json(await reportUpdate(request("reports/saved", "PATCH", { config: filtered }), params(report.id)));
    assert.deepEqual(await call("run_custom_report", filtered), { data: [], total: 0 });
    await call("update_report_schedule", { id: schedule.id, format: "csv", isActive: true });
    await db.update(reportSchedule).set({ nextRunAt: new Date(0) }).where(eq(reportSchedule.id, schedule.id));
    const beforeCron: number = mails.length;
    const cron = await Promise.all([processReportSchedules(), processReportSchedules()]);
    assert.equal(cron.reduce((sum, result) => sum + result.sent, 0), 1); assert.equal(mails.length, beforeCron + 1);
    assert.equal(mails.at(-1)!.attachments[0].content.toString(), csv.split("\n")[0]);
    await call("update_saved_report", { id: report.id, config });
    assert.equal((await call("run_custom_report", config)).total, 2);
    assert.deepEqual(await financial(), financialBefore);
    assert.deepEqual(await financial(), seededFinancial);

    // Posted journal writer -> legacy/exact budget writers -> notifications and scheduled replay.
    const [expense, bank] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "5000", name: "Spending", type: "expense" as const },
      { organizationId: a.id, code: "1000", name: "Bank", type: "asset" as const, subType: "bank" }]).returning();
    const entry = (await json(await entryCreate(request("entries", "POST", { date: today, description: "Combined budget spend", lines: [
      { accountId: expense.id, debitAmountMinor: "1250", rateExact: "1" }, { accountId: bank.id, creditAmount: 1250, rateExact: "1" },
    ] })), 201)).entry;
    await json(await entryPost(request("entries/post", "POST", {}), params(entry.id)));
    const budgetInput = { name: "Combined threshold", startDate: yesterday, endDate: today, periodType: "custom", varianceThresholdPct: 50 };
    await json(await budgetCreate(request("budgets", "POST", { ...budgetInput, lines: [{ accountId: expense.id, total: 1000,
      periods: [{ label: "Now", startDate: yesterday, endDate: today, amount: 1000 }] }] })), 201);
    await call("create_budget", { ...budgetInput, lines: [{ accountId: expense.id, totalMinor: "1000",
      periods: [{ label: "Now", startDate: yesterday, endDate: today, amountMinor: "1000" }] }] });
    const beforeNotes = await financial();
    const checked = await json(await budgetCheck(request("budgets/check-alerts", "POST", {})));
    assert.equal(checked.checked, 2); assert.equal(checked.alerted, 2);
    assert.ok(checked.evaluations.every((value: Record<string, unknown>) => value.actual === 1250 && value.actualMinor === "1250" && value.thresholdMinor === "500"));
    assert.deepEqual(await call("check_budget_alerts"), { ...checked, alerted: 0 });
    assert.deepEqual(await checkBudgetVariances(), { checked: 2, alerted: 0 });
    assert.deepEqual(await financial(), beforeNotes);
    const notes = await json(await notificationList(request("notifications"))); assert.equal(notes.data.length, 2);
    assert.ok(notes.data.every((note: Record<string, unknown>) => String(note.body).includes("actual USD 12.50 vs budget USD 10.00")));
    assert.equal((await db.select().from(notification)).length, 2);

    // Full registry must reject unknown controls instead of silently stripping them.
    const beforeFailures = await snapshot(), mailCount: number = mails.length;
    for (const [type, name] of dashboardPairs) {
      const response = type === "alerts" ? await dashboardAlerts(request("dashboard/alerts?organizationId=foreign"))
        : await widget(request(`dashboard/widgets/${type}/data?organizationId=foreign`), { params: Promise.resolve({ type }) });
      assert.equal(response.status, 400);
      assert.equal((await ma.call(name, { organizationId: b.id })).isError, true, `${name} must reject unknown organizationId`);
      assert.equal((await noRead.call(name)).body.status, 403);
    }
    for (const name of ["get_dashboard_inventory_alerts", "get_dashboard_quick_actions"])
      assert.equal((await ma.call(name, { currencyCode: "USD" })).isError, true);
    for (const [name, input] of [["create_dashboard_layout", { ...layoutInput, organizationId: b.id }],
      ["run_custom_report", { ...config, organizationId: b.id }], ["create_report_schedule", { ...scheduleInput, organizationId: b.id }],
      ["check_budget_alerts", { organizationId: b.id }]] as const) assert.equal((await ma.call(name, input)).isError, true);
    await json(await layoutCreate(request("dashboard/layouts", "POST", { ...layoutInput, organizationId: b.id })), 400);
    await json(await reportRun(request("reports/run", "POST", { ...config, groupBy: ["currencyCode"] })), 400);
    await json(await scheduleCreate(request("report-schedules", "POST", { ...scheduleInput, recipients: [] })), 400);
    await json(await budgetCheck(request("budgets/check-alerts", "POST", { organizationId: b.id })), 400);
    for (const [handler, path, input] of [[reportRun, "reports/run", config], [scheduleCreate, "report-schedules", scheduleInput], [budgetCheck, "budgets/check-alerts", {}]] as const) {
      assert.equal((await handler(request(path, "POST", input, keys.denied))).status, 403);
      assert.equal((await handler(request(path, "POST", input, "dk_invalid"))).status, 401);
    }
    assert.equal((await noRead.call("run_custom_report", config)).body.status, 403);
    assert.equal((await noRead.call("trigger_report_schedule", { id: schedule.id })).body.status, 403);
    assert.equal((await noRead.call("check_budget_alerts")).body.status, 403);
    assert.equal((await mb.call("get_dashboard_layout", { id: savedLayout.id })).body.status, 404);
    assert.equal((await mb.call("get_saved_report", { id: report.id })).body.status, 404);
    assert.equal((await mb.call("trigger_report_schedule", { id: schedule.id })).body.status, 404);
    assert.deepEqual((await mb.call("check_budget_alerts")).body, { checked: 0, alerted: 0, evaluations: [] });
    assert.equal((await mb.call("run_custom_report", config)).body.total, 1);
    assert.deepEqual(await snapshot(), beforeFailures); assert.equal(mails.length, mailCount);

    // Unsupported history fails across readers and delivery without side effects or repair.
    await db.execute(sql`update invoice set total=9007199254740992, amount_due=9007199254740992 where id=${legacy.id}`);
    const unsafeSnapshot = await snapshot();
    assert.equal((await json(await widget(request("dashboard/widgets/accounts_receivable/data"), { params: Promise.resolve({ type: "accounts_receivable" }) }), 422)).code, "LEGACY_NUMERIC_RANGE");
    for (const [name, input] of [["get_dashboard_receivables", {}], ["get_dashboard_alerts", {}], ["run_custom_report", config],
      ["export_saved_report", { id: report.id }], ["trigger_report_schedule", { id: schedule.id }], ["create_report_schedule", scheduleInput]] as const)
      assert.equal((await ma.call(name, input)).body.code, "LEGACY_NUMERIC_RANGE");
    await json(await reportRun(request("reports/run", "POST", config)), 422);
    await json(await reportExport(request("reports/saved"), params(report.id)), 422);
    await json(await scheduleTrigger(request("report-schedules", "POST"), params(schedule.id)), 422);
    assert.deepEqual(await snapshot(), unsafeSnapshot); assert.equal(mails.length, mailCount);
    await db.execute(sql`update invoice set total=1250, amount_due=1250 where id=${legacy.id}`);

    await db.execute(sql`update saved_report set config='{"dataSource":"invoices","columns":["total"],"groupBy":["currencyCode"]}'::jsonb where id=${report.id}`);
    const corruptSnapshot = await snapshot();
    assert.equal((await ma.call("export_saved_report", { id: report.id })).body.status, 422);
    assert.equal((await ma.call("trigger_report_schedule", { id: schedule.id })).body.status, 422);
    await json(await reportUpdate(request("reports/saved", "PATCH", { config }), params(report.id)), 422);
    assert.deepEqual(await snapshot(), corruptSnapshot); assert.equal(mails.length, mailCount);
    await db.update(savedReport).set({ config }).where(eq(savedReport.id, report.id));

    await db.execute(sql`update journal_line set debit_amount=9007199254740992 where journal_entry_id=${entry.id} and account_id=${expense.id}`);
    const unsafeBudget = await snapshot();
    assert.equal((await json(await budgetCheck(request("budgets/check-alerts", "POST", {})), 422)).code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await ma.call("check_budget_alerts")).body.code, "LEGACY_NUMERIC_RANGE");
    await assert.rejects(checkBudgetVariances());
    assert.deepEqual(await snapshot(), unsafeBudget);
    await db.update(journalLine).set({ debitAmount: 1250 }).where(eq(journalLine.accountId, expense.id));

    // Deleting a report through its real API leaves its schedule visible to the worker,
    // but preflight must prevent delivery or metadata advancement on the orphan reference.
    await call("delete_saved_report", { id: report.id });
    await db.update(reportSchedule).set({ nextRunAt: new Date(0) }).where(eq(reportSchedule.id, schedule.id));
    const deletedSnapshot = await snapshot();
    assert.equal((await ma.call("trigger_report_schedule", { id: schedule.id })).body.status, 404);
    await json(await scheduleTrigger(request("report-schedules", "POST"), params(schedule.id)), 404);
    assert.deepEqual(await processReportSchedules(), { processed: 1, sent: 0, failed: 1 });
    assert.deepEqual(await snapshot(), deletedSnapshot); assert.equal(mails.length, mailCount);
    console.log("Combined dashboard and report contracts verified");
  } finally { nodemailer.createTransport = originalTransport; await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
