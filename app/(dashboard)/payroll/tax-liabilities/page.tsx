"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollTaxPaymentJson, taxPaymentOrganization, type TaxPayment } from "@/i18n/payroll-tax-liability-presentation";
import { payrollAnalyticsJson } from "@/i18n/payroll-analytics-presentation";

import { payrollCentsInput } from "@/lib/money/payroll-input";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Landmark,
  Receipt,
  Wallet,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
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
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

// ─── What payroll taxes look like by who you pay ────────────────────────────
// The remittance API (POST /api/v1/payroll/tax-payments) clears one of three
// liability buckets per allocation: income tax (→ GL 2220), payroll taxes such
// as Social Security / Medicare / unemployment (→ 2235), and pension & benefit
// withholdings (→ 2245). We surface those same buckets here as the "agencies"
// you owe, in plain language.
const AGENCY_BUCKETS = [
  { bucket: "income_tax", agency: "incomeAgency", what: "incomeDescription", taxKind: "income_tax" },
  { bucket: "fica", agency: "payrollAgency", what: "payrollDescription", taxKind: "941" },
  { bucket: "pension", agency: "pensionAgency", what: "pensionDescription", taxKind: "benefits" },
] as const;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Start of the current month, used as a sensible default coverage period.
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function TaxLiabilitiesPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollTaxLiabilities");
  useDocumentTitle(t("documentTitle"));
  const orgId = taxPaymentOrganization();

  const [initialLoad, setInitialLoad] = useState(true);
  const [accruedTax, setAccruedTax] = useState(0);
  const [reportCurrency, setReportCurrency] = useState("USD");
  const [reportError, setReportError] = useState<string | null>(null);
  const [payments, setPayments] = useState<TaxPayment[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Record-payment sheet state ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const remittanceKey = useRef<string | null>(null);
  const remittanceInput = useRef<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formBucket, setFormBucket] = useState<string>(AGENCY_BUCKETS[0].bucket);
  const [formAmount, setFormAmount] = useState(""); // decimal string
  const [formPeriodStart, setFormPeriodStart] = useState(monthStartISO());
  const [formPeriodEnd, setFormPeriodEnd] = useState(todayISO());
  const [formJurisdiction, setFormJurisdiction] = useState<
    "federal" | "state" | "local"
  >("federal");
  const [formPaymentDate, setFormPaymentDate] = useState(todayISO());
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // ── Load accrued tax + recorded payments ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setInitialLoad(true);
      setReportError(null);
      try {
        if (!orgId) throw new Error("Missing organization");
        const headers = { "x-organization-id": orgId };
        const [liability, paymentsRes] = await Promise.all([
          fetch("/api/v1/payroll/reports/tax-liability", { headers }).then(r => payrollAnalyticsJson(r, "tax-liability")),
          fetch("/api/v1/payroll/tax-payments", { headers }).then(r => payrollTaxPaymentJson(r, "list")),
        ]);
        if (cancelled) return;
        setReportCurrency(liability.currency);
        setAccruedTax(liability.totalTax);
        setPayments(paymentsRes.payments);
      } catch {
        if (!cancelled) { setReportError(t("loadFailed")); setPayments([]); }
      } finally {
        if (!cancelled) setInitialLoad(false);
      }
    }
    void Promise.resolve().then(() => { if (!cancelled) return load(); });
    return () => { cancelled = true; };
  }, [orgId, refreshKey, t]);

  const paidPayments = payments.filter(p => p.status === "paid");
  const compatibleCurrency = paidPayments.every(p => p.currency === reportCurrency);
  const totalPaid = paidPayments.reduce((s, p) => s + BigInt(p.amount), 0n);
  const difference = BigInt(accruedTax) - totalPaid;
  const outstanding = difference > 0n ? difference : 0n;
  const totalsError = reportError || (!compatibleCurrency ? t("multipleCurrencies") : null);

  const openRecordPayment = useCallback((bucket?: string) => {
    if (bucket) setFormBucket(bucket);
    setFormAmount("");
    setFormReference("");
    setFormNotes("");
    setFormPeriodStart(monthStartISO());
    setFormPeriodEnd(todayISO());
    setFormPaymentDate(todayISO());
    setFormJurisdiction("federal");
    setSheetOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    let cents: string;
    try { cents = payrollCentsInput(formAmount || "0"); } catch {
      toast.error(t("invalidAmount")); return;
    }
    if (cents === "0") {
      toast.error(t("positiveAmount"));
      return;
    }
    if (!formPeriodStart || !formPeriodEnd) {
      toast.error(t("choosePeriod"));
      return;
    }

    const selected = AGENCY_BUCKETS.find((b) => b.bucket === formBucket);
    if (!selected) { toast.error(t("recordFailed")); return; }

    const inputKey = JSON.stringify([formPeriodStart, formPeriodEnd, formJurisdiction, formBucket, cents, formPaymentDate, formReference, formNotes]);
    if (remittanceInput.current !== inputKey) { remittanceKey.current = null; remittanceInput.current = inputKey; }
    remittanceKey.current ??= crypto.randomUUID();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/payroll/tax-payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          idempotencyKey: remittanceKey.current,
          periodStart: formPeriodStart,
          periodEnd: formPeriodEnd,
          jurisdictionLevel: formJurisdiction,
          taxKind: selected?.taxKind ?? null,
          allocations: [{ bucket: formBucket, amountMinor: cents }],
          paymentDate: formPaymentDate || undefined,
          reference: formReference || undefined,
          notes: formNotes || undefined,
        }),
      });
      await payrollTaxPaymentJson(res, "created");
      remittanceKey.current = null;
      toast.success(t("recorded"));
      setSheetOpen(false);
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error(t("recordFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [
    orgId,
    formAmount,
    formBucket,
    formPeriodStart,
    formPeriodEnd,
    formJurisdiction,
    formPaymentDate,
    formReference,
    formNotes,
    t,
  ]);

  // Per-agency paid totals so each row shows how much has been remitted to it.
  const paidByBucket = useMemo(() => {
    const map: Record<string, bigint> = {};
    // taxKind is the only signal we stamp; map it back to a bucket for display.
    for (const p of payments.filter(p => p.status === "paid")) {
      const matched = AGENCY_BUCKETS.find(
        (b) => b.taxKind === p.taxKind,
      );
      const key = matched?.bucket ?? "income_tax";
      map[key] = (map[key] || 0n) + BigInt(p.amount);
    }
    return map;
  }, [payments]);

  const paymentColumns = useMemo<Column<TaxPayment>[]>(
    () => [
      {
        key: "period",
        header: t("periodCovered"),
        render: (r) => (
          <span className="text-sm">
            {t.rich("periodRange", { code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  start: r.periodStart, end: r.periodEnd  })}
          </span>
        ),
      },
      {
        key: "kind",
        header: t("covers"),
        render: (r) => {
          const matched = AGENCY_BUCKETS.find((b) => b.taxKind === r.taxKind);
          return (
            <span className="text-sm">
              {matched ? t(matched.agency) : r.taxKind ?? t("payrollTax")}
            </span>
          );
        },
      },
      {
        key: "jurisdiction",
        header: t("level"),
        className: "w-24",
        render: (r) => (
          <Badge variant="outline">
            {t(r.jurisdictionLevel)}
            <BidiText>{r.jurisdiction ? ` · ${r.jurisdiction}` : ""}</BidiText>
          </Badge>
        ),
      },
      {
        key: "reference",
        header: t("reference"),
        className: "w-40",
        render: (r) => (
          <span className="font-mono text-xs text-muted-foreground">
            <IdentifierText>{r.reference || "-"}</IdentifierText>
          </span>
        ),
      },
      {
        key: "paid",
        header: t("paidOn"),
        className: "w-28",
        render: (r) => (
          <span className="text-sm">
            <IdentifierText>{r.paidAt ? r.paidAt.split("T")[0] : "-"}</IdentifierText>
          </span>
        ),
      },
      {
        key: "amount",
        header: t("amount"),
        className: "w-28 text-end",
        render: (r) => (
          <span className="font-mono text-sm tabular-nums">
            <IdentifierText>{formatMoney(r.amount, r.currency || "USD", unitPresentation)}</IdentifierText>
          </span>
        ),
      },
    ],
    [t, unitPresentation],
  );

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button
          onClick={() => openRecordPayment()}
          className="bg-emerald-600 shrink-0 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
        >
          <Plus className="me-2 size-4" />
          {t("record")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <StatCard
          title={t("owed")}
          value={totalsError ? t("unavailable") : formatMoney(accruedTax, reportCurrency, unitPresentation)}
          icon={Receipt}
        />
        <StatCard
          title={t("paid")}
          value={totalsError ? t("unavailable") : formatMoney(totalPaid, reportCurrency, unitPresentation)}
          icon={CheckCircle2}
        />
        <StatCard
          title={t("outstanding")}
          value={totalsError ? t("unavailable") : formatMoney(outstanding, reportCurrency, unitPresentation)}
          icon={Wallet}
        />
      </div>

      <div className="h-px bg-border" />

      {totalsError && <p role="alert" className="text-sm text-destructive">{totalsError}</p>}

      {/* Who you owe — by agency / type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Landmark className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("whoYouPay")}</h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
          {AGENCY_BUCKETS.map((b) => {
            const paid = paidByBucket[b.bucket] || 0n;
            return (
              <div
                key={b.bucket}
                className="flex flex-col justify-between rounded-xl border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium">{t(b.agency)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(b.what)}</p>
                </div>
                <div className="mt-4 flex items-center justify-between flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    {t("paidToDate")}
                    <span className="ms-1.5 font-mono tabular-nums text-foreground">
                      <IdentifierText>{totalsError ? t("unavailable") : formatMoney(paid, reportCurrency, unitPresentation)}</IdentifierText>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRecordPayment(b.bucket)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                    {t("record")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {!totalsError && outstanding > 0n && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {t.rich("outstandingNotice", { code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  amount: formatMoney(outstanding, reportCurrency, unitPresentation)  })}
            </span>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Payment history */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("paymentsRecorded")}</h3>
        <DataTable
          columns={paymentColumns}
          data={payments}
          loading={false}
          emptyMessage={t("empty")}
        />
      </div>

      {/* Record-payment sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("sheetTitle")}</SheetTitle>
            <SheetDescription>
              {t("sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="payroll-tax-liabilities-1" >{t("payee")}</Label>
              <Select value={formBucket} onValueChange={setFormBucket}>
                <SelectTrigger className="w-full h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" id="payroll-tax-liabilities-1" aria-label={t("payee")} >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_BUCKETS.map((b) => (
                    <SelectItem key={b.bucket} value={b.bucket}>
                      {t(b.agency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payroll-tax-liabilities-2" >{t("amountPaid")}</Label>
              <CurrencyInput
                value={formAmount}
                onChange={setFormAmount}
                prefix={reportCurrency} id="payroll-tax-liabilities-2" aria-label={t("amountPaid")} />
            </div>

            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div className="space-y-1.5" role="group" aria-label={t("periodFrom")}>
                <Label>{t("periodFrom")}</Label>
                <DatePicker
                  value={formPeriodStart}
                  onChange={setFormPeriodStart}
                  placeholder={t("start")}
                />
              </div>
              <div className="space-y-1.5" role="group" aria-label={t("periodTo")}>
                <Label>{t("periodTo")}</Label>
                <DatePicker
                  value={formPeriodEnd}
                  onChange={setFormPeriodEnd}
                  placeholder={t("end")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-tax-liabilities-3" >{t("level")}</Label>
                <Select
                  value={formJurisdiction}
                  onValueChange={(v) =>
                    setFormJurisdiction(v as "federal" | "state" | "local")
                  }
                >
                  <SelectTrigger className="w-full h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" id="payroll-tax-liabilities-3" aria-label={t("level")} >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="federal">{t("federal")}</SelectItem>
                    <SelectItem value="state">{t("state")}</SelectItem>
                    <SelectItem value="local">{t("local")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5" role="group" aria-label={t("paidOn")}>
                <Label>{t("paidOn")}</Label>
                <DatePicker
                  value={formPaymentDate}
                  onChange={setFormPaymentDate}
                  placeholder={t("paymentDate")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payroll-tax-liabilities-4" >{t("reference")}</Label>
              <Input
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                placeholder={t("referencePlaceholder")} dir="ltr" id="payroll-tax-liabilities-4" aria-label={t("reference")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payroll-tax-liabilities-5" >{t("notes")}</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                rows={3} dir="auto" id="payroll-tax-liabilities-5" aria-label={t("notes")} />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
            >
              {submitting ? t("recording") : t("record")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={submitting} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
              {t("cancel")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
