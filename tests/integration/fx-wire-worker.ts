// Invoked only with a disposable migrated fixture database by fx-wire.test.ts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, exchangeRate, auditLog } from "../../lib/db/schema";
import { GET, POST } from "../../app/api/v1/exchange-rates/route";
import { PUT, DELETE } from "../../app/api/v1/exchange-rates/[id]/route";
import { registerCurrencyTools } from "../../lib/mcp/tools/currencies";
import type { AuthContext } from "../../lib/api/auth-context";

type Result = { content: { text: string }[]; isError?: boolean };
function tools(ctx: AuthContext) {
  const registered = new Map<string, { schema: z.ZodObject; handler: (input: unknown) => Promise<Result> }>();
  const server = { tool(name: string, _description: string, shape: z.ZodRawShape, handler: (input: unknown) => Promise<Result>) {
    registered.set(name, { schema: z.object(shape), handler });
  } } as unknown as McpServer;
  registerCurrencyTools(server, ctx);
  return async (name: string, input: unknown) => {
    const tool = registered.get(name)!;
    const result = await tool.handler(tool.schema.parse(input));
    return { ...result, body: JSON.parse(result.content[0].text) };
  };
}
const aliases = { baseCurrency: "USD", targetCurrency: "EUR", date: "2026-10-02" };

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "FX wire A", slug: "fx-wire-a" }, { name: "FX wire B", slug: "fx-wire-b" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { name: "Synthetic owner", email: "fx-wire-owner@example.test" },
    { name: "Synthetic viewer", email: "fx-wire-viewer@example.test" },
  ]).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member" },
    { organizationId: b.id, userId: owner.id, role: "owner" },
  ]);
  const keys = { a: "dk_synthetic_fx_wire_a", b: "dk_synthetic_fx_wire_b", viewer: "dk_synthetic_fx_wire_viewer" };
  for (const [name, key] of Object.entries(keys)) {
    await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
      createdBy: name === "viewer" ? viewer.id : owner.id, name,
      keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_synthetic" });
  }
  function request(method: string, body?: unknown, key = keys.a, query = "") {
    return new Request(`http://fixture.test/api/v1/exchange-rates${query}`, { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      body: body === undefined ? undefined : JSON.stringify(body) });
  }
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const rows = () => db.select().from(exchangeRate).orderBy(exchangeRate.id);
  const audits = () => db.select().from(auditLog).orderBy(auditLog.id);
  const baseline = async () => ({ rows: await rows(), audits: await audits() });
  const ctxA = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const callA = tools(ctxA), callB = tools({ ...ctxA, organizationId: b.id });

  // REST legacy/scaled and exact aliases, bulk validation and persisted trigger metadata.
  let response = await POST(request("POST", { rates: [{ ...aliases, rate: 900000 }] }));
  assert.equal(response.status, 201);
  let saved = (await response.json()).exchangeRates[0];
  const id = saved.id;
  assert.equal(saved.organizationId, a.id, "API key scope wins over an arbitrary org header");
  assert.equal(saved.rate, 900000); assert.equal(saved.rateExact, "0.9");
  assert.equal(saved.rateDirection, "quote_per_base"); assert.equal(saved.rateMigrationStatus, "exact");
  response = await POST(request("POST", { rates: [{ ...aliases, rateExact: "1.2500000" }] }));
  assert.equal(response.status, 201);
  saved = (await response.json()).exchangeRates[0];
  assert.equal(saved.id, id); assert.equal(saved.rate, 1250000); assert.equal(saved.rateExact, "1.25");
  await db.insert(exchangeRate).values({ organizationId: b.id, ...aliases, rate: 400000 });
  for (const rate of [1, 2147483647]) {
    response = await POST(request("POST", { rates: [{ ...aliases, rate }] }));
    assert.equal(response.status, 201); assert.equal((await response.json()).exchangeRates[0].rate, rate);
  }
  for (const [value, status] of [
    [{ rate: 2147483648 }, 400], [{ rate: Number.MAX_SAFE_INTEGER + 1 }, 400], [{ rate: 0 }, 400],
    [{ rate: 1000000, rateExact: "2" }, 400], [{ rateExact: "1e0" }, 400],
    [{ rateExact: "1500000" }, 422], [{ rateExact: "1.0000001" }, 422],
    [{ rateExact: "0.000000000000000001" }, 422],
    [{ rateExact: "1", rateDirection: "base_per_quote" }, 400],
  ] as const) {
    const before = await baseline();
    response = await POST(request("POST", { rates: [{ ...aliases, targetCurrency: "GBP", rate: 700000 }, { ...aliases, ...value }] }));
    assert.equal(response.status, status);
    if (status === 422) assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
    assert.deepEqual(await baseline(), before, "No rate or audit writes from invalid bulk input");
  }
  let before = await baseline();
  response = await POST(request("POST", { rates: [{ ...aliases, rateExact: "1" }] }, keys.viewer));
  assert.equal(response.status, 403); assert.deepEqual(await baseline(), before);
  response = await POST(request("POST", { rates: [{ ...aliases, rateExact: "1" }] }, "dk_invalid"));
  assert.equal(response.status, 401); assert.deepEqual(await baseline(), before);

  // Update aliases preserve id/day, remove stale provider provenance, audit and isolate tenants.
  await db.update(exchangeRate).set({ source: "api", provider: "synthetic", providerBase: "USD", providerQuote: "0.8",
    providerObservedAt: new Date("2026-10-02T00:00:00Z"), importedAt: new Date("2026-10-02T01:00:00Z"),
    providerRounding: "synthetic" }).where(eq(exchangeRate.id, id));
  response = await PUT(request("PUT", { rateExact: "0.8000" }), params(id));
  assert.equal(response.status, 200); saved = (await response.json()).exchangeRate;
  assert.equal(saved.rate, 800000); assert.equal(saved.rateExact, "0.8"); assert.equal(saved.source, "manual");
  for (const field of ["provider", "providerBase", "providerQuote", "providerObservedAt", "importedAt", "providerRounding"]) assert.equal(saved[field], null);
  response = await PUT(request("PUT", { rate: 900000, rateExact: "0.9" }), params(id));
  assert.equal(response.status, 200);
  response = await PUT(request("PUT", { rate: 1000000 }), params(id));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).exchangeRate.rateExact, "1");
  for (const [body, status] of [[{ rate: 2147483648 }, 400], [{ rateExact: "1500000" }, 422], [{ rate: 900000, rateExact: "0.8" }, 400]] as const) {
    before = await baseline();
    assert.equal((await PUT(request("PUT", body), params(id))).status, status);
    assert.deepEqual(await baseline(), before);
  }
  before = await baseline();
  assert.equal((await PUT(request("PUT", { rateExact: "1" }, keys.b), params(id))).status, 404);
  assert.equal((await DELETE(request("DELETE", undefined, keys.b), params(id))).status, 404);
  assert.equal((await PUT(request("PUT", { rateExact: "1" }, keys.viewer), params(id))).status, 403);
  assert.deepEqual(await baseline(), before);
  const [same] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "USD", targetCurrency: "USD", date: aliases.date, rate: 1000000 }).returning();
  before = await baseline();
  assert.equal((await PUT(request("PUT", { rateExact: "2" }), params(same.id))).status, 400);
  assert.deepEqual(await baseline(), before);
  response = await GET(request("GET"));
  assert.equal(response.status, 200);
  let listed = await response.json();
  assert.equal(listed.pagination.total, 2); assert.ok(listed.data.every((row: { organizationId: string }) => row.organizationId === a.id));
  assert.equal((await GET(request("GET", undefined, keys.a, "?startDate=2026-02-29"))).status, 400);

  // Actual registered MCP handlers/schema, including the distinct decimal v1 input.
  for (const input of [{ rateDecimal: 0.75 }, { rateExact: "0.8000" }, { rateDecimal: 0.9, rateExact: "0.9" }]) {
    const result = await callA("set_exchange_rate", { ...aliases, ...input });
    assert.equal(result.isError, undefined); assert.equal(result.body.exchangeRate.id, id);
    assert.equal(result.body.exchangeRate.rateExact, String(input.rateDecimal ?? 0.8));
  }
  for (const [input, status] of [[{ rateExact: "1500000" }, 422], [{ rateExact: "1.0000001" }, 422], [{ rateDecimal: 1, rateExact: "2" }, undefined]] as const) {
    before = await baseline();
    const result = await callA("set_exchange_rate", { ...aliases, ...input });
    assert.equal(result.isError, true);
    if (status) assert.equal(result.body.status, status);
    assert.deepEqual(await baseline(), before);
  }
  before = await baseline();
  assert.equal((await tools({ ...ctxA, role: "member" })("set_exchange_rate", { ...aliases, rateExact: "1" })).body.status, 403);
  assert.equal((await callB("delete_exchange_rate", { id })).isError, true);
  assert.deepEqual(await baseline(), before);
  assert.equal((await callA("get_exchange_rate", aliases)).body.rateExact, "0.9");
  assert.equal((await callB("get_exchange_rate", aliases)).body.rateExact, "0.4");
  const missing = (await callA("get_exchange_rate", { ...aliases, date: "2026-09-01" })).body;
  assert.equal(missing.rate, null); assert.equal(missing.rateExact, null);
  const inverse = (await callA("get_exchange_rate", { ...aliases, baseCurrency: "EUR", targetCurrency: "USD" })).body;
  assert.equal(inverse.rate, 1111111); assert.equal(inverse.rateExact, "1.111111111111111111");
  assert.equal(inverse.rateDirection, "quote_per_base");
  listed = (await callA("list_exchange_rates", {})).body;
  assert.ok(listed.rates.every((row: { organizationId: string }) => row.organizationId === a.id));
  assert.equal(listed.rates.find((row: { id: string }) => row.id === id).rateDecimal, 0.9);
  const converted = await callA("convert_amount", { amountMinorUnits: 1250, fromCurrency: "USD", toCurrency: "EUR", date: aliases.date });
  assert.equal(converted.body.convertedMinorUnits, 1125);
  assert.equal((await callA("convert_amount", { amountMinorUnits: -5, fromCurrency: "USD", toCurrency: "USD", date: aliases.date })).body.convertedMinorUnits, -5);
  assert.equal((await callA("convert_amount", { amountMinorUnits: Number.MAX_SAFE_INTEGER, fromCurrency: "USD", toCurrency: "USD", date: aliases.date })).body.status, 422);
  assert.equal((await callA("convert_amount", { amountMinorUnits: 1250, fromCurrency: "USD", toCurrency: "JPY", date: aliases.date })).body.status, 422);
  await assert.rejects(callA("convert_amount", { amountMinorUnits: Number.MAX_SAFE_INTEGER + 1, fromCurrency: "USD", toCurrency: "EUR", date: aliases.date }), z.ZodError);
  await assert.rejects(callA("set_exchange_rate", { ...aliases, rateDecimal: 0.0000001 }), z.ZodError);

  // Audits, matching numeric/string clients, and delete scope on both transports.
  const updateAudit = (await audits()).find(row => row.action === "update" && row.entityId === id && row.organizationId === a.id);
  assert.ok(updateAudit);
  assert.ok(updateAudit.changes);
  assert.equal((await callA("delete_exchange_rate", { id: same.id })).isError, undefined);
  assert.equal((await DELETE(request("DELETE"), params(id))).status, 200);
  assert.equal((await DELETE(request("DELETE"), params(id))).status, 404);
  assert.equal((await rows()).length, 1);
  assert.equal((await rows())[0].organizationId, b.id);
  assert.ok((await audits()).filter(row => row.action === "delete").every(row => row.organizationId === a.id));
  assert.equal((await db.query.exchangeRate.findFirst({ where: and(eq(exchangeRate.organizationId, b.id), eq(exchangeRate.targetCurrency, "EUR")) }))?.rateExact, "0.4");
  console.log("REST and MCP FX contracts verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
