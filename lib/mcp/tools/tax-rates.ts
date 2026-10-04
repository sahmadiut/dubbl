import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { taxCreateSchema, taxUpdateSchema, taxId } from "@/lib/api/tax-rate-wire";
import { listTaxRates, getTaxRate, createTaxRate, updateTaxRate, deleteTaxRate } from "@/lib/api/tax-rates";
export function registerTaxRateTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_tax_rates", {
    description: "List non-deleted organization tax rates with compound components; includes inactive rows. Best-effort seeds country profile if empty. Rates are integer basis points 0..2147483647 (1000 = 10%); recovery 0..10000. No monetary/FX aliases.", inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, async () => {
    const rows = await listTaxRates(ctx);
    return { taxRates: rows.map(r => ({ id: r.id, name: r.name, rate: r.rate, type: r.type, kind: r.kind,
      recoverablePercent: r.recoverablePercent, isDefault: r.isDefault, isActive: r.isActive,
      components: r.components.map(c => ({ id: c.id, name: c.name, rate: c.rate, accountId: c.accountId })) })) };
  }));
  server.registerTool("get_tax_rate", { description: "Get an owned non-deleted tax rate and components; numeric basis points, no money or FX aliases.",
    inputSchema: z.object({ taxRateId: taxId }).strict() }, args => wrapTool(ctx, async () => ({ taxRate: await getTaxRate(ctx, args.taxRateId) })));
  server.registerTool("create_tax_rate", { description: "Create a scoped tax rate and optional components atomically. Integer basis points 0..2147483647, recovery share 0..10000. References must be owned active accounts. Requires manage:tax-rates; returns created header.",
    inputSchema: taxCreateSchema }, args => wrapTool(ctx, async () => ({ taxRate: await createTaxRate(ctx, args) })));
  server.registerTool("update_tax_rate", { description: "Patch a scoped tax rate. Omitted fields retain values; components replace all. Integer basis points 0..2147483647, recovery 0..10000. Requires manage:tax-rates; returns updated header.",
    inputSchema: taxUpdateSchema.extend({ taxRateId: taxId }).strict() }, args => wrapTool(ctx, async () => {
      const { taxRateId, ...patch } = args; return { taxRate: await updateTaxRate(ctx, taxRateId, patch) };
    }));
  server.registerTool("delete_tax_rate", { description: "Soft-delete an owned tax rate and clear its default flag; preserves historical components. Requires manage:tax-rates; returns success.",
    inputSchema: z.object({ taxRateId: taxId }).strict() }, args => wrapTool(ctx, () => deleteTaxRate(ctx, args.taxRateId)));
}
