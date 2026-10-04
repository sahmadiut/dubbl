import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, bankAccount, bankTransaction, bankStatementImport, chartAccount, journalEntry, journalLine, auditLog, payment, expenseClaim } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { bandFor } from "./bank-ledger-codes";
import { getNextEntryNumber } from "./journal-automation";
import { bankAccountDto, bankAccountCreateFields } from "./bank-account-wire";
import { bankReadId, bankReadCurrency, bankReadNullableMoney, sameBankReadCurrency } from "./bank-transaction-read-wire";
import { bankTransferSchema, bankTransferMcpSchema, bankMatchTransferSchema, bankTransferAmount } from "./bank-transfer-wire";
import type { ExpenseTransport } from "./expense-wire";
import { convertInvoiceLegs } from "./invoice-lifecycle-wire";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Bank = typeof bankAccount.$inferSelect;
function fail(message: string): never { throw new AuthError(message, 400); }
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  return bankReadCurrency(org.defaultCurrency);
}
async function loadBank(tx: Tx, ctx: AuthContext, id: string) {
  const [bank] = await tx.select().from(bankAccount).where(and(eq(bankAccount.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt))).for("update");
  if (!bank) throw new AuthError("Bank account not found", 404);
  bankAccountDto(bank);
  if (!bankAccountCreateFields.accountType.safeParse(bank.accountType).success) throw new WireCompatibilityError("Unsupported saved bank account type");
  if (!bank.isActive) fail("Transfers require active bank accounts");
  return bank;
}
async function loadMovement(tx: Tx, ctx: AuthContext, id: string, bank: Bank) {
  // Tenant-qualified bank is established before decoding any statement money.
  const [row] = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.id, id), eq(bankTransaction.bankAccountId, bank.id))).for("update");
  if (!row) throw new AuthError("Bank transaction not found", 404);
  bankReadNullableMoney(row, ["amount", "balance"]);
  sameBankReadCurrency(row.currencyCode, bank.currencyCode); rateDateSchema.parse(row.date);
  if (row.status !== "unreconciled" || !row.amount || row.journalEntryId || row.reconciliationId || row.transferTransactionId || row.transferGroupId || row.sourceType === "transfer")
    fail("Transfer matching requires a nonzero, unlinked unreconciled statement line");
  if (row.importId) {
    const [statement] = await tx.select({ id: bankStatementImport.id, currency: bankStatementImport.statementCurrency }).from(bankStatementImport)
      .where(and(eq(bankStatementImport.id, row.importId), eq(bankStatementImport.organizationId, ctx.organizationId), eq(bankStatementImport.bankAccountId, bank.id)));
    if (!statement) throw new WireCompatibilityError("Statement import belongs to another bank or organization");
    sameBankReadCurrency(statement.currency, bank.currencyCode);
  }
  const [linked] = await tx.select({ id: payment.id }).from(payment).where(and(eq(payment.bankTransactionId, id), isNull(payment.deletedAt)));
  const [claim] = await tx.select({ id: expenseClaim.id }).from(auditLog).innerJoin(expenseClaim, eq(expenseClaim.id, auditLog.entityId))
    .where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "expense"), eq(expenseClaim.organizationId, ctx.organizationId),
      isNull(expenseClaim.deletedAt), sql`${auditLog.changes}->>'bankTransactionId' = ${id}`));
  if (linked || claim) fail("Resolve existing payment or expense history before matching a transfer");
  await assertNotLocked(ctx.organizationId, row.date, ctx);
  return row;
}
async function gl(tx: Tx, ctx: AuthContext, bank: Bank) {
  const id = await ensureBankLedgerAccount(ctx.organizationId, bank, tx);
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!row) throw new AuthError("Bank GL account not found", 404);
  const [other] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.chartAccountId, id), ne(bankAccount.id, bank.id)));
  if (other || row.deletedAt || !row.isActive || row.type !== bandFor(bank.accountType).type || row.currencyCode !== bank.currencyCode)
    throw new WireCompatibilityError("Bank GL must be active, exclusively linked and correctly denominated");
  return id;
}
function pairBanks(source: Bank, target: Bank) {
  if (source.id === target.id) fail("A transfer must be between two different bank accounts");
  if (source.currencyCode !== target.currencyCode) fail("Transfers must be between accounts in the same currency");
}
async function post(tx: Tx, ctx: AuthContext, from: Bank, to: Bank, amount: number, date: string, base: string, reference: string | null) {
  const currency = from.currencyCode;
  const rate = await createHistoricalRateResolver(ctx.organizationId, tx)(currency, base, date);
  if (!rate) throw new MissingExchangeRateError(currency, base, date);
  let numericRate: number;
  try { numericRate = toLegacyRate(rate.rateExact); }
  catch { throw new WireCompatibilityError("Transfer FX must fit positive int32 millionths exactly"); }
  const fromGl = await gl(tx, ctx, from), toGl = await gl(tx, ctx, to);
  if (fromGl === toGl) fail("Sending and receiving bank GL accounts must differ");
  const description = `Transfer ${from.accountName} → ${to.accountName}`;
  const lines = convertInvoiceLegs([{ accountId: toGl, description, debitAmount: amount, creditAmount: 0 },
    { accountId: fromGl, description, debitAmount: 0, creditAmount: amount }], currency, base, rate.rateExact);
  if (lines[0].debitAmount <= 0 || lines[0].debitAmount !== lines[1].creditAmount) throw new WireCompatibilityError("Transfer must have equal positive base-currency legs");
  const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
  if (!Number.isInteger(entryNumber) || entryNumber < 1 || entryNumber > 2147483647) throw new WireCompatibilityError("Journal numbering exceeds int32 capacity");
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber, date, description, reference,
    status: "posted", sourceType: "bank_transfer", postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(lines.map(l => ({ ...l, journalEntryId: entry.id, currencyCode: currency, exchangeRate: numericRate,
    rateExact: rate.rateExact, rateDirection: "quote_per_base", rateMigrationStatus: "exact", rateFormatVersion: 1, rateProvenance: "bank_transfer:transaction" })));
  return { entry, description, rateExact: rate.rateExact };
}
async function audit(tx: Tx, ctx: AuthContext, entityType: string, id: string, action: string, changes: Record<string, unknown>, request?: Request) {
  stringifyWire(changes);
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType, entityId: id, action, changes,
    ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
export async function recordBankTransfer(ctx: AuthContext, input: unknown, request?: Request, transport: ExpenseTransport = "rest") {
  requireRole(ctx, "manage:banking");
  const parsed = (transport === "rest" ? bankTransferSchema : bankTransferMcpSchema).parse(input);
  if (parsed.fromBankAccountId === parsed.toBankAccountId) fail("A transfer must be between two different bank accounts");
  return db.transaction(async tx => {
    const base = await lockOrg(tx, ctx), from = await loadBank(tx, ctx, parsed.fromBankAccountId), to = await loadBank(tx, ctx, parsed.toBankAccountId);
    pairBanks(from, to);
    const amount = bankTransferAmount(parsed, from.currencyCode, transport);
    await assertNotLocked(ctx.organizationId, parsed.date, ctx);
    const reference = parsed.memo?.trim() || null;
    const { entry, description, rateExact } = await post(tx, ctx, from, to, amount, parsed.date, base, reference);
    // balance is an imported statement snapshot, not an opening-plus-movements
    // accumulator. Retain it and existing running balances; synthetic legs have
    // no provider running balance. Their amounts contribute to statement/GL sums.
    const transferGroupId = randomUUID(), outId = randomUUID(), inId = randomUUID();
    await tx.insert(bankTransaction).values([
      { id: outId, bankAccountId: from.id, date: parsed.date, description, reference, amount: -amount, currencyCode: from.currencyCode,
        status: "reconciled", sourceType: "transfer", journalEntryId: entry.id, transferGroupId, transferTransactionId: inId },
      { id: inId, bankAccountId: to.id, date: parsed.date, description, reference, amount, currencyCode: from.currencyCode,
        status: "reconciled", sourceType: "transfer", journalEntryId: entry.id, transferGroupId, transferTransactionId: outId },
    ]);
    const result = { journalEntryId: entry.id }; stringifyWire(result);
    await audit(tx, ctx, "bank_transfer", entry.id, "create", { ...result, fromBankAccountId: from.id, toBankAccountId: to.id,
      amount, amountMinor: String(amount), currencyCode: from.currencyCode, baseCurrencyCode: base, rateExact, transferGroupId,
      fromTransactionId: outId, toTransactionId: inId }, request);
    return result;
  });
}
export async function matchBankTransfer(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); bankReadId.parse(id);
  const parsed = bankMatchTransferSchema.parse(input);
  return db.transaction(async tx => {
    const base = await lockOrg(tx, ctx);
    const [parent] = await tx.select({ id: bankAccount.id }).from(bankTransaction).innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
      .where(and(eq(bankTransaction.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)));
    if (!parent) throw new AuthError("Bank transaction not found", 404);
    const source = await loadBank(tx, ctx, parent.id), target = await loadBank(tx, ctx, parsed.targetBankAccountId);
    pairBanks(source, target);
    const row = await loadMovement(tx, ctx, id, source);
    const counter = parsed.counterTransactionId ? await loadMovement(tx, ctx, parsed.counterTransactionId, target) : null;
    if (counter && BigInt(counter.amount) !== -BigInt(row.amount)) fail("Counter transaction must have opposite sign and equal amount");
    const amount = legacyMinor(row.amount < 0 ? -BigInt(row.amount) : BigInt(row.amount));
    const from = row.amount < 0 ? source : target, to = row.amount < 0 ? target : source;
    const reference = row.reference || row.description;
    const { entry, description, rateExact } = await post(tx, ctx, from, to, amount, row.date, base, reference);
    const transferGroupId = randomUUID(), counterId = counter?.id ?? randomUUID();
    if (!counter) await tx.insert(bankTransaction).values({ id: counterId, bankAccountId: target.id, date: row.date, description, reference,
      amount: legacyMinor(-BigInt(row.amount)), currencyCode: source.currencyCode, status: "reconciled", sourceType: "transfer",
      journalEntryId: entry.id, transferTransactionId: id, transferGroupId });
    await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: entry.id, transferTransactionId: counterId, transferGroupId }).where(eq(bankTransaction.id, id));
    if (counter) await tx.update(bankTransaction).set({ status: "reconciled", journalEntryId: entry.id, transferTransactionId: id, transferGroupId }).where(eq(bankTransaction.id, counter.id));
    const result = { journalEntryId: entry.id, counterTransactionId: counterId, mirrorCreated: !counter }; stringifyWire(result);
    await audit(tx, ctx, "bank_transaction", id, "matched_transfer", { ...result, targetBankAccountId: target.id, amount: row.amount,
      amountMinor: String(row.amount), currencyCode: source.currencyCode, baseCurrencyCode: base, rateExact, transferGroupId }, request);
    return result;
  });
}
