"use client";

import { useState, useCallback, useRef, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Upload, CheckCircle2, XCircle, Loader2, FileUp, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { autoMapColumns, mapImportRows, csvFailureMessage, importRowError, ImportMappingError } from "@/i18n/import-presentation";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { parseCSV } from "@/lib/import-export/csv-utils";

interface ColumnMapping {
  csvColumn: string;
  targetField: string;
}

interface PreviewRow {
  row: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

interface BulkImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  targetFields: { key: string; label: string; matchLabel?: string; required?: boolean }[];
  previewEndpoint: string;
  importEndpoint: string;
  onComplete?: () => void;
  columnAliases?: Record<string, string[]>;
  source?: string;
}

const STEPS = ["upload", "mapping", "preview", "importing", "results"] as const;

function getStepIndex(step: typeof STEPS[number]) {
  return STEPS.indexOf(step);
}

export function BulkImportWizard({
  open,
  onOpenChange,
  title,
  targetFields,
  previewEndpoint,
  importEndpoint,
  onComplete,
  columnAliases,
  source,
}: BulkImportWizardProps) {
  const t = useTranslations("BulkImport");
  const [step, setStep] = useState<typeof STEPS[number]>("upload");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ processedRows: number; errorRows: number; errorDetails?: Array<{ row: number; error: string }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : "";

  const reset = useCallback(() => {
    setStep("upload");
    setCsvData([]);
    setCsvHeaders([]);
    setMappings([]);
    setPreview([]);
    setValidCount(0);
    setFileName("");
    setResult(null);
    setDragActive(false);
    setError(null);
  }, []);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      let parsed: ReturnType<typeof parseCSV>;
      try { parsed = parseCSV(text); }
      catch (err) { setError(csvFailureMessage(t, err)); return; }
      const { headers, rows } = parsed;
      setCsvHeaders(headers);
      setCsvData(rows);

      const autoMappings = autoMapColumns(headers, targetFields, columnAliases);
      setMappings(autoMappings);
      setStep("mapping");
    };
    reader.readAsText(file);
  }, [targetFields, columnAliases, t]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) processFile(file);
  }, [processFile]);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const mappedRows = mapImportRows(csvData, mappings);

    try {
      const targets = mappings.filter(m => m.targetField).map(m => m.targetField);
      if (new Set(targets).size !== targets.length) throw new ImportMappingError();
      const res = await fetch(previewEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ rows: mappedRows, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPreview(data.preview || []);
      setValidCount(data.validCount || 0);
      setStep("preview");
    } catch (err) {
      setError(err instanceof ImportMappingError ? t("mapEachTargetFieldOnlyOnce") : t("previewFailed"));
    } finally {
      setLoading(false);
    }
  }, [csvData, mappings, previewEndpoint, orgId, source, t]);

  const handleImport = useCallback(async () => {
    setStep("importing");
    setError(null);
    const mappedRows = mapImportRows(csvData, mappings);

    try {
      const targets = mappings.filter(m => m.targetField).map(m => m.targetField);
      if (new Set(targets).size !== targets.length) throw new ImportMappingError();
      const res = await fetch(importEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ fileName, rows: mappedRows, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setResult({
        processedRows: data.job?.processedRows || 0,
        errorRows: data.job?.errorRows || 0,
        errorDetails: data.job?.errorDetails,
      });
      setStep("results");
      onComplete?.();
    } catch (err) {
      setError(err instanceof ImportMappingError ? t("mapEachTargetFieldOnlyOnce") : t("importFailed"));
      setStep("preview");
    }
  }, [csvData, mappings, importEndpoint, orgId, fileName, onComplete, source, t]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <BulkImportWizardContent {...{ title, step, csvData, csvHeaders, mappings, preview, validCount, fileName, result, loading, error, dragActive, fileInputRef, targetFields, setDragActive, setMappings, reset, handleDrop, handleFileUpload, handlePreview, handleImport, setStep, onOpenChange }} />
      </SheetContent>
    </Sheet>
  );
}

interface WizardContentProps {
  title: string;
  step: typeof STEPS[number];
  csvData: Record<string, string>[];
  csvHeaders: string[];
  mappings: ColumnMapping[];
  preview: PreviewRow[];
  validCount: number;
  fileName: string;
  result: { processedRows: number; errorRows: number; errorDetails?: Array<{ row: number; error: string }> } | null;
  loading: boolean;
  error: string | null;
  dragActive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  targetFields: BulkImportWizardProps["targetFields"];
  setDragActive: (value: boolean) => void;
  setMappings: (value: ColumnMapping[]) => void;
  reset: () => void;
  handleDrop: (event: React.DragEvent) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handlePreview: () => void;
  handleImport: () => void;
  setStep: (step: typeof STEPS[number]) => void;
  onOpenChange: (open: boolean) => void;
}

