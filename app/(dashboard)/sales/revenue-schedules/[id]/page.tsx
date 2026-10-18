"use client";

import { useTranslations } from "next-intl";
import { revenueMethodLabel, revenueStatusLabel, revenueScheduleValid, type RevenueReadError } from "@/i18n/revenue-schedule-presentation";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, TrendingUp, Check } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetMoneyDisplay as formatMoney } from "@/lib/money/asset-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import Link from "next/link";

interface RevenueEntry {
  id: string;
  periodDate: string;
  amount: number;
  recognized: boolean;
  journalEntryId: string | null;
}

interface RevenueScheduleDetail {
  id: string;
  totalAmount: number;
  recognizedAmount: number;
  startDate: string;
  endDate: string;
  method: string;
  status: string;
  invoiceId: string | null;
  entries: RevenueEntry[];
}

const statusColors: Record<string, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export default function RevenueScheduleDetailPage() {
  const t = useTranslations("RevenueSchedules");
  const [error, setError] = useState<RevenueReadError | null>(null);
  const { id } = useParams<{ id: string }>();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rs, setRs] = useState<RevenueScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [recognizing, setRecognizing] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("detailDocumentTitle"));

  async function refetch() {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/revenue-schedules/${id}`, { headers: { "x-organization-id": orgId } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!revenueScheduleValid(data?.schedule, true) || data.schedule.id !== id) throw new Error();
      setRs(data.schedule);
      setError(null);
    } catch {
      setRs(null);
      setError("refreshFailed");
    }
  }

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setRs(null);
    setError(null);
    fetch(`/api/v1/revenue-schedules/${id}`, { headers: { "x-organization-id": orgId } })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!revenueScheduleValid(data?.schedule, true) || data.schedule.id !== id) throw new Error();
        if (!cancelled) setRs(data.schedule);
      })
      .catch(() => { if (!cancelled) setError("readFailed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, orgId]);

  async function handleRecognize() {
    const target = rs?.entries.find(e => !e.recognized);
    if (!orgId || !target) return;
    setRecognizing(true);
    try {
      const res = await fetch(`/api/v1/revenue-schedules/${id}/recognize`, {
        method: "POST",
        headers: { "x-organization-id": orgId, "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: target.id }),
      });
      if (res.ok) {
        toast.success(t("recognizedSuccess"));
        await refetch();
      } else {
        toast.error(t("recognizeFailed"));
      }
    } catch {
      toast.error(t("recognizeFailed"));
    } finally {
      setRecognizing(false);
    }
  }

  async function handleCancel() {
    if (!orgId) return;
    await confirm({
      title: t("cancelTitle"),
      description: t("cancelDescription"),
      confirmLabel: t("cancelSchedule"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/revenue-schedules/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          if (!res.ok) throw new Error();
          toast.success(t("cancelledSuccess"));
          await refetch();
        } catch {
          toast.error(t("cancelFailed"));
        }
      },
    });
  }

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (error) return <div className="space-y-6"><PageHeader title={t(error)} /><Button asChild variant="outline"><Link href="/sales/revenue-schedules">{t("back")}</Link></Button></div>;
  if (!rs) return <div className="space-y-6"><PageHeader title={t("notFound")} /></div>;

  const sortedEntries = rs.entries;
  const nextEntry = sortedEntries.find((e) => !e.recognized);
  const remaining = rs.totalAmount - rs.recognizedAmount;

  return (
    <div className="space-y-6">
      <PageHeader title={t("detailTitle")} description={t("detailDescription", { start: rs.startDate, end: rs.endDate, method: revenueMethodLabel(t, rs.method) })}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/revenue-schedules"><ArrowLeft className="mr-2 size-4" />{t("back")}</Link>
        </Button>
        {rs.status === "active" && nextEntry && (
          <Button
            size="sm"
            onClick={handleRecognize}
            loading={recognizing}
            className="bg-emerald-600 hover:bg-emerald-700"
            title={t("recognizeHint")}
          >
            <TrendingUp className="mr-2 size-4" />{t("recognize")}
          </Button>
        )}
        {rs.status === "active" && (
          <Button variant="outline" size="sm" onClick={handleCancel} className="text-red-600" title={t("cancelHint")}>
            <Ban className="mr-2 size-4" />{t("cancelSchedule")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={Object.hasOwn(statusColors, rs.status) ? statusColors[rs.status] : ""}>
          {revenueStatusLabel(t, rs.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("spread", { method: revenueMethodLabel(t, rs.method) })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("total")}</p>
          <p className="text-xl font-bold font-mono">{formatMoney(rs.totalAmount)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("recognized")}</p>
          <p className="text-xl font-bold font-mono text-emerald-600">{formatMoney(rs.recognizedAmount)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("remaining")}</p>
          <p className="text-xl font-bold font-mono text-amber-600">{formatMoney(remaining)}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div className="grid min-w-[400px] grid-cols-[1fr_140px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("period")}</span>
          <span className="text-right">{t("amount")}</span>
          <span className="text-right">{t("countedHeading")}</span>
        </div>
        {sortedEntries.map((entry) => (
          <div key={entry.id} className="grid min-w-[400px] grid-cols-[1fr_140px_120px] gap-2 border-b px-4 py-2 last:border-b-0 items-center">
            <span className="text-sm">{entry.periodDate}</span>
            <span className="text-right text-sm font-mono font-medium">{formatMoney(entry.amount)}</span>
            <span className="text-right text-sm">
              {entry.recognized ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <Check className="mr-1 size-3" />{t("counted")}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">{t("notYet")}</span>
              )}
            </span>
          </div>
        ))}
        {sortedEntries.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("noPeriods")}
          </div>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
