import { z } from "zod";
import { currencyMetadata, parseMajor } from "@/lib/money/exact";
import { exactMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const importFormat = z.enum(["csv", "tsv", "qif", "ofx", "qfx", "qbo", "camt052", "camt053", "camt054", "mt940", "mt942", "bai2"]);
export const mappingFields = Object.fromEntries(["date", "description", "amount", "amountExact", "amountMinor", "debit", "credit", "balance", "balanceMinor", "reference", "payee", "counterparty"].map(key => [key, z.string().min(1).optional().describe(`Optional literal CSV column header for ${key}`)]));
export const statementFields = {
  fileName: z.string().max(10000).nullable().optional().describe("Optional statement filename for format detection and history"),
  content: z.string().min(1).max(10000000).optional().describe("Decoded statement text; amounts are decimal major units except BAI2 integer minor units"),
  csv: z.string().min(1).max(10000000).optional().describe("Legacy alias for content; supplied aliases must agree"),
  format: importFormat.nullable().optional().describe("Optional explicit format; otherwise detected from filename/content"),
  mapping: z.object(mappingFields).strict().optional().describe("Optional CSV/TSV column mapping; amountMinor/balanceMinor contain canonical integer strings"),
};
export const statementSchema = z.object(statementFields).strict().superRefine((value, ctx) => {
  if (!value.content && !value.csv) ctx.addIssue({ code: "custom", message: "Statement content is required" });
  if (value.content && value.csv && value.content !== value.csv) ctx.addIssue({ code: "custom", message: "content and csv disagree" });
});
export const profileFields = {
  dateFormat: z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]).nullable().default(null).describe("CSV date ordering; null retains legacy auto detection"),
  decimalSeparator: z.enum([".", ","]).default(".").describe("Explicit CSV decimal separator"),
  thousandSeparator: z.enum([".", ",", " ", ""]).default(",").describe("Explicit CSV grouping separator; empty disables grouping"),
  timezone: z.literal("UTC").default("UTC").describe("Canonical date-only parser timezone; UTC only, no instant conversion"),
  debitIsNegative: z.boolean().default(true).describe("CSV split columns: true means credit minus debit; false means debit minus credit"),
  encoding: z.literal("utf-8").default("utf-8").describe("Content is already decoded UTF-8 text"),
  csvDelimiter: z.enum([",", ";", "\t", "|"]).nullable().default(null).describe("CSV delimiter override; null uses format default"),
};
export const profileSchema = z.object(profileFields).strict().refine(value => !value.thousandSeparator || value.thousandSeparator !== value.decimalSeparator, "Decimal and grouping separators must differ");
export type ImportProfile = z.infer<typeof profileSchema>;
export function invalidImport(message: string): never { throw new z.ZodError([{ code: "custom", path: [], message }]); }

/** Localized statement amounts remain text until exact currency-scale conversion. */
export function importMajor(value: string | number, currency: string, profile?: ImportProfile): number {
  const scale = currencyMetadata(currency).minorUnits;
  if (typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) >= 2 ** (52 - Math.ceil(Math.log2(10 ** scale)))))
    throw new WireCompatibilityError("Large decimal bank amounts must use strings or amountMinor");
  let text = String(value).trim();
  if (!text || text.length > 256) invalidImport("A nonempty decimal amount is required");
  const parenthesis = text.startsWith("(") && text.endsWith(")");
  if (parenthesis) text = text.slice(1, -1).trim();
  const code = text.match(/^([A-Z]{3})\s+/i);
  if (code && code[1].toUpperCase() !== currency) invalidImport("Amount currency disagrees with bank account");
  text = text.replace(/^[A-Z]{3}\s+/i, "").replace(/^[$€£¥]\s*/, "");
  const sign = text.startsWith("-") ? "-" : "";
  text = text.replace(/^[+-]/, "");
  if (parenthesis && sign) invalidImport("Ambiguous amount sign");
  let decimal = ".", grouping = ",";
  if (profile) { decimal = profile.decimalSeparator; grouping = profile.thousandSeparator; }
  else if (text.includes(",") && (text.includes(".") ? text.lastIndexOf(",") > text.lastIndexOf(".") : /^\d+,\d{1,2}$/.test(text))) { decimal = ","; grouping = "."; }
  const parts = text.split(decimal);
  if (parts.length > 2 || (parts[1] !== undefined && !/^\d+$/.test(parts[1]))) invalidImport("Malformed decimal bank amount");
  let whole = parts[0];
  if (grouping && whole.includes(grouping)) {
    const groups = whole.split(grouping);
    if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some(g => !/^\d{3}$/.test(g))) invalidImport("Malformed amount grouping");
    whole = groups.join("");
  }
  if (!/^\d+$/.test(whole)) invalidImport("Malformed decimal bank amount");
  const canonical = `${parenthesis || sign ? "-" : ""}${whole}${parts[1] === undefined ? "" : `.${parts[1]}`}`;
  try { return legacyMinor(parseMajor(canonical, currency, "reject").amountMinor); }
  catch (error) { if (error instanceof WireCompatibilityError) throw error; invalidImport("Amount must fit signed int64 and contain no fractional minor units"); }
}
export function importExactMajor(value: string, currency: string) {
  if (value.length > 256 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) invalidImport("amountExact must be a canonical ASCII decimal major-unit string");
  return importMajor(value, currency, profileSchema.parse({ thousandSeparator: "" }));
}
export function importAmount(value: string | number | undefined, alias: string | undefined, currency: string, profile?: ImportProfile) {
  const numeric = value === undefined ? undefined : importMajor(value, currency, profile);
  const exact = alias === undefined ? undefined : legacyMinor(BigInt(exactMinorSchema.parse(alias)));
  if (numeric !== undefined && exact !== undefined && numeric !== exact) invalidImport("Legacy and exact bank amount aliases disagree");
  if (numeric === undefined && exact === undefined) invalidImport("Provide amount or amountMinor");
  return exact ?? numeric!;
}
export function importMoneyDto<T extends object>(row: T, fields: string[]): T & Record<string, string | null> {
  const aliases: Record<string, string | null> = {};
  for (const field of fields) {
    const value = (row as Record<string, unknown>)[field];
    if (value == null) aliases[`${field}Minor`] = null;
    else if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new WireCompatibilityError();
    else aliases[`${field}Minor`] = String(value);
  }
  const result = { ...row, ...aliases }; stringifyWire(result); return result;
}
export const bulkFields = {
  fileName: z.string().min(1).max(10000).default("bank-transactions.csv").describe("Filename recorded in bulk job and import history"),
  source: z.enum(["custom", "quickbooks", "xero", "freshbooks", "wave"]).default("custom").describe("Source date normalization; bankAccountCode is an owned bank name, case insensitive"),
  rows: z.array(z.record(z.string().describe("Mapped bank row field"), z.unknown().describe("Field value; numeric/string amount in major units; amountMinor in minor units"))).max(10000).describe("Mapped rows with date, description, bankAccountCode and amount/amountExact/amountMinor or debit/credit"),
};
export const bulkSchema = z.object(bulkFields).strict();
