import { jsonResponse } from "@/lib/api/json-response";
import { db } from "@/lib/db";
import { organization, member, users, subscription, auditLog } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getAuthContext } from "@/lib/api/auth-context";
import { z } from "zod";
import { randomUUID } from "crypto";
import { checkOrganizationLimit } from "@/lib/api/check-limit";
import { getSiteSetting, isSelfHostedUnlimited } from "@/lib/site-settings";
import { render } from "@react-email/render";
import { createElement } from "react";
import { OrgCreatedEmail } from "@/lib/email/templates/org-created";
import { sendPlatformEmail } from "@/lib/email/resend-client";
import { toAppUrl } from "@/lib/public-url";

import { handleError, ok } from "@/lib/api/response";
import { organizationDto, readOrganizationJson } from "@/lib/api/organization-wire";
import { getOrganization, updateOrganizationSettings } from "@/lib/api/organization-settings";

const createSchema = z.object({
  name: z.string().min(1).describe("Organization display name"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).describe("Unique lowercase alphanumeric and hyphen slug"),
}).strict();

export async function GET(request: Request) {
  try {
    // A scoped header or API key selects the authenticated organization.
    const orgId = request.headers.get("x-organization-id");
    if (orgId || request.headers.get("authorization")?.startsWith("Bearer dk_")) {
      const ctx = await getAuthContext(request);
      return ok(await getOrganization(ctx));
    }

    // Otherwise list all orgs for the session user
    const session = await auth();
    if (!session?.user?.id) {
      return jsonResponse({ error: "Not authenticated" }, { status: 401 });
    }

    const memberships = (await db.query.member.findMany({
      where: eq(member.userId, session.user.id),
      with: { organization: true },
    })).filter(m => m.organization.deletedAt === null);

    // Enrich with role and member count
    const orgIds = memberships.map((m) => m.organizationId);
    let memberCounts: Record<string, number> = {};

    if (orgIds.length > 0) {
      const counts = await db
        .select({
          organizationId: member.organizationId,
          count: sql<number>`count(*)::int`,
        })
        .from(member)
        .where(
          sql`${member.organizationId} IN ${orgIds}`
        )
        .groupBy(member.organizationId);
      memberCounts = Object.fromEntries(
        counts.map((c) => [c.organizationId, c.count])
      );
    }

    return ok({
      organizations: memberships.map((m) => ({
        ...organizationDto(m.organization),
        role: m.role,
        memberCount: memberCounts[m.organizationId] || 1,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonResponse({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await readOrganizationJson(request);
    const parsed = createSchema.parse(body);

    // Check if user is allowed to create organizations
    const allowUserOrgCreation = await getSiteSetting("allow_user_org_creation");
    if (allowUserOrgCreation !== "true") {
      const [user, existingMembership] = await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, session.user.id),
          columns: { isSiteAdmin: true },
        }),
        db.query.member.findFirst({
          where: eq(member.userId, session.user.id),
          columns: { id: true },
        }),
      ]);

      if (!user?.isSiteAdmin && existingMembership) {
        return jsonResponse(
          { error: "Only administrators can create organizations" },
          { status: 403 }
        );
      }
    }

    // Check org limit
    await checkOrganizationLimit(session.user.id);

    // Check slug uniqueness
    const existing = await db.query.organization.findFirst({
      where: eq(organization.slug, parsed.slug),
    });
    if (existing) {
      return jsonResponse({ error: "Slug already taken" }, { status: 409 });
    }

    // Create org + owner membership + subscription in a transaction
    const orgId = randomUUID();
    const created = await db.transaction(async (tx) => {
      const [org] = await tx.insert(organization).values({
        id: orgId,
        name: parsed.name,
        slug: parsed.slug,
      }).returning();
      await tx.insert(member).values({
        organizationId: orgId,
        userId: session.user!.id!,
        role: "owner",
      });
      const selfHosted = isSelfHostedUnlimited();
      await tx.insert(subscription).values({
        organizationId: orgId,
        plan: selfHosted ? "pro" : "free",
        status: "active",
        ...(selfHosted ? { managedBy: "manual" } : {}),
      });
      const result = organizationDto(org);
      await tx.insert(auditLog).values({ organizationId: orgId, userId: session.user!.id!, action: "create",
        entityType: "organization", entityId: orgId,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
        userAgent: request.headers.get("user-agent") || null });
      return result;
    });

    // Send org-created email (fire and forget)
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user!.id!),
    });
    if (user) {
      render(createElement(OrgCreatedEmail, { userName: user.name || "there", orgName: parsed.name, dashboardUrl: toAppUrl("/dashboard") }))
        .then((html) => sendPlatformEmail({ to: user.email, subject: `${parsed.name} is ready`, html }))
        .catch(() => {});
    }

    return jsonResponse({ organization: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request) {
  try { return ok(await updateOrganizationSettings(await getAuthContext(request), await readOrganizationJson(request), request)); }
  catch (err) { return handleError(err); }
}
