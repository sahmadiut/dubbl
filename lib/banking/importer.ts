import { createHash } from "crypto";
import { z } from "zod";
import type { bankImportFormatEnum } from "@/lib/db/schema";
import { legacyMinor } from "@/lib/money/wire";
import { importMajor, importExactMajor, importAmount, importMoneyDto, invalidImport, type ImportProfile } from "@/lib/api/bank-import-wire";

export type BankImportFormat = typeof bankImportFormatEnum.enumValues[number];

export interface CsvColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  amountExact?: string;
  amountMinor?: string;
  balanceMinor?: string;
  debit?: string;
  credit?: string;
  balance?: string;
  reference?: string;
  payee?: string;
  counterparty?: string;
}

export interface ImportPreviewRequest {
  fileName?: string | null;
  content: string;
  format?: BankImportFormat | null;
  mapping?: CsvColumnMapping;
}

export interface NormalizedTransaction {
  date: string;
  postedDate?: string | null;
  description: string;
  amount: number;
  balance?: number | null;
  reference?: string | null;
  payee?: string | null;
  counterparty?: string | null;
  currencyCode?: string | null;
  externalTransactionId?: string | null;
  statementLineRef?: string | null;
  pending?: boolean;
  raw: Record<string, unknown>;
}

export interface ParsedStatement {
  format: BankImportFormat;
  accountIdentifier?: string | null;
  currencyCode?: string | null;
  statementStartDate?: string | null;
  statementEndDate?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  warnings: string[];
  metadata: Record<string, unknown>;
  transactions: NormalizedTransaction[];
}

export interface ImportPreviewResult {
  format: BankImportFormat;
  accountIdentifier: string | null;
  currencyCode: string | null;
  statementStartDate: string | null;
  statementEndDate: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  warnings: string[];
  metadata: Record<string, unknown>;
  rowCount: number;
  transactions: NormalizedTransaction[];
  duplicates: Array<{ dedupeHash: string; description: string; amount: number; date: string }>;
}

export interface CommitImportResult extends ImportPreviewResult {
  imported: number;
  duplicateCount: number;
  importId: string;
}

export function makeTransactionDedupeHash(
  bankAccountId: string,
  transaction: NormalizedTransaction
): string {
  return createHash("sha256")
    .update(
      [
        bankAccountId,
        transaction.externalTransactionId || "",
        transaction.statementLineRef || "",
        transaction.date,
        transaction.amount,
        normalizeText(transaction.description),
        normalizeText(transaction.reference || ""),
      ].join("|")
    )
    .digest("hex");
}

export function parseBankStatement(request: ImportPreviewRequest, currency = "USD", profile?: ImportProfile): ParsedStatement {
  const content = request.content.replace(/^\uFEFF/, "").trim();
  if (!content) {
    invalidImport("Statement content is required");
  }

  const format = detectStatementFormat(request.fileName, content, request.format);
  let result: ParsedStatement;
  switch (format) {
    case "csv":
      result = parseDelimitedStatement(content, profile?.csvDelimiter || ",", format, request.mapping, currency, profile); break;
    case "tsv":
      result = parseDelimitedStatement(content, profile?.csvDelimiter || "\t", format, request.mapping, currency, profile); break;
    case "qif":
      result = parseQifStatement(content, currency); break;
    case "ofx":
    case "qfx":
    case "qbo":
      result = parseOfxStatement(content, format, currency); break;
    case "camt052":
    case "camt053":
    case "camt054":
      result = parseCamtStatement(content, format, currency); break;
    case "mt940":
    case "mt942":
      result = parseMtStatement(content, format, currency); break;
    case "bai2":
      result = parseBai2Statement(content, currency); break;
    default:
      invalidImport("Unsupported bank statement format");
  }
  if (result.currencyCode && result.currencyCode !== currency) invalidImport("Statement currency disagrees with bank account");
  result.currencyCode = currency;
  for (const row of result.transactions) {
    if (row.currencyCode && row.currencyCode !== currency) invalidImport("Transaction currency disagrees with bank account");
    row.currencyCode = currency;
    z.iso.date().parse(row.date);
    if (row.postedDate) z.iso.date().parse(row.postedDate);
    importMoneyDto(row, ["amount", "balance"]);
  }
  for (const field of ["statementStartDate", "statementEndDate"] as const) if (result[field]) result[field] = z.iso.date().parse(normalizeDate(result[field]));
  importMoneyDto(result, ["openingBalance", "closingBalance"]);
  return result;

}

