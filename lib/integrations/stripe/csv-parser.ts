import { csvMinor, stripeCurrency, validateStripeObject } from "./money";
import { WireCompatibilityError } from "@/lib/money/wire";

export interface StripeCsvPayment {
  id: string;
  description: string;
  sellerMessage: string;
  createdUtc: string;
  amount: number; // in currency minor units
  fee: number; // in currency minor units
  net: number; // in currency minor units
  currency: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
}

export interface StripeCsvPayout {
  id: string;
  arrivalDate: string;
  amount: number; // in currency minor units
  currency: string;
  status: string;
  description: string;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  if (inQuotes) throw new WireCompatibilityError("Unclosed CSV quote");
  result.push(current);
  return result;
}

function date(value: string): string {
  if (value && !Number.isFinite(Date.parse(value))) throw new WireCompatibilityError("Invalid Stripe CSV date");
  return value;
}

export function parseStripePaymentsCsv(text: string): StripeCsvPayment[] {
  const rows = parseCsvRows(text);
  return rows
    .filter((r) => r["id"] && r["id"].startsWith("ch_"))
    .map((r) => {
      const currency = stripeCurrency(r["Currency"]);
      const result = {
      id: r["id"],
      description: r["Description"] || "",
      sellerMessage: r["Seller Message"] || "",
      createdUtc: date(r["Created (UTC)"] || r["Created date (UTC)"] || ""),
      amount: csvMinor(r["Amount"], r["Amount Minor"], currency),
      fee: csvMinor(r["Fee"] ?? (r["Fee Minor"] ? undefined : "0"), r["Fee Minor"], currency, true),
      net: csvMinor(r["Net"] ?? (r["Net Minor"] ? undefined : "0"), r["Net Minor"], currency, true),
      currency,
      status: r["Status"] || "",
      customerEmail: r["Customer Email"] || r["Customer email"] || null,
      customerName: r["Customer Name"] || r["Customer name"] || null,
      };
      if ("fee" in result && Number(result.fee) < 0) throw new WireCompatibilityError("Charge CSV fee must be nonnegative");
      validateStripeObject({ ...result, object: result.id.startsWith("po_") ? "payout" : "charge" });
      return result;
    });
}

export function parseStripePayoutsCsv(text: string): StripeCsvPayout[] {
  const rows = parseCsvRows(text);
  return rows
    .filter((r) => r["id"] && r["id"].startsWith("po_"))
    .map((r) => {
      const currency = stripeCurrency(r["Currency"]);
      const result = {
      id: r["id"],
      arrivalDate: date(r["Arrival Date"] || r["Arrival date"] || ""),
      amount: csvMinor(r["Amount"], r["Amount Minor"], currency),
      currency,
      status: r["Status"] || "",
      description: r["Description"] || "",
      };
      if ("fee" in result && Number(result.fee) < 0) throw new WireCompatibilityError("Charge CSV fee must be nonnegative");
      validateStripeObject({ ...result, object: result.id.startsWith("po_") ? "payout" : "charge" });
      return result;
    });
}
