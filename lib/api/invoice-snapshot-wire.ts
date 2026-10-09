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

function decimalKey(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value)!;
  const digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  const significant = digits.replace(/0+$/, "");
  const exponent = BigInt(match[4] ?? "0") - BigInt((match[3] ?? "").length) + BigInt(digits.length - significant.length);
  return `${match[1]}${significant}e${exponent}`;
}

/** Fetch jsonb as SQL text so pg cannot round a numeric token before validation. */
export function parseInvoiceSnapshotJson(source: string | null): unknown {
  if (source === null) return null;
  // JSON strings are matched as complete tokens and skipped, including escapes.
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
    const token = match[0];
    if (token.startsWith('"')) continue;
    const numeric = Number(token);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER
      || decimalKey(token) !== decimalKey(String(numeric))) {
      throw new WireCompatibilityError("Historical invoice snapshot number cannot round-trip through numeric JSON; preserve exact values as strings");
    }
  }
  return JSON.parse(source);
}

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
