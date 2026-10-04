import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, member, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { stringifyWire } from "@/lib/money/wire";
export type ApprovalTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockApprovalOrganization(tx: ApprovalTx, orgId: string) {
  const [org] = await tx.select({ id: organization.id }).from(organization).where(and(eq(organization.id, orgId), isNull(organization.deletedAt))).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
export async function auditApproval(tx: ApprovalTx, ctx: AuthContext, entityType: string, entityId: string, action: string, changes: Record<string, unknown>, request?: Request) {
  stringifyWire(changes);
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType, entityId, action, changes,
    ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: request?.headers.get("user-agent") ?? null });
}
export async function approvalMembers(tx: ApprovalTx, orgId: string, ids: string[]) {
  if (!ids.length) return;
  const unique = [...new Set(ids)];
  const found = await tx.select({ id: member.id }).from(member).where(and(eq(member.organizationId, orgId), inArray(member.id, unique))).for("share");
  if (found.length !== unique.length) throw new AuthError("Approval member must belong to this organization", 404);
}
