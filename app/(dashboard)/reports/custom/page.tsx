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
  Save,
  Download,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PageHeader } from "@/components/dashboard/page-header";
import { reportResultJson, customReportUiConfig, customReportUi, customReportCell } from "@/lib/money/report-result-ui";
import { useConfirm } from "@/lib/hooks/use-confirm";

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  config: {
    dataSource: string;
    columns: string[];
    filters: { field: string; operator: string; value: string }[];
    groupBy: string[];
    dateRange?: { from: string; to: string };
    chartType?: string;
  };
  createdAt: string;
}

const DATA_SOURCES: Record<string, { label: string; columns: string[] }> = {
  invoices: {
    label: "invoices",
    columns: ["invoiceNumber", "contactName", "status", "issueDate", "dueDate", "subtotal", "taxTotal", "total", "amountPaid", "amountDue", "currencyCode"],
  },
  contacts: {
    label: "contacts",
    columns: ["name", "email", "type", "phone", "paymentTermsDays", "creditLimit"],
  },
  inventory: {
    label: "inventory",
    columns: ["code", "name", "category", "purchasePrice", "salePrice", "quantityOnHand", "reorderPoint", "isActive"],
  },
  transactions: {
    label: "transactions",
    columns: ["date", "description", "amount", "status", "payee"],
  },
};

export default function CustomReportsPage() {
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
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [dataSource, setDataSource] = useState("invoices");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const runRequest = useRef(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId") || "";
    return { "x-organization-id": orgId, "Content-Type": "application/json" };
  }

  const fetchReports = useCallback(() => {
    setLoading(true);
    fetch("/api/v1/reports/saved", { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => { if (data.reports) setSavedReports(data.reports); })
      .finally(() => {
        setLoading(false);
        setInitialLoad(false);
      });
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  function invalidateRun() {
    runRequest.current++; setRunning(false); setResults(null); setRunError(null);
  }

  function openBuilder() {
    invalidateRun();
    setReportName("");
    setDataSource("invoices");
    setSelectedColumns(DATA_SOURCES.invoices.columns.slice(0, 5));
    setResults(null);
    setBuilderOpen(true);
  }

  async function runReport() {
    const requestId = ++runRequest.current;
    setRunError(null);
    setResults(null);
    setRunning(true);
    try {
      const config = customReportUiConfig({ dataSource, columns: selectedColumns, filters: [], groupBy: [] });
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

  async function saveReport() {
    if (!reportName.trim()) {
      toast.error(t("enterName"));
      return;
    }
    await fetch("/api/v1/reports/saved", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        name: reportName,
        config: {
          dataSource,
          columns: selectedColumns,
          filters: [],
          groupBy: [],
        },
      }),
    });
    toast.success(t("saved"));
    setBuilderOpen(false);
    fetchReports();
  }

  async function handleDelete(report: SavedReport) {
    await confirm({
      title: t("deleteTitle", { name: report.name }),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      destructive: true,
      onConfirm: async () => {
        await fetch(`/api/v1/reports/saved/${report.id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });
        toast.success(t("deleted"));
        fetchReports();
      },
    });
  }

  function handleExport(report: SavedReport) {
    const orgId = localStorage.getItem("activeOrgId") || "";
    window.open(`/api/v1/reports/saved/${report.id}/export?x-organization-id=${orgId}`, "_blank");
  }

  const availableColumns = DATA_SOURCES[dataSource]?.columns || [];

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <Link href="/reports" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5 [&:dir(rtl)]:rotate-180" /> {t("back")}
      </Link>

      <PageHeader title={t("customTitle")} description={t("customDescription")}>
        <Button size="sm" className="h-7 text-xs gap-1 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={openBuilder}>
          <Plus className="size-3" />
          {t("newCustom")}
        </Button>
      </PageHeader>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal>
          {savedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <BarChart3 className="size-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-medium">{t("customEmpty")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("customEmptyDescription")}
              </p>
              <Button size="sm" className="mt-4 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={openBuilder}>
                {t("createCustom")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedReports.map((report) => (
                <div key={report.id} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>{report.name}</BidiText></h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <BidiText>{sourceLabel(report.config.dataSource)}</BidiText>
                        {" ? "}{t("columnCount", { count: report.config.columns.length })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label={t("actions")} className="size-7 p-0">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport(report)}>
                          <Download className="size-4" /> {t("export")}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDelete(report)}>
                          <Trash2 className="size-4" /> {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {report.config.columns.slice(0, 3).map((col) => (
                      <Badge key={col} variant="outline" className="text-[10px]"><IdentifierText>{col}</IdentifierText></Badge>
                    ))}
                    {report.config.columns.length > 3 && (
                      <Badge variant="outline" className="text-[10px]"><IdentifierText>+{report.config.columns.length - 3}</IdentifierText></Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ContentReveal>
      )}

      {/* Builder Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t("builder")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="custom-report-name">{t("reportName")}</Label>
                <Input id="custom-report-name" name="reportName" dir="auto" value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder={t("placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-report-source">{t("dataSource")}</Label>
                <Select value={dataSource} onValueChange={(v) => {
                  invalidateRun();
                  setDataSource(v);
                  setSelectedColumns(DATA_SOURCES[v]?.columns.slice(0, 5) || []);
                  setResults(null);
                }}>
                  <SelectTrigger id="custom-report-source" className="data-[size=default]:h-auto min-h-9 max-w-full whitespace-normal [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-start"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_SOURCES).map(([k, v]) => (
                      <SelectItem key={k} value={k}><BidiText>{sourceLabel(v.label)}</BidiText></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("columns")}</p>
              <div className="flex flex-wrap gap-1.5">
                {availableColumns.map((col) => {
                  const selected = selectedColumns.includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => {
                        invalidateRun();
                        setSelectedColumns((prev) =>
                          selected ? prev.filter((c) => c !== col) : [...prev, col]
                        );
                      }}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        selected
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    ><IdentifierText>
                      {col}
                    </IdentifierText></button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={runReport} disabled={running || selectedColumns.length === 0}>
                <Play className="size-3" />
                {running ? t("running") : t("runReport")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={saveReport} disabled={!reportName.trim()}>
                <Save className="size-3" />
                {t("save")}
              </Button>
            </div>

            {runError && <p role="alert" className="text-sm text-destructive"><BidiText>{runError}</BidiText></p>}
            <p className="text-xs text-muted-foreground">{t("units")}</p>
            {results && (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {selectedColumns.map((col) => (
                        <th key={col} className="px-3 py-2 text-start text-xs font-medium text-muted-foreground"><IdentifierText>
                          {col}
                        </IdentifierText></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {selectedColumns.map((col) => (
                          <td key={col} className="px-3 py-2 text-xs">
                            <BidiText dir={col.endsWith("Minor") ? "ltr" : "auto"}>{customReportCell(row, col)}</BidiText>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={selectedColumns.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
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
            )}
          </div>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </ContentReveal>
  );
}
