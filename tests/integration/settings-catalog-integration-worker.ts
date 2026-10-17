import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerOrganizationTools } from "../../lib/mcp/tools/organization";
import { registerCrmTools } from "../../lib/mcp/tools/crm";
import { registerReminderTools } from "../../lib/mcp/tools/reminders";
import { registerRoleTools } from "../../lib/mcp/tools/roles";
import { registerDocumentTemplateTools } from "../../lib/mcp/tools/document-templates";
import { registerNotificationTools } from "../../lib/mcp/tools/notifications";
import { GET as getOrganization, PATCH as updateOrganization } from "../../app/api/v1/organization/route";
import { GET as getLock, PUT as putLock } from "../../app/api/v1/period-lock/route";
import { GET as listPipelines, POST as createPipeline } from "../../app/api/v1/crm/pipelines/route";
import { DELETE as deletePipeline } from "../../app/api/v1/crm/pipelines/[id]/route";
import { POST as createReminder } from "../../app/api/v1/reminders/route";
import { GET as getReminder, PUT as updateReminder, DELETE as deleteReminder } from "../../app/api/v1/reminders/[id]/route";
import { POST as createRole } from "../../app/api/v1/roles/route";
import { GET as getTemplate, PATCH as updateTemplate } from "../../app/api/v1/document-templates/[id]/route";
import { GET as getPreferences, PUT as putPreferences } from "../../app/api/v1/notifications/preferences/route";
import { readSettingsLockDate } from "../../components/settings/period-lock-response";
import { requireSettingsResponse } from "../../i18n/settings-errors";
import en from "../../messages/en-US.json";
import fa from "../../messages/fa-IR.json";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined settings", version: "1" });
  for (const register of [registerOrganizationTools, registerCrmTools, registerReminderTools, registerRoleTools, registerDocumentTemplateTools, registerNotificationTools]) register(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: object = {}, error = false) {
    const result = await client.callTool({ name, arguments: { ...args } });
    assert.equal(result.isError === true, error, JSON.stringify(result));
    const text = (result.content as { text: string }[])[0].text;
    return text.startsWith("{") ? JSON.parse(text) : { error: text };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Combined A", slug: "combined-a", mileageRate: 1250 }, { name: "Combined B", slug: "combined-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "combined-owner@example.test" }, { email: "combined-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: ["view:data"] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_combined_a", b: "dk_combined_b", viewer: "dk_combined_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyPrefix: "dk_combined", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), denied = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: ["view:data"] });
  const req = (method = "GET", body?: unknown, key = keys.a) => new Request("http://fixture.test/settings", { method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const json = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["organization", "period_lock", "pipeline", "deal", "reminder_rule", "document_template", "custom_role", "notification_preference", "journal_entry", "journal_line"].map(async table =>
    (await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows));
  try {
    // All settings families compose in one tenant; locale is presentation only.
    await json(await updateOrganization(req("PATCH", { defaultLanguage: "fa-IR", name: "Saved {{name}} <script>" })));
    assert.deepEqual(await ma.call("get_organization"), await json(await getOrganization(req())));
    await ma.call("update_organization", { fiscalYearStartMonth: 4 });
    await json(await putLock(req("PUT", { lockDate: "2026-09-30" })));
    const stages = [{ id: "lead", name: "Saved stage", color: "#123456" }];
    const pipeline = (await json(await createPipeline(req("POST", { name: "Saved pipeline", stages })), 201)).pipeline;
    assert.deepEqual(await ma.call("list_pipelines"), await json(await listPipelines(req())));
    await ma.call("update_pipeline", { pipelineId: pipeline.id, isDefault: true });
    const deal = (await ma.call("create_deal", { pipelineId: pipeline.id, stageId: "lead", title: "Exact value", valueCentsMinor: "3000000001" })).deal;
    for (const [locale, messages] of [["en-US", en], ["fa-IR", fa]] as const) {
      const errors = createTranslator({ locale, messages, namespace: "SettingsErrors" });
      assert.equal(await readSettingsLockDate(await getLock(req()), errors, messages.SettingsGeneral.failedToLoadLock), "2026-09-30");
      const before = await snapshot();
      await assert.rejects(requireSettingsResponse(await deletePipeline(req("DELETE"), params(pipeline.id)), errors, messages.SettingsPipelines.failedToDelete), { message: messages.SettingsErrors.pipelineHasDeals });
      await ma.call("delete_pipeline", { pipelineId: pipeline.id }, true);
      assert.deepEqual(await snapshot(), before);
    }
    const reminder = (await json(await createReminder(req("POST", { name: "Saved reminder", triggerType: "after_due", triggerDays: 3, enabled: false,
      subjectTemplate: "{{contactName}}", bodyTemplate: "{{amountDue}} {{dueDate}}", documentType: "invoice", recipientType: "contact_email" })), 201)).rule;
    await ma.call("update_reminder_rule", { reminderRuleId: reminder.id, enabled: true });
    assert.equal((await json(await getReminder(req(), params(reminder.id)))).enabled, true);
    await json(await updateReminder(req("PUT", { enabled: false }), params(reminder.id)));
    assert.equal((await ma.call("get_reminder_rule", { reminderRuleId: reminder.id })).reminderRule.enabled, false);
    const createdRole = (await json(await createRole(req("POST", { name: "Caller role", permissions: ["view:data"] })), 201)).role;
    assert.equal((await ma.call("get_role", { roleId: createdRole.id })).role.name, "Caller role");
    const template = (await ma.call("create_document_template", { name: "Saved template", type: "invoice", headerHtml: "<b>{{orgName}}</b>" })).template;
    await json(await updateTemplate(req("PATCH", { notes: "Saved {{invoiceNumber}}" }), params(template.id)));
    assert.deepEqual(await ma.call("get_document_template", { id: template.id }), await json(await getTemplate(req(), params(template.id))));
    await json(await putPreferences(req("PUT", { preferences: [{ type: "invoice_overdue", channel: "email", enabled: true, digestIntervalMinutes: 120 }] })));
    assert.deepEqual(await ma.call("get_notification_preferences"), await json(await getPreferences(req())));
    const beforeDenied = await snapshot();
    await json(await putLock(req("PUT", { lockDate: "2026-10-17" }, keys.viewer)), 403);
    await json(await updateReminder(req("PUT", { enabled: true }, keys.viewer), params(reminder.id)), 403);
    await json(await deleteReminder(req("DELETE", undefined, keys.b), params(reminder.id)), 404);
    await denied.call("update_pipeline", { pipelineId: pipeline.id, isDefault: false }, true);
    await denied.call("delete_reminder_rule", { reminderRuleId: reminder.id }, true);
    await mb.call("get_document_template", { id: template.id }, true);
    await mb.call("get_role", { roleId: createdRole.id }, true);
    assert.deepEqual(await snapshot(), beforeDenied);
    assert.equal((await json(await getLock(req("GET", undefined, keys.b)))).periodLock, null);
    assert.deepEqual((await mb.call("list_pipelines")).pipelines, []);
    const persisted = (await db.execute(sql`select o.default_language, o.default_currency, o.mileage_rate::text, o.fiscal_year_start_month::text, p.lock_date::text,
      d.value_cents::text, d.currency from organization o join period_lock p on p.organization_id=o.id join deal d on d.organization_id=o.id where o.id=${a.id}`)).rows;
    assert.deepEqual(persisted, [{ default_language: "fa-IR", default_currency: "USD", mileage_rate: "1250", fiscal_year_start_month: "4", lock_date: "2026-09-30", value_cents: "3000000001", currency: "USD" }]);
    assert.deepEqual((await db.execute(sql`select subject_template, body_template, enabled from reminder_rule where id=${reminder.id}`)).rows, [{ subject_template: "{{contactName}}", body_template: "{{amountDue}} {{dueDate}}", enabled: false }]);
    assert.deepEqual((await db.execute(sql`select header_html, notes from document_template where id=${template.id}`)).rows, [{ header_html: "<b>{{orgName}}</b>", notes: "Saved {{invoiceNumber}}" }]);
    await ma.call("delete_deal", { dealId: deal.id });
    await json(await deletePipeline(req("DELETE"), params(pipeline.id)));
    await ma.call("delete_reminder_rule", { reminderRuleId: reminder.id });
    assert.deepEqual((await db.execute(sql`select deleted_at is not null as deleted from pipeline where id=${pipeline.id}`)).rows, [{ deleted: true }]);
    assert.deepEqual((await db.execute(sql`select deleted_at is not null as deleted from reminder_rule where id=${reminder.id}`)).rows, [{ deleted: true }]);
    assert.deepEqual((await db.execute(sql`select (select count(*)::text from journal_entry) as entries, (select count(*)::text from journal_line) as lines`)).rows, [{ entries: "0", lines: "0" }]);
    console.log("Combined settings catalogs REST/MCP/SQL verified");
  } finally { await ma.close(); await mb.close(); await denied.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
