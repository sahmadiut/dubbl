import assert from "node:assert/strict";
import { mock } from "node:test";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, apiKey, chartAccount } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { dateOnlyToDate, dateToDateOnly, formatDateOnly, formatInstant } from "../../i18n/dates";
import { resolvePresentation } from "../../i18n/locale";

// Stub request/session access only. All authorization, registered tools,
// service logic, organization settings, persistence and audit use real code/DB.
let sessionUserId: string | undefined;
const requestCookies = new Map<string, string>();
let acceptLanguage = "fa-IR";
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, {
  namedExports: { auth: async () => sessionUserId ? { user: { id: sessionUserId }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 60000).toISOString() } : null },
});
mock.module("next/headers", { namedExports: {
  cookies: async () => ({ get: (name: string) => requestCookies.has(name) ? { value: requestCookies.get(name) } : undefined }),
  headers: async () => new Headers({ "accept-language": acceptLanguage }),
} });

async function run() {
  const { GET, PATCH } = await import("../../app/api/v1/user/locale-preferences/route");
  const { PATCH: patchOrganization } = await import("../../app/api/v1/organization/route");
  const { registerAllTools } = await import("../../lib/mcp/tools");
  const { getPresentation } = await import("../../i18n/server");
  const { loadPresentationPreferences } = await import("../../lib/api/locale-preferences");
  const { POST: createEntry } = await import("../../app/api/v1/entries/route");
  const [a, b] = await db.insert(organization).values([
    { name: "Locale A", slug: "locale-a", defaultCurrency: "USD", defaultLanguage: "en-US" },
    { name: "Locale B", slug: "locale-b", defaultCurrency: "KWD", defaultLanguage: "fa-IR" },
  ]).returning();
  const [owner, viewer, foreign] = await db.insert(users).values([
    { email: "locale-owner@example.test" }, { email: "locale-viewer@example.test" }, { email: "locale-foreign@example.test", language: "en-US" },
  ]).returning();
  await db.insert(member).values([
    { userId: owner.id, organizationId: a.id, role: "owner" },
    { userId: owner.id, organizationId: b.id, role: "owner" },
    { userId: viewer.id, organizationId: a.id, role: "member" },
    { userId: foreign.id, organizationId: b.id, role: "owner" },
  ]);
  for (const [key, userId, orgId] of [["dk_locale_owner", owner.id, a.id], ["dk_locale_viewer", viewer.id, a.id], ["dk_locale_foreign", foreign.id, b.id]]) {
    await db.insert(apiKey).values({ createdBy: userId, organizationId: orgId, name: key, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_locale" });
  }
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const server = new McpServer({ name: "Locale fixture", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Locale fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some(tool => tool.name === "get_locale_preferences"));
  assert.ok(tools.some(tool => tool.name === "update_locale_preferences"));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  };
  const req = (body?: unknown, key = "dk_locale_owner", path = "user/locale-preferences") => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "PATCH", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const rest = async (body: unknown, key?: string) => {
    const response = await PATCH(req(body, key)); assert.equal(response.status, 200); return response.json();
  };
  const stored = async () => (await db.execute(sql`select language,time_zone,numerals,calendar,font_family from users where id=${owner.id}`)).rows[0];
  const snapshot = async () => (await db.execute(sql`select (select jsonb_agg(to_jsonb(u) order by id)::text from users u) as users, (select jsonb_agg(to_jsonb(o) order by id)::text from organization o) as orgs, (select jsonb_agg(to_jsonb(a) order by id)::text from audit_log a) as audit`)).rows;
  try {
    const blank = { language: null, timeZone: null, numerals: null, calendar: null, fontFamily: null };
    assert.equal((await loadPresentationPreferences(viewer.id)).organizationLanguage, "en-US");
    assert.equal((await loadPresentationPreferences(owner.id)).organizationLanguage, undefined);
    assert.deepEqual((await (await GET(req())).json()).preferences, blank);
    assert.deepEqual((await call("get_locale_preferences")).body.preferences, blank);
    const prefs = { language: "fa-IR", timeZone: "America/New_York", numerals: "latn", calendar: "gregory", fontFamily: "abar" };
    assert.deepEqual((await rest(prefs)).preferences, prefs);
    assert.deepEqual((await call("get_locale_preferences")).body.preferences, prefs);
    assert.deepEqual(await stored(), { language: "fa-IR", time_zone: "America/New_York", numerals: "latn", calendar: "gregory", font_family: "abar" });
    assert.deepEqual((await call("update_locale_preferences", { language: "en-US" })).body.preferences, { ...prefs, language: "en-US" });
    assert.deepEqual((await (await GET(req())).json()).preferences, { ...prefs, language: "en-US" });
    for (const bad of [{}, { language: "fa" }, { timeZone: "Tehran" }, { numerals: "arab" }, { calendar: "islamic" }, { fontFamily: "unknown" }, { fontFamily: "../abar" }, { language: "fa-IR", userId: foreign.id }, { currency: "IRR" }]) {
      const before = await snapshot();
      assert.equal((await PATCH(req(bad))).status, 400);
      assert.equal((await call("update_locale_preferences", bad)).isError, true);
      assert.deepEqual(await snapshot(), before);
    }
    const malformed = new Request("http://fixture.test/api/v1/user/locale-preferences", { method: "PATCH", headers: { authorization: "Bearer dk_locale_owner" }, body: "{" });
    assert.equal((await PATCH(malformed)).status, 400);
    // API-key org wins over the hostile header; each user can only set themself.
    await rest({ language: "fa-IR" }, "dk_locale_viewer");
    assert.equal((await db.select().from(users).where(eq(users.id, foreign.id)))[0].language, "en-US");
    assert.equal((await db.select().from(users).where(eq(users.id, viewer.id)))[0].language, "fa-IR");
    assert.equal((await GET(req(undefined, "dk_invalid"))).status, 401);
    assert.equal((await GET(new Request("http://fixture.test/api/v1/user/locale-preferences"))).status, 401);

    // Existing org update handles language with the same role/audit policy.
    assert.equal((await patchOrganization(req({ defaultLanguage: "fa-IR" }, "dk_locale_viewer", "organization"))).status, 403);
    assert.equal((await patchOrganization(req({ defaultLanguage: "fa" }, "dk_locale_owner", "organization"))).status, 400);
    assert.equal((await patchOrganization(req({ defaultLanguage: "fa-IR" }, "dk_locale_owner", "organization"))).status, 200);
    assert.equal((await call("update_organization", { defaultLanguage: "en-US" })).isError, false);
    assert.equal((await call("update_organization", { defaultLanguage: "xx" })).isError, true);

    sessionUserId = owner.id;
    requestCookies.set("DUBBL_ORGANIZATION", a.id); requestCookies.set("DUBBL_LOCALE", "fa-IR");
    assert.equal((await getPresentation()).locale, "en-US"); // user > org/cookie/header
    assert.equal((await getPresentation()).fontFamily, "abar");
    assert.equal((await call("update_locale_preferences", { fontFamily: "iransansx" })).isError, false);
    assert.equal((await stored()).font_family, "iransansx");
    assert.equal((await getPresentation()).fontFamily, "iransansx");
    assert.equal((await (await GET(req())).json()).preferences.fontFamily, "iransansx");
    await rest(blank);
    assert.deepEqual((await getPresentation()), { locale: "en-US", timeZone: "UTC", numerals: "latn", calendar: "gregory", fontFamily: "vazirmatn" });
    requestCookies.set("DUBBL_ORGANIZATION", b.id);
    assert.equal((await getPresentation()).locale, "fa-IR"); // switch organization
    sessionUserId = viewer.id;
    await rest({ language: null }, "dk_locale_viewer");
    assert.equal((await loadPresentationPreferences(viewer.id, b.id)).organizationLanguage, undefined); // foreign cookie
    requestCookies.set("DUBBL_LOCALE", "en-US");
    assert.equal((await getPresentation()).locale, "en-US");
    requestCookies.set("DUBBL_ORGANIZATION", "malformed");
    requestCookies.set("DUBBL_LOCALE", "invalid");
    assert.equal((await getPresentation()).locale, "fa-IR"); // header
    sessionUserId = undefined; acceptLanguage = "de-DE";
    assert.equal((await getPresentation()).locale, "en-US");
    sessionUserId = owner.id;
    requestCookies.set("DUBBL_ORGANIZATION", b.id);
    await db.update(organization).set({ deletedAt: new Date() }).where(eq(organization.id, b.id));
    assert.equal((await loadPresentationPreferences(owner.id, b.id)).organizationLanguage, undefined);
    // Legacy malformed saved preferences fail closed to supported fallbacks.
    await db.update(users).set({ language: "unsupported", timeZone: "invalid", numerals: "bad", calendar: "bad", fontFamily: "unknown" }).where(eq(users.id, owner.id));
    assert.equal((await getPresentation()).locale, "en-US");
    assert.equal((await getPresentation()).timeZone, "UTC");
    assert.equal((await getPresentation()).fontFamily, "vazirmatn");
    await rest(blank);
    assert.deepEqual(await stored(), { language: null, time_zone: null, numerals: null, calendar: null, font_family: null });
    const audit = (await db.execute(sql`select changes from audit_log where entity_type='locale_preferences' and entity_id=${owner.id} order by created_at limit 1`)).rows[0];
    assert.ok(JSON.stringify(audit.changes).includes("America/New_York"));
    assert.deepEqual((await db.execute(sql`select default_currency,mileage_rate::text from organization where id=${a.id}`)).rows[0], { default_currency: "USD", mileage_rate: "67" });

    // LOC-004: dates produced by the shared picker remain Gregorian through
    // real business REST/MCP writes, independent of all presentation settings.
    const [account] = await db.insert(chartAccount).values({ organizationId: a.id, name: "Calendar cash", code: "100", type: "asset" }).returning();
    const lines = [{ accountId: account.id, debitAmountMinor: "1250" }, { accountId: account.id, creditAmountMinor: "1250" }];
    const entryRequest = (body: unknown) => new Request("http://fixture.test/api/v1/entries", {
      method: "POST", headers: { authorization: "Bearer dk_locale_owner", "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const dateSnapshot = async () => (await db.execute(sql`select id,date::text,created_at::text from journal_entry where organization_id=${a.id} order by id`)).rows;
    for (const language of ["en-US", "fa-IR"] as const) for (const calendar of ["gregory", "persian"]) {
      const preferences = { language, calendar, timeZone: "America/Los_Angeles", numerals: "latn" };
      const before = await dateSnapshot();
      await rest(preferences);
      assert.equal((await call("update_locale_preferences", { timeZone: "Asia/Tehran" })).isError, false);
      assert.deepEqual(await dateSnapshot(), before);
      const presentation = resolvePresentation({ user: preferences });
      for (const value of ["2021-03-20", "2021-03-21", "2024-02-29", "2024-03-20", "2025-03-20", "2025-03-21"]) {
        const date = dateToDateOnly(dateOnlyToDate(value)!);
        const payload = { date, description: "Calendar canonical date", lines };
        const response = await createEntry(entryRequest(payload));
        assert.equal(response.status, 201);
        const restEntry = (await response.json()).entry;
        const mcp = await call("create_entry", payload);
        assert.equal(mcp.isError, false);
        assert.equal(restEntry.date, value);
        assert.equal(mcp.body.entry.date, value);
        const rows = (await db.execute(sql`select date::text,created_at::text from journal_entry where id in (${restEntry.id},${mcp.body.entry.id})`)).rows;
        assert.equal(rows.length, 2);
        for (const row of rows) assert.equal(row.date, value);
        const instant = new Date(restEntry.createdAt), canonicalInstant = instant.toISOString();
        formatInstant(instant, presentation);
        assert.equal(instant.toISOString(), canonicalInstant);
        const storedLines = (await db.execute(sql`select debit_amount::text,credit_amount::text from journal_line where journal_entry_id=${restEntry.id}`)).rows;
        assert.equal(storedLines.reduce((sum, line) => sum + BigInt(String(line.debit_amount)), 0n), 1250n);
        assert.equal(storedLines.reduce((sum, line) => sum + BigInt(String(line.credit_amount)), 0n), 1250n);
      }
      for (const date of [formatDateOnly("2024-03-20", presentation), "۱۴۰۳/۰۱/۰۱", "1403/01/01", "2024-03-20T00:00:00Z"]) {
        const before = await dateSnapshot();
        assert.equal((await createEntry(entryRequest({ date, lines }))).status, 400);
        assert.equal((await call("create_entry", { date, lines })).isError, true);
        assert.deepEqual(await dateSnapshot(), before);
      }
    }
    // Revoked membership is checked even by an already registered MCP session.
    await db.delete(member).where(andScope(owner.id, a.id));
    assert.equal((await call("get_locale_preferences")).body.status, 403);
    assert.equal((await call("update_locale_preferences", { language: "fa-IR" })).body.status, 403);
    console.log("Locale REST, MCP, request resolution and SQL verified");
  } finally { await client.close(); await server.close(); }
}
function andScope(userId: string, orgId: string) { return sql`${member.userId}=${userId} and ${member.organizationId}=${orgId}`; }
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
