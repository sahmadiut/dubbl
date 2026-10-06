import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { payrollInteger } from "@/lib/payroll/exact";
import { payrollDate } from "./payroll-master-wire";
import { runMoneyDto } from "./payroll-run-wire";

export const outputId = z.string().uuid().describe("Owned payroll record UUID");
export const emptyOutputSchema = z.object({}).strict();
const date = payrollDate.refine(v => !v.startsWith("0000"), "Year must be 1..9999");
export const reportSchema = z.object({
  startDate: date.optional().describe("Optional inclusive Gregorian period start YYYY-MM-DD"),
  endDate: date.optional().describe("Optional inclusive Gregorian period end YYYY-MM-DD"),
}).strict();
export function reportInput(input: unknown) {
  const p = reportSchema.parse(input);
  if (p.startDate && p.endDate && p.startDate > p.endDate) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "End date precedes start date" }]);
  return p;
}
export const selfProfileSchema = z.object({
  bankAccountNumber: z.string().max(10000).optional().describe("Your bank account number; omitted retains current value"),
  email: z.string().email().optional().describe("Your email address; omitted retains current value"),
}).strict();
export const taxGenerateSchema = z.object({
  taxYear: z.number().int().min(2020).max(2099).describe("Gregorian tax year, 2020..2099"),
  formType: z.enum(["1099_nec", "1099_misc", "w2"]).describe("USD W-2 or 1099-NEC; generation of 1099-MISC is unsupported and rejects before writes"),
}).strict();
export const taxListSchema = z.object({
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1..100; default 50"),
  taxYear: taxGenerateSchema.shape.taxYear.optional().describe("Optional Gregorian tax year filter, 2020..2099"),
  formType: taxGenerateSchema.shape.formType.optional().describe("Optional form type filter"),
}).strict();
export function outputQuery(url: URL, tax = false) {
  if (!tax) return reportInput({ startDate: url.searchParams.get("startDate") ?? undefined, endDate: url.searchParams.get("endDate") ?? undefined });
  const number = (key: string) => {
    const v = url.searchParams.get(key); if (v === null) return undefined;
    if (!/^[1-9]\d{0,6}$/.test(v)) throw new z.ZodError([{ code: "custom", path: [key], message: "Use a positive integer" }]);
    return Number(v);
  };
  return taxListSchema.parse({ page: number("page"), limit: number("limit"), taxYear: number("taxYear"), formType: url.searchParams.get("formType") ?? undefined });
}
export const payslipMoneyFields = ["grossAmount", "netAmount", "taxAmount", "ytdGross", "ytdNet", "ytdTax"];
const w2Money = ["box1_wages", "box2_federal_tax", "box3_ss_wages", "box4_ss_tax", "box5_medicare_wages", "box6_medicare_tax",
  "box12_retirement_deferrals", "box14_other", "box17_state_income_tax", "box19_local_income_tax"];
const contractorMoney = ["box1_nonemployee_compensation"];
/** Explicit known money fields only; opaque metadata is never guessed by magnitude. */
export function taxDataDto(data: unknown, formType: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new WireCompatibilityError("Unsupported saved tax form payload");
  const row = { ...data } as Record<string, unknown>;
  const fields = formType === "w2" ? w2Money : formType === "1099_nec" ? contractorMoney : [];
  if (!fields.length) throw new WireCompatibilityError("Unsupported saved tax form type");
  const text = formType === "w2" ? ["employee_email", "employee_number"] : ["recipient_company", "recipient_email"];
  const allowed = new Set([...fields, ...fields.map(f => f + "Minor"), ...text, "currency", "box13_retirement_plan"]);
  for (const [key, value] of Object.entries(row)) {
    if (!allowed.has(key)) throw new WireCompatibilityError("Unsupported saved tax form field: " + key);
    if (text.includes(key) && value !== null && typeof value !== "string") throw new WireCompatibilityError("Invalid tax form metadata");
    if (key === "box13_retirement_plan" && typeof value !== "boolean") throw new WireCompatibilityError("Invalid retirement flag");
  }
  const currency = outputCurrency(row.currency ?? "USD");
  if (currency !== "USD") throw new WireCompatibilityError("Tax form payload requires USD cents");
  for (const field of fields) {
    const value = row[field], alias = row[field + "Minor"];
    if (value === undefined && alias === undefined) continue;
    if (value !== undefined) payrollInteger(value as number);
    if (alias !== undefined) {
      if (!exactMinorSchema.safeParse(alias).success) throw new WireCompatibilityError("Invalid saved tax form money alias");
      if (value !== undefined && String(value) !== alias) throw new WireCompatibilityError("Saved tax form aliases disagree");
    }
    row[field] = value ?? legacyMinor(BigInt(alias as string));
  }
  return runMoneyDto({ ...row, currency }, fields);
}
export function outputCurrency(value: unknown): string {
  const parsed = currencyCodeSchema.safeParse(value);
  if (!parsed.success || parsed.data !== value) throw new WireCompatibilityError("Unsupported saved payroll output currency");
  return parsed.data;
}
export function deductionPayload(value: unknown) {
  if (value === null) return null;
  if (!Array.isArray(value)) throw new WireCompatibilityError("Invalid saved payslip deductions");
  return value.map(line => {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw new WireCompatibilityError("Invalid payslip deduction line");
    const p = line as Record<string, unknown>;
    if (Object.keys(p).some(key => !["name", "amount", "amountMinor", "category"].includes(key))) throw new WireCompatibilityError("Unsupported payslip deduction field");
    if (typeof p.name !== "string" || !["pre_tax", "post_tax"].includes(p.category as string)) throw new WireCompatibilityError("Invalid payslip deduction metadata");
    payrollInteger(p.amount as number);
    if (p.amountMinor !== undefined && p.amountMinor !== String(p.amount)) throw new WireCompatibilityError("Payslip deduction aliases disagree");
    const result = runMoneyDto(p, ["amount"]); stringifyWire(result); return result;
  });
}
/** Payroll's existing cents display/export contract, independent of ISO display scales. */
export function payrollCentsText(value: number | string) {
  const amount = typeof value === "string" ? BigInt(exactMinorSchema.parse(value)) : payrollInteger(value);
  const abs = amount < 0n ? -amount : amount;
  return (amount < 0n ? "-" : "") + (abs / 100n).toString() + "." + (abs % 100n).toString().padStart(2, "0");
}
export function payrollCsvCell(value: string) {
  const safe = /^(\s*[=+\-@]|[\t\r\n])/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
