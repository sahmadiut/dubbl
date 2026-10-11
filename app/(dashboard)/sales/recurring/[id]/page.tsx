"use client";

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

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
};

export default function RecurringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [loaded, setLoaded] = useState<{ context: string; template: RecurringTemplate } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  const context = `${orgId}:${id}`;
  const template = loaded?.context === context ? loaded.template : null;

  useDocumentTitle("Sales · Recurring Template");
  useEntityTitle(template?.name);

  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    fetch(`/api/v1/recurring/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Unable to load recurring template"); return response.json(); })
      .then(data => { if (!controller.signal.aborted) { setLoaded({ context, template: recurringInvoiceUiDocument(data.template) as RecurringTemplate }); setError(null); } })
      .catch(error => { if (!controller.signal.aborted) { setLoaded(null); setError(error instanceof Error ? error.message : "Invalid recurring amounts"); } })
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
        const data = await res.json();
        setLoaded(prev => prev?.context === context ? { context, template: { ...prev.template, ...data.template, lines: prev.template.lines } } : prev);
        toast.success(
          newStatus === "paused"
            ? "Recurring template paused"
            : "Recurring template resumed"
        );
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!orgId) return;
    await confirm({
      title: "Delete this recurring template?",
      description:
        "This will permanently delete the recurring template. This action cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        setDeleting(true);
        try {
          const res = await fetch(`/api/v1/recurring/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          if (res.ok) {
            toast.success("Recurring template deleted");
            router.push("/sales/recurring");
          } else {
            toast.error("Failed to delete template");
          }
        } catch {
          toast.error("Failed to delete template");
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title="Loading..." />
      </div>
    );
  if (!template)
    return (
      <div className="space-y-6">
        <PageHeader title="Template not found" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={`Contact: ${template.contact?.name || "Unknown"}`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales/recurring">
            <ArrowLeft className="mr-2 size-4" />
            Back
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
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                Resume
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
          Delete
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className={statusColors[template.status] || ""}
        >
          {template.status}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {frequencyLabels[template.frequency] || template.frequency} · Starts{" "}
          {template.startDate} · Ends{" "}
          {template.endDate || "No end date"}
          {template.nextRunDate &&
            ` · Next run ${template.nextRunDate}`}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Occurrences</p>
          <p className="text-xl font-bold font-mono">
            {template.occurrencesGenerated} /{" "}
            {template.maxOccurrences != null
              ? template.maxOccurrences
              : "\u221E"}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Next Run</p>
          <p className="text-xl font-bold font-mono">
            {template.nextRunDate || "N/A"}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Frequency</p>
          <p className="text-xl font-bold font-mono">
            {frequencyLabels[template.frequency] || template.frequency}
          </p>
        </div>
      </div>

      <RecurringInvoiceMoneyDetails currencyCode={template.currencyCode} lines={template.lines} />

      {template.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Notes
          </p>
          <p className="text-sm">{template.notes}</p>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
