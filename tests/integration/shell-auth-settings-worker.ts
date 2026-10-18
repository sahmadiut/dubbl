import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, notification } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerLocalePreferencesTools } from "../../lib/mcp/tools/locale-preferences";
import { registerOrganizationTools } from "../../lib/mcp/tools/organization";
import { registerNotificationTools } from "../../lib/mcp/tools/notifications";
import { GET as getPreferences, PATCH as patchPreferences } from "../../app/api/v1/user/locale-preferences/route";
import { POST as createTeam, GET as listTeams } from "../../app/api/v1/teams/route";
import { GET as listNotifications } from "../../app/api/v1/notifications/route";
import { loadPresentationPreferences } from "../../lib/api/locale-preferences";
import { resolvePresentation } from "../../i18n/locale";
import { PresentationProvider } from "../../i18n/provider";
import { TeamFields } from "../../components/dashboard/team-fields";
import { workspaceErrorMessage } from "../../i18n/workspace-errors";
import { sourceCallback } from "../helpers/source-callback";
import en from "../../messages/en-US.json";
import fa from "../../messages/fa-IR.json";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "LOC-006", version: "1" });
  for (const register of [registerLocalePreferencesTools, registerOrganizationTools, registerNotificationTools]) register(server, ctx);
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
  const [a, b] = await db.insert(organization).values([{ name: "Shell A", slug: "shell-a", defaultLanguage: "fa-IR", mileageRate: 1250 }, { name: "Shell B", slug: "shell-b", defaultLanguage: "en-US" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "shell-owner@example.test" }, { email: "shell-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: ["view:data"] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_shell_a", b: "dk_shell_b", viewer: "dk_shell_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyPrefix: "dk_shell", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id });
  const req = (path: string, method = "GET", body?: unknown, key = keys.a) => new Request(`http://fixture.test/api/v1/${path}`, { method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const json = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const saved = { name: "Caller <script>team</script>", description: "Saved {{name}}", color: "#3b82f6" };
  const [notice] = await db.insert(notification).values({ organizationId: a.id, userId: owner.id, type: "system_alert", title: "Saved English title", body: "Saved {{amount}} <script>" }).returning();
  try {
    for (const [locale, messages] of [["en-US", en], ["fa-IR", fa]] as const) {
      const prefs = { language: locale, timeZone: "Asia/Tehran", numerals: "latn", calendar: "gregory" };
      const expectedPreferences = { ...prefs, fontFamily: null };
      assert.deepEqual((await json(await patchPreferences(req("user/locale-preferences", "PATCH", prefs)))).preferences, expectedPreferences);
      assert.deepEqual((await ma.call("get_locale_preferences")).preferences, expectedPreferences);
      assert.deepEqual((await db.execute(sql`select language,time_zone,numerals,calendar,font_family from users where id=${owner.id}`)).rows,
        [{ language: locale, time_zone: "Asia/Tehran", numerals: "latn", calendar: "gregory", font_family: null }]);
      const presentation = resolvePresentation(await loadPresentationPreferences(owner.id, a.id));
      assert.deepEqual(presentation, { locale, timeZone: "Asia/Tehran", numerals: "latn", calendar: "gregory", fontFamily: "vazirmatn" });
      const html = renderToStaticMarkup(createElement(PresentationProvider, { presentation, messages, now: new Date("2026-10-18T00:00:00Z") },
        createElement(TeamFields, { ...saved, editing: false, onNameChange() {}, onDescriptionChange() {}, onColorChange() {} })));
      assert.ok(html.includes(messages.Teams.description));
      assert.ok(html.includes("Caller &lt;script&gt;team&lt;/script&gt;"));
      assert.ok(!html.includes("<script>"));
      for (const denied of [false, true]) {
        const failures: string[] = [], successes: string[] = [], resets: unknown[] = [];
        const run = sourceCallback("app/(dashboard)/teams/page.tsx", "handleCreateTeam", {
          t: createTranslator({ locale, messages, namespace: "Teams" }), errors: createTranslator({ locale, messages, namespace: "WorkspaceErrors" }), workspaceErrorMessage,
          localStorage: { getItem: () => a.id }, createName: `  ${saved.name}  `, createDesc: saved.description, createColor: saved.color,
          setCreateSaving() {}, setCreateOpen: (value: boolean) => resets.push(value), setCreateName: (value: string) => resets.push(value), setCreateDesc() {}, setCreateColor() {}, fetchTeams() {},
          toast: { error: (value: string) => failures.push(value), success: (value: string) => successes.push(value) },
          fetch: async (path: string, init: RequestInit) => {
            assert.equal(path, "/api/v1/teams"); assert.equal(init.method, "POST");
            assert.equal((init.headers as Record<string, string>)["x-organization-id"], a.id);
            return createTeam(req("teams", "POST", JSON.parse(init.body as string), denied ? keys.viewer : keys.a));
          },
        });
        await run();
        assert.deepEqual(failures, denied ? [messages.WorkspaceErrors.forbidden] : []);
        assert.deepEqual(successes, denied ? [] : [messages.Teams.teamCreated]);
        assert.deepEqual(resets, denied ? [] : [false, ""]);
      }
      const rest = await json(await listNotifications(req("notifications")));
      const mcp = await ma.call("list_notifications");
      assert.deepEqual(rest.data, mcp.notifications);
      assert.equal(rest.data[0].title, notice.title); assert.equal(rest.data[0].body, notice.body);
      assert.deepEqual((await mb.call("list_notifications")).notifications, []);
      await mb.call("mark_notification_read", { notificationId: notice.id }, true);
      assert.deepEqual((await db.execute(sql`select read_at from notification where id=${notice.id}`)).rows, [{ read_at: null }]);
    }
    await ma.call("update_locale_preferences", { language: null });
    assert.equal((await json(await getPreferences(req("user/locale-preferences")))).preferences.language, null);
    assert.equal(resolvePresentation(await loadPresentationPreferences(owner.id, a.id)).locale, "fa-IR");
    assert.equal(resolvePresentation(await loadPresentationPreferences(owner.id, b.id)).locale, "en-US");
    assert.equal((await loadPresentationPreferences(viewer.id, b.id)).organizationLanguage, undefined);
    assert.deepEqual((await json(await listTeams(req("teams", "GET", undefined, keys.b)))).data, []);
    assert.deepEqual((await db.execute(sql`select name,description,color from team where organization_id=${a.id} order by created_at`)).rows, [saved, saved]);
    assert.deepEqual((await db.execute(sql`select default_currency,mileage_rate::text from organization where id=${a.id}`)).rows, [{ default_currency: "USD", mileage_rate: "1250" }]);
    assert.deepEqual((await db.execute(sql`select (select count(*)::text from journal_entry) as entries,(select count(*)::text from journal_line) as lines`)).rows, [{ entries: "0", lines: "0" }]);
    console.log("Shell auth settings REST/MCP/SQL verified");
  } finally { await ma.close(); await mb.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