export function detectStatementFormat(
  fileName: string | null | undefined,
  content: string,
  explicitFormat?: BankImportFormat | null
): BankImportFormat {
  if (explicitFormat) return explicitFormat;

  const extension = (fileName?.split(".").pop() || "").toLowerCase();
  const extensionMap: Partial<Record<string, BankImportFormat>> = {
    csv: "csv",
    tsv: "tsv",
    txt: "mt940",
    qif: "qif",
    ofx: "ofx",
    qfx: "qfx",
    qbo: "qbo",
    xml: detectXmlStatementFormat(content),
    bai: "bai2",
    bai2: "bai2",
  };

  if (extension && extensionMap[extension]) {
    return extensionMap[extension]!;
  }

  if (content.startsWith("OFXHEADER:") || /<OFX>/i.test(content)) {
    return "ofx";
  }
  if (/^!Type:/im.test(content)) {
    return "qif";
  }
  if (/^01,/.test(content) || /^02,/.test(content)) {
    return "bai2";
  }
  if (/<Document[\s>]/i.test(content)) {
    return detectXmlStatementFormat(content);
  }
  if (/^:20:/m.test(content) && /^:61:/m.test(content)) {
    return content.includes(":13D:") ? "mt942" : "mt940";
  }
  if (content.includes("\t")) {
    return "tsv";
  }
  return "csv";
}

function detectXmlStatementFormat(content: string): BankImportFormat {
  if (/<BkToCstmrAcctRpt/i.test(content)) return "camt052";
  if (/<BkToCstmrStmt/i.test(content)) return "camt053";
  if (/<BkToCstmrDbtCdtNtfctn/i.test(content)) return "camt054";
  if (/<OFX>/i.test(content)) return "ofx";
  return "camt053";
}

