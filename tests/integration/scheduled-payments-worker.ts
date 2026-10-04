// Runs only against the harness-created disposable PostgreSQL database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, chartAccount, bill, scheduledPayment,
  payment, paymentAllocation, journalEntry, journalLine, auditLog, exchangeRate, periodLock, fiscalYear } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/scheduled-payments/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/scheduled-payments/[id]/route";
import { POST as processDue } from "../../app/api/v1/scheduled-payments/process/route";
import { POST as billPay } from "../../app/api/v1/bills/[id]/pay/route";
import { registerScheduledPaymentTools } from "../../lib/mcp/tools/scheduled-payments";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Schedule fixture", version: "1.0.0" }); registerScheduledPaymentTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const names = (await client.listTools()).tools.map(tool => tool.name);
  for (const name of ["list_scheduled_payments", "get_scheduled_payment", "create_scheduled_payment", "update_scheduled_payment", "delete_scheduled_payment", "process_scheduled_payments"])
    assert.ok(names.includes(name), name);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Schedule A", slug: "schedule-a" }, { name: "Schedule B", slug: "schedule-b" }]).returning();
  const [owner, viewer, payOnly] = await db.insert(users).values([{ email: "schedule-owner@example.test" }, { email: "schedule-viewer@example.test" }, { email: "schedule-pay@example.test" }]).returning();
  const [readRole, payRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Read only", permissions: [] },
    { organizationId: a.id, name: "Pay only", permissions: ["manage:payments"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: readRole.id }, { organizationId: a.id, userId: payOnly.id, role: "member", customRoleId: payRole.id }]);
  const keys = { a: "dk_schedule_a", b: "dk_schedule_b", viewer: "dk_schedule_viewer", payOnly: "dk_schedule_pay", expired: "dk_schedule_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "payOnly" ? payOnly.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_schedule", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [party, otherParty, foreignParty, customer] = await db.insert(contact).values([{ organizationId: a.id, name: "Own supplier", type: "both" },
    { organizationId: a.id, name: "Other supplier", type: "supplier" }, { organizationId: b.id, name: "Foreign", type: "both" },
    { organizationId: a.id, name: "Customer", type: "customer" }]).returning();
  const [, cash, expense] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "2100", name: "AP", type: "liability" }, { organizationId: a.id, code: "1100", name: "Cash", type: "asset" },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] }), mb = await mcp({ ...ctx, organizationId: b.id });
  const request = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/scheduled-payments${query}`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const readRequest = (key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/scheduled-payments${query}`, { headers: { authorization: `Bearer ${key}` } });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const getOne = (id: string, key = keys.a) => get(readRequest(key), params(id));
  const patch = (id: string, body: unknown, key = keys.a) => update(request(body, key), params(id));
  const del = (id: string, key = keys.a) => remove(request({}, key), params(id));
  const process = (key = keys.a) => processDue(request({}, key));
  const today = new Date().toISOString().slice(0, 10), future = "2099-01-01";
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  async function recognized(amount = 1250, currencyCode = "USD") {
    const created = await createBill(ctx, { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode,
      lines: [{ description: "Fixture", unitPriceMinor: String(amount), accountId: expense.id }] }, "rest");
    return (await receiveBill(ctx, created.bill.id)).bill;
  }
  const input = (doc: { id: string }, extra: Record<string, unknown> = {}) => ({ billId: doc.id, contactId: party.id, scheduledDate: today, amount: 1250, ...extra });
  const tables = ["scheduled_payment", "bill", "bill_line", "payment", "payment_allocation", "journal_entry", "journal_line", "chart_account", "number_sequence"];
  const snapshot = async () => {
    const rows = await Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
    return [...rows, (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  };
  async function denied(fn: () => Promise<Response>, status: number) {
    const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before);
  }
  async function mcpDenied(name: string, args: Record<string, unknown>, client = ma) {
    const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before);
  }
  async function failed(status: number) {
    const before = await snapshot(); const result = await data(await process());
    assert.equal(result.processed, 0); assert.equal(result.failed, 1); assert.equal(result.failures[0].status, status);
    assert.deepEqual(await snapshot(), before);
    const resultMcp = await ma.call("process_scheduled_payments"); assert.equal(resultMcp.isError, false);
    assert.equal(resultMcp.body.failures[0].status, status); assert.deepEqual(await snapshot(), before);
  }
  const posted = async (scheduleId: string, amount: number, currency = "USD") => {
    const schedule = (await db.query.scheduledPayment.findFirst({ where: eq(scheduledPayment.id, scheduleId) }))!;
    assert.equal(schedule.status, "completed"); assert.ok(schedule.processedAt);
    const link = (await db.query.auditLog.findFirst({ where: and(eq(auditLog.entityId, scheduleId), eq(auditLog.action, "process")) }))!;
    const pay = (await db.query.payment.findFirst({ where: eq(payment.id, (link.changes as { paymentId: string }).paymentId) }))!;
    assert.equal(pay.amount, amount); assert.equal(pay.currencyCode, currency); assert.equal(pay.date, schedule.scheduledDate);
    assert.equal(pay.notes, schedule.notes); assert.equal(pay.type, "made"); assert.equal(pay.method, "bank_transfer");
    const allocations = await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, pay.id));
    assert.equal(allocations.length, 1); assert.equal(allocations[0].amount, amount); assert.equal(allocations[0].documentId, schedule.billId);
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, pay.journalEntryId!));
    assert.equal(lines.reduce((sum, line) => sum + BigInt(line.debitAmount), 0n), lines.reduce((sum, line) => sum + BigInt(line.creditAmount), 0n));
    assert.ok(lines.every(line => line.rateExact && line.rateDirection === "quote_per_base"));
    return pay;
  };
  try {
    const doc = await recognized(); const valid = input(doc);
    const schedule = (await data(await create(request({ ...valid, amountMinor: "1250", notes: "saved" }, keys.payOnly)), 201)).scheduledPayment;
    assert.equal(schedule.amount, 1250); assert.equal(schedule.amountMinor, "1250"); assert.equal(schedule.bill.totalMinor, "1250");
    assert.equal(schedule.contact.creditLimitMinor, null); assert.equal((await db.select().from(payment)).length, 0);
    assert.equal((await data(await getOne(schedule.id))).scheduledPayment.id, schedule.id);
    assert.equal((await ma.call("get_scheduled_payment", { scheduledPaymentId: schedule.id })).body.scheduledPayment.amountMinor, "1250");
    assert.equal((await data(await list(readRequest(keys.a, "?limit=1&status=pending")))).pagination.total, 1);
    assert.equal((await ma.call("list_scheduled_payments")).body.data[0].amountMinor, "1250");
    assert.equal((await readOnly.call("get_scheduled_payment", { scheduledPaymentId: schedule.id })).isError, false);
    assert.equal((await readOnly.call("list_scheduled_payments")).body.data.length, 1);
    assert.equal((await data(await list(readRequest(keys.b)))).data.length, 0);
    await denied(() => list(readRequest(keys.a, "?status=bogus")), 400);
    await denied(() => list(readRequest(keys.a, "?page=bad")), 400);
    for (const [key, status] of [["dk_invalid", 401], [keys.expired, 401], [keys.viewer, 403], [keys.b, 422]] as const)
      await denied(() => create(request(valid, key)), status);
    await denied(() => getOne(schedule.id, keys.b), 404); await denied(() => getOne("bad"), 400);
    for (const operation of [() => patch(schedule.id, { amount: 1 }, keys.viewer), () => del(schedule.id, keys.viewer), () => process(keys.viewer)]) await denied(operation, 403);
    await denied(() => patch(schedule.id, { notes: "foreign" }, keys.b), 404); await denied(() => del(schedule.id, keys.b), 404);
    await mcpDenied("get_scheduled_payment", { scheduledPaymentId: schedule.id }, mb);
    await mcpDenied("create_scheduled_payment", valid, mb);
    await mcpDenied("update_scheduled_payment", { scheduledPaymentId: schedule.id, notes: "foreign" }, mb);
    await mcpDenied("delete_scheduled_payment", { scheduledPaymentId: schedule.id }, mb);
    const orgSnapshot = await snapshot(); assert.equal((await mb.call("process_scheduled_payments")).body.total, 0); assert.deepEqual(await snapshot(), orgSnapshot);
    await mcpDenied("process_scheduled_payments", { amountMinor: "1" });
    await mcpDenied("create_scheduled_payment", valid, readOnly);
    await mcpDenied("update_scheduled_payment", { scheduledPaymentId: schedule.id, amount: 1 }, readOnly);
    await mcpDenied("delete_scheduled_payment", { scheduledPaymentId: schedule.id }, readOnly);
    await mcpDenied("process_scheduled_payments", {}, readOnly);
    for (const patchInput of [{ amount: 12.5 }, { amountMinor: "01", amount: undefined }, { amountMinor: "-1", amount: undefined },
      { amountMinor: "0", amount: undefined }, { amountMinor: "1251" }, { amount: 1251 }, { amount: undefined }, { scheduledDate: "2026-02-30" },
      { scheduledDate: "2026-09-30" }, { status: "completed" }]) {
      const body = { ...valid, ...patchInput };
      await denied(() => create(request(body)), 400); await mcpDenied("create_scheduled_payment", body);
    }
    await denied(() => create(request({ ...valid, amount: undefined, amountMinor: "9007199254740992" })), 422);
    await mcpDenied("create_scheduled_payment", { ...valid, amount: undefined, amountMinor: "9007199254740992" });
    for (const extra of [{ billId: randomUUID() }, { contactId: foreignParty.id }, { contactId: otherParty.id }, { currencyCode: "EUR" }])
      await denied(() => create(request({ ...valid, ...extra })), 422);
    await db.update(contact).set({ type: "customer" }).where(eq(contact.id, party.id)); await denied(() => create(request(valid)), 400);
    await db.update(contact).set({ type: "both" }).where(eq(contact.id, party.id));
    const draft = await createBill(ctx, { contactId: party.id, issueDate: today, dueDate: future, lines: [{ unitPriceMinor: "1250", description: "draft" }] }, "rest");
    await denied(() => create(request(input(draft.bill))), 400);
    await denied(() => create(request({ ...valid, contactId: customer.id })), 422);
    const edited = (await data(await patch(schedule.id, { amountMinor: "500", notes: null }))).scheduledPayment;
    assert.equal(edited.amount, 500); assert.equal(edited.amountMinor, "500"); assert.equal(edited.notes, null);
    assert.equal((await ma.call("update_scheduled_payment", { scheduledPaymentId: schedule.id, amountMinor: "1250", notes: "saved" })).isError, false);
    await denied(() => patch(schedule.id, { amount: 1250, amountMinor: "1251" }), 400);
    const cancelled = (await ma.call("create_scheduled_payment", { ...valid, amount: undefined, amountMinor: "1250" })).body.scheduledPayment;
    assert.equal((await ma.call("update_scheduled_payment", { scheduledPaymentId: cancelled.id, status: "cancelled" })).body.scheduledPayment.status, "cancelled");
    await denied(() => patch(cancelled.id, { amount: 1 }), 400);
    assert.equal((await ma.call("delete_scheduled_payment", { scheduledPaymentId: cancelled.id })).body.success, true);
    await denied(() => getOne(cancelled.id), 404);
    const mcpLegacy = await ma.call("create_scheduled_payment", { ...valid, scheduledDate: future });
    assert.equal(mcpLegacy.isError, false); assert.equal(mcpLegacy.body.scheduledPayment.amountMinor, "1250");
    assert.equal((await ma.call("delete_scheduled_payment", { scheduledPaymentId: mcpLegacy.body.scheduledPayment.id })).body.success, true);
    const removable = (await data(await create(request({ ...valid, scheduledDate: future })), 201)).scheduledPayment;
    assert.equal((await data(await del(removable.id))).success, true);
    const futureSchedule = (await data(await create(request({ ...valid, scheduledDate: future })), 201)).scheduledPayment;

    // Old/new lock dates and closed years reject CRUD/process before mutation.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today }).returning();
    await denied(() => create(request(valid)), 422); await denied(() => patch(schedule.id, { scheduledDate: future }), 422);
    await denied(() => patch(futureSchedule.id, { scheduledDate: today }), 422); await denied(() => del(schedule.id), 422); await failed(422);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: today, endDate: today, isClosed: true }).returning();
    await failed(422); await denied(() => create(request(valid)), 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));

    // Final schedule audit fails after settlement/status writes: every effect must roll back.
    await db.execute(sql.raw("create function fail_schedule_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type='scheduled_payment' then raise exception 'fixture schedule audit failure'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger fixture_schedule_audit before insert on audit_log for each row execute function fail_schedule_audit()"));
    await failed(500); await denied(() => create(request(valid)), 500); await denied(() => patch(schedule.id, { notes: "rollback" }), 500);
    await denied(() => del(schedule.id), 500); await mcpDenied("update_scheduled_payment", { scheduledPaymentId: schedule.id, notes: "rollback" });
    await db.execute(sql.raw("drop trigger fixture_schedule_audit on audit_log; drop function fail_schedule_audit()"));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, cash.id)); await failed(400);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, cash.id));
    const concurrently = await Promise.all([process(keys.payOnly), ma.call("process_scheduled_payments")]);
    const results = [await data(concurrently[0]), concurrently[1].body];
    assert.equal(results.reduce((sum, result) => sum + result.processed, 0), 1);
    assert.equal((await db.select().from(payment)).length, 1); await posted(schedule.id, 1250);
    const paidDoc = (await db.query.bill.findFirst({ where: eq(bill.id, doc.id) }))!;
    assert.equal(paidDoc.amountDue, 0); assert.equal(paidDoc.amountPaid, 1250); assert.equal(paidDoc.status, "paid"); assert.ok(paidDoc.paidAt);
    const after = await snapshot(); assert.equal((await data(await process())).processed, 0); assert.deepEqual(await snapshot(), after);
    await denied(() => patch(schedule.id, { amount: 1 }), 400); await denied(() => del(schedule.id), 400);
    assert.equal((await db.query.scheduledPayment.findFirst({ where: eq(scheduledPayment.id, futureSchedule.id) }))!.status, "pending");
    await data(await del(futureSchedule.id));

    // Partial run: valid independent item commits; stale amount rejects and remains pending.
    const staleDoc = await recognized(), goodDoc = await recognized();
    const stale = (await data(await create(request(input(staleDoc))), 201)).scheduledPayment;
    const good = (await data(await create(request(input(goodDoc, { amount: undefined, amountMinor: "500", scheduledDate: "2026-10-02" }))), 201)).scheduledPayment;
    await data(await billPay(request({ date: today, amount: 1000 }), params(staleDoc.id)));
    const partial = await data(await process()); assert.equal(partial.processed, 1); assert.equal(partial.failed, 1);
    assert.equal(partial.failures[0].scheduledPaymentId, stale.id); assert.equal(partial.failures[0].status, 400);
    await posted(good.id, 500); await failed(400);
    await data(await patch(stale.id, { amountMinor: "250" })); assert.equal((await ma.call("process_scheduled_payments")).body.processed, 1);
    await posted(stale.id, 250);

    // Safe maximum preserves every stored unit and remains JSON serializable.
    const bigDoc = await recognized(Number.MAX_SAFE_INTEGER);
    const bigResult = await ma.call("create_scheduled_payment", input(bigDoc, { amount: undefined, amountMinor: "9007199254740991" }));
    assert.equal(bigResult.isError, false, JSON.stringify(bigResult.body)); const big = bigResult.body.scheduledPayment;
    assert.equal(big.amount, Number.MAX_SAFE_INTEGER); assert.equal(big.amountMinor, "9007199254740991");
    assert.equal((await data(await process())).processed, 1); await posted(big.id, Number.MAX_SAFE_INTEGER);

    // Saved foreign currency and posting-date FX are retained, rather than payment default USD.
    const rates = await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 2000000, rateExact: "2", rateMigrationStatus: "exact", source: "manual" },
      { organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: today, rate: 3000000, rateExact: "3", rateMigrationStatus: "exact", source: "manual" }]).returning();
    const eurDoc = await recognized(1250, "EUR"); const eur = (await data(await create(request(input(eurDoc, { currencyCode: "EUR" }))), 201)).scheduledPayment;
    await db.delete(exchangeRate).where(eq(exchangeRate.organizationId, a.id)); await failed(422);
    await db.insert(exchangeRate).values(rates);
    assert.equal((await data(await process())).processed, 1); const eurPay = await posted(eur.id, 1250, "EUR");
    const eurLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, eurPay.journalEntryId!));
    assert.equal(eurLines.find(line => line.accountId === cash.id)!.creditAmount, 3750); assert.ok(eurLines.every(line => line.rateExact === "3"));

    const raceDoc = await recognized(); const race = (await data(await create(request(input(raceDoc))), 201)).scheduledPayment;
    const [racingProcess, cancellation] = await Promise.all([process(), patch(race.id, { status: "cancelled" })]);
    const raceResult = await data(racingProcess);
    if (raceResult.processed) { await data(cancellation, 400); await posted(race.id, 1250); }
    else { assert.equal((await data(cancellation)).scheduledPayment.status, "cancelled"); await data(await del(race.id)); }

    // Unsafe, foreign and malformed saved history fails reads/writes/process with no effects.
    const historyDoc = await recognized(); const history = (await data(await create(request(input(historyDoc))), 201)).scheduledPayment;
    await db.execute(sql`update scheduled_payment set amount=9007199254740992 where id=${history.id}`);
    await denied(() => getOne(history.id), 422); await denied(() => list(readRequest()), 422); await failed(422);
    await mcpDenied("get_scheduled_payment", { scheduledPaymentId: history.id }); await denied(() => patch(history.id, { amount: 1 }), 422); await denied(() => del(history.id), 422);
    await db.execute(sql`update scheduled_payment set amount=1250 where id=${history.id}`);
    await db.update(scheduledPayment).set({ contactId: foreignParty.id }).where(eq(scheduledPayment.id, history.id));
    await denied(() => getOne(history.id), 422); await failed(422);
    await db.update(scheduledPayment).set({ contactId: null }).where(eq(scheduledPayment.id, history.id)); await failed(422);
    await db.update(scheduledPayment).set({ contactId: party.id }).where(eq(scheduledPayment.id, history.id));
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: today, description: "Foreign", status: "posted" }).returning();
    await db.update(bill).set({ journalEntryId: foreignJournal.id }).where(eq(bill.id, historyDoc.id)); await denied(() => getOne(history.id), 422); await failed(422);
    await db.update(bill).set({ journalEntryId: historyDoc.journalEntryId }).where(eq(bill.id, historyDoc.id));
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, party.id)); await failed(400);
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, party.id));
    await db.update(bill).set({ deletedAt: new Date() }).where(eq(bill.id, historyDoc.id)); await failed(400);
    await db.update(bill).set({ deletedAt: null }).where(eq(bill.id, historyDoc.id));
    await db.update(scheduledPayment).set({ status: "processing" }).where(eq(scheduledPayment.id, history.id));
    const legacy = await snapshot(); assert.equal((await data(await process())).total, 0); assert.deepEqual(await snapshot(), legacy); await denied(() => del(history.id), 400);
    await db.update(scheduledPayment).set({ status: "failed" }).where(eq(scheduledPayment.id, history.id));
    assert.equal((await data(await process())).total, 0); await denied(() => patch(history.id, { amount: 1 }), 400); await data(await del(history.id));
    console.log("REST and MCP scheduled payments verified: exact/legacy, roles/org, locks, atomic rollback, concurrent retry, partial run, max, currency/FX and invalid history");
  } finally {
    await ma.close(); await readOnly.close(); await mb.close(); await db.$client.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
