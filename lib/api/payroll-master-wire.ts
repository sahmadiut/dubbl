import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema, legacyMinor, legacyMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const payrollMasterId = z.string().uuid().describe("Live employee or contractor UUID in the authenticated organization");
const text = z.string().max(10000);
const amount = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const exact = exactMinorSchema.refine(v => !v.startsWith("-"), "Amount must be nonnegative");
export const payrollDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Use a valid Gregorian YYYY-MM-DD date");
const hourlyFields = {
  hourlyRate: amount.nullable().optional().describe("Nonnegative integer cents per hour, max 9007199254740991; null clears, omitted retains on update"),
  hourlyRateMinor: exact.nullable().optional().describe("Canonical nonnegative integer cents per hour string; same safe range; null clears; must agree with hourlyRate"),
};
const employeeFields = {
  name: text.min(1).describe("Employee full name"),
  email: z.string().email().nullable().optional().describe("Employee email; null clears"),
  position: text.nullable().optional().describe("Job title; null clears"),
  salary: amount.optional().describe("Annual salary in nonnegative integer cents, max 9007199254740991; salary or salaryMinor required on create, including zero for hourly staff"),
  salaryMinor: exact.optional().describe("Canonical nonnegative annual salary cents string; same safe range; must agree with salary"),
  payFrequency: z.enum(["weekly", "biweekly", "monthly"]).optional().describe("Pay frequency; defaults monthly on create"),
  taxRate: z.number().int().min(0).max(10000).optional().describe("Flat fallback tax rate in basis points, 0..10000 (2000 = 20%); defaults 2000, not money"),
  bankAccountNumber: text.nullable().optional().describe("Bank account number; null clears"),
  endDate: payrollDate.nullable().optional().describe("Gregorian employment end date YYYY-MM-DD; null clears; cannot precede start date"),
  memberId: z.string().uuid().nullable().optional().describe("Organization-owned member UUID; null clears"),
  compensationType: z.enum(["salary", "hourly", "milestone", "commission"]).optional().describe("Compensation type; defaults salary on create"),
  ...hourlyFields,
};
export const employeeCreateSchema = z.object({ ...employeeFields,
  employeeNumber: text.min(1).describe("Employee identifier; stored as entered, not a uniqueness guarantee"),
  startDate: payrollDate.describe("Gregorian employment start date YYYY-MM-DD"),
  currency: currencyCodeSchema.optional().describe("ISO pay currency; defaults USD; stored cents are never rescaled"),
}).strict();
export const employeeUpdateSchema = z.object({ ...employeeFields, name: employeeFields.name.optional(),
  isActive: z.boolean().optional().describe("Active flag; defaults true on create"),
  currency: currencyCodeSchema.optional().describe("ISO pay currency; changing requires no pay-item history; stored cents never rescale"),
}).strict();
const contractorFields = {
  name: text.min(1).describe("Contractor name"),
  email: z.string().email().nullable().optional().describe("Contractor email; null clears"),
  company: text.nullable().optional().describe("Company; null clears"),
  taxId: text.nullable().optional().describe("Tax identifier; null clears"),
  ...hourlyFields,
  currency: currencyCodeSchema.optional().describe("ISO pay currency; defaults USD; changing requires no payment history; cents never rescale"),
  bankAccountNumber: text.nullable().optional().describe("Bank account number; null clears"),
};
export const contractorCreateSchema = z.object(contractorFields).strict();
export const contractorUpdateSchema = z.object({ ...contractorFields, name: contractorFields.name.optional(),
  isActive: z.boolean().optional().describe("Active flag; defaults true on create"),
}).strict();
export const payrollMasterListSchema = z.object({
  active: z.boolean().optional().describe("Optional active-status filter; omit for all live records"),
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(200).default(50).describe("Page size, max 200 for MCP; REST max 100"),
}).strict();

/** Resolve before any database write; nullable aliases must agree including null. */
export function payrollMasterAmounts<T extends { salary?: number; salaryMinor?: string; hourlyRate?: number | null; hourlyRateMinor?: string | null }>(input: T, requireSalary = false) {
  const { salaryMinor, hourlyRateMinor, ...rest } = input;
  const result = { ...rest } as Omit<T, "salaryMinor" | "hourlyRateMinor"> & { salary?: number; hourlyRate?: number | null };
  for (const field of ["salary", "hourlyRate"] as const) {
    const numeric = input[field], alias = field === "salary" ? salaryMinor : hourlyRateMinor;
    if (numeric !== undefined) (field === "salary" ? amount : amount.nullable()).parse(numeric);
    if (alias !== undefined) (field === "salary" ? exact : exact.nullable()).parse(alias);
    if (numeric !== undefined && alias !== undefined && alias !== (numeric === null ? null : String(numeric)))
      throw new z.ZodError([{ code: "custom", path: [field + "Minor"], message: "Money aliases disagree" }]);
    if (alias !== undefined) {
      if (field === "salary") result.salary = legacyMinor(BigInt(alias!));
      else result.hourlyRate = alias === null ? null : legacyMinor(BigInt(alias));
    }
  }
  if (requireSalary && result.salary === undefined)
    throw new z.ZodError([{ code: "custom", path: ["salary"], message: "Provide salary or salaryMinor" }]);
  return result;
}
export function payrollMasterDto<T extends { currency: string | null; hourlyRate: number | null; salary?: number; taxRate?: number; ptoBalanceHours?: number }>(row: T) {
  try {
    if (row.currency !== null && currencyCodeSchema.parse(row.currency) !== row.currency) throw new Error("Invalid saved currency");
    amount.nullable().parse(row.hourlyRate);
    if (row.salary !== undefined) amount.parse(row.salary);
    if (row.taxRate !== undefined) employeeFields.taxRate.unwrap().parse(row.taxRate);
    if (row.ptoBalanceHours !== undefined) z.number().finite().parse(row.ptoBalanceHours);
    const result = { ...row, hourlyRateMinor: row.hourlyRate === null ? null : String(row.hourlyRate),
      ...(row.salary === undefined ? {} : { salaryMinor: String(row.salary) }) };
    stringifyWire(result); return result;
  } catch (error) {
    if (error instanceof WireCompatibilityError) throw error;
    throw new WireCompatibilityError("Unsupported saved payroll master money, rate or currency");
  }
}
export function payrollPaymentReadDto<T extends { amount: number; currency: string | null }>(row: T) {
  try {
    legacyMinorSchema.parse(row.amount);
    if (row.currency !== null && currencyCodeSchema.parse(row.currency) !== row.currency) throw new Error("Invalid saved currency");
    const result = { ...row, amountMinor: String(row.amount) }; stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Unsupported saved contractor payment money or currency"); }
}
export async function readPayrollMasterJson(request: Request) {
  try { return await request.json(); } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON payroll body" }]);
  }
}
export function payrollMasterQuery(url: URL, contractor = false) {
  const filter = url.searchParams.get(contractor ? "isActive" : "active");
  if (filter !== null && filter !== "true" && filter !== "false")
    throw new z.ZodError([{ code: "custom", path: ["active"], message: "Use true or false" }]);
  const number = (key: string) => {
    const value = url.searchParams.get(key);
    if (value === null) return undefined;
    if (!/^[1-9]\d{0,6}$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Use a positive integer" }]);
    return Number(value);
  };
  const parsed = payrollMasterListSchema.parse({ active: filter === null ? undefined : filter === "true", page: number("page"), limit: number("limit") });
  z.number().max(100).parse(parsed.limit); return parsed;
}
