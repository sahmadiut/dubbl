import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact, chartAccount, invoice, bill, payment, journalEntry, journalLine,
  exchangeRate, periodLock, fiscalYear, costCenter, auditLog, taxRate } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as getEntry } from "../../app/api/v1/entries/[id]/route";
import { processFxRevaluationForOrg, processFxRevaluation } from "../../lib/api/fx-revaluation";

const asOf = "2026-09-30", reversal = "2026-10-01";
let ordinal = 0;
const connections: { close(): Promise<void> }[] = [];
async function tenant(base = "USD", ownerExists = true) {
  const n = ++ordinal;
  const [org] = await db.insert(organization).values({ name: `Revaluation ${n}`, slug: `revalue-${n}`, defaultCurrency: base }).returning();
  const [owner] = await db.insert(users).values({ email: `revalue-${n}@example.test` }).returning();
  if (ownerExists) await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const key = `dk_revalue_${n}`;
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_revalue", keyHash: createHash("sha256").update(key).digest("hex") });
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Both", type: "both" }).returning();
  const [ar, ap, revenue, expense, cash] = await db.insert(chartAccount).values([
    { code: "1200", name: "AR", type: "asset" as const }, { code: "2100", name: "AP", type: "liability" as const },
    { code: "4000", name: "Sales", type: "revenue" as const }, { code: "5000", name: "Expense", type: "expense" as const },
    { code: "1100", name: "Cash", type: "asset" as const },
  ].map(row => ({ ...row, organizationId: org.id, currencyCode: base }))).returning();
  const server = new McpServer({ name: "Revaluation fixture", version: "1" });
  registerAllTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const t = { org, owner, party, ar, ap, revenue, expense, cash,
    req(body?: unknown) { return new Request("http://fixture.test", { method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); },
    async call(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { text: string }[])[0].text;
      assert.equal(result.isError === true, false, `${name}: ${text}`); return JSON.parse(text);
    },
    async close() { await client.close(); await server.close(); },
  };
  connections.push(t); return t;
}
type Tenant = Awaited<ReturnType<typeof tenant>>;
async function rate(t: Tenant, currency: string, value: number, date: string) {
  await db.insert(exchangeRate).values({ organizationId: t.org.id, baseCurrency: currency, targetCurrency: t.org.defaultCurrency!, rate: value, date, source: "manual" })
    .onConflictDoUpdate({ target: [exchangeRate.organizationId, exchangeRate.baseCurrency, exchangeRate.targetCurrency, exchangeRate.date], set: { rate: value } });
}
async function recognized(t: Tenant, kind: "invoice" | "bill" = "invoice", amount = 1250, currency = "EUR", issueDate = "2026-09-01", taxRateId?: string) {
  const input = { contactId: t.party.id, currencyCode: currency, issueDate, dueDate: "2026-12-01",
    lines: [{ description: "Fixture", unitPriceMinor: String(amount), accountId: kind === "invoice" ? t.revenue.id : t.expense.id, taxRateId }] };
  if (kind === "bill") {
    const made = await t.call("create_bill", input);
    return (await t.call("receive_bill", { billId: made.bill.id })).bill;
  }
  const response = await createInvoice(t.req(input)), body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return (await t.call("send_invoice", { invoiceId: body.invoice.id })).invoice;
}
async function snapshot() {
  const result = [];
  for (const table of ["organization", "invoice", "invoice_line", "bill", "bill_line", "payment", "payment_allocation", "chart_account", "journal_entry", "journal_line", "number_sequence", "audit_log"]) {
    // SQL text retains all bigint/numeric digits before JSON enters JavaScript.
    const rows = await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)::text as state from ${table} t`));
    result.push(rows.rows[0].state);
  }
  return JSON.stringify(result);
}
async function rejected(t: Tenant, end = asOf, reverse = reversal) {
  const before = await snapshot(); await assert.rejects(processFxRevaluationForOrg(t.org.id, end, reverse)); assert.equal(await snapshot(), before);
}
async function pair(t: Tenant, arExpected: string, apExpected = "0") {
  const entries = await db.select().from(journalEntry).where(and(eq(journalEntry.organizationId, t.org.id), sql`${journalEntry.sourceType} like 'fx_revaluation%'`)).orderBy(journalEntry.entryNumber);
  assert.equal(entries.length, 2); assert.equal(entries[0].date, asOf); assert.equal(entries[1].date, reversal);
  assert.equal(entries[0].reversedByEntryId, entries[1].id); assert.equal(entries[1].reversesEntryId, entries[0].id);
  const first = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, entries[0].id));
  const second = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, entries[1].id));
  assert.equal(first.reduce((s, l) => s + BigInt(l.debitAmount), 0n), first.reduce((s, l) => s + BigInt(l.creditAmount), 0n));
  const sqlNet = await db.execute(sql`select account_id, sum(debit_amount-credit_amount)::text as net from journal_line where journal_entry_id=${entries[0].id} group by account_id`);
  assert.equal(sqlNet.rows.find(r => r.account_id === t.ar.id)?.net ?? "0", arExpected);
  assert.equal(sqlNet.rows.find(r => r.account_id === t.ap.id)?.net ?? "0", apExpected);
  const sort = (rows: typeof first) => rows.map(({ accountId, debitAmount, creditAmount, currencyCode, exchangeRate, rateExact, rateDirection, rateFormatVersion, rateMigrationStatus, rateProvenance }) =>
    ({ accountId, debitAmount, creditAmount, currencyCode, exchangeRate, rateExact, rateDirection, rateFormatVersion, rateMigrationStatus, rateProvenance })).sort((a,b) => a.accountId.localeCompare(b.accountId));
  assert.deepEqual(sort(second), sort(first.map(l => ({ ...l, debitAmount: l.creditAmount, creditAmount: l.debitAmount }))));
  assert.ok(first.every(l => l.currencyCode === t.org.defaultCurrency && l.rateExact === "1" && l.exchangeRate === 1000000));
  const response = await getEntry(t.req(), { params: Promise.resolve({ id: entries[0].id }) }), rest = await response.json();
  assert.equal(response.status, 200, JSON.stringify(rest));
  const mcp = await t.call("get_entry", { entryId: entries[0].id });
  assert.deepEqual(rest.entry.lines.map((l: { debitAmountMinor: string }) => l.debitAmountMinor).sort(), mcp.entry.lines.map((l: { debitAmountMinor: string }) => l.debitAmountMinor).sort());
  assert.ok(rest.entry.lines.every((l: { debitAmount: string }) => /^\d+\.\d{2}$/.test(l.debitAmount)));
  assert.ok(mcp.entry.lines.every((l: { debitAmount: number }) => Number.isSafeInteger(l.debitAmount)));
  const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.organizationId, t.org.id), eq(auditLog.entityType, "fx_revaluation")));
  assert.equal(audit.userId, t.owner.id); return entries;
}
async function run() {
  try {
    const t = await tenant(); await rate(t, "EUR", 1200000, "2026-09-01");
    const inv = await recognized(t), payable = await recognized(t, "bill", 2500);
    await t.call("pay_invoice", { invoiceId: inv.id, amountMinor: "500", date: "2026-09-10" });
    // Recognition 1500, cumulative release 600 -> carrying 900; period-end 750*1.3 = 975.
    await rate(t, "EUR", 900000, "2026-09-01"); await rate(t, "EUR", 1300000, asOf);
    const historical = await db.execute(sql`select jsonb_agg(to_jsonb(t) order by t.id)::text as state from journal_line t where journal_entry_id in (${inv.journalEntryId},${payable.journalEntryId})`);
    const racing = await Promise.all([processFxRevaluationForOrg(t.org.id, asOf, reversal), processFxRevaluationForOrg(t.org.id, asOf, reversal)]);
    assert.equal(racing.filter(r => r.posted).length, 1); await pair(t, "75", "-250");
    assert.deepEqual((await db.execute(sql`select jsonb_agg(to_jsonb(t) order by t.id)::text as state from journal_line t where journal_entry_id in (${inv.journalEntryId},${payable.journalEntryId})`)).rows, historical.rows);
    const before = await snapshot(); await rate(t, "EUR", 1500000, asOf);
    assert.deepEqual(await processFxRevaluationForOrg(t.org.id, asOf, reversal), { posted: false, reason: "already posted" }); assert.equal(await snapshot(), before);
    await rejected(t, asOf, "2026-10-02");
    const [adjustment] = await db.select().from(journalEntry).where(and(eq(journalEntry.organizationId, t.org.id), eq(journalEntry.sourceType, "fx_revaluation")));
    const [mirrorLeg] = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, adjustment.reversedByEntryId!));
    await db.update(journalLine).set({ debitAmount: mirrorLeg.debitAmount + 1 }).where(eq(journalLine.id, mirrorLeg.id)); await rejected(t);
    await db.update(journalLine).set({ debitAmount: mirrorLeg.debitAmount }).where(eq(journalLine.id, mirrorLeg.id));
    // Different minor scales and low digits; new base legs are identity FX.
    for (const [base, source, amount, expected] of [["USD", "JPY", 1250, "12500"], ["USD", "KWD", 1250, "13"], ["JPY", "USD", 1250, "1"], ["KWD", "USD", 1250, "1250"], ["IRR", "EUR", 1250, "1"], ["USD", "EUR", 3000000001, "300000000"]] as const) {
      const x = await tenant(base); await rate(x, source, 1200000, "2026-09-01"); await recognized(x, "invoice", amount, source);
      await rate(x, source, 1300000, asOf); assert.equal((await processFxRevaluationForOrg(x.org.id, asOf, reversal)).posted, true); await pair(x, expected);
    }
    // Negative rate movement and zero movement keep existing balances intact.
    const down = await tenant(); await rate(down, "EUR", 1200000, "2026-09-01"); await recognized(down); await recognized(down, "bill");
    await rate(down, "EUR", 1100000, asOf); assert.equal((await processFxRevaluationForOrg(down.org.id, asOf, reversal)).posted, true); await pair(down, "-125", "125");
    const zero = await tenant(); await rate(zero, "EUR", 1000000, "2026-09-01"); await recognized(zero);
    const zeroState = await snapshot(); assert.deepEqual(await processFxRevaluationForOrg(zero.org.id, asOf, reversal), { posted: false }); assert.equal(await snapshot(), zeroState);
    const bad = await tenant(); await rate(bad, "EUR", 1200000, "2026-09-01"); const badDoc = await recognized(bad); await rate(bad, "EUR", 1300000, asOf);
    const foreign = await tenant();
    for (const patch of [{ amountDue: 1249 }, { amountPaid: 1 }, { journalEntryId: null }, { contactId: foreign.party.id }, { total: 1251 }]) {
      await db.update(invoice).set(patch).where(eq(invoice.id, badDoc.id)); await rejected(bad);
      await db.update(invoice).set({ amountDue: 1250, amountPaid: 0, total: 1250, journalEntryId: badDoc.journalEntryId, contactId: bad.party.id }).where(eq(invoice.id, badDoc.id));
    }
    await db.execute(sql`update invoice set amount_due=9007199254740992 where id=${badDoc.id}`); await rejected(bad); await db.update(invoice).set({ amountDue: 1250 }).where(eq(invoice.id, badDoc.id));
    const [saved] = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, badDoc.journalEntryId));
    for (const patch of [{ accountId: foreign.ar.id }, { debitAmount: saved.debitAmount + 1 }, { rateFormatVersion: 2 },
      { rateMigrationStatus: "pending" }, { rateExact: null }, { rateExact: "1.3" }, { rateProvenance: "unqualified" }]) {
      await db.transaction(async tx => {
        await tx.execute(sql`alter table journal_line disable trigger journal_line_exact_sync`);
        await tx.execute(sql`alter table journal_line disable trigger journal_line_exact_input_guard`);
        await tx.update(journalLine).set(patch).where(eq(journalLine.id, saved.id));
        await tx.execute(sql`alter table journal_line enable trigger journal_line_exact_input_guard`);
        await tx.execute(sql`alter table journal_line enable trigger journal_line_exact_sync`);
      });
      await rejected(bad);
      await db.update(journalLine).set({ accountId: saved.accountId, debitAmount: saved.debitAmount, rateFormatVersion: 1,
        rateExact: saved.rateExact, rateMigrationStatus: saved.rateMigrationStatus, rateProvenance: saved.rateProvenance }).where(eq(journalLine.id, saved.id));
    }
    const [center] = await db.insert(costCenter).values({ organizationId: foreign.org.id, code: "F", name: "Foreign" }).returning();
    await db.update(journalLine).set({ costCenterId: center.id }).where(eq(journalLine.id, saved.id)); await rejected(bad); await db.update(journalLine).set({ costCenterId: null }).where(eq(journalLine.id, saved.id));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, bad.ar.id)); await rejected(bad); await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, bad.ar.id));
    const badBill = await recognized(bad, "bill");
    for (const patch of [{ amountDue: 1249 }, { total: 1251 }, { subtotal: 1249 }, { taxTotal: 1 }]) {
      await db.update(bill).set(patch).where(eq(bill.id, badBill.id)); await rejected(bad);
      await db.update(bill).set({ amountDue: 1250, total: 1250, subtotal: 1250, taxTotal: 0 }).where(eq(bill.id, badBill.id));
    }
    // Period-end/reversal locks are checked atomically; no account creations escape.
    const [lock] = await db.insert(periodLock).values({ organizationId: bad.org.id, lockDate: asOf }).returning();
    let state = await snapshot(); assert.equal((await processFxRevaluationForOrg(bad.org.id, asOf, reversal)).reason, "period locked"); assert.equal(await snapshot(), state); await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: bad.org.id, name: "Closed reversal", startDate: reversal, endDate: "2026-10-31", isClosed: true }).returning();
    state = await snapshot(); assert.equal((await processFxRevaluationForOrg(bad.org.id, asOf, reversal)).reason, "period locked"); assert.equal(await snapshot(), state); await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    // A lock row that did not exist when the worker started must still win before posting.
    const held = await db.transaction(async tx => {
      await tx.execute(sql`lock table period_lock in row exclusive mode`);
      const running = processFxRevaluationForOrg(bad.org.id, asOf, reversal);
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        // PostgreSQL caches activity snapshots within the observer transaction.
        await tx.execute(sql`select pg_stat_clear_snapshot()`);
        const result = await tx.execute(sql`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'lock table period_lock,%') as waiting`);
        if (result.rows[0].waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(waiting, true, "revaluation must wait for concurrent period-lock insertion");
      const [inserted] = await tx.insert(periodLock).values({ organizationId: bad.org.id, lockDate: asOf }).returning();
      return { running, inserted };
    });
    state = await snapshot(); assert.equal((await held.running).reason, "period locked"); assert.equal(await snapshot(), state);
    await db.delete(periodLock).where(eq(periodLock.id, held.inserted.id));
    // Both the second journal and the audit must commit or roll back with the first.
    for (const table of ["journal_entry", "audit_log"]) {
      await db.execute(sql.raw(`create function fx_fault() returns trigger language plpgsql as $$ begin if ${table === "journal_entry" ? "NEW.source_type = 'fx_revaluation_reversal'" : "NEW.entity_type = 'fx_revaluation'"} then raise exception 'fixture failure'; end if; return NEW; end $$`));
      await db.execute(sql.raw(`create trigger fx_fault before insert on ${table} for each row execute function fx_fault()`));
      try { await rejected(bad); } finally { await db.execute(sql.raw(`drop trigger fx_fault on ${table}`)); await db.execute(sql.raw("drop function fx_fault()")); }
    }
    assert.equal((await processFxRevaluationForOrg(bad.org.id, asOf, reversal)).posted, true); await pair(bad, "125", "-125");
    // Later partial AND full settlements cannot fabricate an earlier-period due.
    for (const amount of [500, 1250]) {
      const x = await tenant(); await rate(x, "EUR", 1200000, "2026-09-01"); const d = await recognized(x); await rate(x, "EUR", 1300000, asOf);
      await x.call("pay_invoice", { invoiceId: d.id, amount, date: reversal }); await rejected(x);
    }
    const overflow = await tenant(); await rate(overflow, "EUR", 1000000, "2026-09-01");
    await recognized(overflow, "invoice", 6000000000000000); await recognized(overflow, "invoice", 6000000000000000);
    await rate(overflow, "EUR", 2000000, asOf); await rejected(overflow);
    const aggregate = await tenant(); await rate(aggregate, "EUR", 100000, "2026-09-01");
    await recognized(aggregate, "invoice", 6000000000000001); await recognized(aggregate, "invoice", 6000000000000001);
    await rate(aggregate, "EUR", 1000000, asOf); await rejected(aggregate);
    const cancelling = await tenant();
    await rate(cancelling, "EUR", 100000, "2026-09-01"); await rate(cancelling, "GBP", 1000000, "2026-09-01");
    for (const source of ["EUR", "EUR", "GBP", "GBP"]) await recognized(cancelling, "invoice", 6000000000000001, source);
    await recognized(cancelling, "invoice", 10); await rate(cancelling, "EUR", 1000000, asOf); await rate(cancelling, "GBP", 100000, asOf);
    assert.equal((await processFxRevaluationForOrg(cancelling.org.id, asOf, reversal)).posted, true); await pair(cancelling, "9");
    const residual = await tenant(); await rate(residual, "EUR", 1200000, "2026-09-01"); const small = await recognized(residual, "invoice", 3);
    await residual.call("pay_invoice", { invoiceId: small.id, amount: 1, date: "2026-09-10" });
    // Original rounds to 4; one-third release rounds to 1; remaining carrying is 3.
    // Same period-end rate values 2 outstanding units at 2, hence a one-unit loss.
    assert.equal((await processFxRevaluationForOrg(residual.org.id, asOf, reversal)).posted, true); await pair(residual, "-1");
    const missing = await tenant(); await rate(missing, "EUR", 1200000, "2026-09-01"); await recognized(missing);
    await db.delete(exchangeRate).where(eq(exchangeRate.organizationId, missing.org.id)); await rejected(missing);
    const taxed = await tenant(); await rate(taxed, "EUR", 1200000, "2026-09-01");
    const [standard] = await db.insert(taxRate).values({ organizationId: taxed.org.id, name: "Standard", rate: 2000, type: "purchase" }).returning();
    await recognized(taxed, "bill", 1250, "EUR", "2026-09-01", standard.id); await rate(taxed, "EUR", 1300000, asOf);
    assert.equal((await processFxRevaluationForOrg(taxed.org.id, asOf, reversal)).posted, true); await pair(taxed, "0", "-150");
    const reverseTax = await tenant(); await rate(reverseTax, "EUR", 1200000, "2026-09-01");
    const [rc] = await db.insert(taxRate).values({ organizationId: reverseTax.org.id, name: "Reverse charge", rate: 2000, type: "purchase", kind: "reverse_charge" }).returning();
    await recognized(reverseTax, "bill", 1250, "EUR", "2026-09-01", rc.id); await rate(reverseTax, "EUR", 1300000, asOf); await rejected(reverseTax);
    const ownerless = await tenant("USD", false); state = await snapshot(); assert.equal((await processFxRevaluationForOrg(ownerless.org.id, asOf, reversal)).reason, "owner unavailable"); assert.equal(await snapshot(), state);
    await db.update(organization).set({ deletedAt: new Date() }).where(eq(organization.id, ownerless.org.id)); state = await snapshot(); assert.equal((await processFxRevaluationForOrg(ownerless.org.id, asOf, reversal)).reason, "organization unavailable"); assert.equal(await snapshot(), state);
    await rejected(zero, "2026-02-30"); await rejected(zero, asOf, asOf);
    const future = await tenant(); await rate(future, "EUR", 1200000, "2026-09-01"); await recognized(future, "invoice", 1250, "EUR", reversal);
    state = await snapshot(); assert.equal((await processFxRevaluationForOrg(future.org.id, asOf, reversal)).posted, false); assert.equal(await snapshot(), state);
    const ready = await tenant(); await rate(ready, "EUR", 1000000, "2026-09-01"); await recognized(ready); await rate(ready, "EUR", 1100000, asOf);
    const sweep = await processFxRevaluation(asOf, reversal); assert.equal(sweep.posted, 1); await pair(ready, "125");
    assert.ok(sweep.orgs > 10);
    assert.equal((await db.select().from(payment).where(eq(payment.organizationId, t.org.id))).length, 1);
    assert.equal((await db.select().from(bill).where(eq(bill.organizationId, t.org.id)))[0].amountDue, 2500);
    console.log("FX revaluation REST MCP SQL verified");
  } finally { await Promise.all(connections.map(c => c.close())); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
