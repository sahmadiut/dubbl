import { z } from "zod";
import { checkedMinor } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";

/**
 * Convert integer cents to decimal string for export.
 */
export function centsToDecimal(cents: number | bigint): string {
  if (typeof cents === "number" && !Number.isSafeInteger(cents)) throw new WireCompatibilityError();
  const raw = checkedMinor(BigInt(cents)), absolute = raw < 0n ? -raw : raw;
  return `${raw < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

/** Forward literal units to Excel; money/Minor fields remain text cells. */
export function spreadsheetCell(value: unknown, asText = false): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "bigint") return checkedMinor(value).toString();
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (asText && !Number.isSafeInteger(value)))) throw new WireCompatibilityError();
  if (!["string", "number", "boolean"].includes(typeof value)) throw new TypeError("Spreadsheet cells must be scalar values");
  return asText ? String(value) : value as string | number | boolean;
}

/**
 * Escape a CSV field value. Wraps in quotes if the value contains
 * commas, quotes, or newlines.
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new WireCompatibilityError();
  if (typeof value === "object" || typeof value === "function" || typeof value === "symbol") throw new TypeError("CSV cells must be scalar values");
  const str = typeof value === "bigint" ? checkedMinor(value).toString() : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Bounded CSV text parser used by the wizard and MCP; never coerces cell text. */
export function parseCSV(input: string) {
  const fail = (message: string): never => { throw new z.ZodError([{ code: "custom", path: ["csv"], message }]); };
  if (new TextEncoder().encode(input).length > 5000000) fail("Maximum CSV size is 5 MB");
  const records: string[][] = []; let row: string[] = [], value = "", quoted = false, closed = false;
  const field = () => { row.push(value.trim()); value = ""; closed = false; };
  const record = () => { field(); if (row.some(v => v !== "")) records.push(row); row = []; if (records.length > 1001) fail("Maximum 1000 CSV data rows"); };
  const csv = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"') { if (csv[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else value += ch;
    } else if (ch === ",") field();
    else if (ch === "\n" || ch === "\r") record();
    else if (ch === '"') { if (value || closed) fail("Malformed CSV quote"); quoted = true; }
    else { if (closed && ch.trim()) fail("Unexpected text after quoted field"); value += ch; }
  }
  if (quoted) fail("Unterminated CSV quote");
  if (value || row.length || closed) record();
  if (records.length < 2) fail("CSV requires a header and data row");
  const [headers, ...data] = records;
  if (headers.some(h => !h) || new Set(headers.map(h => h.toLowerCase())).size !== headers.length) fail("Empty or duplicate CSV headers");
  if (data.some(r => r.length !== headers.length)) fail("CSV column count does not match header");
  return { headers, rows: data.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i]]))) };
}

/**
 * Generate a CSV string from an array of row objects.
 */
export function generateCSV(
  rows: Record<string, unknown>[],
  columns: string[]
): string {
  const header = columns.map(escapeCSV).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCSV(row[col])).join(",")
  );
  return [header, ...lines].join("\n");
}
