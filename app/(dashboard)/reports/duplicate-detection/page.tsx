"use client";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { duplicateDetectionUi, analyticalReportJson } from "@/lib/money/analytical-report-ui";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { analyticalMoney as formatMoney } from "@/lib/money/analytical-report-ui";
import { invoiceStatusLabel } from "@/i18n/invoice-presentation";
import { billStatusLabel } from "@/i18n/bill-presentation";
import { BackToReports } from "../_components";

type DuplicateGroup = ReturnType<typeof duplicateDetectionUi>["duplicateGroups"][number];

export default function DuplicateDetectionPage() {
  const presentation = usePresentation();
  const t = useTranslations("AgingVendorReports");
  const router = useRouter();
  const ti = useTranslations("SalesInvoices");
  const tb = useTranslations("SupplierBills");
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/v1/reports/duplicate-detection", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => analyticalReportJson(r, duplicateDetectionUi))
      .then((data) => {
        if (cancelled) return;
        setGroups(data.duplicateGroups);
        setError(false);
      })
      .catch(() => { if (!cancelled) { setGroups([]); setError(true); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("dupTitle")}
        description={t("dupDescription")}
      />

      {error ? <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p> : loading ? (
        <BrandLoader className="h-48" />
      ) : groups.length === 0 ? (
        <ContentReveal>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <div className="flex justify-center mb-3">
              <div className="size-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <AlertTriangle className="size-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-sm font-medium">{t("noDuplicates")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noDuplicatesHint")}</p>
          </div>
        </ContentReveal>
      ) : (
        <ContentReveal>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t("dupGroupCount", { count: groups.length })}
                </p>
              </div>
            </div>

            {groups.map((group, gi) => (
              <div key={gi} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={group.type === "invoice" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                      {t(group.type)}
                    </Badge>
                    <span className="text-sm font-medium">{group.contactName}</span>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums">{currencyLabel(group.currencyCode, presentation.locale)} {formatMoney(group.amount, group.currencyCode, presentation)}</span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => router.push(group.type === "invoice" ? `/sales/${item.id}` : `/purchases/${item.id}`)}
                      className="flex items-center justify-between w-full rounded px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{item.number}</span>
                        <span>{new Date(item.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{group.type === "invoice" ? invoiceStatusLabel(ti, item.status) : billStatusLabel(item.status, tb)}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
