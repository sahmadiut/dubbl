// Invoked only against the harness's migrated disposable PostgreSQL database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact } from "../../lib/db/schema";
import { money } from "../../lib/money/exact";
import { moneyInputSchema, moneyDto, rateInputSchema, rateDto, legacyMoneyInput, WireCompatibilityError } from "../../lib/money/wire";
import { decodeMoneyInteger } from "../../lib/db/money-column";
import { jsonResponse } from "../../lib/api/json-response";
import { ok, handleError } from "../../lib/api/response";
import { wrapTool } from "../../lib/mcp/errors";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as getInvoice } from "../../app/api/v1/invoices/[id]/route";

const ctx: AuthContext = { organizationId: "storage-fixture", userId: "storage-fixture", role: "owner" };

async function storageAndAdapters() {
  // Isolate transport capacity from public business capacity. This scratch table
  // is not an application schema or a new public full-int64 operation.
  const connection = await db.$client.connect();
  try {
    await connection.query("create temporary table wire_fixture (amount bigint not null, rate numeric not null)");
    for (const amount of ["0", "1250", "-1250", "9007199254740991", "-9007199254740991",
      "9007199254740993", "-9007199254740993", "9223372036854775807", "-9223372036854775808"]) {
      for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
        for (const rate of ["1", "0.000000000000000001", "99999999999999999999.999999999999999999"]) {
          await connection.query("truncate wire_fixture");
          await connection.query("insert into wire_fixture values ($1::bigint, $2::numeric)", [amount, rate]);
          const stored = (await connection.query("select amount::text as amount, rate::text as rate from wire_fixture")).rows[0];
          assert.equal(stored.amount, amount); assert.equal(stored.rate, rate);
          const value = moneyInputSchema.parse({ amountMinor: stored.amount, currencyCode });
          const quote = rateInputSchema.parse({ rateExact: stored.rate });
          const payload = { rows: [{ ...moneyDto(value, "exact"), ...rateDto(quote.rateExact, "exact") }],
            count: 1, quantity: 1.25, savedAt: new Date("2026-10-10T00:00:00Z"), nested: [value.amountMinor] };
          const rest = await jsonResponse(payload, { status: 201, headers: { "x-fixture": "explicit-exact" } }, "exact").json();
          const tool = await wrapTool(ctx, async () => payload, "exact");
          assert.equal(tool.isError, undefined);
          assert.deepEqual(JSON.parse(tool.content[0].text), rest);
          assert.deepEqual(moneyInputSchema.parse({ amountMinor: rest.rows[0].amountMinor, currencyCode: rest.rows[0].currencyCode }), value);
          assert.equal(rest.rows[0].rateExact, rate); assert.equal(rest.rows[0].rateDirection, "quote_per_base");
          assert.equal(rest.nested[0], amount); assert.equal(rest.quantity, 1.25); assert.equal(rest.count, 1);
          assert.equal(rest.savedAt, "2026-10-10T00:00:00.000Z");
          const safe = BigInt(amount) >= -9007199254740991n && BigInt(amount) <= 9007199254740991n;
          if (safe) {
            assert.equal(decodeMoneyInteger(stored.amount), Number(amount));
            const legacy = { ...moneyDto(value), nested: [value.amountMinor] };
            assert.deepEqual(await ok(legacy).json(), JSON.parse((await wrapTool(ctx, async () => legacy)).content[0].text));
            assert.equal(legacyMoneyInput({ amountMinor: amount, currencyCode }).amount, Number(amount));
          } else {
            for (const invoke of [() => decodeMoneyInteger(stored.amount),
              () => legacyMoneyInput({ amountMinor: amount, currencyCode }), () => ok({ nested: [value.amountMinor] })]) {
              let failure: unknown; try { invoke(); } catch (error) { failure = error; }
              assert.ok(failure instanceof WireCompatibilityError);
              const response = handleError(failure); assert.equal(response.status, 422);
              assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
            }
            const rejected = await wrapTool(ctx, async () => ({ nested: [value.amountMinor] }));
            assert.equal(rejected.isError, true);
            assert.equal(JSON.parse(rejected.content[0].text).code, "LEGACY_NUMERIC_RANGE");
          }
          if (rate !== "1") assert.throws(() => rateDto(rate), WireCompatibilityError);
        }
      }
    }
    // Exact mode cannot repair an already rounded Number or guess monetary strings.
    for (const amount of [Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, Infinity, NaN]) {
      assert.throws(() => jsonResponse({ amount }, undefined, "exact"), WireCompatibilityError);
      assert.equal((await wrapTool(ctx, async () => ({ amount }), "exact")).isError, true);
    }
    assert.equal(Object.hasOwn(BigInt.prototype, "toJSON"), false);
    assert.deepEqual(money(1250n, "USD"), moneyInputSchema.parse({ amount: 1250, currencyCode: "USD" }));
  } finally { connection.release(); }
}

