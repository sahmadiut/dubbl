"use client";

import { IdentifierText } from "@/components/ui/bidi-text";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Package2, FileSpreadsheet, Check } from "lucide-react";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { Button } from "@/components/ui/button";
import { BackToReports, ReportHelp, BasisToggle } from "../_components";

const INCLUDED = ["income", "balance", "trial", "cash"] as const;

export default function ReportPackPage() {
  const t = useTranslations("ReportPack");
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");

  const downloadUrl = `/api/v1/reports/pack?${new URLSearchParams({
    startDate,
    endDate,
    basis,
    format: "xlsx",
  })}`;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      <ReportHelp>{t("help")}</ReportHelp>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
        <BasisToggle basis={basis} onChange={setBasis} />
      </div>

      <ContentReveal>
        <div className="rounded-xl border bg-card/80 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
              <Package2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{t("contents")}</h3>
              <p className="text-xs text-muted-foreground">
                {t.rich("period", { startDate, endDate, code: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium">{t(`${item}Name`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`${item}Desc`)}</p>
                </div>
              </li>
            ))}
          </ul>

          <Button asChild className="mt-5 h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] bg-emerald-600 hover:bg-emerald-700">
            <a href={downloadUrl}>
              <FileSpreadsheet className="me-1.5 size-4" />
              {t("download")}
            </a>
          </Button>
        </div>
      </ContentReveal>
    </ContentReveal>
  );
}
