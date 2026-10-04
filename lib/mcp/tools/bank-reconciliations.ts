import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankReadId, bankReadListFields } from "@/lib/api/bank-transaction-read-wire";
import { reconciliationCreateFields, reconciliationCompleteFields, reconciliationAdjustmentFields, reconciliationMarkFields } from "@/lib/api/bank-reconciliation-wire";
import { listBankReconciliations, createBankReconciliation, getBankReconciliationProof, completeBankReconciliation, postBankReconciliationAdjustment,
  reconcileBankTransaction, unreconcileBankTransaction, excludeBankTransaction } from "@/lib/api/bank-reconciliations";

export function registerBankReconciliationTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_bank_reconciliations", {
    description: "List statement sessions of an owned live bank with transaction counts, currency and signed numeric startBalance/endBalance in integer bank currency minor units plus canonical *Minor strings. USD 1250 cents = $12.50. Returns reconciliations,total,page,limit. Safe range +/-9007199254740991. Read-only.",
    inputSchema: z.object({ bankAccountId: bankReadId, page: bankReadListFields.page, limit: bankReadListFields.limit }).strict(),
  }, input => wrapTool(ctx, () => listBankReconciliations(ctx, input)));
  server.registerTool("create_bank_reconciliation", {
    description: "Create an own active-bank statement session with open Gregorian dates, nonoverlapping inclusive window and signed opening/closing balances. Numeric balances are integer BANK currency minor units, USD cents; exact *Minor strings must agree, maximum absolute 9007199254740991. Returns reconciliation with numeric/exact balances and currency. Session and audit commit atomically. Repeats overlapping an existing session fail. Requires manage:banking.",
    inputSchema: z.object({ bankAccountId: bankReadId, ...reconciliationCreateFields }).strict(),
  }, ({ bankAccountId, ...input }) => wrapTool(ctx, () => createBankReconciliation(ctx, bankAccountId, input)));
  server.registerTool("reconciliation_report", {
    description: "Read-only owned-bank statement proof: returns session, reconciled/unreconciled counts, totals and transactions, signed statementEndBalance in BANK minor units, glBalance in ORGANIZATION BASE minor units and their difference only when currencies match. Named *Minor aliases preserve exact integers within +/-9007199254740991. Foreign currencies return difference=null, isBalanced=false and comparisonUnavailableReason=different_currency_units; never subtract unlike units. Includes currencyCode and glCurrencyCode. Optional session defaults to latest. Requires manage:banking.",
    inputSchema: z.object({ bankAccountId: bankReadId, reconciliationId: bankReadId.optional().describe("Optional own-bank statement UUID; omitted selects latest or whole bank") }).strict(),
  }, ({ bankAccountId, reconciliationId }) => wrapTool(ctx, () => getBankReconciliationProof(ctx, bankAccountId, reconciliationId)));
  server.registerTool("complete_bank_reconciliation", {
    description: "Atomically complete an in-progress own-bank statement and audit. Requires all nonexcluded window lines already accounted for, exact opening-plus-movement closing balance and matching GL closing balance; bank currency must equal organization base. Optional distinct IDs must cover every unattached window line. Returns reconciliationId,status,reconciledCount. No new posting. Open dates and manage:banking required; repeats fail.",
    inputSchema: z.object({ bankAccountId: bankReadId, ...reconciliationCompleteFields }).strict(),
  }, ({ bankAccountId, ...input }) => wrapTool(ctx, () => completeBankReconciliation(ctx, bankAccountId, input)));
  server.registerTool("post_bank_reconciliation_adjustment", {
    description: "Post a nonzero signed adjustment in integer BANK currency minor units (USD cents), using numeric amount and/or canonical amountMinor string agreeing exactly; max absolute 9007199254740991. Bank must be in base currency. Positive debits bank/credits revenue; negative credits bank/debits expense. Optional own in-progress session gets a synthetic linked movement. Returns journalEntryId,adjustmentAccountId,amount,amountMinor. Numbering, GL creation, posting, movement and audit commit atomically. Each call creates a new adjustment; no replay key. Requires manage:banking and open date.",
    inputSchema: z.object({ bankAccountId: bankReadId, ...reconciliationAdjustmentFields }).strict(),
  }, ({ bankAccountId, ...input }) => wrapTool(ctx, () => postBankReconciliationAdjustment(ctx, bankAccountId, input)));
  server.registerTool("reconcile_bank_transaction", {
    description: "Mark an unreconciled owned nonzero statement against an existing posted identity-FX base-currency journal with an exact matching bank leg. No new journal. Optional session must be own-bank/in-progress and contain the date. Domain-linked payments, transfers and expenses use dedicated matching tools. Returns transactionId,status,reconciliationId,journalEntryId. Requires manage:banking and open dates. Repeats fail.",
    inputSchema: z.object({ transactionId: bankReadId, ...reconciliationMarkFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => {
    const { transaction } = await reconcileBankTransaction(ctx, transactionId, input);
    return { transactionId, status: transaction.status, reconciliationId: transaction.reconciliationId, journalEntryId: transaction.journalEntryId };
  }));
  server.registerTool("unreconcile_bank_transaction", {
    description: "Atomically undo a qualified reconciled statement. Detaches pre-existing payments/journals preserving their accounting; bank-created cash payments restore allocations and soft-delete payment using saved-FX reversal, noncash carriers never unwind as cash. Bank-created category/expense/transfer postings get exact mirrored reversals preserving historical FX/dimensions. Transfers unwind both reciprocal owned legs and remove proven synthetic legs. Completed affected sessions reopen with audit. Bank-created expense also requires manage:expenses. Open saved dates and manage:banking required; ambiguous/unsafe history and repeats fail. Returns transactionId,status,paymentId,reversedAllocations,voidedJournalEntryId (historical compatibility name),reversalEntryId,unwoundTransferLegId,deletedTransferMirror,deletedTransaction. Saved provider balances unchanged.",
    inputSchema: z.object({ transactionId: bankReadId }).strict(),
  }, ({ transactionId }) => wrapTool(ctx, async () => {
    const { transaction, ...meta } = await unreconcileBankTransaction(ctx, transactionId);
    return { transactionId, status: transaction.status, ...meta };
  }));
  server.registerTool("exclude_bank_transaction", {
    description: "Toggle an unlinked owned statement between unreconciled/excluded. Linked payment, expense, session, journal or transfer history must be undone first. No posting; status and audit commit atomically. Returns transactionId,status. Numeric saved money must fit +/-9007199254740991 integer bank currency minor units. Requires manage:banking and open date. Toggle is intentionally not idempotent.",
    inputSchema: z.object({ transactionId: bankReadId }).strict(),
  }, ({ transactionId }) => wrapTool(ctx, async () => {
    const { transaction } = await excludeBankTransaction(ctx, transactionId); return { transactionId, status: transaction.status };
  }));
}
