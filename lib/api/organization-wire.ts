import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { functionalCurrencySchema } from "@/lib/currency/functional-currency";
import { isValidBusinessType } from "@/lib/data/business-types";
import { exactMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const nullableText = z.string().nullable().optional();
export const organizationUpdateFields = {
  name: z.string().min(1).optional().describe("Optional organization display name"),
  slug: z.string().min(1).optional().describe("Optional unique organization slug"),
  country: z.string().min(1).nullable().optional().describe("Optional country; null clears"),
  businessType: z.string().min(1).nullable().optional().describe("Optional business type valid for the selected country; null clears"),
  defaultCurrency: functionalCurrencySchema.optional().describe("ISO functional currency, immutable after journal activity; IRR remains gated; no amounts rescale"),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional().describe("Gregorian fiscal start month, integer 1 through 12"),
  countryCode: z.string().max(2).nullable().optional().describe("Optional country code, at most two characters; null clears"),
  taxId: nullableText.describe("Optional tax registration identifier; null clears"),
  businessRegistrationNumber: nullableText.describe("Optional business registration number; null clears"),
  legalEntityType: nullableText.describe("Optional legal entity type; null clears"),
  addressStreet: nullableText.describe("Optional street address; null clears"),
  addressCity: nullableText.describe("Optional address city; null clears"),
  addressState: nullableText.describe("Optional address state; null clears"),
  addressPostalCode: nullableText.describe("Optional postal code; null clears"),
  addressCountry: nullableText.describe("Optional address country; null clears"),
  contactPhone: nullableText.describe("Optional contact phone; null clears"),
  contactEmail: nullableText.describe("Optional contact email; null clears"),
  contactWebsite: nullableText.describe("Optional contact website; null clears"),
  defaultPaymentTerms: nullableText.describe("Optional default payment terms; null clears"),
  industrySector: nullableText.describe("Optional industry sector; null clears"),
  referralSource: nullableText.describe("Optional referral source; null clears"),
  peppolId: nullableText.describe("Optional PEPPOL participant identifier; null clears"),
  peppolScheme: nullableText.describe("Optional PEPPOL participant scheme; null clears"),
  onboardingCompleted: z.boolean().optional().describe("True completes the getting-started checklist; false reopens; alone requires view:data"),
};
export const organizationUpdateSchema = z.object(organizationUpdateFields).strict();

// Validate the merged candidate: country-only and business-type-only patches
// must not bypass the joint validity check.
export function validateOrganizationBusinessType(row: { businessType: string | null; countryCode: string | null; country: string | null }) {
  const country = row.countryCode || row.country;
  if (row.businessType && country && !isValidBusinessType(country, row.businessType))
    throw new z.ZodError([{ code: "custom", path: ["businessType"], message: "Invalid business type for the selected country" }]);
}

export const mileageRateFields = {
  mileageRate: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
    .refine(value => !Object.is(value, -0), "Negative zero is not canonical money")
    .optional().describe("Nonnegative safe integer organization currency minor units per mile; USD 67 = $0.67/mile"),
  mileageRateMinor: exactMinorSchema.optional().describe("Canonical nonnegative minor-unit string per mile; agrees with mileageRate; supported maximum 9007199254740991"),
};
export const mileageRateSchema = z.object(mileageRateFields).strict();
export function parseMileageRate(input: unknown) {
  const parsed = mileageRateSchema.parse(input);
  if (parsed.mileageRate === undefined && parsed.mileageRateMinor === undefined)
    throw new z.ZodError([{ code: "custom", path: ["mileageRateMinor"], message: "Provide mileageRate or mileageRateMinor" }]);
  if (parsed.mileageRateMinor !== undefined && BigInt(parsed.mileageRateMinor) < 0n)
    throw new z.ZodError([{ code: "custom", path: ["mileageRateMinor"], message: "Mileage rate must be nonnegative" }]);
  if (parsed.mileageRate !== undefined && parsed.mileageRateMinor !== undefined && String(parsed.mileageRate) !== parsed.mileageRateMinor)
    throw new z.ZodError([{ code: "custom", path: ["mileageRateMinor"], message: "Mileage rate aliases disagree" }]);
  return parsed.mileageRateMinor === undefined ? parsed.mileageRate! : legacyMinor(BigInt(parsed.mileageRateMinor));
}

function savedMoney(value: unknown) {
  if (value === null) return { numeric: null, exact: null };
  if ((typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0)) && typeof value !== "bigint")
    throw new WireCompatibilityError("Organization money must be a nonnegative safe integer or null");
  const exact = BigInt(value as number | bigint);
  if (exact < 0n) throw new WireCompatibilityError("Organization money must be nonnegative");
  return { numeric: legacyMinor(exact), exact: exact.toString() };
}
export function organizationDto<T extends { defaultCurrency: string; mileageRate: unknown; billApprovalThreshold: unknown }>(row: T) {
  const currency = currencyCodeSchema.safeParse(row.defaultCurrency);
  if (!currency.success || currency.data !== row.defaultCurrency) throw new WireCompatibilityError("Invalid saved organization currency");
  const rate = savedMoney(row.mileageRate), threshold = savedMoney(row.billApprovalThreshold);
  const dto = { ...row, mileageRate: rate.numeric, mileageRateMinor: rate.exact,
    billApprovalThreshold: threshold.numeric, billApprovalThresholdMinor: threshold.exact };
  stringifyWire(dto); return dto;
}
export function mileageRateDto(row: { defaultCurrency: string; mileageRate: unknown; billApprovalThreshold: unknown }) {
  const org = organizationDto(row);
  // Preserve the fallback's integer units without replacing the saved null.
  return { mileageRate: org.mileageRate ?? 67, mileageRateMinor: org.mileageRateMinor ?? "67", currencyCode: org.defaultCurrency };
}
export async function readOrganizationJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON organization body" }]);
  }
}
