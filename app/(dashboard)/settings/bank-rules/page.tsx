"use client";
import { bankFieldLabels, opsForField, summarizeRule, isAmountField, type ConditionField, type ConditionOp, type RuleCondition, type SplitAllocation, type BankRule, type AccountOption, type ContactOption, type TaxRateOption } from "@/i18n/bank-rule-presentation";
import { useTranslations } from "next-intl";
import { settingsErrorMessage } from "@/i18n/settings-errors";
import { bankUiRule } from "@/lib/money/bank-ui";

import { useState, useEffect, useCallback } from "react";
import { ContentReveal } from "@/components/ui/content-reveal";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ListFilter,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  X,
  ToggleLeft,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// Sentinel used for "no selection" Select items — Radix forbids empty-string values.
const NONE = "__none__";

// Rules are shared across banks, so thresholds and fixed splits use bank minor units.
function parseMinorUnits(input: string): number | null {
  const text = input.trim();
  if (!/^(?:0|-?[1-9]\d*)$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

function formatMinorUnits(minor: number): string {
  return String(minor);
}

const emptyCondition = (): RuleCondition => ({
  field: "description",
  op: "contains",
  value: "",
});

export default function BankRulesPage() {
  const t = useTranslations("SettingsBankRules");
  const te = useTranslations("SettingsErrors");

  const FIELD_LABELS = bankFieldLabels(t);
  const [rules, setRules] = useState<BankRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BankRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(0);
  const [matchAll, setMatchAll] = useState(true);
  const [conditions, setConditions] = useState<RuleCondition[]>([
    emptyCondition(),
  ]);
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [taxRateId, setTaxRateId] = useState("");
  const [splits, setSplits] = useState<SplitAllocation[]>([]);
  const [useSplits, setUseSplits] = useState(false);
  const [autoReconcile, setAutoReconcile] = useState(false);

  // Select options
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);

  const fetchRules = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/bank-rules", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => setRules((data.data || data.rules || []).map(bankUiRule)))
      .catch(() => { setRules([]); toast.error(t("rulesUnavailable")); })
      .finally(() => setLoading(false));
  }, [t]);

  const fetchOptions = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    fetch("/api/v1/accounts", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts || []));

    fetch("/api/v1/contacts", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts || data.data || []));

    fetch("/api/v1/tax-rates", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => setTaxRates(data.taxRates || []));
  }, []);

  useEffect(() => {
    fetchRules();
    fetchOptions();
  }, [fetchRules, fetchOptions]);

  const resetForm = () => {
    setName("");
    setPriority(0);
    setMatchAll(true);
    setConditions([emptyCondition()]);
    setAccountId("");
    setContactId("");
    setTaxRateId("");
    setSplits([]);
    setUseSplits(false);
    setAutoReconcile(false);
  };

  const openCreate = () => {
    setEditingRule(null);
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (rule: BankRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setPriority(rule.priority);
    setMatchAll(rule.matchAll ?? true);

    // Prefer the multi-condition array; fall back to the legacy single match.
    if (rule.conditions && rule.conditions.length > 0) {
      setConditions(
        rule.conditions.map((c) => {
          if (isAmountField(c.field)) {
            if (c.op === "between") {
              const [a, b] = c.value.split(",");
              return {
                field: c.field,
                op: c.op,
                value: `${a},${b}`,
              };
            }
            return {
              field: c.field,
              op: c.op,
              value: c.value,
            };
          }
          return c;
        })
      );
    } else {
      setConditions([
        {
          field: (rule.matchField as ConditionField) || "description",
          op: (rule.matchType as ConditionOp) || "contains",
          value: rule.matchValue || "",
        },
      ]);
    }

    setAccountId(rule.accountId || "");
    setContactId(rule.contactId || "");
    setTaxRateId(rule.taxRateId || "");
    if (rule.splitAllocations && rule.splitAllocations.length > 0) {
      setUseSplits(true);
      setSplits(rule.splitAllocations);
    } else {
      setUseSplits(false);
      setSplits([]);
    }
    setAutoReconcile(rule.autoReconcile);
    setSheetOpen(true);
  };

  // Condition editing helpers
  const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        // When the field switches between text and amount, keep the operator valid.
        if (patch.field) {
          const allowed = opsForField(patch.field, t).map((o) => o.value);
          if (!allowed.includes(next.op)) next.op = allowed[0];
        }
        return next;
      })
    );
  };

  const addCondition = () =>
    setConditions((prev) => [...prev, emptyCondition()]);

  const removeCondition = (idx: number) =>
    setConditions((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );

  // Split editing helpers
  const addSplit = () =>
    setSplits((prev) => [...prev, { accountId: "", percent: undefined }]);
  const updateSplit = (idx: number, patch: Partial<SplitAllocation>) =>
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  const removeSplit = (idx: number) =>
    setSplits((prev) => prev.filter((_, i) => i !== idx));

  // Validate canonical signed bank minor-unit thresholds.
  const buildConditionsPayload = (): RuleCondition[] | null => {
    const out: RuleCondition[] = [];
    for (const c of conditions) {
      if (isAmountField(c.field)) {
        if (c.op === "between") {
          const [aRaw, bRaw] = c.value.split(",");
          const a = parseMinorUnits(aRaw ?? "");
          const b = parseMinorUnits(bRaw ?? "");
          if (c.value.split(",").length !== 2 || a == null || b == null || a > b) return null;
          out.push({ field: c.field, op: c.op, value: `${a},${b}` });
        } else {
          const cents = parseMinorUnits(c.value);
          if (cents == null || c.value.trim() === "") return null;
          out.push({ field: c.field, op: c.op, value: String(cents) });
        }
      } else {
        if (!c.value.trim()) return null;
        out.push({ field: c.field, op: c.op, value: c.value.trim() });
      }
    }
    return out;
  };

  const canSave =
    name.trim().length > 0 &&
    conditions.length > 0 &&
    conditions.every((c) =>
      c.op === "between"
        ? c.value.split(",").every((p) => p.trim() !== "")
        : c.value.trim() !== ""
    );

  const handleSave = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !name.trim()) return;

    const conditionsPayload = buildConditionsPayload();
    if (!conditionsPayload) {
      toast.error(t("conditionRequired"));
      return;
    }

    let splitPayload: SplitAllocation[] | null = null;
    if (useSplits) {
      const cleaned = splits.filter((s) => s.accountId);
      if (cleaned.length === 0) {
        toast.error(t("splitAccountRequired"));
        return;
      }
      if (cleaned.some(s => s.amountMinor !== undefined && (parseMinorUnits(s.amountMinor) === null || parseMinorUnits(s.amountMinor)! < 0))) {
        toast.error(t("invalidFixedAmount"));
        return;
      }
      splitPayload = cleaned.map((s) => ({
        accountId: s.accountId,
        ...(s.percent != null ? { percent: s.percent } : {}),
        ...(s.amountMinor !== undefined ? { amountMinor: s.amountMinor } : s.amount != null ? { amount: s.amount, amountMinor: String(s.amount) } : {}),
        ...(s.taxRateId ? { taxRateId: s.taxRateId } : {}),
      }));
    }

    setSaving(true);

    const url = editingRule
      ? `/api/v1/bank-rules/${editingRule.id}`
      : "/api/v1/bank-rules";
    const method = editingRule ? "PATCH" : "POST";

    const payload = {
      name: name.trim(),
      priority,
      // Keep the legacy first-condition mirror so older list rows still read.
      matchField: conditionsPayload[0].field,
      matchType: ["contains", "equals", "starts_with", "ends_with"].includes(
        conditionsPayload[0].op
      )
        ? conditionsPayload[0].op
        : "contains",
      matchValue: conditionsPayload[0].value || "-",
      conditions: conditionsPayload,
      matchAll,
      splitAllocations: useSplits ? splitPayload : null,
      accountId: useSplits ? null : accountId || null,
      contactId: contactId || null,
      taxRateId: useSplits ? null : taxRateId || null,
      autoReconcile,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(settingsErrorMessage(te, data.error, t("failedToSaveRule"), res.status));
        return;
      }

      toast.success(editingRule ? t("ruleUpdated") : t("ruleCreated"));
      setSheetOpen(false);
      fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const res = await fetch(`/api/v1/bank-rules/${id}`, {
      method: "DELETE",
      headers: { "x-organization-id": orgId },
    });

    if (res.ok) {
      toast.success(t("ruleDeleted"));
      fetchRules();
    } else {
      toast.error(t("failedToDeleteRule"));
    }
  };

  const handleToggleActive = async (rule: BankRule) => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const res = await fetch(`/api/v1/bank-rules/${rule.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": orgId,
      },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });

    if (res.ok) {
      toast.success(rule.isActive ? t("ruleDisabled") : t("ruleEnabled"));
      fetchRules();
    } else {
      toast.error(t("failedToUpdateRule"));
    }
  };

  const handleGetSuggestions = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    toast.info(t("analyzingSuggestions"));

    try {
      const res = await fetch("/api/v1/bank-rules/suggestions", {
        headers: { "x-organization-id": orgId },
      });

      if (!res.ok) {
        toast.error(t("failedToGetSuggestions"));
        return;
      }

      const data = await res.json();
      const count = data.suggestions?.length ?? 0;
      if (count === 0) {
        toast.info(
          t("noSuggestions")
        );
      } else {
        toast.success(
          t("suggestionCount", { count })
        );
      }
    } catch {
      toast.error(t("failedToGetSuggestions"));
    }
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("bankRules")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("descriptionText")}{rules.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {t("ruleCount", { count: rules.length })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleGetSuggestions}
            >
              <Sparkles className="size-3.5" />
              {t("getSuggestions")}
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
              <Plus className="size-3.5" />
              {t("addRule")}
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={ListFilter}
            title={t("noBankRulesYet")}
            description={t("emptyDescription")}
          >
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 mt-3"
              onClick={openCreate}
            >
              <Plus className="size-3.5" />
              {t("createRule")}
            </Button>
          </EmptyState>
        ) : (
          <div className="rounded-lg border divide-y">
            {rules.map((rule) => {
              const { match, actions } = summarizeRule(
                t,
                rule,
                accounts,
                taxRates,
                contacts
              );
              return (
                <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
                  {/* Name + match info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{rule.name}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {match}
                      </code>
                      {actions.map((a, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{t("priorityValue", { priority: rule.priority })}</span>
                  </div>

                  {/* Active badge */}
                  <Badge
                    variant={rule.isActive ? "default" : "secondary"}
                    className={
                      rule.isActive
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : ""
                    }
                  >
                    {rule.isActive ? t("active") : t("inactive")}
                  </Badge>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(rule)}>
                        <Pencil className="mr-2 size-3.5" />
                        {t("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(rule)}>
                        <ToggleLeft className="mr-2 size-3.5" />
                        {rule.isActive ? t("disable") : t("enable")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingRule ? t("editRule") : t("newBankRule")}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-6 px-4 py-4">
            <div className="space-y-2">
              <Label>{t("ruleName")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("eGStripePayouts")}
              />
            </div>

            {/* WHEN — conditions */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  {t("whenATransactionMatches")}
                </Label>
                {conditions.length > 1 && (
                  <Select
                    value={matchAll ? "all" : "any"}
                    onValueChange={(v) => setMatchAll(v === "all")}
                  >
                    <SelectTrigger className="h-7 w-auto text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allConditions")}</SelectItem>
                      <SelectItem value="any">{t("anyCondition")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-3">
                {conditions.map((cond, idx) => {
                  const isAmount = isAmountField(cond.field);
                  return (
                    <div key={idx} className="space-y-2">
                      {idx > 0 && (
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {matchAll ? t("andLabel") : t("orLabel")}
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <div className="grid flex-1 grid-cols-2 gap-2">
                          {/* Field */}
                          <Select
                            value={cond.field}
                            onValueChange={(v) =>
                              updateCondition(idx, {
                                field: v as ConditionField,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.keys(FIELD_LABELS) as ConditionField[]
                              ).map((f) => (
                                <SelectItem key={f} value={f}>
                                  {FIELD_LABELS[f]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Operator */}
                          <Select
                            value={cond.op}
                            onValueChange={(v) =>
                              updateCondition(idx, { op: v as ConditionOp })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {opsForField(cond.field, t).map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Value */}
                          {cond.op === "between" ? (
                            <div className="col-span-2 flex items-center gap-2">
                              <Input
                                type="number"
                                step="1"
                                value={cond.value.split(",")[0] ?? ""}
                                onChange={(e) =>
                                  updateCondition(idx, {
                                    value: `${e.target.value},${
                                      cond.value.split(",")[1] ?? ""
                                    }`,
                                  })
                                }
                                placeholder={t("min")}
                              />
                              <span className="text-xs text-muted-foreground">
                                {t("to")}
                              </span>
                              <Input
                                type="number"
                                step="1"
                                value={cond.value.split(",")[1] ?? ""}
                                onChange={(e) =>
                                  updateCondition(idx, {
                                    value: `${
                                      cond.value.split(",")[0] ?? ""
                                    },${e.target.value}`,
                                  })
                                }
                                placeholder={t("max")}
                              />
                            </div>
                          ) : (
                            <Input
                              className="col-span-2"
                              type={isAmount ? "number" : "text"}
                              step={isAmount ? "1" : undefined}
                              value={cond.value}
                              onChange={(e) =>
                                updateCondition(idx, { value: e.target.value })
                              }
                              placeholder={
                                isAmount ? t("minorUnitsEG1250USDCents") : t("textToMatch")
                              }
                            />
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0 text-muted-foreground"
                          disabled={conditions.length === 1}
                          onClick={() => removeCondition(idx)}
                          aria-label={t("removeCondition")}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={addCondition}
              >
                <Plus className="size-3.5" />
                {t("addCondition")}
              </Button>
            </div>

            {/* THEN — actions */}
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-sm font-semibold">{t("thenDoThis")}</Label>

              {/* Split toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("splitAcrossSeveralCategories")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("splitHelp")}
                  </p>
                </div>
                <Switch checked={useSplits} onCheckedChange={setUseSplits} />
              </div>

              {!useSplits ? (
                <>
                  <div className="space-y-2">
                    <Label>{t("assignToCategoryAccount")}</Label>
                    <Select
                      value={accountId || NONE}
                      onValueChange={(v) =>
                        setAccountId(v === NONE ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("none")}</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("taxRateOptional")}</Label>
                    <Select
                      value={taxRateId || NONE}
                      onValueChange={(v) =>
                        setTaxRateId(v === NONE ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("noTax")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("noTax")}</SelectItem>
                        {taxRates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {splits.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("noSplitsYetAddOneOrMoreCategoriesBelow")}
                    </p>
                  )}
                  {splits.map((s, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 rounded-md border p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("splitNumber", { number: idx + 1 })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          onClick={() => removeSplit(idx)}
                          aria-label={t("removeSplit")}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      <Select
                        value={s.accountId || NONE}
                        onValueChange={(v) =>
                          updateSplit(idx, {
                            accountId: v === NONE ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("category")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t("selectCategory")}</SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("percent")}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={s.percent ?? ""}
                            onChange={(e) =>
                              updateSplit(idx, {
                                percent:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                                amount: undefined,
                                amountMinor: undefined,
                              })
                            }
                            placeholder={t("eG50")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("orFixedMinorUnits")}</Label>
                          <Input
                            type="number"
                            step="1"
                            value={
                              s.amountMinor ?? (s.amount != null ? formatMinorUnits(s.amount) : "")
                            }
                            onChange={(e) => {
                              updateSplit(idx, {
                                amount: undefined,
                                amountMinor: e.target.value === "" ? undefined : e.target.value,
                                percent: undefined,
                              });
                            }}
                            placeholder={t("eG1250")}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("taxRateOptional")}</Label>
                        <Select
                          value={s.taxRateId || NONE}
                          onValueChange={(v) =>
                            updateSplit(idx, {
                              taxRateId: v === NONE ? undefined : v,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("noTax")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("noTax")}</SelectItem>
                            {taxRates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={addSplit}
                  >
                    <Plus className="size-3.5" />
                    {t("addSplit")}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t("remainderHelp")}
                  </p>
                </div>
              )}

              {/* Contact applies in both modes */}
              <div className="space-y-2">
                <Label>{t("linkToAContactOptional")}</Label>
                <Select
                  value={contactId || NONE}
                  onValueChange={(v) => setContactId(v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectContact")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("none")}</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4 rounded-lg border p-3">
              <Label className="text-sm font-semibold">{t("options")}</Label>
              <div className="space-y-2">
                <Label>{t("priority")}</Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {t("higherPriorityRulesAreCheckedFirst")}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label title={t("clearingHelp")}>
                    {t("markMatchingTransactionsAsCleared")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("clearingNotice")}
                  </p>
                </div>
                <Switch
                  checked={autoReconcile}
                  onCheckedChange={setAutoReconcile}
                />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? t("saving") : editingRule ? t("update") : t("create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
