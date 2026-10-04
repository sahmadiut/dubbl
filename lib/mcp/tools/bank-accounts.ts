import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankAccountIdField, bankAccountCreateFields, bankAccountUpdateFields, bankBalanceAlertFields } from "@/lib/api/bank-account-wire";
import { listBankAccounts, getBankAccount, createBankAccount, updateBankAccount, deleteBankAccount, validateBankBalance, setBankBalanceAlert } from "@/lib/api/bank-accounts";

export function registerBankAccountTools(server: McpServer, ctx: AuthContext) {
  const units = "Signed balances and thresholds are integer currency minor units (USD cents) with matching *Minor strings, supported range +/-9007199254740991. No conversion or rescaling.";
  const id = { bankAccountId: bankAccountIdField };
  server.registerTool("list_bank_accounts", { description: `List live accounts in the authenticated organization with chartAccount relation. Returns {bankAccounts}. ${units}`,
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listBankAccounts(ctx)));
  server.registerTool("get_bank_account", { description: `Get a live organization account and its chartAccount relation. Returns {bankAccount}. ${units}`,
    inputSchema: z.object(id).strict() }, p => wrapTool(ctx, () => getBankAccount(ctx, p.bankAccountId)));
  server.registerTool("create_bank_account", { description: `Create an organization bank account with manage:banking; bank, unique active matching GL link and audit commit atomically. Returns {bankAccount}. balance defaults to zero and is a statement balance; opening GL is set separately with set_opening_balances. ${units}`,
    inputSchema: z.object(bankAccountCreateFields).strict() }, p => wrapTool(ctx, () => createBankAccount(ctx, p)));
  server.registerTool("update_bank_account", { description: `Update a live organization account with manage:banking. Currency changes require zero balances/threshold and no history; currency/type/GL changes reject statement/payment/opening GL history. balance edits only update statement balance, not GL. Returns {bankAccount}. ${units}`,
    inputSchema: z.object({ ...id, ...bankAccountUpdateFields }).strict() }, p => wrapTool(ctx, () => { const { bankAccountId, ...input } = p; return updateBankAccount(ctx, bankAccountId, input); }));
  server.registerTool("delete_bank_account", { description: "Soft-delete a live organization bank account with manage:banking and atomic audit. Retains statement, payment and GL history. Returns {success:true}; unsupported saved money/references reject.",
    inputSchema: z.object(id).strict() }, p => wrapTool(ctx, () => deleteBankAccount(ctx, p.bankAccountId)));
  server.registerTool("validate_bank_balance", { description: `Read-only statement balance diagnostics for a live organization account: accountBalance, transactionSum, count, latest running/last import closing balances, isBalanced and issues. Nullable balances retain null aliases. isBalanced compares available statement balances, not GL or transactionSum. Mixed currency or unsafe sums/differences reject. ${units}`,
    inputSchema: z.object(id).strict() }, p => wrapTool(ctx, () => validateBankBalance(ctx, p.bankAccountId)));
  server.registerTool("set_bank_balance_alert", { description: `Set or clear a low balance threshold on a live organization bank account with manage:bank-rules. threshold/thresholdMinor must agree; null clears. Scheduled maintenance notifies org owners/admins when active balance is below threshold, once per day. Returns bankAccountId, accountName, currencyCode, lowBalanceThreshold and currentBalance with *Minor strings. ${units}`,
    inputSchema: z.object({ ...id, ...bankBalanceAlertFields }).strict() }, p => wrapTool(ctx, () => { const { bankAccountId, ...input } = p; return setBankBalanceAlert(ctx, bankAccountId, input); }));
}
