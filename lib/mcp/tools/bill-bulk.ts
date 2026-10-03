import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { billImportSchema, mcpBillImportFields } from "@/lib/api/bill-bulk-wire";
import { previewBillImport, importBills } from "@/lib/api/bill-bulk";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerBillBulkTools(server: McpServer, ctx: AuthContext) {
  server.tool("preview_bill_import",
    "Preview flat bill CSV rows without writes. Prices and amount overrides are decimal major units; named Exact aliases are decimal strings and Minor aliases are integer currency minor strings. Aliases must agree and prices/products/group totals fit safe Number range. Resolves literal org supplier names and active account codes. Returns per-line data/valid/errors, numeric minor amounts plus named Minor strings, validCount and totalCount. Import additionally checks locked periods.",
    mcpBillImportFields, params => wrapTool(ctx, async () => previewBillImport(ctx, params)));
  server.tool("import_bills",
    "Import flat bill CSV rows grouped by external billNumber (grouping only, not an idempotency key or stored number). Decimal major prices/amount overrides accept Exact decimal strings and Minor integer strings; aliases must agree and money/products/sums fit safe Number range. Requires manage:bills; resolves org suppliers and active accounts and checks period locks. Invalid money fails before job creation; each bill/number/lines/audit commits atomically, business failures are isolated. Returns {job} with input-line totalRows and document processedRows/errorRows. Reimport creates new drafts; no ledger or settlement posting.",
    { ...mcpBillImportFields, fileName: billImportSchema.shape.fileName }, params => wrapTool(ctx, async () => importBills(ctx, params)));
}
