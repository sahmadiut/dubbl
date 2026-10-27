import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "../errors";
import { priceSchema, budgetSchema, reportSchema, createPrice, listPrices, configureBudget, listBudgets, usageReport } from "@/lib/ai/usage";

// Policy and price administration must never be discoverable by ordinary chat.
export { AI_USAGE_ADMIN_TOOLS } from "@/lib/ai/usage";
export function registerAiUsageTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("create_ai_price", { description: "Administration only; excluded from ordinary chat. Create an immutable organization-scoped price version for a delegated provider/model. Rates are exact decimal strings per MILLION tokens in explicit major billing currency, not cents. No live-price or invoice claim. Requires manage:ai-providers.", inputSchema: priceSchema }, input => wrapTool(ctx, () => createPrice(ctx, input)));
  server.registerTool("list_ai_prices", { description: "Administration only; excluded from ordinary chat. List up to 200 organization-scoped immutable price versions; integer rates are MICRO-major billing units per million tokens. Requires manage:ai-providers; returns no credentials.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listPrices(ctx)));
  server.registerTool("configure_ai_budget", { description: "Administration only; excluded from ordinary chat. Set an additional org or member budget in explicit billing currency using optimistic version. Costs are exact major-currency decimal strings, tokens integer strings. UTC-month token quota and global rate/concurrency cover all currencies; cost quota is currency-specific. Both org and user policies are required; zero disables. Requires manage:ai-policy.", inputSchema: budgetSchema }, input => wrapTool(ctx, () => configureBudget(ctx, input)));
  server.registerTool("list_ai_budgets", { description: "Administration only; excluded from ordinary chat. List scoped organization/member budgets and current versions; costs are exact major billing-currency strings, never provider invoices or accounting entries. Requires manage:ai-policy.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listBudgets(ctx)));
  server.registerTool("get_ai_usage", { description: "Get own usage or explicitly authorized organization aggregates within a maximum 93-day UTC creation-time window. Groups remain separated by user/provider/model/billing currency. Token category nulls remain unknown; reported sums are partial observed totals. Charged cost includes conservative unknown reservations, is an estimate and is never a provider invoice. No prompts, outputs, credentials or transcript access. Own requires view:ai-history; org requires view:ai-usage.", inputSchema: reportSchema }, input => wrapTool(ctx, () => usageReport(ctx, input)));
}
