import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, apiKey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import type { MemberRole } from "@/lib/plans";
import { resolveExecutionIdentity } from "./execution-identity";

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: MemberRole;
  customRoleId?: string;
  permissions?: string[];
  isAdvisor?: boolean;
  advisorRole?: string;
}

export async function getAuthContext(request: Request, organizationId?: string): Promise<AuthContext> {
  const authHeader = request.headers.get("authorization");
  const requestedOrg = organizationId || request.headers.get("x-organization-id");
  if (authHeader?.startsWith("Bearer dk_")) {
    const hash = createHash("sha256").update(authHeader.slice(7)).digest("hex");
    const key = await db.query.apiKey.findFirst({ where: eq(apiKey.keyHash, hash) });
    if (!key) throw new AuthError("Invalid API key", 401);
    // API keys always pin the organization. Preserve the existing contract that
    // ignores UI selection headers; an explicit server-required scope must match.
    if (organizationId && organizationId !== key.organizationId) throw new AuthError("Credential organization mismatch", 403);
    const ctx = await resolveExecutionIdentity({ kind: "api-key", userId: key.createdBy, organizationId: key.organizationId, credentialId: key.id });
    db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, key.id)).execute().catch(() => {});
    return ctx;
  }
  if (authHeader) throw new AuthError("Invalid authorization credential", 401);
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("Not authenticated", 401);
  let orgId = requestedOrg;
  if (!orgId) {
    const memberships = await db.query.member.findMany({ where: eq(member.userId, session.user.id) });
    if (!memberships.length) throw new AuthError("Not a member of any organization", 403);
    if (memberships.length > 1) throw new AuthError("Organization ID required when user belongs to multiple organizations", 400);
    orgId = memberships[0].organizationId;
  }
  const issuedAt = (session as unknown as { iat?: number }).iat;
  return resolveExecutionIdentity({ kind: "session", userId: session.user.id, organizationId: orgId,
    issuedAt: typeof issuedAt === "number" ? issuedAt * 1000 : NaN, expiresAt: Date.parse(session.expires) });
}

export class AuthError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
