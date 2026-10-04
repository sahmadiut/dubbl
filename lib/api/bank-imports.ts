import { createHash } from "crypto";
import { z } from "zod";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccount, bankTransaction, bankStatementImport, bankImportProfile, bankRule, chartAccount, contact, taxRate, journalEntry, bankReconciliation, organization, auditLog, bulkImportJob } from "@/lib/db/schema";
import { parseBankStatement, makeTransactionDedupeHash, type NormalizedTransaction, type ParsedStatement } from "@/lib/banking/importer";
import { money, toMajorDecimal } from "@/lib/money/exact";
import { parseDate } from "@/lib/import-export/transformers";
import { exactMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { bankAccountDto, bankAccountIdField } from "./bank-account-wire";
import { bankReadImportDto, checkPlainReferences } from "./bank-transaction-reads";
import { sameBankReadCurrency } from "./bank-transaction-read-wire";
import { applyBankRulesToTransaction, type ActiveBankRule } from "./bank-rules";
import { statementSchema, profileSchema, bulkSchema, importAmount, importMajor, importExactMajor, importMoneyDto, invalidImport } from "./bank-import-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Bank = typeof bankAccount.$inferSelect;
const scope = (ctx: AuthContext, id: string) => and(eq(bankAccount.id, id), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt));
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
async function load(tx: Tx, ctx: AuthContext, id: string, lock = false) {
  bankAccountIdField.parse(id);
  const query = tx.select().from(bankAccount).where(scope(ctx, id));
  const [bank] = await (lock ? query.for("update") : query);
  if (!bank) throw new AuthError("Bank account not found", 404);
  bankAccountDto(bank);
  if (bank.chartAccountId) {
    const [gl] = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.id, bank.chartAccountId), eq(chartAccount.organizationId, ctx.organizationId)));
    if (!gl) throw new WireCompatibilityError("Bank account refers to a foreign GL account");
  }
  return bank;
}
async function profile(tx: Tx, id: string) {
  const [row] = await tx.select().from(bankImportProfile).where(eq(bankImportProfile.bankAccountId, id)).orderBy(desc(bankImportProfile.updatedAt), bankImportProfile.id).limit(1);
  if (!row) return undefined;
  const { id: rowId, bankAccountId: bankId, createdAt, updatedAt, ...fields } = row; void rowId; void bankId; void createdAt; void updatedAt;
  return profileSchema.parse(fields);
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: unknown) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "bank_statement_import", entityId: id, action, changes: JSON.parse(stringifyWire(changes)) });
}
function preview(parsed: ParsedStatement, bank: Bank, seen: Set<string>) {
  const duplicates = [];
  for (const row of parsed.transactions) {
    const hash = makeTransactionDedupeHash(bank.id, row);
    if (seen.has(hash)) duplicates.push(importMoneyDto({ dedupeHash: hash, description: row.description, amount: row.amount, date: row.date }, ["amount"]));
    seen.add(hash);
  }
  return { ...importMoneyDto(parsed, ["openingBalance", "closingBalance"]), accountIdentifier: parsed.accountIdentifier ?? null, currencyCode: bank.currencyCode,
    statementStartDate: parsed.statementStartDate ?? null, statementEndDate: parsed.statementEndDate ?? null,
    openingBalance: parsed.openingBalance ?? null, closingBalance: parsed.closingBalance ?? null, rowCount: parsed.transactions.length,
    transactions: parsed.transactions.slice(0, 100).map(row => importMoneyDto(row, ["amount", "balance"])), duplicates };
}
async function hashes(tx: Tx, id: string) {
  const rows = await tx.select({ hash: bankTransaction.dedupeHash }).from(bankTransaction).where(eq(bankTransaction.bankAccountId, id));
  return new Set(rows.map(row => row.hash).filter((hash): hash is string => hash !== null));
}
async function ruleRows(tx: Tx, ctx: AuthContext) {
  const rows = await tx.select().from(bankRule).where(and(eq(bankRule.organizationId, ctx.organizationId), eq(bankRule.isActive, true), isNull(bankRule.deletedAt))).orderBy(desc(bankRule.priority), bankRule.id);
  stringifyWire(rows);
  for (const rule of rows) for (const condition of rule.conditions) {
    if (!["gt", "lt", "between"].includes(condition.op)) continue;
    const values = condition.op === "between" ? condition.value.split(",") : [condition.value];
    if (values.length !== (condition.op === "between" ? 2 : 1)) invalidImport("Malformed bank rule amount threshold");
    for (const value of values) legacyMinor(BigInt(exactMinorSchema.parse(value.trim())));
  }
  return rows as ActiveBankRule[];
}
async function assignment(tx: Tx, ctx: AuthContext, rules: ActiveBankRule[], row: NormalizedTransaction) {
  const assigned = applyBankRulesToTransaction(rules, row);
  if (!assigned) return {};
  for (const [table, id] of [[chartAccount, assigned.accountId], [contact, assigned.contactId], [taxRate, assigned.taxRateId]] as const) {
    if (!id) continue;
    const [owned] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt)));
    if (!owned) throw new WireCompatibilityError("Import rule refers to a missing or foreign organization resource");
  }
  // Statement suggestions never claim reconciliation without a posted journal.
  return { accountId: assigned.accountId, contactId: assigned.contactId, taxRateId: assigned.taxRateId };
}
async function writeStatement(tx: Tx, ctx: AuthContext, bank: Bank, parsed: ParsedStatement, fileName: string, contentHash: string, sourceType: string, updateBalance: boolean) {
  const seen = await hashes(tx, bank.id), result = preview(parsed, bank, new Set(seen));
  const fresh = parsed.transactions.filter(row => { const hash = makeTransactionDedupeHash(bank.id, row); if (seen.has(hash)) return false; seen.add(hash); return true; });
  const rules = await ruleRows(tx, ctx);
  const sum = fresh.reduce((sum, row) => sum + BigInt(row.amount), 0n);
  const hasOpening = parsed.openingBalance != null;
  let running = !updateBalance ? 0n : hasOpening ? BigInt(parsed.openingBalance!) : BigInt(bank.balance) - sum;
  // Validate every intermediate balance and all rows/references before any insert.
  legacyMinor(running);
  const rows = [];
  const visited = new Set<string>(), freshHashes = new Set(fresh.map(row => makeTransactionDedupeHash(bank.id, row)));
  for (const row of parsed.transactions) {
    const hash = makeTransactionDedupeHash(bank.id, row);
    if (visited.has(hash)) continue; visited.add(hash);
    const isFresh = freshHashes.has(hash);
    if (updateBalance && (isFresh || hasOpening)) running = row.balance == null ? running + BigInt(row.amount) : BigInt(row.balance);
    if (!isFresh) { legacyMinor(running); continue; }
    await assertNotLocked(ctx.organizationId, row.date, ctx);
    const balance = legacyMinor(running);
    rows.push({ ...await assignment(tx, ctx, rules, row), bankAccountId: bank.id, date: row.date, postedDate: row.postedDate || null, description: row.description,
      reference: row.reference || null, amount: row.amount, balance: updateBalance ? balance : row.balance ?? null, status: "unreconciled" as const,
      sourceType, externalTransactionId: row.externalTransactionId || null, statementLineRef: row.statementLineRef || null,
      payee: row.payee || null, counterparty: row.counterparty || null, currencyCode: bank.currencyCode, pending: row.pending ?? false,
      rawPayload: row.raw, dedupeHash: makeTransactionDedupeHash(bank.id, row) });
  }
  const finalBalance = fresh.length ? parsed.closingBalance ?? legacyMinor(running) : bank.balance;
  const [history] = await tx.insert(bankStatementImport).values({ organizationId: ctx.organizationId, bankAccountId: bank.id, format: parsed.format, fileName, contentHash,
    accountIdentifier: parsed.accountIdentifier ?? null, statementCurrency: bank.currencyCode, statementStartDate: parsed.statementStartDate ?? null,
    statementEndDate: parsed.statementEndDate ?? null, openingBalance: parsed.openingBalance ?? null, closingBalance: parsed.closingBalance ?? null,
    warnings: parsed.warnings, metadata: parsed.metadata, importedCount: rows.length, duplicateCount: result.duplicates.length,
    status: rows.length === 0 && result.duplicates.length ? "partial" : "completed" }).returning();
  for (let index = 0; index < rows.length; index += 500) await tx.insert(bankTransaction).values(rows.slice(index, index + 500).map(row => ({ ...row, importId: history.id })));
  if (updateBalance && fresh.length) await tx.update(bankAccount).set({ balance: finalBalance }).where(scope(ctx, bank.id));
  const response = { ...result, imported: rows.length, duplicateCount: result.duplicates.length, importId: history.id };
  stringifyWire(response); await audit(tx, ctx, history.id, "import", { count: rows.length, duplicates: result.duplicates.length, bankAccountId: bank.id, format: parsed.format });
  return response;
}
export async function previewBankImport(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "manage:banking"); const body = statementSchema.parse(input);
  return db.transaction(async tx => {
    const bank = await load(tx, ctx, id), settings = await profile(tx, id);
    const parsed = parseBankStatement({ ...body, content: body.content || body.csv! }, bank.currencyCode, settings);
    return { preview: preview(parsed, bank, await hashes(tx, id)) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function commitBankImport(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "manage:banking"); const body = statementSchema.parse(input);
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); const bank = await load(tx, ctx, id, true), settings = await profile(tx, id);
    const parsed = parseBankStatement({ ...body, content: body.content || body.csv! }, bank.currencyCode, settings);
    return { import: await writeStatement(tx, ctx, bank, parsed, body.fileName || `statement.${parsed.format}`, createHash("sha256").update(body.content || body.csv!).digest("hex"), "statement_import", true) };
  });
}
export async function getBankImport(ctx: AuthContext, id: string) {
  bankAccountIdField.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(bankStatementImport).where(and(eq(bankStatementImport.id, id), eq(bankStatementImport.organizationId, ctx.organizationId)));
    if (!row) throw new AuthError("Bank import not found", 404);
    const bank = await load(tx, ctx, row.bankAccountId);
    const rows = await tx.select().from(bankTransaction).where(eq(bankTransaction.importId, id)).orderBy(desc(bankTransaction.date), bankTransaction.id).limit(100);
    if (rows.some(row => row.bankAccountId !== bank.id)) throw new WireCompatibilityError("Import contains foreign bank transactions");
    for (const row of rows) {
      await checkPlainReferences(tx, ctx, row);
      for (const [table, id] of [[chartAccount, row.accountId], [contact, row.contactId], [taxRate, row.taxRateId], [journalEntry, row.journalEntryId]] as const) {
        if (!id) continue;
        const [owned] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, ctx.organizationId)));
        if (!owned) throw new WireCompatibilityError("Import transaction contains foreign references");
      }
      if (row.reconciliationId) {
        const [owned] = await tx.select({ id: bankReconciliation.id }).from(bankReconciliation).where(and(eq(bankReconciliation.id, row.reconciliationId), eq(bankReconciliation.bankAccountId, bank.id)));
        if (!owned) throw new WireCompatibilityError("Import transaction contains foreign reconciliation");
      }
    }
    return { import: { ...bankReadImportDto(row, ctx, bank), bankAccount: bankAccountDto(bank), transactions: rows.map(row => ({ ...importMoneyDto(row, ["amount", "balance"]), currencyCode: sameBankReadCurrency(row.currencyCode, bank.currencyCode) })) } };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getBankImportProfile(ctx: AuthContext, id: string) {
  return db.transaction(async tx => { await load(tx, ctx, id); return { profile: await profile(tx, id) ?? null }; }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function saveBankImportProfile(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "manage:banking"); const fields = profileSchema.parse(input);
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); await load(tx, ctx, id, true);
    await tx.delete(bankImportProfile).where(eq(bankImportProfile.bankAccountId, id));
    await tx.insert(bankImportProfile).values({ ...fields, bankAccountId: id });
    await audit(tx, ctx, id, "save_profile", fields); return { profile: fields };
  });
}
export async function deleteBankImportProfile(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:banking");
  return db.transaction(async tx => { await lockOrg(tx, ctx); await load(tx, ctx, id, true); await tx.delete(bankImportProfile).where(eq(bankImportProfile.bankAccountId, id));
    await audit(tx, ctx, id, "delete_profile", {}); return { success: true }; });
}
async function bulkRows(tx: Tx, ctx: AuthContext, body: z.infer<typeof bulkSchema>) {
  const rows = [], bankCache = new Map<string, Bank[]>();
  for (const raw of body.rows) {
    const bankName = z.string().trim().min(1).parse(raw.bankAccountCode);
    let banks = bankCache.get(bankName.toLowerCase());
    if (!banks) { banks = await tx.select().from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt), sql`lower(${bankAccount.accountName}) = lower(${bankName})`)); bankCache.set(bankName.toLowerCase(), banks); }
    if (banks.length !== 1) throw new AuthError("Bank account name must identify exactly one live organization account", 400);
    const bank = banks[0]; bankAccountDto(bank);
    const rawDate = z.string().trim().parse(raw.date);
    if (!/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{4})$/.test(rawDate)) invalidImport("Unsupported bank import date format");
    const date = z.iso.date().parse(parseDate(rawDate, body.source));
    const description = z.string().min(1).parse(raw.description), reference = z.string().optional().parse(raw.reference);
    if (raw.currencyCode !== undefined && raw.currencyCode !== bank.currencyCode) invalidImport("Row currency disagrees with bank account");
    const value = z.union([z.string(), z.number()]).optional().parse(raw.amount);
    const exact = z.string().optional().parse(raw.amountExact), minor = z.string().optional().parse(raw.amountMinor);
    let amount: number;
    if (value !== undefined || exact !== undefined || minor !== undefined) {
      const exactAmount = exact === undefined ? undefined : importExactMajor(exact, bank.currencyCode);
      amount = importAmount(value, minor ?? (exactAmount === undefined ? undefined : String(exactAmount)), bank.currencyCode);
      if (exactAmount !== undefined && exactAmount !== amount) invalidImport("amountExact disagrees with amount");
    } else {
      if (raw.debit === undefined && raw.credit === undefined) invalidImport("Provide amount or split debit/credit");
      const side = (value: unknown) => value === undefined || value === "" ? 0 : Math.abs(importMajor(z.union([z.string(), z.number()]).parse(value), bank.currencyCode));
      amount = legacyMinor(BigInt(side(raw.credit)) - BigInt(side(raw.debit)));
    }
    const normalized: NormalizedTransaction = { date, description, reference: reference || null, amount, currencyCode: bank.currencyCode, raw: { row: raw } };
    const amountExact = toMajorDecimal(money(BigInt(amount), bank.currencyCode));
    let previewAmount = raw.amount;
    if (value === undefined && exact === undefined && minor === undefined) {
      previewAmount = Number(amountExact);
      if (importMajor(previewAmount as number, bank.currencyCode) !== amount) throw new WireCompatibilityError("Split amount cannot coexist with the legacy major-unit preview number");
    }
    const { debit, credit, ...rawFields } = raw; void debit; void credit;
    const previewData = { ...rawFields, date, ...(previewAmount === undefined ? {} : { amount: previewAmount }), amountExact, amountMinor: String(amount), currencyCode: bank.currencyCode };
    stringifyWire(normalized); rows.push({ bank, normalized, previewData });
  }
  return rows;
}
export async function previewBulkBankImport(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:banking"); const body = bulkSchema.parse(input);
  return db.transaction(async tx => {
    stringifyWire(body.rows);
    const preview = [];
    for (const [index, raw] of body.rows.entries()) {
      try { const [row] = await bulkRows(tx, ctx, { ...body, rows: [raw] });
        preview.push({ row: index + 1, data: row.previewData, valid: true, errors: [] });
      } catch (error) {
        preview.push({ row: index + 1, data: raw, valid: false, errors: [error instanceof Error ? error.message : "Invalid bank import row"] });
      }
    }
    return { preview, validCount: preview.filter(row => row.valid).length, totalCount: preview.length };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function commitBulkBankImport(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:banking"); const body = bulkSchema.parse(input);
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); const rows = await bulkRows(tx, ctx, body);
    const groups = new Map<string, { bank: Bank; transactions: NormalizedTransaction[] }>();
    for (const row of rows) { const group = groups.get(row.bank.id); if (group) group.transactions.push(row.normalized); else groups.set(row.bank.id, { bank: row.bank, transactions: [row.normalized] }); }
    let processedRows = 0, duplicates = 0;
    const hash = createHash("sha256").update(stringifyWire(body.rows)).digest("hex");
    for (const group of groups.values()) {
      const bank = await load(tx, ctx, group.bank.id, true);
      const result = await writeStatement(tx, ctx, bank, { format: "csv", currencyCode: bank.currencyCode, warnings: [], metadata: {}, transactions: group.transactions }, body.fileName, hash, "csv_import", false);
      processedRows += result.imported; duplicates += result.duplicateCount;
    }
    const [job] = await tx.insert(bulkImportJob).values({ organizationId: ctx.organizationId, type: "bank-transactions", fileName: body.fileName, totalRows: rows.length,
      processedRows, errorRows: 0, status: "completed", completedAt: new Date(), createdBy: ctx.userId }).returning();
    const response = { job, duplicates }; stringifyWire(response); return response;
  });
}
