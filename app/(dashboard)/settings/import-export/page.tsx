"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { BulkImportWizard } from "@/components/bulk-import-wizard";
import { getMapping, aliasesToRecord } from "@/lib/import-export/mappings";
import type { SourceSystem } from "@/lib/import-export/types";
import {
  Download,
  Upload,
  ArrowRight,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { richTextTags } from "@/i18n/rich-text";
import { importOptions } from "@/components/settings/import-options";
import { ImportJobHistory, type ImportJob } from "@/components/settings/data-management-content";
import { toast } from "sonner";

export default function ImportExportPage() {
  const t = useTranslations("SettingsImportExport");
  const { SOURCES, ENTITIES, EXPORT_ENTITIES } = importOptions(t);
  const [source, setSource] = useState<SourceSystem>("quickbooks");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeEntity, setActiveEntity] = useState<typeof ENTITIES[number] | null>(null);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Export state
  const [selectedExports, setSelectedExports] = useState<Set<string>>(new Set());
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : "";

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/bulk/import-jobs?" + new URLSearchParams({ limit: "20" }), {
        headers: { "x-organization-id": orgId },
      });
      if (res.ok) {
        const data = await res.json();
        setImportJobs(data.jobs || []);
      }
    } catch {
      // ignore
    } finally {
      setJobsLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleEntityClick = (entity: typeof ENTITIES[number]) => {
    setActiveEntity(entity);
    setWizardOpen(true);
  };

  const columnAliases = activeEntity
    ? aliasesToRecord(getMapping(source, activeEntity.key))
    : undefined;

  const handleExport = async (entityKey?: string) => {
    setExporting(true);
    try {
      const entities = entityKey ? [entityKey] : Array.from(selectedExports);
      if (entities.length === 0) {
        toast.error(t("selectAtLeastOneEntityToExport"));
        return;
      }

      if (!entityKey && entities.length > 1) {
        const params = new URLSearchParams();
        if (exportDateFrom) params.set("startDate", exportDateFrom);
        if (exportDateTo) params.set("endDate", exportDateTo);

        const res = await fetch(`/api/v1/export/all?${params}`, {
          headers: { "x-organization-id": orgId },
        });
        if (!res.ok) throw new Error(t("exportFailed"));
        const blob = await res.blob();
        downloadBlob(blob, "dubbl-export.zip");
      } else {
        const key = entities[0];
        const params = new URLSearchParams();
        if (EXPORT_ENTITIES.find(e => e.key === key)?.transactional) {
          if (exportDateFrom) params.set("startDate", exportDateFrom);
          if (exportDateTo) params.set("endDate", exportDateTo);
        }

        const res = await fetch(`/api/v1/export/${key}?${params}`, {
          headers: { "x-organization-id": orgId },
        });
        if (!res.ok) throw new Error(t("exportFailed"));
        const blob = await res.blob();
        downloadBlob(blob, `${key}.csv`);
      }
      toast.success(t("exportDownloaded"));
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const toggleExport = (key: string) => {
    setSelectedExports(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllExports = () => {
    setSelectedExports(new Set(EXPORT_ENTITIES.map(e => e.key)));
  };

  const hasTransactionalSelected = Array.from(selectedExports).some(
    k => EXPORT_ENTITIES.find(e => e.key === k)?.transactional
  );

  return (
    <ContentReveal>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("importExport")}</h2>
            <p className="text-sm text-muted-foreground">{t("migrateDataFromOtherBookkeepingToolsOrExportYourDubblData")}</p>
          </div>
        </div>

        {/* Import Section */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("importData")}</h3>
          </div>

          {/* Source selector */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm text-muted-foreground">{t("selectYourSourceSystem")}</p>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(s => (
                <Button
                  key={s.key}
                  variant={source === s.key ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSource(s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Entity grid */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ENTITIES.map(entity => {
              const Icon = entity.icon;
              return (
                <button
                  key={entity.key}
                  onClick={() => handleEntityClick(entity)}
                  className="group flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all hover:bg-muted hover:border-foreground/20"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted group-hover:bg-background transition-colors">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{entity.label}</p>
                    <p className="text-[11px] text-muted-foreground">{entity.note}</p>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Bank statement signpost */}
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed bg-muted/40 p-3.5">
            <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t.rich("bankStatementHelp", richTextTags)}
            </p>
          </div>

          {/* Import history */}
          {jobsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : <ImportJobHistory jobs={importJobs} />}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Export Section */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Download className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("exportData")}</h3>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("selectEntitiesToExportAsCSV")}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={selectAllExports}
              >
                {t("selectAll")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {EXPORT_ENTITIES.map(entity => (
                <Label
                  key={entity.key}
                  className="flex items-center gap-2.5 cursor-pointer text-sm font-normal"
                >
                  <Checkbox
                    checked={selectedExports.has(entity.key)}
                    onCheckedChange={() => toggleExport(entity.key)}
                  />
                  <span>{entity.label}</span>
                  {entity.transactional && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">{t("dateRange")}</Badge>
                  )}
                </Label>
              ))}
            </div>

            {/* Date range */}
            {hasTransactionalSelected && (
              <div className="flex items-end gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("from")}</Label>
                  <DatePicker
                    value={exportDateFrom}
                    onChange={setExportDateFrom}
                    placeholder={t("startDate")}
                    className="w-[180px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("to")}</Label>
                  <DatePicker
                    value={exportDateTo}
                    onChange={setExportDateTo}
                    placeholder={t("endDate")}
                    className="w-[180px]"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleExport()}
                disabled={exporting || selectedExports.size === 0}
              >
                <Download className="mr-1.5 size-3.5" />
                {exporting ? t("exporting") : t("exportSelected")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  selectAllExports();
                  handleExport("all");
                }}
                disabled={exporting}
              >
                {t("exportAllAsZIP")}
              </Button>
            </div>
          </div>
        </div>

        {/* Import Wizard */}
        {activeEntity && (
          <BulkImportWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            title={t("wizardTitle", { entity: activeEntity.label, source: SOURCES.find(s => s.key === source)?.label || source })}
            targetFields={activeEntity.targetFields}
            previewEndpoint={activeEntity.previewEndpoint}
            importEndpoint={activeEntity.importEndpoint}
            columnAliases={columnAliases}
            source={source}
            onComplete={fetchJobs}
          />
        )}
      </div>
    </ContentReveal>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