function parseDelimitedStatement(
  content: string,
  delimiter: string,
  format: BankImportFormat,
  mapping?: CsvColumnMapping,
  currency = "USD", profile?: ImportProfile
): ParsedStatement {
  const parseLocalizedAmount = (value: string | null | undefined) => importMajor(value || "0", currency, profile);
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    invalidImport("Statement must contain a header row and at least one data row");
  }

  const header = parseDelimitedLine(lines[0], delimiter).map((cell) =>
    normalizeHeader(cell)
  );
  const rows = lines.slice(1).map((line) => parseDelimitedLine(line, delimiter));
  const warnings: string[] = [];

  const dateIdx = findColumnIndex(header, mapping?.date, [
    "date",
    "transaction date",
    "trans date",
    "posting date",
    "posted date",
    "book date",
  ]);
  const descIdx = findColumnIndex(header, mapping?.description, [
    "description",
    "memo",
    "details",
    "narrative",
    "particulars",
    "transaction description",
  ]);
  const exactIdx = findColumnIndex(header, mapping?.amountExact, ["amount exact"]);
  const minorIdx = findColumnIndex(header, mapping?.amountMinor, ["amount minor"]);
  const balanceMinorIdx = findColumnIndex(header, mapping?.balanceMinor, ["balance minor"]);
  const amountIdx = findColumnIndex(header, mapping?.amount, ["amount", "value", "sum"]);
  const debitIdx = findColumnIndex(header, mapping?.debit, ["debit", "withdrawal", "withdrawals"]);
  const creditIdx = findColumnIndex(header, mapping?.credit, ["credit", "deposit", "deposits"]);
  const balanceIdx = findColumnIndex(header, mapping?.balance, ["balance", "running balance"]);
  const referenceIdx = findColumnIndex(header, mapping?.reference, [
    "reference",
    "ref",
    "transaction id",
    "fitid",
    "check number",
    "cheque number",
  ]);
  const payeeIdx = findColumnIndex(header, mapping?.payee, ["payee", "merchant", "name"]);
  const currencyIdx = findColumnIndex(header, undefined, ["currency", "currency code"]);
  const counterpartyIdx = findColumnIndex(header, mapping?.counterparty, ["counterparty", "beneficiary"]);

  if (dateIdx === -1) {
    invalidImport("Could not find a date column in the statement header");
  }

  if (amountIdx === -1 && exactIdx === -1 && minorIdx === -1 && debitIdx === -1 && creditIdx === -1) {
    invalidImport("Could not find an amount, debit, or credit column");
  }

  const transactions: NormalizedTransaction[] = [];
  for (const row of rows) {
    if (row.every((cell) => !cell.trim())) continue;
    if (row.length !== header.length) invalidImport("CSV row width differs from header; quote grouped amounts");
    const rawDate = row[dateIdx]?.trim();
    if (!rawDate) invalidImport("Statement row is missing a date");

    const description =
      row[descIdx]?.trim() ||
      row[payeeIdx]?.trim() ||
      row[counterpartyIdx]?.trim() ||
      "Imported transaction";

    let amount = 0;
    if (amountIdx !== -1 || exactIdx !== -1 || minorIdx !== -1) {
      const major = amountIdx === -1 ? undefined : row[amountIdx];
      const exactMajor = exactIdx === -1 ? undefined : row[exactIdx];
      const exactAmount = exactMajor === undefined ? undefined : importExactMajor(exactMajor, currency);
      amount = importAmount(major, minorIdx === -1 ? exactAmount === undefined ? undefined : String(exactAmount) : row[minorIdx], currency, profile);
      if (exactAmount !== undefined && amount !== exactAmount) invalidImport("amountExact disagrees with amount");
    } else {
      const debit = debitIdx !== -1 ? Math.abs(parseLocalizedAmount(row[debitIdx])) : 0;
      const credit = creditIdx !== -1 ? Math.abs(parseLocalizedAmount(row[creditIdx])) : 0;
      amount = legacyMinor((BigInt(credit) - BigInt(debit)) * (profile?.debitIsNegative === false ? -1n : 1n));
    }

    if (!description && amount === 0) continue;

    transactions.push({
      date: profile?.dateFormat ? profile.dateFormat === "YYYY-MM-DD" ? z.iso.date().parse(rawDate) : normalizeProfileDate(rawDate, profile.dateFormat) : normalizeDate(rawDate),
      description,
      amount,
      balance: (balanceIdx === -1 || !row[balanceIdx]) && (balanceMinorIdx === -1 || !row[balanceMinorIdx]) ? null : importAmount(balanceIdx === -1 || !row[balanceIdx] ? undefined : row[balanceIdx], balanceMinorIdx === -1 || !row[balanceMinorIdx] ? undefined : row[balanceMinorIdx], currency, profile),
      reference: referenceIdx !== -1 ? emptyToNull(row[referenceIdx]) : null,
      payee: payeeIdx !== -1 ? emptyToNull(row[payeeIdx]) : null,
      counterparty: counterpartyIdx !== -1 ? emptyToNull(row[counterpartyIdx]) : null,
      currencyCode: currencyIdx === -1 ? currency : row[currencyIdx],
      raw: { row },
    });
  }

  if (transactions.length === 0) {
    warnings.push("No statement lines were parsed from the delimited file.");
  }

  return {
    format,
    warnings,
    metadata: { header },
    transactions,
  };
}

function parseQifStatement(content: string, currency: string): ParsedStatement {
  const lines = content.split(/\r?\n/);
  const warnings: string[] = [];
  const transactions: NormalizedTransaction[] = [];
  let current: Record<string, string[]> = {};

  for (const line of lines) {
    if (!line) invalidImport("Malformed MT transaction line");
    if (line === "^") {
      const tx = qifRecordToTransaction(current, currency);
      if (tx) transactions.push(tx);
      current = {};
      continue;
    }
    if (line.startsWith("!")) continue;
    const key = line[0];
    const value = line.slice(1).trim();
    current[key] = current[key] || [];
    current[key].push(value);
  }

  if (Object.keys(current).length > 0) {
    const tx = qifRecordToTransaction(current, currency);
    if (tx) transactions.push(tx);
  }

  if (transactions.length === 0) {
    warnings.push("No transactions were found in the QIF file.");
  }

  return {
    format: "qif",
    warnings,
    metadata: {},
    transactions,
  };
}

