import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { inventoryMovement, assemblyOrder, journalEntry, journalLine, auditLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import { getNextEntryNumber, ensureControlAccount, ensureAccountByCode, resolveBaseRate } from "@/lib/api/journal-automation";
import { recordInventoryIssue, recordInventoryReceipt, type ValuedItem } from "@/lib/api/inventory-valuation";
import type { AuthContext } from "@/lib/api/auth-context";

// Assembly qualification is retained by MON-078.
export function registerInventoryTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "build_assembly",
    "Complete (build) a draft/in-progress assembly order: issues every BOM component at its current cost (incl. wastage), adds the BOM's labor + overhead (in cents, scaled by build quantity), and receives the finished assembly item at the rolled-up unit cost. Posts ONE balanced journal entry (DR Finished Goods inventory; CR each consumed component's inventory account; CR Manufacturing/WIP Clearing 2305 for labor & overhead), updates perpetual valuation for all items, and marks the order completed. Validates on-hand stock for every component BEFORE writing anything. Returns the completed order, the posted journalEntryId, and the totalCost/unitCost (cents).",
    {
      assemblyOrderId: z.string().uuid().describe("UUID of the draft/in-progress assembly order to build"),
      date: z
        .string()
        .optional()
        .describe("Posting date for the build journal entry (YYYY-MM-DD); defaults to today"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:inventory");

        const order = await db.query.assemblyOrder.findFirst({
          where: and(
            eq(assemblyOrder.id, params.assemblyOrderId),
            eq(assemblyOrder.organizationId, ctx.organizationId),
            notDeleted(assemblyOrder.deletedAt)
          ),
          with: {
            bom: {
              with: {
                assemblyItem: true,
                components: { with: { componentItem: true } },
              },
            },
          },
        });

        if (!order) throw new Error("Assembly order not found");
        if (order.status === "completed") throw new Error("Order already completed");
        if (order.status === "cancelled") throw new Error("Order is cancelled");

        const bom = order.bom;
        if (!bom.assemblyItem) throw new Error("BOM has no assembly item");
        if (bom.components.length === 0) throw new Error("BOM has no components");

        // Resolve per-component required quantity (incl. wastage) and validate
        // on-hand BEFORE writing anything so a build never leaves stock half-consumed.
        const needs = bom.components.map((comp) => {
          const needed = Math.ceil(
            parseFloat(comp.quantity) *
              order.quantity *
              (1 + parseFloat(comp.wastagePercent || "0") / 100)
          );
          return { comp, item: comp.componentItem, needed };
        });

        for (const { comp, item, needed } of needs) {
          if (!item) throw new Error(`Component item missing for BOM line ${comp.id}`);
          if (item.quantityOnHand < needed) {
            throw new Error(
              `Insufficient stock for ${item.name}: need ${needed}, have ${item.quantityOnHand}`
            );
          }
        }

        const date = params.date || new Date().toISOString().slice(0, 10);

        const result = await db.transaction(async (tx) => {
          const { base } = await resolveBaseRate(ctx.organizationId, undefined, date);

          // 1. Issue every component at its current cost.
          const componentMovementIds: string[] = [];
          const componentCredits = new Map<string, number>(); // inventory accountId -> cost
          let componentCost = 0;

          for (const { item, needed } of needs) {
            const valued = item as unknown as ValuedItem;
            const issue = await recordInventoryIssue(tx, {
              item: valued,
              quantity: needed,
              type: "adjustment",
              referenceType: "assembly_order",
              referenceId: order.id,
              createdBy: ctx.userId,
            });
            componentCost += issue.cost;
            componentMovementIds.push(issue.movementId);

            const invAcct = item!.inventoryAccountId
              ? { id: item!.inventoryAccountId }
              : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
            if (!invAcct) throw new Error("Inventory control account unavailable");
            componentCredits.set(invAcct.id, (componentCredits.get(invAcct.id) ?? 0) + issue.cost);
          }

          // 2. Labor + overhead from the BOM, scaled by build quantity.
          const conversionCost = (bom.laborCostCents + bom.overheadCostCents) * order.quantity;
          const totalCost = componentCost + conversionCost;

          // 3. Receive the finished item at the rolled-up unit cost.
          const assemblyValued = bom.assemblyItem as unknown as ValuedItem;
          const unitCost = order.quantity > 0 ? Math.round(totalCost / order.quantity) : 0;
          const receipt = await recordInventoryReceipt(tx, {
            item: assemblyValued,
            quantity: order.quantity,
            unitCost,
            type: "adjustment",
            referenceType: "assembly_order",
            referenceId: order.id,
            createdBy: ctx.userId,
          });

          const finishedValue = unitCost * order.quantity;

          // 4. Build the balanced JE.
          const finishedAcct = bom.assemblyItem!.inventoryAccountId
            ? { id: bom.assemblyItem!.inventoryAccountId }
            : await ensureAccountByCode(
                ctx.organizationId,
                { code: "1320", name: "Finished Goods", type: "asset", subType: "current" },
                base,
                tx
              );
          if (!finishedAcct) throw new Error("Finished goods account unavailable");

          const creditedComponentCost = Array.from(componentCredits.values()).reduce((s, v) => s + v, 0);
          const clearingCredit = finishedValue - creditedComponentCost;

          const lines: {
            accountId: string;
            description: string;
            debitAmount: number;
            creditAmount: number;
            currencyCode: string;
          }[] = [
            {
              accountId: finishedAcct.id,
              description: `Assembly build: ${bom.name} x${order.quantity}`,
              debitAmount: finishedValue,
              creditAmount: 0,
              currencyCode: base,
            },
          ];

          for (const [accountId, amount] of componentCredits) {
            if (amount === 0) continue;
            lines.push({
              accountId,
              description: `Components consumed: ${bom.name}`,
              debitAmount: 0,
              creditAmount: amount,
              currencyCode: base,
            });
          }

          if (clearingCredit !== 0) {
            const clearingAcct = await ensureAccountByCode(
              ctx.organizationId,
              { code: "2305", name: "Manufacturing/WIP Clearing", type: "liability", subType: "current" },
              base,
              tx
            );
            if (!clearingAcct) throw new Error("WIP clearing account unavailable");
            lines.push({
              accountId: clearingAcct.id,
              description: `Labor & overhead applied: ${bom.name}`,
              debitAmount: clearingCredit < 0 ? -clearingCredit : 0,
              creditAmount: clearingCredit > 0 ? clearingCredit : 0,
              currencyCode: base,
            });
          }

          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date,
              description: `Assembly build: ${bom.name} x${order.quantity}`,
              reference: "ASSEMBLY",
              status: "posted",
              sourceType: "assembly_build",
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          await tx.insert(journalLine).values(lines.map((l) => ({ ...l, journalEntryId: entry.id })));

          // 5. Stamp every movement with the JE id.
          for (const movementId of [...componentMovementIds, receipt.movementId]) {
            await tx
              .update(inventoryMovement)
              .set({ journalEntryId: entry.id })
              .where(eq(inventoryMovement.id, movementId));
          }

          // 6. Mark the order complete.
          const [updated] = await tx
            .update(assemblyOrder)
            .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
            .where(eq(assemblyOrder.id, order.id))
            .returning();

          return { updated, entryId: entry.id, totalCost, unitCost };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "build_assembly",
          entityType: "assembly_order",
          entityId: order.id,
          changes: {
            quantity: order.quantity,
            totalCost: result.totalCost,
            unitCost: result.unitCost,
            journalEntryId: result.entryId,
          },
        });

        return {
          order: result.updated,
          journalEntryId: result.entryId,
          totalCost: result.totalCost,
          unitCost: result.unitCost,
        };
      })
  );

  // ─── List movements ───────────────────────────────────────────────
}
