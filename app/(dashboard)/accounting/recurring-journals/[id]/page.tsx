"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { requireJournalResponse, journalFailureMessage } from "@/i18n/journal-presentation";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pause, Play, Zap, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { journalStoredMinor, journalMoney } from "@/lib/money/journal-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface RecurringJournalLine {
  id: string;
  description: string;
  accountId: string | null;
  debitAmount: number;
  debitAmountMinor: string;
  creditAmount: number;
  creditAmountMinor: string;
}

interface RecurringJournalDetail {
  id: string;
  name: string;
  frequency: string;
  status: string;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  lastRunDate: string | null;
  occurrencesGenerated: number;
  maxOccurrences: number | null;
  reference: string | null;
  notes: string | null;
  currencyCode: string;
  lines: RecurringJournalLine[];
}

const statusColors: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  paused:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

// Plain-language status labels (end users aren't accountants).

export default function RecurringJournalDetailPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const frequencyLabels: Record<string, string> = {
    weekly: t("weekly"),
    fortnightly: t("fortnightly"),
    monthly: t("monthly"),
    quarterly: t("quarterly"),
    semi_annual: t("semiAnnual"),
    annual: t("annual"),
  };

  const statusLabels: Record<string, string> = {
    active: t("postingStatus"),
    paused: t("pausedStatus"),
    completed: t("finishedStatus"),
  };

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rj, setRj] = useState<RecurringJournalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [posting, setPosting] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEntityTitle(rj?.name);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/v1/recurring-journals/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => (await requireJournalResponse(r, errors, t("loadRecurringFailed"))).json())
      .then((data) => {
        setError(null);
        if (data.template) setRj(data.template);
      })
      .catch((error) => setError(journalFailureMessage(error, t("loadRecurringFailed"))))
      .finally(() => setLoading(false));
  }, [id, orgId, t, errors]);

  // Pause / resume the schedule.
  async function handleToggle() {
    if (!orgId) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/recurring-journals/${id}/pause`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await requireJournalResponse(res, errors, t("toggleFailed"));
      const data = await res.json();
      if (!data.template || !["active", "paused"].includes(data.template.status)) throw new Error("Invalid recurring journal status");
      setRj((prev) => (prev ? { ...prev, ...data.template } : prev));
      toast.success(
        data.template.status === "paused"
          ? t("pauseSuccess")
          : t("resumeSuccess")
      );
    } catch (error) {
      toast.error(journalFailureMessage(error, t("toggleFailed")));
    } finally {
      setToggling(false);
    }
  }

  // Post any entries that are due right now (catches up if behind).
  async function handlePostNow() {
    if (!orgId) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/recurring-journals/run`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await requireJournalResponse(res, errors, t("runFailed"));
      const data = await res.json();
      const posted = data.posted ?? 0;
      toast.success(
        posted > 0
          ? t("postedDue", { count: posted })
          : t("nothingDue")
      );
      // Refresh this template to reflect new counts/next date.
      const refreshed = await fetch(`/api/v1/recurring-journals/${id}`, { headers: { "x-organization-id": orgId } });
      await requireJournalResponse(refreshed, errors, t("loadRecurringFailed"));
      const d = await refreshed.json();
      if (d.template) setRj(d.template);
    } catch (error) {
      toast.error(journalFailureMessage(error, t("runFailed")));
    } finally {
      setPosting(false);
    }
  }

  // Delete the schedule (already-posted journal entries are untouched).
  async function handleDelete() {
    if (!orgId) return;
    await confirm({
      title: t("deleteRecurringTitle"),
      description: t("deleteRecurringDescription"),
      confirmLabel: t("deleteSchedule"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/recurring-journals/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          await requireJournalResponse(res, errors, t("deleteRecurringFailed"));
          toast.success(t("deletedRecurring"));
          router.push("/accounting/recurring-journals");
        } catch (error) {
          toast.error(journalFailureMessage(error, t("deleteRecurringFailed")));
          throw error;
        }
      },
    });
  }

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!rj) return <div className="space-y-6"><PageHeader title={t("missingRecurring")} /></div>;

  let totalDebit, totalCredit;
  try {
    totalDebit = rj.lines.reduce((s, l) => s + journalStoredMinor(l.debitAmountMinor), 0n);
    totalCredit = rj.lines.reduce((s, l) => s + journalStoredMinor(l.creditAmountMinor), 0n);
    journalMoney(totalDebit, rj.currencyCode, unitPresentation);
    journalMoney(totalCredit, rj.currencyCode, unitPresentation);
  } catch {
    return <p role="alert" className="text-sm text-destructive">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={rj.name} description={t("recurringDetailDescription")}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/accounting/recurring-journals"><ArrowLeft className="me-2 size-4 rtl:rotate-180" />{t("back")}</Link>
        </Button>
        {rj.status !== "completed" && (
          <Button
            type="button"
            size="sm"
            onClick={handlePostNow}
            loading={posting}
            className="h-auto max-w-full whitespace-normal bg-emerald-600 hover:bg-emerald-700"
            title={t("postNowHint")}
          >
            <Zap className="me-2 size-4" />{t("postNow")}</Button>
        )}
        {rj.status === "active" && (
          <Button type="button" variant="outline" size="sm" onClick={handleToggle} loading={toggling} title={t("pauseHint")}>
            <Pause className="me-2 size-4" />{t("pause")}</Button>
        )}
        {rj.status === "paused" && (
          <Button type="button" variant="outline" size="sm" onClick={handleToggle} loading={toggling} title={t("resumeHint")}>
            <Play className="me-2 size-4" />{t("resume")}</Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleDelete} className="h-auto max-w-full whitespace-normal text-red-600" title={t("deleteScheduleHint")}>
          <Trash2 className="me-2 size-4" />{t("delete")}</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[rj.status] || ""}>
          <BidiText>{Object.hasOwn(statusLabels, rj.status) ? statusLabels[rj.status] : rj.status}</BidiText>
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          <BidiText>{Object.hasOwn(frequencyLabels, rj.frequency) ? frequencyLabels[rj.frequency] : rj.frequency}</BidiText>
        </span>
        {rj.reference && (
          <span className="text-xs sm:text-sm text-muted-foreground">
            {t.rich("referenceValue", { reference: rj.reference, em: chunks => <BidiText>{chunks}</BidiText> })}
          </span>
        )}
      </div>

      <div className="grid min-w-0 [&>*]:min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("nextEntry")}</p>
          <p className="text-sm font-medium mt-1"><IdentifierText>{rj.nextRunDate || "-"}</IdentifierText></p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("lastPosted")}</p>
          <p className="text-sm font-medium mt-1"><BidiText>{rj.lastRunDate || t("never")}</BidiText></p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("postedSoFar")}</p>
          <p className="text-sm font-medium font-mono mt-1">
            {rj.occurrencesGenerated} / {rj.maxOccurrences ?? "∞"}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("eachEntry")}</p>
          <p className="text-sm font-bold font-mono mt-1"><BidiText>{journalMoney(totalDebit, rj.currencyCode, unitPresentation)}</BidiText></p>
        </div>
      </div>

      {/* Journal legs */}
      <div className="rounded-lg border overflow-x-auto">
        <div className="grid min-w-[500px] grid-cols-[1fr_140px_120px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("description")}</span>
          <span>{t("account")}</span>
          <span className="text-end">{t("moneyIn")}</span>
          <span className="text-end">{t("moneyOut")}</span>
        </div>
        {rj.lines.map((line) => (
          <div key={line.id} className="grid min-w-[500px] grid-cols-[1fr_140px_120px_120px] gap-2 border-b px-4 py-2 last:border-b-0">
            <p className="text-sm"><BidiText>{line.description}</BidiText></p>
            <span className="text-sm font-mono text-muted-foreground min-w-0"><IdentifierText>{line.accountId || "-"}</IdentifierText></span>
            <span className="text-end text-sm font-mono"><BidiText>{journalStoredMinor(line.debitAmountMinor) > 0n ? journalMoney(journalStoredMinor(line.debitAmountMinor), rj.currencyCode, unitPresentation) : "-"}</BidiText></span>
            <span className="text-end text-sm font-mono"><BidiText>{journalStoredMinor(line.creditAmountMinor) > 0n ? journalMoney(journalStoredMinor(line.creditAmountMinor), rj.currencyCode, unitPresentation) : "-"}</BidiText></span>
          </div>
        ))}
        <div className="border-t bg-muted/30 px-4 py-2 text-end flex flex-wrap justify-end gap-x-4 gap-y-1">
          <span className="text-sm font-medium">{t.rich("totalIn", { amount: journalMoney(totalDebit, rj.currencyCode, unitPresentation), em: chunks => <BidiText>{chunks}</BidiText> })}</span>
          <span className="text-sm font-medium">{t.rich("totalOut", { amount: journalMoney(totalCredit, rj.currencyCode, unitPresentation), em: chunks => <BidiText>{chunks}</BidiText> })}</span>
        </div>
      </div>

      {rj.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
          <p className="text-sm"><BidiText>{rj.notes}</BidiText></p>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
