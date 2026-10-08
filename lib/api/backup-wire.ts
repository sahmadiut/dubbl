import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
import { z } from "zod";
import { exactMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { exactRate, fromLegacyRate, toLegacyRate } from "@/lib/currency/exact-rate";

// The catalog is the snapshot contract, not the entire application database.
export const backupEntities = {
  accounts: schema.chartAccount, contacts: schema.contact, invoices: schema.invoice,
  bills: schema.bill, journalEntries: schema.journalEntry, products: schema.inventoryItem,
  bankAccounts: schema.bankAccount, expenses: schema.expenseClaim, payments: schema.payment,
  quotes: schema.quote, creditNotes: schema.creditNote, debitNotes: schema.debitNote,
  purchaseOrders: schema.purchaseOrder, recurringTemplates: schema.recurringTemplate,
  projects: schema.project, budgets: schema.budget, fixedAssets: schema.fixedAsset,
  loans: schema.loan, taxRates: schema.taxRate, costCenters: schema.costCenter, documents: schema.document,
} satisfies Record<string, AnyPgTable>;
export const backupLines = {
  invoices: { table: schema.invoiceLine, parent: "invoiceId" },
  bills: { table: schema.billLine, parent: "billId" },
  journalEntries: { table: schema.journalLine, parent: "journalEntryId" },
  quotes: { table: schema.quoteLine, parent: "quoteId" },
  creditNotes: { table: schema.creditNoteLine, parent: "creditNoteId" },
  debitNotes: { table: schema.debitNoteLine, parent: "debitNoteId" },
  purchaseOrders: { table: schema.purchaseOrderLine, parent: "purchaseOrderId" },
} satisfies Record<string, { table: AnyPgTable; parent: string }>;
// References without physical foreign keys still require the same ownership checks.
export const backupSoftReferences: Record<string, AnyPgTable> = {
  projectId: schema.project, convertedInvoiceId: schema.invoice,
  reversedByEntryId: schema.journalEntry, reversesEntryId: schema.journalEntry,
};
export const backupSourceReferences: Record<string, AnyPgTable> = {
  invoice: schema.invoice, bill: schema.bill, expense: schema.expenseClaim,
  payment: schema.payment, quote: schema.quote, credit_note: schema.creditNote,
  debit_note: schema.debitNote, purchase_order: schema.purchaseOrder,
  journal_entry: schema.journalEntry, project: schema.project,
};
export type BackupRow = Record<string, unknown> & { id: string };
export type BackupSnapshot = { version: 1 | 2; organizationId: string; createdAt: string; entities: Record<string, BackupRow[]> };
export function invalidBackup(message: string): never {
  throw new z.ZodError([{ code: "custom", path: [], message: `Invalid backup: ${message}` }]);
}

export function moneyColumns(table: AnyPgTable) {
  return Object.entries(getTableColumns(table)).filter(([, column]) => column.getSQLType() === "bigint").map(([key]) => key);
}

/** Additive aliases retain the schema's stored units, including legacy scaled prices. */
export function backupRowDto(table: AnyPgTable, input: Record<string, unknown>): Record<string, unknown> {
  const row = { ...input };
  for (const key of moneyColumns(table)) {
    if (row[key] == null) { row[`${key}Minor`] = row[key]; continue; }
    const value = typeof row[key] === "bigint" ? row[key] as bigint : BigInt(z.number().int().safe().parse(row[key]));
    row[key] = legacyMinor(value); row[`${key}Minor`] = exactMinorSchema.parse(value.toString());
  }
  return row;
}

function parseRow(table: AnyPgTable, input: unknown, orgId: string, version: number, parent?: { key: string; id: string }): BackupRow {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalidBackup("record must be an object");
  const row = { ...input } as BackupRow;
  const columns = getTableColumns(table), money = new Set(moneyColumns(table));
  const allowed = new Set([...Object.keys(columns), ...[...money].map(key => `${key}Minor`)]);
  for (const key of Object.keys(row)) if (!allowed.has(key)) invalidBackup(`unknown ${getTableName(table)} field ${key}`);
  z.string().uuid().parse(row.id);
  if (columns.organizationId && row.organizationId !== orgId) invalidBackup("record organization does not match snapshot");
  if (parent && row[parent.key] !== parent.id) invalidBackup("line parent does not match enclosing record");
  for (const [key, column] of Object.entries(columns)) {
    let value = row[key];
    if (money.has(key)) {
      const alias = row[`${key}Minor`];
      if (value === null && alias != null) invalidBackup(`${key} and ${key}Minor disagree`);
      if (alias === null && value != null) invalidBackup(`${key} and ${key}Minor disagree`);
      if (alias === null && value === undefined) { value = null; row[key] = null; }
      if (version === 2 && !Object.hasOwn(row, `${key}Minor`)) invalidBackup(`missing ${key}Minor`);
      if (alias !== undefined && alias !== null) {
        const exact = BigInt(exactMinorSchema.parse(alias));
        if (value !== undefined && value !== null && BigInt(z.number().int().safe().parse(value)) !== exact) invalidBackup(`${key} and ${key}Minor disagree`);
        value = legacyMinor(exact); row[key] = value;
      } else if (version === 2 && value != null) invalidBackup(`missing ${key}Minor`);
      if (value != null) z.number().int().safe().parse(value);
      if ((value == null) && alias != null) invalidBackup(`invalid ${key}Minor`);
      delete row[`${key}Minor`];
    }
    if (value === undefined) {
      if (column.notNull && !column.hasDefault) invalidBackup(`missing ${key}`);
      continue;
    }
    if (value === null) { if (column.notNull) invalidBackup(`${key} cannot be null`); continue; }
    const type = column.getSQLType();
    if (type === "uuid") z.string().uuid().parse(value);
    else if (type === "integer") z.number().int().min(-2147483648).max(2147483647).parse(value);
    else if (type === "boolean") z.boolean().parse(value);
    else if (type === "numeric") {
      try { row[key] = exactRate(z.string().parse(value)); } catch { invalidBackup(`invalid ${key} decimal`); }
    }
    else if (type === "date") {
      const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(value);
      const parsed = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) invalidBackup(`invalid ${key}`);
    } else if (type.startsWith("timestamp")) {
      const date = z.string().datetime({ offset: true }).parse(value); row[key] = new Date(date);
    } else if (column.enumValues?.length) z.enum(column.enumValues as [string, ...string[]]).parse(value);
    else if (type === "text" || type.startsWith("varchar")) z.string().parse(value);
  }
  if (columns.exchangeRate) {
    let legacy: string;
    try { legacy = fromLegacyRate(z.number().int().parse(row.exchangeRate)); } catch { invalidBackup("invalid legacy FX millionths"); }
    if (row.rateExact != null) {
      try { toLegacyRate(row.rateExact as string); } catch { throw new WireCompatibilityError("Exact FX requires a consumer cutover before snapshot restoration"); }
      if (row.rateExact !== legacy) invalidBackup("legacy and exact FX disagree");
    }
    if (row.rateDirection !== undefined && row.rateDirection !== "quote_per_base") invalidBackup("unsupported FX direction");
  }
  return row;
}