/** The same state view used by the live wizard; Sheet supplies its dialog context. */
export function BulkImportWizardContent({ title, step, csvData, csvHeaders, mappings, preview, validCount, fileName, result, loading, error, dragActive, fileInputRef, targetFields, setDragActive, setMappings, reset, handleDrop, handleFileUpload, handlePreview, handleImport, setStep, onOpenChange }: WizardContentProps) {
  const t = useTranslations("BulkImport");
  const stepIndex = getStepIndex(step);
  const mappedCount = mappings.filter(m => m.targetField).length;
  const requiredFields = targetFields.filter(f => f.required);
  const mappedRequired = requiredFields.filter(f =>
    mappings.some(m => m.targetField === f.key)
  );
  const allRequiredMapped = mappedRequired.length === requiredFields.length;

  return (
    <>
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Upload className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-lg"><BidiText>{title}</BidiText></SheetTitle>
              <SheetDescription>
                {step === "upload" && t("uploadACSVFileToGetStarted")}
                {step === "mapping" && t.rich("mapFile", { fileName, code: chunks => <BidiText>{chunks}</BidiText> })}
                {step === "preview" && t("reviewDataBeforeImporting")}
                {step === "importing" && t("importInProgress")}
                {step === "results" && t("importComplete")}
              </SheetDescription>
            </div>
          </div>

          {/* Step indicator */}
          {step !== "importing" && (
            <div className="flex flex-wrap items-center gap-1.5">
              {([t("upload"), t("map"), t("preview"), t("import")] as const).map((label, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <div className={`flex size-5 items-center justify-center rounded-full text-[10px] font-medium transition-colors ${
                    i <= stepIndex
                      ? "bg-emerald-600 text-white dark:bg-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs ${i <= stepIndex ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                  {i < 3 && <ArrowRight className="rtl:rotate-180 size-3 text-muted-foreground mx-0.5" />}
                </div>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error && <p role="alert" className="text-sm text-destructive mb-4">{error}</p>}
          {/* Upload step */}
          {step === "upload" && (
            <div
              className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-4 sm:p-10 transition-colors cursor-pointer ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-border hover:border-emerald-500/40 hover:bg-muted/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              role="button" tabIndex={0} aria-label={t("orClickToBrowse")}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInputRef.current?.click(); } }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                <FileUp className="size-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{t("dropYourCSVFileHere")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("orClickToBrowse")}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Mapping step */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t("columnsMapped", { count: mappedCount, total: csvHeaders.length })}
                </p>
                {!allRequiredMapped && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">{t("requiredFieldsMissing")}</Badge>
                )}
              </div>

              <div className="space-y-1.5 rounded-lg border p-3">
                {csvHeaders.map((header, i) => (
                  <div key={header} className="flex flex-wrap items-center gap-2">
                    <span className="w-32 text-xs truncate text-muted-foreground" title={header}>
                      <BidiText>{header}</BidiText>
                    </span>
                    <ArrowRight className="rtl:rotate-180 size-3 text-muted-foreground shrink-0" />
                    <Select
                      value={mappings[i]?.targetField || "__skip__"}
                      onValueChange={(v) => {
                        const next = [...mappings];
                        next[i] = { csvColumn: header, targetField: v === "__skip__" ? "" : v };
                        setMappings(next);
                      }}
                    >
                      <SelectTrigger aria-label={header} className="h-auto min-h-8 min-w-0 text-xs flex-1">
                        <SelectValue placeholder={t("skip")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">{t("skip")}</SelectItem>
                        {targetFields.map(f => (
                          <SelectItem key={f.key} value={f.key}>
                            <BidiText>{f.label}</BidiText>{f.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview step */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1">
                  <CheckCircle2 className="size-3" />
                  {t("validCount", { count: validCount })}
                </Badge>
                {preview.length - validCount > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <XCircle className="size-3" />
                    {t("invalidCount", { count: preview.length - validCount })}
                  </Badge>
                )}
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-lg border">
                <Table className="min-w-[28rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">{t("row")}</TableHead>
                      <TableHead className="w-12 text-xs" />
                      <TableHead className="text-xs">{t("data")}</TableHead>
                      <TableHead className="text-xs">{t("errors")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 50).map(p => (
                      <TableRow key={p.row}>
                        <TableCell className="text-xs tabular-nums">{p.row}</TableCell>
                        <TableCell>
                          {p.valid
                            ? <CheckCircle2 className="size-3.5 text-emerald-500" />
                            : <XCircle className="size-3.5 text-destructive" />
                          }
                        </TableCell>
                        <TableCell className="text-[11px] max-w-[200px] truncate text-muted-foreground">
                          <IdentifierText>{JSON.stringify(p.data).slice(0, 80)}</IdentifierText>
                        </TableCell>
                        <TableCell className="text-[11px] text-destructive">{p.errors.map(error => importRowError(t, error)).join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Importing step */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("importingRows", { count: csvData.length })}</p>
            </div>
          )}

          {/* Results step */}
          {step === "results" && result && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-6 rounded-lg border p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600 tabular-nums">{result.processedRows}</p>
                  <p className="text-[11px] text-muted-foreground">{t("imported")}</p>
                </div>
                {result.errorRows > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-destructive tabular-nums">{result.errorRows}</p>
                    <p className="text-[11px] text-muted-foreground">{t("errors")}</p>
                  </div>
                )}
              </div>

              {result.errorDetails && result.errorDetails.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border p-3 space-y-1">
                  {result.errorDetails.map((e, i) => (
                    <p key={i} className="text-[11px] text-destructive">
                      {t("rowError", { row: e.row, error: importRowError(t, e.error) })}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "importing" && (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
            <div>
              {step === "mapping" && (
                <Button variant="ghost" size="sm" onClick={reset}>{t("changeFile")}</Button>
              )}
              {step === "preview" && (
                <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>{t("back")}</Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>
                {step === "results" ? t("close") : t("cancel")}
              </Button>
              {step === "mapping" && (
                <Button
                  size="sm"
                  disabled={loading || !allRequiredMapped}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handlePreview}
                >
                  {loading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  {t("preview")}
                </Button>
              )}
              {step === "preview" && (
                <Button
                  size="sm"
                  disabled={validCount === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleImport}
                >
                  {t("importRows", { count: validCount })}
                </Button>
              )}
              {step === "results" && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { reset(); onOpenChange(false); }}
                >
                  {t("done")}
                </Button>
              )}
            </div>
          </div>
        )}
    </>
  );
}
