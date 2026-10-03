import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { creditListFields, customerCreditCreateFields, customerCreditApplyFields } from "@/lib/api/credit-wire";
import { listCredits, getCustomerCredit, createCustomerCredit, applyCredit, availableCredits } from "@/lib/api/credits";

export function registerCustomerCreditTools(server: McpServer, ctx: AuthContext) {
  const id = { customerCreditId: z.string().uuid().describe("Organization-owned customer-credit UUID") };
  server.tool("list_customer_credits", "List customer credits; returns customerCredits and total. Money is numeric currency minor units (USD cents) plus *Minor strings.", creditListFields,
    params => wrapTool(ctx, async () => { const result = await listCredits(ctx, params, true); return { customerCredits: result.rows, total: result.total }; }));
  server.tool("get_customer_credit", "Get a customer credit with contact and recognition journal. Returns customerCredit with numeric minor amounts and *Minor strings.", id,
    params => wrapTool(ctx, () => getCustomerCredit(ctx, params.customerCreditId)));
  server.tool("create_customer_credit", "Record new cash and customer deposit liability atomically. amount is positive integer minor units, amountMinor an exact string; provide exactly one bankAccountId or depositAccountId. Returns customerCredit with numeric money and *Minor strings.", customerCreditCreateFields,
    params => wrapTool(ctx, () => createCustomerCredit(ctx, params)));
  server.tool("apply_customer_credit", "Apply an open credit to the same customer's same-currency invoice; posts DR deposits / CR AR. amount is positive integer minor units, amountMinor an exact string. Returns customerCredit and invoice with numeric money and *Minor strings.", { ...id, ...customerCreditApplyFields },
    ({ customerCreditId, ...params }) => wrapTool(ctx, () => applyCredit(ctx, customerCreditId, params, true)));
  server.tool("list_invoice_available_credits", "List open positive customer credits matching the invoice customer and currency. Returns credits, currencyCode, amountDue and amountDueMinor; credit money has numeric minor amounts and *Minor strings.", { invoiceId: z.string().uuid().describe("Organization-owned invoice UUID") },
    params => wrapTool(ctx, () => availableCredits(ctx, params.invoiceId)));
}
