import { db } from "@/lib/db";
import { subscription, organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { stripe as _stripeClient } from "@/lib/stripe";

// The service guards configuration before calling helpers.
const stripe = _stripeClient!;
import { z } from "zod";

export const billingCheckoutSchema = z.object({
  type: z.enum(["seats", "storage"]).default("seats").describe("Seat plan or storage add-on"),
  plan: z.string().min(1).describe("pro for seats; starter, growth or scale for storage"),
  interval: z.enum(["monthly", "annual"]).default("monthly").describe("Billing interval"),
}).strict();

export async function createBillingCheckout(ctx: AuthContext, input: unknown) {
  if (!_stripeClient) {
    throw new AuthError("Billing not configured", 404);
  }

  requireRole(ctx, "manage:billing");

  const { type, plan, interval } = billingCheckoutSchema.parse(input);

  if ((type === "seats" && plan !== "pro") || (type === "storage" && !["starter", "growth", "scale"].includes(plan))) {
    throw new AuthError("Invalid plan", 400);
  }
  const envPrice = type === "seats" ? (interval === "annual" ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID)
    : process.env[`STRIPE_STORAGE_${plan.toUpperCase()}_${interval === "annual" ? "ANNUAL_" : ""}PRICE_ID`];
  if (!envPrice) throw new AuthError("Plan price not configured", 400);
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, ctx.organizationId),
  });

  if (!org) {
    throw new AuthError("Organization not found", 404);
  }

  // Get or create stripe customer
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, ctx.organizationId),
  });

  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organizationId: ctx.organizationId },
    });
    customerId = customer.id;
  }

  if (type === "storage") {
    return handleStorageCheckout(sub, customerId, ctx.organizationId, plan, interval);
  } else {
    return handleSeatCheckout(sub, customerId, ctx.organizationId, plan, interval);
  }
}

async function handleSeatCheckout(
  sub: typeof subscription.$inferSelect | undefined,
  customerId: string,
  organizationId: string,
  plan: string,
  interval: string
) {
  if (plan !== "pro") {
    throw new AuthError("Invalid plan", 400);
  }

  const priceId = interval === "annual"
    ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID!
    : process.env.STRIPE_PRO_PRICE_ID!;

  // If already has an active seat subscription, update it instead of creating new
  if (sub?.stripeSubscriptionId && sub.status === "active") {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const currentItem = stripeSub.items.data[0];

    if (currentItem) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: currentItem.id, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { organizationId, type: "seats", plan, interval },
      });

      // Update local DB
      await db
        .update(subscription)
        .set({
          plan: plan as "pro",
          stripePriceId: priceId,
          billingInterval: interval,
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, sub.id));

      return { updated: true };
    }
  }

  // New subscription - create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    automatic_tax: { enabled: true },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    metadata: { organizationId, type: "seats", plan, interval },
  });

  return { url: session.url };
}

async function handleStorageCheckout(
  sub: typeof subscription.$inferSelect | undefined,
  customerId: string,
  organizationId: string,
  plan: string,
  interval: string
) {
  const storagePriceMap: Record<string, Record<string, string | undefined>> = {
    starter: {
      monthly: process.env.STRIPE_STORAGE_STARTER_PRICE_ID,
      annual: process.env.STRIPE_STORAGE_STARTER_ANNUAL_PRICE_ID,
    },
    growth: {
      monthly: process.env.STRIPE_STORAGE_GROWTH_PRICE_ID,
      annual: process.env.STRIPE_STORAGE_GROWTH_ANNUAL_PRICE_ID,
    },
    scale: {
      monthly: process.env.STRIPE_STORAGE_SCALE_PRICE_ID,
      annual: process.env.STRIPE_STORAGE_SCALE_ANNUAL_PRICE_ID,
    },
  };

  const storagePriceId = storagePriceMap[plan]?.[interval];
  if (!storagePriceId) {
    throw new AuthError("Invalid storage plan", 400);
  }

  // If already has an active storage subscription, update it
  if (sub?.stripeStorageSubscriptionId) {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeStorageSubscriptionId);
    const currentItem = stripeSub.items.data[0];

    if (currentItem && stripeSub.status === "active") {
      await stripe.subscriptions.update(sub.stripeStorageSubscriptionId, {
        items: [{ id: currentItem.id, price: storagePriceId }],
        proration_behavior: "create_prorations",
        metadata: { organizationId, type: "storage", storagePlan: plan, interval },
      });

      // Update local DB
      await db
        .update(subscription)
        .set({
          storagePlan: plan as "starter" | "growth" | "scale",
          stripeStoragePriceId: storagePriceId,
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, sub.id));

      return { updated: true };
    }
  }

  // New storage subscription - create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    automatic_tax: { enabled: true },
    line_items: [{ price: storagePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    metadata: { organizationId, type: "storage", storagePlan: plan, interval },
  });

  return { url: session.url };
}
