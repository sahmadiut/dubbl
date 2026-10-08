import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getBankCashFlow, getBankReconciliationStatus } from "@/lib/reports/bank-analytics";
import { bankCashFlowSchema, bankStatusSchema } from "@/lib/reports/bank-analytics-wire";

export function registerBankAnalyticsTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("bank_cash_flow", {
    description: "Read organization-owned non-excluded bank movements for an inclusive Gregorian startDate/endDate (current UTC year through today by default), grouped by UTC day/Monday week/month. Optional bankAccountId or currencyCode selects one currency; mixed currencies reject without FX. Returns currencyCode, periods and totals, signed numeric integer currency minor units with inflowsMinor/outflowsMinor/netMinor/balanceMinor strings; outflows are negative, running balance starts at zero for the period, safe +/-9007199254740991. Requires view:data; no input amounts or writes.",
    inputSchema: bankCashFlowSchema,
  }, params => wrapTool(ctx, () => getBankCashFlow(ctx, params)));
  server.registerTool("bank_reconciliation_status", {
    description: "Read active live organization-owned bank accounts, optionally filtered by bankAccountId. Returns separate currencyCode-tagged accounts with numeric integer currency minor units and balanceMinor/balanceDiscrepancyMinor/totalMinor strings, safe +/-9007199254740991, unreconciled counts and UTC age buckets (0-7,8-30,31-60,older including future lines), last scoped import/reconciliation and date gaps. Discrepancy is saved balance minus non-excluded movement sum; no combined currency total or opening GL assumption. Requires view:data; no input amounts or writes.",
    inputSchema: bankStatusSchema,
  }, params => wrapTool(ctx, () => getBankReconciliationStatus(ctx, params)));
}
