import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankReadId } from "@/lib/api/bank-transaction-read-wire";
import { bankTransferMcpSchema, bankMatchTransferFields } from "@/lib/api/bank-transfer-wire";
import { recordBankTransfer, matchBankTransfer } from "@/lib/api/bank-transfers";

export function registerBankTransferTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("record_bank_transfer", {
    description: "Record a new transfer between two active own bank/cash accounts in the SAME currency. Numeric amount is positive integer currency minor units (USD 1250 cents = $12.50); amountMinor is a canonical integer string and amountExact a decimal major-unit string. Aliases must agree; safe maximum 9007199254740991 minor units. Atomically posts one balanced historical exact-FX journal, two opposite signed linked reconciled movements and audit. Returns journalEntryId. Each call creates a NEW transfer; no replay key. Saved statement balances remain unchanged. Requires manage:banking and open date.",
    inputSchema: bankTransferMcpSchema,
  }, input => wrapTool(ctx, () => recordBankTransfer(ctx, input, undefined, "mcp")));
  server.registerTool("match_transfer", {
    description: "Match an unlinked unreconciled nonzero statement to a transfer between active own banks in the SAME currency. Uses saved integer currency minor-unit amount (USD cents); counter must be equal and opposite. Omit counterTransactionId to create a mirror. Atomically posts one balanced exact-FX journal, pairs both reconciled legs and audit; both statement dates must be open. Returns transactionId, journalEntryId, counterTransactionId, mirrorCreated. Repeated/concurrent matches allow one successful posting. Saved statement balances remain unchanged. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankReadId.describe("Source organization-owned unlinked statement UUID"), ...bankMatchTransferFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => ({ transactionId, ...await matchBankTransfer(ctx, transactionId, input) })));
}
