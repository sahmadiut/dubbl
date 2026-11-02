import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AuthError, getAuthContext } from "./auth-context";
import { assertSiteAdminUser } from "./admin-organization";
import { assertCurrentSession } from "./execution-identity";

export type SiteSessionContext = Readonly<{ kind: "site-session"; userId: string }>;
const siteSessions = new WeakMap<SiteSessionContext, { issuedAt: number; expiresAt: number }>();

/** Site authority has no organization or role snapshot and cannot be supplied by a tool input. */
export async function assertSiteSession(ctx: SiteSessionContext): Promise<void> {
  const binding = siteSessions.get(ctx);
  if (!binding) throw new AuthError("Verified site administrator session required", 401);
  await assertCurrentSession(ctx.userId, binding.issuedAt, binding.expiresAt);
  const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId), columns: { isSiteAdmin: true } });
  if (!user?.isSiteAdmin) throw new AuthError("Site admin access required", 403);
}

export async function getSiteSessionContext(request?: Request): Promise<SiteSessionContext> {
  // Never fall back to a cookie when an organization credential is supplied.
  if (request?.headers.has("authorization")) throw new AuthError("Site administrator session required; bearer credentials are organization scoped", 403);
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("Not authenticated", 401);
  const issuedAt = (session as unknown as { iat?: number }).iat;
  const ctx: SiteSessionContext = Object.freeze({ kind: "site-session", userId: session.user.id });
  siteSessions.set(ctx, { issuedAt: typeof issuedAt === "number" ? issuedAt * 1000 : NaN, expiresAt: Date.parse(session.expires) });
  await assertSiteSession(ctx);
  return ctx;
}

/**
 * Verify the current session user is a site admin.
 * Returns the userId on success, or a NextResponse error.
 */
export async function requireSiteAdmin(request?: Request): Promise<
  { userId: string; organizationId?: string } | NextResponse
> {
  // API credentials retain their organization scope even for a site administrator.
  if (request?.headers.get("authorization")?.startsWith("Bearer dk_")) {
    const ctx = await getAuthContext(request);
    await assertSiteAdminUser(ctx.userId);
    return { userId: ctx.userId, organizationId: ctx.organizationId };
  }
  try {
    return { userId: (await getSiteSessionContext(request)).userId };
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
