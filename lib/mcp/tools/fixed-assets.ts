import { lockAssetSnapshot } from "@/lib/api/asset-depreciation";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  fixedAsset,
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
import type { AuthContext } from "@/lib/api/auth-context";

export function registerFixedAssetTools(server: McpServer, ctx: AuthContext) {
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
