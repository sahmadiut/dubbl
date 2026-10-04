import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseClaim, organization, chartAccount, taxRate, taxComponent, costCenter, project, journalEntry, journalLine, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { expenseIdField, expenseHeaderDto } from "./expense-wire";
import { expensePaySchema, expenseRejectSchema, expenseTaxSplit } from "./expense-lifecycle-wire";
import { lockExpenseOrganization, loadExpenseClaim, expenseClaimHeader, expenseClaimLines,
  auditExpenseClaim, assertExpenseDatesOpen, expenseClaimPerson } from "./expense-crud";
import { stringifyWire, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { getNextEntryNumber, ensureAccountByCode } from "./journal-automation";
import { convertInvoiceLegs } from "./invoice-lifecycle-wire";
import { paymentCashBase } from "./payment-settlement-wire";
import { journalLineDto } from "./journal-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Claim = typeof expenseClaim.$inferSelect;
type Leg = { accountId: string; debitAmount: number; creditAmount: number; costCenterId?: string | null; projectId?: string | null; description?: string | null };
type Operation = "submit" | "recall" | "approve" | "reject" | "pay" | "reverse";
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
async function nextNumber(tx: Tx, ctx: AuthContext) {
  const value = await getNextEntryNumber(ctx.organizationId, tx);
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) unsupported("Expense journal numbering exceeds int32 capacity");
  return value;
}
async function account(tx: Tx, ctx: AuthContext, code: string, base: string,
  definition?: { name: string; type: "asset" | "liability" | "expense" | "revenue"; subType: string }) {
  const row = definition ? await ensureAccountByCode(ctx.organizationId, { code, ...definition }, base, tx)
    : (await tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.code, code))).for("share"))[0];
  if (!row || row.deletedAt || !row.isActive || (definition && row.type !== definition.type) || row.currencyCode !== base)
    unsupported(`Expense posting requires an active base-currency ${definition?.type ?? ""} account (${code})`);
  return row;
}
async function rate(tx: Tx, ctx: AuthContext, currency: string, base: string, date: string) {
  const fx = await createHistoricalRateResolver(ctx.organizationId, tx)(currency, base, date);
  if (!fx) throw new MissingExchangeRateError(currency, base, date);
  try { toLegacyRate(fx.rateExact); } catch { unsupported("Expense FX must fit legacy positive int32 millionths exactly"); }
  return fx;
}
async function post(tx: Tx, ctx: AuthContext, claim: Claim, sourceType: string, date: string, legs: Leg[], rateExact: string) {
  const debit = legs.reduce((s, l) => s + BigInt(l.debitAmount), 0n), credit = legs.reduce((s, l) => s + BigInt(l.creditAmount), 0n);
  legacyMinor(debit); legacyMinor(credit);
  if (!legs.length || debit <= 0n || debit !== credit || legs.some(l => l.debitAmount < 0 || l.creditAmount < 0 || (l.debitAmount && l.creditAmount)))
    unsupported("Expense journal must have nonnegative balanced nonzero base amounts");
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId,
    entryNumber: await nextNumber(tx, ctx), date, description: `Expense claim ${sourceType === "expense_claim" ? "approved" : "paid"}: ${claim.title}`,
    reference: `EXP-${claim.id.slice(0, 8)}`, sourceType, sourceId: claim.id, status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(legs.map(leg => ({ ...leg, journalEntryId: entry.id,
    currencyCode: claim.currencyCode, exchangeRate: toLegacyRate(rateExact), rateExact, rateDirection: "quote_per_base",
    rateFormatVersion: 1, rateMigrationStatus: "exact", rateProvenance: "legacy_scaled_1e6:transaction" })));
  return entry;
}
async function history(tx: Tx, ctx: AuthContext, claim: Claim, base: string) {
  const entries = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
    eq(journalEntry.sourceId, claim.id), isNull(journalEntry.reversedByEntryId),
    // Previous cycles are already reversed; reversals themselves are excluded.
    inArray(journalEntry.sourceType, ["expense_claim", "expense_claim_payment"]))).for("update");
  const original = entries.filter(e => e.sourceType === "expense_claim" || e.sourceType === "expense_claim_payment");
  const approval = original.find(e => e.sourceType === "expense_claim"), payment = original.find(e => e.sourceType === "expense_claim_payment");
  if (!approval || approval.id !== claim.journalEntryId || original.length !== (claim.status === "paid" ? 2 : 1) ||
    (claim.status === "paid" && !payment) || original.some(e => e.deletedAt || e.status !== "posted")) unsupported("Expense requires complete unambiguous unreversed recognition/payment history");
  const result = [];
  for (const entry of original) {
    rateDateSchema.parse(entry.date);
    const rows = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).orderBy(journalLine.id);
    // Match the entry explicitly: a claim may have several approve/pay/reverse cycles.
    const audits = await tx.select({ changes: auditLog.changes }).from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId),
      eq(auditLog.entityType, "expense"), eq(auditLog.entityId, claim.id), eq(auditLog.action, entry.sourceType === "expense_claim" ? "approve" : "pay")));
    const provenance = audits.map(a => a.changes as { journalEntryId?: string; baseCurrencyCode?: string; totalAmountMinor?: string; rateExact?: string; legs?: Leg[] } | null)
      .find(a => a?.journalEntryId === entry.id);
    if (!provenance || provenance.baseCurrencyCode !== base || provenance.totalAmountMinor !== String(claim.totalAmount) || !provenance.legs)
      unsupported("Expense history lacks qualified base-currency/amount/audit provenance; legacy history needs separate review");
    let debit = 0n, credit = 0n;
    for (const row of rows) {
      journalLineDto(row);
      if (row.currencyCode !== claim.currencyCode || row.rateExact !== provenance.rateExact || row.rateFormatVersion !== 1 ||
        row.rateMigrationStatus !== "exact" || row.rateProvenance !== "legacy_scaled_1e6:transaction" ||
        row.debitAmount < 0 || row.creditAmount < 0 || (row.debitAmount && row.creditAmount)) unsupported("Expense saved journal has unqualified amounts/FX");
      const [owned] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, row.accountId), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
      if (!owned) unsupported("Expense saved journal has foreign account");
      for (const [id, table] of [[row.costCenterId, costCenter], [row.projectId, project]] as const) {
        if (id && !(await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, ctx.organizationId))))[0])
          unsupported("Expense saved journal has foreign dimension");
      }
      debit += BigInt(row.debitAmount); credit += BigInt(row.creditAmount);
    }
    legacyMinor(debit); legacyMinor(credit);
    if (!rows.length || debit <= 0n || debit !== credit) unsupported("Expense saved journal is empty or unbalanced");
    const canonical = (legs: Leg[]) => legs.map(l => JSON.stringify([l.accountId, l.debitAmount, l.creditAmount, l.costCenterId ?? null, l.projectId ?? null])).sort();
    if (JSON.stringify(canonical(rows)) !== JSON.stringify(canonical(provenance.legs))) unsupported("Expense saved journal differs from its atomic posting audit");
    result.push({ entry, lines: rows });
  }
  return { approval: result.find(e => e.entry.id === approval.id)!, payment: payment ? result.find(e => e.entry.id === payment.id)! : null, all: result };
}
async function lifecycle(ctx: AuthContext, id: string, operation: Operation, input: unknown = {}, request?: Request) {
  requireRole(ctx, operation === "submit" || operation === "recall" ? "manage:expenses" : "approve:expenses");
  expenseIdField.parse(id);
  const pay = operation === "pay" ? expensePaySchema.parse(input) : undefined;
  const reject = operation === "reject" ? expenseRejectSchema.parse(input) : undefined;
  return db.transaction(async tx => {
    await lockExpenseOrganization(tx, ctx);
    const claim = await loadExpenseClaim(tx, ctx, id, true);
    const before = await expenseClaimHeader(tx, ctx, claim);
    await expenseClaimPerson(tx, ctx, ctx.userId);
    const items = await expenseClaimLines(tx, ctx, claim, operation === "submit" || operation === "approve");
    const states = { submit: ["draft", "rejected"], recall: ["submitted"], approve: ["submitted"], reject: ["submitted"], pay: ["approved"], reverse: ["approved", "paid"] };
    if (!states[operation].includes(claim.status)) fail(`Expense status ${claim.status} cannot ${operation}`);
    if (!["pay", "reverse"].includes(operation)) {
      const live = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
        eq(journalEntry.sourceId, id), inArray(journalEntry.sourceType, ["expense_claim", "expense_claim_payment"]), isNull(journalEntry.reversedByEntryId)));
      if (claim.journalEntryId || live.length) unsupported("Unposted expense has unreversed journal history");
    }
    const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId));
    const base = currencyCodeSchema.parse(org.defaultCurrency);
    const now = new Date(), today = now.toISOString().slice(0, 10);
    const values: Partial<typeof expenseClaim.$inferInsert> = { updatedAt: now };
    let details: Record<string, unknown> = {};
    if (operation === "submit" || operation === "approve") {
      await assertExpenseDatesOpen(ctx, items);
      if (claim.totalAmount <= 0) fail("Submission and approval require a positive claim total");
    }
    if (operation === "submit") Object.assign(values, { status: "submitted", submittedAt: now, rejectedAt: null, rejectionReason: null });
    if (operation === "recall") Object.assign(values, { status: "draft", submittedAt: null });
    if (operation === "reject") Object.assign(values, { status: "rejected", rejectedAt: now, rejectionReason: reject!.reason });
    if (operation === "approve") {
      await assertNotLocked(ctx.organizationId, today, ctx);
      if (items.some(i => i.date > today)) fail("Approval cannot predate an expense line");
      const fx = await rate(tx, ctx, claim.currencyCode, base, today);
      const payable = await account(tx, ctx, "2110", base, { name: "Employee Reimbursements Payable", type: "liability", subType: "current" });
      const legs: Leg[] = [];
      for (const item of items) {
        const tax = item.taxRateId ? await tx.query.taxRate.findFirst({ where: and(eq(taxRate.id, item.taxRateId), eq(taxRate.organizationId, ctx.organizationId)) }) : null;
        if (tax && await tx.query.taxComponent.findFirst({ where: eq(taxComponent.taxRateId, tax.id) }))
          unsupported("Expense compound tax components require separate posting qualification");
        const split = expenseTaxSplit(item.amount, tax);
        const expenseId = item.accountId ?? (await account(tx, ctx, "5990", base, { name: "Miscellaneous Expense", type: "expense", subType: "operating" })).id;
        if (split.expense) legs.push({ accountId: expenseId, debitAmount: split.expense, creditAmount: 0, costCenterId: item.costCenterId, description: item.description });
        if (split.input) legs.push({ accountId: (await account(tx, ctx, "1500", base, { name: "Input VAT", type: "asset", subType: "current" })).id, debitAmount: split.input, creditAmount: 0, costCenterId: item.costCenterId });
        if (split.output) legs.push({ accountId: (await account(tx, ctx, "2200", base, { name: "Output VAT", type: "liability", subType: "current" })).id, debitAmount: 0, creditAmount: split.output, costCenterId: item.costCenterId });
      }
      legs.push({ accountId: payable.id, debitAmount: 0, creditAmount: claim.totalAmount });
      const converted = convertInvoiceLegs(legs, claim.currencyCode, base, fx.rateExact);
      const carrying = converted.filter(l => l.accountId === payable.id).reduce((s, l) => s + BigInt(l.creditAmount), 0n);
      if (carrying <= 0n) unsupported("Expense converts to a zero base-currency obligation");
      const entry = await post(tx, ctx, claim, "expense_claim", today, converted, fx.rateExact);
      Object.assign(values, { status: "approved", approvedBy: ctx.userId, approvedAt: now, journalEntryId: entry.id });
      details = { journalEntryId: entry.id, baseCurrencyCode: base, totalAmountMinor: String(claim.totalAmount), carryingBaseMinor: String(carrying),
        rateExact: fx.rateExact, rateDirection: "quote_per_base", rateEffectiveDate: fx.effectiveDate, rateSource: fx.source, rateInverse: fx.inverse,
        rateProvider: fx.provider, rateProviderObservedAt: fx.providerObservedAt, rateImportedAt: fx.importedAt, legs: converted };
    }
    if (operation === "pay" || operation === "reverse") {
      const saved = await history(tx, ctx, claim, base);
      if (operation === "pay") {
        await assertNotLocked(ctx.organizationId, pay!.date, ctx);
        if (pay!.date < saved.approval.entry.date) fail("Reimbursement cannot predate approval");
        const fx = await rate(tx, ctx, claim.currencyCode, base, pay!.date);
        const [bank] = await tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.code, pay!.bankAccountCode))).for("share");
        if (!bank || bank.deletedAt || !bank.isActive || bank.type !== "asset" ||
          (!["bank", "cash"].includes(bank.subType ?? "") && !/^11\d{2}$/.test(bank.code)) || ![base, claim.currencyCode].includes(bank.currencyCode))
          fail("Reimbursement requires a live active asset bank/cash account in claim or base currency");
        const payable = await account(tx, ctx, "2110", base, { name: "Employee Reimbursements Payable", type: "liability", subType: "current" });
        const carrying = legacyMinor(saved.approval.lines.filter(l => l.accountId === payable.id).reduce((s, l) => s + BigInt(l.creditAmount) - BigInt(l.debitAmount), 0n));
        const cash = paymentCashBase(claim.totalAmount, claim.currencyCode, base, fx.rateExact);
        if (carrying <= 0 || cash <= 0) unsupported("Expense settlement needs positive saved carrying and cash values");
        const difference = BigInt(cash) - BigInt(carrying);
        const legs: Leg[] = [{ accountId: payable.id, debitAmount: carrying, creditAmount: 0 }, { accountId: bank.id, debitAmount: 0, creditAmount: cash }];
        if (difference > 0n) legs.push({ accountId: (await account(tx, ctx, "5930", base, { name: "Realised Currency Losses", type: "expense", subType: "non_operating" })).id, debitAmount: legacyMinor(difference), creditAmount: 0 });
        if (difference < 0n) legs.push({ accountId: (await account(tx, ctx, "4910", base, { name: "Realised Currency Gains", type: "revenue", subType: "non_operating" })).id, debitAmount: 0, creditAmount: legacyMinor(-difference) });
        const entry = await post(tx, ctx, claim, "expense_claim_payment", pay!.date, legs, fx.rateExact);
        Object.assign(values, { status: "paid", paidAt: now });
        details = { journalEntryId: entry.id, baseCurrencyCode: base, totalAmountMinor: String(claim.totalAmount), carryingBaseMinor: String(carrying), cashBaseMinor: String(cash),
          rateExact: fx.rateExact, rateDirection: "quote_per_base", rateEffectiveDate: fx.effectiveDate, rateSource: fx.source, rateInverse: fx.inverse,
          rateProvider: fx.provider, rateProviderObservedAt: fx.providerObservedAt, rateImportedAt: fx.importedAt, legs };
      } else {
        for (const { entry } of saved.all) await assertNotLocked(ctx.organizationId, entry.date, ctx);
        const reversedEntries = [];
        for (const { entry, lines } of saved.all) {
          const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await nextNumber(tx, ctx),
            date: entry.date, description: `Reversal: ${entry.description}`, reference: entry.reference, status: "posted", sourceType: "expense_claim_reversal", sourceId: id,
            reversesEntryId: entry.id, postedAt: now, createdBy: ctx.userId }).returning();
          await tx.insert(journalLine).values(lines.map(line => ({ accountId: line.accountId, description: line.description, costCenterId: line.costCenterId, projectId: line.projectId,
            currencyCode: line.currencyCode, exchangeRate: line.exchangeRate, rateExact: line.rateExact, rateDirection: line.rateDirection,
            rateFormatVersion: line.rateFormatVersion, rateMigrationStatus: line.rateMigrationStatus, rateProvenance: line.rateProvenance,
            journalEntryId: reversal.id, debitAmount: line.creditAmount, creditAmount: line.debitAmount })));
          await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, voidedAt: now, voidReason: "Expense claim reversed", updatedAt: now }).where(eq(journalEntry.id, entry.id));
          reversedEntries.push({ original: entry.id, reversal: reversal.id });
        }
        Object.assign(values, { status: "draft", approvedAt: null, approvedBy: null, paidAt: null, journalEntryId: null, submittedAt: null, rejectedAt: null, rejectionReason: null });
        details = { reversedEntries, baseCurrencyCode: base };
      }
    }
    const [updated] = await tx.update(expenseClaim).set(values).where(and(eq(expenseClaim.id, id), eq(expenseClaim.organizationId, ctx.organizationId))).returning();
    const result = { expenseClaim: expenseHeaderDto(updated) }; stringifyWire(result);
    await auditExpenseClaim(tx, ctx, id, operation, { before, after: result.expenseClaim, previousStatus: claim.status, ...details }, request);
    return result;
  });
}
export const submitExpenseClaim = (ctx: AuthContext, id: string, request?: Request) => lifecycle(ctx, id, "submit", {}, request);
export const recallExpenseClaim = (ctx: AuthContext, id: string, request?: Request) => lifecycle(ctx, id, "recall", {}, request);
export const approveExpenseClaim = (ctx: AuthContext, id: string, request?: Request) => lifecycle(ctx, id, "approve", {}, request);
export const rejectExpenseClaim = (ctx: AuthContext, id: string, input: unknown, request?: Request) => lifecycle(ctx, id, "reject", input, request);
export const payExpenseClaim = (ctx: AuthContext, id: string, input: unknown, request?: Request) => lifecycle(ctx, id, "pay", input, request);
export const reverseExpenseClaim = (ctx: AuthContext, id: string, request?: Request) => lifecycle(ctx, id, "reverse", {}, request);