function qifRecordToTransaction(record: Record<string, string[]>, currency: string): NormalizedTransaction | null {
  const date = normalizeDate(record.D?.[0] || "");
  const amount = importMajor(record.T?.[0] || "", currency);
  const payee = record.P?.[0] || null;
  const memo = record.M?.join(" ").trim() || null;
  const description = [payee, memo].filter(Boolean).join(" - ") || "QIF transaction";
  if (!date || (!amount && !description)) return null;
  return {
    date,
    description,
    amount,
    reference: record.N?.[0] || null,
    payee,
    raw: record,
  };
}

function parseOfxStatement(content: string, format: BankImportFormat, currency: string): ParsedStatement {
  const warnings: string[] = [];
  const segments = splitOfxSegments(content, "STMTTRN");
  if ((content.match(/<ACCTID>/gi) || []).length > 1) invalidImport("Import one OFX account at a time");
  const accountIdentifier = readOfxField(content, "ACCTID");
  const currencyCode = readOfxField(content, "CURDEF");
  if (currencyCode && currencyCode !== currency) invalidImport("Statement currency disagrees with bank account");
  const statementStartDate = normalizeDate(readOfxField(content, "DTSTART"));
  const statementEndDate = normalizeDate(readOfxField(content, "DTEND"));
  const openingBalance = null;
  const closingBalance = parseOptionalAmount(readOfxField(content, "BALAMT"), currency);

  const transactions = segments.map((segment) => {
    const name = readOfxField(segment, "NAME");
    const memo = readOfxField(segment, "MEMO");
    const description = [name, memo].filter(Boolean).join(" - ") || "OFX transaction";
    return {
      date: normalizeDate(readOfxField(segment, "DTPOSTED") || readOfxField(segment, "DTUSER")),
      postedDate: normalizeDate(readOfxField(segment, "DTUSER") || readOfxField(segment, "DTPOSTED")),
      description,
      amount: importMajor(readOfxField(segment, "TRNAMT"), currency),
      reference: emptyToNull(readOfxField(segment, "CHECKNUM") || readOfxField(segment, "REFNUM")),
      payee: emptyToNull(name),
      externalTransactionId: emptyToNull(readOfxField(segment, "FITID")),
      statementLineRef: emptyToNull(readOfxField(segment, "SIC") || readOfxField(segment, "REFNUM")),
      currencyCode: emptyToNull(currencyCode),
      raw: {
        trnType: readOfxField(segment, "TRNTYPE"),
        memo,
      },
    } satisfies NormalizedTransaction;
  });

  if (transactions.length === 0) {
    warnings.push("No transaction entries were found in the OFX/QFX/QBO file.");
  }

  return {
    format,
    accountIdentifier: emptyToNull(accountIdentifier),
    currencyCode: emptyToNull(currencyCode),
    statementStartDate: emptyToNull(statementStartDate),
    statementEndDate: emptyToNull(statementEndDate),
    openingBalance,
    closingBalance,
    warnings,
    metadata: {},
    transactions,
  };
}

