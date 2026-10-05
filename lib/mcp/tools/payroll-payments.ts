import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { listContractorPayments, getContractorPayment, createContractorPayment, updateContractorPayment, deleteContractorPayment,
  processContractorPayment, createPayrollTaxPayment, listPayrollTaxPayments, recordPayrollTaxRemittance } from "@/lib/api/payroll-payments";
import { paymentId, contractorPaymentCreateSchema, contractorPaymentUpdateSchema, contractorPaymentProcessSchema,
  taxPaymentCreateSchema, taxPaymentListSchema, legacyRemittanceSchema } from "@/lib/api/payroll-payment-wire";
export function registerPayrollPaymentTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_contractor_payments", { description: "List contractor payments; returns data array. Requires manage:contractors. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: z.object({ contractorId: paymentId.describe("Live contractor UUID in authenticated organization") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await listContractorPayments(ctx, args.contractorId); return { data: result };
  }));
  server.registerTool("get_contractor_payment", { description: "Get contractor payment; returns payment. Requires manage:contractors. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: z.object({ contractorId: paymentId.describe("Live contractor UUID in authenticated organization"), paymentId: paymentId.describe("Payment UUID belonging to contractorId") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getContractorPayment(ctx, args.contractorId, args.paymentId); return { payment: result };
  }));
  server.registerTool("create_contractor_payment", { description: "Create pending contractor payment; returns payment. Default currency is contractor currency; explicit currency may differ. Each create is a new event. Requires manage:contractors. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: contractorPaymentCreateSchema.extend({ contractorId: paymentId.describe("Live active owned contractor UUID") }) }, args => wrapTool(ctx, async () => {
    const { contractorId, ...body } = args; void contractorId;
    const result = await createContractorPayment(ctx, args.contractorId, body); return { payment: result };
  }));
  server.registerTool("update_contractor_payment", { description: "Update unposted pending contractor payment; returns payment. Paid/void are immutable; paid status requires processing. Requires manage:contractors. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: contractorPaymentUpdateSchema.extend({ contractorId: paymentId.describe("Live owned contractor UUID"), paymentId: paymentId.describe("Payment UUID belonging to contractorId") }) }, args => wrapTool(ctx, async () => {
    const { contractorId, paymentId: ignoredPaymentId, ...body } = args; void contractorId; void ignoredPaymentId;
    const result = await updateContractorPayment(ctx, args.contractorId, args.paymentId, body); return { payment: result };
  }));
  server.registerTool("delete_contractor_payment", { description: "Delete unposted pending contractor payment; returns success. Requires manage:contractors. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: z.object({ contractorId: paymentId.describe("Live contractor UUID in authenticated organization"), paymentId: paymentId.describe("Payment UUID belonging to contractorId") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await deleteContractorPayment(ctx, args.contractorId, args.paymentId); return result;
  }));
  server.registerTool("process_contractor_payment", { description: "Process pending contractor payment; returns payment. Atomic expense 5130 / bank 1100 posting, saved paymentDate/baseCurrency/baseAmountMinor/rateExact. Missing FX, period locks or unsupported amounts reject. Paid retries return original journal and FX. Requires manage:contractors. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: contractorPaymentProcessSchema.extend({ contractorId: paymentId.describe("Live active owned contractor UUID"), paymentId: paymentId.describe("Payment UUID belonging to contractorId") }) }, args => wrapTool(ctx, async () => {
    const { contractorId, paymentId: ignoredPaymentId, ...body } = args; void contractorId; void ignoredPaymentId;
    const result = await processContractorPayment(ctx, args.contractorId, args.paymentId, body); return { payment: result };
  }));
  server.registerTool("list_payroll_tax_payments", { description: "List payroll tax remittances with optional period-overlap dates; returns payments. Requires manage:payroll. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: taxPaymentListSchema }, args => wrapTool(ctx, async () => {
    const result = await listPayrollTaxPayments(ctx, args); return { payments: result };
  }));
  server.registerTool("create_payroll_tax_payment", { description: "Create tax remittance; returns payment and journalEntryId. Allocations debit payroll liability codes, bank credit uses organization base currency. Atomic posting/audit and period locks. Optional idempotencyKey prevents duplicate remittances. Requires manage:payroll. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: taxPaymentCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createPayrollTaxPayment(ctx, args); return result;
  }));
  server.registerTool("record_payroll_tax_remittance", { description: "Record tax remittance using legacy amount/bankAccountId/date fields; returns payment and journalEntryId. Default date is periodEnd. taxKind containing fica/social/medicare/futa/suta/940/unemployment debits 2235, otherwise 2220. Shared atomic remittance service; optional idempotencyKey. Requires manage:payroll. Amounts are positive integer cents with matching Minor strings, max 9007199254740991; aliases must agree. No rescaling. Contractor FX is payment-to-base quote_per_base decimal with lossless positive int32-millionths coexistence; tax remittance FX is 1.", inputSchema: legacyRemittanceSchema }, args => wrapTool(ctx, async () => {
    const result = await recordPayrollTaxRemittance(ctx, args); return result;
  }));
}
