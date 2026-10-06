import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { listLoans, getLoan, createLoan, updateLoan, deleteLoan, postLoanPayment } from "@/lib/api/loans";
import { loanId, loanListSchema, loanCreateMcpSchema, loanUpdateSchema, loanPaymentSchema } from "@/lib/api/loan-wire";
export function registerLoanTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_loans", { description: "List scoped loans and linked accounts with total count. Money is safe integer cents plus canonical Minor strings; rate is annual basis points. Optional status/pagination filters.", inputSchema: loanListSchema },
    p => wrapTool(ctx, async () => { const r = await listLoans(ctx, p); return { loans: r.loans, total: r.total }; }));
  server.registerTool("get_loan", { description: "Get scoped loan, linked accounts and persisted ordered amortization schedule. Money is integer cents with matching Minor strings; unsupported historical money/FX rejects.", inputSchema: z.object({ loanId }).strict() },
    p => wrapTool(ctx, () => getLoan(ctx, p.loanId)));
  server.registerTool("create_loan", { description: "Create loan and exact amortization schedule atomically. principalAmount is INTEGER CENTS (1250 = 12.50), not decimal major units; principalAmountMinor is a canonical cents string. Safe numeric range, 1..1200 months and 0..100000 annual basis points. Returns loan and generated schedule with Minor aliases. Optional retry key prevents duplicate creation.", inputSchema: loanCreateMcpSchema },
    p => wrapTool(ctx, () => createLoan(ctx, p, "mcp")));
  server.registerTool("update_loan", { description: "Update scoped loan name/status without regenerating schedule. paid_off requires all payments posted, active requires unposted payments. Returns loan with cents/Minor aliases.", inputSchema: z.object({ loanId, ...loanUpdateSchema.shape }).strict() },
    p => wrapTool(ctx, () => { const { loanId: id, ...input } = p; return updateLoan(ctx, id, input); }));
  server.registerTool("delete_loan", { description: "Soft-delete a scoped loan and remove its schedule atomically only when no payment journal history exists. Returns success boolean.", inputSchema: z.object({ loanId }).strict() },
    p => wrapTool(ctx, () => deleteLoan(ctx, p.loanId)));
  server.registerTool("post_loan_payment", { description: "Record next scheduled loan repayment atomically: debit liability/interest, credit base-currency bank GL with saved identity FX. Checks period, scope, money, accounts and history. Returns scheduled entry with cents/Minor aliases, journal and loan status. Supply scheduleEntryId for safe retries; an empty request intentionally advances the next payment. Optional retry key also replays across REST/MCP. No bank statement balance mutation or external payment is performed.", inputSchema: z.object({ loanId, ...loanPaymentSchema.shape }).strict() },
    p => wrapTool(ctx, () => { const { loanId: id, ...input } = p; return postLoanPayment(ctx, id, input); }));
}
