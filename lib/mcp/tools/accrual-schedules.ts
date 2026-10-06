import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { accrualId, accrualCreateMcpSchema, accrualPostSchema, accrualListSchema } from "@/lib/api/accrual-wire";
import { listAccrualSchedules, getAccrualSchedule, createAccrualSchedule, postAccrualEntry, cancelAccrualSchedule } from "@/lib/api/accrual-schedules";
export function registerAccrualScheduleTools(server: McpServer, ctx: AuthContext) {
  const scheduleId = accrualId.describe("Organization-owned accrual schedule UUID");
  server.registerTool("list_accrual_schedules", {
    description: "List organization accrual schedules with ordered entries and status filter. Money is numeric integer cents plus totalAmountMinor/amountMinor strings, max 9007199254740991. Returns accrualSchedules and total; requires manage:accruals.",
    inputSchema: accrualListSchema,
  }, p => wrapTool(ctx, async () => { const r = await listAccrualSchedules(ctx, p); return { accrualSchedules: r.schedules, total: r.total }; }));
  server.registerTool("get_accrual_schedule", {
    description: "Get an organization accrual schedule, scoped accounts and ordered entries. Numeric money is integer cents with exact totalAmountMinor/amountMinor strings. Requires manage:accruals.",
    inputSchema: z.object({ scheduleId }).strict(),
  }, p => wrapTool(ctx, async () => ({ accrualSchedule: await getAccrualSchedule(ctx, p.scheduleId) })));
  server.registerTool("create_accrual_schedule", {
    description: "Create a monthly accrual with positive totalAmount in integer CENTS or totalAmountMinor cents string, safe integer range. Never multiply MCP input by 100. Exact floor division; LAST period absorbs remainder. Dates use UTC month overflow and must fit endDate. Optional retry key replays identical normalized create. Returns accrualSchedule with ordered entries and exact aliases. Requires manage:accruals.",
    inputSchema: accrualCreateMcpSchema,
  }, p => wrapTool(ctx, async () => ({ accrualSchedule: await createAccrualSchedule(ctx, p, "mcp") })));
  server.registerTool("post_accrual_entry", {
    description: "Post the next accrual period atomically: DR reverseAccountId / CR accountId, integer cents. Requires active schedule, live base-currency accounts, two-decimal base currency and unlocked date. Optional entryId or idempotencyKey makes successful retries replay without advancing. Without either, each call posts the next period. Returns accrualEntry with numeric cents and amountMinor string; requires manage:accruals.",
    inputSchema: z.object({ scheduleId, ...accrualPostSchema.shape }).strict(),
  }, p => wrapTool(ctx, async () => { const { scheduleId, ...input } = p; return { accrualEntry: await postAccrualEntry(ctx, scheduleId, input) }; }));
  server.registerTool("cancel_accrual_schedule", {
    description: "Cancel an organization accrual schedule, preserving posted journals. Repeated cancellation replays without another audit; completed schedules cannot cancel. Returns accrualSchedule with integer cents and exact aliases. Requires manage:accruals.",
    inputSchema: z.object({ scheduleId }).strict(),
  }, p => wrapTool(ctx, async () => ({ accrualSchedule: await cancelAccrualSchedule(ctx, p.scheduleId) })));
}
