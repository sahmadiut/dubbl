import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { createReportSchedule, listReportSchedules, getReportSchedule, updateReportSchedule, deleteReportSchedule } from "@/lib/reports/schedules";
import { processReportScheduleById } from "@/lib/reports/schedule-processor";
import { createReportScheduleSchema, updateReportScheduleSchema, scheduleIdSchema, schedulePaginationSchema } from "@/lib/reports/schedule-wire";

export function registerReportScheduleTools(server: McpServer, ctx: AuthContext) {
  const contract = " Organization scoped, requires view:data; mutations and delivery also require manage:reports, with view:payroll-reports for payroll execution. Saved configs are validated; real data/attachments are preflighted before writes or delivery. Money retains numeric integer cents with exact Minor strings within +/-9007199254740991; no FX or rescaling. PDF/CSV/XLSX attachments preserve literal integer units; XLSX money uses text cells.";
  const idSchema = z.object({ id: scheduleIdSchema }).strict();
  server.registerTool("create_report_schedule", { description: "Create a recurring saved-report schedule and return the schedule with savedReport metadata. Default PDF, 08:00 UTC. Local weekday/month day and timezone determine nextRunAt." + contract,
    inputSchema: createReportScheduleSchema }, params => wrapTool(ctx, async () => (await createReportSchedule(ctx, params)).reportSchedule));
  server.registerTool("list_report_schedules", { description: "Return {data,pagination} of live schedules and validated savedReport metadata." + contract,
    inputSchema: schedulePaginationSchema }, params => wrapTool(ctx, () => listReportSchedules(ctx, params)));
  server.registerTool("get_report_schedule", { description: "Return a live schedule with validated savedReport metadata by UUID." + contract,
    inputSchema: idSchema }, ({ id }) => wrapTool(ctx, async () => (await getReportSchedule(ctx, id)).reportSchedule));
  server.registerTool("update_report_schedule", { description: "Patch supplied schedule fields by UUID and recalculate nextRunAt; return the updated schedule with savedReport metadata. Require at least one field." + contract,
    inputSchema: updateReportScheduleSchema.safeExtend({ id: scheduleIdSchema }) }, ({ id, ...params }) => wrapTool(ctx, async () => (await updateReportSchedule(ctx, id, params)).reportSchedule));
  server.registerTool("delete_report_schedule", { description: "Soft-delete and disable a live report schedule; return {success:true}." + contract,
    inputSchema: idSchema }, ({ id }) => wrapTool(ctx, () => deleteReportSchedule(ctx, id)));
  server.registerTool("trigger_report_schedule", { description: "Immediately send a saved-report attachment to configured recipients, including paused schedules; return {sent} recipient count. Only successful delivery advances run metadata." + contract,
    inputSchema: idSchema }, ({ id }) => wrapTool(ctx, () => processReportScheduleById(id, ctx)));
}
