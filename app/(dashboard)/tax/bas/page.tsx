"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { basFieldLabelKey } from "@/lib/i18n/tax-filing-presentation";
import { ArrowUpRight, ArrowDownLeft, Printer } from "lucide-react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { taxUiCurrency, taxUiRows, taxUiMoney, taxUiAbs, taxUiMax, taxUiPercent } from "@/lib/money/tax-ui";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface BasField {
  field: string;
  label: string;
  amount: bigint;
}

const GST_FIELDS = ["G1", "G2", "G3", "G10", "G11", "1A", "1B"];
const KEY_FIELD = "NET";

function getFieldSection(field: string): string {
  if (GST_FIELDS.includes(field)) return "gst";
  if (field === "NET") return "net";
  return "other";
}

export default function BasPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <BasPageWorkspace key={orgId} orgId={orgId} />;
}

function BasPageWorkspace({ orgId }: { orgId: string | null }) {
  const t = useTranslations("BasReport");
  const fieldLabel = (field: BasField) => {
    const key = basFieldLabelKey(field.field);
    return key ? t(key) : field.label;
  };
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [fields, setFields] = useState<BasField[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/v1/reports/bas?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Could not load tax report"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const code = taxUiCurrency(data.currencyCode);
        const rows = taxUiRows(data.fields as (Omit<BasField, "amount"> & { amount: number })[], ["amount"]);
        setFields(rows);
        setCurrency(code); setError(null);
      })
      .catch(() => { if (!cancelled) { setError(t("loadFailed")); setCurrency(null); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, orgId, t]);

  const gstOnSales = fields.find((f) => f.field === "1A")?.amount ?? 0n;
  const gstOnPurchases = fields.find((f) => f.field === "1B")?.amount ?? 0n;
  const netGst = fields.find((f) => f.field === "NET")?.amount ?? 0n;
  const maxGst = taxUiMax(taxUiAbs(gstOnSales), taxUiAbs(gstOnPurchases));
  const salesPct = taxUiPercent(gstOnSales, maxGst);
  const purchasesPct = taxUiPercent(gstOnPurchases, maxGst);

  const gstFields = fields.filter((f) => getFieldSection(f.field) === "gst");
  const netField = fields.find((f) => f.field === KEY_FIELD);
  const otherFields = fields.filter((f) => getFieldSection(f.field) === "other");

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
          data={(error || loading || !currency ? [] : fields).map((f) => ({ field: f.field, description: f.label, amount: f.amount.toString(), currencyCode: currency }))}
          columns={["field", "description", "amount", "currencyCode"]}
          filename="bas"
        />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link href="/tax/periods">
            <ArrowUpRight className="size-3.5" />
            {t("taxPeriods")}
          </Link>
        </Button>
      </PageHeader>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading || !currency ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal className="space-y-6">
          {/* GST comparison */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("comparison")}
            </h3>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="size-3.5 text-blue-500" />
                    <span className="text-muted-foreground">{t("salesComparison")}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums font-medium text-blue-600 dark:text-blue-400">
                    {taxUiMoney(gstOnSales, currency!)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${salesPct}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="size-3.5 text-orange-500" />
                    <span className="text-muted-foreground">{t("purchasesComparison")}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums font-medium text-orange-600 dark:text-orange-400">
                    {taxUiMoney(gstOnPurchases, currency!)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${purchasesPct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">
                  {netGst >= 0 ? t("netPayable") : t("netRefund")}
                </span>
                <span className={cn(
                  "font-mono text-sm tabular-nums font-semibold",
                  netGst >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {taxUiMoney(taxUiAbs(netGst), currency!)}
                </span>
              </div>
            </div>
          </div>

          {/* Net result hero */}
          {netField && (
            <div className={cn(
              "rounded-xl border-2 p-5",
              netField.amount >= 0
                ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
                : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    {netField.amount < 0 ? t("atoRefund") : t("atoPayable")}
                  </p>
                  <p className={cn(
                    "mt-1 text-2xl font-bold font-mono tabular-nums",
                    netField.amount >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {taxUiMoney(taxUiAbs(netField.amount), currency!)}
                  </p>
                </div>
                <div className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  netField.amount >= 0
                    ? "bg-red-100 dark:bg-red-900/40"
                    : "bg-emerald-100 dark:bg-emerald-900/40"
                )}>
                  {netField.amount >= 0 ? (
                    <ArrowUpRight className="size-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <ArrowDownLeft className="size-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GST fields */}
          {gstFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{t("gstInformation")}</h3>
                <Badge variant="outline" className="text-[10px]">G1-G11, 1A-1B</Badge>
              </div>
              <div className="rounded-lg border overflow-hidden">
                {gstFields.map((f, i) => {
                  const isGstTotal = f.field === "1A" || f.field === "1B";
                  return (
                    <div
                      key={f.field}
                      className={cn(
                        "flex items-center justify-between px-4 py-3.5",
                        i < gstFields.length - 1 && "border-b",
                        isGstTotal && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex size-8 items-center justify-center rounded-md text-[10px] font-bold font-mono",
                          isGstTotal
                            ? "bg-blue-600 text-white dark:bg-blue-500"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {f.field}
                        </div>
                        <p className={cn("text-sm", isGstTotal && "font-medium")}>{fieldLabel(f)}</p>
                      </div>
                      <span className={cn(
                        "font-mono text-sm tabular-nums font-medium",
                        f.field === "1A" && "text-blue-600 dark:text-blue-400",
                        f.field === "1B" && "text-orange-600 dark:text-orange-400"
                      )}>
                        {taxUiMoney(f.amount, currency!)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other obligations */}
          {otherFields.length > 0 && (
            <div>
              <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">{t("otherObligations")}</h3>
              <div className="rounded-lg border overflow-hidden">
                {otherFields.map((f, i) => (
                  <div
                    key={f.field}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5",
                      i < otherFields.length - 1 && "border-b"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-[10px] font-bold font-mono text-muted-foreground">
                        {f.field}
                      </div>
                      <p className="text-sm">{fieldLabel(f)}</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums font-medium">{taxUiMoney(f.amount, currency!)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ContentReveal>
      )}
    </div>
  );
}
