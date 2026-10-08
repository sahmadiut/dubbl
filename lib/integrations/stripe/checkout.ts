import type Stripe from "stripe";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoice, payment, paymentAllocation, contact } from "@/lib/db/schema";
import { z } from "zod";
import { checkoutAmount, stripeMinor } from "./money";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { stripe } from "@/lib/stripe";
import { AuthError } from "@/lib/api/auth-context";
import { assertNotLocked } from "@/lib/api/period-lock";

/** The verified provider total must pay exactly the scoped invoice balance. */
export async function settleInvoiceCheckout(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  const orgId = session.metadata?.organizationId;
  const token = session.metadata?.paymentLinkToken;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!orgId || !token || !pi) throw new WireCompatibilityError("Invoice checkout is missing scoped payment metadata");
  z.string().uuid().parse(orgId);
  z.string().uuid().parse(invoiceId);
  z.string().min(1).parse(session.id);
  const amount = checkoutAmount(session.amount_total, session.currency);
  if (session.metadata?.amountMinor !== undefined && BigInt(exactMinorSchema.parse(session.metadata.amountMinor)) !== BigInt(amount)) {
    throw new WireCompatibilityError("Stripe checkout amount differs from its invoice snapshot");
  }
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${orgId}, 31))`);
    const [inv] = await tx.select().from(invoice).where(and(eq(invoice.id, invoiceId), eq(invoice.organizationId, orgId),
      eq(invoice.paymentLinkToken, token), isNull(invoice.deletedAt))).for("update");
    if (!inv) throw new WireCompatibilityError("Invoice checkout metadata does not identify a payable invoice");
    const existing = await tx.query.payment.findFirst({ where: and(eq(payment.organizationId, orgId), eq(payment.stripePaymentIntentId, pi)) });
    if (existing) {
      const allocation = await tx.query.paymentAllocation.findFirst({ where: and(eq(paymentAllocation.paymentId, existing.id),
        eq(paymentAllocation.documentType, "invoice"), eq(paymentAllocation.documentId, inv.id)) });
      if (!allocation || existing.amount !== amount || existing.currencyCode.toLowerCase() !== session.currency) {
        throw new WireCompatibilityError("Stripe payment intent is already recorded with a different allocation or amount");
      }
      return { skipped: true };
    }
    if (inv.status === "paid") throw new WireCompatibilityError("A new Stripe payment cannot settle an already-paid invoice");
    if (["void", "draft"].includes(inv.status) || inv.currencyCode.toLowerCase() !== session.currency || stripeMinor(inv.amountDue) !== amount) {
      throw new WireCompatibilityError("Stripe checkout currency or total does not match the current invoice balance");
    }
    const amountPaid = legacyMinor(BigInt(stripeMinor(inv.amountPaid)) + BigInt(amount));
    if (amountPaid !== stripeMinor(inv.total)) throw new WireCompatibilityError("Invoice paid and due balances do not conserve its total");
    if (!await tx.query.contact.findFirst({ where: and(eq(contact.id, inv.contactId), eq(contact.organizationId, orgId), isNull(contact.deletedAt)) })) {
      throw new WireCompatibilityError("Invoice checkout contact is outside this organization");
    }
    const date = new Date().toISOString().slice(0, 10);
    await assertNotLocked(orgId, date, undefined, tx);
    const [saved] = await tx.insert(payment).values({ organizationId: orgId, contactId: inv.contactId,
      paymentNumber: `PMT-${session.id}`, type: "received", date, amount, method: "card",
      reference: `Stripe: ${pi}`, currencyCode: inv.currencyCode, stripePaymentIntentId: pi }).returning();
    await tx.insert(paymentAllocation).values({ paymentId: saved.id, documentType: "invoice", documentId: inv.id, amount });
    await tx.update(invoice).set({ amountPaid, amountDue: 0, status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoice.id, inv.id), eq(invoice.organizationId, orgId)));
    return { paymentId: saved.id };
  });
}

export async function createInvoiceCheckout(token: string, baseUrl: string, organizationId?: string) {
  if (!stripe) throw new AuthError("Billing not configured", 404);
  const inv = await db.query.invoice.findFirst({
    where: and(
      eq(invoice.paymentLinkToken, token),
      isNull(invoice.deletedAt),
      ...(organizationId ? [eq(invoice.organizationId, organizationId)] : [])
    ),
    with: { organization: true },
  });

  if (!inv || inv.status === "paid" || inv.status === "void" || inv.status === "draft") {
    throw new AuthError("Invoice not payable", 400);
  }

  const amount = checkoutAmount(inv.amountDue, inv.currencyCode);
  baseUrl = new URL(baseUrl).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: inv.currencyCode.toLowerCase(),
          product_data: {
            name: `Invoice ${inv.invoiceNumber}`,
            description: `Payment to ${inv.organization.name}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: inv.id,
      organizationId: inv.organizationId,
      paymentLinkToken: token,
      amountMinor: String(amount),
    },
    success_url: `${baseUrl}/pay/${token}?status=success`,
    cancel_url: `${baseUrl}/pay/${token}?status=cancelled`,
  });

  return { checkoutUrl: session.url };
}
