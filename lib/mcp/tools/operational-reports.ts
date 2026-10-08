import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getRecurringReport, getFinancialCalendar, getDuplicateReport } from "@/lib/reports/operational";
import { recurringReportSchema, calendarReportSchema, duplicateReportSchema } from "@/lib/reports/operational-wire";

export function registerOperationalReportTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("recurring_transactions", {
    description: "Detect repeating non-excluded bank movements in live owned accounts. Optional bankAccountId includes inactive history; minOccurrences integer 2-10000, default 2. Returns up to 50 patterns grouped by normalized English description and bank currency, sorted by count; avg/min/max amounts and last five transactions have numeric integer currency minor units and matching Minor strings, safe +/-9007199254740991. Average rounds ties toward positive infinity; frequency/direction are heuristics. No FX or input money. Requires view:data; read-only.",
    inputSchema: recurringReportSchema,
  }, params => wrapTool(ctx, () => getRecurringReport(ctx, params)));
  server.registerTool("financial_calendar", {
    description: "Read due invoices/bills, active recurring generations and active budget period starts for inclusive Gregorian startDate/endDate; defaults UTC today through start plus 60 days. Optional currencyCode filter, otherwise events keep separate currencies. Returns startDate,endDate,events with numeric integer currency minor amount and amountMinor string, safe +/-9007199254740991; budget currency is organization base. Recurring estimate sums rounded quantity/100 times price before tax/discount, using saved UTC month overflow and occurrence/end limits; max 10000 traversed dates per template. No generation, input money, FX or writes; requires view:data.",
    inputSchema: calendarReportSchema,
  }, params => wrapTool(ctx, () => getFinancialCalendar(ctx, params)));
  server.registerTool("duplicate_detection", {
    description: "Read possible duplicate invoices/bills: same live owned contact, same total and currency, with entire group date span at most seven days. Excludes void/deleted documents. Returns duplicateGroups,totalGroups; each group has contactName,currencyCode,numeric integer minor amount and amountMinor string (safe +/-9007199254740991), and date/UUID-ordered items. Takes no inputs; no deletion, FX or writes. Requires view:data.",
    inputSchema: duplicateReportSchema,
  }, params => wrapTool(ctx, () => getDuplicateReport(ctx, params)));
}
