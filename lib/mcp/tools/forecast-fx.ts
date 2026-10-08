import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getCashForecast, getUnrealizedFx } from "@/lib/reports/forecast-fx";
import { cashForecastSchema, unrealizedFxSchema } from "@/lib/reports/forecast-fx-wire";

export function registerForecastFxTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("cash_flow_forecast", {
    description: "Read cash forecast from live unpaid invoices/bills and active recurring invoice/bill/expense pretax, prediscount line subtotals. Returns entries, UTC Sunday weekly buckets and totals in integer cents with Minor string aliases (absolute max 9007199254740991). Default horizon 12 weeks, max 52; includes both endpoint dates and partial weeks. Mixed document currencies require currencyCode; no FX conversion or rescaling. Requires view:data.",
    inputSchema: cashForecastSchema,
  }, args => wrapTool(ctx, () => getCashForecast(ctx, args)));
  server.registerTool("unrealized_gains_losses", {
    description: "Read unrealized FX estimate on current outstanding foreign invoices/bills using organization quotes at issue date and today UTC, not posted historical FX or historical settlements. Returns item/summary integer cents with Minor string aliases (absolute max 9007199254740991), quote_per_base exact rate strings and legacy int32 millionths. Missing/quarantined quotes yield null items and missingRateItems; unrepresentable quotes fail 422. Liability gains invert receivable gains; losses remain negative. No mutations or rate provider calls. Requires view:data; no inputs.",
    inputSchema: unrealizedFxSchema,
  }, args => wrapTool(ctx, () => getUnrealizedFx(ctx, args)));
}
