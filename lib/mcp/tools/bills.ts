import { createBill, updateBill, deleteBill } from "@/lib/api/bill-writes";
import { billCreateFields, billUpdateFields } from "@/lib/api/bill-write-wire";
import { listBills, getBill, getBillCounts } from "@/lib/api/bill-reads";
import { billListFields } from "@/lib/api/bill-read-wire";
import { AuthError } from "@/lib/api/auth-context";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { bill, billLine, inventoryItem } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { assertNotLocked } from "@/lib/api/period-lock";
import { reverseJournalEntry } from "@/lib/api/journal-automation";
import { recordInventoryIssue, type ValuedItem } from "@/lib/api/inventory-valuation";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerBillTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "list_bills",
    "List organization-scoped bills with status and pagination. Returns {bills,total,page,limit}. Numeric money retains stored minor units (USD cents); header *Minor strings and contact creditLimitMinor preserve every digit. Quantities/percentages retain units. Unsafe history fails with 422; mixed-currency pages retain per-bill currencies.",
    billListFields,
    params => wrapTool(ctx, () => listBills(ctx, params))
  );

  server.tool(
    "get_bill",
    "Get an organization-owned bill with contact, account/tax line relations and base-currency display. Returns {bill,base}, numeric money in stored minor units (USD cents) plus header/line/contact *Minor strings. Quantity is hundredths, discount is basis points. Base FX is issue-date lookup, not saved posting FX; missing rates return nulls. Safe numeric and matching-scale display only; unsupported money/references fail with 422.",
    { billId: z.string().uuid().describe("Organization-owned bill UUID") },
    params => wrapTool(ctx, async () => {
      const result = await getBill(ctx, params.billId);
      if (!result) throw new AuthError("Bill not found", 404);
      return result;
    })
  );

  server.tool(
    "get_bill_counts",
    "Get bill counts and amount-due totals per status for this organization. Returns {counts,total}, with count, safe numeric minor-unit amount (USD cents), amountMinor string and currencyCode per status. Empty statuses are omitted. Rejects mixed currencies within a status or unsafe individual/summed money with 422. Counts include all nondeleted statuses; no FX or writes.",
    {},
    () => wrapTool(ctx, () => getBillCounts(ctx))
  );

  server.tool(
    "create_bill",
    "Create an organization-owned bill atomically with numbering, lines, purchase-order links and audit. Legacy unitPrice is decimal major units (USD 12.50), unitPriceExact is an exact major decimal string, unitPriceMinor is an integer minor string. Quantity is decimal physical units; discount/tax are basis points. Extended prices round before discount/exclusive tax; reverse-charge VAT is excluded from supplier amountDue. Returns {bill,held?} with safe numeric money and *Minor strings. MCP currency omission defaults USD. Duplicate warn/block rejects with 409 (confirmDuplicate overrides warn only); hold creates pending_approval. Period/tenant checks apply; unsupported amounts fail with 422 before mutation.",
    billCreateFields,
    params => wrapTool(ctx, () => createBill(ctx, params, "mcp"))
  );

  server.tool(
    "update_bill",
    "Edit an organization-owned draft bill header and optionally replace all lines atomically with audit. Prices use decimal major unitPrice/unitPriceExact or integer unitPriceMinor; omitted replacement prices default zero. Currency and bill number stay fixed. Returns {bill} with numeric minor money (USD cents) plus *Minor strings. Both issue dates must be unlocked; posted/paid/non-draft bills and invalid references reject before mutation. Reverse-charge VAT remains excluded from supplier amountDue.",
    { billId: z.string().uuid().describe("Organization-owned draft bill UUID"), ...billUpdateFields },
    ({ billId, ...params }) => wrapTool(ctx, () => updateBill(ctx, billId, params))
  );

  server.tool(
    "delete_bill",
    "Soft-delete an organization-owned draft bill and remove its lines atomically with audit. Returns {success:true}. The issue date must be unlocked; paid/posted/non-draft bills and unsupported saved money reject before mutation. Purchase-order links remain attached to the deleted historical header.",
    { billId: z.string().uuid().describe("Organization-owned draft bill UUID") },
    params => wrapTool(ctx, () => deleteBill(ctx, params.billId))
  );

  server.tool(
    "approve_bill",
    "Approve a draft or pending_approval bill. Changes status to 'received'. Requires admin role.",
    {
      billId: z.string().describe("The UUID of the bill to approve"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "approve:bills");

        const existing = await db.query.bill.findFirst({
          where: and(
            eq(bill.id, params.billId),
            eq(bill.organizationId, ctx.organizationId),
            notDeleted(bill.deletedAt)
          ),
        });

        if (!existing) throw new Error("Bill not found");
        if (!["draft", "pending_approval"].includes(existing.status)) {
          throw new Error(
            "Only draft or pending approval bills can be approved"
          );
        }

        const [updated] = await db
          .update(bill)
          .set({
            status: "received",
            approvedBy: ctx.userId,
            approvedAt: new Date(),
            receivedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bill.id, params.billId))
          .returning();

        return { bill: updated };
      })
  );

  server.tool(
    "pay_bill",
    "Record a payment against a bill. Amount is in integer cents (e.g. 1250 = $12.50). Automatically updates status to 'paid' or 'partial'.",
    {
      billId: z.string().describe("The UUID of the bill"),
      amount: z
        .number()
        .int()
        .min(1)
        .describe("Payment amount in cents"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:bills");

        const existing = await db.query.bill.findFirst({
          where: and(
            eq(bill.id, params.billId),
            eq(bill.organizationId, ctx.organizationId),
            notDeleted(bill.deletedAt)
          ),
        });

        if (!existing) throw new Error("Bill not found");
        if (existing.status === "void") {
          throw new Error("Cannot pay a voided bill");
        }
        if (existing.status === "paid") {
          throw new Error("Bill is already fully paid");
        }
        if (params.amount > existing.amountDue) {
          throw new Error(
            `Payment amount (${params.amount}) exceeds amount due (${existing.amountDue})`
          );
        }

        const newAmountPaid = existing.amountPaid + params.amount;
        const newAmountDue = existing.total - newAmountPaid;
        const newStatus = newAmountDue === 0 ? "paid" : "partial";

        const [updated] = await db
          .update(bill)
          .set({
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
            paidAt: newAmountDue === 0 ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(bill.id, params.billId))
          .returning();

        return { bill: updated };
      })
  );

  server.tool(
    "void_bill",
    "Void a bill and reverse its bookkeeping. Reverses the posted GL entry (expense/inventory, input VAT, accounts payable) and the perpetual stock receipt for any stock lines. Blocked if the bill has recorded payments (unapply/refund first) or its period is locked. Amounts in integer cents.",
    {
      billId: z.string().describe("The UUID of the bill to void"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:bills");

        const existing = await db.query.bill.findFirst({
          where: and(
            eq(bill.id, params.billId),
            eq(bill.organizationId, ctx.organizationId),
            notDeleted(bill.deletedAt)
          ),
        });

        if (!existing) throw new Error("Bill not found");
        if (existing.status === "void") {
          throw new Error("Bill is already voided");
        }
        if (existing.amountPaid > 0) {
          throw new Error(
            "Cannot void a bill with recorded payments. Unapply or refund the payment first, then void."
          );
        }

        const wasPosted = !!existing.journalEntryId;
        if (wasPosted) {
          await assertNotLocked(ctx.organizationId, existing.issueDate, ctx);
        }

        const lines = wasPosted
          ? await db.query.billLine.findMany({
              where: eq(billLine.billId, params.billId),
            })
          : [];
        const stockLines = lines.filter((l) => l.inventoryItemId);

        const [updated] = await db.transaction(async (tx) => {
          if (wasPosted && existing.journalEntryId) {
            await reverseJournalEntry(
              { organizationId: ctx.organizationId, userId: ctx.userId },
              {
                entryId: existing.journalEntryId,
                date: existing.issueDate,
                description: `Void bill ${existing.billNumber}`,
                reference: existing.billNumber,
                sourceType: "bill_void",
                sourceId: existing.id,
              },
              tx
            );
          }

          for (const line of stockLines) {
            const units = Math.round(line.quantity / 100);
            if (units <= 0 || !line.inventoryItemId) continue;
            const item = await tx.query.inventoryItem.findFirst({
              where: and(
                eq(inventoryItem.id, line.inventoryItemId),
                eq(inventoryItem.organizationId, ctx.organizationId)
              ),
            });
            if (!item) continue;
            await recordInventoryIssue(tx, {
              item: item as ValuedItem,
              quantity: units,
              warehouseId: line.warehouseId,
              type: "adjustment",
              referenceType: "bill_void",
              referenceId: existing.id,
              createdBy: ctx.userId,
            });
          }

          return tx
            .update(bill)
            .set({
              status: "void",
              voidedAt: new Date(),
              amountDue: 0,
              updatedAt: new Date(),
            })
            .where(eq(bill.id, params.billId))
            .returning();
        });

        return { bill: updated };
      })
  );
}
