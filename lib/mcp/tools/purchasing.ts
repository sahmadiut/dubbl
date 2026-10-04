import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  purchaseOrder,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { wrapTool } from "@/lib/mcp/errors";
import {
  getProcurementSettings,
  threeWayMatch,
} from "@/lib/api/procurement";
import { buildSupplierStatement, NotASupplierError } from "@/lib/api/supplier-statement";
import { getBatchRemittance, sendBatchRemittance } from "@/lib/api/remittance";
import { batchIdField, remittanceFields, remittanceSendFields } from "@/lib/api/payment-batch-wire";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * Accounts-payable / purchasing MCP tools:
 * goods receipts (GRN), three-way match,
 * procurement settings, supplier statements, and remittance advice (data + email).
 * Purchase order and receipt contracts live in dedicated tool files. This file retains
 * matching, supplier statement and remittance operations. Settings live in a dedicated tool file.
 *
 * CONVENTIONS (matching the rest of the codebase):
 *  • MONETARY AMOUNTS are integer cents (e.g. $12.50 = 1250). Unit prices on
 *    create_purchase_order are DECIMAL numbers (e.g. 12.50) for convenience and
 *    are converted to cents internally.
 *  • QUANTITIES on inputs are WHOLE units (decimals allowed, e.g. 2.5) and are
 *    stored internally x100 (so 5 units = 500).
 *  • All tools are org-scoped via the AuthContext and use direct Drizzle access
 *    (no HTTP self-calls). Stock-moving tools post the matching double-entry
 *    journal so the GL and perpetual inventory stay in lock-step.
 */
export function registerPurchasingTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "get_purchasing_supplier_statement",
    "Get an accounts-payable statement for a supplier contact over a date range: bills (increase what we owe), debit notes (reduce it), and payments made (reduce it), with a running balance of what we owe the supplier (positive = we owe them). Date params are YYYY-MM-DD and default to the last 12 months. All amounts are integer cents. Errors if the contact is not a supplier.",
    {
      contactId: z.string().describe("Supplier contact UUID"),
      startDate: z
        .string()
        .optional()
        .describe("Start of the period (YYYY-MM-DD); defaults to 12 months ago"),
      endDate: z
        .string()
        .optional()
        .describe("End of the period (YYYY-MM-DD); defaults to today"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        try {
          const statement = await buildSupplierStatement(
            ctx.organizationId,
            params.contactId,
            params.startDate,
            params.endDate
          );
          if (!statement) throw new Error("Contact not found");
          return { statement };
        } catch (err) {
          if (err instanceof NotASupplierError) {
            throw new Error(err.message);
          }
          throw err;
        }
      })
  );

  // ─── Generate remittance advice for a payment batch ─────────────────
  server.tool(
    "generate_remittance",
    "Get qualified completed payment batch remittances grouped by supplier. Returns {batch,remittances}; billTotal, amountPaid, totalPaid and totalAmount are safe integer currency minor units (USD cents), with matching *Minor strings. Requires manage:payments; pending, reversed, unsafe, mixed-currency or foreign history fails before disclosure. Optional contactId filters one supplier.",
    { paymentBatchId: batchIdField, ...remittanceFields },
    params => wrapTool(ctx, () => getBatchRemittance(ctx, params.paymentBatchId, { contactId: params.contactId }, "mcp"))
  );
  server.tool(
    "send_payment_batch_remittance",
    "Email qualified completed batch remittances to suppliers with email addresses. All safe minor money and exact string aliases are preflighted before deliveries. Requires manage:payments. Optional contactId filters one supplier; personalMessage is escaped plain text. Returns {success,sent,skipped}; missing email is skipped. Delivery is sequential and repeats may resend; provider failures may leave earlier deliveries/logs committed.",
    { batchId: batchIdField, ...remittanceSendFields },
    params => wrapTool(ctx, () => sendBatchRemittance(ctx, params.batchId, { contactId: params.contactId, personalMessage: params.personalMessage }))
  );

  server.tool(
    "three_way_match_purchase_order",
    "Run a three-way match on a purchase order: compare ordered (PO) vs received (GRN) vs billed quantities and prices against the org's procurement tolerances. Optionally pass a proposed bill (`billLines` with quantities in whole units and optional unitPrice in cents) to evaluate before billing. Returns per-line status (matched/warning/blocked), variances, and an overall status. No changes are made.",
    {
      purchaseOrderId: z.string().describe("Purchase order UUID to evaluate"),
      billLines: z
        .array(
          z.object({
            purchaseOrderLineId: z.string().describe("PO line UUID"),
            quantity: z.number().positive().describe("Proposed quantity to bill, in whole units"),
            unitPrice: z.number().int().min(0).optional().describe("Proposed bill unit price in cents (defaults to the PO price)"),
          })
        )
        .optional()
        .describe("Proposed bill lines to evaluate. Omit to evaluate the current ordered/received/billed state only."),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const po = await db.query.purchaseOrder.findFirst({
          where: and(
            eq(purchaseOrder.id, params.purchaseOrderId),
            eq(purchaseOrder.organizationId, ctx.organizationId),
            notDeleted(purchaseOrder.deletedAt)
          ),
          with: { lines: true },
        });
        if (!po) throw new Error("Purchase order not found");

        const settings = await getProcurementSettings(ctx.organizationId);
        const proposedById = new Map(
          (params.billLines ?? []).map((b) => [b.purchaseOrderLineId, b])
        );

        const matchInput = po.lines.map((l) => {
          const proposed = proposedById.get(l.id);
          return {
            purchaseOrderLineId: l.id,
            description: l.description,
            quantityOrdered: l.quantity,
            quantityReceived: l.quantityReceived,
            quantityBilled: l.quantityBilled,
            quantityToBill: proposed ? Math.round(proposed.quantity * 100) : 0,
            unitPriceOrdered: l.unitPrice,
            unitPriceBilled: proposed?.unitPrice ?? l.unitPrice,
          };
        });

        return { match: threeWayMatch(matchInput, settings), settings };
      })
  );

}
