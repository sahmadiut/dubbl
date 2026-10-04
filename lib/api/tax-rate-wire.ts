import { z } from "zod";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

// Basis points are dimensionless integers, never minor-unit money or FX.
export const taxBasisPoints = z.number().int().min(0).max(2147483647)
  .refine(v => !Object.is(v, -0), "Negative zero is not canonical")
  .describe("Integer basis points 0..2147483647; 1000 = 10%; not money or FX");
const name = z.string().min(1).max(10000);
export const taxId = z.string().uuid().describe("Organization-owned resource UUID");
export const taxComponentSchema = z.object({
  name: name.describe("Compound component name"),
  rate: taxBasisPoints,
  accountId: taxId.nullable().optional().describe("Live active organization-owned chart account UUID; null/omitted uses default control account"),
}).strict();
export const taxRateFields = {
  name: name.describe("Tax rate display name"),
  rate: taxBasisPoints,
  type: z.enum(["sales", "purchase", "both"]).default("both").describe("Sales, purchases or both; default both"),
  kind: z.enum(["standard", "blocked", "partial_block", "exempt", "reverse_charge", "no_vat", "sales_tax_us"])
    .default("standard").describe("Posting/recovery behavior; default standard; recovery share applies to standard/partial_block"),
  recoverablePercent: taxBasisPoints.pipe(z.number().max(10000)).default(10000)
    .describe("Recoverable input-tax share in integer basis points 0..10000; 10000 = 100%; default 10000"),
  components: z.array(taxComponentSchema).max(100).optional().describe("Up to 100 compound components; update replaces all, [] clears, omission retains; rates independent of header"),
  isDefault: z.boolean().default(false).describe("Organization default; true clears other defaults; default false"),
};
export const taxCreateSchema = z.object(taxRateFields).strict();
export const taxUpdateSchema = z.object({ ...taxRateFields,
  type: taxRateFields.type.removeDefault().describe("Optional sales/purchase/both applicability"),
  kind: taxRateFields.kind.removeDefault().describe("Optional posting/recovery behavior"),
  recoverablePercent: taxRateFields.recoverablePercent.removeDefault().describe("Optional input-tax recovery share, integer basis points 0..10000"),
  isDefault: taxRateFields.isDefault.removeDefault().describe("Optional default choice; true clears other organization defaults"),
}).partial().strict();
export const taxCountry = z.string().regex(/^[A-Za-z]{2}$/).transform(v => v.toUpperCase())
  .describe("Two ASCII-letter country code, case-insensitive; no whitespace");
export const taxProfileSchema = z.object({ country: taxCountry.optional().describe("Optional country code; omitted uses organization regime/country") }).strict();
const address = z.string().max(10000).nullable().optional();
export const taxLookupFields = {
  country: name.describe("Country key, matched exactly as stored"),
  state: address.describe("Optional exact state key; null/empty omits filter"),
  postalCode: address.describe("Optional exact postal code; null/empty omits filter"),
};
export const taxLookupSchema = z.object(taxLookupFields).strict();
export const taxJurisdictionFields = { ...taxLookupFields,
  county: address.describe("Optional county name"), city: address.describe("Optional city name"),
  combinedRate: taxBasisPoints,
  stateRate: taxBasisPoints.optional().describe("State basis points 0..2147483647; default 0"),
  countyRate: taxBasisPoints.optional().describe("County basis points 0..2147483647; default 0"),
  cityRate: taxBasisPoints.optional().describe("City basis points 0..2147483647; default 0"),
  specialRate: taxBasisPoints.optional().describe("Special basis points 0..2147483647; default 0; combined rate remains independent"),
};
export const taxJurisdictionSchema = z.object(taxJurisdictionFields).strict();
export async function readTaxJson(request: Request) {
  try { return await request.json(); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON tax body" }]); }
}
export function taxRateDto<T extends { rate: number; recoverablePercent: number; components?: { rate: number }[] }>(row: T): T {
  try {
    taxBasisPoints.parse(row.rate); taxBasisPoints.parse(row.recoverablePercent);
    if (row.recoverablePercent > 10000) throw new Error("Unsupported recovery share");
    row.components?.forEach(c => taxBasisPoints.parse(c.rate)); stringifyWire(row); return row;
  } catch { throw new WireCompatibilityError("Unsupported stored tax basis points"); }
}
export function taxJurisdictionDto<T extends { combinedRate: number; stateRate: number; countyRate: number; cityRate: number; specialRate: number }>(row: T): T {
  try {
    for (const key of ["combinedRate", "stateRate", "countyRate", "cityRate", "specialRate"] as const) taxBasisPoints.parse(row[key]);
    stringifyWire(row); return row;
  } catch { throw new WireCompatibilityError("Unsupported stored jurisdiction basis points"); }
}
