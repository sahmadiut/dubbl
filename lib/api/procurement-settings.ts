import { db } from "@/lib/db";
import { auditLog, procurementSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { DEFAULT_PROCUREMENT_SETTINGS } from "./procurement";
import { procurementSettingsDto, procurementSettingsUpdateSchema } from "./procurement-settings-wire";

export async function readProcurementSettings(ctx: AuthContext) {
  const row = await db.query.procurementSettings.findFirst({
    where: eq(procurementSettings.organizationId, ctx.organizationId),
  });
  return { procurementSettings: procurementSettingsDto(row ?? {
    organizationId: ctx.organizationId, ...DEFAULT_PROCUREMENT_SETTINGS,
  }) };
}

export async function updateProcurementSettings(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills");
  const parsed = procurementSettingsUpdateSchema.parse(input);
  return db.transaction(async tx => {
    // The unique org key serializes concurrent first writes and partial updates.
    // Only supplied controls change on conflict; insert defaults never overwrite
    // another request's settings.
    const [saved] = await tx.insert(procurementSettings).values({
      organizationId: ctx.organizationId, ...DEFAULT_PROCUREMENT_SETTINGS, ...parsed,
    }).onConflictDoUpdate({
      target: procurementSettings.organizationId,
      set: { ...parsed, updatedAt: new Date() },
    }).returning();
    const dto = procurementSettingsDto(saved);
    await tx.insert(auditLog).values({
      organizationId: ctx.organizationId, userId: ctx.userId, action: "update",
      entityType: "procurement_settings", entityId: saved.id, changes: parsed,
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request?.headers.get("x-real-ip") || null,
      userAgent: request?.headers.get("user-agent") || null,
    });
    return { procurementSettings: dto };
  });
}
