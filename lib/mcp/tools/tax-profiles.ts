import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { taxProfileSchema } from "@/lib/api/tax-rate-wire";
import { readTaxProfiles, seedTaxProfile } from "@/lib/api/tax-profile-contracts";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { register1099ReportTool } from "./tax-reports";

export function registerTaxProfileTools(server: McpServer, ctx: AuthContext) {
  register1099ReportTool(server, ctx);
  server.registerTool("list_tax_profiles", {
    description: "List existing country tax profiles and recommendedCountry, or get one by country. All rates/recovery shares are numeric integer basis points, not money/FX. Catalogue is a stored starting point, not a live statutory-rate service.",
    inputSchema: taxProfileSchema,
  }, args => wrapTool(ctx, () => readTaxProfiles(ctx, args)));
  server.registerTool("apply_tax_profile", {
    description: "Atomically seed this organization's country profile rates; skip existing name/rate/type/kind matches and preserve chosen default. Requires manage:tax-rates. Returns created headers and skipped rates/reasons. Integer basis points; no money/FX aliases.",
    inputSchema: taxProfileSchema,
  }, args => wrapTool(ctx, () => seedTaxProfile(ctx, args)));

}
