import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { runCustomReport, listSavedReports, getSavedReport, createSavedReport, updateSavedReport, deleteSavedReport, exportSavedReport } from "@/lib/reports/custom";
import { customConfigSchema, createSavedReportSchema, updateSavedReportSchema, savedReportIdSchema } from "@/lib/reports/custom-wire";

export function registerCustomReportTools(server: McpServer, ctx: AuthContext) {
  const contract = " Requires view:data, organization scoped. Config fields/operators/dates are allowlisted; groupBy must be empty. Money is numeric integer cents with matching exact Minor strings, safe +/-9007199254740991; no FX or rescaling. Physical quantities/counts keep their units. Payroll execution additionally requires view:payroll-reports.";
  const idSchema = z.object({ id: savedReportIdSchema }).strict();
  server.registerTool("run_custom_report", { description: "Execute config and return {data,total}; AND filters and inclusive date range apply before projection. Selected money columns add Minor aliases." + contract,
    inputSchema: customConfigSchema }, params => wrapTool(ctx, () => runCustomReport(ctx, params)));
  server.registerTool("list_saved_reports", { description: "Return {reports} with names, descriptions, validated persisted configs, ownership and timestamps." + contract,
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => listSavedReports(ctx)));
  server.registerTool("get_saved_report", { description: "Return {report} for a live saved-report UUID." + contract,
    inputSchema: idSchema }, ({ id }) => wrapTool(ctx, () => getSavedReport(ctx, id)));
  server.registerTool("create_saved_report", { description: "Persist a name, optional description and validated config; return {report}. Filter strings are literal and preserved." + contract,
    inputSchema: createSavedReportSchema }, params => wrapTool(ctx, () => createSavedReport(ctx, params)));
  server.registerTool("update_saved_report", { description: "Patch supplied name/description/config by UUID; require at least one field; return {report}. Unsupported stored configs reject before writes." + contract,
    inputSchema: updateSavedReportSchema.safeExtend({ id: savedReportIdSchema }) }, ({ id, ...params }) => wrapTool(ctx, () => updateSavedReport(ctx, id, params)));
  server.registerTool("delete_saved_report", { description: "Soft-delete a live saved-report UUID; return {success:true}. Unsupported stored configs reject before mutation." + contract,
    inputSchema: idSchema }, ({ id }) => wrapTool(ctx, () => deleteSavedReport(ctx, id)));
  server.registerTool("export_saved_report", { description: "Execute a live saved-report config and return CSV as base64 {filename,mimeType,encoding,content}; same filters, dates, columns and Minor aliases as run. Literal integer cents are exported without display scaling." + contract,
    inputSchema: idSchema }, ({ id }) => wrapTool(ctx, async () => {
      const { csv, ...meta } = await exportSavedReport(ctx, id);
      return { ...meta, encoding: "base64", content: Buffer.from(csv, "utf8").toString("base64") };
    }));
}
