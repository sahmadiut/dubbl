import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenseClaim, chartAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { assertNotLocked } from "@/lib/api/period-lock";
import {
  createExpenseClaimApprovalJournalEntry,
  createExpenseClaimPaymentJournalEntry,
} from "@/lib/api/expense-claims";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for employee expense claims and their lifecycle (draft -> submitted
 * -> approved -> paid, plus recall back to draft).
 *
 * All monetary amounts — both INPUTS and RESULTS — are integer cents (e.g.
 * $12.50 = 1250). Mileage distance is miles x 100 (2 decimals) and mileageRate
 * is cents per mile, both stored as integers. Direct DB access via Drizzle (no
 * HTTP self-calls); org-scoped via the AuthContext.
 */
export function registerExpenseTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "submit_expense_claim",
    "Submit a draft (or corrected rejected) expense claim for approval. Sets status to 'submitted', records the submission time, and clears any prior rejection. Only draft or rejected claims can be submitted. Returns the updated claim.",
    {
      expenseClaimId: z.string().describe("The UUID of the expense claim to submit"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:expenses");

        const found = await db.query.expenseClaim.findFirst({
          where: and(
            eq(expenseClaim.id, params.expenseClaimId),
            eq(expenseClaim.organizationId, ctx.organizationId),
            notDeleted(expenseClaim.deletedAt)
          ),
        });
        if (!found) throw new Error("Expense claim not found");
        if (found.status !== "draft" && found.status !== "rejected") {
          throw new Error("Only draft or rejected expense claims can be submitted");
        }

        const [updated] = await db
          .update(expenseClaim)
          .set({
            status: "submitted",
            submittedAt: new Date(),
            rejectedAt: null,
            rejectionReason: null,
            updatedAt: new Date(),
          })
          .where(eq(expenseClaim.id, params.expenseClaimId))
          .returning();

        return { expenseClaim: updated };
      })
  );

  server.tool(
    "recall_expense_claim",
    "Recall a claim that's awaiting approval back to draft so it can be edited. Only a 'submitted' claim qualifies — nothing has been posted to the ledger yet, so pulling it back is a no-op accounting-wise. Sets status to 'draft' and clears the submission time. Returns the updated claim.",
    {
      expenseClaimId: z.string().describe("The UUID of the expense claim to recall"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:expenses");

        const found = await db.query.expenseClaim.findFirst({
          where: and(
            eq(expenseClaim.id, params.expenseClaimId),
            eq(expenseClaim.organizationId, ctx.organizationId),
            notDeleted(expenseClaim.deletedAt)
          ),
        });
        if (!found) throw new Error("Expense claim not found");
        if (found.status !== "submitted") {
          throw new Error("Only a claim that's awaiting approval can be recalled");
        }

        const [updated] = await db
          .update(expenseClaim)
          .set({
            status: "draft",
            submittedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(expenseClaim.id, params.expenseClaimId))
          .returning();

        return { expenseClaim: updated };
      })
  );

  server.tool(
    "approve_expense_claim",
    "Approve a submitted expense claim. Posts the approval journal entry — DR each expense line to its account (falling back to Miscellaneous Expense 5990) / CR Employee Reimbursements Payable 2110 for the total — dated today, then flips status to 'approved' and records the approver, atomically. Only submitted claims can be approved, and today's date must not be in a locked/closed period. Returns the updated claim.",
    {
      expenseClaimId: z.string().describe("The UUID of the expense claim to approve"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "approve:expenses");

        const found = await db.query.expenseClaim.findFirst({
          where: and(
            eq(expenseClaim.id, params.expenseClaimId),
            eq(expenseClaim.organizationId, ctx.organizationId),
            notDeleted(expenseClaim.deletedAt)
          ),
          with: {
            items: {
              with: { account: true },
            },
          },
        });
        if (!found) throw new Error("Expense claim not found");
        if (found.status !== "submitted") {
          throw new Error("Only submitted expense claims can be approved");
        }

        const approvedAt = new Date();
        await assertNotLocked(
          ctx.organizationId,
          approvedAt.toISOString().slice(0, 10),
          ctx
        );

        const updated = await db.transaction(async (tx) => {
          const entry = await createExpenseClaimApprovalJournalEntry(
            ctx,
            found,
            tx,
            approvedAt.toISOString().slice(0, 10)
          );

          const [row] = await tx
            .update(expenseClaim)
            .set({
              status: "approved",
              approvedBy: ctx.userId,
              approvedAt,
              journalEntryId: entry.id,
              updatedAt: approvedAt,
            })
            .where(eq(expenseClaim.id, params.expenseClaimId))
            .returning();
          return row;
        });

        return { expenseClaim: updated };
      })
  );

  server.tool(
    "pay_expense_claim",
    "Mark an approved expense claim as paid. Posts the payment journal entry — DR Employee Reimbursements Payable 2110 (clearing the obligation booked at approval) / CR the chosen bank account — dated `date`, then flips status to 'paid', atomically. The expense accounts are NOT re-debited (they were booked at approval). Only approved claims can be paid, the bank account must exist, and `date` must not be in a locked/closed period. Returns the updated claim.",
    {
      expenseClaimId: z.string().describe("The UUID of the expense claim to pay"),
      date: z.string().describe("Payment date (YYYY-MM-DD); the journal entry is posted on this date"),
      bankAccountCode: z
        .string()
        .optional()
        .default("1100")
        .describe("Chart-of-accounts code of the bank account the money is paid from (default '1100')"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "approve:expenses");

        const found = await db.query.expenseClaim.findFirst({
          where: and(
            eq(expenseClaim.id, params.expenseClaimId),
            eq(expenseClaim.organizationId, ctx.organizationId),
            notDeleted(expenseClaim.deletedAt)
          ),
          with: {
            items: {
              with: { account: true },
            },
          },
        });
        if (!found) throw new Error("Expense claim not found");
        if (found.status !== "approved") {
          throw new Error("Only approved expense claims can be marked as paid");
        }

        const bankAccount = await db.query.chartAccount.findFirst({
          where: and(
            eq(chartAccount.organizationId, ctx.organizationId),
            eq(chartAccount.code, params.bankAccountCode)
          ),
        });
        if (!bankAccount) throw new Error("Bank account not found");

        await assertNotLocked(ctx.organizationId, params.date, ctx);

        const paidAt = new Date();
        const updated = await db.transaction(async (tx) => {
          await createExpenseClaimPaymentJournalEntry(
            ctx,
            found,
            { id: bankAccount.id },
            tx,
            params.date
          );

          const [row] = await tx
            .update(expenseClaim)
            .set({
              status: "paid",
              paidAt,
              updatedAt: paidAt,
            })
            .where(eq(expenseClaim.id, params.expenseClaimId))
            .returning();
          return row;
        });

        return { expenseClaim: updated };
      })
  );
}
