import { coreStoredMinor } from "./core-presentation";

// Asset/loan contracts retain fixed cents, independent of ISO currency scales.
const fields = new Set([
  "purchasePrice", "residualValue", "defaultResidualValue", "accumulatedDepreciation",
  "netBookValue", "revaluedAmount", "revaluationSurplusBalance", "disposalAmount",
  "amount", "previousCarryingAmount", "changeAmount", "surplusAmount", "impairmentAmount",
  "principalAmount", "monthlyPayment", "interestAmount", "totalPayment", "remainingBalance",
  "capitalizedCost", "reversedAmount", "gainOrLoss", "catchUpAmount", "netBookValueAtDisposal",
]);
const signed = new Set(["changeAmount", "surplusAmount", "impairmentAmount", "gainOrLoss"]);
const nullable = new Set(["revaluedAmount", "disposalAmount"]);

/** Check all present money pairs, including partial mutation DTOs and histories. */
export function assetLoanUiPayload<T>(value: T): T {
  if (Array.isArray(value)) { value.forEach(assetLoanUiPayload); return value; }
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  const required = "purchaseDate" in row && "assetNumber" in row
    ? ["purchasePrice", "residualValue", "accumulatedDepreciation", "netBookValue"]
    : "termMonths" in row && "startDate" in row ? ["principalAmount", "monthlyPayment"]
    : "periodNumber" in row ? ["principalAmount", "interestAmount", "totalPayment", "remainingBalance"]
    : "defaultDepreciationMethod" in row ? ["defaultResidualValue"] : [];
  for (const name of required) if (!(name in row)) throw new RangeError(`Missing saved ${name}`);
  const names = new Set(fields);
  // CWIP total is money; pagination total is a count.
  if ("totalMinor" in row || "costs" in row && "total" in row) names.add("total");
  for (const name of names) {
    if (!(name in row) && !(name + "Minor" in row)) continue;
    const numeric = row[name], exact = row[name + "Minor"];
    if (numeric === null) {
      if (!nullable.has(name) || exact !== null) throw new RangeError(`Invalid saved ${name} money pair`);
    } else {
      if (Object.is(numeric, -0)) throw new RangeError("Noncanonical saved asset/loan money");
      const amount = coreStoredMinor(numeric as number, exact as string);
      if (!signed.has(name) && amount < 0n) throw new RangeError(`Negative saved ${name}`);
    }
  }
  for (const child of Object.values(row)) if (child && typeof child === "object") assetLoanUiPayload(child);
  return value;
}

/** Preserve server error bodies; validate successful DTOs before UI adoption. */
export async function assetLoanJson(response: Response) {
  const body = await response.json();
  if (response.ok) assetLoanUiPayload(body);
  return body;
}
