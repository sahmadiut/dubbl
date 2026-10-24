"use client";

import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { loanJson, loanFailureMessage, loanStatusLabel } from "@/i18n/loan-presentation";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Wallet, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetMoneyDisplay as formatMoney } from "@/lib/money/asset-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import Link from "next/link";

interface LoanDetail {
  id: string;
  name: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  monthlyPayment: number;
  status: string;
}

interface ScheduleEntry {
  id: string;
  periodNumber: number;
  date: string | null;
  principalAmount: number;
  interestAmount: number;
  totalPayment: number;
  remainingBalance: number;
  posted: boolean;
}

const statusColors: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  paid_off: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  defaulted: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};


export default function LoanDetailPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Loans");
  const { id } = useParams<{ id: string }>();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [ln, setLn] = useState<LoanDetail | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEntityTitle(ln?.name);

  function load() {
    if (!orgId) return;
    fetch(`/api/v1/loans/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => loanJson(r, t, t("readFailed"), "detail"))
      .then((data) => {
        if (data.loan) setLn(data.loan);
        if (data.schedule) setSchedule(data.schedule);
      })
      .catch((error) => setReadError(loanFailureMessage(error, t, t("readFailed"))))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId]);

  const nextEntry = schedule.find((e) => !e.posted);

  async function handlePostPayment() {
    if (!orgId || !nextEntry) return;
    await confirm({
      title: t("postTitle"),
      description: t("postDescription", { period: nextEntry.periodNumber, total: formatMoney(nextEntry.totalPayment, unitPresentation), principal: formatMoney(nextEntry.principalAmount, unitPresentation), interest: formatMoney(nextEntry.interestAmount, unitPresentation) }),
      confirmLabel: t("record"),
      onConfirm: async () => {
        setPosting(true);
        try {
          const res = await fetch(`/api/v1/loans/${id}/post-payment`, {
            method: "POST",
            headers: { "x-organization-id": orgId, "Content-Type": "application/json" },
            body: JSON.stringify({ scheduleEntryId: nextEntry.id }),
          });
          await loanJson(res, t, t("recordFailed"), "payment");
          toast.success(t("recorded"));
          load();
        } catch (error) {
          toast.error(loanFailureMessage(error, t, t("recordFailed")));
        } finally {
          setPosting(false);
        }
      },
    });
  }

  if (readError) return <p role="alert" className="text-sm text-destructive">{readError}</p>;

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (!ln) return <div className="space-y-6"><PageHeader title={t("notFound")} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={ln.name} description={t("loan")}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/accounting/loans"><ArrowLeft className="mr-2 size-4" />{t("back")}</Link>
        </Button>
        {ln.status === "active" && nextEntry && (
          <Button
            size="sm"
            onClick={handlePostPayment}
            loading={posting}
            className="bg-emerald-600 hover:bg-emerald-700"
            title={t("recordHint")}
          >
            <Wallet className="mr-2 size-4" />{t("recordMonth")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[ln.status] || ""}>
          {loanStatusLabel(t, ln.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("started", { date: ln.startDate })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("borrowed")}</p>
          <p className="text-xl font-bold font-mono">{formatMoney(ln.principalAmount, unitPresentation)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("rate")}</p>
          <p className="text-xl font-bold font-mono">{(ln.interestRate / 100).toFixed(2)}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("length")}</p>
          <p className="text-xl font-bold font-mono">{t("months", { count: ln.termMonths })}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("monthly")}</p>
          <p className="text-xl font-bold font-mono text-emerald-600">{formatMoney(ln.monthlyPayment, unitPresentation)}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[60px_110px_1fr_1fr_1fr_1fr_90px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>#</span>
          <span>{t("date")}</span>
          <span className="text-right">{t("principal")}</span>
          <span className="text-right">{t("interest")}</span>
          <span className="text-right">{t("payment")}</span>
          <span className="text-right">{t("remaining")}</span>
          <span className="text-right">{t("posted")}</span>
        </div>
        {schedule.map((entry) => (
          <div
            key={entry.id}
            className={`grid min-w-[640px] grid-cols-[60px_110px_1fr_1fr_1fr_1fr_90px] gap-2 border-b px-4 py-2 last:border-b-0 ${
              !entry.posted && entry.id === nextEntry?.id ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
            }`}
          >
            <span className="text-sm font-mono">{entry.periodNumber}</span>
            <span className="text-sm">{entry.date || "-"}</span>
            <span className="text-right text-sm font-mono">{formatMoney(entry.principalAmount, unitPresentation)}</span>
            <span className="text-right text-sm font-mono">{formatMoney(entry.interestAmount, unitPresentation)}</span>
            <span className="text-right text-sm font-mono font-medium">{formatMoney(entry.totalPayment, unitPresentation)}</span>
            <span className="text-right text-sm font-mono">{formatMoney(entry.remainingBalance, unitPresentation)}</span>
            <span className="text-right text-sm">
              {entry.posted ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="size-3.5" />
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </div>
        ))}
        {schedule.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noSchedule")}
          </div>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