function parseCamtStatement(content: string, format: BankImportFormat, currency: string): ParsedStatement {
  const warnings: string[] = [];
  if (["Stmt", "Rpt", "Ntfctn"].some(tag => matchXmlBlocks(content, tag).length > 1)) invalidImport("Import one CAMT statement at a time");
  const entryBlocks = matchXmlBlocks(content, "Ntry");
  const transactions = entryBlocks.map((entry) => {
    const amount = importMajor(readXmlField(entry, "Amt"), readXmlAttribute(entry, "Amt", "Ccy") || currency);
    const creditDebit = readXmlField(entry, "CdtDbtInd");
    if (!["DBIT", "CRDT"].includes(creditDebit)) invalidImport("Unknown CAMT credit/debit indicator");
    const sign = creditDebit === "DBIT" ? -1 : 1;
    const bookingDate =
      normalizeDate(readXmlField(entry, "BookgDt") || readXmlField(entry, "ValDt"));
    const remittance = joinXmlFields(entry, ["Ustrd", "AddtlNtryInf", "AddtlTxInf"]);
    const payee =
      readXmlField(entry, "Nm", 1) ||
      readXmlField(entry, "RltdPties");
    const reference =
      readXmlField(entry, "AcctSvcrRef") ||
      readXmlField(entry, "NtryRef") ||
      readXmlField(entry, "TxId");
    const counterparty =
      readXmlField(entry, "Cdtr") ||
      readXmlField(entry, "Dbtr");
    return {
      date: bookingDate,
      postedDate: bookingDate,
      description: remittance || payee || counterparty || "CAMT transaction",
      amount: sign * Math.abs(amount),
      reference: emptyToNull(reference),
      payee: emptyToNull(payee),
      counterparty: emptyToNull(counterparty),
      currencyCode: emptyToNull(readXmlAttribute(entry, "Amt", "Ccy")),
      statementLineRef: emptyToNull(readXmlField(entry, "NtryRef")),
      raw: {
        additionalInfo: readXmlField(entry, "AddtlNtryInf"),
      },
    } satisfies NormalizedTransaction;
  });

  const balances = matchXmlBlocks(content, "Bal");
  const openingBalance = findCamtBalance(balances, ["OPBD", "PRCD"], currency);
  const closingBalance = findCamtBalance(balances, ["CLBD", "ITBD"], currency);

  if (transactions.length === 0) {
    warnings.push("No transaction entries were found in the CAMT file.");
  }

  return {
    format,
    accountIdentifier:
      emptyToNull(readXmlField(content, "IBAN")) ||
      emptyToNull(readXmlField(content, "Othr")) ||
      null,
    currencyCode:
      emptyToNull(readXmlField(content, "Ccy")) ||
      null,
    statementStartDate: emptyToNull(readXmlField(content, "FrDtTm") || readXmlField(content, "FrDt")),
    statementEndDate: emptyToNull(readXmlField(content, "ToDtTm") || readXmlField(content, "ToDt")),
    openingBalance,
    closingBalance,
    warnings,
    metadata: {},
    transactions,
  };
}

function parseMtStatement(content: string, format: BankImportFormat, currency: string): ParsedStatement {
  const warnings: string[] = [];
  const tags = parseSwiftTags(content);
  if (tags.filter(tag => tag.code === "25").length > 1) invalidImport("Import one MT account at a time");
  const transactions: NormalizedTransaction[] = [];
  const refs86 = tags.filter((tag) => tag.code === "86");
  let ref86Index = 0;

  for (const tag of tags) {
    if (tag.code !== "61") continue;
    const line = parseMt61Line(tag.value, currency);
    const memo = refs86[ref86Index]?.value || "";
    ref86Index += 1;
    if (!line) invalidImport("Malformed MT transaction line");
    transactions.push({
      date: line.date,
      description: memo || line.description || "SWIFT statement line",
      amount: line.amount,
      reference: line.reference,
      statementLineRef: line.reference,
      raw: { line61: tag.value, line86: memo },
    });
  }

  if (transactions.length === 0) {
    warnings.push("No :61: transaction lines were found in the MT statement.");
  }

  return {
    format,
    accountIdentifier: emptyToNull(tags.find((tag) => tag.code === "25")?.value),
    statementStartDate: emptyToNull(parseMtBalanceDate(tags.find((tag) => tag.code === "60F" || tag.code === "60M")?.value)),
    statementEndDate: emptyToNull(parseMtBalanceDate(tags.find((tag) => tag.code === "62F" || tag.code === "62M")?.value)),
    currencyCode: tags.find(tag => tag.code === "60F" || tag.code === "60M")?.value.match(/^[DC]\d{6}([A-Z]{3})/)?.[1] || null,
    openingBalance: parseMtBalanceAmount(tags.find((tag) => tag.code === "60F" || tag.code === "60M")?.value, currency),
    closingBalance: parseMtBalanceAmount(tags.find((tag) => tag.code === "62F" || tag.code === "62M")?.value, currency),
    warnings,
    metadata: {},
    transactions,
  };
}

