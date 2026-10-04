import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bankTransaction,
  bankAccount,
  bankReconciliation,
  invoice,
  bill,
  payment,
  paymentAllocation,
  journalEntry,
  journalLine,
  auditLog,
} from "@/lib/db/schema";
import {
  eq,
  and,
  desc,
  asc,
  sql,
  isNull,
  gte,
  lte,
} from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Load a bank transaction and its owning bank account, org-scoped via the
 * bank account's organizationId. Throws "Bank transaction not found" if either
 * the transaction is missing or its bank account doesn't belong to this org.
 */
async function loadTransactionAndAccount(transactionId: string, ctx: AuthContext) {
  const transaction = await db.query.bankTransaction.findFirst({
    where: eq(bankTransaction.id, transactionId),
  });
  if (!transaction) throw new Error("Bank transaction not found");

  const account = await db.query.bankAccount.findFirst({
    where: and(
      eq(bankAccount.id, transaction.bankAccountId),
      eq(bankAccount.organizationId, ctx.organizationId),
      notDeleted(bankAccount.deletedAt)
    ),
  });
  if (!account) throw new Error("Bank transaction not found");

  return { transaction, account };
}

/** Load an org-scoped bank account or throw. */
async function loadBankAccount(bankAccountId: string, ctx: AuthContext) {
  const account = await db.query.bankAccount.findFirst({
    where: and(
      eq(bankAccount.id, bankAccountId),
      eq(bankAccount.organizationId, ctx.organizationId),
      notDeleted(bankAccount.deletedAt)
    ),
  });
  if (!account) throw new Error("Bank account not found");
  return account;
}

