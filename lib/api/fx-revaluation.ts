import { sql, eq, and, isNull, ne, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, chartAccount, journalEntry, journalLine, invoice, bill, auditLog } from "@/lib/db/schema";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { revaluationLegs, reverseLegs } from "@/lib/currency/convert-entry";
import { assertNotLocked, PeriodLockedError } from "./period-lock";
import { maintenanceContext } from "./maintenance-context";
import { revaluationExposure } from "./payment-settlements";
import { paymentCashBase } from "./payment-settlement-wire";
import { safeInvoiceMinor } from "./invoice-write-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { auditTax, type TaxTx } from "./tax-config-transaction";
import { journalLineDto } from "./journal-wire";
import { assertJournalReferences } from "./journal-references";

function fail(message: string): never { throw new WireCompatibilityError(message); }
async function account(tx: TaxTx, orgId: string, code: string, base: string, type: "revenue" | "expense") {
  await tx.insert(chartAccount).values({ organizationId: orgId, code, currencyCode: base, type,
    name: type === "revenue" ? "Unrealised Currency Gains" : "Unrealised Currency Losses", subType: "non_operating" })
    .onConflictDoNothing({ target: [chartAccount.organizationId, chartAccount.code] });
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, orgId), eq(chartAccount.code, code))).for("share");
  if (!row || row.deletedAt || !row.isActive || row.type !== type || row.currencyCode !== base) fail("Unqualified unrealised FX account");
  return row.id;
}

/** Saved recognition GL is already in base minor units. Qualify its cumulative
 * releases, convert only outstanding document units at period end, and reverse
 * the new adjustment verbatim. Nothing reprices recognition history.
 */
