import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, subscription, member, users } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { PLAN_LIMITS, getEffectiveLimits, type PlanName } from "@/lib/plans";
import { stringifyWire } from "@/lib/money/wire";

const count = z.number().int().min(0).max(2147483647);
// Preserve the admin form's canonical decimal strings and empty reset; no arbitrary coercion.
const override = z.union([count, z.string().regex(/^(0|[1-9]\d{0,9})$/).transform(Number).pipe(count),
  z.literal("").transform(() => null), z.null()]);
export const adminSubscriptionSchema = z.strictObject({
  plan: z.enum(["free", "pro"]).optional().describe("Subscription plan; no price input"),
  status: z.enum(["active", "canceled", "past_due", "trialing", "incomplete"]).optional().describe("Subscription status"),
  seatCount: count.min(1).optional().describe("Seat count from 1 through 2147483647"),
  customPlanName: z.string().max(10000).optional().describe("Custom plan label; empty clears"),
  managedBy: z.enum(["stripe", "manual"]).optional().describe("Existing subscription management mode"),
  adminNotes: z.string().max(10000).optional().describe("Administrative notes; empty clears"),
  overrideMembers: override.optional().describe("Member count; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideStorageMb: override.optional().describe("Storage megabytes; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideContacts: override.optional().describe("Contact count; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideInvoicesPerMonth: override.optional().describe("Monthly invoice count; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideProjects: override.optional().describe("Project count; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideBankAccounts: override.optional().describe("Bank account count; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideEntriesPerMonth: override.optional().describe("Monthly entry count; nonnegative int32 or canonical decimal text; null/empty resets"),
  overrideMultiCurrency: z.boolean().nullable().optional().describe("Boolean multi-currency override; null resets"),
  storagePlan: z.enum(["free", "starter", "growth", "scale"]).optional().describe("Storage plan"),
}).refine(v => Object.keys(v).length > 0, "Provide at least one subscription field");

export async function assertSiteAdminUser(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isSiteAdmin: true } });
  if (!user?.isSiteAdmin) throw new AuthError("Site admin access required", 403);
}

export function assertAdminOrganizationScope(id: string, scopedOrganizationId?: string) {
  z.string().uuid().parse(id);
  if (scopedOrganizationId && id !== scopedOrganizationId) throw new AuthError("Organization not found", 404);
}

/** Only plan Infinity sentinels become null (the established unlimited JSON representation). */
function limitDto(limits: object) {
  return Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, value === Infinity ? null : value]));
}

export async function readAdminOrganization(userId: string, id: string, scopedOrganizationId?: string) {
  await assertSiteAdminUser(userId);
  assertAdminOrganizationScope(id, scopedOrganizationId);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, id) });
    if (!org) throw new AuthError("Organization not found", 404);
    const sub = await tx.query.subscription.findFirst({ where: eq(subscription.organizationId, id) });
    const members = await tx.select({ id: member.id, userId: member.userId, role: member.role, createdAt: member.createdAt,
      userName: users.name, userEmail: users.email }).from(member).innerJoin(users, eq(member.userId, users.id)).where(eq(member.organizationId, id));
    const result = {
      organization: { ...org, billApprovalThresholdMinor: org.billApprovalThreshold === null ? null : String(org.billApprovalThreshold),
        mileageRateMinor: org.mileageRate === null ? null : String(org.mileageRate) },
      subscription: sub ?? { plan: "free", status: "active", seatCount: 1, managedBy: "stripe", customPlanName: null, adminNotes: null },
      members, effectiveLimits: limitDto(getEffectiveLimits(sub ?? null)), planDefaults: limitDto(PLAN_LIMITS[(sub?.plan ?? "free") as PlanName]),
    };
    stringifyWire(result);
    return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function updateAdminOrganization(userId: string, id: string, input: unknown, scopedOrganizationId?: string) {
  await assertSiteAdminUser(userId);
  assertAdminOrganizationScope(id, scopedOrganizationId);
  const parsed = adminSubscriptionSchema.parse(input);
  const fields = { ...parsed, ...(parsed.adminNotes !== undefined ? { adminNotes: parsed.adminNotes || null } : {}),
    ...(parsed.customPlanName !== undefined ? { customPlanName: parsed.customPlanName || null } : {}), updatedAt: new Date() };
  stringifyWire(fields);
  return db.transaction(async tx => {
    const [org] = await tx.select({ id: organization.id }).from(organization)
      .where(and(eq(organization.id, id), isNull(organization.deletedAt))).for("update");
    if (!org) throw new AuthError("Organization not found", 404);
    await tx.insert(subscription).values({ organizationId: id, ...fields })
      .onConflictDoUpdate({ target: subscription.organizationId, set: fields });
    return { success: true };
  });
}

export const adminOrganizationForContext = (ctx: AuthContext) => readAdminOrganization(ctx.userId, ctx.organizationId, ctx.organizationId);
