import { db } from "@/lib/db";
import { bankAccount, bankTransaction, journalEntry, journalLine, organization, payment } from "@/lib/db/schema";
import { eq, and, sql, isNull, asc } from "drizzle-orm";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { ruleAutoSchema } from "./bank-rule-wire";
import { bankAccountDto } from "./bank-account-wire";
import { sameBankReadCurrency, bankReadCurrency } from "./bank-transaction-read-wire";
import { legacyMinor } from "@/lib/money/wire";
import { findMatches, type MatchCandidate } from "@/lib/banking/reconciliation-matcher";
import { reconcileBankTransaction } from "./bank-reconciliations";
import { matchBankDocument } from "./bank-document-matches";

/** Link qualified existing cash only. All selection, validation, links and audits
 * share the organization lock used by manual matching and settlement writers. */
export async function autoReconcileBankTransactions(ctx: AuthContext, input: unknown = {}, request?: Request) {
  requireRole(ctx, "manage:banking"); const options = ruleAutoSchema.parse(input);
  return db.transaction(async tx => {
    const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
    if (!org) throw new AuthError("Organization not found", 404);
    const base = bankReadCurrency(org.defaultCurrency);
    const banks = await tx.select().from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt), eq(bankAccount.isActive, true),
      options.bankAccountId ? eq(bankAccount.id, options.bankAccountId) : undefined)).orderBy(bankAccount.id);
    if (options.bankAccountId && !banks.length) throw new AuthError("Bank account not found or inactive", 404);
    let checked = 0, reconciled = 0, skipped = 0;
    const used = new Set<string>();
    for (const bank of banks) {
      bankAccountDto(bank);
      const rows = await tx.select().from(bankTransaction).where(and(eq(bankTransaction.bankAccountId, bank.id), eq(bankTransaction.status, "unreconciled"),
        isNull(bankTransaction.journalEntryId), isNull(bankTransaction.reconciliationId), isNull(bankTransaction.transferGroupId), isNull(bankTransaction.transferTransactionId)))
        .orderBy(bankTransaction.date, bankTransaction.id).limit(500 - checked);
      if (!rows.length) continue;
      if (!bank.chartAccountId) { checked += rows.length; skipped += rows.length; continue; }
      const entries = await tx.select({ id: journalEntry.id, date: journalEntry.date, description: journalEntry.description, reference: journalEntry.reference,
        sourceType: journalEntry.sourceType, sourceId: journalEntry.sourceId, delta: sql<string>`sum(${journalLine.debitAmount} - ${journalLine.creditAmount})::text` })
        .from(journalEntry).innerJoin(journalLine, eq(journalLine.journalEntryId, journalEntry.id))
        .where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt), isNull(journalEntry.reversedByEntryId),
          eq(journalLine.accountId, bank.chartAccountId), sql`not exists (select 1 from bank_transaction bt where bt.journal_entry_id = ${journalEntry.id})`))
        .groupBy(journalEntry.id).orderBy(asc(journalEntry.date), asc(journalEntry.id)).limit(500);
      const candidates: (MatchCandidate & { paymentId?: string })[] = [];
      for (const entry of entries) {
        const delta = legacyMinor(BigInt(entry.delta));
        if (!delta || used.has(entry.id)) continue;
        if (entry.sourceType === "payment") {
          const [cash] = await tx.select().from(payment).where(and(eq(payment.id, entry.sourceId!), eq(payment.journalEntryId, entry.id), eq(payment.organizationId, ctx.organizationId),
            eq(payment.bankAccountId, bank.id), eq(payment.currencyCode, bank.currencyCode), isNull(payment.deletedAt), isNull(payment.bankTransactionId)));
          if (!cash) continue;
          candidates.push({ type: "journal_entry", ...entry, description: entry.description ?? "", amount: cash.type === "received" ? cash.amount : -cash.amount, paymentId: cash.id });
        } else if ([null, "manual"].includes(entry.sourceType) && bank.currencyCode === base) {
          candidates.push({ type: "journal_entry", ...entry, description: entry.description ?? "", amount: delta });
        }
      }
      for (const row of rows) {
        checked++; sameBankReadCurrency(row.currencyCode, bank.currencyCode);
        if (!row.amount || row.pending || row.sourceType === "transfer") { skipped++; continue; }
        // Fuzzy text/date may rank matches; amount and signed bank identity must be exact.
        const eligible = candidates.filter(c => c.amount === row.amount && !used.has(c.id));
        const matches = findMatches(row, [], [], eligible);
        if (!matches.length || matches[0].confidence < options.confidenceThreshold || matches[1]?.confidence === matches[0].confidence) { skipped++; continue; }
        const best = eligible.find(c => c.id === matches[0].candidate.id)!;
        if (best.paymentId) await matchBankDocument(ctx, row.id, { paymentId: best.paymentId }, request, tx);
        else await reconcileBankTransaction(ctx, row.id, { journalEntryId: best.id }, request, tx);
        used.add(best.id); reconciled++;
      }
      if (checked >= 500) break;
    }
    return { checked, reconciled, skipped };
  });
}
