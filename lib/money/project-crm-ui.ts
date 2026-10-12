import { currencyMetadata } from "./exact";
import { coreStoredMinor } from "./core-presentation";

const fields = new Set(["budget", "hourlyRate", "fixedPrice", "totalBilled", "costRate", "amount", "invoicedAmountCents", "costAmount", "billableAmount", "totalAmount", "valueCents", "activeValue", "wonValue", "totalPipelineValue", "avgDealValue", "unitPrice", "creditLimit", "remaining", "totalInvoiced", "totalRemaining", "billableExpensesTotal", "billedAmount", "registeredBillableTotal", "subtotal", "taxTotal", "amountPaid", "amountDue"]);
const nullable = new Set(["hourlyRate", "costRate", "creditLimit", "remaining", "totalInvoiced", "totalRemaining", "billableExpensesTotal", "billedAmount", "registeredTotal", "billedTotal"]);
/** Validate saved numeric/exact pairs before UI adoption; counts, minutes and percentages retain their units. */
export function projectCrmUiPayload<T>(value: T): T {
  if (Array.isArray(value)) { value.forEach(projectCrmUiPayload); return value; }
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  for (const key of ["currency", "currencyCode"]) if (key in row && row[key] !== null) {
    if (typeof row[key] !== "string" || currencyMetadata(row[key] as string).code !== row[key]) throw new RangeError("Invalid saved currency label");
  }
  const required = "billingType" in row && "name" in row ? ["budget", "hourlyRate", "fixedPrice", "totalBilled"]
    : "stageId" in row && "title" in row ? ["valueCents"] : "minutes" in row && "isBillable" in row ? ["hourlyRate"]
    : "invoicedAmountCents" in row ? ["amount"] : "activeCount" in row ? ["activeValue", "wonValue"]
    : "totalPipelineValue" in row ? ["wonValue", "avgDealValue"] : [];
  if ("billingType" in row || "stageId" in row && "title" in row || "activeCount" in row || "totalPipelineValue" in row) {
    if (typeof row.currency !== "string") throw new RangeError("Saved currency is required");
  }
  if ("billingType" in row && !("name" in row)) {
    required.push("billableExpensesTotal");
    if (row.billingType === "hourly") required.push("totalAmount");
    if (row.billingType === "milestone") required.push("totalRemaining");
    if (row.billingType === "fixed") required.push("fixedPrice", "totalInvoiced", "remaining");
  }
  if ("invoiceNumber" in row) required.push("subtotal", "taxTotal", "total", "amountPaid", "amountDue");
  for (const name of required) if (!(name in row)) throw new RangeError(`Missing saved ${name}`);
  const names = new Set(fields);
  if ("valueMinor" in row || "count" in row && "value" in row) names.add("value");
  // Billing preview totals have exact aliases; pagination totals remain counts.
  if ("totalMinor" in row) names.add("total");
  for (const name of names) {
    if (!(name in row) && !(name + "Minor" in row)) continue;
    const numeric = row[name], exact = row[name + "Minor"];
    if (numeric === null) {
      if (!nullable.has(name) || exact !== null) throw new RangeError(`Invalid nullable ${name}`);
    } else {
      if (Object.is(numeric, -0)) throw new RangeError("Noncanonical saved money");
      const amount = coreStoredMinor(numeric as number, exact as string);
      if (!["creditLimit", "remaining"].includes(name) && amount < 0n) throw new RangeError(`Negative saved ${name}`);
    }
  }
  for (const child of Object.values(row)) if (child && typeof child === "object") projectCrmUiPayload(child);
  return value;
}
export async function projectCrmJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load project or CRM data");
  return projectCrmUiPayload(body);
}
