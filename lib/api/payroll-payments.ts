import { createHash } from "node:crypto";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contractor, contractorPayment, payrollTaxPayment, payrollSettings, organization, chartAccount, journalEntry, journalLine, member, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { payrollMasterDto } from "./payroll-master-wire";
import { paymentId, paymentDate, contractorPaymentCreateSchema, contractorPaymentUpdateSchema, contractorPaymentProcessSchema,
  taxPaymentCreateSchema, taxPaymentListSchema, legacyRemittanceSchema, paymentAmounts, paymentAllocations, payrollPaymentDto } from "./payroll-payment-wire";
import { assertNotLocked } from "./period-lock";
import { getNextEntryNumber, ensureAccountByCode } from "./journal-automation";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { assertFunctionalCurrencyEnabled } from "@/lib/currency/rollout";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { payrollConvert, payrollSum } from "@/lib/payroll/exact";
import { stringifyWire, WireCompatibilityError, legacyMinorSchema } from "@/lib/money/wire";

const today = () => new Date().toISOString().slice(0, 10);
const contractorScope = (ctx: AuthContext, id: string) => and(eq(contractor.id, id), eq(contractor.organizationId, ctx.organizationId), isNull(contractor.deletedAt));
async function mutate<T>(ctx: AuthContext, fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return fn(tx); });
}
async function ownedContractor(tx: TaxTx, ctx: AuthContext, id: string, lock = false) {
  paymentId.parse(id); const q = tx.select().from(contractor).where(contractorScope(ctx, id));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new AuthError("Contractor not found", 404); payrollMasterDto(row); return row;
}
async function ownedPayment(tx: TaxTx, id: string, payment: string, lock = false) {
  paymentId.parse(payment); const q = tx.select().from(contractorPayment).where(and(eq(contractorPayment.id, payment), eq(contractorPayment.contractorId, id)));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new AuthError("Payment not found", 404); payrollPaymentDto(row); return row;
}
function ordered(start?: string | null, end?: string | null) {
  if (start && end && end < start) throw new AuthError("Period end cannot precede start", 400);
}
async function baseCurrency(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId));
  const base = currencyCodeSchema.parse(org.defaultCurrency); assertFunctionalCurrencyEnabled(base); return base;
}
async function account(tx: TaxTx, ctx: AuthContext, code: string, base: string, type: "asset" | "expense" | "liability", id?: string) {
  const [existing] = await tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), id ? eq(chartAccount.id, id) : eq(chartAccount.code, code))).for("update");
  if (id && !existing) throw new AuthError("Bank account not found", 404);
  const names: Record<string, string> = { "1100": "Bank", "5130": "Subcontractor Expense", "2220": "Income Tax Payable", "2235": "Payroll Taxes Payable", "2245": "Pension & Benefits Payable", "2236": "Other Statutory Deductions Payable" };
  const row = existing ?? await ensureAccountByCode(ctx.organizationId, { code, name: names[code] ?? `Account ${code}`, type, subType: type === "expense" ? "operating" : "current" }, base, tx);
  if (!row || row.deletedAt || !row.isActive || row.type !== type || row.currencyCode !== base)
    throw new AuthError(`Account ${code} must be live, active, ${type} and in ${base}`, 409);
  return row;
}
async function post(tx: TaxTx, ctx: AuthContext, date: string, sourceType: string, sourceId: string, description: string,
  reference: string | null, lines: { accountId: string; debitAmount: number; creditAmount: number }[], currency: string, rateExact: string) {
  await assertNotLocked(ctx.organizationId, date, ctx);
  if (payrollSum(lines.map(l => l.debitAmount)) !== payrollSum(lines.map(l => l.creditAmount))) throw new WireCompatibilityError("Payment journal is unbalanced");
  let exchangeRate: number;
  try { exchangeRate = toLegacyRate(rateExact); } catch { throw new WireCompatibilityError("Payment FX requires lossless positive int32 millionths during coexistence"); }
  const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber, date, sourceType, sourceId,
    description, reference, status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
  const stamped = lines.map(l => ({ ...l, journalEntryId: entry.id, currencyCode: currency, exchangeRate, rateExact,
    rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact", rateProvenance: "payroll_payment_snapshot" }));
  stringifyWire(stamped); await tx.insert(journalLine).values(stamped); return entry.id;
}
async function ownedJournal(tx: TaxTx, ctx: AuthContext, id: string | null, sourceType: string, sourceId: string, expectedAmount?: number, expectedRate?: string) {
  if (!id) throw new WireCompatibilityError("Paid payment lacks a saved journal; manual review required");
  const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId),
    eq(journalEntry.sourceType, sourceType), eq(journalEntry.sourceId, sourceId), eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt)));
  if (!entry) throw new WireCompatibilityError("Payment journal is missing or outside organization");
  const lines = await tx.select({ line: journalLine, accountOrganizationId: chartAccount.organizationId }).from(journalLine)
    .innerJoin(chartAccount, eq(chartAccount.id, journalLine.accountId)).where(eq(journalLine.journalEntryId, id));
  if (lines.length < 2 || lines.some(({ line, accountOrganizationId }) => accountOrganizationId !== ctx.organizationId ||
    !legacyMinorSchema.min(0).safeParse(line.debitAmount).success || !legacyMinorSchema.min(0).safeParse(line.creditAmount).success ||
    (expectedRate !== undefined && (line.rateExact !== expectedRate || line.rateMigrationStatus !== "exact"))))
    throw new WireCompatibilityError("Payment journal has unsupported lines, scope or FX");
  const debit = payrollSum(lines.map(l => l.line.debitAmount)), credit = payrollSum(lines.map(l => l.line.creditAmount));
  if (debit !== credit || debit <= 0 || (expectedAmount !== undefined && debit !== expectedAmount))
    throw new WireCompatibilityError("Payment journal does not reconcile to the saved payment");
  return entry;
}
export async function listContractorPayments(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:contractors");
  return db.transaction(async tx => { await ownedContractor(tx, ctx, id);
    const rows = await tx.select().from(contractorPayment).where(eq(contractorPayment.contractorId, id)).orderBy(desc(contractorPayment.createdAt), contractorPayment.id);
    return rows.map(payrollPaymentDto);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getContractorPayment(ctx: AuthContext, id: string, payment: string) {
  requireRole(ctx, "manage:contractors");
  return db.transaction(async tx => { await ownedContractor(tx, ctx, id); return payrollPaymentDto(await ownedPayment(tx, id, payment)); },
    { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createContractorPayment(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contractors"); const values = paymentAmounts(contractorPaymentCreateSchema.parse(input)); ordered(values.periodStart, values.periodEnd);
  return mutate(ctx, async tx => {
    const c = await ownedContractor(tx, ctx, id, true);
    if (!c.isActive) throw new AuthError("Active contractor required", 409);
    const currency = currencyCodeSchema.parse(values.currency ?? c.currency);
    const [row] = await tx.insert(contractorPayment).values({ ...values, amount: values.amount!, contractorId: id, currency }).returning();
    const result = payrollPaymentDto(row); await auditTax(tx, ctx.organizationId, "contractorPayment", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateContractorPayment(ctx: AuthContext, id: string, payment: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contractors"); const values = paymentAmounts(contractorPaymentUpdateSchema.parse(input), false);
  if (!Object.values(values).some(v => v !== undefined)) throw new AuthError("Provide at least one payment field", 400);
  if (values.status === "paid") throw new AuthError("Use process to mark a payment paid", 409);
  return mutate(ctx, async tx => {
    await ownedContractor(tx, ctx, id, true); const before = await ownedPayment(tx, id, payment, true);
    if (before.status !== "pending" || before.journalEntryId || before.paidAt) throw new AuthError("Only unposted pending payments can change", 409);
    const [row] = await tx.update(contractorPayment).set(values).where(eq(contractorPayment.id, payment)).returning();
    const result = payrollPaymentDto(row); await auditTax(tx, ctx.organizationId, "contractorPayment", payment, "update", { before: payrollPaymentDto(before), after: result }, ctx, request); return result;
  });
}
export async function deleteContractorPayment(ctx: AuthContext, id: string, payment: string, request?: Request) {
  requireRole(ctx, "manage:contractors");
  return mutate(ctx, async tx => {
    await ownedContractor(tx, ctx, id, true); const row = await ownedPayment(tx, id, payment, true);
    if (row.status !== "pending" || row.journalEntryId || row.paidAt) throw new AuthError("Only unposted pending payments can be deleted", 409);
    await tx.delete(contractorPayment).where(eq(contractorPayment.id, payment));
    await auditTax(tx, ctx.organizationId, "contractorPayment", payment, "delete", payrollPaymentDto(row), ctx, request); return { success: true };
  });
}
export async function processContractorPayment(ctx: AuthContext, id: string, payment: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contractors"); const p = contractorPaymentProcessSchema.parse(input);
  return mutate(ctx, async tx => {
    const c = await ownedContractor(tx, ctx, id, true), before = await ownedPayment(tx, id, payment, true);
    if (before.status === "paid") {
      const journal = await ownedJournal(tx, ctx, before.journalEntryId, "contractor_payment", payment, before.baseAmount ?? undefined, before.rateExact ?? undefined);
      if (before.paymentDate && before.paymentDate !== journal.date) throw new WireCompatibilityError("Payment date disagrees with saved journal");
      if (p.paymentDate && p.paymentDate !== journal.date) throw new AuthError("Paid retry date conflicts with saved posting", 409);
      return payrollPaymentDto(before);
    }
    if (before.status !== "pending" || before.journalEntryId || before.paidAt) throw new AuthError("Only unposted pending payments can be processed", 409);
    if (!c.isActive) throw new AuthError("Active contractor required", 409);
    const date = p.paymentDate ?? today(); paymentDate.parse(date); await assertNotLocked(ctx.organizationId, date, ctx);
    const base = await baseCurrency(tx, ctx), currency = currencyCodeSchema.parse(before.currency);
    const quote = await createHistoricalRateResolver(ctx.organizationId, tx)(currency, base, date);
    if (!quote) throw new MissingExchangeRateError(currency, base, date);
    const baseAmount = payrollConvert(before.amount, quote.rateExact);
    if (baseAmount <= 0) throw new WireCompatibilityError("Payment converts to zero base cents");
    const expense = await account(tx, ctx, "5130", base, "expense"), bank = await account(tx, ctx, "1100", base, "asset");
    const journalEntryId = await post(tx, ctx, date, "contractor_payment", payment, `Contractor payment - ${before.description || payment.slice(0, 8)}`, `CP-${payment.slice(0, 8)}`,
      [{ accountId: expense.id, debitAmount: baseAmount, creditAmount: 0 }, { accountId: bank.id, debitAmount: 0, creditAmount: baseAmount }], currency, quote.rateExact);
    const [row] = await tx.update(contractorPayment).set({ status: "paid", paidAt: new Date(), journalEntryId, baseAmount, baseCurrency: base,
      rateExact: quote.rateExact, paymentDate: date }).where(eq(contractorPayment.id, payment)).returning();
    const result = payrollPaymentDto(row); await auditTax(tx, ctx.organizationId, "contractorPayment", payment, "process", result, ctx, request); return result;
  });
}
export async function listPayrollTaxPayments(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:payroll"); const p = taxPaymentListSchema.parse(input); ordered(p.from, p.to);
  const rows = await db.select().from(payrollTaxPayment).where(and(eq(payrollTaxPayment.organizationId, ctx.organizationId), isNull(payrollTaxPayment.deletedAt),
    p.from ? gte(payrollTaxPayment.periodEnd, p.from) : undefined, p.to ? lte(payrollTaxPayment.periodStart, p.to) : undefined)).orderBy(desc(payrollTaxPayment.periodEnd), desc(payrollTaxPayment.createdAt), payrollTaxPayment.id);
  return rows.map(payrollPaymentDto);
}
export async function createPayrollTaxPayment(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const p = taxPaymentCreateSchema.parse(input); ordered(p.periodStart, p.periodEnd);
  const { allocations, amount } = paymentAllocations(p);
  const normalized = { periodStart: p.periodStart, periodEnd: p.periodEnd, jurisdictionLevel: p.jurisdictionLevel, jurisdiction: p.jurisdiction ?? null,
    taxKind: p.taxKind ?? null, allocations, bankAccountCode: p.bankAccountCode ?? null, bankAccountId: p.bankAccountId ?? null,
    paymentDate: p.paymentDate ?? null, reference: p.reference ?? null, notes: p.notes ?? null };
  const fingerprint = createHash("sha256").update(stringifyWire(normalized)).digest("hex");
  return mutate(ctx, async tx => {
    if (p.idempotencyKey) {
      const [prior] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "payrollTaxPayment"),
        eq(auditLog.action, "create"), sql`${auditLog.changes}->>'idempotencyKey' = ${p.idempotencyKey}`));
      if (prior) {
        const changes = prior.changes as { fingerprint?: string };
        if (changes.fingerprint !== fingerprint) throw new AuthError("Remittance retry key conflicts with previous input", 409);
        const [payment] = await tx.select().from(payrollTaxPayment).where(and(eq(payrollTaxPayment.id, prior.entityId), eq(payrollTaxPayment.organizationId, ctx.organizationId), isNull(payrollTaxPayment.deletedAt)));
        if (!payment || payment.status !== "paid") throw new WireCompatibilityError("Remittance retry record unavailable");
        await ownedJournal(tx, ctx, payment.journalEntryId, "payroll_tax_payment", payment.id, payment.amount, "1");
        return { payment: payrollPaymentDto(payment), journalEntryId: payment.journalEntryId };
      }
    }
    const date = p.paymentDate ?? today(); paymentDate.parse(date); await assertNotLocked(ctx.organizationId, date, ctx);
    const base = await baseCurrency(tx, ctx);
    const [settings] = await tx.select().from(payrollSettings).where(eq(payrollSettings.organizationId, ctx.organizationId));
    const bankCode = p.bankAccountCode ?? settings?.bankAccountCode ?? "1100";
    taxPaymentCreateSchema.shape.bankAccountCode.parse(bankCode);
    const bank = await account(tx, ctx, bankCode, base, "asset", p.bankAccountId);
    if (p.bankAccountCode && p.bankAccountCode !== bank.code) throw new AuthError("Bank ID and code disagree", 400);
    const lines: { accountId: string; debitAmount: number; creditAmount: number }[] = [];
    for (const a of allocations) {
      const liability = await account(tx, ctx, a.code, base, "liability");
      lines.push({ accountId: liability.id, debitAmount: a.amount, creditAmount: 0 });
    }
    lines.push({ accountId: bank.id, debitAmount: 0, creditAmount: amount });
    const [mem] = await tx.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId)));
    const [row] = await tx.insert(payrollTaxPayment).values({ organizationId: ctx.organizationId, periodStart: p.periodStart, periodEnd: p.periodEnd,
      jurisdictionLevel: p.jurisdictionLevel, jurisdiction: p.jurisdiction ?? null, taxKind: p.taxKind ?? null, amount, currency: base,
      bankAccountId: bank.id, reference: p.reference ?? null, notes: p.notes ?? null, status: "paid", paidAt: new Date(), createdBy: mem?.id ?? null }).returning();
    const journalEntryId = await post(tx, ctx, date, "payroll_tax_payment", row.id, `Payroll tax remittance ${p.periodStart} to ${p.periodEnd}`,
      p.reference ?? `PTX-${p.periodEnd}`, lines, base, "1");
    const [saved] = await tx.update(payrollTaxPayment).set({ journalEntryId }).where(eq(payrollTaxPayment.id, row.id)).returning();
    const payment = payrollPaymentDto(saved); await auditTax(tx, ctx.organizationId, "payrollTaxPayment", row.id, "create",
      { idempotencyKey: p.idempotencyKey ?? null, fingerprint, allocations, payment, paymentDate: date }, ctx, request);
    return { payment, journalEntryId };
  });
}
/** Preserve the existing MCP amount/bank-id/date contract through the same service. */
export async function recordPayrollTaxRemittance(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:payroll"); const p = legacyRemittanceSchema.parse(input);
  const { amount, amountMinor, date, ...rest } = p;
  const kind = (p.taxKind ?? "").toLowerCase();
  const bucket = /fica|social|medicare|futa|suta|940|unemployment/.test(kind) ? "2235" : "2220";
  return createPayrollTaxPayment(ctx, { ...rest, allocations: [{ bucket, amount, amountMinor }], paymentDate: date ?? p.periodEnd });
}
