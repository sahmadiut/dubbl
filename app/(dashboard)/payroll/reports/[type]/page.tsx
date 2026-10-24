"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollAnalyticsJson, analyticsOrganization, summaryFields } from "@/i18n/payroll-analytics-presentation";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";

export default function ReportDetailPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollAnalytics");
  const { type } = useParams<{ type: string }>();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  useDocumentTitle(t("detailDocumentTitle"));

  const orgId = analyticsOrganization();

  useEffect(() => {
    let active = true;
    // Start the asynchronous read together with its loading/error lifecycle.
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!orgId) throw new Error("Missing organization");
      setLoading(true);
      const headers = { "x-organization-id": orgId };
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const kind = type === "yoy" || type === "tax-liability" || type === "labor-cost" ? type : "summary";
      const endpoint = `/api/v1/payroll/reports/${kind}`;
      const url = params.toString() ? `${endpoint}?${params}` : endpoint;
      await fetch(url, { headers })
        .then(r => payrollAnalyticsJson(r, kind))
        .then(result => { if (active) { setData(result); setMoneyError(null); } });
    }).catch(() => { if (active) setMoneyError(t(orgId ? "loadFailed" : "organizationRequired")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type, orgId, startDate, endDate, t]);

  const title = type === "summary" ? t("summaryTitle") : type === "tax-liability" ? t("taxTitle")
    : type === "labor-cost" ? t("laborDetailTitle") : type === "yoy" ? t("yoyTitle") : t("report");

  if (loading) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <button onClick={() => router.push("/payroll/reports")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> {t("backToReports")}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <BarChart3 className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>


      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("startDate")}</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("endDate")}</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm w-40" />
        </div>
      </div>

      {moneyError && <p role="alert" className="text-sm text-destructive">{moneyError}</p>}

      {/* Render data based on type */}
      {!moneyError && type === "tax-liability" && data?.data && (
        <div className="rounded-xl border bg-card divide-y">
          <div className="px-4 py-2.5 flex items-center justify-between bg-muted/50 rounded-t-xl">
            <span className="text-xs font-medium text-muted-foreground">{t("employee")}</span>
            <div className="flex gap-8">
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("gross")}</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("tax")}</span>
            </div>
          </div>
          {data.data.map((row: { employeeId: string; employeeName: string; currency: string; totalGross: number; totalTax: number }) => (
            <div key={row.employeeId} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm">{row.employeeName}</span>
              <div className="flex gap-8">
                <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(row.totalGross, row.currency, unitPresentation)}</span>
                <span className="text-sm font-mono tabular-nums w-24 text-right text-red-600 dark:text-red-400">{formatMoney(row.totalTax, row.currency, unitPresentation)}</span>
              </div>
            </div>
          ))}
          {data.totalTax !== undefined && (
            <div className="px-4 py-2.5 flex items-center justify-between font-medium">
              <span className="text-sm">{t("total")}</span>
              <span className="text-sm font-mono tabular-nums text-red-600 dark:text-red-400">{formatMoney(data.totalTax, data.currency, unitPresentation)}</span>
            </div>
          )}
        </div>
      )}

      {!moneyError && type === "labor-cost" && data?.data && (
        <div className="rounded-xl border bg-card divide-y">
          <div className="px-4 py-2.5 flex items-center justify-between bg-muted/50 rounded-t-xl">
            <span className="text-xs font-medium text-muted-foreground">{t("department")}</span>
            <div className="flex gap-8">
              <span className="text-xs font-medium text-muted-foreground w-16 text-right">{t("employees")}</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("gross")}</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("net")}</span>
            </div>
          </div>
          {data.data.map((row: { department: string; employeeCount: number; currency: string; totalGross: number; totalNet: number }, i: number) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm">{row.department}</span>
              <div className="flex gap-8">
                <span className="text-sm font-mono tabular-nums w-16 text-right">{row.employeeCount}</span>
                <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(row.totalGross, row.currency, unitPresentation)}</span>
                <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(row.totalNet, row.currency, unitPresentation)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!moneyError && type === "yoy" && data?.data && (
        <div className="rounded-xl border bg-card divide-y">
          <div className="px-4 py-2.5 flex items-center justify-between bg-muted/50 rounded-t-xl">
            <span className="text-xs font-medium text-muted-foreground">{t("month")}</span>
            <div className="flex gap-8">
              <span className="text-xs font-medium text-muted-foreground w-16 text-right">{t("runs")}</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("gross")}</span>
              <span className="text-xs font-medium text-muted-foreground w-24 text-right">{t("net")}</span>
            </div>
          </div>
          {data.data.map((row: { month: string; runCount: number; currency: string; totalGross: number; totalNet: number }) => (
            <div key={row.month} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm font-mono">{row.month}</span>
              <div className="flex gap-8">
                <span className="text-sm font-mono tabular-nums w-16 text-right">{row.runCount}</span>
                <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(row.totalGross, row.currency, unitPresentation)}</span>
                <span className="text-sm font-mono tabular-nums w-24 text-right">{formatMoney(row.totalNet, row.currency, unitPresentation)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!moneyError && type === "summary" && data?.summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaryFields.map((key) => (
            <div key={key} className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t(key)}</p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums">
                {key !== "totalRuns" && key !== "activeEmployees"
                  ? formatMoney(data.summary[key], data.summary.currency, unitPresentation)
                  : String(data.summary[key])}
              </p>
            </div>
          ))}
        </div>
      )}
    </ContentReveal>
  );
}
