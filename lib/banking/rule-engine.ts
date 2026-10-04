import { ruleConditionSchema, ruleThresholds, type RuleCondition, type RuleSplitAllocation } from "@/lib/api/bank-rule-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
export interface ActiveBankRule {
  name: string; priority: number; matchField: string; matchType: string; matchValue: string;
  conditions: RuleCondition[]; matchAll: boolean; splitAllocations: RuleSplitAllocation[] | null;
  accountId: string | null; contactId: string | null; taxRateId: string | null; autoReconcile: boolean;
}
export interface RuleEvaluable {
  description: string; reference?: string | null; amount?: number | null; payee?: string | null; counterparty?: string | null;
}
export function ruleMatches(transaction: RuleEvaluable, rule: ActiveBankRule) {
  const conditions = rule.conditions.length ? rule.conditions : [{ field: rule.matchField, op: rule.matchType, value: rule.matchValue }];
  const evaluate = (input: unknown) => {
    const c = ruleConditionSchema.parse(input);
    if (c.field === "amount") {
      if (transaction.amount == null) return false;
      if (!Number.isSafeInteger(transaction.amount)) throw new WireCompatibilityError("Unsafe bank rule evaluation amount");
      const amount = BigInt(transaction.amount), [min, max] = ruleThresholds(c.op, c.value);
      return c.op === "equals" ? amount === min : c.op === "gt" ? amount > min : c.op === "lt" ? amount < min : amount >= min && amount <= max;
    }
    const value = (transaction[c.field] ?? "").toLowerCase(), match = c.value.toLowerCase();
    return c.op === "equals" ? value === match : c.op === "contains" ? value.includes(match) : c.op === "starts_with" ? value.startsWith(match) : value.endsWith(match);
  };
  const matches = conditions.map(evaluate);
  return rule.matchAll ? matches.every(Boolean) : matches.some(Boolean);
}
export function applyBankRulesToTransaction(rules: ActiveBankRule[], transaction: RuleEvaluable) {
  const rule = rules.find(rule => ruleMatches(transaction, rule));
  return rule ? { accountId: rule.accountId, contactId: rule.contactId, taxRateId: rule.taxRateId, reconcile: rule.autoReconcile,
    splitAllocations: rule.splitAllocations?.length ? rule.splitAllocations : null, ruleName: rule.name } : null;
}
