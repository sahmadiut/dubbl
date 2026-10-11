import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { journalEntry, journalLine } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/api/require-role";
import { getNextEntryNumber } from "@/lib/api/journal-automation";
import { logAudit } from "@/lib/api/audit";
import { readOpeningBalance } from "@/lib/api/opening-balance-read";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for opening balances — the single posted journal entry (sourceType
 * "opening_balance") that seeds account balances when a business starts using
 * the system. Setting opening balances voids any prior opening-balance entry and
 * posts a fresh one.
 *
 * All monetary amounts (inputs AND results) are integer minor units (cents),
 * e.g. $12.50 = 1250. Direct DB access via Drizzle (no HTTP self-calls).
 */
export function registerOpeningBalanceTools(
  server: McpServer,
  ctx: AuthContext
) {
  server.tool(
    "get_opening_balances",
    "Get the current opening-balance journal entry for this organization, with its lines and the account on each line, or null if none has been set. The entry is the single posted journal entry with sourceType 'opening_balance'. Line amounts retain numeric integer cents with agreeing debitAmountMinor/creditAmountMinor strings. The existing fixed-cents/default USD-tag policy does not infer organization currency.",
    {},
    () =>
      wrapTool(ctx, async () => {
        const entry = await readOpeningBalance(ctx.organizationId);

        return { entry: entry ?? null };
      })
  );

  server.tool(
    "set_opening_balances",
    "Set (replace) the organization's opening balances. Voids any existing posted opening-balance entry, then posts a new journal entry (sourceType 'opening_balance') with one line per balance. Total debits MUST equal total credits, and the totals must be non-zero. All amounts are in integer cents (e.g. $12.50 = 1250). Returns the newly created posted entry with numeric-cent line amounts and agreeing Minor strings. Inputs remain numeric cents only; default USD tags are retained independently of organization currency.",
    {
      date: z
        .string()
        .min(1)
        .describe("Opening-balance entry date (YYYY-MM-DD)"),
      balances: z
        .array(
          z.object({
            accountId: z
              .string()
              .min(1)
              .describe("Chart-of-accounts account UUID for this line"),
            debitAmount: z
              .number()
              .int()
              .min(0)
              .default(0)
              .describe("Debit amount in integer cents (0 if this is a credit line)"),
            creditAmount: z
              .number()
              .int()
              .min(0)
              .default(0)
              .describe("Credit amount in integer cents (0 if this is a debit line)"),
          })
        )
        .min(1)
        .describe("Opening-balance lines; total debits must equal total credits"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:entries");

        // Validate total debits = total credits (amounts already in cents).
        const totalDebit = params.balances.reduce(
          (sum, b) => sum + b.debitAmount,
          0
        );
        const totalCredit = params.balances.reduce(
          (sum, b) => sum + b.creditAmount,
          0
        );

        if (totalDebit !== totalCredit) {
          throw new Error("Total debits must equal total credits");
        }
        if (totalDebit === 0) {
          throw new Error("Opening balances must have non-zero amounts");
        }

        // Find any existing posted opening-balance entry to void.
        const existingEntry = await db.query.journalEntry.findFirst({
          where: and(
            eq(journalEntry.organizationId, ctx.organizationId),
            eq(journalEntry.sourceType, "opening_balance"),
            eq(journalEntry.status, "posted")
          ),
        });

        const full = await db.transaction(async (tx) => {
          if (existingEntry) {
            await tx
              .update(journalEntry)
              .set({
                status: "void",
                voidedAt: new Date(),
                voidReason: "Replaced by new opening balance entry",
                updatedAt: new Date(),
              })
              .where(eq(journalEntry.id, existingEntry.id));
          }

          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);

          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: params.date,
              description: "Opening balances",
              sourceType: "opening_balance",
              status: "posted",
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          await tx.insert(journalLine).values(
            params.balances.map((b) => ({
              journalEntryId: entry.id,
              accountId: b.accountId,
              description: "Opening balance",
              debitAmount: b.debitAmount,
              creditAmount: b.creditAmount,
            }))
          );

          return readOpeningBalance(ctx.organizationId, entry.id, tx);
        });

        await logAudit({
          ctx,
          action: "update",
          entityType: "opening_balance",
          entityId: ctx.organizationId,
        });

        return { entry: full };
      })
  );
}
