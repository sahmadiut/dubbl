import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { expenseIdField, expenseListFields, expenseMcpCreateFields, expenseMcpUpdateFields } from "@/lib/api/expense-wire";
import { listExpenseClaims, getExpenseClaim, getExpenseClaimCounts, createExpenseClaim, updateExpenseClaim, deleteExpenseClaim } from "@/lib/api/expense-crud";

export function registerExpenseCrudTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_expense_claims", {
    description: "List live organization employee expense claims with optional status and pagination. Returns {expenseClaims,total}; totalAmount is safe integer currency minor units (USD cents), with totalAmountMinor strings and public submitter/approver profiles. Unsupported saved money/references reject.",
    inputSchema: z.object(expenseListFields).strict(),
  }, params => wrapTool(ctx, async () => { const result = await listExpenseClaims(ctx, params); return { expenseClaims: result.data, total: result.pagination.total }; }));
  server.registerTool("get_expense_claim", {
    description: "Get a live organization expense claim with lines, accounts and public submitter/approver profiles. Returns {expenseClaim}; totalAmount, amount and mileageRate are safe integer currency minor units (USD cents), with matching *Minor strings; distanceMiles is miles times 100. No FX or tax recomputation.",
    inputSchema: z.object({ expenseClaimId: expenseIdField }).strict(),
  }, params => wrapTool(ctx, () => getExpenseClaim(ctx, params.expenseClaimId)));
  server.registerTool("get_expense_claim_counts", {
    description: "Return {counts,total} for live organization claims. Each status has count, amount (safe integer currency minor units, USD cents), amountMinor string and currencyCode. Rejects mixed currencies within a status and unsafe amounts/sums; never converts currency.",
    inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, () => getExpenseClaimCounts(ctx)));
  server.registerTool("create_expense_claim", {
    description: "Create an unposted draft employee expense claim with manage:expenses. Numeric item amount is integer currency minor units (USD 1250 cents = $12.50), amountMinor its canonical string, amountExact an exact decimal major string; aliases must agree. Tax-inclusive amounts are explicit, not recomputed from mileage. Currency defaults to org default. Header/lines/audit commit atomically; references and date locks checked. Returns {expenseClaim} with numeric totalAmount/totalAmountMinor. Money and total must fit 0..9007199254740991.",
    inputSchema: z.object(expenseMcpCreateFields).strict(),
  }, params => wrapTool(ctx, () => createExpenseClaim(ctx, params, "mcp")));
  server.registerTool("update_expense_claim", {
    description: "Edit an unposted draft or rejected organization claim with manage:expenses. Currency is retained. Optional items completely replace lines; numeric amount is integer currency minor units (USD cents), amountMinor its string, amountExact decimal major string. Existing line IDs retain omitted metadata. Old/new dates must be open; all changes and audit are atomic. Returns {expenseClaim} with safe numeric totalAmount and totalAmountMinor.",
    inputSchema: z.object({ expenseClaimId: expenseIdField, ...expenseMcpUpdateFields }).strict(),
  }, params => wrapTool(ctx, () => { const { expenseClaimId, ...input } = params; return updateExpenseClaim(ctx, expenseClaimId, input, "mcp"); }));
  server.registerTool("delete_expense_claim", {
    description: "Soft-delete an unposted draft or rejected organization claim and remove its lines with manage:expenses. Saved money/references and all line dates are validated; locked dates reject. Deletion and audit commit atomically. Returns {success:true}; no ledger/payment changes.",
    inputSchema: z.object({ expenseClaimId: expenseIdField }).strict(),
  }, params => wrapTool(ctx, () => deleteExpenseClaim(ctx, params.expenseClaimId)));
}
