import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { revenueId, revenueCreateMcpSchema, revenueRecognizeSchema, revenueListSchema } from "@/lib/api/revenue-wire";
import { listRevenueSchedules, getRevenueSchedule, createRevenueSchedule, recognizeRevenueEntry, cancelRevenueSchedule } from "@/lib/api/revenue-schedules";
export function registerRevenueScheduleTools(server: McpServer, ctx: AuthContext) {
  const scheduleId = revenueId.describe("Organization-owned revenue schedule UUID");
  server.registerTool("list_revenue_schedules", {
    description: "List organization revenue schedules with ordered entries and status filter. Money is numeric integer cents plus totalAmountMinor/recognizedAmountMinor/amountMinor strings, max 9007199254740991. Returns revenueSchedules and total; requires manage:revenue.",
    inputSchema: revenueListSchema,
  }, p => wrapTool(ctx, async () => { const r = await listRevenueSchedules(ctx, p); return { revenueSchedules: r.schedules, total: r.total }; }));
  server.registerTool("get_revenue_schedule", {
    description: "Get an organization revenue schedule and ordered entries after validating scoped invoice/line/accounts. Numeric money is integer cents with exact totalAmountMinor/recognizedAmountMinor/amountMinor strings. Requires manage:revenue.",
    inputSchema: z.object({ scheduleId }).strict(),
  }, p => wrapTool(ctx, async () => ({ revenueSchedule: await getRevenueSchedule(ctx, p.scheduleId) })));
  server.registerTool("create_revenue_schedule", {
    description: "Create a monthly revenue schedule with positive totalAmount in integer CENTS or totalAmountMinor cents string, safe integer range. Never multiply MCP input by 100. Exact floor division; LAST period absorbs remainder. Inclusive calendar months determine periods; dates use UTC month overflow. Optional retry key replays identical normalized create. Returns revenueSchedule with ordered entries and exact aliases. Requires manage:revenue.",
    inputSchema: revenueCreateMcpSchema,
  }, p => wrapTool(ctx, async () => ({ revenueSchedule: await createRevenueSchedule(ctx, p, "mcp") })));
  server.registerTool("recognize_revenue_entry", {
    description: "Post the next revenue period atomically: DR Deferred Revenue (2300) / CR invoice line account or Revenue (4000), integer cents. Requires active schedule, issued invoice, live saved accounts, matching invoice/base currency and two-decimal base currency and unlocked date. Optional entryId or idempotencyKey makes successful retries replay without advancing. Without either, each call posts the next period. Returns revenueEntry with numeric cents and amountMinor string; requires manage:revenue.",
    inputSchema: z.object({ scheduleId, ...revenueRecognizeSchema.shape }).strict(),
  }, p => wrapTool(ctx, async () => { const { scheduleId, ...input } = p; return { revenueEntry: await recognizeRevenueEntry(ctx, scheduleId, input) }; }));
  server.registerTool("cancel_revenue_schedule", {
    description: "Cancel an organization revenue schedule, preserving posted journals. Repeated cancellation replays without another audit; completed schedules cannot cancel. Returns revenueSchedule with integer cents and exact aliases. Requires manage:revenue.",
    inputSchema: z.object({ scheduleId }).strict(),
  }, p => wrapTool(ctx, async () => ({ revenueSchedule: await cancelRevenueSchedule(ctx, p.scheduleId) })));
}
