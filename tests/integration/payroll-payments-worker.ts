import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contractor, contractorPayment, payrollTaxPayment, chartAccount, journalEntry, journalLine, exchangeRate, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import * as collection from "../../app/api/v1/payroll/contractors/[id]/payments/route";
import * as detail from "../../app/api/v1/payroll/contractors/[id]/payments/[paymentId]/route";
import * as processRoute from "../../app/api/v1/payroll/contractors/[id]/payments/[paymentId]/process/route";
import * as taxes from "../../app/api/v1/payroll/tax-payments/route";
import { GET as contractorDetail } from "../../app/api/v1/payroll/contractors/[id]/route";
import { registerPayrollPaymentTools } from "../../lib/mcp/tools/payroll-payments";
import { registerAllTools } from "../../lib/mcp/tools";
import { updatePayrollContractor } from "../../lib/api/payroll-master";

type Args = Record<string, unknown>;
const operations = [
  ["list_contractor_payments", "GET", collection], ["create_contractor_payment", "POST", collection],
  ["get_contractor_payment", "GET", detail], ["update_contractor_payment", "PATCH", detail],
  ["delete_contractor_payment", "DELETE", detail], ["process_contractor_payment", "POST", processRoute],
  ["list_payroll_tax_payments", "GET", taxes], ["create_payroll_tax_payment", "POST", taxes],
] as const;
async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Payroll payment fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerPayrollPaymentTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) assert.equal(tools.length, 9);
  for (const name of [...operations.map(o => o[0]), "record_payroll_tax_remittance"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Args) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Payment A", slug: "payment-a" }, { name: "Payment B", slug: "payment-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "payments-owner@example.test" }, { email: "payments-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No access", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, customRoleId: role.id }]);
  const keys = { a: "dk_payments_a", b: "dk_payments_b", viewer: "dk_payments_viewer", expired: "dk_payments_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_payments",
    expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [usd, eur, other, foreign, missing, inactive] = await db.insert(contractor).values([
    { organizationId: a.id, name: "USD", currency: "USD" }, { organizationId: a.id, name: "EUR", currency: "EUR" },
    { organizationId: a.id, name: "Other", currency: "USD" }, { organizationId: b.id, name: "Foreign", currency: "USD" },
    { organizationId: a.id, name: "No FX", currency: "KWD" }, { organizationId: a.id, name: "Inactive", isActive: false },
  ]).returning();
  const [fx] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2024-01-01", rate: 1200000,
    rateExact: "1.2", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact", source: "manual" }).returning();
  const [foreignBank, wrongBank] = await db.insert(chartAccount).values([{ organizationId: b.id, code: "1100", name: "Foreign", type: "asset" },
    { organizationId: a.id, code: "1110", name: "EUR Bank", type: "asset", currencyCode: "EUR" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, permissions: [] });
  const seen = new Set<string>(), mseen = new Set<string>();
  const rest = async (name: string, args: Args = {}, key: string = keys.a, raw?: string) => {
    seen.add(name); const op = operations.find(o => o[0] === name); assert.ok(op);
    const [_, verb, route] = op; void _;
    const { contractorId, paymentId, ...body } = args;
    const url = new URL("http://fixture.test/api/v1/payroll/payments");
    if (verb === "GET") for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v));
    const request = new Request(url, { method: verb, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" },
      body: ["GET", "DELETE"].includes(verb) ? undefined : raw ?? JSON.stringify(body) });
    const handler = (route as unknown as Record<string, (r: Request, p: unknown) => Promise<Response>>)[verb];
    return handler(request, { params: Promise.resolve({ id: contractorId, paymentId }) });
  };
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const read = async (name: string, args: Args = {}) => data(await rest(name, args), name.startsWith("create_") ? 201 : 200);
  const call = async (name: string, args: Args = {}, client = ma) => { mseen.add(name); const result = await client.call(name, args); assert.equal(result.isError, false, JSON.stringify(result.body)); return result.body; };
  const tables = ["contractor", "contractor_payment", "payroll_tax_payment", "chart_account", "journal_entry", "journal_line", "number_sequence", "audit_log"];
  const snapshot = () => Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (name: string, args: Args, status: number, key: string = keys.a, raw?: string) => {
    const before = await snapshot(); await data(await rest(name, args, key, raw), status); assert.deepEqual(await snapshot(), before, name + " REST rollback");
  };
  const mdenied = async (name: string, args: Args, status?: number, client = ma) => {
    mseen.add(name); const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, name);
    if (status === 400 && result.body.status === undefined) assert.match(result.body.error, /validation|invalid|-32602/i);
    else if (status === 500 && result.body.status === undefined) assert.equal(result.body.error, "Internal error");
    else if (status) assert.equal(result.body.status, status, JSON.stringify(result.body));
    assert.deepEqual(await snapshot(), before, name + " MCP rollback");
  };
  const bothDenied = async (name: string, args: Args, status: number) => { await denied(name, args, status); await mdenied(name, args, status); };
  const count = async (table: string) => Number((await db.execute(sql.raw(`select count(*)::text as n from ${table}`))).rows[0].n);
  const period = { periodStart: "2024-01-01", periodEnd: "2024-01-31", paymentDate: "2024-01-31" };
  const ids = (id: string, payment: string) => ({ contractorId: id, paymentId: payment });
  const balanced = async (id: string, expected: number, rate = "1") => {
    const [entry] = await db.select().from(journalEntry).where(eq(journalEntry.id, id)); assert.equal(entry.organizationId, a.id); assert.equal(entry.status, "posted");
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id)); assert.ok(lines.length >= 2);
    assert.equal(lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n), BigInt(expected));
    assert.equal(lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n), BigInt(expected));
    for (const l of lines) { assert.equal(l.rateExact, rate); assert.equal(l.rateMigrationStatus, "exact"); const [a] = await db.select().from(chartAccount).where(eq(chartAccount.id, l.accountId)); assert.equal(a.organizationId, ctx.organizationId); }
  };
  try {
    const p = (await read("create_contractor_payment", { contractorId: eur.id, amount: 1250 })).payment;
    assert.equal(p.currency, "EUR"); assert.equal(p.amountMinor, "1250"); assert.equal(p.baseAmountMinor, null);
    const q = (await call("create_contractor_payment", { contractorId: usd.id, amountMinor: "3000000000" })).payment;
    assert.equal(q.amount, 3000000000);
    assert.equal((await call("update_contractor_payment", { ...ids(usd.id, q.id), amountMinor: "29", description: null })).payment.amount, 29);
    assert.equal((await read("update_contractor_payment", { ...ids(usd.id, q.id), amount: 1250, amountMinor: "1250" })).payment.amountMinor, "1250");
    const listed = await read("list_contractor_payments", { contractorId: eur.id }); assert.deepEqual((await call("list_contractor_payments", { contractorId: eur.id })).data, listed.data);
    assert.deepEqual((await call("get_contractor_payment", ids(eur.id, p.id))).payment, (await read("get_contractor_payment", ids(eur.id, p.id))).payment);
    const cp = (await data(await contractorDetail(new Request("http://fixture.test", { headers: { authorization: `Bearer ${keys.a}` } }), { params: Promise.resolve({ id: eur.id }) }))).contractor;
    assert.deepEqual(cp.payments[0], p);
    const processed = await Promise.all([read("process_contractor_payment", { ...ids(eur.id, p.id), paymentDate: period.paymentDate }), call("process_contractor_payment", { ...ids(eur.id, p.id), paymentDate: period.paymentDate })]);
    assert.equal(processed[0].payment.journalEntryId, processed[1].payment.journalEntryId); assert.equal(processed[0].payment.baseAmountMinor, "1500");
    await balanced(processed[0].payment.journalEntryId, 1500, "1.2");
    await db.update(exchangeRate).set({ rate: 1500000, rateExact: "1.5" }).where(eq(exchangeRate.id, fx.id));
    const beforeRetry = await snapshot(); assert.equal((await call("process_contractor_payment", ids(eur.id, p.id))).payment.rateExact, "1.2"); assert.deepEqual(await snapshot(), beforeRetry);
    await bothDenied("process_contractor_payment", { ...ids(eur.id, p.id), paymentDate: "2024-02-01" }, 409);
    await bothDenied("update_contractor_payment", { ...ids(eur.id, p.id), amount: 1 }, 409); await bothDenied("delete_contractor_payment", ids(eur.id, p.id), 409);
    await bothDenied("update_contractor_payment", { ...ids(usd.id, q.id), status: "paid" }, 409);
    await bothDenied("update_contractor_payment", ids(usd.id, q.id), 400);
    const voided = (await call("create_contractor_payment", { contractorId: usd.id, amount: 29 })).payment;
    await read("update_contractor_payment", { ...ids(usd.id, voided.id), status: "void" }); await bothDenied("process_contractor_payment", ids(usd.id, voided.id), 409);
    for (const amount of [29, 3000000000, Number.MAX_SAFE_INTEGER]) {
      const row = (await call("create_contractor_payment", { contractorId: usd.id, amountMinor: String(amount) })).payment;
      const paid = (await read("process_contractor_payment", { ...ids(usd.id, row.id), paymentDate: period.paymentDate })).payment;
      await balanced(paid.journalEntryId, amount);
    }
    const del = (await read("create_contractor_payment", { contractorId: usd.id, amount: 29 })).payment;
    await call("delete_contractor_payment", ids(usd.id, del.id)); await read("delete_contractor_payment", ids(usd.id, q.id));
    const allocations = [{ bucket: "fica", amount: 1250 }, { bucket: "medicare", amountMinor: "29" }, { bucket: "income_tax", amountMinor: "3000000000" }, { bucket: "pension", amount: 29 }];
    const input = { ...period, allocations, idempotencyKey: "remittance-1" };
    const tax = await Promise.all([read("create_payroll_tax_payment", input), call("create_payroll_tax_payment", input)]);
    assert.equal(tax[0].payment.id, tax[1].payment.id); assert.equal(tax[0].payment.amountMinor, "3000001308"); await balanced(tax[0].journalEntryId, 3000001308);
    const taxLines = await db.select({ code: chartAccount.code, amount: journalLine.debitAmount }).from(journalLine).innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id)).where(eq(journalLine.journalEntryId, tax[0].journalEntryId));
    assert.equal(taxLines.find(l => l.code === "2235")?.amount, 1279);
    const maxTaxInput = { ...period, allocations: [{ bucket: "fit", amountMinor: String(Number.MAX_SAFE_INTEGER) }], idempotencyKey: "max-tax" };
    const maxTax = await read("create_payroll_tax_payment", maxTaxInput);
    assert.equal((await call("create_payroll_tax_payment", maxTaxInput)).payment.id, maxTax.payment.id);
    await balanced(maxTax.journalEntryId, Number.MAX_SAFE_INTEGER);
    const bank = (await db.select().from(chartAccount).where(and(eq(chartAccount.organizationId, a.id), eq(chartAccount.code, "1100"))))[0];
    const legacy = await call("record_payroll_tax_remittance", { periodStart: period.periodStart, periodEnd: period.periodEnd, amount: 1250, bankAccountId: bank.id, taxKind: "940", idempotencyKey: "legacy-key" });
    await balanced(legacy.journalEntryId, 1250); assert.equal((await call("record_payroll_tax_remittance", { periodStart: period.periodStart, periodEnd: period.periodEnd, amountMinor: "1250", bankAccountId: bank.id, taxKind: "940", idempotencyKey: "legacy-key" })).payment.id, legacy.payment.id);
    assert.deepEqual((await call("list_payroll_tax_payments", {})).payments, (await read("list_payroll_tax_payments")).payments);
    assert.equal((await read("list_payroll_tax_payments", { from: "2024-02-01" })).payments.length, 0);
    assert.equal((await data(await rest("list_payroll_tax_payments", {}, keys.b))).payments.length, 0);
    await bothDenied("create_payroll_tax_payment", { ...input, allocations: [{ bucket: "income_tax", amount: 1 }] }, 409);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "income_tax", amount: Number.MAX_SAFE_INTEGER }, { bucket: "fica", amount: 1 }] }, 422);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "typo", amount: 1250 }] }, 400);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "1100", amount: 1250 }] }, 409);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "fit", amount: 1250 }], bankAccountId: foreignBank.id }, 404);
    await mdenied("record_payroll_tax_remittance", { periodStart: period.periodStart, periodEnd: period.periodEnd, amount: 1250, bankAccountId: foreignBank.id }, 404);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "fit", amount: 1250 }], bankAccountId: wrongBank.id }, 409);
    for (const bad of [{ amount: 0 }, { amount: -1 }, { amount: 0.5 }, { amount: 1, amountMinor: "2" }, { amountMinor: "01" }, { amountMinor: "-0" }, { currency: "ZZZ", amount: 1 }, { unexpected: true, amount: 1 }]) {
      await bothDenied("create_contractor_payment", { contractorId: usd.id, ...bad }, 400);
      const allocation = { bucket: "fit", ...bad }; if (!("currency" in bad)) await bothDenied("create_payroll_tax_payment", { ...period, allocations: [allocation] }, 400);
    }
    for (const amountMinor of ["9007199254740992", "9223372036854775807"]) {
      await bothDenied("create_contractor_payment", { contractorId: usd.id, amountMinor }, 422);
      await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "fit", amountMinor }] }, 422);
    }
    await bothDenied("create_contractor_payment", { contractorId: inactive.id, amount: 1250 }, 409);
    await bothDenied("create_contractor_payment", { contractorId: usd.id, amount: 1250, periodStart: "2024-02-01", periodEnd: "2024-01-01" }, 400);
    await bothDenied("create_payroll_tax_payment", { ...period, periodEnd: "2024-04-31", allocations: [{ bucket: "fit", amount: 1250 }] }, 400);
    await bothDenied("list_payroll_tax_payments", { from: "2024-02-01", to: "2024-01-01" }, 400);
    await denied("create_contractor_payment", { contractorId: usd.id }, 400, keys.a, "{");
    const pending = (await read("create_contractor_payment", { contractorId: missing.id, amount: 1250 })).payment;
    await bothDenied("process_contractor_payment", { ...ids(missing.id, pending.id), paymentDate: period.paymentDate }, 422);
    const over = (await read("create_contractor_payment", { contractorId: eur.id, amountMinor: String(Number.MAX_SAFE_INTEGER) })).payment;
    await bothDenied("process_contractor_payment", { ...ids(eur.id, over.id), paymentDate: period.paymentDate }, 422);
    await db.update(contractorPayment).set({ baseAmount: 1501 }).where(eq(contractorPayment.id, p.id));
    await bothDenied("get_contractor_payment", ids(eur.id, p.id), 422);
    await bothDenied("process_contractor_payment", ids(eur.id, p.id), 422);
    await db.update(contractorPayment).set({ baseAmount: 1500 }).where(eq(contractorPayment.id, p.id));
    const savedLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, processed[0].payment.journalEntryId));
    await db.update(journalLine).set({ creditAmount: 1501 }).where(eq(journalLine.id, savedLines.find(l => l.creditAmount > 0)!.id));
    await bothDenied("process_contractor_payment", ids(eur.id, p.id), 422);
    await db.update(journalLine).set({ creditAmount: 1500 }).where(eq(journalLine.id, savedLines.find(l => l.creditAmount > 0)!.id));
    await db.delete(exchangeRate).where(eq(exchangeRate.id, fx.id));
    const [inverseFx] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "USD", targetCurrency: "EUR", date: "2024-01-01", rate: 3000000,
      rateExact: "3", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact", source: "manual" }).returning();
    const unsupportedFx = (await read("create_contractor_payment", { contractorId: eur.id, amount: 1250 })).payment;
    await bothDenied("process_contractor_payment", { ...ids(eur.id, unsupportedFx.id), paymentDate: period.paymentDate }, 422);
    await db.delete(exchangeRate).where(eq(exchangeRate.id, inverseFx.id));
    await db.insert(exchangeRate).values({ ...fx, rate: 1500000, rateExact: "1.5" });
    // Every REST/MCP boundary enforces authorization and foreign/sibling ownership.
    for (const [name] of operations) {
      const args: Args = name === "create_contractor_payment" ? { contractorId: usd.id, amount: 1250 } : name === "create_payroll_tax_payment" ? { ...period, allocations: [{ bucket: "fit", amount: 1250 }] }
        : name === "list_contractor_payments" ? { contractorId: missing.id } : name.includes("contractor") ? { ...ids(missing.id, pending.id), ...(name === "update_contractor_payment" ? { amount: 29 } : {}) } : {};
      await denied(name, args, 403, keys.viewer); await mdenied(name, args, 403, ro);
      await denied(name, args, 401, keys.expired); await denied(name, args, 401, "dk_invalid");
      if (name.includes("contractor")) { await denied(name, args, 404, keys.b); await mdenied(name, args, 404, mb); }
    }
    await mdenied("record_payroll_tax_remittance", { periodStart: period.periodStart, periodEnd: period.periodEnd, amount: 1250, bankAccountId: bank.id }, 403, ro);
    await bothDenied("create_contractor_payment", { contractorId: foreign.id, amount: 1250 }, 404);
    for (const name of ["get_contractor_payment", "update_contractor_payment", "delete_contractor_payment", "process_contractor_payment"]) await bothDenied(name, { ...ids(other.id, pending.id), ...(name === "update_contractor_payment" ? { amount: 29 } : {}) }, 404);
    // Master currency updates serialize with payment creation using the same contractor lock.
    const [race] = await db.insert(contractor).values({ organizationId: a.id, name: "Race", currency: "USD" }).returning();
    const raced = await Promise.allSettled([call("create_contractor_payment", { contractorId: race.id, amount: 1250 }), updatePayrollContractor(ctx, race.id, { currency: "EUR" })]);
    assert.equal(raced[0].status, "fulfilled"); const [savedMaster] = await db.select().from(contractor).where(eq(contractor.id, race.id));
    const [savedPay] = await db.select().from(contractorPayment).where(eq(contractorPayment.contractorId, race.id)); assert.equal(savedPay.currency, savedMaster.currency);
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-01-31" }).returning();
    const usdPending = (await call("create_contractor_payment", { contractorId: usd.id, amount: 1250 })).payment;
    await bothDenied("process_contractor_payment", { ...ids(usd.id, usdPending.id), paymentDate: period.paymentDate }, 422);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "fit", amount: 1250 }] }, 422);
    const retryCounts = await snapshot(); await read("process_contractor_payment", ids(eur.id, p.id)); await read("create_payroll_tax_payment", input); assert.deepEqual(await snapshot(), retryCounts);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2024-01-01", endDate: "2024-12-31", isClosed: true }).returning();
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "fit", amount: 1250 }] }, 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    await db.execute(sql`update contractor_payment set amount=9007199254740992 where id=${usdPending.id}`);
    await bothDenied("get_contractor_payment", ids(usd.id, usdPending.id), 422); await bothDenied("update_contractor_payment", { ...ids(usd.id, usdPending.id), amount: 1250 }, 422);
    await db.update(contractorPayment).set({ amount: 1250 }).where(eq(contractorPayment.id, usdPending.id));
    await db.update(payrollTaxPayment).set({ amount: -1 }).where(eq(payrollTaxPayment.id, legacy.payment.id));
    await bothDenied("list_payroll_tax_payments", {}, 422); await db.update(payrollTaxPayment).set({ amount: 1250 }).where(eq(payrollTaxPayment.id, legacy.payment.id));
    // Audit failure must roll back accounts, sequence, journal, payment and status together.
    await db.execute(sql.raw("create function fail_payment_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic payment audit failure'; end $$; create trigger fail_payment_audit before insert on audit_log for each row execute function fail_payment_audit();"));
    await bothDenied("create_contractor_payment", { contractorId: usd.id, amount: 1250 }, 500);
    await bothDenied("update_contractor_payment", { ...ids(usd.id, usdPending.id), amount: 29 }, 500);
    await bothDenied("delete_contractor_payment", ids(usd.id, usdPending.id), 500);
    await bothDenied("process_contractor_payment", { ...ids(usd.id, usdPending.id), paymentDate: period.paymentDate }, 500);
    await bothDenied("create_payroll_tax_payment", { ...period, allocations: [{ bucket: "3330", amount: 29 }] }, 500);
    await db.execute(sql.raw("drop trigger fail_payment_audit on audit_log; drop function fail_payment_audit();"));
    assert.deepEqual([...seen].sort(), operations.map(o => o[0]).sort()); assert.equal(mseen.size, 9);
    assert.ok(await count("journal_entry") > 0);
    console.log("Payroll payment contracts verified: 8 REST operations, 9 MCP tools, exact cents/FX, tenant isolation, locks, retries and audit rollback");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
