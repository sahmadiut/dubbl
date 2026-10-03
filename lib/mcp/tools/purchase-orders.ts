import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, listPurchaseOrders, getPurchaseOrder,
  getPurchaseOrderCounts, sendPurchaseOrder, convertPurchaseOrder } from "@/lib/api/purchase-orders";
import { purchaseOrderCreateFields, purchaseOrderUpdateFields, purchaseOrderListFields,
  purchaseOrderConvertFields, purchaseOrderSendFields } from "@/lib/api/purchase-order-wire";

export function registerPurchaseOrderTools(server: McpServer, ctx: AuthContext) {
  const id = { purchaseOrderId: z.string().uuid().describe("Organization-owned purchase order UUID") };
  server.tool("create_purchase_order",
    "Create a draft purchase order atomically with numbering, lines and audit. unitPrice is decimal major units (USD 12.50); unitPriceExact is an exact decimal major string; unitPriceMinor is an integer minor string. Aliases must agree. Quantity is physical units, stored x100; discounts/tax rates use basis points. Returns {purchaseOrder}, with numeric minor money (USD cents) plus *Minor strings. Safe numeric bounds and strict period/tenant checks apply.",
    purchaseOrderCreateFields, params => wrapTool(ctx, () => createPurchaseOrder(ctx, params)));
  server.tool("list_purchase_orders",
    "List organization purchase orders by status/supplier and page. Returns {purchaseOrders,total,page,limit}, including contacts and lines. Numeric money is stored currency minor units (USD cents), with *Minor strings; quantities are hundredths. Unsafe saved money or foreign references reject with 422/400. Different currencies retain individual labels.",
    purchaseOrderListFields, params => wrapTool(ctx, () => listPurchaseOrders(ctx, params, "mcp")));
  server.tool("get_purchase_order",
    "Get one organization purchase order, supplier and lines with account/tax details. Returns {purchaseOrder} with numeric currency minor money (USD cents) and *Minor strings; quantities/tallies are hundredths. Foreign/deleted orders return 404; unsupported history rejects.",
    id, params => wrapTool(ctx, () => getPurchaseOrder(ctx, params.purchaseOrderId)));
  server.tool("get_purchase_order_counts",
    "Count organization purchase orders by status and sum their stored total. Returns {counts,total}, each bucket with count, amount in currency minor units (USD cents), amountMinor and currencyCode. Mixed currencies in a bucket and unsafe constituent/aggregate money reject with 422.",
    {}, () => wrapTool(ctx, () => getPurchaseOrderCounts(ctx)));
  server.tool("update_purchase_order",
    "Edit an organization draft purchase order atomically with audit. Returns {purchaseOrder} with minor-unit numeric money (USD cents) and *Minor strings. Numeric/exact prices are decimal major units or unitPriceMinor integers; quantities are physical units. Replacement lines retain legacy REST PATCH: no discounts/tax calculation, taxRateId retained as reference. Currency/number stay fixed. Procurement activity and locked dates reject.",
    { ...id, ...purchaseOrderUpdateFields }, ({ purchaseOrderId, ...params }) => wrapTool(ctx, () => updatePurchaseOrder(ctx, purchaseOrderId, params)));
  server.tool("delete_purchase_order",
    "Soft-delete an organization draft purchase order and remove lines atomically with audit. Returns {success:true}. Procurement activity, locked issue dates and unsupported saved monetary values reject before mutation.",
    id, params => wrapTool(ctx, () => deletePurchaseOrder(ctx, params.purchaseOrderId)));
  server.tool("send_purchase_order",
    "Mark an organization draft purchase order sent with timestamp and audit; requires approve:bills. Returns {purchaseOrder} with numeric minor money (USD cents) and *Minor strings. sendEmail=true requires email, subject and templateProps; delivery follows commit, and a delivery failure returns 502 with sent state retained. No PDF is attached. Locked dates/procurement activity reject.",
    { ...id, ...purchaseOrderSendFields }, ({ purchaseOrderId, ...params }) => wrapTool(ctx, () => sendPurchaseOrder(ctx, purchaseOrderId, params)));
  server.tool("convert_po_to_bill",
    "Create a draft bill from an organization sent/partial/received purchase order. Omit lines to bill remaining quantities; partial selections use physical units (stored x100). Saved net/tax amounts allocate exactly with final residuals, including discounts. Received quantities link GRNs once. Atomic numbering, links, billed tallies and audit; requires manage:bills and unlocked issue date. Returns {bill,purchaseOrderStatus}; numeric currency minor money (USD cents) has *Minor strings. Safe-number range only.",
    { ...id, ...purchaseOrderConvertFields }, ({ purchaseOrderId, ...params }) => wrapTool(ctx, async () => {
      const result = await convertPurchaseOrder(ctx, purchaseOrderId, params);
      return { bill: result.bill, purchaseOrderStatus: result.purchaseOrderStatus };
    }));
}
