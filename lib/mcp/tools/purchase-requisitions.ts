import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { createPurchaseRequisition, listPurchaseRequisitions, getPurchaseRequisition, updatePurchaseRequisition,
  deletePurchaseRequisition, submitPurchaseRequisition, decidePurchaseRequisition, convertPurchaseRequisition } from "@/lib/api/purchase-requisitions";
import { requisitionCreateFields, requisitionUpdateFields, requisitionListFields, requisitionRejectFields } from "@/lib/api/purchase-requisition-wire";

export function registerPurchaseRequisitionTools(server: McpServer, ctx: AuthContext) {
  const id = { requisitionId: z.string().uuid().describe("Organization-owned purchase requisition UUID") };
  server.tool("list_purchase_requisitions",
    "List organization requisitions by status/page. Returns {requisitions,total,page,limit} including supplier and lines. Numeric money is currency minor units (USD cents) with *Minor strings; quantities are hundredths. Unsupported saved money or foreign references reject.",
    requisitionListFields, params => wrapTool(ctx, () => listPurchaseRequisitions(ctx, params)));
  server.tool("get_purchase_requisition",
    "Get one organization requisition with supplier and lines. Returns {requisition}, numeric currency minor amounts (USD cents) plus *Minor strings; quantities are hundredths. Foreign/deleted IDs return 404.",
    id, params => wrapTool(ctx, () => getPurchaseRequisition(ctx, params.requisitionId)));
  server.tool("create_purchase_requisition",
    "Create a draft requisition atomically with REQ numbering, lines and audit. unitPrice is decimal major units (USD 12.50); unitPriceExact is an exact decimal major string; unitPriceMinor is an integer minor string. Aliases must agree. Quantity is physical units, stored x100. Tax is zero; taxRateId is only a reference. Supplier is optional until conversion. Returns {requisition} with numeric currency minor amounts (USD cents) and *Minor strings. Safe-number/tenant/period checks apply.",
    requisitionCreateFields, params => wrapTool(ctx, () => createPurchaseRequisition(ctx, params)));
  server.tool("update_purchase_requisition",
    "Edit supplier, required date, reference or notes on an organization draft requisition. Currency, request date, number and lines stay fixed. Returns {requisition}, with numeric currency minor amounts (USD cents) plus *Minor strings. Requires manage:purchases; locked dates reject.",
    { ...id, ...requisitionUpdateFields }, ({ requisitionId, ...params }) => wrapTool(ctx, () => updatePurchaseRequisition(ctx, requisitionId, params)));
  server.tool("delete_purchase_requisition",
    "Soft-delete an organization draft requisition, retaining historical lines, atomically with audit. Returns {success:true}. Requires manage:purchases; locked dates and unsupported history reject before mutation.",
    id, params => wrapTool(ctx, () => deletePurchaseRequisition(ctx, params.requisitionId)));
  server.tool("submit_purchase_requisition",
    "Submit an organization draft requisition for approval with tenant/period checks and atomic audit. Requires manage:purchases. Returns {requisition} with numeric currency minor amounts (USD cents) plus *Minor strings. Approval/rejection is separate; no automatic workflows or notifications are created.",
    id, params => wrapTool(ctx, () => submitPurchaseRequisition(ctx, params.requisitionId)));
  server.tool("approve_purchase_requisition",
    "Approve a submitted organization requisition and record approver/time atomically with audit. Requires approve:purchases. Returns {requisition} with numeric currency minor amounts (USD cents) plus *Minor strings; only submitted status and unlocked request dates qualify.",
    id, params => wrapTool(ctx, () => decidePurchaseRequisition(ctx, params.requisitionId, "approve")));
  server.tool("reject_purchase_requisition",
    "Reject a submitted organization requisition, stamping rejectedAt and optional reason atomically with audit. Requires approve:purchases. Returns {requisition} with numeric currency minor amounts (USD cents) plus *Minor strings; locked dates reject.",
    { ...id, ...requisitionRejectFields }, ({ requisitionId, ...params }) => wrapTool(ctx, () => decidePurchaseRequisition(ctx, requisitionId, "reject", params)));
  server.tool("convert_purchase_requisition",
    "Convert an approved organization requisition with a supplier into one draft purchase order. Copies saved exact amounts/lines/currency without recomputing tax, dates PO today (UTC), and links convertedPoId. Requires manage:purchases and unlocked request/PO dates. Atomic PO numbering/header/lines/status/link/audit; repeated conversion rejects. Returns {purchaseOrder} with numeric currency minor amounts (USD cents) plus *Minor strings, limited to safe-number range.",
    id, params => wrapTool(ctx, () => convertPurchaseRequisition(ctx, params.requisitionId)));
}
