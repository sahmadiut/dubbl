import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { taxPeriodId, taxPeriodCreateSchema, taxPeriodUpdateSchema, taxPeriodFileSchema } from "@/lib/api/tax-period-wire";
import { listTaxPeriods, getTaxPeriod, createTaxPeriod, updateTaxPeriod, deleteTaxPeriod, fileTaxPeriod } from "@/lib/api/tax-periods";
export function registerTaxPeriodTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_tax_periods", { description: "List owned VAT/GST periods, newest first, with frozen lines: numeric base-currency minor amounts plus amountMinor strings in safe Number range.", inputSchema: z.object({}).strict() },
    () => wrapTool(ctx, async () => ({ taxPeriods: await listTaxPeriods(ctx) })));
  server.registerTool("get_tax_period", { description: "Get an owned tax period and frozen lines with numeric minor amounts and amountMinor strings.", inputSchema: z.object({ taxPeriodId }).strict() },
    args => wrapTool(ctx, async () => ({ taxPeriod: await getTaxPeriod(ctx, args.taxPeriodId) })));
  server.registerTool("create_tax_period", { description: "Create an open owned tax period with Gregorian dates. Requires manage:tax-config; returns created header.", inputSchema: taxPeriodCreateSchema },
    args => wrapTool(ctx, async () => ({ taxPeriod: await createTaxPeriod(ctx, args) })));
  server.registerTool("update_tax_period", { description: "Patch an open owned tax period; omitted fields retain values. Filed/amended records are immutable. Requires manage:tax-config; returns header.", inputSchema: taxPeriodUpdateSchema.extend({ taxPeriodId }).strict() },
    args => wrapTool(ctx, async () => { const { taxPeriodId, ...values } = args; return { taxPeriod: await updateTaxPeriod(ctx, taxPeriodId, values) }; }));
  server.registerTool("delete_tax_period", { description: "Delete an open owned tax period and its lines atomically with audit. Filed/amended records reject. Requires manage:tax-config; returns success.", inputSchema: z.object({ taxPeriodId }).strict() },
    args => wrapTool(ctx, () => deleteTaxPeriod(ctx, args.taxPeriodId)));
  server.registerTool("file_tax_period", { description: "Atomically freeze boxes 1-5/8/9 and post the matching clearing journal for an open period. Numeric base-currency minor amounts plus Minor strings; safe Number range. Cash uses existing heuristic; flat rate retains zero boxes 1/4. Requires manage:tax-config and open posting date; returns period, journal ID, basis, VAT totals and frozen lines. Use record_vat_settlement for cash.", inputSchema: taxPeriodFileSchema.extend({ taxPeriodId }).strict() },
    args => wrapTool(ctx, async () => { const { taxPeriodId, ...values } = args; return fileTaxPeriod(ctx, taxPeriodId, values); }));
}
