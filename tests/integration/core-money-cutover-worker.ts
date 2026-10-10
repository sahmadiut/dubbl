// Invoked only by the migrated disposable MON-128 database harness.
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { db } from "../../lib/db";
import { organization, users, chartAccount, taxRate, journalEntry, journalLine, exchangeRate } from "../../lib/db/schema";
import { createCategorizationJournalEntry, createBillJournalEntry, createInvoiceJournalEntry, createCreditNoteJournalEntry,
  reverseJournalEntry, createVatReturnClearingJournalEntry } from "../../lib/api/journal-automation";
import { calcTax } from "../../lib/api/tax-calculator";
import { WireCompatibilityError } from "../../lib/money/wire";

// Independent positive rational oracle, separate from product rounding helpers.
const rounded = (n: bigint, d: bigint) => n / d + (n % d * 2n >= d ? 1n : 0n);
const amount = 4000000000000001n, bp = 3333n;
async function snapshot() {
  return Promise.all(["organization", "chart_account", "journal_entry", "journal_line", "tax_rate"].map(table =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
}
async function unchanged(work: () => Promise<unknown>) {
  const before = await snapshot();
  await assert.rejects(work, WireCompatibilityError);
  assert.deepEqual(await snapshot(), before);
}
async function legs(id: string) {
  const rows = (await db.execute(sql`select account_id as account, debit_amount::text as debit, credit_amount::text as credit,
    exchange_rate as rate, rate_exact::text as exact from journal_line where journal_entry_id=${id} order by account_id`)).rows;
  assert.equal(rows.reduce((sum, r) => sum + BigInt(String(r.debit)) - BigInt(String(r.credit)), 0n), 0n);
  return rows;
}
async function scenario(currency: string) {
  const [org] = await db.insert(organization).values({ name: `Cutover ${currency}`, slug: `cutover-${currency}`, defaultCurrency: currency }).returning();
  const [owner] = await db.insert(users).values({ email: `cutover-${currency}@example.test` }).returning();
  const ctx = { organizationId: org.id, userId: owner.id }, date = "2026-10-01";
  const [cash, revenue, cost, ar, ap] = await db.insert(chartAccount).values([
    { code: "1100", name: "Cash", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const },
    { code: "5990", name: "Cost", type: "expense" as const }, { code: "1200", name: "AR", type: "asset" as const },
    { code: "2100", name: "AP", type: "liability" as const },
  ].map(row => ({ ...row, organizationId: org.id, currencyCode: currency }))).returning();
  const [partial, reverse] = await db.insert(taxRate).values([
    { name: "Partial", rate: 3333, recoverablePercent: 3333, kind: "standard" as const },
    { name: "Reverse", rate: 3333, recoverablePercent: 3333, kind: "reverse_charge" as const },
  ].map(row => ({ ...row, organizationId: org.id }))).returning();
  const categorize = async (signed: bigint, rateId: string) => db.transaction(tx => createCategorizationJournalEntry(ctx, {
    bankGlAccountId: cash.id, otherAccountId: signed > 0n ? revenue.id : cost.id, amount: Number(signed),
    date, reference: "Cutover tax", description: "Exact gross/reverse VAT", currencyCode: currency, taxRateId: rateId,
  }, tx));
  const inclusiveTax = rounded(amount * bp, 10000n + bp), inclusiveRecovery = rounded(inclusiveTax * bp, 10000n);
  const outgoing = (await categorize(-amount, partial.id))!;
  const out = await legs(outgoing.id);
  assert.equal(out.find(l => l.account === cost.id)?.debit, String(amount - inclusiveRecovery));
  assert.equal(out.find(l => l.account === cash.id)?.credit, String(amount));
  assert.ok(out.some(l => l.debit === String(inclusiveRecovery)));
  const incoming = (await categorize(amount, partial.id))!;
  const inc = await legs(incoming.id);
  assert.equal(inc.find(l => l.account === revenue.id)?.credit, String(amount - inclusiveTax));
  assert.ok(inc.some(l => l.credit === String(inclusiveTax)));
  const output = rounded(amount * bp, 10000n), recovery = rounded(output * bp, 10000n);
  assert.equal(output, 1333200000000000n);
  assert.equal(calcTax(Number(amount), Number(bp)), Number(output));
  const reverseCharge = (await categorize(-amount, reverse.id))!;
  const rc = await legs(reverseCharge.id);
  assert.equal(rc.find(l => l.account === cost.id)?.debit, String(amount + output - recovery));
  assert.ok(rc.some(l => l.credit === String(output)));
  assert.ok(rc.some(l => l.debit === String(recovery)));

  // Retained shared bill helper owns a transaction: range failures cannot leave headers/control accounts.
  const bill = (await createBillJournalEntry(ctx, { billNumber: "Cutover", total: Number(amount + output), taxTotal: Number(output), date,
    currencyCode: currency, lines: [{ accountId: cost.id, amount: Number(amount), taxAmount: Number(output), taxRateId: partial.id }] }))!;
  const billLegs = await legs(bill.id);
  assert.equal(billLegs.find(l => l.account === cost.id)?.debit, String(amount + output - recovery));
  assert.equal(billLegs.find(l => l.account === ap.id)?.credit, String(amount + output));
  await unchanged(() => createBillJournalEntry(ctx, { billNumber: "Overflow", total: Number.MAX_SAFE_INTEGER, taxTotal: 1, date,
    currencyCode: currency, lines: [{ accountId: cost.id, amount: Number.MAX_SAFE_INTEGER, taxAmount: 1 }] }));

  // Legacy shared recognition and credit helpers must also guard sums before creating a header.
  const recognition = { total: Number(amount), taxTotal: 0, subtotal: Number(amount), date, currencyCode: currency,
    lines: [{ accountId: revenue.id, amount: Number(amount), taxAmount: 0 }] };
  const sale = (await createInvoiceJournalEntry(ctx, { ...recognition, invoiceNumber: "Cutover" }))!;
  assert.equal((await legs(sale.id)).find(l => l.account === ar.id)?.debit, String(amount));
  const credit = (await createCreditNoteJournalEntry(ctx, { ...recognition, creditNoteNumber: "Cutover" }))!;
  assert.equal((await legs(credit.id)).find(l => l.account === ar.id)?.credit, String(amount));
  const overflow = { ...recognition, lines: [{ accountId: revenue.id, amount: Number.MAX_SAFE_INTEGER, taxAmount: 0 },
    { accountId: revenue.id, amount: 1, taxAmount: 0 }] };
  await unchanged(() => createInvoiceJournalEntry(ctx, { ...overflow, invoiceNumber: "Overflow" }));
  await unchanged(() => createCreditNoteJournalEntry(ctx, { ...overflow, creditNoteNumber: "Overflow" }));
  await unchanged(() => categorize(-BigInt(Number.MAX_SAFE_INTEGER), reverse.id));

  for (const original of [outgoing, incoming, reverseCharge, bill, sale, credit]) {
    const before = await legs(original.id);
    const reversal = (await db.transaction(tx => reverseJournalEntry(ctx, {
      entryId: original.id, date: "2026-10-02", description: "Saved exact reversal", sourceType: "cutover_reversal",
    }, tx)))!;
    assert.deepEqual((await legs(reversal.id)).map(l => [l.account, l.debit, l.credit]), before.map(l => [l.account, l.credit, l.debit]));
    assert.deepEqual(await legs(original.id), before);
  }
  console.log(`Core posting ${currency} low digits and reversal verified`);

  if (currency === "USD") {
    await db.insert(exchangeRate).values({ organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", date,
      rate: 333300, rateExact: "0.3333", rateDirection: "quote_per_base", rateMigrationStatus: "valid", source: "manual" });
    const fxSale = (await createInvoiceJournalEntry(ctx, { ...recognition, currencyCode: "EUR", invoiceNumber: "FX low digits" }))!;
    const saved = await legs(fxSale.id);
    assert.equal(saved.find(l => l.account === ar.id)?.debit, String(output));
    assert.ok(saved.every(l => l.rate === 333300));
    await db.update(exchangeRate).set({ rate: 500000, rateExact: "0.5" }).where(eq(exchangeRate.organizationId, org.id));
    const reversed = (await db.transaction(tx => reverseJournalEntry(ctx, {
      entryId: fxSale.id, date: "2026-10-02", description: "Preserved FX", sourceType: "cutover_reversal",
    }, tx)))!;
    assert.deepEqual((await legs(reversed.id)).map(l => [l.account, l.debit, l.credit, l.rate, l.exact]),
      saved.map(l => [l.account, l.credit, l.debit, l.rate, l.exact]));

    const [control] = await db.insert(chartAccount).values({ organizationId: org.id, code: "2239", name: "Unsafe source", type: "liability" }).returning();
    const outputControl = (await db.query.chartAccount.findMany({ where: eq(chartAccount.organizationId, org.id) })).find(a => a.code === "2200")!;
    const [retained] = await db.insert(journalEntry).values({ organizationId: org.id, date: "2026-09-01", entryNumber: 1000,
      status: "posted", description: "Two individually safe legs with unsafe sum" }).returning();
    await db.insert(journalLine).values([
      { journalEntryId: retained.id, accountId: outputControl.id, creditAmount: Number.MAX_SAFE_INTEGER },
      { journalEntryId: retained.id, accountId: outputControl.id, creditAmount: 2 },
      { journalEntryId: retained.id, accountId: control.id, debitAmount: Number.MAX_SAFE_INTEGER },
      { journalEntryId: retained.id, accountId: control.id, debitAmount: 2 },
    ]);
    await unchanged(() => db.transaction(tx => createVatReturnClearingJournalEntry(ctx, { date,
      periodStartDate: "2026-09-01", periodEndDate: "2026-09-30" }, tx)));
  }
  assert.deepEqual((await db.execute(sql`select journal_entry_id from journal_line l join journal_entry e on e.id=l.journal_entry_id
    where e.organization_id=${org.id} group by journal_entry_id having sum(debit_amount::numeric)<>sum(credit_amount::numeric)`)).rows, []);
}
try {
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) await scenario(currency);
  console.log("Exact core posting cutover verified");
} finally { await db.$client.end(); }
