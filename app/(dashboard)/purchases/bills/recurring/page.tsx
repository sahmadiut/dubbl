"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { recurringBillFrequencyLabel, recurringBillStatusLabel, recurringBillInputError, type RecurringBillError } from "@/i18n/recurring-bill-presentation";
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
import { Plus } from "lucide-react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { LineItemsEditor, type LineItem } from "@/components/dashboard/line-items-editor";
import { CurrencySelect } from "@/components/ui/currency-select";
import { recurringBillEditorPayload, recurringBillUiDocument } from "@/lib/money/recurring-bill-ui";
import { invoiceUiMoney } from "@/lib/money/invoice-ui";

interface RecurringTemplate {
  id: string;
  name: string;
  frequency: string;
  status: string;
  nextRunDate: string | null;
  reference: string | null;
  currencyCode: string;
  lines: { id: string; description: string; quantity: number; discountPercent: number; unitPrice: bigint; grossMinor: bigint }[];
  contact: { name: string } | null;
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
  quantity: "1",
  unitPrice: "",
  accountId: "",
  taxRateId: "",
});

export default function RecurringBillsPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : "";
  return <RecurringBillsWorkspace key={orgId} orgId={orgId} />;
}

function RecurringBillsWorkspace({ orgId }: { orgId: string }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("RecurringBills");
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(t("documentTitle"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [reference, setReference] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const [error, setError] = useState<RecurringBillError | null>(null);
  const [reload, setReload] = useState(0);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const orgHeaders = useCallback(() => ({ "x-organization-id": orgId }), [orgId]);
  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/v1/recurring?type=bill", { headers: orgHeaders(), signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error("Unable to load recurring bills"); return r.json(); })
      .then(data => {
        if (!Array.isArray(data?.data)) throw new Error("Invalid recurring bill list");
        const rows = data.data.map(recurringBillUiDocument);
        if (!controller.signal.aborted) setTemplates(rows);
      })
      .catch(() => { if (!controller.signal.aborted) { setTemplates([]); setError("readFailed"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgId, orgHeaders, reload]);

  const resetForm = () => {
    setName("");
    setContactId("");
    setFrequency("monthly");
    setStartDate("");
    setEndDate("");
    setMaxOccurrences("");
    setReference("");
    setLines([emptyLine()]);
    setCurrencyCode("USD");
    setValidLines(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!orgId || submitting || !name || !contactId || !startDate || lines.length === 0) return;

    if (!validLines) { setError("checkAmounts"); return; }
    let payload: ReturnType<typeof recurringBillEditorPayload>;
    try {
      payload = recurringBillEditorPayload({ name, contactId, frequency, startDate, endDate, maxOccurrences, reference, currencyCode }, lines);
    } catch (error) { setError(recurringBillInputError(error)); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/recurring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...orgHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data?.template?.id !== "string" || !data.template.id) throw new Error("Invalid recurring bill creation response");
        setDrawerOpen(false);
        resetForm();
        setReload(value => value + 1);
      } else {
        setError("createFailed");
      }
    } catch {
      setError("createFailed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button
          onClick={() => setDrawerOpen(true)}
          className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="me-2 size-4" />
          {t("newBill")}
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("supplier")}</TableHead>
              <TableHead>{t("frequency")}</TableHead>
              <TableHead>{t("nextBill")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("currency")}</TableHead>
              <TableHead className="text-end">{t("grossAmount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="text-sm font-medium">
                    <BidiText>{template.name}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <BidiText>{template.contact?.name || "-"}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <BidiText>{recurringBillFrequencyLabel(t, template.frequency)}</BidiText>
                  </TableCell>
                  <TableCell className="text-sm">
                    <IdentifierText>{template.nextRunDate || "-"}</IdentifierText>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[template.status] || ""}
                    >
                      <BidiText>{recurringBillStatusLabel(t, template.status)}</BidiText>
                    </Badge>
                  </TableCell>
                  <TableCell><BidiText>{currencyLabel(template.currencyCode, unitPresentation.locale)}</BidiText></TableCell>
                  <TableCell className="text-end font-mono break-words"><BidiText>{invoiceUiMoney(template.lines.reduce((sum, line) => sum + line.grossMinor, 0n), template.currencyCode, unitPresentation)}</BidiText></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) resetForm(); }}>
        <SheetContent dir={localeDirection(unitPresentation.locale)} className="sm:max-w-3xl w-full max-h-dvh p-0 flex flex-col overflow-y-auto">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b">
            <SheetTitle>{t("newBill")}</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6 pt-4 sm:px-6 space-y-4 flex-1 overflow-y-auto">
            {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("currency")}</label>
              <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); setValidLines(false); }} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rtl040-name">{t("name")}</label>
              <Input id="rtl040-name" dir="auto"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("supplier")}</label>
              <ContactPicker
                value={contactId}
                onChange={setContactId}
                type="supplier"
                placeholder={t("supplierPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rtl040-reference">{t("reference")}</label>
              <Input id="rtl040-reference" dir="auto"
                placeholder={t("referencePlaceholder")}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("frequency")}</label>
              <Select dir={localeDirection(unitPresentation.locale)} value={frequency} onValueChange={setFrequency}>
                <SelectTrigger aria-label={t("frequency")}>
                  <SelectValue><BidiText>{recurringBillFrequencyLabel(t, frequency)}</BidiText></SelectValue>
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

            {drawerOpen && <LineItemsEditor lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }}
              accountTypeFilter={["expense"]} taxContext="purchase" currencyCode={currencyCode}
              documentKind="recurringBill" priceFractionDigits={18} onValidityChange={setValidLines} />}

            <Button
              className="h-auto whitespace-normal w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={submitting || !name.trim() || !contactId || !startDate || !validLines}
            >
              {submitting ? t("creating") : t("create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
