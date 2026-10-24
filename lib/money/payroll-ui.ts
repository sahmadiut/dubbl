import { coreStoredMinor } from "./core-presentation";
import { currencyMetadata, roundRatio } from "./exact";
import { payrollMoneyDisplay } from "./payroll-display";

// Payroll money remains legacy cents for every ISO currency. Hours, percentages,
// headcounts, basis points and approximate historical FX are separate units.
const fields = new Set([
  "salary", "hourlyRate", "amount", "baseAmount", "defaultAmount", "additionalWithholding",
  "minIncome", "maxIncome", "baseAmountCents", "standardDeductionCents", "allowanceValueCents",
  "ssWageBaseCents", "addlMedicareThresholdCents", "futaWageBaseCents", "sutaWageBaseCents",
  "minSalary", "midSalary", "maxSalary", "totalBudget", "currentSalary", "proposedSalary", "difference",
  "totalGross", "totalNet", "totalDeductions", "totalTax", "avgCostPerRun",
  "grossAmount", "netAmount", "taxAmount", "deductions", "overtimeAmount", "bonusAmount",
  "preTaxDeductions", "postTaxDeductions", "ytdGross", "ytdTax", "ytdNet",
  "gross", "tax", "net", "monthlyGross", "projectedTotal", "budget", "actual", "variance",
]);
const nonnegative = new Set([
  "salary", "hourlyRate", "defaultAmount", "additionalWithholding", "minIncome", "maxIncome",
  "baseAmountCents", "standardDeductionCents", "allowanceValueCents", "ssWageBaseCents",
  "addlMedicareThresholdCents", "futaWageBaseCents", "sutaWageBaseCents",
  "minSalary", "midSalary", "maxSalary", "totalBudget", "currentSalary", "proposedSalary",
]);
const nullable = new Set([
  "hourlyRate", "amount", "baseAmount", "defaultAmount", "additionalWithholding", "maxIncome",
  "baseAmountCents", "standardDeductionCents", "totalBudget", "overtimeAmount", "bonusAmount",
  "preTaxDeductions", "postTaxDeductions",
]);

/** Validate nested DTOs before state adoption; aliases are required even at zero. */
export function payrollUiPayload<T>(value: T): T {
  if (Array.isArray(value)) { value.forEach(payrollUiPayload); return value; }
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  for (const [name, numeric] of Object.entries(row)) {
    const isMoney = fields.has(name) || /^box\d+_/.test(name) && !name.endsWith("Minor") && name !== "box13_retirement_plan";
    if (isMoney && !Array.isArray(numeric) && (numeric === null || typeof numeric !== "object")) {
      const exact = row[name + "Minor"];
      if (numeric === null) {
        if (!nullable.has(name)) throw new RangeError(`Saved payroll ${name} is required`);
        if (exact !== null) throw new RangeError(`Saved payroll ${name} aliases disagree`);
      } else {
        if (Object.is(numeric, -0)) throw new RangeError("Noncanonical saved payroll money");
        const amount = coreStoredMinor(numeric as number, exact as string);
        if (nonnegative.has(name) && amount < 0n) throw new RangeError(`Negative saved payroll ${name}`);
      }
    }
    if (name.endsWith("Minor") && !(name.slice(0, -5) in row)) throw new RangeError("Missing payroll numeric alias");
    if (["currency", "baseCurrency", "defaultCurrency"].includes(name) && numeric !== null) {
      if (typeof numeric !== "string" || currencyMetadata(numeric).code !== numeric) throw new RangeError("Unsupported saved payroll currency");
    }
    if (numeric && typeof numeric === "object") payrollUiPayload(numeric);
  }
  if ("minSalary" in row && "midSalary" in row && "maxSalary" in row &&
    (BigInt(row.minSalary as number) > BigInt(row.midSalary as number) || BigInt(row.midSalary as number) > BigInt(row.maxSalary as number)))
    throw new RangeError("Invalid saved payroll band range");
  return value;
}

/** Error bodies remain available to existing UI handlers; success DTOs are checked. */
export async function payrollJson(response: Response) {
  const body = await response.json();
  if (response.ok) payrollUiPayload(body);
  return body;
}

export function payrollSum(values: readonly number[]): bigint {
  return values.reduce((sum, value) => {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new RangeError("Exact payroll cents required");
    return sum + BigInt(value);
  }, 0n);
}

/** Clamped percentage text for charts; money never passes through Number division. */
export function payrollShare(numerator: bigint, denominator: bigint): string {
  const clamped = numerator < 0n ? 0n : numerator > denominator ? denominator : numerator;
  const tenths = denominator > 0n ? roundRatio(clamped * 1000n, denominator, "half-away-from-zero") : 0n;
  return `${tenths / 10n}.${tenths % 10n}`;
}

/** Overview aggregates group currencies instead of adding unlike units. */
export function payrollGroupedDisplay(rows: readonly { amount: number; currency: string | null }[], divisor = 1n, presentation?: import("../../i18n/numbers").NumberPresentation) {
  const groups = new Map<string, bigint>();
  for (const row of rows) {
    const currency = currencyMetadata(row.currency ?? "USD").code;
    groups.set(currency, (groups.get(currency) ?? 0n) + payrollSum([row.amount]));
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) =>
    payrollMoneyDisplay(roundRatio(amount, divisor, "half-away-from-zero"), currency, presentation)).join(" · ") || "—";
}
