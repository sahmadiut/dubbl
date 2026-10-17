import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeIntegration, chartAccount, bankAccount } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";

export const stripeSettingsSchema = z.object({
  integrationId: z.string().uuid().describe("Live organization-owned Stripe integration UUID"),
  clearingAccountId: z.string().uuid().optional().describe("Live organization-owned clearing ledger account UUID"),
  revenueAccountId: z.string().uuid().optional().describe("Live organization-owned revenue ledger account UUID"),
  feesAccountId: z.string().uuid().optional().describe("Live organization-owned fees ledger account UUID"),
  payoutBankAccountId: z.string().uuid().optional().describe("Live organization-owned payout bank account UUID"),
  initialSyncDays: z.number().int().min(1).max(365).optional().describe("Initial synchronization lookback, 1..365 days"),
});

export async function updateStripeSettings(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:integrations");
  const { integrationId, ...updates } = stripeSettingsSchema.parse(input);
  return db.transaction(async tx => {
    const owned = and(eq(stripeIntegration.id, integrationId), eq(stripeIntegration.organizationId, ctx.organizationId), isNull(stripeIntegration.deletedAt));
    const [integration] = await tx.select({ id: stripeIntegration.id }).from(stripeIntegration).where(owned).for("update");
    if (!integration) throw new AuthError("Stripe integration not found", 404);
    for (const id of [updates.clearingAccountId, updates.revenueAccountId, updates.feesAccountId]) {
      if (id === undefined) continue;
      const [account] = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.id, id),
        eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt))).for("share");
      if (!account) throw new AuthError("Account not found", 404);
    }
    if (updates.payoutBankAccountId !== undefined) {
      const [account] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.id, updates.payoutBankAccountId),
        eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt))).for("share");
      if (!account) throw new AuthError("Bank account not found", 404);
    }
    const [updated] = await tx.update(stripeIntegration).set({ ...updates, updatedAt: new Date() }).where(owned).returning({
      id: stripeIntegration.id, organizationId: stripeIntegration.organizationId,
      clearingAccountId: stripeIntegration.clearingAccountId, revenueAccountId: stripeIntegration.revenueAccountId,
      feesAccountId: stripeIntegration.feesAccountId, payoutBankAccountId: stripeIntegration.payoutBankAccountId,
      initialSyncDays: stripeIntegration.initialSyncDays, updatedAt: stripeIntegration.updatedAt,
    });
    return updated;
  });
}
