import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey } from "../../lib/db/schema";
import { POST, GET } from "../../app/api/v1/accounts/route";
import { registerAccountTools } from "../../lib/mcp/tools/accounts";
import type { AuthContext } from "../../lib/api/auth-context";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Accounts fixture", version: "1" });
  registerAccountTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [irr, usd] = await db.insert(organization).values([
    { name: "Rial", slug: "account-rial", defaultCurrency: "IRR" },
    { name: "Dollar", slug: "account-dollar", defaultCurrency: "USD" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "account-owner@example.test" }, { email: "account-viewer@example.test" }]).returning();
  await db.insert(member).values([{ organizationId: irr.id, userId: owner.id, role: "owner" }, { organizationId: usd.id, userId: owner.id, role: "owner" }]);
  for (const org of [irr, usd]) await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: org.name,
    keyHash: createHash("sha256").update(`dk_${org.slug}`).digest("hex"), keyPrefix: "dk_account" });
  const req = (org: typeof irr, body?: unknown) => new Request("http://fixture.test/api/v1/accounts", {
    method: body ? "POST" : "GET", headers: { authorization: `Bearer dk_${org.slug}`, "content-type": "application/json", "x-organization-id": org.id === irr.id ? usd.id : irr.id },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const ma = await connect({ userId: owner.id, organizationId: irr.id, role: "owner" });
  const mb = await connect({ userId: owner.id, organizationId: usd.id, role: "owner" });
  const ro = await connect({ userId: viewer.id, organizationId: irr.id, role: "member", permissions: [] });
  try {
    for (const [org, mcp] of [[irr, ma], [usd, mb]] as const) {
      const created = await POST(req(org, { code: "9001", name: "Custom", type: "expense" }));
      assert.equal(created.status, 201); const { account } = await created.json();
      assert.equal(account.currencyCode, org.defaultCurrency); assert.equal(account.organizationId, org.id);
      const mc = await mcp.call("create_account", { code: "9002", name: "Custom MCP", type: "asset" });
      assert.equal(mc.isError, false); assert.equal(mc.body.account.currencyCode, org.defaultCurrency);
      assert.equal(mc.body.account.organizationId, org.id);
      const explicit = await POST(req(org, { code: "9003", name: "Foreign", type: "asset", currencyCode: " eur " }));
      assert.equal(explicit.status, 201); assert.equal((await explicit.json()).account.currencyCode, "EUR");
      const explicitMcp = await mcp.call("create_account", { code: "9004", name: "Foreign MCP", type: "asset", currencyCode: " eur " });
      assert.equal(explicitMcp.isError, false); assert.equal(explicitMcp.body.account.currencyCode, "EUR");
      assert.equal((await POST(req(org, { code: "9005", name: "Invalid", type: "asset", currencyCode: "bad" }))).status, 400);
      assert.equal((await mcp.call("create_account", { code: "9006", name: "Invalid MCP", type: "asset", currencyCode: "bad" })).isError, true);
      const list = await GET(req(org)); assert.equal(list.status, 200);
      const cash = (await list.json()).accounts.find((row: { code: string }) => row.code === "1000");
      assert.equal(cash.name, "Cash"); assert.equal(cash.currencyCode, org.defaultCurrency);
      const localized = await mcp.call("list_accounts", { locale: "fa-IR" });
      assert.equal(localized.isError, false);
      const displayCash = localized.body.accounts.find((row: { code: string }) => row.code === "1000");
      assert.equal(displayCash.id, cash.id); assert.equal(displayCash.name, "Cash"); assert.equal(displayCash.displayName, "صندوق");
      assert.ok(localized.body.accounts.every((row: { organizationId: string }) => row.organizationId === org.id));
      const custom = localized.body.accounts.find((row: { code: string }) => row.code === "9001"); assert.equal(custom.displayName, "Custom");
      const canonical = await mcp.call("list_accounts", {});
      assert.ok(canonical.body.accounts.every((row: object) => !Object.hasOwn(row, "displayName")));
      const en = await mcp.call("list_accounts", { locale: "en-US" });
      assert.equal(en.body.accounts.find((row: { code: string }) => row.code === "1000").displayName, "Cash");
    }
    const before = await db.execute(sql`select count(*)::text n from chart_account`);
    assert.equal((await ro.call("create_account", { code: "9999", name: "Denied", type: "asset" })).isError, true);
    assert.equal((await POST(new Request("http://fixture.test/api/v1/accounts", { method: "POST", headers: { authorization: "Bearer dk_invalid" }, body: "{}" }))).status, 401);
    assert.deepEqual((await db.execute(sql`select count(*)::text n from chart_account`)).rows, before.rows);
    console.log("Account defaults and localized identities verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
