"use client";
import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { budgetTypeLabel, budgetPeriodLabel, budgetFailureMessage, requireBudgetResponse } from "@/i18n/budget-presentation";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { budgetMoney, budgetDecimal, budgetDistribute, budgetPerPeriod, budgetInput, budgetLinesInput, budgetDraftInvalid, budgetRemoveDraftLine } from "@/lib/money/budget-ui";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useBudgetContext } from "../layout";
import type { BudgetLineData } from "../layout";
import { generatePeriods } from "@/lib/budget-periods";
import type { PeriodType } from "@/lib/budget-periods";


interface PeriodInput {
  label: string;
  startDate: string;
  endDate: string;
  amount: bigint;
  sortOrder: number;
}

interface LineInput {
  id?: string;
  accountId: string;
  total: bigint;
  periods: PeriodInput[];
}

function buildLineFromBudgetLine(l: BudgetLineData): LineInput {
  return {
    id: l.id,
    accountId: l.accountId,
    total: l.total,
    periods: [...(l.periods || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        amount: p.amount,
        sortOrder: p.sortOrder,
      })),
  };
}

function emptyLine(periodType: PeriodType, startDate: string, endDate: string): LineInput {
  const periods = generatePeriods(periodType, startDate, endDate).map((p) => ({
    ...p,
    amount: 0n,
  }));
  return { accountId: "", total: 0n, periods };
}

