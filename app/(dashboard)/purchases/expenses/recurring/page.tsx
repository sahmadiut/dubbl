"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";
import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { expenseStatusLabel, expenseFrequencyLabel, expenseInputError, type ExpenseErrorKey } from "@/i18n/expense-presentation";


import { toast } from "sonner";
import { ExpenseAmountInput } from "@/components/dashboard/expense-amount-input";
import { CurrencySelect } from "@/components/ui/currency-select";
import { recurringExpensePayload, recurringExpensePreview } from "@/lib/money/recurring-expense-ui";
import { expenseUiMoney } from "@/lib/money/expense-ui";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { AccountPicker } from "@/components/dashboard/account-picker";

interface RecurringTemplate {
  id: string;
  name: string;
  frequency: string;
  status: string;
  nextRunDate: string | null;
  contact: { name: string } | null;
}

interface LineItem {
  description: string;
  amount: string;
  accountId: string | null;
}

const statusColors: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  paused:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

const emptyLine = (): LineItem => ({
  description: "",
  amount: "",
  accountId: null,
});

export default function RecurringExpensesPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <RecurringExpensesWorkspace key={orgId} />;
}

function RecurringExpensesWorkspace() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Expenses");
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [error, setError] = useState<ExpenseErrorKey | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(t("recurringDocumentTitle"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const orgHeaders = useCallback(
    () => ({
      "x-organization-id": localStorage.getItem("activeOrgId") || "",
    }),
    []
  );

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const fetchTemplates = useCallback(() => {
    if (!orgId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/v1/recurring?type=expense", {
      headers: orgHeaders(), signal: controller.signal,
    })
      .then(async r => { if (!r.ok) throw new Error("Recurring read failed"); const data = await r.json(); if (!Array.isArray(data.data)) throw new Error("Invalid recurring list"); return data.data; })
      .then(rows => { if (!controller.signal.aborted) setTemplates(rows); })
      .catch(() => { if (!controller.signal.aborted) { setTemplates([]); setError("recurringReadFailed"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgHeaders, orgId]);

  useEffect(() => {
    return fetchTemplates();
  }, [fetchTemplates]);

  const preview = recurringExpensePreview(lines, currencyCode);

  const resetForm = () => {
    setCurrencyCode("USD");
    setName("");
    setContactId("");
    setFrequency("monthly");
    setStartDate("");
    setEndDate("");
    setMaxOccurrences("");
    setLines([emptyLine()]);
  };

  const handleSubmit = async () => {
    if (!orgId || submitting || !name || !contactId || !startDate || lines.length === 0) return;

    try {
      let payload;
      try { payload = recurringExpensePayload({ name, contactId, frequency, startDate, endDate, maxOccurrences, currencyCode }, lines); }
      catch (error) { toast.error(t(expenseInputError(error))); return; }
      setSubmitting(true);
      const res = await fetch("/api/v1/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...orgHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Recurring create failed");
      const data = await res.json();
      if (typeof data.template?.id !== "string" || !data.template.id) throw new Error("Invalid recurring identity");
      if (res.ok) {
        setDrawerOpen(false);
        resetForm();
        fetchTemplates();
      }
    } catch {
      toast.error(t("recurringCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const updateLine = (index: number, field: keyof LineItem, value: string | null) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {t("recurringTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("recurringDescription")}</p>
        </div>
        <Button
          onClick={() => setDrawerOpen(true)}
          className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="me-2 size-4" />
          {t("newRecurring")}</Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <div className="rounded-lg border">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("contact")}</TableHead>
              <TableHead>{t("frequency")}</TableHead>
              <TableHead>{t("nextRun")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  {t("loading")}</TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  {t("recurringEmpty")}</TableCell>
              </TableRow>
            ) : (
              templates.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm font-medium">
                    <BidiText>{row.name}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <BidiText>{row.contact?.name || "-"}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <BidiText>{expenseFrequencyLabel(t, row.frequency)}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <IdentifierText>{row.nextRunDate || "-"}</IdentifierText>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[row.status] || ""}
                    >
                      <BidiText>{expenseStatusLabel(t, row.status)}</BidiText>
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={open => { setDrawerOpen(open); if (!open) resetForm(); }}>
        <SheetContent dir={localeDirection(unitPresentation.locale)} className="sm:max-w-lg w-full max-h-dvh p-0 flex flex-col overflow-y-auto">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b">
            <SheetTitle>{t("newRecurring")}</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6 pt-4 sm:px-6 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("currency")}</label>
              <CurrencySelect value={currencyCode} onValueChange={setCurrencyCode} />
              <p className="text-xs text-muted-foreground">{t("recurringScale")}</p>
            </div>
            {preview.error && <p role="alert" className="text-sm text-destructive">{t(expenseInputError(preview.error))}</p>}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rtl040-name">{t("name")}</label>
              <Input id="rtl040-name" dir="auto"
                placeholder={t("nameExample")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("contact")}</label>
              <ContactPicker
                value={contactId}
                onChange={setContactId}
                type="supplier"
                placeholder={t("supplierPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("frequency")}</label>
              <Select dir={localeDirection(unitPresentation.locale)} value={frequency} onValueChange={setFrequency}>
                <SelectTrigger aria-label={t("frequency")}>
                  <SelectValue><BidiText>{expenseFrequencyLabel(t, frequency)}</BidiText></SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("weekly")}</SelectItem>
                  <SelectItem value="fortnightly">{t("fortnightly")}</SelectItem>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                  <SelectItem value="quarterly">{t("quarterly")}</SelectItem>
                  <SelectItem value="semi_annual">{t("semiAnnual")}</SelectItem>
                  <SelectItem value="annual">{t("annual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rtl040-startDate">{t("startDate")}</label>
                <Input id="rtl040-startDate" dir="ltr"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rtl040-endDate">{t("endDate")}</label>
                <Input id="rtl040-endDate" dir="ltr"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rtl040-maxOccurrences">{t("maxOccurrences")}</label>
              <Input id="rtl040-maxOccurrences" dir="ltr"
                type="number"
                min="1"
                placeholder={t("unlimited")}
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium">{t("lineItems")}</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                >
                  <Plus className="me-1 size-3" />
                  {t("addLine")}</Button>
              </div>

              {lines.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      dir="auto" aria-label={t("itemDescription")}
                      placeholder={t("itemDescription")}
                      value={line.description}
                      onChange={(e) =>
                        updateLine(i, "description", e.target.value)
                      }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ExpenseAmountInput currency={t("fixedTwo")} label={t("lineAmount", { number: i + 1 })} value={line.amount} onChange={value => updateLine(i, "amount", value)} />
                      <AccountPicker
                        value={line.accountId || ""}
                        onChange={(v) => updateLine(i, "accountId", v)}
                        typeFilter={["expense"]}
                        placeholder={t("accountPlaceholder")}
                      />
                    </div>
                  </div>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-1 shrink-0"
                      aria-label={t("removeItem", { number: i + 1 })} onClick={() => removeLine(i)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-sm font-mono"><BidiText>{t("totalValue", { amount: preview.error ? "\u2014" : expenseUiMoney(preview.total, currencyCode, unitPresentation) })}</BidiText></p>
            <Button
              className="h-auto whitespace-normal w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={submitting || !name || !contactId || !startDate}
            >
              {submitting ? t("creating") : t("createRecurring")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
