import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dashboardLayout } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { createDashboardLayoutSchema, dashboardLayoutIdSchema, parseDashboardLayoutInput, validateLayoutJson } from "./dashboard-layout-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const scope = (ctx: AuthContext, id?: string) => and(
  eq(dashboardLayout.organizationId, ctx.organizationId), eq(dashboardLayout.userId, ctx.userId),
  id === undefined ? undefined : eq(dashboardLayout.id, dashboardLayoutIdSchema.parse(id)),
);

// Drizzle appends a timezone to timestamp text; JS can parse "infinity+0000" as a finite date.
const fields = { ...getTableColumns(dashboardLayout), timestampsFinite: sql<boolean>`isfinite(${dashboardLayout.createdAt}) and isfinite(${dashboardLayout.updatedAt})` };
function output(stored: typeof dashboardLayout.$inferSelect & { timestampsFinite: boolean }) {
  const { timestampsFinite, ...row } = stored;
  try {
    const parsed = createDashboardLayoutSchema.parse({ name: row.name, isDefault: row.isDefault, layout: row.layout });
    validateLayoutJson(parsed);
    if (!timestampsFinite || ![row.createdAt, row.updatedAt].every(date => date instanceof Date && Number.isFinite(date.getTime())))
      throw new TypeError("Layout timestamps must be finite dates");
    // Include timestamps and ownership metadata in the pre-commit serialization check.
    stringifyWire(row);
    return row;
  } catch (err) {
    if (err instanceof WireCompatibilityError) throw err;
    throw new AuthError("Stored dashboard layout is unsupported", 422);
  }
}

export async function listDashboardLayouts(ctx: AuthContext) {
  const rows = await db.select(fields).from(dashboardLayout).where(scope(ctx)).orderBy(dashboardLayout.createdAt);
  return { layouts: rows.map(output) };
}

export async function getDashboardLayout(ctx: AuthContext, id: string) {
  const [row] = await db.select(fields).from(dashboardLayout).where(scope(ctx, id)).limit(1);
  if (!row) throw new AuthError("Layout not found", 404);
  return { layout: output(row) };
}

export async function createDashboardLayout(ctx: AuthContext, input: unknown) {
  const parsed = createDashboardLayoutSchema.parse(parseDashboardLayoutInput(input));
  return db.transaction(async tx => {
    const [row] = await tx.insert(dashboardLayout).values({ ...parsed, organizationId: ctx.organizationId, userId: ctx.userId }).returning(fields);
    return { layout: output(row) };
  });
}

export async function updateDashboardLayout(ctx: AuthContext, id: string, input: unknown) {
  const where = scope(ctx, id);
  const parsed = parseDashboardLayoutInput(input, true);
  return db.transaction(async tx => {
    const [existing] = await tx.select(fields).from(dashboardLayout).where(where).for("update");
    if (!existing) throw new AuthError("Layout not found", 404);
    output(existing);
    const [row] = await tx.update(dashboardLayout).set({ ...parsed, updatedAt: new Date() }).where(where).returning(fields);
    return { layout: output(row) };
  });
}

export async function deleteDashboardLayout(ctx: AuthContext, id: string) {
  const where = scope(ctx, id);
  return db.transaction(async tx => {
    const [existing] = await tx.select(fields).from(dashboardLayout).where(where).for("update");
    if (!existing) throw new AuthError("Layout not found", 404);
    output(existing);
    await tx.delete(dashboardLayout).where(where);
    return { success: true };
  });
}