// JSON.parse can round a numeric token into a seemingly safe integer (e.g. a
// fractional token near MAX_SAFE_INTEGER). Reject that before schema validation.
function validateNumberTokens(json: string) {
  const canonical = (token: string) => {
    const [mantissa, exponent = "0"] = token.toLowerCase().split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    let digits = (whole + fraction).replace(/^(-?)0+/, "$1");
    let scale = Number(exponent) - fraction.length;
    if (!Number.isSafeInteger(scale) || Math.abs(scale) > 10000) invalidBackup("unsupported numeric exponent");
    if (!digits || digits === "-" || /^-?0+$/.test(digits)) return "0";
    while (digits.endsWith("0")) { digits = digits.slice(0, -1); scale++; }
    return `${digits}e${scale}`;
  };
  for (const match of json.matchAll(/"(?:[^"\\]|\\[\s\S])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)) {
    if (!match[1]) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || canonical(match[1]) !== canonical(String(value))) throw new WireCompatibilityError("Backup numeric token cannot be represented losslessly; use an exact string field");
  }
}

export function parseBackupSnapshot(json: string, orgId: string): BackupSnapshot {
  if (Buffer.byteLength(json, "utf8") > 20 * 1024 * 1024) invalidBackup("maximum file size is 20 MiB");
  let input: unknown; try { input = JSON.parse(json); } catch { invalidBackup("invalid JSON"); }
  validateNumberTokens(json);
  // Reject unsafe numeric leaves even in opaque JSON, without interpreting or rewriting their units.
  stringifyWire(input);
  const header = z.object({ version: z.union([z.literal(1), z.literal(2)]), organizationId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }), entities: z.record(z.string(), z.array(z.unknown())) }).strict().parse(input);
  if (header.organizationId !== orgId) invalidBackup("snapshot belongs to another organization");
  const entities: Record<string, BackupRow[]> = {};
  for (const key of Object.keys(header.entities)) if (!Object.hasOwn(backupEntities, key)) invalidBackup(`unknown entity ${key}`);
  for (const [key, table] of Object.entries(backupEntities)) {
    if (!header.entities[key]) invalidBackup(`missing entity ${key}`);
    const ids = new Set<string>();
    const lineSpec = backupLines[key as keyof typeof backupLines];
    const lineIds = new Set<string>();
    entities[key] = header.entities[key].map(input => {
      const raw = { ...input as Record<string, unknown> }, lines = raw.lines; delete raw.lines;
      const row = parseRow(table, raw, orgId, header.version);
      if (ids.has(row.id)) invalidBackup(`duplicate ${key} id`); ids.add(row.id);
      if (lineSpec) {
        if (!Array.isArray(lines)) invalidBackup(`missing ${key} lines`);
        row.lines = lines.map(line => {
          const parsed = parseRow(lineSpec.table, line, orgId, header.version, { key: lineSpec.parent, id: row.id });
          if (lineIds.has(parsed.id)) invalidBackup(`duplicate ${key} line id`); lineIds.add(parsed.id); return parsed;
        });
      } else if (lines !== undefined) invalidBackup(`unsupported ${key} lines`);
      return row;
    });
  }
  return { ...header, entities };
}

