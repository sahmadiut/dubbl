import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { taxPeriodId, taxPeriodFileSchema, taxSettlementSchema } from "@/lib/api/tax-period-wire";
import { fileTaxPeriod, settleTaxPeriod } from "@/lib/api/tax-periods";
export function registerTaxTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("file_vat_return", { description: "File an open owned VAT/GST period: atomically freeze boxes 1-5/8/9 and matching base-currency clearing journal. Returns period ID/status, journal ID, basis, numeric minor VAT totals and Minor strings, frozen lines. Safe Number range; cash heuristic and legacy flat-rate zero boxes retained. Requires manage:tax-config and open posting date.", inputSchema: taxPeriodFileSchema.extend({ taxPeriodId }).strict() },
    args => wrapTool(ctx, async () => {
      const { taxPeriodId, ...values } = args, { taxPeriod, ...result } = await fileTaxPeriod(ctx, taxPeriodId, values);
      return { taxPeriodId, status: taxPeriod.status, ...result };
    }));
  server.registerTool("record_vat_settlement", { description: "Post a VAT cash payment (suspense debit/bank credit) or refund (bank debit/suspense credit). amount numeric base-currency minor units or amountMinor canonical string, maximum 9007199254740991. Optional taxPeriodId links a filed/amended owned period; omission retains standalone legacy posting. Zero no-op; repeated positive calls create separate journals, no payment idempotency key. Requires manage:tax-config and open date; returns journal ID, amount/amountMinor and direction.", inputSchema: taxSettlementSchema.extend({ taxPeriodId: taxPeriodId.optional().describe("Optional owned filed/amended tax period UUID; omission retains standalone settlement") }).strict() },
    args => wrapTool(ctx, async () => { const { taxPeriodId, ...values } = args; return settleTaxPeriod(ctx, values, taxPeriodId); }));
}