export async function processFxRevaluationForOrg(orgId: string, asOfDate: string, reversalDate: string): Promise<{ posted: boolean; reason?: string }> {
  rateDateSchema.parse(asOfDate); rateDateSchema.parse(reversalDate);
  if (reversalDate <= asOfDate) fail("Revaluation reversal must follow the period-end date");
  try {
    return await db.transaction(async tx => {
      // Same organization lock/order as document settlement and period writers.
      // NO KEY UPDATE still serializes domain writers, while allowing a lock-row
      // insertion's FK KEY SHARE check to finish before our shared table lock.
      const [org] = await tx.select().from(organization).where(and(eq(organization.id, orgId), isNull(organization.deletedAt))).for("no key update");
      if (!org) return { posted: false, reason: "organization unavailable" };
      const ctx = await maintenanceContext(orgId, tx);
      if (!ctx) return { posted: false, reason: "owner unavailable" };
      const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD");
      const prior = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, orgId),
        eq(journalEntry.sourceType, "fx_revaluation"), eq(journalEntry.date, asOfDate)));
      if (prior.length) {
        const original = prior[0];
        const [reverse] = original.reversedByEntryId ? await tx.select().from(journalEntry).where(and(eq(journalEntry.id, original.reversedByEntryId), eq(journalEntry.organizationId, orgId))) : [];
        if (prior.length !== 1 || original.deletedAt || original.status !== "posted" || !reverse || reverse.deletedAt || reverse.status !== "posted" ||
          reverse.sourceType !== "fx_revaluation_reversal" || reverse.reversesEntryId !== original.id || reverse.date !== reversalDate)
          fail("Existing revaluation has an incompatible or incomplete reversal");
        const [audit] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, orgId), eq(auditLog.entityType, "fx_revaluation"),
          eq(auditLog.entityId, original.id), eq(auditLog.action, "post")));
        const saved = audit?.changes as { baseCurrencyCode?: string; reversalEntryId?: string; asOfDate?: string; reversalDate?: string } | null;
        if (!saved?.baseCurrencyCode || saved.reversalEntryId !== reverse.id || saved.asOfDate !== asOfDate || saved.reversalDate !== reversalDate)
          fail("Existing revaluation lacks qualified posting provenance");
        const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, original.id));
        const mirrors = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, reverse.id));
        for (const line of [...lines, ...mirrors]) {
          journalLineDto(line);
          if (line.currencyCode !== saved.baseCurrencyCode || line.rateExact !== "1" || line.rateMigrationStatus !== "exact" || line.rateFormatVersion !== 1 ||
            line.rateProvenance !== "legacy_scaled_1e6:transaction" || line.debitAmount < 0 || line.creditAmount < 0 || (line.debitAmount && line.creditAmount))
            fail("Existing revaluation has unqualified base-currency legs");
        }
        await assertJournalReferences(orgId, [...lines, ...mirrors], undefined, true, tx);
        const debit = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.debitAmount), 0n));
        const credit = safeInvoiceMinor(lines.reduce((sum, line) => sum + BigInt(line.creditAmount), 0n));
        const signature = (rows: typeof lines, reversing: boolean) => rows.map(line => JSON.stringify([line.accountId, line.description,
          reversing ? line.creditAmount : line.debitAmount, reversing ? line.debitAmount : line.creditAmount, line.costCenterId, line.projectId])).sort();
        if (!debit || debit !== credit || JSON.stringify(signature(lines, true)) !== JSON.stringify(signature(mirrors, false)))
          fail("Existing revaluation reversal does not mirror balanced saved legs");
        return { posted: false, reason: "already posted" };
      }
      // Existing lock/fiscal-year writers do not all take the org lock. A short
      // shared table lock also protects absent rows and concurrent close/replace.
      await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
      await assertNotLocked(orgId, asOfDate, undefined, tx);
      await assertNotLocked(orgId, reversalDate, undefined, tx);
      const conditions = (table: typeof invoice | typeof bill) => and(eq(table.organizationId, orgId), isNull(table.deletedAt),
        ne(table.status, "draft"), ne(table.status, "void"), ne(table.currencyCode, base), lte(table.issueDate, asOfDate));
      const invoices = await tx.select().from(invoice).where(conditions(invoice)).orderBy(invoice.id).for("update");
      const bills = await tx.select().from(bill).where(conditions(bill)).orderBy(bill.id).for("update");
      const resolve = createHistoricalRateResolver(orgId, tx);
      const deltas = new Map<string, { kind: "receivable" | "payable"; delta: bigint }>();
      const exposures = [];
      for (const kind of ["invoice", "bill"] as const) {
        for (const row of kind === "invoice" ? invoices : bills) {
          const saved = await revaluationExposure(tx, ctx, row, kind, base, asOfDate);
          if (!saved) continue;
          const current = await resolve(row.currencyCode, base, asOfDate);
          if (!current) throw new MissingExchangeRateError(row.currencyCode, base, asOfDate);
          const value = paymentCashBase(row.amountDue, row.currencyCode, base, current.rateExact);
          const delta = BigInt(value) - BigInt(saved.carrying);
          const group = deltas.get(saved.accountId) ?? { kind: kind === "invoice" ? "receivable" : "payable", delta: 0n };
          group.delta += delta; deltas.set(saved.accountId, group);
          exposures.push({ documentId: row.id, kind, amountDueMinor: String(row.amountDue), carryingMinor: String(saved.carrying),
            currentMinor: String(value), recognitionRateExact: saved.rateExact, currentRateExact: current.rateExact, effectiveDate: current.effectiveDate });
        }
      }
      const groups = [...deltas].map(([id, group]) => ({ id, legs: revaluationLegs(group.kind, safeInvoiceMinor(group.delta)) })).filter(g => g.legs.length);
      if (!groups.length) return { posted: false };
      safeInvoiceMinor(groups.reduce((sum, g) => sum + g.legs.reduce((s, leg) => s + BigInt(leg.debit), 0n), 0n));
      safeInvoiceMinor(groups.reduce((sum, g) => sum + g.legs.reduce((s, leg) => s + BigInt(leg.credit), 0n), 0n));
      const gain = await account(tx, orgId, "4920", base, "revenue"), loss = await account(tx, orgId, "5940", base, "expense");
      const build = (entryId: string, reversing: boolean) => groups.flatMap(g => (reversing ? reverseLegs(g.legs) : g.legs).map(leg => ({
        journalEntryId: entryId, accountId: leg.role === "counter" ? g.id : leg.role === "fxGain" ? gain : loss,
        description: `Unrealised FX ${asOfDate}`, debitAmount: leg.debit, creditAmount: leg.credit, currencyCode: base,
        exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1,
        rateMigrationStatus: "exact", rateProvenance: "legacy_scaled_1e6:transaction",
      })));
      const [maximum] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}), 0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, orgId));
      const number = BigInt(maximum.value) + 1n;
      if (number + 1n > 2147483647n) fail("Revaluation journal numbering exceeds int32 capacity");
      const [entry] = await tx.insert(journalEntry).values({ organizationId: orgId, entryNumber: Number(number), date: asOfDate,
        description: `Unrealised FX revaluation ${asOfDate}`, reference: `FX ${asOfDate}`, sourceType: "fx_revaluation", status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
      await tx.insert(journalLine).values(build(entry.id, false));
      const [reverse] = await tx.insert(journalEntry).values({ organizationId: orgId, entryNumber: Number(number + 1n), date: reversalDate,
        description: `Reverse unrealised FX revaluation ${asOfDate}`, reference: `FX ${asOfDate}`, sourceType: "fx_revaluation_reversal", sourceId: entry.id,
        reversesEntryId: entry.id, status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
      await tx.insert(journalLine).values(build(reverse.id, true));
      await tx.update(journalEntry).set({ reversedByEntryId: reverse.id }).where(eq(journalEntry.id, entry.id));
      await auditTax(tx, orgId, "fx_revaluation", entry.id, "post", { asOfDate, reversalDate, baseCurrencyCode: base, reversalEntryId: reverse.id, exposures }, ctx);
      return { posted: true };
    });
  } catch (error) {
    if (error instanceof PeriodLockedError) return { posted: false, reason: "period locked" };
    throw error;
  }
}

/** Trusted scheduled sweep; one invalid organization cannot suppress another. */
export async function processFxRevaluation(asOfDate: string, reversalDate: string): Promise<{ orgs: number; posted: number }> {
  rateDateSchema.parse(asOfDate); rateDateSchema.parse(reversalDate);
  if (reversalDate <= asOfDate) fail("Revaluation reversal must follow the period-end date");
  const orgs = await db.select({ id: organization.id }).from(organization).where(isNull(organization.deletedAt));
  let posted = 0;
  for (const org of orgs) {
    try { if ((await processFxRevaluationForOrg(org.id, asOfDate, reversalDate)).posted) posted++; }
    catch (error) { console.error(`fx-revaluation failed for org ${org.id}`, error); }
  }
  return { orgs: orgs.length, posted };
}
