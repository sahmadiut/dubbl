import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loan, loanSchedule, chartAccount, bankAccount, journalEntry, journalLine, auditLog, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { calculatePMT, generateAmortizationSchedule, loanPaymentDate } from "./amortization";
import { loanId, loanDto, loanScheduleDto, loanPrincipal, loanUpdateSchema, loanListSchema, loanPaymentSchema, loanPreflight } from "./loan-wire";
import { assetDate, assetMoneyDto } from "./asset-master-wire";
import { bankAccountDto } from "./bank-account-wire";
import { currencyMetadata, roundRatio } from "@/lib/money/exact";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { getNextEntryNumber } from "./journal-automation";
import { assertNotLocked } from "./period-lock";

type Loan = typeof loan.$inferSelect;
type Result = Record<string, unknown>;
function unchangedLoan(before: Loan, after: Loan, allowed: readonly string[]) {
  loanDto(after);
  for (const key of Object.keys(before) as (keyof Loan)[]) {
    if (allowed.includes(key)) continue;
    const a = before[key], b = after[key];
    if (a instanceof Date && b instanceof Date ? a.getTime() !== b.getTime() : a !== b) unsupported("Saved loan changed outside the requested operation");
  }
}
const scope = (ctx: AuthContext, id: string) => and(eq(loan.id, id), eq(loan.organizationId, ctx.organizationId), isNull(loan.deletedAt));
const unsupported = (message: string): never => { throw new AuthError(message, 422); };
async function baseCurrency(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)));
  if (!org) throw new AuthError("Organization not found", 404);
  // Loan tables have no currency snapshot. Preserve fixed cents and reject unlike scales.
  if (currencyMetadata(org.defaultCurrency).minorUnits !== 2) unsupported("Loan fixed-cents contract requires a two-decimal base currency; historical currency qualification remains separate");
  return org.defaultCurrency;
}
async function account(tx: TaxTx, ctx: AuthContext, id: string | null, base: string, type: string, live: boolean) {
  if (!id) return unsupported("Loan posting account is missing");
  const query = tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId)));
  const [a] = await (live ? query.for("share") : query);
  if (!a || a.currencyCode !== base || a.type !== type || (live && (!a.isActive || a.deletedAt)))
    return unsupported("Loan accounts must be organization-owned, have the required type and base currency; posting requires live active accounts");
  return a;
}
async function links(tx: TaxTx, ctx: AuthContext, row: Loan, base: string, live = false) {
  const principalAccount = await account(tx, ctx, row.principalAccountId, base, "liability", live);
  const interestAccount = await account(tx, ctx, row.interestAccountId, base, "expense", live);
  let bank = null;
  if (row.bankAccountId) {
    const query = tx.select().from(bankAccount).where(and(eq(bankAccount.id, row.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId)));
    const [saved] = await (live ? query.for("update") : query);
    if (!saved || saved.currencyCode !== base || ["credit_card", "loan"].includes(saved.accountType) || (live && (!saved.isActive || saved.deletedAt))) unsupported("Loan bank must belong to the organization, use base currency and an asset GL; posting requires live active bank");
    bank = bankAccountDto(saved);
    if (saved.chartAccountId) await account(tx, ctx, saved.chartAccountId, base, "asset", live);
  }
  return { bankAccount: bank, principalAccount, interestAccount };
}
async function load(tx: TaxTx, ctx: AuthContext, id: string, lock = false) {
  const q = tx.select().from(loan).where(scope(ctx, id));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new AuthError("Loan not found", 404);
  loanDto(row);
  if (!assetDate.safeParse(row.startDate).success || !Number.isInteger(row.termMonths) || row.termMonths < 1 || row.termMonths > 1200 ||
    !Number.isInteger(row.interestRate) || row.interestRate < 0 || row.interestRate > 100000 || row.principalAmount <= 0 || row.monthlyPayment <= 0)
    unsupported("Unsupported saved loan date, term, rate or amount");
  return row;
}
async function schedule(tx: TaxTx, ctx: AuthContext, row: Loan, base: string) {
  const rows = await tx.select().from(loanSchedule).where(eq(loanSchedule.loanId, row.id)).orderBy(asc(loanSchedule.sortOrder), asc(loanSchedule.id));
  if (rows.length !== row.termMonths) unsupported("Saved loan schedule is incomplete");
  if (row.monthlyPayment !== calculatePMT(row.principalAmount, row.interestRate, row.termMonths)) unsupported("Saved loan payment is inconsistent with exact PMT");
  let balance = BigInt(row.principalAmount), total = 0n, unposted = false, previousDate = row.startDate;
  const journals = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; loanScheduleDto(r);
    if (BigInt(r.interestAmount) !== roundRatio(balance * BigInt(row.interestRate), 120000n, "half-away-from-zero") ||
      r.date !== loanPaymentDate(row.startDate, i + 1) || (i < rows.length - 1 && r.totalPayment !== row.monthlyPayment)) unsupported("Saved loan interest, payment or date differs from supported schedule policy");
    balance -= BigInt(r.principalAmount); total += BigInt(r.totalPayment); legacyMinor(total);
    if (r.periodNumber !== i + 1 || r.sortOrder !== i + 1 || !assetDate.safeParse(r.date).success || r.date <= previousDate ||
      balance < 0n || balance !== BigInt(r.remainingBalance) || BigInt(r.principalAmount) + BigInt(r.interestAmount) !== BigInt(r.totalPayment) || r.totalPayment <= 0)
      unsupported("Saved loan schedule amounts, ordering or dates are inconsistent");
    previousDate = r.date;
    if (!r.posted) { unposted = true; if (r.journalEntryId) unsupported("Unposted schedule has journal history"); continue; }
    if (unposted || !r.journalEntryId || journals.has(r.journalEntryId)) return unsupported("Saved loan posting history is missing, duplicate or out of sequence");
    journals.add(r.journalEntryId);
    const [j] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, r.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!j || j.deletedAt || j.status !== "posted" || j.sourceType !== "loan" || j.sourceId !== row.id || j.date !== r.date) unsupported("Saved loan journal does not match scheduled payment");
    const legs = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, j.id));
    const [bank] = row.bankAccountId ? await tx.select().from(bankAccount).where(and(eq(bankAccount.id, row.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId))) : [];
    const expected = new Map<string, [number, number]>();
    if (r.principalAmount) expected.set(row.principalAccountId!, [r.principalAmount, 0]);
    if (r.interestAmount) expected.set(row.interestAccountId!, [r.interestAmount, 0]);
    if (!bank?.chartAccountId || expected.has(bank.chartAccountId)) return unsupported("Saved loan payment has no distinct bank GL account");
    expected.set(bank.chartAccountId, [0, r.totalPayment]);
    if (legs.length !== expected.size) unsupported("Saved loan journal has unexpected legs");
    for (const l of legs) {
      assetMoneyDto(l, ["debitAmount", "creditAmount"]);
      const e = expected.get(l.accountId);
      if (!e || l.debitAmount !== e[0] || l.creditAmount !== e[1] || l.currencyCode !== base || l.exchangeRate !== 1000000 ||
        (l.rateExact !== null && l.rateExact !== "1") || (l.rateDirection !== null && l.rateDirection !== "quote_per_base")) unsupported("Unsupported saved loan journal money, account or FX");
      expected.delete(l.accountId);
    }
  }
  if (balance !== 0n) unsupported("Saved schedule does not conserve principal");
  const history = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceType, "loan"), eq(journalEntry.sourceId, row.id)));
  if (history.length !== journals.size || history.some(j => !journals.has(j.id))) unsupported("Loan has unlinked or unsupported payment journal history");
  if (row.status === "paid_off" && unposted) unsupported("Paid-off loan has unposted payments");
  return rows;
}
async function replay(tx: TaxTx, ctx: AuthContext, action: string, id: string | undefined, key: string | undefined, fingerprint: string) {
  if (!key) return;
  const [a] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "loan"),
    eq(auditLog.action, action), id ? eq(auditLog.entityId, id) : undefined, sql`${auditLog.changes}->>'retryKey' = ${key}`)).orderBy(desc(auditLog.createdAt)).limit(1);
  if (!a) return;
  const saved = a.changes as { fingerprint: string; result: Result };
  if (saved.fingerprint !== fingerprint) throw new AuthError("Loan retry key has different inputs", 409);
  return loanPreflight(saved.result);
}
async function record(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string, result: Result, request?: Request) {
  loanPreflight(result);
  await auditTax(tx, ctx.organizationId, "loan", id, action, { retryKey: key ?? null, fingerprint, result }, ctx, request);
}
export async function listLoans(ctx: AuthContext, input: unknown) {
  const p = loanListSchema.parse(input);
  return db.transaction(async tx => {
    const base = await baseCurrency(tx, ctx), where = and(eq(loan.organizationId, ctx.organizationId), isNull(loan.deletedAt), p.status ? eq(loan.status, p.status) : undefined);
    const rows = await tx.select().from(loan).where(where).orderBy(desc(loan.createdAt), desc(loan.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const loans = [];
    for (const r of rows) { await load(tx, ctx, r.id); loans.push({ ...loanDto(r), ...await links(tx, ctx, r, base) }); }
    const [count] = await tx.select({ total: sql<string>`count(*)::text` }).from(loan).where(where);
    return loanPreflight({ loans, total: legacyMinor(BigInt(count.total)), page: p.page, limit: p.limit });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getLoan(ctx: AuthContext, id: string) {
  loanId.parse(id);
  return db.transaction(async tx => {
    const row = await load(tx, ctx, id), base = await baseCurrency(tx, ctx);
    return loanPreflight({ loan: { ...loanDto(row), ...await links(tx, ctx, row, base) }, schedule: (await schedule(tx, ctx, row, base)).map(loanScheduleDto) });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createLoan(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:invoices"); const p = loanPrincipal(input, transport);
  const generated = generateAmortizationSchedule(p.principalAmount, p.interestRate, p.termMonths, p.startDate);
  const values = { organizationId: ctx.organizationId, name: p.name, bankAccountId: p.bankAccountId ?? null, principalAmount: p.principalAmount,
    interestRate: p.interestRate, termMonths: p.termMonths, startDate: p.startDate, monthlyPayment: calculatePMT(p.principalAmount, p.interestRate, p.termMonths),
    principalAccountId: p.principalAccountId, interestAccountId: p.interestAccountId };
  const fingerprint = stringifyWire(values);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const saved = await replay(tx, ctx, "create", undefined, p.idempotencyKey, fingerprint); if (saved) return saved;
    const base = await baseCurrency(tx, ctx);
    await links(tx, ctx, values as Loan, base, true);
    const [created] = await tx.insert(loan).values(values).returning();
    if (Object.entries(values).some(([key, value]) => created[key as keyof Loan] !== value)) unsupported("Saved loan differs from validated input");
    if (created.status !== "active" || created.deletedAt) unsupported("Saved loan is not a new active loan");
    const inserted = await tx.insert(loanSchedule).values(generated.map(e => ({ ...e, loanId: created.id, sortOrder: e.periodNumber }))).returning();
    for (let i = 0; i < generated.length; i++) if (Object.entries(generated[i]).some(([key, value]) => inserted[i][key as keyof typeof inserted[number]] !== value)) unsupported("Saved loan schedule differs from exact calculation");
    // Create preserves its historical generated-schedule envelope (no persisted row IDs).
    const result = { loan: loanDto(created), schedule: generated.map(loanScheduleDto) };
    await record(tx, ctx, created.id, "create", p.idempotencyKey, fingerprint, result, request); return result;
  });
}
export async function updateLoan(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices"); loanId.parse(id); const p = loanUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const row = await load(tx, ctx, id, true), base = await baseCurrency(tx, ctx);
    await links(tx, ctx, row, base); const rows = await schedule(tx, ctx, row, base), remaining = rows.some(r => !r.posted);
    if ((p.status === "paid_off" && remaining) || (p.status === "active" && !remaining)) throw new AuthError("Status must agree with saved scheduled payments", 409);
    const [updated] = await tx.update(loan).set({ ...p, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    unchangedLoan(row, updated, [...Object.keys(p), "updatedAt"]);
    if (Object.entries(p).some(([k, v]) => updated[k as keyof Loan] !== v)) unsupported("Saved loan update differs from input");
    const result = { loan: loanDto(updated) }; await record(tx, ctx, id, "update", undefined, stringifyWire(p), result, request); return result;
  });
}
export async function deleteLoan(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:invoices"); loanId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const row = await load(tx, ctx, id, true), base = await baseCurrency(tx, ctx);
    await links(tx, ctx, row, base); const rows = await schedule(tx, ctx, row, base);
    const [history] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceType, "loan"), eq(journalEntry.sourceId, id))).limit(1);
    if (rows.some(r => r.posted || r.journalEntryId) || history) throw new AuthError("Cannot delete a loan with posted payment history", 400);
    await tx.delete(loanSchedule).where(eq(loanSchedule.loanId, id));
    const [deleted] = await tx.update(loan).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id)).returning();
    unchangedLoan(row, deleted, ["deletedAt", "updatedAt"]);
    loanDto(deleted); if (!deleted.deletedAt) unsupported("Loan soft deletion failed");
    const result = { success: true }; await record(tx, ctx, id, "delete", undefined, "delete", result, request); return result;
  });
}
export async function postLoanPayment(ctx: AuthContext, id: string, input: unknown = {}, request?: Request) {
  requireRole(ctx, "manage:invoices"); loanId.parse(id); const p = loanPaymentSchema.parse(input);
  const fingerprint = stringifyWire({ scheduleEntryId: p.scheduleEntryId ?? null });
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const row = await load(tx, ctx, id, true), base = await baseCurrency(tx, ctx);
    const related = await links(tx, ctx, row, base), rows = await schedule(tx, ctx, row, base);
    const saved = await replay(tx, ctx, "post_payment", id, p.idempotencyKey ?? p.scheduleEntryId, fingerprint); if (saved) return saved;
    if (row.status !== "active") throw new AuthError("Loan is not active", 400);
    const next = rows.find(r => !r.posted);
    if (!next) throw new AuthError("No unposted schedule entries remaining", 400);
    if (p.scheduleEntryId && p.scheduleEntryId !== next.id) throw new AuthError("Expected schedule entry is not the next unposted payment", 409);
    if (!related.bankAccount) throw new AuthError("Select the bank account this loan is repaid from before posting a payment", 400);
    await links(tx, ctx, row, base, true);
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    await assertNotLocked(ctx.organizationId, next.date, ctx, tx);
    const cash = await ensureBankLedgerAccount(ctx.organizationId, related.bankAccount, tx);
    await account(tx, ctx, cash, base, "asset", true);
    const [shared] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), eq(bankAccount.chartAccountId, cash), sql`${bankAccount.id} <> ${related.bankAccount.id}`)).limit(1);
    if (shared) unsupported("Loan repayment bank GL is shared by another bank account");
    if (cash === row.principalAccountId || cash === row.interestAccountId) unsupported("Loan payment accounts must differ");
    const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx),
      date: next.date, description: `Loan payment #${next.periodNumber} for ${row.name}`, reference: `LOAN-${row.name}-${next.periodNumber}`,
      status: "posted", sourceType: "loan", sourceId: row.id, createdBy: ctx.userId, postedAt: new Date() }).returning();
    const legs = [];
    if (next.principalAmount) legs.push({ accountId: row.principalAccountId!, debitAmount: next.principalAmount, creditAmount: 0 });
    if (next.interestAmount) legs.push({ accountId: row.interestAccountId!, debitAmount: next.interestAmount, creditAmount: 0 });
    legs.push({ accountId: cash, debitAmount: 0, creditAmount: next.totalPayment });
    const savedLegs = await tx.insert(journalLine).values(legs.map(l => ({ ...l, journalEntryId: entry.id, description: entry.description, currencyCode: base,
      exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact" }))).returning();
    for (let i = 0; i < legs.length; i++) {
      assetMoneyDto(savedLegs[i], ["debitAmount", "creditAmount"]);
      if (Object.entries(legs[i]).some(([k, v]) => savedLegs[i][k as keyof typeof savedLegs[number]] !== v) || savedLegs[i].currencyCode !== base || savedLegs[i].rateExact !== "1") unsupported("Saved loan journal differs from exact posting");
    }
    const [posted] = await tx.update(loanSchedule).set({ posted: true, journalEntryId: entry.id }).where(eq(loanSchedule.id, next.id)).returning();
    if (!posted.posted || posted.journalEntryId !== entry.id) unsupported("Saved loan payment link differs from posting");
    const status = rows.every(r => r.posted || r.id === next.id) ? "paid_off" : "active";
    const [updated] = await tx.update(loan).set({ status, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    unchangedLoan(row, updated, ["status", "updatedAt"]);
    loanDto(updated); if (updated.status !== status) unsupported("Saved loan status differs from posting");
    await schedule(tx, ctx, updated, base);
    const result = { entry: loanScheduleDto(posted), journalEntry: entry, loanStatus: status };
    await record(tx, ctx, id, "post_payment", p.idempotencyKey ?? p.scheduleEntryId, fingerprint, result, request); return result;
  });
}
