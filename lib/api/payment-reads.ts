import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { payment, invoice, bill, creditNote, debitNote, customerCredit, journalEntry, bankTransaction, bankAccount } from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import { WireCompatibilityError } from "@/lib/money/wire";
import type { AuthContext } from "./auth-context";
import { paymentListSchema, paymentReadDto } from "./payment-read-wire";

type ReadTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Allocation = { documentType: string; documentId: string };

/** Allocations have no tenant column; verify every polymorphic document before exposing IDs. */
async function assertAllocationScope(tx: ReadTx, orgId: string, allocations: Allocation[]) {
  const sources = { invoice, bill, credit_note: creditNote, debit_note: debitNote, prepayment: customerCredit };
  const groups = new Map<keyof typeof sources, Set<string>>();
  for (const row of allocations) {
    if (!Object.hasOwn(sources, row.documentType)) throw new WireCompatibilityError("Payment contains an unsupported allocation document type");
    const type = row.documentType as keyof typeof sources;
    if (!groups.has(type)) groups.set(type, new Set());
    groups.get(type)!.add(row.documentId);
  }
  for (const [type, ids] of groups) {
    const table = sources[type];
    const found = await tx.select({ id: table.id }).from(table)
      .where(and(eq(table.organizationId, orgId), inArray(table.id, [...ids])));
    if (found.length !== ids.size) throw new WireCompatibilityError("Payment contains an allocation outside this organization or a missing document");
  }
}

/** Scalar journal/statement links also lack a tenant constraint at the database FK. */
async function assertPaymentLinks(tx: ReadTx, orgId: string,
  rows: { journalEntryId: string | null; bankTransactionId: string | null }[]) {
  const journalIds = [...new Set(rows.flatMap(row => row.journalEntryId ? [row.journalEntryId] : []))];
  const transactionIds = [...new Set(rows.flatMap(row => row.bankTransactionId ? [row.bankTransactionId] : []))];
  if (journalIds.length) {
    const found = await tx.select({ id: journalEntry.id }).from(journalEntry)
      .where(and(eq(journalEntry.organizationId, orgId), inArray(journalEntry.id, journalIds)));
    if (found.length !== journalIds.length) throw new WireCompatibilityError("Payment contains a journal reference outside this organization");
  }
  if (transactionIds.length) {
    const found = await tx.select({ id: bankTransaction.id }).from(bankTransaction)
      .innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
      .where(and(eq(bankAccount.organizationId, orgId), inArray(bankTransaction.id, transactionIds)));
    if (found.length !== transactionIds.length) throw new WireCompatibilityError("Payment contains a bank transaction reference outside this organization");
  }
}

export async function listPayments(ctx: AuthContext, input: unknown) {
  const parsed = paymentListSchema.parse(input);
  const conditions = [eq(payment.organizationId, ctx.organizationId), notDeleted(payment.deletedAt)];
  if (parsed.type) conditions.push(eq(payment.type, parsed.type));
  if (parsed.contactId) conditions.push(eq(payment.contactId, parsed.contactId));
  return db.transaction(async tx => {
    const rows = await tx.query.payment.findMany({ where: and(...conditions),
      orderBy: [desc(payment.createdAt), desc(payment.id)], limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit,
      with: { contact: true, bankAccount: true, allocations: true } });
    await assertAllocationScope(tx, ctx.organizationId, rows.flatMap(row => row.allocations));
    await assertPaymentLinks(tx, ctx.organizationId, rows);
    const [result] = await tx.select({ count: count() }).from(payment).where(and(...conditions));
    if (!Number.isSafeInteger(result.count)) throw new WireCompatibilityError("Payment count exceeds the supported range");
    const payments = rows.map(row => {
      const dto = paymentReadDto(row, ctx.organizationId);
      // The historical list envelope includes contact/allocations, but no bank expansion.
      const { bankAccount: _bank, ...listed } = dto;
      void _bank;
      return listed;
    });
    return { payments, total: result.count, page: parsed.page, limit: parsed.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function getPayment(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const found = await tx.query.payment.findFirst({ where: and(eq(payment.id, id),
      eq(payment.organizationId, ctx.organizationId), notDeleted(payment.deletedAt)),
      with: { contact: true, bankAccount: true, allocations: true } });
    if (!found) return null;
    await assertAllocationScope(tx, ctx.organizationId, found.allocations);
    await assertPaymentLinks(tx, ctx.organizationId, [found]);
    return { payment: paymentReadDto(found, ctx.organizationId) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
