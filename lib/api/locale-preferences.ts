import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, member, organization, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { localePreferencesSchema } from "@/i18n/preferences-schema";
import { diffChanges } from "./audit";

const columns = { language: true, timeZone: true, numerals: true, calendar: true, fontFamily: true } as const;

// A client-supplied org cookie cannot expose another tenant's defaults. Without
// a selection, a sole live membership is unambiguous; multiple orgs need selection.
export async function loadPresentationPreferences(userId: string, organizationId?: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns });
  let organizationLanguage: string | null | undefined;
  if (z.uuid().safeParse(organizationId).success) {
    const [selected] = await db.select({ language: organization.defaultLanguage }).from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId!), isNull(organization.deletedAt))).limit(1);
    organizationLanguage = selected?.language;
  } else if (organizationId === undefined) {
    const memberships = await db.select({ language: organization.defaultLanguage }).from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(and(eq(member.userId, userId), isNull(organization.deletedAt))).limit(2);
    if (memberships.length === 1) organizationLanguage = memberships[0].language;
  }
  return { user, organizationLanguage };
}

async function assertMembership(ctx: AuthContext) {
  const [membership] = await db.select({ id: member.id }).from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, ctx.userId), eq(member.organizationId, ctx.organizationId), isNull(organization.deletedAt))).limit(1);
  if (!membership) throw new AuthError("Organization membership required", 403);
}

export async function getLocalePreferences(ctx: AuthContext) {
  await assertMembership(ctx);
  const preferences = await db.query.users.findFirst({ where: eq(users.id, ctx.userId), columns });
  if (!preferences) throw new AuthError("User not found", 404);
  return { preferences };
}

export async function updateLocalePreferences(ctx: AuthContext, input: unknown) {
  const parsed = localePreferencesSchema.parse(input);
  await assertMembership(ctx);
  return db.transaction(async tx => {
    const [before] = await tx.select({ language: users.language, timeZone: users.timeZone, numerals: users.numerals, calendar: users.calendar, fontFamily: users.fontFamily })
      .from(users).where(eq(users.id, ctx.userId)).for("update");
    if (!before) throw new AuthError("User not found", 404);
    const [preferences] = await tx.update(users).set(parsed).where(eq(users.id, ctx.userId))
      .returning({ language: users.language, timeZone: users.timeZone, numerals: users.numerals, calendar: users.calendar, fontFamily: users.fontFamily });
    await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId,
      action: "update", entityType: "locale_preferences", entityId: ctx.userId, changes: diffChanges(before, preferences) ?? null });
    return { preferences };
  });
}
