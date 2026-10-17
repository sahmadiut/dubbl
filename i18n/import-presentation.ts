import type { useTranslations } from "next-intl";
import { ZodError } from "zod";
type Translate = ReturnType<typeof useTranslations<"BulkImport">>;
export interface ImportField { key: string; label: string; matchLabel?: string; required?: boolean }
export interface ColumnMapping { csvColumn: string; targetField: string }
export class ImportMappingError extends Error {}

/** Match canonical English labels and provider aliases independently of display locale. */
export function autoMapColumns(headers: string[], fields: ImportField[], aliases?: Record<string, string[]>): ColumnMapping[] {
  return headers.map(header => {
    const normalized = header.toLowerCase();
    const match = fields.find(f => f.key.toLowerCase() === normalized || (f.matchLabel ?? f.label).toLowerCase() === normalized)
      ?? fields.find(f => aliases?.[f.key]?.some(alias => alias.toLowerCase() === normalized));
    return { csvColumn: header, targetField: match?.key || "" };
  });
}
export function mapImportRows(rows: Record<string, string>[], mappings: ColumnMapping[]): Record<string, unknown>[] {
  return rows.map(row => Object.fromEntries(mappings.filter(m => m.targetField && m.csvColumn).map(m => [m.targetField, row[m.csvColumn]])));
}
const csvErrors = {
  "Maximum CSV size is 5 MB": "maximumCSVSizeIs5MB",
  "Maximum 1000 CSV data rows": "maximum1000CSVDataRows",
  "Malformed CSV quote": "malformedCSVQuote",
  "Unexpected text after quoted field": "unexpectedTextAfterQuotedField",
  "Unterminated CSV quote": "unterminatedCSVQuote",
  "CSV requires a header and data row": "cSVRequiresAHeaderAndDataRow",
  "Empty or duplicate CSV headers": "emptyOrDuplicateCSVHeaders",
  "CSV column count does not match header": "cSVColumnCountDoesNotMatchHeader",
} as const;
function approvedCsvError(t: Translate, message: unknown): string | undefined {
  if (typeof message !== "string") return;
  const key = Object.keys(csvErrors).find(key => key === message) as keyof typeof csvErrors | undefined;
  return key ? t(csvErrors[key]) : undefined;
}
export function csvFailureMessage(t: Translate, error: unknown): string {
  return (error instanceof ZodError && error.issues.length === 1 ? approvedCsvError(t, error.issues[0].message) : undefined) ?? t("invalidCSV");
}
/** Server diagnostics are data, never translation keys; unknown prose uses a reviewed fallback. */
export function importRowError(t: Translate, message: unknown): string {
  return approvedCsvError(t, message) ?? t("invalidRowCheckTheMappedValues");
}
