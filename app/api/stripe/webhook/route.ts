import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { z } from "zod";
import { settleInvoiceCheckout } from "@/lib/integrations/stripe/checkout";
import { handleError } from "@/lib/api/response";
import { validateStripeObject } from "@/lib/integrations/stripe/money";

function getItemPeriod(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  return {
    start: item ? new Date(item.current_period_start * 1000) : new Date(),
    end: item ? new Date(item.current_period_end * 1000) : new Date(),
  };
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 404 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    validateStripeObject(event.data.object);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organizationId;
        const checkoutType = session.metadata?.type;

        if (orgId && checkoutType === "storage" && session.subscription) {
          // Storage add-on checkout
          const storagePlan = z.enum(["starter", "growth", "scale"]).parse(session.metadata?.storagePlan);
          const stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          validateStripeObject(stripeSubscription);
          const existing = await db.query.subscription.findFirst({
            where: eq(subscription.organizationId, orgId),
          });

          const storageData = {
            storagePlan,
            stripeStorageSubscriptionId: stripeSubscription.id,
            stripeStoragePriceId: stripeSubscription.items.data[0].price.id,
            stripeCustomerId: session.customer as string,
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(subscription)
              .set(storageData)
              .where(eq(subscription.id, existing.id));
          } else {
            await db.insert(subscription).values({
              organizationId: orgId,
              ...storageData,
            });
          }
        } else if (orgId && session.subscription) {
          // Seat plan checkout
          const plan = session.metadata?.plan ? z.literal("pro").parse(session.metadata.plan) : undefined;
          if (plan) {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );

            validateStripeObject(stripeSubscription);
            const existing = await db.query.subscription.findFirst({
              where: eq(subscription.organizationId, orgId),
            });

            const period = getItemPeriod(stripeSubscription);

            const billingInterval = session.metadata?.interval === "annual" ? "annual" : "monthly";

            const data = {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: stripeSubscription.id,
              stripePriceId: stripeSubscription.items.data[0].price.id,
              plan,
              status: "active" as const,
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
              seatCount: stripeSubscription.items.data[0].quantity || 1,
              billingInterval,
              updatedAt: new Date(),
            };

            if (existing) {
              await db
                .update(subscription)
                .set(data)
                .where(eq(subscription.id, existing.id));
            } else {
              await db.insert(subscription).values({
                organizationId: orgId,
                ...data,
              });
            }
          }
        }

        await settleInvoiceCheckout(session);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const period = getItemPeriod(sub);

        // Check if this is a storage subscription
        const storageMatch = await db.query.subscription.findFirst({
          where: eq(subscription.stripeStorageSubscriptionId, sub.id),
        });

        if (storageMatch) {
          if (sub.status === "active") {
            // Storage subscription updated (upgrade/downgrade) - update price ID
            await db
              .update(subscription)
              .set({
                stripeStoragePriceId: sub.items.data[0]?.price.id || null,
                updatedAt: new Date(),
              })
              .where(eq(subscription.id, storageMatch.id));
          } else if (sub.status === "canceled") {
            await db
              .update(subscription)
              .set({
                storagePlan: "free",
                stripeStorageSubscriptionId: null,
                stripeStoragePriceId: null,
                updatedAt: new Date(),
              })
              .where(eq(subscription.id, storageMatch.id));
          }
        } else {
          // Seat subscription update
          await db
            .update(subscription)
            .set({
              status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled",
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              seatCount: sub.items.data[0].quantity || 1,
              updatedAt: new Date(),
            })
            .where(eq(subscription.stripeSubscriptionId, sub.id));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        // Check if this is a storage subscription
        const storageMatch = await db.query.subscription.findFirst({
          where: eq(subscription.stripeStorageSubscriptionId, sub.id),
        });

        if (storageMatch) {
          await db
            .update(subscription)
            .set({
              storagePlan: "free",
              stripeStorageSubscriptionId: null,
              stripeStoragePriceId: null,
              updatedAt: new Date(),
            })
            .where(eq(subscription.id, storageMatch.id));
        } else {
          await db
            .update(subscription)
            .set({
              status: "canceled",
              plan: "free",
              updatedAt: new Date(),
            })
            .where(eq(subscription.stripeSubscriptionId, sub.id));
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) { return handleError(err); }
}
