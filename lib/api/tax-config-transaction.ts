import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { stringifyWire } from "@/lib/money/wire";
export type TaxTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockTaxOrganization(tx: TaxTx, organizationId: string) {
  const [org] = await tx.select({ id: organization.id }).from(organization)
    .where(and(eq(organization.id, organizationId), isNull(organization.deletedAt))).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
export async function auditTax(tx: TaxTx, organizationId: string, entityType: string, entityId: string,
  action: string, changes: unknown, ctx: AuthContext, request?: Request) {
  await tx.insert(auditLog).values({ organizationId, userId: ctx.userId, entityType, entityId, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
