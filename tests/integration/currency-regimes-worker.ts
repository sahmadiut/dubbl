import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, subscription, apiKey, currencyRegime } from "../../lib/db/schema";
import { GET } from "../../app/api/v1/currency-regimes/route";
import { GET as currencies, POST as createCurrency } from "../../app/api/currencies/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerCurrencyRegimeTools } from "../../lib/mcp/tools/currency-regimes";
import type { AuthContext } from "../../lib/api/auth-context";
import { IRR_CURRENT_REGIME_KEY, IRR_METADATA_SOURCE } from "../../lib/currency/irr-metadata";

async function connect(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Regime fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerCurrencyRegimeTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tool = (await client.listTools()).tools.find(tool => tool.name === "list_currency_regimes")!;
  assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
  assert.ok((tool.inputSchema.properties?.isoCode as { description?: string }).description);
  return { async call(name = "list_currency_regimes", args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    let body;
    try { body = JSON.parse(text); } catch { assert.equal(result.isError, true); body = { error: text }; }
    return { error: Boolean(result.isError), body };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Regime A", slug: "regime-a" }, { name: "Regime B", slug: "regime-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "regime-owner@example.test" }, { email: "regime-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: denied.id, customRoleId: role.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  for (const [key, org, user] of [["dk_regime_a", a.id, owner.id], ["dk_regime_b", b.id, owner.id], ["dk_regime_denied", a.id, denied.id]])
    await db.insert(apiKey).values({ organizationId: org, createdBy: user, name: key, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_regime" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await connect(ctx, true), mb = await connect({ ...ctx, organizationId: b.id }), noRead = await connect({ ...ctx, permissions: [] });
  const req = (query = "", key = "dk_regime_a") => new Request(`http://fixture.test/api/v1/currency-regimes${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  try {
    const baseline = (await db.select().from(currencyRegime)).find(row => row.organizationId === a.id)!;
    assert.equal(baseline.regimeKey, IRR_CURRENT_REGIME_KEY); assert.equal(baseline.sourceUrl, IRR_METADATA_SOURCE);
    // Synthetic future policy only: this is not an Iranian transition assertion.
    const future = { organizationId: a.id, regimeKey: "synthetic-future-test-only", isoCode: "IRR", name: "Synthetic future",
      effectiveFrom: "2099-01-01", effectiveTo: "2099-12-31", displayMinorUnits: 2, previousRegimeId: baseline.id,
      scaleToPrevious: "10000.000000000000000001", official: false, sourceUrl: "https://example.test/synthetic", verifiedOn: "2026-10-16" };
    const ledgerSnapshot = async () => (await db.execute(sql`SELECT row_to_json(t)::text AS row FROM journal_line t ORDER BY id`)).rows;
    const historic = await ledgerSnapshot();
    await db.insert(currencyRegime).values(future);
    assert.deepEqual(await ledgerSnapshot(), historic);
    const rest = await GET(req()); assert.equal(rest.status, 200);
    const payload = await rest.json(); assert.equal(payload.regimes.length, 2);
    assert.deepEqual(payload, (await ma.call()).body);
    assert.ok(payload.regimes.every((row: { organizationId: string }) => row.organizationId === a.id));
    assert.equal(payload.regimes[1].scaleToPrevious, "10000.000000000000000001");
    assert.equal(payload.regimes[1].effectiveFrom, "2099-01-01");
    const foreign = await (await GET(req("", "dk_regime_b"))).json();
    assert.equal(foreign.regimes.length, 1); assert.deepEqual(foreign, (await mb.call()).body);
    assert.deepEqual((await (await GET(req("?isoCode=USD"))).json()).regimes, []);
    assert.deepEqual(await (await GET(req("?isoCode=IRR"))).json(), (await ma.call("list_currency_regimes", { isoCode: "IRR" })).body);
    for (const query of ["?organizationId=" + b.id, "?isoCode=irr", "?isoCode=IRT&cutover=true", "?asOf=2099-01-01"]) assert.equal((await GET(req(query))).status, 400);
    for (const args of [{ organizationId: b.id }, { isoCode: "irr" }, { isoCode: "IRR", cutover: true }])
      assert.equal((await ma.call("list_currency_regimes", args)).error, true);
    assert.equal((await GET(req("", "dk_invalid"))).status, 401);
    assert.equal((await GET(req("", "dk_regime_denied"))).status, 403);
    assert.equal((await noRead.call()).error, true);
    for (const decimalPlaces of [2, 1, null, "0"]) {
      const response = await createCurrency(new NextRequest("http://fixture.test/api/currencies", { method: "POST",
        headers: { authorization: "Bearer dk_regime_a", "content-type": "application/json" },
        body: JSON.stringify({ code: "IRR", name: "Iranian Rial", symbol: "IRR", decimalPlaces }) }));
      assert.equal(response.status, 400);
    }
    const created = await createCurrency(new NextRequest("http://fixture.test/api/currencies", { method: "POST",
      headers: { authorization: "Bearer dk_regime_a", "content-type": "application/json" },
      body: JSON.stringify({ code: "IRR", name: "Iranian Rial", symbol: "IRR" }) }));
    assert.equal(created.status, 201); assert.equal((await created.json()).currency.decimalPlaces, 0);
    const currencyPayload = await (await currencies()).json();
    assert.equal(currencyPayload.currencies.find((row: { code: string }) => row.code === "IRR").decimalPlaces, 0);
    assert.equal((await ma.call("list_currencies", { search: "IRR" })).body.currencies.find((row: { code: string }) => row.code === "IRR").decimalPlaces, 0);
    // PostgreSQL independently enforces precision, direction, tenant references and immutability.
    for (const patch of [{ displayMinorUnits: -1 }, { displayMinorUnits: 5 }, { effectiveTo: "2098-12-31" },
      { scaleToPrevious: "0" }, { scaleToPrevious: "-1" }, { scaleToPrevious: "NaN" }, { scaleToPrevious: "Infinity" },
      { scaleToPrevious: "1.0000000000000000001" }, { scaleToPrevious: "100000000000000000000" },
      { scaleToPrevious: null }, { previousRegimeId: null }, { organizationId: b.id }, { isoCode: "IRT!" }]) {
      await assert.rejects(db.insert(currencyRegime).values({ ...future, regimeKey: randomUUID(), ...patch }));
    }
    const unchanged = (await db.execute(sql`SELECT row_to_json(t)::text AS row FROM currency_regime t ORDER BY id`)).rows;
    await assert.rejects(db.execute(sql`UPDATE currency_regime SET display_minor_units=2 WHERE id=${baseline.id}`));
    await assert.rejects(db.execute(sql`DELETE FROM currency_regime WHERE id=${baseline.id}`));
    assert.deepEqual((await db.execute(sql`SELECT row_to_json(t)::text AS row FROM currency_regime t ORDER BY id`)).rows, unchanged);
    await db.execute(sql`DELETE FROM organization WHERE id=${a.id}`); // Cascading tenant cleanup still works.
    assert.equal((await ma.call()).body.regimes.length, 0);
    assert.equal((await mb.call()).body.regimes.length, 1);
    console.log("Regime REST/MCP/SQL contracts verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
