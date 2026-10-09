import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import { getMapping } from "@/lib/import-export/mappings";
import { importGenericCsv, importPermission, listGenericImportJobs } from "@/lib/import-export/generic-import";
import { genericExport, genericExportAll } from "@/lib/import-export/generic-export";
import { csvImportSchema, directEntity, exportFiltersSchema, exportToolSchema, genericEntity, genericSource, importJobsSchema, previewGenericRows, previewRowsSchema } from "@/lib/import-export/generic-wire";
import { createZip } from "@/lib/import-export/zip";
import { requireRole } from "@/lib/api/require-role";
import { importJournals } from "@/lib/api/journal-import";
import { mcpJournalImportRow, parseJournalImportRows, previewJournalImport } from "@/lib/api/journal-import-wire";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerImportExportTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_import_template", {
    description: "Get CSV source aliases and canonical exact fields. Generic products use fixed two-decimal major prices (12.50 = 1250) or unitPriceMinor/costPriceMinor integer strings; domain invoice/bill/journal/bank imports retain their own contracts.",
    inputSchema: z.strictObject({ source: genericSource.describe("Source bookkeeping system"), entityType: genericEntity.describe("Entity whose expected headers and aliases are returned") }),
  }, params => wrapTool(ctx, async () => {
    requireRole(ctx, "view:data");
    return { source: params.source, entityType: params.entityType, columns: getMapping(params.source, params.entityType).map(a => ({ field: a.targetField, aliases: a.aliases })) };
  }));
  server.registerTool("import_csv_data", {
    description: "Import 1..1000 mapped CSV rows for accounts, contacts or products. Requires the entity's manage permission. Product decimal prices use fixed two-decimal units; exact unitPriceMinor/costPriceMinor strings must agree and fit safe integer range. Quantities are nonnegative whole int32 units; positive stock requires positive cost and uses inventory opening-stock posting/locks. Unsupported types/fields/money fail before jobs. Domain row failures are isolated and reported; returns jobId/counts/status/errors.",
    inputSchema: csvImportSchema,
  }, params => wrapTool(ctx, () => importGenericCsv(ctx, params)));
  server.registerTool("preview_csv_import_rows", {
    description: "Preview mapped generic account/contact/product rows without writes. Same permissions and wire validation as import_csv_data; returns preview errors and valid/total counts. Product prices are fixed two-decimal major values or Minor strings; preview does not resolve DB duplicates or posting references.",
    inputSchema: previewRowsSchema.extend({ entityType: directEntity.describe("Entity being previewed") }),
  }, params => wrapTool(ctx, async () => {
    requireRole(ctx, importPermission[params.entityType]);
    const { entityType, ...input } = params; return previewGenericRows(entityType, input);
  }));
  server.registerTool("import_journal_entries", {
    description: "Import grouped balanced journals using integer cents (debit/credit) or canonical debitAmountMinor/creditAmountMinor strings; dual aliases must agree and amounts/sums must fit safe Number range. Requires manage:entries and post:entries when post=true. Resolves active org-owned accounts, keeps imported USD/1:1 defaults, checks posted period locks, and atomically writes each entry. Invalid groups are reported independently; malformed wire values fail before job creation. Returns job and group counts/errors.",
    inputSchema: z.strictObject({ rows: z.array(mcpJournalImportRow.strict()).min(1).describe("Flat journal rows grouped by entryNumber or date|description; headers must agree"),
      post: z.boolean().default(false).describe("Create posted journals when true (permission and period lock required); otherwise drafts") }),
  }, params => wrapTool(ctx, async () => {
    requireRole(ctx, "manage:entries");
    return (await importJournals(ctx, parseJournalImportRows(params.rows), "mcp-import-entries", params.post)).summary;
  }));
  server.registerTool("preview_journal_entries", {
    description: "Preview grouped journal import without writes. MCP debit/credit are integer cents; exact aliases are canonical minor-unit strings. Returns row validation and safe integer totals plus exact totalDebitMinor/totalCreditMinor/imbalanceMinor strings. Preview checks shape/balance; import additionally resolves accounts and posting locks.",
    inputSchema: z.strictObject({ rows: z.array(mcpJournalImportRow.strict()).describe("Flat journal rows using MCP integer cents or exact minor-unit strings") }),
  }, params => wrapTool(ctx, async () => { requireRole(ctx, "manage:entries"); return previewJournalImport(params.rows); }));
  server.registerTool("export_csv_data", {
    description: "Export live organization-owned rows as CSV text; requires view:data. Legacy money columns remain fixed two-decimal text (1250 stored units = 12.50), with canonical Minor strings and saved currency codes; quantities keep their existing scale. Safe Number storage range applies. Inclusive dateFrom/dateTo apply to invoices/bills/entries/bank-transactions; unsupported controls fail. Returns entityType/csv/actual rowCount, counting quoted multiline rows once.",
    inputSchema: exportToolSchema,
  }, params => wrapTool(ctx, () => genericExport(ctx, params.entityType, { startDate: params.dateFrom, endDate: params.dateTo })));
  server.registerTool("export_all_csv_data", {
    description: "Export all seven organization-owned entity CSV files in one consistent read-only snapshot as a base64 ZIP. Requires view:data; legacy fixed two-decimal money text coexists with canonical Minor strings and saved currency codes. Inclusive dates filter transactional files. Returns filename/encoding/data/fileCount; no writes.",
    inputSchema: exportFiltersSchema,
  }, params => wrapTool(ctx, async () => ({ filename: "dubbl-export.zip", encoding: "base64", data: Buffer.from(createZip(await genericExportAll(ctx, params))).toString("base64"), fileCount: 7 })));
  server.registerTool("list_import_jobs", {
    description: "List organization-owned bulk import jobs ordered by newest first; requires view:data. Returns jobs and total (the returned page count), with bounded limit/offset.", inputSchema: importJobsSchema,
  }, params => wrapTool(ctx, () => listGenericImportJobs(ctx, params)));
}
