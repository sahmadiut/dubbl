"use client";

import { useTranslations } from "next-intl";
import { recurringInvoiceFrequencyLabel, recurringInvoiceStatusLabel, type RecurringInvoiceReadError } from "@/i18n/recurring-invoice-presentation";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pause, Play, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recurringInvoiceUiDocument, type RecurringInvoiceUiLine } from "@/lib/money/recurring-invoice-ui";
import { RecurringInvoiceMoneyDetails } from "@/components/dashboard/recurring-invoice-money-details";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import Link from "next/link";

interface RecurringTemplate {
  id: string;
  name: string;
  type: string;
  contactId: string | null;
  frequency: string;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  lastRunDate: string | null;
  occurrencesGenerated: number;
  maxOccurrences: number | null;
  status: string;
  reference: string | null;
  notes: string | null;
  currencyCode: string;
  contact: { name: string } | null;
  lines: RecurringInvoiceUiLine[];
}

const statusColors: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  paused:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  completed:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400",
};
export default function RecurringDetailPage() {
  const t = useTranslations("RecurringInvoices");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [loaded, setLoaded] = useState<{ context: string; template: RecurringTemplate } | null>(null);
  const [error, setError] = useState<RecurringInvoiceReadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  const context = `${orgId}:${id}`;
  const template = loaded?.context === context ? loaded.template : null;

  useDocumentTitle(t("detailTitle"));
  useEntityTitle(template?.name);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/recurring/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Unable to load recurring template"); return response.json(); })
      .then(data => { if (!controller.signal.aborted) { setLoaded({ context, template: recurringInvoiceUiDocument(data.template) as RecurringTemplate }); setError(null); } })
      .catch(() => { if (!controller.signal.aborted) { setLoaded(null); setError("readFailed"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, orgId, context]);

  async function handleToggleStatus() {
    if (!orgId || !template) return;
    setToggling(true);
    const newStatus = template.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/v1/recurring/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data?.template || data.template.id !== id || data.template.status !== newStatus) {
          setLoaded(null); setError("updateReadFailed"); return;
        }
        setLoaded(prev => prev?.context === context ? { context, template: { ...prev.template, status: newStatus } } : prev);
        toast.success(
          newStatus === "paused"
            ? t("pausedSuccess")
            : t("resumedSuccess")
        );
      } else {
        toast.error(t("updateFailed"));
      }
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!orgId) return;
    await confirm({
      title: t("deleteTitle"),
      description:
        t("deleteDescription"),
      confirmLabel: t("delete"),
      destructive: true,
      onConfirm: async () => {
        setDeleting(true);
        try {
          const res = await fetch(`/api/v1/recurring/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          if (res.ok) {
            toast.success(t("deleted"));
            router.push("/sales/recurring");
          } else {
            toast.error(t("deleteFailed"));
          }
        } catch {
          toast.error(t("deleteFailed"));
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title={t("loading")} />
      </div>
    );
  if (!template)
    return (
      <div className="space-y-6">
        <PageHeader title={t("notFound")} />
        {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={t("contact", { name: template.contact?.name || t("unknown") })}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/recurring">
            <ArrowLeft className="mr-2 size-4" />
            {t("back")}
          </Link>
        </Button>
        {(template.status === "active" || template.status === "paused") && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            loading={toggling}
          >
            {template.status === "active" ? (
              <>
                <Pause className="mr-2 size-4" />
                {t("pause")}
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                {t("resume")}
              </>
            )}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          loading={deleting}
          className="text-red-600"
        >
          <Trash2 className="mr-2 size-4" />
          {t("delete")}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className={statusColors[template.status] || ""}
        >
          {recurringInvoiceStatusLabel(t, template.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("schedule", { frequency: recurringInvoiceFrequencyLabel(t, template.frequency), start: template.startDate, end: template.endDate || t("noEndDate") })}
          {template.nextRunDate && t("nextRunHint", { date: template.nextRunDate })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("occurrences")}</p>
          <p className="text-xl font-bold font-mono">
            {template.occurrencesGenerated} /{" "}
            {template.maxOccurrences != null
              ? template.maxOccurrences
              : "\u221E"}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("nextRun")}</p>
          <p className="text-xl font-bold font-mono">
            {template.nextRunDate || t("notApplicable")}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("frequency")}</p>
          <p className="text-xl font-bold font-mono">
            {recurringInvoiceFrequencyLabel(t, template.frequency)}
          </p>
        </div>
      </div>

      <RecurringInvoiceMoneyDetails currencyCode={template.currencyCode} lines={template.lines} />

      {template.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {t("notes")}
          </p>
          <p className="text-sm">{template.notes}</p>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
