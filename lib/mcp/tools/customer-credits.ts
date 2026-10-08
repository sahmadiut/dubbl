import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { creditListFields, customerCreditCreateFields, customerCreditApplyFields } from "@/lib/api/credit-wire";
import { listCredits, getCustomerCredit, createCustomerCredit, applyCredit, availableCredits } from "@/lib/api/credits";

export function registerCustomerCreditTools(server: McpServer, ctx: AuthContext) {
  const id = { customerCreditId: z.string().uuid().describe("Organization-owned customer-credit UUID") };
  server.registerTool("list_customer_credits", {
    description: "List customer credits; returns customerCredits and total. Money is numeric currency minor units (USD cents) plus *Minor strings.",
    inputSchema: z.strictObject(creditListFields),
  }, params => wrapTool(ctx, async () => { const result = await listCredits(ctx, params, true); return { customerCredits: result.rows, total: result.total }; }));
  server.registerTool("get_customer_credit", {
    description: "Get a customer credit with contact and recognition journal. Returns customerCredit with numeric minor amounts and *Minor strings.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, () => getCustomerCredit(ctx, params.customerCreditId)));
  server.registerTool("create_customer_credit", {
    description: "Record new cash and customer deposit liability atomically. amount is positive integer minor units, amountMinor an exact string; provide exactly one bankAccountId or depositAccountId. Returns customerCredit with numeric money and *Minor strings.",
    inputSchema: z.strictObject(customerCreditCreateFields),
  }, params => wrapTool(ctx, () => createCustomerCredit(ctx, params)));
  server.registerTool("apply_customer_credit", {
    description: "Apply an open credit to the same customer's same-currency invoice; posts DR deposits / CR AR. amount is positive integer minor units, amountMinor an exact string. Returns customerCredit and invoice with numeric money and *Minor strings.",
    inputSchema: z.strictObject({ ...id, ...customerCreditApplyFields }),
  }, ({ customerCreditId, ...params }) => wrapTool(ctx, () => applyCredit(ctx, customerCreditId, params, true)));
  server.registerTool("list_invoice_available_credits", {
    description: "List open positive customer credits matching the invoice customer and currency. Returns credits, currencyCode, amountDue and amountDueMinor; credit money has numeric minor amounts and *Minor strings.",
    inputSchema: z.strictObject({ invoiceId: z.string().uuid().describe("Organization-owned invoice UUID") }),
  }, params => wrapTool(ctx, () => availableCredits(ctx, params.invoiceId)));
}
