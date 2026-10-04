import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { taxProfileSchema } from "@/lib/api/tax-rate-wire";
import { readTaxProfiles, seedTaxProfile } from "@/lib/api/tax-profile-contracts";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import {
  build1099Report,
  FORM_1099_NEC_THRESHOLD_CENTS,
} from "@/lib/api/tax-profiles";

export function registerTaxProfileTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_tax_profiles", {
    description: "List existing country tax profiles and recommendedCountry, or get one by country. All rates/recovery shares are numeric integer basis points, not money/FX. Catalogue is a stored starting point, not a live statutory-rate service.",
    inputSchema: taxProfileSchema,
  }, args => wrapTool(ctx, () => readTaxProfiles(ctx, args)));
  server.registerTool("apply_tax_profile", {
    description: "Atomically seed this organization's country profile rates; skip existing name/rate/type/kind matches and preserve chosen default. Requires manage:tax-rates. Returns created headers and skipped rates/reasons. Integer basis points; no money/FX aliases.",
    inputSchema: taxProfileSchema,
  }, args => wrapTool(ctx, () => seedTaxProfile(ctx, args)));

  server.tool(
    "report_1099",
    "Generate the US 1099-NEC/MISC vendor summary for a calendar tax year. Aggregates payments made to each 1099 vendor (contacts flagged is1099Vendor) on a CASH basis — sums actual supplier payments dated within the year, not bill totals. Card payments are EXCLUDED (those are reported on 1099-K by the card/processor). All amounts are returned in integer cents (e.g. $600.00 = 60000). Each vendor row includes the W-9 tax identifier, classification, backup-withholding flag, total paid, payment count, and whether it meets the reporting threshold ($600 = 60000 cents by default). Returns per-vendor summaries plus the count/total of reportable vendors.",
    {
      year: z
        .number()
        .int()
        .min(2000)
        .max(2100)
        .optional()
        .describe(
          "Four-digit calendar tax year (e.g. 2025). Defaults to the prior calendar year."
        ),
      threshold: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          `Reporting threshold in integer cents; vendors at or above this are flagged reportable. Defaults to ${FORM_1099_NEC_THRESHOLD_CENTS} ($600.00).`
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const year = params.year ?? new Date().getFullYear() - 1;
        return build1099Report(
          ctx.organizationId,
          year,
          params.threshold ?? FORM_1099_NEC_THRESHOLD_CENTS
        );
      })
  );
}
