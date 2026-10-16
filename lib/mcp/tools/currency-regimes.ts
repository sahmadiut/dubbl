import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { listCurrencyRegimes, listCurrencyRegimesSchema } from "@/lib/currency/regimes";

export function registerCurrencyRegimeTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_currency_regimes", {
    description: "List this organization's currency-regime metadata, optionally filtered by uppercase ISO code. Returns inclusive Gregorian effective dates (null = unspecified), display minor units, provenance and exact decimal-string scaleToPrevious (previous major units per one new major unit). Catalogue only; does not convert integer minor-unit amounts, activate a cutover or enable toman/IRR production.",
    inputSchema: listCurrencyRegimesSchema,
  }, params => wrapTool(ctx, () => listCurrencyRegimes(ctx, params)));
}
