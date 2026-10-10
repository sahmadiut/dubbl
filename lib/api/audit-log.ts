import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import type { AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { getOrgPlanLimits } from "./check-limit";
import { paginatedResponse } from "./pagination";
import { parseOpaqueJson } from "./opaque-json";
import { stringifyWire } from "@/lib/money/wire";

export const auditLogSchema = z.strictObject({
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page number"),
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum rows per page"),
  entityType: z.string().max(200).optional().describe("Exact saved entity type filter"),
  entityId: z.string().uuid().optional().describe("Exact entity UUID filter within this organization"),
  userId: z.string().uuid().optional().describe("Exact actor UUID filter within this organization"),
  action: z.string().max(200).optional().describe("Exact saved action filter"),
  startDate: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).optional().describe("Inclusive Gregorian date (UTC midnight) or ISO instant with offset"),
  endDate: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).optional().describe("Inclusive Gregorian date (UTC midnight) or ISO instant with offset"),
}).refine(v => !v.startDate || !v.endDate || new Date(v.startDate) <= new Date(v.endDate), "startDate must not exceed endDate");

export async function listAuditLog(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:audit-log");
  const v = auditLogSchema.parse(input);
  const { limits } = await getOrgPlanLimits(ctx.organizationId);
  const conditions = [eq(auditLog.organizationId, ctx.organizationId)];
  if (limits.auditLogDays !== Infinity) conditions.push(gte(auditLog.createdAt, new Date(Date.now() - limits.auditLogDays * 86400000)));
  for (const key of ["entityType", "entityId", "userId", "action"] as const) if (v[key]) conditions.push(eq(auditLog[key], v[key]!));
  if (v.startDate) conditions.push(gte(auditLog.createdAt, new Date(v.startDate)));
  if (v.endDate) conditions.push(lte(auditLog.createdAt, new Date(v.endDate)));
  const result = await db.transaction(async tx => {
    const rows = await tx.select({ id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType,
      entityId: auditLog.entityId, changes: sql<string | null>`${auditLog.changes}::text`, ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent, createdAt: auditLog.createdAt, userName: users.name, userEmail: users.email })
      .from(auditLog).leftJoin(users, eq(auditLog.userId, users.id)).where(and(...conditions))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(v.limit).offset((v.page - 1) * v.limit);
    const [count] = await tx.select({ total: sql<string>`count(*)::text` }).from(auditLog).where(and(...conditions));
    const data = rows.map(({ userEmail, ...row }) => ({ ...row, changes: parseOpaqueJson(row.changes), userName: row.userName || userEmail || "Unknown" }));
    return paginatedResponse(data, Number(count.total), v.page, v.limit);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  stringifyWire(result);
  return result;
}
