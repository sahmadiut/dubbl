import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { getDashboardAlerts, getDashboardWidget } from "@/lib/api/dashboard-data";
import { dashboardQuerySchema } from "@/lib/api/dashboard-wire";
import { wrapTool } from "@/lib/mcp/errors";

export function registerDashboardDataTools(server: McpServer, ctx: AuthContext) {
  // Pass full strict objects: raw shapes let the SDK strip unknown controls before validation.
  const empty = z.object({}).strict();
  server.registerTool("get_dashboard_receivables", {
    description: "Return all live invoice amount-due total and counts (all statuses), numeric fixed cents and totalMinor exact string, with currencyCode. Mixed currencies require a filter. Requires view:data.",
    inputSchema: dashboardQuerySchema,
  }, params => wrapTool(ctx, () => getDashboardWidget(ctx, "accounts_receivable", params)));
  server.registerTool("get_dashboard_payables", {
    description: "Return all live bill amount-due total and counts (all statuses), numeric fixed cents and totalMinor exact string, with currencyCode. Mixed currencies require a filter. Requires view:data.",
    inputSchema: dashboardQuerySchema,
  }, params => wrapTool(ctx, () => getDashboardWidget(ctx, "accounts_payable", params)));
  server.registerTool("get_dashboard_bank_balances", {
    description: "Return live bank account IDs/names, currencyCode and numeric currency minor-unit balance (USD cents) plus balanceMinor exact string. Includes inactive accounts; never sums different currencies or rescales stored amounts. Requires view:data.",
    inputSchema: dashboardQuerySchema,
  }, params => wrapTool(ctx, () => getDashboardWidget(ctx, "bank_balances", params)));
  server.registerTool("get_dashboard_inventory_alerts", {
    description: "Return active live items at or below reorder point: lowStockCount and first ten by ID. quantityOnHand and reorderPoint retain physical integer units; no money. Requires view:data.",
    inputSchema: empty,
  }, () => wrapTool(ctx, () => getDashboardWidget(ctx, "inventory_alerts")));
  server.registerTool("get_dashboard_quick_actions", {
    description: "Return existing new_invoice, new_bill, new_entry and new_contact action identifiers. No monetary inputs or outputs. Requires view:data.",
    inputSchema: empty,
  }, () => wrapTool(ctx, () => getDashboardWidget(ctx, "quick_actions")));
  server.registerTool("get_dashboard_alerts", {
    description: "Return overdue invoice/bill counts and totals in numeric fixed cents plus totalMinor exact strings and currencyCode (before today UTC, excluding draft/void/paid), uncategorized transaction count, active accounts needing reconciliation and reminder count. Currency filter affects overdue sections only; mixed currencies in either section require a filter. Requires view:data.",
    inputSchema: dashboardQuerySchema,
  }, params => wrapTool(ctx, () => getDashboardAlerts(ctx, params)));
}
