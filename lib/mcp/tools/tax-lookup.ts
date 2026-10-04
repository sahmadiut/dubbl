import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { taxLookupSchema, taxJurisdictionSchema, taxId } from "@/lib/api/tax-rate-wire";
import { lookupTaxRate, saveTaxJurisdiction, deleteTaxJurisdiction } from "@/lib/tax/lookup";
export function registerTaxLookupTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("lookup_tax_rate", { description: "Look up this organization's cached jurisdiction by exact country and optional state/postal key; omitted filters match any. Latest updated row wins, UUID breaks ties. Returns found and rate/null. Integer basis points 0..2147483647; not money/FX. No live provider lookup.",
    inputSchema: taxLookupSchema }, args => wrapTool(ctx, async () => {
      const rate = await lookupTaxRate(ctx, args); return { found: rate !== null, rate };
    }));
  server.registerTool("save_tax_jurisdiction", { description: "Create or replace an owned manual jurisdiction for country/state/postal key, including null keys. Integer basis points 0..2147483647; combined rate independent of parts. Omitted sub-rates reset to zero. Requires manage:tax-rates; returns jurisdiction.",
    inputSchema: taxJurisdictionSchema }, args => wrapTool(ctx, async () => ({ jurisdiction: await saveTaxJurisdiction(ctx, args) })));
  server.registerTool("delete_tax_jurisdiction", { description: "Delete an owned cached jurisdiction. Requires manage:tax-rates; returns success.",
    inputSchema: z.object({ jurisdictionId: taxId.describe("Owned jurisdiction UUID") }).strict() }, args => wrapTool(ctx, () => deleteTaxJurisdiction(ctx, args.jurisdictionId)));
}
