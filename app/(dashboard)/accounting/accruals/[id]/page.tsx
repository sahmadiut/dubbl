"use client";

import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { accrualJson, accrualFailureMessage, accrualStatusLabel } from "@/i18n/accrual-presentation";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, CalendarClock, Check } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetMoneyDisplay as formatMoney } from "@/lib/money/asset-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import Link from "next/link";

interface AccrualEntry {
  id: string;
  periodDate: string;
  amount: number;
  posted: boolean;
  journalEntryId: string | null;
  sortOrder: number;
}

interface AccrualScheduleDetail {
  id: string;
  description: string;
  totalAmount: number;
  startDate: string;
  endDate: string;
  periods: number;
  status: string;
  entries: AccrualEntry[];
}

const statusColors: Record<string, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export default function AccrualDetailPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Accruals");
  const [error, setError] = useState("");
  const { id } = useParams<{ id: string }>();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [acc, setAcc] = useState<AccrualScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEntityTitle(acc?.description);

  const refetch = useCallback(async () => {
    if (!orgId) { setError(t("unauthenticated")); setLoading(false); return; }
    try {
      const data = await accrualJson(await fetch(`/api/v1/accrual-schedules/${id}`, {
        headers: { "x-organization-id": orgId },
      }), t, t("detailLoadFailed"), "schedule");
      setAcc(data.schedule);
      setError("");
    } catch (err) {
      setError(accrualFailureMessage(err, t, t("detailLoadFailed")));
    } finally {
      setLoading(false);
    }
  }, [id, orgId, t]);

  useEffect(() => { void refetch(); }, [refetch]);

  async function handlePostNext() {
    if (!orgId) return;
    const entryId = acc?.entries.find((e) => !e.posted)?.id;
    if (!entryId) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/accrual-schedules/${id}/post`, {
        method: "POST",
        headers: { "x-organization-id": orgId, "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      await accrualJson(res, t, t("postFailed"), "post");
      toast.success(t("posted"));
      await refetch();
    } catch (err) {
      toast.error(accrualFailureMessage(err, t, t("postFailed")));
    } finally {
      setPosting(false);
    }
  }

  async function handleCancel() {
    if (!orgId) return;
    await confirm({
      title: t("cancelQuestion"),
      description: t("cancelDescription"),
      confirmLabel: t("cancelAccrual"),
      destructive: true,
      cancelLabel: t("keep"),
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/accrual-schedules/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          await accrualJson(res, t, t("cancelFailed"), "cancel");
          toast.success(t("cancelSuccess"));
          await refetch();
        } catch (err) {
          toast.error(accrualFailureMessage(err, t, t("cancelFailed")));
          throw err;
        }
      },
    });
  }

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (error && !acc) return <p role="alert">{error}</p>;
  if (!acc) return <div className="space-y-6"><PageHeader title={t("notFound")} /></div>;

  const entries = [...acc.entries].sort((a, b) => a.sortOrder - b.sortOrder);
  const postedCount = entries.filter((e) => e.posted).length;
  const hasUnposted = entries.some((e) => !e.posted);

  return (
    <div className="space-y-6">
      {error && <p role="alert">{error}</p>}
      <PageHeader title={acc.description} description={t("summary", { amount: formatMoney(acc.totalAmount, unitPresentation), count: acc.periods })}>
        <Button className="h-auto min-h-9 min-w-0 whitespace-normal text-start" type="button" variant="outline" size="sm" asChild>
          <Link href="/accounting/accruals"><ArrowLeft className="rtl:rotate-180 me-2 size-4" />{t("back")}</Link>
        </Button>
        {acc.status === "active" && hasUnposted && (
          <Button type="button"
            size="sm"
            onClick={handlePostNext}
            loading={posting}
            className="h-auto min-h-9 min-w-0 whitespace-normal text-start bg-emerald-600 hover:bg-emerald-700"
            title={t("postTitle")}
          >
            <CalendarClock className="me-2 size-4" />{t("post")}
          </Button>
        )}
        {acc.status !== "cancelled" && (
          <Button type="button" variant="outline" size="sm" onClick={handleCancel} className="text-red-600" title={t("cancelTitle")}>
            <Ban className="me-2 size-4" />{t("cancelAccrual")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[acc.status] || ""}>
          <BidiText>{accrualStatusLabel(t, acc.status)}</BidiText>
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t.rich("dateRange", { start: acc.startDate, end: acc.endDate, em: chunks => <IdentifierText>{chunks}</IdentifierText> })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("total")}</p>
          <p className="text-xl font-bold font-mono"><BidiText>{formatMoney(acc.totalAmount, unitPresentation)}</BidiText></p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("months")}</p>
          <p className="text-xl font-bold font-mono"><BidiText>{acc.periods}</BidiText></p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("recordedSoFar")}</p>
          <p className="text-xl font-bold font-mono text-emerald-600">{t("progress", { posted: postedCount, count: acc.periods })}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div className="grid min-w-[420px] grid-cols-[1fr_140px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("month")}</span>
          <span className="text-end">{t("amount")}</span>
          <span className="text-end">{t("recorded")}</span>
        </div>
        {entries.map((entry) => (
          <div key={entry.id} className="grid min-w-[420px] grid-cols-[1fr_140px_120px] gap-2 border-b px-4 py-2.5 last:border-b-0 items-center">
            <span className="text-sm"><IdentifierText>{entry.periodDate}</IdentifierText></span>
            <span className="text-end text-sm font-mono font-medium"><BidiText>{formatMoney(entry.amount, unitPresentation)}</BidiText></span>
            <span className="text-end">
              {entry.posted ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="size-3.5" />{t("recorded")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{t("notYet")}</span>
              )}
            </span>
          </div>
        ))}
        <div className="border-t bg-muted/30 px-4 py-2 text-end">
          <span className="text-sm font-bold"><BidiText>{t("totalAmountSummary", { amount: formatMoney(acc.totalAmount, unitPresentation) })}</BidiText></span>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
