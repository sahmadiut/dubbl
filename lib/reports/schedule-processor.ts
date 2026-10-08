import { db } from "@/lib/db";
import { reportSchedule, emailConfig } from "@/lib/db/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { sendEmail } from "@/lib/email/smtp-client";
import { requireRole } from "@/lib/api/require-role";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { scheduleFields, scheduleScope, preflightSchedule, validateSchedule } from "./schedules";
import { calculateNextReportRun, scheduleIdSchema } from "./schedule-wire";

const htmlEscape = (text: string) => text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

async function deliver(ctx: AuthContext, id: string, dueOnly: boolean) {
  const where = scheduleScope(ctx, id);
  return db.transaction(async tx => {
    // Lock across preflight, delivery and metadata updates, preventing overlapping cron/manual sends.
    const [row] = await tx.select(scheduleFields).from(reportSchedule).where(where).for("update");
    if (!row) throw new AuthError("Report schedule not found", 404);
    const now = new Date();
    if (dueOnly && (!row.isActive || !row.nextRunAt || row.nextRunAt > now)) return { sent: 0, skipped: true };
    const { result, attachment } = await preflightSchedule(ctx, row, tx);
    const nextRunAt = calculateNextReportRun(result, now);
    const [smtp] = await tx.select().from(emailConfig).where(eq(emailConfig.organizationId, ctx.organizationId));
    if (!smtp) throw new AuthError("No email config found for organization", 422);
    // All data, attachment and metadata inputs are validated before the first external side effect.
    for (const recipient of result.recipients) await sendEmail(smtp, {
      to: recipient,
      subject: `Scheduled Report: ${result.savedReport.name}`,
      html: `<h2>Scheduled Report: ${htmlEscape(result.savedReport.name)}</h2><p>Your ${result.frequency} report is attached (${result.format}).</p>`,
      attachments: [attachment],
    });
    const [updated] = await tx.update(reportSchedule).set({ lastRunAt: now, lastRunStatus: "success", nextRunAt, updatedAt: now }).where(where).returning(scheduleFields);
    validateSchedule(updated);
    return { sent: result.recipients.length, skipped: false };
  });
}

/** Manual REST/MCP delivery retains caller permissions, including payroll access. */
export async function processReportScheduleById(scheduleId: string, ctx: AuthContext) {
  requireRole(ctx, "view:data"); requireRole(ctx, "manage:reports");
  const result = await deliver(ctx, scheduleIdSchema.parse(scheduleId), false);
  return { sent: result.sent };
}

/** Trusted Trigger/cron worker; every report and SMTP lookup is scoped to the schedule organization. */
export async function processReportSchedules() {
  const due = await db.select({ id: reportSchedule.id, organizationId: reportSchedule.organizationId }).from(reportSchedule)
    .where(and(eq(reportSchedule.isActive, true), isNull(reportSchedule.deletedAt), lte(reportSchedule.nextRunAt, new Date())));
  let sent = 0, failed = 0;
  for (const row of due) {
    try {
      const result = await deliver({ userId: "report-schedule-worker", organizationId: row.organizationId, role: "owner" }, row.id, true);
      if (!result.skipped) sent++;
    } catch (err) {
      console.error(`Report schedule ${row.id} failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      failed++;
    }
  }
  // Preflight failures leave schedule/run metadata unchanged and send no mail.
  return { processed: due.length, sent, failed };
}
