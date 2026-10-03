import { z } from "zod";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

// These are bounded, dimensionless integers, not money or FX. Keep their numeric
// representation for both legacy and exact clients (500 basis points = 5%).
export const procurementControlSchema = z.object({
  priceTolerancePercent: z.number().int().min(0).max(100000)
    .describe("Price tolerance: integer basis points from 0 to 100000 (500 = 5%); not currency minor units"),
  qtyTolerancePercent: z.number().int().min(0).max(100000)
    .describe("Quantity tolerance: integer basis points from 0 to 100000 (500 = 5%); not physical quantity units"),
  requireGrnBeforeBill: z.boolean()
    .describe("Block billing goods that have not been received via a GRN"),
  blockOverBill: z.boolean()
    .describe("Block billing beyond the ordered quantity and billing unreceived goods"),
});
export const procurementSettingsUpdateSchema = procurementControlSchema.partial();

/** Reject unsupported stored controls before reads/matching or write commit. */
export function validateProcurementControls(input: unknown) {
  const result = procurementControlSchema.safeParse(input);
  if (!result.success) throw new WireCompatibilityError("Stored procurement controls must use integer basis points from 0 to 100000 and boolean flags");
  return result.data;
}

export function procurementSettingsDto<T extends object>(row: T) {
  validateProcurementControls(row);
  stringifyWire(row);
  return row;
}