export default function BudgetSettingsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("Budgets");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { budget, currencyCode, accounts, refetch } = useBudgetContext();
  const formatMoney = (amount: bigint) => budgetMoney(amount, currencyCode, unitPresentation);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useDocumentTitle(t("settingsTitle"));

  const [name, setName] = useState(budget.name);
  const [startDate, setStartDate] = useState(budget.startDate);
  const [endDate, setEndDate] = useState(budget.endDate);
  const [periodType, setPeriodType] = useState<PeriodType>(budget.periodType);
  const [lines, setLines] = useState<LineInput[]>(
    budget.lines.map(buildLineFromBudgetLine)
  );
  const [periodDrafts, setPeriodDrafts] = useState<Record<string, string>>({});
  const [annualAmounts, setAnnualAmounts] = useState<Record<number, string>>({});
  const [expandedLine, setExpandedLine] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  function handlePeriodTypeChange(newType: PeriodType) {
    setPeriodType(newType);
    setPeriodDrafts({});
    // Regenerate periods for all lines
    setLines((prev) =>
      prev.map((line) => {
        const newPeriods = generatePeriods(newType, startDate, endDate);
        const amounts = budgetDistribute(line.total, newPeriods.length);
        return {
          ...line,
          periods: newPeriods.map((p, i) => ({ ...p, amount: amounts[i] })),
        };
      })
    );
  }

  function handleDateChange(field: "start" | "end", value: string) {
    const newStart = field === "start" ? value : startDate;
    const newEnd = field === "end" ? value : endDate;
    if (field === "start") setStartDate(value);
    else setEndDate(value);

    setPeriodDrafts({});
    // Regenerate periods
    setLines((prev) =>
      prev.map((line) => {
        const newPeriods = generatePeriods(periodType, newStart, newEnd);
        const amounts = budgetDistribute(line.total, newPeriods.length);
        return {
          ...line,
          periods: newPeriods.map((p, i) => ({ ...p, amount: amounts[i] })),
        };
      })
    );
  }

  function handleAnnualChange(index: number, value: string) {
    setPeriodDrafts(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${index}:`))));
    setAnnualAmounts((prev) => ({ ...prev, [index]: value }));
    let cents: bigint;
    try { cents = budgetInput(value || "0"); } catch { return; }
    setLines((prev) => {
      const copy = [...prev];
      const line = copy[index];
      const amounts = budgetDistribute(cents, line.periods.length);
      copy[index] = {
        ...line,
        total: cents,
        periods: line.periods.map((p, i) => ({ ...p, amount: amounts[i] })),
      };
      return copy;
    });
  }


  function updatePeriodAmount(lineIndex: number, periodIndex: number, value: string) {
    setPeriodDrafts(prev => ({ ...prev, [`${lineIndex}:${periodIndex}`]: value }));
    let cents: bigint;
    try { cents = budgetInput(value || "0"); } catch { return; }
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[lineIndex] };
      const periods = [...line.periods];
      periods[periodIndex] = { ...periods[periodIndex], amount: cents };
      line.periods = periods;
      line.total = periods.reduce((s, p) => s + p.amount, 0n);
      copy[lineIndex] = line;
      return copy;
    });
    setAnnualAmounts((prev) => {
      const copy = { ...prev };
      delete copy[lineIndex];
      return copy;
    });
  }

  function removeLine(index: number) {
    setPeriodDrafts(prev => budgetRemoveDraftLine(prev, index));
    setLines((prev) => prev.filter((_, i) => i !== index));
    setAnnualAmounts(prev => budgetRemoveDraftLine(prev, index));
    setExpandedLine(prev => prev === index ? null : prev !== null && prev > index ? prev - 1 : prev);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const validLines = lines.filter((l) => l.accountId);
    if (validLines.length === 0) {
      toast.error(t("addAccount"));
      return;
    }

    setSaving(true);
    try {
      for (const value of [...Object.values(annualAmounts), ...Object.values(periodDrafts)]) budgetInput(value || "0");
      const res = await fetch(`/api/v1/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          periodType,
          lines: budgetLinesInput(validLines),
        }),
      });
      await requireBudgetResponse(res, t, t("updateFailed"));
      toast.success(t("updated"));
      window.dispatchEvent(new Event("budgets-changed"));
      refetch();
    } catch (err) {
      toast.error(budgetFailureMessage(err, t, t("updateFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!orgId) return;
    const willDeactivate = budget.isActive;
    await confirm({
      title: willDeactivate ? t("deactivateQuestion") : t("reactivateQuestion"),
      description: willDeactivate
        ? t("deactivateDescription")
        : t("reactivateDescription"),
      confirmLabel: willDeactivate ? t("deactivate") : t("reactivate"),
      cancelLabel: t("cancel"),
      destructive: willDeactivate,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/budgets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-organization-id": orgId },
            body: JSON.stringify({ isActive: !willDeactivate }),
          });
          await requireBudgetResponse(res, t, t("updateFailed"));
          toast.success(willDeactivate ? t("deactivated") : t("reactivated"));
          window.dispatchEvent(new Event("budgets-changed"));
          refetch();
        } catch (error) {
          toast.error(budgetFailureMessage(error, t, t("updateFailed")));
          throw error;
        }
      },
    });
  }

  async function handleDelete() {
    if (!orgId) return;
    await confirm({
      title: t("deleteQuestion"),
      description: t("deleteWarning"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/budgets/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          await requireBudgetResponse(res, t, t("deleteFailed"));
          toast.success(t("deleted"));
          window.dispatchEvent(new Event("budgets-changed"));
          router.push("/accounting/budgets");
        } catch (error) {
          toast.error(budgetFailureMessage(error, t, t("deleteFailed")));
          throw error;
        }
      },
    });
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-10">
        {/* General */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("general")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("generalDescription")}</p>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="budget-name" className="text-xs">{t("name")}</Label>
              <Input id="budget-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget-start" className="text-xs">{t("startDate")}</Label>
                <Input id="budget-start" dir="ltr" type="date" value={startDate} onChange={(e) => handleDateChange("start", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-end" className="text-xs">{t("endDate")}</Label>
                <Input id="budget-end" dir="ltr" type="date" value={endDate} onChange={(e) => handleDateChange("end", e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-period-type" className="text-xs">{t("periodType")}</Label>
              <Select value={periodType} onValueChange={(v) => handlePeriodTypeChange(v as PeriodType)}>
                <SelectTrigger className="data-[size=default]:h-auto min-h-9 whitespace-normal text-start *:data-[slot=select-value]:line-clamp-none" id="budget-period-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] as const).map((value) => (
                    <SelectItem key={value} value={value}><BidiText>{budgetTypeLabel(t, value)}</BidiText></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Budget Lines */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("lines")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("linesDescription")}</p>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex justify-end">
              <Button className="h-auto min-h-9 min-w-0 whitespace-normal text-start" type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine(periodType, startDate, endDate)])}>
                <Plus className="me-2 size-3.5" />{t("addLine")}
              </Button>
            </div>

            {lines.map((line, i) => {
              const isExpanded = expandedLine === i;
              return (
                <div key={i} className="space-y-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        value={line.accountId || undefined}
                        onValueChange={(val) => {
                          setLines((prev) => {
                            const copy = [...prev];
                            copy[i] = { ...copy[i], accountId: val };
                            return copy;
                          });
                        }}
                      >
                        <SelectTrigger className="data-[size=default]:h-auto min-h-9 whitespace-normal text-start *:data-[slot=select-value]:line-clamp-none" aria-label={t("selectAccount")}><SelectValue placeholder={t("selectAccount")} /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}><IdentifierText>{a.code}</IdentifierText> - <BidiText>{a.name}</BidiText></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button type="button" aria-label={t("removeLine", { number: i + 1 })} onClick={() => removeLine(i)} className="text-muted-foreground hover:text-red-600 shrink-0 p-1">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <Label htmlFor={`budget-annual-${i}`} className="text-xs text-muted-foreground min-w-0 w-16">{t("annual")}</Label>
                    <CurrencyInput
                      id={`budget-annual-${i}`}
                      prefix={currencyCode === "USD" ? currencyLabel("USD", unitPresentation.locale, "$") : currencyCode}
                      aria-label={t("totalForLine", { number: i + 1 })}
                        aria-invalid={budgetDraftInvalid(annualAmounts[i] ?? budgetDecimal(line.total))}
                        value={annualAmounts[i] ?? budgetDecimal(line.total)}
                      onChange={(v) => handleAnnualChange(i, v)}
                      placeholder="0.00"
                      className="min-w-0 flex-1 basis-40"
                    />
                    {line.total !== 0n && line.periods.length > 0 && (
                      <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                        <BidiText>{t("perPeriod", { amount: formatMoney(budgetPerPeriod(line.total, line.periods.length)) })}</BidiText>
                      </span>
                    )}
                  </div>
                  {line.total !== 0n && line.periods.length > 0 && (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedLine(isExpanded ? null : i)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                    >
                      {isExpanded ? t("hidePeriods") : t("customizePeriods", { count: line.periods.length })}
                    </button>
                  )}
                  {isExpanded && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {line.periods.map((p, pi) => (
                        <div key={pi} className="space-y-1">
                          <label htmlFor={`budget-period-${i}-${pi}`} className="text-[10px] text-muted-foreground ps-0.5"><BidiText>{budgetPeriodLabel(t, p.label)}</BidiText></label>
                          <CurrencyInput
                            id={`budget-period-${i}-${pi}`}
                            size="sm"
                            aria-label={t("amountForPeriod", { period: budgetPeriodLabel(t, p.label) })}
                              aria-invalid={budgetDraftInvalid(periodDrafts[`${i}:${pi}`] ?? budgetDecimal(p.amount))}
                              value={periodDrafts[`${i}:${pi}`] ?? budgetDecimal(p.amount)}
                            onChange={(v) => updatePeriodAmount(i, pi, v)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {i < lines.length - 1 && <div className="h-px bg-border" />}
                </div>
              );
            })}

            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{t("noLines")}</p>
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={saving} className="h-auto min-h-9 min-w-0 whitespace-normal text-start bg-emerald-600 hover:bg-emerald-700">
            <Save className="me-2 size-3.5" />{t("save")}
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Danger zone */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium text-red-600">{t("danger")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("irreversible")}</p>
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {budget.isActive ? t("deactivateBudget") : t("reactivateBudget")}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {budget.isActive
                    ? t("hideDescription")
                    : t("makeActive")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleToggleActive}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
              >
                {budget.isActive ? t("deactivate") : t("reactivate")}
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteBudget")}</p>
                <p className="text-[12px] text-muted-foreground">{t("deleteDescription")}</p>
              </div>
              <Button className="h-auto min-h-9 min-w-0 whitespace-normal text-start" variant="destructive" size="sm" type="button" onClick={handleDelete}>{t("delete")}</Button>
            </div>
          </div>
        </div>
      </form>

      {confirmDialog}
    </>
  );
}
