import { z } from "zod";
import { reportDateSchema } from "./statement-wire";

export const sources = {
  invoices: { fields: ["id", "invoiceNumber", "contactName", "status", "issueDate", "dueDate", "subtotal", "taxTotal", "total", "amountPaid", "amountDue", "currencyCode"], money: ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"], numbers: [], date: "issueDate" },
  contacts: { fields: ["id", "name", "email", "type", "phone", "paymentTermsDays", "creditLimit", "currencyCode"], money: ["creditLimit"], numbers: ["paymentTermsDays"], date: null },
  inventory: { fields: ["id", "code", "name", "category", "purchasePrice", "salePrice", "quantityOnHand", "reorderPoint", "isActive", "currencyCode"], money: ["purchasePrice", "salePrice"], numbers: ["quantityOnHand", "reorderPoint"], date: null },
  transactions: { fields: ["id", "date", "description", "amount", "status", "payee", "currencyCode"], money: ["amount"], numbers: [], date: "date" },
  expenses: { fields: ["id", "title", "status", "totalAmount", "currencyCode", "submittedAt", "approvedAt"], money: ["totalAmount"], numbers: [], date: "submittedAt" },
  payroll: { fields: ["id", "employeeName", "payPeriodStart", "payPeriodEnd", "type", "grossAmount", "taxAmount", "deductions", "netAmount", "currencyCode"], money: ["grossAmount", "taxAmount", "deductions", "netAmount"], numbers: [], date: "payPeriodStart" },
} as const;

const field = z.string().min(1).max(80).describe("Allowlisted source column or monetary Minor alias");
export const customConfigSchema = z.object({
  dataSource: z.enum(["invoices", "expenses", "transactions", "payroll", "inventory", "contacts"]).describe("Scoped data source; payroll and expenses are supported by run and export"),
  filters: z.array(z.object({
    field,
    operator: z.enum(["equals", "contains", "gt", "lt", "gte", "lte"]).describe("Equality/text contains, or numeric comparison for money/count/quantity fields"),
    value: z.string().max(4096).describe("Literal string; money comparisons require canonical signed integer cents, including Minor aliases"),
  }).strict().describe("One filter; all filters are combined with AND")).max(50).default([]).describe("Up to 50 validated filters applied before projection and export"),
  groupBy: z.array(field).max(0, "Grouping is not supported").default([]).describe("Must be empty; grouped aggregation is not supported"),
  columns: z.array(field).min(1).max(40).describe("Unique source columns; selected money adds its exact Minor sibling"),
  dateRange: z.object({ from: reportDateSchema, to: reportDateSchema }).strict().optional().describe("Inclusive Gregorian range on issueDate/date/submittedAt UTC/payPeriodStart; unavailable for contacts/inventory"),
  chartType: z.enum(["table", "bar", "line", "pie"]).optional().describe("Presentation hint preserved in saved configuration; does not aggregate rows"),
}).strict().superRefine((config, ctx) => {
  const source = sources[config.dataSource];
  const fields: readonly string[] = [...source.fields, ...source.money.map(name => `${name}Minor`)];
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(config.columns).size !== config.columns.length) issue("Columns must be unique");
  for (const name of [...config.columns, ...config.filters.map(filter => filter.field)])
    if (!fields.includes(name)) issue(`Unsupported ${config.dataSource} field: ${name}`);
  if (config.dateRange && (!source.date || config.dateRange.from > config.dateRange.to)) issue("Unsupported or reversed date range");
  for (const filter of config.filters) {
    const base = filter.field.endsWith("Minor") ? filter.field.slice(0, -5) : filter.field;
    const monetary = (source.money as readonly string[]).includes(base);
    const numeric = (source.numbers as readonly string[]).includes(base);
    if (monetary) {
      if (filter.operator === "contains" || !/^(0|-?[1-9]\d*)$/.test(filter.value) ||
        (filter.value.length > 17 || BigInt(filter.value) < -BigInt(Number.MAX_SAFE_INTEGER) || BigInt(filter.value) > BigInt(Number.MAX_SAFE_INTEGER)))
        issue("Money filter requires a canonical safe signed integer in cents and cannot use contains");
    } else if (!["equals", "contains"].includes(filter.operator)) {
      if (!numeric || !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(filter.value) || !Number.isFinite(Number(filter.value)) || Math.abs(Number(filter.value)) > Number.MAX_SAFE_INTEGER)
        issue("Ordered comparison requires a safe numeric source field and decimal literal");
    }
  }
});

export const savedReportIdSchema = z.string().uuid().describe("UUID of a live saved report in the current organization");
export const createSavedReportSchema = z.object({
  name: z.string().min(1).max(200).describe("Nonempty report name, up to 200 characters"),
  description: z.string().max(4096).nullable().optional().describe("Optional description, up to 4096 characters; null clears it"),
  config: customConfigSchema.describe("Validated custom-report configuration; strings retain their literal values"),
}).strict();
export const updateSavedReportSchema = createSavedReportSchema.partial().refine(value => Object.keys(value).length > 0, "Provide a report field to update");

export function customCsv(columns: string[], rows: Record<string, unknown>[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.map(cell).join(","), ...rows.map(row => columns.map(name => cell(row[name])).join(","))].join("\n");
}
