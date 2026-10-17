import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, documentTemplate, contact, stripeIntegration, chartAccount, bankAccount } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { GET as list, POST as create } from "../../app/api/v1/document-templates/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/document-templates/[id]/route";
import { POST as empty } from "../../app/api/v1/trash/empty/route";
import { GET as billing } from "../../app/api/v1/billing/route";
import { POST as portal } from "../../app/api/v1/billing/portal/route";
import { PATCH as mapping } from "../../app/api/v1/integrations/stripe/settings/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Settings", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, args: object = {}) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Settings A", slug: "settings-a" }, { name: "Settings B", slug: "settings-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "settings-owner@example.test" }, { email: "settings-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Denied", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "owner", customRoleId: role.id }]);
  const keys = { a: "dk_settings_a", b: "dk_settings_b", denied: "dk_settings_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_settings", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, permissions: [] });
  const request = (method = "GET", body?: unknown, key = keys.a) => new Request("http://fixture.test/settings", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const json = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const good = async (name: string, args: object = {}) => { const result = await ma.call(name, args); assert.equal(result.error, false, JSON.stringify(result)); return result.body; };
  const snapshot = async () => (await db.execute(sql`select id::text, name, type::text, is_default, deleted_at::text, header_html, footer_html, notes from document_template order by id`)).rows;
  try {
    const names = ["list_document_templates", "get_document_template", "create_document_template", "update_document_template", "delete_document_template", "empty_trash", "get_billing_settings", "create_billing_portal", "update_stripe_settings"];
    for (const name of names) {
      const tool = ma.tools.find(t => t.name === name)!; assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
      assert.equal((await ma.call(name, { surprise: true })).error, true);
    }
    const summary = await json(await billing(request()));
    assert.deepEqual(await good("get_billing_settings"), summary);
    assert.equal(summary.selfHosted, true); assert.equal(summary.billing.plan, "free");
    assert.equal(summary.billing.storageUsedBytes, 0); assert.equal(summary.billing.emailsSentThisMonth, 0);
    await json(await portal(request("POST")), 404);
    assert.equal((await ma.call("create_billing_portal")).body.status, 404);
    const [ledger, foreignLedger, deletedLedger] = await db.insert(chartAccount).values([
      { organizationId: a.id, name: "Owned", code: "1000", type: "asset" },
      { organizationId: b.id, name: "Foreign", code: "1000", type: "asset" },
      { organizationId: a.id, name: "Deleted", code: "1001", type: "asset", deletedAt: new Date() },
    ]).returning();
    const [bank, foreignBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Owned", currencyCode: "USD" },
      { organizationId: b.id, accountName: "Foreign", currencyCode: "USD" }]).returning();
    const [integration] = await db.insert(stripeIntegration).values({ organizationId: a.id, stripeAccountId: "acct_settings", accessToken: "fixture_secret", refreshToken: "refresh_secret", webhookSecret: "webhook_secret" }).returning();
    const mapArgs = { integrationId: integration.id, clearingAccountId: ledger.id, payoutBankAccountId: bank.id, initialSyncDays: 60 };
    const mapped = await json(await mapping(request("PATCH", mapArgs)));
    assert.equal(mapped.clearingAccountId, ledger.id); assert.equal(mapped.initialSyncDays, 60);
    assert.ok(!JSON.stringify(mapped).includes("secret"));
    const mcpMapped = await good("update_stripe_settings", { integrationId: integration.id, revenueAccountId: ledger.id, initialSyncDays: 90 });
    assert.equal(mcpMapped.clearingAccountId, ledger.id); assert.equal(mcpMapped.revenueAccountId, ledger.id);
    assert.ok(!JSON.stringify(mcpMapped).includes("secret"));
    const mappingSnapshot = async () => (await db.execute(sql`select clearing_account_id::text, revenue_account_id::text, payout_bank_account_id::text, initial_sync_days::text, access_token from stripe_integration where id=${integration.id}`)).rows;
    const mappingBefore = await mappingSnapshot();
    assert.deepEqual(mappingBefore, [{ clearing_account_id: ledger.id, revenue_account_id: ledger.id, payout_bank_account_id: bank.id, initial_sync_days: "90", access_token: "fixture_secret" }]);
    for (const changes of [{ clearingAccountId: foreignLedger.id }, { feesAccountId: deletedLedger.id }, { payoutBankAccountId: foreignBank.id }]) {
      await json(await mapping(request("PATCH", { integrationId: integration.id, ...changes })), 404);
      assert.equal((await ma.call("update_stripe_settings", { integrationId: integration.id, ...changes })).body.status, 404);
    }
    await json(await mapping(request("PATCH", mapArgs, keys.denied)), 403);
    await json(await mapping(request("PATCH", mapArgs, keys.b)), 404);
    assert.equal((await no.call("update_stripe_settings", mapArgs)).body.status, 403);
    assert.equal((await mb.call("update_stripe_settings", mapArgs)).body.status, 404);
    await json(await mapping(request("PATCH", { integrationId: integration.id, initialSyncDays: 366 })), 400);
    assert.deepEqual(await mappingSnapshot(), mappingBefore);
    const saved = { name: 'Caller <script> & {{name}}', type: "invoice", headerHtml: "<b>{{invoiceNumber}}</b>", notes: "Saved notes", isDefault: true };
    const first = (await json(await create(request("POST", saved)), 201)).template;
    const second = (await good("create_document_template", { ...saved, name: "Second" })).template;
    assert.deepEqual((await snapshot()).map(r => [r.id, r.is_default]).sort(), [[first.id, false], [second.id, true]].sort());
    assert.equal((await good("get_document_template", { id: first.id })).template.headerHtml, saved.headerHtml);
    assert.equal((await json(await get(request(), params(second.id)))).template.name, "Second");
    assert.deepEqual((await good("list_document_templates")).templates, (await json(await list(request()))).templates);
    assert.deepEqual((await mb.call("list_document_templates")).body.templates, []);
    assert.deepEqual((await json(await list(request("GET", undefined, keys.b)))).templates, []);
    const third = (await good("create_document_template", { name: "Quote", type: "quote", isDefault: true })).template;
    await json(await update(request("PATCH", { isDefault: true, notes: null }), params(first.id)));
    await good("update_document_template", { id: first.id, footerHtml: "Literal {{total}}", name: "Changed" });
    const persisted = await snapshot();
    assert.deepEqual(persisted.find(r => r.id === first.id), { id: first.id, name: "Changed", type: "invoice", is_default: true, deleted_at: null,
      header_html: saved.headerHtml, footer_html: "Literal {{total}}", notes: null });
    assert.equal(persisted.find(r => r.id === second.id)!.is_default, false);
    assert.equal(persisted.find(r => r.id === third.id)!.is_default, true);
    const before = await snapshot();
    for (const [tool, args] of [["get_document_template", { id: first.id }], ["update_document_template", { id: first.id, name: "Foreign" }], ["delete_document_template", { id: first.id }]] as const) {
      assert.equal((await mb.call(tool, args)).body.status, 404);
    }
    for (const key of [keys.b, "dk_invalid"]) {
      const status = key === keys.b ? 404 : 401;
      await json(await get(request("GET", undefined, key), params(first.id)), status);
      await json(await update(request("PATCH", { name: "Foreign" }, key), params(first.id)), status);
      await json(await remove(request("DELETE", undefined, key), params(first.id)), status);
    }
    for (const [tool, args] of [["create_document_template", saved], ["update_document_template", { id: first.id, name: "Denied" }], ["delete_document_template", { id: first.id }], ["empty_trash", { confirm: true }]] as const) assert.equal((await no.call(tool, args)).body.status, 403);
    await json(await create(request("POST", saved, keys.denied)), 403);
    await json(await update(request("PATCH", { name: "Denied" }, keys.denied), params(first.id)), 403);
    await json(await remove(request("DELETE", undefined, keys.denied), params(first.id)), 403);
    await json(await empty(request("POST", undefined, keys.denied)), 403);
    for (const input of [{ name: "", type: "invoice" }, { name: "Bad", type: "future" }]) await json(await create(request("POST", input)), 400);
    assert.equal((await ma.call("update_document_template", { id: first.id, type: "quote" })).error, true);
    await json(await get(request(), params("bad")), 400);
    await json(await get(request(), params(randomUUID())), 404);
    assert.deepEqual(await snapshot(), before);
    await good("delete_document_template", { id: first.id });
    await json(await remove(request("DELETE"), params(second.id)));
    assert.ok((await snapshot()).filter(r => [first.id, second.id].includes(r.id as string)).every(r => r.deleted_at !== null));
    await json(await get(request(), params(first.id)), 404);
    assert.equal((await ma.call("get_document_template", { id: second.id })).body.status, 404);
    assert.equal((await good("list_document_templates")).templates.length, 1);
    const [foreign] = await db.insert(documentTemplate).values({ organizationId: b.id, name: "Foreign trash", type: "invoice", deletedAt: new Date() }).returning();
    const [trashed, live] = await db.insert(contact).values([{ organizationId: a.id, name: "Old trash", deletedAt: new Date("2020-01-01") }, { organizationId: a.id, name: "Live" }]).returning();
    // Inject a failure late in the loop to prove early deletions are rolled back.
    await db.execute(sql`create function fixture_fail_purge() returns trigger language plpgsql as $$ begin raise exception 'fixture purge failure'; end $$`);
    await db.execute(sql`create trigger fixture_fail_purge before delete on document_template for each row execute function fixture_fail_purge()`);
    const preFailure = await snapshot();
    await json(await empty(request("POST")), 500);
    assert.equal((await ma.call("empty_trash", { confirm: true })).error, true);
    assert.deepEqual(await snapshot(), preFailure);
    assert.equal((await db.execute(sql`select count(*)::text as n from contact where id=${trashed.id}`)).rows[0].n, "1");
    await db.execute(sql`drop trigger fixture_fail_purge on document_template`);
    await db.execute(sql`drop function fixture_fail_purge()`);
    for (const input of [{}, { confirm: false }, { confirm: true, entityType: "contact" }]) assert.equal((await ma.call("empty_trash", input)).error, true);
    await good("empty_trash", { confirm: true });
    assert.deepEqual((await snapshot()).map(r => r.id).sort(), [third.id, foreign.id].sort());
    assert.deepEqual((await db.execute(sql`select id::text from contact order by id`)).rows.map(r => r.id), [live.id]);
    // Exercise REST success with another record, including trash older than the list view.
    await db.update(contact).set({ deletedAt: new Date("2020-01-01") }).where(eq(contact.id, live.id));
    await json(await empty(request("POST")));
    assert.equal((await db.execute(sql`select count(*)::text as n from contact`)).rows[0].n, "0");
    assert.ok((await snapshot()).some(r => r.id === foreign.id));
    await Promise.all([
      good("create_document_template", { name: "Concurrent MCP", type: "receipt", isDefault: true }),
      json(await create(request("POST", { name: "Concurrent REST", type: "receipt", isDefault: true })), 201),
    ]);
    assert.equal((await db.execute(sql`select count(*)::text as n from document_template where organization_id=${a.id} and type='receipt' and is_default and deleted_at is null`)).rows[0].n, "1");
    const audit = (await db.execute(sql`select action, entity_type, count(*)::text as n from audit_log where organization_id=${a.id} group by action, entity_type`)).rows;
    for (const action of ["create", "update", "delete"]) assert.ok(audit.some(r => r.action === action && r.entity_type === "document_template"));
    assert.equal(audit.find(r => r.action === "purge" && r.entity_type === "organization")!.n, "2");
    console.log("Settings provider/data integration verified");
  } finally { await ma.close(); await mb.close(); await no.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