function parseBai2Statement(content: string, currency: string): ParsedStatement {
  const warnings: string[] = [];
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const transactions: NormalizedTransaction[] = [];
  let currentAccount: string | null = null;
  let currentDate: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.endsWith("/") ? rawLine.slice(0, -1) : rawLine;
    const parts = line.split(",");
    const recordType = parts[0];

    if (recordType === "02") {
      currentDate = normalizeDate(parts[4] || parts[3] || "");
    }

    if (recordType === "03") {
      if (currentAccount && currentAccount !== parts[1]) invalidImport("Import one BAI2 account at a time");
      currentAccount = parts[1] || null;
      if (parts[2] && parts[2] !== currency) invalidImport("BAI2 currency disagrees with bank account");
    }

    if (recordType === "16") {
      const typeCode = parts[1] || "";
      const amount = parseBai2Amount(parts[2], typeCode);
      const reference = parts[4] || parts[5] || "";
      const description = parts.slice(6).join(" ").replace(/\/$/, "").trim() || `BAI2 ${typeCode}`;
      transactions.push({
        date: currentDate || invalidImport("BAI2 requires a statement date"),
        description,
        amount,
        reference: emptyToNull(reference),
        statementLineRef: emptyToNull(reference),
        raw: { account: currentAccount, typeCode, line: rawLine },
      });
    }
  }

  if (transactions.length === 0) {
    warnings.push("No transaction detail lines were found in the BAI2 file.");
  }

  return {
    format: "bai2",
    accountIdentifier: currentAccount,
    warnings,
    metadata: {},
    transactions,
  };
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (inQuotes) invalidImport("Unterminated CSV quote");
  result.push(current);
  return result.map((value) => value.trim());
}

function findColumnIndex(headers: string[], override: string | undefined, candidates: string[]): number {
  if (override) {
    const overrideHeader = normalizeHeader(override);
    const overrideIdx = headers.indexOf(overrideHeader);
    if (overrideIdx !== -1) return overrideIdx;
    invalidImport(`Mapped column not found: ${override}`);
  }

  for (const candidate of candidates) {
    const idx = headers.indexOf(normalizeHeader(candidate));
    if (idx !== -1) return idx;
  }

  for (const candidate of candidates) {
    const needle = normalizeHeader(candidate);
    const idx = headers.findIndex((header) => !header.endsWith(" minor") && !header.endsWith(" exact") && header.includes(needle));
    if (idx !== -1) return idx;
  }

  return -1;
}

function normalizeHeader(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseOptionalAmount(value: string | null | undefined, currency: string): number | null {
  return value ? importMajor(value, currency) : null;
}

function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = raw.trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return value.slice(0, 10);
  if (/^\d{8}\d{6}(?:[.\[]|$)/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{14}\.\d{3}/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{8}T/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{6}$/.test(value)) {
    const year = Number(value.slice(0, 2));
    return `${year >= 70 ? 1900 + year : 2000 + year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  }

  const slash = value.split(/[\/.\-']/);
  if (slash.length === 3 && slash.every(part => /^\d+$/.test(part))) {
    const [a, b, c] = slash;
    const year = c.length === 2 ? String(Number(c) + 2000) : c;
    if (a.length === 4) {
      return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    }
    if (Number(a) > 12) {
      return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }
    return `${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }

  const named = value.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})$/);
  if (named) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(named[2].toLowerCase()) + 1;
    if (month) return `${named[3]}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  }

  return value;
}

function readOfxField(content: string, tag: string): string {
  const closing = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const closeMatch = content.match(closing);
  if (closeMatch) return closeMatch[1].trim();

  const sgml = new RegExp(`<${tag}>([^\\r\\n<]+)`, "i");
  const sgmlMatch = content.match(sgml);
  return sgmlMatch?.[1]?.trim() || "";
}

function splitOfxSegments(content: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|(?=<${tag}>|</BANKTRANLIST>|$))`, "gi");
  return Array.from(content.matchAll(regex)).map((match) => match[1]);
}

function matchXmlBlocks(content: string, tag: string): string[] {
  const regex = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "gi");
  return Array.from(content.matchAll(regex)).map((match) => match[0]);
}

