"use client";

import { usePresentation } from "@/i18n/provider";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { DollarSign } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { DatePicker } from "@/components/ui/date-picker";
import { ledgerAgingJson, receivablesUi, reportUiMoney, agingExportRows, type AgingUi, type AgingItemUi } from "@/lib/money/ledger-aging-ui";
import { ErrorState } from "@/components/dashboard/error-state";
import { ExportButton } from "@/components/dashboard/export-button";
import { agingBucketLabel } from "@/i18n/aging-vendor-report-presentation";
import { BackToReports } from "../_components";

type DocumentRow = AgingItemUi;

export default function AgedReceivablesPage() {
  const presentation = usePresentation();
  const t = useTranslations("AgingVendorReports");
  const today = new Date().toISOString().slice(0, 10);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [asAt, setAsAt] = useState(today);
  const [data, setData] = useState<AgingUi | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ asAt });
    fetch(`/api/v1/reports/aged-receivables?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => ledgerAgingJson(r, receivablesUi))
      .then((data) => {
        if (cancelled) return;
        setData(data);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [asAt]);

  if (initialLoad) return <BrandLoader />;
  if (error) return <ErrorState message={t("loadFailed")} onRetry={() => window.location.reload()} />;
  const buckets = data?.buckets ?? [], grandTotal = data?.grandTotal ?? 0n;
  const allInvoices = buckets.flatMap(b => b.items.map(row => ({ ...row, bucket: b.label })));
  const formatMoney = (amount: bigint) => reportUiMoney(amount, data!.currencyCode, presentation);

  const columns: Column<DocumentRow>[] = [
    { key: "number", header: t("invoice"), className: "w-32", render: (r) => <span className="font-mono text-sm">{r.invoiceNumber}</span> },
    { key: "contact", header: t("customer"), render: (r) => <span className="text-sm font-medium">{r.contactName}</span> },
    { key: "due", header: t("dueDate"), className: "w-28", render: (r) => <span className="text-sm">{r.dueDate}</span> },
    { key: "days", header: t("daysOverdue"), className: "w-28", render: (r) => <span className="text-sm tabular-nums">{r.daysOverdue}</span> },
    { key: "amount", header: t("amountDue"), className: "w-32 text-right", render: (r) => <span className="font-mono text-sm tabular-nums">{reportUiMoney(r.amountDue, r.currencyCode, presentation)}</span> },
  ];

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("receivablesTitle")}
        description={t("receivablesDescription")}
      >
        <ExportButton
          data={data ? agingExportRows(data) : []}
          columns={["invoiceNumber", "contactName", "dueDate", "daysOverdue", "currencyCode", "amountDueMinor", "bucket"]}
          filename="aged-receivables"
        />
      </PageHeader>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">{t("asOfLabel")}</span>
          <DatePicker value={asAt} onChange={setAsAt} className="w-40 h-8 text-sm" />
        </div>
      </div>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {buckets.map((b) => (
              <StatCard
                key={b.label}
                title={agingBucketLabel(t, b.label)}
                value={formatMoney(b.total)}
                change={t("invoiceCount", { count: b.count })}
                icon={DollarSign}
              />
            ))}
          </div>

          <div className="rounded-lg border bg-card p-3 sm:p-4 mt-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">{t("totalOwedToYou")}</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums truncate">{formatMoney(grandTotal)}</p>
          </div>

          <div className="mt-4">
            <DataTable
              columns={columns}
              data={allInvoices}
              loading={loading}
              emptyMessage={t("noReceivables")}
            />
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
