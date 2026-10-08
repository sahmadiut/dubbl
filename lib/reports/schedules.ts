import { and, eq, isNull, desc, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportSchedule } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { logAudit, diffChanges } from "@/lib/api/audit";
import { stringifyWire } from "@/lib/money/wire";
import { getSavedReport, type CustomReportDb } from "./custom";
import { generateScheduledAttachment } from "./schedule-export";
import { createReportScheduleSchema, updateReportScheduleSchema, scheduleIdSchema, schedulePaginationSchema, calculateNextReportRun } from "./schedule-wire";

export const scheduleScope = (ctx: AuthContext, id?: string) => and(eq(reportSchedule.organizationId, ctx.organizationId), isNull(reportSchedule.deletedAt),
  id === undefined ? undefined : eq(reportSchedule.id, scheduleIdSchema.parse(id)));
export const scheduleFields = { ...getTableColumns(reportSchedule), timestampsFinite: sql<boolean>`isfinite(${reportSchedule.createdAt}) and isfinite(${reportSchedule.updatedAt}) and (${reportSchedule.nextRunAt} is null or isfinite(${reportSchedule.nextRunAt})) and (${reportSchedule.lastRunAt} is null or isfinite(${reportSchedule.lastRunAt}))` };
export type ScheduleRow = typeof reportSchedule.$inferSelect & { timestampsFinite: boolean };
export function validateSchedule(row: ScheduleRow) {
  try {
    createReportScheduleSchema.parse({ savedReportId: row.savedReportId, frequency: row.frequency, format: row.format, recipients: row.recipients,
      dayOfWeek: row.dayOfWeek, dayOfMonth: row.dayOfMonth, timeOfDay: row.timeOfDay, timezone: row.timezone });
  } catch { throw new AuthError("Stored report schedule is unsupported", 422); }
  if (!row.timestampsFinite || ![row.createdAt, row.updatedAt, row.nextRunAt, row.lastRunAt, row.deletedAt].every(date => date === null || date instanceof Date && Number.isFinite(date.getTime())))
    throw new AuthError("Stored schedule timestamps are unsupported", 422);
  const { timestampsFinite, ...output } = row;
  void timestampsFinite;
  stringifyWire(output);
  return output;
}
export async function scheduleOutput(ctx: AuthContext, row: ScheduleRow, reader: CustomReportDb = db) {
  const output = validateSchedule(row);
  const { report } = await getSavedReport(ctx, row.savedReportId, reader);
  const result = { ...output, savedReport: report };
  stringifyWire(result);
  return result;
}
export async function preflightSchedule(ctx: AuthContext, row: ScheduleRow, reader: CustomReportDb = db) {
  const result = await scheduleOutput(ctx, row, reader);
  const attachment = await generateScheduledAttachment(ctx, result.savedReport, result.format, reader);
  return { result, attachment };
}
export async function listReportSchedules(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const { page, limit } = schedulePaginationSchema.parse(input);
  return db.transaction(async tx => {
    const rows = await tx.select(scheduleFields).from(reportSchedule).where(scheduleScope(ctx)).orderBy(desc(reportSchedule.createdAt), reportSchedule.id).limit(limit).offset((page - 1) * limit);
    const [count] = await tx.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(reportSchedule).where(scheduleScope(ctx));
    return { data: await Promise.all(rows.map(row => scheduleOutput(ctx, row, tx))), pagination: { page, limit, total: count.total, totalPages: Math.ceil(count.total / limit) } };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getReportSchedule(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:data");
  return db.transaction(async tx => {
    const [row] = await tx.select(scheduleFields).from(reportSchedule).where(scheduleScope(ctx, id));
    if (!row) throw new AuthError("Report schedule not found", 404);
    return { reportSchedule: await scheduleOutput(ctx, row, tx) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createReportSchedule(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "view:data"); requireRole(ctx, "manage:reports");
  const parsed = createReportScheduleSchema.parse(input);
  const result = await db.transaction(async tx => {
    const { report } = await getSavedReport(ctx, parsed.savedReportId, tx);
    await generateScheduledAttachment(ctx, report, parsed.format, tx);
    const [row] = await tx.insert(reportSchedule).values({ ...parsed, organizationId: ctx.organizationId,
      dayOfWeek: parsed.dayOfWeek ?? null, dayOfMonth: parsed.dayOfMonth ?? null, nextRunAt: calculateNextReportRun(parsed, new Date()) }).returning(scheduleFields);
    return await scheduleOutput(ctx, row, tx);
  }, { isolationLevel: "repeatable read" });
  await logAudit({ ctx, action: "create", entityType: "report_schedule", entityId: result.id, request });
  return { reportSchedule: result };
}
export async function updateReportSchedule(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "view:data"); requireRole(ctx, "manage:reports");
  const where = scheduleScope(ctx, id), parsed = updateReportScheduleSchema.parse(input);
  const { result, existing } = await db.transaction(async tx => {
    const [row] = await tx.select(scheduleFields).from(reportSchedule).where(where).for("update");
    if (!row) throw new AuthError("Report schedule not found", 404);
    const existing = await scheduleOutput(ctx, row, tx);
    const merged = { ...row, ...parsed };
    await preflightSchedule(ctx, merged, tx);
    const [updated] = await tx.update(reportSchedule).set({ ...parsed, updatedAt: new Date(), nextRunAt: calculateNextReportRun(merged, new Date()) }).where(where).returning(scheduleFields);
    return { existing, result: await scheduleOutput(ctx, updated, tx) };
  }, { isolationLevel: "repeatable read" });
  await logAudit({ ctx, action: "update", entityType: "report_schedule", entityId: id, changes: diffChanges(existing, result), request });
  return { reportSchedule: result };
}
export async function deleteReportSchedule(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "view:data"); requireRole(ctx, "manage:reports");
  const where = scheduleScope(ctx, id);
  const existing = await db.transaction(async tx => {
    const [row] = await tx.select(scheduleFields).from(reportSchedule).where(where).for("update");
    if (!row) throw new AuthError("Report schedule not found", 404);
    const { result } = await preflightSchedule(ctx, row, tx);
    const [deleted] = await tx.update(reportSchedule).set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false }).where(where).returning(scheduleFields);
    validateSchedule(deleted);
    return result;
  }, { isolationLevel: "repeatable read" });
  await logAudit({ ctx, action: "delete", entityType: "report_schedule", entityId: id, changes: existing, request });
  return { success: true };
}