function readXmlField(content: string, tag: string, index = 0): string {
  const regex = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "gi");
  const matches = Array.from(content.matchAll(regex));
  if (!matches[index]) return "";
  const inner = matches[index][1];
  return stripXmlTags(inner).trim();
}

function readXmlAttribute(content: string, tag: string, attribute: string): string {
  const regex = new RegExp(`<(?:\\w+:)?${tag}[^>]*\\b${attribute}="([^"]+)"[^>]*>`, "i");
  return content.match(regex)?.[1]?.trim() || "";
}

function joinXmlFields(content: string, tags: string[]): string {
  return tags
    .map((tag) => readXmlField(content, tag))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function findCamtBalance(blocks: string[], codes: string[], currency: string): number | null {
  for (const block of blocks) {
    const code = readXmlField(block, "Cd");
    if (codes.includes(code)) {
      const amount = readXmlField(block, "Amt");
      const code = readXmlAttribute(block, "Amt", "Ccy");
      if (code && code !== currency) invalidImport("Balance currency disagrees with bank account");
      const direction = readXmlField(block, "CdtDbtInd");
      if (!["DBIT", "CRDT"].includes(direction)) invalidImport("Missing or unknown CAMT balance sign");
      return (direction === "DBIT" ? -1 : 1) * importMajor(amount, currency);
    }
  }
  return null;
}

function parseSwiftTags(content: string): Array<{ code: string; value: string }> {
  const lines = content.split(/\r?\n/);
  const tags: Array<{ code: string; value: string }> = [];
  let current: { code: string; value: string } | null = null;

  for (const line of lines) {
    const match = line.match(/^:([0-9A-Z]{2,3}):(.+)$/);
    if (match) {
      if (current) tags.push(current);
      current = { code: match[1], value: match[2].trim() };
      continue;
    }
    if (current) {
      current.value += ` ${line.trim()}`;
    }
  }
  if (current) tags.push(current);
  return tags;
}

function parseMt61Line(value: string, currency: string): {
  date: string;
  amount: number;
  reference: string | null;
  description: string;
} | null {
  const match = value.match(/^(\d{6})(\d{4})?([RC]?)([DC])([A-Z])?([0-9,]+)N([A-Z0-9]{3})(.*)$/);
  if (!match) return null;
  const [, datePart, , reversal, direction, , amountPart, code, tail] = match;
  const amount = importMajor(amountPart.replace(",", "."), currency);
  const sign = direction === "D" ? -1 : 1;
  const reversalSign = reversal === "R" ? -1 : 1;
  const reference = tail.split("//")[1] || tail || null;
  return {
    date: normalizeDate(datePart),
    amount: sign * reversalSign * Math.abs(amount),
    reference: emptyToNull(reference),
    description: code,
  };
}

function parseMtBalanceDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^[DC](\d{6})/);
  return match ? normalizeDate(match[1]) : null;
}

function parseMtBalanceAmount(value: string | undefined, currency: string): number | null {
  if (!value) return null;
  const match = value.match(/^[DC]\d{6}([A-Z]{3})([0-9,]+)$/);
  if (!match || match[1] !== currency) invalidImport("Malformed or incompatible MT balance currency");
  return (value.startsWith("D") ? -1 : 1) * importMajor(match[2].replace(",", "."), currency);
}

function parseBai2Amount(value: string | undefined, typeCode: string): number {
  if (!value || !/^[+-]?\d+$/.test(value) || value.length > 30) invalidImport("BAI2 amounts must be integer minor units");
  const cents = legacyMinor(BigInt(value));
  return bai2IsCredit(typeCode) ? Math.abs(cents) : -Math.abs(cents);
}

function bai2IsCredit(typeCode: string): boolean {
  const code = Number(typeCode);
  if (Number.isNaN(code)) return true;
  if (code >= 100 && code < 400) return true;
  if (code >= 400 && code < 700) return false;
  if (code >= 700 && code < 900) return true;
  return false;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}


function normalizeProfileDate(raw: string, format: string) {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) invalidImport("Date does not match import profile");
  const [, a, b, year] = match;
  return `${year}-${(format === "DD/MM/YYYY" ? b : a).padStart(2, "0")}-${(format === "DD/MM/YYYY" ? a : b).padStart(2, "0")}`;
}
