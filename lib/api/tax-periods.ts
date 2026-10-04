import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, taxPeriod, taxReturnLine, chartAccount, journalEntry, journalLine } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { taxPeriodId, taxPeriodCreateSchema, taxPeriodUpdateSchema, taxPeriodFileSchema, taxSettlementSchema,
  taxSettlementAmount, taxPeriodRange, taxPeriodDto, taxReturnLineDto, taxSafeMinor } from "./tax-period-wire";
import { taxControlMovement, taxEcTotals } from "./tax-period-calculation";
import { getNextEntryNumber } from "./journal-automation";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { assertFunctionalCurrencyEnabled } from "@/lib/currency/rollout";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const scope = (ctx: AuthContext, id?: string) => and(eq(taxPeriod.organizationId, ctx.organizationId), id ? eq(taxPeriod.id, id) : undefined);
function fail(message: string): never { throw new AuthError(message, 400); }
async function load(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(taxPeriod).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Tax period not found", 404);
  const lines = await tx.select().from(taxReturnLine).where(eq(taxReturnLine.taxPeriodId, id));
  taxPeriodDto({ ...row, lines }); return row;
}
async function baseConfig(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId));
  if (!org) throw new AuthError("Organization not found", 404);
  const parsed = currencyCodeSchema.safeParse(org.defaultCurrency);
  if (!parsed.success || parsed.data !== org.defaultCurrency) throw new WireCompatibilityError("Invalid stored base currency");
  const base = parsed.data;
  assertFunctionalCurrencyEnabled(base);
  return { base, basis: org.vatScheme === "cash" ? "cash" as const : "accrual" as const, country: org.countryCode ?? org.country };
}
async function control(tx: TaxTx, ctx: AuthContext, code: string, base: string) {
  const [existing] = await tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.code, code))).for("share");
  if (existing) {
    if (existing.deletedAt || !existing.isActive || existing.currencyCode !== base || existing.type !== (code === "1500" ? "asset" : "liability"))
      throw new WireCompatibilityError("Tax control account must be live, active and correctly denominated/typed");
    return existing.id;
  }
  const [row] = await tx.insert(chartAccount).values({ organizationId: ctx.organizationId, code,
    name: code === "1500" ? "Input VAT / GST Receivable" : code === "2200" ? "Output VAT / GST Payable" : "VAT Suspense / Return Clearing",
    type: code === "1500" ? "asset" : "liability", subType: code === "1500" ? "input_vat" : code === "2200" ? "output_vat" : "current", currencyCode: base }).returning();
  return row.id;
}
async function post(tx: TaxTx, ctx: AuthContext, base: string, date: string, reference: string | null, source: "vat_return" | "tax_settlement", sourceId: string | null,
  legs: { accountId: string; signedDebit: bigint }[]) {
  if (legs.reduce((sum, l) => sum + l.signedDebit, 0n) !== 0n) throw new WireCompatibilityError("Unbalanced tax posting");
  // Even balanced sides may exceed the coexistence range.
  taxSafeMinor(legs.reduce((sum, l) => sum + (l.signedDebit > 0n ? l.signedDebit : 0n), 0n));
  const lines = legs.filter(l => l.signedDebit !== 0n).map(l => ({ accountId: l.accountId,
    debitAmount: taxSafeMinor(l.signedDebit > 0n ? l.signedDebit : 0n), creditAmount: taxSafeMinor(l.signedDebit < 0n ? -l.signedDebit : 0n) }));
  const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
  if (!Number.isInteger(entryNumber) || entryNumber < 1 || entryNumber > 2147483647) throw new WireCompatibilityError("Tax journal numbering exceeds int32");
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber, date, reference,
    description: source === "vat_return" ? "VAT return clearing" : "VAT cash settlement", sourceType: source, sourceId,
    status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
  if (lines.length) await tx.insert(journalLine).values(lines.map(l => ({ ...l, journalEntryId: entry.id, currencyCode: base, exchangeRate: 1000000,
    rateExact: "1", rateDirection: "quote_per_base", rateMigrationStatus: "exact", rateFormatVersion: 1, rateProvenance: `${source}:identity` })));
  return entry.id;
}
export async function listTaxPeriods(ctx: AuthContext) {
  return db.transaction(async tx => {
    const rows = await tx.query.taxPeriod.findMany({ where: scope(ctx), orderBy: [desc(taxPeriod.startDate), taxPeriod.id], with: { lines: { orderBy: [taxReturnLine.sortOrder, taxReturnLine.id] } } });
    return rows.map(taxPeriodDto);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getTaxPeriod(ctx: AuthContext, id: string) {
  taxPeriodId.parse(id);
  return db.transaction(async tx => {
    const row = await tx.query.taxPeriod.findFirst({ where: scope(ctx, id), with: { lines: { orderBy: [taxReturnLine.sortOrder, taxReturnLine.id] } } });
    if (!row) throw new AuthError("Tax period not found", 404);
    return taxPeriodDto(row);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createTaxPeriod(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); const values = taxPeriodCreateSchema.parse(input); taxPeriodRange(values.startDate, values.endDate);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [row] = await tx.insert(taxPeriod).values({ ...values, organizationId: ctx.organizationId }).returning();
    const result = taxPeriodDto(row); await auditTax(tx, ctx.organizationId, "tax_period", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateTaxPeriod(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); taxPeriodId.parse(id); const values = taxPeriodUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const before = await load(tx, ctx, id);
    if (before.status !== "open") fail("Filed or amended tax periods are immutable");
    taxPeriodRange(values.startDate ?? before.startDate, values.endDate ?? before.endDate);
    const [row] = await tx.update(taxPeriod).set({ ...values, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = taxPeriodDto(row); await auditTax(tx, ctx.organizationId, "tax_period", id, "update", { before, after: result }, ctx, request); return result;
  });
}
export async function deleteTaxPeriod(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:tax-config"); taxPeriodId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const before = await load(tx, ctx, id);
    if (before.status !== "open") fail("This return has already been filed and can't be deleted. Amend it instead.");
    await tx.delete(taxPeriod).where(scope(ctx, id)); await auditTax(tx, ctx.organizationId, "tax_period", id, "delete", before, ctx, request); return { success: true };
  });
}
export async function fileTaxPeriod(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); taxPeriodId.parse(id); const values = taxPeriodFileSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const period = await load(tx, ctx, id);
    if (period.status !== "open") fail("Only open tax periods can be filed");
    await assertNotLocked(ctx.organizationId, period.endDate, ctx);
    const config = await baseConfig(tx, ctx), basis = values.basis ?? config.basis;
    const output = await taxControlMovement(tx, ctx.organizationId, "2200", period.startDate, period.endDate, basis);
    const inputVat = await taxControlMovement(tx, ctx.organizationId, "1500", period.startDate, period.endDate, basis);
    const ec = await taxEcTotals(tx, ctx.organizationId, period.startDate, period.endDate, config.country, config.base);
    const box1 = values.flatRatePercent ? 0n : output.credits - output.debits;
    const box4 = values.flatRatePercent ? 0n : inputVat.debits - inputVat.credits;
    const net = taxSafeMinor(box1 - box4), outputVat = taxSafeMinor(box1), input = taxSafeMinor(box4);
    const boxes = [
      { boxNumber: "1", label: "VAT due on sales", amount: outputVat, sortOrder: 1 },
      { boxNumber: "2", label: "VAT due on EU acquisitions", amount: 0, sortOrder: 2 },
      { boxNumber: "3", label: "Total VAT due (Box 1 + 2)", amount: outputVat, sortOrder: 3 },
      { boxNumber: "4", label: "VAT reclaimed on purchases", amount: input, sortOrder: 4 },
      { boxNumber: "5", label: "Net VAT to pay/reclaim (Box 3 - 4)", amount: net, sortOrder: 5 },
      { boxNumber: "8", label: "Total supplies to EU ex-VAT", amount: ec.sales, sortOrder: 8 },
      { boxNumber: "9", label: "Total acquisitions from EU ex-VAT", amount: ec.acquisitions, sortOrder: 9 },
    ];
    const outId = await control(tx, ctx, "2200", config.base), inId = await control(tx, ctx, "1500", config.base), suspense = await control(tx, ctx, "2240", config.base);
    const clearingJournalEntryId = await post(tx, ctx, config.base, period.endDate, values.filedReference || period.name, "vat_return", id,
      [{ accountId: outId, signedDebit: box1 }, { accountId: inId, signedDebit: -box4 }, { accountId: suspense, signedDebit: box4 - box1 }]);
    const [row] = await tx.update(taxPeriod).set({ status: "filed", filedAt: new Date(), filedBy: ctx.userId, filedReference: values.filedReference || null, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    await tx.delete(taxReturnLine).where(eq(taxReturnLine.taxPeriodId, id));
    const lines = await tx.insert(taxReturnLine).values(boxes.map(b => ({ ...b, taxPeriodId: id, isCalculated: true,
      sourceDescription: `Filed ${basis}-basis${values.flatRatePercent ? " (flat-rate)" : ""}` }))).returning();
    const result = { taxPeriod: taxPeriodDto(row), clearingJournalEntryId, net, netMinor: String(net), outputVat, outputVatMinor: String(outputVat),
      inputVat: input, inputVatMinor: String(input), basis, currencyCode: config.base, filedLines: lines.map(taxReturnLineDto) };
    stringifyWire(result); await auditTax(tx, ctx.organizationId, "tax_period", id, "tax_period.filed", { ...result, flatRatePercent: values.flatRatePercent ?? null }, ctx, request); return result;
  });
}
// Legacy MCP settlements are standalone. Optional period links add REST-equivalent ownership/state validation.
export async function settleTaxPeriod(ctx: AuthContext, input: unknown, id?: string, request?: Request) {
  requireRole(ctx, "manage:tax-config"); if (id !== undefined) taxPeriodId.parse(id);
  const values = taxSettlementSchema.parse(input), amount = taxSettlementAmount(values), date = values.date ?? new Date().toISOString().slice(0, 10);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const period = id === undefined ? null : await load(tx, ctx, id);
    if (period?.status === "open") fail("Only filed or amended periods can be settled");
    await assertNotLocked(ctx.organizationId, date, ctx);
    const { base } = await baseConfig(tx, ctx);
    const [bank] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, values.bankGlAccountId), eq(chartAccount.organizationId, ctx.organizationId),
      isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
    if (!bank) throw new AuthError("Bank ledger account not found", 404);
    if (bank.type !== "asset" || bank.subType !== "bank" || bank.currencyCode !== base) fail("Tax settlement requires a base-currency bank/cash asset account");
    let settlementJournalEntryId: string | null = null;
    if (amount !== 0) {
      const suspense = await control(tx, ctx, "2240", base), debit = BigInt(amount) * (values.isRefund ? -1n : 1n);
      settlementJournalEntryId = await post(tx, ctx, base, date, values.reference || period?.filedReference || period?.name || null, "tax_settlement", id ?? null,
        [{ accountId: suspense, signedDebit: debit }, { accountId: bank.id, signedDebit: -debit }]);
    }
    const result = { ...(period ? { taxPeriod: taxPeriodDto(period) } : {}), settlementJournalEntryId, amount, amountMinor: String(amount), isRefund: values.isRefund, currencyCode: base };
    stringifyWire(result);
    if (settlementJournalEntryId) await auditTax(tx, ctx.organizationId, "tax_settlement", settlementJournalEntryId, "create", { ...result, date, bankGlAccountId: bank.id }, ctx, request);
    return result;
  });
}
