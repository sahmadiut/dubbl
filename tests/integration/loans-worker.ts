import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, loan, loanSchedule, chartAccount, bankAccount, journalEntry, journalLine, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/loans/route";
import { GET as get, PATCH as patch, DELETE as remove } from "../../app/api/v1/loans/[id]/route";
import { POST as post } from "../../app/api/v1/loans/[id]/post-payment/route";
import { registerAllTools } from "../../lib/mcp/tools";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Loan fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["list_loans", "get_loan", "create_loan", "update_loan", "delete_loan", "post_loan_payment"]) {
    const t = tools.find(t => t.name === name); assert.ok(t); assert.equal(t.inputSchema.additionalProperties, false);
    for (const f of Object.values(t.inputSchema.properties ?? {})) assert.ok((f as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Loan A", slug: "loan-a" }, { name: "Loan B", slug: "loan-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "loan-owner@example.test" }, { email: "loan-viewer@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }]);
  const keys = { a: "dk_loan_a", b: "dk_loan_b", viewer: "dk_loan_viewer", expired: "dk_loan_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_loan",
    expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const [liability, expense, cash, foreign, wrongCurrency, inactive] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "2300", name: "Loan liability", type: "liability" },
    { organizationId: a.id, code: "5900", name: "Interest", type: "expense" },
    { organizationId: a.id, code: "1100", name: "Bank", type: "asset" },
    { organizationId: b.id, code: "2300", name: "Foreign liability", type: "liability" },
    { organizationId: a.id, code: "2301", name: "GBP liability", type: "liability", currencyCode: "GBP" },
    { organizationId: a.id, code: "2302", name: "Inactive", type: "liability", isActive: false },
  ]).returning();
  const [bank, otherBank, unlinkedBank, currencyBank, deadBank] = await db.insert(bankAccount).values([
    { organizationId: a.id, accountName: "Bank", bankName: "Fixture", accountType: "checking", chartAccountId: cash.id, balance: 999 },
    { organizationId: b.id, accountName: "Foreign bank", bankName: "Fixture", accountType: "checking" },
    { organizationId: a.id, accountName: "Unlinked", bankName: "Fixture", accountType: "checking" },
    { organizationId: a.id, accountName: "GBP", bankName: "Fixture", accountType: "checking", currencyCode: "GBP" },
    { organizationId: a.id, accountName: "Inactive", bankName: "Fixture", accountType: "checking", isActive: false },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id });
  const ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const staff = await connect({ ...ctx, role: "member", permissions: ["manage:invoices"] });
  const req = (body: unknown = {}, key: string = keys.a, query = "") => new Request("http://fixture.test/loans" + query,
    { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const base = { name: "Loan", principalAmount: 10000, interestRate: 500, termMonths: 12, startDate: "2024-01-01",
    bankAccountId: bank.id, principalAccountId: liability.id, interestAccountId: expense.id };
  async function snapshot() {
    const r = await db.execute(sql.raw("select jsonb_build_object('loans',(select jsonb_agg(to_jsonb(t) order by id) from loan t),'schedule',(select jsonb_agg(to_jsonb(t) order by id) from loan_schedule t),'bank',(select jsonb_agg(to_jsonb(t) order by id) from bank_account t),'accounts',(select jsonb_agg(to_jsonb(t) order by id) from chart_account t),'journals',(select jsonb_agg(to_jsonb(t) order by id) from journal_entry t),'lines',(select jsonb_agg(to_jsonb(t) order by id) from journal_line t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown>, client = ma, status?: number) {
    const before = await snapshot(), r = await client.call(name, args); assert.equal(r.isError, true, JSON.stringify(r));
    if (status) assert.equal(r.body.status, status); assert.equal(await snapshot(), before);
  }
  async function fresh(values: Record<string, unknown> = {}) { return data(await create(req({ ...base, ...values })), 201); }
  try {
    const first = await fresh({ idempotencyKey: "create-first" }); assert.equal(first.loan.principalAmountMinor, "1000000"); assert.equal(first.loan.monthlyPaymentMinor, "85607");
    assert.equal(first.schedule.length, 12); assert.equal(first.schedule.at(-1).remainingBalanceMinor, "0");
    const beforeRetry = await snapshot();
    const { principalAmount: _principal, ...mcpBase } = base;
    assert.equal(_principal, 10000);
    const retry = await ma.call("create_loan", { ...mcpBase, principalAmountMinor: "1000000", idempotencyKey: "create-first" });
    assert.equal(retry.isError, false); assert.deepEqual(retry.body, first); assert.equal(await snapshot(), beforeRetry);
    await mdenied("create_loan", { ...base, principalAmount: 1000001, idempotencyKey: "create-first" }, ma, 409);
    const legacy = await ma.call("create_loan", { ...base, principalAmount: 1250, interestRate: 0, termMonths: 3 });
    assert.equal(legacy.isError, false); assert.equal(legacy.body.loan.principalAmount, 1250); assert.equal(legacy.body.schedule.at(-1).principalAmount, 416);
    const ln = first.loan.id, detail = await data(await get(req(), p(ln)));
    assert.deepEqual((await ma.call("get_loan", { loanId: ln })).body, detail);
    assert.equal(detail.loan.bankAccount.balanceMinor, "999"); assert.ok(detail.schedule.every((r: { id?: string }) => r.id));
    const listing = await data(await list(req()));
    assert.equal(listing.pagination.total, 2); assert.deepEqual((await ma.call("list_loans", {})).body.loans, listing.data);
    const named = await data(await patch(req({ name: "Renamed" }), p(ln))); assert.equal(named.loan.name, "Renamed");
    const defaulted = await ma.call("update_loan", { loanId: ln, status: "defaulted" }); assert.equal(defaulted.body.loan.status, "defaulted");
    const filters = await data(await list(req({}, keys.a, "?status=defaulted&page=1&limit=1"))); assert.equal(filters.pagination.total, 1);
    await denied(() => post(req(), p(ln)), 400);
    await data(await patch(req({ status: "active" }), p(ln)));
    await denied(() => patch(req({ status: "paid_off" }), p(ln)), 409);
    const target = detail.schedule[0].id;
    const paid = await data(await post(req({ scheduleEntryId: target }), p(ln)));
    assert.equal(paid.entry.totalPaymentMinor, "85607"); assert.equal(paid.loanStatus, "active");
    const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, paid.journalEntry.id));
    assert.equal(legs.reduce((s, l) => s + BigInt(l.debitAmount), 0n), 85607n);
    assert.equal(legs.reduce((s, l) => s + BigInt(l.creditAmount), 0n), 85607n);
    assert.ok(legs.every(l => l.currencyCode === "USD" && l.rateExact === "1" && l.rateDirection === "quote_per_base"));
    assert.equal((await db.select().from(bankAccount).where(eq(bankAccount.id, bank.id)))[0].balance, 999);
    const replayState = await snapshot(); assert.deepEqual((await ma.call("post_loan_payment", { loanId: ln, scheduleEntryId: target })).body, paid); assert.equal(await snapshot(), replayState);
    await denied(() => remove(req(), p(ln)), 400); await mdenied("delete_loan", { loanId: ln }, ma, 400);
    await denied(() => post(req({ scheduleEntryId: detail.schedule[3].id }), p(ln)), 409);
    const concurrent = await Promise.all([post(req({ scheduleEntryId: detail.schedule[1].id }), p(ln)), ma.call("post_loan_payment", { loanId: ln, scheduleEntryId: detail.schedule[1].id })]);
    assert.deepEqual(await data(concurrent[0]), concurrent[1].body); assert.equal(concurrent[1].isError, false);
    const keyed = await data(await post(req({ idempotencyKey: "third" }), p(ln)));
    assert.deepEqual((await ma.call("post_loan_payment", { loanId: ln, idempotencyKey: "third" })).body, keyed);
    await mdenied("post_loan_payment", { loanId: ln, idempotencyKey: "third", scheduleEntryId: detail.schedule[3].id }, ma, 409);
    for (let i = 3; i < 12; i++) { const r = await ma.call("post_loan_payment", { loanId: ln, scheduleEntryId: detail.schedule[i].id }); assert.equal(r.isError, false); assert.equal(r.body.loanStatus, i === 11 ? "paid_off" : "active"); }
    assert.equal((await data(await get(req(), p(ln)))).loan.status, "paid_off");
    await denied(() => patch(req({ status: "active" }), p(ln)), 409);
    const gone = await fresh(); assert.deepEqual((await ma.call("delete_loan", { loanId: gone.loan.id })).body, { success: true });
    await denied(() => get(req(), p(gone.loan.id)), 404);
    assert.equal((await db.select().from(loanSchedule).where(eq(loanSchedule.loanId, gone.loan.id))).length, 0);
    const restGone = await fresh(); await data(await remove(req(), p(restGone.loan.id)));
    const createRace = await Promise.all([create(req({ ...base, idempotencyKey: "concurrent-create" })),
      ma.call("create_loan", { ...mcpBase, principalAmountMinor: "1000000", idempotencyKey: "concurrent-create" })]);
    assert.deepEqual(await data(createRace[0], 201), createRace[1].body); assert.equal(createRace[1].isError, false);
    const raced = await fresh(), raceDetail = await data(await get(req(), p(raced.loan.id)));
    const deleteRace = await Promise.all([remove(req(), p(raced.loan.id)), post(req({ scheduleEntryId: raceDetail.schedule[0].id }), p(raced.loan.id))]);
    assert.ok((deleteRace[0].status === 200 && deleteRace[1].status === 404) || (deleteRace[0].status === 400 && deleteRace[1].status === 200));
    // Reads preserve authenticated access; mutation permissions are exact custom-role permissions.
    await data(await get(req({}, keys.viewer), p(ln)));
    for (const key of ["dk_invalid", keys.expired]) await denied(() => list(req({}, key)), 401);
    for (const fn of [() => create(req(base, keys.viewer)), () => patch(req({}, keys.viewer), p(ln)), () => remove(req({}, keys.viewer), p(ln)), () => post(req({}, keys.viewer), p(ln))]) await denied(fn, 403);
    for (const [name, args] of [["create_loan", base], ["update_loan", { loanId: ln }], ["delete_loan", { loanId: ln }], ["post_loan_payment", { loanId: ln }]] as const) await mdenied(name, args, ro, 403);
    const staffMade = await staff.call("create_loan", { ...base, principalAmountMinor: "10000", principalAmount: 10000 }); assert.equal(staffMade.isError, false);
    for (const rest of [get, patch, remove, post]) await denied(() => rest(req({}, keys.b), p(ln)), 404);
    for (const name of ["get_loan", "update_loan", "delete_loan", "post_loan_payment"]) await mdenied(name, { loanId: ln }, mb, 404);
    assert.equal((await data(await list(req({}, keys.b)))).pagination.total, 0);
    // Invalid money/schema/scope fail with unchanged domain snapshots.
    for (const values of [{ principalAmountMinor: "1000001" }, { principalAmountMinor: "01" }, { termMonths: 1201 }, { interestRate: 0.5 }, { startDate: "2024-02-30" }, { rateExact: "1" }, { principalAmount: 0.001 }]) await denied(() => create(req({ ...base, ...values })), 400);
    for (const values of [{ principalAmount: undefined, principalAmountMinor: "9007199254740992" }, { principalAmount: 1e-7 },
      { principalAmount: undefined, principalAmountExact: "9".repeat(256) },
      { principalAmount: undefined, principalAmountExact: "90071992547409.91", termMonths: 1, interestRate: 1 }]) await denied(() => create(req({ ...base, ...values })), 422);
    for (const values of [{ principalAccountId: foreign.id }, { principalAccountId: expense.id }, { principalAccountId: wrongCurrency.id }, { principalAccountId: inactive.id },
      { bankAccountId: otherBank.id }, { bankAccountId: currencyBank.id }, { bankAccountId: deadBank.id }]) {
      await denied(() => create(req({ ...base, ...values })), 422); await mdenied("create_loan", { ...base, ...values }, ma, 422);
    }
    await denied(() => list(req({}, keys.a, "?page=1e2")), 400);
    const missingBank = await fresh({ bankAccountId: undefined }); await denied(() => post(req(), p(missingBank.loan.id)), 400);
    const orphan = await fresh();
    const [orphanJournal] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1000, date: "2024-02-01", description: "Orphan fixture", status: "posted", sourceType: "loan", sourceId: orphan.loan.id }).returning();
    await denied(() => post(req(), p(orphan.loan.id)), 422); await mdenied("delete_loan", { loanId: orphan.loan.id }, ma, 422);
    await db.delete(journalEntry).where(eq(journalEntry.id, orphanJournal.id));
    const locked = await fresh();
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-02-01", advisorLockDate: "2024-01-15", lockedBy: owner.id }).returning();
    await mdenied("post_loan_payment", { loanId: locked.loan.id }, staff, 422);
    await db.update(periodLock).set({ advisorLockDate: null }).where(eq(periodLock.id, lock.id)); await denied(() => post(req(), p(locked.loan.id)), 422);
    await db.update(periodLock).set({ advisorLockDate: "2024-01-15" }).where(eq(periodLock.id, lock.id)); await data(await post(req(), p(locked.loan.id)));
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2024-03-01", endDate: "2024-03-31", isClosed: true }).returning();
    await denied(() => post(req(), p(locked.loan.id)), 422); await mdenied("post_loan_payment", { loanId: locked.loan.id }, ma, 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    const max = await fresh({ principalAmount: undefined, principalAmountMinor: "9007199254740991", termMonths: 1, interestRate: 0 });
    const maxPayment = await ma.call("post_loan_payment", { loanId: max.loan.id }); assert.equal(maxPayment.isError, false); assert.equal(maxPayment.body.entry.totalPaymentMinor, "9007199254740991");
    // Stored unsafe/corrupt schedule, foreign history and bank references fail closed.
    const corrupt = await fresh(); const corruptDetail = await data(await get(req(), p(corrupt.loan.id)));
    await db.execute(sql`update loan_schedule set total_payment=9007199254740992 where id=${corruptDetail.schedule[0].id}`);
    await denied(() => get(req(), p(corrupt.loan.id)), 422); await mdenied("post_loan_payment", { loanId: corrupt.loan.id }, ma, 422);
    await db.update(loanSchedule).set({ totalPayment: corruptDetail.schedule[0].totalPayment + 1 }).where(eq(loanSchedule.id, corruptDetail.schedule[0].id));
    await denied(() => post(req(), p(corrupt.loan.id)), 422);
    await db.update(loanSchedule).set({ totalPayment: corruptDetail.schedule[0].totalPayment }).where(eq(loanSchedule.id, corruptDetail.schedule[0].id));
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2024-02-01", status: "posted", description: "Foreign" }).returning();
    await db.update(loanSchedule).set({ posted: true, journalEntryId: foreignJournal.id }).where(eq(loanSchedule.id, corruptDetail.schedule[0].id));
    await denied(() => get(req(), p(corrupt.loan.id)), 422);
    await db.update(loan).set({ bankAccountId: otherBank.id }).where(eq(loan.id, corrupt.loan.id)); await denied(() => list(req()), 422);
    await db.update(loan).set({ bankAccountId: bank.id }).where(eq(loan.id, corrupt.loan.id));
    const tamperedJournal = paid.journalEntry.id;
    await db.update(journalLine).set({ currencyCode: "GBP" }).where(eq(journalLine.journalEntryId, tamperedJournal));
    await mdenied("get_loan", { loanId: ln }, ma, 422);
    await db.update(journalLine).set({ currencyCode: "USD" }).where(eq(journalLine.journalEntryId, tamperedJournal));
    // Faults must roll back complete create/schedule/edit/delete/payment/audit/GL linking.
    const fault = await fresh({ bankAccountId: unlinkedBank.id });
    await db.execute(sql.raw("create function loan_audit_fault() returns trigger language plpgsql as $$ begin if NEW.entity_type='loan' then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger loan_audit_fault before insert on audit_log for each row execute function loan_audit_fault()"));
    for (const fn of [() => create(req(base)), () => patch(req({ name: "Fault" }), p(fault.loan.id)), () => remove(req(), p(fault.loan.id)), () => post(req(), p(fault.loan.id))]) await denied(fn, 500);
    for (const [name, args] of [["create_loan", base], ["update_loan", { loanId: fault.loan.id, name: "Fault" }], ["delete_loan", { loanId: fault.loan.id }], ["post_loan_payment", { loanId: fault.loan.id }]] as const) await mdenied(name, args);
    await db.execute(sql.raw("drop trigger loan_audit_fault on audit_log; drop function loan_audit_fault()"));
    for (const [table, event, assignment, fn, tool, args] of [
      ["loan", "insert", "NEW.principal_amount=9007199254740992", () => create(req(base)), "create_loan", base],
      ["loan_schedule", "insert", "NEW.total_payment=NEW.total_payment+1", () => create(req(base)), "create_loan", base],
      ["loan", "update", "NEW.monthly_payment=9007199254740992", () => patch(req({ name: "Fault" }), p(fault.loan.id)), "update_loan", { loanId: fault.loan.id, name: "Fault" }],
      ["loan", "update", "NEW.principal_amount=NEW.principal_amount+1", () => patch(req({ name: "Fault" }), p(fault.loan.id)), "update_loan", { loanId: fault.loan.id, name: "Fault" }],
      ["journal_line", "insert", "NEW.debit_amount=NEW.debit_amount+1", () => post(req(), p(fault.loan.id)), "post_loan_payment", { loanId: fault.loan.id }],
      ["loan_schedule", "update", "NEW.total_payment=NEW.total_payment+1", () => post(req(), p(fault.loan.id)), "post_loan_payment", { loanId: fault.loan.id }],
    ] as const) {
      await db.execute(sql.raw(`create function loan_output_fault() returns trigger language plpgsql as $$ begin ${assignment}; return NEW; end $$`));
      await db.execute(sql.raw(`create trigger loan_output_fault before ${event} on ${table} for each row execute function loan_output_fault()`));
      await denied(fn, 422); await mdenied(tool, args, ma, 422);
      await db.execute(sql.raw(`drop trigger loan_output_fault on ${table}; drop function loan_output_fault()`));
    }
    const healed = await data(await post(req(), p(fault.loan.id))); assert.ok(healed.journalEntry.id);
    assert.ok((await db.select().from(bankAccount).where(eq(bankAccount.id, unlinkedBank.id)))[0].chartAccountId);
    await db.execute(sql`update loan set principal_amount=9007199254740992 where id=${fault.loan.id}`);
    await denied(() => get(req(), p(fault.loan.id)), 422); await mdenied("update_loan", { loanId: fault.loan.id, name: "Unsafe" }, ma, 422);
    await db.update(loan).set({ deletedAt: new Date() }).where(eq(loan.id, fault.loan.id)); await denied(() => get(req(), p(fault.loan.id)), 404);
    await db.update(organization).set({ defaultCurrency: "JPY" }).where(eq(organization.id, a.id)); await denied(() => create(req(base)), 422);
    console.log("Loan contracts verified: six REST/MCP pairs, exact units/schedules, scoped ledger, permissions, periods, retries, concurrency and atomic failures");
  } finally { await ma.close(); await mb.close(); await ro.close(); await staff.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
