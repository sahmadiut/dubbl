import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { customConfigSchema, customCsv, sources } from "./custom-wire";
import { runCustomReport, type CustomReportDb } from "./custom";
import type { AuthContext } from "@/lib/api/auth-context";
import { stringifyWire } from "@/lib/money/wire";
import { spreadsheetCell } from "@/lib/import-export/csv-utils";

/** Real saved-report data in literal integer units. XLSX money is text to avoid Excel's 15-digit limit. */
export async function generateScheduledAttachment(ctx: AuthContext, report: { name: string; config: unknown }, format: "csv" | "xlsx" | "pdf", reader?: CustomReportDb) {
  const config = customConfigSchema.parse(report.config);
  const { data } = await runCustomReport(ctx, config, reader);
  stringifyWire(data);
  const columns = [...config.columns];
  const money: readonly string[] = sources[config.dataSource].money;
  for (const name of money) if (columns.includes(name) && !columns.includes(`${name}Minor`)) columns.push(`${name}Minor`);
  const filename = `${report.name.replace(/[^a-zA-Z0-9]/g, "_")}.${format}`;
  if (format === "csv") return { filename, content: Buffer.from(customCsv(columns, data), "utf8") };
  if (format === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.addRow(columns);
    for (const row of data) sheet.addRow(columns.map(name => {
      const value = row[name];
      return spreadsheetCell(value, money.includes(name) || name.endsWith("Minor"));
    }));
    for (const column of sheet.columns) column.width = 24;
    return { filename, content: Buffer.from(await workbook.xlsx.writeBuffer()) };
  }
  // Vertical field/value rows keep arbitrary user-selected columns readable without narrowing money.
  const document = React.createElement(Document, null, React.createElement(Page, { size: "A4", style: { padding: 30, fontSize: 9 } },
    React.createElement(Text, { style: { fontSize: 16, marginBottom: 12 } }, report.name),
    React.createElement(Text, { style: { marginBottom: 12 } }, "Amounts are literal integer cents; Minor columns contain exact integer strings."),
    ...(data.length ? data : [Object.fromEntries(columns.map(name => [name, ""]))]).map((row, index) => React.createElement(View, { key: index, style: { marginBottom: 12 } },
      ...columns.map(name => React.createElement(Text, { key: name, style: { marginBottom: 3 } }, `${name}: ${String(row[name] ?? "")}`))))));
  return { filename, content: await renderToBuffer(document) };
}
