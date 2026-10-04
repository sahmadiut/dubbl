import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bankAccount, bankRule, bankTransaction, chartAccount, contact, taxRate, organization, auditLog, payment, expenseClaim } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { ruleFields, ruleCreateSchema, ruleUpdateSchema, normalizeRule, ruleDto, ruleApplySchema, resolveSplitAmounts } from "./bank-rule-wire";
import { applyBankRulesToTransaction, type ActiveBankRule, type RuleEvaluable } from "@/lib/banking/rule-engine";
import { categorizeBankTransaction, splitBankAccounts } from "./bank-categorization";
import { bankReadId, sameBankReadCurrency, bankReadCount } from "./bank-transaction-read-wire";
import { bankAccountDto } from "./bank-account-wire";
import { checkPlainReferences } from "./bank-transaction-reads";
import { contactDto } from "./contact-wire";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
export { applyBankRulesToTransaction } from "@/lib/banking/rule-engine";
export type { ActiveBankRule, RuleEvaluable } from "@/lib/banking/rule-engine";
export { resolveSplitAmounts } from "./bank-rule-wire";
export type { RuleCondition, RuleSplitAllocation } from "./bank-rule-wire";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext, id?: string) => and(eq(bankRule.organizationId, ctx.organizationId), isNull(bankRule.deletedAt), id ? eq(bankRule.id, id) : undefined);
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
export async function validateRuleReferences(tx: Tx | typeof db, organizationId: string, input: Pick<ActiveBankRule, "accountId" | "contactId" | "taxRateId" | "splitAllocations">, saved = false) {
  const refs = [[chartAccount, input.accountId], [contact, input.contactId], [taxRate, input.taxRateId],
    ...(input.splitAllocations ?? []).flatMap(a => [[chartAccount, a.accountId], [taxRate, a.taxRateId]] as const)] as const;
  for (const [table, id] of refs) {
    if (!id) continue;
    const [row] = await tx.select().from(table).where(and(eq(table.id, id), eq(table.organizationId, organizationId), isNull(table.deletedAt)));
    if (!row || ("isActive" in row && !row.isActive)) {
      if (saved) throw new WireCompatibilityError("Saved bank rule has unavailable or foreign references");
      throw new AuthError("Bank rule reference must be live, active and organization-owned", 404);
    }
  }
}
async function audit(tx: Tx, ctx: AuthContext, entityType: string, entityId: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType, entityId, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
async function dto(tx: Tx, ctx: AuthContext, row: typeof bankRule.$inferSelect) {
  const result = ruleDto(row); await validateRuleReferences(tx, ctx.organizationId, result as ActiveBankRule, true); return result;
}
export const ruleListFields = {
  isActive: z.boolean().optional().describe("Optional active status filter"),
  page: z.number().int().min(1).max(2147483647).default(1).describe("Positive page number; offset must fit int32"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size 1..100"),
};
export const ruleListSchema = z.object(ruleListFields).strict();
export async function listBankRules(ctx: AuthContext, input: unknown, relations = false) {
  const args = ruleListSchema.parse(input), offset = (args.page - 1) * args.limit;
  if (offset > 2147483647) throw new AuthError("Pagination offset exceeds int32", 400);
  return db.transaction(async tx => {
    const where = and(scope(ctx), args.isActive === undefined ? undefined : eq(bankRule.isActive, args.isActive));
    const rows = await tx.select().from(bankRule).where(where).orderBy(desc(bankRule.priority), bankRule.id).limit(args.limit).offset(offset);
    const [count] = await tx.select({ n: sql<string>`count(*)::text` }).from(bankRule).where(where);
    const rules = []; for (const row of rows) {
      const result = await dto(tx, ctx, row);
      if (!relations) rules.push(result);
      else {
        const account = row.accountId ? await tx.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, row.accountId), eq(chartAccount.organizationId, ctx.organizationId)) }) : null;
        const party = row.contactId ? await tx.query.contact.findFirst({ where: and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId)) }) : null;
        const tax = row.taxRateId ? await tx.query.taxRate.findFirst({ where: and(eq(taxRate.id, row.taxRateId), eq(taxRate.organizationId, ctx.organizationId)) }) : null;
        rules.push({ ...result, account: account ?? null, contact: party ? contactDto(party) : null, taxRate: tax ?? null });
      }
    }
    return { rules, total: bankReadCount(count.n), page: args.page, limit: args.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getBankRule(ctx: AuthContext, id: string) {
  bankReadId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(bankRule).where(scope(ctx, id));
    if (!row) throw new AuthError("Bank rule not found", 404);
    return dto(tx, ctx, row);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createBankRule(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bank-rules"); const fields = normalizeRule(ruleCreateSchema.parse(input));
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); await validateRuleReferences(tx, ctx.organizationId, fields);
    const [row] = await tx.insert(bankRule).values({ ...fields, organizationId: ctx.organizationId }).returning();
    const result = ruleDto(row); await audit(tx, ctx, "bank_rule", row.id, "create", result, request); return result;
  });
}
export async function updateBankRule(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bank-rules"); bankReadId.parse(id); const patch = ruleUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); const [existing] = await tx.select().from(bankRule).where(scope(ctx, id)).for("update");
    if (!existing) throw new AuthError("Bank rule not found", 404);
    const keys = Object.keys(ruleFields), config = Object.fromEntries(Object.entries(existing).filter(([key]) => keys.includes(key)));
    const merged = { ...config, ...Object.fromEntries(Object.entries(patch).filter(([,v]) => v !== undefined)) };
    if (Array.isArray(merged.conditions) && merged.conditions.length && merged.matchValue === "") delete merged.matchValue;
    const fields = normalizeRule(merged); await validateRuleReferences(tx, ctx.organizationId, fields);
    const [row] = await tx.update(bankRule).set(fields).where(scope(ctx, id)).returning();
    const result = ruleDto(row); await audit(tx, ctx, "bank_rule", id, "update", { before: ruleDto(existing), after: result }, request); return result;
  });
}
export async function deleteBankRule(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:bank-rules"); bankReadId.parse(id);
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); const [existing] = await tx.select().from(bankRule).where(scope(ctx, id)).for("update");
    if (!existing) throw new AuthError("Bank rule not found", 404);
    const [row] = await tx.update(bankRule).set({ deletedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = ruleDto(row);
    await audit(tx, ctx, "bank_rule", id, "delete", { id }, request); return result;
  });
}
export async function loadActiveBankRules(organizationId: string, tx: Tx | typeof db = db): Promise<ActiveBankRule[]> {
  const rows = await tx.select().from(bankRule).where(and(eq(bankRule.organizationId, organizationId), eq(bankRule.isActive, true), isNull(bankRule.deletedAt)))
    .orderBy(desc(bankRule.priority), bankRule.id);
  const rules = rows.map(row => ruleDto(row) as ActiveBankRule);
  for (const rule of rules) await validateRuleReferences(tx, organizationId, rule, true);
  return rules;
}
export async function matchBankRules(organizationId: string, transaction: RuleEvaluable) {
  const assignment = applyBankRulesToTransaction(await loadActiveBankRules(organizationId), transaction);
  return assignment ? { ...assignment, autoReconcile: assignment.reconcile } : null;
}
export const ruleSuggestionSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10).describe("Maximum suggestions 1..50"),
  style: z.enum(["patterns", "keywords"]).default("patterns").describe("patterns returns full descriptions/contact/count; keywords returns deduplicated longest words with category name/code/occurrences, minimum two matching lines"),
}).strict();
export async function getBankRuleSuggestions(ctx: AuthContext, input: unknown) {
  const { limit, style } = ruleSuggestionSchema.parse(input), keywords = style === "keywords";
  return db.transaction(async tx => {
    const rows = await tx.select({ description: bankTransaction.description, accountId: bankTransaction.accountId, contactId: keywords ? sql<null>`null` : bankTransaction.contactId,
      count: sql<string>`count(*)::text` }).from(bankTransaction).innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
      .where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt), isNotNull(bankTransaction.accountId)))
      .groupBy(bankTransaction.description, bankTransaction.accountId, ...(keywords ? [] : [bankTransaction.contactId]))
      .having(keywords ? sql`count(*) >= 2` : undefined).orderBy(sql`count(*) desc`, bankTransaction.description, bankTransaction.accountId).limit(limit);
    for (const row of rows) await validateRuleReferences(tx, ctx.organizationId, { ...row, taxRateId: null, splitAllocations: null }, true);
    if (!keywords) return { suggestions: rows.map(row => ({ matchField: "description", matchType: "contains", matchValue: row.description,
      accountId: row.accountId, contactId: row.contactId, transactionCount: bankReadCount(row.count) })) };
    const suggestions = [], seen = new Set<string>();
    for (const row of rows) {
      const matchValue = row.description.split(/\s+/).filter(w => w.length > 3).sort((a,b) => b.length - a.length)[0] || row.description;
      const key = `${matchValue.toLowerCase()}_${row.accountId}`; if (seen.has(key)) continue; seen.add(key);
      const [category] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, row.accountId!), eq(chartAccount.organizationId, ctx.organizationId)));
      suggestions.push({ matchValue, matchType: "contains", matchField: "description", accountId: row.accountId, accountName: category.name,
        accountCode: category.code, occurrences: bankReadCount(row.count), sampleDescription: row.description });
    }
    return { suggestions };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function applyBankRules(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:banking"); const args = ruleApplySchema.parse(input);
  return db.transaction(async tx => {
    if (!args.dryRun) await lockOrg(tx, ctx);
    const banks = await tx.select().from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt), eq(bankAccount.isActive, true),
      args.bankAccountId ? eq(bankAccount.id, args.bankAccountId) : undefined)).orderBy(bankAccount.id);
    if (args.bankAccountId && !banks.length) throw new AuthError("Bank account not found or inactive", 404);
    const rules = await loadActiveBankRules(ctx.organizationId, tx);
    let applied = 0, reconciled = 0, split = 0;
    const matches: { transactionId: string; ruleName: string; description: string }[] = [];
    for (const bank of banks) {
      bankAccountDto(bank);
      await validateRuleReferences(tx, ctx.organizationId, { accountId: bank.chartAccountId, contactId: null, taxRateId: null, splitAllocations: null }, true);
      const eligible = and(eq(bankTransaction.bankAccountId, bank.id), eq(bankTransaction.status, "unreconciled"), isNull(bankTransaction.accountId),
        isNull(bankTransaction.journalEntryId), isNull(bankTransaction.reconciliationId), isNull(bankTransaction.transferTransactionId), isNull(bankTransaction.transferGroupId));
      const rows = await tx.select().from(bankTransaction).where(eligible).orderBy(bankTransaction.id);
      for (const row of rows) {
        if (!Number.isSafeInteger(row.amount)) throw new WireCompatibilityError();
        sameBankReadCurrency(row.currencyCode, bank.currencyCode); rateDateSchema.parse(row.date);
        if (!row.amount || row.pending || row.sourceType === "transfer") continue;
        const assignment = applyBankRulesToTransaction(rules, row); if (!assignment) continue;
        await checkPlainReferences(tx, ctx, row);
        await validateRuleReferences(tx, ctx.organizationId, { accountId: row.accountId, contactId: row.contactId, taxRateId: row.taxRateId, splitAllocations: null }, true);
        const [hiddenPayment] = await tx.select({ id: payment.id }).from(payment).where(and(eq(payment.bankTransactionId, row.id), isNull(payment.deletedAt)));
        const [hiddenExpense] = await tx.select({ id: expenseClaim.id }).from(auditLog).innerJoin(expenseClaim, eq(expenseClaim.id, auditLog.entityId))
          .where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "expense"), isNull(expenseClaim.deletedAt), sql`${auditLog.changes}->>'bankTransactionId' = ${row.id}`));
        if (hiddenPayment || hiddenExpense) throw new AuthError("Resolve hidden payment or expense history first", 400);
        matches.push({ transactionId: row.id, ruleName: assignment.ruleName, description: row.description });
        if (args.dryRun) continue;
        await assertNotLocked(ctx.organizationId, row.date, ctx);
        if (assignment.splitAllocations) {
          const parts = resolveSplitAmounts(assignment.splitAllocations, row.amount);
          await splitBankAccounts(ctx, row.id, { allocations: parts.map(p => ({ accountId: p.allocation.accountId, amountMinor: String(Math.abs(p.amount)),
            taxRateId: p.allocation.taxRateId ?? undefined })) }, request, tx);
          await tx.update(bankTransaction).set({ contactId: assignment.contactId }).where(eq(bankTransaction.id, row.id)); split++; reconciled++;
        } else if (assignment.reconcile && assignment.accountId) {
          await categorizeBankTransaction(ctx, row.id, { accountId: assignment.accountId, contactId: assignment.contactId, taxRateId: assignment.taxRateId }, request, false, tx); reconciled++;
        } else {
          await tx.update(bankTransaction).set({ accountId: assignment.accountId, contactId: assignment.contactId, taxRateId: assignment.taxRateId }).where(and(eligible, eq(bankTransaction.id, row.id)));
        }
        await audit(tx, ctx, "bank_transaction", row.id, "rule_applied", { ruleName: assignment.ruleName, amount: row.amount, amountMinor: String(row.amount), currencyCode: bank.currencyCode }, request);
        applied++;
      }
    }
    return { applied, reconciled, split, matched: matches.length, updated: applied, dryRun: args.dryRun, matches: args.dryRun ? matches : undefined };
  }, args.dryRun ? { isolationLevel: "repeatable read", accessMode: "read only" } : undefined);
}
export async function applyBankRulesToAccount(ctx: AuthContext, bankAccountId: string, request?: Request) {
  const { applied, reconciled, split } = await applyBankRules(ctx, { bankAccountId }, request);
  return { applied, reconciled, split };
}
