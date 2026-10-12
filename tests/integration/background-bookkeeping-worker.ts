import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, fixedAsset, bankAccount, contact, invoice,
  loan, loanSchedule, revenueSchedule, revenueEntry, journalEntry, journalLine, periodLock, costCenter, project } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as createAsset } from "../../app/api/v1/fixed-assets/route";
import { GET as getAsset } from "../../app/api/v1/fixed-assets/[id]/route";
import { POST as createLoan } from "../../app/api/v1/loans/route";
import { GET as getLoan } from "../../app/api/v1/loans/[id]/route";
import { POST as createRevenue } from "../../app/api/v1/revenue-schedules/route";
import { GET as getRevenue } from "../../app/api/v1/revenue-schedules/[id]/route";
import { POST as createEntry } from "../../app/api/v1/entries/route";
import { GET as getEntry } from "../../app/api/v1/entries/[id]/route";
import { processBookkeepingMaintenance, processDepreciation, processLoanPayments, processRevenueRecognition } from "../../lib/api/bookkeeping-maintenance";
import { processAutoReversals } from "../../lib/api/auto-reverse";

const today = new Date().toISOString().slice(0, 10);
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function data(response: Response, status = 200) {
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
}
let ordinal = 0;
async function tenant(currency = "USD", ownerExists = true) {
  const tag = ++ordinal;
  const [org] = await db.insert(organization).values({ name: "Background " + tag, slug: "background-" + tag, defaultCurrency: currency }).returning();
  const [owner] = await db.insert(users).values({ email: `background-${tag}@example.test` }).returning();
  if (ownerExists) await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const key = "dk_background_" + tag;
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_background",
    keyHash: createHash("sha256").update(key).digest("hex") });
  const server = new McpServer({ name: "Background fixture", version: "1" });
  registerAllTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const [expense, accumulated, liability, interest, cash, revenue, deferred] = await db.insert(chartAccount).values([
    { code: "5900", name: "Depreciation", type: "expense" as const },
    { code: "1590", name: "Accumulated", type: "asset" as const },
    { code: "2300", name: "Principal", type: "liability" as const },
    { code: "5901", name: "Interest", type: "expense" as const },
    { code: "1100", name: "Cash", type: "asset" as const },
    { code: "4000", name: "Revenue", type: "revenue" as const },
    { code: "2500", name: "Deferred", type: "liability" as const },
  ].map(row => ({ ...row, organizationId: org.id, currencyCode: currency }))).returning();
  return { org, owner, expense, accumulated, liability, interest, cash, revenue, deferred,
    req(body?: unknown, method = "POST") { return new Request("http://fixture.test", { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); },
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { text: string }[])[0].text, body = JSON.parse(text);
      assert.equal(result.isError === true, false, `${name}: ${text}`); return body;
    },
    async close() { await client.close(); await server.close(); },
  };
}
type Tenant = Awaited<ReturnType<typeof tenant>>;
const connections: Tenant[] = [];
async function newTenant(currency = "USD", owner = true) { const t = await tenant(currency, owner); connections.push(t); return t; }
async function snapshot() {
  const tables = ["organization", "fixed_asset", "depreciation_entry", "loan", "loan_schedule", "bank_account", "chart_account",
    "revenue_schedule", "revenue_entry", "journal_entry", "journal_line", "audit_log"];
  const rows = [];
  for (const table of tables) {
    // Serialize SQL text before JS sees bigint/numeric tokens, preserving every low digit.
    const result = await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)::text as state from ${table} t`));
    rows.push(result.rows[0].state);
  }
  return JSON.stringify(rows);
}
async function journalAmounts(id: string) {
  return (await db.execute(sql`select account_id, debit_amount::text as debit, credit_amount::text as credit,
    currency_code, exchange_rate, rate_exact::text as rate, rate_direction, rate_format_version, rate_provenance, rate_migration_status,
    description, cost_center_id, project_id from journal_line where journal_entry_id = ${id} order by account_id, debit_amount`)).rows;
}
async function sourceInvoice(t: Tenant, currency = t.org.defaultCurrency) {
  const [customer] = await db.insert(contact).values({ organizationId: t.org.id, name: "Customer", type: "customer" }).returning();
  const [row] = await db.insert(invoice).values({ organizationId: t.org.id, contactId: customer.id, invoiceNumber: "SOURCE",
    issueDate: "2024-01-01", dueDate: "2024-01-31", status: "sent", currencyCode: currency }).returning();
  return row;
}
async function run() {
  // Four bases preserve fixed stored asset cents; no currency/magnitude rescaling.
  const assetCases = [];
  for (const currency of ["USD", "JPY", "KWD", "IRR"]) {
    const t = await newTenant(currency);
    const amount = currency === "USD" ? "9007199254740991" : "3000000001";
    const input = { name: "Scheduled exact", assetNumber: currency, purchaseDate: "2024-01-01", purchasePriceMinor: amount,
      usefulLifeMonths: 3, depreciationAccountId: t.expense.id, accumulatedDepAccountId: t.accumulated.id };
    const created = currency === "USD" ? await data(await createAsset(t.req(input)), 201) : await t.call("create_fixed_asset", input);
    assetCases.push({ t, id: created.asset.id as string, amount, expected: currency === "USD" ? "3002399751580330" : "1000000000" });
  }
  const t = assetCases[0].t;
  const [bank] = await db.insert(bankAccount).values({ organizationId: t.org.id, accountName: "Repayment", bankName: "Fixture",
    accountType: "checking", chartAccountId: t.cash.id, balance: 999 }).returning();
  const loanInput = { name: "Scheduled loan", principalAmountMinor: "3000000001", interestRate: 0, termMonths: 3, startDate: "2024-01-01",
    principalAccountId: t.liability.id, interestAccountId: t.interest.id, bankAccountId: bank.id };
  const loanResult = await data(await createLoan(t.req(loanInput)), 201), loanId = loanResult.loan.id as string;
  const source = await sourceInvoice(t);
  const revenueResult = await data(await createRevenue(t.req({ invoiceId: source.id, totalAmountMinor: "3000000001",
    startDate: "2024-01-01", endDate: "2024-03-31" })), 201), revenueId = revenueResult.schedule.id as string;
  // Actual scheduled maintenance composition also invokes bank reconciliation and both alert workers.
  const first = await processBookkeepingMaintenance();
  assert.deepEqual(first.depreciation, { processed: 4, skipped: 0 });
  assert.deepEqual(first.loanPayments, { processed: 3, skipped: 0 });
  assert.deepEqual(first.revenueRecognition, { processed: 3, skipped: 0 });
  assert.deepEqual(first.autoReconciliation, { checked: 0, reconciled: 0, skipped: 0 });
  assert.deepEqual(first.budgetAlerts, { checked: 0, alerted: 0 });
  assert.deepEqual(first.balanceAlerts, { checked: 0, alerted: 0 });
  for (const c of assetCases) {
    const r = (await data(await getAsset(c.t.req(undefined, "GET"), params(c.id)))).asset;
    const m = (await c.t.call("get_fixed_asset", { assetId: c.id })).asset;
    assert.deepEqual(r, m); assert.equal(r.purchasePriceMinor, c.amount);
    assert.equal(r.accumulatedDepreciationMinor, c.expected);
    assert.equal(r.netBookValueMinor, (BigInt(c.amount) - BigInt(c.expected)).toString());
    assert.equal(r.depreciationEntries.length, 1); assert.equal(r.depreciationEntries[0].amountMinor, c.expected);
    const legs = await journalAmounts(r.depreciationEntries[0].journalEntryId);
    assert.equal(legs.reduce((s, l) => s + BigInt(l.debit as string), 0n), BigInt(c.expected));
    assert.ok(legs.every(l => l.currency_code === c.t.org.defaultCurrency && /^1(?:\.0+)?$/.test(String(l.rate))), JSON.stringify(legs));
  }
  const ld = await data(await getLoan(t.req(undefined, "GET"), params(loanId)));
  assert.deepEqual(ld, await t.call("get_loan", { loanId }));
  assert.equal(ld.loan.status, "paid_off");
  assert.deepEqual(ld.schedule.map((e: { principalAmountMinor: string }) => e.principalAmountMinor), ["1000000000", "1000000000", "1000000001"]);
  assert.equal(ld.schedule.at(-1).remainingBalanceMinor, "0");
  const rd = (await data(await getRevenue(t.req(undefined, "GET"), params(revenueId)))).schedule;
  assert.deepEqual(rd, (await t.call("get_revenue_schedule", { scheduleId: revenueId })).revenueSchedule);
  assert.equal(rd.status, "completed"); assert.equal(rd.recognizedAmountMinor, "3000000001");
  assert.deepEqual(rd.entries.map((e: { amountMinor: string }) => e.amountMinor), ["1000000000", "1000000000", "1000000001"]);
  const repeat = await snapshot(); await processBookkeepingMaintenance(); assert.equal(await snapshot(), repeat);
  // Manual target replay after cron must never consume another period.
  await t.call("post_loan_payment", { loanId, scheduleEntryId: ld.schedule[0].id });
  await t.call("recognize_revenue_entry", { scheduleId: revenueId, entryId: rd.entries[0].id });
  // Revenue target replay records no audit without a retry key; loan replays its saved domain result.
  assert.equal(await snapshot(), repeat);

  // Locked, inconsistent, unsafe, foreign, usage-based and ownerless assets never post.
  const bad = await newTenant(), missing = await newTenant("USD", false);
  const [badAsset, lockedAsset, foreignAsset, usageAsset, unsafeAsset, missingAsset] = await db.insert(fixedAsset).values([
    { name: "Mismatch", netBookValue: 1249 }, { name: "Locked" }, { name: "Foreign", depreciationAccountId: t.expense.id },
    { name: "Usage", depreciationMethod: "units_of_production" as const, totalExpectedUnits: 10 },
    { name: "Unsafe" }, { name: "Ownerless", organizationId: missing.org.id, depreciationAccountId: missing.expense.id, accumulatedDepAccountId: missing.accumulated.id },
  ].map((row, i) => ({ organizationId: bad.org.id, assetNumber: "NEG" + i, purchaseDate: "2024-01-01", purchasePrice: 1250,
    netBookValue: 1250, usefulLifeMonths: 3, depreciationAccountId: bad.expense.id, accumulatedDepAccountId: bad.accumulated.id, ...row }))).returning();
  assert.ok(badAsset && foreignAsset && usageAsset && missingAsset);
  await db.execute(sql`update fixed_asset set purchase_price = 9007199254740992, net_book_value = 9007199254740992 where id = ${unsafeAsset.id}`);
  await db.insert(periodLock).values({ organizationId: bad.org.id, lockDate: today });
  const lockedState = await snapshot(); assert.equal((await processDepreciation()).processed, 0); assert.equal(await snapshot(), lockedState);
  await db.delete(periodLock).where(eq(periodLock.organizationId, bad.org.id));
  // Only the valid previously locked asset can now post; corruption does not poison unrelated targets.
  assert.equal((await processDepreciation()).processed, 1);
  assert.equal((await db.select().from(fixedAsset).where(eq(fixedAsset.id, lockedAsset.id)))[0].accumulatedDepreciation, 417);
  const negativeState = await snapshot(); await processDepreciation(); assert.equal(await snapshot(), negativeState);

  // Bad loan allocation and revenue source/base disagreement remain pending and unmodified.
  const pendingLoan = (await bad.call("create_loan", { ...loanInput, bankAccountId: undefined,
    principalAccountId: bad.liability.id, interestAccountId: bad.interest.id })).loan;
  await db.update(loanSchedule).set({ totalPayment: 1 }).where(eq(loanSchedule.loanId, pendingLoan.id));
  const badSource = await sourceInvoice(bad);
  const pendingRevenue = (await bad.call("create_revenue_schedule", { invoiceId: badSource.id, totalAmountMinor: "1250",
    startDate: "2024-01-01", endDate: "2024-03-31" })).revenueSchedule;
  await db.update(invoice).set({ currencyCode: "EUR" }).where(eq(invoice.id, badSource.id));
  const pendingState = await snapshot();
  assert.equal((await processLoanPayments()).processed, 0); assert.equal((await processRevenueRecognition()).processed, 0);
  assert.equal(await snapshot(), pendingState);
  assert.equal((await db.select().from(loan).where(eq(loan.id, pendingLoan.id)))[0].status, "active");
  assert.equal((await db.select().from(revenueSchedule).where(eq(revenueSchedule.id, pendingRevenue.id)))[0].recognizedAmount, 0);

  // Real manual/cron races target the same saved period, never the next payment.
  const raceLoan = (await t.call("create_loan", { ...loanInput, principalAmountMinor: "1251", termMonths: 1 })).loan;
  const raceLoanEntry = (await t.call("get_loan", { loanId: raceLoan.id })).schedule[0];
  await Promise.all([processLoanPayments(), t.call("post_loan_payment", { loanId: raceLoan.id, scheduleEntryId: raceLoanEntry.id })]);
  assert.equal((await db.execute(sql`select count(*)::text as count from journal_entry where source_type = 'loan' and source_id = ${raceLoan.id}`)).rows[0].count, "1");
  const raceRevenue = (await t.call("create_revenue_schedule", { invoiceId: source.id, totalAmountMinor: "1251",
    startDate: "2024-01-01", endDate: "2024-01-31" })).revenueSchedule;
  await Promise.all([processRevenueRecognition(), t.call("recognize_revenue_entry", { scheduleId: raceRevenue.id, entryId: raceRevenue.entries[0].id })]);
  assert.equal((await db.execute(sql`select count(*)::text as count from journal_entry where source_type = 'revenue_recognition' and source_id = ${raceRevenue.id}`)).rows[0].count, "1");
  const racesDone = await snapshot(); await processLoanPayments(); await processRevenueRecognition(); assert.equal(await snapshot(), racesDone);

  // Saved multi-currency metadata/dimensions survive mirror reversal and historical reference edits.
  const auto = await newTenant();
  const [center] = await db.insert(costCenter).values({ organizationId: auto.org.id, name: "Center", code: "C" }).returning();
  const [job] = await db.insert(project).values({ organizationId: auto.org.id, name: "Project" }).returning();
  async function original(amount = "3000000001") {
    const created = await data(await createEntry(auto.req({ date: "2024-01-01", description: "Accrual", lines: [
      { accountId: auto.expense.id, debitAmountMinor: amount, currencyCode: "KWD", rateExact: "1.234567", costCenterId: center.id, projectId: job.id },
      { accountId: auto.liability.id, creditAmountMinor: amount, currencyCode: "KWD", rateExact: "1.234567", costCenterId: center.id, projectId: job.id },
    ] })), 201);
    await auto.call("post_entry", { entryId: created.entry.id });
    await auto.call("set_auto_reverse_date", { entryId: created.entry.id, autoReverseDate: today });
    return created.entry.id as string;
  }
  const originalId = await original();
  await db.update(journalEntry).set({ createdBy: null }).where(eq(journalEntry.id, originalId));
  const originalRows = await journalAmounts(originalId);
  // Original period is closed after scheduling; an open reversal date is still allowed.
  await db.insert(periodLock).values({ organizationId: auto.org.id, lockDate: "2024-01-31" });
  await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, auto.expense.id));
  const race = await Promise.all([processAutoReversals(), processAutoReversals()]);
  assert.equal(race.reduce((sum, r) => sum + r.reversed, 0), 1); assert.equal(race.reduce((sum, r) => sum + r.failed, 0), 0);
  const [orig] = await db.select().from(journalEntry).where(eq(journalEntry.id, originalId));
  const [rev] = await db.select().from(journalEntry).where(eq(journalEntry.id, orig.reversedByEntryId!));
  assert.equal(rev.reversesEntryId, originalId); assert.equal(rev.date, today); assert.equal(orig.status, "posted");
  assert.equal(rev.createdBy, null);
  assert.deepEqual((await db.execute(sql`select user_id, changes->>'reversalEntryId' as reversal from audit_log
    where entity_id = ${originalId} and action = 'auto_reverse'`)).rows, [{ user_id: auto.owner.id, reversal: rev.id }]);
  const reversedRows = await journalAmounts(rev.id);
  assert.deepEqual(reversedRows.map(row => ({ ...row, debit: row.credit, credit: row.debit })), originalRows);
  assert.deepEqual(await journalAmounts(originalId), originalRows);
  const restRev = (await data(await getEntry(auto.req(undefined, "GET"), params(rev.id)))).entry;
  const mcpRev = (await auto.call("get_entry", { entryId: rev.id })).entry;
  assert.equal(restRev.lines.find((l: { debitAmountMinor: string }) => l.debitAmountMinor === "3000000001").debitAmount, "30000000.01");
  assert.equal(mcpRev.lines.find((l: { debitAmountMinor: string }) => l.debitAmountMinor === "3000000001").debitAmount, 3000000001);
  const afterReversal = await snapshot(); assert.deepEqual(await processAutoReversals(), { checked: 0, reversed: 0, failed: 0 });
  assert.equal(await snapshot(), afterReversal);
  await assert.rejects(processAutoReversals("2026-02-30")); assert.equal(await snapshot(), afterReversal);

  // Negative reversal cases must leave the complete SQL snapshot unchanged and stay due.
  await db.delete(periodLock).where(eq(periodLock.organizationId, auto.org.id));
  await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, auto.expense.id));
  const blockedId = await original("1250"), foreignId = await original("1251"), unsafeId = await original("1252"), emptyId = await original("1253");
  const fxId = await original("1254"), dimensionId = await original("1255"), unbalancedId = await original("1256");
  await db.update(journalLine).set({ accountId: bad.expense.id }).where(and(eq(journalLine.journalEntryId, foreignId), eq(journalLine.accountId, auto.expense.id)));
  await db.execute(sql`update journal_line set debit_amount = 9007199254740992 where journal_entry_id = ${unsafeId} and debit_amount > 0`);
  await db.delete(journalLine).where(eq(journalLine.journalEntryId, emptyId));
  const [foreignProject] = await db.insert(project).values({ organizationId: bad.org.id, name: "Foreign dimension" }).returning();
  await db.update(journalLine).set({ projectId: foreignProject.id }).where(eq(journalLine.journalEntryId, dimensionId));
  await db.update(journalLine).set({ creditAmount: 1 }).where(and(eq(journalLine.journalEntryId, unbalancedId), eq(journalLine.accountId, auto.liability.id)));
  // Seed unqualified preexisting FX only in this disposable fixture; restore the guard before running the job.
  await db.transaction(async tx => {
    await tx.execute(sql`alter table journal_line disable trigger journal_line_exact_sync`);
    await tx.execute(sql`update journal_line set rate_migration_status = 'pending' where journal_entry_id = ${fxId}`);
    await tx.execute(sql`alter table journal_line enable trigger journal_line_exact_sync`);
  });
  await db.insert(periodLock).values({ organizationId: auto.org.id, lockDate: today });
  const blocked = await snapshot(); assert.deepEqual(await processAutoReversals(), { checked: 7, reversed: 0, failed: 7 }); assert.equal(await snapshot(), blocked);
  await db.delete(periodLock).where(eq(periodLock.organizationId, auto.org.id));
  assert.deepEqual(await processAutoReversals(), { checked: 7, reversed: 1, failed: 6 });
  const [unblocked] = await db.select().from(journalEntry).where(eq(journalEntry.id, blockedId)); assert.ok(unblocked.reversedByEntryId);
  const corrupt = await snapshot(); assert.deepEqual(await processAutoReversals(), { checked: 6, reversed: 0, failed: 6 }); assert.equal(await snapshot(), corrupt);
  // An audit failure must roll back already-inserted mirror header/legs and original links.
  const auditId = await original("1257");
  await db.execute(sql`create function reject_background_audit() returns trigger language plpgsql as $$
    begin if NEW.action = 'auto_reverse' then raise exception 'synthetic audit failure'; end if; return NEW; end; $$`);
  await db.execute(sql`create trigger reject_background_audit before insert on audit_log for each row execute function reject_background_audit()`);
  const auditState = await snapshot(); assert.deepEqual(await processAutoReversals(), { checked: 7, reversed: 0, failed: 7 }); assert.equal(await snapshot(), auditState);
  await db.execute(sql`drop trigger reject_background_audit on audit_log`);
  await db.execute(sql`drop function reject_background_audit()`);
  assert.deepEqual(await processAutoReversals(), { checked: 7, reversed: 1, failed: 6 });
  assert.ok((await db.select().from(journalEntry).where(eq(journalEntry.id, auditId)))[0].reversedByEntryId);
  // All valid scheduled journals remain balanced in literal SQL base raw units.
  const unbalanced = (await db.execute(sql`select j.id from journal_entry j join journal_line l on l.journal_entry_id = j.id
    where j.organization_id <> ${auto.org.id} group by j.id having sum(l.debit_amount) <> sum(l.credit_amount)`)).rows;
  assert.deepEqual(unbalanced, []);
  const [cashRow] = await db.select().from(bankAccount).where(eq(bankAccount.id, bank.id)); assert.equal(cashRow.balance, 999);
  assert.equal((await db.select().from(revenueEntry).where(eq(revenueEntry.scheduleId, pendingRevenue.id))).every(e => !e.recognized), true);
  console.log("Background bookkeeping REST MCP SQL verified");
}
run().then(async () => { for (const t of connections) await t.close(); process.exit(0); }).catch(error => { console.error(error); process.exit(1); });
