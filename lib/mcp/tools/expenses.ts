import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { expenseIdField } from "@/lib/api/expense-wire";
import { expensePayFields, expenseRejectFields } from "@/lib/api/expense-lifecycle-wire";
import { submitExpenseClaim, recallExpenseClaim, approveExpenseClaim, rejectExpenseClaim, payExpenseClaim, reverseExpenseClaim } from "@/lib/api/expense-claims";

export function registerExpenseTools(server: McpServer, ctx: AuthContext) {
  const result = " Returns {expenseClaim} with totalAmount in safe integer currency minor units (USD cents) and totalAmountMinor string. Organization-scoped; saved amounts/references validated and status, journals and audit commit atomically. Unsupported history or amounts above 9007199254740991 fail without committed effects.";
  server.registerTool("submit_expense_claim", {
    description: "Submit a positive unposted draft or rejected claim with manage:expenses. Checks saved line dates/locks and current references; clears prior rejection." + result,
    inputSchema: z.object({ expenseClaimId: expenseIdField }).strict(),
  }, p => wrapTool(ctx, () => submitExpenseClaim(ctx, p.expenseClaimId)));
  server.registerTool("recall_expense_claim", {
    description: "Recall a submitted unposted claim to editable draft with manage:expenses; clears submission time; no GL changes." + result,
    inputSchema: z.object({ expenseClaimId: expenseIdField }).strict(),
  }, p => wrapTool(ctx, () => recallExpenseClaim(ctx, p.expenseClaimId)));
  server.registerTool("approve_expense_claim", {
    description: "Approve a positive submitted claim with approve:expenses. Recognizes expense/input/output VAT and Employee Reimbursements Payable at today's UTC Gregorian date with exact qualified historical FX. Item and posting dates must be open." + result,
    inputSchema: z.object({ expenseClaimId: expenseIdField }).strict(),
  }, p => wrapTool(ctx, () => approveExpenseClaim(ctx, p.expenseClaimId)));
  server.registerTool("reject_expense_claim", {
    description: "Reject a submitted unposted claim with approve:expenses and a nonblank reason. Records rejection/time, posts no GL." + result,
    inputSchema: z.object({ expenseClaimId: expenseIdField, ...expenseRejectFields }).strict(),
  }, p => wrapTool(ctx, () => rejectExpenseClaim(ctx, p.expenseClaimId, { reason: p.reason })));
  server.registerTool("pay_expense_claim", {
    description: "Fully reimburse an approved claim with approve:expenses, Gregorian date and bank/cash asset GL code. Clears saved payable carrying amount, credits cash at date FX and posts realised gain/loss separately; does not debit expenses again. Date cannot predate approval. No partial payment or payment table/bank-feed update." + result,
    inputSchema: z.object({ expenseClaimId: expenseIdField, ...expensePayFields }).strict(),
  }, p => wrapTool(ctx, () => payExpenseClaim(ctx, p.expenseClaimId, { date: p.date, bankAccountCode: p.bankAccountCode })));
  server.registerTool("reverse_expense_claim", {
    description: "Reverse complete qualified approval and optional payment history with approve:expenses. Mirrors saved base amounts, FX and dimensions on original open posting dates; resets to draft. Both reversal cycles and audit commit atomically; no rate lookup or current-cost recomputation." + result,
    inputSchema: z.object({ expenseClaimId: expenseIdField }).strict(),
  }, p => wrapTool(ctx, () => reverseExpenseClaim(ctx, p.expenseClaimId)));
}
