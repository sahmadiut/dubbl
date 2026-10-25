"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { Button } from "@/components/ui/button";
import { reportResultJson, reportResultMoney, vatReturnUi, type VatReturnUi } from "@/lib/money/report-result-ui";
import { BackToReports, ReportHelp, BasisToggle } from "../_components";

type VatResponse = VatReturnUi;

/**
 * Plain-language explanation for each box, plus where to look to see what's
 * behind the number. Drill-down opens the matching detail report filtered to
 * the same dates.
 */
type BoxNumber = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
const BOX_PLAIN: Record<BoxNumber, { title: `box${BoxNumber}Title`; help: `box${BoxNumber}Help`; drill?: "tax-summary" | "ledger" }> = {
  "1": { title: "box1Title", help: "box1Help", drill: "tax-summary" },
  "2": { title: "box2Title", help: "box2Help", drill: "tax-summary" },
  "3": { title: "box3Title", help: "box3Help" },
  "4": { title: "box4Title", help: "box4Help", drill: "tax-summary" },
  "5": { title: "box5Title", help: "box5Help" },
  "6": { title: "box6Title", help: "box6Help", drill: "tax-summary" },
  "7": { title: "box7Title", help: "box7Help", drill: "tax-summary" },
  "8": { title: "box8Title", help: "box8Help" },
  "9": { title: "box9Title", help: "box9Help" },
};

export default function VatReturnPage() {
  const presentation = usePresentation();
  const t = useTranslations("TaxReports");
  const now = new Date();
  const [error, setError] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [data, setData] = useState<VatResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    setData(null);
    const params = new URLSearchParams({ startDate, endDate, basis });
    fetch(`/api/v1/reports/vat-return?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => reportResultJson(r, vatReturnUi))
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });
    return () => { cancelled = true; };
  }, [startDate, endDate, basis]);

  function toggle(box: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(box)) next.delete(box);
      else next.add(box);
      return next;
    });
  }

  function drillHref(kind: "tax-summary" | "ledger" | undefined): string | null {
    if (!kind) return null;
    const dr = new URLSearchParams({ startDate, endDate });
    if (kind === "tax-summary") return `/reports/tax-summary?${dr.toString()}`;
    return `/reports/general-ledger?${dr.toString()}`;
  }

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("returnTitle")}
        description={t("returnDescription")}
      >
        {data && (
          <a
            href={`/api/v1/reports/vat-return?${new URLSearchParams({ startDate, endDate, basis })}`}
            className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
          >
            {t("rawFigures")}
          </a>
        )}
      </PageHeader>

      <ReportHelp>{t("returnHelp")}</ReportHelp>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
        <BasisToggle basis={basis} onChange={setBasis} />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p>}

      {loading ? (
        <BrandLoader className="h-48" />
      ) : error ? null : !data ? (
        <p className="text-sm text-muted-foreground">{t("noFigures")}</p>
      ) : (
        <ContentReveal>
          <div className="space-y-2">
            {data.boxes.map((b) => {
              const plain = BOX_PLAIN[b.box as BoxNumber];
              const isOpen = expanded.has(b.box);
              const href = drillHref(plain?.drill);
              return (
                <div key={b.box} className="rounded-lg border overflow-hidden">
                  <button
                    onClick={() => toggle(b.box)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 hover:bg-muted/40 transition-colors text-start"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground [&:dir(rtl)]:rotate-180" />}
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-mono font-semibold text-muted-foreground"><IdentifierText>
                        {b.box}
                      </IdentifierText></span>
                      <span className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>
                        {plain ? t(plain.title) : b.label}
                      </BidiText></span>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-semibold shrink-0"><IdentifierText>
                      {reportResultMoney(b.amount, data.currencyCode, presentation)}
                    </IdentifierText></span>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/20 px-3 py-3 sm:px-4 text-sm text-muted-foreground space-y-2">
                      <p><BidiText>{plain ? t(plain.help) : b.label}</BidiText></p>
                      <p className="text-xs">{t.rich("officialLabel", { label: b.label, code: (chunks) => <BidiText>{chunks}</BidiText> })}</p>
                      {href && (
                        <Button asChild variant="outline" size="sm" className="mt-1">
                          <Link href={href}>{t("drillDown")}</Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ContentReveal>
      )}
    </ContentReveal>
  );
}
