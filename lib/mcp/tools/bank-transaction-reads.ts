import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankReadId, bankReadListFields } from "@/lib/api/bank-transaction-read-wire";
import { listBankTransactionReads, getBankTransactionActivity, getBankAccountSuggestions, listBankImportReads, listBankDuplicates } from "@/lib/api/bank-transaction-reads";
import { getBankMatchSuggestions } from "@/lib/api/bank-match-reads";

export function registerBankTransactionReadTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_bank_transactions", {
    description: "Read paginated bank transactions with signed integer currency minor units (USD cents), amountMinor/balanceMinor strings, import metadata and safe numeric aliases; supported money range +/-9007199254740991. Negative means money out. Returns transactions,total,page,limit.",
    inputSchema: z.object(bankReadListFields).strict(),
  }, params => wrapTool(ctx, () => listBankTransactionReads(ctx, params)));
  const transactionInput = z.object({ transactionId: bankReadId.describe("Live organization-owned bank transaction UUID") }).strict();
  const accountInput = z.object({ bankAccountId: bankReadId.describe("Live organization-owned bank account UUID") }).strict();
  server.registerTool("get_match_suggestions", {
    description: "Read same-currency open invoice/bill, existing payment, base-currency net journal and transfer candidates, ranked by confidence, plus accountSuggestions. Returns transaction,suggestedMatches,existingMatches,openInvoices,openBills,accountSuggestions. Money has safe signed integer minor-unit numeric and *Minor string aliases; +/-9007199254740991. Does not post or match.",
    inputSchema: transactionInput,
  }, params => wrapTool(ctx, () => getBankMatchSuggestions(ctx, params.transactionId)));
  server.registerTool("get_bank_transaction_activity", {
    description: "Read organization-scoped transaction activity with sanitized users and known minor-unit audit money *Minor aliases. Returns currencyCode,activity. Unsupported historic money fails; saved audit is unchanged.", inputSchema: transactionInput,
  }, params => wrapTool(ctx, () => getBankTransactionActivity(ctx, params.transactionId)));
  server.registerTool("get_bank_account_suggestions", {
    description: "Read up to five active organization-owned chart-account suggestions from similar historical bank descriptions. Returns suggestions with accountId/name/code, confidence percent, matchCount and recentDate. No monetary aggregate.", inputSchema: transactionInput,
  }, params => wrapTool(ctx, () => getBankAccountSuggestions(ctx, params.transactionId)));
  server.registerTool("list_bank_statement_imports", {
    description: "Read the latest twenty statement import records for a live owned bank. Returns imports, numeric nullable openingBalance/closingBalance and matching *Minor strings, currencyCode, metadata and numeric counts. Money is signed integer minor units, +/-9007199254740991; raw metadata units remain unchanged.", inputSchema: accountInput,
  }, params => wrapTool(ctx, () => listBankImportReads(ctx, params.bankAccountId)));
  server.registerTool("list_bank_transaction_duplicates", {
    description: "Read potential duplicates with identical date, signed amount and currency; considers at most 100 ordered pairs. Returns bankAccountId,duplicateGroups,totalGroups; each group has amount/amountMinor in currency minor units, +/-9007199254740991. Opposite signs are distinct. Does not delete transactions.", inputSchema: accountInput,
  }, params => wrapTool(ctx, () => listBankDuplicates(ctx, params.bankAccountId)));
}
