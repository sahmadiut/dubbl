import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import { logAudit } from "@/lib/api/audit";
import { notDeleted } from "@/lib/db/soft-delete";
import { processRecurringJournals } from "@/lib/api/recurring-generate";
import { assertJournalReferences } from "@/lib/api/journal-references";
import { getRecurringJournal, createRecurringJournal, updateRecurringJournal, pauseRecurringJournal, deleteRecurringJournal } from "@/lib/api/recurring-journal";
import { recurringJournalFields, recurringJournalUpdateSchema, recurringJournalDto } from "@/lib/api/recurring-journal-wire";
import type { AuthContext } from "@/lib/api/auth-context";

const templateId = z.string().uuid().describe("Organization-owned recurring journal template UUID");
export function registerRecurringJournalTools(server: McpServer, ctx: AuthContext) {
  server.tool("list_recurring_journals", "List organization recurring journal templates with safe numeric debit/credit minor units (USD cents), exact *AmountMinor strings, saved currency tag and fixed 1:1 rate aliases.", {
    status: z.enum(["active", "paused", "completed"]).optional().describe("Optional status filter"),
  }, params => wrapTool(ctx, async () => {
    const templates = await db.query.recurringTemplate.findMany({ where: and(eq(recurringTemplate.organizationId, ctx.organizationId),
      eq(recurringTemplate.type, "journal"), notDeleted(recurringTemplate.deletedAt), params.status ? eq(recurringTemplate.status, params.status) : undefined),
      orderBy: desc(recurringTemplate.createdAt), with: { lines: true } });
    for (const template of templates) await assertJournalReferences(ctx.organizationId, template.lines.map(line => ({ accountId: line.accountId ?? undefined, costCenterId: line.costCenterId })), undefined, true);
    return { templates: templates.map(template => recurringJournalDto(template)) };
  }));
  server.tool("get_recurring_journal", "Get an organization recurring journal with schedule, safe numeric minor-unit legs (USD cents), exact *AmountMinor strings and fixed 1:1 FX aliases.",
    { templateId }, params => wrapTool(ctx, async () => ({ template: await getRecurringJournal(ctx, params.templateId) })));
  server.tool("create_recurring_journal", "Create a balanced recurring journal. Debit/credit inputs are integer minor units (USD cents), or exact *AmountMinor strings with agreeing numeric aliases. Each leg has one positive side; line and summed amounts must fit safe Numbers. Saved currency is a tag, posted verbatim at fixed 1:1; configurable FX is unsupported. Returns the template header.",
    recurringJournalFields, params => wrapTool(ctx, () => createRecurringJournal(ctx, params)));
  server.tool("update_recurring_journal", "Edit a recurring journal header or replace all balanced legs atomically. Minor-unit inputs (USD cents) accept safe numbers and exact *AmountMinor strings; aliases must agree, sums must be safe. Fixed 1:1 posting only. Returns the updated template header.",
    { templateId, ...recurringJournalUpdateSchema.shape }, params => wrapTool(ctx, () => {
      const { templateId: id, ...input } = params;
      return updateRecurringJournal(ctx, id, input);
    }));
  server.tool("set_recurring_journal_status", "Set active, paused or completed on an organization recurring journal; activation catches up from the unchanged saved nextRunDate. Returns the template header.", {
    templateId, status: z.enum(["active", "paused", "completed"]).describe("New template status"),
  }, params => wrapTool(ctx, () => updateRecurringJournal(ctx, params.templateId, { status: params.status })));
  server.tool("pause_recurring_journal", "Toggle active/paused without moving nextRunDate. Resumed schedules catch up; completed templates cannot toggle. Returns the template header.",
    { templateId }, params => wrapTool(ctx, () => pauseRecurringJournal(ctx, params.templateId)));
  server.tool("delete_recurring_journal", "Soft-delete an organization recurring journal; posted entries remain. Returns success.",
    { templateId }, params => wrapTool(ctx, () => deleteRecurringJournal(ctx, params.templateId)));
  server.tool("run_recurring_journals", "Run organization recurring journals now. Posts safe minor-unit legs verbatim at fixed 1:1 after amount, balance and tenant-dimension validation. Locked dates consume an occurrence without posting. Each template catch-up and schedule advancement is atomic and serialized; returns posted count.",
    {}, () => wrapTool(ctx, async () => {
      requireRole(ctx, "manage:recurring");
      const posted = await processRecurringJournals(ctx.organizationId);
      await logAudit({ ctx, action: "run", entityType: "recurring_journal", entityId: ctx.organizationId, changes: { posted } });
      return { posted };
    }));
}
