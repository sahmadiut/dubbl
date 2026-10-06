import { lockAssetSnapshot } from "@/lib/api/asset-depreciation";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  fixedAsset,
  depreciationEntry,
  assetRevaluation,
  cwipCost,
  journalEntry,
  journalLine,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import {
  getNextEntryNumber,
  ensureAccountByCode,
  resolveBaseRate,
} from "@/lib/api/journal-automation";
import { calculateMonthlyDepreciation } from "@/lib/fixed-assets/depreciation";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerFixedAssetTools(server: McpServer, ctx: AuthContext) {
  // ─── Dispose ───────────────────────────────────────────────────────
  server.tool(
    "dispose_fixed_asset",
    "Dispose of (sell or write off) a fixed asset. Books a depreciation catch-up to the disposal date (if any remains), then posts the disposal entry: DR accumulated depreciation, CR asset at cost, DR proceeds account for any sale proceeds, and recognizes the balancing gain (CR 4300 Gain on Asset Disposal) or loss (DR 5920 Loss on Asset Disposal). Any revaluation surplus held in equity for the asset is transferred to retained earnings (DR 3400 / CR 3100). Marks the asset 'disposed' with NBV 0. Atomic; GL posts only when the asset + accumulated-depreciation accounts are configured. 'disposalAmount' is sale proceeds in integer cents (0 for a write-off). Returns the updated asset, the realized gain/loss and journalEntryId.",
    {
      assetId: z.string().uuid().describe("UUID of the fixed asset to dispose"),
      disposalAmount: z.number().int().min(0).describe("Sale proceeds in integer cents (0 for a write-off)"),
      date: z.string().min(1).describe("Disposal date (YYYY-MM-DD)"),
      proceedsAccountId: z
        .string()
        .uuid()
        .optional()
        .describe("Chart account UUID where proceeds land; defaults to Undeposited Funds (1250) / Cash (1100)"),
      gainAccountId: z.string().uuid().optional().describe("Override chart account UUID for the disposal gain (default 4300)"),
      lossAccountId: z.string().uuid().optional().describe("Override chart account UUID for the disposal loss (default 5920)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:assets");

        const asset = await db.query.fixedAsset.findFirst({
          where: and(
            eq(fixedAsset.id, params.assetId),
            eq(fixedAsset.organizationId, ctx.organizationId),
            notDeleted(fixedAsset.deletedAt)
          ),
        });
        if (!asset) throw new Error("Fixed asset not found");
        if (asset.status === "disposed") throw new Error("Asset is already disposed");

        const { base: baseCurrency } = await resolveBaseRate(
          ctx.organizationId,
          undefined,
          params.date
        );

        // Depreciation catch-up to the disposal date for an active asset.
        let catchUpAmount = 0;
        if (asset.status === "active") {
          const [priorCount] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(depreciationEntry)
            .where(eq(depreciationEntry.fixedAssetId, asset.id));
          const periodIndex = Number(priorCount?.count ?? 0);

          catchUpAmount = calculateMonthlyDepreciation({
            purchasePrice: asset.purchasePrice,
            residualValue: asset.residualValue,
            usefulLifeMonths: asset.usefulLifeMonths,
            depreciationMethod: asset.depreciationMethod,
            accumulatedDepreciation: asset.accumulatedDepreciation,
            purchaseDate: asset.purchaseDate,
            periodIndex,
            convention: asset.convention,
            inServiceDate: asset.inServiceDate ?? asset.purchaseDate,
            totalExpectedUnits: asset.totalExpectedUnits,
            unitsThisPeriod: undefined,
            periodDate: params.date,
          });
        }

        const result = await db.transaction(async (tx) => {
          await lockAssetSnapshot(tx, ctx, asset);
          let disposalEntryId: string | null = null;
          // Only post when the asset can be balanced.
          if (asset.assetAccountId && asset.accumulatedDepAccountId) {
            // Catch-up entry first so the disposal removes the full accumulated balance.
            if (catchUpAmount > 0) {
              if (asset.depreciationAccountId) {
                const depNumber = await getNextEntryNumber(ctx.organizationId, tx);
                const [depEntry] = await tx
                  .insert(journalEntry)
                  .values({
                    organizationId: ctx.organizationId,
                    entryNumber: depNumber,
                    date: params.date,
                    description: `Disposal depreciation catch-up - ${asset.name} (${asset.assetNumber})`,
                    reference: asset.assetNumber,
                    status: "posted",
                    sourceType: "depreciation",
                    sourceId: asset.id,
                    postedAt: new Date(),
                    createdBy: ctx.userId,
                  })
                  .returning();

                await tx.insert(journalLine).values([
                  {
                    journalEntryId: depEntry.id,
                    accountId: asset.depreciationAccountId,
                    description: `Depreciation catch-up - ${asset.name}`,
                    debitAmount: catchUpAmount,
                    creditAmount: 0,
                  },
                  {
                    journalEntryId: depEntry.id,
                    accountId: asset.accumulatedDepAccountId,
                    description: `Depreciation catch-up - ${asset.name}`,
                    debitAmount: 0,
                    creditAmount: catchUpAmount,
                  },
                ]);

                await tx.insert(depreciationEntry).values({
                  fixedAssetId: asset.id,
                  date: params.date,
                  amount: catchUpAmount,
                  journalEntryId: depEntry.id,
                });
              } else {
                // No expense account to post the catch-up; don't fold it in.
                catchUpAmount = 0;
              }
            }

            const postedAccumulated = asset.accumulatedDepreciation + catchUpAmount;
            const postedNbv = asset.purchasePrice - postedAccumulated;
            const postedGainOrLoss = params.disposalAmount - postedNbv;

            // Resolve proceeds account: override → Undeposited Funds (1250) → Cash (1100).
            let proceedsAccountId = params.proceedsAccountId ?? null;
            if (!proceedsAccountId && params.disposalAmount > 0) {
              const undeposited =
                (await ensureAccountByCode(
                  ctx.organizationId,
                  { code: "1250", name: "Undeposited Funds", type: "asset", subType: "current" },
                  baseCurrency,
                  tx
                )) ??
                (await ensureAccountByCode(
                  ctx.organizationId,
                  { code: "1100", name: "Cash", type: "asset", subType: "current" },
                  baseCurrency,
                  tx
                ));
              proceedsAccountId = undeposited?.id ?? null;
            }
            if (params.disposalAmount > 0 && !proceedsAccountId) {
              throw new Error("Could not resolve a proceeds account for the disposal");
            }

            const number = await getNextEntryNumber(ctx.organizationId, tx);
            const [entry] = await tx
              .insert(journalEntry)
              .values({
                organizationId: ctx.organizationId,
                entryNumber: number,
                date: params.date,
                description: `Disposal - ${asset.name} (${asset.assetNumber})`,
                reference: asset.assetNumber,
                status: "posted",
                sourceType: "disposal",
                sourceId: asset.id,
                postedAt: new Date(),
                createdBy: ctx.userId,
              })
              .returning();
            disposalEntryId = entry.id;

            const lines: (typeof journalLine.$inferInsert)[] = [];

            if (postedAccumulated > 0) {
              lines.push({
                journalEntryId: entry.id,
                accountId: asset.accumulatedDepAccountId,
                description: `Disposal - remove accumulated depreciation - ${asset.name}`,
                debitAmount: postedAccumulated,
                creditAmount: 0,
              });
            }

            lines.push({
              journalEntryId: entry.id,
              accountId: asset.assetAccountId,
              description: `Disposal - remove asset at cost - ${asset.name}`,
              debitAmount: 0,
              creditAmount: asset.purchasePrice,
            });

            if (params.disposalAmount > 0 && proceedsAccountId) {
              lines.push({
                journalEntryId: entry.id,
                accountId: proceedsAccountId,
                description: `Disposal proceeds - ${asset.name}`,
                debitAmount: params.disposalAmount,
                creditAmount: 0,
              });
            }

            if (postedGainOrLoss > 0) {
              let gainAccountId = params.gainAccountId ?? null;
              if (!gainAccountId) {
                const gainAccount = await ensureAccountByCode(
                  ctx.organizationId,
                  { code: "4300", name: "Gain on Asset Disposal", type: "revenue", subType: "other_income" },
                  baseCurrency,
                  tx
                );
                gainAccountId = gainAccount?.id ?? null;
              }
              if (gainAccountId) {
                lines.push({
                  journalEntryId: entry.id,
                  accountId: gainAccountId,
                  description: `Gain on disposal - ${asset.name}`,
                  debitAmount: 0,
                  creditAmount: postedGainOrLoss,
                });
              }
            } else if (postedGainOrLoss < 0) {
              let lossAccountId = params.lossAccountId ?? null;
              if (!lossAccountId) {
                const lossAccount = await ensureAccountByCode(
                  ctx.organizationId,
                  { code: "5920", name: "Loss on Asset Disposal", type: "expense", subType: "other_expense" },
                  baseCurrency,
                  tx
                );
                lossAccountId = lossAccount?.id ?? null;
              }
              if (lossAccountId) {
                lines.push({
                  journalEntryId: entry.id,
                  accountId: lossAccountId,
                  description: `Loss on disposal - ${asset.name}`,
                  debitAmount: Math.abs(postedGainOrLoss),
                  creditAmount: 0,
                });
              }
            }

            await tx.insert(journalLine).values(lines);

            // Transfer revaluation surplus to retained earnings (IAS 16).
            if (asset.revaluationSurplusBalance > 0) {
              const surplusAccount =
                (asset.revaluationReserveAccountId
                  ? { id: asset.revaluationReserveAccountId }
                  : null) ??
                (await ensureAccountByCode(
                  ctx.organizationId,
                  { code: "3400", name: "Revaluation Surplus", type: "equity", subType: "other_equity" },
                  baseCurrency,
                  tx
                ));
              const retainedEarnings = await ensureAccountByCode(
                ctx.organizationId,
                { code: "3100", name: "Retained Earnings", type: "equity", subType: "retained_earnings" },
                baseCurrency,
                tx
              );

              if (surplusAccount?.id && retainedEarnings?.id) {
                const surplusNumber = await getNextEntryNumber(ctx.organizationId, tx);
                const [surplusEntry] = await tx
                  .insert(journalEntry)
                  .values({
                    organizationId: ctx.organizationId,
                    entryNumber: surplusNumber,
                    date: params.date,
                    description: `Disposal - transfer revaluation surplus to retained earnings - ${asset.name} (${asset.assetNumber})`,
                    reference: asset.assetNumber,
                    status: "posted",
                    sourceType: "disposal_revaluation_transfer",
                    sourceId: asset.id,
                    postedAt: new Date(),
                    createdBy: ctx.userId,
                  })
                  .returning();

                await tx.insert(journalLine).values([
                  {
                    journalEntryId: surplusEntry.id,
                    accountId: surplusAccount.id,
                    description: `Transfer revaluation surplus on disposal - ${asset.name}`,
                    debitAmount: asset.revaluationSurplusBalance,
                    creditAmount: 0,
                  },
                  {
                    journalEntryId: surplusEntry.id,
                    accountId: retainedEarnings.id,
                    description: `Realized revaluation surplus on disposal - ${asset.name}`,
                    debitAmount: 0,
                    creditAmount: asset.revaluationSurplusBalance,
                  },
                ]);
              }
            }
          }

          const [row] = await tx
            .update(fixedAsset)
            .set({
              status: "disposed",
              disposalDate: params.date,
              disposalAmount: params.disposalAmount,
              accumulatedDepreciation: asset.accumulatedDepreciation + catchUpAmount,
              netBookValue: 0,
              revaluationSurplusBalance: 0,
              updatedAt: new Date(),
            })
            .where(eq(fixedAsset.id, asset.id))
            .returning();

          return { row, disposalEntryId };
        });

        const finalAccumulated = asset.accumulatedDepreciation + catchUpAmount;
        const gainOrLoss = params.disposalAmount - (asset.purchasePrice - finalAccumulated);

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "dispose",
          entityType: "fixed_asset",
          entityId: asset.id,
          changes: { disposalAmount: params.disposalAmount, gainOrLoss, journalEntryId: result.disposalEntryId },
        });

        return { asset: result.row, gainOrLoss, journalEntryId: result.disposalEntryId };
      })
  );

  // ─── Revalue (IAS 16 revaluation model) ────────────────────────────
  server.tool(
    "revalue_fixed_asset",
    "Revalue a fixed asset to a new carrying amount under the IAS 16 revaluation model. 'revaluedAmount' is the new net carrying amount in integer cents. UPWARD revaluations credit the revaluation surplus in equity (DR asset 1500 / CR 3400 Revaluation Surplus), except the portion that reverses a prior impairment of this asset, which is credited back to P&L (CR 5510). DOWNWARD revaluations first reduce any revaluation surplus held for the asset (DR 3400) and book the excess as an impairment loss in P&L (DR 5510). Updates revaluedAmount, netBookValue and revaluationSurplusBalance, and records an assetRevaluation audit row. Atomic. Returns the revaluation record, updated asset and journalEntryId.",
    {
      assetId: z.string().uuid().describe("UUID of the fixed asset to revalue"),
      revaluedAmount: z.number().int().min(0).describe("New carrying (net book) amount in integer cents"),
      date: z.string().min(1).describe("Revaluation date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Optional notes for the revaluation audit trail"),
      assetAccountId: z.string().uuid().optional().describe("Override chart account UUID for the asset (defaults to the asset's assetAccountId or 1500)"),
      surplusAccountId: z.string().uuid().optional().describe("Override chart account UUID for revaluation surplus (default 3400)"),
      impairmentAccountId: z.string().uuid().optional().describe("Override chart account UUID for impairment loss (default 5510)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:assets");

        const asset = await db.query.fixedAsset.findFirst({
          where: and(
            eq(fixedAsset.id, params.assetId),
            eq(fixedAsset.organizationId, ctx.organizationId),
            notDeleted(fixedAsset.deletedAt)
          ),
        });
        if (!asset) throw new Error("Fixed asset not found");
        if (asset.status === "disposed") throw new Error("Cannot revalue a disposed asset");

        const previousCarrying = asset.netBookValue;
        const change = params.revaluedAmount - previousCarrying;
        if (change === 0) throw new Error("Revalued amount equals the current carrying amount");

        const { base: baseCurrency } = await resolveBaseRate(ctx.organizationId, undefined, params.date);

        const result = await db.transaction(async (tx) => {
          await lockAssetSnapshot(tx, ctx, asset);
          const assetAccountId =
            params.assetAccountId ??
            asset.assetAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "1500", name: "Property, Plant & Equipment", type: "asset", subType: "fixed_asset" },
              baseCurrency,
              tx
            ))?.id ??
            null;
          if (!assetAccountId) throw new Error("Could not resolve the asset account for revaluation");

          const surplusAccountId =
            params.surplusAccountId ??
            asset.revaluationReserveAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "3400", name: "Revaluation Surplus", type: "equity", subType: "other_equity" },
              baseCurrency,
              tx
            ))?.id ??
            null;

          const impairmentAccountId =
            params.impairmentAccountId ??
            asset.impairmentExpenseAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "5510", name: "Impairment Loss", type: "expense", subType: "other_expense" },
              baseCurrency,
              tx
            ))?.id ??
            null;

          let surplusDelta = 0; // signed change to equity surplus
          let impairmentDelta = 0; // signed P&L impact (positive = loss, negative = reversal income)
          const lines: (typeof journalLine.$inferInsert)[] = [];

          if (change > 0) {
            // Upward: reverse any prior impairment to P&L first, remainder to surplus.
            // Prior impairment is tracked as a negative revaluationSurplusBalance is
            // not used; instead reversals beyond a zero surplus go to income only when
            // a prior impairment exists. We approximate IAS 16 by crediting income for
            // the portion that restores a previously impaired carrying amount.
            const priorImpairment = Math.max(0, -asset.revaluationSurplusBalance);
            const reversalToIncome = Math.min(change, priorImpairment);
            const toSurplus = change - reversalToIncome;

            lines.push({
              journalEntryId: "",
              accountId: assetAccountId,
              description: `Revaluation increase - ${asset.name}`,
              debitAmount: change,
              creditAmount: 0,
            });
            if (reversalToIncome > 0 && impairmentAccountId) {
              lines.push({
                journalEntryId: "",
                accountId: impairmentAccountId,
                description: `Reversal of impairment - ${asset.name}`,
                debitAmount: 0,
                creditAmount: reversalToIncome,
              });
              impairmentDelta = -reversalToIncome;
            }
            if (toSurplus > 0 && surplusAccountId) {
              lines.push({
                journalEntryId: "",
                accountId: surplusAccountId,
                description: `Revaluation surplus - ${asset.name}`,
                debitAmount: 0,
                creditAmount: toSurplus,
              });
              surplusDelta = toSurplus;
            }
          } else {
            // Downward: consume existing surplus first, excess to impairment loss.
            const decrease = -change;
            const existingSurplus = Math.max(0, asset.revaluationSurplusBalance);
            const fromSurplus = Math.min(decrease, existingSurplus);
            const toImpairment = decrease - fromSurplus;

            if (fromSurplus > 0 && surplusAccountId) {
              lines.push({
                journalEntryId: "",
                accountId: surplusAccountId,
                description: `Reverse revaluation surplus - ${asset.name}`,
                debitAmount: fromSurplus,
                creditAmount: 0,
              });
              surplusDelta = -fromSurplus;
            }
            if (toImpairment > 0 && impairmentAccountId) {
              lines.push({
                journalEntryId: "",
                accountId: impairmentAccountId,
                description: `Impairment loss - ${asset.name}`,
                debitAmount: toImpairment,
                creditAmount: 0,
              });
              impairmentDelta = toImpairment;
            }
            lines.push({
              journalEntryId: "",
              accountId: assetAccountId,
              description: `Revaluation decrease - ${asset.name}`,
              debitAmount: 0,
              creditAmount: decrease,
            });
          }

          let journalEntryId: string | null = null;
          if (lines.length > 0) {
            const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
            const [entry] = await tx
              .insert(journalEntry)
              .values({
                organizationId: ctx.organizationId,
                entryNumber,
                date: params.date,
                description: `Revaluation - ${asset.name} (${asset.assetNumber})`,
                reference: asset.assetNumber,
                status: "posted",
                sourceType: "asset_revaluation",
                sourceId: asset.id,
                postedAt: new Date(),
                createdBy: ctx.userId,
              })
              .returning();
            journalEntryId = entry.id;
            await tx
              .insert(journalLine)
              .values(lines.map((l) => ({ ...l, journalEntryId: entry.id })));
          }

          // revaluationSurplusBalance tracks net equity surplus; a negative value
          // records a cumulative net P&L impairment still outstanding for reversal.
          const newSurplusBalance =
            asset.revaluationSurplusBalance + surplusDelta - impairmentDelta;

          const [revRow] = await tx
            .insert(assetRevaluation)
            .values({
              fixedAssetId: asset.id,
              date: params.date,
              previousCarryingAmount: previousCarrying,
              revaluedAmount: params.revaluedAmount,
              changeAmount: change,
              surplusAmount: surplusDelta,
              impairmentAmount: impairmentDelta,
              isImpairment: impairmentDelta > 0,
              notes: params.notes || null,
              journalEntryId,
            })
            .returning();

          const [updated] = await tx
            .update(fixedAsset)
            .set({
              revaluedAmount: params.revaluedAmount,
              netBookValue: params.revaluedAmount,
              revaluationSurplusBalance: newSurplusBalance,
              revaluationReserveAccountId: surplusAccountId ?? asset.revaluationReserveAccountId,
              impairmentExpenseAccountId: impairmentAccountId ?? asset.impairmentExpenseAccountId,
              updatedAt: new Date(),
            })
            .where(eq(fixedAsset.id, asset.id))
            .returning();

          return { revRow, updated, journalEntryId };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "revalue",
          entityType: "fixed_asset",
          entityId: asset.id,
          changes: { previousCarrying, revaluedAmount: params.revaluedAmount, change, journalEntryId: result.journalEntryId },
        });

        return { revaluation: result.revRow, asset: result.updated, journalEntryId: result.journalEntryId };
      })
  );

  // ─── Impair ────────────────────────────────────────────────────────
  server.tool(
    "impair_fixed_asset",
    "Recognize an impairment loss on a fixed asset under IAS 36, writing its carrying amount down to a lower recoverable amount. 'recoverableAmount' is the new (lower) carrying amount in integer cents and must be below the current net book value. The impairment first reduces any revaluation surplus held in equity for the asset (DR 3400), then charges the remainder to P&L (DR 5510 Impairment Loss); the credit reduces the asset (CR 1500 / the asset account). Updates netBookValue, revaluedAmount and revaluationSurplusBalance, and records an assetRevaluation row flagged isImpairment. Atomic. Returns the impairment record, updated asset and journalEntryId.",
    {
      assetId: z.string().uuid().describe("UUID of the fixed asset to impair"),
      recoverableAmount: z.number().int().min(0).describe("New (lower) recoverable/carrying amount in integer cents"),
      date: z.string().min(1).describe("Impairment date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Optional notes for the impairment audit trail"),
      assetAccountId: z.string().uuid().optional().describe("Override chart account UUID for the asset (defaults to the asset's assetAccountId or 1500)"),
      surplusAccountId: z.string().uuid().optional().describe("Override chart account UUID for revaluation surplus consumed (default 3400)"),
      impairmentAccountId: z.string().uuid().optional().describe("Override chart account UUID for impairment loss (default 5510)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:assets");

        const asset = await db.query.fixedAsset.findFirst({
          where: and(
            eq(fixedAsset.id, params.assetId),
            eq(fixedAsset.organizationId, ctx.organizationId),
            notDeleted(fixedAsset.deletedAt)
          ),
        });
        if (!asset) throw new Error("Fixed asset not found");
        if (asset.status === "disposed") throw new Error("Cannot impair a disposed asset");

        const previousCarrying = asset.netBookValue;
        if (params.recoverableAmount >= previousCarrying) {
          throw new Error("Recoverable amount must be below the current net book value to impair");
        }
        const decrease = previousCarrying - params.recoverableAmount;

        const { base: baseCurrency } = await resolveBaseRate(ctx.organizationId, undefined, params.date);

        const result = await db.transaction(async (tx) => {
          await lockAssetSnapshot(tx, ctx, asset);
          const assetAccountId =
            params.assetAccountId ??
            asset.assetAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "1500", name: "Property, Plant & Equipment", type: "asset", subType: "fixed_asset" },
              baseCurrency,
              tx
            ))?.id ??
            null;
          if (!assetAccountId) throw new Error("Could not resolve the asset account for impairment");

          const surplusAccountId =
            params.surplusAccountId ??
            asset.revaluationReserveAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "3400", name: "Revaluation Surplus", type: "equity", subType: "other_equity" },
              baseCurrency,
              tx
            ))?.id ??
            null;

          const impairmentAccountId =
            params.impairmentAccountId ??
            asset.impairmentExpenseAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "5510", name: "Impairment Loss", type: "expense", subType: "other_expense" },
              baseCurrency,
              tx
            ))?.id ??
            null;

          // Consume existing surplus first, excess to P&L.
          const existingSurplus = Math.max(0, asset.revaluationSurplusBalance);
          const fromSurplus = Math.min(decrease, existingSurplus);
          const toImpairment = decrease - fromSurplus;

          const lines: (typeof journalLine.$inferInsert)[] = [];
          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: params.date,
              description: `Impairment - ${asset.name} (${asset.assetNumber})`,
              reference: asset.assetNumber,
              status: "posted",
              sourceType: "asset_impairment",
              sourceId: asset.id,
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          if (fromSurplus > 0 && surplusAccountId) {
            lines.push({
              journalEntryId: entry.id,
              accountId: surplusAccountId,
              description: `Impairment against revaluation surplus - ${asset.name}`,
              debitAmount: fromSurplus,
              creditAmount: 0,
            });
          }
          if (toImpairment > 0 && impairmentAccountId) {
            lines.push({
              journalEntryId: entry.id,
              accountId: impairmentAccountId,
              description: `Impairment loss - ${asset.name}`,
              debitAmount: toImpairment,
              creditAmount: 0,
            });
          }
          lines.push({
            journalEntryId: entry.id,
            accountId: assetAccountId,
            description: `Impairment write-down - ${asset.name}`,
            debitAmount: 0,
            creditAmount: decrease,
          });

          await tx.insert(journalLine).values(lines);

          const newSurplusBalance = asset.revaluationSurplusBalance - fromSurplus - toImpairment;

          const [revRow] = await tx
            .insert(assetRevaluation)
            .values({
              fixedAssetId: asset.id,
              date: params.date,
              previousCarryingAmount: previousCarrying,
              revaluedAmount: params.recoverableAmount,
              changeAmount: -decrease,
              surplusAmount: -fromSurplus,
              impairmentAmount: toImpairment,
              isImpairment: true,
              notes: params.notes || null,
              journalEntryId: entry.id,
            })
            .returning();

          const [updated] = await tx
            .update(fixedAsset)
            .set({
              revaluedAmount: params.recoverableAmount,
              netBookValue: params.recoverableAmount,
              revaluationSurplusBalance: newSurplusBalance,
              revaluationReserveAccountId: surplusAccountId ?? asset.revaluationReserveAccountId,
              impairmentExpenseAccountId: impairmentAccountId ?? asset.impairmentExpenseAccountId,
              updatedAt: new Date(),
            })
            .where(eq(fixedAsset.id, asset.id))
            .returning();

          return { revRow, updated, journalEntryId: entry.id, fromSurplus, toImpairment };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "impair",
          entityType: "fixed_asset",
          entityId: asset.id,
          changes: {
            previousCarrying,
            recoverableAmount: params.recoverableAmount,
            impairmentLoss: result.toImpairment,
            surplusConsumed: result.fromSurplus,
            journalEntryId: result.journalEntryId,
          },
        });

        return { impairment: result.revRow, asset: result.updated, journalEntryId: result.journalEntryId };
      })
  );

  // ─── Capitalize CWIP ───────────────────────────────────────────────
  server.tool(
    "capitalize_cwip_asset",
    "Capitalize a capital-work-in-progress (CWIP) asset into service: transfers the accumulated CWIP cost into the fixed-asset account and starts depreciation. Sums the asset's recorded cwipCost rows (or uses purchasePrice when none exist) as the capitalized cost and posts DR asset account (1500) / CR CWIP account, then marks the asset 'active' with isCwip=false, sets capitalizedDate and inServiceDate, and refreshes purchasePrice / netBookValue to the capitalized cost. Atomic; posts only when both the asset and CWIP accounts are resolvable. Returns the updated asset, capitalized cost and journalEntryId.",
    {
      assetId: z.string().uuid().describe("UUID of the in-progress (CWIP) fixed asset to capitalize"),
      date: z.string().min(1).describe("Capitalization / in-service date (YYYY-MM-DD)"),
      assetAccountId: z.string().uuid().optional().describe("Override chart account UUID for the asset (defaults to the asset's assetAccountId or 1500)"),
      cwipAccountId: z.string().uuid().optional().describe("Override chart account UUID holding the CWIP cost (defaults to the asset's cwipAccountId or 1600)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:assets");

        const asset = await db.query.fixedAsset.findFirst({
          where: and(
            eq(fixedAsset.id, params.assetId),
            eq(fixedAsset.organizationId, ctx.organizationId),
            notDeleted(fixedAsset.deletedAt)
          ),
        });
        if (!asset) throw new Error("Fixed asset not found");
        if (!asset.isCwip && asset.status !== "in_progress") {
          throw new Error("Asset is not capital-work-in-progress");
        }

        // Capitalized cost = sum of recorded CWIP costs, or the purchasePrice when none.
        const [costSum] = await db
          .select({ total: sql<number>`coalesce(sum(${cwipCost.amount}), 0)`.mapWith(Number) })
          .from(cwipCost)
          .where(eq(cwipCost.fixedAssetId, asset.id));
        const capitalizedCost = Number(costSum?.total ?? 0) || asset.purchasePrice;

        const { base: baseCurrency } = await resolveBaseRate(ctx.organizationId, undefined, params.date);

        const result = await db.transaction(async (tx) => {
          await lockAssetSnapshot(tx, ctx, asset);
          let journalEntryId: string | null = null;

          const assetAccountId =
            params.assetAccountId ??
            asset.assetAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "1500", name: "Property, Plant & Equipment", type: "asset", subType: "fixed_asset" },
              baseCurrency,
              tx
            ))?.id ??
            null;

          const cwipAccountId =
            params.cwipAccountId ??
            asset.cwipAccountId ??
            (await ensureAccountByCode(
              ctx.organizationId,
              { code: "1600", name: "Capital Work in Progress", type: "asset", subType: "fixed_asset" },
              baseCurrency,
              tx
            ))?.id ??
            null;

          if (capitalizedCost > 0 && assetAccountId && cwipAccountId) {
            const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
            const [entry] = await tx
              .insert(journalEntry)
              .values({
                organizationId: ctx.organizationId,
                entryNumber,
                date: params.date,
                description: `Capitalize CWIP - ${asset.name} (${asset.assetNumber})`,
                reference: asset.assetNumber,
                status: "posted",
                sourceType: "cwip_capitalization",
                sourceId: asset.id,
                postedAt: new Date(),
                createdBy: ctx.userId,
              })
              .returning();
            journalEntryId = entry.id;

            await tx.insert(journalLine).values([
              {
                journalEntryId: entry.id,
                accountId: assetAccountId,
                description: `Capitalize CWIP into service - ${asset.name}`,
                debitAmount: capitalizedCost,
                creditAmount: 0,
              },
              {
                journalEntryId: entry.id,
                accountId: cwipAccountId,
                description: `Transfer CWIP cost - ${asset.name}`,
                debitAmount: 0,
                creditAmount: capitalizedCost,
              },
            ]);
          }

          const [updated] = await tx
            .update(fixedAsset)
            .set({
              isCwip: false,
              status: "active",
              capitalizedDate: params.date,
              inServiceDate: params.date,
              purchasePrice: capitalizedCost,
              netBookValue: capitalizedCost - asset.accumulatedDepreciation,
              assetAccountId: assetAccountId ?? asset.assetAccountId,
              cwipAccountId: cwipAccountId ?? asset.cwipAccountId,
              updatedAt: new Date(),
            })
            .where(eq(fixedAsset.id, asset.id))
            .returning();

          return { updated, journalEntryId };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "capitalize_cwip",
          entityType: "fixed_asset",
          entityId: asset.id,
          changes: { capitalizedCost, journalEntryId: result.journalEntryId },
        });

        return { asset: result.updated, capitalizedCost, journalEntryId: result.journalEntryId };
      })
  );

}
