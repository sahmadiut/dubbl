// Runs only against the harness-created disposable migrated database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql, isNull } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, taxRate, taxComponent, costCenter, expenseClaim, expenseItem,
  periodLock, fiscalYear, journalEntry, journalLine, exchangeRate } from "../../lib/db/schema";
import { POST as create } from "../../app/api/v1/expenses/route";
import { PATCH as edit } from "../../app/api/v1/expenses/[id]/route";
import { POST as submit } from "../../app/api/v1/expenses/[id]/submit/route";
import { POST as recall } from "../../app/api/v1/expenses/[id]/recall/route";
import { POST as approve } from "../../app/api/v1/expenses/[id]/approve/route";
import { POST as reject } from "../../app/api/v1/expenses/[id]/reject/route";
import { POST as pay } from "../../app/api/v1/expenses/[id]/pay/route";
import { POST as reverse } from "../../app/api/v1/expenses/[id]/reverse/route";
import { registerExpenseCrudTools } from "../../lib/mcp/tools/expense-crud";
import { registerExpenseTools } from "../../lib/mcp/tools/expenses";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Expense lifecycle fixture", version: "1.0.0" });
  registerExpenseCrudTools(server, ctx); registerExpenseTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const names = (await client.listTools()).tools.map(tool => tool.name);
  for (const op of ["submit", "recall", "approve", "reject", "pay", "reverse"]) assert.ok(names.includes(`${op}_expense_claim`));
  assert.equal(names.length, new Set(names).size);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const relative = (days: number) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const tomorrow = relative(1), yesterday = relative(-1);
  const [a, b] = await db.insert(organization).values([{ name: "Expense lifecycle A", slug: "expense-lifecycle-a" }, { name: "Expense lifecycle B", slug: "expense-lifecycle-b" }]).returning();
  const [owner, viewer, manager, approver] = await db.insert(users).values(["owner", "viewer", "manager", "approver"].map(name => ({ email: `expense-lifecycle-${name}@example.test` }))).returning();
  const [readRole, manageRole, approveRole] = await db.insert(customRole).values([
    { organizationId: a.id, name: "Read", permissions: [] }, { organizationId: a.id, name: "Manage", permissions: ["manage:expenses"] },
    { organizationId: a.id, name: "Approve", permissions: ["approve:expenses"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: readRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id },
    { organizationId: a.id, userId: approver.id, customRoleId: approveRole.id }]);
  const keys = { a: "dk_lifecycle_a", b: "dk_lifecycle_b", viewer: "dk_lifecycle_viewer", manager: "dk_lifecycle_manager", approver: "dk_lifecycle_approver", expired: "dk_lifecycle_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : label === "approver" ? approver.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_lifecycle", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [expense, bank, foreignExpense, wrongBank] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "5990", name: "Expense", type: "expense" }, { organizationId: a.id, code: "1100", name: "Bank", type: "asset" },
    { organizationId: b.id, code: "5990", name: "Foreign", type: "expense" }, { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" }]).returning();
  const [standard, partial, reverseTax, blocked] = await db.insert(taxRate).values([
    { organizationId: a.id, name: "Standard", rate: 1000, type: "purchase" },
    { organizationId: a.id, name: "Partial", rate: 1000, type: "purchase", kind: "partial_block", recoverablePercent: 5000 },
    { organizationId: a.id, name: "Reverse", rate: 1000, type: "purchase", kind: "reverse_charge", recoverablePercent: 5000 },
    { organizationId: a.id, name: "Blocked", rate: 1000, type: "purchase", kind: "blocked" }]).returning();
  const [center] = await db.insert(costCenter).values({ organizationId: a.id, code: "TRAVEL", name: "Travel" }).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managerMcp = await mcp({ ...ctx, userId: manager.id, role: "member", permissions: ["manage:expenses"] });
  const approverMcp = await mcp({ ...ctx, userId: approver.id, role: "member", permissions: ["approve:expenses"] });
  const request = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/expenses", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const routes = { submit, recall, approve, reject, pay, reverse };
  const rest = (op: keyof typeof routes, id: string, body: unknown = {}, key = keys.a) => routes[op](request(body, key), params(id));
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const line = (amountMinor = "1100", extra = {}) => ({ date: today, description: "Travel", amountMinor, accountId: expense.id, costCenterId: center.id, ...extra });
  const draft = async (items = [line()], currencyCode = "USD") => (await data(await create(request({ title: "Lifecycle fixture", currencyCode, items })), 201)).expenseClaim;
  const tables = ["expense_claim", "expense_item", "journal_entry", "journal_line", "payment", "payment_allocation", "chart_account", "number_sequence"];
  const snapshot = async () => [...await Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (op: string, id: string, extra = {}, client = ma) => { const before = await snapshot(); assert.equal((await client.call(`${op}_expense_claim`, { expenseClaimId: id, ...extra })).isError, true); assert.deepEqual(await snapshot(), before); };
  const entries = (id: string) => db.select().from(journalEntry).where(and(eq(journalEntry.sourceId, id), isNull(journalEntry.reversedByEntryId)));
  const legs = (id: string) => db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
  const netByCode = async (id: string) => { const values: Record<string, bigint> = {}; for (const l of await legs(id)) {
    const [account] = await db.select().from(chartAccount).where(eq(chartAccount.id, l.accountId));
    values[account.code] = (values[account.code] ?? 0n) + BigInt(l.debitAmount) - BigInt(l.creditAmount);
    assert.equal(l.rateMigrationStatus, "exact"); assert.equal(l.rateDirection, "quote_per_base");
  } assert.equal(Object.values(values).reduce((s, n) => s + n, 0n), 0n); return values; };
  const approveDraft = async (row: { id: string }) => { await data(await rest("submit", row.id)); return (await data(await rest("approve", row.id))).expenseClaim; };
  try {
    const basic = await draft();
    for (const op of Object.keys(routes) as (keyof typeof routes)[]) {
      const body = op === "pay" ? { date: today } : op === "reject" ? { reason: "Correction" } : {};
      await denied(() => rest(op, basic.id, body, keys.viewer), 403);
      await denied(() => rest(op, basic.id, body, keys.b), 404);
      await denied(() => rest(op, basic.id, body, "dk_invalid"), 401);
      await denied(() => rest(op, basic.id, body, keys.expired), 401);
      await denied(() => rest(op, randomUUID(), body), 404);
      await denied(() => rest(op, "bad", body), 400);
      await mcpDenied(op, basic.id, body, readOnly); await mcpDenied(op, basic.id, body, mb);
      await mcpDenied(op, basic.id, { ...body, amountMinor: "1" });
    }
    for (const op of ["approve", "reject", "pay", "reverse"] as const) {
      const body = op === "pay" ? { date: today } : op === "reject" ? { reason: "Correction" } : {};
      await denied(() => rest(op, basic.id, body, keys.manager), 403); await mcpDenied(op, basic.id, body, managerMcp);
    }
    await denied(() => rest("submit", basic.id, {}, keys.approver), 403); await mcpDenied("submit", basic.id, {}, approverMcp);
    await data(await rest("submit", basic.id, {}, keys.manager)); await denied(() => rest("submit", basic.id), 400);
    await data(await rest("recall", basic.id, {}, keys.manager)); await data(await rest("submit", basic.id));
    await denied(() => rest("reject", basic.id, { reason: " " }), 400); await mcpDenied("reject", basic.id, { reason: " " });
    await data(await rest("reject", basic.id, { reason: "Correct receipt" }, keys.approver));
    assert.equal((await ma.call("submit_expense_claim", { expenseClaimId: basic.id })).body.expenseClaim.rejectionReason, null);
    assert.equal((await ma.call("recall_expense_claim", { expenseClaimId: basic.id })).body.expenseClaim.status, "draft");
    await ma.call("submit_expense_claim", { expenseClaimId: basic.id });
    assert.equal((await approverMcp.call("reject_expense_claim", { expenseClaimId: basic.id, reason: "Again" })).body.expenseClaim.status, "rejected");
    await ma.call("submit_expense_claim", { expenseClaimId: basic.id });
    const approved = (await approverMcp.call("approve_expense_claim", { expenseClaimId: basic.id })).body.expenseClaim;
    assert.equal(approved.totalAmount, 1100); assert.equal(approved.totalAmountMinor, "1100");
    assert.deepEqual(await netByCode(approved.journalEntryId), { "5990": 1100n, "2110": -1100n });
    await denied(() => rest("approve", basic.id), 400); await denied(() => rest("recall", basic.id), 400);
    for (const body of [{ date: "2026-02-30" }, { date: today, amountMinor: "1" }, { date: yesterday }, { date: today, bankAccountCode: "missing" }, { date: today, bankAccountCode: wrongBank.code }]) {
      await denied(() => rest("pay", basic.id, body), 400); await mcpDenied("pay", basic.id, body);
    }
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, bank.id)); await denied(() => rest("pay", basic.id, { date: today }), 400);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, bank.id));
    const paid = (await data(await rest("pay", basic.id, { date: today }, keys.approver))).expenseClaim;
    assert.equal(paid.status, "paid"); assert.equal(paid.totalAmountMinor, "1100");
    const payment = (await entries(basic.id)).find(e => e.sourceType === "expense_claim_payment")!;
    assert.deepEqual(await netByCode(payment.id), { "2110": 1100n, "1100": -1100n });
    await denied(() => rest("pay", basic.id, { date: today }), 400);
    const originals = await entries(basic.id), originalLines = await Promise.all(originals.map(e => legs(e.id)));
    assert.equal((await ma.call("reverse_expense_claim", { expenseClaimId: basic.id })).body.expenseClaim.status, "draft");
    for (const [i, original] of originals.entries()) {
      const [saved] = await db.select().from(journalEntry).where(eq(journalEntry.id, original.id));
      assert.ok(saved.reversedByEntryId); const mirrored = await legs(saved.reversedByEntryId!);
      const shape = (l: typeof mirrored[number], reversed = false) => [l.accountId, reversed ? l.creditAmount : l.debitAmount,
        reversed ? l.debitAmount : l.creditAmount, l.rateExact, l.exchangeRate, l.currencyCode, l.costCenterId, l.projectId].join("|");
      assert.deepEqual(mirrored.map(l => shape(l)).sort(), originalLines[i].map(l => shape(l, true)).sort());
    }
    await denied(() => rest("reverse", basic.id), 400);
    await approveDraft(basic); await data(await rest("reverse", basic.id));
    const taxClaim = await draft([line("1100", { taxRateId: standard.id }), line("1100", { taxRateId: partial.id }),
      line("1000", { taxRateId: reverseTax.id }), line("1100", { taxRateId: blocked.id })]);
    const taxApproval = await approveDraft(taxClaim);
    assert.deepEqual(await netByCode(taxApproval.journalEntryId), { "5990": 4200n, "1500": 200n, "2200": -100n, "2110": -4300n });
    const [payable] = await db.select().from(chartAccount).where(and(eq(chartAccount.organizationId, a.id), eq(chartAccount.code, "2110")));
    for (const l of await legs(taxApproval.journalEntryId)) if (l.accountId !== payable.id) assert.equal(l.costCenterId, center.id);
    await db.update(taxRate).set({ rate: 2000 }).where(eq(taxRate.id, standard.id)); await data(await rest("reverse", taxClaim.id));
    const euro = await draft([line("1000")], "EUR"); await data(await rest("submit", euro.id));
    await denied(() => rest("approve", euro.id), 422); await mcpDenied("approve", euro.id);
    const [fx] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: today, rate: 1200000, source: "manual" }).returning();
    const euroApproved = (await data(await rest("approve", euro.id))).expenseClaim;
    assert.deepEqual(await netByCode(euroApproved.journalEntryId), { "5990": 1200n, "2110": -1200n });
    await db.update(exchangeRate).set({ rate: 1400000 }).where(eq(exchangeRate.id, fx.id));
    assert.equal((await ma.call("pay_expense_claim", { expenseClaimId: euro.id, date: today })).isError, false);
    const euroPayment = (await entries(euro.id)).find(e => e.sourceType === "expense_claim_payment")!;
    assert.deepEqual(await netByCode(euroPayment.id), { "2110": 1200n, "1100": -1400n, "5930": 200n });
    await db.delete(exchangeRate).where(eq(exchangeRate.id, fx.id)); await data(await rest("reverse", euro.id));
    // Unsupported FX/compound tax/zero base conversion cannot leave accounts or journals.
    const invalidFx = await draft([line("1")], "GBP"); await data(await rest("submit", invalidFx.id));
    const [tiny] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "GBP", targetCurrency: "USD", date: today, rate: 1, source: "manual" }).returning();
    await denied(() => rest("approve", invalidFx.id), 422);
    await assert.rejects(() => db.update(exchangeRate).set({ rateExact: "0.0000015" }).where(eq(exchangeRate.id, tiny.id)));
    await db.update(exchangeRate).set({ baseCurrency: "USD", targetCurrency: "GBP", rate: 3000000 }).where(eq(exchangeRate.id, tiny.id));
    await denied(() => rest("approve", invalidFx.id), 422);
    const compound = await draft([line("1100", { taxRateId: standard.id })]); await data(await rest("submit", compound.id));
    const [component] = await db.insert(taxComponent).values({ taxRateId: standard.id, name: "Compound", rate: 500 }).returning();
    await denied(() => rest("approve", compound.id), 422); await mcpDenied("approve", compound.id);
    await db.delete(taxComponent).where(eq(taxComponent.id, component.id));
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "JPY", targetCurrency: "USD", date: today, rate: 10000, source: "manual" });
    const yen = await draft([line("1000")], "JPY"); const yenApproved = await approveDraft(yen);
    assert.deepEqual(await netByCode(yenApproved.journalEntryId), { "5990": 1000n, "2110": -1000n });
    await db.update(exchangeRate).set({ rate: 5000 }).where(eq(exchangeRate.baseCurrency, "JPY"));
    await data(await rest("pay", yen.id, { date: today }));
    assert.deepEqual(await netByCode((await entries(yen.id)).find(e => e.sourceType === "expense_claim_payment")!.id), { "2110": 1000n, "1100": -500n, "4910": -500n });
    await data(await rest("reverse", yen.id));
    const max = await draft([line("9007199254740991")]); const maxApproved = await approveDraft(max);
    assert.equal(maxApproved.totalAmountMinor, "9007199254740991"); await data(await rest("pay", max.id, { date: today })); await data(await rest("reverse", max.id));
    const zero = await draft([line("0")]); await denied(() => rest("submit", zero.id), 400);
    const future = await draft([line("1", { date: tomorrow })]); await data(await rest("submit", future.id)); await denied(() => rest("approve", future.id), 400);
    const corrupt = await draft(); await db.update(expenseClaim).set({ totalAmount: 1 }).where(eq(expenseClaim.id, corrupt.id)); await denied(() => rest("submit", corrupt.id), 422);
    await db.update(expenseClaim).set({ totalAmount: 1100 }).where(eq(expenseClaim.id, corrupt.id));
    await db.update(expenseItem).set({ accountId: foreignExpense.id }).where(eq(expenseItem.expenseClaimId, corrupt.id)); await denied(() => rest("submit", corrupt.id), 422);
    await db.update(expenseItem).set({ accountId: expense.id }).where(eq(expenseItem.expenseClaimId, corrupt.id));
    await db.execute(sql`update expense_claim set total_amount=9007199254740992 where id=${corrupt.id}`); await denied(() => rest("submit", corrupt.id), 422);
    await db.execute(sql`update expense_claim set total_amount=1100 where id=${corrupt.id}`);
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, expense.id)); await denied(() => rest("submit", corrupt.id), 400);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, expense.id));
    const locked = await draft(); await data(await rest("submit", locked.id));
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today }).returning();
    await denied(() => rest("approve", locked.id), 422); await mcpDenied("approve", locked.id);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id)); const lockedApproved = (await data(await rest("approve", locked.id))).expenseClaim;
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: today, endDate: tomorrow, isClosed: true }).returning();
    await denied(() => rest("pay", locked.id, { date: tomorrow }), 422); await denied(() => rest("reverse", locked.id), 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    await db.update(organization).set({ defaultCurrency: "EUR" }).where(eq(organization.id, a.id));
    await denied(() => rest("pay", locked.id, { date: today }), 422); await denied(() => rest("reverse", locked.id), 422);
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    const [tier] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today, advisorLockDate: yesterday }).returning();
    await denied(() => rest("pay", locked.id, { date: today }, keys.approver), 422);
    await data(await rest("pay", locked.id, { date: today })); await db.delete(periodLock).where(eq(periodLock.id, tier.id));
    const oldLeg = (await legs(lockedApproved.journalEntryId))[0];
    await db.execute(sql`update journal_line set debit_amount=debit_amount+1 where id=${oldLeg.id}`); await denied(() => rest("reverse", locked.id), 422);
    await db.execute(sql`update journal_line set debit_amount=${oldLeg.debitAmount} where id=${oldLeg.id}`);
    await db.execute(sql`delete from audit_log where entity_type='expense' and entity_id=${locked.id} and action='approve'`); await denied(() => rest("reverse", locked.id), 422);
    const ambiguous = await draft(); const ambiguousApproved = await approveDraft(ambiguous);
    const [duplicate] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 5000, date: today, description: "Ambiguous fixture", status: "posted", sourceType: "expense_claim", sourceId: ambiguous.id }).returning();
    await denied(() => rest("pay", ambiguous.id, { date: today }), 422); await denied(() => rest("reverse", ambiguous.id), 422);
    await db.delete(journalEntry).where(eq(journalEntry.id, duplicate.id));
    await db.update(journalEntry).set({ status: "draft" }).where(eq(journalEntry.id, ambiguousApproved.journalEntryId));
    await denied(() => rest("pay", ambiguous.id, { date: today }), 422);
    await db.update(journalEntry).set({ status: "posted" }).where(eq(journalEntry.id, ambiguousApproved.journalEntryId));
    await db.execute(sql`delete from audit_log where entity_type='expense' and entity_id=${ambiguous.id} and action='approve'`);
    await denied(() => rest("pay", ambiguous.id, { date: today }), 422);
    const fault = await draft(); await data(await rest("submit", fault.id));
    await db.execute(sql.raw("create function fail_lifecycle_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type='expense' and NEW.action<>'create' then raise exception 'fixture lifecycle audit failure'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger fixture_lifecycle_audit before insert on audit_log for each row execute function fail_lifecycle_audit()"));
    for (const op of ["approve", "recall", "reject"] as const) await denied(() => rest(op, fault.id, { reason: "Fault" }), 500);
    await mcpDenied("approve", fault.id);
    await db.execute(sql.raw("drop trigger fixture_lifecycle_audit on audit_log")); await data(await rest("approve", fault.id));
    await db.execute(sql.raw("create trigger fixture_lifecycle_audit before insert on audit_log for each row execute function fail_lifecycle_audit()"));
    await denied(() => rest("pay", fault.id, { date: today }), 500); await denied(() => rest("reverse", fault.id), 500);
    await mcpDenied("pay", fault.id, { date: today }); await mcpDenied("reverse", fault.id);
    await db.execute(sql.raw("drop trigger fixture_lifecycle_audit on audit_log; drop function fail_lifecycle_audit()"));
    const parallel = await draft(); await data(await rest("submit", parallel.id));
    const approvals = await Promise.all([rest("approve", parallel.id), rest("approve", parallel.id)]); assert.deepEqual(approvals.map(r => r.status).sort(), [200, 400]);
    const pays = await Promise.all([rest("pay", parallel.id, { date: today }), ma.call("pay_expense_claim", { expenseClaimId: parallel.id, date: today })]);
    assert.equal((pays[0] as Response).status === 200 ? (pays[1] as { isError: boolean }).isError : !(pays[1] as { isError: boolean }).isError, true);
    assert.equal((await entries(parallel.id)).filter(e => e.sourceType === "expense_claim_payment").length, 1);
    const reversals = await Promise.all([rest("reverse", parallel.id), rest("reverse", parallel.id)]); assert.deepEqual(reversals.map(r => r.status).sort(), [200, 400]);
    const editing = await draft();
    const editSubmit = await Promise.all([edit(request({ items: [line("1200")] }), params(editing.id)), rest("submit", editing.id)]);
    assert.equal(editSubmit[1].status, 200); assert.ok([200, 400].includes(editSubmit[0].status));
    const [saved] = await db.select().from(expenseClaim).where(eq(expenseClaim.id, editing.id)); const savedItems = await db.select().from(expenseItem).where(eq(expenseItem.expenseClaimId, editing.id));
    assert.equal(saved.totalAmount, savedItems[0].amount); assert.equal(saved.status, "submitted");
    const decisions = await Promise.all([rest("approve", editing.id), rest("recall", editing.id)]); assert.deepEqual(decisions.map(r => r.status).sort(), [200, 400]);
    assert.equal((await db.execute(sql`select count(*)::int n from payment`)).rows[0].n, 0);
    console.log("REST and MCP expense lifecycle verified");
  } finally { await Promise.all([ma.close(), mb.close(), readOnly.close(), managerMcp.close(), approverMcp.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