export function snapshotRows(snapshot: BackupSnapshot) {
  return Object.entries(backupEntities).flatMap(([key, table]) => {
    const lines = backupLines[key as keyof typeof backupLines];
    return [{ key, table: table as AnyPgTable, rows: snapshot.entities[key] }, ...(lines ? [{ key: `${key}.lines`, table: lines.table as AnyPgTable,
      rows: snapshot.entities[key].flatMap(row => row.lines as BackupRow[]) }] : [])];
  });
}

export function orderedSnapshotRows(snapshot: BackupSnapshot) {
  const pending = snapshotRows(snapshot).flatMap(({ table, rows }) => rows.map(row => ({ table, row })));
  const result: typeof pending = [];
  while (pending.length) {
    const index = pending.findIndex(({ table, row }) => getTableConfig(table).foreignKeys.every(fk => {
      const ref = fk.reference(), columns = getTableColumns(table);
      const prop = Object.entries(columns).find(([, col]) => col.name === ref.columns[0].name)![0];
      return !pending.some(candidate => getTableName(candidate.table) === getTableName(ref.foreignTable) && candidate.row.id === row[prop]);
    }));
    if (index < 0) invalidBackup("cyclic snapshot references are unsupported");
    result.push(pending.splice(index, 1)[0]);
  }
  return result;
}

export { getTableConfig };
