import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getTaxReport } from "@/lib/reports/tax-reports";
import { taxReportSchemas } from "@/lib/reports/tax-report-wire";

const units = " Requires view:data. Returns existing numeric integer cents with matching Minor strings, currencyCode and counts. Absolute final limit 9007199254740991 cents; no currency rescaling or exact-only negotiation. Real inclusive Gregorian dates; read-only organization snapshot.";
export function register1099ReportTool(server: McpServer, ctx: AuthContext) {
  server.registerTool("report_1099", { description: "Existing 1099 vendor cash summary: non-card supplier payments, zero-paid flagged vendors included. year defaults to prior UTC year; threshold/thresholdMinor agree, default 60000 cents. Requires single organization-currency payments; no FX conversion or new statutory rules." + units,
    inputSchema: taxReportSchemas["1099"] }, args => wrapTool(ctx, () => getTaxReport(ctx, "1099", args)));
}
export function registerTaxReportTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("tax_summary", { description: "Document tax activity by live tax rate; dates default to current UTC year/today. Net cents retain per-line truncation of scaled quantity times unit price; only positive output/input activity rates returned. Single organization-currency documents." + units,
    inputSchema: taxReportSchemas["tax-summary"] }, args => wrapTool(ctx, () => getTaxReport(ctx, "tax-summary", args)));
  server.registerTool("sales_tax", { description: "Sales tax breakdown by assigned tax rate, including untaxed group and separate exemptAmount. Required startDate/endDate; rate percentages remain integer basis points. Single organization-currency documents." + units,
    inputSchema: taxReportSchemas["sales-tax"] }, args => wrapTool(ctx, () => getTaxReport(ctx, "sales-tax", args)));
  server.registerTool("vat_return", { description: "Live nine-box VAT report; required dates, optional cash/accrual and flatRatePercent integer basis points. Preserves control-account cash heuristic, accrual reverse-charge and cross-border tax-registered contact heuristic; flat rate rounds ties toward positive infinity. Single organization-currency documents; not statutory compliance." + units,
    inputSchema: taxReportSchemas["vat-return"] }, args => wrapTool(ctx, () => getTaxReport(ctx, "vat-return", args)));
  server.registerTool("vat_return_transactions", { description: "Live VAT/BAS full control-account drill-down for box 1/4/1A/1B; periodId overrides dates but current organization basis is used unless overridden. Output lines include debit/credit/amount and matching Minor strings. Box 1 includes reverse charge and does not match split/flat-rate VAT box 1; not frozen filing history." + units,
    inputSchema: taxReportSchemas["vat-transactions"] }, args => wrapTool(ctx, () => getTaxReport(ctx, "vat-transactions", args)));
  server.registerTool("bas", { description: "Live existing BAS fields; required dates and optional cash/accrual. G2 preserves cross-border heuristic; G3/G10 remain zero placeholders. Single organization-currency documents; not new statutory compliance." + units,
    inputSchema: taxReportSchemas.bas }, args => wrapTool(ctx, () => getTaxReport(ctx, "bas", args)));
  server.registerTool("schedule_c", { description: "Existing Schedule C subtype mapping from posted ledger lines; required dates. Revenue uses credit minus debit, others debit minus credit; netProfit retains income minus expenses, excluding returns line 2. No new statutory rules." + units,
    inputSchema: taxReportSchemas["schedule-c"] }, args => wrapTool(ctx, () => getTaxReport(ctx, "schedule-c", args)));
}
