import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { invoiceUbl, invoiceUblSchema } from "@/lib/api/invoice-ubl";

export function registerInvoiceUblTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("export_invoice_ubl", {
    description: "Export an organization-owned live invoice UUID as the existing UBL XML with view:data permission. Returns xml, filename, currencyCode and totalMinor. Monetary XML decimals use the saved currency scale (USD cents, IRR/JPY whole units, KWD thousandths); unsafe history fails with LEGACY_NUMERIC_RANGE. Missing supplier/customer country or other existing required fields fail with 422. No monetary input or new statutory compliance qualification.",
    inputSchema: invoiceUblSchema,
  }, params => wrapTool(ctx, () => invoiceUbl(ctx, params.invoiceId)));
}
