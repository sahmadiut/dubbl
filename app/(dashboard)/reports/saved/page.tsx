"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  BarChart3,
  Plus,
  Play,
  Download,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { reportResultJson, customReportUiConfig, customReportUi, customReportCell } from "@/lib/money/report-result-ui";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface ReportConfig {
  dataSource: string;
  columns: string[];
  filters: { field: string; operator: string; value: string }[];
  groupBy: string[];
  dateRange?: { from: string; to: string };
  chartType?: string;
}

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  config: ReportConfig;
  createdAt: string;
  updatedAt: string;
}

interface ReportSchedule {
  id: string;
  savedReportId: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

export default function SavedReportsPage() {
  const t = useTranslations("CustomReports");
  function sourceLabel(source: string) {
    switch (source) {
      case "invoices": return t("invoices");
      case "expenses": return t("expenses");
      case "transactions": return t("transactions");
      case "payroll": return t("payroll");
      case "inventory": return t("inventory");
      case "contacts": return t("contacts");
      default: return source;
    }
  }
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<SavedReport[]>([]);
  // Last-run lives on report schedules, not on the saved report itself.
  // Map savedReportId -> most recent lastRunAt across its schedules.
  const [lastRunByReport, setLastRunByReport] = useState<Record<string, string | null>>({});

  // Run-inline state
  const [runOpen, setRunOpen] = useState(false);
  const [runReportItem, setRunReportItem] = useState<SavedReport | null>(null);
  const runRequest = useRef(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);

  useDocumentTitle(t("savedTitle"));

  function formatDate(value: string | null) {
    if (!value || Number.isNaN(new Date(value).getTime())) return t("never");
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }


  function getHeaders() {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : "";
    return { "x-organization-id": orgId, "Content-Type": "application/json" };
  }

  const fetchReports = useCallback(() => {
    setLoading(true);
    // Fetch saved reports + schedules (for last-run) in parallel.
    Promise.all([
      fetch("/api/v1/reports/saved", { headers: getHeaders() })
        .then((r) => r.json())
        .catch(() => ({ reports: [] })),
      fetch("/api/v1/report-schedules?limit=200", { headers: getHeaders() })
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
    ])
      .then(([savedData, scheduleData]) => {
        setReports(Array.isArray(savedData?.reports) ? savedData.reports : []);

        const schedules: ReportSchedule[] = Array.isArray(scheduleData?.data)
          ? scheduleData.data
          : [];
        const lastRun: Record<string, string | null> = {};
        for (const s of schedules) {
          if (!s.savedReportId || !s.lastRunAt) continue;
          const existing = lastRun[s.savedReportId];
          if (!existing || new Date(s.lastRunAt) > new Date(existing)) {
            lastRun[s.savedReportId] = s.lastRunAt;
          }
        }
        setLastRunByReport(lastRun);
      })
      .finally(() => {
        setLoading(false);
        setInitialLoad(false);
      });
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function openRun(report: SavedReport) {
    setRunReportItem(report);
    setResults(null);
    setRunOpen(true);
    const requestId = ++runRequest.current;
    setRunError(null);
    setResults(null);
    setRunning(true);
    try {
      const config = customReportUiConfig(report.config);
      const res = await fetch("/api/v1/reports/run", {
        method: "POST", headers: getHeaders(), body: JSON.stringify(config),
      });
      const rows = await reportResultJson(res, body => customReportUi(body, config));
      if (requestId === runRequest.current) setResults(rows);
    } catch {
      const message = t("runError");
      if (requestId === runRequest.current) {
        setResults(null); setRunError(message); toast.error(message);
      }
    } finally {
      if (requestId === runRequest.current) setRunning(false);
    }
  }

  function handleExport(report: SavedReport) {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : "";
    window.open(
      `/api/v1/reports/saved/${report.id}/export?x-organization-id=${orgId}`,
      "_blank"
    );
  }

  async function handleDelete(report: SavedReport) {
    await confirm({
      title: t("deleteTitle", { name: report.name }),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      destructive: true,
      onConfirm: async () => {
        const res = await fetch(`/api/v1/reports/saved/${report.id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });
        if (res.ok) {
          toast.success(t("deleted"));
          fetchReports();
        } else {
          toast.error(t("deleteError"));
        }
      },
    });
  }

  const columns: Column<SavedReport>[] = [
    {
      key: "name",
      header: t("name"),
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>{r.name}</BidiText></p>
          {r.description && (
            <p className="text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>{r.description}</BidiText></p>
          )}
        </div>
      ),
    },
    {
      key: "source",
      header: t("basedOn"),
      className: "w-40",
      render: (r) => (
        <Badge variant="outline" className="text-[11px]"><BidiText>
          {sourceLabel(r.config.dataSource)}
        </BidiText></Badge>
      ),
    },
    {
      key: "columns",
      header: t("columns"),
      className: "w-24 text-end",
      render: (r) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {r.config.columns?.length ?? 0}
        </span>
      ),
    },
    {
      key: "lastRun",
      header: t("lastRun"),
      className: "w-32",
      render: (r) => (
        <span className="text-sm text-muted-foreground"><IdentifierText>
          {formatDate(lastRunByReport[r.id] ?? null)}
        </IdentifierText></span>
      ),
    },
    {
      key: "updated",
      header: t("updated"),
      className: "w-32",
      render: (r) => (
        <span className="text-sm text-muted-foreground"><IdentifierText>{formatDate(r.updatedAt)}</IdentifierText></span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-28 text-end",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
            onClick={(e) => {
              e.stopPropagation();
              openRun(r);
            }}
          >
            <Play className="size-3" /> {t("run")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("actions")}
                className="size-7 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport(r)}>
                <Download className="size-4" /> {t("export")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(r)}>
                <Trash2 className="size-4" /> {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <Link
        href="/reports"
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5 [&:dir(rtl)]:rotate-180" /> {t("back")}
      </Link>

      <PageHeader
        title={t("savedTitle")}
        description={t("savedDescription")}
      >
        <Button asChild size="sm" className="h-7 text-xs gap-1">
          <Link href="/reports/custom">
            <Plus className="size-3" /> {t("newSaved")}
          </Link>
        </Button>
      </PageHeader>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <BarChart3 className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">{t("savedEmpty")}</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {t("savedEmptyDescription")}
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/reports/custom">{t("createSaved")}</Link>
          </Button>
        </div>
      ) : (
        <ContentReveal>
          <DataTable
            columns={columns}
            data={reports}
            loading={false}
            emptyMessage={t("emptyTable")}
            onRowClick={(r) => openRun(r)}
          />
        </ContentReveal>
      )}

      {/* Run results dialog */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle><BidiText>{runReportItem?.name || t("report")}</BidiText></DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {runReportItem
                  ? t("sourceSummary", { source: sourceLabel(runReportItem.config.dataSource) })
                  : ""}
              </p>
              {runReportItem && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                  onClick={() => handleExport(runReportItem)}
                >
                  <Download className="size-3" /> {t("export")}
                </Button>
              )}
            </div>

            {runError && <p role="alert" className="text-sm text-destructive"><BidiText>{runError}</BidiText></p>}
            <p className="text-xs text-muted-foreground">{t("units")}</p>
            {running ? (
              <BrandLoader className="h-48" />
            ) : results && runReportItem ? (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {runReportItem.config.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-start text-xs font-medium text-muted-foreground whitespace-nowrap"
                        ><IdentifierText>
                          {col}
                        </IdentifierText></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {runReportItem.config.columns.map((col) => (
                          <td key={col} className="px-3 py-2 text-xs whitespace-normal [overflow-wrap:anywhere]">
                            <BidiText dir={col.endsWith("Minor") ? "ltr" : "auto"}>{customReportCell(row, col)}</BidiText>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td
                          colSpan={runReportItem.config.columns.length}
                          className="px-3 py-8 text-center text-xs text-muted-foreground"
                        >
                          {t("noData")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {results.length > 50 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                    {t("showing", { count: results.length })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </ContentReveal>
  );
}
