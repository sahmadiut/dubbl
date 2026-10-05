import { z } from "zod";
import { payrollDate, payrollPaymentReadDto } from "./payroll-master-wire";
import { runAmount } from "./payroll-run-wire";
import { legacyMinorSchema, exactMinorSchema, WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactRate } from "@/lib/currency/exact-rate";
import { payrollConvert, payrollSum } from "@/lib/payroll/exact";

export const paymentId = z.string().uuid().describe("Owned contractor/payment UUID");
export const paymentDate = payrollDate.refine(v => !v.startsWith("0000"), "Year must be 1..9999").describe("Valid Gregorian YYYY-MM-DD, year 1..9999");
const text = z.string().max(10000).nullable().optional().describe("Optional text; null clears");
const money = {
  amount: legacyMinorSchema.min(1).optional().describe("Positive safe integer cents, max 9007199254740991; amount or amountMinor required"),
  amountMinor: exactMinorSchema.refine(v => !v.startsWith("-") && v !== "0", "Positive cents required").optional().describe("Canonical positive integer cents string; same safe range; must agree with amount"),
};
export const contractorPaymentCreateSchema = z.object({ ...money,
  currency: currencyCodeSchema.optional().describe("ISO payment currency; defaults to contractor currency; may differ without rescaling"),
  description: text.describe("Optional payment description"), invoiceNumber: text.describe("Optional contractor invoice number"),
  periodStart: paymentDate.optional().describe("Optional service-period start YYYY-MM-DD"),
  periodEnd: paymentDate.optional().describe("Optional service-period end YYYY-MM-DD; cannot precede start"),
}).strict();
export const contractorPaymentUpdateSchema = z.object({ ...money, description: text.describe("Description; null clears"),
  invoiceNumber: text.describe("Invoice number; null clears"),
  status: z.enum(["pending", "paid", "void"]).optional().describe("Pending may remain pending or become void; paid requires process; paid/void records are immutable"),
}).strict();
export const contractorPaymentProcessSchema = z.object({
  paymentDate: paymentDate.optional().describe("Posting date YYYY-MM-DD; defaults today UTC; paid retries must agree if supplied"),
}).strict();
export const taxPaymentCreateSchema = z.object({
  periodStart: paymentDate.describe("Remitted period start YYYY-MM-DD"), periodEnd: paymentDate.describe("Remitted period end YYYY-MM-DD; cannot precede start"),
  jurisdictionLevel: z.enum(["federal", "state", "local"]).default("federal").describe("Jurisdiction level; defaults federal"),
  jurisdiction: text.describe("Optional jurisdiction code"), taxKind: text.describe("Optional tax reporting label; allocations choose accounts"),
  allocations: z.array(z.object({ ...money,
    bucket: z.string().min(1).max(128).describe("Known payroll liability bucket or explicit 3..20 digit liability account code"),
  }).strict()).min(1).max(200).describe("1..200 positive allocations in organization base-currency cents; sum must remain safe"),
  bankAccountCode: z.string().regex(/^\d{3,20}$/).optional().describe("Owned base-currency asset account code; defaults payroll settings bank code, then 1100"),
  bankAccountId: paymentId.optional().describe("Owned base-currency asset account UUID; if code also supplied they must agree"),
  paymentDate: paymentDate.optional().describe("Posting date YYYY-MM-DD; REST defaults today UTC"),
  reference: text.describe("Optional confirmation number; not a retry key"), notes: text.describe("Optional remittance notes"),
  idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional().describe("Optional org-scoped retry key; same normalized input returns original payment and journal; conflicting reuse rejects"),
}).strict();
export const taxPaymentListSchema = z.object({ from: paymentDate.optional().describe("Optional overlap lower bound on periodEnd"),
  to: paymentDate.optional().describe("Optional overlap upper bound on periodStart; cannot precede from"),
}).strict();
export const legacyRemittanceSchema = taxPaymentCreateSchema.omit({ allocations: true, bankAccountCode: true, paymentDate: true }).extend({ ...money,
  bankAccountId: paymentId.describe("Owned base-currency asset account UUID"),
  date: paymentDate.optional().describe("Posting date YYYY-MM-DD; existing MCP default is periodEnd"),
});
export function resolvePayrollLiability(bucket: string): string {
  if (/^\d{3,20}$/.test(bucket)) return bucket;
  const b = bucket.toLowerCase();
  if (["income_tax", "fit", "paye", "state_income", "withholding"].includes(b)) return "2220";
  if (["fica", "social_security", "medicare", "futa", "suta", "payroll_tax", "nic"].includes(b)) return "2235";
  if (["pension", "benefits", "retirement"].includes(b)) return "2245";
  if (["garnishment", "statutory"].includes(b)) return "2236";
  throw new z.ZodError([{ code: "custom", path: ["bucket"], message: "Unknown payroll liability bucket; use an explicit account code" }]);
}
export function paymentAmounts<T extends { amount?: number; amountMinor?: string }>(input: T, required = true) {
  const { amountMinor, ...rest } = input; void amountMinor;
  return { ...rest, ...(required || input.amount !== undefined || input.amountMinor !== undefined ? { amount: runAmount(input) } : {}) };
}
export function paymentAllocations(input: z.infer<typeof taxPaymentCreateSchema>) {
  const byCode = new Map<string, number>();
  for (const allocation of input.allocations) {
    const code = resolvePayrollLiability(allocation.bucket), amount = runAmount(allocation);
    byCode.set(code, payrollSum([byCode.get(code) ?? 0, amount]));
  }
  const allocations = [...byCode].sort(([a], [b]) => a.localeCompare(b)).map(([code, amount]) => ({ code, amount }));
  return { allocations, amount: payrollSum(allocations.map(a => a.amount)) };
}
export function payrollPaymentDto<T extends { amount: number; currency: string | null; status: string;
  periodStart?: string | null; periodEnd?: string | null; baseAmount?: number | null; baseCurrency?: string | null;
  rateExact?: string | null; paymentDate?: string | null }>(row: T) {
  try {
    const result = payrollPaymentReadDto(row);
    legacyMinorSchema.min(1).parse(row.amount);
    z.enum(["pending", "paid", "void"]).parse(row.status);
    if (row.periodStart) paymentDate.parse(row.periodStart);
    if (row.periodEnd) paymentDate.parse(row.periodEnd);
    if (row.periodStart && row.periodEnd && row.periodEnd < row.periodStart) throw new Error("Invalid saved period");
    const snapshot = [row.baseAmount, row.baseCurrency, row.rateExact, row.paymentDate];
    if (snapshot.some(v => v !== null && v !== undefined)) {
      legacyMinorSchema.min(1).parse(row.baseAmount); paymentDate.parse(row.paymentDate);
      if (currencyCodeSchema.parse(row.baseCurrency) !== row.baseCurrency) throw new Error("Invalid saved base currency");
      if (row.status !== "paid" || !row.rateExact || row.baseAmount !== payrollConvert(row.amount, exactRate(row.rateExact))) throw new Error("Invalid payment snapshot");
    }
    const dto = { ...result, ...(row.baseAmount === undefined ? {} : { baseAmountMinor: row.baseAmount === null ? null : String(row.baseAmount),
      rateDirection: row.rateExact === null ? null : "quote_per_base" }) };
    stringifyWire(dto); return dto;
  } catch (error) { if (error instanceof WireCompatibilityError) throw error; throw new WireCompatibilityError("Unsupported saved payroll payment money, dates or snapshot"); }
}
