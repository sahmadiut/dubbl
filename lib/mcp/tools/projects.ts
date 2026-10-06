import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { billingSchemas, billingItemSchema } from "@/lib/api/project-billing-wire";
import { executeProjectBilling, projectBillingPreview } from "@/lib/api/project-billing";

export function registerProjectTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_project_profitability", { description: "Project job-costing revenue, materials, net journals and labor with estimate variances. Integer cents plus exact Minor strings; physical minutes. Optional dates and saved currency filter; mixed currencies require a filter. Returns projects and entries with numeric/exact totals.", inputSchema: billingSchemas.profitability },
    params => wrapTool(ctx, () => executeProjectBilling(ctx, "profitability", params)));
  server.registerTool("list_project_billable_items", { description: "List scoped registered costs, billed history and candidate bill lines. Integer cents plus exact Minor strings; markup basis points (1000 = 10%). Returns buckets and registeredBillableTotal.", inputSchema: billingSchemas.list },
    params => wrapTool(ctx, () => executeProjectBilling(ctx, "list", params)));
  const single = z.object({ projectId: billingSchemas.list.shape.projectId, ...billingItemSchema.shape }).strict();
  server.registerTool("register_project_billable_item", { description: "Register/update one approved scoped source cost line atomically. Optional costAmount integer cents or agreeing costAmountMinor string; markup basis points. Billed costs are immutable. Returns id and numeric/exact cost and billable amount.", inputSchema: single },
    params => wrapTool(ctx, async () => {
      const { projectId, ...item } = params;
      const result = await executeProjectBilling(ctx, "register", { projectId, items: [item] }) as { items: object[] };
      return result.items[0];
    }));
  server.registerTool("register_project_billable_items", { description: "Register/update a batch of approved scoped source costs in one transaction. Integer cents or exact costAmountMinor; markup basis points. Returns count and items; any invalid line rejects the entire batch.", inputSchema: billingSchemas.register },
    params => wrapTool(ctx, () => executeProjectBilling(ctx, "register", params)));
  server.registerTool("unregister_project_billable_item", { description: "Remove one scoped unbilled cost registration. Billed and period-locked sources reject. Returns success.", inputSchema: billingSchemas.unregister },
    params => wrapTool(ctx, () => executeProjectBilling(ctx, "unregister", params)));
  server.registerTool("generate_project_invoice", { description: "Invoice all unbilled time and optional costs for an hourly project. Exact cents products and numeric/Minor invoice totals. Period/customer guards and atomic source allocation; optional requestKey provides replay. Returns invoice.", inputSchema: billingSchemas.invoice },
    params => wrapTool(ctx, () => executeProjectBilling(ctx, "invoice", params)));
  server.registerTool("generate_project_progress_invoice", { description: "Invoice selected hourly time, milestone remainders or a percent of original fixed cents price, optionally costs. Physical IDs, decimal percent and integer markup basis points; returns invoice with numeric/Minor totals. Allocation cannot exceed remaining price. Optional requestKey replays identical inputs.", inputSchema: billingSchemas.progress },
    params => wrapTool(ctx, () => executeProjectBilling(ctx, "progress", params)));
  server.registerTool("get_project_billing_preview", { description: "Preview unbilled time/milestones/fixed price and registered expenses. Returns policy-specific amounts in integer cents and exact Minor strings, saved currency, and physical minutes/percent; public user projections only.", inputSchema: billingSchemas.list },
    params => wrapTool(ctx, () => projectBillingPreview(ctx, params)));
}