export function registerBankTransactionTools(server: McpServer, ctx: AuthContext) {
  // -------------------------------------------------------------------------
  // reconcile_bank_transaction — mark reconciled (link to a recon/JE).
  // -------------------------------------------------------------------------
  server.tool(
    "reconcile_bank_transaction",
    "Mark a single bank transaction as reconciled, optionally linking it to a reconciliation session and/or an existing journal entry. This does NOT post any new journal entry on its own — use categorize/match/split tools for lines that still need a posting. Use this to tick off a line that is already accounted for. The transaction must currently be unreconciled.",
    {
      transactionId: z.string().describe("UUID of the bank transaction to reconcile"),
      reconciliationId: z
        .string()
        .optional()
        .describe("Optional UUID of the reconciliation session to roll this line into"),
      journalEntryId: z
        .string()
        .optional()
        .describe("Optional UUID of an existing journal entry to link to this line"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:banking");

        const { transaction, account } = await loadTransactionAndAccount(params.transactionId, ctx);
        if (transaction.status === "reconciled") throw new Error("Transaction is already reconciled");

        // Validate that any supplied journalEntry / reconciliation belong to
        // THIS org before stamping them onto the bank line.
        if (params.journalEntryId) {
          const je = await db.query.journalEntry.findFirst({
            where: and(
              eq(journalEntry.id, params.journalEntryId),
              eq(journalEntry.organizationId, ctx.organizationId)
            ),
          });
          if (!je) throw new Error("Journal entry not found");
        }
        if (params.reconciliationId) {
          const rec = await db.query.bankReconciliation.findFirst({
            where: and(
              eq(bankReconciliation.id, params.reconciliationId),
              eq(bankReconciliation.bankAccountId, account.id)
            ),
          });
          if (!rec) throw new Error("Reconciliation not found");
        }

        const [updated] = await db
          .update(bankTransaction)
          .set({
            status: "reconciled",
            reconciliationId: params.reconciliationId || null,
            journalEntryId: params.journalEntryId || null,
          })
          .where(eq(bankTransaction.id, params.transactionId))
          .returning();

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "reconciled",
          entityType: "bank_transaction",
          entityId: params.transactionId,
          changes: {
            previousStatus: transaction.status,
            reconciliationId: params.reconciliationId || null,
          },
        });

        return {
          transactionId: params.transactionId,
          status: updated.status,
          reconciliationId: updated.reconciliationId,
          journalEntryId: updated.journalEntryId,
        };
      })
  );

  // -------------------------------------------------------------------------
  // unreconcile_bank_transaction — undo a reconcile, reversing side-effects.
  // -------------------------------------------------------------------------
  server.tool(
    "unreconcile_bank_transaction",
    "Undo the reconciliation of a bank transaction and roll back its side effects. If a payment was recorded for this line: its allocations are reversed (restoring each invoice/bill amount paid/due and status), the payment and its journal entry are voided/soft-deleted. If the line was categorized or split-to-account: that categorization journal entry is voided so the ledger no longer double-counts. If the line was matched as a transfer: the shared transfer journal entry is voided once and the paired (counter) leg is unwound too — an auto-created mirror line is deleted, a matched statement line is reset to unreconciled — so both legs come undone together. The transaction returns to 'unreconciled' with its reconciliationId, journalEntryId and transfer pairing cleared. The transaction must currently be reconciled.",
    {
      transactionId: z.string().describe("UUID of the reconciled bank transaction to unreconcile"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:banking");

        const { transaction } = await loadTransactionAndAccount(params.transactionId, ctx);
        if (transaction.status !== "reconciled") throw new Error("Transaction is not reconciled");

        const linkedPayment = await db.query.payment.findFirst({
          where: and(
            eq(payment.bankTransactionId, params.transactionId),
            isNull(payment.deletedAt)
          ),
          with: { allocations: true },
        });

        const { result } = await db.transaction(async (tx) => {
          let linkedPaymentId: string | null = null;
          let reversedAllocations = 0;
          let voidedJournalEntryId: string | null = null;
          let unwoundTransferLegId: string | null = null;
          let deletedTransferMirror = false;

          // Transfer-aware unwind: a transfer match posts ONE shared journal
          // entry referenced by BOTH legs and pairs them via
          // transferTransactionId. Unreconciling one leg must unwind the other
          // too (void the shared JE once, reset or delete the counter leg, and
          // clear the pairing fields) so no counter leg is left reconciled
          // pointing at a voided JE.
          if (transaction.transferTransactionId) {
            const counter = await tx.query.bankTransaction.findFirst({
              where: eq(bankTransaction.id, transaction.transferTransactionId),
            });

            if (transaction.journalEntryId) {
              await tx
                .update(journalEntry)
                .set({
                  status: "void",
                  voidedAt: new Date(),
                  voidReason: "Bank transfer unreconciled",
                  deletedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(journalEntry.id, transaction.journalEntryId),
                    eq(journalEntry.organizationId, ctx.organizationId)
                  )
                );
              voidedJournalEntryId = transaction.journalEntryId;
            }

            if (counter) {
              // Auto-created mirror (sourceType 'transfer', no statement
              // origin) is deleted; a matched statement line is reset.
              const isAutoMirror =
                counter.sourceType === "transfer" && counter.importId === null;
              if (isAutoMirror) {
                await tx
                  .delete(bankTransaction)
                  .where(eq(bankTransaction.id, counter.id));
                deletedTransferMirror = true;
              } else {
                await tx
                  .update(bankTransaction)
                  .set({
                    status: "unreconciled",
                    journalEntryId: null,
                    transferTransactionId: null,
                    transferGroupId: null,
                  })
                  .where(eq(bankTransaction.id, counter.id));
              }
              unwoundTransferLegId = counter.id;
            }
          }

          if (linkedPayment) {
            linkedPaymentId = linkedPayment.id;

            for (const allocation of linkedPayment.allocations) {
              if (allocation.documentType === "bill") {
                const existingBill = await tx.query.bill.findFirst({
                  where: eq(bill.id, allocation.documentId),
                });
                if (existingBill) {
                  const newAmountPaid = existingBill.amountPaid - allocation.amount;
                  const newAmountDue = existingBill.amountDue + allocation.amount;
                  const newStatus = newAmountPaid > 0 ? "partial" : "received";
                  await tx
                    .update(bill)
                    .set({
                      amountPaid: newAmountPaid,
                      amountDue: newAmountDue,
                      status: newStatus,
                      paidAt: null,
                      updatedAt: new Date(),
                    })
                    .where(eq(bill.id, allocation.documentId));
                }
              } else if (allocation.documentType === "invoice") {
                const existingInvoice = await tx.query.invoice.findFirst({
                  where: eq(invoice.id, allocation.documentId),
                });
                if (existingInvoice) {
                  const newAmountPaid = existingInvoice.amountPaid - allocation.amount;
                  const newAmountDue = existingInvoice.amountDue + allocation.amount;
                  const newStatus = newAmountPaid > 0 ? "partial" : "sent";
                  await tx
                    .update(invoice)
                    .set({
                      amountPaid: newAmountPaid,
                      amountDue: newAmountDue,
                      status: newStatus,
                      paidAt: null,
                      updatedAt: new Date(),
                    })
                    .where(eq(invoice.id, allocation.documentId));
                }
              }
              reversedAllocations++;
            }

            if (linkedPayment.allocations.length > 0) {
              await tx
                .delete(paymentAllocation)
                .where(eq(paymentAllocation.paymentId, linkedPayment.id));
            }

            if (linkedPayment.journalEntryId) {
              await tx
                .update(journalEntry)
                .set({ status: "void", deletedAt: new Date(), updatedAt: new Date() })
                .where(eq(journalEntry.id, linkedPayment.journalEntryId));
            }

            await tx
              .update(payment)
              .set({ deletedAt: new Date(), updatedAt: new Date() })
              .where(eq(payment.id, linkedPayment.id));
          } else if (transaction.journalEntryId && !transaction.transferTransactionId) {
            // Transfer JEs are already voided above; only void a plain
            // categorization/split JE here.
            await tx
              .update(journalEntry)
              .set({
                status: "void",
                voidedAt: new Date(),
                voidReason: "Bank transaction unreconciled",
                deletedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(journalEntry.id, transaction.journalEntryId),
                  eq(journalEntry.organizationId, ctx.organizationId)
                )
              );
            voidedJournalEntryId = transaction.journalEntryId;
          }

          const [updated] = await tx
            .update(bankTransaction)
            .set({
              status: "unreconciled",
              reconciliationId: null,
              journalEntryId: null,
              transferTransactionId: null,
              transferGroupId: null,
            })
            .where(eq(bankTransaction.id, params.transactionId))
            .returning();

          await tx.insert(auditLog).values({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "unreconciled",
            entityType: "bank_transaction",
            entityId: params.transactionId,
            changes: {
              previousStatus: "reconciled",
              paymentId: linkedPaymentId,
              reversedAllocations,
              voidedJournalEntryId,
              unwoundTransferLegId,
              deletedTransferMirror,
            },
          });

          return {
            result: {
              transactionId: params.transactionId,
              status: updated.status,
              paymentId: linkedPaymentId,
              reversedAllocations,
              voidedJournalEntryId,
              unwoundTransferLegId,
              deletedTransferMirror,
            },
          };
        });

        return result;
      })
  );

  // -------------------------------------------------------------------------
  // exclude_bank_transaction — toggle exclude/restore for a line.
  // -------------------------------------------------------------------------
  server.tool(
    "exclude_bank_transaction",
    "Toggle whether a bank transaction is EXCLUDED from reconciliation (e.g. a duplicate import or a personal line that should never hit the books). An unreconciled line becomes 'excluded'; an already-excluded line is restored to 'unreconciled'. A reconciled line cannot be excluded — unreconcile it first. No journal entries are posted. Returns the new status.",
    {
      transactionId: z.string().describe("UUID of the bank transaction to exclude/restore"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:banking");

        const { transaction } = await loadTransactionAndAccount(params.transactionId, ctx);
        if (transaction.status === "reconciled") {
          throw new Error("Cannot exclude a reconciled transaction");
        }

        const newStatus = transaction.status === "excluded" ? "unreconciled" : "excluded";

        const [updated] = await db
          .update(bankTransaction)
          .set({ status: newStatus })
          .where(eq(bankTransaction.id, params.transactionId))
          .returning();

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: newStatus === "excluded" ? "exclude" : "restore",
          entityType: "bank_transaction",
          entityId: params.transactionId,
          changes: { previousStatus: transaction.status },
        });

        return { transactionId: params.transactionId, status: updated.status };
      })
  );

  // -------------------------------------------------------------------------
  // reconciliation_report — reconciliation proof for a bank account.
  // -------------------------------------------------------------------------
  server.tool(
    "reconciliation_report",
    "Reconciliation proof for one bank account: returns the reconciled vs unreconciled statement lines for the period, the statement closing balance, the GL/ledger balance of the bank's chart-of-accounts account (sum of posted debits minus credits, bounded to the statement end date), and the difference between them (positive = statement shows more than the books). Scope to a specific reconciliation session via reconciliationId, otherwise the latest session (or the whole account) is used. Read-only. Amounts in integer cents.",
    {
      bankAccountId: z.string().describe("UUID of the bank account to prove"),
      reconciliationId: z
        .string()
        .optional()
        .describe("Optional UUID of a specific reconciliation session to scope to; defaults to the latest"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:banking");

        const account = await loadBankAccount(params.bankAccountId, ctx);

        // Scope to a specific reconciliation if given, else the latest one.
        let rec: typeof bankReconciliation.$inferSelect | undefined;
        if (params.reconciliationId) {
          rec = await db.query.bankReconciliation.findFirst({
            where: and(
              eq(bankReconciliation.id, params.reconciliationId),
              eq(bankReconciliation.bankAccountId, account.id)
            ),
          });
          if (!rec) throw new Error("Reconciliation not found");
        } else {
          rec = await db.query.bankReconciliation.findFirst({
            where: eq(bankReconciliation.bankAccountId, account.id),
            orderBy: desc(bankReconciliation.createdAt),
          });
        }

        const reconciledWhere = rec
          ? eq(bankTransaction.reconciliationId, rec.id)
          : sql`${bankTransaction.reconciliationId} IS NOT NULL`;
        const reconciled = await db.query.bankTransaction.findMany({
          where: and(eq(bankTransaction.bankAccountId, account.id), reconciledWhere),
          orderBy: asc(bankTransaction.date),
        });

        const unreconciledConds = [
          eq(bankTransaction.bankAccountId, account.id),
          isNull(bankTransaction.reconciliationId),
          sql`${bankTransaction.status} <> 'excluded'`,
        ];
        if (rec) {
          unreconciledConds.push(gte(bankTransaction.date, rec.startDate));
          unreconciledConds.push(lte(bankTransaction.date, rec.endDate));
        }
        const unreconciled = await db.query.bankTransaction.findMany({
          where: and(...unreconciledConds),
          orderBy: asc(bankTransaction.date),
        });

        const statementEndBalance = rec ? rec.endBalance : account.balance;

        // GL/ledger balance of the bank's chart account, bounded to the
        // statement end date when known.
        let glBalance: number | null = null;
        if (account.chartAccountId) {
          const conds = [
            eq(journalLine.accountId, account.chartAccountId),
            eq(journalEntry.organizationId, ctx.organizationId),
            eq(journalEntry.status, "posted"),
          ];
          if (rec?.endDate) conds.push(lte(journalEntry.date, rec.endDate));
          const [row] = await db
            .select({
              balance: sql<number>`coalesce(sum(${journalLine.debitAmount} - ${journalLine.creditAmount}), 0)::int`,
            })
            .from(journalLine)
            .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
            .where(and(...conds));
          glBalance = row?.balance || 0;
        }

        const difference = glBalance === null ? null : statementEndBalance - glBalance;
        const sumAmount = (rows: typeof reconciled) => rows.reduce((s, r) => s + r.amount, 0);

        return {
          bankAccountId: account.id,
          reconciliation: rec ?? null,
          statementEndBalance,
          glBalance,
          difference,
          isBalanced: difference === 0,
          hasLedgerAccount: account.chartAccountId !== null,
          reconciled: {
            count: reconciled.length,
            total: sumAmount(reconciled),
            transactions: reconciled,
          },
          unreconciled: {
            count: unreconciled.length,
            total: sumAmount(unreconciled),
            transactions: unreconciled,
          },
        };
      })
  );

}
