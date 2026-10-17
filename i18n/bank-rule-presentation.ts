import type { useTranslations } from "next-intl";
type BankTranslate = ReturnType<typeof useTranslations<"SettingsBankRules">>;

export type ConditionField =
  | "description"
  | "reference"
  | "amount"
  | "payee"
  | "counterparty";
export type ConditionOp =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "lt"
  | "between";

export interface RuleCondition {
  field: ConditionField;
  op: ConditionOp;
  value: string;
}

export interface SplitAllocation {
  accountId: string;
  percent?: number;
  amount?: number;
  amountMinor?: string;
  taxRateId?: string;
}

export interface BankRule {
  id: string;
  name: string;
  priority: number;
  matchField: string;
  matchType: string;
  matchValue: string;
  conditions?: RuleCondition[] | null;
  matchAll: boolean;
  splitAllocations?: SplitAllocation[] | null;
  accountId: string | null;
  contactId: string | null;
  taxRateId: string | null;
  autoReconcile: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AccountOption {
  id: string;
  name: string;
}

export interface ContactOption {
  id: string;
  name: string;
}

export interface TaxRateOption {
  id: string;
  name: string;
}

const AMOUNT_FIELDS: ConditionField[] = ["amount"];

export function isAmountField(field: ConditionField) {
  return AMOUNT_FIELDS.includes(field);
}

export function summarizeRule(
  t: BankTranslate,
  rule: BankRule,
  accounts: AccountOption[],
  taxRates: TaxRateOption[],
  contacts: ContactOption[]
): { match: string; actions: string[] } {
  const conds =
    rule.conditions && rule.conditions.length > 0
      ? rule.conditions
      : ([
          {
            field: (rule.matchField as ConditionField) || "description",
            op: (rule.matchType as ConditionOp) || "contains",
            value: rule.matchValue,
          },
        ] as RuleCondition[]);

  const joiner = rule.matchAll ? t("and") : t("or");
  const match = conds
    .map((c) => {
      const fieldLabel = bankFieldLabels(t)[c.field] ?? c.field;
      const opLabel =
        opsForField(c.field, t).find((o) => o.value === c.op)?.label ?? c.op;
      let val = c.value;
      if (isAmountField(c.field)) {
        if (c.op === "between") {
          const [a, b] = c.value.split(",");
          val = t("amountRange", { min: a, max: b });
        }
      }
      return t("conditionSummary", { field: fieldLabel, operator: opLabel, value: val });
    })
    .join(joiner);

  const actions: string[] = [];
  if (rule.splitAllocations && rule.splitAllocations.length > 0) {
    actions.push(t("splitAccounts", { count: rule.splitAllocations.length }));
  } else if (rule.accountId) {
    actions.push(
      accounts.find((a) => a.id === rule.accountId)?.name ?? t("assignedCategory")
    );
  }
  if (rule.taxRateId) {
    actions.push(taxRates.find((t) => t.id === rule.taxRateId)?.name ?? t("tax"));
  }
  if (rule.contactId) {
    actions.push(
      contacts.find((c) => c.id === rule.contactId)?.name ?? t("contact")
    );
  }
  return { match, actions };
}


export function opsForField(field: ConditionField, t: BankTranslate) {
  return isAmountField(field) ? amountOps(t) : textOps(t);
}


// Plain-language labels for the things a transaction can be matched on.
export function bankFieldLabels(t: BankTranslate): Record<ConditionField, string> {
  return {
    description: t("description"),
    reference: t("reference"),
    amount: t("amountMinorUnits"),
    payee: t("payee"),
    counterparty: t("otherParty"),
  };
}

// Operators available for text fields.
function textOps(t: BankTranslate): { value: ConditionOp; label: string }[] {
  return [
    { value: "contains", label: t("contains") },
    { value: "equals", label: t("isExactly") },
    { value: "starts_with", label: t("startsWith") },
    { value: "ends_with", label: t("endsWith") },
  ];
}

// Operators available for the amount field.
function amountOps(t: BankTranslate): { value: ConditionOp; label: string }[] {
  return [
    { value: "equals", label: t("isExactly") },
    { value: "gt", label: t("isMoreThan") },
    { value: "lt", label: t("isLessThan") },
    { value: "between", label: t("isBetween") },
  ];
}
