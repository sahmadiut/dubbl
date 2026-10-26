"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { vatBoxLabelKey } from "@/lib/i18n/vat-return-presentation";
import { ArrowUpRight, ArrowDownLeft, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { taxUiCurrency, taxUiRows, taxUiMoney, taxUiAbs, taxUiMax, taxUiPercent } from "@/lib/money/tax-ui";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import Link from "next/link";

interface VatBox {
  box: string;
  label: string;
  amount: bigint;
}

interface BoxTransaction {
  journalLineId: string;
  journalEntryId: string;
  entryNumber: number;
  date: string;
  description: string | null;
  reference: string | null;
  sourceType: string | null;
  accountCode: string;
  accountName: string;
  debit: bigint;
  credit: bigint;
  amount: bigint;
}

const CALCULATED_BOXES = ["3", "5"];
const KEY_BOX = "5";
// Boxes backed by control-account journal lines (drillable via the
// /transactions endpoint). Mirrors BOX_ACCOUNT in lib/reports/tax-return.ts.
const DRILLABLE_BOXES = ["1", "4"];

type Basis = "accrual" | "cash";

export default function VatReturnPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <VatReturnPageWorkspace key={orgId} orgId={orgId} />;
}

function VatReturnPageWorkspace({ orgId }: { orgId: string | null }) {
  const presentation = usePresentation();
  const t = useTranslations("VatReturn");
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [basis, setBasis] = useState<Basis>("accrual");
  // Flat-rate scheme percentage as the user types it (e.g. "14.5"). Empty = off.
  const [flatRatePercent, setFlatRatePercent] = useState("");
  const [flatRateOn, setFlatRateOn] = useState(false);
  const [boxes, setBoxes] = useState<VatBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-box drill-down: which box is open, plus its loaded/loading transactions.
  const drillGeneration = useRef(0);
  const [openBox, setOpenBox] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<Record<string, BoxTransaction[]>>({});
  const [drillLoading, setDrillLoading] = useState<string | null>(null);
  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const params = new URLSearchParams({ startDate, endDate, basis });
    // The API takes the flat rate in basis points (1450 = 14.5%). Only send it
    // when the scheme is switched on and a positive percentage is entered.
    const pct = Number(flatRatePercent);
    if (flatRateOn && Number.isFinite(pct) && pct > 0) {
      params.set("flatRatePercent", String(Math.round(pct * 100)));
    }
    setLoading(true);
    fetch(`/api/v1/reports/vat-return?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Could not load tax report"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const code = taxUiCurrency(data.currencyCode);
        const rows = taxUiRows(data.boxes as (Omit<VatBox, "amount"> & { amount: number })[], ["amount"]);
        setBoxes(rows);
        setCurrency(code); setError(null);
      })
      .catch(() => { if (!cancelled) { setError(t("loadFailed")); setCurrency(null); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, basis, flatRateOn, flatRatePercent, orgId, t]);

  // Any change to the period/basis invalidates the cached drill-down rows.
  useEffect(() => {
    setOpenBox(null);
    drillGeneration.current += 1;
    setDrillData({});
    return () => { drillGeneration.current += 1; };
  }, [startDate, endDate, basis, orgId]);

  const toggleDrill = useCallback(
    (box: string) => {
      if (openBox === box) {
        setOpenBox(null);
        return;
      }
      setOpenBox(box);
      if (drillData[box]) return; // already loaded for this period
      if (!orgId) return;
      const params = new URLSearchParams({ box, startDate, endDate, basis });
      setDrillLoading(box);
      const generation = drillGeneration.current;
      fetch(`/api/v1/reports/vat-return/transactions?${params}`, {
        headers: { "x-organization-id": orgId },
      })
        .then((r) => { if (!r.ok) throw new Error("Could not load tax report"); return r.json(); })
        .then((data) => {
          if (generation !== drillGeneration.current) return;
          if (taxUiCurrency(data.currencyCode) !== currency) throw new Error("Tax drill currency changed");
          const rows = taxUiRows(data.transactions as (Omit<BoxTransaction, "amount" | "debit" | "credit"> & { amount: number; debit: number; credit: number })[], ["amount", "debit", "credit"]);
          setDrillData((prev) => ({ ...prev, [box]: rows }));
        })
        .catch(() => { if (generation === drillGeneration.current) setError(t("drillFailed")); })
        .finally(() => { if (generation === drillGeneration.current) setDrillLoading((cur) => (cur === box ? null : cur)); });
    },
    [openBox, drillData, startDate, endDate, basis, orgId, currency, t]
  );

  const outputVat = boxes.find((b) => b.box === "1")?.amount ?? 0n;
  const inputVat = boxes.find((b) => b.box === "4")?.amount ?? 0n;
  const netVat = boxes.find((b) => b.box === "5")?.amount ?? 0n;
  const maxVat = taxUiMax(taxUiAbs(outputVat), taxUiAbs(inputVat));
  const outputPct = taxUiPercent(outputVat, maxVat);
  const inputPct = taxUiPercent(inputVat, maxVat);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          {t("print")}
        </Button>
        <ExportButton
          data={(error || loading || !currency ? [] : boxes).map((b) => ({ box: b.box, description: b.label, amount: b.amount.toString(), currencyCode: currency }))}
          columns={["box", "description", "amount", "currencyCode"]}
          filename="vat-return"
        />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link href="/tax/periods">
            <ArrowUpRight className="size-3.5 rtl:rotate-180" />
            {t("taxPeriods")}
          </Link>
        </Button>
      </PageHeader>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {/* How VAT is counted, plus optional flat-rate scheme */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("countVat")}
          </Label>
          <div role="group" aria-label={t("countVat")} className="inline-flex flex-wrap gap-y-2 rounded-md border p-0.5">
            <Button aria-pressed={basis === "accrual"}
              type="button"
              size="sm"
              variant={basis === "accrual" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setBasis("accrual")}
            >
              {t("accrual")}
            </Button>
            <Button aria-pressed={basis === "cash"}
              type="button"
              size="sm"
              variant={basis === "cash" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setBasis("cash")}
            >
              {t("cash")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {basis === "accrual"
              ? t("accrualHelp")
              : t("cashHelp")}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-y-2 items-center gap-2">
            <Switch
              id="flat-rate-toggle"
              checked={flatRateOn}
              onCheckedChange={setFlatRateOn}
            />
            <Label htmlFor="flat-rate-toggle" className="text-sm font-medium">
              {t("flatRate")}
            </Label>
          </div>
          <div className="flex flex-wrap gap-y-2 items-center gap-2">
            <Input dir="ltr"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="100"
              disabled={!flatRateOn}
              value={flatRatePercent}
              onChange={(e) => setFlatRatePercent(e.target.value)}
              placeholder={t("flatRatePlaceholder")}
              className="h-8 w-28 text-sm"
              aria-label={t("flatRatePercent")}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("flatRateHelp")}
          </p>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading || !currency ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal className="space-y-6">
          {/* Output vs Input comparison */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("comparison")}
            </h3>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-y-2 items-center justify-between text-sm">
                  <div className="flex flex-wrap gap-y-2 items-center gap-2">
                    <ArrowUpRight className="size-3.5 text-blue-500 rtl:rotate-180" />
                    <span className="text-muted-foreground">{t("outputVat")}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums font-medium">
                    <BidiText>{taxUiMoney(outputVat, currency!, presentation)}</BidiText>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${outputPct}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-y-2 items-center justify-between text-sm">
                  <div className="flex flex-wrap gap-y-2 items-center gap-2">
                    <ArrowDownLeft className="size-3.5 text-orange-500" />
                    <span className="text-muted-foreground">{t("inputVat")}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums font-medium">
                    <BidiText>{taxUiMoney(inputVat, currency!, presentation)}</BidiText>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${inputPct}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-y-2 items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">
                  {netVat >= 0 ? t("netDue") : t("netRefund")}
                </span>
                <span className={cn(
                  "font-mono text-sm tabular-nums font-semibold",
                  netVat >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  <BidiText>{taxUiMoney(taxUiAbs(netVat), currency!, presentation)}</BidiText>
                </span>
              </div>
            </div>
          </div>

          {/* Net result hero */}
          <div className={cn(
            "rounded-xl border-2 p-5",
            netVat >= 0
              ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
              : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
          )}>
            <div className="flex flex-wrap gap-y-2 items-center justify-between">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {netVat >= 0 ? t("boxFiveDue") : t("boxFiveRefund")}
                </p>
                <p className={cn(
                  "mt-1 text-2xl font-bold font-mono tabular-nums",
                  netVat >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  <BidiText>{taxUiMoney(taxUiAbs(netVat), currency!, presentation)}</BidiText>
                </p>
              </div>
              <div className={cn(
                "flex size-12 items-center justify-center rounded-xl",
                netVat >= 0
                  ? "bg-red-100 dark:bg-red-900/40"
                  : "bg-emerald-100 dark:bg-emerald-900/40"
              )}>
                {netVat >= 0 ? (
                  <ArrowUpRight className="size-5 text-red-600 dark:text-red-400 rtl:rotate-180" />
                ) : (
                  <ArrowDownLeft className="size-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            </div>
          </div>

          {/* Box breakdown */}
          <div>
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t("allBoxes")}
            </h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("drillHelp")}
            </p>
            <div className="rounded-lg border overflow-x-auto">
              {boxes.map((b, i) => {
                const labelKey = vatBoxLabelKey(b.box);
                const isKey = b.box === KEY_BOX;
                const isCalc = CALCULATED_BOXES.includes(b.box);
                const isDrillable = DRILLABLE_BOXES.includes(b.box);
                const isOpen = openBox === b.box;
                const rows = drillData[b.box];
                const isDrillLoading = drillLoading === b.box;

                const rowInner = (
                  <>
                    <div className="flex flex-wrap gap-y-2 items-center gap-3">
                      {isDrillable && (
                        isOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                        )
                      )}
                      <div className={cn(
                        "flex size-8 items-center justify-center rounded-md text-xs font-bold font-mono",
                        isKey
                          ? "bg-emerald-600 text-white dark:bg-emerald-500"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <IdentifierText>{b.box}</IdentifierText>
                      </div>
                      <div>
                        <p className={cn("text-sm", isKey && "font-semibold")}><BidiText>{labelKey ? t(labelKey) : b.label}</BidiText></p>
                        {isCalc && (
                          <Badge variant="outline" className="text-[9px] mt-0.5">{t("calculated")}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <p className={cn(
                        "font-mono text-sm tabular-nums",
                        isKey && "text-base font-bold",
                        isKey && netVat >= 0 && "text-red-600 dark:text-red-400",
                        isKey && netVat < 0 && "text-emerald-600 dark:text-emerald-400",
                        !isKey && "font-medium"
                      )}>
                        <BidiText>{taxUiMoney(taxUiAbs(b.amount), currency!, presentation)}</BidiText>
                      </p>
                    </div>
                  </>
                );

                return (
                  <div
                    key={b.box}
                    className={cn(
                      i < boxes.length - 1 && "border-b",
                      isKey && "bg-emerald-50/60 dark:bg-emerald-950/20",
                      isCalc && !isKey && "bg-muted/30"
                    )}
                  >
                    {isDrillable ? (
                      <button
                        type="button"
                        onClick={() => toggleDrill(b.box)}
                        aria-expanded={isOpen}
                        className="flex flex-wrap gap-y-2 w-full items-center justify-between px-4 py-3.5 text-start transition-colors hover:bg-muted/50"
                      >
                        {rowInner}
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-y-2 items-center justify-between px-4 py-3.5">
                        {rowInner}
                      </div>
                    )}

                    {isDrillable && isOpen && (
                      <div className="border-t bg-muted/20 px-4 py-3">
                        {isDrillLoading ? (
                          <p className="py-2 text-xs text-muted-foreground">{t("loadingTransactions")}</p>
                        ) : !rows || rows.length === 0 ? (
                          <p className="py-2 text-xs text-muted-foreground">
                            {t("noTransactions")}
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[520px]">
                              <thead>
                                <tr className="text-start text-muted-foreground">
                                  <th className="py-1.5 pe-3 font-medium">{t("date")}</th>
                                  <th className="py-1.5 pe-3 font-medium">{t("entry")}</th>
                                  <th className="py-1.5 pe-3 font-medium">{t("transactionDescription")}</th>
                                  <th className="py-1.5 pe-3 font-medium">{t("reference")}</th>
                                  <th className="py-1.5 ps-3 text-end font-medium">{t("amount")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((t) => (
                                  <tr key={t.journalLineId} className="border-t border-border/60">
                                    <td className="py-1.5 pe-3 whitespace-nowrap tabular-nums"><IdentifierText>{t.date}</IdentifierText></td>
                                    <td className="py-1.5 pe-3 whitespace-nowrap font-mono">
                                      <IdentifierText>#{t.entryNumber}</IdentifierText>
                                    </td>
                                    <td className="py-1.5 pe-3"><BidiText>{t.description || "—"}</BidiText></td>
                                    <td className="py-1.5 pe-3 text-muted-foreground"><IdentifierText>{t.reference || "—"}</IdentifierText></td>
                                    <td className="py-1.5 ps-3 text-end font-mono tabular-nums">
                                      <BidiText>{taxUiMoney(t.amount, currency!, presentation)}</BidiText>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-border font-medium">
                                  <td className="py-1.5 pe-3" colSpan={4}>
                                    {t("totalLines", { count: rows.length })}
                                  </td>
                                  <td className="py-1.5 ps-3 text-end font-mono tabular-nums">
                                    <BidiText>{taxUiMoney(rows.reduce((s, t) => s + t.amount, 0n), currency!, presentation)}</BidiText>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ContentReveal>
      )}
    </div>
  );
}
