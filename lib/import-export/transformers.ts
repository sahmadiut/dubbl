import type { SourceSystem } from "./types";
import { z } from "zod";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";

/**
 * Parse a money string to integer cents.
 * Handles "1,234.56", "1234.56", "1.234,56" (European), negative with - or ()
 */
export function parseMoney(value: string | number): number {
  // Decimal Numbers beyond this bound can lose hundredths during JSON decoding.
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 2 ** 45 - 1)) {
    throw new WireCompatibilityError("Large decimal import amounts must use text or Minor aliases");
  }
  let cleaned = String(value).trim();
  if (cleaned === "") return 0;
  const parentheses = cleaned.startsWith("(") && cleaned.endsWith(")");
  if (parentheses) cleaned = cleaned.slice(1, -1);
  cleaned = cleaned.replace(/^[$€£¥]\s*/, "");
  const negative = parentheses || cleaned.startsWith("-");
  if (!parentheses && negative) cleaned = cleaned.slice(1);
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replaceAll(".", "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(cleaned)) cleaned = cleaned.replaceAll(",", "");
  if (cleaned.length > 40 || !/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Expected decimal money with at most two fractional digits and valid grouping" }]);
  }
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) * (negative ? -1n : 1n);
  if (minor < BigInt(Number.MIN_SAFE_INTEGER) || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new WireCompatibilityError();
  return legacyMinor(minor);
}

/**
 * Normalize date strings to YYYY-MM-DD format.
 */
export function parseDate(value: string, _source: SourceSystem): string {
  void _source; // Existing date conventions are shared across source systems.
  if (!value || value.trim() === "") return "";
  const trimmed = value.trim();

  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // MM/DD/YYYY or M/D/YYYY (common in QuickBooks, Wave)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  }

  // DD/MM/YYYY (common in Xero, FreshBooks outside US)
  const euMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (euMatch) {
    return `${euMatch[3]}-${euMatch[2].padStart(2, "0")}-${euMatch[1].padStart(2, "0")}`;
  }

  // DD MMM YYYY or DD-MMM-YYYY (e.g. "15 Jan 2024")
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const namedMatch = trimmed.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})$/);
  if (namedMatch) {
    const month = monthNames[namedMatch[2].toLowerCase()];
    if (month) return `${namedMatch[3]}-${month}-${namedMatch[1].padStart(2, "0")}`;
  }

  // Fallback: try JS Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return trimmed;
}

const QB_ACCOUNT_TYPE_MAP: Record<string, string> = {
  "bank": "asset",
  "other current asset": "asset",
  "fixed asset": "asset",
  "other asset": "asset",
  "accounts receivable": "asset",
  "accounts payable": "liability",
  "credit card": "liability",
  "other current liability": "liability",
  "long term liability": "liability",
  "equity": "equity",
  "income": "revenue",
  "other income": "revenue",
  "cost of goods sold": "expense",
  "expense": "expense",
  "other expense": "expense",
};

const XERO_ACCOUNT_TYPE_MAP: Record<string, string> = {
  "bank": "asset",
  "current": "asset",
  "currliab": "liability",
  "depreciatn": "expense",
  "directcosts": "expense",
  "equity": "equity",
  "expense": "expense",
  "fixed": "asset",
  "inventory": "asset",
  "liability": "liability",
  "noncurrent": "asset",
  "otherincome": "revenue",
  "overheads": "expense",
  "prepayment": "asset",
  "revenue": "revenue",
  "sales": "revenue",
  "termliab": "liability",
  "paygliability": "liability",
  "superannuationexpense": "expense",
  "superannuationliability": "liability",
  "wagesexpense": "expense",
};

/**
 * Normalize account type strings from various sources to Dubbl types.
 */
export function normalizeAccountType(value: string, source: SourceSystem): string {
  const lower = value.toLowerCase().trim();
  if (["asset", "liability", "equity", "revenue", "expense"].includes(lower)) {
    return lower;
  }

  if (source === "quickbooks") {
    return QB_ACCOUNT_TYPE_MAP[lower] || lower;
  }
  if (source === "xero") {
    return XERO_ACCOUNT_TYPE_MAP[lower] || lower;
  }

  // FreshBooks and Wave use similar naming to QuickBooks
  return QB_ACCOUNT_TYPE_MAP[lower] || lower;
}

/**
 * Normalize contact type to Dubbl enum.
 */
export function normalizeContactType(value: string): string {
  const lower = value.toLowerCase().trim();
  if (lower === "vendor" || lower === "supplier") return "supplier";
  if (lower === "both" || lower === "customer & vendor") return "both";
  return lower || "customer";
}
