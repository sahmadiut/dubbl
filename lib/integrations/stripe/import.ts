import type Stripe from "stripe";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { WireCompatibilityError } from "@/lib/money/wire";
import { parseStripePaymentsCsv, parseStripePayoutsCsv } from "./csv-parser";
import { handleChargeSucceeded, handlePayoutPaid } from "./sync";
import type { stripeIntegration } from "@/lib/db/schema";

export async function importStripeCsv(integration: typeof stripeIntegration.$inferSelect, text: string, inputType: unknown) {
  const type = z.enum(["payments", "payouts"]).parse(inputType);
  // Validate the entire input before any row, contact, mapping or chart-account write.
  const rows = type === "payments" ? parseStripePaymentsCsv(text) : parseStripePayoutsCsv(text);
  const org = await db.query.organization.findFirst({ where: eq(organization.id, integration.organizationId) });
  if (rows.some(row => row.currency !== org?.defaultCurrency)) throw new WireCompatibilityError("Stripe import requires the organization's functional currency; no implicit FX");
  let imported = 0, skipped = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const existing = await db.query.stripeEntityMap.findFirst({ where: (map, { and, eq }) => and(
      eq(map.organizationId, integration.organizationId), eq(map.stripeEntityType, type === "payments" ? "charge" : "payout"), eq(map.stripeEntityId, row.id),
    ) });
    if (existing) { skipped++; continue; }
    try {
      if ("fee" in row) {
        if (row.fee < 0) throw new WireCompatibilityError("Charge CSV fee must be nonnegative");
        const charge = {
          id: row.id, object: "charge", amount: row.amount, currency: row.currency.toLowerCase(),
          created: row.createdUtc ? Math.floor(Date.parse(row.createdUtc) / 1000) : Math.floor(Date.now() / 1000),
          balance_transaction: { object: "balance_transaction", amount: row.amount, fee: row.fee, net: row.net, currency: row.currency.toLowerCase() },
          payment_intent: null, customer: null, billing_details: { email: row.customerEmail, name: row.customerName },
        } as unknown as Stripe.Charge;
        await handleChargeSucceeded(integration, charge);
      } else {
        await handlePayoutPaid(integration, { id: row.id, object: "payout", amount: row.amount, currency: row.currency.toLowerCase(),
          arrival_date: row.arrivalDate ? Math.floor(Date.parse(row.arrivalDate) / 1000) : Math.floor(Date.now() / 1000) } as Stripe.Payout);
      }
      imported++;
    } catch (err) { errors.push(`${row.id}: ${err instanceof Error ? err.message : "Unknown error"}`); }
  }
  return { imported, skipped, errors };
}
