import { z } from "zod";
import { exactMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const id = z.string().uuid();
const field = z.enum(["description", "reference", "amount", "payee", "counterparty"]);
const textOp = z.enum(["contains", "equals", "starts_with", "ends_with"]);
const numeric = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
function invalid(message: string): never { throw new z.ZodError([{ code: "custom", path: [], message }]); }
export async function readBankRuleJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { invalid("Invalid JSON bank rule body"); }
}
export function ruleThresholds(op: string, value: string): bigint[] {
  const parts = op === "between" ? value.split(",") : [value];
  if (parts.length !== (op === "between" ? 2 : 1)) invalid("between requires min,max in canonical signed minor units");
  const amounts = parts.map(p => BigInt(exactMinorSchema.parse(p)));
  for (const amount of amounts) legacyMinor(amount);
  if (amounts.length === 2 && amounts[0] > amounts[1]) invalid("Minimum must not exceed maximum");
  return amounts;
}
export const ruleConditionSchema = z.object({
  field: field.describe("Transaction field; amount uses signed BANK currency minor units, USD cents"),
  op: z.enum(["contains", "equals", "starts_with", "ends_with", "gt", "lt", "between"]).describe("Text comparison, or amount equals/gt/lt/inclusive between"),
  value: z.string().min(1).max(10000).describe("Text or canonical signed minor-unit integer; between is min,max without spaces; safe numeric range"),
}).strict().superRefine((v, ctx) => {
  if (v.field === "amount") {
    if (!["equals", "gt", "lt", "between"].includes(v.op)) { ctx.addIssue({ code: "custom", message: "Unsupported amount operator" }); return; }
    try { ruleThresholds(v.op, v.value); } catch (error) {
      if (error instanceof WireCompatibilityError) throw error;
      ctx.addIssue({ code: "custom", message: "Invalid canonical amount condition or range" });
    }
  } else if (!textOp.safeParse(v.op).success) ctx.addIssue({ code: "custom", message: "Numeric operators require amount field" });
});
export const ruleSplitSchema = z.object({
  accountId: id.describe("Active organization-owned category GL UUID"),
  percent: z.number().min(0).max(100).refine(v => /^\d+(?:\.\d{1,6})?$/.test(String(v)), "Use at most six decimal places")
    .optional().describe("Percent 0..100 with at most six decimals; used when fixed amount absent"),
  amount: numeric.optional().describe("Fixed nonnegative safe integer BANK currency minor units, USD cents; takes precedence over percent"),
  amountMinor: exactMinorSchema.optional().describe("Canonical nonnegative fixed minor-unit string; agrees with amount; maximum 9007199254740991"),
  taxRateId: id.optional().describe("Active organization-owned tax UUID; direction checked at posting"),
}).strict().superRefine((v, ctx) => {
  const validExact = v.amountMinor !== undefined && exactMinorSchema.safeParse(v.amountMinor).success;
  if (validExact && BigInt(v.amountMinor!) < 0n) ctx.addIssue({ code: "custom", message: "Fixed amount must be nonnegative" });
  if (numeric.safeParse(v.amount).success && validExact && BigInt(v.amount!) !== BigInt(v.amountMinor!)) ctx.addIssue({ code: "custom", message: "Money aliases disagree" });
});
export type RuleCondition = z.infer<typeof ruleConditionSchema>;
export type RuleSplitAllocation = z.infer<typeof ruleSplitSchema>;
export const ruleFields = {
  name: z.string().min(1).max(10000).describe("Rule name"),
  priority: z.number().int().min(-2147483648).max(2147483647).default(0).describe("Signed int32 priority; highest first, UUID breaks ties"),
  matchField: field.default("description").describe("Legacy single-condition field; multi-conditions supersede it"),
  matchType: textOp.optional().describe("Legacy text comparison operator"),
  matchValue: z.string().min(1).max(10000).optional().describe("Legacy comparison text; amount equals uses canonical signed minor units"),
  conditions: z.array(ruleConditionSchema).max(100).default([]).describe("Up to 100 conditions; nonempty supersedes legacy comparison"),
  matchAll: z.boolean().default(true).describe("true matches all conditions; false matches any"),
  splitAllocations: z.array(ruleSplitSchema).min(1).max(100).nullable().optional().describe("Optional splits; sequential fixed/percentage amounts are capped, last receives exact remainder; split rules post when applied"),
  accountId: id.nullable().optional().describe("Active owned category GL UUID or null"),
  contactId: id.nullable().optional().describe("Live owned contact UUID or null"),
  taxRateId: id.nullable().optional().describe("Active owned tax UUID or null"),
  autoReconcile: z.boolean().default(false).describe("Post single-account rule and reconcile; requires banking permission"),
  isActive: z.boolean().default(true).describe("Enable or disable rule"),
};
export const ruleCreateSchema = z.object(ruleFields).strict().superRefine((v, ctx) => {
  if (!v.conditions.length) {
    if (!v.matchType || !v.matchValue) ctx.addIssue({ code: "custom", message: "Provide conditions or legacy matchType/matchValue" });
    else {
      const parsed = ruleConditionSchema.safeParse({ field: v.matchField, op: v.matchType, value: v.matchValue });
      if (!parsed.success) ctx.addIssue({ code: "custom", message: "Invalid legacy condition" });
    }
  }
});
export const ruleUpdateSchema = z.object({ ...ruleFields,
  priority: ruleFields.priority.removeDefault().describe("Optional signed int32 priority"),
  matchField: ruleFields.matchField.removeDefault().describe("Optional legacy comparison field"),
  conditions: ruleFields.conditions.removeDefault().describe("Optional replacement conditions; empty restores legacy comparison"),
  matchAll: ruleFields.matchAll.removeDefault().describe("Optional all/any conditions choice"),
  autoReconcile: ruleFields.autoReconcile.removeDefault().describe("Optional single-account posting choice"),
  isActive: ruleFields.isActive.removeDefault().describe("Optional active status"),
}).partial().strict();
export function ruleFixedAmount(a: RuleSplitAllocation) {
  if (a.amount === undefined && a.amountMinor === undefined) return undefined;
  const value = legacyMinor(a.amountMinor === undefined ? BigInt(a.amount!) : BigInt(a.amountMinor));
  if (value < 0) invalid("Fixed amount must be nonnegative");
  return value;
}
export function normalizeRule(input: unknown) {
  const v = ruleCreateSchema.parse(input);
  return { ...v, matchType: v.matchType ?? "contains" as const, matchValue: v.matchValue ?? "",
    accountId: v.accountId ?? null, contactId: v.contactId ?? null, taxRateId: v.taxRateId ?? null,
    splitAllocations: v.splitAllocations?.map(a => { const amount = ruleFixedAmount(a); const { amountMinor: _alias, ...rest } = a; void _alias; return amount === undefined ? rest : { ...rest, amount }; }) ?? null };
}
export function ruleDto<T extends { conditions: unknown; splitAllocations: unknown }>(row: T) {
  try {
    const keys = Object.keys(ruleFields), config = Object.fromEntries(Object.entries(row).filter(([key]) => keys.includes(key)));
    // Superseded legacy empty value is valid storage, not a client create input.
    if (Array.isArray(config.conditions) && config.conditions.length) { delete config.matchType; delete config.matchValue; }
    const normalized = normalizeRule(config);
    const result = { ...row, conditions: normalized.conditions, splitAllocations: normalized.splitAllocations?.map((a): RuleSplitAllocation =>
      a.amount === undefined ? a : { ...a, amountMinor: String(a.amount) }) ?? null };
    stringifyWire(result); return result;
  } catch (error) { if (error instanceof WireCompatibilityError) throw error; throw new WireCompatibilityError("Unsupported saved bank rule configuration"); }
}
export function resolveSplitAmounts(allocations: RuleSplitAllocation[], signedTotal: number) {
  if (!Number.isSafeInteger(signedTotal) || Object.is(signedTotal, -0)) throw new WireCompatibilityError("Unsafe bank rule amount");
  const total = signedTotal < 0 ? -BigInt(signedTotal) : BigInt(signedTotal), sign = signedTotal < 0 ? -1n : 1n;
  let allocated = 0n;
  const result: { allocation: RuleSplitAllocation; amount: number }[] = [];
  for (let i = 0; i < allocations.length; i++) {
    const allocation = ruleSplitSchema.parse(allocations[i]), fixed = ruleFixedAmount(allocation);
    let portion = 0n;
    if (i === allocations.length - 1) portion = total - allocated;
    else if (fixed !== undefined) portion = BigInt(fixed);
    else if (allocation.percent !== undefined) {
      const [whole, fraction = ""] = String(allocation.percent).split(".");
      const numerator = BigInt(whole + fraction), denominator = 100n * 10n ** BigInt(fraction.length);
      portion = (total * numerator * 2n + denominator) / (denominator * 2n);
    }
    if (portion > total - allocated) portion = total - allocated;
    allocated += portion;
    if (portion) result.push({ allocation, amount: legacyMinor(portion * sign) });
  }
  return result;
}
export const ruleApplyFields = {
  bankAccountId: id.optional().describe("Optional live active owned bank UUID; omitted applies across owned active banks"),
  dryRun: z.boolean().default(false).describe("Preview matching uncategorized, unlinked, unreconciled lines without mutations"),
};
export const ruleApplySchema = z.object(ruleApplyFields).strict();
export const ruleAutoFields = {
  bankAccountId: id.optional().describe("Optional live active owned bank UUID"),
  confidenceThreshold: z.number().int().min(70).max(100).default(85).describe("Minimum confidence 70..100; signed exact amount and bank GL must also match"),
};
export const ruleAutoSchema = z.object(ruleAutoFields).strict();
