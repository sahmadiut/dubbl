import { catalogPriceMinor } from "./catalog-input";

/** Legacy payroll editors use two-decimal cents, independently of ISO display scales. */
export function payrollCentsInput(value: string): string {
  const parsed = catalogPriceMinor(value);
  if (parsed === undefined) throw new Error("Enter an amount with at most two decimal places");
  return parsed;
}
export function payrollCentsDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Unsupported payroll amount");
  const cents = BigInt(value);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
export function payrollBasisPointsInput(value: string): number {
  const bp = BigInt(payrollCentsInput(value));
  if (bp > 10000n) throw new Error("Tax percentage must be between 0 and 100");
  return Number(bp);
}
/** Preview is advisory; invalid unfinished input has no posted value. */
export function payrollCentsPreview(value: string): number {
  try { return Number(BigInt(payrollCentsInput(value || "0"))); } catch { return 0; }
}
export function payrollPeriodPreview(salary: number, frequency: string): number {
  const divisor = frequency === "weekly" ? 52n : frequency === "biweekly" ? 26n : 12n;
  const cents = BigInt(salary);
  return Number((cents * 2n + divisor) / (2n * divisor));
}
