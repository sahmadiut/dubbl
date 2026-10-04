import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
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
import {
  getNextEntryNumber,
  resolveBaseRate,
  toBaseLines,
  assertBaseRateAvailable,
} from "@/lib/api/journal-automation";
import { ensureBankLedgerAccount } from "@/lib/api/bank-ledger";
import { assertNotLocked } from "@/lib/api/period-lock";
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
  // match_transfer — reconcile a line as a transfer between own bank accounts.
  // -------------------------------------------------------------------------
  server.tool(
    "match_transfer",
    "Reconcile a bank transaction as a TRANSFER between two of the org's OWN bank accounts (a balance-sheet reclassification with no P&L impact). Posts ONE journal entry that debits the receiving bank's ledger account and credits the sending bank's ledger account (direction follows the sign of this line), marks BOTH legs reconciled, links them via transferTransactionId and a shared transferGroupId, and stamps the journalEntryId on both. Both bank accounts must be linked to a ledger account. Amounts in integer cents.",
    {
      transactionId: z.string().describe("UUID of the source bank transaction (the statement line being matched)"),
      targetBankAccountId: z
        .string()
        .describe("UUID of the OTHER own bank account this transfer moves money to/from (must differ from the source)"),
      counterTransactionId: z
        .string()
        .optional()
        .describe(
          "Optional UUID of the matched statement line in the target bank account. Must be the opposite sign and equal magnitude. Omit to auto-create a mirror reconciled transaction in the target account."
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:banking");

        const { transaction, account: sourceAccount } = await loadTransactionAndAccount(
          params.transactionId,
          ctx
        );
        if (transaction.status === "reconciled") throw new Error("Transaction already reconciled");

        if (params.targetBankAccountId === sourceAccount.id) {
          throw new Error("A transfer must be between two different bank accounts.");
        }

        const targetAccount = await loadBankAccount(params.targetBankAccountId, ctx);

        // Both banks must post to a ledger account; connect them automatically
        // (older accounts self-heal on first use) so transfers never dead-end.
        const sourceGlAccountId = await ensureBankLedgerAccount(ctx.organizationId, sourceAccount);
        const targetGlAccountId = await ensureBankLedgerAccount(ctx.organizationId, targetAccount);

        const abs = Math.abs(transaction.amount);
        if (abs === 0) throw new Error("Cannot transfer a zero-amount transaction.");

        // Resolve the optional counter line.
        let counter: typeof bankTransaction.$inferSelect | null = null;
        if (params.counterTransactionId) {
          const candidate = await db.query.bankTransaction.findFirst({
            where: eq(bankTransaction.id, params.counterTransactionId),
          });
          if (!candidate) throw new Error("Counter transaction not found");
          if (candidate.bankAccountId !== targetAccount.id) {
            throw new Error("The counter transaction must belong to the target bank account.");
          }
          if (candidate.id === transaction.id) {
            throw new Error("A transfer must be between two different transactions.");
          }
          if (candidate.status === "reconciled") {
            throw new Error("Counter transaction already reconciled");
          }
          if (
            Math.sign(candidate.amount) === Math.sign(transaction.amount) ||
            Math.abs(candidate.amount) !== abs
          ) {
            throw new Error(
              "The counter transaction must be the opposite sign and equal amount to this transaction."
            );
          }
          counter = candidate;
        }

        const moneyInToSource = transaction.amount > 0;
        const debitBankAccountId = moneyInToSource
          ? sourceGlAccountId
          : targetGlAccountId;
        const creditBankAccountId = moneyInToSource
          ? targetGlAccountId
          : sourceGlAccountId;

        const currencyCode = transaction.currencyCode || sourceAccount.currencyCode;
        await assertBaseRateAvailable(ctx.organizationId, currencyCode, transaction.date);

        const reference = transaction.reference || transaction.description;
        const description = `Transfer ${sourceAccount.accountName} → ${targetAccount.accountName}`;

        const { entry, mirrorId } = await db.transaction(async (tx) => {
          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);

          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: transaction.date,
              description,
              reference,
              status: "posted",
              sourceType: "bank_transfer",
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          const { currency, rate } = await resolveBaseRate(
            ctx.organizationId,
            currencyCode,
            transaction.date
          );

          const lines: (typeof journalLine.$inferInsert)[] = [
            {
              journalEntryId: entry.id,
              accountId: debitBankAccountId!,
              description,
              debitAmount: abs,
              creditAmount: 0,
            },
            {
              journalEntryId: entry.id,
              accountId: creditBankAccountId!,
              description,
              debitAmount: 0,
              creditAmount: abs,
            },
          ];
          await tx.insert(journalLine).values(toBaseLines(lines, currency, rate));

          const transferGroupId = randomUUID();

          let counterId: string;
          if (counter) {
            counterId = counter.id;
          } else {
            const [mirror] = await tx
              .insert(bankTransaction)
              .values({
                bankAccountId: targetAccount.id,
                date: transaction.date,
                description,
                reference,
                amount: -transaction.amount,
                currencyCode,
                status: "reconciled",
                sourceType: "transfer",
                journalEntryId: entry.id,
                transferTransactionId: transaction.id,
                transferGroupId,
              })
              .returning();
            counterId = mirror.id;
          }

          await tx
            .update(bankTransaction)
            .set({
              status: "reconciled",
              journalEntryId: entry.id,
              transferTransactionId: counterId,
              transferGroupId,
            })
            .where(eq(bankTransaction.id, transaction.id));

          if (counter) {
            await tx
              .update(bankTransaction)
              .set({
                status: "reconciled",
                journalEntryId: entry.id,
                transferTransactionId: transaction.id,
                transferGroupId,
              })
              .where(eq(bankTransaction.id, counter.id));
          }

          return { entry, mirrorId: counter ? null : counterId };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "matched_transfer",
          entityType: "bank_transaction",
          entityId: params.transactionId,
          changes: {
            targetBankAccountId: targetAccount.id,
            counterTransactionId: counter?.id ?? mirrorId,
            journalEntryId: entry?.id ?? null,
            amount: transaction.amount,
            mirrorCreated: !counter,
          },
        });

        return {
          transactionId: params.transactionId,
          journalEntryId: entry?.id ?? null,
          counterTransactionId: counter?.id ?? mirrorId,
          mirrorCreated: !counter,
        };
      })
  );

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

  // -------------------------------------------------------------------------
  // record_bank_transfer — move money between two of the org's OWN bank
  // accounts without an imported statement line to match against.
  // -------------------------------------------------------------------------
  server.tool(
    "record_bank_transfer",
    "Record a standalone TRANSFER of money between two of the org's OWN bank/cash accounts (no imported statement line required). A transfer has no P&L impact — it posts ONE balanced journal entry that DEBITS the receiving bank's ledger account and CREDITS the sending bank's ledger account (a pure balance-sheet reclassification). Both accounts must be in the SAME currency (cross-currency FX transfers are rejected). Records the two halves as paired, already-reconciled bank transactions (money out of the from-account, money in to the to-account) that share a transferGroupId and reference each other via transferTransactionId, so both accounts' running balances reflect the move. Amounts are in integer cents (e.g. $12.50 = 1250) in the accounts' shared currency.",
    {
      fromBankAccountId: z
        .string()
        .describe("UUID of the own bank/cash account the money leaves"),
      toBankAccountId: z
        .string()
        .describe("UUID of the own bank/cash account the money arrives in (must differ from the from-account)"),
      amount: z
        .number()
        .int()
        .positive()
        .describe("Amount to move, in integer cents (e.g. $12.50 = 1250), in the accounts' shared currency"),
      date: z.string().describe("Transfer date (YYYY-MM-DD)"),
      memo: z.string().nullable().optional().describe("Optional note for the transfer"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:banking");

        if (params.fromBankAccountId === params.toBankAccountId) {
          throw new Error("A transfer must be between two different accounts.");
        }

        await assertNotLocked(ctx.organizationId, params.date, ctx);

        // Both accounts must be the org's own, not deleted.
        const fromAccount = await loadBankAccount(params.fromBankAccountId, ctx);
        const toAccount = await loadBankAccount(params.toBankAccountId, ctx);

        // Cross-currency FX transfers are out of scope: both legs are booked at
        // the same amount, so mismatched currencies would post an unbalanced /
        // mis-scaled journal entry. Reject before any writes.
        if (fromAccount.currencyCode !== toAccount.currencyCode) {
          throw new Error("Transfers must be between accounts in the same currency.");
        }

        // Both banks must post to a ledger account; connect them automatically
        // (older accounts self-heal on first use) so a transfer never dead-ends.
        const fromGlAccountId = await ensureBankLedgerAccount(ctx.organizationId, fromAccount);
        const toGlAccountId = await ensureBankLedgerAccount(ctx.organizationId, toAccount);

        // MCP amounts are already integer cents in the accounts' shared currency.
        const currencyCode = fromAccount.currencyCode;
        const abs = params.amount;
        if (abs <= 0) {
          throw new Error("Transfer amount must be greater than zero.");
        }

        // Pre-flight the FX rate so a missing rate fails cleanly before writes.
        await assertBaseRateAvailable(ctx.organizationId, currencyCode, params.date);

        const memo = params.memo?.trim() || null;
        const description = `Transfer ${fromAccount.accountName} → ${toAccount.accountName}`;
        const reference = memo;

        const { entry } = await db.transaction(async (tx) => {
          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);

          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: params.date,
              description,
              reference,
              status: "posted",
              sourceType: "bank_transfer",
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          const { currency, rate } = await resolveBaseRate(
            ctx.organizationId,
            currencyCode,
            params.date
          );

          // DR the receiving bank, CR the sending bank (both asset accounts).
          const lines: (typeof journalLine.$inferInsert)[] = [
            {
              journalEntryId: entry.id,
              accountId: toGlAccountId!,
              description,
              debitAmount: abs,
              creditAmount: 0,
            },
            {
              journalEntryId: entry.id,
              accountId: fromGlAccountId!,
              description,
              debitAmount: 0,
              creditAmount: abs,
            },
          ];
          await tx.insert(journalLine).values(toBaseLines(lines, currency, rate));

          // Record both halves as paired, already-reconciled bank transactions
          // so each account's balance reflects the move.
          const transferGroupId = randomUUID();

          const [outLine] = await tx
            .insert(bankTransaction)
            .values({
              bankAccountId: fromAccount.id,
              date: params.date,
              description,
              reference,
              amount: -abs,
              currencyCode,
              status: "reconciled",
              sourceType: "transfer",
              journalEntryId: entry.id,
              transferGroupId,
            })
            .returning();

          const [inLine] = await tx
            .insert(bankTransaction)
            .values({
              bankAccountId: toAccount.id,
              date: params.date,
              description,
              reference,
              amount: abs,
              currencyCode,
              status: "reconciled",
              sourceType: "transfer",
              journalEntryId: entry.id,
              transferTransactionId: outLine.id,
              transferGroupId,
            })
            .returning();

          await tx
            .update(bankTransaction)
            .set({ transferTransactionId: inLine.id })
            .where(eq(bankTransaction.id, outLine.id));

          return { entry };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "create",
          entityType: "bank_transfer",
          entityId: entry.id,
          changes: {
            fromBankAccountId: fromAccount.id,
            toBankAccountId: toAccount.id,
            amount: abs,
            currencyCode,
            journalEntryId: entry.id,
          },
        });

        return { journalEntryId: entry.id };
      })
  );
}
