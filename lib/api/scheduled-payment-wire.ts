import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { creditAmountFields } from "./credit-wire";
import { paymentListFields } from "./payment-read-wire";

export const scheduledPaymentIdField = z.string().uuid().describe("Live scheduled payment UUID in the authenticated organization");
export const scheduledPaymentCreateFields = {
  billId: z.string().uuid().describe("Organization-owned recognized outstanding supplier bill UUID"),
  contactId: z.string().uuid().describe("Organization-owned supplier UUID matching the bill"),
  ...creditAmountFields,
  currencyCode: currencyCodeSchema.default("USD").describe("Stored minor-unit currency, defaults to USD; must match the bill, never converts or rescales"),
  scheduledDate: rateDateSchema.describe("Gregorian posting date YYYY-MM-DD, not before bill recognition; must be open"),
  notes: z.string().max(10000).nullable().optional().describe("Optional payment notes; null clears"),
};
export const scheduledPaymentCreateSchema = z.object(scheduledPaymentCreateFields).strict();
export const scheduledPaymentUpdateFields = {
  scheduledDate: scheduledPaymentCreateFields.scheduledDate.optional().describe("Optional replacement posting date; old and new dates must be open"),
  ...creditAmountFields,
  notes: scheduledPaymentCreateFields.notes,
  status: z.literal("cancelled").optional().describe("Optional pending-to-cancelled transition; never posts or reverses cash"),
};
export const scheduledPaymentUpdateSchema = z.object(scheduledPaymentUpdateFields).strict();
export const scheduledPaymentListFields = {
  page: paymentListFields.page,
  limit: paymentListFields.limit,
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]).optional().describe("Optional saved schedule status; failed/processing legacy rows are not automatically retried"),
};
export const scheduledPaymentListSchema = z.object(scheduledPaymentListFields).strict();
