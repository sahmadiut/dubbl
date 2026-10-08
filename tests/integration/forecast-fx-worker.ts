import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, bill, recurringTemplate, recurringTemplateLine, exchangeRate, subscription } from "../../lib/db/schema";
import { GET as forecast } from "../../app/api/v1/reports/cash-flow-forecast/route";
import { GET as unrealized } from "../../app/api/v1/reports/unrealized-gains-losses/route";
import { registerForecastFxTools } from "../../lib/mcp/tools/forecast-fx";
import { getCashForecast, getUnrealizedFx } from "../../lib/reports/forecast-fx";
import { forecastAddDays, forecastWeekOf } from "../../lib/reports/forecast-fx-wire";
import { toLegacyRate } from "../../lib/currency/exact-rate";
import { createInvoice } from "../../lib/api/invoice-writes";
import { createBill } from "../../lib/api/bill-writes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Forecast FX fixture", version: "1" }); registerForecastFxTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  for (const tool of (await client.listTools()).tools) assert.match(tool.description!, /Minor/);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Forecast A", slug: "ffa" }, { name: "Forecast B", slug: "ffb" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "ff-owner@example.test" }, { email: "ff-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No report access", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_ff_a", b: "dk_ff_b", denied: "dk_ff_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ff" });
  const [local, foreign, deleted] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
    { organizationId: b.id, name: "Foreign secret", type: "both" }, { organizationId: a.id, name: "Deleted secret", type: "both", deletedAt: new Date() }]).returning();
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const today = new Date().toISOString().slice(0, 10), end = forecastAddDays(today, 84);
  const request = (fx = false, query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/${fx ? "unrealized-gains-losses" : "cash-flow-forecast"}${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const read = async (fx = false, query = "") => { const r = await (fx ? unrealized : forecast)(request(fx, query)); assert.equal(r.status, 200); return r.json(); };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "recurring_template", "recurring_template_line", "exchange_rate", "journal_entry", "journal_line", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  let sequence = 0;
  const seed = async (payable: boolean, amount: number, options: { org?: string; contactId?: string; currency?: string; due?: string; status?: "draft" | "void" | "paid"; deleted?: boolean } = {}) => {
    const values = { organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id,
      issueDate: "2020-01-01", dueDate: options.due ?? today, amountDue: amount, total: amount, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null };
    if (payable) return (await db.insert(bill).values({ ...values, billNumber: `FFB-${++sequence}`, status: options.status ?? "received" }).returning())[0].id;
    return (await db.insert(invoice).values({ ...values, invoiceNumber: `FFI-${++sequence}`, status: options.status ?? "sent" }).returning())[0].id;
  };
  const template = async (type: string, price: number, options: { currency?: string; next?: string; end?: string; max?: number; generated?: number;
    status?: "active" | "paused" | "completed"; deleted?: boolean; quantity?: number; contactId?: string; frequency?: "weekly" | "fortnightly" | "monthly" | "quarterly" | "semi_annual" | "annual"; org?: string } = {}) => {
    const [saved] = await db.insert(recurringTemplate).values({ organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id,
      name: type, type, frequency: options.frequency ?? "weekly", startDate: options.next ?? today, nextRunDate: options.next ?? today,
      currencyCode: options.currency ?? "USD", status: options.status ?? "active", deletedAt: options.deleted ? new Date() : null,
      endDate: options.end, maxOccurrences: options.max, occurrencesGenerated: options.generated ?? 0 }).returning();
    await db.insert(recurringTemplateLine).values({ templateId: saved.id, description: "Projected line", unitPrice: price, quantity: options.quantity ?? 100, discountPercent: 5000 });
    return saved.id;
  };
  const rate = async (currency: string, exact: string, date: string, options: { org?: string; inverse?: boolean; status?: string; numeric?: number } = {}) => {
    let numeric: number;
    try { numeric = toLegacyRate(exact); } catch { numeric = 1000000; }
    return (await db.insert(exchangeRate).values({ organizationId: options.org ?? a.id, baseCurrency: options.inverse ? "USD" : currency,
      targetCurrency: options.inverse ? currency : "USD", date, rateExact: exact, rate: options.numeric ?? numeric, rateMigrationStatus: options.status ?? "exact" }).returning())[0].id;
  };
  const clear = async () => {
    await db.delete(invoice); await db.delete(bill); await db.delete(recurringTemplate); await db.delete(exchangeRate);
  };
  const range = async (fx = false, query = "", args: Record<string, unknown> = {}) => {
    const before = await snapshot(); const response = await (fx ? unrealized : forecast)(request(fx, query));
    assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
    const m = await ma.call(fx ? "unrealized_gains_losses" : "cash_flow_forecast", args);
    assert.equal(m.isError, true); assert.equal(m.body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), before);
  };
  try {
    for (const fx of [false, true]) {
      assert.deepEqual((await ma.call(fx ? "unrealized_gains_losses" : "cash_flow_forecast")).body, await read(fx));
      assert.equal((await (fx ? unrealized : forecast)(request(fx, "", "dk_invalid"))).status, 401);
      assert.equal((await (fx ? unrealized : forecast)(request(fx, "", keys.denied))).status, 403);
      assert.equal((await noRead.call(fx ? "unrealized_gains_losses" : "cash_flow_forecast")).body.status, 403);
    }
    for (const query of ["?weeks=0", "?weeks=-1", "?weeks=53", "?weeks=abc", "?weeks=12x", "?weeks=", "?weeks=1&weeks=1", "?currencyCode=XXX", "?unknown=1", "?currencyCode=USD&currencyCode=USD"]) {
      assert.equal((await forecast(request(false, query))).status, 400);
    }
    assert.equal((await unrealized(request(true, "?unknown=1"))).status, 400);
    assert.equal((await ma.call("cash_flow_forecast", { weeks: 53 })).isError, true);
    assert.equal((await ma.call("unrealized_gains_losses", { unknown: 1 })).isError, true);
    // Both actual public legacy/exact document write contracts feed the shared reports.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
      const input = { contactId: local.id, issueDate: today, dueDate: today, lines: [{ description: "Actual client", ...price }] };
      const saved = await createInvoice(ctx, input, "rest"); await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, saved.invoice.id));
      const payable = await createBill(ctx, input, "rest"); await db.update(bill).set({ status: "received" }).where(eq(bill.id, payable.bill.id));
    }
    await seed(false, 7, { contactId: foreign.id }); await seed(false, 9, { contactId: deleted.id });
    await seed(false, -1); await seed(true, -2); await seed(false, 3, { due: end });
    for (const options of [{ status: "draft" as const }, { status: "void" as const }, { status: "paid" as const }, { deleted: true },
      { due: forecastAddDays(today, -1) }, { due: forecastAddDays(end, 1) }, { org: b.id, contactId: foreign.id }]) await seed(false, 900, options);
    await template("invoice", 1, { quantity: 50 }); // 13 occurrences, exact .5 rounds to one cent.
    await template("bill", 2, { max: 2 }); await template("expense", 3, { end: today });
    await template("invoice", 4, { next: forecastAddDays(today, -7), max: 2 }); // first overdue occurrence consumes one slot.
    await template("invoice", -1, { quantity: 50, max: 1 }); // negative tie rounds to zero.
    for (const options of [{ status: "paused" as const }, { status: "completed" as const }, { deleted: true }, { max: 1, generated: 1 },
      { end: forecastAddDays(today, -1) }, { next: forecastAddDays(end, 1) }, { org: b.id, contactId: foreign.id }]) await template("invoice", 900, options);
    await template("journal", 900);
    let before = await snapshot(); let body = await read();
    assert.deepEqual((await ma.call("cash_flow_forecast")).body, body);
    assert.equal(body.totalInflowsMinor, "2538"); assert.equal(body.totalOutflowsMinor, "2508"); assert.equal(body.netForecastMinor, "30");
    assert.equal(body.weeks.length, 13); assert.equal(body.weeks.at(-1).weekOf, forecastWeekOf(end));
    assert.equal(body.weeks.at(-1).entryCount, 2);
    assert.equal(body.weeks.reduce((s: number, w: { inflows: number }) => s + w.inflows, 0), body.totalInflows);
    assert.equal(body.weeks.at(-1).cumulativeNetMinor, body.netForecastMinor);
    assert.equal(body.entries.filter((e: { type: string }) => e.type === "recurring_invoice").length, 15);
    assert.ok(!JSON.stringify(body).includes("secret")); assert.deepEqual(await snapshot(), before);
    const foreignBody = await (await forecast(request(false, "", keys.b))).json();
    assert.equal(foreignBody.totalInflowsMinor, "12600"); assert.deepEqual((await mb.call("cash_flow_forecast")).body, foreignBody);
    for (const currency of ["IRR", "JPY", "KWD"]) {
      const id = await seed(false, 1250, { currency }); await range();
      body = await read(false, `?currencyCode=${currency}`); assert.equal(body.totalInflowsMinor, "1250"); assert.equal(body.currencyCode, currency);
      assert.deepEqual((await ma.call("cash_flow_forecast", { currencyCode: currency })).body, body);
      await db.delete(invoice).where(eq(invoice.id, id));
    }
    await clear();
    await template("invoice", 1); body = await read(false, "?weeks=52"); assert.equal(body.entries.length, 53); assert.equal(body.totalInflowsMinor, "53");
    await clear();
    for (const frequency of ["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"] as const) {
      await template("invoice", 1, { frequency, max: 1 });
    }
    assert.equal((await read()).entries.length, 6); await clear();
    await template("invoice", 7, { max: 1, contactId: foreign.id });
    await template("bill", 9, { max: 1, contactId: deleted.id });
    body = await read(); assert.ok(!JSON.stringify(body).includes("secret"));
    assert.deepEqual((await ma.call("cash_flow_forecast")).body, body); await clear();
    // Safe price and large quantity require exact multiplication before rounding.
    const high = await template("invoice", Number.MAX_SAFE_INTEGER, { quantity: 50, max: 1 });
    assert.equal((await read()).totalInflowsMinor, "4503599627370496");
    await db.execute(sql`update ${recurringTemplateLine} set unit_price=9223372036854775807 where template_id=${high}`); await range(); await clear();
    await template("invoice", Number.MAX_SAFE_INTEGER, { quantity: 101, max: 1 }); await range(); await clear();
    const linesOverflow = await template("invoice", Number.MAX_SAFE_INTEGER, { max: 1 });
    await db.insert(recurringTemplateLine).values({ templateId: linesOverflow, description: "Overflows subtotal", unitPrice: 1 });
    await range(); await clear();
    await template("invoice", 1, { next: "0001-01-01" }); await range(); await clear();
    await seed(false, Number.MAX_SAFE_INTEGER); assert.equal((await read()).totalInflowsMinor, "9007199254740991");
    await seed(false, 1); await range(); await clear();
    await seed(false, -Number.MAX_SAFE_INTEGER); assert.equal((await read()).totalOutflowsMinor, "9007199254740991"); await clear();
    const unsafe = await seed(false, 1); await db.execute(sql`update ${invoice} set amount_due=9223372036854775807 where id=${unsafe}`); await range(); await clear();
    await seed(false, 1, { currency: "XXX" }); await range(); await clear();
    // FX fixtures use synthetic rates, no external providers.
    await rate("EUR", "1.25", "2020-01-01"); await rate("EUR", "1.5", today);
    await seed(false, 1001, { currency: "EUR" }); await seed(true, 1001, { currency: "EUR" });
    await seed(false, -1, { currency: "EUR" }); await seed(false, 1250, { currency: "JPY" }); // no quotes
    await seed(false, 1); // base-currency documents excluded
    for (const options of [{ status: "draft" as const }, { status: "void" as const }, { status: "paid" as const }, { deleted: true }]) await seed(false, 999, { currency: "EUR", ...options });
    await seed(false, 20, { currency: "EUR", org: b.id, contactId: foreign.id });
    await rate("EUR", "2", "2020-01-01", { org: b.id }); await rate("EUR", "3", today, { org: b.id });
    before = await snapshot(); body = await read(true);
    assert.deepEqual((await ma.call("unrealized_gains_losses")).body, body); assert.equal(body.items.length, 4);
    assert.equal(body.summary.totalUnrealizedGainMinor, "251"); assert.equal(body.summary.totalUnrealizedLossMinor, "-251"); assert.equal(body.summary.netUnrealizedGainLossMinor, "0");
    assert.equal(body.summary.missingRateItems, 1);
    const item = body.items.find((i: { type: string; amountDue: number }) => i.type === "invoice" && i.amountDue === 1001);
    assert.equal(item.originalRateExact, "1.25"); assert.equal(item.originalRate, 1250000);
    assert.equal(item.currentRateExact, "1.5"); assert.equal(item.originalAmountBaseMinor, "1251"); assert.equal(item.currentAmountBaseMinor, "1502");
    const missing = body.items.find((i: { currencyCode: string }) => i.currencyCode === "JPY");
    assert.equal(missing.unrealizedGainLossMinor, null); assert.equal(missing.originalRateExact, null); assert.deepEqual(await snapshot(), before);
    const otherFx = await (await unrealized(request(true, "", keys.b))).json(); assert.equal(otherFx.summary.totalUnrealizedGainMinor, "20");
    assert.deepEqual((await mb.call("unrealized_gains_losses")).body, otherFx);
    await clear();
    // Inverse pair, direct precedence, quarantine behavior and canonical output aliases.
    await rate("EUR", "2", "2020-01-01", { inverse: true }); await rate("EUR", "4", today, { inverse: true });
    await seed(false, 100, { currency: "EUR" }); body = await read(true);
    assert.equal(body.items[0].originalRateExact, "0.5"); assert.equal(body.items[0].currentRateExact, "0.25"); assert.equal(body.summary.totalUnrealizedLossMinor, "-25");
    await rate("EUR", "1", "2020-01-01"); assert.equal((await read(true)).items[0].currentRateExact, "1");
    // Deliberately malformed/future-expanded rates exist only in this disposable database.
    // Restore the guard before reads: runtime never changes migration safeguards.
    await db.execute(sql`alter table exchange_rate disable trigger user`);
    await rate("EUR", "1", today, { status: "quarantined" });
    await db.execute(sql`alter table exchange_rate enable trigger user`);
    body = await read(true); assert.equal(body.summary.missingRateItems, 1); assert.equal(body.items[0].currentRateExact, null);
    await clear();
    for (const quote of ["1.0000001", "0.0000001", "2147.483648"]) {
      await db.execute(sql`alter table exchange_rate disable trigger user`);
      await rate("EUR", quote, "2020-01-01");
      await db.execute(sql`alter table exchange_rate enable trigger user`);
      await seed(false, 1, { currency: "EUR" }); await range(true); await clear();
    }
    await rate("EUR", "3", "2020-01-01", { inverse: true }); await seed(false, 1, { currency: "EUR" }); await range(true); await clear();
    await rate("EUR", "0.5", "2020-01-01"); await seed(false, Number.MAX_SAFE_INTEGER, { currency: "EUR" });
    body = await read(true); assert.equal(body.items[0].originalAmountBaseMinor, "4503599627370496"); await clear();
    await rate("EUR", "2", "2020-01-01"); await seed(false, Number.MAX_SAFE_INTEGER, { currency: "EUR" }); await range(true); await clear();
    await rate("EUR", "1", "2020-01-01"); await rate("EUR", "2", today);
    await seed(false, 4503599627370496, { currency: "EUR" }); await range(true); await clear();
    // Individually representable amounts and gains can overflow the root summary.
    await rate("EUR", "1", "2020-01-01"); await rate("EUR", "2", today);
    for (let i = 0; i < 3; i++) await seed(false, 4000000000000000, { currency: "EUR" }); await range(true); await clear();
    await seed(false, 1, { currency: "XXX" }); await range(true); await clear();
    const badFx = await seed(false, 1, { currency: "EUR" }); await db.execute(sql`update ${invoice} set amount_due=-9223372036854775808 where id=${badFx}`); await range(true); await clear();
    await assert.rejects(getCashForecast({ ...ctx, organizationId: randomUUID() }), { status: 404 });
    await assert.rejects(getUnrealizedFx({ ...ctx, organizationId: randomUUID() }), { status: 404 });
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id)); await range(); await range(true);
    console.log("REST and MCP forecast/FX verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
