import { receiveBill, actBillApproval, voidBill } from "@/lib/api/bill-lifecycle";
import { billRejectFields, assertBillSettlementReady, billSettlementBalances } from "@/lib/api/bill-lifecycle-wire";
import { createBill, updateBill, deleteBill } from "@/lib/api/bill-writes";
import { billCreateFields, billUpdateFields } from "@/lib/api/bill-write-wire";
import { listBills, getBill, getBillCounts } from "@/lib/api/bill-reads";
import { billListFields } from "@/lib/api/bill-read-wire";
import { AuthError } from "@/lib/api/auth-context";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { bill } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
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
    "receive_bill",
    "Receive an organization-owned unposted draft bill. Atomically posts expense/inventory, input/output VAT, AP, stock and GRNI/PO effects with saved exact FX and audit. Returns {bill,grniEntryId,warnings}, retaining numeric minor money (USD cents) plus *Minor strings. Strict period/tenant checks and safe-number bounds apply; unsupported history fails before commit.",
    { billId: z.string().uuid().describe("Organization-owned draft bill UUID") },
    params => wrapTool(ctx, () => receiveBill(ctx, params.billId))
  );
  server.tool(
    "approve_bill",
    "Approve an organization-owned pending_approval bill and post the same atomic bookkeeping as receive_bill on final approval. Workflow assignee checks apply when a request exists. Returns {bill,grniEntryId?,warnings?,request?} with numeric minor units and *Minor strings. Drafts use receive_bill. Requires manage:bills; strict period and safe money/FX bounds apply.",
    { billId: z.string().uuid().describe("Organization-owned pending approval bill UUID") },
    params => wrapTool(ctx, () => actBillApproval(ctx, params.billId, "approve"))
  );
  server.tool(
    "reject_bill",
    "Reject an organization-owned unposted pending_approval bill back to draft, atomically recording rejection, optional workflow action and audit. Returns {bill,request?} with numeric minor-unit money (USD cents) plus *Minor strings. Current workflow assignee, tenant, period and saved-money checks apply.",
    { billId: z.string().uuid().describe("Organization-owned pending approval bill UUID"), ...billRejectFields },
    ({ billId, ...input }) => wrapTool(ctx, () => actBillApproval(ctx, billId, "reject", input))
  );

  server.tool(
    "pay_bill",
    "Annotate payment against an organization-owned recognized outstanding bill. Amount is a positive safe integer in the bill's stored minor units (USD 1250 = $12.50); no exact payment aliases yet. Returns {bill} and updates paid/due/status using the actual payable. Retains legacy balance-only behavior: creates no payment, allocation or settlement journal. Full settlement belongs to payment tools.",
    {
      billId: z.string().describe("The UUID of the bill"),
      amount: z
        .number()
        .int()
        .min(1)
        .describe("Positive safe integer payment amount in the bill currency's stored minor units (USD cents)"),
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
        assertBillSettlementReady(existing);
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

        const { amountPaid: newAmountPaid, amountDue: newAmountDue } = billSettlementBalances(existing, params.amount);
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
    "Void an organization-owned unsettled bill atomically with audit, saved GL/GRNI/FX reversal, original stock-value reversal, PO billed-quantity restoration and pending-approval cancellation. Returns {bill} with numeric minor units (USD cents) plus *Minor strings. Requires approve:bills and unlocked dates. Recorded payments/credits, consumed FIFO receipts and unqualified historical stock/FX reject before commit; no current-cost revaluation.",
    { billId: z.string().uuid().describe("Organization-owned unsettled bill UUID") },
    params => wrapTool(ctx, () => voidBill(ctx, params.billId))
  );
}