async function endpointClients() {
  const [own, foreign] = await db.insert(organization).values([
    { name: "Compatibility", slug: "compatibility" }, { name: "Foreign", slug: "compatibility-foreign" },
  ]).returning();
  const [owner] = await db.insert(users).values({ email: "compatibility@example.test" }).returning();
  await db.insert(member).values({ organizationId: own.id, userId: owner.id, role: "owner" });
  const key = "dk_mon006_fixture";
  await db.insert(apiKey).values({ organizationId: own.id, createdBy: owner.id, name: "Compatibility",
    keyPrefix: "dk_mon006", keyHash: createHash("sha256").update(key).digest("hex") });
  const [party] = await db.insert(contact).values({ organizationId: own.id, name: "Customer", type: "customer" }).returning();
  const server = new McpServer({ name: "MON-006 actual tools", version: "1" });
  registerAllTools(server, { organizationId: own.id, userId: owner.id, role: "owner" });
  const client = new Client({ name: "Compatibility clients", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const call = async (name: string, input: object) => {
    const result = await client.callTool({ name, arguments: { ...input } });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  };
  const request = (input?: object, headers: Record<string, string> = {}) => new Request("https://fixture.test/invoices", {
    method: input ? "POST" : "GET", headers: { authorization: `Bearer ${key}`, "content-type": "application/json",
      "x-organization-id": foreign.id, ...headers }, ...(input ? { body: JSON.stringify(input) } : {}),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const snapshot = async () => (await db.execute(sql`select
    (select coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]') from invoice t) as invoices,
    (select coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]') from invoice_line t) as lines,
    (select coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]') from audit_log t) as audits,
    (select coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]') from organization t) as organizations`)).rows;
  try {
    const advertised = (await client.listTools()).tools.find(tool => tool.name === "create_invoice")!;
    assert.match(JSON.stringify(advertised.inputSchema), /unitPriceExact/);
    assert.match(JSON.stringify(advertised.inputSchema), /unitPriceMinor/);
    for (const [currencyCode, digits] of [["USD", 2], ["IRR", 0], ["JPY", 0], ["KWD", 3]] as const) {
      const input = (price: object) => ({ contactId: party.id, currencyCode, issueDate: "2024-01-01",
        lines: [{ description: "One unit", quantity: 1, ...price }] });
      const majorText = (minor: string) => {
        const value = BigInt(minor), absolute = value < 0n ? -value : value, scale = 10n ** BigInt(digits);
        return `${value < 0n ? "-" : ""}${absolute / scale}${digits ? `.${String(absolute % scale).padStart(digits, "0")}` : ""}`;
      };
      for (const amount of ["1250", "-1250", "3000000000", "9007199254740991", "-9007199254740991"]) {
        // Numeric major prices are qualified only where their decimal spelling
        // preserves the requested minor amount. Exact major/minor cover safe edges.
        const prices = [{ unitPriceMinor: amount }, { unitPriceExact: majorText(amount) },
          ...(BigInt(amount) < 9007199254740991n && BigInt(amount) > -9007199254740991n
            ? [{ unitPrice: Number(majorText(amount)) }, { unitPrice: Number(majorText(amount)), unitPriceMinor: amount }] : [])];
        for (const price of prices) {
          const response = await createInvoice(request(input(price))); assert.equal(response.status, 201);
          const saved = (await response.json()).invoice;
          const tool = await call("create_invoice", input(price)); assert.equal(tool.error, false, JSON.stringify(tool));
          for (const id of [saved.id, tool.body.invoice.id]) {
            const rest = await getInvoice(request(undefined, { "accept-language": "fa", "x-money-representation": "exact" }), params(id));
            assert.equal(rest.status, 200); const read = (await rest.json()).invoice;
            const mcp = await call("get_invoice", { invoiceId: id }); assert.equal(mcp.error, false);
            for (const invoice of [read, mcp.body.invoice]) {
              assert.equal(invoice.organizationId, own.id); assert.equal(invoice.currencyCode, currencyCode);
              assert.equal(invoice.totalMinor, amount); assert.equal(invoice.total, Number(amount));
              assert.equal(invoice.lines[0].unitPriceMinor, amount);
            }
            const row = (await db.execute(sql`select total::text as total from invoice where id=${id}`)).rows[0];
            assert.equal(row.total, amount);
          }
        }
      }
      for (const [price, status] of [
        [{ unitPriceMinor: "9007199254740993" }, 422], [{ unitPriceMinor: "-9007199254740993" }, 422],
        [{ unitPriceMinor: "9223372036854775807" }, 422], [{ unitPriceMinor: "-9223372036854775808" }, 422],
        [{ unitPriceMinor: "9223372036854775808" }, 400], [{ unitPriceMinor: "01" }, 400],
        [{ unitPriceMinor: "-0" }, 400], [{ unitPriceMinor: "1e3" }, 400],
        [{ unitPriceMinor: "1250", unitPriceExact: majorText("1251") }, 400],
      ] as const) {
        const before = await snapshot();
        const response = await createInvoice(request(input(price))); assert.equal(response.status, status);
        const tool = await call("create_invoice", input(price)); assert.equal(tool.error, true);
        if (status === 422) {
          assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
          assert.equal(tool.body.code, "LEGACY_NUMERIC_RANGE");
        }
        assert.deepEqual(await snapshot(), before);
      }
    }
    // Retained SQL int64 rows must fail with a compatibility error, never round
    // or bypass the bridge because a client supplied a locale/exact-looking header.
    const id = (await db.execute(sql`select id from invoice order by id limit 1`)).rows[0].id as string;
    for (const amount of ["9007199254740993", "-9007199254740993", "9223372036854775807", "-9223372036854775808"]) {
      await db.execute(sql`update invoice set total=${amount}::bigint where id=${id}`);
      const before = await snapshot();
      const response = await getInvoice(request(undefined, { "accept-language": "fa", "x-money-representation": "exact" }), params(id));
      assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await call("get_invoice", { invoiceId: id })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.deepEqual(await snapshot(), before);
      assert.equal((await db.execute(sql`select total::text as total from invoice where id=${id}`)).rows[0].total, amount);
    }
  } finally { await client.close(); await server.close(); }
}

try {
  await storageAndAdapters(); await endpointClients();
  console.log("Storage, wire and endpoint compatibility verified");
} finally { await db.$client.end(); }
