import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankCodingId, bankCodingFields, bankSplitFields, bankExpenseMcpFields, bankBulkFields, bankCashFields } from "@/lib/api/bank-categorization-wire";
import { categorizeBankTransaction, splitBankAccounts, createBankExpense, bulkCategorizeBankTransactions, bulkBankCashCode } from "@/lib/api/bank-categorization";

export function registerBankCategorizationTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("categorize_bank_transaction", {
    description: "Code a signed bank movement to a ledger account with exact tax and saved FX; posts a balanced journal and returns transactionId/journalEntryId. Repeating a plain categorization corrects it atomically, voiding its old journal and retaining saved FX. Payments, transfers and statement matches require undo first. Bank-created expenses cannot be corrected here. Bank amounts remain integer currency minor units (USD cents); no amount override.",
    inputSchema: z.object({ transactionId: bankCodingId, ...bankCodingFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => ({ transactionId, ...await categorizeBankTransaction(ctx, transactionId, input) })));
  server.registerTool("split_bank_transaction", {
    description: "Code one unreconciled bank movement across ledger accounts; allocations in integer bank-currency minor units (USD cents) via amount and/or amountMinor must sum exactly to the bank magnitude. Posts one balanced tax-aware journal with saved FX and returns journalEntryId. Repeats fail; split_to_documents handles invoice/bill settlement separately.",
    inputSchema: z.object({ transactionId: bankCodingId, ...bankSplitFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => ({ transactionId, ...await splitBankAccounts(ctx, transactionId, input) })));
  server.registerTool("create_expense_from_bank_transaction", {
    description: "Record an outgoing unreconciled bank movement as an already-paid expense with one atomic journal. Numeric item amount is integer currency minor units (USD 1250 cents = $12.50); amountExact is decimal major string and amountMinor integer minor string. Total/currency must equal bank magnitude/currency. Returns expenseClaim (numeric totalAmount and exact totalAmountMinor) and journalEntryId. Repeats fail; ordinary expense approval/payment cannot repost this paid claim. Requires manage:expenses.",
    inputSchema: z.object({ transactionId: bankCodingId, ...bankExpenseMcpFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, () => createBankExpense(ctx, transactionId, input, undefined, "mcp")));
  server.registerTool("bulk_categorize_bank_transactions", {
    description: "Code 1..200 unreconciled bank transactions, each to its own account/dimensions. Bank amounts are integer currency minor units (USD cents); no override. Each item atomically posts journal/bank/audit; failures leave that item unchanged, others commit. Returns results with transactionId, success, journalEntryId or error, and summary total/succeeded/failed. Repeated lines fail without another posting.",
    inputSchema: z.object(bankBulkFields).strict(),
  }, input => wrapTool(ctx, () => bulkCategorizeBankTransactions(ctx, input)));
  server.registerTool("bulk_cash_code", {
    description: "Code 1..200 unreconciled bank transactions to the same account/dimensions, with per-item atomic posting and failure reporting. Bank amounts are integer currency minor units (USD cents). Returns accountId, requested/succeeded/failed and results with transactionId, ok, journalEntryId or error. Repeated lines fail without another posting.",
    inputSchema: z.object(bankCashFields).strict(),
  }, input => wrapTool(ctx, () => bulkBankCashCode(ctx, input)));
}
