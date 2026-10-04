import { z } from "zod";
import { exactMinorSchema, WireCompatibilityError } from "@/lib/money/wire";

export const approvalEntity = z.enum(["bill", "expense", "invoice", "journal_entry", "purchase_order"])
  .describe("Document type governed by the workflow");
export type ApprovalEntity = z.infer<typeof approvalEntity>;
const documentMoney = ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"];
export const approvalMoneyFields: Record<ApprovalEntity, string[]> = {
  bill: documentMoney, invoice: documentMoney, expense: ["totalAmount"],
  purchase_order: ["subtotal", "taxTotal", "total"], journal_entry: [],
};
const common = ["id", "organizationId", "status", "reference", "createdBy"];
export const approvalTextFields: Record<ApprovalEntity, string[]> = {
  bill: [...common, "contactId", "billNumber", "issueDate", "dueDate", "currencyCode", "notes"],
  invoice: [...common, "contactId", "invoiceNumber", "invoiceType", "issueDate", "dueDate", "currencyCode", "notes"],
  expense: ["id", "organizationId", "status", "title", "description", "submittedBy", "currencyCode"],
  purchase_order: [...common, "contactId", "poNumber", "issueDate", "deliveryDate", "currencyCode", "notes"],
  journal_entry: [...common, "date", "description", "sourceType", "sourceId", "fiscalYearId"],
};
const integerFields: Record<ApprovalEntity, string[]> = {
  invoice: ["depositPercent"], journal_entry: ["entryNumber"], bill: [], expense: [], purchase_order: [],
};
export const conditionSchema = z.object({
  field: z.enum([...new Set([...Object.values(approvalMoneyFields).flat(), ...Object.values(approvalTextFields).flat(), ...Object.values(integerFields).flat()])])
    .describe("Supported header field, validated for the chosen document type; monetary fields use document currency minor units"),
  operator: z.enum(["eq", "neq", "gt", "lt", "gte", "lte"]).describe("Equality/inequality or exact integer ordering; text supports eq/neq only"),
  value: z.string().max(4096).optional().describe("Legacy string threshold: canonical signed int64 integer for numeric fields (money in minor units, depositPercent in basis points, entryNumber as ordinal); literal text for text fields"),
  valueMinor: exactMinorSchema.optional().describe("Exact canonical signed int64 threshold string for monetary fields only; must agree with value when both are supplied"),
}).strict().describe("One condition; all workflow conditions must match");
export type ApprovalCondition = { field: string; operator: z.infer<typeof conditionSchema>["operator"]; value: string };

export function parseConditions(entityType: ApprovalEntity, input: unknown): ApprovalCondition[] {
  return z.array(conditionSchema).max(100).parse(input).map(c => {
    const monetary = approvalMoneyFields[entityType].includes(c.field);
    const integer = monetary || integerFields[entityType].includes(c.field);
    if (!integer && !approvalTextFields[entityType].includes(c.field)) throw new Error(`Unsupported approval field: ${c.field}`);
    if (c.value === undefined && c.valueMinor === undefined) throw new Error("Provide condition value or valueMinor");
    if (c.valueMinor !== undefined && !monetary) throw new Error("valueMinor is supported only for monetary fields");
    if (c.value !== undefined && c.valueMinor !== undefined && c.value !== c.valueMinor) throw new Error("Condition value and valueMinor disagree");
    const value = c.valueMinor ?? c.value!;
    if (integer) exactMinorSchema.parse(value);
    else if (c.operator !== "eq" && c.operator !== "neq") throw new Error("Text conditions support eq/neq only");
    return { field: c.field, operator: c.operator, value };
  });
}

export function conditionDto(entityType: ApprovalEntity, input: unknown) {
  try {
    return parseConditions(entityType, input).map(c => approvalMoneyFields[entityType].includes(c.field)
      ? { ...c, valueMinor: c.value } : c);
  } catch { throw new WireCompatibilityError("Saved approval conditions are invalid or unsupported; repair the workflow explicitly"); }
}

export function evaluateConditions(entityType: ApprovalEntity, input: unknown, entity: Record<string, unknown>): boolean {
  // Validate every condition and operand before AND evaluation; never short-circuit malformed money.
  const conditions = conditionDto(entityType, input);
  const decisions = conditions.map(c => {
    if (!Object.hasOwn(entity, c.field) || entity[c.field] == null) return false;
    const raw = entity[c.field];
    const integer = approvalMoneyFields[entityType].includes(c.field) || integerFields[entityType].includes(c.field);
    let left: string | bigint, right: string | bigint;
    if (integer) {
      if (typeof raw === "number" && (!Number.isSafeInteger(raw) || Object.is(raw, -0)))
        throw new WireCompatibilityError("Approval operand must be a safe integer or canonical signed int64 string");
      if (!["number", "string", "bigint"].includes(typeof raw)) throw new WireCompatibilityError("Unsupported approval operand");
      try { left = BigInt(exactMinorSchema.parse(String(raw))); } catch { throw new WireCompatibilityError("Unsupported approval integer operand"); }
      right = BigInt(c.value);
    } else {
      if (typeof raw !== "string") throw new WireCompatibilityError("Approval text operand must be a string");
      left = raw; right = c.value;
    }
    switch (c.operator) {
      case "eq": return left === right;
      case "neq": return left !== right;
      case "gt": return left > right;
      case "lt": return left < right;
      case "gte": return left >= right;
      case "lte": return left <= right;
    }
  });
  return decisions.every(Boolean);
}
