import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, customRole, advisorAccess, users, apiKey, mcpAccessToken, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { ALL_PERMISSIONS, getEffectiveLimits } from "@/lib/plans";
import { subscription } from "@/lib/db/schema/billing";
import { requireRole } from "./require-role";

/** Persist only this server-created reference, never a bearer secret or role snapshot.
 * Re-resolve it before each dispatch/retry/resumed approval. Model input is not a reference.
 */
export type ExecutionIdentity =
  | { kind: "session"; userId: string; organizationId: string; issuedAt: number; expiresAt: number }
  | { kind: "api-key" | "mcp"; userId: string; organizationId: string; credentialId: string };

const identities = new WeakMap<AuthContext, Readonly<ExecutionIdentity>>();

export function bindExecutionIdentity(ctx: AuthContext, identity: ExecutionIdentity): AuthContext {
  identities.set(ctx, Object.freeze({ ...identity }));
  return ctx;
}

export function executionIdentity(ctx: AuthContext): Readonly<ExecutionIdentity> {
  const identity = identities.get(ctx);
  if (!identity) throw new AuthError("Credential reference required", 401);
  return identity;
}

export async function assertCurrentSession(userId: string, issuedAt: number, expiresAt: number): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, sessionRevokedAt: true } });
  if (!user || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now() ||
    (user.sessionRevokedAt && issuedAt <= user.sessionRevokedAt.getTime())) {
    throw new AuthError("Session expired. Please sign in again.", 401);
  }
}

/** Both transports resolve custom roles from current organization membership. */
export async function resolveMembership(userId: string, organizationId: string, allowAdvisor = false): Promise<AuthContext> {
  const org = await db.query.organization.findFirst({ where: and(eq(organization.id, organizationId), isNull(organization.deletedAt)), columns: { id: true } });
  if (!org) throw new AuthError("Organization not found", 403);
  const mem = await db.query.member.findFirst({ where: and(eq(member.userId, userId), eq(member.organizationId, organizationId)) });
  if (!mem) {
    if (allowAdvisor) {
      const grant = await db.query.advisorAccess.findFirst({ where: and(eq(advisorAccess.advisorUserId, userId), eq(advisorAccess.organizationId, organizationId)) });
      if (grant?.isActive && grant.acceptedAt && !grant.revokedAt) {
        // External advisors have no implicit organization administration rights.
        // Auditor and tax-advisor access is read-only; bookkeeping access is explicit.
        const permissions = ["view:data"];
        if (grant.role === "accountant" || grant.role === "bookkeeper") {
          permissions.push("create:entries", "edit:entries", "manage:contacts", "manage:invoices", "manage:bills", "manage:expenses", "manage:payments");
        }
        return { userId, organizationId, role: "member", isAdvisor: true, advisorRole: grant.role, permissions };
      }
    }
    throw new AuthError("Not a member of this organization", 403);
  }
  const ctx: AuthContext = { userId, organizationId, role: mem.role };
  if (mem.customRoleId) {
    const role = await db.query.customRole.findFirst({ where: and(eq(customRole.id, mem.customRoleId), eq(customRole.organizationId, organizationId)) });
    if (!role || !Array.isArray(role.permissions) || !role.permissions.every(p => typeof p === "string")) {
      throw new AuthError("Invalid organization role", 403);
    }
    ctx.customRoleId = role.id;
    ctx.permissions = role.permissions;
  }
  return ctx;
}

export async function resolveExecutionIdentity(identity: Readonly<ExecutionIdentity>): Promise<AuthContext> {
  const user = await db.query.users.findFirst({ where: eq(users.id, identity.userId), columns: { id: true, sessionRevokedAt: true } });
  if (!user) throw new AuthError("Invalid identity", 401);
  if (identity.kind === "session") {
    await assertCurrentSession(identity.userId, identity.issuedAt, identity.expiresAt);
  } else {
    const credential = identity.kind === "api-key"
      ? await db.query.apiKey.findFirst({ where: eq(apiKey.id, identity.credentialId) })
      : await db.query.mcpAccessToken.findFirst({ where: eq(mcpAccessToken.id, identity.credentialId) });
    if (!credential || credential.organizationId !== identity.organizationId ||
      ("createdBy" in credential ? credential.createdBy : credential.userId) !== identity.userId ||
      (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
      throw new AuthError("Invalid or expired credential", 401);
    }
    if (identity.kind === "api-key") {
      const sub = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, identity.organizationId) });
      if (!getEffectiveLimits(sub ?? null).apiAccess) throw new AuthError("API access requires a Pro or Business plan", 403);
    }
  }
  return bindExecutionIdentity(await resolveMembership(identity.userId, identity.organizationId, identity.kind === "session"), { ...identity });
}

/** Agent dispatch/retry/resume must supply its server-owned scope and operation
 * permission. Domain services must still validate every referenced resource ID.
 * This never grants global site administration or authorizes an approval itself.
 */
export async function authorizeExecution(identity: Readonly<ExecutionIdentity>, organizationId: string, permission: string): Promise<AuthContext> {
  if (identity.organizationId !== organizationId) throw new AuthError("Execution organization mismatch", 403);
  if (!ALL_PERMISSIONS.includes(permission)) throw new AuthError("Unknown execution permission", 403);
  const ctx = await resolveExecutionIdentity(identity);
  requireRole(ctx, permission);
  return ctx;
}

/** Existing tool closures retain ctx, so refresh its effective grants before invoking them.
 * Only authenticated contexts carry a credential binding. Internal callers still own their
 * trusted context and domain authorization; agent execution must use resolveExecutionIdentity.
 */
export async function revalidateToolIdentity(ctx: AuthContext): Promise<void> {
  const identity = identities.get(ctx);
  if (!identity) return;
  if (ctx.userId !== identity.userId || ctx.organizationId !== identity.organizationId) throw new AuthError("Identity scope changed", 403);
  const current = await resolveExecutionIdentity(identity);
  delete ctx.permissions;
  delete ctx.customRoleId;
  delete ctx.isAdvisor;
  delete ctx.advisorRole;
  Object.assign(ctx, current);
}
