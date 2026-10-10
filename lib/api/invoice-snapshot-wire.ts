import { z } from "zod";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const text = (label: string) => z.string().max(10000).nullable().optional().describe(label);
const sender = z.strictObject({
  name: z.string().min(1).max(10000).optional().describe("Sender organization name"),
  address: text("Sender address; null clears it"),
  taxId: text("Sender tax identifier"),
  registrationNumber: text("Sender business registration identifier"),
  phone: text("Sender phone"), email: text("Sender email"), countryCode: text("Sender country code"),
}).refine(value => Object.keys(value).length > 0, "Provide at least one sender field");
const recipient = z.strictObject({
  name: z.string().min(1).max(10000).optional().describe("Recipient contact name"),
  email: text("Recipient email"), address: text("Recipient address; null clears it"),
  taxNumber: text("Recipient tax identifier"),
}).refine(value => Object.keys(value).length > 0, "Provide at least one recipient field");

export const invoiceSnapshotId = z.string().uuid().describe("Organization-owned live invoice UUID");
export const invoiceSnapshotFields = {
  sender: sender.optional().describe("Sender text fields to correct; no monetary fields"),
  recipient: recipient.optional().describe("Recipient text fields to correct; no monetary fields"),
};
export const invoiceSnapshotSchema = z.strictObject(invoiceSnapshotFields)
  .refine(value => value.sender !== undefined || value.recipient !== undefined, "Provide sender or recipient corrections");
export const invoiceSnapshotMcpSchema = z.strictObject({ invoiceId: invoiceSnapshotId, ...invoiceSnapshotFields })
  .refine(value => value.sender !== undefined || value.recipient !== undefined, "Provide sender or recipient corrections");

export { parseOpaqueJson as parseInvoiceSnapshotJson } from "./opaque-json";

/** Historical JSON is opaque: do not guess money units or generate aliases from names. */
function snapshot(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new WireCompatibilityError("Historical invoice snapshot must be a JSON object or null");
  }
  return JSON.parse(stringifyWire(value)) as Record<string, unknown>;
}
export function invoiceSnapshotDto(row: { senderSnapshot: unknown; recipientSnapshot: unknown }) {
  return { sender: snapshot(row.senderSnapshot), recipient: snapshot(row.recipientSnapshot) };
}
