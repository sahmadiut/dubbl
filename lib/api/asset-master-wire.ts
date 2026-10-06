import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const assetMasterId = z.string().uuid().describe("Asset or category UUID in the authenticated organization");
const amount = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const exact = exactMinorSchema.refine(v => !v.startsWith("-"), "Amount must be nonnegative");
const text = z.string().max(10000);
const int32 = z.number().int().min(0).max(2147483647);
export const assetDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const date = new Date(v + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Use a valid Gregorian YYYY-MM-DD date");
const method = z.enum(["straight_line", "declining_balance", "units_of_production", "sum_of_years_digits"]);
const convention = z.enum(["full_month", "mid_month", "half_year", "mid_quarter", "pro_rata_days", "full_at_purchase"]);
const accounts = {
  assetAccountId: assetMasterId.nullable().optional().describe("Live active organization-owned asset-cost GL account; null clears"),
  depreciationAccountId: assetMasterId.nullable().optional().describe("Live active organization-owned depreciation GL account; null clears"),
  accumulatedDepAccountId: assetMasterId.nullable().optional().describe("Live active organization-owned accumulated-depreciation GL account; null clears"),
  cwipAccountId: assetMasterId.nullable().optional().describe("Live active organization-owned CWIP GL account; null clears"),
};
const categoryFields = {
  name: text.min(1).describe("Category name"),
  defaultDepreciationMethod: method.optional().describe("Default method; straight_line when omitted on create"),
  defaultConvention: convention.optional().describe("Default timing convention; full_month when omitted on create"),
  defaultUsefulLifeMonths: int32.min(1).nullable().optional().describe("Default useful life in months, 1..2147483647; null clears"),
  defaultResidualValue: amount.optional().describe("Nonnegative integer cents, max 9007199254740991; defaults zero only when both aliases omitted"),
  defaultResidualValueMinor: exact.optional().describe("Canonical nonnegative cents string; same safe range; must agree with defaultResidualValue"),
  defaultDepreciationRateBp: int32.max(100000).nullable().optional().describe("Default rate in basis points, 0..100000 (2000 = 20%); metadata, not money; null clears"),
  ...accounts,
  isActive: z.boolean().optional().describe("Active template flag; defaults true on create"),
};
export const assetCategoryCreateSchema = z.object(categoryFields).strict();
export const assetCategoryUpdateSchema = z.object({ ...categoryFields, name: categoryFields.name.optional() }).strict();
const assetFields = {
  name: text.min(1).describe("Asset name"),
  description: text.nullable().optional().describe("Description; null clears"),
  assetNumber: text.min(1).describe("Asset number/tag; stored as entered, not a uniqueness guarantee"),
  categoryId: assetMasterId.nullable().optional().describe("Live organization-owned category; defaults copied only on create; null clears association"),
  inServiceDate: assetDate.nullable().optional().describe("Gregorian YYYY-MM-DD service date; defaults purchaseDate on create; null clears on update"),
  residualValue: amount.optional().describe("Nonnegative residual in integer cents, max 9007199254740991; cannot exceed cost"),
  residualValueMinor: exact.optional().describe("Canonical nonnegative residual cents string; same safe range; must agree with residualValue"),
  usefulLifeMonths: int32.min(1).optional().describe("Useful life in months, 1..2147483647; required directly or by category on create"),
  depreciationMethod: method.optional().describe("Depreciation method; category default or straight_line on create"),
  convention: convention.optional().describe("Timing convention; category default or full_month on create"),
  totalExpectedUnits: int32.nullable().optional().describe("Expected physical units, 0..2147483647; positive for units_of_production; null clears"),
  unitOfMeasure: text.nullable().optional().describe("Physical unit label; null clears"),
  isCwip: z.boolean().optional().describe("CWIP flag on create; update may only retain it, use capitalization workflow to change state"),
  ...accounts,
};
export const assetCreateSchema = z.object({ ...assetFields,
  purchaseDate: assetDate.describe("Gregorian purchase date YYYY-MM-DD"),
  purchasePrice: amount.optional().describe("Acquisition cost in integer cents, max 9007199254740991; this or purchasePriceMinor required"),
  purchasePriceMinor: exact.optional().describe("Canonical nonnegative cost cents string; same safe range; must agree with purchasePrice"),
}).strict();
export const assetUpdateSchema = z.object({ ...assetFields, name: assetFields.name.optional(), assetNumber: assetFields.assetNumber.optional() }).strict();
const pagination = {
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(200).default(50).describe("Page size, max 200"),
};
export const assetCategoryListSchema = z.object({ ...pagination, isActive: z.boolean().optional().describe("Optional active-template filter") }).strict();
export const assetListSchema = z.object({ ...pagination,
  status: z.enum(["active", "fully_depreciated", "disposed", "in_progress"]).optional().describe("Optional asset status filter"),
  categoryId: assetMasterId.optional().describe("Optional organization-owned category filter"),
}).strict();

export function assetMinorPair(numeric: number | undefined, alias: string | undefined, field: string, required = false) {
  if (numeric !== undefined) amount.parse(numeric);
  if (alias !== undefined) exact.parse(alias);
  if (numeric !== undefined && alias !== undefined && String(numeric) !== alias)
    throw new z.ZodError([{ code: "custom", path: [field + "Minor"], message: "Money aliases disagree" }]);
  const value = alias === undefined ? numeric : legacyMinor(BigInt(alias));
  if (required && value === undefined) throw new z.ZodError([{ code: "custom", path: [field], message: `Provide ${field} or ${field}Minor` }]);
  return value;
}
export function assetCategoryAmounts<T extends { defaultResidualValue?: number; defaultResidualValueMinor?: string }>(input: T) {
  const { defaultResidualValueMinor, defaultResidualValue, ...rest } = input;
  return { ...rest, defaultResidualValue: assetMinorPair(defaultResidualValue, defaultResidualValueMinor, "defaultResidualValue") };
}
export function assetAmounts<T extends { residualValue?: number; residualValueMinor?: string; purchasePrice?: number; purchasePriceMinor?: string }>(input: T, required = false) {
  const { residualValueMinor, purchasePriceMinor, residualValue, purchasePrice, ...rest } = input;
  return { ...rest, residualValue: assetMinorPair(residualValue, residualValueMinor, "residualValue"),
    ...(required ? { purchasePrice: assetMinorPair(purchasePrice, purchasePriceMinor, "purchasePrice", true)! } : {}) };
}
export const assetMoneyFields = ["purchasePrice", "residualValue", "accumulatedDepreciation", "netBookValue", "revaluedAmount", "revaluationSurplusBalance", "disposalAmount"] as const;
/** Explicit known fields only; no magnitude-based or recursive alias guessing. */
export function assetMoneyDto<T extends object>(row: T, fields: readonly string[], signed: readonly string[] = []) {
  const result: Record<string, unknown> = { ...row } as Record<string, unknown>;
  try {
    for (const field of fields) {
      const value = result[field];
      if (value === null) { result[field + "Minor"] = null; continue; }
      (signed.includes(field) ? legacyMinorSchema : amount).parse(value);
      result[field + "Minor"] = String(value);
    }
    stringifyWire(result); return result as T & Record<string, unknown>;
  } catch { throw new WireCompatibilityError("Unsupported saved asset money or numeric data"); }
}
export const assetDto = <T extends object>(row: T) => {
  const result = assetMoneyDto(row, assetMoneyFields);
  try {
    if (result.usefulLifeMonths !== undefined) int32.min(1).parse(result.usefulLifeMonths);
    if (result.totalExpectedUnits !== undefined) int32.nullable().parse(result.totalExpectedUnits);
    if (result.purchaseDate !== undefined) assetDate.parse(result.purchaseDate);
    if (result.inServiceDate !== undefined) assetDate.nullable().parse(result.inServiceDate);
    return result;
  } catch { throw new WireCompatibilityError("Unsupported saved asset date, life or physical units"); }
};
export const assetCategoryDto = <T extends object>(row: T) => {
  const result = assetMoneyDto(row, ["defaultResidualValue"]);
  try {
    if (result.defaultUsefulLifeMonths !== undefined) int32.min(1).nullable().parse(result.defaultUsefulLifeMonths);
    if (result.defaultDepreciationRateBp !== undefined) int32.max(100000).nullable().parse(result.defaultDepreciationRateBp);
    return result;
  } catch { throw new WireCompatibilityError("Unsupported saved asset category life or basis-point rate"); }
};
export async function readAssetJson(request: Request) {
  try { return await request.json(); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON asset body" }]); }
}
export function assetMasterQuery(url: URL, category = false) {
  const result: Record<string, unknown> = {};
  for (const key of ["page", "limit"]) {
    const value = url.searchParams.get(key); if (value === null) continue;
    if (!/^[1-9]\d{0,6}$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Use a positive integer" }]);
    result[key] = Number(value);
  }
  if (category) {
    const value = url.searchParams.get("isActive");
    if (value !== null) {
      if (value !== "true" && value !== "false") throw new z.ZodError([{ code: "custom", path: ["isActive"], message: "Use true or false" }]);
      result.isActive = value === "true";
    }
  } else for (const key of ["status", "categoryId"]) { const value = url.searchParams.get(key); if (value !== null) result[key] = value; }
  return category ? assetCategoryListSchema.parse(result) : assetListSchema.parse(result);
}
