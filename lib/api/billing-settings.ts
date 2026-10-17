import { db } from "@/lib/db";
import { subscription, document, documentEmailLog } from "@/lib/db/schema";
import { eq, and, isNull, sql, gte } from "drizzle-orm";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { stripe } from "@/lib/stripe";
import { PLAN_LIMITS, STORAGE_PLANS, type PlanName, type StoragePlanName } from "@/lib/plans";

export async function readBillingSettings(ctx: AuthContext) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [sub, storageResult, emailCountResult] = await Promise.all([
      db.query.subscription.findFirst({
        where: eq(subscription.organizationId, ctx.organizationId),
      }),
      db
        .select({ totalBytes: sql<number>`coalesce(sum(${document.fileSize}), 0)` })
        .from(document)
        .where(
          and(
            eq(document.organizationId, ctx.organizationId),
            isNull(document.deletedAt)
          )
        ),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(documentEmailLog)
        .where(
          and(
            eq(documentEmailLog.organizationId, ctx.organizationId),
            eq(documentEmailLog.status, "sent"),
            gte(documentEmailLog.sentAt, monthStart)
          )
        ),
    ]);

    const storageUsedBytes = Number(storageResult[0]?.totalBytes ?? 0);
    const emailsSentThisMonth = emailCountResult[0]?.count ?? 0;

    const plan = (sub?.plan ?? "free") as PlanName;
    const storagePlan = (sub?.storagePlan ?? "free") as StoragePlanName;

    // Email limit: storage plan overrides if not on free storage, otherwise use team plan limit
    const emailsPerMonth = storagePlan !== "free"
      ? STORAGE_PLANS[storagePlan].emailsPerMonth
      : PLAN_LIMITS[plan].emailsPerMonth;

    const selfHosted = !process.env.STRIPE_SECRET_KEY;

    return {
      selfHosted,
      billing: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            seatCount: sub.seatCount,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            billingInterval: sub.billingInterval || "monthly",
            storagePlan,
            storageFilesMb: STORAGE_PLANS[storagePlan].filesMb,
            emailsPerMonth,
            emailsSentThisMonth,
            storageUsedBytes,
          }
        : {
            plan: "free" as const,
            status: "active",
            seatCount: 1,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            billingInterval: "monthly" as const,
            storagePlan: "free" as const,
            storageFilesMb: STORAGE_PLANS.free.filesMb,
            emailsPerMonth,
            emailsSentThisMonth,
            storageUsedBytes,
          },
     };
}

export async function createBillingPortal(ctx: AuthContext) {
  if (!stripe) throw new AuthError("Billing not configured", 404);
  requireRole(ctx, "manage:billing");
  const sub = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, ctx.organizationId) });
  if (!sub?.stripeCustomerId) throw new AuthError("No billing account found", 404);
  const session = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing` });
  return { url: session.url };
}
