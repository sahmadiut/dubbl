import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, journalEntry, journalLine, taxPeriod, taxReturnLine, periodLock, fiscalYear, contact, invoice, bill } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/tax-periods/route";
import { GET as get, PUT as update, DELETE as remove } from "../../app/api/v1/tax-periods/[id]/route";
import { POST as file } from "../../app/api/v1/tax-periods/[id]/file/route";
import { registerTaxPeriodTools } from "../../lib/mcp/tools/tax-periods";
import { registerTaxTools } from "../../lib/mcp/tools/tax";
import { createTaxPeriod, updateTaxPeriod, deleteTaxPeriod, fileTaxPeriod, settleTaxPeriod } from "../../lib/api/tax-periods";
import { getNextEntryNumber } from "../../lib/api/journal-automation";
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Tax periods fixture", version: "1" });
  registerTaxPeriodTools(server, ctx); registerTaxTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 8);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, tool.name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Period A", slug: "period-a", countryCode: "GB" }, { name: "Period B", slug: "period-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "period-owner@example.test" }, { email: "period-view@example.test" }, { email: "period-manage@example.test" }]).returning();
  const roles = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Tax", permissions: ["manage:tax-config"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: roles[0].id }, { organizationId: a.id, userId: manager.id, customRoleId: roles[1].id }]);
  const keys = { a: "dk_period_a", b: "dk_period_b", viewer: "dk_period_view", manager: "dk_period_manage", expired: "dk_period_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_period", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" }, ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/tax-periods", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["tax_period", "tax_return_line", "chart_account", "journal_entry", "journal_line", "audit_log"].map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  const [out, inp, bank, contra, foreign, inactive, deleted, euro] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "2200", name: "Output", type: "liability" }, { organizationId: a.id, code: "1500", name: "Input", type: "asset" },
    { organizationId: a.id, code: "1000", name: "Bank", type: "asset", subType: "bank" }, { organizationId: a.id, code: "4000", name: "Contra", type: "revenue" },
    { organizationId: b.id, code: "1000", name: "Foreign", type: "asset", subType: "bank" },
    { organizationId: a.id, code: "1001", name: "Inactive", type: "asset", subType: "bank", isActive: false },
    { organizationId: a.id, code: "1002", name: "Deleted", type: "asset", subType: "bank", deletedAt: new Date() },
    { organizationId: a.id, code: "1003", name: "Euro", type: "asset", subType: "bank", currencyCode: "EUR" },
  ]).returning();
  async function seed(date: string, output: number, input: number, source = "invoice", cash = false, status: "posted" | "draft" = "posted") {
    const [entry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: await getNextEntryNumber(a.id), date, description: "Synthetic tax", status, sourceType: source }).returning();
    const rows = [{ accountId: out.id, creditAmount: output, debitAmount: 0 }, { accountId: inp.id, debitAmount: input, creditAmount: 0 },
      { accountId: cash ? bank.id : contra.id, debitAmount: output > input ? output - input : 0, creditAmount: input > output ? input - output : 0 }];
    await db.insert(journalLine).values(rows.map(r => ({ ...r, journalEntryId: entry.id })));
    return entry.id;
  }
  const period = (startDate = "2026-01-01", endDate = "2026-01-31") => ({ name: "Synthetic month", type: "monthly", startDate, endDate });
  const make = async (start: string, end: string) => (await data(await create(req(period(start, end))), 201)).taxPeriod;
  const legs = async (entry: string) => db.select().from(journalLine).where(eq(journalLine.journalEntryId, entry));
  const balanced = async (entry: string, expected: number) => {
    const lines = await legs(entry); assert.equal(lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n), BigInt(expected));
    assert.equal(lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n), BigInt(expected));
    for (const l of lines) { assert.equal(l.rateExact, "1"); assert.equal(l.rateMigrationStatus, "exact"); assert.equal(l.currencyCode, "USD"); }
  };
  try {
    await seed("2026-01-03", 3000000000, 1250); await seed("2026-01-04", 900, 10, "invoice", false, "draft");
    const own = (await data(await create(req(period())), 201)).taxPeriod; assert.equal(own.organizationId, a.id);
    for (const key of [keys.expired, "dk_invalid"]) {
      await denied(() => list(req({}, key)), 401); await denied(() => get(req({}, key), params(own.id)), 401);
    }
    assert.deepEqual((await ma.call("get_tax_period", { taxPeriodId: own.id })).body, await data(await get(req(), params(own.id))));
    assert.deepEqual((await ma.call("list_tax_periods")).body, await data(await list(req())));
    assert.equal((await data(await list(req({}, keys.viewer)))).taxPeriods.length, 1);
    for (const key of [keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.viewer ? 403 : 401;
      await denied(() => create(req(period(), key)), status); await denied(() => update(req({ name: "Denied" }, key), params(own.id)), status);
      await denied(() => remove(req({}, key), params(own.id)), status); await denied(() => file(req({}, key), params(own.id)), status);
      await denied(() => file(req({ mode: "settle", bankGlAccountId: bank.id, amount: 1 }, key), params(own.id)), status);
    }
    for (const route of [get, update, remove, file]) await denied(() => route(req({}, keys.b), params(own.id)), 404);
    await denied(() => get(req(), params("bad")), 400);
    for (const input of [{ ...period(), startDate: "2026-02-30" }, { ...period(), endDate: "2025-01-01" }, { ...period(), totalMinor: "1" }]) await denied(() => create(req(input)), 400);
    await denied(() => update(req({ startDate: "2026-02-01" }), params(own.id)), 400);
    const malformed = () => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    await denied(() => create(malformed()), 400); await denied(() => update(malformed(), params(own.id)), 400); await denied(() => file(malformed(), params(own.id)), 400);
    for (const input of [null, [], "file", { flatRatePercent: 2147483648 }, { basis: "unknown" }, { amountMinor: "1" }]) await denied(() => file(req(input), params(own.id)), 400);
    for (const [name, args] of [["create_tax_period", period()], ["update_tax_period", { taxPeriodId: own.id, name: "Denied" }], ["delete_tax_period", { taxPeriodId: own.id }],
      ["file_tax_period", { taxPeriodId: own.id }], ["file_vat_return", { taxPeriodId: own.id }], ["record_vat_settlement", { bankGlAccountId: bank.id, amount: 1 }]] as const) {
      await mdenied(name, args, ro); await mdenied(name, { ...args, unknown: true });
    }
    for (const name of ["get_tax_period", "update_tax_period", "delete_tax_period", "file_tax_period", "file_vat_return"]) await mdenied(name, { taxPeriodId: own.id }, mb);
    await mdenied("record_vat_settlement", { taxPeriodId: own.id, bankGlAccountId: foreign.id, amount: 1 }, mb);
    await denied(() => file(req({ mode: "settle", bankGlAccountId: bank.id, amount: 1 }), params(own.id)), 400);
    await data(await update(req({ name: "Renamed", notes: null }), params(own.id)));
    const results = await Promise.all([file(req({ filedReference: "REF1" }), params(own.id)), file(req({ filedReference: "REF2" }), params(own.id))]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    const filed = await results.find(r => r.status === 200)!.json();
    assert.equal(filed.outputVat, 3000000000); assert.equal(filed.inputVatMinor, "1250"); assert.equal(filed.netMinor, "2999998750");
    assert.equal(filed.filedLines.length, 7); assert.equal(filed.filedLines.find((l: { boxNumber: string }) => l.boxNumber === "5").amount, filed.net);
    await balanced(filed.clearingJournalEntryId, 3000000000);
    assert.equal((await db.select().from(journalEntry).where(and(eq(journalEntry.sourceType, "vat_return"), eq(journalEntry.sourceId, own.id)))).length, 1);
    const frozen = (await data(await get(req(), params(own.id)))).taxPeriod.lines;
    await db.update(journalLine).set({ creditAmount: 3000000001 }).where(and(eq(journalLine.accountId, out.id), eq(journalLine.creditAmount, 3000000000)));
    assert.deepEqual((await ma.call("get_tax_period", { taxPeriodId: own.id })).body.taxPeriod.lines, frozen);
    for (const route of [update, remove, file]) await denied(() => route(req({}), params(own.id)), 400);
    for (const bankGlAccountId of [foreign.id, inactive.id, deleted.id]) await denied(() => file(req({ mode: "settle", bankGlAccountId, amountMinor: "1250" }), params(own.id)), 404);
    for (const bankGlAccountId of [euro.id, contra.id]) await denied(() => file(req({ mode: "settle", bankGlAccountId, amountMinor: "1250" }), params(own.id)), 400);
    for (const bankGlAccountId of [foreign.id, inactive.id, deleted.id, euro.id, contra.id])
      await mdenied("record_vat_settlement", { bankGlAccountId, amountMinor: "1250", isRefund: false });
    for (const money of [{}, { amount: 1, amountMinor: "2" }, { amountMinor: "01" }, { amount: 1.5 }, { amountMinor: "-1" }]) await denied(() => file(req({ mode: "settle", bankGlAccountId: bank.id, ...money }), params(own.id)), 400);
    await denied(() => file(req({ mode: "settle", bankGlAccountId: bank.id, amountMinor: "9007199254740992" }), params(own.id)), 422);
    const payment = await data(await file(req({ mode: "settle", bankGlAccountId: bank.id, amount: 1250, amountMinor: "1250", date: "2026-02-01" }), params(own.id)));
    await balanced(payment.settlementJournalEntryId, 1250); assert.equal((await legs(payment.settlementJournalEntryId)).find(l => l.accountId === bank.id)!.creditAmount, 1250);
    const refund = (await ma.call("record_vat_settlement", { taxPeriodId: own.id, bankGlAccountId: bank.id, amountMinor: "1250", isRefund: true, date: "2026-02-02" })).body;
    await balanced(refund.settlementJournalEntryId, 1250); assert.equal((await legs(refund.settlementJournalEntryId)).find(l => l.accountId === bank.id)!.debitAmount, 1250);
    const zeroBefore = await snapshot(); const zero = await data(await file(req({ mode: "settle", bankGlAccountId: bank.id, amount: 0 }), params(own.id)));
    assert.equal(zero.settlementJournalEntryId, null); assert.deepEqual(await snapshot(), zeroBefore);
    const standalone = await ma.call("record_vat_settlement", { bankGlAccountId: bank.id, amountMinor: "9007199254740991", isRefund: false, date: "2026-02-03" });
    assert.equal(standalone.isError, false); await balanced(standalone.body.settlementJournalEntryId, Number.MAX_SAFE_INTEGER);
    const legacySettlement = await ma.call("record_vat_settlement", { bankGlAccountId: bank.id, amount: 1250, isRefund: false, date: "2026-02-04" });
    assert.equal(legacySettlement.isError, false); assert.equal(legacySettlement.body.amountMinor, "1250"); await balanced(legacySettlement.body.settlementJournalEntryId, 1250);
    await seed("2026-03-03", 200, 800); const refundPeriod = await make("2026-03-01", "2026-03-31");
    const refundFiled = await ma.call("file_vat_return", { taxPeriodId: refundPeriod.id }); assert.equal(refundFiled.isError, false); assert.equal(refundFiled.body.netMinor, "-600");
    assert.equal(refundFiled.body.taxPeriodId, refundPeriod.id); assert.equal(refundFiled.body.status, "filed"); await balanced(refundFiled.body.clearingJournalEntryId, 800);
    await db.update(taxPeriod).set({ status: "amended" }).where(eq(taxPeriod.id, refundPeriod.id));
    await denied(() => update(req({ name: "Changed" }), params(refundPeriod.id)), 400); await denied(() => remove(req({}), params(refundPeriod.id)), 400);
    assert.equal((await ma.call("record_vat_settlement", { taxPeriodId: refundPeriod.id, bankGlAccountId: bank.id, amountMinor: "600", isRefund: true, date: "2026-04-01" })).isError, false);
    await seed("2026-04-03", 500, 200); await seed("2026-04-04", 50, 20, "payment"); await seed("2026-04-05", 30, 10, "manual", true);
    await db.update(organization).set({ vatScheme: "cash" }).where(eq(organization.id, a.id));
    const cashPeriod = await make("2026-04-01", "2026-04-30"), cash = await ma.call("file_tax_period", { taxPeriodId: cashPeriod.id });
    assert.equal(cash.body.basis, "cash"); assert.equal(cash.body.outputVat, 80); assert.equal(cash.body.inputVat, 30); await balanced(cash.body.clearingJournalEntryId, 80);
    const flatPeriod = await make("2026-05-01", "2026-05-31"); await seed("2026-05-03", 100, 10);
    const flat = await data(await file(req({ flatRatePercent: 1000, basis: "accrual" }), params(flatPeriod.id))); assert.equal(flat.net, 0); assert.equal((await legs(flat.clearingJournalEntryId)).length, 0);
    const [counterparty] = await db.insert(contact).values({ organizationId: a.id, name: "Cross border", type: "both", taxNumber: "SYNTH", addresses: { billing: { country: "FR" } } }).returning();
    const [foreignDoc] = await db.insert(invoice).values({ organizationId: a.id, contactId: counterparty.id, invoiceNumber: "EC1", issueDate: "2026-06-03", dueDate: "2026-06-30", status: "sent", subtotal: 4500000000, currencyCode: "EUR" }).returning();
    const ecPeriod = await make("2026-06-01", "2026-06-30"); await denied(() => file(req({}), params(ecPeriod.id)), 422);
    await db.update(invoice).set({ currencyCode: "USD" }).where(eq(invoice.id, foreignDoc.id));
    const [otherContact] = await db.insert(contact).values({ organizationId: b.id, name: "Foreign cross border", type: "both", taxNumber: "SYNTH", addresses: { billing: { country: "FR" } } }).returning();
    await db.update(invoice).set({ contactId: otherContact.id }).where(eq(invoice.id, foreignDoc.id));
    await denied(() => file(req({}), params(ecPeriod.id)), 422);
    await db.update(invoice).set({ contactId: counterparty.id }).where(eq(invoice.id, foreignDoc.id));
    const [offsetDoc] = await db.insert(invoice).values({ organizationId: a.id, contactId: counterparty.id, invoiceNumber: "OFFSET", issueDate: "2026-06-03", dueDate: "2026-06-30", status: "sent", subtotal: -1 }).returning();
    await db.execute(sql`update invoice set subtotal = 9007199254740992 where id = ${foreignDoc.id}`);
    await denied(() => file(req({}), params(ecPeriod.id)), 422);
    await db.update(invoice).set({ subtotal: 4500000000 }).where(eq(invoice.id, foreignDoc.id)); await db.delete(invoice).where(eq(invoice.id, offsetDoc.id));
    await db.insert(bill).values({ organizationId: a.id, contactId: counterparty.id, billNumber: "EC2", issueDate: "2026-06-04", dueDate: "2026-06-30", status: "received", subtotal: 3000000000 });
    const ec = await data(await file(req({}), params(ecPeriod.id))); assert.equal(ec.filedLines.find((l: { boxNumber: string }) => l.boxNumber === "8").amountMinor, "4500000000"); assert.equal(ec.filedLines.find((l: { boxNumber: string }) => l.boxNumber === "9").amountMinor, "3000000000");
    // SQL sums above the supported range fail without freezing/posting; never Number-coerced.
    const overflowPeriod = await make("2026-07-01", "2026-07-31"); const overflowEntry = await seed("2026-07-03", Number.MAX_SAFE_INTEGER, 0);
    await seed("2026-07-04", 1, 0); await denied(() => file(req({ basis: "accrual" }), params(overflowPeriod.id)), 422);
    await db.execute(sql`update journal_line set credit_amount = 9223372036854775807 where journal_entry_id = ${overflowEntry} and account_id = ${out.id}`);
    await denied(() => file(req({ basis: "accrual" }), params(overflowPeriod.id)), 422);
    // Invalid saved frozen money is rejected by both transports without rewriting history.
    const savedLine = frozen[0]; await db.execute(sql`update tax_return_line set amount = 9007199254740992 where id = ${savedLine.id}`);
    await denied(() => get(req(), params(own.id)), 422); await mdenied("get_tax_period", { taxPeriodId: own.id });
    await db.update(taxReturnLine).set({ amount: savedLine.amount }).where(eq(taxReturnLine.id, savedLine.id));
    const lockPeriod = await make("2026-08-01", "2026-08-31");
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-08-31", advisorLockDate: "2026-08-31", lockedBy: owner.id });
    await denied(() => file(req({}), params(lockPeriod.id)), 422); await mdenied("file_tax_period", { taxPeriodId: lockPeriod.id });
    await denied(() => file(req({ mode: "settle", bankGlAccountId: bank.id, amountMinor: "1", date: "2026-08-01" }), params(own.id)), 422);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-08-01", endDate: "2026-08-31", isClosed: true });
    await denied(() => file(req({}), params(lockPeriod.id)), 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    const edited = await ma.call("create_tax_period", period("2026-09-01", "2026-09-30")); assert.equal(edited.isError, false);
    assert.equal((await ma.call("update_tax_period", { taxPeriodId: edited.body.taxPeriod.id, name: "Edited" })).body.taxPeriod.name, "Edited");
    assert.equal((await ma.call("delete_tax_period", { taxPeriodId: edited.body.taxPeriod.id })).body.success, true);
    const managed = (await data(await create(req(period("2026-10-01", "2026-10-31"), keys.manager)), 201)).taxPeriod;
    await data(await update(req({ notes: "Custom role" }, keys.manager), params(managed.id)));
    await data(await file(req({ mode: "file" }, keys.manager), params(managed.id)));
    await data(await file(req({ mode: "settle", bankGlAccountId: bank.id, amountMinor: "1", date: "2026-11-01" }, keys.manager), params(managed.id)));
    const disposable = await make("2026-10-01", "2026-10-31");
    await db.insert(taxReturnLine).values({ taxPeriodId: disposable.id, boxNumber: "1", label: "Preview", amount: 1 });
    await data(await remove(req({}, keys.manager), params(disposable.id)));
    assert.equal((await db.select().from(taxReturnLine).where(eq(taxReturnLine.taxPeriodId, disposable.id))).length, 0);
    await denied(() => get(req(), params(disposable.id)), 404);
    const racePeriod = await make("2027-01-01", "2027-01-31");
    const toolRace = await Promise.all([ma.call("file_tax_period", { taxPeriodId: racePeriod.id }), ma.call("file_vat_return", { taxPeriodId: racePeriod.id })]);
    assert.deepEqual(toolRace.map(r => r.isError).sort(), [false, true]);
    assert.equal((await db.select().from(journalEntry).where(eq(journalEntry.sourceId, racePeriod.id))).length, 1);
    assert.equal((await db.select().from(taxReturnLine).where(eq(taxReturnLine.taxPeriodId, racePeriod.id))).length, 7);
    // Base currency scale never rescales stored integers; production IRR stays gated.
    const [kwd] = await db.insert(organization).values({ name: "KWD", slug: "period-kwd", defaultCurrency: "KWD" }).returning();
    const kwdCtx = { ...ctx, organizationId: kwd.id };
    const [kwdBank] = await db.insert(chartAccount).values({ organizationId: kwd.id, code: "1000", name: "KWD Bank", type: "asset", subType: "bank", currencyCode: "KWD" }).returning();
    const kwdSettlement = await settleTaxPeriod(kwdCtx, { bankGlAccountId: kwdBank.id, amountMinor: "1250", date: "2026-10-01" });
    assert.equal(kwdSettlement.amountMinor, "1250");
    const kwdLegs = await legs(kwdSettlement.settlementJournalEntryId!); assert.equal(kwdLegs[0].currencyCode, "KWD");
    assert.equal(kwdLegs.reduce((sum, l) => sum + l.debitAmount, 0), 1250);
    await db.update(organization).set({ defaultCurrency: "IRR" }).where(eq(organization.id, kwd.id));
    const irrBefore = await snapshot(); await assert.rejects(() => settleTaxPeriod(kwdCtx, { bankGlAccountId: kwdBank.id, amountMinor: "1250" }), /IRR functional currency is disabled/); assert.deepEqual(await snapshot(), irrBefore);
    // Required audit and journal-line faults roll back all adopted write effects.
    const rollbackPeriod = await make("2026-11-01", "2026-11-30"); await seed("2026-11-03", 100, 20, "payment");
    await db.execute(sql`create function fail_period_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure'; end $$`);
    await db.execute(sql`create trigger fail_period_audit before insert on audit_log for each row execute function fail_period_audit()`);
    for (const fn of [() => createTaxPeriod(ctx, period("2026-12-01", "2026-12-31")), () => updateTaxPeriod(ctx, rollbackPeriod.id, { name: "Rollback" }),
      () => deleteTaxPeriod(ctx, rollbackPeriod.id), () => fileTaxPeriod(ctx, rollbackPeriod.id, {}),
      () => settleTaxPeriod(ctx, { bankGlAccountId: bank.id, amountMinor: "1", date: "2026-11-01" }, own.id)]) {
      const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_period_audit on audit_log`); await db.execute(sql`drop function fail_period_audit()`);
    await db.execute(sql`create function fail_period_lines() returns trigger language plpgsql as $$ begin raise exception 'Synthetic journal failure'; end $$`);
    await db.execute(sql`create trigger fail_period_lines before insert on journal_line for each row execute function fail_period_lines()`);
    const before = await snapshot(); await assert.rejects(() => fileTaxPeriod(ctx, rollbackPeriod.id, {})); assert.deepEqual(await snapshot(), before);
    await db.execute(sql`drop trigger fail_period_lines on journal_line`); await db.execute(sql`drop function fail_period_lines()`);
    console.log("REST and MCP tax period contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
